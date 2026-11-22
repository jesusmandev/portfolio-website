import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Game } from '../Game.js'

/**
 * FlagsExhibition.js
 * Exposición de Banderas del Mundo + Avión 3D
 * Posicionado en X: -15.16, Y: 0.00, Z: -55.32
 */

// ── DIBUJO DE BANDERAS ESPECÍFICAS EN CANVAS 2D ───────────────────

function drawItalia(ctx, w, h)
{
    ctx.fillStyle = '#009246'; ctx.fillRect(0, 0, w / 3, h)
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 3, 0, w / 3, h)
    ctx.fillStyle = '#CE2B37'; ctx.fillRect((w / 3) * 2, 0, w / 3, h)
}

function drawAlemania(ctx, w, h)
{
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h / 3)
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, h / 3, w, h / 3)
    ctx.fillStyle = '#FFCC00'; ctx.fillRect(0, (h / 3) * 2, w, h / 3)
}

function drawEspana(ctx, w, h)
{
    ctx.fillStyle = '#AA151B'; ctx.fillRect(0, 0, w, h / 4)
    ctx.fillStyle = '#F1BF00'; ctx.fillRect(0, h / 4, w, h / 2)
    ctx.fillStyle = '#AA151B'; ctx.fillRect(0, (h / 4) * 3, w, h / 4)
    
    // Escudo de España
    const cx = w * 0.33
    const cy = h / 2
    const shieldHeight = h * 0.35
    const shieldWidth = shieldHeight * 0.8
    
    ctx.save()
    ctx.translate(cx, cy)

    ctx.beginPath()
    ctx.moveTo(-shieldWidth / 2, -shieldHeight / 2)
    ctx.lineTo(shieldWidth / 2, -shieldHeight / 2)
    ctx.lineTo(shieldWidth / 2, shieldHeight / 4)
    ctx.bezierCurveTo(shieldWidth / 2, shieldHeight / 2, 0, shieldHeight / 2 * 1.2, 0, shieldHeight / 2 * 1.2)
    ctx.bezierCurveTo(0, shieldHeight / 2 * 1.2, -shieldWidth / 2, shieldHeight / 2, -shieldWidth / 2, shieldHeight / 4)
    ctx.closePath()
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#000000'
    ctx.stroke()

    ctx.clip()

    // 1. Castilla
    ctx.fillStyle = '#AA151B'
    ctx.fillRect(-shieldWidth / 2, -shieldHeight / 2, shieldWidth / 2, shieldHeight / 2)
    ctx.fillStyle = '#F1BF00'
    const castleS = shieldWidth * 0.25
    ctx.fillRect(-shieldWidth / 4 - castleS / 2, -shieldHeight / 4 - castleS / 2 + 5, castleS, castleS)
    ctx.fillRect(-shieldWidth / 4 - castleS / 2, -shieldHeight / 4 - castleS / 2, castleS / 3, 5)
    ctx.fillRect(-shieldWidth / 4 - castleS / 6, -shieldHeight / 4 - castleS / 2, castleS / 3, 5)
    ctx.fillRect(-shieldWidth / 4 + castleS / 6, -shieldHeight / 4 - castleS / 2, castleS / 3, 5)

    // 2. León
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, -shieldHeight / 2, shieldWidth / 2, shieldHeight / 2)
    ctx.fillStyle = '#A2006D'
    ctx.beginPath()
    ctx.arc(shieldWidth / 4, -shieldHeight / 4 + 5, shieldWidth * 0.12, 0, Math.PI * 2)
    ctx.arc(shieldWidth / 4 - 10, -shieldHeight / 4 - 10, shieldWidth * 0.08, 0, Math.PI * 2)
    ctx.fill()

    // 3. Aragón
    ctx.fillStyle = '#F1BF00'
    ctx.fillRect(-shieldWidth / 2, 0, shieldWidth / 2, shieldHeight / 2)
    ctx.fillStyle = '#AA151B'
    for(let i = 1; i < 4; i += 2)
    {
        ctx.fillRect(-shieldWidth / 2 + (shieldWidth / 8) * i, 0, shieldWidth / 8, shieldHeight / 2)
    }

    // 4. Navarra
    ctx.fillStyle = '#AA151B'
    ctx.fillRect(0, 0, shieldWidth / 2, shieldHeight / 2)
    ctx.strokeStyle = '#F1BF00'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0); ctx.lineTo(shieldWidth / 2, shieldHeight / 2)
    ctx.moveTo(shieldWidth / 2, 0); ctx.lineTo(0, shieldHeight / 2)
    ctx.moveTo(shieldWidth / 4, 0); ctx.lineTo(shieldWidth / 4, shieldHeight / 2)
    ctx.moveTo(0, shieldHeight / 4); ctx.lineTo(shieldWidth / 2, shieldHeight / 4)
    ctx.stroke()

    // Granada
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(-shieldWidth / 4, shieldHeight / 2 * 0.9)
    ctx.lineTo(shieldWidth / 4, shieldHeight / 2 * 0.9)
    ctx.lineTo(0, shieldHeight / 2 * 1.2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#009246'
    ctx.beginPath(); ctx.arc(0, shieldHeight / 2 * 0.95, 3, 0, Math.PI * 2); ctx.fill()

    // Borbón-Anjou
    ctx.fillStyle = '#0033A0'
    ctx.beginPath()
    ctx.arc(0, 0, shieldWidth * 0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#AA151B'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#F1BF00'
    ctx.fillRect(-4, -4, 3, 3)
    ctx.fillRect(2, -4, 3, 3)
    ctx.fillRect(-1, 2, 3, 3)

    ctx.restore()

    // Columnas de Hércules
    const colWidth = shieldWidth * 0.15
    const colHeight = shieldHeight * 0.9
    const colDist = shieldWidth * 0.8
    
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(cx - colDist, cy - colHeight / 2, colWidth, colHeight)
    ctx.fillRect(cx + colDist - colWidth, cy - colHeight / 2, colWidth, colHeight)
    
    ctx.fillStyle = '#CCCCCC'
    ctx.fillRect(cx - colDist - 2, cy - colHeight / 2 - 5, colWidth + 4, 5)
    ctx.fillRect(cx - colDist - 2, cy + colHeight / 2, colWidth + 4, 5)
    ctx.fillRect(cx + colDist - colWidth - 2, cy - colHeight / 2 - 5, colWidth + 4, 5)
    ctx.fillRect(cx + colDist - colWidth - 2, cy + colHeight / 2, colWidth + 4, 5)

    // Corona real
    ctx.fillStyle = '#F1BF00'
    ctx.beginPath()
    ctx.moveTo(cx - shieldWidth / 2, cy - shieldHeight / 2 - 5)
    ctx.lineTo(cx + shieldWidth / 2, cy - shieldHeight / 2 - 5)
    ctx.lineTo(cx + shieldWidth / 2 + 10, cy - shieldHeight / 2 - 25)
    ctx.lineTo(cx + shieldWidth / 4, cy - shieldHeight / 2 - 15)
    ctx.lineTo(cx, cy - shieldHeight / 2 - 30)
    ctx.lineTo(cx - shieldWidth / 4, cy - shieldHeight / 2 - 15)
    ctx.lineTo(cx - shieldWidth / 2 - 10, cy - shieldHeight / 2 - 25)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#AA151B'
    ctx.fillRect(cx - shieldWidth / 2, cy - shieldHeight / 2 - 8, shieldWidth, 3)
}

function drawSuiza(ctx, w, h)
{
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, w, h)
    
    const cw = w * 0.15
    const ch = h * 0.6
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect((w - cw) / 2, (h - ch) / 2, cw, ch)
    ctx.fillRect((w - ch) / 2, (h - cw) / 2, ch, cw)
}

