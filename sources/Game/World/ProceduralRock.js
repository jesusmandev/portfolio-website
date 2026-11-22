import * as THREE from 'three/webgpu'
import { normalWorld, texture, vertexColor } from 'three/tsl'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * =====================================================================
 * MOTOR DE ROCA 3D PROCEDURAL REALISTA (Adaptado a Folio-2025 WebGPU)
 * =====================================================================
 * - Geometría geodésica indexada (icosaedro subdividido soldado)
 * - Esculpido geológico: planos de fractura (cleavage planes), ruido
 *   multifractal con crestas (ridged noise) y estratificación sedimentaria
 * - Vertex colors con oclusión ambiental (AO) en grietas, desgaste en
 *   aristas y acumulación orgánica de musgo en caras superiores
 * - Mapeo UV planar en 6 ejes sin costuras ni pinzamiento polar
 * - Texturas PBR procedurales sin costuras (512x512) compartidas en GPU
 */

export class SeededRandom
{
    constructor(seed)
    {
        this.seed = seed >>> 0
    }

    next()
    {
        let t = (this.seed += 0x6D2B79F5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    range(min, max)
    {
        return min + this.next() * (max - min)
    }
}

export class Noise3D
{
    constructor(seed = 402)
    {
        this.p = new Uint8Array(512)
        const perm = new Uint8Array(256)
        for(let i = 0; i < 256; i++) perm[i] = i

        const rng = new SeededRandom(seed)
        for(let i = 255; i > 0; i--)
        {
            const j = Math.floor(rng.next() * (i + 1))
            const tmp = perm[i]
            perm[i] = perm[j]
            perm[j] = tmp
        }
        for(let i = 0; i < 512; i++)
            this.p[i] = perm[i & 255]
    }

    fade(t)
    {
        return t * t * t * (t * (t * 6 - 15) + 10)
    }

    lerp(t, a, b)
    {
        return a + t * (b - a)
    }

    grad(hash, x, y, z)
    {
        const h = hash & 15
        const u = h < 8 ? x : y
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z)
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
    }

    noise(x, y, z)
    {
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255
        const Z = Math.floor(z) & 255

        x -= Math.floor(x)
        y -= Math.floor(y)
        z -= Math.floor(z)

        const u = this.fade(x)
        const v = this.fade(y)
        const w = this.fade(z)

        const p = this.p
        const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z
        const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z)),
                this.lerp(u, this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z))
            ),
            this.lerp(v,
                this.lerp(u, this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1))
            )
        )
    }

    fbm(x, y, z, octaves = 4, lacunarity = 2.05, gain = 0.5)
    {
        let sum = 0
        let amp = 0.5
        let freq = 1.0
        for(let i = 0; i < octaves; i++)
        {
            sum += amp * this.noise(x * freq, y * freq, z * freq)
            freq *= lacunarity
            amp *= gain
        }
        return sum
    }

    ridged(x, y, z, octaves = 4, lacunarity = 2.1, gain = 0.52)
    {
        let sum = 0
        let amp = 0.5
        let freq = 1.0
        let weight = 1.0
        for(let i = 0; i < octaves; i++)
        {
            let signal = 1.0 - Math.abs(this.noise(x * freq, y * freq, z * freq))
            signal *= signal
            signal *= weight
            weight = Math.min(1.0, Math.max(0.0, signal * 1.8))
            sum += signal * amp
            freq *= lacunarity
            amp *= gain
        }
        return sum
    }
}

function smoothMin(a, b, k)
{
    const h = Math.max(k - Math.abs(a - b), 0.0) / k
    return Math.min(a, b) - h * h * k * 0.25
}

