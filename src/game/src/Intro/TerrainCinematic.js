/**
 * TerrainCinematic - Portal Iris Transition.
 * Overlay negro con un corte circular que se expande para revelar el mapa.
 *
 * Fases:
 *  1. showInstant(cam, onComplete) -> Nace en 1s hasta minR con arcos girando.
 *  2. Fase HOLD: Se mantiene rotando de forma hermosa con chispas durante 2.5s.
 *  3. Fase OPEN: Se expande de forma majestuosa y lenta (3.5s).
 *  4. Al terminar la apertura, destruye el overlay y ejecuta onComplete().
 */
import gsap from 'gsap';

let _cssInjected = false;
function _injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    const css = `
#portal-overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    overflow: hidden;
}
#portal-overlay canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
`;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
}

export class TerrainCinematic {

    constructor() {
        this._disposed   = false;
        this._canvas     = null;
        this._ctx        = null;
        this._gameCam    = null;
        this._animId     = null;
        this._startTime  = null;
        this._el         = null;
        this._resize     = null;
        this._sparks     = [];
    }

    // ----------------------------------------------------------------
    //  API publica
    // ----------------------------------------------------------------

    showInstant(gameCam, onComplete) {
        _injectCSS();
        this._gameCam = gameCam;
        this._build();
        this._startTime = performance.now();
        this._startLoop(onComplete);
    }

    hide() {
        return new Promise(resolve => {
            this._cleanup();
            resolve();
        });
    }

    // ----------------------------------------------------------------
    //  DOM
    // ----------------------------------------------------------------

    _build() {
        const el = document.createElement('div');
        el.id = 'portal-overlay';

        const canvas = document.createElement('canvas');
        el.appendChild(canvas);
        document.body.appendChild(el);

        this._el     = el;
        this._canvas = canvas;
        this._ctx    = canvas.getContext('2d');

        const resize = () => {
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);
        this._resize = resize;
    }

    // ----------------------------------------------------------------
    //  Loop de animacion
    // ----------------------------------------------------------------

