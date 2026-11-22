import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { SymbolFrontendDev } from '../SymbolFrontendDev.js'

export class LandingArea extends Area
{
    constructor(model)
    {
        // Evitar que se agreguen las letras del GLB original, el kiosco del mapa ("Map")
        // y los controles antiguos (teclado gigante Plane002/004, gamepad, gizmo, teléfono) del modelo GLB
        for(const child of model.children)
        {
            if(
                child.name.startsWith('refLetters') ||
                child.name.startsWith('physicalFixed003') ||
                child.name.startsWith('physicalFixed.003') ||
                child.name.startsWith('physicalFixed009') ||
                child.name.startsWith('physicalFixed.009') ||
                child.name.startsWith('Plane002') ||
                child.name.startsWith('Plane.002') ||
                child.name.startsWith('Plane004') ||
                child.name.startsWith('Plane.004') ||
                child.name.startsWith('gamepadPhysicalDynamic') ||
                child.name.startsWith('gizmoPhysicalDynamic') ||
                child.name.startsWith('phonePhysicalDynamic') ||
                child.name.startsWith('base.015') ||
                child.name.startsWith('base015') ||
                child.name.startsWith('sword') ||
                child.name.startsWith('Sword') ||
                child.name.startsWith('refBonfireBurn') ||
                child.name.startsWith('refBonfireHashes')
            )
            {
                child.userData.preventAutoAdd = true
                child.visible = false
            }
        }

        model.traverse((child) =>
        {
            if(
                child.name.startsWith('base.015') ||
                child.name.startsWith('base015') ||
                child.name.startsWith('sword') ||
                child.name.startsWith('Sword') ||
                child.name.startsWith('refBonfireBurn') ||
                child.name.startsWith('refBonfireHashes')
            )
            {
                child.userData.preventAutoAdd = true
                child.visible = false
            }
        })

        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        // this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.references.items.get('letters')

        // Calcular el centro, altura del suelo y rotación original donde iban las letras
        const baseRotation = references && references.length > 0
            ? references[0].quaternion.clone()
            : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (25 * Math.PI) / 180)

        const centerWorld = new THREE.Vector3()
        let groundY = 0.022

        if(references && references.length > 0)
        {
            const minPos = new THREE.Vector3(Infinity, Infinity, Infinity)
            const maxPos = new THREE.Vector3(-Infinity, -Infinity, -Infinity)

            for(const ref of references)
            {
                const worldPos = ref.position.clone().add(this.model.position)
                minPos.min(worldPos)
                maxPos.max(worldPos)
            }

            centerWorld.addVectors(minPos, maxPos).multiplyScalar(0.5)
            groundY = centerWorld.y - 0.724
        }
        else
        {
            centerWorld.set(44.04, 0.75, 41.61)
        }

        // Vector dirección a lo largo de la fila de letras (eje X local rotado)
        const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(baseRotation).normalize()

