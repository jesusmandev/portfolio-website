import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Seeded generator (idéntico al original)
export function alea(seed) {
    let s0 = 0, s1 = 0, s2 = 0, c = 1;
    function mash(str) {
        let n = 0xefc8249d;
        for (let i = 0; i < str.length; i++) {
            n += str.charCodeAt(i);
            let h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000;
        }
        return (n >>> 0) * 2.3283064365386963e-10;
    }
    s0 = mash(' '); s1 = mash(' '); s2 = mash(' ');
    s0 -= mash(seed); if (s0 < 0) s0 += 1;
    s1 -= mash(seed); if (s1 < 0) s1 += 1;
    s2 -= mash(seed); if (s2 < 0) s2 += 1;
    return function() {
        const t = 2091639 * s0 + c * 2.3283064365386963e-10;
        s0 = s1; s1 = s2;
        return s2 = t - (c = t | 0);
    };
}

// ============================================================================
// TEXTURAS Y MÁSCARAS DE HOJA REALISTAS (Diseño Original HTML)
// ============================================================================
export function createLeafTexture(darkColor, lightColor) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // Hoja ancha y redondeada
    ctx.beginPath();
    ctx.moveTo(128, 4);
    ctx.bezierCurveTo(180, 8, 220, 50, 224, 100);
    ctx.bezierCurveTo(228, 150, 200, 210, 160, 238);
    ctx.bezierCurveTo(148, 248, 136, 254, 128, 254);
    ctx.bezierCurveTo(120, 254, 108, 248, 96, 238);
    ctx.bezierCurveTo(56, 210, 28, 150, 32, 100);
    ctx.bezierCurveTo(36, 50, 76, 8, 128, 4);
    ctx.closePath();

    const g = ctx.createLinearGradient(60, 10, 200, 246);
    g.addColorStop(0, lightColor);
    g.addColorStop(0.5, darkColor);
    g.addColorStop(1, darkColor);
    ctx.fillStyle = g;
    ctx.fill();

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
}

let cachedAlphaMask = null;
export function createLeafAlphaMask() {
    if (cachedAlphaMask) return cachedAlphaMask;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.moveTo(128, 4);
    ctx.bezierCurveTo(180, 8, 220, 50, 224, 100);
    ctx.bezierCurveTo(228, 150, 200, 210, 160, 238);
    ctx.bezierCurveTo(148, 248, 136, 254, 128, 254);
    ctx.bezierCurveTo(120, 254, 108, 248, 96, 238);
    ctx.bezierCurveTo(56, 210, 28, 150, 32, 100);
    ctx.bezierCurveTo(36, 50, 76, 8, 128, 4);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    cachedAlphaMask = t;
    return t;
}

export function makeFoliageTexture() {
    return createLeafAlphaMask();
}

export function buildFoliageGeometry(count = 32, planeSize = 0.38, rng) {
    const planes = [];

    for (let i = 0; i < count; i++) {
        const plane = new THREE.PlaneGeometry(planeSize, planeSize);

        const r = 0.85 - Math.pow(rng(), 2.5) * 0.85;
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);

        plane.rotateX(rng() * Math.PI);
        plane.rotateY(rng() * Math.PI * 2);
        plane.rotateZ(rng() * Math.PI);

        plane.translate(x, y, z);

        const normal = new THREE.Vector3(x, y, z).normalize();
        const posAttr = plane.attributes.position;
        const normalArray = new Float32Array(posAttr.count * 3);

        for (let v = 0; v < posAttr.count; v++) {
            const vp = new THREE.Vector3(
                posAttr.array[v * 3],
                posAttr.array[v * 3 + 1],
                posAttr.array[v * 3 + 2]
            ).normalize();
            const mixedNormal = vp.lerp(normal, 0.85).normalize();
            normalArray[v * 3] = mixedNormal.x;
            normalArray[v * 3 + 1] = mixedNormal.y;
            normalArray[v * 3 + 2] = mixedNormal.z;
        }
        plane.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));

        planes.push(plane);
    }

    try {
        const merged = mergeGeometries(planes);
        for (let p of planes) p.dispose();
        if (merged && merged.attributes && merged.attributes.position && merged.attributes.position.count > 0) {
            return merged;
        }
    } catch (e) {
        console.warn('[trees.js] mergeGeometries falló en buildFoliageGeometry:', e);
        for (let p of planes) p.dispose();
    }

    return new THREE.PlaneGeometry(planeSize, planeSize);
}

