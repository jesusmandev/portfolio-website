/**
 * WorldLoadingScreen — Redesigned loading screen.
 * Central figure: Holographic crystal octahedron (diamond) spinning.
 * Background: Tech plane with dot grid in perspective.
 */
import gsap from 'gsap';
import * as THREE from 'three';

// ── Style injection (only once) ──────────────────────────────
let _stylesInjected = false;
function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;

    const css = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

/* ═══════════════════════════════════════════════════════
   WORLD LOADING SCREEN — HOLOGRAPHIC OCTAHEDRON
   ═══════════════════════════════════════════════════════ */
#world-loading-screen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Orbitron', 'Courier New', monospace;
    opacity: 0;
    pointer-events: all;
    user-select: none;
    overflow: hidden;
    background: #010814;
}

#wl-grid-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    opacity: 0.7;
}

.wl-gem-container {
    position: relative;
    width: 280px;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    z-index: 2;
}

#wl-gem-canvas {
    width: 100%;
    height: 100%;
    outline: none;
}

.wl-gem-glow {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,180,255,0.22) 0%, rgba(100,0,255,0.08) 55%, transparent 80%);
    filter: blur(28px);
    z-index: 1;
    animation: wl-pulse 2.4s ease-in-out infinite;
}

@keyframes wl-pulse {
    0%, 100% { transform: scale(1);    opacity: 0.7; }
    50%       { transform: scale(1.15); opacity: 1; }
}

.wl-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(0, 180, 255, 0.35);
    animation: wl-ring-expand 2.8s ease-out infinite;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
}
.wl-ring:nth-child(3) { animation-delay: 0.9s; }
.wl-ring:nth-child(4) { animation-delay: 1.8s; }

@keyframes wl-ring-expand {
    0%   { width: 80px;  height: 80px;  opacity: 0.7; }
    100% { width: 340px; height: 340px; opacity: 0; }
}

.wl-percent {
    font-size: clamp(44px, 6vw, 64px);
    font-weight: 900;
    letter-spacing: 0.05em;
    color: #ffffff;
    text-shadow: 0 0 20px rgba(0,180,255,0.8), 0 0 50px rgba(100,0,255,0.4);
    line-height: 1;
    margin-bottom: 22px;
    z-index: 5;
    transition: color 0.5s, text-shadow 0.5s;
}
.wl-percent.done {
    color: #a0ffe0;
    text-shadow: 0 0 35px rgba(0,255,180,0.9);
}

