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
        this.walkSpeed = 7.8
        this.runSpeed = 18.5
        this.swimSpeed = 5.6
        this.swimSprintSpeed = 10.8
        this.turnSpeed = 18.0
        this.gravity = -24.0
        this.jumpForce = 9.5

        // Parámetros de Dash (impulso rápido con estela y enfriamiento corto)
        this.isDashing = false
        this._dashTimer = 0
        this._dashCooldown = 0
        this._dashDuration = 0.24
        this._dashCooldownDuration = 1.05
        this._dashSpeedBonus = 15.0
        this._dashDir = new THREE.Vector3(0, 0, 1)
        this._dashTrailTimer = 0
        this._wasBoostActive = false
        this._wasDashKeyActive = false
        this._wasMobileSprintRim = false

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
        this.isSwimming = false
        this.waterDepth = 0
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

        // Audio procedural de pasos, salto, agua, dash y caída
        this.proceduralSound = new ProceduralSound()
        this._stepTimer = 0.35
        this._swimStrokeTimer = 0.25
        this._lastCollisionSoundTime = new WeakMap()
        this._lastImpactFxTime = new WeakMap()
        this._feetPos = new THREE.Vector3()

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
        this.isSwimming = false
        this.isDashing = false
        this._dashTimer = 0
        this._dashCooldown = 0
        this.characterController?.enableSnapToGround(0.75)

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

        // Detectar inmersión en agua (inundación por lluvia o ríos/estanques) con histéresis suave
        const waterY = this.game.water?.surfaceElevation ?? -0.3
        const iceRatio = this.game.world?.waterSurface?.iceRatio?.value ?? 0
        const currentBottomY = translation.y - this.capsuleTotalHalf
        this.waterDepth = waterY - currentBottomY

        const wasSwimming = this.isSwimming
        if(iceRatio >= 0.5)
        {
            this.isSwimming = false
        }
        else if(!this.isSwimming && this.waterDepth >= 0.65)
        {
            this.isSwimming = true
        }
        else if(this.isSwimming && this.waterDepth < 0.48)
        {
            this.isSwimming = false
        }

        if(this.isSwimming !== wasSwimming)
        {
            if(this.characterController)
            {
                if(this.isSwimming)
                    this.characterController.disableSnapToGround()
                else
                    this.characterController.enableSnapToGround(0.75)
            }

            if(this.isSwimming && iceRatio < 0.5)
            {
                const splashIntensity = Math.min(1.2, Math.max(0.65, Math.abs(this.verticalVelocity) / 10 + 0.5))
                this.proceduralSound.playWaterSplash(splashIntensity)
                this._feetPos.set(translation.x, waterY, translation.z)
                this.game.world?.gameFeelFX?.emitWaterSplash(this._feetPos, splashIntensity)
            }
        }

        if(this._dashCooldown > 0)
            this._dashCooldown = Math.max(0, this._dashCooldown - delta)

        if(this._dashTimer > 0)
        {
            this._dashTimer = Math.max(0, this._dashTimer - delta)
            this.isDashing = this._dashTimer > 0
        }
        else
        {
            this.isDashing = false
        }

        this._moveDir.set(0, 0, 0)
        this.justJumped = false

        const controlsActive = !this.game.player || this.game.player.state === Player.STATE_DEFAULT
        const fx = this.game.world?.gameFeelFX
        const isInShallowWater = !this.isSwimming && iceRatio < 0.5 && this.waterDepth > 0.06

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
            const dashAction = this.game.inputs.actions.get('brake')
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

            // Soporte para joystick virtual inferior (solo móvil y tablet)
            const mobileJoy = this.game.inputs.mobileJoystick
            let mobileJoyMagnitude = 1.0
            if(fInput === 0 && sInput === 0 && mobileJoy?.enabled && mobileJoy.active && mobileJoy.magnitude > 0.02)
            {
                sInput = mobileJoy.x
                fInput = mobileJoy.y
                mobileJoyMagnitude = 0.35 + 0.65 * mobileJoy.magnitude
            }

            // Fallback táctil (solo si no está activo el joystick virtual inferior)
            let directMoveActive = false
            const nipple = this.game.inputs.nipple
            if(fInput === 0 && sInput === 0 && !mobileJoy?.enabled && nipple?.active && nipple.progress > 0.02)
            {
                const nippleAngle = nipple.targetAngle
                this._moveDir.set(Math.cos(nippleAngle), 0, Math.sin(nippleAngle))
                directMoveActive = true
            }

            const boostNow = !!boostAction?.active
            const dashKeyNow = !!dashAction?.active
            const mobileSprintBtn = !!(mobileJoy?.enabled && mobileJoy.sprintActive)

            // En móvil/tablet ya NO corre ni hace dash automáticamente al empujar lejos el joystick;
            // solo corre si se mantiene pulsado el botón dedicado de Correr (o Shift en PC)
            this.isSprinting = !!(boostNow || mobileSprintBtn || this.isDashing)

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

            // Activar Dash solo con Shift (arranque en PC/gamepad) o tecla Ctrl/B/Cuadrado (nunca por presionar fuerte en móvil)
            const wantsDash =
                (dashKeyNow && !this._wasDashKeyActive) ||
                (boostNow && !this._wasBoostActive && this.isMoving)

            this._wasBoostActive = boostNow
            this._wasDashKeyActive = dashKeyNow

            if(wantsDash && this._dashCooldown <= 0)
            {
                this.isDashing = true
                this._dashTimer = this._dashDuration
                this._dashCooldown = this._dashCooldownDuration

                if(this.isMoving)
                    this._dashDir.copy(this._moveDir).normalize()
                else
                    this._dashDir.set(this.forward.x, 0, this.forward.z).normalize()

                this.proceduralSound.playDashSound()
                this._feetPos.set(translation.x, this.isSwimming ? waterY : currentBottomY, translation.z)
                if(this.isSwimming)
                    fx?.emitWaterSplash(this._feetPos, 0.9)
                else
                    fx?.emitDashBurst(this._feetPos, this._dashDir)
            }

            if(this.isMoving)
            {
                const speedScale = this.isSprinting ? 1.0 : mobileJoyMagnitude
                if(this.isSwimming)
                {
                    this._targetMoveSpeed = (this.isSprinting ? this.swimSprintSpeed : this.swimSpeed) * speedScale
                }
                else
                {
                    this._targetMoveSpeed = (this.isSprinting ? this.runSpeed : this.walkSpeed) * speedScale
                }
                this._currentMoveSpeed += (this._targetMoveSpeed - this._currentMoveSpeed) * Math.min(1, delta * (this.isSwimming ? 10.0 : 18.0))

                // Rotar suavemente hacia la dirección de movimiento
                const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z)
                this._targetQuat.setFromAxisAngle(this._yAxis, targetAngle)

                const turnRate = Math.min(1, delta * (this.isSwimming ? this.turnSpeed * 0.55 : this.turnSpeed))
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
                this._currentMoveSpeed += (0 - this._currentMoveSpeed) * Math.min(1, delta * (this.isSwimming ? 8.0 : 16.0))
            }

            // Aplicar impulso extra suave del Dash + estela de chispas
            if(this.isDashing)
            {
                const dashRatio = this._dashTimer / this._dashDuration
                const dashSpeed = this._dashSpeedBonus * (0.4 + 0.6 * dashRatio) * (this.isSwimming ? 0.65 : 1.0)
                this._moveDir.x += this._dashDir.x * dashSpeed * delta
                this._moveDir.z += this._dashDir.z * dashSpeed * delta
                this.isMoving = true

                this._dashTrailTimer += delta
                if(this._dashTrailTimer >= 0.035)
                {
                    this._dashTrailTimer = 0
                    this._feetPos.set(translation.x, this.isSwimming ? waterY : currentBottomY, translation.z)
                    if(this.isSwimming)
                        fx?.emitWaterRipple(this._feetPos, 0.85)
                    else
                        fx?.emitDashTrail(this._feetPos, this._dashDir)
                }
            }

            // Sonidos y partículas de pasos en tierra / chapoteo en agua poco profunda
            if(this.isMoving && this.isGrounded && !this.isSwimming)
            {
                this._stepTimer += delta
                const stepInterval = this.isSprinting ? 0.23 : 0.40
                if(this._stepTimer >= stepInterval)
                {
                    this._stepTimer = 0
                    this._feetPos.set(translation.x, currentBottomY, translation.z)

                    if(isInShallowWater)
                    {
                        this.proceduralSound.playWaterStep(this.isSprinting)
                        fx?.emitWaterSplash(this._feetPos, this.isSprinting ? 0.55 : 0.32)
                    }
                    else
                    {
                        if(this.isSprinting)
                            this.proceduralSound.playRunStep()
                        else
                            this.proceduralSound.playWalkStep()

                        fx?.emitFootDust(this._feetPos, this.isSprinting)
                    }
                }
            }
            else if(this.isSwimming)
            {
                // Brazadas suaves y ondas en el agua mientras nada
                this._swimStrokeTimer += delta
                const strokeInterval = this.isMoving
                    ? (this.isSprinting ? 0.30 : 0.44)
                    : 1.15

                if(this._swimStrokeTimer >= strokeInterval)
                {
                    this._swimStrokeTimer = 0
                    this._feetPos.set(translation.x, waterY, translation.z)
                    if(this.isMoving)
                    {
                        this.proceduralSound.playSwimStroke(this.isSprinting)
                        fx?.emitWaterSplash(this._feetPos, this.isSprinting ? 0.48 : 0.32)
                    }
                    else
                    {
                        fx?.emitWaterRipple(this._feetPos, 0.9)
                    }
                }
            }
            else
            {
                this._stepTimer = 0.34
            }

            // Salto (solo fuera del modo nado)
            const touchTapJump = this.game.player?.suspensions?.[0] === 'high'
            const mobileJumpBtn = !!(mobileJoy?.enabled && mobileJoy.jumpActive)
            if((jumpAction?.active || touchTapJump || mobileJumpBtn) && this.isGrounded && !this.isSwimming)
            {
                this.verticalVelocity = this.jumpForce
                this.isGrounded = false
                this.justJumped = true
                this.proceduralSound.playJumpSound()
                this._feetPos.set(translation.x, currentBottomY, translation.z)
                if(isInShallowWater)
                    fx?.emitWaterSplash(this._feetPos, 0.7)
                else
                    fx?.emitFootDust(this._feetPos, true)
            }
        }
        else
        {
            this.isMoving = false
            this.isSprinting = false
            this.isDashing = false
            this._dashTimer = 0
            this._currentMoveSpeed = 0
        }

        const wasGrounded = this.isGrounded
        const preLandVy = this.verticalVelocity
        this.justLanded = false

        // Gravedad o flotabilidad suave al nadar (mantiene la cápsula siguiendo el nivel del agua y baja al drenar)
        if(this.isSwimming)
        {
            const bob = Math.sin((this.game.ticker.elapsed || 0) * 2.8) * 0.04
            const desiredBottomY = waterY - 0.85 + bob
            const desiredCenterY = desiredBottomY + this.capsuleTotalHalf
            const yError = desiredCenterY - translation.y
            this.verticalVelocity = Math.max(-5.0, Math.min(5.5, yError * 6.0))
        }
        else
        {
            this.verticalVelocity += this.gravity * delta
            if(this.verticalVelocity < -40)
                this.verticalVelocity = -40

            if(this.isGrounded && this.verticalVelocity < 0)
                this.verticalVelocity = -0.5
        }

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
                        const dashBoost = this.isDashing ? 1.65 : 1.0
                        const pushSpeed = Math.max(2.5, (this._currentMoveSpeed + (this.isDashing ? 10.0 : 0)) * 0.55) * dashBoost
                        const bodyMass = Math.max(0.08, otherBody.mass())
                        const pushDirX = this.forward.x
                        const pushDirZ = this.forward.z

                        otherBody.applyImpulse({
                            x: pushDirX * pushSpeed * bodyMass * 0.45,
                            y: 0.18 * pushSpeed * bodyMass,
                            z: pushDirZ * pushSpeed * bodyMass * 0.45
                        }, true)

                        const lastFxTime = this._lastImpactFxTime.get(otherBody) || 0
                        if(now - lastFxTime > 0.22 && (this._currentMoveSpeed > 2.0 || this.isDashing))
                        {
                            this._lastImpactFxTime.set(otherBody, now)
                            const hitPos = otherBody.translation()
                            const sparkIntensity = Math.min(1.25, (pushSpeed / 12.0))
                            fx?.emitImpactSparks(hitPos, this.isDashing ? 0x38d9ff : 0xfff0c2, sparkIntensity)
                        }
                    }

                    const onCollision = otherBody.userData?.object?.physical?.onCollision
                    if(typeof onCollision === 'function' && (this._currentMoveSpeed > 1.0 || this.isDashing))
                    {
                        const lastTime = this._lastCollisionSoundTime.get(otherBody) || 0
                        if(now - lastTime > 0.25)
                        {
                            this._lastCollisionSoundTime.set(otherBody, now)
                            onCollision(Math.max(this._currentMoveSpeed, this.isDashing ? 16.0 : 0), otherBody.translation())
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
            const impactIntensity = Math.min(1.3, Math.max(0.45, Math.abs(preLandVy) / 11.0))
            this._feetPos.set(nextPos.x, nextPos.y - this.capsuleTotalHalf, nextPos.z)
            if(isInShallowWater)
            {
                this.proceduralSound.playWaterSplash(impactIntensity)
                fx?.emitWaterSplash(this._feetPos, impactIntensity)
            }
            else
            {
                this.proceduralSound.playLandSound()
                fx?.emitLandingDust(this._feetPos, impactIntensity)
            }
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