export function buildFoliageMaterial(darkColor, lightColor, foliageTexture, lightDirection) {
    const leafTex = (typeof darkColor === 'string')
        ? createLeafTexture(darkColor, lightColor)
        : createLeafTexture('#1B5E20', '#2E7D32');

    const alphaMask = createLeafAlphaMask();

    const mat = new THREE.MeshStandardMaterial({
        map: leafTex,
        alphaMap: alphaMask,
        transparent: false,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.7,
        metalness: 0.0,
        shadowSide: THREE.FrontSide
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = { value: 0 };
        shader.uniforms.uWindStrength = { value: 0 };
        mat.userData.shader = shader;

        shader.vertexShader = `
            uniform float uWindTime;
            uniform float uWindStrength;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            if (uWindStrength > 0.001) {
                float windFreq = 2.2 + uWindStrength * 3.5;
                float swayNoise = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
                float swayAmp = uWindStrength * 0.38;
                float sway = sin(uWindTime * windFreq + position.x * 0.5 + position.z * 0.5 + swayNoise * 6.28) * swayAmp;
                transformed.x += sway;
                transformed.z += sway * 0.7;
                transformed.y += sin(uWindTime * (windFreq * 0.7) + position.x * 0.3 + swayNoise * 6.28) * (swayAmp * 0.22);
            }
            `
        );
    };

    if (!window.windMaterials) window.windMaterials = [];
    if (!window.windMaterials.includes(mat)) {
        window.windMaterials.push(mat);
    }

    return mat;
}

