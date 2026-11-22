import * as THREE from 'three/webgpu'
import { attribute, color, float, Fn, mix, mod, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { lerp } from '../utilities/maths.js'

/**
 * RainLines — Sistema de lluvia estilo StormManager (de frontend-portfolio) adaptado a WebGPU/TSL.
 * - Mantiene los rayos originales de Lightnings.js (sin duplicar rayos de StormManager).
 * - Programación exacta en minutos reales:
 *     - Primera lluvia: a los 5 minutos (300 s)
 *     - Siguientes lluvias: a los 15, 30, 45, 60... minutos (cada 15 min = 900 s)
 * - Fases de cada tormenta:
 *     1. CLEAR             -> espera hasta la próxima marca programada
 *     2. WIND_START (6 s)  -> empieza a soplar el viento
 *     3. DARKENING (4 s)   -> el cielo y las nubes se oscurecen
 *     4. RAIN (45 s)       -> lluvia intensa + viento + inundación (subida del nivel del agua)
 *     5. CLEARING (6 s)    -> la lluvia cesa y el cielo + nivel del agua vuelven a la normalidad
 */
export class RainLines
{
    constructor()
    {
        this.game = Game.getInstance()

        // Programación en tiempo real (segundos): 1ª lluvia a los 5 min, luego 15, 30, 45, 60... (cada 15 min)
        this.firstStormTime = 5 * 60       // 300 s (5 min)
        this.recurringInterval = 15 * 60   // 900 s (15 min)
        this.elapsedRealTime = 0
        this.nextStormTime = this.firstStormTime
        this.stormCount = 0

        this.stormPhase = 'CLEAR'
        this.phaseTimer = 0

        this.windStrength = 0
        this.rainOpacity = 0
        this.cloudsStrength = 0

        // 8,192 gotas GPU (1 solo draw call, 0 bucles CPU por frame)
        this.count = 8192

        this.setGeometry()
        this.setMaterial()
        this.setMesh()

        // Tick
        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 7) // Prioridad 7 (antes de Weather en prioridad 8 y Water en prioridad 9)

        // Resize
        this.game.viewport.events.on('throttleChange', () =>
        {
            this.size.value = Math.max(70, this.game.view.optimalArea.radius * 2.2)
        }, 2)

        // Helper rápido en consola para probar la lluvia al instante si se desea
        window.triggerRain = () => this.triggerStorm()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌧️ Storm Rain (5m -> 15m, 30m...)',
                expanded: false,
            })
            this.debugPanel.addBinding(this, 'stormPhase', { label: 'phase', readonly: true })
            this.debugPanel.addBinding(this, 'elapsedRealTime', { label: 'elapsed (s)', readonly: true })
            this.debugPanel.addBinding(this, 'nextStormTime', { label: 'nextStorm (s)', readonly: true })
            this.debugPanel.addBinding(this, 'recurringInterval', { label: 'interval (s)', min: 30, max: 1800, step: 30 })
            this.debugPanel.addButton({ title: 'Trigger Rain Now' }).on('click', () =>
            {
                this.triggerStorm()
            })
            this.debugPanel.addButton({ title: 'Stop Rain' }).on('click', () =>
            {
                this.stopStorm()
            })
        }
    }

    scheduleNextStorm()
    {
        // Después de la 1ª lluvia (5 min), las siguientes caen en múltiplos exactos de 15 min: 15, 30, 45, 60...
        this.nextStormTime = (Math.floor(this.elapsedRealTime / this.recurringInterval) + 1) * this.recurringInterval
    }

    triggerStorm()
    {
        this.stormPhase = 'WIND_START'
        this.phaseTimer = 0
        this.stormCount++
        this.scheduleNextStorm()
    }

    stopStorm()
    {
        this.stormPhase = 'CLEARING'
        this.phaseTimer = 0
    }

    setGeometry()
    {
        const positionArray = new Float32Array(this.count * 4 * 3)
        const uvArray = new Float32Array(this.count * 4 * 2)
        const randomArray = new Float32Array(this.count * 4 * 2)
        const indexArray = new Uint32Array(this.count * 6)

        for(let i = 0; i < this.count; i++)
        {
            const rx = Math.random()
            const rz = Math.random()
            const rPhase = Math.random()
            const rSpeed = 0.78 + Math.random() * 0.44 // Velocidad variada como en StormManager (60 + rand*25)

            for(let v = 0; v < 4; v++)
            {
                const pIdx = (i * 4 + v) * 3
                positionArray[pIdx + 0] = rx
                positionArray[pIdx + 1] = 0
                positionArray[pIdx + 2] = rz

                const uIdx = (i * 4 + v) * 2
                const ux = (v === 0 || v === 1) ? 1 : 0
                const uy = (v === 0 || v === 3) ? 1 : 0
                uvArray[uIdx + 0] = ux
                uvArray[uIdx + 1] = uy

                const rndIdx = (i * 4 + v) * 2
                randomArray[rndIdx + 0] = rPhase
                randomArray[rndIdx + 1] = rSpeed
            }

            const iIdx = i * 6
            const base = i * 4
            indexArray[iIdx + 0] = base + 0
            indexArray[iIdx + 1] = base + 3
            indexArray[iIdx + 2] = base + 2
            indexArray[iIdx + 3] = base + 2
            indexArray[iIdx + 4] = base + 1
            indexArray[iIdx + 5] = base + 0
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionArray, 3))
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2))
        this.geometry.setAttribute('dropRandom', new THREE.Float32BufferAttribute(randomArray, 2))
        this.geometry.setIndex(new THREE.Uint32BufferAttribute(indexArray, 1))
    }

    setMaterial()
    {
        this.size = uniform(Math.max(70, this.game.view.optimalArea.radius * 2.2))
        this.elevation = uniform(34)
        this.center = uniform(vec2())
        this.localTime = uniform(0)
        this.opacityUniform = uniform(0)
        this.windSlantUniform = uniform(0.18)
        this.dropWidthUniform = uniform(0.036)
        this.dropLengthUniform = uniform(0.62)

        const dropColorTop = color('#557799')
        const dropColorTip = color('#b8d8f5')

        this.material = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        })

        this.material.positionNode = Fn(() =>
        {
            const basePos = attribute('position').toVar()
            const dropUv = uv()
            const dropRnd = attribute('dropRandom')
            const rPhase = dropRnd.x
            const rSpeed = dropRnd.y

            // Orientación billboard perpendicular a la vista isométrica
            const tangent = vec2(0.707, -0.707)

            // Distribución en bucle infinito alrededor del jugador / cámara
            const halfSize = this.size.mul(0.5)
            basePos.xz.mulAssign(this.size)
            // Deriva lateral por el viento (igual que StormManager: positions[i] -= wind * dt)
            basePos.x.subAssign(this.localTime.mul(this.windSlantUniform).mul(14.0))
            basePos.xz.subAssign(this.center)
            basePos.x.assign(mod(basePos.x.add(halfSize), this.size).sub(halfSize))
            basePos.z.assign(mod(basePos.z.add(halfSize), this.size).sub(halfSize))
            basePos.xz.addAssign(this.center)

            // Ancho de la gota
            basePos.xz.addAssign(tangent.mul(dropUv.x.sub(0.5).mul(this.dropWidthUniform)))

            // Caída rápida vertical (efecto aguacero de StormManager)
            const progress = this.localTime.mul(rSpeed).add(rPhase).mod(1.0)
            const topY = this.elevation.add(this.dropLengthUniform)
            basePos.y.assign(topY.sub(this.dropLengthUniform.mul(dropUv.y.oneMinus())).sub(progress.mul(topY)))
            basePos.y.assign(basePos.y.clamp(0.0, this.elevation))

            // Inclinación diagonal por el viento
            const slantOffset = dropUv.y.mul(this.dropLengthUniform).mul(this.windSlantUniform)
            basePos.x.addAssign(slantOffset)

            return basePos
        })()

        this.material.outputNode = Fn(() =>
        {
            const dropUv = uv()
            // Forma suave de gota alargada (punta brillante abajo, cola difuminada arriba) — smoothstep WGSL seguro
            const edgeFade = smoothstep(0.0, 0.35, dropUv.x).mul(smoothstep(0.65, 1.0, dropUv.x).oneMinus())
            const verticalFade = smoothstep(0.0, 0.18, dropUv.y).mul(smoothstep(0.25, 1.0, dropUv.y).oneMinus())
            const dropCol = mix(dropColorTip, dropColorTop, dropUv.y)
            const revealedCol = MeshDefaultMaterial.revealDiscardNodeBuilder(this.game, dropCol)
            const alpha = edgeFade.mul(verticalFade).mul(this.opacityUniform)

            return vec4(revealedCol, alpha)
        })()
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.position.y = -0.3
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = 3
        this.mesh.visible = false
        this.game.scene.add(this.mesh)
    }

    update()
    {
        const realDt = Math.min(this.game.ticker.delta || 1 / 60, 0.1)
        const dt = Math.min(this.game.ticker.deltaScaled || 1 / 60, 0.1)

        // Reloj en tiempo real: 1ª tormenta a los 5 min (300 s), siguientes a los 15, 30, 45, 60... min
        this.elapsedRealTime += realDt
        this.phaseTimer += realDt

        switch(this.stormPhase)
        {
            case 'CLEAR':
                if(this.elapsedRealTime >= this.nextStormTime)
                {
                    this.stormPhase = 'WIND_START'
                    this.phaseTimer = 0
                    this.stormCount++
                    this.scheduleNextStorm()
                }
                break

            case 'WIND_START':
                if(this.phaseTimer >= 6.0)
                {
                    this.stormPhase = 'DARKENING'
                    this.phaseTimer = 0
                }
                break

            case 'DARKENING':
                if(this.phaseTimer >= 4.0)
                {
                    this.stormPhase = 'RAIN'
                    this.phaseTimer = 0
                }
                break

            case 'RAIN':
                if(this.phaseTimer >= 45.0)
                {
                    this.stormPhase = 'CLEARING'
                    this.phaseTimer = 0
                }
                break

            case 'CLEARING':
                if(this.phaseTimer >= 6.0)
                {
                    this.stormPhase = 'CLEAR'
                    this.phaseTimer = 0
                }
                break
        }

        // Objetivos por fase (sin rayos de StormManager — Lightnings.js queda intacto)
        let targetWind = 0
        let targetRainOpacity = 0
        let targetClouds = 0

        switch(this.stormPhase)
        {
            case 'CLEAR':
                targetWind = 0
                targetRainOpacity = 0
                targetClouds = 0
                break

            case 'WIND_START':
                targetWind = 0.35
                targetRainOpacity = 0
                targetClouds = 0.25
                break

            case 'DARKENING':
            {
                const p = Math.min(1, this.phaseTimer / 4.0)
                targetWind = lerp(0.35, 0.78, p)
                targetRainOpacity = 0
                targetClouds = lerp(0.25, 0.92, p)
                break
            }

            case 'RAIN':
                targetWind = 1.0
                targetRainOpacity = 0.72
                targetClouds = 1.0
                break

            case 'CLEARING':
            {
                const p = Math.min(1, this.phaseTimer / 6.0)
                targetWind = lerp(1.0, 0.0, p)
                targetRainOpacity = lerp(0.72, 0.0, p)
                targetClouds = lerp(1.0, 0.0, p)
                break
            }
        }

        // Interpolaciones suaves
        this.windStrength = lerp(this.windStrength, targetWind, Math.min(1, dt * 1.8))
        this.rainOpacity = lerp(this.rainOpacity, targetRainOpacity, Math.min(1, dt * 1.6))
        this.cloudsStrength = lerp(this.cloudsStrength, targetClouds, Math.min(1, dt * 1.2))

        if(this.stormPhase === 'CLEAR' && this.rainOpacity < 0.002)
            this.rainOpacity = 0

        // Sincronizar con Weather.js (activa audio lluvia.mp3 + viento.wav, subida del nivel de agua y rayos de Lightnings.js)
        const normalizedRain = Math.min(1, this.rainOpacity / 0.72)
        this.game.weather.stormRainIntensity = normalizedRain
        this.game.weather.stormWindIntensity = this.windStrength
        this.game.weather.stormCloudsIntensity = this.cloudsStrength

        // Actualizar malla GPU de lluvia
        this.opacityUniform.value = this.rainOpacity
        this.windSlantUniform.value = 0.10 + this.windStrength * 0.28
        this.mesh.visible = this.rainOpacity > 0.003

        if(this.mesh.visible)
        {
            this.center.value.set(
                this.game.view.optimalArea.position.x,
                this.game.view.optimalArea.position.z
            )
            this.localTime.value += dt * (1.25 + this.windStrength * 0.35)
        }
    }
}
