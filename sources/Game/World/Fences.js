import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Game } from '../Game.js'
import { InstancedGroup } from '../InstancedGroup.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class Fences
{
    constructor()
    {
        this.game = Game.getInstance()

        // Base and references from original fencesModel (used ONLY for positions and Rapier physics colliders)
        const [ base, references ] = InstancedGroup.getBaseAndReferencesFromInstances(this.game.resources.fencesModel.scene.children)

        // Descriptions > To extract physics colliders
        const descriptions = this.game.objects.getFromModel(base, {}, {})

        // Objects (Rapier physics)
        this.objects = []
        const isInsideSoccerField = (pos) => Math.abs(pos.x - (-19.0)) < 17.5 && Math.abs(pos.z - (-5.0)) < 12.0
        const isInsideBasketballField = (pos) => Math.abs(pos.x - (-37.415)) < 7.8 && Math.abs(pos.z - (-54.505)) < 15.2
        const filteredReferences = references.filter(ref => !isInsideSoccerField(ref.position) && !isInsideBasketballField(ref.position))

        for(const reference of filteredReferences)
        {
            this.objects.push(this.game.objects.add(
                {
                    model: reference,
                    updateMaterials: false,
                    parent: null,
                },
                {
                    type: 'dynamic',
                    position: reference.position,
                    rotation: reference.quaternion,
                    friction: 0.7,
                    mass: 0.1,
                    sleeping: true,
                    colliders: descriptions[1].colliders,
                    waterGravityMultiplier: - 1,
                    contactThreshold: 10,
                    onCollision: (force, position) =>
                    {
                        // this.game.audio.groups.get('hitMetal').playRandomNext(force, position)
                    }
                },
            ))
        }

        // Create new visual base from cerca2.glb (completely replacing old orange fences)
        const newBase = this._createCercaBase()

        // Instanced group using the newBase and filteredReferences
        this.instancedGroup = new InstancedGroup(filteredReferences, newBase)

        // Tick update for physics motion
        this.game.ticker.events.on('tick', () =>
        {
            for(const object of this.objects)
            {
                if(!object.physical.body.isSleeping() && object.physical.body.isEnabled())
                    object.visual.object3D.needsUpdate = true
            }
        }, 10)
    }

    _createCercaBase()
    {
        const newBase = new THREE.Group()
        newBase.name = 'cercaBase'

        let cercaMesh = null
        if(this.game.resources.cercaModel)
        {
            this.game.resources.cercaModel.scene.traverse((child) =>
            {
                if(child.isMesh && !cercaMesh)
                    cercaMesh = child
            })
        }

        if(cercaMesh)
        {
            const mesh = this._buildMeshFromCerca(cercaMesh)
            newBase.add(mesh)
        }
        else
        {
            // Asynchronous fallback loader just in case
            const loader = new GLTFLoader()
            loader.load('./cerca/cerca2.glb', (gltf) =>
            {
                let loadedMesh = null
                gltf.scene.traverse((child) =>
                {
                    if(child.isMesh && !loadedMesh)
                        loadedMesh = child
                })

                if(loadedMesh && this.instancedGroup && this.instancedGroup.meshes)
                {
                    const replacement = this._buildMeshFromCerca(loadedMesh)
                    for(const m of this.instancedGroup.meshes)
                    {
                        m.instance.geometry = replacement.geometry
                        m.instance.material = replacement.material
                        m.instance.computeBoundingSphere()
                    }
                }
            })

            // Temporary placeholder mesh while loading
            const placeholderGeom = new THREE.BoxGeometry(2.14, 1.04, 0.1)
            placeholderGeom.translate(0, -0.52, 0)
            const placeholderMat = new MeshDefaultMaterial({
                colorNode: color('#4a2711'),
                side: THREE.DoubleSide
            })
            placeholderMat.userData = { prevent: true }
            const placeholderMesh = new THREE.Mesh(placeholderGeom, placeholderMat)
            placeholderMesh.castShadow = true
            placeholderMesh.receiveShadow = true
            placeholderMesh.frustumCulled = false
            newBase.add(placeholderMesh)
        }

        return newBase
    }

    _buildMeshFromCerca(cercaMesh)
    {
        cercaMesh.updateMatrix()
        const geom = cercaMesh.geometry.clone()
        geom.applyMatrix4(cercaMesh.matrix)

        // Scale to standard world dimensions: width ~2.14m, height ~1.04m, thickness ~0.10m
        geom.scale(2.7, 3.2, 4.0)
        geom.computeBoundingBox()

        // Align fence base to the ground (reference object is at y = 1.041854)
        geom.translate(0, -1.041854 - geom.boundingBox.min.y, 0)
        geom.computeVertexNormals()

        // Dark timber wood material compatible with Folio WebGPU lighting, shadows, and fog
        const mat = new MeshDefaultMaterial({
            colorNode: color('#4a2711'),
            side: THREE.DoubleSide
        })
        mat.userData = { prevent: true }

        const mesh = new THREE.Mesh(geom, mat)
        mesh.name = 'cercaTimber'
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.frustumCulled = false

        return mesh
    }
}
