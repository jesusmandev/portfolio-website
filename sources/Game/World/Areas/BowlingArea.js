import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { color, float, Fn, instancedBufferAttribute, instanceIndex, sin, texture, uniform, uv, vec2, vec4 } from 'three/tsl'
import { Area } from './Area.js'
import { Speaker3D } from '../Speaker3D.js'
import { RubikSign } from '../RubikSign.js'
import { PlayableRubikCube } from '../PlayableRubikCube.js'

export class BowlingArea extends Area
{
    constructor(model)
    {
        // Quitar todos los objetos antiguos de la bolera y el diner (barra, asientos, sofás, mesas, salsas, letreros, colisionadores)
        // Conservando únicamente las referencias de zona y del parlante (jukebox)
        const toRemove = []
        for(const child of model.children)
        {
            const name = child.name || ''
            if(name.startsWith('refJukeboxPhysical'))
            {
                child.userData.preventAutoAdd = true
                child.visible = false
                child.name = 'refJukebox'
                continue
            }
            if(
                name.startsWith('refJukeboxInteractivePoint') ||
                name.startsWith('refZoneBounding') ||
                name.startsWith('refZoneFrustum')
            )
            {
                continue
            }

            child.userData.preventAutoAdd = true
            child.visible = false
            toRemove.push(child)
        }

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
                title: '🎲 Rubik Cube Area',
                expanded: false,
            })
        }

        this.setJukebox()
        this.setAchievement()
        this.setRubikSign()
        this.setPlayableRubik()
    }

    setRubikSign()
    {
        // Letrero de neón del Cubo de Rubik 3D en la entrada del área
        this.rubikSign = new RubikSign({
            position: new THREE.Vector3(25.28, 0, 65.82),
            rotationY: 0.35,
            scale: 0.95
        })
    }

    setPlayableRubik()
    {
        // Monumental Cubo de Rubik 3D interactivo y jugable en la pista central
        this.playableRubik = new PlayableRubikCube({
            x: 5.0,
            y: 0.05,
            z: 67.5,
            camDistance: 20.0
        })
    }

    setJukebox()
    {
        const count = 8

        // Notes > Base position
        const positionsArray = new Float32Array(count * 3)
        for(let i = 0; i < count; i++)
        {
            const i3 = i * 3
            positionsArray[i3 + 0] = (Math.random() - 0.5) * 1
            positionsArray[i3 + 1] = (Math.random() - 0.5) * 1
            positionsArray[i3 + 2] = (Math.random() - 0.5) * 1
        }

        const positionAttribute = new THREE.InstancedBufferAttribute(positionsArray, 3)

        // Notes > Material
        const progress = this.game.ticker.elapsedScaledUniform.mul(0.2).add(instanceIndex.toFloat().div(count)).fract().toVarying()
        const notesColor = uniform(color('#ff994d'))
        const notesStrength = uniform(3.5)

        const outputNode = Fn(() =>
        {
            const baseUv = vec2(uv().x, uv().y.oneMinus())
            const noteMask = texture(this.game.resources.jukeboxMusicNotes, baseUv).r
            return vec4(notesColor.mul(notesStrength), noteMask)
        })()

        const positionNode = Fn(() =>
        {
            const newPosition = instancedBufferAttribute(positionAttribute).toVar()

            newPosition.z.addAssign(progress.oneMinus().pow(3).oneMinus())
            newPosition.y.addAssign(progress)
            return newPosition
        })()

        const rotationNode = Fn(() =>
        {
            return sin(this.game.ticker.elapsedScaledUniform.mul(4).add(instanceIndex.toFloat())).add(1).mul(0.5).pow(2).oneMinus()
        })()
        
        const scaleNode = Fn(() =>
        {
            return progress.sub(0.5).abs().mul(2).oneMinus().mul(3).min(1)
        })()

        const material = new THREE.PointsNodeMaterial({
            outputNode: outputNode,
            positionNode: positionNode,
            rotationNode: rotationNode,
            scaleNode: scaleNode,
            size: 1.5,
            sizeAttenuation: true,
            alphaToCoverage: true,
        })

        // Instanciar Parlante 3D
        const jukeboxItems = this.references.items.get('jukebox') || this.references.items.get('jukeboxPhysicalDynamic')
        const jukeboxRef = jukeboxItems ? jukeboxItems[0] : null
        const speakerWorldPos = jukeboxRef
            ? new THREE.Vector3(
                this.model.position.x + jukeboxRef.position.x,
                0.0,
                this.model.position.z + jukeboxRef.position.z
            )
            : new THREE.Vector3(24.01, 0.0, 55.10)

        this.speaker3D = new Speaker3D({
            position: speakerWorldPos,
            rotation: jukeboxRef ? jukeboxRef.quaternion : new THREE.Quaternion(),
            scale: 7.5
        })
        this.objects.hideable.push(this.speaker3D._group)

        // Notes > Mesh
        const points = new THREE.Sprite(material)
        points.count = count
        points.position.y = 2.2
        points.position.z = 0.8
        this.speaker3D._group.add(points)

        // Interactive point
        const jukeboxPoint = this.references.items.get('jukeboxInteractivePoint')
        if(jukeboxPoint && jukeboxPoint[0])
        {
            this.game.interactivePoints.create(
                jukeboxPoint[0].position,
                'Change song',
                InteractivePoints.ALIGN_LEFT,
                InteractivePoints.STATE_CONCEALED,
                () =>
                {
                    if(this.speaker3D)
                        this.speaker3D.nextTrack()
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
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'bowling')
        })
    }

    update()
    {
        // Actualizar Cubo de Rubik jugable
        if(this.playableRubik)
            this.playableRubik.update()

        // Actualizar Speaker 3D
        if(this.speaker3D)
            this.speaker3D.update(this.game.ticker.deltaScaled, this.game.player.position)
    }
}
