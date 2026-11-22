import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { InstancedGroup } from '../InstancedGroup.js'
import { hash, instancedArray, instanceIndex, sin, uniform, vec3 } from 'three/tsl'
import gsap from 'gsap'
import { buildHumanoidLanternBase } from './HumanoidLanternBuilder.js'

export class PoleLights
{
    constructor()
    {
        this.game = Game.getInstance()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🏮 Pole lights',
                expanded: false,
            })
        }

        // Extraer posiciones y seleccionar únicamente 6 farolas bien distribuidas por todo el mapa
        const allReferences = InstancedGroup.getReferencesFromChildren(this.game.resources.poleLightsModel.scene.children)
        this.references = this._selectSpreadReferences(allReferences, 6)

        // Construir la nueva Farola Humanoide de Madera 3D (6 mallas fusionadas por material)
        const { baseGroup, glowIntensity } = buildHumanoidLanternBase(this.game, {
            targetHeight: 3.85,
            baseOffsetY: -1.75
        })
        this.glowIntensity = glowIntensity

        // Instanciar todas las farolas del mapa con el nuevo modelo (solo 2 draw calls)
        this.instancedGroup = new InstancedGroup(this.references, baseGroup, false)
        this.instancedGroup.updateBoundings()

        const glassEntry = this.instancedGroup.meshes.find(mesh => mesh.instance.name === 'glass')
        this.glass = glassEntry ? glassEntry.instance : null

        this.setPhysics()
        this.setFireflies()
        this.setSwitchInterval()
    }

    /**
     * Selecciona N farolas maximizando la distancia entre ellas para repartirlas de forma equilibrada.
     */
    _selectSpreadReferences(allRefs, maxCount = 6)
    {
        if(allRefs.length <= maxCount)
            return allRefs

        const selected = [ allRefs[0] ]
        const remaining = allRefs.slice(1)

        while(selected.length < maxCount && remaining.length > 0)
        {
            let bestIdx = 0
            let bestMinDist = -1

            for(let i = 0; i < remaining.length; i++)
            {
                const cand = remaining[i].position
                let minDist = Infinity
                for(const s of selected)
                {
                    const d = cand.distanceToSquared(s.position)
                    if(d < minDist) minDist = d
                }
                if(minDist > bestMinDist)
                {
                    bestMinDist = minDist
                    bestIdx = i
                }
            }

            selected.push(remaining.splice(bestIdx, 1)[0])
        }

        return selected
    }

    setPhysics()
    {
        for(const reference of this.references)
        {
            this.game.objects.add(
                null,
                {
                    type: 'fixed',
                    position: reference.position,
                    rotation: reference.quaternion,
                    colliders: [ { shape: 'cuboid', parameters: [ 0.42, 1.85, 0.42 ], category: 'object' } ],
                    onCollision: (force, position) =>
                    {
                        this.game.audio.groups.get('hitDefault').playRandomNext(force, position)
                    }
                },
            )
        }
    }

    setFireflies()
    {
        this.firefliesScale = uniform(0)

        const countPerLight = 5
        const count = this.references.length * countPerLight
        const positions = new Float32Array(count * 3)

        let i = 0
        for(const reference of this.references)
        {
            for(let j = 0; j < countPerLight; j++)
            {
                const i3 = i * 3

                const angle = Math.random() * Math.PI * 2
                positions[i3 + 0] = reference.position.x + Math.cos(angle)
                positions[i3 + 1] = reference.position.y + 1.05
                positions[i3 + 2] = reference.position.z + Math.sin(angle)
                i++
            }
        }

        const positionAttribute = instancedArray(positions, 'vec3').toAttribute()

        const material = new THREE.SpriteNodeMaterial()
        material.outputNode = this.game.materials.getFromName('emissiveOrangeRadialGradient').outputNode

        const baseTime = this.game.ticker.elapsedScaledUniform.add(hash(instanceIndex).mul(999))
        const flyOffset = vec3(
            sin(baseTime.mul(0.4)).mul(0.5),
            sin(baseTime).mul(0.2),
            sin(baseTime.mul(0.3)).mul(0.5)
        )
        material.positionNode = positionAttribute.add(flyOffset)
        material.scaleNode = this.firefliesScale

        const geometry = new THREE.CircleGeometry(0.015, 8)

        const mesh = new THREE.Mesh(geometry, material)
        mesh.count = count
        mesh.frustumCulled = false
        this.game.scene.add(mesh)
    }

    setSwitchInterval()
    {
        const intervalChange = (inInterval) =>
        {
            if(inInterval)
            {
                if(this.glass) this.glass.visible = true
                gsap.to(this.glowIntensity, { value: 2.35, duration: 2.5, overwrite: true })
                gsap.to(this.firefliesScale, { value: 1, duration: 5, overwrite: true })
            }
            else
            {
                if(this.glass) this.glass.visible = true
                gsap.to(this.glowIntensity, { value: 0.85, duration: 2.5, overwrite: true })
                gsap.to(this.firefliesScale, { value: 0, duration: 5, overwrite: true })
            }
        }

        this.game.dayCycles.events.on('night', intervalChange)
        intervalChange(this.game.dayCycles.intervalEvents.get('night').inInterval)
    }
}
