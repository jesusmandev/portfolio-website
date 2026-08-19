import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerBoldFont from 'three/examples/fonts/helvetiker_bold.typeface.json';

const HUD_ID = 'logo-interaction-hud';

let _hudEl = null;
let _fontPromise = null;

function getFontPromise() {
    if (!_fontPromise) {
        try {
            const font = new FontLoader().parse(helvetikerBoldFont);
            _fontPromise = Promise.resolve(font);
        } catch (e) {
            console.error('[logo.js] Error parsing font:', e);
            _fontPromise = Promise.reject(e);
        }
    }
    return _fontPromise;
}

// ── Shared water-wave HUD styles (injected once) ────────────────────────────
if (!document.getElementById('water-hud-styles')) {
    const _style = document.createElement('style');
    _style.id = 'water-hud-styles';
    _style.textContent = `
        @keyframes _whud-pulse { 0%,100%{opacity:.92;box-shadow:0 0 12px var(--whud-glow,.3);} 50%{opacity:1;box-shadow:0 0 26px var(--whud-glow,.6);} }
        @keyframes _whud-waves { 0%{transform:translateX(0) rotate(0deg);} 50%{transform:translateX(-25%) rotate(2deg);} 100%{transform:translateX(-50%) rotate(0deg);} }
        .whud-wrap { position:relative; padding:2px; border-radius:999px; animation:_whud-pulse 3s infinite ease-in-out; cursor:pointer; overflow:hidden; transition:transform .2s ease; }
        .whud-wrap:hover { transform:scale(1.03); }
        .whud-inner { position:relative; background:#0f172a; border-radius:999px; padding:11px 22px; display:flex; align-items:center; gap:10px; overflow:hidden; }
        .whud-water { position:absolute; bottom:0; left:0; width:100%; height:52%; z-index:1; pointer-events:none; border-bottom-left-radius:999px; border-bottom-right-radius:999px; overflow:hidden; }
        .whud-wave { position:absolute; bottom:0; left:0; width:200%; height:100%; border-radius:40%; }
        .whud-wave:nth-child(1) { animation:_whud-waves 4s infinite linear; }
        .whud-wave:nth-child(2) { bottom:-5px; border-radius:45%; animation:_whud-waves 6s infinite linear reverse; }
        .whud-wave:nth-child(3) { bottom:-2px; border-radius:42%; opacity:.7; animation:_whud-waves 3s infinite linear; }
        .whud-content { position:relative; z-index:20; display:flex; align-items:center; gap:10px; white-space:nowrap; }
        .whud-badge { background:rgba(51,65,85,.65); color:#f8fafc; padding:2px 10px; border-radius:999px; font-weight:700; font-size:13px; border:1px solid rgba(255,255,255,.12); backdrop-filter:blur(4px); }
        .whud-key { font-weight:800; letter-spacing:.05em; font-size:16px; }
        .whud-label { color:#e2e8f0; font-weight:400; font-size:14px; }
    `;
    document.head.appendChild(_style);
}

/** Build a water-wave HUD element.
 * @param {object} opts
 *   waveColors: [string,string,string]  – rgba for 3 wave layers
 *   borderColor: string                 – border rgba
 *   glowColor: string                   – box-shadow rgba
 *   keyText: string                     – e.g. 'ENTER'
 *   keyColor: string                    – text color for keyText
 *   labelText: string                   – e.g. 'or tap here to view projects'
 *   bottom: string                      – CSS bottom value
 *   pointerEvents: string
 */
