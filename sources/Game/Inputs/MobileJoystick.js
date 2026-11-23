import { Game } from '../Game.js'

/**
 * MobileJoystick
 *
 * Joystick virtual táctil en la parte inferior de la pantalla, visible únicamente
 * en dispositivos móviles y tablets (nunca en escritorio/PC).
 * - Joystick izquierdo: movimiento 360° suave (siempre camina, nunca corre por presionar fuerte).
 * - Botones derechos: Saltar (tap) y Correr (mantener pulsado de forma voluntaria).
 * - Multi-touch independiente para moverse, correr y saltar a la vez sin bloquear el canvas.
 */
export class MobileJoystick
{
    constructor()
    {
        this.game = Game.getInstance()

        this.enabled = false
        this.active = false
        this.x = 0
        this.y = 0
        this.magnitude = 0
        this.sprintActive = false
        this.jumpActive = false

        this._stickTouchId = null
        this._sprintTouchId = null
        this._jumpTouchId = null
        this._centerX = 0
        this._centerY = 0
        this._maxRadius = 42

        this.container = document.querySelector('.js-mobile-controls')
        this.zone = this.container?.querySelector('.js-joystick-zone') || null
        this.base = this.container?.querySelector('.js-joystick-base') || null
        this.knob = this.container?.querySelector('.js-joystick-knob') || null
        this.jumpBtn = this.container?.querySelector('.js-mobile-jump') || null
        this.sprintBtn = this.container?.querySelector('.js-mobile-sprint') || null

        this._updateDeviceVisibility()
        this._bindEvents()
    }

    _detectMobileOrTablet()
    {
        const ua = navigator.userAgent || ''
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
        // iPadOS 13+ se reporta como MacIntel con pantalla multi-touch
        const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
        const isCoarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
        const isTouchTabletViewport = hasTouch && isCoarsePointer && window.innerWidth <= 1366

        return isMobileUA || isIPadOS || isTouchTabletViewport
    }

    _updateDeviceVisibility()
    {
        this.enabled = this._detectMobileOrTablet()

        if(this.enabled)
            document.documentElement.classList.add('is-mobile-tablet')
        else
            document.documentElement.classList.remove('is-mobile-tablet')

        if(!this.enabled)
            this.reset()
    }

    _bindEvents()
    {
        this._onResize = () => this._updateDeviceVisibility()
        window.addEventListener('resize', this._onResize, { passive: true })
        window.addEventListener('orientationchange', this._onResize, { passive: true })

        if(!this.container)
            return

        // Evitar que los toques sobre los controles disparen raycasts o eventos del canvas
        const stopProp = (e) => e.stopPropagation()
        this.container.addEventListener('pointerdown', stopProp)
        this.container.addEventListener('mousedown', stopProp)

        if(this.zone)
        {
            this.zone.addEventListener('touchstart', (e) => this._onStickStart(e), { passive: false })
            this.zone.addEventListener('touchmove', (e) => this._onStickMove(e), { passive: false })
            this.zone.addEventListener('touchend', (e) => this._onStickEnd(e), { passive: false })
            this.zone.addEventListener('touchcancel', (e) => this._onStickEnd(e), { passive: false })
        }

        if(this.jumpBtn)
        {
            this.jumpBtn.addEventListener('touchstart', (e) =>
            {
                e.preventDefault()
                e.stopPropagation()
                if(this._jumpTouchId === null && e.changedTouches.length > 0)
                {
                    this._jumpTouchId = e.changedTouches[0].identifier
                    this.jumpActive = true
                    this.jumpBtn.classList.add('is-pressed')
                }
            }, { passive: false })

            const endJump = (e) =>
            {
                e.preventDefault()
                e.stopPropagation()
                for(const touch of e.changedTouches)
                {
                    if(touch.identifier === this._jumpTouchId)
                    {
                        this._jumpTouchId = null
                        this.jumpActive = false
                        this.jumpBtn.classList.remove('is-pressed')
                        break
                    }
                }
            }
            this.jumpBtn.addEventListener('touchend', endJump, { passive: false })
            this.jumpBtn.addEventListener('touchcancel', endJump, { passive: false })
        }

        if(this.sprintBtn)
        {
            this.sprintBtn.addEventListener('touchstart', (e) =>
            {
                e.preventDefault()
                e.stopPropagation()
                if(this._sprintTouchId === null && e.changedTouches.length > 0)
                {
                    this._sprintTouchId = e.changedTouches[0].identifier
                    this.sprintActive = true
                    this.sprintBtn.classList.add('is-pressed')
                }
            }, { passive: false })

            const endSprint = (e) =>
            {
                e.preventDefault()
                e.stopPropagation()
                for(const touch of e.changedTouches)
                {
                    if(touch.identifier === this._sprintTouchId)
                    {
                        this._sprintTouchId = null
                        this.sprintActive = false
                        this.sprintBtn.classList.remove('is-pressed')
                        break
                    }
                }
            }
            this.sprintBtn.addEventListener('touchend', endSprint, { passive: false })
            this.sprintBtn.addEventListener('touchcancel', endSprint, { passive: false })
        }

        // Seguridad: resetear si la pestaña pierde foco
        window.addEventListener('blur', () => this.reset())
    }