// ============================================================================
// TRONCO ORGÁNICO — extrusión a lo largo de curvas Catmull-Rom con color de
// vértice (corteza), acanaladuras y raíces. Es el mismo sistema del árbol
// "hero" standalone, adaptado para producir UNA sola geometría fusionada
// por tipo de árbol (compatible con InstancedMesh).
// Devuelve además `canopySources` (puntos + radio a lo largo de las ramas,
// nunca en el tronco principal) y `endpoints` (puntas de rama), que se usan
// después para anclar el follaje y para hacer nacer las hojas que caen.
// ============================================================================
export function buildOrganicTrunk(seed, opts = {}) {
    const rng = alea(seed + '-organic-trunk');

    const height      = opts.height      ?? 4.5;
    const trunkRadius = opts.trunkRadius ?? 0.28;
    const numRoots     = opts.numRoots     ?? 6;
    const rootLenMin    = opts.rootLenMin    ?? height * 0.16;
    const rootLenMax    = opts.rootLenMax    ?? height * 0.30;
    const sway          = opts.sway          ?? 1.0;   // multiplicador de curvatura del tronco
    const branchiness   = opts.branchiness   ?? 1.0;   // multiplicador de nº de ramas hijas
    const isBone        = opts.isBone        ?? false;

    const positions = [];
    const indices = [];
    const colors = [];
    let vertexOffset = 0;

    const canopySources = [];
    const endpoints = [];

    // Tronco de madera clásico o tronco de hueso con vetas oscuras (tree2.js)
    const colorBase = isBone ? new THREE.Color(0xf5e6d3) : new THREE.Color(0x8b6540);
    const colorMid  = isBone ? new THREE.Color(0xe8d4bd) : new THREE.Color(0xbd8f5b);
    const colorTip  = isBone ? new THREE.Color(0xfce7f3) : new THREE.Color(0x8ebf49);
    const creviceMult = isBone ? 2.6 : 1.2;

    function noise3D(x, y, z) {
        return Math.sin(x * 1.5 + Math.cos(y * 1.2)) * Math.cos(z * 1.5 + Math.sin(x * 1.1));
    }
    function rand(min, max) {
        return min + rng() * (max - min);
    }

    function growBranch(startPt, dir, length, baseRad, tipRad, level, angleTwist) {
        const isRoot = level === -1;

        const controlPoints = [];
        let currentPt = startPt.clone();
        let currentDir = dir.clone().normalize();
        const numSplinePts = isRoot ? 3 : 5;

        for (let i = 0; i <= numSplinePts; i++) {
            controlPoints.push(currentPt.clone());

            if (i < numSplinePts) {
                if (!isRoot) {
                    if (level === 0) {
                        currentDir.x += rand(-0.02, 0.02) * sway;
                        currentDir.z += rand(-0.02, 0.02) * sway;
                        currentDir.y += 0.1;
                    } else {
                        const heightFactor = currentPt.y / (height * 0.7);
                        const droop = level > 1 ? -0.08 : 0;
                        currentDir.y += (heightFactor * 0.15) + droop;
                        currentDir.x += rand(-0.05, 0.05) * sway;
                        currentDir.z += rand(-0.05, 0.05) * sway;
                    }
                } else {
                    currentDir.y -= rand(0.2, 0.5);
                }

                currentDir.normalize();
                const segLen = length / numSplinePts;
                currentPt.add(currentDir.clone().multiplyScalar(segLen));
            }
        }

        const curve = new THREE.CatmullRomCurve3(controlPoints);

        let tubularSegments = Math.max(6, Math.floor(length * 4));
        let radialSegments = 8;
        if (level === 0) radialSegments = 16;
        else if (level === 1) radialSegments = 10;
        else if (isRoot) radialSegments = 8;

        const points = curve.getPoints(tubularSegments);
        const frames = curve.computeFrenetFrames(tubularSegments, false);

        // Puntos de anclaje para el follaje: solo en ramas (nivel >= 1), nunca
        // en el tronco principal ni en raíces — así las hojas no "flotan"
        // pegadas al tronco desnudo.
        if (level >= 1) {
            const sampleEvery = Math.max(1, Math.floor(tubularSegments / 4));
            for (let si = 0; si <= tubularSegments; si += sampleEvery) {
                const st = si / tubularSegments;
                const sr = THREE.MathUtils.lerp(baseRad, tipRad, st);
                canopySources.push({ pos: points[si].clone(), radius: 0.55 + sr * 4.2 });
            }
            endpoints.push(points[tubularSegments].clone());
        }

        const localVertexOffset = vertexOffset;

        for (let i = 0; i <= tubularSegments; i++) {
            const pt = points[i];
            const t = i / tubularSegments;
            const normal = frames.normals[i];
            const binormal = frames.binormals[i];

            let r = THREE.MathUtils.lerp(baseRad, tipRad, t);

            if (level === 0 && t < 0.25) {
                const flare = Math.pow(1.0 - (t / 0.25), 2.5) * baseRad * 1.2;
                r += flare;
            }
            if (isRoot && t < 0.3) {
                r += Math.pow(1.0 - (t / 0.3), 2.0) * baseRad * 0.5;
            }

            let vColor = new THREE.Color().lerpColors(colorBase, colorMid, Math.min(1.0, pt.y / (height * 0.55)));
            if (level >= 2) {
                vColor.lerp(colorTip, t);
            }

            for (let j = 0; j <= radialSegments; j++) {
                const v = j / radialSegments;
                let theta = v * Math.PI * 2;
                theta += t * angleTwist;

                let fluting = 0;
                if (level <= 1 || isRoot) {
                    const flutes = level === 0 ? 8 : 4;
                    fluting = Math.sin(theta * flutes) * r * (level === 0 ? 0.10 : 0.06);
                    fluting *= (1.0 - t * 0.5);
                }

                const noiseFreq = 4.5;
                const n = noise3D(pt.x * noiseFreq, pt.y * noiseFreq, pt.z * noiseFreq) * r * 0.08;

                const creviceDarkening = Math.min(0, fluting + n) * creviceMult;
                const finalColor = vColor.clone();
                finalColor.r = Math.max(0, finalColor.r + creviceDarkening);
                finalColor.g = Math.max(0, finalColor.g + creviceDarkening);
                finalColor.b = Math.max(0, finalColor.b + creviceDarkening);

                const finalR = r + fluting + n;

                const sin = Math.sin(theta);
                const cos = Math.cos(theta);

                const vertex = new THREE.Vector3()
                    .copy(pt)
                    .add(normal.clone().multiplyScalar(cos * finalR))
                    .add(binormal.clone().multiplyScalar(sin * finalR));

                positions.push(vertex.x, vertex.y, vertex.z);
                colors.push(finalColor.r, finalColor.g, finalColor.b);
            }
        }

        for (let i = 0; i < tubularSegments; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const a = localVertexOffset + i * (radialSegments + 1) + j;
                const b = localVertexOffset + (i + 1) * (radialSegments + 1) + j;
                const c = localVertexOffset + i * (radialSegments + 1) + (j + 1);
                const d = localVertexOffset + (i + 1) * (radialSegments + 1) + (j + 1);
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }

        vertexOffset += (tubularSegments + 1) * (radialSegments + 1);

        if (level >= 0 && level < 3) {
            let numChildren = 0;
            if (level === 0) numChildren = Math.round(9 * branchiness);
            else if (level === 1) numChildren = Math.round(4 * branchiness);
            else if (level === 2) numChildren = Math.round(2 * branchiness);

            for (let k = 0; k < numChildren; k++) {
                const minT = level === 0 ? 0.35 : 0.1;
                const spawnT = rand(minT, 0.95);

                const spawnIndex = Math.floor(spawnT * tubularSegments);
                const spawnPt = points[spawnIndex];
                const spawnTangent = frames.tangents[spawnIndex];
                const spawnNormal = frames.normals[spawnIndex];
                const spawnBinormal = frames.binormals[spawnIndex];

                const angle = rand(0, Math.PI * 2);
                const outwardDir = new THREE.Vector3()
                    .copy(spawnNormal).multiplyScalar(Math.cos(angle))
                    .add(spawnBinormal.clone().multiplyScalar(Math.sin(angle)))
                    .normalize();

                const forwardBias = level === 0 ? 0.45 : 0.65;
                const childDir = new THREE.Vector3()
                    .copy(spawnTangent).multiplyScalar(forwardBias)
                    .add(outwardDir.multiplyScalar(1.0 - forwardBias))
                    .normalize();

                let lengthMultiplier = rand(0.45, 0.75);
                if (level === 0) {
                    const heightTaper = 1.0 - (spawnT * 0.35);
                    lengthMultiplier *= heightTaper;
                }

                const childLen = length * lengthMultiplier;
                const parentRadAtSpawn = THREE.MathUtils.lerp(baseRad, tipRad, spawnT);
                const childBaseRad = parentRadAtSpawn * rand(0.5, 0.8);
                const childTipRad = 0.015;

                const adjustedSpawn = spawnPt.clone().add(outwardDir.clone().multiplyScalar(-childBaseRad * 1.5));

                growBranch(adjustedSpawn, childDir, childLen, childBaseRad, childTipRad, level + 1, angleTwist * 1.5);
            }
        }
    }

    for (let r = 0; r < numRoots; r++) {
        const angle = (r / numRoots) * Math.PI * 2 + rand(-0.2, 0.2);
        const rootDir = new THREE.Vector3(Math.cos(angle), -0.5, Math.sin(angle)).normalize();
        const rootLen = rand(rootLenMin, rootLenMax);
        const rootStart = new THREE.Vector3(0, trunkRadius * 0.5, 0);
        growBranch(rootStart, rootDir, rootLen, trunkRadius * 0.8, 0.08, -1, 2.0);
    }

    growBranch(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0),
        height,
        trunkRadius,
        0.04,
        0,
        3.0
    );

    let geometry;
    if (positions.length > 0) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
    } else {
        geometry = new THREE.CylinderGeometry(trunkRadius * 0.3, trunkRadius, height, 6, 1, false);
        geometry.translate(0, height / 2, 0);
        const cylColors = [];
        const cylCount = geometry.attributes.position.count;
        for (let cIdx = 0; cIdx < cylCount; cIdx++) cylColors.push(0.55, 0.4, 0.25);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(cylColors, 3));
    }

    return { geometry, height, canopySources, endpoints };
}

