import * as THREE from 'three/webgpu'
import { color, Fn, texture, uniform, uv, vec4 } from 'three/tsl'
import { InteractivePoints } from '../../InteractivePoints.js'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { Area } from './Area.js'

const SOFA_FABRICS = [
    { key: 'slate', main: '#456275', weave: '#597a91', base: '#395263', label: 'Azul Pizarra' },
    { key: 'cream', main: '#ddd4c7', weave: '#eee8de', base: '#cbc0b0', label: 'Arena Crema' },
    { key: 'sage',  main: '#6d8272', weave: '#839a88', base: '#5a6e5f', label: 'Verde Salvia' }
]

const CHANNELS = [
    { name: 'Canal 1: Atardecer Synthwave' },
    { name: 'Canal 2: Océano Relajante' },
    { name: 'Canal 3: Clásico Pong' },
    { name: 'Canal 4: Señal Retro HD' }
]

// =========================================================================
// GENERADORES DE GEOMETRÍAS SUAVES Y PULIDAS (OPTIMIZADOS PARA WEBGPU)
// =========================================================================

function createRoundedRectShape(width, height, radius)
{
    const shape = new THREE.Shape()
    const hw = width / 2
    const hh = height / 2
    const r = Math.min(Math.max(0.001, radius), hw * 0.99, hh * 0.99)

    shape.moveTo(-hw + r, -hh)
    shape.lineTo(hw - r, -hh)
    shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false)
    shape.lineTo(hw, hh - r)
    shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false)
    shape.lineTo(-hw + r, hh)
    shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false)
    shape.lineTo(-hw, -hh + r)
    shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false)

    return shape
}

function createRoundedBlock(width, height, depth, cornerRadiusXY, edgeBevel)
{
    const b = Math.min(edgeBevel, width * 0.45, height * 0.45, depth * 0.45)
    const sw = Math.max(0.004, width - 2 * b)
    const sh = Math.max(0.004, height - 2 * b)
    const extDepth = Math.max(0.002, depth - 2 * b)
    const innerR = Math.max(0.002, cornerRadiusXY - b)

    const shape = createRoundedRectShape(sw, sh, innerR)
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: extDepth,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: b,
        bevelThickness: b,
        curveSegments: 14
    })
    geo.center()
    geo.computeVertexNormals()
    return geo
}

function createRoundedSlab(width, height, depth, cornerRadiusXZ, edgeBevel)
{
    const geo = createRoundedBlock(width, depth, height, cornerRadiusXZ, edgeBevel)
    geo.rotateX(-Math.PI / 2)
    geo.computeVertexNormals()
    return geo
}

function createSmoothRoundedBox(width, height, depth, radius, puff = 0, segs = [ 14, 8, 14 ])
{
    const geo = new THREE.BoxGeometry(width, height, depth, segs[0], segs[1], segs[2])
    const pos = geo.attributes.position

    const hw = width / 2
    const hh = height / 2
    const hd = depth / 2
    const r = Math.min(radius, hw * 0.92, hh * 0.92, hd * 0.92)

    const hx = hw - r
    const hy = hh - r
    const hz = hd - r

    for(let i = 0; i < pos.count; i++)
    {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)

        const cx = Math.max(-hx, Math.min(hx, x))
        const cy = Math.max(-hy, Math.min(hy, y))
        const cz = Math.max(-hz, Math.min(hz, z))

        const dx = x - cx
        const dy = y - cy
        const dz = z - cz
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz)

        let nx = x, ny = y, nz = z
        if(len > 1e-6)
        {
            const inv = r / len
            nx = cx + dx * inv
            ny = cy + dy * inv
            nz = cz + dz * inv
        }

        if(puff > 0)
        {
            const ux = Math.min(1, Math.abs(nx) / hw)
            const uy = Math.min(1, Math.abs(ny) / hh)
            const uz = Math.min(1, Math.abs(nz) / hd)

            const domeY = Math.cos(ux * Math.PI * 0.5) * Math.cos(uz * Math.PI * 0.5)
            const domeZ = Math.cos(ux * Math.PI * 0.5) * Math.cos(uy * Math.PI * 0.5)
            const domeX = Math.cos(uy * Math.PI * 0.5) * Math.cos(uz * Math.PI * 0.5)

            ny += (ny / hh) * domeY * puff
            nz += (nz / hd) * domeZ * (puff * 0.65)
            nx += (nx / hw) * domeX * (puff * 0.35)
        }

        pos.setXYZ(i, nx, ny, nz)
    }

    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
}

function createCapsuleMesh(radius, length, material)
{
    const group = new THREE.Group()
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material)
    cyl.castShadow = true
    group.add(cyl)

    const capGeo = new THREE.SphereGeometry(radius, 10, 8)
    const capTop = new THREE.Mesh(capGeo, material)
    capTop.position.y = length / 2
    group.add(capTop)

    const capBot = new THREE.Mesh(capGeo, material)
    capBot.position.y = -length / 2
    group.add(capBot)

    return group
}

