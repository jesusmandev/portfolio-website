import * as THREE from 'three/webgpu'
import { color, float, Fn, max, PI, positionWorld, texture, uniform, uv, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { References } from '../References.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { buildRockClusterGeometry, getSharedRockMaterial } from './ProceduralRock.js'

export class Scenery
{
    constructor()
    {
        this.game = Game.getInstance()

        this.references = new References()
        const model = [...this.game.resources.sceneryModel.scene.children]
        let basaltClusterIdx = 0
        for(const child of model)
        {
            // Add
            if(typeof child.userData.prevent === 'undefined' || child.userData.prevent === false)
            {
                // Omitir la carretera negra (refRoad), bordillos de carreras (Cube...) y las baldosas blancas junto a la estatua (slabes)
                if(child.name.toLowerCase().includes('road') || /^cube/i.test(child.name) || /^slabes/i.test(child.name))
                {
                    child.visible = false
                    if(child.parent)
                        child.parent.remove(child)
                }
                // Reemplazar los puentes originales por el modelo personalizado puente.glb
                else if(child.name.toLowerCase().startsWith('bridge') && this.game.resources.bridgeModel)
                {
                    const [ , physicalDescription ] = this.game.objects.getFromModel(
                        child,
                        {},
                        {
                            position: child.position,
                            rotation: child.quaternion,
                            sleeping: true,
                            mass: child.userData.mass
                        }
                    )

                    const bridgeGroup = new THREE.Group()
                    const customBridge = this.game.resources.bridgeModel.scene.clone(true)
                    customBridge.scale.set(8.45, 4.5, 8.45)
                    customBridge.position.set(0.0108, -0.32, -3.10)
                    bridgeGroup.add(customBridge)

                    this.game.objects.add(
                        {
                            model: bridgeGroup,
                            updateMaterials: true,
                            castShadow: true,
                            receiveShadow: true
                        },
                        physicalDescription
                    )
                }
                // Reemplazar todas las rocas hexagonales de basalto en agua y orillas por rocas 3D procedurales realistas
                else if(child.name.toLowerCase().includes('basaltrock'))
                {
                    // Extraer cajas delimitadoras locales de cada hull antes de que getFromModel los retire
                    const hullBoxes = []
                    for(const sub of child.children)
                    {
                        if(/^hull/i.test(sub.name) && sub.isMesh && sub.geometry)
                        {
                            sub.geometry.computeBoundingBox()
                            sub.updateMatrix()
                            const box = sub.geometry.boundingBox.clone()
                            box.applyMatrix4(sub.matrix)
                            hullBoxes.push(box)
                        }
                    }

                    // Respaldo si el nodo no tuviera hijos hull
                    if(hullBoxes.length === 0)
                    {
                        const fallbackBox = new THREE.Box3()
                        child.traverse((sub) =>
                        {
                            if(sub.isMesh && sub.geometry)
                            {
                                sub.geometry.computeBoundingBox()
                                const b = sub.geometry.boundingBox.clone()
                                if(sub !== child)
                                {
                                    sub.updateMatrix()
                                    b.applyMatrix4(sub.matrix)
                                }
                                fallbackBox.union(b)
                            }
                        })
                        if(!fallbackBox.isEmpty())
                            hullBoxes.push(fallbackBox)
                    }

                    // Extraer colisionadores físicos estáticos Rapier originales
                    const [ , physicalDescription ] = this.game.objects.getFromModel(
                        child,
                        {},
                        {
                            position: child.position,
                            rotation: child.quaternion,
                            sleeping: true,
                            mass: child.userData.mass
                        }
                    )

                    // Ocultar y descartar por completo la malla hexagonal anterior
                    child.visible = false
                    if(child.parent)
                        child.parent.remove(child)

                    // Generar formación de rocas procedurales realistas ajustadas al volumen exacto
                    const rockGroup = new THREE.Group()
                    rockGroup.name = `proceduralBasaltCluster_${basaltClusterIdx}`
                    rockGroup.position.copy(child.position)
                    rockGroup.quaternion.copy(child.quaternion)

                    if(hullBoxes.length > 0)
                    {
                        const clusterGeo = buildRockClusterGeometry(hullBoxes, 500 + basaltClusterIdx * 173)
                        const rockMesh = new THREE.Mesh(clusterGeo, getSharedRockMaterial())
                        rockMesh.name = `proceduralBasaltMesh_${basaltClusterIdx}`
                        rockMesh.castShadow = true
                        rockMesh.receiveShadow = true
                        rockMesh.frustumCulled = false
                        rockGroup.add(rockMesh)
                    }

                    this.game.objects.add(
                        {
                            model: rockGroup,
                            updateMaterials: false,
                            castShadow: true,
                            receiveShadow: true
                        },
                        physicalDescription
                    )

                    basaltClusterIdx++
                }
                else
                {
                    // Objects
                    this.game.objects.addFromModel(
                        child,
                        {

                        },
                        {
                            position: child.position,
                            rotation: child.quaternion,
                            sleeping: true,
                            mass: child.userData.mass
                        }
                    )
                }
            }

            this.references.parse(child)
        }

        this.setRoad()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        })
    }
    
    setRoad()
    {
        this.road = {}

        // Mesh and material
        const mesh = this.references.items.get('road')?.[0]
        if(!mesh)
            return

        mesh.visible = false
        mesh.removeFromParent()
    }

    update()
    {
        if(this.road && this.road.glitterVariation)
            this.road.glitterVariation.value += this.game.ticker.deltaScaled * 0.004 + this.game.view.delta.length() * 0.004
    }
}