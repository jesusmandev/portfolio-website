import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Floor } from './Floor.js'
import { Grid } from './Grid.js'
import { Grass } from './Grass.js'
import { color, float, Fn, instance, normalWorld, positionLocal, texture, vec3, vec4 } from 'three/tsl'
import { WaterSurface } from './WaterSurface.js'
import { Areas } from './Areas/Areas.js'
import { WindLines } from './WindLines.js'
import { Leaves } from './Leaves.js'
import { Lightnings } from './Lightnings.js'
import { Snow } from './Snow.js'
import { Whispers } from './Whispers.js'
import { VisualVehicle } from './VisualVehicle.js'
import { VisualTornado } from './VisualTornado.js'
import { Flowers } from './Flowers.js'
import { Bricks } from './Bricks.js'
import { Trees } from './Trees.js'
import { Bushes } from './Bushes.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { Fireballs } from './Fireballs.js'
import { ExplosiveCrates } from './ExplosiveCrates.js'
import { RainLines } from './RainLines.js'
import { Confetti } from './Confetti.js'
import { Intro } from './Intro.js'
import { PoleLights } from './PoleLights.js'
import { Lanterns } from './Lanterns.js'
import { Fences } from './Fences.js'
import { Scenery } from './Scenery.js'
import { ProyectosSign } from './ProyectosSign.js'
import { Statue } from './Statue.js'
import { SocialIconsArea } from './SocialIconsArea.js'
import { RoadTrees } from './RoadTrees.js'
import { SoccerField } from './SoccerField.js'
import { BasketballField } from './BasketballField.js'
import { Windmill } from './Windmill.js'
import { FlagsExhibition } from './FlagsExhibition.js'
import { Skills } from './Skills.js'
import { TextFreelancer } from './TextFreelancer.js'

export class World
{
    constructor()
    {
        this.game = Game.getInstance()

        this.step(0)

        // this.setAxesHelper()
        // this.setCollisionGroupsTest()
        // this.setNormalTest()
        // this.setTestMesh()
        // this.setTestShadow()
    }