function drawCanada(ctx, w, h)
{
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, 0, w / 4, h)
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 4, 0, w / 2, h)
    ctx.fillStyle = '#FF0000'; ctx.fillRect((w / 4) * 3, 0, w / 4, h)

    ctx.save()
    ctx.translate(w / 2, h / 2)
    
    ctx.fillStyle = '#FF0000'
    ctx.beginPath()
    
    const s = h * 0.46 
    
    ctx.moveTo(0, -0.85 * s)
    ctx.lineTo(0.12 * s, -0.35 * s)
    ctx.lineTo(0.32 * s, -0.55 * s)
    ctx.lineTo(0.28 * s, -0.20 * s)
    ctx.lineTo(0.72 * s, -0.35 * s)
    ctx.lineTo(0.55 * s, -0.05 * s)
    ctx.lineTo(0.95 * s, 0.05 * s)
    ctx.lineTo(0.60 * s, 0.20 * s)
    ctx.lineTo(0.75 * s, 0.45 * s)
    ctx.lineTo(0.35 * s, 0.35 * s)
    ctx.lineTo(0.40 * s, 0.65 * s)
    ctx.lineTo(0.06 * s, 0.55 * s)
    
    ctx.lineTo(0.06 * s, 0.95 * s)
    ctx.lineTo(-0.06 * s, 0.95 * s)
    
    ctx.lineTo(-0.06 * s, 0.55 * s)
    ctx.lineTo(-0.40 * s, 0.65 * s)
    ctx.lineTo(-0.35 * s, 0.35 * s)
    ctx.lineTo(-0.75 * s, 0.45 * s)
    ctx.lineTo(-0.60 * s, 0.20 * s)
    ctx.lineTo(-0.95 * s, 0.05 * s)
    ctx.lineTo(-0.55 * s, -0.05 * s)
    ctx.lineTo(-0.72 * s, -0.35 * s)
    ctx.lineTo(-0.28 * s, -0.20 * s)
    ctx.lineTo(-0.32 * s, -0.55 * s)
    ctx.lineTo(-0.12 * s, -0.35 * s)
    
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function drawUSA(ctx, w, h)
{
    const stripeHeight = h / 13
    for(let i = 0; i < 13; i++)
    {
        ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#FFFFFF'
        ctx.fillRect(0, i * stripeHeight, w, stripeHeight)
    }

    const cantonWidth = w * 0.4
    const cantonHeight = stripeHeight * 7
    ctx.fillStyle = '#3C3B6E'
    ctx.fillRect(0, 0, cantonWidth, cantonHeight)

    ctx.fillStyle = '#FFFFFF'
    const starRadius = stripeHeight * 0.35
    const hGap = cantonWidth / 12
    const vGap = cantonHeight / 10

    for(let row = 1; row <= 9; row++)
    {
        let cols = (row % 2 !== 0) ? 6 : 5
        let startX = (row % 2 !== 0) ? hGap : hGap * 2
        for(let col = 0; col < cols; col++)
        {
            const cx = startX + col * hGap * 2
            const cy = row * vGap
            drawStar(ctx, cx, cy, 5, starRadius, starRadius * 0.4)
        }
    }
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius)
{
    let rot = (Math.PI / 2) * 3
    let x = cx
    let y = cy
    const step = Math.PI / spikes

    ctx.beginPath()
    ctx.moveTo(cx, cy - outerRadius)
    for(let i = 0; i < spikes; i++)
    {
        x = cx + Math.cos(rot) * outerRadius
        y = cy + Math.sin(rot) * outerRadius
        ctx.lineTo(x, y)
        rot += step

        x = cx + Math.cos(rot) * innerRadius
        y = cy + Math.sin(rot) * innerRadius
        ctx.lineTo(x, y)
        rot += step
    }
    ctx.lineTo(cx, cy - outerRadius)
    ctx.closePath()
    ctx.fill()
}

