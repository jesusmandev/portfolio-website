import * as THREE from 'three/webgpu'
import { color, float, sin, uniform, vec4 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

const _V0 = new THREE.Vector3()
const _V1 = new THREE.Vector3()
const _UP = new THREE.Vector3(0, 1, 0)

function _tube(p1, p2, radius, material, parent, segs = 6)
{
    _V0.subVectors(p2, p1)
    const len = _V0.length()
    if(len < 0.001) return null
    const geo = new THREE.CylinderGeometry(radius, radius, len, segs)
    const mesh = new THREE.Mesh(geo, material)
    _V1.addVectors(p1, p2).multiplyScalar(0.5)
    mesh.position.copy(_V1)
    mesh.quaternion.setFromUnitVectors(_UP, _V0.normalize())
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
}

function v(x, y, z) { return new THREE.Vector3(x, y, z) }

/**
 * FerrisWheel — Rueda de la Fortuna 3D (adaptada de frontend-portfolio a Folio-2025 WebGPU)
 *
 * - Gira y suena de forma continua 24/7 (día y noche) con cabinas siempre niveladas.
 * - Bombillas de feria instanciadas con brillo animado por GPU (TSL).
 * - Materiales compatibles con el pipeline WebGPU de Folio (sombras, luz y niebla).
 * - Colisión física fija en Rapier para que no se pueda traspasar.
 * - Audio espacial continuo en bucle ("After_the_Fair.mp3" + giro mecánico suave).
 */
export class FerrisWheel
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this._wx        = options.x         ?? 11.3
        this._wy        = options.y         ?? 0.0
        this._wz        = options.z         ?? 32.0
        this._scale     = options.scale     ?? 0.36
        this._rotationY = options.rotationY ?? Math.PI * 0.18
        this._spinSpeed = options.spinSpeed ?? 0.45 // rad/s (giro continuo todo el tiempo)

        this._time = 0
        this._wheelGroup = null
        this._cabins = []
        this._bulbTimeUniform = uniform(0)
        this._bulbIntensityUniform = uniform(1.8)

        this.position = new THREE.Vector3(this._wx, this._wy, this._wz)

        this._build()
        this._createPhysics()
        this._setAudio()
    }

    _makeMat(hex)
    {
        const mat = new MeshDefaultMaterial({
            colorNode: color(hex),
            hasCoreShadows: true,
            hasDropShadows: true,
            hasLightBounce: true,
            hasFog: true,
            hasReveal: true,
            hasWater: false,
        })
        mat.userData = { prevent: true }
        return mat
    }

    _build()
    {
        const radius      = 17
        const wheelThick  = 3.2
        const halfT       = wheelThick / 2
        const rimTube     = 0.28
        const spokeCount  = 12
        const cabinCount  = 12
        const innerRadius = radius * 0.55

        // Materiales estructurales compatibles con WebGPU (MeshDefaultMaterial)
        const mat = {
            support:  this._makeMat('#c84c4c'),
            rim:      this._makeMat('#dddddd'),
            innerRim: this._makeMat('#ffcc00'),
            spoke:    this._makeMat('#c84c4c'),
            hub:      this._makeMat('#ffcc00'),
            axle:     this._makeMat('#777777'),
            strut:    this._makeMat('#555555'),
            armHang:  this._makeMat('#555555'),
            winMat:   this._makeMat('#1a1a1a'),
            roofMat:  this._makeMat('#ffffff'),
        }

        // Grupo raíz
        this._root = new THREE.Group()
        this._root.name = 'ferrisWheelRoot'
        this._root.position.set(this._wx, this._wy, this._wz)
        this._root.rotation.y = this._rotationY
        this._root.scale.setScalar(this._scale)
        this.game.scene.add(this._root)

        // Grupo giratorio elevado
        const wg = new THREE.Group()
        wg.name = 'ferrisWheelSpinner'
        wg.position.set(0, radius + 6, 0)
        this._root.add(wg)
        this._wheelGroup = wg

        // Geometrías reutilizadas
        const outerTorusGeo = new THREE.TorusGeometry(radius,      rimTube,        10, 60)
        const innerTorusGeo = new THREE.TorusGeometry(innerRadius, rimTube * 0.75, 10, 48)
        const hubCapGeo     = new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24)
        const bodyGeo       = new THREE.CylinderGeometry(1.2, 1.0, 1.5, 8)
        const winGeo        = new THREE.BoxGeometry(2.2, 0.6, 1.7)
        const roofGeo       = new THREE.BoxGeometry(2.5, 0.25, 1.7)
        const railGeo       = new THREE.TorusGeometry(1.1, 0.07, 6, 12)
        const armGeo        = new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6)
        const legGeo        = new THREE.BoxGeometry(1.2, 26, 0.9)
        const footGeo       = new THREE.BoxGeometry(5.5, 0.8, 2)

        // Aros exteriores e interiores
        const mkTorus = (geo, posZ, material) =>
        {
            const m = new THREE.Mesh(geo, material)
            m.position.z = posZ
            m.castShadow = true
            m.receiveShadow = true
            wg.add(m)
        }
        mkTorus(outerTorusGeo,  halfT, mat.rim)
        mkTorus(outerTorusGeo, -halfT, mat.rim)
        mkTorus(innerTorusGeo,  halfT, mat.innerRim)
        mkTorus(innerTorusGeo, -halfT, mat.innerRim)

        // Conectores entre caras
        for(let i = 0; i < spokeCount; i++)
        {
            const a = (i / spokeCount) * Math.PI * 2
            const x = Math.cos(a) * radius
            const y = Math.sin(a) * radius
            _tube(v(x, y, halfT), v(x, y, -halfT), 0.14, mat.rim, wg)
        }

        // Hub central
        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(1.4, 1.4, wheelThick + 0.6, 24),
            mat.hub
        )
        hub.rotation.x = Math.PI / 2
        hub.castShadow = true
        wg.add(hub)

        for(const z of [ halfT + 0.15, -halfT - 0.15 ])
        {
            const c = new THREE.Mesh(hubCapGeo, mat.hub)
            c.rotation.x = Math.PI / 2
            c.position.z = z
            wg.add(c)
        }

        // Radios exteriores
        for(let i = 0; i < spokeCount; i++)
        {
            const a = (i / spokeCount) * Math.PI * 2
            const x = Math.cos(a) * radius
            const y = Math.sin(a) * radius
            _tube(v(0, 0,  halfT), v(x, y,  halfT), 0.16, mat.spoke, wg)
            _tube(v(0, 0, -halfT), v(x, y, -halfT), 0.16, mat.spoke, wg)
        }

        // Radios interiores + conectores transversales
        for(let i = 0; i < spokeCount; i++)
        {
            const a  = (i / spokeCount) * Math.PI * 2
            const a2 = ((i + 1) / spokeCount) * Math.PI * 2
            const xi  = Math.cos(a)  * innerRadius, yi  = Math.sin(a)  * innerRadius
            const xi2 = Math.cos(a2) * innerRadius, yi2 = Math.sin(a2) * innerRadius

            _tube(v(0, 0,  halfT), v(xi,  yi,   halfT), 0.2,  mat.innerRim, wg)
            _tube(v(0, 0, -halfT), v(xi,  yi,  -halfT), 0.2,  mat.innerRim, wg)
            _tube(v(xi, yi, 0),    v(xi2, yi2,  0),     0.14, mat.innerRim, wg)
        }

        // Triangulación exterior <-> interior
        for(let i = 0; i < spokeCount; i++)
        {
            const a1 = (i / spokeCount) * Math.PI * 2
            const a2 = ((i + 1) / spokeCount) * Math.PI * 2
            const aM = (a1 + a2) / 2

            for(const z of [ halfT, -halfT ])
            {
                _tube(
                    v(Math.cos(aM) * innerRadius, Math.sin(aM) * innerRadius, z),
                    v(Math.cos(aM) * radius,      Math.sin(aM) * radius,      z),
                    0.1, mat.spoke, wg
                )
                _tube(
                    v(Math.cos(a1) * radius,      Math.sin(a1) * radius,      z),
                    v(Math.cos(a2) * innerRadius, Math.sin(a2) * innerRadius, z),
                    0.1, mat.spoke, wg
                )
            }
        }

        // Eje horizontal
        const axle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 12, 16),
            mat.axle
        )
        axle.rotation.x = Math.PI / 2
        axle.position.set(0, radius + 6, 0)
        axle.castShadow = true
        this._root.add(axle)

        // 12 Cabinas de colores (siempre verticales durante el giro)
        const cabinColors = [
            '#3a86ff', '#ff6b6b', '#ffd93d', '#06d6a0',
            '#8338ec', '#ff9f1c', '#ff006e', '#00bbf9',
            '#2ec4b6', '#e71d36', '#3d5a80', '#ffbe0b',
        ]
        const cabinMats = cabinColors.map((hex) => this._makeMat(hex))

        for(let i = 0; i < cabinCount; i++)
        {
            const a = (i / cabinCount) * Math.PI * 2
            const holder = new THREE.Group()
            holder.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
            wg.add(holder)

            // Soporte en V
            const lArm = new THREE.Mesh(armGeo, mat.armHang)
            lArm.position.set(-0.35, -0.55, 0)
            lArm.rotation.z = 0.35
            lArm.castShadow = true
            holder.add(lArm)

            const rArm = new THREE.Mesh(armGeo, mat.armHang)
            rArm.position.set(0.35, -0.55, 0)
            rArm.rotation.z = -0.35
            rArm.castShadow = true
            holder.add(rArm)

            // Cabina
            const cabin = new THREE.Group()
            cabin.position.y = -1.9
            holder.add(cabin)

            const body = new THREE.Mesh(bodyGeo, cabinMats[i % cabinMats.length])
            body.castShadow = true
            body.receiveShadow = true
            cabin.add(body)

            const win = new THREE.Mesh(winGeo, mat.winMat)
            win.position.y = 0.05
            cabin.add(win)

            const roof = new THREE.Mesh(roofGeo, mat.roofMat)
            roof.position.y = 0.95
            roof.castShadow = true
            cabin.add(roof)

            const rail = new THREE.Mesh(railGeo, mat.strut)
            rail.rotation.x = Math.PI / 2
            rail.position.y = -0.45
            cabin.add(rail)

            this._cabins.push({ cabin })
        }

        // Soportes en A sobre el suelo
        for(const dz of [ halfT + 0.8, -halfT - 0.8 ])
        {
            const g = new THREE.Group()
            g.position.set(0, 0, dz)

            const lLeg = new THREE.Mesh(legGeo, mat.support)
            lLeg.position.set(-3, 13, 0)
            lLeg.rotation.z = -0.32
            lLeg.castShadow = true
            lLeg.receiveShadow = true
            g.add(lLeg)

            const rLeg = new THREE.Mesh(legGeo, mat.support)
            rLeg.position.set(3, 13, 0)
            rLeg.rotation.z = 0.32
            rLeg.castShadow = true
            rLeg.receiveShadow = true
            g.add(rLeg)

            for(const x of [ -8, 8 ])
            {
                const f = new THREE.Mesh(footGeo, mat.support)
                f.position.set(x, 0.4, 0)
                f.castShadow = true
                f.receiveShadow = true
                g.add(f)
            }

            this._root.add(g)
        }

        // Plataforma central
        const platform = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, wheelThick + 3), mat.axle)
        platform.position.set(0, radius + 6, 0)
        platform.castShadow = true
        this._root.add(platform)

        // Bombillas luminosas de feria agrupadas por color (8 InstancedMeshes con animación GPU TSL)
        const lightPalette = [
            '#ff2a2a', '#ffee00', '#00ff66', '#00f0ff',
            '#2a66ff', '#ff2aff', '#ff9900', '#ff69b4',
        ]

        const buckets = lightPalette.map(() => [])

        // Aro exterior (48 × 2 caras)
        for(let i = 0; i < 48; i++)
        {
            const a = (i / 48) * Math.PI * 2
            const cIdx = i % lightPalette.length
            const x = Math.cos(a) * radius
            const y = Math.sin(a) * radius
            buckets[cIdx].push({ x, y, z:  halfT + 0.28, s: 1.0 })
            buckets[cIdx].push({ x, y, z: -halfT - 0.28, s: 1.0 })
        }

        // Aro interior (24 × 2 caras)
        for(let i = 0; i < 24; i++)
        {
            const a = (i / 24) * Math.PI * 2
            const cIdx = (i + 2) % lightPalette.length
            const x = Math.cos(a) * innerRadius
            const y = Math.sin(a) * innerRadius
            buckets[cIdx].push({ x, y, z:  halfT + 0.18, s: 0.9 })
            buckets[cIdx].push({ x, y, z: -halfT - 0.18, s: 0.9 })
        }

        // Bombillas pequeñas en los radios
        for(let i = 0; i < spokeCount; i++)
        {
            const a = (i / spokeCount) * Math.PI * 2
            for(let r = radius * 0.3; r < radius; r += 3.5)
            {
                const cIdx = Math.floor(r + i) % lightPalette.length
                const x = Math.cos(a) * r
                const y = Math.sin(a) * r
                buckets[cIdx].push({ x, y, z:  halfT + 0.1, s: 0.68 })
                buckets[cIdx].push({ x, y, z: -halfT - 0.1, s: 0.68 })
            }
        }

        const bulbGeo = new THREE.SphereGeometry(0.28, 7, 7)
        const dummy = new THREE.Object3D()

        buckets.forEach((items, cIdx) =>
        {
            if(items.length === 0) return

            const phaseOffset = float(cIdx * 0.785)
            const pulse = sin(this._bulbTimeUniform.mul(3.8).add(phaseOffset)).mul(0.35).add(0.65)
            const bulbCol = color(lightPalette[cIdx]).mul(pulse).mul(this._bulbIntensityUniform)

            const bulbMat = new THREE.MeshBasicNodeMaterial()
            bulbMat.outputNode = vec4(
                MeshDefaultMaterial.revealDiscardNodeBuilder(this.game, bulbCol),
                float(1)
            )

            const inst = new THREE.InstancedMesh(bulbGeo, bulbMat, items.length)
            inst.castShadow = false
            inst.receiveShadow = false
            inst.frustumCulled = false

            for(let i = 0; i < items.length; i++)
            {
                const it = items[i]
                dummy.position.set(it.x, it.y, it.z)
                dummy.scale.setScalar(it.s)
                dummy.updateMatrix()
                inst.setMatrixAt(i, dummy.matrix)
            }
            inst.instanceMatrix.needsUpdate = true
            wg.add(inst)
        })
    }

    _createPhysics()
    {
        const sc = this._scale
        const wheelThick = 3.2
        const halfT = wheelThick / 2

        // Colisionadores fijos en Rapier para las patas y la base (evita traspasar la noria)
        const colliderHalfW = 9.5 * sc
        const colliderHalfH = 7.0 * sc
        const colliderHalfD = (halfT + 1.5) * sc

        const rotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._rotationY)

        this.game.objects.add(
            null,
            {
                type: 'fixed',
                position: new THREE.Vector3(this._wx, this._wy + colliderHalfH, this._wz),
                rotation: rotQuat,
                friction: 0.8,
                restitution: 0.0,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ colliderHalfW, colliderHalfH, colliderHalfD ],
                        category: 'object'
                    }
                ]
            }
        )
    }

    _setAudio()
    {
        // Música continua de feria en bucle espacial 3D (siempre activa)
        this.fairMusic = this.game.audio.register({
            group: 'ferrisFairMusic',
            path: 'sounds/ferris/After_the_Fair.mp3',
            autoplay: true,
            loop: true,
            volume: 0.55,
            positions: [ this.position.clone() ],
            distanceFade: 32,
        })

        // Sonido mecánico suave de giro continuo
        this.mechanismSound = this.game.audio.register({
            group: 'ferrisMechanism',
            path: 'sounds/mecanism/05947 light wooden cart riding on cobblestone - looping.mp3',
            autoplay: true,
            loop: true,
            volume: 0.16,
            rate: 0.65,
            positions: [ this.position.clone() ],
            distanceFade: 18,
        })
    }

    update()
    {
        const dt = Math.min(this.game.ticker.deltaScaled * 0.5, 0.05)
        this._time += dt

        // Giro continuo 24/7 (día y noche)
        if(this._wheelGroup)
        {
            this._wheelGroup.rotation.z -= this._spinSpeed * dt
            const wRot = this._wheelGroup.rotation.z

            // Mantener todas las cabinas niveladas verticalmente
            for(let i = 0; i < this._cabins.length; i++)
                this._cabins[i].cabin.rotation.z = -wRot
        }

        // Animación continua de bombillas (más brillante de noche, encendidas también de día)
        this._bulbTimeUniform.value = this._time
        const isNight = this.game.dayCycles?.intervalEvents?.get('night')?.inInterval ?? false
        const targetIntensity = isNight ? 2.6 : 1.35
        this._bulbIntensityUniform.value += (targetIntensity - this._bulbIntensityUniform.value) * Math.min(1, dt * 2.0)
    }
}
