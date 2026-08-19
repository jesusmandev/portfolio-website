/**
 * palms.js — Procedural instanced palm trees for the city.
 *
 * Exports `createPalmManager(scene, parent, maxPalms, opts)` with the same
 * API as `createTreeManager` in trees.js (addPalm, finalize, update).
 *
 * Configured to generate exclusively the Tall Palm variant (slender).
 */
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
//  TEXTURA DEL TRONCO (canvas procedural)
// ─────────────────────────────────────────────────────────────────────────────

let _cachedTrunkTexture = null;
function makeTrunkTexture() {
    if (_cachedTrunkTexture) return _cachedTrunkTexture;

    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base tone (light yellowish-green of a palm trunk)
    ctx.fillStyle = '#dcd792';
    ctx.fillRect(0, 0, 256, 512);

    // Horizontal rings simulating palm leaf scar marks
    const numRings = 12;
    for (let i = 0; i < numRings; i++) {
        const y = (i / numRings) * 512;
        ctx.fillStyle = '#7a8234';
        ctx.fillRect(0, y, 256, 15);
        ctx.fillStyle = '#a6ab5e';
        ctx.fillRect(0, y - 5, 256, 5);
        ctx.fillRect(0, y + 15, 256, 10);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS    = THREE.RepeatWrapping;
    tex.wrapT    = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.needsUpdate = true;
    _cachedTrunkTexture = tex;
    return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRUNK GEOMETRY
//  Returns a conical cylinder BufferGeometry already centered at the base (y=0).
// ─────────────────────────────────────────────────────────────────────────────

function makeTrunkGeometry(height, radiusBottom, radiusTop) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12, 1);
    // Translate so the base sits at y = 0
    geo.translate(0, height / 2, 0);
    return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PALM LEAF GEOMETRY
//  Procedurally deformed plane that mimics a hanging leaf with cuts.
// ─────────────────────────────────────────────────────────────────────────────

function makePalmLeafGeometry(leafLength, leafWidth) {
    const geo = new THREE.PlaneGeometry(leafWidth, leafLength, 8, 16);
    // Translate so the leaf base sits at y=0 and grows toward +y
    geo.translate(0, leafLength / 2, 0);

    const posAttr = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);

        const t = v.y / leafLength; // 0 (base) → 1 (punta)

        // 1. Downward curvature from gravity
        v.z = Math.pow(t, 2.2) * leafLength * 0.65;

        // 2. Leaf width with organic profile
        let widthFactor = Math.sin(Math.pow(t, 0.7) * Math.PI);

        // 3. Cuts/fingers simulating pinnate leaf shape
        const dist = Math.abs(v.x) / (leafWidth / 2);
        if (dist > 0.15) {
            const cuts = Math.pow(Math.abs(Math.sin(t * Math.PI * 12)), 2);
            widthFactor -= cuts * 0.4 * dist;
        }
        v.x *= Math.max(0.02, widthFactor);

        // 4. Transverse V-curvature
        v.z -= Math.abs(v.x) * 0.4;

        posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CROWN GEOMETRY (merged group of leaves)
//  Returns a single BufferGeometry with all leaves arranged radially.
// ─────────────────────────────────────────────────────────────────────────────

function mergeBufferGeometriesSimple(geos) {
    let totalVerts = 0;
    for (const g of geos) totalVerts += g.attributes.position.count;

    const positions = new Float32Array(totalVerts * 3);
    const normals   = new Float32Array(totalVerts * 3);
    const uvs       = new Float32Array(totalVerts * 2);

    let offset = 0;
    for (const g of geos) {
        const n = g.attributes.position.count;
        positions.set(g.attributes.position.array, offset * 3);
        if (g.attributes.normal) normals.set(g.attributes.normal.array, offset * 3);
        if (g.attributes.uv)     uvs.set(g.attributes.uv.array, offset * 2);
        offset += n;
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    result.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
    result.setAttribute('uv',       new THREE.BufferAttribute(uvs,       2));
    return result;
}

function makePalmCrownGeometry(leafCount, leafLength, leafWidth) {
    const baseLeafGeo = makePalmLeafGeometry(leafLength, leafWidth);
    const geometries  = [];
    const dummy       = new THREE.Object3D();

    for (let i = 0; i < leafCount; i++) {
        // Copy and transform the leaf
        const angle = (i / leafCount) * Math.PI * 2;

        dummy.position.set(0, 0, 0);
        dummy.rotation.order = 'YXZ';
        dummy.rotation.y = angle + (Math.random() - 0.5) * 0.15;
        // Alternate two layers: upper and lower
        dummy.rotation.x = (i % 2 === 0)
            ? Math.PI / 2 - 0.05
            : Math.PI / 2 + 0.15;
        const s = 0.85 + Math.random() * 0.3;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();

        const clone = baseLeafGeo.clone();
        clone.applyMatrix4(dummy.matrix);
        geometries.push(clone);
    }

    let merged = null;
    try {
        merged = mergeBufferGeometriesSimple(geometries);
    } catch (e) {
        console.warn('[palms.js] Could not merge crown geometry:', e);
        merged = geometries[0] || new THREE.PlaneGeometry(0.001, 0.001);
    }

    baseLeafGeo.dispose();
    for (const g of geometries) g.dispose();
    return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PALM TYPE CONFIGURATION (Tall palm only)
// ─────────────────────────────────────────────────────────────────────────────

const PALM_TYPES = [
    {
        // Only type: Tall Palm (slender, slightly larger leaves)
        id: 'tall',
        trunkHeight:   18,
        trunkRadBot:    0.45,
        trunkRadTop:    0.22,
        leafCount:     24,
        leafLength:     6.3,
        leafWidth:      2.4,
        hasCrown:      true,
    }
];

function pickPalmType() {
    return 0; // Always tall palm
}

// ─────────────────────────────────────────────────────────────────────────────
//  MATERIALS
// ─────────────────────────────────────────────────────────────────────────────

let _trunkMat = null;
let _leafMat  = null;

function getTrunkMaterial() {
    if (_trunkMat) return _trunkMat;
    _trunkMat = new THREE.MeshStandardMaterial({
        map:       makeTrunkTexture(),
        roughness: 0.9,
        metalness: 0.0,
    });
    return _trunkMat;
}

function getLeafMaterial() {
    if (_leafMat) return _leafMat;
    _leafMat = new THREE.MeshStandardMaterial({
        color:     0x4ade2b,
        roughness: 0.6,
        metalness: 0.0,
        side:      THREE.DoubleSide,
    });
    return _leafMat;
}

function applyWindShader(mat) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        mat.userData.shader   = shader;

        shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float swayNoise = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
            float sway = sin(uTime * 1.5 + position.x * 0.5 + position.z * 0.5 + swayNoise * 6.28) * 0.04;
            transformed.x += sway;
            transformed.z += sway * 0.6;
            transformed.y += sin(uTime * 1.2 + position.x * 0.3 + swayNoise * 6.28) * 0.015;
            `
        );
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN MANAGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an instanced palm tree manager for the city.
 *
 * @param {THREE.Scene}  scene
 * @param {THREE.Object3D} parent  — root group where meshes are added
 * @param {number}  maxPalms       — maximum instances per type
 * @param {Object}  opts
 * @param {Set}     [opts.cityLeafMaterials]  — set of day/night materials
 * @param {Set}     [opts.cityBarkMaterials]  — set of day/night materials
 *
 * @returns {{ addPalm(x,z,scale,y), finalize(), update(time) }}
 */
export function createPalmManager(scene, parent, maxPalms = 400, opts = {}) {
    const TYPE_COUNT = PALM_TYPES.length;

    // Generate trunk and crown geometries per type
    const trunkGeos  = [];
    const crownGeos  = [];

    for (let t = 0; t < TYPE_COUNT; t++) {
        const cfg = PALM_TYPES[t];

        const tGeo = makeTrunkGeometry(cfg.trunkHeight, cfg.trunkRadBot, cfg.trunkRadTop);
        trunkGeos.push(tGeo);

        if (cfg.hasCrown && cfg.leafCount > 0) {
            const cGeo = makePalmCrownGeometry(cfg.leafCount, cfg.leafLength, cfg.leafWidth);
            cGeo.translate(0, cfg.trunkHeight, 0);
            crownGeos.push(cGeo);
        } else {
            const empty = new THREE.BufferGeometry();
            const dummy = new Float32Array([0, -9999, 0, 0, -9999, 0, 0, -9999, 0]);
            empty.setAttribute('position', new THREE.BufferAttribute(dummy, 3));
            crownGeos.push(empty);
        }
    }

    // Materials (shared between all types)
    const trunkMat = getTrunkMaterial();
    const leafMat  = getLeafMaterial();
    applyWindShader(leafMat);

    if (opts.cityBarkMaterials) opts.cityBarkMaterials.add(trunkMat);
    if (opts.cityLeafMaterials) opts.cityLeafMaterials.add(leafMat);

    // InstancedMesh per type — trunks
    const trunkMeshes = [];
    for (let t = 0; t < TYPE_COUNT; t++) {
        const mesh = new THREE.InstancedMesh(trunkGeos[t], trunkMat, maxPalms);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(mesh);
        trunkMeshes.push(mesh);
    }

    // InstancedMesh per type — crowns
    const crownMeshes = [];
    for (let t = 0; t < TYPE_COUNT; t++) {
        const mesh = new THREE.InstancedMesh(crownGeos[t], leafMat, maxPalms);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(mesh);
        crownMeshes.push(mesh);
    }

    const counts = new Array(TYPE_COUNT).fill(0);
    const dummy  = new THREE.Object3D();

    return {
        /**
         * Adds a palm tree at (x, y, z) with the given scale.
         * Type is selected randomly based on the defined distribution:
         * 15% no leaves, 15% few leaves, 28% tall, 42% normal.
         *
         * @param {number} x
         * @param {number} z
         * @param {number} [scale=1]
         * @param {number} [y=0]       — base height (ground)
         * @param {number|null} [typeIndex=null] — forces a specific type (0-3)
         * @returns {boolean}  false if the instance limit was exceeded
         */
        addPalm(x, z, scale = 1, y = 0, typeIndex = null) {
            const type = (typeIndex !== null && typeIndex >= 0 && typeIndex < TYPE_COUNT)
                ? typeIndex
                : pickPalmType();

            if (counts[type] >= maxPalms) return false;

            const idx = counts[type];

            dummy.position.set(x, y, z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();

            trunkMeshes[type].setMatrixAt(idx, dummy.matrix);
            crownMeshes[type].setMatrixAt(idx, dummy.matrix);

            counts[type]++;
            return true;
        },

        /** Call once after adding all palm trees. */
        finalize() {
            for (let t = 0; t < TYPE_COUNT; t++) {
                trunkMeshes[t].count = counts[t];
                trunkMeshes[t].instanceMatrix.needsUpdate = true;
                crownMeshes[t].count = counts[t];
                crownMeshes[t].instanceMatrix.needsUpdate = true;
            }
        },

        /** Update the time uniform for wind animation. */
        update(time) {
            const shader = leafMat.userData.shader;
            if (shader && shader.uniforms && shader.uniforms.uTime) {
                shader.uniforms.uTime.value = time;
            }
        },

        /** Releases GPU resources when the manager is no longer needed. */
        dispose() {
            for (let t = 0; t < TYPE_COUNT; t++) {
                trunkGeos[t].dispose();
                crownGeos[t].dispose();
                trunkMeshes[t].dispose();
                crownMeshes[t].dispose();
            }
            if (_trunkMat) { _trunkMat.dispose(); _trunkMat = null; }
            if (_leafMat)  { _leafMat.dispose();  _leafMat  = null; }
            if (_cachedTrunkTexture) { _cachedTrunkTexture.dispose(); _cachedTrunkTexture = null; }
        },
    };
}
