import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import { Robot3D } from '../Robot.js'

export class BehindTheSceneArea extends Area
{
    constructor(model)
    {
        // Quitar generador con reflectores y conos de tráfico de la zona
        const toRemove = []
        model.traverse((child) =>
        {
            if(child.name && (
                /^lightGenerator/i.test(child.name) ||
                /^refObjects/i.test(child.name)
            ))
            {
                child.userData.preventAutoAdd = true
                child.visible = false
                toRemove.push(child)
            }
        })

        for(const child of toRemove)
        {
            if(child.parent)
                child.parent.remove(child)
        }

        super(model)

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🤖 Robot Area',
                expanded: false,
            })
        }

        const centerRef = this.references.items.get('center')
        this.center = centerRef && centerRef[0] ? centerRef[0].position.clone() : new THREE.Vector3(52.75, 0.0, -11.10)

        this.setRobot()
        this.setInteractivePoint()
        this.setAchievement()
    }

    setRobot()
    {
        // Robot Low Poly 3D interactivo en el centro del claro
        this.robot = new Robot3D({
            x: this.center.x,
            y: this.center.y + 0.05,
            z: this.center.z,
            scale: 0.7,
            rotationY: 2.35
        })
        this.objects.hideable.push(this.robot.group)
    }

    setInteractivePoint()
    {
        const pointPos = new THREE.Vector3(this.center.x - 1.2, 1.2, this.center.z + 2.5)

        this.interactivePoint = this.game.interactivePoints.create(
            pointPos,
            'Saludar Robot',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                if(this.robot)
                    this.robot.salute()

                if(this.game.player)
                    this.game.player.honk()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'behindTheScene')
        })
    }

    update()
    {
        if(this.robot)
        {
            const delta = this.game.ticker?.deltaScaled ?? 0.016
            this.robot.update(delta)
        }
    }
}
