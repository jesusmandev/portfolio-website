import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { InteractivePoints } from '../InteractivePoints.js'

export class Statue
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.position = options.position || new THREE.Vector3(35.76, 0, 13.41)
        this.rotationY = options.rotationY !== undefined ? options.rotationY : 0.4
        this.scale = options.scale || 6.5
        this.radius = options.radius || 6.5

        this.isNear = false
        this.isOpen = false

        this.createModel()
        this.createPhysics()
        this.createUI()
        this.setInteractivePoint()
        this.setEvents()
    }

    setInteractivePoint()
    {
        if(!this.game.interactivePoints)
            return

        const forwardX = Math.sin(this.rotationY) * 3.8
        const forwardZ = Math.cos(this.rotationY) * 3.8
        const pointPos = new THREE.Vector3(
            this.position.x + forwardX,
            this.position.y + 1.5,
            this.position.z + forwardZ
        )

        this.interactivePoint = this.game.interactivePoints.create(
            pointPos,
            'About Me',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.open()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems([ 'interact' ])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
            }
        )
    }

    createModel()
    {
        this.group = new THREE.Group()
        this.group.position.copy(this.position)
        this.group.rotation.y = this.rotationY
        this.game.scene.add(this.group)

        const rawModel = this.game.resources.statueModel
        if(!rawModel)
        {
            console.warn('[Statue] statueModel resource not found')
            return
        }

        const model = rawModel.scene.clone()

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        // Align base to Y = 0 and center X/Z
        model.position.set(-center.x, -box.min.y, -center.z)

        // Scale to desired height
        const scaleFactor = this.scale / (size.y || 1)
        model.scale.setScalar(scaleFactor)

        this.scaledSize = size.clone().multiplyScalar(scaleFactor)

        model.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        this.group.add(model)

        // Subtle ambient blue/cyan point light at base
        const blueGlow = new THREE.PointLight(0x00a0ff, 1.2, 12, 1.8)
        blueGlow.position.set(0, 1.8, 1.2)
        this.group.add(blueGlow)
    }

    createPhysics()
    {
        // Add solid physical collider with category: 'object' so the player cannot pass through
        const halfHeight = 2.5
        const halfX = Math.max(1.5, (this.scaledSize?.x || 3.0) * 0.42)
        const halfZ = Math.max(1.5, (this.scaledSize?.z || 3.0) * 0.42)
        const radius = Math.max(1.5, Math.max(halfX, halfZ))

        this.physicalObject = this.game.objects.add(
            null,
            {
                type: 'fixed',
                category: 'object',
                position: {
                    x: this.position.x,
                    y: this.position.y + halfHeight,
                    z: this.position.z
                },
                rotation: this.group.quaternion,
                friction: 0.6,
                restitution: 0.05,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ halfX, halfHeight, halfZ ],
                        category: 'object'
                    },
                    {
                        shape: 'cylinder',
                        parameters: [ halfHeight, radius ],
                        category: 'object'
                    }
                ]
            }
        )
    }

    createUI()
    {
        this.createStyles()

        // ABOUT ME MODAL (la interacción se muestra con el punto 3D JM + Corona)
        this.modalElement = document.createElement('div')
        this.modalElement.className = 'aboutme-modal-backdrop'
        this.modalElement.style.display = 'none'

        this.modalElement.innerHTML = `
            <div class="aboutme-modal-scroll" id="aboutmeModalCard">
                <div class="aboutme-top-glow"></div>

                <!-- HEADER -->
                <div class="aboutme-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="picture 4/About_me.png" alt="About Me Icon" style="width: 26px; height: 26px; object-fit: contain;" />
                        <span style="color: rgba(100,190,255,0.75); font-size: 11px; font-family: Inter, sans-serif; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase;">
                            ABOUT ME
                        </span>
                    </div>
                    <button class="aboutme-close-btn" id="aboutmeCloseBtn">×</button>
                </div>

                <!-- BODY: 2 COLUMNS -->
                <div class="aboutme-body-grid">
                    <!-- Left column -->
                    <div class="aboutme-left-col">
                        <div style="position: relative;">
                            <div class="aboutme-photo-glow"></div>
                            <div class="aboutme-photo-wrap">
                                <img src="picture 2/JESUS'S_PICTURE.png" alt="Jesús Martínez" style="width: 100%; height: 100%; object-fit: cover; object-position: center 15%;" />
                            </div>
                        </div>

                        <div style="text-align: center;">
                            <h3 style="color: #fff; font-size: 17px; font-family: Inter, sans-serif; font-weight: 800; margin: 0 0 5px; letter-spacing: -0.02em;">
                                Jesús Martínez
                            </h3>
                            <p style="color: #00a0ff; font-size: 11px; font-family: Inter, sans-serif; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin: 0; text-shadow: 0 0 20px rgba(0,160,255,0.4);">
                                Frontend Developer
                            </p>
                        </div>

                        <div class="aboutme-chips">
                            <div class="aboutme-chip"><span>📍</span><span>Montería, Colombia</span></div>
                            <div class="aboutme-chip"><span>💻</span><span>Frontend Developer</span></div>
                            <div class="aboutme-chip"><span>🎨</span><span>UI Design</span></div>
                            <div class="aboutme-chip"><span>🚀</span><span>Continuous Learner</span></div>
                        </div>
                    </div>

                    <!-- Right column -->
                    <div class="aboutme-right-col">
                        <div>
                            <h2 style="color: #fff; font-size: 28px; font-family: Inter, sans-serif; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 10px; line-height: 1.2;">
                                Hi, I'm Jesús Martínez.
                            </h2>
                            <p style="color: #00a0ff; font-size: 15px; font-family: Inter, sans-serif; font-weight: 600; margin: 0; line-height: 1.55; text-shadow: 0 0 25px rgba(0,150,255,0.2);">
                                Frontend Developer — I turn ideas and designs into real websites that work and deliver results.
                            </p>
                        </div>

                        <p style="color: rgba(175,180,195,0.85); font-size: 14px; font-family: Inter, sans-serif; font-weight: 400; line-height: 1.8; margin: 0;">
                            Many businesses and projects get stuck between a great idea and a website that actually works. I bridge that gap: I take your Figma design or landing page concept and turn it into a real, fast, pixel-perfect site. I combine clean code with sharp attention to visual detail, so your digital presence not only looks great but loads fast, works on any device, and helps your business attract more clients. When the project calls for it, I also bring interactive 3D experiences with Three.js — that extra touch that makes a site memorable, not just visitable.
                        </p>

                        <!-- Skills grid (5 cards) -->
                        <div class="aboutme-skills-grid">
                            <div class="aboutme-skill-card">
                                <div style="font-size: 20px; margin-bottom: 7px;">🎨</div>
                                <div style="color: #fff; font-size: 13px; font-family: Inter, sans-serif; font-weight: 700; margin-bottom: 3px;">Design to Code</div>
                                <div style="color: rgba(145,145,155,0.8); font-size: 11px; font-family: Inter, sans-serif;">Pixel-perfect fidelity, no surprises</div>
                            </div>
                            <div class="aboutme-skill-card">
                                <div style="font-size: 20px; margin-bottom: 7px;">🚀</div>
                                <div style="color: #fff; font-size: 13px; font-family: Inter, sans-serif; font-weight: 700; margin-bottom: 3px;">Converting Landing Pages</div>
                                <div style="color: rgba(145,145,155,0.8); font-size: 11px; font-family: Inter, sans-serif;">Results-focused, not just aesthetics</div>
                            </div>
                            <div class="aboutme-skill-card">
                                <div style="font-size: 20px; margin-bottom: 7px;">◎</div>
                                <div style="color: #fff; font-size: 13px; font-family: Inter, sans-serif; font-weight: 700; margin-bottom: 3px;">Responsive Design</div>
                                <div style="color: rgba(145,145,155,0.8); font-size: 11px; font-family: Inter, sans-serif;">Perfect on any device</div>
                            </div>
                            <div class="aboutme-skill-card">
                                <div style="font-size: 20px; margin-bottom: 7px;">⚡</div>
                                <div style="color: #fff; font-size: 13px; font-family: Inter, sans-serif; font-weight: 700; margin-bottom: 3px;">High Performance</div>
                                <div style="color: rgba(145,145,155,0.8); font-size: 11px; font-family: Inter, sans-serif;">Fast loading, optimized code</div>
                            </div>
                            <div class="aboutme-skill-card">
                                <div style="font-size: 20px; margin-bottom: 7px;">🧊</div>
                                <div style="color: #fff; font-size: 13px; font-family: Inter, sans-serif; font-weight: 700; margin-bottom: 3px;">3D Experiences</div>
                                <div style="color: rgba(145,145,155,0.8); font-size: 11px; font-family: Inter, sans-serif;">Immersive interfaces with Three.js</div>
                            </div>
                        </div>

                        <!-- Quote -->
                        <div class="aboutme-quote-box">
                            <div class="aboutme-quote-bar"></div>
                            <p style="color: rgba(225,225,230,0.9); font-size: 13px; font-family: Inter, sans-serif; font-style: italic; font-weight: 500; line-height: 1.7; margin: 0;">
                                "I don't just deliver a website; I deliver the solution that connects your idea with your clients."
                            </p>
                        </div>

                        <!-- Close hint -->
                        <div style="display: flex; align-items: center; gap: 8px; opacity: 0.38; margin-top: -4px;">
                            <div style="padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.28); color: rgba(255,255,255,0.7); font-size: 10px; font-family: monospace; letter-spacing: 0.05em;">
                                ESC
                            </div>
                            <span style="color: rgba(255,255,255,0.5); font-size: 11px; font-family: Inter, sans-serif;">
                                or click outside to close
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `
        document.body.appendChild(this.modalElement)

        // Close handlers
        const closeBtn = this.modalElement.querySelector('#aboutmeCloseBtn')
        if(closeBtn)
        {
            closeBtn.addEventListener('click', (e) =>
            {
                e.stopPropagation()
                this.close()
            })
        }

        this.modalElement.addEventListener('click', (e) =>
        {
            if(e.target === this.modalElement)
                this.close()
        })

        const card = this.modalElement.querySelector('#aboutmeModalCard')
        if(card)
        {
            card.addEventListener('click', (e) => e.stopPropagation())
            card.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
        }
    }

    createStyles()
    {
        if(document.getElementById('statue-aboutme-styles')) return

        const style = document.createElement('style')
        style.id = 'statue-aboutme-styles'
        style.textContent = `
            /* MODAL */
            .aboutme-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.82);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                animation: backdropIn 0.35s ease;
                transform: translateZ(0);
            }
            .aboutme-modal-scroll {
                position: relative;
                width: min(92vw, 960px);
                max-height: 88vh;
                overflow-y: auto;
                background: rgba(7, 9, 14, 0.96);
                border: 1px solid rgba(0, 150, 255, 0.2);
                border-radius: 24px;
                box-shadow: 0 0 100px rgba(0, 120, 255, 0.1), 0 40px 100px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06);
                animation: modalSlideUp 0.45s cubic-bezier(0.25, 1, 0.5, 1);
                will-change: transform;
                transform: translateZ(0);
                overscroll-behavior: contain;
                -webkit-overflow-scrolling: touch;
            }
            .aboutme-modal-scroll::-webkit-scrollbar {
                width: 6px;
            }
            .aboutme-modal-scroll::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
            }
            .aboutme-modal-scroll::-webkit-scrollbar-thumb {
                background: rgba(0, 150, 255, 0.35);
                border-radius: 10px;
            }
            .aboutme-modal-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 160, 255, 0.7);
            }
            .aboutme-top-glow {
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%) translateY(-50%);
                width: 350px;
                height: 180px;
                background: radial-gradient(ellipse, rgba(0, 140, 255, 0.15) 0%, transparent 70%);
                pointer-events: none;
                z-index: 0;
            }
            .aboutme-header {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 24px 32px 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            .aboutme-close-btn {
                width: 34px;
                height: 34px;
                border-radius: 9px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.45);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                line-height: 1;
                transition: all 0.2s ease;
            }
            .aboutme-close-btn:hover {
                background: rgba(0, 150, 255, 0.15);
                border-color: rgba(0, 150, 255, 0.4);
                color: #00a0ff;
            }
            .aboutme-body-grid {
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: 220px 1fr;
                min-height: 400px;
            }
            @media (max-width: 640px) {
                .aboutme-body-grid {
                    grid-template-columns: 1fr;
                }
            }
            .aboutme-left-col {
                padding: 32px 24px 32px 32px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 18px;
                border-right: 1px solid rgba(255, 255, 255, 0.05);
            }
            .aboutme-photo-glow {
                position: absolute;
                inset: -14px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0, 120, 255, 0.22) 0%, transparent 70%);
                animation: fireGlow 2.5s ease-in-out infinite alternate;
            }
            .aboutme-photo-wrap {
                width: 148px;
                height: 148px;
                border-radius: 50%;
                overflow: hidden;
                border: 2px solid rgba(0, 160, 255, 0.45);
                box-shadow: 0 0 35px rgba(0, 120, 255, 0.18);
                background: rgba(0, 120, 255, 0.04);
                position: relative;
            }
            .aboutme-chips {
                display: flex;
                flex-direction: column;
                gap: 8px;
                width: 100%;
            }
            .aboutme-chip {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 7px 11px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.07);
                color: rgba(190, 190, 200, 0.8);
                font-size: 12px;
                font-family: Inter, sans-serif;
                box-sizing: border-box;
            }
            .aboutme-right-col {
                padding: 32px 32px 32px 28px;
                display: flex;
                flex-direction: column;
                gap: 22px;
            }
            .aboutme-skills-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 10px;
            }
            .aboutme-skill-card {
                padding: 14px 16px;
                border-radius: 11px;
                background: rgba(255, 255, 255, 0.025);
                border: 1px solid rgba(255, 255, 255, 0.06);
                transition: all 0.2s ease;
                cursor: default;
            }
            .aboutme-skill-card:hover {
                background: rgba(0, 140, 255, 0.07);
                border-color: rgba(0, 140, 255, 0.28);
                transform: translateY(-2px);
            }
            .aboutme-quote-box {
                position: relative;
                padding: 18px 18px 18px 26px;
                border-radius: 11px;
                background: linear-gradient(90deg, rgba(255, 255, 255, 0.035), transparent);
                border: 1px solid rgba(255, 255, 255, 0.055);
                border-left: none;
                overflow: hidden;
            }
            .aboutme-quote-bar {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 3px;
                background: #00a0ff;
                box-shadow: 0 0 12px rgba(0, 160, 255, 0.55);
            }

            @keyframes flameParticle {
                0%, 100% { transform: translateY(0) scale(1); opacity: 0.85; }
                50% { transform: translateY(-10px) scale(0.55); opacity: 0.25; }
            }
            @keyframes enterPulse {
                0%, 100% { box-shadow: 0 0 20px rgba(0, 120, 255, 0.32), inset 0 1px 0 rgba(100, 220, 255, 0.14); }
                50% { box-shadow: 0 0 40px rgba(0, 120, 255, 0.6), inset 0 1px 0 rgba(100, 240, 255, 0.22); }
            }
            @keyframes fireGlow {
                0% { opacity: 0.55; transform: scale(1); }
                100% { opacity: 1; transform: scale(1.1); }
            }
            @keyframes backdropIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes modalSlideUp {
                from { opacity: 0; transform: translateY(28px) scale(0.97); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `
        document.head.appendChild(style)
    }

    setEvents()
    {
        // Check proximity on each tick
        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })

        // Keydown Enter listener
        this.onKeyDown = (e) =>
        {
            if(e.code === 'Enter')
            {
                if(this.isNear && !this.isOpen)
                {
                    e.stopImmediatePropagation()
                    this.open()
                }
            }
            else if(e.code === 'Escape')
            {
                if(this.isOpen)
                {
                    e.stopImmediatePropagation()
                    this.close()
                }
            }
        }
        window.addEventListener('keydown', this.onKeyDown, true)
    }

    update()
    {
        if(!this.game.player) return

        const playerPos = this.game.player.position
        const dx = playerPos.x - this.position.x
        const dz = playerPos.z - this.position.z
        const distSq = dx * dx + dz * dz

        this.isNear = distSq < (this.radius * this.radius)
    }

    open()
    {
        if(this.isOpen) return
        this.isOpen = true
        this.modalElement.style.display = 'flex'
        if(this.interactivePoint)
            this.interactivePoint.hide()

        // Disable vehicle controls while modal is open
        if(this.game.player?.vehicle)
        {
            this.game.player.vehicle.controls.forward = false
            this.game.player.vehicle.controls.backward = false
            this.game.player.vehicle.controls.left = false
            this.game.player.vehicle.controls.right = false
            this.game.player.vehicle.controls.boost = false
            this.game.player.vehicle.controls.brake = true
        }
    }

    close()
    {
        if(!this.isOpen) return
        this.isOpen = false
        this.modalElement.style.display = 'none'
        if(this.interactivePoint)
            this.interactivePoint.show()

        // Release brake
        if(this.game.player?.vehicle)
        {
            this.game.player.vehicle.controls.brake = false
        }
    }

    destroy()
    {
        if(this.onKeyDown)
            window.removeEventListener('keydown', this.onKeyDown, true)

        if(this.modalElement && this.modalElement.parentNode)
            this.modalElement.parentNode.removeChild(this.modalElement)

        if(this.group)
            this.game.scene.remove(this.group)
    }
}
