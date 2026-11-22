import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { color, texture, uniform } from 'three/tsl'
import { Game } from '../Game.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export const PROJECTS_DATA = [
    { title: 'Streaming Account Store', category: 'WEB APPLICATION', categoryColor: '#f59e0b', image: 'projects/tienda-streaming.png', codeLink: 'https://github.com/jesusmandev/platform-to-sell-streaming-accounts.git', webLink: 'https://jesusmandev.github.io/platform-to-sell-streaming-accounts/' },
    { title: 'World Food Menu', category: 'FOOD', categoryColor: '#f59e0b', image: 'projects/menu-comida.png', codeLink: 'https://github.com/jesusmandev/WorldMenu.git', webLink: 'https://jesusmandev.github.io/WorldMenu/' },
    { title: 'Hangman Game', category: 'GAME', categoryColor: '#22c55e', image: 'projects/juego-ahorcado.png', codeLink: 'https://github.com/jesusmandev/Hangman-game.git', webLink: 'https://jesusmandev.github.io/Hangman-game/' },
    { title: 'GIF App', category: 'APP', categoryColor: '#a855f7', image: 'projects/app-gifs.png', codeLink: 'https://github.com/jesusmandev/GIF-app.git', webLink: 'https://jesusmandev.github.io/GIF-app/' },
    { title: "Valentine's Day Card", category: 'DESIGN', categoryColor: '#ec4899', image: 'projects/tarjeta-san-valentin.png', codeLink: 'https://github.com/jesusmandev/valentine-card.git', webLink: 'https://jesusmandev.github.io/valentine-card/' },
    { title: 'Prelcfes Simulator', category: 'EDUCATION', categoryColor: '#6366f1', image: 'projects/simulador-prelcfes.png', codeLink: 'https://github.com/jesusmandev/simulator.git', webLink: 'https://jesusmandev.github.io/simulator/' },
    { title: 'Calculator', category: 'UTILITY', categoryColor: '#f59e0b', image: 'projects/calculadora.png', codeLink: 'https://github.com/jesusmandev/calculadora.git', webLink: 'https://jesusmandev.github.io/calculadora/' },
    { title: 'Colombian Coffees', category: 'COLOMBIA', categoryColor: '#f59e0b', image: 'projects/cafe.png', codeLink: 'https://github.com/jesusmandev/CAFES-COLOMBIANOS.git', webLink: 'https://jesusmandev.github.io/CAFES-COLOMBIANOS/' },
    { title: 'Burger Landing Page', category: 'LANDING PAGE', categoryColor: '#ef4444', image: 'projects/hamburguesa.png', codeLink: 'https://github.com/jesusmandev/burger-landing.git', webLink: 'https://agent-6a1ac44517acbb0fc92284c3--burger-jesu.netlify.app/' },
    { title: 'Motorcycle Landing Page', category: 'LANDING PAGE', categoryColor: '#3b82f6', image: 'projects/moto.png', codeLink: 'https://github.com/jesusmandev/landing-page-of-motorbike.git', webLink: 'https://jesusmandev.github.io/landing-page-of-motorbike/' },
    { title: '3D Black Hole', category: '3D / GAME', categoryColor: '#8b5cf6', image: 'projects/black-hole.png', codeLink: 'https://github.com/jesusmandev/3D-Black-Hole.git', webLink: 'https://jesusmandev.github.io/3D-Black-Hole/' },
    { title: 'Gemini Clone AI', category: 'AI WEB APP', categoryColor: '#3b82f6', image: 'projects/gemini.png', codeLink: 'https://github.com/jesusmandev/gemini-clon.git', webLink: 'https://agent-6a8492e1e0a9504b48d47baf--gemini-clonado.netlify.app' },
    { title: 'Hotel Landing Page', category: 'LANDING PAGE', categoryColor: '#06b6d4', image: 'projects/hotel.png', codeLink: 'https://github.com/jesusmandev/landing-page-hotel.git', webLink: 'https://jesusmandev.github.io/landing-page-hotel/' },
    { title: 'Solar System 3D', category: '3D / SPACE', categoryColor: '#8b5cf6', image: 'projects/solarSistem.png', codeLink: 'https://github.com/jesusmandev/solar-sistem.git', webLink: 'https://jesusmandev.github.io/solar-sistem/' },
]

