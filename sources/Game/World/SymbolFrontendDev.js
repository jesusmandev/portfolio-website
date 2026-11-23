import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { ProceduralSound } from '../ProceduralSound.js'

/**
 * SymbolFrontendDev
 *
 * Símbolo 3D "</>" flotante con física dinámica Rapier en cada pieza (<, /, >):
 * - Flota suavemente en el aire (levitación vertical + balanceo sutil) con gravedad 0.
 * - Al chocar contra él con el personaje o hacer clic/toque en alguna pieza,
 *   esa pieza se suelta de la levitación, activa la gravedad y cae/rueda/rebota con
 *   físicas reales y sonido procedural de impacto.
 * - Al reiniciar el mundo (game.reset / resetAll) las 3 piezas vuelven a flotar en su lugar.
 */
export class SymbolFrontendDev
{
    constructor(options = {})
    {
        this.game = Game.getInstance()
        this.proceduralSound = new ProceduralSound()

        this.position = options.position
            ? new THREE.Vector3(options.position.x, options.position.y, options.position.z)
            : new THREE.Vector3(56.16, 1.45, 47.36)

        this.scale = options.scale ?? 0.18
        this.baseRotY = options.rotationY ?? (-Math.PI * 0.65)
        this.floatAmplitude = options.floatAmplitude ?? 0.15
        this.swayAmplitude = options.swayAmplitude ?? 0.25

        this.pieces = []
        this.pieceMeshes = []
        this.pieceObjects = []

        this._raycaster = new THREE.Raycaster()
        this._mouse = new THREE.Vector2()
        this._upAxis = new THREE.Vector3(0, 1, 0)
        this._tempQuat = new THREE.Quaternion()
        this._tempRight = new THREE.Vector3()
        this._tempPos = new THREE.Vector3()

        this._createPhysicsPieces()

        this._onPointerDown = this._onPointerDown.bind(this)
        this._onPrePhysics = this._onPrePhysics.bind(this)
        this._onPostPhysics = this._onPostPhysics.bind(this)

        window.addEventListener('pointerdown', this._onPointerDown)
        // Orden 1: antes de PhysicsVehicle (2) y Physics (3) para mantener la pose flotante con gravedad 0
        this.game.ticker.events.on('tick', this._onPrePhysics, 1)
        // Orden 5: después de Physics (3) y Objects (4) para detectar impactos reales y activar gravedad
        this.game.ticker.events.on('tick', this._onPostPhysics, 5)
    }

