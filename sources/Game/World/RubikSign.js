import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { InteractivePoints } from '../InteractivePoints.js'

// ==========================================
// PALETA DE COLORES DE NEÓN (Fiel a la referencia)
// ==========================================
const NEON_PALETTE = {
    RED:      { hex: 0xff3b30, core: '#ffd5d2', main: '#ff3b30', dark: '#3d1414' },
    GREEN:    { hex: 0x10e868, core: '#d4ffe6', main: '#10e868', dark: '#113823' },
    BLUE:     { hex: 0x00a8ff, core: '#d6f3ff', main: '#00a8ff', dark: '#102c44' },
    DEEPBLUE: { hex: 0x0066ff, core: '#cce0ff', main: '#0077ff', dark: '#0d2142' },
    YELLOW:   { hex: 0xffd000, core: '#fff8cc', main: '#ffd000', dark: '#423712' },
    ORANGE:   { hex: 0xff7300, core: '#ffe4cc', main: '#ff7300', dark: '#422410' },
    WHITE:    { hex: 0xf5f9ff, core: '#ffffff', main: '#e2eeff', dark: '#35383f' },
    ARROW:    { hex: 0xffae00, core: '#fff3b8', main: '#ff9d00', dark: '#4d2c12' }
}

const COLOR_KEYS = ['RED', 'GREEN', 'BLUE', 'DEEPBLUE', 'YELLOW', 'ORANGE', 'WHITE']

const INITIAL_FACE_COLORS = {
    top: [
        'RED',   'GREEN', 'YELLOW',
        'GREEN', 'WHITE', 'BLUE',
        'BLUE',  'YELLOW','RED'
    ],
    left: [
        'RED',      'BLUE',  'ORANGE',
        'DEEPBLUE', 'GREEN', 'GREEN',
        'WHITE',    'RED',   'YELLOW'
    ],
    right: [
        'BLUE',   'GREEN',  'ORANGE',
        'ORANGE', 'YELLOW', 'WHITE',
        'RED',    'BLUE',   'GREEN'
    ],
    backLeft: [
        'YELLOW', 'BLUE',   'RED',
        'GREEN',  'ORANGE', 'WHITE',
        'BLUE',   'GREEN',  'ORANGE'
    ],
    backRight: [
        'ORANGE', 'WHITE',  'GREEN',
        'RED',    'BLUE',   'YELLOW',
        'GREEN',  'ORANGE', 'WHITE'
    ],
    bottom: [
        'GREEN',  'RED',    'BLUE',
        'YELLOW', 'WHITE',  'ORANGE',
        'BLUE',   'GREEN',  'RED'
    ]
}

function createRoundedPolygonShape(points, radius)
{
    const shape = new THREE.Shape()
    const n = points.length

    for (let i = 0; i < n; i++)
    {
        const p0 = points[(i - 1 + n) % n]
        const p1 = points[i]
        const p2 = points[(i + 1) % n]

        const v1 = new THREE.Vector2(p0.x - p1.x, p0.y - p1.y)
        const v2 = new THREE.Vector2(p2.x - p1.x, p2.y - p1.y)
        const len1 = v1.length()
        const len2 = v2.length()
        v1.normalize()
        v2.normalize()

        const r = Math.min(radius, len1 * 0.45, len2 * 0.45)
        const startPt = new THREE.Vector2(p1.x + v1.x * r, p1.y + v1.y * r)
        const endPt = new THREE.Vector2(p1.x + v2.x * r, p1.y + v2.y * r)

        if (i === 0)
            shape.moveTo(startPt.x, startPt.y)
        else
            shape.lineTo(startPt.x, startPt.y)

        shape.quadraticCurveTo(p1.x, p1.y, endPt.x, endPt.y)
    }
    shape.closePath()
    return shape
}