function makeEmptyFoliagePlaceholder() {
    const geo = new THREE.PlaneGeometry(0.0001, 0.0001).toNonIndexed();
    geo.translate(0, -9999, 0);
    return geo;
}

// ============================================================================
// CONFIGS DE TIPOS DE ÁRBOL
// Verdes (classic), Cerezos Rosa (tree2.js), Grandes Dorados (tree3.js),
// Sauce Azul y Lavanda Compacto (tree4.js), Arbusto decorativo.
// ALTURA MÍNIMA de árbol real: 7.5m (> farola 7.35m).
// FOLLAJE ULTRA DENSO Y FRONDOSO (Coincide exactamente con la imagen de referencia 2).
// ============================================================================
const TREE_TYPE_CONFIGS = [
    {
        // Tipo 0: Roble verde clásico — copa masiva y muy tupida (follaje -10%)
        trunk: { height: 8.0, trunkRadius: 0.35, numRoots: 5, sway: 1.0, branchiness: 1.2, isBone: false },
        foliage: { clumpCount: 76, planesPerClump: 52, planeSize: 0.36, scaleMin: 0.85, scaleMax: 1.30, radiusScale: 1.25 }
    },
    {
        // Tipo 1: Cerezo Sakura (tree2.js) — tronco hueso, copa rosa exuberante (follaje -10%)
        trunk: { height: 7.8, trunkRadius: 0.32, numRoots: 5, sway: 1.1, branchiness: 1.3, isBone: true },
        foliage: { clumpCount: 81, planesPerClump: 56, planeSize: 0.38, scaleMin: 0.90, scaleMax: 1.35, radiusScale: 1.30 }
    },
    {
        // Tipo 2: Pino verde alto — follaje denso cónico (follaje -10%)
        trunk: { height: 9.0, trunkRadius: 0.28, numRoots: 4, sway: 0.7, branchiness: 1.0, isBone: false },
        foliage: { clumpCount: 63, planesPerClump: 43, planeSize: 0.32, scaleMin: 0.75, scaleMax: 1.15, radiusScale: 1.05 }
    },
    {
        // Tipo 3: Sakura rosa brillante (tree2.js) — copa magenta hiper-densa (follaje -10%)
        trunk: { height: 7.5, trunkRadius: 0.38, numRoots: 5, sway: 1.2, branchiness: 1.4, isBone: true },
        foliage: { clumpCount: 85, planesPerClump: 58, planeSize: 0.38, scaleMin: 0.95, scaleMax: 1.40, radiusScale: 1.35 }
    },
    {
        // Tipo 4: Olmo frondoso verde — gran volumen de hojas verdes (follaje -10%)
        trunk: { height: 7.6, trunkRadius: 0.42, numRoots: 5, sway: 1.1, branchiness: 1.3, isBone: false },
        foliage: { clumpCount: 79, planesPerClump: 54, planeSize: 0.38, scaleMin: 0.85, scaleMax: 1.30, radiusScale: 1.25 }
    },
    {
        // Tipo 5: Árbol 3 (tree3.js) — Gran Roble Dorado Gigante (follaje -10%)
        trunk: { height: 9.5, trunkRadius: 0.45, numRoots: 6, sway: 1.0, branchiness: 1.3, isBone: true },
        foliage: { clumpCount: 99, planesPerClump: 65, planeSize: 0.40, scaleMin: 1.05, scaleMax: 1.50, radiusScale: 1.40 }
    },
    {
        // Tipo 6: Árbol 3 (tree3.js) — Gran Árbol Amarillo Otoñal Colosal (follaje -10%)
        trunk: { height: 11.5, trunkRadius: 0.52, numRoots: 6, sway: 1.0, branchiness: 1.4, isBone: true },
        foliage: { clumpCount: 108, planesPerClump: 70, planeSize: 0.42, scaleMin: 1.15, scaleMax: 1.60, radiusScale: 1.45 }
    },
    {
        // Tipo 7: Arbusto decorativo compacto
        trunk: { height: 1.4, trunkRadius: 0.14, numRoots: 3, sway: 1.0, branchiness: 1.5, isBone: false },
        foliage: { clumpCount: 22, planesPerClump: 24, planeSize: 0.28, scaleMin: 0.75, scaleMax: 1.15, radiusScale: 0.95 }
    },
    {
        // Tipo 8: Sauce Azul (tree4.js) — copa azul-celeste gigante y espesa (follaje -10%)
        trunk: { height: 8.5, trunkRadius: 0.38, numRoots: 6, sway: 1.4, branchiness: 1.3, isBone: true },
        foliage: { clumpCount: 83, planesPerClump: 54, planeSize: 0.36, scaleMin: 0.90, scaleMax: 1.35, radiusScale: 1.30 }
    },
    {
        // Tipo 9: Lavanda Azul (tree4.js) — copa violeta tupida (follaje -10%)
        trunk: { height: 7.5, trunkRadius: 0.28, numRoots: 4, sway: 1.1, branchiness: 1.2, isBone: true },
        foliage: { clumpCount: 72, planesPerClump: 47, planeSize: 0.32, scaleMin: 0.85, scaleMax: 1.25, radiusScale: 1.15 }
    }
];