export const ROCK_PRESETS = {
    granite: {
        baseColor: new THREE.Color('#8a8d91'),
        creviceColor: new THREE.Color('#2d3136'),
        highlightColor: new THREE.Color('#c6c4bc'),
        accentColor: new THREE.Color('#9a9082'),
        strataStrength: 0.22,
        mossAmount: 0.0
    },
    basalt: {
        baseColor: new THREE.Color('#525760'),
        creviceColor: new THREE.Color('#1d2026'),
        highlightColor: new THREE.Color('#7c848f'),
        accentColor: new THREE.Color('#5c5753'),
        strataStrength: 0.28,
        mossAmount: 0.0
    },
    sandstone: {
        baseColor: new THREE.Color('#b57c52'),
        creviceColor: new THREE.Color('#4a2d1c'),
        highlightColor: new THREE.Color('#dfb286'),
        accentColor: new THREE.Color('#965636'),
        strataStrength: 0.85,
        mossAmount: 0.0
    },
    mossy: {
        baseColor: new THREE.Color('#6f7671'),
        creviceColor: new THREE.Color('#252d26'),
        highlightColor: new THREE.Color('#9ea49a'),
        accentColor: new THREE.Color('#4e7137'),
        strataStrength: 0.30,
        mossAmount: 0.85
    }
}

// Cache de texturas y material compartido (generados una sola vez)
let _sharedTextures = null
let _sharedMaterial = null

export function getSharedRockTextures(size = 512)
{
    if(_sharedTextures)
        return _sharedTextures

    const rng = new SeededRandom(1337)
    const gridCache = new Map()

    function getGrid(period)
    {
        if(gridCache.has(period)) return gridCache.get(period)
        const data = new Float32Array(period * period)
        for(let i = 0; i < data.length; i++)
            data[i] = rng.next()
        gridCache.set(period, data)
        return data
    }

    function periodicNoise2D(u, v, period)
    {
        const grid = getGrid(period)
        const x = u * period
        const y = v * period
        const x0 = Math.floor(x) % period
        const y0 = Math.floor(y) % period
        const x1 = (x0 + 1) % period
        const y1 = (y0 + 1) % period

        const fx = x - Math.floor(x)
        const fy = y - Math.floor(y)
        const sx = fx * fx * (3 - 2 * fx)
        const sy = fy * fy * (3 - 2 * fy)

        const n00 = grid[y0 * period + x0]
        const n10 = grid[y0 * period + x1]
        const n01 = grid[y1 * period + x0]
        const n11 = grid[y1 * period + x1]

        const nx0 = n00 + sx * (n10 - n00)
        const nx1 = n01 + sx * (n11 - n01)
        return nx0 + sy * (nx1 - nx0)
    }

    const heightMap = new Float32Array(size * size)
    const sparkleMap = new Float32Array(size * size)

    for(let y = 0; y < size; y++)
    {
        const v = y / size
        for(let x = 0; x < size; x++)
        {
            const u = x / size
            const n1 = periodicNoise2D(u, v, 8)
            const n2 = periodicNoise2D(u, v, 16)
            const n3 = periodicNoise2D(u, v, 32)
            const n4 = periodicNoise2D(u, v, 64)
            const n5 = periodicNoise2D(u, v, 128)
            const microGrain = periodicNoise2D(u, v, 256)

            const crackBase = Math.abs(periodicNoise2D(u + n2 * 0.06, v + n1 * 0.06, 12) * 2.0 - 1.0)
            const crack = Math.pow(Math.min(1.0, crackBase * 2.2), 0.55)

            const h = (n1 * 0.30 + n2 * 0.24 + n3 * 0.20 + n4 * 0.14 + n5 * 0.08 + microGrain * 0.04) * (0.72 + 0.28 * crack)
            const idx = y * size + x
            heightMap[idx] = h
            sparkleMap[idx] = microGrain > 0.78 ? 1.0 : 0.0
        }
    }

    const normalCanvas = document.createElement('canvas')
    normalCanvas.width = size
    normalCanvas.height = size
    const nCtx = normalCanvas.getContext('2d')
    const nImg = nCtx.createImageData(size, size)

    const albedoCanvas = document.createElement('canvas')
    albedoCanvas.width = size
    albedoCanvas.height = size
    const aCtx = albedoCanvas.getContext('2d')
    const aImg = aCtx.createImageData(size, size)

    const mask = size - 1
    const normalStrength = 6.5

    for(let y = 0; y < size; y++)
    {
        const ym1 = (y - 1) & mask
        const yp1 = (y + 1) & mask
        for(let x = 0; x < size; x++)
        {
            const xm1 = (x - 1) & mask
            const xp1 = (x + 1) & mask

            const tl = heightMap[ym1 * size + xm1]
            const t  = heightMap[ym1 * size + x]
            const tr = heightMap[ym1 * size + xp1]
            const l  = heightMap[y * size + xm1]
            const c  = heightMap[y * size + x]
            const r  = heightMap[y * size + xp1]
            const bl = heightMap[yp1 * size + xm1]
            const b  = heightMap[yp1 * size + x]
            const br = heightMap[yp1 * size + xp1]

            const dx = (tr + 2 * r + br - tl - 2 * l - bl) * normalStrength
            const dy = (bl + 2 * b + br - tl - 2 * t - tr) * normalStrength
            const dz = 1.0
            const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz)

            const pIdx = (y * size + x) * 4

            nImg.data[pIdx]     = Math.round((-dx * invLen * 0.5 + 0.5) * 255)
            nImg.data[pIdx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255)
            nImg.data[pIdx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255)
            nImg.data[pIdx + 3] = 255

            const sparkle = sparkleMap[y * size + x]
            const grainShade = Math.max(0.68, Math.min(1.0, 0.72 + c * 0.28 + sparkle * 0.08))
            const aByte = Math.round(grainShade * 255)
            aImg.data[pIdx] = aImg.data[pIdx + 1] = aImg.data[pIdx + 2] = aByte
            aImg.data[pIdx + 3] = 255
        }
    }

    nCtx.putImageData(nImg, 0, 0)
    aCtx.putImageData(aImg, 0, 0)

    const configureTex = (canvas, isSRGB) =>
    {
        const tex = new THREE.CanvasTexture(canvas)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        if(isSRGB) tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        return tex
    }

    _sharedTextures = {
        normalMap: configureTex(normalCanvas, false),
        albedoMap: configureTex(albedoCanvas, true)
    }

    return _sharedTextures
}