function drawRoundedRectPath(ctx, x, y, w, h, r)
{
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

function createTileTexture(colorInfo)
{
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#1f2229'
    ctx.fillRect(0, 0, size, size)

    const centerGrad = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size*0.42)
    centerGrad.addColorStop(0, colorInfo.dark)
    centerGrad.addColorStop(0.68, colorInfo.main)
    centerGrad.addColorStop(1, '#111318')

    ctx.save()
    drawRoundedRectPath(ctx, 56, 56, size - 112, size - 112, 68)
    ctx.fillStyle = centerGrad
    ctx.fill()

    const innerShadow = ctx.createRadialGradient(size/2, size/2, size*0.02, size/2, size/2, size*0.35)
    innerShadow.addColorStop(0, 'rgba(15, 17, 22, 0.68)')
    innerShadow.addColorStop(0.75, 'rgba(15, 17, 22, 0.25)')
    innerShadow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = innerShadow
    ctx.fill()
    ctx.restore()

    ctx.save()
    drawRoundedRectPath(ctx, 48, 48, size - 96, size - 96, 76)
    ctx.strokeStyle = colorInfo.main
    ctx.lineWidth = 42
    ctx.shadowColor = colorInfo.main
    ctx.shadowBlur = 45
    ctx.stroke()
    ctx.restore()

    ctx.save()
    drawRoundedRectPath(ctx, 28, 28, size - 56, size - 56, 92)
    ctx.strokeStyle = '#121418'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.restore()

    ctx.save()
    drawRoundedRectPath(ctx, 48, 48, size - 96, size - 96, 76)
    ctx.strokeStyle = colorInfo.main
    ctx.lineWidth = 28
    ctx.shadowColor = colorInfo.main
    ctx.shadowBlur = 20
    ctx.stroke()
    ctx.restore()

    ctx.save()
    drawRoundedRectPath(ctx, 48, 48, size - 96, size - 96, 76)
    ctx.strokeStyle = colorInfo.core
    ctx.lineWidth = 12
    ctx.stroke()
    ctx.restore()

    ctx.save()
    drawRoundedRectPath(ctx, 66, 66, size - 132, size - 132, 58)
    ctx.strokeStyle = 'rgba(15, 17, 22, 0.75)'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.restore()

    const texture = new THREE.CanvasTexture(canvas)
    texture.anisotropy = 4
    texture.generateMipmaps = false
    return texture
}

