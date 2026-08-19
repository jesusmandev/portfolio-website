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
// TEXTURA DE HOJAS — silueta real de una hoja (no manchas pintadas).
// Fondo negro opaco + hoja blanca opaca: así el canal .r sirve como máscara
// de alpha sin depender de que el canvas se suba premultiplicado o no.
// ============================================================================
export function makeFoliageTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(size * 0.500, size * 0.015);
    ctx.bezierCurveTo(size * 0.705, size * 0.030, size * 0.860, size * 0.195, size * 0.875, size * 0.390);
    ctx.bezierCurveTo(size * 0.890, size * 0.585, size * 0.780, size * 0.820, size * 0.625, size * 0.930);
    ctx.bezierCurveTo(size * 0.578, size * 0.968, size * 0.531, size * 0.985, size * 0.500, size * 0.985);
    ctx.bezierCurveTo(size * 0.469, size * 0.985, size * 0.422, size * 0.968, size * 0.375, size * 0.930);
    ctx.bezierCurveTo(size * 0.220, size * 0.820, size * 0.110, size * 0.585, size * 0.125, size * 0.390);
    ctx.bezierCurveTo(size * 0.140, size * 0.195, size * 0.295, size * 0.030, size * 0.500, size * 0.015);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

// Cada "plano" de esta función es UNA hoja completa (usa toda la silueta de
// makeFoliageTexture en su UV 0..1), distribuidas en una nube esférica
// alrededor del origen con rotaciones 3D aleatorias.
export function buildFoliageGeometry(count = 22, planeSize = 0.45, rng) {
    const planes = [];

    for (let i = 0; i < count; i++) {
        const plane = new THREE.PlaneGeometry(planeSize, planeSize);

        const r = 0.85 - Math.pow(rng(), 2.5) * 0.85;
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);

        // Rotación 3D en los 3 ejes para orientar hojas en todas las direcciones
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

        const nonIndexed = plane.toNonIndexed();
        plane.dispose();
        planes.push(nonIndexed);
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

    const fallbackPlane = new THREE.PlaneGeometry(planeSize, planeSize).toNonIndexed();
    return fallbackPlane;
}

export function buildFoliageMaterial(colorShadow, colorMid, colorLight, colorRim, foliageTexture, lightDirection) {
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorLight),
        alphaMap: foliageTexture,
        transparent: false,
        alphaTest: 0.22,
        side: THREE.DoubleSide,
        roughness: 0.75,
        metalness: 0.05,
        shadowSide: THREE.FrontSide
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        mat.userData.shader = shader;

        shader.vertexShader = `
            uniform float uTime;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float swayNoise = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
            float sway = sin(uTime * 1.8 + position.x * 0.5 + position.z * 0.5 + swayNoise * 6.28) * 0.08;
            transformed.x += sway;
            transformed.z += sway * 0.6;
            transformed.y += sin(uTime * 1.2 + position.x * 0.3 + swayNoise * 6.28) * 0.02;
            `
        );
    };

    return mat;
}