export function getSharedRockMaterial()
{
    if(_sharedMaterial)
        return _sharedMaterial

    const textures = getSharedRockTextures(512)

    // Perturbación sutil de normales en espacio mundo para micro-relieve mineral
    const microNormal = texture(textures.normalMap).rgb.mul(2.0).sub(1.0).mul(0.32)
    const perturbedNormal = normalWorld.add(microNormal).normalize()

    _sharedMaterial = new MeshDefaultMaterial({
        colorNode: vertexColor().rgb.mul(texture(textures.albedoMap).rgb),
        normalNode: perturbedNormal,
        hasWater: true,
        hasCoreShadows: true,
        hasDropShadows: true,
        hasLightBounce: true,
        hasFog: true,
        hasReveal: true,
    })
    _sharedMaterial.userData = { prevent: true }

    return _sharedMaterial
}

function createIndexedIcosphere(subdivisions)
{
    const t = (1.0 + Math.sqrt(5.0)) / 2.0
    const rawVerts = [
        -1,  t,  0,   1,  t,  0,  -1, -t,  0,   1, -t,  0,
         0, -1,  t,   0,  1,  t,   0, -1, -t,   0,  1, -t,
         t,  0, -1,   t,  0,  1,  -t,  0, -1,  -t,  0,  1
    ]

    const vertices = []
    for(let i = 0; i < rawVerts.length; i += 3)
    {
        const vx = rawVerts[i], vy = rawVerts[i + 1], vz = rawVerts[i + 2]
        const invLen = 1.0 / Math.sqrt(vx * vx + vy * vy + vz * vz)
        vertices.push(vx * invLen, vy * invLen, vz * invLen)
    }

    let indices = [
        0, 11, 5,  0, 5, 1,   0, 1, 7,   0, 7, 10,  0, 10, 11,
        1, 5, 9,   5, 11, 4,  11, 10, 2, 10, 7, 6,  7, 1, 8,
        3, 9, 4,   3, 4, 2,   3, 2, 6,   3, 6, 8,   3, 8, 9,
        4, 9, 5,   2, 4, 11,  6, 2, 10,  8, 6, 7,   9, 8, 1
    ]

    const midpointCache = new Map()

    function getMidpoint(i1, i2)
    {
        const min = i1 < i2 ? i1 : i2
        const max = i1 < i2 ? i2 : i1
        const key = min * 65536 + max
        const cached = midpointCache.get(key)
        if(cached !== undefined) return cached

        const mx = (vertices[i1 * 3] + vertices[i2 * 3]) * 0.5
        const my = (vertices[i1 * 3 + 1] + vertices[i2 * 3 + 1]) * 0.5
        const mz = (vertices[i1 * 3 + 2] + vertices[i2 * 3 + 2]) * 0.5
        const invLen = 1.0 / Math.sqrt(mx * mx + my * my + mz * mz)

        const newIndex = vertices.length / 3
        vertices.push(mx * invLen, my * invLen, mz * invLen)
        midpointCache.set(key, newIndex)
        return newIndex
    }

    for(let s = 0; s < subdivisions; s++)
    {
        const nextIndices = []
        midpointCache.clear()
        for(let i = 0; i < indices.length; i += 3)
        {
            const a = indices[i]
            const b = indices[i + 1]
            const c = indices[i + 2]

            const ab = getMidpoint(a, b)
            const bc = getMidpoint(b, c)
            const ca = getMidpoint(c, a)

            nextIndices.push(
                a, ab, ca,
                b, bc, ab,
                c, ca, bc,
                ab, bc, ca
            )
        }
        indices = nextIndices
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint32Array(indices)
    }
}