function createCanvasTexture(drawFunction)
{
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    drawFunction(ctx, canvas.width, canvas.height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    return texture
}

// ── CLASE PRINCIPAL ───────────────────────────────────────────────

export class FlagsExhibition
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.x = options.x ?? -15.16
        this.y = options.y ?? 0.05
        this.z = options.z ?? -55.32
        this.scale = options.scale ?? 1.0
        this.airplaneScale = options.airplaneScale ?? 4.8

        this.group = new THREE.Group()
        this.group.name = 'FlagsExhibition'
        this.group.position.set(this.x, this.y, this.z)
        this.game.scene.add(this.group)

        this.flags = []
        this.frameCount = 0
        this.isNear = false
        this.typewriterInterval = null

        this._initAirplane()
        this._initFlags()
        this._initAudio()
        this._initNoticeDOM()

        // Loop de viento y detección de proximidad
        this._onTick = this._onTick.bind(this)
        this.game.ticker.events.on('tick', this._onTick, 6)
    }

    _initAirplane()
    {
        const airplaneUrl = './airplane/Airplane.glb'
        const loader = new GLTFLoader()

        loader.load(
            airplaneUrl,
            (gltf) =>
            {
                const airplane = gltf.scene

                airplane.traverse((child) =>
                {
                    if(child.isMesh)
                    {
                        child.castShadow = true
                        child.receiveShadow = true
                    }
                })

                airplane.scale.setScalar(this.airplaneScale)
                // Orientación a lo largo de la pista recta con ligero ángulo estilizado
                airplane.rotation.y = 0.08

                const box = new THREE.Box3().setFromObject(airplane)
                airplane.position.set(0, -box.min.y + 0.02, 0)

                this.group.add(airplane)

                // Físicas Rapier para el avión
                this.game.objects.add(null, {
                    type: 'fixed',
                    position: new THREE.Vector3(this.x, this.y + 1.2, this.z),
                    colliders: [
                        { shape: 'cuboid', parameters: [ 1.8, 1.2, 5.2 ], category: 'object' },
                        { shape: 'cuboid', parameters: [ 5.6, 0.35, 1.6 ], category: 'object' }
                    ],
                    onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
                })
            },
            undefined,
            (err) =>
            {
                console.warn('[FlagsExhibition] Airplane.glb aviso:', err)
            }
        )
    }

    _initFlags()
    {
        // 6 Banderas en dos hileras simétricas a ambos lados de la pista
        const flagConfigs = [
            // Flanco Izquierdo (Oeste)
            { name: 'Canadá',   texture: createCanvasTexture(drawCanada),   pos: [ -7.2, 0, -9.5 ] },
            { name: 'USA',      texture: createCanvasTexture(drawUSA),      pos: [ -8.4, 0,  0.0 ] },
            { name: 'Italia',   texture: createCanvasTexture(drawItalia),   pos: [ -7.2, 0,  9.5 ] },
            // Flanco Derecho (Este)
            { name: 'Suiza',    texture: createCanvasTexture(drawSuiza),    pos: [  7.2, 0, -9.5 ] },
            { name: 'Alemania', texture: createCanvasTexture(drawAlemania), pos: [  8.4, 0,  0.0 ] },
            { name: 'España',   texture: createCanvasTexture(drawEspana),   pos: [  7.2, 0,  9.5 ] }
        ]

        const flagWidth = 3.6
        const flagHeight = 1.8
        const poleHeight = 7.0

        // Geometrías y materiales reutilizados
        const poleGeo = new THREE.CylinderGeometry(0.065, 0.065, poleHeight, 16)
        const baseGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.28, 16)
        const knobGeo = new THREE.SphereGeometry(0.16, 12, 12)

        const poleMat = new THREE.MeshStandardMaterial({
            color: 0xd8d8d8,
            emissive: 0x333333,
            metalness: 0.85,
            roughness: 0.2
        })
        const knobMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0x553300,
            metalness: 0.95,
            roughness: 0.15
        })

        const flagGeoTemplate = new THREE.PlaneGeometry(flagWidth, flagHeight, 36, 20)

        flagConfigs.forEach((data, index) =>
        {
            const [ relX, relY, relZ ] = data.pos

            // 1. Mástil
            const pole = new THREE.Mesh(poleGeo, poleMat)
            pole.position.set(relX - flagWidth / 2 - 0.07, poleHeight / 2, relZ)
            pole.castShadow = true
            this.group.add(pole)

            // Base de hormigón/metal
            const base = new THREE.Mesh(baseGeo, poleMat)
            base.position.set(pole.position.x, 0.14, relZ)
            this.group.add(base)

            // Remate dorado superior
            const knob = new THREE.Mesh(knobGeo, knobMat)
            knob.position.set(pole.position.x, poleHeight + 0.10, relZ)
            this.group.add(knob)

            // 2. Tela de la bandera (Material auto-iluminado para máxima viveza de color y visibilidad sin sombras negras)
            const flagMat = new THREE.MeshBasicMaterial({
                map: data.texture,
                side: THREE.DoubleSide
            })

            const mesh = new THREE.Mesh(flagGeoTemplate.clone(), flagMat)
            mesh.position.set(relX, poleHeight - flagHeight / 2 - 0.25, relZ)
            mesh.castShadow = true
            mesh.receiveShadow = false

            mesh.userData.originalPositions = new Float32Array(mesh.geometry.attributes.position.array)
            mesh.userData.offset = index * Math.PI * 0.65
            mesh.userData.flagWidth = flagWidth

            this.group.add(mesh)
            this.flags.push(mesh)

            // Colisionador físico para cada mástil
            const worldPoleX = this.x + pole.position.x
            const worldPoleZ = this.z + relZ

            this.game.objects.add(null, {
                type: 'fixed',
                position: new THREE.Vector3(worldPoleX, this.y + poleHeight / 2, worldPoleZ),
                colliders: [ { shape: 'cuboid', parameters: [ 0.35, poleHeight / 2, 0.35 ], category: 'object' } ],
                onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
            })
        })

        // Sonido espacial intenso (6 banderas ondeando juntas en los países que quiero visitar)
        this._flagAudioPositions = flagConfigs.map((d) => new THREE.Vector3(
            this.x + d.pos[0],
            this.y + poleHeight * 0.7,
            this.z + d.pos[2]
        ))
    }

    _initAudio()
    {
        const positions = (this._flagAudioPositions && this._flagAudioPositions.length > 0)
            ? this._flagAudioPositions
            : [ new THREE.Vector3(this.x, this.y + 4, this.z) ]

        this.flagSound = this.game.audio.register({
            group: 'countriesFlagsSound',
            path: 'sounds/flag/flags.mp3',
            autoplay: true,
            loop: true,
            volume: 0.95,
            positions,
            distanceFade: 28,
        })
    }

    _initNoticeDOM()
    {
        // Contenedor flotante tipo Glassmorphism superior
        this.noticeEl = document.createElement('div')
        this.noticeEl.id = 'flags-location-toast'

        Object.assign(this.noticeEl.style, {
            position:        'fixed',
            top:             '24px',
            left:            '50%',
            transform:       'translateX(-50%) translateY(-24px)',
            background:      'rgba(7, 12, 24, 0.90)',
            border:          '1.5px solid rgba(0, 195, 255, 0.45)',
            borderRadius:    '9999px',
            padding:         '10px 24px 10px 14px',
            color:           '#ffffff',
            fontFamily:      "'Inter', system-ui, -apple-system, sans-serif",
            fontSize:        '14px',
            zIndex:          '9999',
            boxShadow:       '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 26px rgba(0, 195, 255, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            backdropFilter:  'blur(16px)',
            pointerEvents:   'none',
            userSelect:      'none',
            opacity:         '0',
            display:         'flex',
            alignItems:      'center',
            gap:             '14px',
            transition:      'opacity 0.35s ease, transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace:      'nowrap'
        })

        this.noticeEl.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:rgba(0,195,255,0.12);border:1px solid rgba(0,195,255,0.35);font-size:18px;box-shadow:inset 0 0 10px rgba(0,195,255,0.2);">
                <span>✈️</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px;">
                <div style="font-size:9.5px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#00c3ff;text-shadow:0 0 10px rgba(0,195,255,0.5);">
                    • DESTINOS
                </div>
                <div style="display:flex;align-items:center;font-size:15px;font-weight:600;color:#ffffff;letter-spacing:0.02em;">
                    <span class="js-typewriter-text"></span>
                    <span class="js-cursor" style="display:inline-block;width:2px;height:15px;margin-left:3px;background:#00c3ff;animation:blinkTypeCursor 0.65s infinite alternate;"></span>
                </div>
            </div>
        `

        // Estilo CSS de la animación del cursor parpadeante
        if(!document.getElementById('typewriter-cursor-style'))
        {
            const style = document.createElement('style')
            style.id = 'typewriter-cursor-style'
            style.textContent = `
                @keyframes blinkTypeCursor {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `
            document.head.appendChild(style)
        }

        document.body.appendChild(this.noticeEl)
    }

    _showNotice()
    {
        if(!this.noticeEl) return

        const textSpan = this.noticeEl.querySelector('.js-typewriter-text')
        const cursor = this.noticeEl.querySelector('.js-cursor')
        if(textSpan) textSpan.textContent = ''
        if(cursor) cursor.style.display = 'inline-block'

        // Aparecer suavemente con slide hacia abajo
        this.noticeEl.style.opacity = '1'
        this.noticeEl.style.transform = 'translateX(-50%) translateY(0)'

        if(this.typewriterInterval) clearInterval(this.typewriterInterval)

        const fullText = 'Países que quiero visitar'
        let charIndex = 0

        // Efecto máquina de escribir (40ms por letra)
        this.typewriterInterval = setInterval(() =>
        {
            if(charIndex < fullText.length)
            {
                if(textSpan) textSpan.textContent = fullText.slice(0, charIndex + 1)
                charIndex++
            }
            else
            {
                clearInterval(this.typewriterInterval)
                this.typewriterInterval = null
                setTimeout(() =>
                {
                    if(cursor) cursor.style.display = 'none'
                }, 1000)
            }
        }, 40)
    }

    _hideNotice()
    {
        if(!this.noticeEl) return

        if(this.typewriterInterval)
        {
            clearInterval(this.typewriterInterval)
            this.typewriterInterval = null
        }

        // Desvanecer suavemente hacia arriba
        this.noticeEl.style.opacity = '0'
        this.noticeEl.style.transform = 'translateX(-50%) translateY(-24px)'
    }

    _onTick()
    {
        this.frameCount++
        const time = performance.now() * 0.001

        // 1. Detección de proximidad del jugador/vehículo (cada 3 fotogramas)
        if(this.frameCount % 3 === 0)
        {
            const player = this.game.player
            const px = player?.position2?.x ?? this.game.view?.focusPoint?.position?.x
            const pz = player?.position2?.y ?? this.game.view?.focusPoint?.position?.z

            if(px !== undefined && pz !== undefined)
            {
                const dist = Math.hypot(px - this.x, pz - this.z)

                if(dist < 23.0 && !this.isNear)
                {
                    this.isNear = true
                    this._showNotice()
                }
                else if(dist > 26.0 && this.isNear)
                {
                    this.isNear = false
                    this._hideNotice()
                }
            }
        }

        // 2. Animación de ondulación de las banderas por el viento
        for(let idx = 0; idx < this.flags.length; idx++)
        {
            const flag = this.flags[idx]
            const positionAttr = flag.geometry.attributes.position
            const pos = positionAttr.array
            const orig = flag.userData.originalPositions
            const count = positionAttr.count
            const offset = flag.userData.offset
            const width = flag.userData.flagWidth

            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
                const x = orig[i3]
                
                // Normalizado de 0 (pegado al mástil) a 1 (extremo libre)
                const normalizedX = (x + width / 2) / width
                
                // Ondulación natural de tela por el viento
                const wave = Math.sin(normalizedX * 5.5 - time * 4.0 + offset) * (normalizedX * 0.32)
                const waveY = Math.cos(normalizedX * 3.0 - time * 2.2) * (normalizedX * 0.08)

                pos[i3 + 2] = orig[i3 + 2] + wave
                pos[i3 + 1] = orig[i3 + 1] + waveY
            }

            positionAttr.needsUpdate = true
            if(this.frameCount % 2 === 0)
            {
                flag.geometry.computeVertexNormals()
            }
        }
    }
}
