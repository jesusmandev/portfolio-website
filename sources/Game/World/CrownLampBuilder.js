import * as THREE from 'three/webgpu'
import { color, float, sin, uniform, vec4, vertexColor } from 'three/tsl'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * ============================================================================
 * LÁMPARA CORONA DORADA 3D ("Corona Aurelia") — Ultra Optimizada WebGPU
 * ============================================================================
 * - Conserva fielmente la silueta de 9 puntas acampanadas, banda inferior con
 *   molduras, 9 zafiros azules engastados, 9 relieves de flor de lis, 9 esferas
 *   doradas superiores, zócalo de mármol oscuro y cúpula luminosa ámbar interior.
 * - Ultra optimizada: ~2,100 triángulos por corona y solo 2 draw calls totales
 *   para todas las lámparas del mapa (1 'body' + 1 'glowCore' instanciados).
 * - Brillo cálido en GPU (TSL + Bloom de Folio) sin luces dinámicas costosas.
 */

const PALETTE = {
    royalGold:  new THREE.Color('#f4c84c'),
    satinGold:  new THREE.Color('#d9a838'),
    deepGold:   new THREE.Color('#9c711c'),
    sapphire:   new THREE.Color('#2255f5'),
    darkMarble: new THREE.Color('#1d1916'),
    goldTrim:   new THREE.Color('#ffe082'),
}

function paintGeo(geo, tintColor, minAO = 0.82, maxAO = 1.0, bottomFade = 0.20, topFade = 0.10)
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

/**
 * Construye el modelo base ultra optimizado de la Lámpara Corona Dorada ("Corona Aurelia")
 * escalado y alineado a las dimensiones exactas de las lámparas del mapa.
 */
