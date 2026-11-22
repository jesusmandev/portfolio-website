import * as THREE from 'three/webgpu'
import { color, Fn, positionGeometry, sin, texture, uv } from 'three/tsl'
import { Area } from './Area.js'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

let cachedColombiaFlagTexture = null

function getColombiaFlagTexture()
{
    if(cachedColombiaFlagTexture)
        return cachedColombiaFlagTexture

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 341 // Proporción oficial 2:3
    const ctx = canvas.getContext('2d')

    // Amarillo (#FCD116) - Mitad superior (50%)
    ctx.fillStyle = '#FCD116'
    ctx.fillRect(0, 0, 512, 170.5)

    // Azul (#003893) - Franja media (25%)
    ctx.fillStyle = '#003893'
    ctx.fillRect(0, 170.5, 512, 85.25)

    // Rojo (#CE1126) - Franja inferior (25%)
    ctx.fillStyle = '#CE1126'
    ctx.fillRect(0, 255.75, 512, 85.25)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true

    cachedColombiaFlagTexture = tex
    return tex
}

export class ToiletArea extends Area
{
    constructor(model)
    {
        // Quitar la cabina del baño, los rollos de papel y el taburete (conservar únicamente terreno/rocas y zonas)
        for(const child of [...model.children])
        {
            const name = child.name.toLowerCase()
            const keep = name.startsWith('refzone') || name.startsWith('rocks')
            if(!keep)
            {
                child.userData.preventAutoAdd = true
                child.visible = false
                model.remove(child)
            }
        }

        super(model)

        // Mantener siempre visible la bandera de Colombia desde lejos
        if(this.frustum)
            this.frustum.alwaysVisible = true

        this.setColombiaFlag({
            x: 70.92,
            z: 70.34,
            scale: 0.52,
            rotationY: -Math.PI * 0.25
        })

        this.setAchievement()
    }

    _getGroundY(wx, wz)
    {
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(wx, 30, wz),
            new THREE.Vector3(0, -1, 0)
        )

        const targets = []
        if(this.game.resources.terrainModel?.scene)
        {
            this.game.resources.terrainModel.scene.updateMatrixWorld(true)
            targets.push(this.game.resources.terrainModel.scene)
        }
        for(const obj of this.objects.items)
        {
            if(obj.visual?.object3D)
            {
                obj.visual.object3D.updateMatrixWorld(true)
                targets.push(obj.visual.object3D)
            }
        }

        if(targets.length > 0)
        {
            const hits = raycaster.intersectObjects(targets, true)
            if(hits.length > 0)
                return hits[0].point.y
        }

        // Respaldo con raycast físico de Rapier sobre el terreno/suelo
        if(this.game.physics?.world && this.game.RAPIER)
        {
            const ray = new this.game.RAPIER.Ray({ x: wx, y: 30, z: wz }, { x: 0, y: -1, z: 0 })
            const hit = this.game.physics.world.castRay(ray, 50, true)
            if(hit)
                return 30 - hit.timeOfImpact
        }

