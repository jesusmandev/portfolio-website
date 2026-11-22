import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { Player } from '../Player.js'
import { ProceduralSound } from '../ProceduralSound.js'

export class PhysicsVehicle
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        // Parámetros de física del personaje humano
        this.targetHeight = 2.6
        this.walkSpeed = 7.5
        this.runSpeed = 16.0
        this.turnSpeed = 18.0
        this.gravity = -24.0
        this.jumpForce = 9.5

        // Compatibilidad con referencias del vehículo
        this.steeringAmplitude = 0.5
        this.engineForceAmplitude = 300
        this.boostMultiplier = 2
        this.topSpeed = this.walkSpeed
        this.topSpeedBoost = this.runSpeed

        this.sideward = new THREE.Vector3(1, 0, 0)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.forward = new THREE.Vector3(0, 0, 1)
        this.position = new THREE.Vector3(0, 4, 0)
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.direction = this.forward.clone()
        this.speed = 0
        this.xzSpeed = 0
        this.forwardRatio = 1
        this.goingForward = true
        this.forwardSpeed = 0
        this.xRotation = 0
        this.yRotation = 0
        this.zRotation = 0

        // Estado de locomoción para animaciones
        this.isGrounded = false
        this.isMoving = false
        this.isSprinting = false
        this.justJumped = false
        this.justLanded = false
        this.verticalVelocity = 0
        this._targetMoveSpeed = 0
        this._currentMoveSpeed = 0
        this.externalVelocity = new THREE.Vector3()

        // Vectores reutilizables (evitan GC en cada frame)
        this._tmpQuat = new THREE.Quaternion()
        this._targetQuat = new THREE.Quaternion()
        this._yAxis = new THREE.Vector3(0, 1, 0)
        this._moveDir = new THREE.Vector3()
        this._gravStep = new THREE.Vector3()
        this._totalMove = new THREE.Vector3()
        this._forwardVec = new THREE.Vector3(0, 0, -1)
        this._rightVec = new THREE.Vector3(1, 0, 0)
        this._camForward = new THREE.Vector3()
        this._camRight = new THREE.Vector3()

        // Audio procedural de pasos, salto y caída
        this.proceduralSound = new ProceduralSound()
        this._stepTimer = 0.35
        this._lastCollisionSoundTime = new WeakMap()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.physics.debugPanel.addFolder({
                title: '🏃 Character Physics',
                expanded: true,
            })

            this.debugPanel.addBinding(this, 'walkSpeed', { min: 1, max: 25, step: 0.5 })
            this.debugPanel.addBinding(this, 'runSpeed', { min: 5, max: 40, step: 0.5 })
            this.debugPanel.addBinding(this, 'jumpForce', { min: 2, max: 25, step: 0.5 })
            this.debugPanel.addBinding(this, 'gravity', { min: -50, max: -5, step: 0.5 })
        }

        this.setChassis()
        this.setWheels()
        this.setStop()
        this.setUpsideDown()
        this.setStuck()
        this.setFlip()

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 2)
        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 5)
    }

    get capsuleTotalHalf()
    {
        return this._capsuleHalfHeight + this._capsuleRadius
    }

    get capsuleBottomY()
    {
        return this.position.y - this.capsuleTotalHalf
    }

    setChassis()
    {
        this.chassis = {}
        this._capsuleHalfHeight = this.targetHeight * 0.28
        this._capsuleRadius = this.targetHeight * 0.22

        const object = this.game.objects.add(null, {
            type: 'kinematicPositionBased',
            position: this.position,
            friction: 0.0,
            rotation: new THREE.Quaternion(),
            colliders: [
                {
                    shape: 'capsule',
                    mass: 3.0,
                    parameters: [ this._capsuleHalfHeight, this._capsuleRadius ],
                    position: { x: 0, y: 0, z: 0 },
                    category: 'object'
                }
            ],
            canSleep: false,
            waterGravityMultiplier: 0,
        })

        this.chassis.physical = object.physical
        this.chassis.mass = 3.0
        this.chassisBody = object.physical.body
        this.chassisCollider = object.physical.colliders[0]

        // Soportar impulsos externos (explosiones, tornado, etc.) sobre el cuerpo cinemático
        const applyExternalImpulse = (impulse) =>
        {
            if(!impulse)
                return
            this.externalVelocity.x += (impulse.x || 0) * 1.5
            this.externalVelocity.z += (impulse.z || 0) * 1.5
            if((impulse.y || 0) > 0.1)
            {
                this.verticalVelocity = Math.max(this.verticalVelocity, Math.min(18, (impulse.y || 0) * 2.5))
                this.isGrounded = false
            }
        }
        this.chassisBody.applyImpulse = (impulse) => applyExternalImpulse(impulse)
        this.chassisBody.applyImpulseAtPoint = (impulse) => applyExternalImpulse(impulse)

        // Controlador de personaje Rapier3D
        const controllerOffset = 0.05
        this.characterController = this.game.physics.world.createCharacterController(controllerOffset)
        this.characterController.setApplyImpulsesToDynamicBodies(true)
        if(typeof this.characterController.setCharacterMass === 'function')
            this.characterController.setCharacterMass(3.0)
        if(typeof this.characterController.setUp === 'function')
            this.characterController.setUp({ x: 0, y: 1, z: 0 })

        this.characterController.setSlideEnabled(true)
        this.characterController.setMaxSlopeClimbAngle(65 * Math.PI / 180)
        this.characterController.setMinSlopeSlideAngle(35 * Math.PI / 180)
        this.characterController.enableAutostep(1.1, 0.001, true)
        this.characterController.enableSnapToGround(0.75)
    }

    setWheels()
    {
        // Estructura dummy de 4 ruedas para mantener compatibilidad con Player.js y otros módulos
        this.wheels = {}
        this.wheels.inContactCount = 4
        this.wheels.justTouchedCount = 0
        this.wheels.items = []
        this.wheels.settings = {
            offset: { x: 0.5, y: 0, z: 0.5 },
            radius: 0.4,
        }

        for(let i = 0; i < 4; i++)
        {
            this.wheels.items.push({
                inContact: true,
                contactPoint: new THREE.Vector3(),
                suspensionLength: 0.5,
                suspensionState: 'low',
                lastTouchTime: 0,
                basePosition: new THREE.Vector3()
            })
        }
    }

    setStop()
    {
        this.stop = {}
        this.stop.active = true
        this.stop.lowThreshold = 0.04
        this.stop.highThreshold = 0.7

        this.stop.test = () =>
        {
            if(this.speed < this.stop.lowThreshold)
            {
                if(!this.stop.active)
                {
                    this.stop.active = true
                    this.events.trigger('stop')
                }
            }
            else if(this.speed > this.stop.highThreshold)
            {
                if(this.stop.active)
                {
                    this.stop.active = false
                    this.events.trigger('start')
                }
            }
        }
    }

    setUpsideDown()
    {
        this.upsideDown = {
            active: false,
            ratio: 0,
            threshold: 0.3,
            test: () => {}
        }
    }

    setStuck()
    {
        this.stuck = {
            durationTest: 3,
            durationSaved: 0,
            savedItems: [],
            distance: 0,
            distanceThreshold: 0.5,
            active: false,
            accumulate: () => {},
            test: () => {}
        }
    }

    setFlip()
    {
        this.flip = {
            force: 5,
            test: () => {},
            jump: () =>
            {
                this.verticalVelocity = this.jumpForce
                this.isGrounded = false
            }
        }
    }

    moveTo(position, rotation = 0)
    {
        const spawnY = Math.max(position.y, this.capsuleTotalHalf + 1.5)
        const targetPos = { x: position.x, y: spawnY, z: position.z }
        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation)

        this.chassisBody.setTranslation(targetPos, true)
        this.chassisBody.setNextKinematicTranslation(targetPos)
        this.chassisBody.setRotation(quaternion, true)
        this.chassisBody.setNextKinematicRotation(quaternion)

        this._tmpQuat.copy(quaternion)
        this.quaternion.copy(quaternion)
        this.position.set(targetPos.x, targetPos.y, targetPos.z)
        this.verticalVelocity = 0
        this._currentMoveSpeed = 0
        this.externalVelocity.set(0, 0, 0)
        this.isGrounded = false

        if(this.game.world?.visualVehicle)
        {
            this.game.world.visualVehicle.onRespawn()
        }
    }

    updatePrePhysics()
    {
        if(!this.chassisBody || !this.chassisBody.isEnabled())
            return

        const rawDelta = this.game.ticker.deltaScaled
        const delta = Math.min(rawDelta > 0 ? rawDelta : 1 / 60, 0.033)

        const translation = this.chassisBody.translation()
        const rotation = this.chassisBody.rotation()
        this._tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w)

        this._moveDir.set(0, 0, 0)
        this.justJumped = false

        const controlsActive = !this.game.player || this.game.player.state === Player.STATE_DEFAULT

        if(controlsActive)
        {
            const camera = this.game.view?.camera
            this._forwardVec.set(0, 0, -1)
            this._rightVec.set(1, 0, 0)

            if(camera)
            {
                this._camForward.set(0, 0, -1).applyQuaternion(camera.quaternion)
                this._camForward.y = 0
                if(this._camForward.lengthSq() > 0.0001)
                    this._camForward.normalize()

                this._camRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
                this._camRight.y = 0
                if(this._camRight.lengthSq() > 0.0001)
                    this._camRight.normalize()

                this._forwardVec.copy(this._camForward)
                this._rightVec.copy(this._camRight)
            }

            let fInput = 0
            let sInput = 0

            const forwardAction = this.game.inputs.actions.get('forward')
            const backwardAction = this.game.inputs.actions.get('backward')
            const rightAction = this.game.inputs.actions.get('right')
            const leftAction = this.game.inputs.actions.get('left')
            const boostAction = this.game.inputs.actions.get('boost')
            const jumpAction = this.game.inputs.actions.get('suspensions')

            if(forwardAction?.active)
                fInput += forwardAction.value || 1
            if(backwardAction?.active)
                fInput -= backwardAction.value || 1
            if(rightAction?.active)
                sInput += rightAction.value || 1
            if(leftAction?.active)
                sInput -= leftAction.value || 1

            // Soporte para joystick de Gamepad
            if(fInput === 0 && sInput === 0 && this.game.inputs.gamepad?.joysticks?.left?.active)
            {
                sInput = this.game.inputs.gamepad.joysticks.left.safeX
                fInput = -this.game.inputs.gamepad.joysticks.left.safeY
            }

            // Soporte para control táctil (nipple 360° hacia la dirección del dedo)
            let directMoveActive = false
            const nipple = this.game.inputs.nipple
            if(fInput === 0 && sInput === 0 && nipple?.active && nipple.progress > 0.02)
            {
                const nippleAngle = nipple.targetAngle
                this._moveDir.set(Math.cos(nippleAngle), 0, Math.sin(nippleAngle))
                directMoveActive = true
            }

            this.isSprinting = !!(boostAction?.active || (nipple?.active && nipple.progress > 0.82))

            if(directMoveActive)
            {
                if(this._moveDir.lengthSq() > 0.0001)
                    this._moveDir.normalize()
            }
            else if(fInput !== 0 || sInput !== 0)
            {
                this._moveDir.addScaledVector(this._forwardVec, fInput)
                this._moveDir.addScaledVector(this._rightVec, sInput)
                if(this._moveDir.lengthSq() > 0.0001)
                    this._moveDir.normalize()
            }

            this.isMoving = this._moveDir.lengthSq() > 0.0001

            if(this.isMoving)
            {
                this._targetMoveSpeed = this.isSprinting ? this.runSpeed : this.walkSpeed
                this._currentMoveSpeed += (this._targetMoveSpeed - this._currentMoveSpeed) * Math.min(1, delta * 18.0)

                // Rotar suavemente hacia la dirección de movimiento
                const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z)
                this._targetQuat.setFromAxisAngle(this._yAxis, targetAngle)

                const turnRate = Math.min(1, delta * this.turnSpeed)
                this._tmpQuat.slerp(this._targetQuat, turnRate)

                this.chassisBody.setNextKinematicRotation({
                    x: this._tmpQuat.x,
                    y: this._tmpQuat.y,
                    z: this._tmpQuat.z,
                    w: this._tmpQuat.w
                })

                this._moveDir.multiplyScalar(this._currentMoveSpeed * delta)
            }
            else
            {
                this._targetMoveSpeed = 0
                this._currentMoveSpeed += (0 - this._currentMoveSpeed) * Math.min(1, delta * 16.0)
            }

            // Sonidos procedurales de pasos
            if(this.isMoving && this.isGrounded)
            {
                this._stepTimer += delta
                const stepInterval = this.isSprinting ? 0.25 : 0.42
                if(this._stepTimer >= stepInterval)
                {
                    this._stepTimer = 0
                    if(this.isSprinting)
                        this.proceduralSound.playRunStep()
                    else
                        this.proceduralSound.playWalkStep()
                }
            }
            else
            {
                this._stepTimer = 0.38
            }

            // Salto (Barra espaciadora / botón de salto / tap en el personaje en móvil)
            const touchTapJump = this.game.player?.suspensions?.[0] === 'high'
            if((jumpAction?.active || touchTapJump) && this.isGrounded)
            {
                this.verticalVelocity = this.jumpForce
                this.isGrounded = false
                this.justJumped = true
                this.proceduralSound.playJumpSound()
            }
        }
        else
        {
            this.isMoving = false
            this.isSprinting = false
            this._currentMoveSpeed = 0
        }

        const wasGrounded = this.isGrounded
        this.justLanded = false

        // Gravedad
        this.verticalVelocity += this.gravity * delta
        if(this.verticalVelocity < -40)
            this.verticalVelocity = -40

        if(this.isGrounded && this.verticalVelocity < 0)
            this.verticalVelocity = -0.5

        // Amortiguar impulsos externos
        if(this.externalVelocity.lengthSq() > 0.001)
        {
            this._moveDir.x += this.externalVelocity.x * delta
            this._moveDir.z += this.externalVelocity.z * delta
            this.externalVelocity.multiplyScalar(Math.max(0, 1 - delta * 5))
        }

        this._gravStep.set(0, this.verticalVelocity * delta, 0)
        this._totalMove.addVectors(this._moveDir, this._gravStep)

        let computed = { x: 0, y: 0, z: 0 }
        if(this._totalMove.lengthSq() > 0.000001 || !this.isGrounded || this.verticalVelocity !== 0)
        {
            this.characterController.computeColliderMovement(
                this.chassisCollider,
                { x: this._totalMove.x, y: this._totalMove.y, z: this._totalMove.z }
            )
            computed = this.characterController.computedMovement()

            // Empujar objetos dinámicos (letras, ladrillos, bolos, bancas, cercas) y activar sus callbacks de colisión
            const numCollisions = this.characterController.numComputedCollisions()
            const now = this.game.ticker.elapsed
            for(let i = 0; i < numCollisions; i++)
            {
                const collision = this.characterController.computedCollision(i)
                const otherCollider = collision?.collider
                const otherBody = otherCollider?.parent?.()

                if(otherBody)
                {
                    if(otherBody.isDynamic())
                    {
                        otherBody.wakeUp()
                        const pushSpeed = Math.max(2.5, this._currentMoveSpeed * 0.55)
                        const bodyMass = Math.max(0.08, otherBody.mass())
                        const pushDirX = this.forward.x
                        const pushDirZ = this.forward.z

                        otherBody.applyImpulse({
                            x: pushDirX * pushSpeed * bodyMass * 0.45,
                            y: 0.18 * pushSpeed * bodyMass,
                            z: pushDirZ * pushSpeed * bodyMass * 0.45
                        }, true)
                    }

                    const onCollision = otherBody.userData?.object?.physical?.onCollision
                    if(typeof onCollision === 'function' && this._currentMoveSpeed > 1.0)
                    {
                        const lastTime = this._lastCollisionSoundTime.get(otherBody) || 0
                        if(now - lastTime > 0.25)
                        {
                            this._lastCollisionSoundTime.set(otherBody, now)
                            onCollision(this._currentMoveSpeed, otherBody.translation())
                        }
                    }
                }
            }
        }

        const nextPos = {
            x: translation.x + computed.x,
            y: translation.y + computed.y,
            z: translation.z + computed.z
        }

        this.chassisBody.setNextKinematicTranslation(nextPos)

        this.isGrounded = this.characterController.computedGrounded()
        if(this.isGrounded && this.verticalVelocity < 0)
            this.verticalVelocity = 0

        if(!wasGrounded && this.isGrounded)
        {
            this.justLanded = true
            this.proceduralSound.playLandSound()
        }

        // Actualizar estado de contacto de ruedas dummy para compatibilidad
        this.wheels.inContactCount = this.isGrounded ? 4 : 0
        this.wheels.justTouchedCount = this.justLanded ? 4 : 0
        for(const wheel of this.wheels.items)
        {
            wheel.inContact = this.isGrounded
            wheel.contactPoint.set(nextPos.x, nextPos.y - this.capsuleTotalHalf, nextPos.z)
        }
    }

    updatePostPhysics()
    {
        const newPosition = new THREE.Vector3().copy(this.chassisBody.translation())
        const dt = Math.max(0.001, this.game.ticker.deltaScaled)

        this.velocity.copy(newPosition).sub(this.position)
        if(this.velocity.lengthSq() > 0.000001)
            this.direction.copy(this.velocity).normalize()

        this.position.copy(newPosition)
        this.quaternion.copy(this.chassisBody.rotation())

        // En el modelo del personaje, el frente local es +Z
        this.sideward.set(1, 0, 0).applyQuaternion(this.quaternion)
        this.upward.set(0, 1, 0).applyQuaternion(this.quaternion)
        this.forward.set(0, 0, 1).applyQuaternion(this.quaternion)

        this.speed = this.velocity.length() / dt
        this.xzSpeed = Math.hypot(this.velocity.x, this.velocity.z) / dt
        this.forwardRatio = this.xzSpeed > 0.05 ? Math.max(0.5, this.direction.dot(this.forward)) : 1
        this.goingForward = this.xzSpeed > 0.05
        this.forwardSpeed = this.xzSpeed

        this.xRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'XYZ').x
        this.yRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ').y
        this.zRotation = new THREE.Euler().setFromQuaternion(this.quaternion, 'ZYX').z

        this.stop.test()
    }

    activate()
    {
        this.chassisBody.setEnabled(true)
    }

    deactivate()
    {
        this.chassisBody.setEnabled(false)
    }
}
