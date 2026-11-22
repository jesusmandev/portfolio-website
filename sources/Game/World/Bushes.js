import * as THREE from 'three/webgpu'
import { color, uniform } from 'three/tsl'
import { Foliage } from './Foliage.js'
import { Game } from '../Game.js'

export class Bushes
{
    constructor()
    {
        this.game = Game.getInstance()

        this.colorANode = uniform(color('#b4b536'))
        this.colorBNode = uniform(color('#d8cf3b'))

        // Excluir arbustos que queden dentro de las canchas, aeropuerto o habilidades
        const isInsideSoccerField = (pos) => Math.abs(pos.x - (-19.0)) < 17.5 && Math.abs(pos.z - (-5.0)) < 12.0
        const isInsideBasketballField = (pos) => Math.abs(pos.x - (-37.415)) < 7.8 && Math.abs(pos.z - (-54.505)) < 15.2
        const isInsideAirport = (pos) => Math.hypot(pos.x - (-15.16), pos.z - (-55.32)) < 13.0
        const isInsideSkills = (pos) => Math.hypot(pos.x - (-23.13), pos.z - 58.10) < 11.0
        const isInsideFreelancer = (pos) => Math.hypot(pos.x - 4.90, pos.z - (-29.21)) < 10.5
        const isInsideWindmill = (pos) => Math.hypot(pos.x - (-77.65), pos.z - 39.92) < 6.5
        const filteredBushes = this.game.resources.bushesReferences.scene.children.filter(child => !isInsideSoccerField(child.position) && !isInsideBasketballField(child.position) && !isInsideAirport(child.position) && !isInsideSkills(child.position) && !isInsideFreelancer(child.position) && !isInsideWindmill(child.position))

        this.foliage = new Foliage(filteredBushes, this.colorANode, this.colorBNode)

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '🌳 Bushes',
                expanded: false,
            })
            this.game.debug.addThreeColorBinding(debugPanel, this.colorANode.value, 'colorA')
            this.game.debug.addThreeColorBinding(debugPanel, this.colorBNode.value, 'colorB')
            debugPanel.addBinding(this.foliage.material.shadowOffset, 'value', { label: 'shadowOffset', min: 0, max: 2, step: 0.001 })
        }
    }
}