function createWoodTexture(darker = false)
{
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const ctx = c.getContext('2d')
    const base = darker ? [139, 90, 43] : [196, 143, 90]
    ctx.fillStyle = `rgb(${base.join(',')})`
    ctx.fillRect(0, 0, 512, 512)

    for(let i = 0; i < 40; i++)
    {
        const y = Math.random() * 512
        ctx.strokeStyle = `rgba(60,40,20,${0.06 + Math.random() * 0.1})`
        ctx.lineWidth = 1 + Math.random() * 3
        ctx.beginPath()
        ctx.moveTo(0, y)
        let cy = y
        for(let x = 0; x <= 512; x += 40)
        {
            cy += (Math.random() - 0.5) * 6
            ctx.lineTo(x, cy)
        }
        ctx.stroke()
    }

    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
}

function createBoardTexture()
{
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#c48f5a'
    ctx.fillRect(0, 0, 512, 512)

    const planks = 5
    const ph = 512 / planks
    for(let p = 0; p < planks; p++)
    {
        const y = p * ph
        ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.04})`
        ctx.fillRect(0, y, 512, ph)
        ctx.strokeStyle = 'rgba(60,40,20,0.35)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(512, y)
        ctx.stroke()
    }

    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
}

function createSideButtonTexture(text, accentColor = '#3b82f6')
{
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const ctx = c.getContext('2d')

    ctx.fillStyle = '#1e1b18'
    ctx.fillRect(0, 0, 512, 256)

    ctx.strokeStyle = accentColor
    ctx.lineWidth = 10
    ctx.strokeRect(6, 6, 500, 244)

    ctx.shadowColor = accentColor
    ctx.shadowBlur = 14
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 58px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 128)

    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
}

function roundedRectShape(w, h, r)
{
    const s = new THREE.Shape()
    s.moveTo(-w / 2 + r, h / 2)
    s.lineTo(w / 2 - r, h / 2)
    s.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - r)
    s.lineTo(w / 2, -h / 2 + r)
    s.quadraticCurveTo(w / 2, -h / 2, w / 2 - r, -h / 2)
    s.lineTo(-w / 2 + r, -h / 2)
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + r)
    s.lineTo(-w / 2, h / 2 - r)
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2 + r, h / 2)
    return s
}

/**
 * Cartel 3D "THESE ARE MY PROJECTS" (portado de frontend-portfolio al motor WebGPU de folio-2025)
 */
export class ProyectosSign
{
    static STATE_OPEN = 3
    static STATE_OPENING = 4
    static STATE_CLOSED = 5
    static STATE_CLOSING = 6

    constructor(options = {})
    {
        this.game = Game.getInstance()
        this.scene = this.game.scene

        this.position = options.position ? options.position.clone() : new THREE.Vector3(13.1, 0, 15.5)
        this.scale = options.scale ?? 0.9
        this.rotationY = options.rotationY ?? 0

        this.currentIndex = 0
        this._imgCache = new Map()

        this.rootGroup = new THREE.Group()
        this.rootGroup.position.copy(this.position)
        this.rootGroup.rotation.y = this.rotationY
        this.rootGroup.scale.setScalar(this.scale)
        this.scene.add(this.rootGroup)

        this.swingGroups = []
        this.interactiveMeshes = []
        this._raycaster = new THREE.Raycaster()
        this._mouse = new THREE.Vector2()
        this._hoveredObj = null
        this._downPos = { x: 0, y: 0 }

        // Canvas dinámico del tablero principal
        this.mainCanvas = document.createElement('canvas')
        this.mainCanvas.width = 1024
        this.mainCanvas.height = 640
        this.mainCtx = this.mainCanvas.getContext('2d')
        this.mainTexture = new THREE.CanvasTexture(this.mainCanvas)
        this.mainTexture.colorSpace = THREE.SRGBColorSpace

        this._build()
        this._buildPhysics()
        this._updateProjectCanvas()

        this._onPointerDown = this._onPointerDown.bind(this)
        this._onPointerUp = this._onPointerUp.bind(this)
        this._onPointerMove = this._onPointerMove.bind(this)

        window.addEventListener('pointerdown', this._onPointerDown)
        window.addEventListener('pointerup', this._onPointerUp)
        window.addEventListener('pointermove', this._onPointerMove)

        this.game.ticker.events.on('tick', () =>
        {
            this.update(this.game.ticker.elapsed)
        }, 10)

        this.setInteraction()
    }

    /**
     * Punto interactivo "Projects" (presiona ENTER para ver los proyectos) y modo cinemática
     */
    setInteraction()
    {
        this.state = ProyectosSign.STATE_CLOSED

        const rotation = this.rotationY
        const front = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation))

        // Punto interactivo frente al cartel
        const pointPosition = this.position.clone().addScaledVector(front, 5.0)
        pointPosition.y = 1.2

        // Cámara de la cinemática (frente al cartel, mirando al tablero)
        this._frontDir = front.clone()
        this.cinematic = {
            position: this.position.clone().addScaledVector(front, 13.5).add(new THREE.Vector3(0, 4.2, 0)),
            target: this.position.clone().add(new THREE.Vector3(0, 3.0, 0))
        }

        this.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            'Projects',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.open()
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

        // Navegación con teclado / gamepad mientras está abierto
        const inputs = this.game.inputs

        inputs.events.on('left', (action) =>
        {
            if(action.active && this.state === ProyectosSign.STATE_OPEN)
                this.previous()
        })

        inputs.events.on('right', (action) =>
        {
            if(action.active && this.state === ProyectosSign.STATE_OPEN)
                this.next()
        })

        inputs.events.on('forward', (action) =>
        {
            if(action.active && !action.activeKeys.has('Gamepad.r2') && this.state === ProyectosSign.STATE_OPEN)
                this.previous()
        })

        inputs.events.on('backward', (action) =>
        {
            if(action.active && !action.activeKeys.has('Gamepad.l2') && this.state === ProyectosSign.STATE_OPEN)
                this.next()
        })

        // ENTER => abrir el enlace del proyecto actual
        inputs.events.on('interact', (action) =>
        {
            if(!action.active && this.state === ProyectosSign.STATE_OPEN)
                this.openLink('webLink')
        })

        // Botones táctiles
        inputs.interactiveButtons.events.on('previous', () =>
        {
            if(this.state === ProyectosSign.STATE_OPEN)
                this.previous()
        })

        inputs.interactiveButtons.events.on('next', () =>
        {
            if(this.state === ProyectosSign.STATE_OPEN)
                this.next()
        })

        inputs.interactiveButtons.events.on('open', () =>
        {
            if(this.state === ProyectosSign.STATE_OPEN)
                this.openLink('webLink')
        })

        inputs.interactiveButtons.events.on('close', () =>
        {
            if(this.state === ProyectosSign.STATE_OPEN)
                this.close()
        })
    }

    get isOpen()
    {
        return this.state === ProyectosSign.STATE_OPEN || this.state === ProyectosSign.STATE_OPENING
    }

    openLink(type)
    {
        const project = PROJECTS_DATA[this.currentIndex]
        if(project && project[type])
            window.open(project[type], '_blank')
    }

    previous()
    {
        this.currentIndex = (this.currentIndex - 1 + PROJECTS_DATA.length) % PROJECTS_DATA.length
        this._updateProjectCanvas()
    }

    next()
    {
        this.currentIndex = (this.currentIndex + 1) % PROJECTS_DATA.length
        this._updateProjectCanvas()
    }

    open()
    {
        if(this.isOpen)
            return

        this.state = ProyectosSign.STATE_OPENING

        if(this.stateTransition)
            this.stateTransition.kill()

        this.stateTransition = gsap.delayedCall(1.5, () =>
        {
            this.state = ProyectosSign.STATE_OPEN
            this.stateTransition = null
        })

        // Filtros de inputs y cámara cinemática (en móvil se acerca mucho más para llenar bien la pantalla)
        this.game.inputs.filters.delete('wandering')
        this.game.inputs.filters.add('cinematic')

        const aspect = this.game.viewport.ratio || (window.innerWidth / window.innerHeight)
        const isMobileView = this.game.inputs.mode === 3 || window.innerWidth <= 900 || aspect < 1

        if(isMobileView)
        {
            const dist = aspect < 1
                ? Math.min(21.5, Math.max(11.0, 10.2 / Math.max(aspect, 0.38)))
                : 9.2
            const camY = aspect < 1 ? 3.25 : 3.4
            const targetY = aspect < 1 ? 2.85 : 3.05
            const mobilePos = this.position.clone().addScaledVector(this._frontDir, dist).add(new THREE.Vector3(0, camY, 0))
            const mobileTarget = this.position.clone().add(new THREE.Vector3(0, targetY, 0))
            this.game.view.cinematic.start(mobilePos, mobileTarget, 0)
        }
        else
        {
            this.game.view.cinematic.start(this.cinematic.position, this.cinematic.target)
        }

        this.game.interactivePoints.temporaryHide()
        this.game.physicalVehicle.deactivate()

        this.game.inputs.interactiveButtons.clearItems()
        this.game.inputs.interactiveButtons.addItems(['previous', 'next', 'open', 'close'])

        const sound = this.game.audio.groups.get('click')
        if(sound)
            sound.play(true)
    }

    close()
    {
        if(this.state === ProyectosSign.STATE_CLOSED || this.state === ProyectosSign.STATE_CLOSING)
            return

        this.state = ProyectosSign.STATE_CLOSING

        if(this.stateTransition)
            this.stateTransition.kill()

        this.stateTransition = gsap.delayedCall(1.5, () =>
        {
            this.state = ProyectosSign.STATE_CLOSED
            this.stateTransition = null
        })

        this.game.inputs.filters.delete('cinematic')
        this.game.inputs.filters.add('wandering')
        this.game.view.cinematic.end()

        gsap.delayedCall(1, () =>
        {
            this.game.interactivePoints.recover()
        })

        this.game.physicalVehicle.activate()
        this.game.inputs.interactiveButtons.clearItems()

        const sound = this.game.audio.groups.get('click')
        if(sound)
            sound.play(false)
    }

    // Material con el estilo del juego (luces, sombras, niebla y reveal)
    _lit(hex, tex = null)
    {
        return new MeshDefaultMaterial({
            colorNode: tex ? texture(tex).rgb : color(hex),
            hasLightBounce: false,
            hasWater: false
        })
    }

    // Material "brillante" (sin sombreado propio) con intensidad ajustable para hover
    _glow(tex, hex, base = 1)
    {
        const glow = uniform(base)
        const colorNode = (tex ? texture(tex).rgb : color(hex)).mul(glow)
        const material = new MeshDefaultMaterial({
            colorNode,
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
            hasWater: false
        })
        material.userData.glow = glow
        material.userData.glowBase = base
        return material
    }

    _updateProjectCanvas()
    {
        const project = PROJECTS_DATA[this.currentIndex]
        if(!project)
            return

        const ctx = this.mainCtx
        const w = 1024, h = 640

        const drawContent = (imgElement) =>
        {
            const grad = ctx.createLinearGradient(0, 0, w, h)
            grad.addColorStop(0, '#0c0d14')
            grad.addColorStop(0.5, '#161829')
            grad.addColorStop(1, '#0c0d14')
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, w, h)

            ctx.strokeStyle = '#3b82f6'
            ctx.lineWidth = 14
            ctx.strokeRect(7, 7, w - 14, h - 14)

            ctx.font = 'bold 34px "Segoe UI", sans-serif'
            ctx.fillStyle = '#e2e8f0'
            ctx.textAlign = 'center'
            ctx.shadowColor = 'rgba(59, 130, 246, 0.6)'
            ctx.shadowBlur = 12
            ctx.fillText('THESE ARE MY PROJECTS', w / 2, 46)
            ctx.shadowBlur = 0

            ctx.font = 'bold 22px sans-serif'
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
            ctx.textAlign = 'right'
            ctx.fillText(`${this.currentIndex + 1} / ${PROJECTS_DATA.length}`, w - 28, 46)

            ctx.font = '800 36px "Segoe UI", sans-serif'
            ctx.fillStyle = '#ffffff'
            ctx.textAlign = 'center'
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
            ctx.shadowBlur = 12
            ctx.fillText(project.title.toUpperCase(), w / 2, 94)
            ctx.shadowBlur = 0

            ctx.font = 'bold 17px sans-serif'
            const badgeText = project.category.toUpperCase()
            const badgeW = ctx.measureText(badgeText).width + 32
            ctx.fillStyle = project.categoryColor || '#f59e0b'
            ctx.fillRect(w / 2 - badgeW / 2, 108, badgeW, 30)
            ctx.fillStyle = '#ffffff'
            ctx.fillText(badgeText, w / 2, 129)

            const imgW = 740
            const imgH = 440
            const imgX = (w - imgW) / 2
            const imgY = 160

            ctx.fillStyle = '#1e293b'
            ctx.fillRect(imgX - 8, imgY - 8, imgW + 16, imgH + 16)
            ctx.strokeStyle = '#64748b'
            ctx.lineWidth = 4
            ctx.strokeRect(imgX - 8, imgY - 8, imgW + 16, imgH + 16)

            if(imgElement)
            {
                ctx.drawImage(imgElement, imgX, imgY, imgW, imgH)
            }
            else
            {
                ctx.fillStyle = '#0f172a'
                ctx.fillRect(imgX, imgY, imgW, imgH)
                ctx.fillStyle = '#94a3b8'
                ctx.font = 'bold 26px sans-serif'
                ctx.fillText('Loading image...', w / 2, imgY + imgH / 2)
            }

            this.mainTexture.needsUpdate = true
        }

        if(project.image)
        {
            const cached = this._imgCache.get(project.image)
            if(cached)
            {
                drawContent(cached)
            }
            else
            {
                drawContent(null)
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.src = `./${project.image}`
                img.onload = () =>
                {
                    this._imgCache.set(project.image, img)
                    if(PROJECTS_DATA[this.currentIndex] === project)
                        drawContent(img)
                }
                img.onerror = () =>
                {
                    this._imgCache.set(project.image, null)
                }
            }
        }
        else
        {
            drawContent(null)
        }
    }

    _build()
    {
        const woodTex = createWoodTexture()
        const darkWoodTex = createWoodTexture(true)
        const boardTex = createBoardTexture()

        const matWood = this._lit(null, woodTex)
        const matDarkWood = this._lit(null, darkWoodTex)
        const matBoard = this._lit(null, boardTex)
        const matRope = this._lit('#d7ccc8')
        const matStone = this._lit('#9e9e9e')
        const matMetal = this._lit('#3a3a3a')

        const mw = 5.6, mh = 3.9, md = 0.55
        const mainGroup = new THREE.Group()

        // Estructura de madera
        const board = new THREE.Mesh(
            new THREE.ExtrudeGeometry(roundedRectShape(mw, mh, 0.18), {
                depth: md, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.08, bevelSegments: 2
            }),
            matBoard
        )
        board.position.set(0, 3.5, -md / 2)
        board.castShadow = true
        board.receiveShadow = true
        mainGroup.add(board)

        // Pantalla con la imagen del proyecto
        const screenMaterial = this._glow(this.mainTexture, null, 1.0)
        const mainDisplayPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(mw * 0.88, mh * 0.85),
            screenMaterial
        )
        mainDisplayPlane.position.set(0, 3.5, md / 2 + 0.15)
        mainDisplayPlane.renderOrder = 1
        mainGroup.add(mainDisplayPlane)

        // Marco exterior
        const frameShape = roundedRectShape(mw + 0.36, mh + 0.36, 0.26)
        frameShape.holes.push(roundedRectShape(mw + 0.04, mh + 0.04, 0.2))
        const frame = new THREE.Mesh(
            new THREE.ExtrudeGeometry(frameShape, { depth: md + 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }),
            matDarkWood
        )
        frame.position.set(0, 3.5, -(md + 0.18) / 2)
        frame.castShadow = true
        frame.receiveShadow = true
        mainGroup.add(frame)

        // Postes
        const createPost = (x) =>
        {
            const points = []
            for(let i = 0; i <= 8; i++)
                points.push(new THREE.Vector2(0.21 + Math.sin(i * 0.6) * 0.008, (i / 8) * 4.1))

            const g = new THREE.Group()
            const post = new THREE.Mesh(new THREE.LatheGeometry(points, 12), matDarkWood)
            post.castShadow = true
            post.receiveShadow = true
            g.add(post)

            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 14), matRope)
            ring.rotation.x = Math.PI / 2
            ring.position.y = 3.15
            ring.castShadow = true
            g.add(ring)

            g.position.set(x, 0, 0)
            g.rotation.z = x > 0 ? -0.015 : 0.015
            return g
        }
        mainGroup.add(createPost(-1.9))
        mainGroup.add(createPost(1.9))
        this.rootGroup.add(mainGroup)

        // Flechas de navegación
        const createArrow = () =>
        {
            const s = new THREE.Shape()
            const sl = 1.55, sw = 0.5, hl = 0.72, hw = 0.82
            s.moveTo(-sl / 2, sw / 2)
            s.lineTo(sl / 2 - 0.06, sw / 2)
            s.lineTo(sl / 2, hw / 2)
            s.lineTo(sl / 2 + hl, 0)
            s.lineTo(sl / 2, -hw / 2)
            s.lineTo(sl / 2 - 0.06, -sw / 2)
            s.lineTo(-sl / 2, -sw / 2)
            s.closePath()
            const geo = new THREE.ExtrudeGeometry(s, {
                depth: 0.32, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 2
            })
            geo.center()
            const mesh = new THREE.Mesh(geo, this._glow(null, '#ffc86b', 1.0))
            mesh.castShadow = true
            return mesh
        }

        this.leftArrow = createArrow()
        this.leftArrow.rotation.z = Math.PI
        this.leftArrow.position.set(-2.25, 1.85, md / 2 + 0.28)
        this.leftArrow.scale.setScalar(0.55)
        this.leftArrow.userData = { actionType: 'prev' }
        this.rootGroup.add(this.leftArrow)
        this.interactiveMeshes.push(this.leftArrow)

        this.rightArrow = createArrow()
        this.rightArrow.position.set(2.25, 1.85, md / 2 + 0.28)
        this.rightArrow.scale.setScalar(0.55)
        this.rightArrow.userData = { actionType: 'next' }
        this.rootGroup.add(this.rightArrow)
        this.interactiveMeshes.push(this.rightArrow)

        const ropeSegment = (p1, p2, thickness = 0.03) =>
        {
            const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
            const curve = new THREE.CatmullRomCurve3([ p1, mid, p2 ])
            const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, thickness, 5, false), matRope)
            mesh.castShadow = true
            return mesh
        }

        const addRocks = (parent, cx, cz, radius) =>
        {
            const count = 3 + Math.floor(Math.random() * 3)
            for(let i = 0; i < count; i++)
            {
                const a = Math.random() * Math.PI * 2
                const r = Math.random() * radius
                const s = 0.1 + Math.random() * 0.15
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), matStone)
                rock.position.set(cx + Math.cos(a) * r, s * 0.35, cz + Math.sin(a) * r)
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
                rock.castShadow = true
                rock.receiveShadow = true
                parent.add(rock)
            }
        }

        // Carteles laterales "VIEW DEMO" y "VIEW CODE"
        const createSideSign = (text, side, actionType) =>
        {
            const root = new THREE.Group()
            const dir = side === 'left' ? -1 : 1
            root.position.set(dir * 4.5, 0, 0)

            const polePoints = []
            for(let i = 0; i <= 8; i++)
                polePoints.push(new THREE.Vector2(0.15 + Math.sin(i * 0.5) * 0.006, (i / 8) * 4.6))
            const pole = new THREE.Mesh(new THREE.LatheGeometry(polePoints, 10), matDarkWood)
            pole.position.set(0, 0, -0.25)
            pole.castShadow = true
            pole.receiveShadow = true
            root.add(pole)

            const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 0.24), matDarkWood)
            beam.position.set(dir * 0.15, 4.55, 0.08)
            beam.castShadow = true
            root.add(beam)

            const swing = new THREE.Group()
            swing.position.set(dir * 0.3, 4.4, 0.12)
            root.add(swing)

            const sw = 2.0, sh = 0.95, sd = 0.12
            const accentColor = actionType === 'demo' ? '#3b82f6' : '#10b981'
            const matFront = this._glow(createSideButtonTexture(text, accentColor), null, 1.0)

            const signBoard = new THREE.Mesh(
                new THREE.BoxGeometry(sw, sh, sd),
                [ matWood, matWood, matWood, matWood, matFront, matWood ]
            )
            signBoard.position.y = -0.85
            signBoard.castShadow = true
            signBoard.userData = { actionType, glowMaterial: matFront }
            swing.add(signBoard)
            this.interactiveMeshes.push(signBoard)

            const addGrip = (xOffset) =>
            {
                const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, sd + 0.08), matMetal)
                strap.position.set(xOffset, -0.525, 0)
                swing.add(strap)
            }
            addGrip(-0.75)
            addGrip(0.75)

            const ringX1 = dir * 0.3 - 0.75
            const ringX2 = dir * 0.3 + 0.75
            root.add(ropeSegment(new THREE.Vector3(ringX1, 4.55, 0.22), new THREE.Vector3(ringX1, 4.085, 0.12)))
            root.add(ropeSegment(new THREE.Vector3(ringX2, 4.55, 0.22), new THREE.Vector3(ringX2, 4.085, 0.12)))

            addRocks(root, 0, 0.1, 0.5)

            this.rootGroup.add(root)
            this.swingGroups.push({ group: swing, phase: side === 'left' ? 0 : Math.PI })
        }

        createSideSign('VIEW DEMO', 'left', 'demo')
        createSideSign('VIEW CODE', 'right', 'code')

        const decor = new THREE.Group()
        addRocks(decor, -1.9, 0.15, 0.45)
        addRocks(decor, 1.9, 0.15, 0.45)
        addRocks(decor, 0, 0.2, 0.9)
        this.rootGroup.add(decor)
    }

    _buildPhysics()
    {
        const sc = this.scale

        this.physical = this.game.objects.add(
            null,
            {
                type: 'fixed',
                position: this.position,
                rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY),
                colliders: [
                    { shape: 'cuboid', parameters: [ 0.25 * sc, 2.05 * sc, 0.25 * sc ], position: { x: -1.9 * sc, y: 2.05 * sc, z: 0 }, category: 'object' },
                    { shape: 'cuboid', parameters: [ 0.25 * sc, 2.05 * sc, 0.25 * sc ], position: { x: 1.9 * sc, y: 2.05 * sc, z: 0 }, category: 'object' },
                    { shape: 'cuboid', parameters: [ 2.9 * sc, 2.0 * sc, 0.35 * sc ], position: { x: 0, y: 3.5 * sc, z: 0 }, category: 'object' },
                    { shape: 'cuboid', parameters: [ 0.2 * sc, 2.3 * sc, 0.2 * sc ], position: { x: -4.5 * sc, y: 2.3 * sc, z: 0 }, category: 'object' },
                    { shape: 'cuboid', parameters: [ 0.2 * sc, 2.3 * sc, 0.2 * sc ], position: { x: 4.5 * sc, y: 2.3 * sc, z: 0 }, category: 'object' },
                ]
            }
        )
    }

    _pick(event)
    {
        const camera = this.game.view?.camera
        if(!camera || !this.interactiveMeshes.length)
            return null

        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
        this._raycaster.setFromCamera(this._mouse, camera)
        const hits = this._raycaster.intersectObjects(this.interactiveMeshes)
        return hits.length > 0 ? hits[0].object : null
    }

    _getGlowMaterial(obj)
    {
        return obj.userData?.glowMaterial || obj.material
    }

    _setGlow(obj, value)
    {
        const material = this._getGlowMaterial(obj)
        if(material?.userData?.glow)
            material.userData.glow.value = value
    }

    _onPointerDown(event)
    {
        if(!event.isPrimary)
            return
        this._downPos.x = event.clientX
        this._downPos.y = event.clientY
    }

    _onPointerUp(event)
    {
        if(!event.isPrimary)
            return

        // Ignorar si fue un arrastre de cámara
        if(Math.hypot(event.clientX - this._downPos.x, event.clientY - this._downPos.y) > 6)
            return

        const hitObj = this._pick(event)
        if(!hitObj)
            return

        const action = hitObj.userData?.actionType
        const project = PROJECTS_DATA[this.currentIndex]

        // Destello rápido al presionar
        this._setGlow(hitObj, 2.4)
        setTimeout(() => this._setGlow(hitObj, 1), 150)

        if(action === 'next')
        {
            this.currentIndex = (this.currentIndex + 1) % PROJECTS_DATA.length
            this._updateProjectCanvas()
        }
        else if(action === 'prev')
        {
            this.currentIndex = (this.currentIndex - 1 + PROJECTS_DATA.length) % PROJECTS_DATA.length
            this._updateProjectCanvas()
        }
        else if(action === 'demo' && project?.webLink)
        {
            window.open(project.webLink, '_blank')
        }
        else if(action === 'code' && project?.codeLink)
        {
            window.open(project.codeLink, '_blank')
        }
    }

    _onPointerMove(event)
    {
        const hitObj = this._pick(event)

        if(hitObj)
        {
            if(this._hoveredObj !== hitObj)
            {
                if(this._hoveredObj)
                    this._setGlow(this._hoveredObj, 1)

                this._hoveredObj = hitObj
                document.body.style.cursor = 'pointer'
                this._setGlow(hitObj, 1.6)
            }
        }
        else if(this._hoveredObj)
        {
            this._setGlow(this._hoveredObj, 1)
            this._hoveredObj = null
            document.body.style.cursor = 'auto'
        }
    }

    update(t = 0)
    {
        for(const item of this.swingGroups)
        {
            item.group.rotation.z = Math.sin(t * 1.2 + item.phase) * 0.05
            item.group.rotation.x = Math.sin(t * 0.9 + item.phase) * 0.015
        }

        if(this.leftArrow)
            this.leftArrow.position.y = 1.85 + Math.sin(t * 1.8) * 0.03
        if(this.rightArrow)
            this.rightArrow.position.y = 1.85 + Math.sin(t * 1.8 + 1) * 0.03
    }
}