export const TREE_PALETTES_BY_TYPE = [
    // Tipo 0: Roble verde clásico
    [ { dark: '#1B5E20', light: '#2E7D32' }, { dark: '#33691E', light: '#7CB342' }, { dark: '#7CB342', light: '#DCE775' }, { dark: '#2E7D32', light: '#8BC34A' } ],
    // Tipo 1: Cerezo Sakura rosa
    [ { dark: '#be185d', light: '#db2777' }, { dark: '#9d174d', light: '#ff69b4' }, { dark: '#831843', light: '#f9a8d4' }, { dark: '#86198f', light: '#ec4899' } ],
    // Tipo 2: Pino verde oscuro
    [ { dark: '#0d3b1e', light: '#1b5e20' }, { dark: '#1b4d2e', light: '#2d6a4f' }, { dark: '#2d6a4f', light: '#40916c' }, { dark: '#1e3a2f', light: '#52b788' } ],
    // Tipo 3: Sakura magenta brillante
    [ { dark: '#c71585', light: '#ff69b4' }, { dark: '#db2777', light: '#f472b6' }, { dark: '#f472b6', light: '#fbcfe8' }, { dark: '#e11d48', light: '#fb7185' } ],
    // Tipo 4: Olmo verde medio
    [ { dark: '#33691E', light: '#689F38' }, { dark: '#558B2F', light: '#8BC34A' }, { dark: '#689F38', light: '#AED581' }, { dark: '#7CB342', light: '#C5E1A5' } ],
    // Tipo 5: Roble dorado otoñal
    [ { dark: '#a16207', light: '#facc15' }, { dark: '#b45309', light: '#f59e0b' }, { dark: '#d97706', light: '#fcd34d' }, { dark: '#c2410c', light: '#fbbf24' } ],
    // Tipo 6: Árbol amarillo gigante
    [ { dark: '#854d0e', light: '#fde047' }, { dark: '#a16207', light: '#facc15' }, { dark: '#713f12', light: '#fef08a' }, { dark: '#7c2d12', light: '#fde68a' } ],
    // Tipo 7: Arbusto verde compacto
    [ { dark: '#1B5E20', light: '#4CAF50' }, { dark: '#2E7D32', light: '#66BB6A' }, { dark: '#388E3C', light: '#81C784' }, { dark: '#1B5E20', light: '#A5D6A7' } ],
    // Tipo 8: Sauce Azul (tree4.js) — azul cielo y azul marino
    [ { dark: '#0c4a6e', light: '#38bdf8' }, { dark: '#1e3a8a', light: '#3b82f6' }, { dark: '#172554', light: '#60a5fa' }, { dark: '#1e40af', light: '#93c5fd' } ],
    // Tipo 9: Lavanda Compacto (tree4.js) — violeta y lavanda
    [ { dark: '#312e81', light: '#818cf8' }, { dark: '#4338ca', light: '#a5b4fc' }, { dark: '#3730a3', light: '#c7d2fe' }, { dark: '#5b21b6', light: '#ddd6fe' } ]
];