function _buildWaterHUD(id, opts) {
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = [
        'position:fixed',
        `bottom:${opts.bottom || '82px'}`,
        'left:50%',
        'transform:translateX(-50%)',
        `z-index:9999`,
        'display:none',
        'user-select:none',
        `pointer-events:${opts.pointerEvents || 'auto'}`,
        'max-width:90vw',
        'font-family:"Segoe UI",system-ui,sans-serif',
        'letter-spacing:0.04em',
        `border-radius:999px`,
        `border:2px solid ${opts.borderColor}`,
        `background:linear-gradient(90deg,${opts.borderColor.replace(')',',0.5)').replace('rgba(','rgba(')} 0%,${opts.borderColor} 50%,${opts.borderColor.replace(')',',0.5)').replace('rgba(','rgba(')} 100%)`,
    ].join(';');
    const [w1, w2, w3] = opts.waveColors;
    el.innerHTML = `
        <div class="whud-wrap" style="border:none;background:none;padding:0;">
          <div class="whud-inner">
            <div class="whud-water">
              <div class="whud-wave" style="background:${w1};"></div>
              <div class="whud-wave" style="background:${w2};"></div>
              <div class="whud-wave" style="background:${w3};"></div>
            </div>
            <div class="whud-content">
              <span class="whud-badge">Press</span>
              <span class="whud-key" style="color:${opts.keyColor};">${opts.keyText}</span>
              <span class="whud-label">${opts.labelText}</span>
            </div>
          </div>
        </div>`;
    document.body.appendChild(el);
    return el;
}

function _getHUD() {
    if (!_hudEl) {
        _hudEl = _buildWaterHUD(HUD_ID, {
            bottom: '82px',
            borderColor: 'rgba(14,165,233,0.8)',
            waveColors: [
                'rgba(2,132,199,0.22)',
                'rgba(3,105,161,0.16)',
                'rgba(7,89,133,0.28)',
            ],
            keyText: 'ENTER',
            keyColor: '#fbbf24',
            labelText: 'or tap here to view projects',
            pointerEvents: 'auto',
        });
        _hudEl.style.cursor = 'pointer';
    }
    return _hudEl;
}

let _escHudEl = null;
function _getEscHUD() {
    if (!_escHudEl) {
        _escHudEl = _buildWaterHUD('projects-esc-hud', {
            bottom: '36px',
            borderColor: 'rgba(239,68,68,0.75)',
            waveColors: [
                'rgba(185,28,28,0.22)',
                'rgba(153,27,27,0.16)',
                'rgba(127,29,29,0.28)',
            ],
            keyText: 'ESC',
            keyColor: '#f87171',
            labelText: 'to close projects',
            pointerEvents: 'none',
        });
    }
    return _escHudEl;
}

export class LogoInteraction {
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this._mode = options.mode || 'projects'; // 'projects' o 'aboutMe'
        this._logoPos = new THREE.Vector3(
            options.x ?? -614.93,
            options.y ?? 0.20,
            options.z ?? -34.58,
        );
        this._radius = options.radius ?? 18;
        this._boardFocus = new THREE.Vector3(
            options.boardFocus?.x ?? -612.58,
            options.boardFocus?.y ?? 14.2,   // centro del tablero con scale 4.0
            options.boardFocus?.z ?? -54.9,  // cara frontal del tablero
        );
        this._boardCam = new THREE.Vector3(
            options.boardCam?.x ?? -612.58,
            options.boardCam?.y ?? 16.0,     // ligeramente por encima del centro
            options.boardCam?.z ?? -30.0,    // ~25 u. frente al tablero (FOV 60°, ancho 22u)
        );
        this._playerNear = false;
        this._boardOpen = false;
        this._group = null;
        this._material = null;
        this._hud = (this._mode === 'projects') ? _getHUD() : null;
        this._enterHandler = null;
        this._escapeHandler = null;
        this._logoOpenHandler = null;
        this._camTransitioning = false;
        this._camFromPos = new THREE.Vector3();
        this._camLerpT = 0;
        this._time = 0;
        this._ready = false;

        this._build();
        this._registerKeys();
        if (this._mode === 'projects') {
            this._registerOpenEvent();
        }

