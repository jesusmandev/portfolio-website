import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

let cachedGrassTexture = null
let cachedBallTexture = null

function getGrassTexture(fieldLength, fieldWidth)
{
    if(cachedGrassTexture) return cachedGrassTexture

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')

    // Césped base con franjas alternadas
    context.fillStyle = '#388e3c'
    context.fillRect(0, 0, 512, 512)

    context.fillStyle = '#2e7d32'
    const stripeWidth = 64
    for(let i = 0; i < 512; i += stripeWidth * 2)
    {
        context.fillRect(i, 0, stripeWidth, 512)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(Math.round(fieldLength / 4), Math.round(fieldWidth / 4))
    texture.colorSpace = THREE.SRGBColorSpace
    cachedGrassTexture = texture
    return texture
}

function getSoccerBallTexture()
{
    if(cachedBallTexture) return cachedBallTexture

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // Fondo blanco
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, 256, 256)

    // Patrón clásico de pentágonos negros de balón de fútbol
    ctx.fillStyle = '#1a1a1a'
    const drawPentagon = (cx, cy, r) =>
    {
        ctx.beginPath()
        for(let i = 0; i < 5; i++)
        {
            const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
            const x = cx + r * Math.cos(a)
            const y = cy + r * Math.sin(a)
            if(i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
    }

    const spots = [
        [64, 64], [192, 64], [128, 128], [64, 192], [192, 192],
        [0, 128], [256, 128], [128, 0], [128, 256]
    ]
    for(const [sx, sy] of spots)
    {
        drawPentagon(sx, sy, 22)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    cachedBallTexture = texture
    return texture
}

export class SoccerField
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.x = options.x ?? -19.0
        this.y = options.y ?? 0.04
        this.z = options.z ?? -5.0
        this.fieldLength = options.fieldLength ?? 32.0
        this.fieldWidth = options.fieldWidth ?? 20.5
        this.rotationY = options.rotationY ?? 0

        // Factores de escala relativos a cancha reglamentaria (105x68)
        this.scaleX = this.fieldLength / 105
        this.scaleZ = this.fieldWidth / 68

        this.colliders = []

        this.group = new THREE.Group()
        this.group.name = 'SoccerField'
        this.group.position.set(this.x, this.y, this.z)
        if(this.rotationY) this.group.rotation.y = this.rotationY

        this._build()
        this._buildGoalsAndPhysics()
        this._buildBall()

        this.game.scene.add(this.group)

        // Verificación de gol en cada tick
        this._onTick = this._onTick.bind(this)
        this.game.ticker.events.on('tick', this._onTick, 5)
    }

    _build()
    {
        const fieldLength = this.fieldLength
        const fieldWidth  = this.fieldWidth
        const lineWidth   = 0.18

        // 1. Césped de la cancha
        const grassTexture = getGrassTexture(fieldLength, fieldWidth)
        const fieldGeometry = new THREE.PlaneGeometry(fieldLength, fieldWidth)
        const fieldMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.85,
            metalness: 0.05
        })
        
        const field = new THREE.Mesh(fieldGeometry, fieldMaterial)
        field.rotation.x = -Math.PI / 2
        field.position.y = 0.015
        field.receiveShadow = true
        this.group.add(field)

        // 2. Borde exterior verde oscuro
        const borderGeometry = new THREE.PlaneGeometry(fieldLength + 2.5, fieldWidth + 2.2)
        const borderMaterial = new THREE.MeshStandardMaterial({
            color: 0x1b5e20,
            roughness: 0.9
        })
        const border = new THREE.Mesh(borderGeometry, borderMaterial)
        border.rotation.x = -Math.PI / 2
        border.position.y = 0.008
        border.receiveShadow = true
        this.group.add(border)

        // 3. Líneas y demarcaciones blancas
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })

        const createLine = (w, h, lx, lz) =>
        {
            const geom = new THREE.PlaneGeometry(w, h)
            const line = new THREE.Mesh(geom, lineMaterial)
            line.rotation.x = -Math.PI / 2
            line.position.set(lx, 0.022, lz)
            this.group.add(line)
            return line
        }

        // Líneas perimetrales
        createLine(fieldLength + lineWidth, lineWidth, 0, fieldWidth / 2)
        createLine(fieldLength + lineWidth, lineWidth, 0, -fieldWidth / 2)
        createLine(lineWidth, fieldWidth - lineWidth, fieldLength / 2, 0)
        createLine(lineWidth, fieldWidth - lineWidth, -fieldLength / 2, 0)

        // Línea central
        createLine(lineWidth, fieldWidth - lineWidth, 0, 0)

        // Círculo central
        const centerRadius = (fieldWidth / 13) * 2.5
        const circleGeometry = new THREE.RingGeometry(centerRadius, centerRadius + lineWidth, 48)
        const circle = new THREE.Mesh(circleGeometry, lineMaterial)
        circle.rotation.x = -Math.PI / 2
        circle.position.y = 0.022
        this.group.add(circle)

        // Punto central
        const dotGeom = new THREE.CircleGeometry(0.24, 24)
        const dot = new THREE.Mesh(dotGeom, lineMaterial)
        dot.rotation.x = -Math.PI / 2
        dot.position.y = 0.022
        this.group.add(dot)

        // Puntos penales
        const penaltyDistance = (fieldLength / 22) * 3.0
        const leftPenaltyDot = new THREE.Mesh(dotGeom, lineMaterial)
        leftPenaltyDot.rotation.x = -Math.PI / 2
        leftPenaltyDot.position.set(-fieldLength / 2 + penaltyDistance, 0.022, 0)
        this.group.add(leftPenaltyDot)

        const rightPenaltyDot = new THREE.Mesh(dotGeom, lineMaterial)
        rightPenaltyDot.rotation.x = -Math.PI / 2
        rightPenaltyDot.position.set(fieldLength / 2 - penaltyDistance, 0.022, 0)
        this.group.add(rightPenaltyDot)

        // Áreas de penalti
        const penAreaW = (fieldWidth / 13) * 7.2
        const penAreaD = (fieldLength / 22) * 4.5
        const pLen = penAreaD
        const pCZ = penAreaW / 2
        const pCXLeft = -fieldLength / 2 + penAreaD / 2
        const pCXRight = fieldLength / 2 - penAreaD / 2

        createLine(pLen, lineWidth, pCXLeft, pCZ)
        createLine(pLen, lineWidth, pCXLeft, -pCZ)
        createLine(lineWidth, penAreaW, -fieldLength / 2 + penAreaD, 0)

        createLine(pLen, lineWidth, pCXRight, pCZ)
        createLine(pLen, lineWidth, pCXRight, -pCZ)
        createLine(lineWidth, penAreaW, fieldLength / 2 - penAreaD, 0)

        // Áreas de meta chicas
        const goalAreaW = (fieldWidth / 13) * 4.2
        const goalAreaD = (fieldLength / 22) * 1.8
        createLine(goalAreaD, lineWidth, -fieldLength / 2 + goalAreaD / 2, goalAreaW / 2)
        createLine(goalAreaD, lineWidth, -fieldLength / 2 + goalAreaD / 2, -goalAreaW / 2)
        createLine(lineWidth, goalAreaW, -fieldLength / 2 + goalAreaD, 0)

        createLine(goalAreaD, lineWidth, fieldLength / 2 - goalAreaD / 2, goalAreaW / 2)
        createLine(goalAreaD, lineWidth, fieldLength / 2 - goalAreaD / 2, -goalAreaW / 2)
        createLine(lineWidth, goalAreaW, fieldLength / 2 - goalAreaD, 0)

        // Banderines de tiro de esquina
        const createCornerFlag = (fx, fz) =>
        {
            const flagGroup = new THREE.Group()
            
            const poleGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8)
            const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
            const pole = new THREE.Mesh(poleGeom, poleMat)
            pole.position.y = 0.7
            pole.castShadow = true
            flagGroup.add(pole)

            const clothGeom = new THREE.PlaneGeometry(0.38, 0.28)
            const clothMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide })
            const cloth = new THREE.Mesh(clothGeom, clothMat)
            cloth.position.set(0.19, 1.25, 0)
            flagGroup.add(cloth)

            flagGroup.position.set(fx, 0.02, fz)
            this.group.add(flagGroup)
        }

        createCornerFlag(-fieldLength / 2, -fieldWidth / 2)
        createCornerFlag(-fieldLength / 2,  fieldWidth / 2)
        createCornerFlag( fieldLength / 2, -fieldWidth / 2)
        createCornerFlag( fieldLength / 2,  fieldWidth / 2)
    }

    _buildGoalsAndPhysics()
    {
        const fieldLength = this.fieldLength
        const goalWidth     = 6.2
        const goalHeight    = 2.65
        const goalDepth     = 1.9
        const postThickness = 0.16
        const goalMaterial  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })

        this.goalWidth = goalWidth
        this.goalHeight = goalHeight

        const createGoal = (xPos, rotationY) =>
        {
            const goalGroup = new THREE.Group()

            // Postes principales
            const postGeom = new THREE.BoxGeometry(postThickness, goalHeight, postThickness)
            
            const leftPost = new THREE.Mesh(postGeom, goalMaterial)
            leftPost.position.set(0, goalHeight / 2, goalWidth / 2)
            leftPost.castShadow = true
            goalGroup.add(leftPost)

            const rightPost = new THREE.Mesh(postGeom, goalMaterial)
            rightPost.position.set(0, goalHeight / 2, -goalWidth / 2)
            rightPost.castShadow = true
            goalGroup.add(rightPost)

            // Travesaño
            const crossbarGeom = new THREE.BoxGeometry(postThickness, postThickness, goalWidth + postThickness)
            const crossbar = new THREE.Mesh(crossbarGeom, goalMaterial)
            crossbar.position.set(0, goalHeight, 0)
            crossbar.castShadow = true
            goalGroup.add(crossbar)

            // Estructura trasera de la red
            const depthBarGeom = new THREE.BoxGeometry(goalDepth, postThickness, postThickness)
            
            const topLeftDepth = new THREE.Mesh(depthBarGeom, goalMaterial)
            topLeftDepth.position.set(-goalDepth / 2, goalHeight, goalWidth / 2)
            goalGroup.add(topLeftDepth)

            const topRightDepth = new THREE.Mesh(depthBarGeom, goalMaterial)
            topRightDepth.position.set(-goalDepth / 2, goalHeight, -goalWidth / 2)
            goalGroup.add(topRightDepth)

            const backTopCrossbar = new THREE.Mesh(crossbarGeom, goalMaterial)
            backTopCrossbar.position.set(-goalDepth, goalHeight, 0)
            goalGroup.add(backTopCrossbar)

            const botLeftDepth = new THREE.Mesh(depthBarGeom, goalMaterial)
            botLeftDepth.position.set(-goalDepth / 2, postThickness / 2, goalWidth / 2)
            goalGroup.add(botLeftDepth)

            const botRightDepth = new THREE.Mesh(depthBarGeom, goalMaterial)
            botRightDepth.position.set(-goalDepth / 2, postThickness / 2, -goalWidth / 2)
            goalGroup.add(botRightDepth)
            
            const backBotCrossbar = new THREE.Mesh(crossbarGeom, goalMaterial)
            backBotCrossbar.position.set(-goalDepth, postThickness / 2, 0)
            goalGroup.add(backBotCrossbar)

            const backPostGeom = new THREE.BoxGeometry(postThickness, goalHeight, postThickness)
            const backLeftPost = new THREE.Mesh(backPostGeom, goalMaterial)
            backLeftPost.position.set(-goalDepth, goalHeight / 2, goalWidth / 2)
            goalGroup.add(backLeftPost)

            const backRightPost = new THREE.Mesh(backPostGeom, goalMaterial)
            backRightPost.position.set(-goalDepth, goalHeight / 2, -goalWidth / 2)
            goalGroup.add(backRightPost)

            // Red de la portería
            const netMaterial = new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.65 })
            
            const createNetGrid = (w, h, rotX, rotY, rotZ, nx, ny, nz) =>
            {
                const step = 0.28
                const points = []
                const xmin = -w / 2, xmax = w / 2
                const ymin = -h / 2, ymax = h / 2
                
                for(let c = ymin - xmax; c <= ymax - xmin; c += step)
                {
                    const pts = []
                    const y_xmin = xmin + c; if(y_xmin >= ymin && y_xmin <= ymax) pts.push({ x: xmin, y: y_xmin })
                    const y_xmax = xmax + c; if(y_xmax >= ymin && y_xmax <= ymax) pts.push({ x: xmax, y: y_xmax })
                    const x_ymin = ymin - c; if(x_ymin > xmin && x_ymin < xmax) pts.push({ x: x_ymin, y: ymin })
                    const x_ymax = ymax - c; if(x_ymax > xmin && x_ymax < xmax) pts.push({ x: x_ymax, y: ymax })

                    if(pts.length === 2)
                    {
                        points.push(new THREE.Vector3(pts[0].x, pts[0].y, 0))
                        points.push(new THREE.Vector3(pts[1].x, pts[1].y, 0))
                    }
                }

                for(let k = ymin + xmin; k <= ymax + xmax; k += step)
                {
                    const pts = []
                    const y_xmin = -xmin + k; if(y_xmin >= ymin && y_xmin <= ymax) pts.push({ x: xmin, y: y_xmin })
                    const y_xmax = -xmax + k; if(y_xmax >= ymin && y_xmax <= ymax) pts.push({ x: xmax, y: y_xmax })
                    const x_ymin = k - ymin; if(x_ymin > xmin && x_ymin < xmax) pts.push({ x: x_ymin, y: ymin })
                    const x_ymax = k - ymax; if(x_ymax > xmin && x_ymax < xmax) pts.push({ x: x_ymax, y: ymax })

                    if(pts.length === 2)
                    {
                        points.push(new THREE.Vector3(pts[0].x, pts[0].y, 0))
                        points.push(new THREE.Vector3(pts[1].x, pts[1].y, 0))
                    }
                }

                const geometry = new THREE.BufferGeometry().setFromPoints(points)
                const lineSegments = new THREE.LineSegments(geometry, netMaterial)
                lineSegments.rotation.set(rotX, rotY, rotZ)
                lineSegments.position.set(nx, ny, nz)
                return lineSegments
            }

            const backNet  = createNetGrid(goalWidth, goalHeight, 0, Math.PI / 2, 0, -goalDepth, goalHeight / 2, 0)
            const topNet   = createNetGrid(goalWidth, goalDepth, Math.PI / 2, 0, Math.PI / 2, -goalDepth / 2, goalHeight, 0)
            const leftNet  = createNetGrid(goalDepth, goalHeight, 0, 0, 0, -goalDepth / 2, goalHeight / 2, goalWidth / 2)
            const rightNet = createNetGrid(goalDepth, goalHeight, 0, 0, 0, -goalDepth / 2, goalHeight / 2, -goalWidth / 2)

            goalGroup.add(backNet, topNet, leftNet, rightNet)
            goalGroup.position.set(xPos, 0, 0)
            if(rotationY) goalGroup.rotation.y = rotationY

            this.group.add(goalGroup)

            // Colisionadores físicos estáticos con Rapier
            const worldPostX = this.x + xPos
            const worldPostZ = this.z
            const hw = postThickness / 2
            const hh = goalHeight / 2

            // Poste izquierdo
            this.game.objects.add(null, {
                type: 'fixed',
                position: new THREE.Vector3(worldPostX, this.y + hh, worldPostZ + goalWidth / 2),
                colliders: [ { shape: 'cuboid', parameters: [ hw, hh, hw ], category: 'object' } ],
                onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
            })

            // Poste derecho
            this.game.objects.add(null, {
                type: 'fixed',
                position: new THREE.Vector3(worldPostX, this.y + hh, worldPostZ - goalWidth / 2),
                colliders: [ { shape: 'cuboid', parameters: [ hw, hh, hw ], category: 'object' } ],
                onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
            })

            // Travesaño superior
            this.game.objects.add(null, {
                type: 'fixed',
                position: new THREE.Vector3(worldPostX, this.y + goalHeight, worldPostZ),
                colliders: [ { shape: 'cuboid', parameters: [ hw, hw, goalWidth / 2 ], category: 'object' } ],
                onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
            })

            // Red trasera (bloqueo físico para que el balón quede contenido dentro del arco)
            const backX = worldPostX + (xPos < 0 ? -goalDepth : goalDepth)
            this.game.objects.add(null, {
                type: 'fixed',
                position: new THREE.Vector3(backX, this.y + hh, worldPostZ),
                colliders: [ { shape: 'cuboid', parameters: [ hw, hh, goalWidth / 2 ], category: 'object' } ],
                onCollision: (force, pos) => this.game.audio.groups.get('hitDefault')?.playRandomNext(force, pos)
            })
        }

        // Portería izquierda (mira hacia el centro) y portería derecha (mira hacia el centro)
        createGoal(-fieldLength / 2, 0)
        createGoal(fieldLength / 2, Math.PI)
    }

    _buildBall()
    {
        const ballRadius = 0.46
        const ballGeo = new THREE.SphereGeometry(ballRadius, 24, 24)
        const ballTexture = getSoccerBallTexture()
        const ballMat = new THREE.MeshStandardMaterial({
            map: ballTexture,
            roughness: 0.4,
            metalness: 0.05
        })

        const ballMesh = new THREE.Mesh(ballGeo, ballMat)
        ballMesh.castShadow = true
        ballMesh.receiveShadow = true

        // Balón dinámico físico kickeable con Rapier
        this.ballPhysical = this.game.objects.add(
            ballMesh,
            {
                type: 'dynamic',
                position: new THREE.Vector3(this.x, this.y + ballRadius + 0.05, this.z),
                friction: 0.6,
                restitution: 0.85, // Alto rebote divertido
                mass: 0.04,
                colliders: [ { shape: 'ball', parameters: [ ballRadius ], category: 'object' } ],
                onCollision: (force, position) =>
                {
                    this.game.audio.groups.get('hitDefault')?.playRandomNext(force, position)
                }
            }
        )
    }

    _onTick()
    {
        if(!this.ballPhysical || !this.ballPhysical.body) return

        const ballPos = this.ballPhysical.body.translation()
        const fieldLength = this.fieldLength
        const goalHalfW = this.goalWidth / 2

        // Verificar gol en la portería izquierda o derecha
        const leftGoalX = this.x - fieldLength / 2
        const rightGoalX = this.x + fieldLength / 2
        const inGoalZ = Math.abs(ballPos.z - this.z) < goalHalfW
        const inGoalY = ballPos.y < this.y + this.goalHeight

        const isLeftGoal = inGoalZ && inGoalY && ballPos.x < leftGoalX && ballPos.x > leftGoalX - 2.0
        const isRightGoal = inGoalZ && inGoalY && ballPos.x > rightGoalX && ballPos.x < rightGoalX + 2.0

        if((isLeftGoal || isRightGoal) && !this.goalCelebrationActive)
        {
            this.goalCelebrationActive = true

            // Disparar confeti 3D celebratorio en el arco
            if(this.game.world.confetti)
            {
                const goalPos = new THREE.Vector3(
                    isLeftGoal ? leftGoalX : rightGoalX,
                    this.y + 1.2,
                    this.z
                )
                this.game.world.confetti.pop(goalPos, 5, 7)
            }

            // Reproducir sonido celebratorio
            this.game.audio.groups.get('jingleBells')?.playRandomNext()

            // Reponer el balón en el centro tras 2.5 segundos
            setTimeout(() =>
            {
                if(this.ballPhysical && this.ballPhysical.body)
                {
                    this.ballPhysical.body.setTranslation(
                        { x: this.x, y: this.y + 0.5, z: this.z },
                        true
                    )
                    this.ballPhysical.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
                    this.ballPhysical.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
                }
                this.goalCelebrationActive = false
            }, 2500)
        }
    }
}
