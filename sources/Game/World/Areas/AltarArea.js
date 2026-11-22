import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import {
    color,
    float,
    Fn,
    luminance,
    min,
    max,
    mix,
    smoothstep,
    step,
    texture,
    uniform,
    uv,
    vec2,
    vec3,
    vec4,
    PI,
    positionLocal,
    cos,
    sin,
    atan,
    pow,
    clamp,
    exp,
    length,
    abs,
    fract,
    instancedArray,
    instanceIndex
} from 'three/tsl'
import gsap from 'gsap'
import { Area } from './Area.js'
import { Player } from '../../Player.js'

export class AltarArea extends Area
{
    constructor(model)
    {
        // Quitar por completo el monumento de piedra, cráneos y colisionadores físicos
        const toRemove = []
        model.traverse((child) =>
        {
            if(child.name && (
                /^Cube[._]?173/i.test(child.name) ||
                /^physicalFixed[._]?005/i.test(child.name) ||
                /^refSkullEyes/i.test(child.name) ||
                /^refCounter/i.test(child.name) ||
                /^(cuboid|trimesh)/i.test(child.name)
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

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌪️ Vórtice HDR',
                expanded: false,
            })
        }

        this.value = 0
        const altarRef = this.references.items.get('altar')
        this.position = altarRef && altarRef[0] ? altarRef[0].position.clone() : new THREE.Vector3(75.34, 0, -27.95)

        this.color = uniform(color('#ff7b24'))
        this.emissive = uniform(8)
        this.progressUniform = uniform(0)

        this.setSounds()
        this.setHdrVortex()
        this.setTornadoInteraction()
        this.setData()
        this.setAchievement()
    }

    setSounds()
    {
        this.sounds = {}

        // 1. Sonido ambiental posicional del tornado (suave de lejos, fuerte de cerca, desaparece al alejarse)
        this.sounds.tornadoWind = this.game.audio.register({
            path: 'sounds/tornado/tornado-loop.mp3',
            autoplay: true,
            loop: true,
            volume: 0.95,
            positions: this.position,
            distanceFade: 35
        })

        // 2. Sonido de grito mientras es absorbido y mientras cae
        this.sounds.maleScream = this.game.audio.register({
            path: 'sounds/fall/male-scream.mp3',
            autoplay: false,
            loop: false,
            volume: 0.9
        })

        // 3. Sonido de caída / golpe contra el suelo
        this.sounds.bodyFall = this.game.audio.register({
            path: 'sounds/fall/body-fall.mp3',
            autoplay: false,
            loop: false,
            volume: 1.0
        })

        this.sounds.chimers = this.game.audio.register({
            path: 'sounds/magic/Ghostly Whisper Background Loop 9.mp3',
            autoplay: true,
            loop: true,
            volume: 0.1,
            positions: this.position,
            distanceFade: 25
        })

        this.sounds.deathBell1 = this.game.audio.register({
            path: 'sounds/bell/Death Hit.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4
        })
        this.sounds.deathBell2 = this.game.audio.register({
            path: 'sounds/bell/Epic Bell Impact Hit.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4
        })
    }

    setHdrVortex()
    {
        const perlinTexture = this.game.noises.perlin
        const timeNode = this.game.ticker.elapsedScaledUniform

        // =========================================================================
        // PARÁMETROS REALISTAS (VÓRTICE PARABÓLICO HDR)
        // =========================================================================
        const emissiveColor = uniform(color('#ff7b24'))
        const timeScale = uniform(0.48)
        const parabolStrength = uniform(1.55)
        const parabolOffset = uniform(0.34)
        const parabolAmplitude = uniform(0.42)
        const smokeDensity = uniform(0.88)
        const turbulenceDetail = uniform(1.15)

        // Escala del vórtice gigante
        const heightVal = uniform(19.0)
        const radiusScale = uniform(3.6)

        // =========================================================================
        // FUNCIONES TSL MATEMÁTICAS COMPARTIDAS (100% GPU SHADER)
        // =========================================================================

        // Curva de radio parabólico con expansión dramática de corona superior
        const getParabolicRadius = Fn(([ h, strength, offset ]) =>
        {
            const mainParabola = h.mul(strength).pow(2.15)
            const crownFlare = max(0.0, h.sub(0.52)).div(0.48).pow(2.6).mul(strength.mul(1.45))
            return offset.add(mainParabola).add(crownFlare)
        })

        // Desplazamiento helicoidal asimétrico de la columna vertebral
        const getParabolicSpine = Fn(([ h, t, amplitude ]) =>
        {
            const phase = h.mul(5.2).sub(t.mul(4.8))
            const env = h.pow(1.15).mul(amplitude).mul(1.65)
            const tilt = vec2(0.55, -0.25).mul(h.pow(1.8)).mul(amplitude).mul(1.4)
            return vec2(cos(phase), sin(phase)).mul(env).add(tilt)
        })

        // Gradiente térmico de radiación de cuerpo negro (Carbón -> Rojo -> Magma -> Núcleo Blanco Incandescente)
        const getBlackbodyColor = Fn(([ heat, baseEmissive ]) =>
        {
            const deepChar = vec3(0.03, 0.01, 0.01)
            const darkRed = baseEmissive.mul(vec3(0.45, 0.08, 0.02))
            const midGlow = baseEmissive.mul(1.35)
            const hotCore = mix(baseEmissive, vec3(1.0, 0.97, 0.86), 0.78).mul(2.8)

            const c = mix(deepChar, darkRed, smoothstep(0.05, 0.35, heat)).toVar()
            c.assign(mix(c, midGlow, smoothstep(0.30, 0.70, heat)))
            c.assign(mix(c, hotCore, smoothstep(0.68, 1.00, heat)))
            return c
        })

        // Deformación de vértices cilíndricos a embudo parabólico helicoidal
        const funnelVertex = Fn(([ pos, rMult ]) =>
        {
            const h = pos.y
            const angle = atan(pos.z, pos.x).toVar()
            const t = timeNode.mul(timeScale)

            const rBase = getParabolicRadius(h, parabolStrength, parabolOffset).mul(radiusScale).mul(rMult).toVar()

            // Ondas helicoidales y turbulencia sin costuras
            const twistPhase = angle.mul(2.0).sub(h.mul(8.5)).add(t.mul(6.5))
            const helicalRidge = sin(twistPhase).mul(0.5).add(0.5)
            const flareWisps = h.pow(2.2).mul(helicalRidge)

            const finalRadius = max(0.08, rBase.add(flareWisps.mul(0.4).mul(radiusScale)))

            // Inclinación y asimetría
            const lipAsymmetry = sin(angle.sub(t.mul(2.2)).add(1.2)).mul(h.pow(2.6)).mul(0.4).mul(parabolStrength)
            const verticalStretch = h.mul(heightVal).add(lipAsymmetry.mul(0.55))

            const spine = getParabolicSpine(h, t, parabolAmplitude)

            return vec3(
                spine.x.add(cos(angle).mul(finalRadius.add(lipAsymmetry.mul(0.2)))),
                max(0.01, verticalStretch),
                spine.y.add(sin(angle).mul(finalRadius.add(lipAsymmetry.mul(0.2))))
            )
        })

        // =========================================================================
        // 1. VÓRTICE DE SUELO CON ESPIRALES LOGARÍTMICAS Y HOLLÍN
        // =========================================================================
        const groundGeo = new THREE.PlaneGeometry(28, 28, 1, 1)
        groundGeo.rotateX(-Math.PI * 0.5)

        const groundMat = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        })

