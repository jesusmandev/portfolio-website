import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * ChunkManager - Sistema de carga dinámica de físicas por chunks.
 *
 * ESTRATEGIA:
 * - Los meshes SIEMPRE están visibles (para ver el mundo completo sin lag de pop-in).
 * - Todos los colliders Rapier se crean UNA SOLA VEZ durante la carga inicial.
 * - En juego, solo se llama setEnabled(true/false) en los colliders — operación
 *   prácticamente gratuita que NO bloquea el hilo principal y elimina los tirones.
 */
export class ChunkManager {
    constructor(physicsWorld, cellSize = 100) {
        this.physicsWorld = physicsWorld;
        this.cellSize = cellSize;
        
        // Map de key "x,z" -> Chunk object
        this.chunks = new Map();
        
        // Radio para activar/desactivar FÍSICA (colliders)
        // Los meshes siempre son visibles, solo la física varía
        this.physicsActivationRadius   = 220;  // Activar cuando está dentro de este radio
        this.physicsDeactivationRadius = 280;  // Desactivar cuando supera este radio
        this.physicsActivationRadiusSq   = this.physicsActivationRadius * this.physicsActivationRadius;
        this.physicsDeactivationRadiusSq = this.physicsDeactivationRadius * this.physicsDeactivationRadius;
        
        // Meshes que siempre tienen física activa (suelo, caminos, agua)
        this.alwaysActiveMeshes = new Set();
    }
    
    registerObject3D(group, label) {
        console.log(`[ChunkManager] Registrando ${label}...`);
        group.updateMatrixWorld(true);
        
        let propsCount = 0;
        let groundCount = 0;

        group.traverse((child) => {
            if (!child.isMesh) return;
            
            // Determinar si este mesh es suelo/camino/puente (siempre con física activa)
            const lowerName = (child.name || '').toLowerCase();
            
            const isAlwaysActive = 
                lowerName.includes('ground') || lowerName.includes('suelo') || 
                lowerName.includes('floor') || lowerName.includes('terrain') || 
                lowerName.includes('road') || lowerName.includes('calle') || 
                lowerName.includes('bridge') || lowerName.includes('puente') ||
                lowerName.includes('water') || lowerName.includes('lago') ||
                lowerName.includes('base') || lowerName.includes('pedestal') ||
                lowerName.includes('landscape') || lowerName.includes('isla') ||
                lowerName.includes('hill') || lowerName.includes('loma') ||
                lowerName.includes('waterobjects') || lowerName.includes('mesh_0') ||
                lowerName.startsWith('node') || // Césped siempre activo
                child.userData.alwaysActive === true;
                
            if (isAlwaysActive) {
                this.alwaysActiveMeshes.add(child);
                groundCount++;
                // Física permanente para suelo/caminos
                if (!child.userData.noCollision) {
                    this._createPhysicsForMesh(child, null);
                }
                // El mesh del suelo SIEMPRE visible
                child.visible = true;
                return;
            }
            
            // Props/árboles/edificios → siempre visibles, física pre-creada
            child.visible = true;  // ← CLAVE: siempre visible
            
            // Calcular chunk según posición mundial
            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            
            const cx = Math.floor(worldPos.x / this.cellSize);
            const cz = Math.floor(worldPos.z / this.cellSize);
            const key = `${cx},${cz}`;
            
            if (!this.chunks.has(key)) {
                this.chunks.set(key, {
                    key,
                    cx,
                    cz,
                    meshes: [],
                    // NUEVO: lista de colliders Rapier pre-creados (se activan/desactivan con setEnabled)
                    colliders: [],
                    rigidBody: null,
                    physicsActive: false
                });
            }
            
            const chunk = this.chunks.get(key);
            chunk.meshes.push(child);
            propsCount++;
        });

        // ── Pre-crear todos los colliders de props en estado DESACTIVADO ──────
        // Esto ocurre UNA SOLA VEZ durante la carga. En juego solo se llama
        // setEnabled(true/false), que no bloquea el hilo principal.
        let prebuiltChunks = 0;
        for (const chunk of this.chunks.values()) {
            if (chunk.colliders.length > 0) continue; // ya procesado (llamadas múltiples)

            const bodyDesc = RAPIER.RigidBodyDesc.fixed();
            chunk.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);

            for (const child of chunk.meshes) {
                if (child.userData.noCollision) continue;
                const geo = child.geometry;
                if (!geo || !geo.attributes.position || geo.attributes.position.count < 3) continue;

                const vertices = this._extractTransformedVertices(geo, child.matrixWorld);
                const indices  = this._extractSanitizedIndices(geo, vertices.length / 3);
                if (!indices) continue;

                try {
                    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
                        .setFriction(0.9)
                        .setRestitution(0.0);
                    const col = this.physicsWorld.createCollider(desc, chunk.rigidBody);
                    // ← Empieza DESACTIVADO: el broadphase lo ignora completamente
                    col.setEnabled(false);
                    chunk.colliders.push(col);
                } catch (e) {
                    console.warn(`[ChunkManager] Falló pre-crear collider para chunk ${chunk.key}:`, e);
                }
            }

            if (chunk.colliders.length > 0) prebuiltChunks++;
        }

