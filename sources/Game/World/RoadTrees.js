import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Trees } from './Trees.js'
import roadPairs from '../../data/roadPairs.json'

export class RoadTrees
{
    constructor()
    {
        this.game = Game.getInstance()

        // Zonas de exclusión para no obstruir puentes, plazas clave, puntos interactivos ni la cancha de fútbol
        this.exclusions = [
            { x: 47.1,  z: 22.3,   r: 12 }, // Puente 1
            { x: 23.4,  z: 39.8,   r: 12 }, // Puente 2
            { x: 35.76, z: 13.41,  r: 10 }, // Plaza de la Estatua y Sobre Mí
            { x: 25.95, z: -18.09, r: 10 }, // Plaza de Iconos Sociales
            { x: 13.1,   z: 15.8,   r: 8  }, // Cartel de Proyectos
            { x: -19.0,  z: -5.0,   r: 22 }, // Cancha de fútbol
            { x: -15.16, z: -55.32, r: 16 }, // Exposición de Banderas y Avión
            { x: -23.13, z: 58.10,  r: 14 }, // Banderas de Habilidades (Skills)
            { x: 4.90,   z: -29.21, r: 10.5 }, // Texto 3D Freelancer
            { x: -77.65, z: 39.92,  r: 8.5  }, // Molino de viento 3D
        ]

        this.setTrees()
    }

    isExcluded(x, z)
    {
        // Exclusión rectangular precisa para la cancha de fútbol (32x20.5m + margen) y baloncesto (22x12.5m + margen)
        if(Math.abs(x - (-19.0)) < 18.0 && Math.abs(z - (-5.0)) < 12.5)
            return true
        if(Math.abs(x - (-37.415)) < 8.2 && Math.abs(z - (-54.505)) < 15.5)
            return true

        for(const e of this.exclusions)
        {
            if(Math.hypot(x - e.x, z - e.z) < e.r)
                return true
        }
        return false
    }

    setTrees()
    {
        const blueReferences = []
        const greenReferences = []

        // Semilla pseudoaleatoria determinista para que la posición sea consistente
        let seed = 12345
        const random = () =>
        {
            seed = (seed * 9301 + 49297) % 233280
            return seed / 233280
        }

        const createTreeReference = (x, z, scale) =>
        {
            const treeObj = new THREE.Object3D()
            treeObj.position.set(x, 0, z)
            treeObj.rotation.y = random() * Math.PI * 2
            treeObj.scale.setScalar(scale)
            treeObj.updateMatrix()
            treeObj.updateMatrixWorld(true)
            return treeObj
        }

        // Recorrer los 136 pares de la antigua carretera
        for(let i = 0; i < roadPairs.length; i++)
        {
            const [ x1, z1, x2, z2 ] = roadPairs[i]

            // 1. Árbol en el flanco izquierdo (t entre 0.10 y 0.32)
            if(random() < 0.68)
            {
                const t = 0.10 + random() * 0.22
                const x = x1 * (1 - t) + x2 * t
                const z = z1 * (1 - t) + z2 * t

                if(!this.isExcluded(x, z))
                {
                    const scale = 0.80 + random() * 0.45 // Entre 0.80 y 1.25
                    const isBlue = random() < 0.44
                    const ref = createTreeReference(x, z, scale)
                    if(isBlue)
                        blueReferences.push(ref)
                    else
                        greenReferences.push(ref)
                }
            }

            // 2. Árbol en el flanco derecho (t entre 0.68 y 0.90)
            if(random() < 0.68)
            {
                const t = 0.68 + random() * 0.22
                const x = x1 * (1 - t) + x2 * t
                const z = z1 * (1 - t) + z2 * t

                if(!this.isExcluded(x, z))
                {
                    const scale = 0.80 + random() * 0.45
                    const isBlue = random() < 0.44
                    const ref = createTreeReference(x, z, scale)
                    if(isBlue)
                        blueReferences.push(ref)
                    else
                        greenReferences.push(ref)
                }
            }

            // 3. Ocasionales árboles centrales para variar la vegetación (cada 4 secciones)
            if(i % 4 === 0 && random() < 0.5)
            {
                const t = 0.44 + random() * 0.12
                const x = x1 * (1 - t) + x2 * t
                const z = z1 * (1 - t) + z2 * t

                if(!this.isExcluded(x, z))
                {
                    const scale = 0.75 + random() * 0.35
                    const isBlue = random() < 0.50
                    const ref = createTreeReference(x, z, scale)
                    if(isBlue)
                        blueReferences.push(ref)
                    else
                        greenReferences.push(ref)
                }
            }
        }

        // Árboles Azules (Abedules elegantes con follaje azul zafiro a cian luminoso)
        if(blueReferences.length > 0 && this.game.resources.birchTreesVisualModel)
        {
            this.blueTrees = new Trees(
                'Road Blue Trees',
                this.game.resources.birchTreesVisualModel.scene,
                blueReferences,
                '#0055ff', // Azul eléctrico intenso
                '#00e5ff'  // Azul cian luminoso
            )
        }

        // Árboles Verdes (Robles frondosos con verde bosque natural)
        if(greenReferences.length > 0 && this.game.resources.oakTreesVisualModel)
        {
            this.greenTrees = new Trees(
                'Road Green Trees',
                this.game.resources.oakTreesVisualModel.scene,
                greenReferences,
                '#1b5e20', // Verde bosque profundo
                '#4caf50'  // Verde esmeralda fresco
            )
        }
    }
}