        // Material blanco compatible con el sistema WebGPU/TSL de luces, sombras y niebla del juego
        const textMaterial = new MeshDefaultMaterial({
            colorNode: color(0xffffff),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        const loader = new FontLoader()
        loader.load('fonts/helvetiker_bold.typeface.json', (font) =>
        {
            const text = 'JESUS MARTINEZ'
            const letterSpacing = 0.14
            const spaceWidth = 0.75
            const items = []
            let totalWidth = 0

            for(const char of text)
            {
                if(char === ' ')
                {
                    totalWidth += spaceWidth
                    continue
                }

                const geometry = new TextGeometry(char, {
                    font: font,
                    size: 1.25,
                    depth: 0.38,
                    curveSegments: 3,
                    bevelEnabled: true,
                    bevelThickness: 0.04,
                    bevelSize: 0.03,
                    bevelOffset: 0,
                    bevelSegments: 1
                })

                geometry.computeBoundingBox()
                const bbox = geometry.boundingBox
                const width = bbox.max.x - bbox.min.x
                const height = bbox.max.y - bbox.min.y
                const depth = bbox.max.z - bbox.min.z

                // Centrar la geometría de cada letra en su propio origen (0, 0, 0) para las físicas
                geometry.translate(
                    -0.5 * (bbox.max.x + bbox.min.x),
                    -0.5 * (bbox.max.y + bbox.min.y),
                    -0.5 * (bbox.max.z + bbox.min.z)
                )

                const offsetX = totalWidth + width * 0.5
                totalWidth += width + letterSpacing

                items.push({
                    geometry,
                    width,
                    height,
                    depth,
                    offsetX
                })
            }

            if(items.length > 0)
                totalWidth -= letterSpacing

            // Crear cada letra con su malla 3D y su cuerpo físico dinámico en Rapier3D
            for(const item of items)
            {
                const localX = item.offsetX - totalWidth * 0.5
                const position = centerWorld.clone().addScaledVector(rightDir, localX)
                position.y = groundY + item.height * 0.5

                const mesh = new THREE.Mesh(item.geometry, textMaterial)
                mesh.castShadow = true
                mesh.receiveShadow = true

                const object = this.game.objects.add(
                    {
                        model: mesh,
                        updateMaterials: false,
                        castShadow: true,
                        receiveShadow: true,
                    },
                    {
                        type: 'dynamic',
                        position: position,
                        rotation: baseRotation,
                        friction: 0.4,
                        sleeping: true,
                        mass: 0.2,
                        colliders: [
                            {
                                shape: 'cuboid',
                                parameters: [ item.width * 0.5, item.height * 0.5, item.depth * 0.5 ],
                                category: 'object'
                            }
                        ],
                        contactThreshold: 5,
                        onCollision: (force, collisionPos) =>
                        {
                            this.game.audio.groups.get('hitBrick').playRandomNext(force, collisionPos)
                        }
                    }
                )

                this.objects.items.push(object)
            }
        })
    }

    setKiosk()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Map',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        // Modelo 3D del Joystick (de frontend-portfolio/public/Joystick/Videogame Controller.glb)
        if(this.game.resources.joystickControllerModel)
        {
            const joystickPos = new THREE.Vector3(
                this.model.position.x + 5.23,
                0.65,
                this.model.position.z - 8.20
            )

            this.joystickModel = this.game.resources.joystickControllerModel.scene
            this.joystickModel.scale.setScalar(0.08)
            this.joystickModel.position.copy(joystickPos)

            this.joystickModel.traverse((child) =>
            {
                if(child.isMesh)
                {
                    child.castShadow = true
                    child.receiveShadow = true
                }
            })

            this.game.materials.updateObject(this.joystickModel)
            this.game.scene.add(this.joystickModel)
            this.objects.hideable.push(this.joystickModel)

            // Colisionador físico fijo para el Joystick 3D
            this.game.objects.add(
                null,
                {
                    type: 'fixed',
                    position: joystickPos,
                    colliders: [
                        {
                            shape: 'cuboid',
                            parameters: [ 1.15, 0.75, 0.85 ],
                            category: 'object'
                        }
                    ]
                }
            )
        }

        // Modal de Controles y Guía de Movimiento (portado de frontend-portfolio/assets/joystick.js)
        this._controlsModalOpen = false
        this._buildControlsModal()

        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this._openControlsModal()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
        this._controlsInteractivePoint = interactivePoint
    }

    _buildControlsModal()
    {
        if(document.getElementById('joystick-controls-modal'))
        {
            this._controlsModalEl = document.getElementById('joystick-controls-modal')
            return
        }

        if(!document.getElementById('joystick-controls-modal-styles'))
        {
            const styleTag = document.createElement('style')
            styleTag.id = 'joystick-controls-modal-styles'
            styleTag.textContent = `
                @keyframes joystickModalIn {
                    from { opacity: 0; transform: scale(0.92) translateY(12px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .kbd-badge {
                    display: inline-block;
                    padding: 2px 7px;
                    background: rgba(56, 189, 248, 0.15);
                    border: 1px solid rgba(56, 189, 248, 0.4);
                    color: #7dd3fc;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 12px;
                    font-weight: 700;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .kbd-badge.amber {
                    background: rgba(251, 191, 36, 0.15);
                    border-color: rgba(251, 191, 36, 0.4);
                    color: #fde047;
                }
                .kbd-badge.green {
                    background: rgba(74, 222, 128, 0.15);
                    border-color: rgba(74, 222, 128, 0.4);
                    color: #86efac;
                }
            `
            document.head.appendChild(styleTag)
        }

        const modalEl = document.createElement('div')
        modalEl.id = 'joystick-controls-modal'
        modalEl.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:10000',
            'display:none',
            'align-items:center',
            'justify-content:center',
            'background:rgba(3, 7, 18, 0.78)',
            'backdrop-filter:blur(14px)',
            'padding:16px',
            'font-family:"Segoe UI", system-ui, -apple-system, sans-serif',
            'box-sizing:border-box'
        ].join(';')

