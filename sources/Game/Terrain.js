import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import MeshGridMaterial, { MeshGridMaterialLine } from './Materials/MeshGridMaterial.js'
import { color, Fn, max, mix, round, smoothstep, step, texture, uniform, uv, vec2 } from 'three/tsl'
import roadPairs from '../data/roadPairs.json'

export class Terrain
{
    constructor()
    {
        this.game = Game.getInstance()

        this.subdivision = 128
        this.size = 192

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🏔️ Terrain Data',
                expanded: false,
            })
        }

        this.setGradient()
        this.setRoadGrass()
        this.setNodes()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setGradient()
    {
        const height = 16

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = height

        this.gradientTexture = new THREE.Texture(canvas)
        this.gradientTexture.colorSpace = THREE.SRGBColorSpace

        const context = canvas.getContext('2d')

        this.colors = [
            { stop: 0.1, value: '#615240' },
            { stop: 0.3, value: '#3d9991' },
            { stop: 0.9, value: '#13375f' },
        ]

        const update = () =>
        {
            const gradient = context.createLinearGradient(0, 0, 0, height)
            for(const color of this.colors)
                gradient.addColorStop(color.stop, color.value)

            context.fillStyle = gradient
            context.fillRect(0, 0, 1, height)
            this.gradientTexture.needsUpdate = true
        }

        update()

        // // Debug
        // canvas.style.position = 'fixed'
        // canvas.style.zIndex = 999
        // canvas.style.top = 0
        // canvas.style.left = 0
        // canvas.style.width = '128px'
        // canvas.style.height = `256px`
        // document.body.append(canvas)
        
        if(this.game.debug.active)
        {
            for(const color of this.colors)
            {
                this.debugPanel.addBinding(color, 'stop', { min: 0, max: 1, step: 0.001 }).on('change', update)
                this.debugPanel.addBinding(color, 'value', { view: 'color' }).on('change', update)
            }
        }
    }

    setRoadGrass()
    {
        const canvas = document.createElement('canvas')
        const canvasSize = 512
        canvas.width = canvasSize
        canvas.height = canvasSize
        const context = canvas.getContext('2d')

        context.fillStyle = '#000000'
        context.fillRect(0, 0, canvasSize, canvasSize)

        const mapSize = this.size

        // Zonas de exclusión para no poner césped sobre puentes o plazas
        const exclusions = [
            { x: 47.1,  z: 22.3,   r: 14 },
            { x: 23.4,  z: 39.8,   r: 14 },
            { x: 35.76, z: 13.41,  r: 12 },
            { x: 25.95, z: -18.09, r: 12 },
            { x: 13.1,  z: 15.8,   r: 10 },
        ]

        const isExcluded = (x, z) =>
        {
            for(const e of exclusions)
            {
                if(Math.hypot(x - e.x, z - e.z) < e.r)
                    return true
            }
            return false
        }

        // Tramos de la carretera donde el césped cubrirá el suelo en praderas naturales
        const zones = [
            [8, 26],
            [38, 56],
            [68, 86],
            [96, 114],
            [122, 135]
        ]

        for(const [start, end] of zones)
        {
            for(let i = start; i <= end; i++)
            {
                const [x1, z1, x2, z2] = roadPairs[i]
                const mx = (x1 + x2) * 0.5
                const mz = (z1 + z2) * 0.5

                if(isExcluded(mx, mz))
                    continue

                const cx = (mx / mapSize + 0.5) * canvasSize
                const cy = (mz / mapSize + 0.5) * canvasSize
                const radiusPx = (6.0 / mapSize) * canvasSize

                const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radiusPx)
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
                gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.85)')
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)')

                context.fillStyle = gradient
                context.beginPath()
                context.arc(cx, cy, radiusPx, 0, Math.PI * 2)
                context.fill()
            }
        }

        // Césped natural del mapa en el área de la palmera / CV
        {
            const palmX = 69.66
            const palmZ = 12.0
            const cx = (palmX / mapSize + 0.5) * canvasSize
            const cy = (palmZ / mapSize + 0.5) * canvasSize
            const radiusPx = (6.5 / mapSize) * canvasSize

            const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radiusPx)
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
            gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.85)')
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)')

            context.fillStyle = gradient
            context.beginPath()
            context.arc(cx, cy, radiusPx, 0, Math.PI * 2)
            context.fill()
        }

        this.roadGrassTexture = new THREE.CanvasTexture(canvas)
        this.roadGrassTexture.flipY = false
        this.roadGrassTexture.minFilter = THREE.LinearFilter
        this.roadGrassTexture.magFilter = THREE.LinearFilter
        this.roadGrassTexture.generateMipmaps = false
    }

    setNodes()
    {
        this.grassColorUniform = uniform(color('#56923e'))
        this.tracksDelta = uniform(vec2(0))

        const worldPositionToUvNode = Fn(([position]) =>
        {
            return position.div(this.subdivision).div(1.5).add(0.5)
        })

        this.terrainNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            const data = texture(this.game.resources.terrainTexture, textureUv).toVar()

            if(this.roadGrassTexture)
            {
                const roadGrass = texture(this.roadGrassTexture, textureUv).r
                data.g.assign(max(data.g, roadGrass))
                data.r.mulAssign(roadGrass.oneMinus())
            }

            // Wheel tracks
            const groundDataColor = texture(
                this.game.tracks.renderTarget.texture,
                position.sub(- this.game.tracks.halfSize).sub(this.tracksDelta).div(this.game.tracks.size)
            )
            data.g.mulAssign(groundDataColor.r.oneMinus())

            return data
        })
        
        this.colorNode = Fn(([terrainData]) =>
        {
            // Dirt and water
            const baseColor = texture(this.gradientTexture, vec2(0, terrainData.b.oneMinus()))

            // Grass
            baseColor.assign(mix(baseColor, this.grassColorUniform, terrainData.g))

            return baseColor.rgb
        })

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.grassColorUniform.value, 'grassColor')
        }
    }
    
    update()
    {
        // Tracks delta
        this.tracksDelta.value.set(
            this.game.tracks.focusPoint.x,
            this.game.tracks.focusPoint.y
        )
    }
}