export const TREE_PALETTES = TREE_PALETTES_BY_TYPE[0];

export const TRUNK_MATERIAL = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: false,
    side: THREE.DoubleSide
});

/**
 * Genera la plantilla de un árbol: geometría de tronco orgánico (con color de
 * vértice) + 4 geometrías de follaje (una por paleta), ancladas a los puntos
 * reales de las ramas. También devuelve `endpoints` en espacio LOCAL, que
 * `createTreeManager` usa para hacer nacer hojas que caen en la posición
 * mundial real de cada árbol plantado.
 */
export function generateTreeTemplate(seed, typeIndex = 0) {
    const config = TREE_TYPE_CONFIGS[typeIndex % TREE_TYPE_CONFIGS.length];
    const rng = alea(seed + '-foliage');

    const trunkRes = buildOrganicTrunk(seed, config.trunk);
    const trunkGeometry = trunkRes.geometry;

    const fCfg = config.foliage;
    const foliageGeomsByPalette = [[], [], [], []];

    // Fuentes de anclaje: puntos a lo largo de las ramas + puntas de rama.
    const rawSources = trunkRes.canopySources.length
        ? [...trunkRes.canopySources, ...trunkRes.endpoints.map(p => ({ pos: p, radius: 1.5 }))]
        : [{ pos: new THREE.Vector3(0, trunkRes.height * 0.85, 0), radius: 1.5 }];

    // Agregar puntos distribuidos en cúpula 360° para garantizar copa esférica "redondita"
    const crownCenterY = trunkRes.height * 0.72;
    const crownRadius  = trunkRes.height * 0.38;
    const domeSamples = 45;
    for (let c = 0; c < domeSamples; c++) {
        const theta = (c / domeSamples) * Math.PI * 2 + rng() * 0.2;
        const phi = Math.acos(2 * (0.15 + rng() * 0.78) - 1);
        const r = crownRadius * (0.35 + rng() * 0.65);
        const px = r * Math.sin(phi) * Math.cos(theta);
        const py = crownCenterY + r * Math.cos(phi) * 0.75;
        const pz = r * Math.sin(phi) * Math.sin(theta);
        rawSources.push({ pos: new THREE.Vector3(px, py, pz), radius: 1.6 });
    }

    // Mezcla determinista con rng() para distribuir el follaje 360° por igual en todos los lados
    const sources = rawSources.slice();
    for (let i = sources.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [sources[i], sources[j]] = [sources[j], sources[i]];
    }

    let clumpIdx = 0;
    for (let i = 0; i < fCfg.clumpCount; i++) {
        // Muestreo uniforme 360° para cobertura redonda en todo el árbol
        const src = sources[i % sources.length];
        const paletteIndex = clumpIdx < 4 ? clumpIdx : Math.floor(rng() * 4);
        const scale = fCfg.scaleMin + rng() * (fCfg.scaleMax - fCfg.scaleMin);
        const clumpRadius = (src.radius || 1) * fCfg.radiusScale;

        const clumpGeo = buildFoliageGeometry(fCfg.planesPerClump, fCfg.planeSize, rng);
        clumpGeo.scale(scale * clumpRadius, scale * clumpRadius, scale * clumpRadius);
        clumpGeo.rotateY(rng() * Math.PI * 2);
        clumpGeo.translate(src.pos.x, src.pos.y, src.pos.z);

        foliageGeomsByPalette[paletteIndex].push(clumpGeo);
        clumpIdx++;
    }

    const foliageGeometries = [];
    for (let p = 0; p < 4; p++) {
        const geoms = foliageGeomsByPalette[p];
        if (geoms.length > 0) {
            foliageGeometries[p] = mergeGeometries(geoms);
            if (!foliageGeometries[p]) {
                console.warn(`[trees.js] Fallo al fusionar follaje paleta ${p}, se usa geometría vacía de respaldo.`);
                foliageGeometries[p] = makeEmptyFoliagePlaceholder();
            }
            for (let g of geoms) g.dispose();
        } else {
            foliageGeometries[p] = makeEmptyFoliagePlaceholder();
        }
    }

    // Un puñado de puntos de "punta de rama" en espacio local, para que
    // el sistema de hojas cayendo sepa dónde nacer en cada árbol plantado.
    const localEndpoints = trunkRes.endpoints.length
        ? trunkRes.endpoints.filter((_, idx) => idx % 3 === 0).slice(0, 6)
        : [new THREE.Vector3(0, trunkRes.height * 0.85, 0)];

    return { trunkGeometry, foliageGeometries, endpoints: localEndpoints };
}

