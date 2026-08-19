import * as THREE from 'three';

/**
 * PositionDebugger
 *
 * Herramienta de depuración que muestra las coordenadas 3D del mundo
 * al hacer doble click derecho sobre el canvas del juego.
 *
 * Uso:
 *   const debugger = new PositionDebugger(scene, camera);
 *   // Para destruir:
 *   debugger.destroy();
 */
export class PositionDebugger {
    /**
     * @param {THREE.Scene}  scene  - Escena principal de Three.js
     * @param {THREE.Camera} camera - Cámara activa del juego
     */
    constructor(scene, camera) {
        this.scene  = scene;
        this.camera = camera;

        this._raycaster          = new THREE.Raycaster();
        this._mouse              = new THREE.Vector2();
        this._lastRightClickTime = 0;

        // Binds para poder remover los listeners después
        this._onMouseDown    = this._onMouseDown.bind(this);
        this._onContextMenu  = this._onContextMenu.bind(this);

        window.addEventListener('mousedown',   this._onMouseDown);
        window.addEventListener('contextmenu', this._onContextMenu);

        console.log('%c[PositionDebugger] ✅ Activado — doble click derecho para ver coordenadas', 'color:#00d2ff;font-weight:bold;');
    }

    // ─────────────────────────────────────────────
    //  EVENTOS
    // ─────────────────────────────────────────────

    _onMouseDown(e) {
        if (e.button !== 2) return; // Solo botón derecho

        const now = performance.now();

        if (now - this._lastRightClickTime < 300) {
            // Doble click derecho detectado
            e.preventDefault();
            this._sample(e.clientX, e.clientY);
        }

        this._lastRightClickTime = now;
    }

    _onContextMenu(e) {
        // Suprimir el menú contextual si el doble click acaba de ocurrir
        if (performance.now() - this._lastRightClickTime < 500) {
            e.preventDefault();
        }
    }

    // ─────────────────────────────────────────────
    //  RAYCAST Y VISUALIZACIÓN
    // ─────────────────────────────────────────────

    _sample(clientX, clientY) {
        // Convertir coordenadas de pantalla a NDC (-1 … +1)
        this._mouse.set(
            (clientX / window.innerWidth)  *  2 - 1,
            (clientY / window.innerHeight) * -2 + 1
        );

        this._raycaster.setFromCamera(this._mouse, this.camera);

        // Recoger todos los Mesh visibles de la escena
        const targets = [];
        this.scene.traverse(child => {
            if (child.isMesh && child.visible) targets.push(child);
        });

        const hits = this._raycaster.intersectObjects(targets, true);
        if (hits.length === 0) return;

        const pt = hits[0].point;

        console.log(
            `%c[PositionDebugger] 📍 X: ${pt.x.toFixed(2)}  Y: ${pt.y.toFixed(2)}  Z: ${pt.z.toFixed(2)}`,
            'color:#00e5ff;font-weight:bold;font-size:13px;'
        );

        this._showHUD(pt);
        this._spawnRing(pt);
    }

    // ─────────────────────────────────────────────
    //  HUD FLOTANTE
    // ─────────────────────────────────────────────

    _showHUD(pt) {
        // Eliminar HUD anterior si existe
        document.getElementById('pos-debugger-hud')?.remove();

        const hud = document.createElement('div');
        hud.id = 'pos-debugger-hud';

        Object.assign(hud.style, {
            position:        'fixed',
            top:             '22px',
            left:            '50%',
            transform:       'translateX(-50%) translateY(-18px)',
            background:      'rgba(6, 11, 22, 0.90)',
            border:          '1.5px solid rgba(0, 160, 255, 0.50)',
            borderRadius:    '12px',
            padding:         '10px 22px',
            color:           '#fff',
            fontFamily:      "'Inter', -apple-system, sans-serif",
            fontSize:        '14px',
            zIndex:          '999999',
            boxShadow:       '0 8px 32px rgba(0, 120, 255, 0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter:  'blur(14px)',
            pointerEvents:   'none',
            opacity:         '0',
            display:         'flex',
            alignItems:      'center',
            gap:             '18px',
            transition:      'opacity 0.28s ease, transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)',
            whiteSpace:      'nowrap',
        });

        hud.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;">📍</span>
                <span style="color:rgba(100,215,255,0.80);font-weight:700;letter-spacing:0.07em;
                             font-size:10px;text-transform:uppercase;">Posición 3D</span>
            </div>
            <div style="display:flex;gap:14px;font-family:monospace;font-weight:600;font-size:13px;">
                <span>X: <span style="color:#00e5ff;">${pt.x.toFixed(2)}</span></span>
                <span>Y: <span style="color:#00e5ff;">${pt.y.toFixed(2)}</span></span>
                <span>Z: <span style="color:#00e5ff;">${pt.z.toFixed(2)}</span></span>
            </div>`;

        document.body.appendChild(hud);

        // Fade-in + slide
        requestAnimationFrame(() => {
            hud.style.opacity   = '1';
            hud.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Auto-cierre a los 4.5 s
        setTimeout(() => {
            hud.style.opacity   = '0';
            hud.style.transform = 'translateX(-50%) translateY(-18px)';
            setTimeout(() => hud.remove(), 320);
        }, 4500);
    }

    // ─────────────────────────────────────────────
    //  ANILLO 3D EN EL PUNTO DE IMPACTO
    // ─────────────────────────────────────────────

    _spawnRing(pt) {
        const geo = new THREE.RingGeometry(0.1, 1.8, 48);
        const mat = new THREE.MeshBasicMaterial({
            color:       0x00a0ff,
            side:        THREE.DoubleSide,
            transparent: true,
            opacity:     0.85,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pt);
        mesh.position.y += 0.06; // evitar z-fighting
        this.scene.add(mesh);

        // Animación: crece y se desvanece en 1.3 s
        const t0  = performance.now();
        const dur = 1300;

        const tick = () => {
            const p = Math.min((performance.now() - t0) / dur, 1);
            const s = 1 + p * 1.6;
            mesh.scale.set(s, s, 1);
            mat.opacity = (1 - p) * 0.85;

            if (p < 1) {
                requestAnimationFrame(tick);
            } else {
                this.scene.remove(mesh);
                geo.dispose();
                mat.dispose();
            }
        };

        requestAnimationFrame(tick);
    }

    // ─────────────────────────────────────────────
    //  LIMPIEZA
    // ─────────────────────────────────────────────

    destroy() {
        window.removeEventListener('mousedown',   this._onMouseDown);
        window.removeEventListener('contextmenu', this._onContextMenu);
        document.getElementById('pos-debugger-hud')?.remove();
        console.log('%c[PositionDebugger] ❌ Destruido', 'color:#ff4444;');
    }
}
