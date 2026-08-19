import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import RAPIER from '@dimforge/rapier3d-compat';

const HUD_ID = 'joystick-interaction-hud';
const MODAL_ID = 'joystick-controls-modal';

let _hudEl = null;
let _modalEl = null;

function _getHUD() {
    if (!_hudEl) {
        // Reuse water-hud-styles if not yet injected
        if (!document.getElementById('water-hud-styles')) {
            const _s = document.createElement('style');
            _s.id = 'water-hud-styles';
            _s.textContent = `
                @keyframes _whud-pulse{0%,100%{opacity:.92;}50%{opacity:1;}}
                @keyframes _whud-waves{0%{transform:translateX(0) rotate(0deg);}50%{transform:translateX(-25%) rotate(2deg);}100%{transform:translateX(-50%) rotate(0deg);}}
                .whud-wrap{position:relative;padding:2px;border-radius:999px;animation:_whud-pulse 3s infinite ease-in-out;cursor:pointer;overflow:hidden;transition:transform .2s ease;}
                .whud-wrap:hover{transform:scale(1.03);}
                .whud-inner{position:relative;background:#0f172a;border-radius:999px;padding:11px 22px;display:flex;align-items:center;gap:10px;overflow:hidden;}
                .whud-water{position:absolute;bottom:0;left:0;width:100%;height:52%;z-index:1;pointer-events:none;border-bottom-left-radius:999px;border-bottom-right-radius:999px;overflow:hidden;}
                .whud-wave{position:absolute;bottom:0;left:0;width:200%;height:100%;border-radius:40%;}
                .whud-wave:nth-child(1){animation:_whud-waves 4s infinite linear;}
                .whud-wave:nth-child(2){bottom:-5px;border-radius:45%;animation:_whud-waves 6s infinite linear reverse;}
                .whud-wave:nth-child(3){bottom:-2px;border-radius:42%;opacity:.7;animation:_whud-waves 3s infinite linear;}
                .whud-content{position:relative;z-index:20;display:flex;align-items:center;gap:10px;white-space:nowrap;}
                .whud-badge{background:rgba(51,65,85,.65);color:#f8fafc;padding:2px 10px;border-radius:999px;font-weight:700;font-size:13px;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(4px);}
                .whud-key{font-weight:800;letter-spacing:.05em;font-size:16px;}
                .whud-label{color:#e2e8f0;font-weight:400;font-size:14px;}
            `;
            document.head.appendChild(_s);
        }

        _hudEl = document.createElement('div');
        _hudEl.id = HUD_ID;
        _hudEl.style.cssText = [
            'position:fixed',
            'bottom:82px',
            'left:50%',
            'transform:translateX(-50%)',
            'z-index:9999',
            'display:none',
            'user-select:none',
            'pointer-events:auto',
            'cursor:pointer',
            'max-width:90vw',
            'border-radius:999px',
            'border:2px solid rgba(139,92,246,0.8)',
            'background:linear-gradient(90deg,rgba(139,92,246,0.4) 0%,rgba(139,92,246,0.8) 50%,rgba(139,92,246,0.4) 100%)',
            'font-family:"Segoe UI",system-ui,sans-serif',
        ].join(';');
        _hudEl.innerHTML = `
            <div class="whud-wrap" style="border:none;background:none;padding:0;">
              <div class="whud-inner">
                <div class="whud-water">
                  <div class="whud-wave" style="background:rgba(109,40,217,0.22);"></div>
                  <div class="whud-wave" style="background:rgba(91,33,182,0.16);"></div>
                  <div class="whud-wave" style="background:rgba(76,29,149,0.28);"></div>
                </div>
                <div class="whud-content">
                  <span class="whud-badge">Press</span>
                  <span class="whud-key" style="color:#fbbf24;">ENTER</span>
                  <span class="whud-label">or tap here to view Controls</span>
                </div>
              </div>
            </div>`;
        document.body.appendChild(_hudEl);
    }
    return _hudEl;
}