        modalEl.innerHTML = `
            <div id="joystick-modal-content" style="
                background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94));
                border: 1px solid rgba(56, 189, 248, 0.4);
                box-shadow: 0 0 35px rgba(56, 189, 248, 0.25), 0 20px 50px rgba(0,0,0,0.6);
                border-radius: 24px;
                width: 100%;
                max-width: 840px;
                max-height: 88vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                color: #f8fafc;
                animation: joystickModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            ">
                <div style="
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: rgba(2, 6, 23, 0.5);
                ">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="
                            width: 44px; height: 44px; border-radius: 14px;
                            background: linear-gradient(135deg, #0284c7, #6366f1);
                            display: flex; align-items: center; justify-content: center;
                            font-size: 22px; box-shadow: 0 0 16px rgba(56, 189, 248, 0.5);
                            flex-shrink: 0;
                        ">🎮</div>
                        <div>
                            <h2 style="margin:0; font-size: 18px; font-weight: 800; letter-spacing:0.03em; color:#fff;">
                                CONTROLS &amp; MOVEMENT GUIDE
                            </h2>
                            <p style="margin:2px 0 0 0; font-size: 12px; color:#94a3b8;">
                                Keyboard (PC) and Touch Screen (Mobile)
                            </p>
                        </div>
                    </div>
                    <button id="joystick-modal-close" style="
                        background: rgba(255, 255, 255, 0.08);
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        color: #94a3b8;
                        width: 36px; height: 36px; border-radius: 10px;
                        cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;
                        transition: all 0.2s; flex-shrink: 0;
                    ">✕</button>
                </div>

                <div style="
                    padding: 20px 24px;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 16px;
                ">
                    <div style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(56, 189, 248, 0.25);
                        border-radius: 16px;
                        padding: 16px;
                    ">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#38bdf8; font-weight:700; font-size:14px;">
                            <span>🏃</span> <span>MOVEMENT — KEYBOARD (PC)</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Walk / Move</span>
                                <div><span class="kbd-badge">W</span> <span class="kbd-badge">A</span> <span class="kbd-badge">S</span> <span class="kbd-badge">D</span></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Sprint</span>
                                <div><span class="kbd-badge">Shift</span> + <span class="kbd-badge">WASD</span></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Jump</span>
                                <span class="kbd-badge">Space</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Crouch</span>
                                <span class="kbd-badge">C</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">Dodge Roll</span>
                                <span class="kbd-badge">Z</span>
                            </div>
                        </div>
                    </div>

                    <div style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(56, 189, 248, 0.35);
                        border-radius: 16px;
                        padding: 16px;
                    ">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#38bdf8; font-weight:700; font-size:14px;">
                            <span>📱</span> <span>MOBILE CONTROLS (TOUCH SCREEN)</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Move Character</span>
                                <span style="color:#7dd3fc; font-weight:600;">One Finger Drag</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Rotate Camera / Zoom</span>
                                <span style="color:#7dd3fc; font-weight:600;">Two Fingers</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Jump</span>
                                <span style="color:#7dd3fc; font-weight:600;">Tap on Character</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">Interact with Objects</span>
                                <span style="color:#7dd3fc; font-weight:600;">Tap JM Logo / Object</span>
                            </div>
                        </div>
                    </div>

                    <div style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(251, 191, 36, 0.25);
                        border-radius: 16px;
                        padding: 16px;
                    ">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#fbbf24; font-weight:700; font-size:14px;">
                            <span>💬</span> <span>EXPRESSIONS &amp; EMOTES</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">👋 Wave / Greet</span>
                                <span class="kbd-badge amber">0</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">😡 Angry / Cross Arms</span>
                                <span class="kbd-badge amber">2</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">💃 Dance</span>
                                <span class="kbd-badge amber">X</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">🥷 Ninja Jump / ⚔️ Actions</span>
                                <div><span class="kbd-badge amber">Q</span> <span class="kbd-badge amber">J</span> <span class="kbd-badge amber">K</span></div>
                            </div>
                        </div>
                    </div>

                    <div style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(74, 222, 128, 0.25);
                        border-radius: 16px;
                        padding: 16px;
                    ">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#4ade80; font-weight:700; font-size:14px;">
                            <span>🗺️</span> <span>WORLD INTERACTIVITY</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">🔊 3D Speaker Music</span>
                                <span style="color:#86efac; font-size:12px;">Approach &amp; ENTER / Click</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">🚩 Projects / About / CV</span>
                                <div><span class="kbd-badge green">ENTER</span> / <span style="color:#86efac; font-size:12px;">Click JM Logo</span></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">🔇 Mute / Respawn</span>
                                <div><span class="kbd-badge green">L</span> <span class="kbd-badge green">R</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="
                    padding: 14px 24px;
                    background: rgba(2, 6, 23, 0.6);
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #64748b;
                ">
                    <span>💡 Press <strong style="color:#cbd5e1;">ESC</strong>, <strong style="color:#cbd5e1;">ENTER</strong> or click the button to close</span>
                    <button id="joystick-modal-btn-ok" style="
                        background: linear-gradient(135deg, #0284c7, #2563eb);
                        color: #fff;
                        border: none;
                        padding: 8px 22px;
                        border-radius: 10px;
                        font-weight: 700;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
                    ">Got it!</button>
                </div>
            </div>
        `