        return 0.0
    }

    setColombiaFlag(options = {})
    {
        const wx        = options.x         ?? 70.92
        const wz        = options.z         ?? 70.34
        const wy        = this._getGroundY(wx, wz)
        const scale     = options.scale     ?? 0.52
        const rotationY = options.rotationY ?? -Math.PI * 0.25

        const poleHeight = 15
        const poleRadius = 0.15
        const knobRadius = 0.30
        const flagWidth  = 7.5
        const flagHeight = 5.0

        const root = new THREE.Group()
        root.name = 'colombiaFlagRoot'
        root.position.set(wx, wy, wz)
        root.rotation.y = rotationY
        root.scale.setScalar(scale)
        this.game.scene.add(root)

        // Materiales compatibles con Folio WebGPU (sombras, luz, niebla y Reveal)
        const poleMat = new MeshDefaultMaterial({
            colorNode: color('#9aa0a6'),
            hasCoreShadows: true,
            hasDropShadows: true,
            hasLightBounce: true,
            hasFog: true,
            hasReveal: true,
            hasWater: false,
        })
        poleMat.userData = { prevent: true }

        const knobMat = new MeshDefaultMaterial({
            colorNode: color('#ffd700'),
            hasCoreShadows: true,
            hasDropShadows: true,
            hasLightBounce: true,
            hasFog: true,
            hasReveal: true,
            hasWater: false,
        })
        knobMat.userData = { prevent: true }

        // Base circular pegada exactamente al suelo base (y = 0 local)
        const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.55, 14), poleMat)
        baseMesh.position.y = 0.20
        baseMesh.castShadow = true
        baseMesh.receiveShadow = true
        root.add(baseMesh)

        // Mástil metálico
        const poleGeo = new THREE.CylinderGeometry(poleRadius * 0.8, poleRadius, poleHeight, 14)
        const poleMesh = new THREE.Mesh(poleGeo, poleMat)
        poleMesh.position.y = poleHeight / 2
        poleMesh.castShadow = true
        poleMesh.receiveShadow = true
        root.add(poleMesh)

        // Esfera dorada superior
        const knobGeo = new THREE.SphereGeometry(knobRadius, 14, 12)
        const knobMesh = new THREE.Mesh(knobGeo, knobMat)
        knobMesh.position.y = poleHeight + knobRadius * 0.5
        knobMesh.castShadow = true
        root.add(knobMesh)

        // Paño de la bandera de Colombia con ondulación por viento en GPU (TSL)
        const flagGeo = new THREE.PlaneGeometry(flagWidth, flagHeight, 28, 16)
        flagGeo.translate(flagWidth / 2, 0, 0)

        const flagTex = getColombiaFlagTexture()
        const flagMat = new MeshDefaultMaterial({
            colorNode: texture(flagTex).rgb,
            side: THREE.DoubleSide,
            hasCoreShadows: true,
            hasDropShadows: true,
            hasLightBounce: false,
            hasFog: true,
            hasReveal: true,
            hasWater: false,
        })
        flagMat.userData = { prevent: true }

        const tNode = this.game.ticker.elapsedScaledUniform
        flagMat.positionNode = Fn(() =>
        {
            const pos = positionGeometry.toVar()
            const windIntensity = uv().x
            const wave1 = sin(pos.x.mul(1.5).add(tNode.mul(1.6))).mul(0.45).mul(windIntensity)
            const wave2 = sin(pos.y.mul(2.2).add(tNode.mul(2.05))).mul(0.12).mul(windIntensity)
            pos.z.addAssign(wave1.add(wave2))
            return pos
        })()

        const flagMesh = new THREE.Mesh(flagGeo, flagMat)
        flagMesh.position.set(0, poleHeight - flagHeight / 2 - 0.3, 0)
        flagMesh.castShadow = true
        flagMesh.receiveShadow = true
        root.add(flagMesh)

        this.flagRoot = root

        // Colisionador físico Rapier para que no se pueda traspasar el mástil
        const totalHeight = poleHeight * scale
        const colRadius = Math.max(poleRadius * scale * 2.2, 0.32)

        this.game.objects.add(
            null,
            {
                type: 'fixed',
                position: new THREE.Vector3(wx, wy + totalHeight / 2, wz),
                friction: 0.6,
                restitution: 0.0,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ colRadius, totalHeight / 2, colRadius ],
                        category: 'object'
                    }
                ]
            }
        )

        // Sonido espacial de bandera al acercarse (1 sola bandera: volumen moderado)
        this.flagSound = this.game.audio.register({
            group: 'colombiaFlagSound',
            path: 'sounds/flag/flags.mp3',
            autoplay: true,
            loop: true,
            volume: 0.42,
            positions: [ new THREE.Vector3(wx, wy + totalHeight * 0.65, wz) ],
            distanceFade: 20,
        })
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'toilet')
        })
    }

    update()
    {
        // Animación de viento gestionada directamente en GPU (TSL)
    }
}
