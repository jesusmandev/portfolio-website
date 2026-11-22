import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { abs, color, float, Fn, hash, instancedArray, instanceIndex, materialNormal, max, mix, mod, modelViewMatrix, normalWorld, positionGeometry, remapClamp, rotateUV, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { remap } from '../utilities/maths.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class Leaves
{
    constructor()
    {
        this.game = Game.getInstance()

        // if(this.game.yearCycles.properties.leaves.value < 0.25)
        //     return

        const power = Math.round(remap((this.game.yearCycles.properties.leaves.value), 0.25, 1, 7, 11))
        this.count = Math.pow(2, power)
        // this.count = Math.pow(2, 12)

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🍃 Leaves',
                expanded: false,
            })
        }

        this.setGeometry()
        this.setMaterial()
        this.setMesh()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setGeometry()
    {
        // Geometría 3D realista de hoja botánica con pecíolo (tallo), silueta orgánica,
        // nervadura central en V y curvatura longitudinal natural (ultra ligera: 22 triángulos).
        const positions = []
        const uvs = []
        const indices = []

        // Secciones transversales desde la base del pecíolo hasta la punta de la hoja:
        // [ z (largo), halfWidth (ancho medio), midY (altura nervio central), edgeY (altura borde), v (UV) ]
        const sections = [
            // Tallo / pecíolo delgado
            [ -0.76, 0.032, 0.035, 0.038, 0.00 ],
            [ -0.52, 0.042, 0.015, 0.022, 0.14 ],
            // Base redondeada de la lámina
            [ -0.40, 0.210, 0.006, 0.042, 0.24 ],
            // Cuerpo ancho inferior
            [ -0.18, 0.365, 0.020, 0.088, 0.42 ],
            // Zona media más ancha (ligera muesca/curva orgánica)
            [  0.08, 0.385, 0.036, 0.105, 0.60 ],
            // Estrechamiento superior
            [  0.34, 0.275, 0.032, 0.082, 0.78 ],
            // Sub-punta
            [  0.56, 0.125, 0.016, 0.038, 0.91 ],
        ]

        // Agregar filas de 3 vértices por sección: [izquierda, centro (nervio), derecha]
        for(let i = 0; i < sections.length; i++)
        {
            const [ z, hw, midY, edgeY, v ] = sections[i]

            // Izquierda
            positions.push(-hw, edgeY, z)
            uvs.push(0.0, v)

            // Centro (nervio central)
            positions.push(0.0, midY, z)
            uvs.push(0.5, v)

            // Derecha
            positions.push(hw, edgeY, z)
            uvs.push(1.0, v)
        }

        // Vértice final de la punta afilada de la hoja
        const tipIndex = sections.length * 3
        positions.push(0.0, 0.002, 0.76)
        uvs.push(0.5, 1.0)

        // Conectar quads entre secciones consecutivas (4 triángulos por segmento, 2 a cada lado del nervio)
        for(let i = 0; i < sections.length - 1; i++)
        {
            const r0 = i * 3
            const r1 = (i + 1) * 3

            // Mitad izquierda (L0, M0, M1, L1)
            indices.push(r0 + 0, r0 + 1, r1 + 1)
            indices.push(r0 + 0, r1 + 1, r1 + 0)

            // Mitad derecha (M0, R0, R1, M1)
            indices.push(r0 + 1, r0 + 2, r1 + 2)
            indices.push(r0 + 1, r1 + 2, r1 + 1)
        }

        // Conectar última sección con la punta (2 triángulos)
        const lastRow = (sections.length - 1) * 3
        indices.push(lastRow + 0, lastRow + 1, tipIndex)
        indices.push(lastRow + 1, lastRow + 2, tipIndex)

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
        this.geometry.setIndex(indices)
        this.geometry.computeVertexNormals()
    }

    setMaterial()
    {
        // Uniforms
        this.focusPoint = uniform(vec2())
        this.vehicleVelocity = uniform(vec3())
        this.vehiclePosition = uniform(vec3())
        this.scale = uniform(0.38)
        this.rotationFrequency = uniform(3)
        this.rotationElevationMultiplier = uniform(1)
        this.pushSidewaysMultiplier = uniform(20)
        this.pushMultiplier = uniform(100)
        this.windFrequency = uniform(0.005)
        this.windMultiplier = uniform(0.5)
        this.upwardMultiplier = uniform(1)
        this.defaultDamping = uniform(1.5)
        this.waterDamping = uniform(0.75)
        this.gravity = uniform(9.807)
        this.explosion = uniform(vec4(0))
        this.tornado = uniform(vec4(75.34, -27.95, 14.0, 1.0))

        // Buffers
        this.positionBuffer = instancedArray(this.count, 'vec3')
        this.velocityBuffer = instancedArray(this.count, 'vec3')

        // Base rotation buffer
        const baseRotationArray = new Float32Array(this.count)
        for(let i = 0; i < this.count; i++)
            baseRotationArray[i] = Math.random() * Math.PI * 2
        const baseRotationBuffer = instancedArray(baseRotationArray, 'float').toAttribute()
        
        // Scale
        const scaleArray = new Float32Array(this.count)
        for(let i = 0; i < this.count; i++)
            scaleArray[i] = Math.random() * 0.5 + 0.55
        const scaleBuffer = instancedArray(scaleArray, 'float').toAttribute()
        
        // Weight
        const weightArray = new Float32Array(this.count)
        for(let i = 0; i < this.count; i++)
            weightArray[i] = Math.random() * 0.1 + 0.1
        const weightBuffer = instancedArray(weightArray, 'float')

        // Paleta multicolor natural por instancia: Naranja, Verde, Azul, Amarillo y Rojo
        const palettePairs = [
            [ new THREE.Color('#d94e14'), new THREE.Color('#ff8c2e') ], // Naranja
            [ new THREE.Color('#84e812'), new THREE.Color('#c4ff2e') ], // Verde limón
            [ new THREE.Color('#196ee6'), new THREE.Color('#38c6ff') ], // Azul
            [ new THREE.Color('#e0a80b'), new THREE.Color('#ffe047') ], // Amarillo
            [ new THREE.Color('#b81d2b'), new THREE.Color('#f43f54') ], // Rojo
        ]
        const colorArray = new Float32Array(this.count * 3)
        const tmpColor = new THREE.Color()
        for(let i = 0; i < this.count; i++)
        {
            const pair = palettePairs[Math.floor(Math.random() * palettePairs.length)]
            tmpColor.copy(pair[0]).lerp(pair[1], Math.random())
            colorArray[i * 3 + 0] = tmpColor.r
            colorArray[i * 3 + 1] = tmpColor.g
            colorArray[i * 3 + 2] = tmpColor.b
        }
        const instanceColorBuffer = instancedArray(colorArray, 'vec3').toAttribute()

        const colorNode = Fn(() =>
        {
            const leafUv = uv()
            const distFromMid = abs(leafUv.x.sub(0.5)).mul(2.0) // 0 en nervio central, 1 en borde

            // Nervio central sutil + venas diagonales + tallo más oscuro + bordes ligeramente iluminados
            const isStem = smoothstep(0.22, 0.12, leafUv.y)
            const midrib = smoothstep(0.14, 0.0, distFromMid).mul(smoothstep(0.14, 0.24, leafUv.y))
            const lateralVeins = sin(leafUv.y.mul(22.0).sub(distFromMid.mul(9.0))).mul(0.5).add(0.5)
            const veinMask = smoothstep(0.75, 0.98, lateralVeins).mul(smoothstep(0.18, 0.30, leafUv.y)).mul(smoothstep(0.95, 0.6, leafUv.y))

            const baseCol = instanceColorBuffer.toVar()
            // Oscurecer ligeramente el tallo/pecíolo
            const stemCol = baseCol.mul(0.58)
            baseCol.assign(mix(baseCol, stemCol, isStem))
            // Resaltar sutilmente el nervio central y venas laterales
            baseCol.assign(mix(baseCol, baseCol.mul(1.22).add(vec3(0.05)), midrib.mul(0.55).add(veinMask.mul(0.22))))
            // Ligero degradado hacia la punta
            const tipShade = mix(float(0.9), float(1.12), smoothstep(0.2, 0.95, leafUv.y))

            return baseCol.mul(tipShade)
        })()

        // Normal buffer
        const normalArray = new Float32Array(this.count * 3)
        for(let i = 0; i < this.count; i++)
        {
            const normal = new THREE.Vector3(0, 1, 0)
            normal.applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 2)
            normal.applyAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * 2)
            normal.toArray(normalArray, i * 3)
        }
        const normalBuffer = instancedArray(normalArray, 'vec3').toAttribute()

        this.material = new MeshDefaultMaterial({
            side: THREE.DoubleSide,
            colorNode: colorNode,
            normalNode: normalWorld,
            hasWater: false,
            transparent: true
        })

        // Position
        this.material.positionNode = Fn(() =>
        {
            // Normal
            materialNormal.assign(modelViewMatrix.mul(vec4(normalBuffer, 0)))

            // Position
            const leavePosition = this.positionBuffer.toAttribute()

            // Ocultar hojas caídas dentro de la cancha de fútbol y de baloncesto
            const soccerMin = uniform(new THREE.Vector2(-19.0 - 16.5, -5.0 - 10.75))
            const soccerMax = uniform(new THREE.Vector2(-19.0 + 16.5, -5.0 + 10.75))
            const basketMin = uniform(new THREE.Vector2(-37.415 - 7.4, -54.505 - 14.6))
            const basketMax = uniform(new THREE.Vector2(-37.415 + 7.4, -54.505 + 14.6))
            const inFieldX = step(soccerMin.x, leavePosition.x).mul(step(leavePosition.x, soccerMax.x))
            const inFieldZ = step(soccerMin.y, leavePosition.z).mul(step(leavePosition.z, soccerMax.y))
            const inBasketX = step(basketMin.x, leavePosition.x).mul(step(leavePosition.x, basketMax.x))
            const inBasketZ = step(basketMin.y, leavePosition.z).mul(step(leavePosition.z, basketMax.y))
            const inProtectedField = inFieldX.mul(inFieldZ).add(inBasketX.mul(inBasketZ)).clamp(0, 1)
            const notInSoccerField = inProtectedField.oneMinus()
            const groundDrop = inProtectedField.mul(-20.0)

            const newPosition = positionGeometry.mul(scaleBuffer).mul(this.scale).mul(notInSoccerField)

            const rotationMultiplier = max(leavePosition.y.mul(this.rotationElevationMultiplier), 0)
            
            const rotationZ = sin(leavePosition.x.mul(this.rotationFrequency)).mul(rotationMultiplier)
            const rotationX = sin(leavePosition.z.mul(this.rotationFrequency)).mul(rotationMultiplier)
            const rotationY = baseRotationBuffer

            newPosition.xy.assign(rotateUV(newPosition.xy, rotationZ, vec2(0)))
            newPosition.yz.assign(rotateUV(newPosition.yz, rotationX, vec2(0)))
            newPosition.xz.assign(rotateUV(newPosition.xz, rotationY, vec2(0)))

            return newPosition.add(leavePosition).add(vec3(0, groundDrop, 0))
        })()

        this.size = float(this.game.view.optimalArea.radius * 2)

        // Init
        const init = Fn(() =>
        {
            // Position
            const position = this.positionBuffer.element(instanceIndex)
            
            position.assign(vec3(
                hash(instanceIndex).sub(0.5).mul(this.size),
                0,
                hash(instanceIndex.add(1)).sub(0.5).mul(this.size)
            ))

            const noiseUv = position.xz.mul(0.02)
            const noise = texture(this.game.noises.perlin, noiseUv).r
            position.x.addAssign(noise.mul(15))
        })()
        const initCompute = init.compute(this.count)

        this.game.rendering.renderer.computeAsync(initCompute)

        // Update
        const update = Fn(() =>
        {
            const position = this.positionBuffer.element(instanceIndex)
            const velocity = this.velocityBuffer.element(instanceIndex)
            const weight = weightBuffer.element(instanceIndex)

            // Terrain
            // const terrainUv = this.game.terrain.worldPositionToUvNode(position.xz)
            const terrainData = this.game.terrain.terrainNode(position.xz)
            
            // Push from vehicle
            const vehicleDelta = position.sub(this.vehiclePosition)

            const pushSideways = vec3(vehicleDelta.x, 0, vehicleDelta.z).normalize().mul(this.pushSidewaysMultiplier)

            const pushVelocity = vec3(this.vehicleVelocity.x, 0, this.vehicleVelocity.z).mul(this.pushMultiplier)

            const distanceToVehicle = vehicleDelta.length()
            const vehicleMultiplier = distanceToVehicle.remapClamp(0.5, 2, 1, 0)
            const speedMultiplier = this.vehicleVelocity.length()
            const vehiclePush = pushVelocity.add(pushSideways).mul(speedMultiplier).mul(vehicleMultiplier)//.mul(inverseWeight)

            velocity.addAssign(vehiclePush)

            // Wind
            const noiseUv = position.xz.mul(this.windFrequency).add(this.game.wind.direction.mul(this.game.wind.localTime)).xy
            const noise = texture(this.game.noises.perlin, noiseUv).r

            const windStrength = this.game.wind.strength.sub(noise).mul(weight).mul(this.windMultiplier).max(0)
            velocity.x.addAssign(this.game.wind.direction.x.mul(windStrength))
            velocity.z.addAssign(this.game.wind.direction.y.mul(windStrength))

            // Explosion
            const explosionDelta = position.xz.sub(this.explosion.xy)
            const distanceToExplosion = explosionDelta.length()
            const explosionMultiplier = distanceToExplosion.remapClamp(this.explosion.z.mul(0.5), this.explosion.z.mul(1), 0.2, 0)
            const explosionDirection = vec2(explosionDelta.x, explosionDelta.y)
            const explosionPush = explosionDirection.mul(explosionMultiplier).mul(this.explosion.a)
            
            velocity.addAssign(vec3(explosionPush.x, 0, explosionPush.y))

            // Tornado vortex suction and swirl
            const tornadoDelta = position.xz.sub(this.tornado.xy)
            const tornadoDistance = tornadoDelta.length()
            const tornadoInfluence = tornadoDistance.remapClamp(this.tornado.z, float(1.5), 0, 1)

            const normDelta = tornadoDelta.normalize()
            const pullVector = normDelta.negate()
            const tangentVector = vec2(normDelta.y.negate(), normDelta.x)
            const tornadoSwirl = tangentVector.mul(32.0).add(pullVector.mul(18.0))

            velocity.x.addAssign(tornadoSwirl.x.mul(tornadoInfluence).mul(this.tornado.w))
            velocity.z.addAssign(tornadoSwirl.y.mul(tornadoInfluence).mul(this.tornado.w))
            velocity.y.addAssign(tornadoInfluence.mul(20.0).mul(this.tornado.w))

            // Upward fly
            const upwardDim = position.y.remapClamp(0, 6, 1, 0)
            velocity.y = velocity.xz.length().min(2).mul(this.upwardMultiplier).mul(upwardDim)

            // Damping
            const groundDamping = terrainData.b.remapClamp(0.4, 0, this.waterDamping, this.defaultDamping) // Low on water
            const inTheAirDamping = step(0.05, position.y).mul(this.defaultDamping) // High in the air
            const damping = max(groundDamping, inTheAirDamping).mul(this.game.ticker.deltaScaledUniform)
            velocity.mulAssign(float(1).sub(damping))

            // Gravity
            velocity.y = velocity.y.sub(this.gravity.mul(weight))

            // Apply velocity
            position.addAssign(velocity.mul(this.game.ticker.deltaScaledUniform))

            // Clamp to floor / water (las hojas flotan encima del agua cuando sube el nivel por la lluvia)
            const terrainWaterY = terrainData.b.remapClamp(0.02, 0.13, 0, this.game.water.surfaceElevationUniform)
            const floorY = max(terrainWaterY, this.game.water.surfaceElevationUniform).add(0.02)
            position.y.assign(max(position.y, floorY))

            // Loop
            const halfSize = this.size.mul(0.5)
            position.x.assign(mod(position.x.add(halfSize).sub(this.focusPoint.x), this.size).sub(halfSize).add(this.focusPoint.x))
            position.z.assign(mod(position.z.add(halfSize).sub(this.focusPoint.y), this.size).sub(halfSize).add(this.focusPoint.y))
        })()
        this.updateCompute = update.compute(this.count)

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(this.scale, 'value', { label: 'scale', min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this.rotationFrequency, 'value', { label: 'rotationFrequency', min: 0, max: 20, step: 0.001 })
            this.debugPanel.addBinding(this.rotationElevationMultiplier, 'value', { label: 'rotationElevationMultiplier', min: 0, max: 2, step: 0.001 })
            this.debugPanel.addBinding(this.pushSidewaysMultiplier, 'value', { label: 'pushSidewaysMultiplier', min: 0, max: 300, step: 1 })
            this.debugPanel.addBinding(this.pushMultiplier, 'value', { label: 'pushMultiplier', min: 0, max: 300, step: 1 })
            this.debugPanel.addBinding(this.windFrequency, 'value', { label: 'windFrequency', min: 0, max: 0.02, step: 0.00001 })
            this.debugPanel.addBinding(this.windMultiplier, 'value', { label: 'windMultiplier', min: 0, max: 10, step: 0.0001 })
            this.debugPanel.addBinding(this.upwardMultiplier, 'value', { label: 'upwardMultiplier', min: 0, max: 10, step: 0.01 })
            this.debugPanel.addBinding(this.defaultDamping, 'value', { label: 'defaultDamping', min: 0, max: 10, step: 0.01 })
            this.debugPanel.addBinding(this.waterDamping, 'value', { label: 'waterDamping', min: 0, max: 10, step: 0.01 })
            this.debugPanel.addBinding(this.gravity, 'value', { label: 'gravity', min: 0, max: 20, step: 0.01 })
        }
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.count = this.count
        this.mesh.frustumCulled = false
        this.mesh.castShadow = true
        this.mesh.receiveShadow = true
        this.mesh.renderOrder = 2
        this.game.scene.add(this.mesh)
    }

    explode(coordinates, radius)
    {
        this.explosion.value.x = coordinates.x // X
        this.explosion.value.y = coordinates.z // Z
        this.explosion.value.z = radius // Radius
        this.explosion.value.w = 20 // Strength
    }

    update()
    {
        this.focusPoint.value.set(this.game.view.optimalArea.position.x, this.game.view.optimalArea.position.z)

        this.vehicleVelocity.value.copy(this.game.physicalVehicle.velocity)
        this.vehiclePosition.value.copy(this.game.physicalVehicle.position)
        this.game.rendering.renderer.computeAsync(this.updateCompute)

        this.explosion.value.w = 0 // Reset potential explosion

    }
}