    step(step)
    {
        if(step === 0)
        {
            this.grid = new Grid()
            this.intro = new Intro()
        }
        else if(step === 1)
        {
            this.visualVehicle = new VisualVehicle(this.game.resources.vehicle.scene)
            this.floor = new Floor()
            this.waterSurface = new WaterSurface()
            this.grass = new Grass()
            this.windLines = new WindLines()
            this.confetti = new Confetti()
            this.leaves = new Leaves()
            this.rain = new RainLines()
            this.lightnings = new Lightnings()
            this.fireballs = new Fireballs()
            this.snow = new Snow()
            this.visualTornado = new VisualTornado()
            this.bushes = new Bushes()

            const isInsideSoccerField = (pos) => Math.abs(pos.x - (-19.0)) < 17.5 && Math.abs(pos.z - (-5.0)) < 12.0
            const isInsideBasketballField = (pos) => Math.abs(pos.x - (-37.415)) < 7.8 && Math.abs(pos.z - (-54.505)) < 15.2
            const isInsideFlagsExhibition = (pos) => Math.hypot(pos.x - (-15.16), pos.z - (-55.32)) < 15.0
            const isInsideSkills = (pos) => Math.hypot(pos.x - (-23.13), pos.z - 58.10) < 14.0
            const isInsideFreelancer = (pos) => Math.hypot(pos.x - 4.90, pos.z - (-29.21)) < 10.5
            const isInsideWindmill = (pos) => Math.hypot(pos.x - (-77.65), pos.z - 39.92) < 7.5
            const isExcludedTree = (pos) => isInsideSoccerField(pos) || isInsideBasketballField(pos) || isInsideFlagsExhibition(pos) || isInsideSkills(pos) || isInsideFreelancer(pos) || isInsideWindmill(pos)

            const birchRefs = this.game.resources.birchTreesReferencesModel.scene.children.filter(ref => !isExcludedTree(ref.position))
            const oakRefs = this.game.resources.oakTreesReferencesModel.scene.children.filter(ref => !isExcludedTree(ref.position))

            this.birchTrees = new Trees('Birch Tree', this.game.resources.birchTreesVisualModel.scene, birchRefs, '#ff4f2b', '#ff903f')
            this.oakTrees = new Trees('Oak Tree', this.game.resources.oakTreesVisualModel.scene, oakRefs, '#b4b536', '#d8cf3b')

            const defaultRespawn = this.game.respawns.getDefault()
            const allCherryRefs = [...this.game.resources.cherryTreesReferencesModel.scene.children]

            // Ordenar por distancia al punto exacto de aparición (spawn)
            allCherryRefs.sort((a, b) =>
            {
                const distA = Math.hypot(a.position.x - defaultRespawn.position.x, a.position.z - defaultRespawn.position.z)
                const distB = Math.hypot(b.position.x - defaultRespawn.position.x, b.position.z - defaultRespawn.position.z)
                return distA - distB
            })

            // Únicamente el árbol que está detrás del banco donde aparece el jugador
            const startTreeRef = [ allCherryRefs[0] ]
            // Todos los demás árboles cerezo del mapa se conservan originales con su color rosa, filtrando los que caigan en áreas protegidas
            const otherCherryRefs = allCherryRefs.slice(1).filter(ref => !isExcludedTree(ref.position))

            this.startBlueTree = new Trees('Blue Tree', this.game.resources.oakTreesVisualModel.scene, startTreeRef, '#0047ba', '#00d4ff', 1.75, true)
            this.cherryTrees = new Trees('Cherry Tree', this.game.resources.cherryTreesVisualModel.scene, otherCherryRefs, '#ff6d6d', '#ff9990')
            this.roadTrees = new RoadTrees()
            this.flowers = new Flowers()
            this.bricks = new Bricks()
            this.fences = new Fences()
            this.explosiveCrates = new ExplosiveCrates()
            this.poleLights = new PoleLights()
            this.lanterns = new Lanterns()
            this.scenery = new Scenery()
            this.areas = new Areas()

            // Cartel 3D de proyectos (de frontend-portfolio) en el lugar del antiguo Lab
            this.proyectosSign = new ProyectosSign({
                position: new THREE.Vector3(13.1, 0, 15.8),
                rotationY: 1.0,
                scale: 0.9
            })

            // Estatua de frontend-portfolio y modal About Me en la plaza del antiguo Projects
            this.statue = new Statue({
                position: new THREE.Vector3(35.76, 0, 13.41),
                rotationY: 0.6,
                scale: 6.8,
                radius: 7.0
            })

            // Iconos Sociales 3D con pedestales y neón en las posiciones exactas de la plaza social
            this.socialIcons = new SocialIconsArea({
                center: new THREE.Vector3(25.95, 0, -18.09),
                radius: 7.85,
                scale: 0.22
            })

            // Cancha de fútbol 3D profesional en el espacio abierto después de proyectos
            this.soccerField = new SoccerField({
                x: -19.0,
                y: 0.04,
                z: -5.0,
                fieldLength: 32.0,
                fieldWidth: 20.5,
                rotationY: 0
            })

            // Cancha de baloncesto 3D girada con canastas en (-36.16, -40.88) y (-38.67, -68.13)
            this.basketballField = new BasketballField({
                x: -37.415,
                y: 0.04,
                z: -54.505,
                courtWidth: 25.26,
                courtLength: 10.5,
                basketHeight: 4.8,
                rotationY: Math.atan2(-27.25, 2.51)
            })

            // Molino de viento 3D procedural en x: -77.65, y: 0.00, z: 39.92
            this.windmill = new Windmill({
                x: -77.65,
                y: 0.0,
                z: 39.92,
                scale: 1.15,
                rotorSpeed: 1.0,
                audioRadius: 36,
                rotationY: Math.PI * 0.35
            })

            // Exposición de Banderas del Mundo + Avión 3D
            this.flagsExhibition = new FlagsExhibition({
                x: -15.16,
                y: 0.05,
                z: -55.32,
                airplaneScale: 4.8
            })

            // Banderas de Habilidades (Skills) 3D ceremoniales con física de tela
            this.skills = new Skills({
                x: -23.13,
                y: 0.02,
                z: 58.10,
                rotationY: -0.25,
                scale: 0.65
            })

            // Texto 3D FREELANCER dinámico con física Rapier
            this.textFreelancer = new TextFreelancer({
                start: new THREE.Vector3(-0.56, 0.0, -21.64),
                end: new THREE.Vector3(10.35, 0.0, -36.78),
                floorY: 0.0,
                fontSize: 1.85,
                fontDepth: 0.45
            })
        }
        else if(step === 2)
        {
            // Whispers disabled
        }
    }

