import * as THREE from 'three/webgpu'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { Game } from '../Game.js'
import { ProceduralSound } from '../ProceduralSound.js'

/**
 * TextFreelancer.js
 * 
 * Letras 3D dinámicas "FREELANCER" a nivel de suelo con física Rapier
 * y sintetizador de sonido de impacto procedural nativo.
 * Posicionadas desde el punto A (-0.56, 0.0, -21.64) hacia el punto B (10.35, 0.0, -36.78).
 */
export class TextFreelancer
{
    constructor(options = {})
    {
        this.game = Game.getInstance()
        this.proceduralSound = new ProceduralSound()

        this.textString = options.text || 'FREELANCER'

        // Puntos de inicio y fin especificados por el usuario
        this.start = options.start
            ? new THREE.Vector3(options.start.x, options.start.y ?? 0.0, options.start.z)
            : new THREE.Vector3(-0.56, 0.0, -21.64)

        this.end = options.end
            ? new THREE.Vector3(options.end.x, options.end.y ?? 0.0, options.end.z)
            : new THREE.Vector3(10.35, 0.0, -36.78)

        this.floorY = options.floorY ?? 0.0
        this.fontSize = options.fontSize ?? 1.85
        this.fontDepth = options.fontDepth ?? 0.45

        this.letterMeshes = []
        this.letterObjects = []
        this._raycaster = new THREE.Raycaster()
        this._mouse = new THREE.Vector2()

        this._onPointerDown = this._onPointerDown.bind(this)
        window.addEventListener('pointerdown', this._onPointerDown)

        this._loadFontAndCreate()
    }

    _loadFontAndCreate()
    {
        const loader = new FontLoader()
        const fontUrl = './fonts/helvetiker_bold.typeface.json'

        loader.load(
            fontUrl,
            (font) =>
            {
                this.font = font
                this._createText()
            },
            undefined,
            (err) =>
            {
                console.error('[TextFreelancer] Error cargando fuente:', err)
            }
        )
    }