/**
 * Construye una BufferGeometry de roca realista (esculpido geológico, AO, desgaste, musgo y UVs en 6 ejes)
 */
export function buildRockGeometry(options = {})
{
    const {
        seed = 402,
        detail = 3,
        radius = 1.5,
        fracture = 0.75,
        crags = 0.55,
        rockType = 'granite',
        uvScale = 0.58,
        centerVertically = false,
        aspectX = 1.0,
        aspectY = 1.0,
        aspectZ = 1.0,
    } = options

    const preset = ROCK_PRESETS[rockType] || ROCK_PRESETS.granite
    const rng = new SeededRandom(seed)
    const noise = new Noise3D(seed)

    const base = createIndexedIcosphere(detail)
    const vertCount = base.vertices.length / 3
    const pos = new Float32Array(base.vertices.length)
    const cavity = new Float32Array(vertCount)
    const strataValues = new Float32Array(vertCount)

    // Planos de fractura (cleavage planes)
    const numPlanes = 7 + Math.floor(rng.next() * 4)
    const planes = []
    for(let i = 0; i < numPlanes; i++)
    {
        const theta = rng.range(0, Math.PI * 2)
        const phi = Math.acos(rng.range(-0.85, 0.95))
        planes.push({
            nx: Math.sin(phi) * Math.cos(theta),
            ny: Math.cos(phi),
            nz: Math.sin(phi) * Math.sin(theta),
            dist: rng.range(0.68, 0.96)
        })
    }

    const scaleX = rng.range(1.02, 1.24) * aspectX
    const scaleY = rng.range(0.74, 0.92) * aspectY
    const scaleZ = rng.range(0.92, 1.18) * aspectZ
    const tiltX = rng.range(-0.22, 0.22)
    const tiltZ = rng.range(-0.22, 0.22)

    let minY = Infinity
    let maxY = -Infinity

    for(let i = 0; i < vertCount; i++)
    {
        const dx = base.vertices[i * 3]
        const dy = base.vertices[i * 3 + 1]
        const dz = base.vertices[i * 3 + 2]

        const warp = noise.fbm(dx * 1.15, dy * 1.15, dz * 1.15, 2) * 0.28
        let r = 1.0 + warp

        let planeClip = 1.45
        for(let p = 0; p < planes.length; p++)
        {
            const pl = planes[p]
            const dot = dx * pl.nx + dy * pl.ny + dz * pl.nz
            if(dot > 0.15)
            {
                const limit = pl.dist / Math.max(dot, 0.35)
                planeClip = smoothMin(planeClip, limit, 0.26)
            }
        }
        const facetedR = smoothMin(r, planeClip, 0.18)
        r = r * (1.0 - fracture * 0.65) + facetedR * (fracture * 0.65)

        const ridgeVal = noise.ridged(dx * 2.1 + 4.3, dy * 2.1 - 1.7, dz * 2.1 + 2.9, 4)
        const fbmDetail = noise.fbm(dx * 4.2, dy * 4.2, dz * 4.2, 3)

        const strataCoord = (dy + dx * tiltX + dz * tiltZ) * 6.5 + noise.fbm(dx * 1.8, dy * 1.8, dz * 1.8, 2) * 1.4
        const strataWave = Math.sin(strataCoord) * 0.5 + Math.sin(strataCoord * 2.3) * 0.25
        const strataDisp = strataWave * 0.055 * preset.strataStrength * (0.4 + crags * 0.8)
        strataValues[i] = strataWave * 0.5 + 0.5

        const crevice = (ridgeVal - 0.42) * 0.32 * crags
        const microDisp = fbmDetail * 0.08 * crags

        const finalR = (r + crevice + strataDisp + microDisp) * radius

        let px = dx * finalR * scaleX
        let py = dy * finalR * scaleY
        let pz = dz * finalR * scaleZ

        // Asentamiento natural en la base
        const baseThreshold = -radius * scaleY * 0.62
        if(py < baseThreshold)
            py = baseThreshold + (py - baseThreshold) * 0.32

        pos[i * 3] = px
        pos[i * 3 + 1] = py
        pos[i * 3 + 2] = pz

        if(py < minY) minY = py
        if(py > maxY) maxY = py

        cavity[i] = Math.max(0.0, Math.min(1.0, 0.48 + (ridgeVal - 0.38) * 1.25 + fbmDetail * 0.45))
    }

    // Alinear base en y = 0 o centrar verticalmente en y = 0
    const yShift = centerVertically ? -0.5 * (minY + maxY) : -minY
    for(let i = 0; i < vertCount; i++)
        pos[i * 3 + 1] += yShift

    const heightSpan = Math.max(0.001, maxY - minY)

    // Normales suaves sobre malla soldada (cero costuras)
    const normals = new Float32Array(vertCount * 3)
    const indices = base.indices

    for(let i = 0; i < indices.length; i += 3)
    {
        const i0 = indices[i] * 3
        const i1 = indices[i + 1] * 3
        const i2 = indices[i + 2] * 3

        const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2]
        const bx = pos[i1], by = pos[i1 + 1], bz = pos[i1 + 2]
        const cx = pos[i2], cy = pos[i2 + 1], cz = pos[i2 + 2]

        const abx = bx - ax, aby = by - ay, abz = bz - az
        const acx = cx - ax, acy = cy - ay, acz = cz - az

        const nx = aby * acz - abz * acy
        const ny = abz * acx - abx * acz
        const nz = abx * acy - aby * acx

        normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz
        normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz
        normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz
    }

    for(let i = 0; i < vertCount; i++)
    {
        const idx = i * 3
        const nx = normals[idx], ny = normals[idx + 1], nz = normals[idx + 2]
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0
        normals[idx] = nx / len
        normals[idx + 1] = ny / len
        normals[idx + 2] = nz / len
    }

    // Colores de vértice: variación mineral, desgaste en aristas, AO en grietas y musgo
    const colors = new Float32Array(vertCount * 3)
    const tmpColor = new THREE.Color()
    const mossColor = new THREE.Color('#3b5a28')
    const mossTip = new THREE.Color('#5c7c34')
    const mossBlend = new THREE.Color()

    for(let i = 0; i < vertCount; i++)
    {
        const px = pos[i * 3]
        const py = pos[i * 3 + 1]
        const pz = pos[i * 3 + 2]
        const ny = normals[i * 3 + 1]
        const cav = cavity[i]
        const strat = strataValues[i]

        const patch = noise.fbm(px * 1.4, py * 1.4, pz * 1.4, 3) * 0.5 + 0.5

        tmpColor.copy(preset.baseColor).lerp(preset.accentColor, patch * 0.55 + strat * 0.35 * preset.strataStrength)

        const edgeWear = Math.max(0.0, (cav - 0.62) * 1.65)
        tmpColor.lerp(preset.highlightColor, Math.min(0.65, edgeWear))

        const normHeight = (py - (minY + yShift)) / heightSpan
        const groundAO = Math.min(1.0, 0.58 + normHeight * 0.45)
        const creviceMix = Math.max(0.0, Math.min(1.0, (1.0 - cav) * 0.85))
        tmpColor.lerp(preset.creviceColor, creviceMix)
        tmpColor.multiplyScalar(groundAO)

        if(preset.mossAmount > 0.01)
        {
            const mossNoise = noise.fbm(px * 2.6 + 9.1, py * 2.6, pz * 2.6 - 3.4, 3) * 0.5 + 0.5
            const slopeFactor = Math.max(0.0, (ny - 0.38) * 1.85)
            const mossMask = Math.max(0.0, Math.min(1.0, (slopeFactor * mossNoise * 1.65 - 0.25) * preset.mossAmount))
            if(mossMask > 0.01)
            {
                mossBlend.copy(mossColor).lerp(mossTip, patch)
                tmpColor.lerp(mossBlend, mossMask)
            }
        }

        colors[i * 3] = tmpColor.r
        colors[i * 3 + 1] = tmpColor.g
        colors[i * 3 + 2] = tmpColor.b
    }

    // Proyección UV planar en 6 ejes sin distorsión polar
    const outPos = []
    const outNorm = []
    const outCol = []
    const outUV = []
    const outIndices = []
    const vertCache = new Map()

    function getProjectedVertex(vIdx, axis)
    {
        const key = vIdx * 6 + axis
        const existing = vertCache.get(key)
        if(existing !== undefined) return existing

        const px = pos[vIdx * 3]
        const py = pos[vIdx * 3 + 1]
        const pz = pos[vIdx * 3 + 2]

        let u = 0, v = 0
        switch(axis)
        {
            case 0: u = -pz * uvScale; v =  py * uvScale; break
            case 1: u =  pz * uvScale; v =  py * uvScale; break
            case 2: u =  px * uvScale; v = -pz * uvScale; break
            case 3: u =  px * uvScale; v =  pz * uvScale; break
            case 4: u =  px * uvScale; v =  py * uvScale; break
            case 5: u = -px * uvScale; v =  py * uvScale; break
        }

        const newIdx = outPos.length / 3
        outPos.push(px, py, pz)
        outNorm.push(normals[vIdx * 3], normals[vIdx * 3 + 1], normals[vIdx * 3 + 2])
        outCol.push(colors[vIdx * 3], colors[vIdx * 3 + 1], colors[vIdx * 3 + 2])
        outUV.push(u, v)

        vertCache.set(key, newIdx)
        return newIdx
    }

    for(let i = 0; i < indices.length; i += 3)
    {
        const a = indices[i]
        const b = indices[i + 1]
        const c = indices[i + 2]

        const fnx = normals[a * 3] + normals[b * 3] + normals[c * 3]
        const fny = normals[a * 3 + 1] + normals[b * 3 + 1] + normals[c * 3 + 1]
        const fnz = normals[a * 3 + 2] + normals[b * 3 + 2] + normals[c * 3 + 2]

        const ax = Math.abs(fnx), ay = Math.abs(fny), az = Math.abs(fnz)
        let axis = 0
        if(ax >= ay && ax >= az) axis = fnx >= 0 ? 0 : 1
        else if(ay >= ax && ay >= az) axis = fny >= 0 ? 2 : 3
        else axis = fnz >= 0 ? 4 : 5

        outIndices.push(
            getProjectedVertex(a, axis),
            getProjectedVertex(b, axis),
            getProjectedVertex(c, axis)
        )
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outNorm, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(outCol, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(outUV, 2))
    geometry.setIndex(outIndices)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    return geometry
}