    setPhysicalFloor()
    {
        this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.25,
                restitution: 0,
                colliders: [
                    { shape: 'cuboid', parameters: [ 1000, 1, 1000 ], position: { x: 0, y: - 1.01, z: 0 }, category: 'floor' },
                ]
            }
        )
    }

    setTestKtx()
    {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(10, 10, 10),
            new THREE.MeshBasicNodeMaterial(),
        )
        mesh.material.outputNode = vec4(
            texture(this.game.resources.paletteTexture).rgb,
            1
        )
        mesh.position.copy(this.game.player.position)
        mesh.position.y += 2
        this.game.scene.add(mesh)
    }

    setTestShadow()
    {
        // Geometry
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)

        // Material
        const material = new THREE.MeshLambertNodeMaterial()
        material.castShadowNode = vec4(0, 0, 0, 1)

        // Mesh
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.y = 2
        mesh.receiveShadow = true
        mesh.castShadow = true
        this.game.scene.add(mesh)

        // // Receiver
        // const receiver = new THREE.Mesh(
        //     new THREE.PlaneGeometry(3, 3),
        //     new THREE.MeshLambertNodeMaterial()
        // )
        // receiver.rotation.x = - Math.PI * 0.5
        // receiver.position.y = 1
        // receiver.receiveShadow = true
        // receiver.castShadow = true
        // this.game.scene.add(receiver)
    }


    setTestMesh()
    {
        console.log(this.game.rendering.renderer.library)
        const testMesh = new THREE.Mesh(
            new THREE.SphereGeometry(1, 32, 32),
            new THREE.MeshBasicMaterial()
        )
        // console.log(testMesh.material.outputNode = vec4(1, 0, 0, 1))
        // testMesh.material.outputNode = Fn(() =>
        // {
        //     return vec4(1, 0, 0, 1)
        // })()
        // setTimeout(() =>
        // {

        //     testMesh.material.outputNode = Fn(() =>
        //     {
        //         return vec4(1, 1, 0, 1)
        //     })()
        //     testMesh.material.needsUpdate = true
        // }, 2000)
        // testMesh.receiveShadow = true
        testMesh.position.z = 3
        this.game.scene.add(testMesh)

        // const testMesh2 = new THREE.Mesh(
        //     new THREE.SphereGeometry(1, 32, 32),
        //     new MeshDefaultMaterial({
        //         colorNode: color(0xffffff),
        //         hasCoreShadows: true,
        //         hasDropShadows: true,
        //     })
        // )
        // testMesh2.receiveShadow = true
        // testMesh2.position.x = 3
        // this.game.scene.add(testMesh2)
    }

    setAxesHelper()
    {
        const axesHelper = new THREE.AxesHelper()
        axesHelper.position.y = 0.1
        this.game.scene.add(axesHelper)
    }

    setCollisionGroupsTest()
    {
        // // Left (object)
        // this.game.objects.add(
        //     {
        //         type: 'dynamic',
        //         position: { x: 4, y: 2, z: 0.1 },
        //         colliders: [ { shape: 'cuboid', parameters: [ 0.5, 0.5, 0.5 ], category: 'object' } ]
        //     }
        // )

        // Right (terrain)
        this.game.objects.add(
            null,
            {
                type: 'dynamic',
                position: { x: 4, y: 2, z: -1.1 },
                colliders: [ { shape: 'cuboid', parameters: [ 0.5, 0.5, 0.5 ], category: 'floor' } ]
            }
        )

        // // Top (bumper)
        // this.game.objects.add(
        //     {
        //         type: 'dynamic',
        //         position: { x: 4, y: 4, z: -0.5 },
        //         colliders: [ { shape: 'cuboid', parameters: [ 0.5, 0.5, 0.5 ], category: 'bumper' } ]
        //     }
        // )
    }

    // setNormalTest()
    // {
    //     const geometry = new THREE.IcosahedronGeometry(1, 2)

    //     const material = new THREE.MeshLambertNodeMaterial()

    //     material.normalNode = normalView
    //     // const newNormal = 
    //     // material.normalNode = vec3(0, 1, 0)

    //     // material.positionNode = Fn(() =>
    //     // {
    //     //     // materialNormal.assign(vec3(0, 1, 0))
    //     //     return positionGeometry
    //     // })()
    //     material.outputNode = vec4(transformedNormalWorld, 1)

    //     const mesh = new THREE.Mesh(geometry, material)
    //     mesh.position.y = 2

    //     this.game.scene.add(mesh)
    // }
}