.wl-bar-wrap {
    width: min(380px, 72vw);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    z-index: 5;
}
.wl-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(255,255,255,0.06);
    border-radius: 4px;
    overflow: hidden;
}
.wl-bar-fill {
    height: 100%;
    width: 0%;
    border-radius: 4px;
    background: linear-gradient(90deg, #4400ff, #00b4ff, #00ffa6);
    box-shadow: 0 0 14px rgba(0,180,255,0.9);
    transition: width 0.25s ease-out;
}
.wl-label {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: rgba(0,200,255,0.6);
    text-transform: uppercase;
    text-align: center;
    font-weight: 700;
}

.wl-corner {
    position: absolute;
    width: 18px;
    height: 18px;
    border-color: rgba(0,180,255,0.2);
    border-style: solid;
}
.wl-corner--tl { top:18px; left:18px;    border-width: 1.5px 0 0 1.5px; }
.wl-corner--tr { top:18px; right:18px;   border-width: 1.5px 1.5px 0 0; }
.wl-corner--bl { bottom:18px; left:18px; border-width: 0 0 1.5px 1.5px; }
.wl-corner--br { bottom:18px; right:18px;border-width: 0 1.5px 1.5px 0; }

.wl-ready-text {
    margin-top: 16px;
    font-size: 10px;
    letter-spacing: 0.28em;
    color: rgba(0,255,180,0);
    text-transform: uppercase;
    transition: color 0.7s;
    text-align: center;
    z-index: 5;
}
.wl-ready-text.show { color: rgba(0,255,180,0.8); }
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

// ── Clase principal ───────────────────────────────────────────────────

export class WorldLoadingScreen {

    constructor() {
        _injectStyles();
        this._el        = null;
        this._barFill   = null;
        this._label     = null;
        this._percent   = null;
        this._readyText = null;
        this._overlay   = document.getElementById('transition-overlay');
        this._pct       = 0;
        this._isDone    = false;

        // Three.js para el octaedro
        this._renderer  = null;
        this._scene     = null;
        this._camera    = null;
        this._gem       = null;
        this._innerGem  = null;
        this._gem2      = null;
        this._ring      = null;
        this._ring2     = null;
        this._pLight    = null;
        this._rafId     = null;
        this._clock     = null;

        // 2D Canvas for tech plane
        this._gridCanvas = null;
        this._gridTime   = 0;
        this._gridRafId  = null;
    }

    // ─────────────────────────────────────────────────────────────────
    //  DOM Construction
    // ─────────────────────────────────────────────────────────────────

    _build() {
        if (this._el) return;

        const el = document.createElement('div');
        el.id = 'world-loading-screen';
        el.innerHTML = `
            <canvas id="wl-grid-canvas"></canvas>

            <div class="wl-corner wl-corner--tl"></div>
            <div class="wl-corner wl-corner--tr"></div>
            <div class="wl-corner wl-corner--bl"></div>
            <div class="wl-corner wl-corner--br"></div>

            <div class="wl-gem-container">
                <div class="wl-gem-glow"></div>
                <div class="wl-ring"></div>
                <div class="wl-ring"></div>
                <div class="wl-ring"></div>
                <canvas id="wl-gem-canvas"></canvas>
            </div>

            <div class="wl-percent" id="wl-percent">0%</div>

            <div class="wl-bar-wrap">
                <div class="wl-bar-track">
                    <div class="wl-bar-fill" id="wl-bar-fill"></div>
                </div>
                <span class="wl-label" id="wl-label">INICIALIZANDO SISTEMA</span>
            </div>

            <div class="wl-ready-text" id="wl-ready-text">ACCESO AUTORIZADO — ENTRANDO AL MUNDO…</div>
        `;

        if (this._overlay) {
            this._overlay.appendChild(el);
        } else {
            document.body.appendChild(el);
        }

        this._el        = el;
        this._barFill   = document.getElementById('wl-bar-fill');
        this._label     = document.getElementById('wl-label');
        this._percent   = document.getElementById('wl-percent');
        this._readyText = document.getElementById('wl-ready-text');

        this._initGrid();
        this._initGem();
    }

    _initGrid() {
        const canvas = document.getElementById('wl-grid-canvas');
        if (!canvas) return;

        const resize = () => {
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        this._gridCanvas = canvas;
        this._gridTime   = 0;

        const ctx = canvas.getContext('2d');
        const draw = () => {
            this._gridRafId = requestAnimationFrame(draw);
            this._gridTime += 0.008;
            this._drawGrid(ctx, canvas.width, canvas.height);
        };
        draw();
    }

    _drawGrid(ctx, W, H) {
        const t = this._gridTime;
        ctx.clearRect(0, 0, W, H);

        const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.75);
        bg.addColorStop(0,   'rgba(4, 14, 48, 1)');
        bg.addColorStop(0.6, 'rgba(1, 6, 22, 1)');
        bg.addColorStop(1,   'rgba(0, 2, 8,  1)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const horizon = H * 0.56;
        const vpX = W / 2;
        const cols = 18;
        const rows = 14;
        const speed = t * 0.12;

        for (let r = 0; r <= rows; r++) {
            const frac   = ((r / rows) + speed) % 1;
            const alpha  = frac * frac;
            const y      = horizon + (H - horizon) * frac;
            const spread = W * 0.85 * frac;

            ctx.beginPath();
            ctx.moveTo(vpX - spread/2, y);
            ctx.lineTo(vpX + spread/2, y);
            ctx.strokeStyle = `rgba(0,140,255,${0.10 + alpha * 0.22})`;
            ctx.lineWidth   = 0.7;
            ctx.stroke();

            for (let c = 0; c <= cols; c++) {
                const cx = vpX - spread/2 + (spread / cols) * c;
                const sz = 1.4 + frac * 2.2;
                ctx.beginPath();
                ctx.moveTo(cx - sz, y); ctx.lineTo(cx + sz, y);
                ctx.moveTo(cx, y - sz); ctx.lineTo(cx, y + sz);
                ctx.strokeStyle = `rgba(0,200,255,${0.06 + alpha * 0.18})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        for (let c = 0; c <= cols; c++) {
            const frac  = c / cols;
            const xBase = W * 0.075 + W * 0.85 * frac;
            ctx.beginPath();
            ctx.moveTo(xBase, H);
            ctx.lineTo(vpX, horizon);
            ctx.strokeStyle = `rgba(0,120,255,${0.08 + Math.abs(frac-0.5)*0.07})`;
            ctx.lineWidth   = 0.6;
            ctx.stroke();
        }

        const fog = ctx.createLinearGradient(0, horizon - 55, 0, horizon + 40);
        fog.addColorStop(0, 'rgba(1,6,22,0)');
        fog.addColorStop(1, 'rgba(1,6,22,0.88)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, horizon - 55, W, 95);

        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, 'rgba(1,4,18,1)');
        sky.addColorStop(1, 'rgba(2,8,30,0)');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, horizon);
    }

    _initGem() {
        const canvas = document.getElementById('wl-gem-canvas');
        if (!canvas) return;

        const SIZE = 280;
        this._scene  = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        this._camera.position.set(0, 0.4, 5.5);
        this._camera.lookAt(0, 0, 0);

        this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this._renderer.setSize(SIZE, SIZE);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this._scene.add(new THREE.AmbientLight(0x111133, 1.0));

        const dL1 = new THREE.DirectionalLight(0x00b4ff, 4.0);
        dL1.position.set(3, 4, 3);
        this._scene.add(dL1);

        const dL2 = new THREE.DirectionalLight(0x8844ff, 2.5);
        dL2.position.set(-3, -2, 2);
        this._scene.add(dL2);

        this._pLight = new THREE.PointLight(0x00ffff, 2.0, 8);
        this._pLight.position.set(0, 2, 2);
        this._scene.add(this._pLight);

        const geoInner = new THREE.OctahedronGeometry(1.3, 0);
        const matInner = new THREE.MeshPhysicalMaterial({
            color:       0x0044aa,
            emissive:    0x000820,
            metalness:   0.05,
            roughness:   0.05,
            transparent: true,
            opacity:     0.32,
            side:        THREE.DoubleSide,
            depthWrite:  false,
        });
        this._innerGem = new THREE.Mesh(geoInner, matInner);
        this._scene.add(this._innerGem);

        const geoWire = new THREE.OctahedronGeometry(1.45, 0);
        const matWire = new THREE.MeshBasicMaterial({
            color: 0x00d4ff, wireframe: true, transparent: true, opacity: 0.6,
        });
        this._gem = new THREE.Mesh(geoWire, matWire);
        this._scene.add(this._gem);

        const geoWire2 = new THREE.OctahedronGeometry(1.65, 0);
        const matWire2 = new THREE.MeshBasicMaterial({
            color: 0x6600ff, wireframe: true, transparent: true, opacity: 0.18,
        });
        this._gem2 = new THREE.Mesh(geoWire2, matWire2);
        this._scene.add(this._gem2);

        const geoRing = new THREE.TorusGeometry(1.7, 0.025, 8, 80);
        const matRing = new THREE.MeshBasicMaterial({
            color: 0x00b4ff, transparent: true, opacity: 0.55,
        });
        this._ring = new THREE.Mesh(geoRing, matRing);
        this._ring.rotation.x = Math.PI / 2;
        this._scene.add(this._ring);

        const geoRing2 = new THREE.TorusGeometry(1.85, 0.015, 8, 80);
        const matRing2 = new THREE.MeshBasicMaterial({
            color: 0xaa00ff, transparent: true, opacity: 0.28,
        });
        this._ring2 = new THREE.Mesh(geoRing2, matRing2);
        this._ring2.rotation.x = Math.PI / 4;
        this._ring2.rotation.z = Math.PI / 6;
        this._scene.add(this._ring2);

        this._clock = new THREE.Clock();
        const animate = () => {
            this._rafId = requestAnimationFrame(animate);
            const elapsed = this._clock.getElapsedTime();

            if (this._gem)      { this._gem.rotation.y += 0.008; this._gem.rotation.x = Math.sin(elapsed * 0.5) * 0.3; }
            if (this._innerGem) { this._innerGem.rotation.y -= 0.005; this._innerGem.rotation.z = Math.cos(elapsed * 0.4) * 0.2; }
            if (this._gem2)     { this._gem2.rotation.y += 0.012; this._gem2.rotation.x -= 0.004; }
            if (this._ring)  {
                const s = 1 + Math.sin(elapsed * 2.0) * 0.04;
                this._ring.scale.set(s, s, 1);
                this._ring.rotation.z += 0.006;
            }
            if (this._ring2) {
                this._ring2.rotation.y += 0.009;
                this._ring2.rotation.x = Math.PI / 4 + Math.cos(elapsed * 1.5) * 0.15;
            }
            if (this._pLight) this._pLight.intensity = 2.0 + Math.sin(elapsed * 3.0) * 0.8;

            this._camera.position.x = Math.sin(elapsed * 0.3) * 0.15;
            this._camera.position.y = 0.4 + Math.cos(elapsed * 0.4) * 0.08;
            this._camera.lookAt(0, 0, 0);

            this._renderer.render(this._scene, this._camera);
        };
        animate();
    }

    // ─────────────────────────────────────────────────────────────────
    //  Public API
    // ─────────────────────────────────────────────────────────────────

    show() {
        this._build();
        this._overlay?.classList.add('loading-active');
        gsap.fromTo(this._el,
            { opacity: 0 },
            { opacity: 1, duration: 0.8, ease: 'power2.out' }
        );
    }

    setProgress(p) {
        const pct = Math.round(p * 100);
        this._pct = pct;

        if (this._barFill) this._barFill.style.width = pct + '%';
        if (this._percent) this._percent.textContent  = pct + '%';

        if (this._label) {
            if (pct < 25)       this._label.textContent = 'LOADING ASSETS…';
            else if (pct < 50)  this._label.textContent = 'INITIALIZING 3D ENGINE…';
            else if (pct < 75)  this._label.textContent = 'COMPILING PHYSICS…';
            else if (pct < 100) this._label.textContent = 'STABILIZING WORLD…';
            else                this._label.textContent = 'SYSTEM READY';
        }

        if (pct >= 100 && !this._isDone) {
            this._isDone = true;
            this._onComplete();
        }
    }

    _onComplete() {
        if (this._percent) this._percent.classList.add('done');
        if (this._barFill) {
            gsap.to(this._barFill, {
                boxShadow: '0 0 28px rgba(0,255,180,0.9)',
                duration: 0.4, yoyo: true, repeat: 3
            });
        }
        if (this._readyText) this._readyText.classList.add('show');
    }

    hide() {
        return new Promise(resolve => {
            if (!this._el) { resolve(); return; }
            const delay = this._isDone ? 0.5 : 0;
            gsap.to(this._el, {
                delay,
                opacity: 0,
                duration: 0.6,
                ease: 'power2.in',
                onComplete: () => {
                    if (this._rafId)     cancelAnimationFrame(this._rafId);
                    if (this._gridRafId) cancelAnimationFrame(this._gridRafId);
                    if (this._renderer)  { this._renderer.dispose(); this._renderer = null; }
                    this._el?.remove();
                    this._el = null;
                    this._overlay?.classList.remove('loading-active');
                    resolve();
                }
            });
        });
    }
}
