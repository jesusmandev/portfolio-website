/**
 * MobileControlsManager.js
 *
 * Touch Controls ONLY for Mobile/Tablet Devices.
 * Detects mobile strictly: only shown when the device has touch support AND
 * is a mobile/tablet screen (no mouse pointer available as primary input).
 *
 * Controls:
 * - Virtual Joystick (Bottom-Left) for WASD movement
 * - Action Buttons (Bottom-Right) for Jump, Sprint toggle, Dance, Wave
 * - Right-side swipe for Camera Rotation
 */
export class MobileControlsManager {
    constructor(game, character) {
        this.game = game;
        this.character = character;

        this.container = null;
        this.joystickBase = null;
        this.joystickKnob = null;
        this._swipeListeners = [];
        this._sprintActive = false;

        // Strict mobile detection:
        // - Must have touchstart support
        // - Must NOT be a fine-pointer device (mouse) as primary input
        // - OR must be small enough screen (phones)
        this.isMobile = this._detectMobile();

        if (this.isMobile) {
            this._initUI();
        }
    }

    /**
     * Returns true only if the device is a real mobile/tablet touch device.
     * Excludes desktops with touch screens (e.g. Surface, touch monitors).
     */
    _detectMobile() {
        // 1. Must have touch support
        const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!hasTouch) return false;

        // 2. Check if primary pointer is coarse (finger) vs. fine (mouse)
        //    matchMedia('(pointer: coarse)') is true on phones/tablets
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

        // 3. Fallback: user-agent check for common mobile strings
        const ua = navigator.userAgent || '';
        const isMobileUA = /Android|iPhone|iPod|iPad|Mobile|IEMobile|BlackBerry|Opera Mini/i.test(ua);

