import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

/**
 * PositionDebugger
 *
 * Herramienta de depuración que muestra las coordenadas 3D del mundo
 * al hacer doble click derecho sobre el mapa del juego (o Shift + Click derecho).
 *
 * Muestra un HUD flotante superior elegante, copia las coordenadas al portapapeles
 * y crea un anillo luminoso expansivo en el punto de impacto.
 */
export class PositionDebugger
{
    /**
     * @param {THREE.Scene}  [scene]  - Escena principal de Three.js
     * @param {THREE.Camera} [camera] - Cámara activa del juego
     */
    constructor(scene, camera)
    {
        this.game = Game.getInstance()
        this.scene = scene || this.game.scene
        this.camera = camera || this.game.view?.camera

        this._raycaster          = new THREE.Raycaster()
        this._mouse              = new THREE.Vector2()
        this._lastRightClickTime = 0
        this._groundPlane        = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

        // Binds
        this._onMouseDown   = this._onMouseDown.bind(this)
        this._onContextMenu = this._onContextMenu.bind(this)

        window.addEventListener('mousedown',   this._onMouseDown)
        window.addEventListener('contextmenu', this._onContextMenu)

        console.log('%c[PositionDebugger] ✅ Activado — Doble click derecho (o Shift+Click derecho) para ver y copiar coordenadas 3D', 'color:#00d2ff;font-weight:bold;font-size:12px;')
    }

    // ─────────────────────────────────────────────
    //  EVENTOS
    // ─────────────────────────────────────────────

    _onMouseDown(e)
    {
        if(e.button !== 2) return // Solo botón derecho

        const now = performance.now()
        const isDoubleRightClick = (now - this._lastRightClickTime < 350)
        const isShiftRightClick = e.shiftKey

        if(isDoubleRightClick || isShiftRightClick)
        {
            e.preventDefault()
            e.stopPropagation()
            this._sample(e.clientX, e.clientY)
        }

        this._lastRightClickTime = now
    }

    _onContextMenu(e)
    {
        // Suprimir el menú contextual si se hizo click derecho para depurar
        if(performance.now() - this._lastRightClickTime < 500)
        {
            e.preventDefault()
        }
    }

    // ─────────────────────────────────────────────
    //  RAYCAST Y VISUALIZACIÓN
    // ─────────────────────────────────────────────

    _sample(clientX, clientY)
    {
        // Actualizar referencia dinámica a la cámara activa
        const camera = this.game?.view?.camera || this.camera
        if(!camera) return

        // Convertir coordenadas de pantalla a NDC (-1 … +1)
        this._mouse.set(
            (clientX / window.innerWidth)  *  2 - 1,
            (clientY / window.innerHeight) * -2 + 1
        )

        this._raycaster.setFromCamera(this._mouse, camera)

        let hitPoint = null

        // 1. Recoger todos los Mesh visibles de la escena
        const targets = []
        this.scene.traverse(child =>
        {
            if(child.isMesh && child.visible && child.name !== 'PositionRing')
            {
                targets.push(child)
            }
        })

        const hits = this._raycaster.intersectObjects(targets, true)
        if(hits.length > 0)
        {
            hitPoint = hits[0].point
        }
        else
        {
            // Fallback seguro: intersectar plano del suelo (y = 0)
            const fallbackTarget = new THREE.Vector3()
            if(this._raycaster.ray.intersectPlane(this._groundPlane, fallbackTarget))
            {
                hitPoint = fallbackTarget
            }
        }

        if(!hitPoint) return

        const pt = hitPoint

        // Log en consola
        console.log(
            `%c[PositionDebugger] 📍 X: ${pt.x.toFixed(2)}  Y: ${pt.y.toFixed(2)}  Z: ${pt.z.toFixed(2)}`,
            'color:#00e5ff;font-weight:bold;font-size:13px;'
        )

        // Copiar automáticamente al portapapeles en formato listo para usar
        const coordString = `x: ${pt.x.toFixed(2)}, y: ${pt.y.toFixed(2)}, z: ${pt.z.toFixed(2)}`
        if(navigator.clipboard && navigator.clipboard.writeText)
        {
            navigator.clipboard.writeText(coordString).catch(() => {})
        }

        this._showHUD(pt, coordString)
        this._spawnRing(pt)
    }

    // ─────────────────────────────────────────────
    //  HUD FLOTANTE
    // ─────────────────────────────────────────────

