import * as THREE from 'three/webgpu'
import { float, sin, texture, uniform, vec4, vertexColor } from 'three/tsl'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * ============================================================================
 * FAROLA HUMANOIDE DE MADERA 3D — Versión Ultra Optimizada (60 FPS WebGPU)
 * ============================================================================
 * - Conserva la silueta completa y detalles icónicos: pedestal diamante con
 *   banda de hierro, piernas esculpidas, cinturón metálico, torso con escudo
 *   en V, hombreras dobles, brazos en jarra con muñequeras y manos en cadera,
 *   cuello con collarín, cabeza de linterna medieval con celosía en X, cristal
 *   ámbar brillante, tejado piramidal escalonado y aguja superior.
 * - Ultra ligera: ~1,600 triángulos (20x menos que la versión anterior) y solo
 *   2 draw calls instanciados para todas las farolas del mapa (1 cuerpo + 1 cristal).
 */

function createLightweightWoodGrainTexture()
{
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#efefef'
    ctx.fillRect(0, 0, size, size)

    // Vetas verticales sutiles en escala de grises neutra (se multiplica por vertexColor)
    for(let i = 0; i < 42; i++)
    {
        const x = (i / 42) * size
        const w = 1 + (i % 3)
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'
        ctx.fillRect(x, 0, w, size)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
}

function createLanternGlassTexture()
{
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')

    const grad = ctx.createRadialGradient(
        size * 0.5, size * 0.52, size * 0.04,
        size * 0.5, size * 0.5, size * 0.62
    )
    grad.addColorStop(0.0, '#fffef2')
    grad.addColorStop(0.24, '#fff199')
    grad.addColorStop(0.55, '#ffbe1a')
    grad.addColorStop(0.84, '#eb7100')
    grad.addColorStop(1.0, '#9e3300')

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
}

const PALETTE = {
    carvedWood:      new THREE.Color('#c27332'),
    trimWood:        new THREE.Color('#9a5320'),
    roofShingleWood: new THREE.Color('#743c2c'),
    deepGrooveWood:  new THREE.Color('#3a1808'),
    agedIron:        new THREE.Color('#53443b'),
}

/**
 * Aplica color base del material + gradiente AO vertical directo en vertex colors
 * para unificar todas las piezas sólidas en 1 único draw call sin perder matices.
 */
function paintGeo(geo, tintColor, minAO = 0.80, maxAO = 1.0, bottomFade = 0.18, topFade = 0.12)
{
    geo.computeBoundingBox()
    const minY = geo.boundingBox.min.y
    const maxY = geo.boundingBox.max.y
    const span = Math.max(1e-5, maxY - minY)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)

    for(let i = 0; i < pos.count; i++)
    {
        const t = (pos.getY(i) - minY) / span
        let ao = maxAO
        if(bottomFade > 0 && t < bottomFade)
            ao = THREE.MathUtils.lerp(minAO, maxAO, t / bottomFade)
        else if(topFade > 0 && t > 1 - topFade)
            ao = THREE.MathUtils.lerp(minAO, maxAO, (1 - t) / topFade)

        colors[i * 3]     = tintColor.r * ao
        colors[i * 3 + 1] = tintColor.g * ao
        colors[i * 3 + 2] = tintColor.b * ao
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
}

function createTaperedBoxGeo(bottomW, bottomD, topW, topD, height)
{
    const geo = new THREE.BoxGeometry(1, height, 1, 1, 1, 1)
    const pos = geo.attributes.position
    for(let i = 0; i < pos.count; i++)
    {
        const y = pos.getY(i)
        const t = THREE.MathUtils.clamp((y + height * 0.5) / height, 0, 1)
        pos.setX(i, pos.getX(i) * THREE.MathUtils.lerp(bottomW, topW, t))
        pos.setZ(i, pos.getZ(i) * THREE.MathUtils.lerp(bottomD, topD, t))
    }
    geo.computeVertexNormals()
    return geo
}

function createSculptedTrunkGeo(slices, tintColor, radialSegments = 12)
{
    const numSlices = slices.length
    const positions = []
    const uvs = []
    const colors = []
    const indices = []

    for(let s = 0; s < numSlices; s++)
    {
        const {
            y, rx, rz,
            superExp = 0.84,
            frontCleft = 0.0,
            ao = 1.0,
            diamondMix = 0.0
        } = slices[s]
        const vCoord = s / (numSlices - 1)

        for(let r = 0; r <= radialSegments; r++)
        {
            const uCoord = r / radialSegments
            const theta = uCoord * Math.PI * 2
            const sinT = Math.sin(theta)
            const cosT = Math.cos(theta)

            let x = Math.sign(sinT) * Math.pow(Math.abs(sinT), superExp) * rx
            let z = Math.sign(cosT) * Math.pow(Math.abs(cosT), superExp) * rz

            if(diamondMix > 0)
            {
                const dx = Math.sign(sinT) * Math.pow(Math.abs(sinT), 1.06) * rx * 1.12
                const dz = Math.sign(cosT) * Math.pow(Math.abs(cosT), 1.06) * rz * 1.12
                x = THREE.MathUtils.lerp(x, dx, diamondMix)
                z = THREE.MathUtils.lerp(z, dz, diamondMix)
            }

            const cleft = Math.pow(Math.abs(cosT), 8) * frontCleft
            x *= (1.0 - cleft)
            z *= (1.0 - cleft * 0.85)

            positions.push(x, y, z)
            uvs.push(uCoord * 2.0, vCoord * 1.5)

            const finalAO = THREE.MathUtils.clamp(ao * (1.0 - cleft * 1.1), 0.65, 1.0)
            colors.push(tintColor.r * finalAO, tintColor.g * finalAO, tintColor.b * finalAO)
        }
    }

    const ringVerts = radialSegments + 1
    for(let s = 0; s < numSlices - 1; s++)
    {
        for(let r = 0; r < radialSegments; r++)
        {
            const a = s * ringVerts + r
            const b = (s + 1) * ringVerts + r
            const c = (s + 1) * ringVerts + (r + 1)
            const d = s * ringVerts + (r + 1)
            indices.push(a, d, b, b, d, c)
        }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
}

/**
 * Construye el modelo base ultra optimizado de la Farola Humanoide de Madera 3D
 * (2 draw calls totales: 'body' + 'glass', ~1,600 triángulos).
 */
export function buildHumanoidLanternBase(game, options = {})
{
    const targetHeight = options.targetHeight ?? 3.85
    const baseOffsetY = options.baseOffsetY ?? -1.75
    const RAW_HEIGHT = 11.51
    const scaleFactor = targetHeight / RAW_HEIGHT

    // 1 solo material compartido para TODA la madera + hierro (tintado por vertexColor)
    const woodGrainTex = createLightweightWoodGrainTexture()
    const matBody = new MeshDefaultMaterial({
        colorNode: vertexColor().rgb.mul(texture(woodGrainTex).rgb),
        hasCoreShadows: true,
        hasDropShadows: true,
        hasLightBounce: true,
        hasFog: true,
        hasReveal: true,
        hasWater: false,
    })
    matBody.name = 'body'
    matBody.userData = { prevent: true }

    // 1 material emisivo cálido para el cristal con pulso orgánico y soporte de Reveal
    const glowIntensity = uniform(2.1)
    const glassGradientTex = createLanternGlassTexture()
    const tNode = game.ticker.elapsedScaledUniform
    const flicker = sin(tNode.mul(3.1)).mul(0.08).add(sin(tNode.mul(5.7)).mul(0.04)).add(1.0)
    const matGlowingGlass = new THREE.MeshBasicNodeMaterial()
    matGlowingGlass.name = 'glass'
    matGlowingGlass.outputNode = vec4(
        MeshDefaultMaterial.revealDiscardNodeBuilder(
            game,
            texture(glassGradientTex).rgb.mul(glowIntensity).mul(flicker)
        ),
        float(1)
    )
    matGlowingGlass.userData = { prevent: true }

    // Contenedores para recolectar geometrías
    const WAIST_Y = 4.66
    const rawBodyRoot = new THREE.Group()
    const rawGlassRoot = new THREE.Group()
    const upperBody = new THREE.Group()
    upperBody.position.y = WAIST_Y
    rawBodyRoot.add(upperBody)

    const upperGlass = new THREE.Group()
    upperGlass.position.y = WAIST_Y
    rawGlassRoot.add(upperGlass)

    const addPart = (parent, geo, tint, minAO = 0.80) =>
    {
        paintGeo(geo, tint, minAO)
        const mesh = new THREE.Mesh(geo, matBody)
        parent.add(mesh)
        return mesh
    }

    // ── PARTE 7: PEDESTAL MULTINIVEL EN DIAMANTE ──
    {
        const baseDiamond = new THREE.Group()
        baseDiamond.rotation.y = Math.PI / 4

        // Zócalo base + escalón
        const plinth = addPart(baseDiamond, new THREE.BoxGeometry(2.86, 0.42, 2.86), PALETTE.trimWood, 0.76)
        plinth.position.y = 0.21

        const step = addPart(baseDiamond, createTaperedBoxGeo(2.68, 2.68, 2.42, 2.42, 0.16), PALETTE.carvedWood)
        step.position.y = 0.48

        // 4 cantoneras de esquina simples
        for(let i = 0; i < 4; i++)
        {
            const cg = new THREE.Group()
            cg.rotation.y = (i * Math.PI) / 2
            const c1 = addPart(cg, new THREE.BoxGeometry(0.66, 0.45, 0.34), PALETTE.carvedWood)
            c1.position.set(1.16, 0.225, 1.32)
            const c2 = addPart(cg, new THREE.BoxGeometry(0.34, 0.45, 0.66), PALETTE.carvedWood)
            c2.position.set(1.32, 0.225, 1.16)
            baseDiamond.add(cg)
        }

        // Cuerpo piramidal truncado + 4 contrafuertes diagonales
        const slopeY0 = 0.52, slopeY1 = 1.54, slopeH = slopeY1 - slopeY0
        const rBot = 1.15, rTop = 0.85
        const slopeBody = addPart(baseDiamond, createTaperedBoxGeo(rBot * 1.94, rBot * 1.94, rTop * 1.94, rTop * 1.94, slopeH), PALETTE.trimWood, 0.78)
        slopeBody.position.y = (slopeY0 + slopeY1) * 0.5

        for(let i = 0; i < 4; i++)
        {
            const fg = new THREE.Group()
            fg.rotation.y = (i * Math.PI) / 2
            const pBot = new THREE.Vector3(rBot - 0.12, slopeY0 - 0.02, rBot - 0.12)
            const pTop = new THREE.Vector3(rTop - 0.06, slopeY1 + 0.02, rTop - 0.06)
            const vec = new THREE.Vector3().subVectors(pTop, pBot)
            const mid = new THREE.Vector3().addVectors(pBot, pTop).multiplyScalar(0.5)
            const bh = new THREE.Group()
            bh.position.copy(mid)
            bh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize())
            const butt = addPart(bh, createTaperedBoxGeo(0.44, 0.44, 0.34, 0.34, vec.length()), PALETTE.carvedWood)
            butt.rotation.y = Math.PI / 4
            fg.add(bh)
            baseDiamond.add(fg)
        }

        // Abrazadera de hierro envejecido + cornisa superior
        const band = addPart(baseDiamond, createTaperedBoxGeo(1.90, 1.90, 1.80, 1.80, 0.40), PALETTE.agedIron, 0.82)
        band.position.y = 1.74

        const topCap = addPart(baseDiamond, createTaperedBoxGeo(1.84, 1.84, 1.60, 1.60, 0.16), PALETTE.trimWood)
        topCap.position.y = 2.00

        rawBodyRoot.add(baseDiamond)
    }

    // ── PARTE 6: PIERNAS ESCULPIDAS CONTINUAS (12x6 = solo 144 tris) ──
    {
        const slices = []
        for(let i = 0; i <= 6; i++)
        {
            const t = i / 6
            const y = THREE.MathUtils.lerp(1.94, 4.68, t)
            const flare = Math.pow(1.0 - t, 1.75)
            const rx = 0.49 + flare * 0.50
            const rz = 0.45 + flare * 0.47
            const cleft = 0.02 + Math.pow(1.0 - t, 1.15) * 0.11
            const diamondMix = Math.pow(Math.max(0, 1.0 - t * 3.2), 2.0) * 0.55
            const ao = t < 0.2 ? 0.78 : (t > 0.85 ? 0.82 : 1.0)
            slices.push({ y, rx, rz, superExp: 0.84, frontCleft: cleft, ao, diamondMix })
        }
        const legsMesh = new THREE.Mesh(createSculptedTrunkGeo(slices, PALETTE.carvedWood, 12), matBody)
        rawBodyRoot.add(legsMesh)
    }

    // ── PARTE 5: CINTURÓN DE HIERRO FORJADO ──
    {
        const beltGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.42, 12)
        beltGeo.scale(1.08, 1.0, 0.96)
        addPart(upperBody, beltGeo, PALETTE.agedIron, 0.82)
    }

    // ── PARTE 3: TORSO HUMANOIDE + ESCUDO EN V + HOMBRERAS ──
    {
        const slices = []
        for(let i = 0; i <= 5; i++)
        {
            const t = i / 5
            const y = THREE.MathUtils.lerp(-0.04, 2.04, t)
            const chestCurve = Math.pow(t, 1.25)
            const rx = 0.48 + chestCurve * 0.34
            const rz = 0.44 + chestCurve * 0.18
            const cleft = Math.sin(t * Math.PI) * 0.045
            const ao = t < 0.2 ? 0.80 : 1.0
            slices.push({ y, rx, rz, superExp: 0.84, frontCleft: cleft, ao })
        }
        upperBody.add(new THREE.Mesh(createSculptedTrunkGeo(slices, PALETTE.carvedWood, 12), matBody))

        // Escudo pectoral en V frontal y dorsal (bajo poligonaje)
        const createPlastronGeo = () =>
        {
            const geo = new THREE.BoxGeometry(0.96, 0.72, 0.22, 2, 1, 1)
            const pos = geo.attributes.position
            for(let i = 0; i < pos.count; i++)
            {
                const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i)
                const nx = vx / 0.48, ny = vy / 0.36
                const absX = Math.abs(nx)
                const yBot = -0.44 + absX * 0.40
                const yTop = 0.26 + absX * 0.11
                const newY = THREE.MathUtils.lerp(yBot, yTop, (ny + 1) * 0.5)
                const newX = vx * (0.86 + (ny + 1) * 0.09)
                const newZ = vz - absX * 0.22
                pos.setXYZ(i, newX, newY, newZ)
            }
            geo.computeVertexNormals()
            return geo
        }
        for(const zSide of [ 1, -1 ])
        {
            const p = addPart(upperBody, createPlastronGeo(), PALETTE.carvedWood, 0.85)
            p.position.set(0, 1.66, zSide * 0.56)
            if(zSide === -1) p.rotation.y = Math.PI
            p.rotation.x = zSide * 0.09
        }

        // Hombreras dobles
        for(const dir of [ -1, 1 ])
        {
            const pg = new THREE.Group()
            pg.position.set(dir * 0.72, 1.84, 0)
            pg.rotation.z = -dir * 0.25

            const upperPad = addPart(pg, new THREE.BoxGeometry(0.74, 0.21, 0.86), PALETTE.carvedWood, 0.85)
            upperPad.position.set(dir * 0.12, 0.11, 0)
            const lowerPad = addPart(pg, new THREE.BoxGeometry(0.80, 0.17, 0.80), PALETTE.trimWood, 0.82)
            lowerPad.position.set(dir * 0.22, -0.05, 0)
            upperBody.add(pg)
        }
    }

    // ── PARTE 4: BRAZOS ARTICULADOS EN JARRA + MUÑEQUERAS + MANOS ──
    {
        for(const dir of [ -1, 1 ])
        {
            const P0 = new THREE.Vector3(dir * 0.68, 1.62, 0.00)
            const P1 = new THREE.Vector3(dir * 1.66, 0.74, 0.02)
            const P2 = new THREE.Vector3(dir * 0.90, 0.06, 0.12)

            const addLimbSegment = (a, b, rA, rB) =>
            {
                const vec = new THREE.Vector3().subVectors(b, a)
                const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
                const geo = createTaperedBoxGeo(rA * 2, rA * 2, rB * 2, rB * 2, vec.length() + 0.12)
                const holder = new THREE.Group()
                holder.position.copy(mid)
                holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize())
                const mesh = addPart(holder, geo, PALETTE.carvedWood, 0.84)
                mesh.rotation.y = Math.PI / 4
                upperBody.add(holder)
            }

            addLimbSegment(P0, P1, 0.23, 0.20)
            addLimbSegment(P1, P2, 0.20, 0.17)

            // Codo suavizado
            const elbow = addPart(upperBody, new THREE.BoxGeometry(0.36, 0.36, 0.36), PALETTE.carvedWood, 0.86)
            elbow.position.copy(P1)
            elbow.rotation.set(0.3, Math.PI / 4, 0.3)

            // Muñequera de hierro
            const dirOut = new THREE.Vector3().subVectors(P2, P1).normalize()
            const cuffPos = new THREE.Vector3().lerpVectors(P1, P2, 0.76)
            const cuffGroup = new THREE.Group()
            cuffGroup.position.copy(cuffPos)
            cuffGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirOut)
            addPart(cuffGroup, new THREE.CylinderGeometry(0.24, 0.24, 0.24, 10), PALETTE.agedIron, 0.84)
            upperBody.add(cuffGroup)

            // Mano tallada apoyada en la cadera
            const handGroup = new THREE.Group()
            handGroup.position.set(dir * 0.78, -0.04, 0.14)
            handGroup.rotation.set(0.14, -dir * 0.30, dir * 0.62)
            addPart(handGroup, createTaperedBoxGeo(0.28, 0.24, 0.32, 0.25, 0.34), PALETTE.carvedWood, 0.84)
            const fingers = addPart(handGroup, new THREE.BoxGeometry(0.20, 0.24, 0.24), PALETTE.trimWood, 0.80)
            fingers.position.set(-dir * 0.12, -0.18, 0.02)
            fingers.rotation.z = -dir * 0.55
            upperBody.add(handGroup)
        }
    }

    // ── PARTE 2: CUELLO TORNEADO Y COLLARÍN DE HIERRO ──
    {
        const neckGroup = new THREE.Group()
        neckGroup.position.y = 1.96

        const neck = addPart(neckGroup, new THREE.CylinderGeometry(0.41, 0.43, 0.72, 10), PALETTE.carvedWood, 0.78)
        neck.position.y = 0.36

        const collar = addPart(neckGroup, new THREE.CylinderGeometry(0.47, 0.47, 0.27, 12), PALETTE.agedIron, 0.84)
        collar.position.y = 0.30

        const neckCap = addPart(neckGroup, createTaperedBoxGeo(0.76, 0.76, 1.12, 1.12, 0.22), PALETTE.trimWood)
        neckCap.position.y = 0.60
        neckCap.rotation.y = Math.PI / 4

        upperBody.add(neckGroup)
    }

    // ── PARTE 1: CABEZA DE LINTERNA MEDIEVAL + CELOSÍA EN X + TEJADO ESCALONADO + AGUJA ──
    {
        const headDiamond = new THREE.Group()
        headDiamond.position.y = 2.66
        headDiamond.rotation.y = Math.PI / 4

        const glassDiamond = new THREE.Group()
        glassDiamond.position.y = 2.66
        glassDiamond.rotation.y = Math.PI / 4

        // Base de linterna
        const lBase = addPart(headDiamond, createTaperedBoxGeo(1.34, 1.34, 1.56, 1.56, 0.28), PALETTE.carvedWood, 0.80)
        lBase.position.y = 0.14
        const lSeat = addPart(headDiamond, new THREE.BoxGeometry(1.42, 0.09, 1.42), PALETTE.trimWood)
        lSeat.position.y = 0.30

        // Jaula + celosía en X ligera (solo 6 barras BoxGeometry por cara) + cristal trapezoidal
        const cageY0 = 0.32, cageH = 1.68, cageY1 = cageY0 + cageH
        const bH = 0.61, tH = 0.93
        const faceTilt = Math.atan2(tH - bH, cageH)
        const faceSlantH = Math.hypot(tH - bH, cageH)
        const midZ = (bH + tH) * 0.5

        for(let i = 0; i < 4; i++)
        {
            const fg = new THREE.Group()
            fg.rotation.y = (i * Math.PI) / 2

            // Poste maestro de esquina
            const pBot = new THREE.Vector3(bH, cageY0 - 0.02, bH)
            const pTop = new THREE.Vector3(tH, cageY1 + 0.04, tH)
            const pVec = new THREE.Vector3().subVectors(pTop, pBot)
            const pMid = new THREE.Vector3().addVectors(pBot, pTop).multiplyScalar(0.5)
            const ph = new THREE.Group()
            ph.position.copy(pMid)
            ph.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pVec.clone().normalize())
            const post = addPart(ph, createTaperedBoxGeo(0.19, 0.19, 0.23, 0.23, pVec.length()), PALETTE.carvedWood)
            post.rotation.y = Math.PI / 4
            fg.add(ph)

            // Celosía en X ligera sobre el plano inclinado de la ventana
            const wh = new THREE.Group()
            wh.position.set(0, (cageY0 + cageY1) * 0.5, midZ - 0.01)
            wh.rotation.x = faceTilt

            const barD = 0.055
            const diagLen = Math.hypot((bH + tH) * 0.92, faceSlantH * 0.94)
            const diagAngle = Math.atan2((bH + tH) * 0.92, faceSlantH * 0.94)

            const bar1 = addPart(wh, new THREE.BoxGeometry(0.075, diagLen, barD), PALETTE.trimWood)
            bar1.rotation.z = diagAngle
            const bar2 = addPart(wh, new THREE.BoxGeometry(0.075, diagLen, barD), PALETTE.trimWood)
            bar2.rotation.z = -diagAngle

            // Travesaño horizontal + marco inferior/superior
            const midBar = addPart(wh, new THREE.BoxGeometry((bH + tH) * 0.92, 0.065, barD), PALETTE.trimWood)
            midBar.position.y = -faceSlantH * 0.10
            const topBar = addPart(wh, new THREE.BoxGeometry(tH * 1.9, 0.09, barD), PALETTE.trimWood)
            topBar.position.y = faceSlantH * 0.46
            const botBar = addPart(wh, new THREE.BoxGeometry(bH * 1.9, 0.09, barD), PALETTE.trimWood)
            botBar.position.y = -faceSlantH * 0.46

            fg.add(wh)
            headDiamond.add(fg)

            // Cristal trapezoidal emisivo (solo 2 triángulos por cara = 8 tris en total)
            const gFg = new THREE.Group()
            gFg.rotation.y = (i * Math.PI) / 2
            const gWh = new THREE.Group()
            gWh.position.set(0, (cageY0 + cageY1) * 0.5, midZ - 0.05)
            gWh.rotation.x = faceTilt

            const halfH = (faceSlantH - 0.02) * 0.5
            const wb = bH - 0.05, wt = tH - 0.06
            const glassGeo = new THREE.BufferGeometry()
            glassGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                -wb, -halfH, 0,   wb, -halfH, 0,   wt, halfH, 0,
                -wb, -halfH, 0,   wt,  halfH, 0,  -wt, halfH, 0
            ]), 3))
            glassGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
                0.10, 0.04,   0.90, 0.04,   0.98, 0.96,
                0.10, 0.04,   0.98, 0.96,   0.02, 0.96
            ]), 2))
            glassGeo.computeVertexNormals()
            gWh.add(new THREE.Mesh(glassGeo, matGlowingGlass))
            gFg.add(gWh)
            glassDiamond.add(gFg)
        }

        // Gran alero cuadrado + 4 esquinas
        const eavesH = 0.28
        const eavesY = cageY1 + eavesH * 0.5 - 0.01
        const eavesSpan = 2.46
        const eavesCore = addPart(headDiamond, new THREE.BoxGeometry(eavesSpan, eavesH, eavesSpan), PALETTE.carvedWood)
        eavesCore.position.y = eavesY
        const eavesSoffit = addPart(headDiamond, new THREE.BoxGeometry(eavesSpan - 0.24, 0.08, eavesSpan - 0.24), PALETTE.trimWood)
        eavesSoffit.position.y = eavesY - eavesH * 0.5 - 0.01

        // Tejado piramidal de 3 niveles escalonados + 4 limatesas diagonales
        const roofY0 = eavesY + eavesH * 0.5 - 0.02
        const roofY1 = roofY0 + 0.94
        const roofR0 = 1.18
        const roofR1 = 0.40

        const roofTiers = [
            { f0: 0.00, f1: 0.36, pad: 0.04 },
            { f0: 0.32, f1: 0.68, pad: 0.02 },
            { f0: 0.64, f1: 1.00, pad: 0.00 },
        ]
        for(const tier of roofTiers)
        {
            const yA = THREE.MathUtils.lerp(roofY0, roofY1, tier.f0)
            const yB = THREE.MathUtils.lerp(roofY0, roofY1, tier.f1)
            const wA = (THREE.MathUtils.lerp(roofR0, roofR1, tier.f0) + tier.pad) * 2
            const wB = (THREE.MathUtils.lerp(roofR0, roofR1, tier.f1) + tier.pad * 0.6) * 2
            const tierMesh = addPart(headDiamond, createTaperedBoxGeo(wA, wA, wB, wB, yB - yA + 0.02), PALETTE.roofShingleWood, 0.78)
            tierMesh.position.y = (yA + yB) * 0.5
        }

        for(let i = 0; i < 4; i++)
        {
            const hg = new THREE.Group()
            hg.rotation.y = (i * Math.PI) / 2
            const hBot = new THREE.Vector3(roofR0 + 0.02, roofY0 - 0.02, roofR0 + 0.02)
            const hTop = new THREE.Vector3(roofR1 - 0.01, roofY1 + 0.02, roofR1 - 0.01)
            const hVec = new THREE.Vector3().subVectors(hTop, hBot)
            const hMid = new THREE.Vector3().addVectors(hBot, hTop).multiplyScalar(0.5)
            const hh = new THREE.Group()
            hh.position.copy(hMid)
            hh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hVec.clone().normalize())
            const rafter = addPart(hh, createTaperedBoxGeo(0.20, 0.20, 0.14, 0.14, hVec.length()), PALETTE.carvedWood)
            rafter.rotation.y = Math.PI / 4
            hg.add(hh)
            headDiamond.add(hg)
        }

        // Corona escalonada + aguja piramidal
        const crownY = roofY1 - 0.02
        const c1 = addPart(headDiamond, createTaperedBoxGeo(0.86, 0.86, 0.78, 0.78, 0.16), PALETTE.carvedWood)
        c1.position.y = crownY + 0.08
        const c2 = addPart(headDiamond, createTaperedBoxGeo(0.64, 0.64, 0.56, 0.56, 0.14), PALETTE.trimWood)
        c2.position.y = crownY + 0.22
        const flange = addPart(headDiamond, createTaperedBoxGeo(0.56, 0.56, 0.42, 0.42, 0.11), PALETTE.carvedWood)
        flange.position.y = crownY + 0.33
        const spireH = 0.66
        const spire = addPart(headDiamond, createTaperedBoxGeo(0.46, 0.46, 0.03, 0.03, spireH), PALETTE.carvedWood, 0.84)
        spire.position.y = crownY + 0.36 + spireH * 0.5

        upperBody.add(headDiamond)
        upperGlass.add(glassDiamond)
    }

    // ── Fusionar en exactamente 2 geometrías (body + glass) ──
    const mergeRoot = (root, needColor) =>
    {
        root.updateMatrixWorld(true)
        const geos = []
        root.traverse((obj) =>
        {
            if(!obj.isMesh) return
            const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()
            g.applyMatrix4(obj.matrixWorld)
            g.scale(scaleFactor, scaleFactor, scaleFactor)
            g.translate(0, baseOffsetY, 0)
            if(!g.attributes.normal) g.computeVertexNormals()
            const count = g.attributes.position.count
            if(!g.attributes.uv)
                g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
            if(needColor && !g.attributes.color)
            {
                const col = new Float32Array(count * 3)
                col.fill(1.0)
                g.setAttribute('color', new THREE.BufferAttribute(col, 3))
            }
            for(const key of Object.keys(g.attributes))
            {
                if(key !== 'position' && key !== 'normal' && key !== 'uv' && (!needColor || key !== 'color'))
                    g.deleteAttribute(key)
            }
            geos.push(g)
            obj.geometry.dispose()
        })
        const merged = mergeGeometries(geos, false)
        for(const g of geos) g.dispose()
        merged.computeBoundingBox()
        merged.computeBoundingSphere()
        return merged
    }

    const baseGroup = new THREE.Group()
    baseGroup.name = 'humanoidLanternBase'

    const bodyGeo = mergeRoot(rawBodyRoot, true)
    const bodyMesh = new THREE.Mesh(bodyGeo, matBody)
    bodyMesh.name = 'body'
    bodyMesh.castShadow = true
    bodyMesh.receiveShadow = true
    bodyMesh.frustumCulled = true
    baseGroup.add(bodyMesh)

    const glassGeo = mergeRoot(rawGlassRoot, false)
    const glassMesh = new THREE.Mesh(glassGeo, matGlowingGlass)
    glassMesh.name = 'glass'
    glassMesh.castShadow = false
    glassMesh.receiveShadow = false
    glassMesh.frustumCulled = true
    baseGroup.add(glassMesh)

    return { baseGroup, glowIntensity }
}