        // Show controls if coarse pointer OR mobile UA with touch
        return isCoarsePointer || isMobileUA;
    }

    _initUI() {
        // Remove existing if any
        const existing = document.getElementById('mobile-touch-controls-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = 'mobile-touch-controls-container';
        container.style.cssText = [
            'position: fixed',
            'inset: 0',
            'pointer-events: none',
            'z-index: 9990',
            'user-select: none',
            '-webkit-user-select: none',
            'touch-action: none'
        ].join(';');

        container.innerHTML = `
            <!-- Left Side: Virtual Joystick -->
            <div id="touch-joystick-base" style="
                position: absolute;
                bottom: 28px;
                left: 28px;
                width: 130px;
                height: 130px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(10,17,35,0.92) 0%, rgba(20,30,55,0.82) 100%);
                border: 2px solid rgba(56,189,248,0.6);
                box-shadow: 0 0 28px rgba(56,189,248,0.3), inset 0 0 18px rgba(0,0,0,0.55);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                pointer-events: auto;
                touch-action: none;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <!-- Crosshair lines -->
                <div style="
                    position: absolute; top: 50%; left: 12px; right: 12px;
                    height: 1px; background: rgba(56,189,248,0.25); transform: translateY(-50%);
                    pointer-events: none;
                "></div>
                <div style="
                    position: absolute; left: 50%; top: 12px; bottom: 12px;
                    width: 1px; background: rgba(56,189,248,0.25); transform: translateX(-50%);
                    pointer-events: none;
                "></div>
                <div id="touch-joystick-knob" style="
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
                    border: 2px solid rgba(255,255,255,0.9);
                    box-shadow: 0 0 18px rgba(56,189,248,0.9), 0 4px 14px rgba(0,0,0,0.5);
                    pointer-events: none;
                    position: relative;
                    z-index: 1;
                "></div>
            </div>

            <!-- Right Side: Action Buttons -->
            <div id="touch-action-buttons" style="
                position: absolute;
                bottom: 28px;
                right: 24px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: flex-end;
                pointer-events: auto;
                touch-action: manipulation;
            ">
                <!-- Top Row: Emotes + Guide -->
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button id="btn-touch-dance" title="Bailar" style="
                        width: 46px; height: 46px; border-radius: 50%;
                        background: rgba(168,85,247,0.9); border: 1.5px solid rgba(233,213,255,0.85);
                        color: #fff; font-size: 19px; display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 4px 12px rgba(168,85,247,0.5);
                        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
                        cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
                    ">💃</button>

                    <button id="btn-touch-wave" title="Saludar" style="
                        width: 46px; height: 46px; border-radius: 50%;
                        background: rgba(245,158,11,0.9); border: 1.5px solid rgba(254,243,199,0.85);
                        color: #fff; font-size: 19px; display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 4px 12px rgba(245,158,11,0.5);
                        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
                        cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
                    ">👋</button>

                    <button id="btn-touch-guide" title="Guía de Controles" style="
                        width: 46px; height: 46px; border-radius: 50%;
                        background: rgba(14,165,233,0.9); border: 1.5px solid rgba(186,230,253,0.85);
                        color: #fff; font-size: 19px; display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 4px 12px rgba(14,165,233,0.5);
                        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
                        cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
                    ">🎮</button>
                </div>

                <!-- Bottom Row: Sprint + Jump -->
                <div style="display: flex; gap: 14px; align-items: center;">
                    <button id="btn-touch-sprint" title="Correr" style="
                        width: 58px; height: 58px; border-radius: 50%;
                        background: linear-gradient(135deg, rgba(234,179,8,0.95), rgba(180,120,0,0.95));
                        border: 2px solid rgba(254,240,138,0.9);
                        color: #fff; font-size: 22px; display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 6px 16px rgba(234,179,8,0.5);
                        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
                        cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
                        font-weight: 800;
                    ">⚡</button>

                    <button id="btn-touch-jump" title="Saltar" style="
                        width: 72px; height: 72px; border-radius: 50%;
                        background: linear-gradient(135deg, rgba(37,99,235,0.95), rgba(2,132,199,0.95));
                        border: 2.5px solid rgba(186,230,253,0.9);
                        color: #fff; font-size: 30px; display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 6px 24px rgba(56,189,248,0.65);
                        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
                        cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
                    ">🦘</button>
                </div>
            </div>

            <!-- Camera swipe hint -->
            <div id="touch-cam-hint" style="
                position: absolute;
                top: 50%;
                right: 16px;
                transform: translateY(-50%);
                opacity: 0;
                color: rgba(255,255,255,0.35);
                font-size: 11px;
                font-family: sans-serif;
                text-align: center;
                pointer-events: none;
                transition: opacity 0.4s ease;
                writing-mode: vertical-rl;
                letter-spacing: 0.05em;
            ">Desliza para girar cámara ↕</div>
        `;

        document.body.appendChild(container);
        this.container = container;

        this.joystickBase = document.getElementById('touch-joystick-base');
        this.joystickKnob = document.getElementById('touch-joystick-knob');

        this._setupJoystickEvents();
        this._setupActionButtons();
        this._setupCameraSwipe();
    }

    _setupJoystickEvents() {
        const base = this.joystickBase;
        const knob = this.joystickKnob;
        if (!base || !knob) return;

        const maxDist = 46; // max knob displacement in px
        let activeId = null;

        const getPos = (touches, id) => {
            for (let t of touches) {
                if (t.identifier === id) return t;
            }
            return null;
        };

        const onStart = (e) => {
            e.preventDefault();
            // Use the first touch that starts on the joystick base
            const newTouch = Array.from(e.changedTouches).find(t =>
                t.target === base || base.contains(t.target)
            );
            if (!newTouch || activeId !== null) return;
            activeId = newTouch.identifier;
            this._applyJoystick(newTouch, base, knob, maxDist);
        };

        const onMove = (e) => {
            e.preventDefault();
            if (activeId === null) return;
            const t = getPos(e.touches, activeId);
            if (t) this._applyJoystick(t, base, knob, maxDist);
        };

        const onEnd = (e) => {
            e.preventDefault();
            const ended = Array.from(e.changedTouches).find(t => t.identifier === activeId);
            if (!ended) return;
            activeId = null;
            knob.style.transform = 'translate(0px, 0px)';
            if (this.character) {
                this.character.sideInput = 0;
                this.character.forwardInput = 0;
            }
        };

        base.addEventListener('touchstart', onStart, { passive: false });
        base.addEventListener('touchmove', onMove, { passive: false });
        base.addEventListener('touchend', onEnd, { passive: false });
        base.addEventListener('touchcancel', onEnd, { passive: false });
    }

    _applyJoystick(touch, base, knob, maxDist) {
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let dx = touch.clientX - cx;
        let dy = touch.clientY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        knob.style.transform = `translate(${dx}px, ${dy}px)`;

        const normX = dx / maxDist;
        const normY = dy / maxDist;

        if (this.character) {
            this.character.sideInput = normX;
            // Forward: negative dy = up on screen = forward in game
            this.character.forwardInput = normY < 0 ? Math.abs(normY) : -Math.abs(normY);
        }
    }

    _setupActionButtons() {
        const btnJump   = document.getElementById('btn-touch-jump');
        const btnSprint = document.getElementById('btn-touch-sprint');
        const btnDance  = document.getElementById('btn-touch-dance');
        const btnWave   = document.getElementById('btn-touch-wave');
        const btnGuide  = document.getElementById('btn-touch-guide');

        // Jump: hold = jump active, release = jump off
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.character) this.character.jumpInput = true;
                btnJump.style.transform = 'scale(0.92)';
            }, { passive: false });

            btnJump.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (this.character) this.character.jumpInput = false;
                btnJump.style.transform = 'scale(1)';
            }, { passive: false });

            btnJump.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                if (this.character) this.character.jumpInput = false;
                btnJump.style.transform = 'scale(1)';
            }, { passive: false });
        }

        // Sprint: toggle on/off
        if (btnSprint) {
            btnSprint.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._sprintActive = !this._sprintActive;
                if (this.character) this.character.sprintInput = this._sprintActive;
                if (this._sprintActive) {
                    btnSprint.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
                    btnSprint.style.boxShadow = '0 0 28px #fbbf24, 0 6px 16px rgba(234,179,8,0.6)';
                    btnSprint.style.transform = 'scale(1.08)';
                } else {
                    btnSprint.style.background = 'linear-gradient(135deg, rgba(234,179,8,0.95), rgba(180,120,0,0.95))';
                    btnSprint.style.boxShadow = '0 6px 16px rgba(234,179,8,0.5)';
                    btnSprint.style.transform = 'scale(1)';
                }
            }, { passive: false });
        }

        if (btnDance) {
            btnDance.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.character) this.character.playAction('Dance_Loop');
                btnDance.style.transform = 'scale(0.9)';
                setTimeout(() => { btnDance.style.transform = 'scale(1)'; }, 150);
            }, { passive: false });
        }

        if (btnWave) {
            btnWave.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.character) this.character.playAction('Yes');
                btnWave.style.transform = 'scale(0.9)';
                setTimeout(() => { btnWave.style.transform = 'scale(1)'; }, 150);
            }, { passive: false });
        }

        // Guide: dispatch Enter keydown to open the controls modal
        if (btnGuide) {
            btnGuide.addEventListener('touchstart', (e) => {
                e.preventDefault();
                window.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', bubbles: true
                }));
                btnGuide.style.transform = 'scale(0.9)';
                setTimeout(() => { btnGuide.style.transform = 'scale(1)'; }, 150);
            }, { passive: false });
        }
    }

    _setupCameraSwipe() {
        let startX = 0;
        let startY = 0;
        let swipeTouchId = null;

        const onTouchStart = (e) => {
            // Only start camera swipe on the right portion of screen (not on joystick/buttons areas)
            const touch = e.changedTouches[0];
            if (!touch) return;

            const isOnJoystick = this.joystickBase && this.joystickBase.contains(touch.target);
            const isOnButtons = document.getElementById('touch-action-buttons')?.contains(touch.target);
            if (isOnJoystick || isOnButtons) return;

            // Right 65% of the screen (excludes joystick area on the left)
            if (touch.clientX > window.innerWidth * 0.35) {
                swipeTouchId = touch.identifier;
                startX = touch.clientX;
                startY = touch.clientY;
            }
        };

        const onTouchMove = (e) => {
            if (swipeTouchId === null || !this.game) return;
            const touch = Array.from(e.touches).find(t => t.identifier === swipeTouchId);
            if (!touch) return;

            const dx = touch.clientX - startX;
            startX = touch.clientX;
            startY = touch.clientY;

            if (typeof this.game.rotateCameraBy === 'function') {
                this.game.rotateCameraBy(-dx * 0.007);
            }
        };

        const onTouchEnd = (e) => {
            const ended = Array.from(e.changedTouches).find(t => t.identifier === swipeTouchId);
            if (ended) swipeTouchId = null;
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchEnd, { passive: true });

        // Store refs to remove on destroy
        this._swipeListeners = [
            { type: 'touchstart', fn: onTouchStart },
            { type: 'touchmove',  fn: onTouchMove  },
            { type: 'touchend',   fn: onTouchEnd   },
            { type: 'touchcancel', fn: onTouchEnd  },
        ];
    }

    destroy() {
        this._swipeListeners.forEach(({ type, fn }) => {
            window.removeEventListener(type, fn);
        });
        this._swipeListeners = [];

        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}
