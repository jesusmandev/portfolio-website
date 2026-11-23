import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Track } from '../Tracks.js'
import { Trails } from '../Trails.js'
import { Player } from '../Player.js'

const digitAnimationMap = {
    '1': 'Idle_Loop',
    '2': 'Idle_FoldArms_Loop',
    '3': 'Idle_Talking_Loop',
    '4': 'Idle_TalkingPhone_Loop',
    '5': 'Idle_No_Loop',
    '6': 'Idle_Lantern_Loop',
    '7': 'Idle_Torch_Loop',
    '8': 'Idle_Rail_Loop',
    '9': 'Idle_Rail_Call',
    '0': 'Yes',
}

const extraKeyAnimationMap = {
    'x': 'Dance_Loop',
    'z': 'Roll',
    'c': 'Crouch_Idle_Loop',
    'v': 'Consume',
    'p': 'ClimbUp_1m',
    'q': 'NinjaJump_Start',
    'k': 'Sword_Attack',
    'j': 'Punch_Jab',
    'u': 'PickUp_Table',
    'y': 'Death01',
}

export function showHelloIntroImage()
{
    const existing = document.getElementById('hello-intro-overlay')
    if(existing)
        existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'hello-intro-overlay'
    overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'pointer-events: none',
        'z-index: 99999',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'overflow: hidden'
    ].join(';')

    const img = document.createElement('img')
    img.src = './hello/hello-intro.png'
    img.alt = 'Hello Intro'
    img.style.cssText = [
        'max-width: 44vw',
        'max-height: 44vh',
        'object-fit: contain',
        'transform: translate(12vw, 120vh) scale(0.5)',
        'opacity: 0',
        'transition: transform 0.85s cubic-bezier(0.175, 0.885, 0.32, 1.25), opacity 0.6s ease',
        'filter: drop-shadow(0 15px 45px rgba(0,0,0,0.65))'
    ].join(';')

    overlay.appendChild(img)
    document.body.appendChild(overlay)

    requestAnimationFrame(() =>
    {
        requestAnimationFrame(() =>
        {
            img.style.transform = 'translate(24vw, -14vh) scale(0.85)'
            img.style.opacity = '1'
        })
    })

    setTimeout(() =>
    {
        img.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease-out'
        img.style.transform = 'translate(24vw, -20vh) scale(0.78)'
        img.style.opacity = '0'
        setTimeout(() =>
        {
            if(overlay.parentNode)
                overlay.parentNode.removeChild(overlay)
        }, 700)
    }, 3000)
}

export class VisualVehicle
{
    constructor(model)
    {
        this.game = Game.getInstance()

        this.model = this.game.resources.characterModel ? this.game.resources.characterModel.scene : model
        this.mixer = null
        this.actions = {}
        this.currentAction = null
        this._introState = 'falling'
        this._feetOffsetY = 0
        this._swimBlend = 0
        this._forcedActionName = null

        this.setParts()
        this.setAnimations()
        this.setCustomAnimationHotkeys()
        this.setMainGroundTrack()
        this.setWheels()
        this.setBoostTrails()
        this.setScreenPosition()
        this.setPaints()

        this.tickCallback = () =>
        {
            this.update()
        }
        this.game.ticker.events.on('tick', this.tickCallback, 8)
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.tickCallback)

        if(this._boundKeyDown)
            window.removeEventListener('keydown', this._boundKeyDown)

        if(this.mixer && this.parts.chassis)
        {
            this.mixer.stopAllAction()
            this.mixer.uncacheRoot(this.parts.chassis)
        }

        if(this.parts?.chassis)
            this.parts.chassis.removeFromParent()