        if (this._hud) {
            this._hud.onclick = () => {
                if (this._playerNear && !this._boardOpen) {
                    this._openBoard();
                }
            };
        }
    }

    get isBoardOpen() {
        return this._boardOpen;
    }

    _registerOpenEvent() {
        this._logoOpenHandler = () => {
            if (this._playerNear && !this._boardOpen) {
                this._openBoard();
            }
        };
        window.addEventListener('logo:open', this._logoOpenHandler);
    }

    _registerKeys() {
        this._enterHandler = (e) => {
            if (e.code === 'Enter' && this._playerNear) {
                if (this._mode === 'aboutMe') {
                    e.stopImmediatePropagation();
                    window.dispatchEvent(new CustomEvent('flame:open'));
                } else if (this._mode === 'cv') {
                    e.stopImmediatePropagation();
                    window.dispatchEvent(new CustomEvent('cv:open'));
                } else if (this._mode === 'rubik') {
                    e.stopImmediatePropagation();
                    window.dispatchEvent(new CustomEvent('rubik:enter-play'));
                } else if (!this._boardOpen) {
                    e.stopImmediatePropagation();
                    this._openBoard();
                }
            }
        };
        this._escapeHandler = (e) => {
            if (e.code === 'Escape' && this._boardOpen) {
                e.stopImmediatePropagation();
                this._closeBoard();
            }
        };
        window.addEventListener('keydown', this._enterHandler, true);
        window.addEventListener('keydown', this._escapeHandler, true);
    }

    _openBoard() {
        if (this._mode !== 'projects') return;
        this._boardOpen = true;
        this._camTransitioning = true;
        this._camLerpT = 0;
        this._camFromPos.copy(this.camera.position);
        if (this._hud) this._hud.style.display = 'none';
        const escHud = _getEscHUD();
        if (escHud) escHud.style.display = 'block';
        window.dispatchEvent(new CustomEvent('projects:board', { detail: { open: true } }));
    }

    _closeBoard() {
        if (this._mode !== 'projects') return;
        this._boardOpen = false;
        this._camTransitioning = false;
        const escHud = _getEscHUD();
        if (escHud) escHud.style.display = 'none';
        if (this._playerNear && this._hud) this._hud.style.display = 'block';
        window.dispatchEvent(new CustomEvent('projects:board', { detail: { open: false } }));
    }

    _build() {
        this._group = new THREE.Group();
        this._group.position.copy(this._logoPos);
        this._group.position.y += 4.2;
        this.scene.add(this._group);

        // Antes: intensidad 2.5 pegada al centro del grupo -> a esa distancia
        // una point light casi siempre "quema" el material por la caída inversa
        // al cuadrado. Se baja y se aleja un poco, igual que en el diseño ajustado.
        const light = new THREE.PointLight(0x60a5fa, 0.6, 28, 2);
        light.position.set(0, 6, 8);
        this._group.add(light);

        this._material = new THREE.MeshStandardMaterial({
            color: 0xf2f2f2,
            metalness: 0.15,
            roughness: 0.45,
        });

        this._createLogoMesh();
    }

    _createLogoMesh() {
        getFontPromise().then((font) => {
            if (!this._group || !this._material) return;

            const textOptions = {
                font,
                size: 1.6,   // antes: 5.1 (reducido ~30%, letras y corona más chicas pero no exageradas)
                depth: 0.52, // antes: 1.3 (misma proporción grosor/tamaño que antes)
                curveSegments: 10,
                bevelEnabled: true,
                bevelThickness: 0.13, // antes: 0.18
                bevelSize: 0.07,      // antes: 0.1
                bevelOffset: 0,
                bevelSegments: 4,
            };

            const leftGeometry = new TextGeometry('J', textOptions);
            leftGeometry.computeBoundingBox();
            leftGeometry.computeVertexNormals();

            const rightGeometry = new TextGeometry('M', textOptions);
            rightGeometry.computeBoundingBox();
            rightGeometry.computeVertexNormals();

            const leftMesh = new THREE.Mesh(leftGeometry, this._material);
            leftMesh.castShadow = true;
            leftMesh.receiveShadow = true;

            const rightMesh = new THREE.Mesh(rightGeometry, this._material);
            rightMesh.castShadow = true;
            rightMesh.receiveShadow = true;

            const leftBox = leftGeometry.boundingBox;
            const rightBox = rightGeometry.boundingBox;
            const spacing = 0.13; // antes: 0.18 (escalado junto con el nuevo tamaño de letra)
            const totalWidth = (leftBox.max.x - leftBox.min.x) + (rightBox.max.x - rightBox.min.x) + spacing;
            const startX = -totalWidth * 0.5 + (leftBox.max.x - leftBox.min.x) * 0.5;
            const height = Math.max(leftBox.max.y - leftBox.min.y, rightBox.max.y - rightBox.min.y);
            const yOffset = -height * 0.42;

            leftMesh.position.set(startX - 0.49, yOffset - 0.06, 0); // antes: -0.7 / -0.08
            rightMesh.position.set(startX + (leftBox.max.x - leftBox.min.x) + spacing * 0.7, yOffset - 0.06, 0);

            // Ancho, centro y borde superior REALES de las letras ya posicionadas.
            // Antes la corona usaba un scale (0.58) y position (0,0.2,0) fijos,
            // sin relación con el tamaño real de J y M -> por eso quedaba chica,
            // descentrada y "flotando" en vez de calzar sobre las letras.
            const lettersMinX = Math.min(leftMesh.position.x + leftBox.min.x, rightMesh.position.x + rightBox.min.x);
            const lettersMaxX = Math.max(leftMesh.position.x + leftBox.max.x, rightMesh.position.x + rightBox.max.x);
            const lettersWidth = lettersMaxX - lettersMinX;
            const lettersCenterX = (lettersMinX + lettersMaxX) / 2;
            const lettersTopY = (yOffset - 0.08) + Math.max(leftBox.max.y, rightBox.max.y);

            const crownGroup = new THREE.Group();
            const crownShape = new THREE.Shape();
            crownShape.moveTo(-3.8, 1.0);
            crownShape.lineTo(-4.6, 3.5);
            crownShape.lineTo(-2.5, 2.2);
            crownShape.lineTo(-2.2, 4.9);
            crownShape.lineTo(-0.8, 2.7);
            crownShape.lineTo(0, 6.1);
            crownShape.lineTo(0.8, 2.7);
            crownShape.lineTo(2.2, 4.9);
            crownShape.lineTo(2.5, 2.2);
            crownShape.lineTo(4.6, 3.5);
            crownShape.lineTo(3.8, 1.0);
            crownShape.lineTo(-3.8, 1.0);

            const extrudeSettings = {
                depth: 0.9,
                bevelEnabled: true,
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.12,
                bevelThickness: 0.14,
            };

            const crownGeometry = new THREE.ExtrudeGeometry(crownShape, extrudeSettings);
            crownGeometry.translate(0, 0, -0.6);
            const crownMesh = new THREE.Mesh(crownGeometry, this._material);
            crownMesh.position.set(0, 2.5, 0);
            crownMesh.rotation.x = Math.PI * 0.02;
            crownGroup.add(crownMesh);

            const ring1Shape = new THREE.Shape();
            ring1Shape.moveTo(-3.9, 0.4);
            ring1Shape.lineTo(3.9, 0.4);
            ring1Shape.lineTo(3.9, 0.9);
            ring1Shape.lineTo(-3.9, 0.9);
            const ring1Geo = new THREE.ExtrudeGeometry(ring1Shape, extrudeSettings);
            ring1Geo.translate(0, 0, -0.6);
            const ring1 = new THREE.Mesh(ring1Geo, this._material);
            ring1.position.y = 1.6;
            crownGroup.add(ring1);

            const ring2Shape = new THREE.Shape();
            ring2Shape.moveTo(-3.5, -0.1);
            ring2Shape.lineTo(3.5, -0.1);
            ring2Shape.lineTo(3.5, 0.2);
            ring2Shape.lineTo(-3.5, 0.2);
            const ring2Geo = new THREE.ExtrudeGeometry(ring2Shape, extrudeSettings);
            ring2Geo.translate(0, 0, -0.6);
            const ring2 = new THREE.Mesh(ring2Geo, this._material);
            ring2.position.y = 0.9;
            crownGroup.add(ring2);

            // El contorno de la corona tal como está dibujado arriba va de -4.6 a 4.6 (ancho 9.2).
            // Se escala para que ocupe ~90% del ancho real de las letras (igual que en el
            // diseño original), y se centra exactamente sobre ellas en X, apoyada justo
            // encima de su borde superior en Y.
            const originalCrownWidth = 9.2;
            const crownScale = (lettersWidth * 0.9) / originalCrownWidth;
            crownGroup.scale.setScalar(crownScale);
            crownGroup.position.set(lettersCenterX, lettersTopY + 0.15 * crownScale, 0);
            this._group.add(leftMesh, rightMesh, crownGroup);
            this._ready = true;
        }).catch((error) => {
            console.error('[LogoInteraction] Error cargando la fuente para el logo:', error);
        });
    }

    update(delta, playerPos) {
        if (!this._group) return;

        this._time += delta;

        // ── Cuando el tablero está abierto: mueve la cámara hacia el letrero ──
        if (this._boardOpen && this._mode === 'projects') {
            // El logo deja de girar (congelado mientras ves el tablero)
            if (this._camTransitioning) {
                this._camLerpT = Math.min(this._camLerpT + delta * 1.8, 1);
                const t = this._camLerpT < 1
                    ? 1 - Math.pow(1 - this._camLerpT, 3) // ease-out cubic
                    : 1;

                this.camera.position.lerpVectors(this._camFromPos, this._boardCam, t);
                this.camera.lookAt(this._boardFocus);

                if (t >= 1) this._camTransitioning = false;
            } else {
                // Mantener cámara fija en el letrero
                this.camera.position.copy(this._boardCam);
                this.camera.lookAt(this._boardFocus);
            }
            return; // No hacer nada más mientras el tablero está abierto
        }

        // ── Animación normal del logo ─────────────────────────────────────────
        this._group.rotation.y += delta * 0.8;
        this._group.position.y = this._logoPos.y + 3.3 + Math.sin(this._time * 2.2) * 0.55;

        if (playerPos) {
            const dx = playerPos.x - this._logoPos.x;
            const dz = playerPos.z - this._logoPos.z;
            const near = (dx * dx + dz * dz) < (this._radius * this._radius);

            if (near !== this._playerNear) {
                this._playerNear = near;
                if (this._mode === 'aboutMe') {
                    if (near) {
                        window.dispatchEvent(new CustomEvent('flame:near'));
                    } else {
                        window.dispatchEvent(new CustomEvent('flame:far'));
                    }
                } else if (this._mode === 'cv') {
                    if (near) {
                        window.dispatchEvent(new CustomEvent('cv:near'));
                    } else {
                        window.dispatchEvent(new CustomEvent('cv:far'));
                    }
                } else if (this._mode === 'rubik') {
                    if (near) {
                        window.dispatchEvent(new CustomEvent('rubik:near'));
                    } else {
                        window.dispatchEvent(new CustomEvent('rubik:far'));
                    }
                } else if (this._hud) {
                    this._hud.style.display = near && !this._boardOpen ? 'block' : 'none';
                }
            }
        }
    }

    dispose() {
        if (this._playerNear) {
            if (this._mode === 'aboutMe') window.dispatchEvent(new CustomEvent('flame:far'));
            if (this._mode === 'cv') window.dispatchEvent(new CustomEvent('cv:far'));
            if (this._mode === 'rubik') window.dispatchEvent(new CustomEvent('rubik:far'));
        }

        if (this._enterHandler) {
            window.removeEventListener('keydown', this._enterHandler, true);
            this._enterHandler = null;
        }
        if (this._escapeHandler) {
            window.removeEventListener('keydown', this._escapeHandler, true);
            this._escapeHandler = null;
        }
        if (this._logoOpenHandler) {
            window.removeEventListener('logo:open', this._logoOpenHandler);
            this._logoOpenHandler = null;
        }

        if (this._group) {
            this.scene.remove(this._group);
            this._group.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m) => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            this._group = null;
        }

        if (this._material) {
            this._material.dispose();
            this._material = null;
        }

        if (this._hud) {
            this._hud.style.display = 'none';
        }
    }
}

export function mountJMLogo(containerId = 'canvas-container') {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.015);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 10, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.7);
    topLight.position.set(0, 40, 10);
    scene.add(topLight);

    const logo = new LogoInteraction(scene, camera, { x: 0, y: 0, z: 0, radius: 99 });
    logo._group.position.set(0, 0, 0);
    logo._group.scale.setScalar(0.9);

    const tick = () => {
        requestAnimationFrame(tick);
        logo.update(0.016, new THREE.Vector3(0, 0, 0));
        renderer.render(scene, camera);
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    tick();
    return { scene, camera, renderer };
}

if (typeof window !== 'undefined') {
    window.mountJMLogo = mountJMLogo;
}