    _createText()
    {
        if(!this.font) return

        // Vector dirección desde el punto A hacia el punto B
        const dir = new THREE.Vector3().subVectors(this.end, this.start)
        const totalDist = dir.length()
        if(totalDist < 0.001) return

        const unitDir = dir.clone().normalize()

        // Ángulo de rotación sobre el eje Y para que las letras se alineen a lo largo del segmento A -> B
        // y miren hacia el camino principal / cámara del jugador
        const rotationY = Math.atan2(-unitDir.z, unitDir.x)

        const textOptions = {
            font: this.font,
            size: this.fontSize,
            depth: this.fontDepth,
            curveSegments: 5,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 2
        }

        // 1. Medir dimensiones de cada letra
        const letterData = []
        let sumWidth = 0

        for(let i = 0; i < this.textString.length; i++)
        {
            const char = this.textString[i]
            const geometry = new TextGeometry(char, textOptions)
            geometry.computeBoundingBox()
            geometry.center() // Centrado en el origen local (centro de masa)

            const size = new THREE.Vector3()
            geometry.boundingBox.getSize(size)

            letterData.push({
                char,
                geometry,
                size,
                width: size.x,
                height: size.y,
                depth: size.z
            })

            sumWidth += size.x
        }

        // 2. Distribuir las letras equitativamente entre los puntos de inicio y fin
        const startMargin = 0.5
        const usableDist = Math.max(totalDist - startMargin * 2, sumWidth)
        const numGaps = Math.max(letterData.length - 1, 1)
        const letterSpacing = Math.max((usableDist - sumWidth) / numGaps, 0.2)

        let currentDist = startMargin

        // Material dorado/amarillo brillante característico
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xffca3a,
            roughness: 0.35,
            metalness: 0.15,
            emissive: 0x332200,
            emissiveIntensity: 0.30
        })

        for(let i = 0; i < letterData.length; i++)
        {
            const item = letterData[i]
            const letterCenterDist = currentDist + item.width / 2

            const posX = this.start.x + unitDir.x * letterCenterDist
            const posZ = this.start.z + unitDir.z * letterCenterDist
            const posY = this.floorY + item.height / 2 + 0.02

            const mat = baseMaterial.clone()
            const mesh = new THREE.Mesh(item.geometry, mat)
            mesh.name = `TextFreelancer_${item.char}_${i}`

            mesh.position.set(posX, posY, posZ)
            mesh.rotation.y = rotationY
            mesh.castShadow = true
            mesh.receiveShadow = true

            const halfX = item.width / 2
            const halfY = item.height / 2
            const halfZ = item.depth / 2

            // Integración física dinámica con Rapier en folio-2025
            const object = this.game.objects.add(
                {
                    model: mesh,
                    updateMaterials: false,
                    castShadow: true,
                    receiveShadow: true
                },
                {
                    type: 'dynamic',
                    position: mesh.position.clone(),
                    rotation: mesh.quaternion.clone(),
                    friction: 0.75,
                    restitution: 0.35,
                    mass: 0.08,
                    sleeping: true,
                    colliders: [
                        {
                            shape: 'cuboid',
                            parameters: [ halfX, halfY, halfZ ],
                            category: 'object'
                        }
                    ],
                    onCollision: (force) =>
                    {
                        if(force > 0.4)
                        {
                            const pitchMod = 0.85 + (item.char.charCodeAt(0) % 7) * 0.05
                            const intensity = Math.min(Math.max(force / 8.0, 0.2), 1.0)
                            this.proceduralSound.playLetterImpactSound(intensity, pitchMod)
                            if(object.physical?.body)
                                this.game.world?.gameFeelFX?.emitImpactSparks(object.physical.body.translation(), 0xffda55, intensity)
                        }
                    }
                }
            )

            mesh.userData = {
                object,
                char: item.char,
                initialPos: mesh.position.clone(),
                initialRot: mesh.quaternion.clone(),
                halfX,
                halfY,
                halfZ
            }

            this.letterMeshes.push(mesh)
            this.letterObjects.push(object)

            currentDist += item.width + letterSpacing
        }
    }

    _onPointerDown(event)
    {
        if(event.isPrimary === false) return

        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        const cam = this.game.view?.camera || this.game.camera
        if(!cam) return

        this._raycaster.setFromCamera(this._mouse, cam)
        const intersects = this._raycaster.intersectObjects(this.letterMeshes)

        if(intersects.length > 0)
        {
            const clickedMesh = intersects[0].object
            const object = clickedMesh.userData?.object
            const body = object?.physical?.body

            if(body)
            {
                body.wakeUp()

                // Impulso y giro físico en 3D
                const fx = (Math.random() - 0.5) * 5.0
                const fy = 7.5 + Math.random() * 3.5
                const fz = (Math.random() - 0.5) * 5.0
                body.applyImpulse({ x: fx, y: fy, z: fz }, true)

                const tx = (Math.random() - 0.5) * 3.5
                const ty = (Math.random() - 0.5) * 3.5
                const tz = (Math.random() - 0.5) * 3.5
                body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true)

                // Sonido de impacto y chispas doradas
                const charCode = (clickedMesh.userData.char || 'F').charCodeAt(0)
                const pitchMod = 0.85 + (charCode % 7) * 0.05
                this.proceduralSound.playLetterImpactSound(0.9, pitchMod)
                this.game.world?.gameFeelFX?.emitImpactSparks(body.translation(), 0xffda55, 1.0)

                // Efecto visual de parpadeo blanco
                if(clickedMesh.material)
                {
                    const origColor = clickedMesh.material.color.getHex()
                    const origEmissive = clickedMesh.material.emissive.getHex()
                    clickedMesh.material.color.setHex(0xffffff)
                    clickedMesh.material.emissive.setHex(0x555555)
                    setTimeout(() =>
                    {
                        clickedMesh.material.color.setHex(origColor)
                        clickedMesh.material.emissive.setHex(origEmissive)
                    }, 150)
                }
            }
        }
    }

    resetAll()
    {
        for(const object of this.letterObjects)
        {
            this.game.objects.resetObject(object)
        }
    }

    destroy()
    {
        window.removeEventListener('pointerdown', this._onPointerDown)

        for(const obj of this.letterObjects)
        {
            this.game.objects.delete(obj)
        }
        this.letterMeshes = []
        this.letterObjects = []
    }
}
