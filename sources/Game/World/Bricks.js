import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { InstancedGroup } from '../InstancedGroup.js'
import { buildRockGeometry, getSharedRockMaterial } from './ProceduralRock.js'

export class Bricks
{
    constructor()
    {
        this.game = Game.getInstance()

        // Extract ONLY transforms from bricksModel (completely discard old white block geometry)
        const references = InstancedGroup.getReferencesFromChildren(this.game.resources.bricksModel.scene.children)

        // Physics objects (keep dynamic Rapier physics and collisions intact)
        this.objects = []
        for(const reference of references)
        {
            this.objects.push(
                this.game.objects.add(
                    {
                        model: reference,
                        updateMaterials: false,
                        castShadow: false,
                        receiveShadow: false,
                        parent: null,
                    },
                    {
                        type: 'dynamic',
                        position: reference.position,
                        rotation: reference.quaternion,
                        friction: 0.7,
                        mass: 0.1,
                        sleeping: true,
                        colliders: [ { shape: 'cuboid', parameters: [ 0.75 * 0.75, 0.5 * 0.75, 1 * 0.75 ], category: 'object' } ],
                        waterGravityMultiplier: - 1,
                        contactThreshold: 15,
                        onCollision: (force, position) =>
                        {
                            this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
                        }
                    },
                )
            )
        }

        // Build 3 realistic procedural rock variants so every pile looks natural (only 3 draw calls total)
        const rockMaterial = getSharedRockMaterial()
        const variantConfigs = [
            { seed: 402,  rockType: 'granite', fracture: 0.78, crags: 0.58 },
            { seed: 719,  rockType: 'mossy',   fracture: 0.72, crags: 0.55 },
            { seed: 1024, rockType: 'granite', fracture: 0.85, crags: 0.62 },
        ]

        const variantBuckets = variantConfigs.map(() => [])
        references.forEach((ref, idx) =>
        {
            variantBuckets[idx % variantConfigs.length].push(ref)
        })

        this.instancedGroups = []
        const sizeVec = new THREE.Vector3()
        // Target dimensions matching the original brick collider (1.12 x 0.76 x 1.50 m)
        const targetSize = { x: 1.22, y: 0.80, z: 1.48 }

        variantConfigs.forEach((cfg, idx) =>
        {
            const bucket = variantBuckets[idx]
            if(bucket.length === 0) return

            const geom = buildRockGeometry({
                seed: cfg.seed,
                detail: 3,
                radius: 1.0,
                fracture: cfg.fracture,
                crags: cfg.crags,
                rockType: cfg.rockType,
                uvScale: 0.85,
                centerVertically: true
            })

            // Normalize geometry to fit collider dimensions cleanly
            geom.computeBoundingBox()
            geom.boundingBox.getSize(sizeVec)
            geom.scale(
                targetSize.x / Math.max(0.01, sizeVec.x),
                targetSize.y / Math.max(0.01, sizeVec.y),
                targetSize.z / Math.max(0.01, sizeVec.z)
            )
            geom.computeBoundingBox()
            geom.computeBoundingSphere()

            const rockBase = new THREE.Group()
            rockBase.name = `proceduralRockBase_${idx}`

            const mesh = new THREE.Mesh(geom, rockMaterial)
            mesh.name = `proceduralRock_${idx}`
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.frustumCulled = false
            rockBase.add(mesh)

            this.instancedGroups.push(new InstancedGroup(bucket, rockBase))
        })

        // Keep reference for compatibility
        this.instancedGroup = this.instancedGroups[0]

        // Tick update
        this.game.ticker.events.on('tick', () =>
        {
            for(const object of this.objects)
            {
                if(!object.physical.body.isSleeping() && object.physical.body.isEnabled())
                    object.visual.object3D.needsUpdate = true
            }
        }, 10)
    }
}