    _startLoop(onComplete) {
        const INTRO_MS = 600; 
        const HOLD_MS  = 1200; 
        const OPEN_MS  = 1800; 
        const TOTAL    = INTRO_MS + HOLD_MS + OPEN_MS;

        const loop = () => {
            if (this._disposed) return;
            this._animId = requestAnimationFrame(loop);

            const ctx     = this._ctx;
            const W       = this._canvas.width;
            const H       = this._canvas.height;
            const elapsed = performance.now() - this._startTime;
            const cx      = W / 2;
            const cy      = H / 2;
            const time    = elapsed * 0.001;

            ctx.clearRect(0, 0, W, H);

            const minR = Math.min(W, H) * 0.18;
            const maxR = Math.sqrt(cx * cx + cy * cy) + 15;

            let currentR;
            let openT = 0;

            if (elapsed < INTRO_MS) {
                const growT = elapsed / INTRO_MS;
                const easeGrow = Math.sin((growT * Math.PI) / 2);
                currentR = easeGrow * minR;
            } else if (elapsed < INTRO_MS + HOLD_MS) {
                currentR = minR;
            } else {
                const rawOpen = Math.min((elapsed - (INTRO_MS + HOLD_MS)) / OPEN_MS, 1.0);
                openT = 1 - Math.pow(1 - rawOpen, 4); 
                currentR = minR + openT * (maxR - minR);
            }

            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            ctx.arc(cx, cy, currentR, 0, Math.PI * 2, true);
            ctx.fill();
            ctx.restore();

            const ringAlpha = Math.max(0, 1.0 - openT * 1.3);

            if (ringAlpha > 0.01 && currentR > 1) {
                const gr = ctx.createRadialGradient(cx, cy, Math.max(1, currentR - 8), cx, cy, currentR + 40);
                gr.addColorStop(0, `rgba(0, 200, 255, ${ringAlpha * 0.7})`);
                gr.addColorStop(0.4, `rgba(100, 0, 255, ${ringAlpha * 0.35})`);
                gr.addColorStop(1, 'rgba(0, 80, 255, 0)');
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, currentR + 40, 0, Math.PI * 2);
                ctx.arc(cx, cy, Math.max(0, currentR - 8), 0, Math.PI * 2, true);
                ctx.fillStyle = gr;
                ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 240, 255, ${ringAlpha * 0.95})`;
                ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
                ctx.shadowBlur = 15;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(0, currentR - 5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(180, 50, 255, ${ringAlpha * 0.5})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.restore();

                if (elapsed < INTRO_MS + HOLD_MS + OPEN_MS * 0.5) {
                    const spawnRate = 2;
                    for (let s = 0; s < spawnRate; s++) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = currentR + (Math.random() * 8 - 4);
                        this._sparks.push({
                            x: cx + Math.cos(angle) * dist,
                            y: cy + Math.sin(angle) * dist,
                            vx: Math.cos(angle) * (Math.random() * 2 + 1) + (Math.random() * 1 - 0.5),
                            vy: Math.sin(angle) * (Math.random() * 2 + 1) + (Math.random() * 1 - 0.5),
                            life: 1.0,
                            decay: Math.random() * 0.03 + 0.02,
                            color: Math.random() > 0.4 ? 'rgba(0, 255, 230,' : 'rgba(180, 50, 255,',
                            size: Math.random() * 2 + 1.2
                        });
                    }
                }

                this._sparks.forEach((p, idx) => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    p.life -= p.decay;

                    if (p.life <= 0) {
                        this._sparks.splice(idx, 1);
                        return;
                    }

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `${p.color} ${p.life * ringAlpha})`;
                    ctx.shadowColor = 'rgba(0, 255, 230, 0.5)';
                    ctx.shadowBlur = 4;
                    ctx.fill();
                    ctx.restore();
                });

                const arcA = ringAlpha * 0.95;
                const numArcs = 4;
                for (let i = 0; i < numArcs; i++) {
                    const base = (i / numArcs) * Math.PI * 2;

                    const a1 = time * 3.5 + base;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, currentR + 15, a1, a1 + Math.PI * 0.45);
                    ctx.strokeStyle = `rgba(0, 230, 255, ${arcA * 0.8})`;
                    ctx.lineWidth = 1.8;
                    ctx.stroke();
                    ctx.restore();

                    const a2 = -time * 2.8 + base + Math.PI / 6;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, currentR + 7, a2, a2 + Math.PI * 0.35);
                    ctx.strokeStyle = `rgba(200, 70, 255, ${arcA * 0.7})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.restore();

                    const a3 = time * 5.0 + base + Math.PI / 4;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, Math.max(0, currentR - 8), a3, a3 + Math.PI * 0.25);
                    ctx.strokeStyle = `rgba(0, 255, 180, ${arcA * 0.55})`;
                    ctx.lineWidth = 1.0;
                    ctx.stroke();
                    ctx.restore();
                }

                [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((angle, idx) => {
                    const a  = angle + time * 0.5;
                    const sx = cx + Math.cos(a) * currentR;
                    const sy = cy + Math.sin(a) * currentR;
                    const sz = 12 + Math.sin(time * 5 + idx) * 4;
                    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sz);
                    sg.addColorStop(0, `rgba(255, 255, 255, ${ringAlpha * 0.95})`);
                    sg.addColorStop(0.3, `rgba(0, 230, 255, ${ringAlpha * 0.55})`);
                    sg.addColorStop(1, 'rgba(0,100,255,0)');
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(sx, sy, sz, 0, Math.PI * 2);
                    ctx.fillStyle = sg;
                    ctx.fill();
                    ctx.restore();
                });
            }

            if (elapsed >= TOTAL) {
                cancelAnimationFrame(this._animId);
                this._cleanup();
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        };

        loop();
    }

    _cleanup() {
        if (this._disposed) return;
        this._disposed = true;

        if (this._animId) cancelAnimationFrame(this._animId);
        if (this._resize) window.removeEventListener('resize', this._resize);

        if (this._el) {
            gsap.to(this._el, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => this._el?.remove()
            });
        }
        this._gameCam = this._canvas = this._ctx = this._el = null;
        this._sparks  = [];
    }
}