    _createPhysicsPieces()
    {
        const COLOR_SKY_BLUE = 0x00c3ff
        const s = this.scale

        const baseMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_SKY_BLUE,
            roughness: 0.15,
            metalness: 0.35,
            emissive: 0x0077aa,
            emissiveIntensity: 0.45,
            side: THREE.DoubleSide
        })

        const depth = 1.0
        const thickness = 1.2
        const length = 5
        const angle = Math.PI / 4

        const extrudeSettings = {
            depth: depth,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.06,
            bevelThickness: 0.06
        }

        const buildBracketGeometry = (flip) =>
        {
            const shape = new THREE.Shape()
            const innerOffset = thickness / Math.cos(angle)
            const halfLen = length * Math.sin(angle)
            const height = length * Math.cos(angle)

            shape.moveTo(0, 0)
            shape.lineTo(halfLen, height)
            shape.lineTo(halfLen + thickness * Math.cos(angle), height - thickness * Math.sin(angle))
            shape.lineTo(innerOffset, 0)
            shape.lineTo(halfLen + thickness * Math.cos(angle), -height + thickness * Math.sin(angle))
            shape.lineTo(halfLen, -height)
            shape.lineTo(0, 0)

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
            if(flip)
                geometry.rotateY(Math.PI)
            geometry.scale(s, s, s)
            geometry.computeBoundingBox()
            geometry.center()
            return geometry
        }

        const buildSlashGeometry = () =>
        {
            const slashShape = new THREE.Shape()
            const sW = thickness * 0.8
            const sH = length * 2.1

            slashShape.moveTo(-sW / 2, -sH / 2)
            slashShape.lineTo(sW / 2, -sH / 2)
            slashShape.lineTo(sW / 2, sH / 2)
            slashShape.lineTo(-sW / 2, sH / 2)
            slashShape.lineTo(-sW / 2, -sH / 2)

            const geometry = new THREE.ExtrudeGeometry(slashShape, extrudeSettings)
            geometry.rotateZ(-Math.PI / 8)
            geometry.scale(s, s, s)
            geometry.computeBoundingBox()
            geometry.center()
            return geometry
        }

        const specs = [
            { name: 'SymbolFrontendDev_Left',  geometry: buildBracketGeometry(false), localX: -5.3 * s, pitch: 0.92, hasLight: false },
            { name: 'SymbolFrontendDev_Slash', geometry: buildSlashGeometry(),        localX:  0.0,     pitch: 1.02, hasLight: true  },
            { name: 'SymbolFrontendDev_Right', geometry: buildBracketGeometry(true),  localX:  5.3 * s, pitch: 1.12, hasLight: false }
        ]

        const rotQuat = new THREE.Quaternion().setFromAxisAngle(this._upAxis, this.baseRotY)
        const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(rotQuat)

        for(const spec of specs)
        {
            spec.geometry.computeBoundingBox()
            const size = new THREE.Vector3()
            spec.geometry.boundingBox.getSize(size)

            const halfX = Math.max(size.x * 0.5, 0.14)
            const halfY = Math.max(size.y * 0.5, 0.14)
            const halfZ = Math.max(size.z * 0.5, 0.14)

            const worldPos = new THREE.Vector3(
                this.position.x + rightAxis.x * spec.localX,
                this.position.y,
                this.position.z + rightAxis.z * spec.localX
            )

            const material = baseMaterial.clone()
            const mesh = new THREE.Mesh(spec.geometry, material)
            mesh.name = spec.name
            mesh.position.copy(worldPos)
            mesh.quaternion.copy(rotQuat)
            mesh.castShadow = true
            mesh.receiveShadow = true

            if(spec.hasLight)
            {
                const light = new THREE.PointLight(0x00c3ff, 1.5, 6.0)
                light.position.set(0, 0, 0.35)
                mesh.add(light)
            }

            const piece = {
                mesh,
                object: null,
                body: null,
                localX: spec.localX,
                expectedPos: worldPos.clone(),
                expectedQuat: rotQuat.clone(),
                pitch: spec.pitch,
                floating: true,
                wasResetting: false
            }

            const object = this.game.objects.add(
                {
                    model: mesh,
                    updateMaterials: false,
                    castShadow: true,
                    receiveShadow: true
                },
                {
                    type: 'dynamic',
                    position: worldPos.clone(),
                    rotation: rotQuat.clone(),
                    friction: 0.72,
                    restitution: 0.35,
                    mass: 0.09,
                    canSleep: false,
                    colliders: [
                        {
                            shape: 'cuboid',
                            parameters: [ halfX, halfY, halfZ ],
                            category: 'object'
                        }
                    ],
                    onCollision: (force) =>
                    {
                        if(piece.floating && force > 0.25)
                            this._releasePiece(piece)

                        if(force > 0.35)
                        {
                            const intensity = Math.min(Math.max(force / 8.0, 0.2), 1.0)
                            this.proceduralSound.playLetterImpactSound(intensity, spec.pitch)
                            if(piece.body)
                                this.game.world?.gameFeelFX?.emitImpactSparks(piece.body.translation(), 0x38d9ff, intensity)
                        }
                    }
                }
            )

            piece.object = object
            piece.body = object.physical.body
            piece.body.setGravityScale(0, false)
            piece.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
            piece.body.setAngvel({ x: 0, y: 0, z: 0 }, false)

            mesh.userData = {
                object,
                piece,
                pitch: spec.pitch
            }

            this.pieces.push(piece)
            this.pieceMeshes.push(mesh)
            this.pieceObjects.push(object)
        }
    }

    _releasePiece(piece)
    {
        if(!piece || !piece.floating)
            return

        piece.floating = false
        if(piece.body)
        {
            piece.body.setGravityScale(1, true)
            piece.body.wakeUp()
        }
    }

    _onPrePhysics()
    {
        const timeSec = this.game.ticker.elapsedScaled * 1.5
        const bobY = this.position.y + Math.sin(timeSec * 1.5) * this.floatAmplitude
        const swayRotY = this.baseRotY + Math.sin(timeSec * 0.8) * this.swayAmplitude

        this._tempQuat.setFromAxisAngle(this._upAxis, swayRotY)
        this._tempRight.set(1, 0, 0).applyQuaternion(this._tempQuat)

        for(const piece of this.pieces)
        {
            const body = piece.body
            if(!body)
                continue

            if(piece.object.reseting)
            {
                piece.wasResetting = true
                continue
            }

            if(piece.wasResetting)
            {
                piece.wasResetting = false
                piece.floating = true
                body.setGravityScale(0, false)
                body.setLinvel({ x: 0, y: 0, z: 0 }, false)
                body.setAngvel({ x: 0, y: 0, z: 0 }, false)
            }

            if(!body.isEnabled() || !piece.floating)
                continue

            this._tempPos.set(
                this.position.x + this._tempRight.x * piece.localX,
                bobY,
                this.position.z + this._tempRight.z * piece.localX
            )

            piece.expectedPos.copy(this._tempPos)
            piece.expectedQuat.copy(this._tempQuat)

            body.setGravityScale(0, false)
            body.setLinvel({ x: 0, y: 0, z: 0 }, false)
            body.setAngvel({ x: 0, y: 0, z: 0 }, false)
            body.setTranslation(this._tempPos, false)
            body.setRotation(this._tempQuat, false)
        }
    }

    _onPostPhysics()
    {
        for(const piece of this.pieces)
        {
            const body = piece.body
            if(!body || !body.isEnabled() || piece.object.reseting || !piece.floating)
                continue

            const lv = body.linvel()
            const av = body.angvel()
            const pos = body.translation()

            const speedSq = lv.x * lv.x + lv.y * lv.y + lv.z * lv.z
            const angSq = av.x * av.x + av.y * av.y + av.z * av.z
            const dx = pos.x - piece.expectedPos.x
            const dy = pos.y - piece.expectedPos.y
            const dz = pos.z - piece.expectedPos.z
            const dispSq = dx * dx + dy * dy + dz * dz

            // Solo suelta la levitación si recibió un empuje/choque real durante el paso de física
            if(speedSq > 0.04 || angSq > 0.04 || dispSq > 0.0025)
            {
                this._releasePiece(piece)
            }
            else
            {
                piece.mesh.position.copy(piece.expectedPos)
                piece.mesh.quaternion.copy(piece.expectedQuat)
            }
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
        const intersects = this._raycaster.intersectObjects(this.pieceMeshes)

        if(intersects.length > 0)
        {
            const clickedMesh = intersects[0].object
            const piece = clickedMesh.userData?.piece
            const body = piece?.body || clickedMesh.userData?.object?.physical?.body

            if(body)
            {
                this._releasePiece(piece)
                body.wakeUp()
                body.applyImpulse(
                    {
                        x: (Math.random() - 0.5) * 4.5,
                        y: 6.5 + Math.random() * 3.0,
                        z: (Math.random() - 0.5) * 4.5
                    },
                    true
                )
                body.applyTorqueImpulse(
                    {
                        x: (Math.random() - 0.5) * 3.0,
                        y: (Math.random() - 0.5) * 3.0,
                        z: (Math.random() - 0.5) * 3.0
                    },
                    true
                )

                this.proceduralSound.playLetterImpactSound(0.85, clickedMesh.userData.pitch || 1.0)
                this.game.world?.gameFeelFX?.emitImpactSparks(body.translation(), 0x38d9ff, 1.0)

                if(clickedMesh.material)
                {
                    const origColor = clickedMesh.material.color.getHex()
                    const origEmissive = clickedMesh.material.emissive.getHex()
                    clickedMesh.material.color.setHex(0xffffff)
                    clickedMesh.material.emissive.setHex(0x66e0ff)
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
        for(const piece of this.pieces)
        {
            piece.floating = true
            piece.wasResetting = false
            if(piece.body)
            {
                piece.body.setGravityScale(0, false)
                piece.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
                piece.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
            }
            this.game.objects.resetObject(piece.object)
        }
    }

    destroy()
    {
        window.removeEventListener('pointerdown', this._onPointerDown)
        this.game.ticker.events.off('tick', this._onPrePhysics)
        this.game.ticker.events.off('tick', this._onPostPhysics)

        for(const obj of this.pieceObjects)
        {
            this.game.objects.delete(obj)
        }
        this.pieces = []
        this.pieceMeshes = []
        this.pieceObjects = []
    }
}