    _onStickStart(e)
    {
        if(!this.enabled)
            return

        e.preventDefault()
        e.stopPropagation()

        if(this._stickTouchId !== null || e.changedTouches.length === 0)
            return

        const touch = e.changedTouches[0]
        this._stickTouchId = touch.identifier

        const rect = this.base.getBoundingClientRect()
        this._centerX = rect.left + rect.width * 0.5
        this._centerY = rect.top + rect.height * 0.5
        this._maxRadius = Math.max(28, rect.width * 0.36)

        this.active = true
        this.base?.classList.add('is-active')
        this._updateStickFromPoint(touch.clientX, touch.clientY)
    }

    _onStickMove(e)
    {
        if(this._stickTouchId === null)
            return

        e.preventDefault()
        e.stopPropagation()

        for(const touch of e.changedTouches)
        {
            if(touch.identifier === this._stickTouchId)
            {
                this._updateStickFromPoint(touch.clientX, touch.clientY)
                break
            }
        }
    }

    _onStickEnd(e)
    {
        if(this._stickTouchId === null)
            return

        e.preventDefault()
        e.stopPropagation()

        for(const touch of e.changedTouches)
        {
            if(touch.identifier === this._stickTouchId)
            {
                this._resetStick()
                break
            }
        }
    }

    _updateStickFromPoint(clientX, clientY)
    {
        const dx = clientX - this._centerX
        const dy = clientY - this._centerY
        const dist = Math.hypot(dx, dy)
        const clampedDist = Math.min(dist, this._maxRadius)
        const angle = Math.atan2(dy, dx)

        const offsetX = dist > 0.001 ? Math.cos(angle) * clampedDist : 0
        const offsetY = dist > 0.001 ? Math.sin(angle) * clampedDist : 0

        const rawMag = clampedDist / this._maxRadius
        // Pequeña zona muerta para evitar micro-deriva
        if(rawMag < 0.08)
        {
            this.x = 0
            this.y = 0
            this.magnitude = 0
        }
        else
        {
            const normMag = (rawMag - 0.08) / 0.92
            this.x = (offsetX / this._maxRadius)
            // En pantalla Y hacia arriba es negativo, pero forward (+fInput) es positivo
            this.y = -(offsetY / this._maxRadius)
            this.magnitude = Math.min(1, normMag)
        }

        if(this.knob)
        {
            this.knob.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0)`
        }
    }

    _resetStick()
    {
        this._stickTouchId = null
        this.active = false
        this.x = 0
        this.y = 0
        this.magnitude = 0
        this.base?.classList.remove('is-active')
        if(this.knob)
            this.knob.style.transform = 'translate3d(0px, 0px, 0)'
    }

    reset()
    {
        this._resetStick()
        this._jumpTouchId = null
        this.jumpActive = false
        this.jumpBtn?.classList.remove('is-pressed')

        this._sprintTouchId = null
        this.sprintActive = false
        this.sprintBtn?.classList.remove('is-pressed')
    }
}