/**
 * Construye una formación rocosa natural (boulder principal + rocas secundarias + guijarros)
 * ajustada exactamente a las cajas delimitadoras (boxes) de un grupo de basaltRocks en el agua/orilla.
 */
export function buildRockClusterGeometry(boxes, baseSeed = 402)
{
    const rng = new SeededRandom(baseSeed)
    const rockTypes = [ 'granite', 'mossy', 'basalt' ]
    const geos = []
    const mat4 = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scale = new THREE.Vector3()
    const boxSize = new THREE.Vector3()
    const boxCenter = new THREE.Vector3()

    const addRockPiece = (geo, px, py, pz, rx, ry, rz, sx, sy, sz) =>
    {
        pos.set(px, py, pz)
        euler.set(rx, ry, rz)
        quat.setFromEuler(euler)
        scale.set(sx, sy, sz)
        mat4.compose(pos, quat, scale)
        geo.applyMatrix4(mat4)
        geos.push(geo)
    }

    boxes.forEach((box, boxIdx) =>
    {
        box.getSize(boxSize)
        box.getCenter(boxCenter)

        const mainType = rockTypes[(baseSeed + boxIdx) % rockTypes.length]

        // 1. Roca principal ocupando el núcleo del volumen
        const mainGeo = buildRockGeometry({
            seed: baseSeed + boxIdx * 97 + 11,
            detail: 4,
            radius: 1.0,
            fracture: 0.78,
            crags: 0.58,
            rockType: mainType,
            uvScale: 0.52,
            centerVertically: false
        })
        mainGeo.computeBoundingBox()
        const mSize = mainGeo.boundingBox.getSize(new THREE.Vector3())

        const mainSX = (boxSize.x * 0.88) / Math.max(0.01, mSize.x)
        const mainSY = (boxSize.y * 0.98) / Math.max(0.01, mSize.y)
        const mainSZ = (boxSize.z * 0.88) / Math.max(0.01, mSize.z)

        addRockPiece(
            mainGeo,
            boxCenter.x,
            box.min.y,
            boxCenter.z,
            0,
            rng.range(0, Math.PI * 2),
            0,
            mainSX,
            mainSY,
            mainSZ
        )

        // 2. 4 rocas secundarias escalonadas rodeando el contorno para una silueta orgánica natural
        const subCount = 4
        for(let i = 0; i < subCount; i++)
        {
            const angle = (i / subCount) * Math.PI * 2 + rng.range(-0.4, 0.4)
            const ox = Math.cos(angle) * boxSize.x * rng.range(0.24, 0.38)
            const oz = Math.sin(angle) * boxSize.z * rng.range(0.24, 0.38)
            const subType = rockTypes[(baseSeed + boxIdx + i + 1) % rockTypes.length]

            const subGeo = buildRockGeometry({
                seed: baseSeed + boxIdx * 97 + (i + 1) * 37,
                detail: 3,
                radius: 1.0,
                fracture: rng.range(0.65, 0.90),
                crags: rng.range(0.45, 0.68),
                rockType: subType,
                uvScale: 0.65,
                centerVertically: false
            })
            subGeo.computeBoundingBox()
            const sSize = subGeo.boundingBox.getSize(new THREE.Vector3())

            const radiusFactor = rng.range(0.42, 0.62)
            const heightFactor = rng.range(0.50, 0.84)
            const sx = (boxSize.x * radiusFactor) / Math.max(0.01, sSize.x)
            const sy = (boxSize.y * heightFactor) / Math.max(0.01, sSize.y)
            const sz = (boxSize.z * radiusFactor) / Math.max(0.01, sSize.z)

            addRockPiece(
                subGeo,
                boxCenter.x + ox,
                box.min.y - 0.12,
                boxCenter.z + oz,
                rng.range(-0.08, 0.08),
                rng.range(0, Math.PI * 2),
                rng.range(-0.08, 0.08),
                sx,
                sy,
                sz
            )
        }

        // 3. 3 guijarros/rocas pequeñas de detalle en la base (low-poly nivel 2)
        const pebbleCount = 3
        for(let p = 0; p < pebbleCount; p++)
        {
            const angle = (p / pebbleCount) * Math.PI * 2 + rng.range(0.2, 0.9)
            const ox = Math.cos(angle) * boxSize.x * rng.range(0.42, 0.56)
            const oz = Math.sin(angle) * boxSize.z * rng.range(0.42, 0.56)
            const r = rng.range(0.32, 0.58)

            const pGeo = buildRockGeometry({
                seed: baseSeed + boxIdx * 131 + (p + 1) * 53,
                detail: 2,
                radius: r,
                fracture: 0.85,
                crags: 0.50,
                rockType: mainType,
                uvScale: 1.25,
                centerVertically: false
            })

            addRockPiece(
                pGeo,
                boxCenter.x + ox,
                box.min.y + boxSize.y * 0.12,
                boxCenter.z + oz,
                0,
                rng.range(0, Math.PI * 2),
                0,
                1,
                1,
                1
            )
        }
    })

    const merged = mergeGeometries(geos, false)
    for(const g of geos) g.dispose()
    merged.computeBoundingBox()
    merged.computeBoundingSphere()

    return merged
}