        if(this.mainGroundTrack)
            this.game.tracks.remove(this.mainGroundTrack)
    }

    setParts()
    {
        this.parts = {}

        const characterRoot = this.model
        characterRoot.position.set(0, 0, 0)
        characterRoot.rotation.set(0, 0, 0)
        characterRoot.scale.setScalar(1)

        const targetHeight = this.game.physicalVehicle?.targetHeight || 2.6
        characterRoot.scale.setScalar(targetHeight / 1.8)

        characterRoot.updateMatrixWorld(true)
        const bbox = new THREE.Box3().setFromObject(characterRoot)
        this._feetOffsetY = isFinite(bbox.min.y) ? bbox.min.y : 0

        characterRoot.traverse((child) =>
        {
            if(child.isMesh)
            {
                // Ocultar los cristales opacos de las gafas para que se vean los ojos y la montura claramente
                if(child.name === 'avaturn_glasses_1')
                {
                    child.visible = false
                    return
                }

                child.receiveShadow = false
                child.castShadow = (child.name === 'avaturn_body' || child.name === 'avaturn_look_0')

                if(child.geometry?.attributes?.position?.count > 0)
                {
                    try
                    {
                        child.geometry.computeBoundingSphere()
                    }
                    catch(_) {}

                    if(!child.geometry.boundingSphere || isNaN(child.geometry.boundingSphere.radius))
                    {
                        child.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10)
                    }
                    else
                    {
                        child.geometry.boundingSphere.radius *= 2.5
                    }
                }
            }
        })

        this.game.materials.updateObject(characterRoot)

        this.parts.chassis = characterRoot
        this.parts.bodyPainted = characterRoot
        this.game.scene.add(this.parts.chassis)
    }

    setAnimations()
    {
        this.mixer = new THREE.AnimationMixer(this.parts.chassis)
        this.mixer.addEventListener('finished', (e) => this.onActionFinished(e))

        const animResource = this.game.resources.characterAnimations
        const clips = animResource?.animations?.length
            ? animResource.animations
            : (this.game.resources.characterModel?.animations || [])

        for(const clip of clips)
        {
            this.actions[clip.name] = this.mixer.clipAction(clip)
        }

        // Pre-calentar poses principales (incluyendo nado y caída Death01)
        const posesToWarm = [
            'Idle_Loop', 'Walk_Loop', 'Sprint_Loop', 'Jump_Loop',
            'Jump_Start', 'Jump_Land', 'Roll', 'Crouch_Idle_Loop',
            'Sword_Block', 'Yes', 'Dance_Loop',
            'Swim_Fwd_Loop', 'Swim_Idle_Loop', 'Death01'
        ]
        for(const name of posesToWarm)
        {
            const act = this.actions[name]
            if(act)
            {
                act.play()
                this.mixer.update(0.001)
                act.stop()
            }
        }

        this.playAction('Idle_Loop')
        this.mixer.update(0)
    }

    setCustomAnimationHotkeys()
    {
        this._boundKeyDown = (e) =>
        {
            if(this.game.player && this.game.player.state !== Player.STATE_DEFAULT)
                return

            const activeEl = document.activeElement
            if(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable))
                return

            if(!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey)
            {
                const k = e.key.toLowerCase()
                const clipName = digitAnimationMap[e.key] || extraKeyAnimationMap[k]
                if(clipName)
                {
                    this.playAction(clipName)
                }
            }
        }

        window.addEventListener('keydown', this._boundKeyDown)
    }

    playAction(name)
    {
        const action = this.actions[name]
        if(!action)
            return
        if(this.currentAction === action)
            return

        const isLoop = name.endsWith('_Loop') || name === 'Sword_Idle' || name === 'A_TPose'
        const prevClipName = this.currentAction ? this.currentAction.getClip().name : null
        const isSwimTransition = name.startsWith('Swim_') || (prevClipName && prevClipName.startsWith('Swim_'))
        const isRecoveringFromFall = prevClipName === 'Death01' && name === 'Idle_Loop'
        const fadeDuration = isRecoveringFromFall ? 0.5 : (isSwimTransition ? 0.20 : 0.09)

        action.reset()
        action.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1)
        action.clampWhenFinished = !isLoop

        let timeScale = isLoop ? 1.0 : 1.08
        if(name === 'Walk_Loop')
            timeScale = 1.35
        else if(name === 'Sprint_Loop')
            timeScale = 1.15
        else if(name === 'Swim_Fwd_Loop')
            timeScale = 1.10

        action.timeScale = timeScale

        if(this.currentAction)
        {
            this.currentAction.fadeOut(fadeDuration)
        }

        action.fadeIn(fadeDuration).play()
        this.currentAction = action

        if(name === 'Yes')
        {
            showHelloIntroImage()
        }
    }

    forceAction(name)
    {
        const action = this.actions[name]
        if(!action)
            return

        this._forcedActionName = name
        const isLoop = name.endsWith('_Loop') || name === 'Sword_Idle' || name === 'A_TPose'

        action.enabled = true
        action.reset()
        action.setEffectiveTimeScale(1.0)
        action.setEffectiveWeight(1.0)
        action.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1)
        action.clampWhenFinished = !isLoop

        if(this.currentAction && this.currentAction !== action)
        {
            this.currentAction.fadeOut(0.14)
            action.fadeIn(0.14).play()
        }
        else
        {
            action.play()
        }

        this.currentAction = action
    }

    clearForcedAction()
    {
        this._forcedActionName = null
    }

    onActionFinished(e)
    {
        const name = e.action.getClip().name
        if(name === 'Death01')
            return

        if(name === 'Sword_Block' && this._introState === 'landing')
        {
            this._introState = 'handGesture'
            this.playAction('Yes')
        }
        else if(name === 'Yes' && this._introState === 'handGesture')
        {
            this._introState = 'done'
            this.playAction('Idle_Loop')
        }
        else
        {
            const isLoop = name.endsWith('_Loop') || name === 'Sword_Idle' || name === 'A_TPose'
            if(!isLoop)
            {
                this.playAction('Idle_Loop')
            }
        }
    }

    onRespawn()
    {
        this._introState = 'falling'
        this._forcedActionName = null
    }

    setPaints()
    {
        this.paints = {}
        this.paints.choices = {}
        this.paints.changeTo = () => {}
    }

    setMainGroundTrack()
    {
        this.mainGroundTrack = this.game.tracks.add(new Track(0.85, 'g'))
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.items = []
        this.wheels.steering = 0
    }

    setBoostTrails()
    {
        this.boostTrails = {}
        this.boostTrails.instance = new Trails()

        this.boostTrails.leftReference = new THREE.Object3D()
        this.boostTrails.leftReference.position.set(-0.25, 0.1, -0.3)
        this.parts.chassis.add(this.boostTrails.leftReference)

        this.boostTrails.left = this.boostTrails.instance.create()
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)

        this.boostTrails.rightReference = new THREE.Object3D()
        this.boostTrails.rightReference.position.set(0.25, 0.1, -0.3)
        this.parts.chassis.add(this.boostTrails.rightReference)

        this.boostTrails.right = this.boostTrails.instance.create()
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
    }

    setScreenPosition()
    {
        this.screenPosition = new THREE.Vector2(0, 0)
    }

    update()
    {
        const physicalVehicle = this.game.physicalVehicle
        const delta = Math.min(this.game.ticker.deltaScaled || 1 / 60, 0.05)

        if(this.mixer)
            this.mixer.update(delta)

        // Secuencia de aterrizaje inicial
        if(this._introState === 'falling' && physicalVehicle.isGrounded)
        {
            this._introState = 'landing'
            this.playAction('Sword_Block')
        }

        // Locomoción automática según el estado físico del personaje (si no hay una animación forzada como Death01)
        const currentClip = this.currentAction ? this.currentAction.getClip().name : null

        if(this._forcedActionName)
        {
            // Mantener la animación forzada (ej. Death01 en el suelo) sin que la locomoción la sobrescriba
        }
        else if(physicalVehicle.isSwimming)
        {
            if(physicalVehicle.isMoving)
            {
                this.playAction('Swim_Fwd_Loop')
                if(this.actions['Swim_Fwd_Loop'])
                    this.actions['Swim_Fwd_Loop'].timeScale = physicalVehicle.isSprinting ? 1.4 : 1.05
            }
            else
            {
                this.playAction('Swim_Idle_Loop')
            }
        }
        else if(physicalVehicle.justJumped)
        {
            this.playAction('Jump_Loop')
        }
        else if(physicalVehicle.isMoving)
        {
            if(physicalVehicle.isGrounded || currentClip !== 'Jump_Loop')
            {
                if(physicalVehicle.isSprinting)
                {
                    this.playAction('Sprint_Loop')
                    if(this.actions['Sprint_Loop'])
                        this.actions['Sprint_Loop'].timeScale = physicalVehicle.panicOverride?.active ? 1.45 : 1.15
                }
                else
                    this.playAction('Walk_Loop')
            }
        }
        else if(physicalVehicle.isGrounded || currentClip === 'Swim_Fwd_Loop' || currentClip === 'Swim_Idle_Loop')
        {
            if(
                currentClip === 'Walk_Loop' ||
                currentClip === 'Sprint_Loop' ||
                currentClip === 'Jump_Loop' ||
                currentClip === 'Swim_Fwd_Loop' ||
                currentClip === 'Swim_Idle_Loop'
            )
            {
                this.playAction('Idle_Loop')
            }
        }

        // Sincronizar posición y rotación del modelo 3D:
        // - En tierra: pies exactos sobre el suelo (capsuleBottomY)
        // - En agua (nadando): Swim_Fwd_Loop y Swim_Idle_Loop tienen las caderas debajo de Y=0 y espalda/cabeza arriba,
        //   así que al alinear la raíz con la superficie del agua queda exactamente mitad adentro y mitad afuera.
        const groundMeshY = physicalVehicle.capsuleBottomY - (this._feetOffsetY || 0)
        const targetSwimBlend = physicalVehicle.isSwimming ? 1 : 0
        this._swimBlend += (targetSwimBlend - this._swimBlend) * Math.min(1, delta * 7.5)

        const waterY = this.game.water?.surfaceElevation ?? -0.3
        const swimBob = Math.sin((this.game.ticker.elapsed || 0) * 2.8) * 0.04
        const swimSurfaceOffset = physicalVehicle.isMoving ? -0.04 : 0.04
        const swimMeshY = waterY + swimSurfaceOffset + swimBob

        const targetMeshY = groundMeshY + (swimMeshY - groundMeshY) * this._swimBlend
        this.parts.chassis.position.set(
            physicalVehicle.position.x,
            targetMeshY,
            physicalVehicle.position.z
        )
        this.parts.chassis.quaternion.copy(physicalVehicle.quaternion)

        // Huellas sobre el terreno / nieve / pasto (solo fuera del agua)
        this.mainGroundTrack.update(
            new THREE.Vector3(physicalVehicle.position.x, targetMeshY, physicalVehicle.position.z),
            physicalVehicle.isGrounded && !physicalVehicle.isSwimming
        )

        // Estelas al correr rápido o durante el Dash (incluye Air-Dash)
        const showTrail = physicalVehicle.isDashing || (physicalVehicle.isMoving && physicalVehicle.isSprinting && physicalVehicle.isGrounded && !physicalVehicle.isSwimming)
        const trailAlpha = showTrail ? (physicalVehicle.isDashing ? 1.0 : 0.78) : 0
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)
        this.boostTrails.left.alpha = trailAlpha
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
        this.boostTrails.right.alpha = trailAlpha

        // Posición en pantalla para el efecto see-through de los árboles (Foliage.js)
        const vector = new THREE.Vector3(
            physicalVehicle.position.x,
            physicalVehicle.position.y,
            physicalVehicle.position.z
        )
        vector.project(this.game.view.camera)

        this.screenPosition.x = (vector.x * 0.5 + 0.5)
        this.screenPosition.y = (vector.y * -0.5 + 0.5)
    }
}