        groundMat.outputNode = Fn(() =>
        {
            const t = timeNode.mul(timeScale)
            const spine0 = getParabolicSpine(float(0.0), t, parabolAmplitude)
            
            // Coordenadas relativas al pie del vórtice
            const p = positionLocal.xz.sub(spine0).toVar()
            const r = length(p).toVar()
            const angle = atan(p.y, p.x).toVar()

            // Espirales logarítmicas
            const logR = r.max(0.05).log()
            const rotSpeed = t.mul(5.5)
            const spiralAngle = angle.mul(3.0).sub(logR.mul(5.2)).add(rotSpeed)

            // Muestra de ruido optimizada en GPU
            const polarUv = vec2(
                angle.div(PI.mul(2)),
                r.mul(0.08).sub(t.mul(0.15))
            )
            const warp = texture(perlinTexture, polarUv).r.remap(0.4, 0.7)

            const ribbonPattern = sin(spiralAngle.add(warp.mul(3.4)))
            const fineStreaks = sin(angle.mul(7.0).sub(r.mul(3.2)).add(rotSpeed.mul(1.4)).add(warp.mul(4.0)))
            const combinedSwirl = ribbonPattern.mul(0.65).add(fineStreaks.mul(0.35))

            // Anillos de hollín
            const ringEnvelope = smoothstep(0.2, 0.9, r).mul(smoothstep(12.0, 3.5, r))
            const sootBands = smoothstep(-0.15, 0.45, combinedSwirl).mul(ringEnvelope).mul(smokeDensity)

            // Filamento ígneo en la base del suelo
            const innerFireRing = smoothstep(0.52, 0.88, combinedSwirl).mul(
                r.sub(parabolOffset.mul(1.45)).mul(1.8).pow(2.0).negate().exp()
            )

            const sootColor = vec3(0.012, 0.005, 0.004)
            const fireColor = getBlackbodyColor(float(0.85), emissiveColor)

            const finalCol = mix(vec3(0), sootColor, sootBands).add(fireColor.mul(innerFireRing))
            const alpha = max(sootBands.mul(0.85), innerFireRing).mul(smoothstep(13.0, 4.0, r))

            alpha.lessThan(0.01).discard()

            return vec4(finalCol, alpha)
        })()