        document.body.appendChild(modalEl)
        this._controlsModalEl = modalEl

        modalEl.querySelector('#joystick-modal-close')?.addEventListener('click', () => this._closeControlsModal())
        modalEl.querySelector('#joystick-modal-btn-ok')?.addEventListener('click', () => this._closeControlsModal())
        modalEl.addEventListener('click', (e) =>
        {
            if(e.target === modalEl)
                this._closeControlsModal()
        })

        window.addEventListener('keydown', (e) =>
        {
            if(this._controlsModalOpen && (e.code === 'Escape' || e.code === 'Enter'))
            {
                e.stopImmediatePropagation()
                e.preventDefault()
                this._closeControlsModal()
            }
        }, true)
    }

    _openControlsModal()
    {
        if(!this._controlsModalEl || this._controlsModalOpen)
            return
        this._controlsModalOpen = true
        this._controlsModalEl.style.display = 'flex'
    }

    _closeControlsModal()
    {
        if(!this._controlsModalEl || !this._controlsModalOpen)
            return
        this._controlsModalOpen = false
        this._controlsModalEl.style.display = 'none'
    }

    setBonfire()
    {
        // Posición original exacta donde estaba la calavera y la espada en LandingArea
        const skullWorldPos = new THREE.Vector3(56.16, 1.45, 47.36)

        // Instanciar el símbolo 3D de Frontend Developer </>
        this.symbolFrontendDev = new SymbolFrontendDev({
            position: skullWorldPos,
            scale: 0.18,
            rotationY: -Math.PI * 0.65
        })

        // Punto interactivo de Frontend Developer
        const refInteractive = this.references.items.get('bonfireInteractivePoint')
        const pointPos = refInteractive && refInteractive.length > 0
            ? refInteractive[0].position.clone().add(this.model.position)
            : new THREE.Vector3(54.45, 1.2, 46.30)

        this.game.interactivePoints.create(
            pointPos,
            'Frontend Dev',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1

        // Leve oscilación y giro suave del Joystick 3D en su lugar
        if(this.joystickModel)
        {
            this.joystickModel.position.y = 0.65 + Math.sin(this.game.ticker.elapsed * 2.0) * 0.12
            this.joystickModel.rotation.y += this.game.ticker.deltaScaled * 0.5
        }
    }
}