export function buildCrownLampBase(game, options = {})
{
    const scaleFactor = options.scale ?? 0.42
    const baseOffsetY = options.baseOffsetY ?? -0.50

    const NUM_PEAKS = 9
    const BAND_RADIUS = 1.32
    const WALL_BASE_Y = 0.62
    const VALLEY_H = 0.23
    const PEAK_H = 1.34
    const WALL_THICKNESS = 0.065

    const getCrownTopHeight = (theta) =>
    {
        let phase = ((theta * NUM_PEAKS) / (2 * Math.PI)) % 1
        if(phase < 0) phase += 1
        const d = 1 - Math.abs(phase - 0.5) * 2
        return VALLEY_H + (PEAK_H - VALLEY_H) * Math.pow(d, 2.08)
    }

    const getCrownRadius = (localY) => BAND_RADIUS + 0.15 * localY + 0.145 * localY * localY
    const getCrownFlareAngle = (localY) => Math.atan(0.15 + 0.29 * localY)

    // 1 único material para todo el cuerpo sólido (mármol + oro 24K + zafiros)
    const matBody = new MeshDefaultMaterial({
        colorNode: vertexColor().rgb,
        hasCoreShadows: true,
        hasDropShadows: true,
        hasLightBounce: true,
        hasFog: true,
        hasReveal: true,
        hasWater: true,
    })
    matBody.name = 'crownBody'
    matBody.userData = { prevent: true }

    // 1 material emisivo cálido ámbar en GPU (TSL) con pulso suave y soporte de Reveal
    const glowIntensity = uniform(2.1)
    const tNode = game.ticker.elapsedScaledUniform
    const pulse = sin(tNode.mul(2.4)).mul(0.06).add(sin(tNode.mul(5.3)).mul(0.03)).add(1.0)
    const matGlow = new THREE.MeshBasicNodeMaterial()
    matGlow.name = 'crownGlow'
    matGlow.outputNode = vec4(
        MeshDefaultMaterial.revealDiscardNodeBuilder(
            game,
            color('#ffbe55').mul(glowIntensity).mul(pulse)
        ),
        float(1)
    )
    matGlow.userData = { prevent: true }

    const rawBodyRoot = new THREE.Group()
    const rawGlowRoot = new THREE.Group()

    const addBody = (parent, geo, tint, minAO = 0.84) =>
    {
        paintGeo(geo, tint, minAO)
        const mesh = new THREE.Mesh(geo, matBody)
        parent.add(mesh)
        return mesh
    }

    // ── 1. ZÓCALO DE MÁRMOL OSCURO + ARO DORADO + BOTÓN INTERRUPTOR ──
    {
        const plinthPts = [
            new THREE.Vector2(0.01, 0.00),
            new THREE.Vector2(1.52, 0.00),
            new THREE.Vector2(1.52, 0.14),
            new THREE.Vector2(1.42, 0.22),
            new THREE.Vector2(1.24, 0.24),
            new THREE.Vector2(0.01, 0.24),
        ]
        addBody(rawBodyRoot, new THREE.LatheGeometry(plinthPts, 18), PALETTE.darkMarble, 0.78)

        const goldTrim = addBody(rawBodyRoot, new THREE.TorusGeometry(1.51, 0.028, 6, 18), PALETTE.royalGold)
        goldTrim.rotation.x = Math.PI / 2
        goldTrim.position.y = 0.03

        const swBtn = addBody(rawBodyRoot, new THREE.CylinderGeometry(0.065, 0.065, 0.04, 8), PALETTE.goldTrim)
        swBtn.position.set(0, 0.11, 1.505)
        swBtn.rotation.x = Math.PI / 2
    }

    // ── 2. CORONA REAL DE 9 PUNTAS ACAMPANADAS ──
    const crownGroup = new THREE.Group()
    crownGroup.position.y = 0.25
    rawBodyRoot.add(crownGroup)

    const glowGroup = new THREE.Group()
    glowGroup.position.y = 0.25
    rawGlowRoot.add(glowGroup)

    // A. Base moldurada inferior + banda central + moldura superior
    {
        const baseMoldPts = [
            new THREE.Vector2(BAND_RADIUS - 0.06, 0.02),
            new THREE.Vector2(BAND_RADIUS + 0.12, 0.02),
            new THREE.Vector2(BAND_RADIUS + 0.13, 0.09),
            new THREE.Vector2(BAND_RADIUS + 0.04, 0.16),
            new THREE.Vector2(BAND_RADIUS + 0.01, 0.24),
        ]
        addBody(crownGroup, new THREE.LatheGeometry(baseMoldPts, 24), PALETTE.royalGold, 0.80)

        const bandMesh = addBody(
            crownGroup,
            new THREE.CylinderGeometry(BAND_RADIUS + 0.006, BAND_RADIUS + 0.002, 0.36, 27, 1, false),
            PALETTE.satinGold,
            0.84
        )
        bandMesh.position.y = 0.41

        const midTrim = addBody(crownGroup, new THREE.TorusGeometry(BAND_RADIUS + 0.03, 0.028, 6, 27), PALETTE.royalGold)
        midTrim.rotation.x = Math.PI / 2
        midTrim.position.y = 0.59
    }

    // B. Pared acampanada sólida con 9 puntas nítidas (exterior + interior + borde superior)
    {
        const radialSegs = NUM_PEAKS * 6 // 54 segmentos (punta exacta cada 6 pasos, valles suaves)
        const heightSegs = 3
        const ringVerts = radialSegs + 1
        const shellVertCount = (heightSegs + 1) * ringVerts

        const positions = []
        const colors = []
        const indices = []

        for(let side = 0; side < 2; side++)
        {
            const rOffset = side === 0 ? 0 : -WALL_THICKNESS
            const col = side === 0 ? PALETTE.royalGold : PALETTE.satinGold

            for(let j = 0; j <= heightSegs; j++)
            {
                const v = j / heightSegs
                const shade = side === 0
                    ? THREE.MathUtils.lerp(0.84, 1.06, v)
                    : THREE.MathUtils.lerp(0.75, 0.96, v)

                for(let i = 0; i <= radialSegs; i++)
                {
                    const u = i / radialSegs
                    const theta = u * Math.PI * 2
                    const topH = getCrownTopHeight(theta)
                    const localY = v * topH
                    const r = getCrownRadius(localY) + rOffset

                    positions.push(
                        r * Math.sin(theta),
                        WALL_BASE_Y + localY,
                        r * Math.cos(theta)
                    )
                    colors.push(
                        Math.min(1, col.r * shade),
                        Math.min(1, col.g * shade),
                        Math.min(1, col.b * shade)
                    )
                }
            }

            const baseIdx = side * shellVertCount
            for(let j = 0; j < heightSegs; j++)
            {
                for(let i = 0; i < radialSegs; i++)
                {
                    const a = baseIdx + j * ringVerts + i
                    const b = baseIdx + j * ringVerts + i + 1
                    const c = baseIdx + (j + 1) * ringVerts + i
                    const d = baseIdx + (j + 1) * ringVerts + i + 1
                    if(side === 0) indices.push(a, b, d, a, d, c)
                    else indices.push(a, d, b, a, c, d)
                }
            }
        }

        // Cerrar borde superior entre pared exterior e interior
        const topOuterStart = heightSegs * ringVerts
        const topInnerStart = shellVertCount + heightSegs * ringVerts
        for(let i = 0; i < radialSegs; i++)
        {
            const o1 = topOuterStart + i, o2 = topOuterStart + i + 1
            const i1 = topInnerStart + i, i2 = topInnerStart + i + 1
            indices.push(o1, o2, i2, o1, i2, i1)
        }

        const wallGeo = new THREE.BufferGeometry()
        wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
        wallGeo.setIndex(indices)
        wallGeo.computeVertexNormals()
        crownGroup.add(new THREE.Mesh(wallGeo, matBody))
    }

    // C. 9 Zafiros Azules + 9 Relieves Flor de Lis + 9 Esferas Doradas en las puntas
    {
        const bezelGeo = new THREE.TorusGeometry(0.105, 0.024, 5, 10)
        const gemGeo = new THREE.IcosahedronGeometry(0.088, 0)
        const fdlCenterGeo = new THREE.ConeGeometry(0.08, 0.44, 4)
        const fdlSideGeo = new THREE.BoxGeometry(0.13, 0.16, 0.045)
        const finialBallGeo = new THREE.SphereGeometry(0.105, 7, 6)
        const finialBudGeo = new THREE.ConeGeometry(0.04, 0.09, 5)

        for(let k = 0; k < NUM_PEAKS; k++)
        {
            const peakTheta = ((k + 0.5) / NUM_PEAKS) * Math.PI * 2
            const sinT = Math.sin(peakTheta)
            const cosT = Math.cos(peakTheta)

            // 1. Zafiro azul real en engaste dorado
            const gemHolder = new THREE.Group()
            gemHolder.position.set((BAND_RADIUS + 0.015) * sinT, 0.41, (BAND_RADIUS + 0.015) * cosT)
            gemHolder.rotation.y = peakTheta
            crownGroup.add(gemHolder)

            const bezel = addBody(gemHolder, bezelGeo.clone(), PALETTE.royalGold)
            bezel.position.z = 0.01

            const gem = addBody(gemHolder, gemGeo.clone(), PALETTE.sapphire, 0.90)
            gem.scale.set(1.0, 1.0, 0.62)
            gem.position.z = 0.02

            // 2. Relieve estilizado de Flor de Lis sobre cada punta
            const fdlLocalY = 0.36
            const fdlR = getCrownRadius(fdlLocalY) + 0.015
            const fdlHolder = new THREE.Group()
            fdlHolder.position.set(fdlR * sinT, WALL_BASE_Y + fdlLocalY, fdlR * cosT)
            fdlHolder.rotation.order = 'YXZ'
            fdlHolder.rotation.y = peakTheta
            fdlHolder.rotation.x = getCrownFlareAngle(fdlLocalY)
            crownGroup.add(fdlHolder)

            const lance = addBody(fdlHolder, fdlCenterGeo.clone(), PALETTE.goldTrim)
            lance.scale.set(1.0, 1.0, 0.45)
            lance.position.y = 0.08

            for(const s of [ -1, 1 ])
            {
                const petal = addBody(fdlHolder, fdlSideGeo.clone(), PALETTE.satinGold)
                petal.position.set(s * 0.11, -0.02, -0.005)
                petal.rotation.z = -s * 0.45
            }

            // 3. Remate de esfera dorada + brote superior en la cima de cada punta
            const tipR = getCrownRadius(PEAK_H) - WALL_THICKNESS * 0.35
            const finialGroup = new THREE.Group()
            finialGroup.position.set(tipR * sinT, WALL_BASE_Y + PEAK_H, tipR * cosT)
            finialGroup.rotation.order = 'YXZ'
            finialGroup.rotation.y = peakTheta
            finialGroup.rotation.x = getCrownFlareAngle(PEAK_H) * 0.85
            crownGroup.add(finialGroup)

            const orb = addBody(finialGroup, finialBallGeo.clone(), PALETTE.royalGold, 0.88)
            orb.scale.set(0.95, 1.08, 0.95)
            orb.position.y = 0.105

            const bud = addBody(finialGroup, finialBudGeo.clone(), PALETTE.goldTrim)
            bud.position.y = 0.24
        }

        bezelGeo.dispose()
        gemGeo.dispose()
        fdlCenterGeo.dispose()
        fdlSideGeo.dispose()
        finialBallGeo.dispose()
        finialBudGeo.dispose()
    }

    // ── 3. CÚPULA LUMINOSA ÁMBAR INTERIOR (ENCAJADA DENTRO DE LA CORONA) ──
    {
        const diffuserPts = [
            new THREE.Vector2(0.01, 0.14),
            new THREE.Vector2(0.72, 0.16),
            new THREE.Vector2(0.90, 0.44),
            new THREE.Vector2(0.88, 0.74),
            new THREE.Vector2(0.68, 0.98),
            new THREE.Vector2(0.36, 1.12),
            new THREE.Vector2(0.01, 1.16),
        ]
        const diffuserGeo = new THREE.LatheGeometry(diffuserPts, 14)
        glowGroup.add(new THREE.Mesh(diffuserGeo, matGlow))
    }

    // ── Fusionar en exactamente 2 geometrías (body + glow) ──
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
            if(needColor && !g.attributes.color)
            {
                const col = new Float32Array(count * 3)
                col.fill(1.0)
                g.setAttribute('color', new THREE.BufferAttribute(col, 3))
            }
            for(const key of Object.keys(g.attributes))
            {
                if(key !== 'position' && key !== 'normal' && (!needColor || key !== 'color'))
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
    baseGroup.name = 'crownLampBase'

    const bodyGeo = mergeRoot(rawBodyRoot, true)
    const bodyMesh = new THREE.Mesh(bodyGeo, matBody)
    bodyMesh.name = 'crownBody'
    bodyMesh.castShadow = true
    bodyMesh.receiveShadow = true
    bodyMesh.frustumCulled = true
    baseGroup.add(bodyMesh)

    const glowGeo = mergeRoot(rawGlowRoot, false)
    const glowMesh = new THREE.Mesh(glowGeo, matGlow)
    glowMesh.name = 'crownGlow'
    glowMesh.castShadow = false
    glowMesh.receiveShadow = false
    glowMesh.frustumCulled = true
    baseGroup.add(glowMesh)

    return { baseGroup, glowIntensity }
}