// ============================================================================
// HOJAS CAYENDO — un único sistema compartido para TODA la ciudad (no uno
// por árbol). Nace en puntos reales de copas de árboles ya plantados, cae,
// se posa en el suelo un rato y se recicla. Costo fijo sin importar cuántos
// árboles haya.
// ============================================================================
function createFallingLeavesSystem(parent, foliageTexture, maxLeaves = 260) {
    const leafGeo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshStandardMaterial({
        alphaMap: foliageTexture,
        transparent: false,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0.0
    });

    const mesh = new THREE.InstancedMesh(leafGeo, mat, maxLeaves);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    parent.add(mesh);

    const rng = alea('falling-leaves-city');
    const leafColors = [0x7CB342, 0xDCE775, 0x8BC34A, 0x9CCC65, 0xAED581, 0x558B2F];
    const color = new THREE.Color();
    const dummy = new THREE.Object3D();

    const data = [];
    for (let i = 0; i < maxLeaves; i++) {
        data.push({
            pos: new THREE.Vector3(0, -9999, 0),
            vy: 0,
            driftPhase: 0,
            driftAmp: 0,
            rotSpeed: 0,
            rot: new THREE.Euler(),
            scale: 0.001,
            delay: rng() * 25, // arranques escalonados al iniciar
            landed: false,
            restTimer: 0,
            colorIdx: Math.floor(rng() * leafColors.length)
        });
    }

    let spawnPool = [];
    let lastTime = null;

    function spawnFrom(d, originPos) {
        d.pos = originPos.clone().add(new THREE.Vector3(
            (rng() - 0.5) * 1.6, rng() * 1.0, (rng() - 0.5) * 1.6
        ));
        d.vy = -(0.5 + rng() * 0.45);
        d.driftPhase = rng() * 10;
        d.driftAmp = 0.25 + rng() * 0.4;
        d.rotSpeed = (rng() - 0.5) * 2.0;
        d.rot = new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        d.scale = 0.85 + rng() * 0.5;
        d.landed = false;
        d.restTimer = 0;
        d.colorIdx = Math.floor(rng() * leafColors.length);
    }

    return {
        setSpawnPool(points) {
            spawnPool = points;
        },
        update(time) {
            if (spawnPool.length === 0) return;
            if (lastTime === null) lastTime = time;
            const dt = Math.min(0.05, Math.max(0, time - lastTime));
            lastTime = time;

            for (let i = 0; i < maxLeaves; i++) {
                const d = data[i];

                if (d.delay > 0) {
                    d.delay -= dt;
                } else if (d.landed) {
                    d.restTimer -= dt;
                    if (d.restTimer <= 0) {
                        spawnFrom(d, spawnPool[Math.floor(rng() * spawnPool.length)]);
                        d.delay = rng() * 2;
                    }
                } else if (d.pos.y < -9000) {
                    spawnFrom(d, spawnPool[Math.floor(rng() * spawnPool.length)]);
                } else {
                    d.pos.y += d.vy * dt;
                    d.pos.x += Math.sin(time * 0.6 + d.driftPhase) * d.driftAmp * dt;
                    d.pos.z += Math.cos(time * 0.5 + d.driftPhase) * d.driftAmp * dt;
                    d.rot.x += d.rotSpeed * dt;
                    d.rot.z += d.rotSpeed * 0.7 * dt;

                    if (d.pos.y <= 0.03) {
                        d.pos.y = 0.02;
                        d.rot.set(-Math.PI / 2 + (rng() - 0.5) * 0.4, rng() * Math.PI * 2, (rng() - 0.5) * 0.4);
                        d.landed = true;
                        d.restTimer = 6 + rng() * 14;
                    }
                }

                dummy.position.copy(d.pos);
                dummy.rotation.copy(d.rot);
                dummy.scale.setScalar(d.scale);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                color.set(leafColors[d.colorIdx]);
                mesh.setColorAt(i, color);
            }

            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    };
}

/**
 * Crea un manager de árboles instanciados para toda la ciudad.
 * Devuelve un objeto con métodos addTree(x,z,scale) y update(time).
 */
export function createTreeManager(scene, parent, maxTrees = 600, opts = {}) {
    const TYPE_COUNT = TREE_TYPE_CONFIGS.length;
    const PALETTE_COUNT = TREE_PALETTES.length;
    const maxFallingLeaves = opts.maxFallingLeaves ?? 260;

    // Generar plantillas una vez por tipo
    const templates = [];
    for (let i = 0; i < TYPE_COUNT; i++) {
        templates.push(generateTreeTemplate(`city-tree-type-${i}`, i));
    }

    // Un InstancedMesh por tipo para troncos
    const trunkMeshes = [];
    for (let i = 0; i < TYPE_COUNT; i++) {
        const mesh = new THREE.InstancedMesh(templates[i].trunkGeometry, TRUNK_MATERIAL, maxTrees);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position && mesh.geometry.attributes.position.count > 0) {
            mesh.geometry.computeBoundingSphere();
        }
        if (!mesh.geometry.boundingSphere) {
            mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 350);
        } else {
            mesh.geometry.boundingSphere.center.set(0, 5, 0);
            mesh.geometry.boundingSphere.radius = 350;
        }
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(mesh);
        trunkMeshes.push(mesh);
    }

    // 4 InstancedMesh de follaje por tipo (uno por paleta)
    const foliageTexture = makeFoliageTexture();
    const lightDir = new THREE.Vector3(0.5, 1, 0.3).normalize();
    const foliageMeshes = []; // [type][palette]
    for (let i = 0; i < TYPE_COUNT; i++) {
        const typeFoliage = [];
        const palList = TREE_PALETTES_BY_TYPE[i] || TREE_PALETTES_BY_TYPE[0];
        for (let p = 0; p < PALETTE_COUNT; p++) {
            const pal = palList[p];
            const mat = buildFoliageMaterial(
                pal.dark,
                pal.light,
                foliageTexture,
                lightDir
            );
            if (opts.cityLeafMaterials) {
                opts.cityLeafMaterials.add(mat);
            }
            const mesh = new THREE.InstancedMesh(templates[i].foliageGeometries[p], mat, maxTrees);
            // Optimización GPU principal: El tronco proyecta la sombra del árbol en el suelo (castShadow = true).
            // Desactivar castShadow en el follaje elimina 40 pases alphaTest extremadamente pesados en el mapa de sombras.
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = true;
        if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position && mesh.geometry.attributes.position.count > 0) {
            mesh.geometry.computeBoundingSphere();
        }
        if (!mesh.geometry.boundingSphere) {
            mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 350);
        } else {
            mesh.geometry.boundingSphere.center.set(0, 5, 0);
            mesh.geometry.boundingSphere.radius = 350;
        }
            parent.add(mesh);
            typeFoliage.push(mesh);
        }
        foliageMeshes.push(typeFoliage);
    }

    // Sistema de hojas cayendo compartido por toda la ciudad
    const fallingLeaves = createFallingLeavesSystem(parent, foliageTexture, maxFallingLeaves);
    const endpointPool = [];
    const MAX_POOL = 2000;

    const counts = new Array(TYPE_COUNT).fill(0);
    const dummy = new THREE.Object3D();

    return {
        addTree(x, z, scale = 1, typeIndex = null, y = 0, dry = false) {
            // Tipos 7-9 (arbusto, sauce azul, lavanda) solo se colocan explícitamente.
            // La selección aleatoria (null) elige entre tipos 0-6 (verdes/sakura/dorados).
            const NATURAL_TYPES = 7; // índices 0..6
            const type = typeIndex !== null
                ? Math.floor(Math.abs(typeIndex) % TYPE_COUNT)
                : Math.floor(Math.random() * NATURAL_TYPES);
            if (counts[type] >= maxTrees) return false;

            const idx = counts[type];
            dummy.position.set(x, y, z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();

            trunkMeshes[type].setMatrixAt(idx, dummy.matrix);

            if (dry) {
                // Árbol seco: ocultar todo el follaje (escala 0 en la instancia)
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                for (let p = 0; p < PALETTE_COUNT; p++) {
                    foliageMeshes[type][p].setMatrixAt(idx, dummy.matrix);
                }
                // Restaurar para registros de copa (no aplica en árbol seco)
                dummy.scale.setScalar(scale);
                dummy.updateMatrix();
            } else {
                for (let p = 0; p < PALETTE_COUNT; p++) {
                    foliageMeshes[type][p].setMatrixAt(idx, dummy.matrix);
                }
                // Registrar 1-2 puntos reales de copa como orígenes de hojas cayendo
                if (endpointPool.length < MAX_POOL) {
                    const localPts = templates[type].endpoints;
                    const picks = Math.min(2, localPts.length);
                    for (let k = 0; k < picks; k++) {
                        const src = localPts[Math.floor(Math.random() * localPts.length)];
                        const worldPt = src.clone().applyMatrix4(dummy.matrix);
                        endpointPool.push(worldPt);
                        if (endpointPool.length >= MAX_POOL) break;
                    }
                }
            }

            counts[type]++;
            return true;
        },
        finalize() {
            for (let i = 0; i < TYPE_COUNT; i++) {
                trunkMeshes[i].count = counts[i];
                trunkMeshes[i].instanceMatrix.needsUpdate = true;
                for (let p = 0; p < PALETTE_COUNT; p++) {
                    foliageMeshes[i][p].count = counts[i];
                    foliageMeshes[i][p].instanceMatrix.needsUpdate = true;
                }
            }
            fallingLeaves.setSpawnPool(endpointPool);
        },
        update(time) {
            for (let i = 0; i < TYPE_COUNT; i++) {
                for (let p = 0; p < PALETTE_COUNT; p++) {
                    const shader = foliageMeshes[i][p].material.userData.shader;
                    if (shader && shader.uniforms && shader.uniforms.uTime) {
                        shader.uniforms.uTime.value = time;
                    }
                }
            }
            fallingLeaves.update(time);
        }
    };
}