    _showHUD(pt, coordString)
    {
        // Eliminar HUD anterior si existe
        document.getElementById('pos-debugger-hud')?.remove()

        const hud = document.createElement('div')
        hud.id = 'pos-debugger-hud'

        Object.assign(hud.style, {
            position:        'fixed',
            top:             '22px',
            left:            '50%',
            transform:       'translateX(-50%) translateY(-18px)',
            background:      'rgba(6, 11, 22, 0.92)',
            border:          '1.5px solid rgba(0, 160, 255, 0.60)',
            borderRadius:    '14px',
            padding:         '10px 22px',
            color:           '#ffffff',
            fontFamily:      "'Inter', system-ui, -apple-system, sans-serif",
            fontSize:        '14px',
            zIndex:          '999999',
            boxShadow:       '0 8px 32px rgba(0, 120, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
            backdropFilter:  'blur(16px)',
            pointerEvents:   'auto',
            cursor:          'pointer',
            opacity:         '0',
            display:         'flex',
            alignItems:      'center',
            gap:             '18px',
            transition:      'opacity 0.28s ease, transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)',
            whiteSpace:      'nowrap',
            userSelect:      'none'
        })

        hud.title = 'Click para volver a copiar al portapapeles'
        hud.onclick = () =>
        {
            if(navigator.clipboard && navigator.clipboard.writeText)
            {
                navigator.clipboard.writeText(coordString)
            }
        }

        hud.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;">📍</span>
                <span style="color:rgba(100,215,255,0.85);font-weight:700;letter-spacing:0.07em;
                             font-size:11px;text-transform:uppercase;">Posición 3D</span>
            </div>
            <div style="display:flex;gap:14px;font-family:monospace;font-weight:600;font-size:13px;">
                <span>X: <span style="color:#00e5ff;">${pt.x.toFixed(2)}</span></span>
                <span>Y: <span style="color:#00e5ff;">${pt.y.toFixed(2)}</span></span>
                <span>Z: <span style="color:#00e5ff;">${pt.z.toFixed(2)}</span></span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);color:#00e5ff;font-size:11px;font-weight:600;">
                <span>✓ Copiado</span>
            </div>`

        document.body.appendChild(hud)

        // Fade-in + slide
        requestAnimationFrame(() =>
        {
            hud.style.opacity   = '1'
            hud.style.transform = 'translateX(-50%) translateY(0)'
        })

        // Auto-cierre a los 4.5 s
        setTimeout(() =>
        {
            hud.style.opacity   = '0'
            hud.style.transform = 'translateX(-50%) translateY(-18px)'
            setTimeout(() => hud.remove(), 320)
        }, 4500)
    }

    // ─────────────────────────────────────────────
    //  ANILLO 3D EN EL PUNTO DE IMPACTO
    // ─────────────────────────────────────────────

    _spawnRing(pt)
    {
        const geo = new THREE.RingGeometry(0.1, 1.8, 48)
        const mat = new THREE.MeshBasicMaterial({
            color:       0x00a0ff,
            side:        THREE.DoubleSide,
            transparent: true,
            opacity:     0.85,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        })

        const mesh = new THREE.Mesh(geo, mat)
        mesh.name = 'PositionRing'
        mesh.rotation.x = -Math.PI / 2
        mesh.position.copy(pt)
        mesh.position.y += 0.06 // Evitar z-fighting
        this.scene.add(mesh)

        // Animación: crece y se desvanece en 1.3 s
        const t0  = performance.now()
        const dur = 1300

        const tick = () =>
        {
            const p = Math.min((performance.now() - t0) / dur, 1)
            const s = 1 + p * 1.6
            mesh.scale.set(s, s, 1)
            mat.opacity = (1 - p) * 0.85

            if(p < 1)
            {
                requestAnimationFrame(tick)
            }
            else
            {
                this.scene.remove(mesh)
                geo.dispose()
                mat.dispose()
            }
        }

        requestAnimationFrame(tick)
    }

    // ─────────────────────────────────────────────
    //  LIMPIEZA
    // ─────────────────────────────────────────────

    destroy()
    {
        window.removeEventListener('mousedown',   this._onMouseDown)
        window.removeEventListener('contextmenu', this._onContextMenu)
        document.getElementById('pos-debugger-hud')?.remove()
        console.log('%c[PositionDebugger] ❌ Destruido', 'color:#ff4444;')
    }
}
