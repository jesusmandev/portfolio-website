import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * TrimeshCollider.js — Full Trimesh collider generator for Rapier
 *
 * Recursively traverses a THREE.Object3D (city or field GLB) and creates a
 * Trimesh collider for each visible mesh, mapping EXACTLY the real geometry:
 * hills, slopes, bridges, buildings, poles, fences, chairs, etc.
 *
 * Soporta InstancedMesh (generado por gltf-transform optimize --instance)
 * y buffers interleaved (generado por gltf-transform optimize --meshopt).
 *
 * @param {THREE.Object3D} group - Grupo/escena del GLB cargado
 * @param {RAPIER.World} physicsWorld - Rapier physics world
 * @param {string} label - Label for logs (e.g. 'cityMaterial', 'fieldMaterial')
 * @returns {RAPIER.RigidBody} El rigid body fijo con todos los colliders
 */

// Minimum triangles to create a Rapier trimesh.
// Meshes with fewer triangles are decorative props (flowers, loose leaves, low-poly
// details) that don't provide useful collision but do add broadphase cost in Rapier.
const MIN_TRIS_FOR_TRIMESH = 20;

// Keywords for purely decorative meshes that don't need physical collision
// even if they have more than MIN_TRIS_FOR_TRIMESH triangles (leaves, flowers, fine grass).
const DECORATIVE_KEYWORDS = [
    'leaf', 'leaves', 'foliage', 'flower', 'petal',
    'grass_blade', 'blade', 'fern', 'weed', 'shrub_detail',
];

