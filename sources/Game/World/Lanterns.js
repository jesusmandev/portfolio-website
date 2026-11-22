import gsap from 'gsap'
import { Game } from '../Game.js'
import { InstancedGroup } from '../InstancedGroup.js'
import { buildCrownLampBase } from './CrownLampBuilder.js'

export class Lanterns
{
    constructor()
    {
        this.game = Game.getInstance()

        // Extraer posiciones originales y reducir exactamente a la mitad (8 lámparas bien distribuidas)
        const allReferences = InstancedGroup.getReferencesFromChildren(this.game.resources.lanternsModel.scene.children)
        const targetCount = Math.max(1, Math.floor(allReferences.length / 2))
        const references = this._selectSpreadReferences(allReferences, targetCount)

        // Construir Lámpara Corona Dorada ("Corona Aurelia") ultra optimizada (solo 2 draw calls)
        const { baseGroup, glowIntensity } = buildCrownLampBase(this.game, {
            scale: 0.42,
            baseOffsetY: -0.50
        })
        this.glowIntensity = glowIntensity

        // Objetos físicos dinámicos en Rapier (solo para las lámparas activas)
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
                        mass: 0.12,
                        sleeping: true,
                        colliders: [ { shape: 'cuboid', parameters: [ 0.62, 0.50, 0.62 ], category: 'object' } ],
                        waterGravityMultiplier: - 1,
                        contactThreshold: 10,
                        onCollision: (force, position) =>
                        {
                            this.game.audio.groups.get('hitMetal').playRandomNext(force, position)
                        }
                    },
                )
            )
        }

        // Grupo instanciado con el nuevo modelo de Corona Dorada
        this.instancedGroup = new InstancedGroup(references, baseGroup)
        this.instancedGroup.updateBoundings()

        // Transición suave de luminosidad entre día y noche
        this.setDayNightGlow()

        // Actualización física cuando se golpean
        this.game.ticker.events.on('tick', () =>
        {
            for(const object of this.objects)
            {
                if(!object.physical.body.isSleeping() && object.physical.body.isEnabled())
                    object.visual.object3D.needsUpdate = true
            }
        }, 10)
    }

    /**
     * Selecciona la mitad de las lámparas maximizando la distancia entre ellas para repartirlas por todo el mapa.
     */
    _selectSpreadReferences(allRefs, maxCount)
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

    setDayNightGlow()
    {
        const updateGlow = (isNight) =>
        {
            gsap.to(this.glowIntensity, {
                value: isNight ? 2.4 : 1.15,
                duration: 2.5,
                overwrite: true
            })
        }

        this.game.dayCycles.events.on('night', updateGlow)
        updateGlow(this.game.dayCycles.intervalEvents.get('night').inInterval)
    }
}