export class RubikSign
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.position = options.position || new THREE.Vector3(25.28, 0, 65.82)
        this.rotationY = typeof options.rotationY !== 'undefined' ? options.rotationY : 0.35
        this.scale = options.scale || 0.95

        this.neonMode = 'steady' // 'steady', 'pulse', 'flicker', 'arcade'
        this.glowMultiplier = 1.0
        this.neonTiles = []
        this.comicOutlines = []
        this.arrowNeonObj = null

        this.setGroup()
        this.buildNeonRubikCube()
        this.buildNeonArrowSign()
        this.buildSupportPost()
        this.setPhysical()
        this.setInteractivePoint()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }

    setGroup()
    {
        this.group = new THREE.Group()
        this.group.position.copy(this.position)
        // Elevar para que la base del poste toque el suelo perfectamente
        this.group.position.y += 3.2
        this.group.rotation.y = this.rotationY
        this.group.scale.setScalar(this.scale)

        this.game.scene.add(this.group)
    }

    addComicEdges(mesh, thresholdAngle = 20, hexColor = 0x0d0f12)
    {
        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle)
        const edgesMat = new THREE.LineBasicMaterial({
            color: hexColor,
            transparent: true,
            opacity: 0.85
        })
        const lineSegments = new THREE.LineSegments(edgesGeo, edgesMat)
        mesh.add(lineSegments)
        this.comicOutlines.push(lineSegments)
    }

    buildNeonRubikCube()
    {
        this.cubeGroup = new THREE.Group()
        this.cubeGroup.position.set(0, 1.55, 0)
        this.group.add(this.cubeGroup)

        const cubeSize = 3.55
        const half = cubeSize / 2

        const casingMat = new THREE.MeshStandardMaterial({
            color: 0x2c3038,
            roughness: 0.42,
            metalness: 0.35
        })

        const innerCoreMat = new THREE.MeshStandardMaterial({
            color: 0x17191e,
            roughness: 0.6,
            metalness: 0.2
        })

        const coreGeo = new THREE.BoxGeometry(cubeSize * 0.96, cubeSize * 0.96, cubeSize * 0.96)
        const coreMesh = new THREE.Mesh(coreGeo, innerCoreMat)
        this.cubeGroup.add(coreMesh)

        const frameOuter = cubeSize / 2
        const frameInner = (cubeSize / 2) * 0.89
        const frameShape = createRoundedPolygonShape([
            { x: -frameOuter, y: -frameOuter },
            { x:  frameOuter, y: -frameOuter },
            { x:  frameOuter, y:  frameOuter },
            { x: -frameOuter, y:  frameOuter }
        ], 0.16)

        const holePath = createRoundedPolygonShape([
            { x: -frameInner, y: -frameInner },
            { x:  frameInner, y: -frameInner },
            { x:  frameInner, y:  frameInner },
            { x: -frameInner, y:  frameInner }
        ], 0.1)
        frameShape.holes.push(holePath)

        const frameExtrude = new THREE.ExtrudeGeometry(frameShape, {
            depth: 0.12,
            bevelEnabled: true,
            bevelThickness: 0.06,
            bevelSize: 0.06,
            bevelSegments: 2
        })

        const faceConfigs = [
            { name: 'top',       rot: [-Math.PI / 2, 0, 0], pos: [0, half - 0.06, 0] },
            { name: 'bottom',    rot: [ Math.PI / 2, 0, 0], pos: [0, -half + 0.06, 0] },
            { name: 'left',      rot: [0, 0, 0],            pos: [0, 0, half - 0.06] },
            { name: 'right',     rot: [0, Math.PI / 2, 0],  pos: [half - 0.06, 0, 0] },
            { name: 'backLeft',  rot: [0, -Math.PI / 2, 0], pos: [-half + 0.06, 0, 0] },
            { name: 'backRight', rot: [0, Math.PI, 0],      pos: [0, 0, -half + 0.06] }
        ]

        faceConfigs.forEach(fc =>
        {
            const faceHolder = new THREE.Group()
            faceHolder.position.set(...fc.pos)
            faceHolder.rotation.set(...fc.rot)
            this.cubeGroup.add(faceHolder)

            const frameMesh = new THREE.Mesh(frameExtrude, casingMat)
            frameMesh.position.z = -0.04
            faceHolder.add(frameMesh)
            this.addComicEdges(frameMesh, 22, 0x0d0f12)

            const plateGeo = new THREE.PlaneGeometry(cubeSize * 0.94, cubeSize * 0.94)
            const plateMesh = new THREE.Mesh(plateGeo, innerCoreMat)
            plateMesh.position.z = 0.01
            faceHolder.add(plateMesh)

            const gridSpan = cubeSize * 0.85
            const cellStep = gridSpan / 3
            const tileSize = cellStep * 0.95

            const colorsForFace = INITIAL_FACE_COLORS[fc.name]

            for (let row = 0; row < 3; row++)
            {
                for (let col = 0; col < 3; col++)
                {
                    const idx = row * 3 + col
                    const colorKey = colorsForFace[idx]

                    if (fc.name === 'bottom' && row === 1 && col === 1) continue

                    const x = (col - 1) * cellStep
                    const y = (1 - row) * cellStep

                    const tileObj = this.createNeonCubeTile(tileSize, colorKey, fc.name, idx)
                    tileObj.group.position.set(x, y, 0.03)
                    faceHolder.add(tileObj.group)
                    this.neonTiles.push(tileObj)
                }
            }
        })
    }

    createNeonCubeTile(size, colorKey, faceName, index)
    {
        const group = new THREE.Group()
        const colorInfo = NEON_PALETTE[colorKey]

        const tex = createTileTexture(colorInfo)
        const planeGeo = new THREE.PlaneGeometry(size, size)
        const planeMat = new THREE.MeshBasicMaterial({
            map: tex
        })
        const planeMesh = new THREE.Mesh(planeGeo, planeMat)
        group.add(planeMesh)

        const outerR = size * 0.43
        const innerR = size * 0.34
        const tubeShape = createRoundedPolygonShape([
            { x: -outerR, y: -outerR },
            { x:  outerR, y: -outerR },
            { x:  outerR, y:  outerR },
            { x: -outerR, y:  outerR }
        ], size * 0.14)

        const tubeHole = createRoundedPolygonShape([
            { x: -innerR, y: -innerR },
            { x:  innerR, y: -innerR },
            { x:  innerR, y:  innerR },
            { x: -innerR, y:  innerR }
        ], size * 0.10)
        tubeShape.holes.push(tubeHole)

        const tubeGeo = new THREE.ExtrudeGeometry(tubeShape, {
            depth: 0.045,
            bevelEnabled: true,
            bevelThickness: 0.025,
            bevelSize: 0.02,
            bevelSegments: 3
        })

        const tubeMat = new THREE.MeshStandardMaterial({
            color: colorInfo.hex,
            emissive: colorInfo.hex,
            emissiveIntensity: 0.95,
            roughness: 0.15,
            metalness: 0.05
        })

        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat)
        tubeMesh.position.z = 0.01
        group.add(tubeMesh)

        const haloGeo = new THREE.PlaneGeometry(size * 1.18, size * 1.18)
        const haloMat = new THREE.MeshBasicMaterial({
            color: colorInfo.hex,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
        const haloMesh = new THREE.Mesh(haloGeo, haloMat)
        haloMesh.position.z = 0.05
        group.add(haloMesh)

        const tileData = {
            group,
            planeMesh,
            tubeMesh,
            haloMesh,
            colorKey,
            initialColorKey: colorKey,
            faceName,
            index,
            phase: Math.random() * Math.PI * 2
        }

        planeMesh.userData.tileRef = tileData
        tubeMesh.userData.tileRef = tileData

        return tileData
    }

    setTileColor(tile, newColorKey)
    {
        tile.colorKey = newColorKey
        const colorInfo = NEON_PALETTE[newColorKey]

        if (tile.planeMesh.material.map)
        {
            tile.planeMesh.material.map.dispose()
        }
        tile.planeMesh.material.map = createTileTexture(colorInfo)
        tile.planeMesh.material.needsUpdate = true

        tile.tubeMesh.material.color.setHex(colorInfo.hex)
        tile.tubeMesh.material.emissive.setHex(colorInfo.hex)
        tile.haloMesh.material.color.setHex(colorInfo.hex)
    }

    buildNeonArrowSign()
    {
        this.arrowGroup = new THREE.Group()
        this.arrowGroup.position.set(0, -1.38, 0.18)
        this.arrowGroup.rotation.y = 0.18
        this.group.add(this.arrowGroup)

        const outerPts = [
            { x: -1.62, y:  0.00 },
            { x: -0.08, y:  1.12 },
            { x:  0.14, y:  0.96 },
            { x:  0.08, y:  0.56 },
            { x:  1.42, y:  0.56 },
            { x:  1.42, y: -0.56 },
            { x:  0.08, y: -0.56 },
            { x:  0.14, y: -0.96 },
            { x: -0.08, y: -1.12 }
        ]

        const housingShape = createRoundedPolygonShape(outerPts, 0.22)
        const housingGeo = new THREE.ExtrudeGeometry(housingShape, {
            depth: 0.56,
            bevelEnabled: true,
            bevelThickness: 0.10,
            bevelSize: 0.09,
            bevelSegments: 3
        })
        housingGeo.center()

        const housingMat = new THREE.MeshStandardMaterial({
            color: 0x363233,
            roughness: 0.45,
            metalness: 0.3
        })

        const housingMesh = new THREE.Mesh(housingGeo, housingMat)
        this.arrowGroup.add(housingMesh)
        this.addComicEdges(housingMesh, 20, 0x0f1014)

        const arrowInnerPts = [
            { x: -1.32, y:  0.00 },
            { x: -0.04, y:  0.86 },
            { x: -0.04, y:  0.38 },
            { x:  1.18, y:  0.38 },
            { x:  1.18, y: -0.38 },
            { x: -0.04, y: -0.38 },
            { x: -0.04, y: -0.86 }
        ]

        const arrowHolePts = [
            { x: -1.04, y:  0.00 },
            { x: -0.20, y:  0.56 },
            { x: -0.20, y:  0.22 },
            { x:  0.98, y:  0.22 },
            { x:  0.98, y: -0.22 },
            { x: -0.20, y: -0.22 },
            { x: -0.20, y: -0.56 }
        ]

        const neonArrowShape = createRoundedPolygonShape(arrowInnerPts, 0.14)
        const neonArrowHole = createRoundedPolygonShape(arrowHolePts, 0.08)
        neonArrowShape.holes.push(neonArrowHole)

        const recessedShape = createRoundedPolygonShape(arrowInnerPts, 0.14)
        const recessedGeo = new THREE.ShapeGeometry(recessedShape)
        const recessedMat = new THREE.MeshBasicMaterial({
            color: 0x784421
        })

        const arrowTubeGeo = new THREE.ExtrudeGeometry(neonArrowShape, {
            depth: 0.08,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.035,
            bevelSegments: 3
        })

        const arrowTubeMat = new THREE.MeshStandardMaterial({
            color: 0xffd000,
            emissive: 0xff9900,
            emissiveIntensity: 1.25,
            roughness: 0.1,
            metalness: 0.0
        })

        const arrowCoreGeo = new THREE.ExtrudeGeometry(neonArrowShape, {
            depth: 0.095,
            bevelEnabled: false
        })
        const arrowCoreMat = new THREE.MeshBasicMaterial({
            color: 0xfff3b0
        })

        const glowShape = createRoundedPolygonShape(outerPts, 0.25)
        const glowGeo = new THREE.ShapeGeometry(glowShape)
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.26,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })

        ;[1, -1].forEach(dir =>
        {
            const sideGroup = new THREE.Group()
            sideGroup.position.z = dir * 0.34
            if (dir === -1) sideGroup.rotation.y = Math.PI
            this.arrowGroup.add(sideGroup)

            const recMesh = new THREE.Mesh(recessedGeo, recessedMat)
            recMesh.position.z = 0.01
            sideGroup.add(recMesh)

            const tubeMesh = new THREE.Mesh(arrowTubeGeo, arrowTubeMat)
            tubeMesh.position.z = 0.015
            sideGroup.add(tubeMesh)

            const coreMesh = new THREE.Mesh(arrowCoreGeo, arrowCoreMat)
            coreMesh.scale.set(0.985, 0.985, 1)
            coreMesh.position.z = 0.02
            sideGroup.add(coreMesh)

            const glowMesh = new THREE.Mesh(glowGeo, glowMat)
            glowMesh.scale.set(0.92, 0.92, 1)
            glowMesh.position.z = 0.07
            sideGroup.add(glowMesh)
        })

        const arrowLight = new THREE.PointLight(0xff9900, 1.4, 6.0)
        arrowLight.position.set(-0.2, 0, 1.1)
        this.arrowGroup.add(arrowLight)

        this.arrowNeonObj = {
            tubeMat: arrowTubeMat,
            glowMat: glowMat,
            light: arrowLight
        }
    }

    buildSupportPost()
    {
        this.postGroup = new THREE.Group()
        this.group.add(this.postGroup)

        const postShape = createRoundedPolygonShape([
            { x: -0.34, y: -0.34 },
            { x:  0.34, y: -0.34 },
            { x:  0.34, y:  0.34 },
            { x: -0.34, y:  0.34 }
        ], 0.08)

        const postGeo = new THREE.ExtrudeGeometry(postShape, {
            depth: 3.3,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.04,
            bevelSegments: 2
        })

        const postMat = new THREE.MeshStandardMaterial({
            color: 0x353942,
            roughness: 0.5,
            metalness: 0.4
        })

        const postMesh = new THREE.Mesh(postGeo, postMat)
        postMesh.rotation.x = Math.PI / 2
        postMesh.position.set(0, 0.1, 0)
        this.postGroup.add(postMesh)
        this.addComicEdges(postMesh, 25, 0x0d0f12)

        const collarGeo = new THREE.BoxGeometry(0.95, 0.25, 0.95)
        const collarMesh = new THREE.Mesh(collarGeo, postMat)
        collarMesh.position.set(0, -0.25, 0)
        this.postGroup.add(collarMesh)
        this.addComicEdges(collarMesh, 20, 0x0d0f12)
    }

    setPhysical()
    {
        // Colisionador físico sólido en el poste
        this.game.objects.add(
            null,
            {
                type: 'fixed',
                position: { x: this.position.x, y: 1.6, z: this.position.z },
                colliders: [
                    { shape: 'cylinder', parameters: [ 1.8, 0.45 ], category: 'object' }
                ]
            }
        )
    }

    scrambleColors()
    {
        this.neonTiles.forEach(tile =>
        {
            const randomKey = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]
            this.setTileColor(tile, randomKey)
        })
    }

    cycleMode()
    {
        const modes = ['steady', 'pulse', 'arcade', 'flicker']
        const currentIdx = modes.indexOf(this.neonMode)
        this.neonMode = modes[(currentIdx + 1) % modes.length]
    }

    setInteractivePoint()
    {
        const pointPosition = new THREE.Vector3(
            this.position.x - 1.2,
            1.5,
            this.position.z - 1.2
        )

        this.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            'Cubo Neón (Mezclar)',
            InteractivePoints.ALIGN_CENTER,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                const clickSound = this.game.audio.groups.get('click')
                if(clickSound) clickSound.play(true)

                this.scrambleColors()
                this.cycleMode()

                // Animación de pulso visual al interactuar
                if(this.cubeGroup)
                {
                    this.cubeGroup.scale.set(1.06, 1.06, 1.06)
                    setTimeout(() => {
                        this.cubeGroup.scale.set(1, 1, 1)
                    }, 180)
                }
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
    }

    update()
    {
        const elapsed = this.game.ticker.elapsed

        // Efectos dinámicos de los tubos de neón según el modo activo
        this.neonTiles.forEach((tile, i) =>
        {
            let factor = 1.0

            if (this.neonMode === 'pulse')
            {
                factor = 0.75 + 0.35 * Math.sin(elapsed * 3.0 + tile.phase)
            }
            else if (this.neonMode === 'flicker')
            {
                if (i % 7 === 0)
                {
                    const noise = Math.sin(elapsed * 25 + i) * Math.cos(elapsed * 13)
                    factor = noise > 0.65 ? 0.35 : 1.0
                }
            }
            else if (this.neonMode === 'arcade')
            {
                factor = 0.6 + 0.55 * Math.sin(elapsed * 4.5 - (tile.index * 0.5))
            }

            const finalIntensity = factor * this.glowMultiplier
            tile.tubeMesh.material.emissiveIntensity = 0.95 * finalIntensity
            tile.haloMesh.material.opacity = Math.min(0.55, 0.18 * finalIntensity)
        })

        if (this.arrowNeonObj)
        {
            let arrowFactor = 1.0
            if (this.neonMode === 'pulse' || this.neonMode === 'arcade')
            {
                arrowFactor = 0.8 + 0.3 * Math.sin(elapsed * 3.5)
            }
            else if (this.neonMode === 'flicker')
            {
                arrowFactor = Math.sin(elapsed * 40) > 0.92 ? 0.5 : 1.0
            }
            const arrowIntensity = arrowFactor * this.glowMultiplier
            this.arrowNeonObj.tubeMat.emissiveIntensity = 1.25 * arrowIntensity
            this.arrowNeonObj.glowMat.opacity = Math.min(0.65, 0.26 * arrowIntensity)
            this.arrowNeonObj.light.intensity = 1.4 * arrowIntensity
        }
    }
}