function createTurnedWoodLeg(height, topRadius, bottomRadius, material)
{
    const points = [
        new THREE.Vector2(0.001, 0),
        new THREE.Vector2(bottomRadius * 0.72, 0.004),
        new THREE.Vector2(bottomRadius, 0.018),
        new THREE.Vector2(bottomRadius + (topRadius - bottomRadius) * 0.45, height * 0.48),
        new THREE.Vector2(topRadius * 0.96, height * 0.88),
        new THREE.Vector2(topRadius * 1.12, height)
    ]
    const geo = new THREE.LatheGeometry(points, 14)
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
}

// =========================================================================
// TEXTURAS PROCEDURALES
// =========================================================================

function createWoodTexture(baseHex = '#b7895e', grainHex = '#8d603a')
{
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = baseHex
    ctx.fillRect(0, 0, 256, 256)

    for(let i = 0; i < 110; i++)
    {
        const y = Math.random() * 256
        ctx.strokeStyle = grainHex
        ctx.globalAlpha = 0.06 + Math.random() * 0.13
        ctx.lineWidth = 0.8 + Math.random() * 2.0
        ctx.beginPath()
        ctx.moveTo(0, y)
        const amp = 1.5 + Math.random() * 4.0
        for(let x = 0; x <= 256; x += 24)
        {
            ctx.lineTo(x, y + Math.sin(x * 0.025 + i) * amp)
        }
        ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(0.45, 0.45)
    return tex
}

function drawBoucleOnCanvas(canvas, baseHex, weaveHex)
{
    const ctx = canvas.getContext('2d')
    const s = canvas.width
    ctx.globalAlpha = 1
    ctx.fillStyle = baseHex
    ctx.fillRect(0, 0, s, s)

    for(let y = 0; y < s; y += 3)
    {
        for(let x = 0; x < s; x += 3)
        {
            ctx.fillStyle = ((x + y) % 6 === 0) ? weaveHex : '#ffffff'
            ctx.globalAlpha = ((x + y) % 6 === 0) ? 0.18 : 0.04
            ctx.fillRect(x, y, 2, 2)
        }
    }

    for(let i = 0; i < 360; i++)
    {
        ctx.fillStyle = i % 2 === 0 ? weaveHex : '#000000'
        ctx.globalAlpha = i % 2 === 0 ? 0.14 : 0.03
        ctx.beginPath()
        ctx.arc(Math.random() * s, Math.random() * s, 0.9 + Math.random() * 1.1, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.globalAlpha = 1
}

function createBoucleCanvasTexture(baseHex, weaveHex)
{
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    drawBoucleOnCanvas(canvas, baseHex, weaveHex)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(5, 5)
    return { canvas, tex }
}

export class TimeMachineArea extends Area
{
    constructor(model)
    {
        // Quitar por completo el antiguo televisor 2019, mesa, tazas, banco y colisionadores del GLB
        const toRemove = []
        for(const child of model.children)
        {
            const name = child.name || ''
            if(
                !name.startsWith('refZoneBounding') &&
                !name.startsWith('refZoneFrustum') &&
                !name.startsWith('refInteractivePoint')
            )
            {
                child.userData.preventAutoAdd = true
                child.visible = false
                toRemove.push(child)
            }
        }
        for(const child of toRemove)
        {
            if(child.parent)
                child.parent.remove(child)
        }

        super(model)

        // Mantener siempre visible para que los objetos dinámicos no desaparezcan al empujarlos lejos
        if(this.frustum)
            this.frustum.alwaysVisible = true

        this.center = new THREE.Vector3(this.model.position.x, 0.02, this.model.position.z)
        this.scale = 1.25

        this.tvOn = true
        this.channel = 0
        this.fabricIndex = 0
        this.tvTime = 0
        this._lastScreenDraw = 0
        this._lastTvCollisionSwitch = -10

        this.pongState = {
            ballX: 256,
            ballY: 144,
            vx: 4.5,
            vy: 3.1,
            leftY: 144,
            rightY: 144,
            scoreL: 0,
            scoreR: 0
        }

        this.setDynamicFurniture()
        this.setInteractivePoints()
        this.setRayIntersects()
        this.updateTVScreen(0)
    }

    setDynamicFurniture()
    {
        const s = this.scale

        // 1. MESA CÁPSULA DINÁMICA (empujable y tumbable)
        const tableInner = this.buildSleekTVTable()
        tableInner.position.y = -0.46 * s
        tableInner.scale.setScalar(s)

        const tableWrapper = new THREE.Group()
        tableWrapper.add(tableInner)

        this.tableObject = this.game.objects.add(
            {
                model: tableWrapper,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true
            },
            {
                type: 'dynamic',
                position: {
                    x: this.center.x,
                    y: this.center.y + 0.46 * s,
                    z: this.center.z - 2.15 * s
                },
                friction: 0.45,
                restitution: 0.1,
                mass: 0.22,
                sleeping: true,
                waterGravityMultiplier: -1,
                contactThreshold: 5,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ 1.56 * s, 0.46 * s, 0.43 * s ],
                        category: 'object'
                    }
                ],
                onCollision: (force, position) =>
                {
                    const hitSound = this.game.audio.groups.get('hitDefault')
                    if(hitSound)
                        hitSound.playRandomNext(force, position)
                }
            }
        )
        this.objects.items.push(this.tableObject)

        // 2. TELEVISOR OLED DINÁMICO (apoyado sobre la mesa; se puede tumbar y al golpearlo cambia de canal)
        const tvInner = this.buildSleekTelevision()
        tvInner.position.y = -0.82 * s
        tvInner.scale.setScalar(s)

        const tvWrapper = new THREE.Group()
        tvWrapper.add(tvInner)

        this.tvObject = this.game.objects.add(
            {
                model: tvWrapper,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true
            },
            {
                type: 'dynamic',
                position: {
                    x: this.center.x,
                    y: this.center.y + (0.92 + 0.82) * s + 0.01,
                    z: this.center.z - 2.18 * s
                },
                friction: 0.35,
                restitution: 0.18,
                mass: 0.12,
                sleeping: true,
                waterGravityMultiplier: -1,
                contactThreshold: 4,
                colliders: [
                    // Pedestal ovalado inferior
                    {
                        shape: 'cuboid',
                        position: { x: 0, y: (-0.82 + 0.05) * s, z: 0.02 * s },
                        parameters: [ 0.44 * s, 0.05 * s, 0.18 * s ],
                        category: 'object'
                    },
                    // Pantalla y marco superior
                    {
                        shape: 'cuboid',
                        position: { x: 0, y: (-0.82 + 0.94) * s, z: 0 },
                        parameters: [ 1.23 * s, 0.70 * s, 0.08 * s ],
                        category: 'object'
                    }
                ],
                onCollision: (force, position) =>
                {
                    const hitSound = this.game.audio.groups.get('hitMetal')
                    if(hitSound)
                        hitSound.playRandomNext(force, position)

                    // Al golpear o tumbar el TV también cambia de canal (con cooldown de 0.7s)
                    if(this.tvTime - this._lastTvCollisionSwitch > 0.7)
                    {
                        this._lastTvCollisionSwitch = this.tvTime
                        this.nextChannel()
                    }
                }
            }
        )
        this.objects.items.push(this.tvObject)

        // 3. SILLÓN MULLIDO DINÁMICO (empujable, girable y tumbable)
        const sofaInner = this.buildPlushSofa()
        sofaInner.position.y = -0.55 * s
        sofaInner.scale.setScalar(s)

        const sofaWrapper = new THREE.Group()
        sofaWrapper.add(sofaInner)

        this.sofaObject = this.game.objects.add(
            {
                model: sofaWrapper,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true
            },
            {
                type: 'dynamic',
                position: {
                    x: this.center.x,
                    y: this.center.y + 0.55 * s,
                    z: this.center.z + 1.42 * s
                },
                friction: 0.5,
                restitution: 0.12,
                mass: 0.28,
                sleeping: true,
                waterGravityMultiplier: -1,
                contactThreshold: 5,
                colliders: [
                    // Base + asiento + apoyabrazos
                    {
                        shape: 'cuboid',
                        position: { x: 0, y: (-0.55 + 0.36) * s, z: 0 },
                        parameters: [ 1.32 * s, 0.36 * s, 0.54 * s ],
                        category: 'object'
                    },
                    // Respaldo superior
                    {
                        shape: 'cuboid',
                        position: { x: 0, y: (-0.55 + 0.86) * s, z: 0.38 * s },
                        parameters: [ 1.30 * s, 0.34 * s, 0.18 * s ],
                        category: 'object'
                    }
                ],
                onCollision: (force, position) =>
                {
                    const hitSound = this.game.audio.groups.get('hitDefault')
                    if(hitSound)
                        hitSound.playRandomNext(force, position)
                }
            }
        )
        this.objects.items.push(this.sofaObject)
    }

    buildSleekTVTable()
    {
        const tableGroup = new THREE.Group()

        const oakTex = createWoodTexture('#b8895e', '#865b36')
        const darkWalnutTex = createWoodTexture('#966a45', '#6b4527')

        const woodMat = new MeshDefaultMaterial({
            colorNode: texture(oakTex).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const darkWalnutMat = new MeshDefaultMaterial({
            colorNode: texture(darkWalnutTex).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const drawerFrontMat = new MeshDefaultMaterial({
            colorNode: color(0xf4f1eb),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const champagneBrassMat = new MeshDefaultMaterial({
            colorNode: color(0xd6b56d),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        // Patas torneadas de madera suavemente inclinadas hacia afuera (y = 0 a y = 0.47)
        const legConfig = [
            [ -1.12, -0.22,  0.11,  0.09 ],
            [  1.12, -0.22, -0.11,  0.09 ],
            [ -1.12,  0.22,  0.11, -0.09 ],
            [  1.12,  0.22, -0.11, -0.09 ]
        ]

        const brassTipGeo = new THREE.CylinderGeometry(0.027, 0.023, 0.055, 12)
        for(const [ x, z, rz, rx ] of legConfig)
        {
            const legPivot = new THREE.Group()
            legPivot.position.set(x, 0, z)
            legPivot.rotation.set(rx, 0, rz)

            const leg = createTurnedWoodLeg(0.47, 0.042, 0.024, darkWalnutMat)
            legPivot.add(leg)

            const brassTip = new THREE.Mesh(brassTipGeo, champagneBrassMat)
            brassTip.position.y = 0.032
            legPivot.add(brassTip)

            tableGroup.add(legPivot)
        }

        // Cuerpo principal tipo cápsula (extremos totalmente curvos, bordes biselados)
        const bodyGeo = createRoundedSlab(3.04, 0.42, 0.78, 0.385, 0.045)
        const bodyMesh = new THREE.Mesh(bodyGeo, woodMat)
        bodyMesh.position.set(0, 0.655, 0)
        bodyMesh.castShadow = true
        bodyMesh.receiveShadow = true
        tableGroup.add(bodyMesh)

        // Tablero superior flotante ultra-suave (superficie exacta en y = 0.92)
        const topGeo = createRoundedSlab(3.16, 0.062, 0.86, 0.425, 0.026)
        const topMesh = new THREE.Mesh(topGeo, woodMat)
        topMesh.position.set(0, 0.889, 0)
        topMesh.castShadow = true
        topMesh.receiveShadow = true
        tableGroup.add(topMesh)

        // Dos frentes de cajón redondeados minimalistas al frente de la mesa
        const drawerGeo = createRoundedBlock(1.02, 0.29, 0.042, 0.085, 0.016)
        for(const x of [ -0.56, 0.56 ])
        {
            const drawerMesh = new THREE.Mesh(drawerGeo, drawerFrontMat)
            drawerMesh.position.set(x, 0.655, 0.378)
            drawerMesh.castShadow = true
            drawerMesh.receiveShadow = true
            tableGroup.add(drawerMesh)

            const handle = createCapsuleMesh(0.011, 0.17, champagneBrassMat)
            handle.rotation.z = Math.PI / 2
            handle.position.set(x, 0.665, 0.412)
            tableGroup.add(handle)
        }

        // Acanalado decorativo suave en los extremos curvos
        const fluteGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.31, 8)
        const curveAngles = [ -0.65, -0.32, 0, 0.32, 0.65 ]
        for(const side of [ -1, 1 ])
        {
            const centerX = side * 1.135
            for(const a of curveAngles)
            {
                const angle = side === 1 ? a : Math.PI - a
                const flute = new THREE.Mesh(fluteGeo, darkWalnutMat)
                flute.position.set(
                    centerX + Math.cos(angle) * 0.382,
                    0.655,
                    Math.sin(angle) * 0.382
                )
                tableGroup.add(flute)
            }
        }

        return tableGroup
    }

    buildSleekTelevision()
    {
        const tvGroup = new THREE.Group()

        const brushedMetalMat = new MeshDefaultMaterial({
            colorNode: color(0x262b33),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const darkBezelMat = new MeshDefaultMaterial({
            colorNode: color(0x16191f),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const backShellMat = new MeshDefaultMaterial({
            colorNode: color(0x20242c),
            hasCoreShadows: true,
            hasDropShadows: true
        })

        // Pedestal ovalado ultradelgado apoyado en y = 0 local
        const baseGeo = createRoundedSlab(0.84, 0.026, 0.32, 0.155, 0.011)
        const baseMesh = new THREE.Mesh(baseGeo, brushedMetalMat)
        baseMesh.position.set(0, 0.013, 0.02)
        baseMesh.castShadow = true
        baseMesh.receiveShadow = true
        tvGroup.add(baseMesh)

        // Cuello curvo escultural
        const neckCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.02, -0.02),
            new THREE.Vector3(0, 0.14, -0.075),
            new THREE.Vector3(0, 0.34, -0.055),
            new THREE.Vector3(0, 0.52, -0.035)
        ])
        const neckGeo = new THREE.TubeGeometry(neckCurve, 16, 0.038, 12, false)
        neckGeo.scale(1.9, 1.0, 0.72)
        const neckMesh = new THREE.Mesh(neckGeo, brushedMetalMat)
        neckMesh.castShadow = true
        tvGroup.add(neckMesh)

        // Dimensiones del televisor
        const tvWidth = 2.46
        const tvHeight = 1.40
        const tvCenterY = 0.24 + tvHeight / 2

        // Marco exterior ultra-delgado con esquinas redondeadas
        const bezelGeo = createRoundedBlock(tvWidth, tvHeight, 0.052, 0.068, 0.018)
        const bezelMesh = new THREE.Mesh(bezelGeo, darkBezelMat)
        bezelMesh.position.set(0, tvCenterY, 0)
        bezelMesh.castShadow = true
        bezelMesh.receiveShadow = true
        tvGroup.add(bezelMesh)

        // Carcasa trasera OLED suavemente abombada
        const rearGeo = createSmoothRoundedBox(tvWidth * 0.74, tvHeight * 0.64, 0.068, 0.03, 0.024, [ 12, 8, 8 ])
        const rearMesh = new THREE.Mesh(rearGeo, backShellMat)
        rearMesh.position.set(0, tvCenterY - 0.08, -0.032)
        rearMesh.castShadow = true
        tvGroup.add(rearMesh)

        // Lienzo 2D animado para la pantalla (4 canales + estado apagado)
        this.tvCanvas = document.createElement('canvas')
        this.tvCanvas.width = 512
        this.tvCanvas.height = 288
        this.tvCtx = this.tvCanvas.getContext('2d')

        this.tvTexture = new THREE.CanvasTexture(this.tvCanvas)
        this.tvTexture.colorSpace = THREE.SRGBColorSpace
        this.tvTexture.minFilter = THREE.LinearFilter
        this.tvTexture.magFilter = THREE.LinearFilter

        const screenW = tvWidth - 0.085
        const screenH = tvHeight - 0.085
        const screenShape = createRoundedRectShape(screenW, screenH, 0.042)
        const screenGeo = new THREE.ShapeGeometry(screenShape, 12)

        const uvAttr = screenGeo.attributes.uv
        const posAttr = screenGeo.attributes.position
        for(let i = 0; i < posAttr.count; i++)
        {
            const u = (posAttr.getX(i) + screenW / 2) / screenW
            const v = (posAttr.getY(i) + screenH / 2) / screenH
            uvAttr.setXY(i, u, v)
        }
        uvAttr.needsUpdate = true

        this.tvBrightnessUniform = uniform(1.35)
        const screenMat = new THREE.MeshBasicNodeMaterial()
        screenMat.outputNode = vec4(
            MeshDefaultMaterial.revealDiscardNodeBuilder(
                this.game,
                Fn(() =>
                {
                    return texture(this.tvTexture, uv()).rgb.mul(this.tvBrightnessUniform)
                })()
            ),
            1
        )

        this.tvScreenMesh = new THREE.Mesh(screenGeo, screenMat)
        this.tvScreenMesh.position.set(0, tvCenterY, 0.029)
        tvGroup.add(this.tvScreenMesh)

        // Indicador LED discreto debajo del borde inferior
        this.ledColorUniform = uniform(color(0x10b981))
        const ledMat = new THREE.MeshBasicNodeMaterial()
        ledMat.outputNode = vec4(
            MeshDefaultMaterial.revealDiscardNodeBuilder(
                this.game,
                this.ledColorUniform.mul(2.2)
            ),
            1
        )

        this.tvLedMesh = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), ledMat)
        this.tvLedMesh.scale.set(1.8, 0.7, 0.8)
        this.tvLedMesh.position.set(0, 0.252, 0.026)
        tvGroup.add(this.tvLedMesh)

        return tvGroup
    }

    buildPlushSofa()
    {
        const sofaGroup = new THREE.Group()

        const initialFabric = SOFA_FABRICS[this.fabricIndex]
        this.sofaMainTexData = createBoucleCanvasTexture(initialFabric.main, initialFabric.weave)
        this.sofaSecondaryTexData = createBoucleCanvasTexture(initialFabric.base, initialFabric.main)

        const sofaMainMat = new MeshDefaultMaterial({
            colorNode: texture(this.sofaMainTexData.tex).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const sofaSecondaryMat = new MeshDefaultMaterial({
            colorNode: texture(this.sofaSecondaryTexData.tex).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const legWoodMat = new MeshDefaultMaterial({
            colorNode: texture(createWoodTexture('#966a45', '#6b4527')).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        // 1. Cuatro patas cortas torneadas de madera
        const legPositions = [
            [ -1.08, -0.34,  0.10, -0.08 ],
            [  1.08, -0.34, -0.10, -0.08 ],
            [ -1.08,  0.36,  0.10,  0.08 ],
            [  1.08,  0.36, -0.10,  0.08 ]
        ]
        for(const [ x, z, rz, rx ] of legPositions)
        {
            const pivot = new THREE.Group()
            pivot.position.set(x, 0, z)
            pivot.rotation.set(rx, 0, rz)
            pivot.add(createTurnedWoodLeg(0.20, 0.044, 0.028, legWoodMat))
            sofaGroup.add(pivot)
        }

        // 2. Plataforma base acolchada y redondeada
        const baseGeo = createSmoothRoundedBox(2.58, 0.25, 1.08, 0.11, 0.018, [ 14, 6, 12 ])
        const baseMesh = new THREE.Mesh(baseGeo, sofaSecondaryMat)
        baseMesh.position.set(0, 0.29, 0.01)
        baseMesh.castShadow = true
        baseMesh.receiveShadow = true
        sofaGroup.add(baseMesh)

        // 3. Dos cojines amplios y mullidos para el asiento
        const seatGeo = createSmoothRoundedBox(1.06, 0.26, 0.92, 0.115, 0.046, [ 14, 8, 12 ])
        for(const x of [ -0.535, 0.535 ])
        {
            const seat = new THREE.Mesh(seatGeo, sofaMainMat)
            seat.position.set(x, 0.50, -0.04)
            seat.castShadow = true
            seat.receiveShadow = true
            sofaGroup.add(seat)
        }

        // 4. Apoyabrazos laterales envolventes y redondeados
        const armGeo = createSmoothRoundedBox(0.32, 0.62, 1.05, 0.145, 0.026, [ 10, 10, 12 ])
        for(const x of [ -1.18, 1.18 ])
        {
            const arm = new THREE.Mesh(armGeo, sofaSecondaryMat)
            arm.position.set(x, 0.61, 0.02)
            arm.rotation.z = x < 0 ? 0.04 : -0.04
            arm.castShadow = true
            arm.receiveShadow = true
            sofaGroup.add(arm)
        }

        // 5. Respaldo curvo exterior
        const backShellGeo = createSmoothRoundedBox(2.60, 0.82, 0.28, 0.13, 0.032, [ 14, 10, 8 ])
        const backShell = new THREE.Mesh(backShellGeo, sofaSecondaryMat)
        backShell.position.set(0, 0.78, 0.44)
        backShell.rotation.x = 0.12
        backShell.castShadow = true
        backShell.receiveShadow = true
        sofaGroup.add(backShell)

        // 6. Dos cojines mullidos del respaldo
        const backCushionGeo = createSmoothRoundedBox(1.03, 0.58, 0.29, 0.125, 0.058, [ 12, 10, 8 ])
        for(const x of [ -0.53, 0.53 ])
        {
            const backCushion = new THREE.Mesh(backCushionGeo, sofaMainMat)
            backCushion.position.set(x, 0.87, 0.24)
            backCushion.rotation.x = 0.17
            backCushion.castShadow = true
            backCushion.receiveShadow = true
            sofaGroup.add(backCushion)
        }

        // 7. Dos almohadones decorativos en tonos cálidos (arena y terracota)
        const pillowGeo = createSmoothRoundedBox(0.42, 0.40, 0.17, 0.08, 0.058, [ 10, 10, 8 ])

        const warmSandTex = createBoucleCanvasTexture('#e5cfb3', '#f2e3ce').tex
        const terracottaTex = createBoucleCanvasTexture('#cb795b', '#dd9377').tex

        const warmSandMat = new MeshDefaultMaterial({
            colorNode: texture(warmSandTex).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })
        const terracottaMat = new MeshDefaultMaterial({
            colorNode: texture(terracottaTex).rgb,
            hasCoreShadows: true,
            hasDropShadows: true
        })

        const leftPillow = new THREE.Mesh(pillowGeo, warmSandMat)
        leftPillow.position.set(-0.88, 0.78, 0.04)
        leftPillow.rotation.set(0.24, 0.54, -0.16)
        leftPillow.castShadow = true
        leftPillow.receiveShadow = true
        sofaGroup.add(leftPillow)

        const rightPillow = new THREE.Mesh(pillowGeo, terracottaMat)
        rightPillow.position.set(0.88, 0.78, 0.04)
        rightPillow.rotation.set(0.24, -0.52, 0.15)
        rightPillow.castShadow = true
        rightPillow.receiveShadow = true
        sofaGroup.add(rightPillow)

        return sofaGroup
    }

    setInteractivePoints()
    {
        const s = this.scale
        const pointPos = new THREE.Vector3(
            this.center.x,
            this.center.y + 1.5,
            this.center.z - 0.35 * s
        )

        this.interactivePoint = this.game.interactivePoints.create(
            pointPos,
            'Change Channel',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.nextChannel()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems([ 'interact' ])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
            }
        )
    }

    setRayIntersects()
    {
        if(!this.game.rayCursor)
            return

        const s = this.scale

        // Esferas de clic sincronizadas dinámicamente con la posición real del TV y el sillón
        this.tvRaySphere = new THREE.Sphere(this.tvObject.visual.object3D.position.clone(), 1.45 * s)
        this.game.rayCursor.addIntersect({
            active: true,
            shape: this.tvRaySphere,
            onClick: () =>
            {
                this.nextChannel()
            }
        })

        this.sofaRaySphere = new THREE.Sphere(this.sofaObject.visual.object3D.position.clone(), 1.45 * s)
        this.game.rayCursor.addIntersect({
            active: true,
            shape: this.sofaRaySphere,
            onClick: () =>
            {
                this.nextSofaFabric()
            }
        })
    }

    nextChannel()
    {
        const clickSound = this.game.audio.groups.get('click')
        if(clickSound)
            clickSound.play(true)

        if(!this.tvOn)
        {
            this.tvOn = true
            this.channel = 0
            this.tvBrightnessUniform.value = 1.35
            this.ledColorUniform.value.set(0x10b981)
        }
        else if(this.channel < CHANNELS.length - 1)
        {
            this.channel++
        }
        else
        {
            // Al pasar del canal 4, apaga la TV; el siguiente clic la vuelve a encender en el canal 1
            this.tvOn = false
            this.tvBrightnessUniform.value = 0.55
            this.ledColorUniform.value.set(0xef4444)
        }

        this.updateTVScreen(this.tvTime)
    }

    nextSofaFabric()
    {
        const clickSound = this.game.audio.groups.get('click')
        if(clickSound)
            clickSound.play(true)

        this.fabricIndex = (this.fabricIndex + 1) % SOFA_FABRICS.length
        const fabric = SOFA_FABRICS[this.fabricIndex]

        drawBoucleOnCanvas(this.sofaMainTexData.canvas, fabric.main, fabric.weave)
        this.sofaMainTexData.tex.needsUpdate = true

        drawBoucleOnCanvas(this.sofaSecondaryTexData.canvas, fabric.base, fabric.main)
        this.sofaSecondaryTexData.tex.needsUpdate = true
    }

    updateTVScreen(t)
    {
        const tvCtx = this.tvCtx
        const w = this.tvCanvas.width
        const h = this.tvCanvas.height

        if(!this.tvOn)
        {
            const offGrad = tvCtx.createLinearGradient(0, 0, w, h)
            offGrad.addColorStop(0, '#141820')
            offGrad.addColorStop(0.5, '#090b10')
            offGrad.addColorStop(1, '#161b24')
            tvCtx.fillStyle = offGrad
            tvCtx.fillRect(0, 0, w, h)

            tvCtx.fillStyle = 'rgba(255,255,255,0.05)'
            tvCtx.beginPath()
            tvCtx.moveTo(0, 0)
            tvCtx.lineTo(w * 0.44, 0)
            tvCtx.lineTo(w * 0.18, h)
            tvCtx.lineTo(0, h)
            tvCtx.closePath()
            tvCtx.fill()

            this.tvTexture.needsUpdate = true
            return
        }

        if(this.channel === 0)
        {
            // CANAL 1: Atardecer Synthwave
            const sky = tvCtx.createLinearGradient(0, 0, 0, h * 0.6)
            sky.addColorStop(0, '#160a33')
            sky.addColorStop(0.55, '#622078')
            sky.addColorStop(1, '#ff6a74')
            tvCtx.fillStyle = sky
            tvCtx.fillRect(0, 0, w, h * 0.6)

            tvCtx.fillStyle = '#ffffff'
            for(let i = 0; i < 24; i++)
            {
                const sx = (i * 73) % w
                const sy = (i * 31) % (h * 0.4)
                tvCtx.globalAlpha = 0.4 + 0.6 * Math.sin(t * 2.5 + i)
                tvCtx.fillRect(sx, sy, 2, 2)
            }
            tvCtx.globalAlpha = 1

            const sunGrad = tvCtx.createLinearGradient(0, 50, 0, 170)
            sunGrad.addColorStop(0, '#ffe66d')
            sunGrad.addColorStop(1, '#ff4593')
            tvCtx.fillStyle = sunGrad
            tvCtx.beginPath()
            tvCtx.arc(w / 2, h * 0.52, 54, 0, Math.PI * 2)
            tvCtx.fill()

            tvCtx.fillStyle = '#73216c'
            for(let s = 0; s < 5; s++)
            {
                tvCtx.fillRect(w / 2 - 60, h * 0.50 + s * 10, 120, 2 + s * 0.7)
            }

            tvCtx.fillStyle = '#180a2e'
            tvCtx.fillRect(0, h * 0.58, w, h * 0.42)
            tvCtx.strokeStyle = '#ff3ca6'
            tvCtx.lineWidth = 1.6

            for(let i = 0; i < 9; i++)
            {
                const progress = ((i / 9) + (t * 0.28)) % 1
                const y = h * 0.58 + Math.pow(progress, 2) * (h * 0.42)
                tvCtx.beginPath()
                tvCtx.moveTo(0, y)
                tvCtx.lineTo(w, y)
                tvCtx.stroke()
            }
            for(let i = -6; i <= 6; i++)
            {
                tvCtx.beginPath()
                tvCtx.moveTo(w / 2 + i * 18, h * 0.58)
                tvCtx.lineTo(w / 2 + i * 95, h)
                tvCtx.stroke()
            }
        }
        else if(this.channel === 1)
        {
            // CANAL 2: Océano Relajante
            const oceanGrad = tvCtx.createLinearGradient(0, 0, 0, h)
            oceanGrad.addColorStop(0, '#063757')
            oceanGrad.addColorStop(0.5, '#0e7ea0')
            oceanGrad.addColorStop(1, '#032033')
            tvCtx.fillStyle = oceanGrad
            tvCtx.fillRect(0, 0, w, h)

            const waveColors = [ 'rgba(56,189,248,0.28)', 'rgba(34,211,238,0.34)', 'rgba(125,211,252,0.25)' ]
            waveColors.forEach((col, idx) =>
            {
                tvCtx.fillStyle = col
                tvCtx.beginPath()
                tvCtx.moveTo(0, h)
                for(let x = 0; x <= w; x += 16)
                {
                    const y = h * (0.42 + idx * 0.14) + Math.sin(x * 0.015 + t * (1.4 + idx * 0.4) + idx) * 18
                    tvCtx.lineTo(x, y)
                }
                tvCtx.lineTo(w, h)
                tvCtx.closePath()
                tvCtx.fill()
            })

            tvCtx.strokeStyle = 'rgba(255,255,255,0.55)'
            tvCtx.lineWidth = 1.5
            for(let i = 0; i < 14; i++)
            {
                const bx = ((i * 53 + Math.sin(t + i) * 20) % w + w) % w
                const by = h - (((t * (35 + (i % 4) * 12) + i * 47) % (h + 40)))
                tvCtx.beginPath()
                tvCtx.arc(bx, by, 4 + (i % 5) * 2, 0, Math.PI * 2)
                tvCtx.stroke()
            }
        }
        else if(this.channel === 2)
        {
            // CANAL 3: Clásico Pong
            const pong = this.pongState
            tvCtx.fillStyle = '#091714'
            tvCtx.fillRect(0, 0, w, h)

            tvCtx.strokeStyle = 'rgba(74, 222, 128, 0.35)'
            tvCtx.setLineDash([ 8, 8 ])
            tvCtx.lineWidth = 3
            tvCtx.beginPath()
            tvCtx.moveTo(w / 2, 16)
            tvCtx.lineTo(w / 2, h - 16)
            tvCtx.stroke()
            tvCtx.setLineDash([])

            pong.ballX += pong.vx
            pong.ballY += pong.vy

            if(pong.ballY < 16 || pong.ballY > h - 16)
                pong.vy *= -1

            pong.leftY += (pong.ballY - pong.leftY) * 0.12
            pong.rightY += (pong.ballY - pong.rightY) * 0.12

            if(pong.ballX < 38 && Math.abs(pong.ballY - pong.leftY) < 42)
                pong.vx = Math.abs(pong.vx)
            else if(pong.ballX > w - 38 && Math.abs(pong.ballY - pong.rightY) < 42)
                pong.vx = -Math.abs(pong.vx)

            if(pong.ballX < 0)
            {
                pong.scoreR++
                pong.ballX = w / 2
                pong.ballY = h / 2
            }
            else if(pong.ballX > w)
            {
                pong.scoreL++
                pong.ballX = w / 2
                pong.ballY = h / 2
            }

            tvCtx.fillStyle = '#4ade80'
            tvCtx.fillRect(22, pong.leftY - 32, 10, 64)
            tvCtx.fillRect(w - 32, pong.rightY - 32, 10, 64)
            tvCtx.beginPath()
            tvCtx.arc(pong.ballX, pong.ballY, 7, 0, Math.PI * 2)
            tvCtx.fill()

            tvCtx.font = 'bold 28px monospace'
            tvCtx.textAlign = 'center'
            tvCtx.fillText(String(pong.scoreL % 99), w / 2 - 50, 44)
            tvCtx.fillText(String(pong.scoreR % 99), w / 2 + 50, 44)
        }
        else
        {
            // CANAL 4: Señal Retro HD
            const barColors = [ '#e5e7eb', '#facc15', '#22d3ee', '#4ade80', '#e879f9', '#ef4444', '#3b82f6' ]
            const barW = w / barColors.length
            barColors.forEach((c, idx) =>
            {
                tvCtx.fillStyle = c
                tvCtx.fillRect(idx * barW, 0, barW + 1, h * 0.78)
            })

            tvCtx.fillStyle = '#111827'
            tvCtx.fillRect(0, h * 0.78, w, h * 0.22)

            tvCtx.fillStyle = '#ffffff'
            tvCtx.font = 'bold 20px monospace'
            tvCtx.textAlign = 'center'
            tvCtx.fillText('SEÑAL EN VIVO • 4K ULTRA HD', w / 2, h * 0.92)

            const scanY = (t * 90) % h
            tvCtx.fillStyle = 'rgba(255,255,255,0.22)'
            tvCtx.fillRect(0, scanY, w, 6)
        }

        // Etiqueta discreta del canal
        tvCtx.fillStyle = 'rgba(0,0,0,0.45)'
        tvCtx.fillRect(w - 86, 14, 72, 24)
        tvCtx.fillStyle = '#ffffff'
        tvCtx.font = '600 13px sans-serif'
        tvCtx.textAlign = 'center'
        tvCtx.fillText(`CH 0${this.channel + 1}`, w - 50, 31)

        this.tvTexture.needsUpdate = true
    }

    update()
    {
        const dt = this.game.ticker.deltaScaled || 1 / 60
        this.tvTime += dt

        // Seguir la posición dinámica del TV y del sillón para los clics
        if(this.tvRaySphere && this.tvObject?.visual?.object3D)
            this.tvRaySphere.center.copy(this.tvObject.visual.object3D.position)
        if(this.sofaRaySphere && this.sofaObject?.visual?.object3D)
            this.sofaRaySphere.center.copy(this.sofaObject.visual.object3D.position)

        // Actualizar la pantalla (~24 FPS) solo cuando el TV está encendido y cerca del jugador
        if(this.tvOn && (this.tvTime - this._lastScreenDraw) >= 0.042)
        {
            const tvPos = this.tvObject?.visual?.object3D?.position
            const playerPos = this.game.player?.position
            if(!tvPos || !playerPos || tvPos.distanceToSquared(playerPos) < 1600)
            {
                this._lastScreenDraw = this.tvTime
                this.updateTVScreen(this.tvTime)
            }
        }
    }
}
