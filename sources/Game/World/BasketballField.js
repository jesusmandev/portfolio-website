import * as THREE from 'three/webgpu'
import { color, texture, vec4 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

let cachedCourtWoodTex = null
let cachedBasketballTex = null

function getCourtWoodTexture()
{
    if(cachedCourtWoodTex)
        return cachedCourtWoodTex

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // Duela de madera cálida clásica (#dfb175) con listones sutiles
    ctx.fillStyle = '#dfb175'
    ctx.fillRect(0, 0, 512, 256)

    const plankH = 16
    for(let y = 0; y < 256; y += plankH)
    {
        const shade = ((y / plankH) % 3 === 0) ? '#d6a465' : (((y / plankH) % 2 === 0) ? '#e5ba80' : '#dfb175')
        ctx.fillStyle = shade
        ctx.fillRect(0, y, 512, plankH)

        // Junta horizontal sutil entre listones
        ctx.fillStyle = 'rgba(120, 74, 30, 0.14)'
        ctx.fillRect(0, y, 512, 1)

        // Juntas verticales escalonadas
        const offset = ((y / plankH) * 97) % 128
        for(let x = offset; x < 512; x += 128)
        {
            ctx.fillRect(x, y, 1, plankH)
        }
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(3, 3)
    cachedCourtWoodTex = tex
    return tex
}

function getBasketballTexture()
{
    if(cachedBasketballTex)
        return cachedBasketballTex

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')

    // Naranja clásico de balón de básquet
    ctx.fillStyle = '#ea580c'
    ctx.fillRect(0, 0, 256, 128)

    // Textura granulada sutil
    ctx.fillStyle = 'rgba(124, 45, 18, 0.22)'
    for(let i = 0; i < 650; i++)
    {
        ctx.fillRect((i * 47) % 256, (i * 29) % 128, 2, 2)
    }

    // Líneas negras características del balón
    ctx.strokeStyle = '#18181b'
    ctx.lineWidth = 4

    // Ecuador
    ctx.beginPath()
    ctx.moveTo(0, 64)
    ctx.lineTo(256, 64)
    ctx.stroke()

    // Meridianos principales
    ctx.beginPath()
    ctx.moveTo(64, 0)
    ctx.lineTo(64, 128)
    ctx.moveTo(192, 0)
    ctx.lineTo(192, 128)
    ctx.stroke()

    // Curvas laterales
    ctx.beginPath()
    ctx.ellipse(128, 64, 46, 52, 0, 0, Math.PI * 2)
    ctx.stroke()

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    cachedBasketballTex = tex
    return tex
}

export class BasketballField
{
    /**
     * Cancha de Baloncesto 3D (portada de frontend-portfolio al motor WebGPU/TSL de folio-2025)
     * @param {Object} [options]
     * @param {number} [options.x=-37.65] - Centro X (mitad de cancha)
     * @param {number} [options.y=0.04] - Altura base Y
     * @param {number} [options.z=-54.68] - Centro Z (mitad de cancha)
     * @param {number} [options.courtWidth=22.0] - Largo (eje X)
     * @param {number} [options.courtLength=12.5] - Ancho (eje Z)
     * @param {number} [options.basketHeight=5.2] - Altura de los postes
     * @param {number} [options.rotationY=0]
     */
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.x = options.x ?? -37.415
        this.y = options.y ?? 0.04
        this.z = options.z ?? -54.505
        this.courtWidth = options.courtWidth ?? 25.26
        this.courtLength = options.courtLength ?? 10.5
        this.basketHeight = options.basketHeight ?? 4.8
        this.rotationY = options.rotationY ?? -1.4789

        this.scaleX = this.courtWidth / 28
        this.scaleZ = this.courtLength / 15

        this.group = new THREE.Group()
        this.group.name = 'BasketballField'
        this.group.position.set(this.x, this.y, this.z)
        if(this.rotationY)
            this.group.rotation.y = this.rotationY

        this._build()
        this._buildBasketball()

        this.game.scene.add(this.group)
    }

    _build()
    {
        const W = this.courtWidth
        const L = this.courtLength
        const BH = this.basketHeight

        // ── 1. Borde exterior verde oscuro (Apron) ────────────────────────
        const apronMat = new MeshDefaultMaterial({
            colorNode: color(0x2d4735),
            hasCoreShadows: true,
            hasDropShadows: true
        })
        const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 2.4, L + 2.0), apronMat)
        apron.rotation.x = -Math.PI / 2
        apron.position.y = 0.01
        apron.receiveShadow = true
        this.group.add(apron)

        // ── 2. Superficie de madera (duela) ───────────────────────────────
        const courtMat = new MeshDefaultMaterial({
            colorNode: texture(getCourtWoodTexture()).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })
        const court = new THREE.Mesh(new THREE.PlaneGeometry(W, L), courtMat)
        court.rotation.x = -Math.PI / 2
        court.position.y = 0.02
        court.receiveShadow = true
        this.group.add(court)

        // ── 3. Líneas reglamentarias blancas ──────────────────────────────
        const lineMat = new MeshDefaultMaterial({
            colorNode: color(0xffffff),
            hasCoreShadows: false,
            hasDropShadows: true
        })
        const lineWidth = 0.14 * Math.min(this.scaleX, this.scaleZ)

        const addLine = (w, h, lx, lz) =>
        {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat)
            m.rotation.x = -Math.PI / 2
            m.position.set(lx, 0.032, lz)
            m.receiveShadow = true
            this.group.add(m)
        }

        // Líneas perimetrales
        addLine(W, lineWidth, 0, L / 2)
        addLine(W, lineWidth, 0, -L / 2)
        addLine(lineWidth, L, W / 2, 0)
        addLine(lineWidth, L, -W / 2, 0)
        // Línea central (pasa exactamente por x: -37.65, z: -54.68)
        addLine(lineWidth, L, 0, 0)

        // Círculo central
        const cr = 1.75 * Math.min(this.scaleX, this.scaleZ)
        const cRing = new THREE.Mesh(
            new THREE.RingGeometry(cr - lineWidth / 2, cr + lineWidth / 2, 48),
            lineMat
        )
        cRing.rotation.x = -Math.PI / 2
        cRing.position.y = 0.032
        cRing.receiveShadow = true
        this.group.add(cRing)

        // Áreas de pintura / zona restringida (Key area)
        const addKeyArea = (isRight) =>
        {
            const sign = isRight ? 1 : -1
            const kw = 4.9 * this.scaleZ
            const kl = 5.8 * this.scaleX
            const kCenterX = sign * (W / 2 - kl / 2)

            addLine(kl, lineWidth, kCenterX, kw / 2)
            addLine(kl, lineWidth, kCenterX, -kw / 2)
            addLine(lineWidth, kw, sign * (W / 2 - kl), 0)

            const ftr = 1.8 * this.scaleZ
            const ftRing = new THREE.Mesh(
                new THREE.RingGeometry(ftr - lineWidth / 2, ftr + lineWidth / 2, 32, 1, 0, Math.PI),
                lineMat
            )
            ftRing.rotation.x = -Math.PI / 2
            ftRing.rotation.z = isRight ? Math.PI / 2 : -Math.PI / 2
            ftRing.position.set(sign * (W / 2 - kl), 0.032, 0)
            ftRing.receiveShadow = true
            this.group.add(ftRing)
        }
        addKeyArea(true)
        addKeyArea(false)

        // Líneas de 3 puntos
        const add3ptLine = (isRight) =>
        {
            const sign = isRight ? 1 : -1
            const hoopX = sign * (W / 2 - 1.575 * this.scaleX)
            const radius = 6.75 * Math.min(this.scaleX, this.scaleZ)
            const zOff = Math.min(L / 2 - 0.25, 6.2 * this.scaleZ)
            const ratio = Math.min(1, Math.max(-1, zOff / radius))
            const angle = Math.asin(ratio)
            const tStart = isRight ? Math.PI - angle : Math.PI * 2 - angle

            const arc = new THREE.Mesh(
                new THREE.RingGeometry(radius - lineWidth / 2, radius + lineWidth / 2, 32, 1, tStart, angle * 2),
                lineMat
            )
            arc.rotation.x = -Math.PI / 2
            arc.position.set(hoopX, 0.032, 0)
            arc.receiveShadow = true
            this.group.add(arc)

            const dx = Math.cos(angle) * radius
            const exX = hoopX - sign * dx
            const sLen = Math.abs(sign * W / 2 - exX)
            const sCX = (sign * W / 2 + exX) / 2
            addLine(sLen, lineWidth, sCX, zOff)
            addLine(sLen, lineWidth, sCX, -zOff)
        }
        add3ptLine(true)
        add3ptLine(false)

        // ── 4. Sistemas de canasta (postes, tableros, aros y redes) ───────
        const poleMat = new MeshDefaultMaterial({
            colorNode: color(0x16181d),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const boardMat = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false
        })
        boardMat.outputNode = vec4(
            MeshDefaultMaterial.revealDiscardNodeBuilder(this.game, color(0xf8fafc)),
            0.82
        )

        const boardBorderMat = new MeshDefaultMaterial({
            colorNode: color(0xe2e8f0),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const redSquareMat = new MeshDefaultMaterial({
            colorNode: color(0xef4444),
            hasCoreShadows: false,
            hasDropShadows: false
        })

        const orangeMat = new MeshDefaultMaterial({
            colorNode: color(0xff4500),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const netMat = new THREE.MeshBasicNodeMaterial({
            wireframe: true
        })
        netMat.outputNode = vec4(
            MeshDefaultMaterial.revealDiscardNodeBuilder(this.game, color(0xf1f5f9)),
            1
        )

        const addHoopSystem = (isRight) =>
        {
            const sg = new THREE.Group()
            const sign = isRight ? 1 : -1

            const poleX = sign * (W / 2 + 1.05)
            const armY = BH
            const boardX = sign * (W / 2 - 0.95)
            const ringX = sign * (W / 2 - 1.38)

            // Poste cónico principal fuera de la línea de fondo
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, BH, 14), poleMat)
            pole.position.set(poleX, BH / 2, 0)
            pole.castShadow = true
            pole.receiveShadow = true
            sg.add(pole)

            // Brazo horizontal del poste hacia el tablero
            const armLen = Math.abs(poleX - boardX)
            const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.18, 0.18), poleMat)
            arm.position.set((poleX + boardX) / 2, armY, 0)
            arm.castShadow = true
            sg.add(arm)

            // Tablero traslúcido colgando del extremo del brazo
            const boardH = 1.35
            const boardZ = 1.95
            const boardCenterY = armY - boardH * 0.42
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.10, boardH, boardZ), boardMat)
            board.position.set(boardX, boardCenterY, 0)
            board.castShadow = true
            sg.add(board)

            // Marco perimetral fino del tablero
            const frameT = 0.055
            const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, frameT, boardZ + frameT), boardBorderMat)
            topBar.position.set(boardX, boardCenterY + boardH / 2, 0)
            const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, frameT, boardZ + frameT), boardBorderMat)
            botBar.position.set(boardX, boardCenterY - boardH / 2, 0)
            const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, boardH, frameT), boardBorderMat)
            leftBar.position.set(boardX, boardCenterY, -boardZ / 2)
            const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, boardH, frameT), boardBorderMat)
            rightBar.position.set(boardX, boardCenterY, boardZ / 2)
            sg.add(topBar, botBar, leftBar, rightBar)

            // Rectángulo rojo interior en el tablero (4 barras finas compatibles con WebGPU)
            const sqW = 0.62
            const sqH = 0.44
            const sqT = 0.032
            const sqX = boardX - sign * 0.058
            const sqY = boardCenterY - 0.12
            const sqTop = new THREE.Mesh(new THREE.BoxGeometry(0.015, sqT, sqW), redSquareMat)
            sqTop.position.set(sqX, sqY + sqH / 2, 0)
            const sqBot = new THREE.Mesh(new THREE.BoxGeometry(0.015, sqT, sqW), redSquareMat)
            sqBot.position.set(sqX, sqY - sqH / 2, 0)
            const sqL = new THREE.Mesh(new THREE.BoxGeometry(0.015, sqH, sqT), redSquareMat)
            sqL.position.set(sqX, sqY, -sqW / 2)
            const sqR = new THREE.Mesh(new THREE.BoxGeometry(0.015, sqH, sqT), redSquareMat)
            sqR.position.set(sqX, sqY, sqW / 2)
            sg.add(sqTop, sqBot, sqL, sqR)

            // Aro naranja
            const ringRadius = 0.34
            const ringY = boardCenterY - 0.42
            const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.032, 12, 24), orangeMat)
            ring.rotation.x = Math.PI / 2
            ring.position.set(ringX, ringY, 0)
            ring.castShadow = true
            sg.add(ring)

            // Soporte del aro al tablero
            const suppLen = Math.abs(boardX - ringX)
            const supp = new THREE.Mesh(new THREE.BoxGeometry(suppLen, 0.055, 0.09), orangeMat)
            supp.position.set((boardX + ringX) / 2, ringY, 0)
            sg.add(supp)

            // Red blanca en malla
            const net = new THREE.Mesh(
                new THREE.CylinderGeometry(ringRadius, ringRadius * 0.58, 0.68, 12, 4, true),
                netMat
            )
            net.position.set(ringX, ringY - 0.35, 0)
            sg.add(net)

            this.group.add(sg)

            // Colisionador físico Rapier para el poste de la canasta
            const cosR = Math.cos(this.rotationY)
            const sinR = Math.sin(this.rotationY)
            const worldPoleX = this.x + poleX * cosR
            const worldPoleZ = this.z - poleX * sinR

            this.game.objects.add(
                null,
                {
                    type: 'fixed',
                    position: { x: worldPoleX, y: this.y + BH / 2, z: worldPoleZ },
                    colliders: [
                        { shape: 'cylinder', parameters: [ BH / 2, 0.32 ], category: 'object' }
                    ]
                }
            )
        }

        addHoopSystem(true)
        addHoopSystem(false)
    }

    _buildBasketball()
    {
        const ballRadius = 0.36
        const ballGeo = new THREE.SphereGeometry(ballRadius, 20, 16)
        const ballMat = new MeshDefaultMaterial({
            colorNode: texture(getBasketballTexture()).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const ballMesh = new THREE.Mesh(ballGeo, ballMat)
        ballMesh.castShadow = true
        ballMesh.receiveShadow = true

        // Balón de básquet dinámico y rebotador en el círculo central
        this.ballObject = this.game.objects.add(
            {
                model: ballMesh,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true
            },
            {
                type: 'dynamic',
                position: { x: this.x, y: this.y + ballRadius + 0.06, z: this.z },
                friction: 0.55,
                restitution: 0.85,
                mass: 0.05,
                sleeping: true,
                waterGravityMultiplier: -1,
                contactThreshold: 4,
                colliders: [
                    { shape: 'ball', parameters: [ ballRadius ], category: 'object' }
                ],
                onCollision: (force, position) =>
                {
                    const hitSound = this.game.audio.groups.get('hitDefault')
                    if(hitSound)
                        hitSound.playRandomNext(force, position)
                }
            }
        )
    }
}