export async function addTrimeshPhysics(group, physicsWorld, label) {
    // Ensure world transformation matrices are up to date
    group.updateMatrixWorld(true);

    // Un solo RigidBody fijo para todos los colliders de este GLB
    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    const terrainBody = physicsWorld.createRigidBody(bodyDesc);

    // Diagnostic metrics
    let meshesProcessed = 0;
    let instancesProcessed = 0;
    let meshesSkipped = 0;
    let totalTriangles = 0;
    let nanCorrected = 0;

    /**
     * Extracts transformed vertices from a geometry using a world matrix.
     * Uses getX/getY/getZ to be compatible with InterleavedBufferAttribute
     * (produced by gltf-transform optimize --meshopt).
     *
     * Instead of cloning the geometry and calling applyMatrix4 (which can fail
     * with interleaved buffers), we extract each vertex individually and
     * transform it manually with the matrix.
     */
    function extractTransformedVertices(geometry, worldMatrix) {
        const posAttr = geometry.attributes.position;
        const count = posAttr.count;
        const vertices = new Float32Array(count * 3);
        const v = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            v.applyMatrix4(worldMatrix);
            vertices[i * 3] = v.x;
            vertices[i * 3 + 1] = v.y;
            vertices[i * 3 + 2] = v.z;
        }

        return vertices;
    }

    /**
     * Extracts and sanitizes the indices of a geometry.
     * Filters degenerate triangles (repeated indices) and out-of-range indices.
     */
    function extractSanitizedIndices(geometry, vertexCount) {
        let rawIndices;
        if (geometry.index) {
            rawIndices = geometry.index.array;
        } else {
            // Non-indexed geometry: generate sequential indices
            rawIndices = new Uint32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) rawIndices[i] = i;
        }

        const sanitized = [];
        const maxIdx = vertexCount - 1;
        for (let i = 0; i < rawIndices.length; i += 3) {
            if (i + 2 >= rawIndices.length) break;
            const a = rawIndices[i], b = rawIndices[i + 1], c = rawIndices[i + 2];
            // Out of range
            if (a > maxIdx || b > maxIdx || c > maxIdx) continue;
            // Degenerate (zero-area triangle)
            if (a === b || b === c || a === c) continue;
            sanitized.push(a, b, c);
        }

        return sanitized.length > 0 ? new Uint32Array(sanitized) : null;
    }

    /**
     * Processes a single mesh with a given world transformation matrix.
     * Creates a trimesh collider in Rapier and optionally a debug wireframe.
     */
    function processOneMesh(geometry, worldMatrix, meshName, instanceTag) {
        const posAttr = geometry.attributes.position;
        if (!posAttr || posAttr.count < 3) return false;

        // 1. Extract vertices transformed to world space
        const vertices = extractTransformedVertices(geometry, worldMatrix);

        // 2. Validar NaN/Infinity
        for (let i = 0; i < vertices.length; i++) {
            if (!isFinite(vertices[i])) {
                vertices[i] = 0;
                nanCorrected++;
            }
        }

        // 3. Extract and sanitize indices
        const vertexCount = vertices.length / 3;
        const indices = extractSanitizedIndices(geometry, vertexCount);
        if (!indices) {
            console.log(
                `[TrimeshCollider] ⏩ "${meshName}"${instanceTag} — 0 valid triangles, skipped`
            );
            return false;
        }

        const triCount = indices.length / 3;

        // 4. Crear el collider en Rapier
        try {
            const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
                .setFriction(0.9)
                .setRestitution(0.0);
            physicsWorld.createCollider(desc, terrainBody);
            totalTriangles += triCount;
            return true;
        } catch (e) {
            console.error(
                `[TrimeshCollider] ❌ Error en "${meshName}"${instanceTag} (${label}): ${e.message}`
            );
            return false;
        }
    }

    // ── Phase 1: Collect candidates (synchronous, instant) ──────────────
    // Only object tree traversal — does not process geometry yet.
    const candidates = [];
    group.traverse((child) => {
        if (!child.isMesh) return;
        if (!child.visible)                                                          { meshesSkipped++; return; }
        if (child.userData && child.userData.noCollision)                            { meshesSkipped++; return; }
        const geo = child.geometry;
        if (!geo || !geo.attributes.position || geo.attributes.position.count < 3) { meshesSkipped++; return; }

        // ── Filter: decorative meshes without useful collision ──────────────────────
        // 1. Fewer than MIN_TRIS_FOR_TRIMESH triangles -> too small to import
        const indexCount = geo.index ? geo.index.count : geo.attributes.position.count;
        const triCount   = indexCount / 3;
        if (triCount < MIN_TRIS_FOR_TRIMESH) { meshesSkipped++; return; }

        // 2. Nombre del mesh o su material coincide con palabras clave decorativas
        const lowerName = (child.name || '').toLowerCase();
        const lowerMatName = (Array.isArray(child.material)
            ? (child.material[0] ? child.material[0].name : '')
            : (child.material ? child.material.name : '')
        ).toLowerCase();
        const isDecorative = DECORATIVE_KEYWORDS.some(
            kw => lowerName.includes(kw) || lowerMatName.includes(kw)
        );
        if (isDecorative) { meshesSkipped++; return; }

        candidates.push(child);
    });

    // ── Fase 2: Procesar en lotes de CHUNK_SIZE para no bloquear el hilo ─
    // Cada CHUNK_SIZE mallas cedemos control con setTimeout(0) — el
    // navegador renderiza un frame y luego continuamos con el siguiente lote.
    const CHUNK_SIZE = 15;
    for (let ci = 0; ci < candidates.length; ci++) {
        const child = candidates[ci];
        const name  = child.name || '(unnamed)';

        if (child.isInstancedMesh) {
            const count   = child.count;
            const instMat = new THREE.Matrix4();
            let ok = 0;
            for (let i = 0; i < count; i++) {
                child.getMatrixAt(i, instMat);
                const wm = new THREE.Matrix4().multiplyMatrices(child.matrixWorld, instMat);
                if (processOneMesh(child.geometry, wm, name, ` [inst ${i}/${count}]`)) ok++;
            }
            if (ok > 0) { meshesProcessed++; instancesProcessed += ok; }
            else          meshesSkipped++;
        } else {
            if (processOneMesh(child.geometry, child.matrixWorld, name, '')) meshesProcessed++;
            else meshesSkipped++;
        }

        // Yield the main thread every CHUNK_SIZE processed meshes
        if ((ci + 1) % CHUNK_SIZE === 0 && ci + 1 < candidates.length) {
            await new Promise(r => setTimeout(r, 0));
        }
    }

    // ── Final diagnostics ──
    console.log(
        `[TrimeshCollider] ✅ ${label}: ` +
        `${meshesProcessed} meshes processed` +
        (instancesProcessed > 0 ? ` (${instancesProcessed} instances)` : '') +
        `, ${totalTriangles.toLocaleString()} triangles, ` +
        `${meshesSkipped} skipped` +
        (nanCorrected > 0 ? `, ${nanCorrected} NaN corrected` : '')
    );

    return terrainBody;
}