// ============================================================================
// TRONCO ORGÁNICO — extrusión a lo largo de curvas Catmull-Rom con color de
// vértice (corteza), acanaladuras y raíces. Versión hueso con rayas negras.
// Devuelve `canopySources`, `endpoints` y la geometría fusionada del tronco.
// ============================================================================
export function buildOrganicTrunk(seed, opts = {}) {
    const rng = alea(seed + '-organic-trunk');

    const height      = opts.height      ?? 6.2;
    const trunkRadius = opts.trunkRadius ?? 0.30;
    const numRoots     = opts.numRoots     ?? 7;
    const rootLenMin    = opts.rootLenMin    ?? height * 0.16;
    const rootLenMax    = opts.rootLenMax    ?? height * 0.30;
    const sway          = opts.sway          ?? 1.0;
    const branchiness   = opts.branchiness   ?? 1.0;

    const positions = [];
    const indices = [];
    const colors = [];
    let vertexOffset = 0;

    const canopySources = [];
    const endpoints = [];

    // Colores hueso con rayas negras en las hendiduras
    const colorBase = new THREE.Color(0xf5e6d3);
    const colorMid = new THREE.Color(0xe8d4bd);
    const colorTip = new THREE.Color(0xfce7f3);

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
        // en el tronco principal ni en raíces.
        if (level >= 1) {
            const sampleEvery = Math.max(1, Math.floor(tubularSegments / 3));
            for (let si = 0; si <= tubularSegments; si += sampleEvery) {
                const st = si / tubularSegments;
                const sr = THREE.MathUtils.lerp(baseRad, tipRad, st);
                canopySources.push({ pos: points[si].clone(), radius: 0.90 + sr * 6.5 });
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

                // Hendiduras más oscuras para lograr el efecto de rayas negras
                const creviceDarkening = Math.min(0, fluting + n) * 2.6;
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
            if (level === 0) numChildren = Math.round(16 * branchiness);
            else if (level === 1) numChildren = Math.round(8 * branchiness);
            else if (level === 2) numChildren = Math.round(4 * branchiness);

            for (let k = 0; k < numChildren; k++) {
                const minT = level === 0 ? 0.28 : 0.1;
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

                const forwardBias = level === 0 ? 0.35 : 0.55;
                const childDir = new THREE.Vector3()
                    .copy(spawnTangent).multiplyScalar(forwardBias)
                    .add(outwardDir.multiplyScalar(1.0 - forwardBias))
                    .normalize();

                let lengthMultiplier = rand(0.60, 0.95);
                if (level === 0) {
                    const heightTaper = 1.0 - (spawnT * 0.35);
                    lengthMultiplier *= heightTaper;
                }

                const childLen = length * lengthMultiplier;
                const parentRadAtSpawn = THREE.MathUtils.lerp(baseRad, tipRad, spawnT);
                const childBaseRad = parentRadAtSpawn * rand(0.55, 0.85);
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
// Canopias redondas y ultra frondosas formadas por miles de hojas pequeñas.
// ============================================================================
const TREE_TYPE_CONFIGS = [
    {
        trunk: { height: 6.8, trunkRadius: 0.35, numRoots: 7, sway: 1.0, branchiness: 1.3 },
        foliage: { clumpCount: 110, planesPerClump: 88, planeSize: 0.32, scaleMin: 0.85, scaleMax: 1.30, radiusScale: 1.25 }
    },
    {
        trunk: { height: 9.5, trunkRadius: 0.28, numRoots: 6, sway: 0.8, branchiness: 1.1 },
        foliage: { clumpCount: 95, planesPerClump: 78, planeSize: 0.28, scaleMin: 0.80, scaleMax: 1.25, radiusScale: 1.15 }
    },
    {
        trunk: { height: 5.2, trunkRadius: 0.44, numRoots: 8, sway: 1.3, branchiness: 1.5 },
        foliage: { clumpCount: 120, planesPerClump: 96, planeSize: 0.35, scaleMin: 0.90, scaleMax: 1.40, radiusScale: 1.35 }
    },
    {
        trunk: { height: 7.8, trunkRadius: 0.30, numRoots: 7, sway: 0.9, branchiness: 1.2 },
        foliage: { clumpCount: 105, planesPerClump: 84, planeSize: 0.30, scaleMin: 0.85, scaleMax: 1.30, radiusScale: 1.20 }
    },
    {
        trunk: { height: 4.0, trunkRadius: 0.22, numRoots: 6, sway: 1.1, branchiness: 1.0 },
        foliage: { clumpCount: 85, planesPerClump: 72, planeSize: 0.26, scaleMin: 0.75, scaleMax: 1.15, radiusScale: 1.10 }
    }
];

// Paletas amarillas
export const TREE_PALETTES = [
    { shadow: 0xa16207, mid: 0xca8a04, light: 0xfacc15, rim: 0xfef08a },
    { shadow: 0x854d0e, mid: 0xb45309, light: 0xf59e0b, rim: 0xfde68a },
    { shadow: 0x713f12, mid: 0xd97706, light: 0xfcd34d, rim: 0xfef3c7 },
    { shadow: 0x7c2d12, mid: 0xc2410c, light: 0xfbbf24, rim: 0xfffbeb },
];

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
    const sources = trunkRes.canopySources.length
        ? [...trunkRes.canopySources, ...trunkRes.endpoints.map(p => ({ pos: p, radius: 1.8 }))]
        : [{ pos: new THREE.Vector3(0, trunkRes.height * 0.85, 0), radius: 1.8 }];

    let clumpIdx = 0;
    for (let i = 0; i < fCfg.clumpCount; i++) {
        const src = sources[Math.floor(rng() * sources.length)];
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
// HOJAS CAYENDO — un único sistema compartido para TODA la ciudad.
// Nace en puntos reales de copas de árboles ya plantados, cae, se posa en el
// suelo un rato y se recicla. Costo fijo sin importar cuántos árboles haya.
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
    const leafColors = [0xfacc15, 0xfef08a, 0xfde047, 0xeab308, 0xca8a04, 0xfef9c3];
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
            delay: rng() * 25,
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
        mesh.frustumCulled = false;
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
        for (let p = 0; p < PALETTE_COUNT; p++) {
            const mat = buildFoliageMaterial(
                TREE_PALETTES[p].shadow,
                TREE_PALETTES[p].mid,
                TREE_PALETTES[p].light,
                TREE_PALETTES[p].rim,
                foliageTexture,
                lightDir
            );
            if (opts.cityLeafMaterials) {
                opts.cityLeafMaterials.add(mat);
            }
            const mesh = new THREE.InstancedMesh(templates[i].foliageGeometries[p], mat, maxTrees);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position && mesh.geometry.attributes.position.count > 0) {
                mesh.geometry.computeBoundingSphere();
                if (mesh.geometry.boundingSphere && !isNaN(mesh.geometry.boundingSphere.radius)) {
                    mesh.geometry.boundingSphere.radius *= 4;
                }
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
        addTree(x, z, scale = 1, typeIndex = null, y = 0) {
            const type = typeIndex !== null ? Math.floor(Math.abs(typeIndex) % TYPE_COUNT) : Math.floor(Math.random() * TYPE_COUNT);
            if (counts[type] >= maxTrees) return false;

            const idx = counts[type];
            dummy.position.set(x, y, z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();

            trunkMeshes[type].setMatrixAt(idx, dummy.matrix);

            for (let p = 0; p < PALETTE_COUNT; p++) {
                foliageMeshes[type][p].setMatrixAt(idx, dummy.matrix);
            }

            // Registrar 1-2 puntos reales de copa (en espacio mundial) como
            // posibles orígenes de hojas cayendo.
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