function _getModal(onClose) {
    if (!_modalEl) {
        _modalEl = document.createElement('div');
        _modalEl.id = MODAL_ID;
        _modalEl.style.cssText = [
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
        ].join(';');

        _modalEl.innerHTML = `
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
                <!-- Header -->
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
                                CONTROLS & MOVEMENT GUIDE
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
                    " onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.color='#f87171'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='#94a3b8'">✕</button>
                </div>

                <!-- Content Grid -->
                <div style="
                    padding: 20px 24px;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 16px;
                ">
                    <!-- Card 1: Movimientos en PC (Teclado) -->
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
                                <span class="kbd-badge">F</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">Dodge Roll</span>
                                <span class="kbd-badge">H</span>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: Controles en Teléfono / Móvil -->
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
                                <span style="color:#7dd3fc; font-weight:600;">Touch Joystick (Bottom Left)</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Rotate Camera</span>
                                <span style="color:#7dd3fc; font-weight:600;">Swipe on the right side</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">Jump / Sprint</span>
                                <span style="color:#7dd3fc; font-weight:600;">On-screen touch buttons</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">Interact with Objects</span>
                                <span style="color:#7dd3fc; font-weight:600;">Tap the object on screen</span>
                            </div>
                        </div>
                    </div>

                    <!-- Card 3: Emotas y Expresiones -->
                    <div style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(251, 191, 36, 0.25);
                        border-radius: 16px;
                        padding: 16px;
                    ">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#fbbf24; font-weight:700; font-size:14px;">
                            <span>💬</span> <span>EXPRESSIONS & EMOTES</span>
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
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">💃 Dance</span>
                                <span class="kbd-badge amber">X</span>
                            </div>
                        </div>
                    </div>

                    <!-- Card 4: Interactividad en la Ciudad -->
                    <div style="
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(74, 222, 128, 0.25);
                        border-radius: 16px;
                        padding: 16px;
                    ">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#4ade80; font-weight:700; font-size:14px;">
                            <span>🗺️</span> <span>CITY INTERACTIVITY</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:5px;">
                                <span style="color:#cbd5e1;">🔊 3D Speaker Music</span>
                                <span style="color:#86efac; font-size:12px;">Approach & Click / Tap</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#cbd5e1;">🚩 View Projects / Info</span>
                                <div><span class="kbd-badge green">ENTER</span> / <span style="color:#86efac; font-size:12px;">Tap the Sign</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
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
                    <span>💡 Press <strong style="color:#cbd5e1;">ESC</strong>, <strong style="color:#cbd5e1;">ENTER</strong> or tap the button to close</span>
                    <button id="joystick-modal-btn-ok" style="
                        background: linear-gradient(135deg, #0284c7, #2563eb);
                        color: #fff;
                        border: none;
                        padding: 8px 22px;
                        border-radius: 10px;
                        font-weight: 700;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
                        transition: opacity 0.2s;
                    " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Got it!</button>
                </div>
            </div>
        `;

        // CSS inline para badges de teclas
        const styleTag = document.createElement('style');
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
            .kbd-badge.purple {
                background: rgba(168, 85, 247, 0.15);
                border-color: rgba(168, 85, 247, 0.4);
                color: #e9d5ff;
            }
            .kbd-badge.green {
                background: rgba(74, 222, 128, 0.15);
                border-color: rgba(74, 222, 128, 0.4);
                color: #86efac;
            }
        `;
        document.head.appendChild(styleTag);
        document.body.appendChild(_modalEl);

        const closeBtn = document.getElementById('joystick-modal-close');
        const okBtn = document.getElementById('joystick-modal-btn-ok');
        if (closeBtn) closeBtn.addEventListener('click', () => onClose());
        if (okBtn) okBtn.addEventListener('click', () => onClose());
        _modalEl.addEventListener('click', (e) => {
            if (e.target === _modalEl) onClose();
        });
    }
    return _modalEl;
}

export class JoystickInteraction {
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = options.physicsWorld || null;

        // Posición especificada en la imagen: X: -318.73, Y: 1.70, Z: -96.23
        this._pos = new THREE.Vector3(
            options.x ?? -318.73,
            options.y ?? 1.70,
            options.z ?? -96.23
        );

        this._radiusSq = 25 * 25; // Distancia de detección (~25 unidades / 1-2 metros)
        this._playerNear = false;
        this._modalOpen = false;

        this._group = null;
        this._model = null;
        this._pedestal = null;
        this._hud = _getHUD();
        this._modal = _getModal(() => this._closeModal());

        if (this._hud) {
            this._hud.onclick = () => {
                if (this._playerNear) {
                    this._toggleModal();
                }
            };
        }

        this._enterHandler = null;
        this._escapeHandler = null;
        this._time = 0;

        this._build();
        this._registerKeys();
    }

    _registerKeys() {
        this._enterHandler = (e) => {
            if (e.code === 'Enter' && this._playerNear) {
                e.stopImmediatePropagation();
                this._toggleModal();
            }
        };
        this._escapeHandler = (e) => {
            if (e.code === 'Escape' && this._modalOpen) {
                e.stopImmediatePropagation();
                this._closeModal();
            }
        };
        window.addEventListener('keydown', this._enterHandler, true);
        window.addEventListener('keydown', this._escapeHandler, true);
    }

    _toggleModal() {
        if (this._modalOpen) {
            this._closeModal();
        } else {
            this._openModal();
        }
    }

    _openModal() {
        this._modalOpen = true;
        this._modal.style.display = 'flex';
        this._hud.style.display = 'none';
    }

    _closeModal() {
        this._modalOpen = false;
        this._modal.style.display = 'none';
        if (this._playerNear) {
            this._hud.style.display = 'block';
        }
    }

    _build() {
        this._group = new THREE.Group();
        this._group.position.copy(this._pos);
        this.scene.add(this._group);

        // Cargar ÚNICA Y EXCLUSIVAMENTE el modelo GLB original con la ruta exacta de la carpeta public/Joystick/
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
        const glbUrl = encodeURI(`${baseUrl}/Joystick/Videogame Controller.glb`);

        loader.load(
            glbUrl,
            (gltf) => {
                this._model = gltf.scene;
                this._model.scale.setScalar(0.3); // Tamaño mini y muy pequeño del control 3D
                this._model.position.set(0, 0, 0);

                this._model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this._group.add(this._model);

                // Colisionador físico Rapier para el joystick GLB
                if (this.physicsWorld) {
                    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(this._pos.x, this._pos.y, this._pos.z);
                    const body = this.physicsWorld.createRigidBody(bodyDesc);
                    const colliderDesc = RAPIER.ColliderDesc.cuboid(1.2, 1.2, 1.2);
                    this.physicsWorld.createCollider(colliderDesc, body);
                }

                console.log('[JoystickInteraction] Modelo GLB Videogame Controller.glb cargado e instalado en (-318.73, 1.70, -96.23).');
            },
            undefined,
            (err) => {
                console.error('[JoystickInteraction] Error al cargar Videogame Controller.glb:', err);
            }
        );
    }

    update(delta, playerPos) {
        this._time += delta;

        // Leve oscilación del control GLB en su lugar
        if (this._model) {
            this._model.position.y = Math.sin(this._time * 2.0) * 0.15;
            this._model.rotation.y += delta * 0.5;
        }

        if (!playerPos) return;

        // Verificar proximidad con el jugador
        const dx = playerPos.x - this._pos.x;
        const dz = playerPos.z - this._pos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= this._radiusSq) {
            if (!this._playerNear) {
                this._playerNear = true;
                if (!this._modalOpen) {
                    this._hud.style.display = 'block';
                }
            }
        } else {
            if (this._playerNear) {
                this._playerNear = false;
                this._hud.style.display = 'none';
                if (this._modalOpen) {
                    this._closeModal();
                }
            }
        }
    }

    destroy() {
        window.removeEventListener('keydown', this._enterHandler, true);
        window.removeEventListener('keydown', this._escapeHandler, true);
        if (this._group) this.scene.remove(this._group);
        const hud = document.getElementById(HUD_ID);
        if (hud) hud.remove();
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove();
    }
}
