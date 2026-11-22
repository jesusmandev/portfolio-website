import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { cameraPosition, color, cos, dot, float, Fn, max, mix, normalize, positionLocal, positionWorld, pow, reflect, sin, smoothstep, step, texture, uniform, vec2, vec3, vec4 } from 'three/tsl'
import { lerp, remapClamp } from '../utilities/maths.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class WaterSurface
{
    constructor()
    {
        this.game = Game.getInstance()

        this.hasRipples = false
        this.hasIce = false
        this.hasSplashes = false

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌊 Water surface',
                expanded: false,
            })

            this.iceDebugPanel = this.debugPanel.addFolder({
                title: 'Ice',
                expanded: true,
            })
        }

        this.setGeometry()
        this.setNodes()
        this.setMaterial()
        this.setMesh()
        this.setIce()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setGeometry()
    {
        this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
        this.geometry.rotateX(- Math.PI * 0.5)
    }

    setNodes()
    {
        this.iceRatio = uniform(0)
        this.iceRatioBinding = this.game.debug.addManualBinding(
            this.iceDebugPanel,
            this.iceRatio,
            'value',
            { label: 'iceRatio', min: 0, max: 1, step: 0.001 },
            () =>
            {
                return remapClamp(this.game.weather.temperature.value, 0, -5, 0, 1)
            }
        )

        this.waterColorUniform = uniform(color('#0f6b86'))
        this.sunColorUniform = uniform(color('#ffffff'))
        this.foamColorUniform = uniform(color('#f0f7ff'))
        this.waveSizeUniform = uniform(1.8)

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.waterColorUniform.value, 'waterColor')
            this.debugPanel.addBinding(this.waveSizeUniform, 'value', { label: 'waveScale', min: 0.2, max: 15, step: 0.1 })
        }
    }

    setMaterial()
    {
        const time = this.game.ticker.elapsedScaledUniform
        const waterNormalsTex = this.game.resources.waterNormalsTexture

        // Diseño de lago tranquilo de Water.js (sin olas 3D ni oleaje brusco)
        const colorNode = Fn(() =>
        {
            const terrainData = this.game.terrain.terrainNode(positionWorld.xz)

            // 4 capas suaves de normal map (getNoise de Water.js con escala amplia de lago calmo)
            const wpUv = positionWorld.xz.mul(this.waveSizeUniform)
            const uv0 = wpUv.div(103.0).add(vec2(time.div(17.0), time.div(29.0)))
            const uv1 = wpUv.div(107.0).sub(vec2(time.div(-19.0), time.div(31.0)))
            const uv2 = wpUv.div(vec2(8907.0, 9803.0)).add(vec2(time.div(101.0), time.div(97.0)))
            const uv3 = wpUv.div(vec2(1091.0, 1027.0)).sub(vec2(time.div(109.0), time.div(-113.0)))

            const noise = texture(waterNormalsTex, uv0)
                .add(texture(waterNormalsTex, uv1))
                .add(texture(waterNormalsTex, uv2))
                .add(texture(waterNormalsTex, uv3))
                .mul(0.5)
                .sub(1.0)

            const surfaceNormal = normalize(vec3(noise.x.mul(1.2), noise.z, noise.y.mul(1.2)))

            // Iluminación solar y reflejo especular (sunLight de Water.js)
            const eyeDirection = normalize(cameraPosition.sub(positionWorld))
            const sunDir = normalize(vec3(0.70707, 0.70707, 0.0))

            const reflection = normalize(reflect(sunDir.negate(), surfaceNormal))
            const specDir = max(float(0.0), dot(eyeDirection, reflection))
            const specularColor = pow(specDir, float(120.0)).mul(this.sunColorUniform).mul(2.5)
            const diffuseColor = max(dot(sunDir, surfaceNormal), float(0.0)).mul(this.sunColorUniform).mul(0.5)

            // Color base: Deep ocean turquoise blue #0f6b86
            const upDot = max(float(0.0), dot(surfaceNormal, vec3(0.0, 1.0, 0.0)))
            const scatter = float(0.65).add(float(0.35).mul(upDot)).mul(this.waterColorUniform)
            const albedo = scatter.add(this.sunColorUniform.mul(diffuseColor).mul(0.12)).add(specularColor.mul(0.35)).toVar()

            // Brillo suave de superficie y borde limpio de orilla (sin olas)
            const crestFoam = smoothstep(0.28, 0.68, noise.y.mul(0.5).add(0.5))
            const shoreFoam = smoothstep(0.03, 0.09, terrainData.b).mul(smoothstep(0.18, 0.09, terrainData.b))
            const totalFoam = max(crestFoam.mul(0.25), shoreFoam.mul(0.55))

            albedo.assign(mix(albedo, this.foamColorUniform, totalFoam))

            return albedo
        })()

        // Mostrar agua en cauces/estanques normalmente, y al superar y=0 durante la lluvia se desborda hacia arriba por todo el terreno
        const alphaNode = Fn(() =>
        {
            const terrainData = this.game.terrain.terrainNode(positionWorld.xz)
            const overflow = smoothstep(float(-0.04), float(0.06), this.game.water.surfaceElevationUniform)
            const shoreThreshold = mix(float(0.03), float(-0.05), overflow)
            return step(shoreThreshold, terrainData.b)
        })()

        const material = new MeshDefaultMaterial({
            depthWrite: true,
            colorNode: colorNode,
            alphaNode: alphaNode,
            alphaTest: 0.1,
            hasCoreShadows: false,
            hasDropShadows: true,
            hasLightBounce: false,
            hasFog: true,
            hasWater: false,
            transparent: false
        })

        this.material = material
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(this.geometry, this.material)

        const halfExtent = this.game.view.optimalArea.radius
        this.mesh.scale.setScalar(halfExtent * 2)

        this.mesh.position.y = this.game.water.surfaceElevation
        this.mesh.castShadow = false
        this.mesh.receiveShadow = true
        this.game.scene.children.unshift(this.mesh)

        this.game.viewport.events.on('throttleChange', () =>
        {
            const halfExtent = this.game.view.optimalArea.radius
            this.mesh.scale.setScalar(halfExtent * 2)
        }, 2)
    }

    setIce()
    {
        this.ice = {}

        this.ice.halfThickness = 0.5
        this.ice.physical = this.game.physics.getPhysical({
            type: 'kinematicPositionBased',
            position: new THREE.Vector3(0, this.game.water.surfaceElevation - this.ice.halfThickness, 0),
            frictionRule: 'min',
            friction: 0.02,
            enabled: false,
            colliders:
            [
                { shape: 'cuboid', parameters: [ 256, this.ice.halfThickness, 256 ] },
            ]
        })
    }

    update()
    {
        this.iceRatioBinding.update()

        this.mesh.position.x = this.game.view.optimalArea.position.x
        this.mesh.position.y = this.game.water.surfaceElevation
        this.mesh.position.z = this.game.view.optimalArea.position.z
        this.mesh.renderOrder = 1

        // Ice
        const friction = lerp(0.5, 0.02, this.iceRatio.value)
        this.ice.physical.body.collider(0).setFriction(friction)
        this.ice.physical.body.setNextKinematicTranslation({
            x: 0,
            y: lerp(- 1.5 - this.ice.halfThickness, this.game.water.surfaceElevation - this.ice.halfThickness, this.iceRatio.value),
            z: 0
        })

        if(this.iceRatio.value > 0)
        {
            if(!this.ice.physical.body.isEnabled())
            {
                this.game.objects.enable(this.ice)
            }
        }
        else
        {
            if(this.ice.physical.body.isEnabled())
            {
                this.game.objects.disable(this.ice)
            }
        }
    }
}