        const groundMesh = new THREE.Mesh(groundGeo, groundMat)
        groundMesh.position.set(this.position.x, 0.05, this.position.z)
        groundMesh.frustumCulled = false
        this.game.scene.add(groundMesh)
        this.objects.hideable.push(groundMesh)

        // =========================================================================
        // 2. GEOMETRÍA CILÍNDRICA NORMALIZADA (Y: 0.0 a 1.0)
        // =========================================================================
        const funnelGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 36, 36, true)
        funnelGeo.translate(0, 0.5, 0)

        // =========================================================================
        // 3. CAPA 1: NÚCLEO INCANDESCENTE (CINTAS HELICOIDALES DOBLE CARA)
        // =========================================================================
        const coreMat = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        })

        coreMat.positionNode = funnelVertex(positionLocal, float(0.95))

        coreMat.outputNode = Fn(() =>
        {
            const h = uv().y
            const angle = uv().x.mul(PI.mul(2))
            const t = timeNode.mul(timeScale)

            // Velocidad angular diferencial (más rápida en la base)
            const spin = t.mul(float(7.2).sub(h.mul(2.2)))

            // Muestra de ruido rápida
            const noiseUv = vec2(uv().x, h.mul(0.5).sub(t.mul(0.2)))
            const warp1 = texture(perlinTexture, noiseUv).r.remap(0.4, 0.7)

            // Cintas helicoidales
            const helixMain = angle.mul(3.0).sub(h.mul(9.5)).add(spin).add(warp1.mul(2.6))
            const helixFine = angle.mul(8.0).sub(h.mul(21.0)).add(spin.mul(1.35))
            const ribbonSignal = sin(helixMain).mul(0.6).add(sin(helixFine).mul(0.3))

            // Máscara vertical de extremos orgánicos
            const topCutout = smoothstep(0.98, 0.75, h)
            const bottomCutout = smoothstep(0.0, 0.05, h)
            const verticalMask = topCutout.mul(bottomCutout)

            // Calor y gradiente térmico de cuerpo negro
            const heat = smoothstep(-0.25, 0.88, ribbonSignal.add(warp1.mul(0.35)))
            const fireCol = getBlackbodyColor(heat, emissiveColor)

            const alpha = smoothstep(-0.15, 0.38, ribbonSignal).mul(verticalMask)
            alpha.lessThan(0.02).discard()

            return vec4(fireCol, alpha)
        })()

        const coreMesh = new THREE.Mesh(funnelGeo, coreMat)
        coreMesh.position.set(this.position.x, 0.0, this.position.z)
        coreMesh.renderOrder = 2
        coreMesh.frustumCulled = false
        this.game.scene.add(coreMesh)
        this.objects.hideable.push(coreMesh)

        // =========================================================================
        // 4. CAPA 2: CORAZÓN DE PLASMA ULTRA-INCANDESCENTE (FILAMENTOS ADITIVOS)
        // =========================================================================
        const plasmaMat = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })

        plasmaMat.positionNode = funnelVertex(positionLocal, float(0.80))

        plasmaMat.outputNode = Fn(() =>
        {
            const h = uv().y
            const angle = uv().x.mul(PI.mul(2))
            const t = timeNode.mul(timeScale)

            const spin = t.mul(float(8.0).sub(h.mul(2.5)))
            const noiseUv = vec2(uv().x.add(0.33), h.mul(0.6).sub(t.mul(0.25)))
            const warp = texture(perlinTexture, noiseUv).r.remap(0.4, 0.7)

            const helixMain = angle.mul(3.0).sub(h.mul(9.5)).add(spin).add(warp.mul(2.2))
            const ribbonSignal = sin(helixMain)

            const verticalMask = smoothstep(0.95, 0.70, h).mul(smoothstep(0.01, 0.06, h))
            const heat = smoothstep(0.15, 0.95, ribbonSignal).add(0.35)
            const plasmaCol = getBlackbodyColor(heat, emissiveColor).mul(1.2)

            const alpha = smoothstep(0.1, 0.65, ribbonSignal).mul(verticalMask).mul(0.7)
            alpha.lessThan(0.02).discard()

            return vec4(plasmaCol, alpha)
        })()

        const plasmaMesh = new THREE.Mesh(funnelGeo, plasmaMat)
        plasmaMesh.position.set(this.position.x, 0.0, this.position.z)
        plasmaMesh.renderOrder = 3
        plasmaMesh.frustumCulled = false
        this.game.scene.add(plasmaMesh)
        this.objects.hideable.push(plasmaMesh)

        // =========================================================================
        // 5. CAPA 3: MANTO EXTERIOR DE HUMO Y HOLLÍN (AUTO-OCLUSIÓN REALISTA)
        // =========================================================================
        const smokeMat = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.FrontSide,
            depthWrite: false
        })

        smokeMat.positionNode = funnelVertex(positionLocal, float(1.05))

        smokeMat.outputNode = Fn(() =>
        {
            const h = uv().y
            const angle = uv().x.mul(PI.mul(2))
            const t = timeNode.mul(timeScale)

            const spin = t.mul(float(7.0).sub(h.mul(2.0)))
            const noiseUv = vec2(uv().x.add(0.67), h.mul(0.4).sub(t.mul(0.15)))
            const warp = texture(perlinTexture, noiseUv).r.remap(0.4, 0.7)

            const helixMain = angle.mul(3.0).sub(h.mul(9.5)).add(spin).add(warp.mul(2.0))
            const smokeSignal = sin(helixMain.add(1.15)).mul(0.65).add(sin(angle.mul(8.0).sub(h.mul(20.0))).mul(0.35))

            const verticalMask = smoothstep(0.98, 0.72, h).mul(smoothstep(0.0, 0.05, h))
            const smokeMask = smoothstep(-0.08, 0.52, smokeSignal).mul(smokeDensity)

            // Resplandor en los bordes de brasa de las plumas de humo
            const rimHeat = smoothstep(0.45, 0.0, abs(smokeSignal.sub(0.12)))
            const smokeColor = vec3(0.022, 0.008, 0.005)
            const glowingEdge = getBlackbodyColor(float(0.68), emissiveColor).mul(rimHeat).mul(0.95)

            const finalCol = smokeColor.add(glowingEdge)
            const alpha = smokeMask.mul(verticalMask).mul(0.92)
            alpha.lessThan(0.02).discard()

            return vec4(finalCol, alpha)
        })()

        const smokeMesh = new THREE.Mesh(funnelGeo, smokeMat)
        smokeMesh.position.set(this.position.x, 0.0, this.position.z)
        smokeMesh.renderOrder = 4
        smokeMesh.frustumCulled = false
        this.game.scene.add(smokeMesh)
        this.objects.hideable.push(smokeMesh)

        // =========================================================================
        // 6. BRASAS VOLADORAS TANGENCIALES EN GPU (INSTANCED EMBER QUADS)
        // =========================================================================
        const emberCount = 80
        const phaseArray = new Float32Array(emberCount)
        const speedArray = new Float32Array(emberCount)
        const rSeedArray = new Float32Array(emberCount)
        const sizeArray = new Float32Array(emberCount)

        for(let i = 0; i < emberCount; i++)
        {
            phaseArray[i] = Math.random()
            speedArray[i] = 0.6 + Math.random() * 0.8
            rSeedArray[i] = 0.4 + Math.random() * 0.9
            sizeArray[i] = 0.4 + Math.random() * 0.8
        }

        const phaseAttr = instancedArray(phaseArray, 'float').toAttribute()
        const speedAttr = instancedArray(speedArray, 'float').toAttribute()
        const rSeedAttr = instancedArray(rSeedArray, 'float').toAttribute()
        const sizeAttr = instancedArray(sizeArray, 'float').toAttribute()

        const emberGeo = new THREE.PlaneGeometry(0.2, 0.45)
        const emberMat = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })

        emberMat.positionNode = Fn(() =>
        {
            const t = timeNode.mul(timeScale)
            const life = fract(phaseAttr.add(t.mul(speedAttr).mul(0.4)))
            const hNorm = life.mul(0.7)

            const funnelR = getParabolicRadius(hNorm, parabolStrength, parabolOffset).mul(radiusScale)
            const orbitR = funnelR.mul(rSeedAttr.add(0.1))

            const angle = phaseAttr.mul(PI.mul(8.0)).add(t.mul(speedAttr).mul(5.5))
            const spine = getParabolicSpine(hNorm, t, parabolAmplitude)

            const centerPos = vec3(
                spine.x.add(cos(angle).mul(orbitR)),
                hNorm.mul(heightVal).add(0.1),
                spine.y.add(sin(angle).mul(orbitR))
            )

            const dispPos = positionLocal.mul(sizeAttr).toVar()
            return centerPos.add(dispPos)
        })()

        emberMat.outputNode = Fn(() =>
        {
            const t = timeNode.mul(timeScale)
            const life = fract(phaseAttr.add(t.mul(speedAttr).mul(0.4)))
            const dist = uv().sub(0.5).length()
            const shapeMask = smoothstep(0.5, 0.05, dist)
            const flicker = sin(t.mul(16.0).add(phaseAttr.mul(30.0))).mul(0.25).add(0.75)
            const alpha = shapeMask.mul(sin(life.mul(PI))).mul(flicker)

            const col = getBlackbodyColor(float(0.88), emissiveColor).mul(1.5)
            alpha.lessThan(0.02).discard()

            return vec4(col, alpha)
        })()

        const emberMesh = new THREE.Mesh(emberGeo, emberMat)
        emberMesh.count = emberCount
        emberMesh.position.set(this.position.x, 0.0, this.position.z)
        emberMesh.renderOrder = 5
        emberMesh.frustumCulled = false
        this.game.scene.add(emberMesh)
        this.objects.hideable.push(emberMesh)

        // =========================================================================
        // ANIMACIÓN DE SACRIFICIO / INTERACCIÓN
        // =========================================================================
        this.animateTornado = () =>
        {
            gsap.fromTo(
                timeScale,
                { value: 1.2 },
                { value: 0.48, duration: 2.8, ease: 'power2.out' }
            )
            gsap.fromTo(
                parabolAmplitude,
                { value: 0.8 },
                { value: 0.42, duration: 2.2, ease: 'elastic.out(1, 0.35)' }
            )
            gsap.fromTo(
                smokeDensity,
                { value: 1.3 },
                { value: 0.88, duration: 3.0, ease: 'power2.out' }
            )
        }

        // Debug bindings
        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, emissiveColor.value, 'emissiveColor')
            this.debugPanel.addBinding(timeScale, 'value', { label: 'timeScale', min: 0.05, max: 2.0, step: 0.01 })
            this.debugPanel.addBinding(parabolStrength, 'value', { label: 'parabolStrength', min: 0.5, max: 3.0, step: 0.01 })
            this.debugPanel.addBinding(parabolOffset, 'value', { label: 'parabolOffset', min: 0.1, max: 1.5, step: 0.01 })
            this.debugPanel.addBinding(parabolAmplitude, 'value', { label: 'parabolAmplitude', min: 0.0, max: 1.5, step: 0.01 })
            this.debugPanel.addBinding(smokeDensity, 'value', { label: 'smokeDensity', min: 0.1, max: 2.0, step: 0.01 })
            this.debugPanel.addBinding(heightVal, 'value', { label: 'height', min: 5.0, max: 35.0, step: 0.5 })
            this.debugPanel.addBinding(radiusScale, 'value', { label: 'radiusScale', min: 1.0, max: 8.0, step: 0.1 })
        }
    }

    setData()
    {
        this.data = {}
        
        this.data.insert = () =>
        {
            this.game.server.send({
                type: 'cataclysmInsert'
            })
        }

        // Server message event
        this.game.server.events.on('message', (data) =>
        {
            if(data.type === 'init' || data.type === 'cataclysmUpdate')
            {
                this.updateText(data.cataclysmCount)
                this.progressUniform.value = data.cataclysmProgress
            }
        })

        if(this.game.server.initData)
        {
            this.updateText(this.game.server.initData.cataclysmCount)
            this.progressUniform.value = this.game.server.initData.cataclysmProgress
        }
    }

    updateText(value)
    {
        if(typeof value === 'number')
        {
            this.value = value
        }
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'altar')
        })
    }

    setTornadoInteraction()
    {
        this.tornadoState = 'idle'
        this.tornadoCooldown = 0
        this.liftElapsed = 0
        this.liftStartAngle = 0
        this.liftStartRadius = 0
        this.liftStartY = 0

        this.game.ticker.events.on('tick', () =>
        {
            this.updateTornadoInteraction()
        }, 4)
    }

    updateTornadoInteraction()
    {
        const dt = this.game.ticker.deltaScaled || 1 / 60
        if(dt <= 0) return

        if(this.tornadoCooldown > 0)
        {
            this.tornadoCooldown -= dt
        }

        const physicalVehicle = this.game.physicalVehicle
        if(!physicalVehicle || !physicalVehicle.chassisBody)
            return

        const playerPos = physicalVehicle.position
        const tornadoCenter = this.position

        // 1. ESTADO IDLE: Detectar cercanía al vórtice
        if(this.tornadoState === 'idle')
        {
            if(this.tornadoCooldown <= 0)
            {
                const dx = playerPos.x - tornadoCenter.x
                const dz = playerPos.z - tornadoCenter.z
                const dist = Math.hypot(dx, dz)

                // Cuando esté cerca del tornado (rango ampliado a ~7.2m)
                if(dist < 7.2)
                {
                    this.tornadoState = 'lifting'
                    this.liftElapsed = 0
                    this.liftStartAngle = Math.atan2(dz, dx)
                    this.liftStartRadius = Math.max(1.8, dist)
                    this.liftStartY = playerPos.y

                    // Bloquear controles durante el ascenso y vuelo
                    if(this.game.player)
                        this.game.player.state = Player.STATE_LOCKED

                    // Reproducir animación de salto / vuelo
                    if(this.game.world?.visualVehicle)
                        this.game.world.visualVehicle.playAction('Jump_Loop')

                    // Reproducir sonido de grito mientras es absorbido y mientras cae
                    if(this.sounds?.maleScream)
                    {
                        this.sounds.maleScream.howl.stop()
                        this.sounds.maleScream.play()
                    }

                    // Acelerar tornado
                    if(this.animateTornado)
                        this.animateTornado()
                }
            }
        }
        // 2. ESTADO LIFTING: Atraer, elevar y lanzar hacia arriba durante 3 segundos
        else if(this.tornadoState === 'lifting')
        {
            this.liftElapsed += dt
            const progress = Math.min(1.0, this.liftElapsed / 3.0)

            // Vórtice espiral: primero atrae hacia el centro y luego se abre en la corona
            const currentRadius = this.liftStartRadius * (1.0 - progress * 0.65) + (progress > 0.55 ? Math.pow(progress - 0.55, 1.4) * 6.5 : 0)
            const currentAngle = this.liftStartAngle + progress * Math.PI * 7.5

            // Elevar violentamente hacia arriba (hasta 17 metros de altura)
            const liftHeight = Math.pow(progress, 0.82) * 17.5
            const targetY = this.liftStartY + liftHeight

            const targetX = tornadoCenter.x + Math.cos(currentAngle) * currentRadius
            const targetZ = tornadoCenter.z + Math.sin(currentAngle) * currentRadius

            // Actualizar la posición cinemática de Rapier3D
            physicalVehicle.chassisBody.setTranslation({ x: targetX, y: targetY, z: targetZ }, true)
            physicalVehicle.chassisBody.setNextKinematicTranslation({ x: targetX, y: targetY, z: targetZ })
            physicalVehicle.position.set(targetX, targetY, targetZ)
            physicalVehicle.verticalVelocity = 0
            physicalVehicle.isGrounded = false

            // Orientar al personaje con el giro del vórtice
            const tangentAngle = currentAngle + Math.PI * 0.5
            const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -tangentAngle)
            physicalVehicle.chassisBody.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true)
            physicalVehicle.chassisBody.setNextKinematicRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
            physicalVehicle.quaternion.copy(quat)

            // Al cumplirse exactamente los 3 segundos: lanzar y dejar caer
            if(this.liftElapsed >= 3.0)
            {
                this.tornadoState = 'falling'

                // Lanzar hacia afuera con inercia tangencial y vertical
                const outX = Math.cos(currentAngle) * 6.5
                const outZ = Math.sin(currentAngle) * 6.5
                physicalVehicle.externalVelocity.set(outX, 0, outZ)
                physicalVehicle.verticalVelocity = 3.0 // pequeño impulso inicial antes de la caída libre
                physicalVehicle.isGrounded = false
            }
        }
        // 3. ESTADO FALLING: Caída libre hasta tocar el suelo
        else if(this.tornadoState === 'falling')
        {
            // Detectar impacto con el suelo
            if(physicalVehicle.isGrounded || physicalVehicle.justLanded)
            {
                this.tornadoState = 'landed'
                this.tornadoCooldown = 5.0 // Cooldown para no ser re-succionado al instante

                // Detener el grito al tocar el suelo
                if(this.sounds?.maleScream)
                {
                    this.sounds.maleScream.howl.stop()
                }

                // Sonido de caída / golpe contra el suelo
                if(this.sounds?.bodyFall)
                {
                    this.sounds.bodyFall.play()
                }

                // Reproducir inmediatamente la animación de la tecla (Y) -> Death01
                if(this.game.world?.visualVehicle)
                {
                    this.game.world.visualVehicle.playAction('Death01')
                }

                // Sonido adicional procedural de impacto contra el suelo
                physicalVehicle.proceduralSound?.playLandSound()

                // Desbloquear controles tras 2 segundos para apreciar la animación
                gsap.delayedCall(2.0, () =>
                {
                    if(this.game.player)
                        this.game.player.state = Player.STATE_DEFAULT
                    this.tornadoState = 'idle'
                })
            }
        }
    }
}
