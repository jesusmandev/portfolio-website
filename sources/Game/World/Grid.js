import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, cos, dot, float, floor, Fn, fract, length, max, mix, positionWorld, sin, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl'
import { distanceToLetterJ } from '../Reveal.js'

export class Grid
{
    constructor()
    {
        this.game = Game.getInstance()

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌐 Grid',
                expanded: false,
            })
        }

        this.timeUniform = uniform(0)

        this.setVisual()

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 8)
    }

    setVisual()
    {
        // Paleta elegante en tonos de Azul Oscuro profundo y Azul Claro luminoso
        const deepNavyVoid = uniform(color('#020714'))   // Azul noche muy oscuro en los bordes
        const midnightBlue = uniform(color('#071a3d'))   // Azul marino oscuro en el centro
        const royalBlue = uniform(color('#1045a8'))      // Azul real intenso
        const brightBlue = uniform(color('#2998ff'))     // Azul brillante
        const lightSkyBlue = uniform(color('#7ce4ff'))   // Azul claro luminoso / hielo

        const auroraStrength = uniform(0.50)
        const gridOpacity = uniform(0.32)
        const ringIntensity = uniform(1.0)

        const invSmoothstep = (low, high, x) => smoothstep(float(low), float(high), x).oneMinus()

        const material = new THREE.MeshBasicNodeMaterial({
            side: THREE.DoubleSide
        })

        material.outputNode = Fn(() =>
        {
            const distanceToCenter = distanceToLetterJ(positionWorld.xz, this.game.reveal.position2Uniform)
            distanceToCenter.lessThan(this.game.reveal.distance).discard()

            // Coordenadas alineadas a la cámara isométrica (45°) — constantes numéricas puras para evitar NaN
            const diff = positionWorld.xz.sub(this.game.reveal.position2Uniform)
            const SQRT2_INV = 0.70710678
            const isoX = diff.x.sub(diff.y).mul(SQRT2_INV)
            const isoY = diff.x.add(diff.y).mul(-SQRT2_INV)
            const isoPos = vec2(isoX, isoY)
            const radialDist = length(isoPos)
            const dir = isoPos.div(max(radialDist, float(0.001)))
            const t = this.timeUniform

            // 1. Base en azul oscuro profundo con degradado radial hacia azul marino en el centro
            const centerDepth = invSmoothstep(0.0, 16.0, radialDist)
            const baseBg = mix(deepNavyVoid, midnightBlue, centerDepth.mul(0.9))

            // 2. Cortinas fluidas tipo Aurora en tonos Azul Oscuro -> Azul Brillante -> Azul Claro
            const warpX = sin(isoY.mul(0.20).add(t.mul(0.38))).mul(1.6)
            const warpY = cos(isoX.mul(0.18).sub(t.mul(0.32))).mul(1.5)
            const waveA = sin(isoX.mul(0.25).add(warpX).sub(t.mul(0.28)))
            const waveB = cos(isoY.mul(0.22).add(warpY).add(t.mul(0.24)))
            const ribbon = smoothstep(float(0.06), float(0.94), waveA.mul(waveB).mul(0.5).add(0.5))

            // Cresta luminosa azul claro en cada onda
            const crest = smoothstep(float(0.55), float(0.98), waveA.mul(0.5).add(0.5).mul(waveB.mul(0.5).add(0.5)))

            // Transición orgánica de azul oscuro/real a azul claro luminoso
            const colorShift = sin(isoX.mul(0.11).sub(isoY.mul(0.10)).add(t.mul(0.30))).mul(0.5).add(0.5)
            const blueMid = mix(royalBlue, brightBlue, colorShift)
            const auroraTone = mix(blueMid, lightSkyBlue, crest.mul(0.85))

            const auroraEnvelope = smoothstep(float(1.4), float(6.2), radialDist)
                .mul(invSmoothstep(9.0, 30.0, radialDist))
            const auroraCol = auroraTone.mul(ribbon.mul(0.45).add(crest.mul(0.95))).mul(auroraEnvelope).mul(auroraStrength)

            // 3. Retícula arquitectónica limpia que se ilumina en azul claro con una onda expansiva
            const gridCell = float(2.0)
            const gUV = fract(isoPos.div(gridCell)).sub(0.5).abs()
            const lineX = smoothstep(float(0.486), float(0.498), gUV.x)
            const lineY = smoothstep(float(0.486), float(0.498), gUV.y)
            const gridLines = max(lineX, lineY)

            // Destellos en las intersecciones
            const nodeDist = length(vec2(float(0.5).sub(gUV.x), float(0.5).sub(gUV.y)))
            const gridNode = invSmoothstep(0.015, 0.065, nodeDist)

            // Onda expansiva luminosa azul claro desde la "J"
            const pulsePhase = fract(radialDist.mul(0.048).sub(t.mul(0.16)))
            const pulseWave = invSmoothstep(0.0, 0.16, pulsePhase.sub(0.5).abs())
            const gridFade = invSmoothstep(3.0, 26.0, radialDist)

            const gridBaseCol = mix(royalBlue, brightBlue, colorShift)
            const gridPulseCol = mix(brightBlue, lightSkyBlue, pulseWave)
            const gridGlow = gridLines.mul(float(0.18).add(pulseWave.mul(0.95)))
                .add(gridNode.mul(float(0.35).add(pulseWave.mul(1.65))))
                .mul(gridFade)
                .mul(gridOpacity)

            // 4. Anillos orbitales de precisión en azul brillante y azul claro
            const ang1 = t.mul(0.40)
            const rotVec1 = vec2(cos(ang1), sin(ang1))
            const orbitGrad = dot(dir, rotVec1).mul(0.5).add(0.5)
            const ring1Color = mix(brightBlue, lightSkyBlue, orbitGrad)

            const ring1Core = invSmoothstep(0.008, 0.048, radialDist.sub(5.7).abs())
            const ring1Halo = invSmoothstep(0.0, 0.38, radialDist.sub(5.7).abs()).mul(0.24)
            const innerOrbit = ring1Color.mul(ring1Core.mul(0.92).add(ring1Halo)).mul(ringIntensity)

            // Segundo anillo exterior segmentado en arcos simétricos
            const ang2 = t.mul(-0.25)
            const rotVec2 = vec2(cos(ang2), sin(ang2))
            const arcMask = smoothstep(float(0.28), float(0.58), dot(dir, rotVec2).abs())
            const ring2Core = invSmoothstep(0.010, 0.052, radialDist.sub(9.8).abs()).mul(arcMask)
            const ring2Halo = invSmoothstep(0.0, 0.35, radialDist.sub(9.8).abs()).mul(arcMask).mul(0.18)
            const ring2Color = mix(royalBlue, lightSkyBlue, orbitGrad)
            const outerOrbit = ring2Color.mul(ring2Core.mul(0.80).add(ring2Halo)).mul(ringIntensity)

            // 5. Micro-estrellas en azul hielo en el fondo azul oscuro exterior
            const starCell = floor(isoPos.div(2.4))
            const starUV = fract(isoPos.div(2.4))
            const h1 = fract(sin(dot(starCell, vec2(127.1, 311.7))).mul(43758.5453))
            const h2 = fract(sin(dot(starCell, vec2(269.5, 183.3))).mul(43758.5453))
            const starPos = vec2(h1.mul(0.68).add(0.16), h2.mul(0.68).add(0.16))
            const starDist = length(starUV.sub(starPos))
            const twinkle = sin(t.mul(2.4).add(h1.mul(25.0))).mul(0.45).add(0.55)
            const starExists = smoothstep(float(0.56), float(0.94), h1)
            const starMask = invSmoothstep(0.006, 0.036, starDist)
                .mul(starExists)
                .mul(twinkle)
                .mul(smoothstep(float(3.5), float(9.0), radialDist))
                .mul(invSmoothstep(14.0, 34.0, radialDist))
            const starCol = mix(brightBlue, lightSkyBlue, h2).add(vec3(0.45)).mul(starMask).mul(0.85)

            // 6. Resplandor azul claro suave en el suelo justo debajo de la letra "J"
            const jGlowRaw = invSmoothstep(0.0, 5.2, distanceToCenter)
            const jGlow = jGlowRaw.mul(jGlowRaw).mul(0.32)
            const jHaloColor = mix(brightBlue, lightSkyBlue, float(0.55)).mul(jGlow)

            const finalRgb = baseBg
                .add(auroraCol)
                .add(mix(gridBaseCol, gridPulseCol, pulseWave).mul(gridGlow))
                .add(innerOrbit)
                .add(outerOrbit)
                .add(starCol)
                .add(jHaloColor)

            return vec4(finalRgb, float(1.0))
        })()

        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(180, 180),
            material
        )
        this.mesh.position.y = 0
        this.mesh.rotation.x = - Math.PI * 0.5

        const defaultRespawn = this.game.respawns.getDefault()
        this.mesh.position.x = defaultRespawn.position.x
        this.mesh.position.z = defaultRespawn.position.z

        this.game.scene.add(this.mesh)

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(auroraStrength, 'value', { label: 'auroraStrength', min: 0, max: 1.5, step: 0.01 })
            this.debugPanel.addBinding(gridOpacity, 'value', { label: 'gridOpacity', min: 0, max: 1, step: 0.01 })
            this.debugPanel.addBinding(ringIntensity, 'value', { label: 'ringIntensity', min: 0, max: 2, step: 0.05 })
        }
    }

    update()
    {
        this.timeUniform.value = this.game.ticker.elapsed
    }

    show()
    {
        this.game.scene.add(this.mesh)
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.update)
        this.mesh.material.dispose()
        this.mesh.geometry.dispose()
        this.mesh.removeFromParent()
    }
}