        console.log(`[ChunkManager] Registrado ${label}: ${groundCount} meshes permanentes, ${propsCount} meshes dinámicos en ${this.chunks.size} chunks.`);
        console.log(`[ChunkManager] ${prebuiltChunks} chunks con ${[...this.chunks.values()].reduce((s,c) => s + c.colliders.length, 0)} colliders pre-creados en estado DESACTIVADO (sin coste en juego).`);
    }
    
    update(playerPosition) {
        if (!playerPosition) return;
        
        const px = playerPosition.x;
        const pz = playerPosition.z;
        
        for (const chunk of this.chunks.values()) {
            const chunkCenterX = chunk.cx * this.cellSize + this.cellSize / 2;
            const chunkCenterZ = chunk.cz * this.cellSize + this.cellSize / 2;
            const dx = chunkCenterX - px;
            const dz = chunkCenterZ - pz;
            const distSq = dx * dx + dz * dz;
            
            // Activar física para chunks cercanos
            if (distSq <= this.physicsActivationRadiusSq) {
                if (!chunk.physicsActive) {
                    this._activateChunkPhysics(chunk);
                }
            } else if (distSq > this.physicsDeactivationRadiusSq) {
                if (chunk.physicsActive) {
                    this._deactivateChunkPhysics(chunk);
                }
            }
            // Los meshes siempre son visibles (no se ocultan nunca)
        }
    }
    
    _activateChunkPhysics(chunk) {
        chunk.physicsActive = true;
        // ZERO lag: solo cambia un flag booleano en cada collider pre-creado.
        // No se crea ningún objeto nuevo, no se bloquea el hilo.
        for (const col of chunk.colliders) {
            col.setEnabled(true);
        }
    }
    
    _deactivateChunkPhysics(chunk) {
        chunk.physicsActive = false;
        // ZERO lag: solo deshabilita los colliders, no los destruye.
        for (const col of chunk.colliders) {
            col.setEnabled(false);
        }
    }

    preActivateAll() {
        console.log('[ChunkManager] Activando todos los chunks de física (setEnabled)...');
        let activated = 0;
        for (const chunk of this.chunks.values()) {
            if (!chunk.physicsActive) {
                this._activateChunkPhysics(chunk);
                activated++;
            }
        }
        console.log(`[ChunkManager] ${activated} chunks activados sin coste de creación.`);
    }
    
    // ── Helpers ──────────────────────────────────────────────────────────────
    
    _extractTransformedVertices(geometry, worldMatrix) {
        const posAttr = geometry.attributes.position;
        const count = posAttr.count;
        const vertices = new Float32Array(count * 3);
        const v = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            v.applyMatrix4(worldMatrix);
            vertices[i * 3]     = v.x;
            vertices[i * 3 + 1] = v.y;
            vertices[i * 3 + 2] = v.z;
        }

        // Validar NaN/Infinity
        for (let i = 0; i < vertices.length; i++) {
            if (!isFinite(vertices[i])) {
                vertices[i] = 0;
            }
        }

        return vertices;
    }

    _extractSanitizedIndices(geometry, vertexCount) {
        let rawIndices;
        if (geometry.index) {
            rawIndices = geometry.index.array;
        } else {
            rawIndices = new Uint32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) rawIndices[i] = i;
        }

        const sanitized = [];
        const maxIdx = vertexCount - 1;
        for (let i = 0; i < rawIndices.length; i += 3) {
            if (i + 2 >= rawIndices.length) break;
            const a = rawIndices[i], b = rawIndices[i + 1], c = rawIndices[i + 2];
            if (a > maxIdx || b > maxIdx || c > maxIdx) continue;
            if (a === b || b === c || a === c) continue;
            sanitized.push(a, b, c);
        }

        return sanitized.length > 0 ? new Uint32Array(sanitized) : null;
    }
    
    _createPhysicsForMesh(mesh, chunkRigidBody) {
        const geo = mesh.geometry;
        if (!geo || !geo.attributes.position || geo.attributes.position.count < 3) return;
        
        const vertices = this._extractTransformedVertices(geo, mesh.matrixWorld);
        const indices = this._extractSanitizedIndices(geo, vertices.length / 3);
        if (!indices) return;
        
        try {
            const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
                .setFriction(0.9)
                .setRestitution(0.0);
                
            let targetBody = chunkRigidBody;
            if (!targetBody) {
                const bodyDesc = RAPIER.RigidBodyDesc.fixed();
                targetBody = this.physicsWorld.createRigidBody(bodyDesc);
            }
            this.physicsWorld.createCollider(desc, targetBody);
        } catch (e) {
            console.warn(`[ChunkManager] Falló crear collider permanente:`, e);
        }
    }
}
