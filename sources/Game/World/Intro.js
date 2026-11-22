import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { attribute, color, dot, float, Fn, max, mix, normalWorld, uniform, vec3, vec4 } from 'three/tsl'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import gsap from 'gsap'
import { Inputs } from '../Inputs/Inputs.js'

export class Intro
{
    constructor()
    {
        this.game = Game.getInstance()

        const respawn = this.game.respawns.getDefault()
        this.center = respawn.position.clone()

        this.disposables = {
            geometries: [],
            materials: []
        }

        this.setCircle()
        this.setLabel()

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 8)
    }

    /**
     * Converts screen-aligned floor offsets (lx = screen right, ly = screen up)
     * into world XZ coordinates relative to this.center for the 45° isometric camera.
     */
    getIsoPosition(lx, ly, y = 0)
    {
        const SQRT2_INV = Math.SQRT1_2
        return new THREE.Vector3(
            this.center.x + (lx - ly) * SQRT2_INV,
            y,
            this.center.z + (-lx - ly) * SQRT2_INV
        )
    }

    setLabel()
    {
        const isDesktop = this.game.quality.level === 0

        // Grupo izquierdo: "CLICK TO START" estilo 3D con parpadeo
        this.startGroup = new THREE.Group()
        this.startBasePos = isDesktop
            ? this.getIsoPosition(-4.7, -1.1, 1.15)
            : this.getIsoPosition(-3.8, -1.0, 1.25)
        this.startGroup.position.copy(this.startBasePos)
        this.startGroup.rotation.reorder('YXZ')
        this.startGroup.rotation.y = Math.PI * 0.25 + 0.18
        this.startGroup.rotation.x = -0.32
        this.startGroup.scale.setScalar(0.001)
        this.game.scene.add(this.startGroup)

        // Grupo derecho: botón de sonido 3D apoyado en el suelo
        this.soundGroup = new THREE.Group()
        this.soundBasePos = isDesktop
            ? this.getIsoPosition(4.8, -0.8, 0.0)
            : this.getIsoPosition(4.4, -0.9, 0.0)
        this.soundGroup.position.copy(this.soundBasePos)
        this.soundGroup.rotation.y = Math.PI * 0.25
        this.soundGroup.scale.setScalar(0.001)
        this.game.scene.add(this.soundGroup)

        this.labelShown = false
    }

    createLetterJGeometry()
    {
        const positions = []
        const progresses = []
        const indices = []

        const HW = 0.35 // Mucho más gruesa y sólida

        const addRibbon = (points, progStart, progEnd) =>
        {
            const startIndex = positions.length / 3
            const count = points.length

            for(let i = 0; i < count; i++)
            {
                const p = points[i]
                const t = progStart + (i / (count - 1)) * (progEnd - progStart)

                let tx, ty
                if(i === 0)
                {
                    tx = points[1].x - points[0].x
                    ty = points[1].y - points[0].y
                }
                else if(i === count - 1)
                {
                    tx = points[count - 1].x - points[count - 2].x
                    ty = points[count - 1].y - points[count - 2].y
                }
                else
                {
                    tx = points[i + 1].x - points[i - 1].x
                    ty = points[i + 1].y - points[i - 1].y
                }
                const len = Math.hypot(tx, ty) || 1
                tx /= len
                ty /= len

                const nx = - ty
                const ny = tx

                positions.push(p.x + nx * HW, p.y + ny * HW, 0)
                progresses.push(t)

                positions.push(p.x - nx * HW, p.y - ny * HW, 0)
                progresses.push(t)
            }

            for(let i = 0; i < count - 1; i++)
            {
                const base = startIndex + i * 2
                indices.push(base, base + 1, base + 2)
                indices.push(base + 2, base + 1, base + 3)
            }
        }

        // 1. Barra superior horizontal: de izquierda a derecha (0.0 a 0.28)
        const topBarPts = []
        for(let i = 0; i <= 35; i++)
        {
            const u = i / 35
            topBarPts.push({ x: -2.6 + u * 4.4, y: 2.2 })
        }
        addRibbon(topBarPts, 0.0, 0.28)

        // 2. Fuste vertical: desde la barra superior hacia abajo (0.28 a 0.65)
        const stemPts = []
        for(let i = 0; i <= 40; i++)
        {
            const u = i / 40
            stemPts.push({ x: 0.8, y: 2.2 - u * 2.8 })
        }
        addRibbon(stemPts, 0.28, 0.65)

        // 3. Gancho curvo inferior: describe semicírculo y sube por la izquierda (0.65 a 1.0)
        const hookPts = [
            { x: 0.8, y: -0.6 },
            { x: 0.7, y: -1.2 },
            { x: 0.4, y: -1.8 },
            { x: -0.1, y: -2.1 },
            { x: -0.7, y: -2.1 },
            { x: -1.3, y: -1.8 },
            { x: -1.8, y: -1.3 },
            { x: -1.8, y: -0.7 },
            { x: -1.8, y: -0.1 }
        ]
        addRibbon(hookPts, 0.65, 1.0)

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geo.setAttribute('progress', new THREE.Float32BufferAttribute(progresses, 1))
        geo.setIndex(indices)

        return geo
    }

    setCircle()
    {
        this.circle = {}
        
        this.circle.progress = 0
        this.circle.smoothedProgress = uniform(0)
        this.circle.alpha = uniform(1.0)

        // Geometría procedural de la letra "J"
        const geometry = this.createLetterJGeometry()

        // Material TSL con dibujo dinámico por progreso y haz láser brillante en la punta
        const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true })
        material.outputNode = Fn(() =>
        {
            const vertProgress = attribute('progress')
            this.circle.smoothedProgress.lessThan(vertProgress).discard()

            // Haz de luz más intenso y brillante en la punta que va dibujando la letra "J"
            const tipDist = this.circle.smoothedProgress.sub(vertProgress).abs()
            const tipGlow = tipDist.lessThan(0.045).select(float(2.2), float(1.0))

            return vec4(this.game.reveal.color.mul(this.game.reveal.intensity).mul(tipGlow), this.circle.alpha)
        })()

        // Malla
        const mesh = new THREE.Mesh(geometry, material)
        
        mesh.position.copy(this.center)
        mesh.position.y = 0.002
        mesh.rotation.x = - Math.PI * 0.5
        mesh.rotation.z = Math.PI * 0.25 // Orientada de frente a la vista isométrica (45°)
        mesh.scale.setScalar(1.0)
        
        this.game.scene.add(mesh)

        this.circle.mesh = mesh

        // Animación de apertura de la letra "J" sincronizada con la expansión del mundo
        this.circle.hide = (callback = null) =>
        {
            if(typeof callback === 'function')
                callback()

            const dummy = { scale: 1.0 }
            const speedMultiplier = this.game.debug.active ? 4 : 1

            const tl = gsap.timeline({
                onComplete: () =>
                {
                    mesh.removeFromParent()
                }
            })

            // Pulso brillante de alta intensidad
            tl.to(this.game.reveal.intensity, {
                value: 8.5,
                duration: 0.35 / speedMultiplier,
                ease: 'power2.out'
            })

            // Expansión dramática de la "J" hacia el exterior abriendo el mundo
            tl.to(dummy, {
                scale: 1.8,
                duration: 1.15 / speedMultiplier,
                ease: 'power2.out',
                onUpdate: () =>
                {
                    mesh.scale.setScalar(dummy.scale)
                }
            }, 0)

            // Desvanecimiento suave que se fusiona con la apertura en forma de J del terreno
            tl.to(this.circle.alpha, {
                value: 0,
                duration: 0.75 / speedMultiplier,
                ease: 'power2.in'
            }, 0.25 / speedMultiplier)

            tl.to(this.game.reveal.intensity, {
                value: 5.5,
                duration: 0.7 / speedMultiplier,
                ease: 'power2.in'
            }, 0.45 / speedMultiplier)
        }
    }

    setText()
    {
        this.text = {}
        this.text.meshGroup = new THREE.Group()
        this.startGroup.add(this.text.meshGroup)

        // Uniforms de parpadeo y hover para el texto 3D
        const blinkUniform = uniform(1.0)
        const hoverUniform = uniform(1.0)
        this.text.blinkUniform = blinkUniform
        this.text.hoverUniform = hoverUniform
        this.text.isHovered = false

        // Material 3D con sombreado direccional + bordes neón y parpadeo HDR
        const keyLightDir = vec3(0.45, 0.72, 0.52).normalize()
        const rimLightDir = vec3(-0.65, 0.30, -0.68).normalize()

        const textMaterial = new THREE.MeshBasicNodeMaterial({ transparent: false })
        textMaterial.outputNode = Fn(() =>
        {
            const n = normalWorld.normalize()
            const ndl = max(dot(n, keyLightDir), float(0.0001))
            const rim = max(dot(n, rimLightDir), float(0.0))

            const sideColor = mix(color('#521db3'), this.game.reveal.color, rim.mul(0.55).add(0.28))
            const litColor = mix(sideColor, vec3(1.0, 0.97, 1.0), ndl.pow(0.7))

            return vec4(litColor.mul(blinkUniform).mul(hoverUniform), float(1.0))
        })()
        this.disposables.materials.push(textMaterial)
        this.text.material = textMaterial

        // Barra inferior 3D acentuada que también parpadea
        const accentGeo = new THREE.BoxGeometry(2.65, 0.08, 0.16)
        const accentMat = new THREE.MeshBasicNodeMaterial({ transparent: false })
        accentMat.outputNode = Fn(() =>
        {
            const n = normalWorld.normalize()
            const ndl = max(dot(n, keyLightDir), float(0.0))
            const base = mix(color('#7b3fe4'), this.game.reveal.color, ndl.mul(0.7).add(0.3))
            return vec4(base.mul(blinkUniform).mul(hoverUniform).mul(1.25), float(1.0))
        })()
        this.disposables.geometries.push(accentGeo)
        this.disposables.materials.push(accentMat)

        const accentMesh = new THREE.Mesh(accentGeo, accentMat)
        accentMesh.position.set(0, -0.82, 0.04)
        this.text.meshGroup.add(accentMesh)

        this.text.font = null
        this.text.currentLinesKey = null
        this.text.letterMeshes = []

        const getActionLines = () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                return [ 'TAP TO', 'START' ]
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                return [ 'PRESS TO', 'START' ]
            return [ 'CLICK TO', 'START' ]
        }

        const build3DLetters = () =>
        {
            if(this.destroyed || !this.text.font)
                return

            const lines = getActionLines()
            const linesKey = lines.join('|')
            if(linesKey === this.text.currentLinesKey)
                return
            this.text.currentLinesKey = linesKey

            // Limpiar letras previas si cambia el modo de entrada
            for(const oldMesh of this.text.letterMeshes)
            {
                oldMesh.removeFromParent()
                oldMesh.geometry.dispose()
            }
            this.text.letterMeshes = []

            const specs = [
                { text: lines[0], size: 0.44, depth: 0.24, bevelThickness: 0.04, bevelSize: 0.022, y: 0.28 },
                { text: lines[1], size: 0.64, depth: 0.28, bevelThickness: 0.05, bevelSize: 0.028, y: -0.56 }
            ]

            for(const spec of specs)
            {
                const geo = new TextGeometry(spec.text, {
                    font: this.text.font,
                    size: spec.size,
                    depth: spec.depth,
                    curveSegments: 8,
                    bevelEnabled: true,
                    bevelThickness: spec.bevelThickness,
                    bevelSize: spec.bevelSize,
                    bevelOffset: 0,
                    bevelSegments: 3
                })
                geo.computeBoundingBox()
                const centerX = -0.5 * (geo.boundingBox.max.x + geo.boundingBox.min.x)
                geo.translate(centerX, spec.y, -spec.depth * 0.5)

                const mesh = new THREE.Mesh(geo, textMaterial)
                this.text.meshGroup.add(mesh)
                this.text.letterMeshes.push(mesh)
            }
        }

        const fontLoader = new FontLoader()
        fontLoader.load('fonts/helvetiker_bold.typeface.json', (font) =>
        {
            if(this.destroyed)
                return
            this.text.font = font
            build3DLetters()
        })

        this.text.updateText = () => build3DLetters()
        this.game.inputs.gamepad.events.on('typeChange', this.text.updateText)
        this.game.inputs.events.on('modeChange', this.text.updateText)

        // Hacer clickeable directamente el "CLICK TO START" 3D
        this.text.intersect = this.game.rayCursor.addIntersect({
            active: true,
            shape: new THREE.Sphere(this.startBasePos.clone(), 1.85),
            onClick: () =>
            {
                if(this.game.reveal.step === 0)
                    this.game.inputs.events.trigger('introStart')
            },
            onEnter: () =>
            {
                this.text.isHovered = true
                gsap.to(hoverUniform, { value: 1.45, duration: 0.25, overwrite: true })
                gsap.to(this.text.meshGroup.scale, { x: 1.07, y: 1.07, z: 1.07, duration: 0.25, ease: 'back.out(2)', overwrite: true })
            },
            onLeave: () =>
            {
                this.text.isHovered = false
                gsap.to(hoverUniform, { value: 1.0, duration: 0.25, overwrite: true })
                gsap.to(this.text.meshGroup.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'power2.out', overwrite: true })
            }
        })
    }

    setSoundButton()
    {
        this.soundButton = {}

        const isMuted = !!this.game.audio.mute.active
        const hoverIntensity = uniform(1.0)
        const muteFactor = uniform(isMuted ? 1.0 : 0.0)
        const wavePulse1 = uniform(1.0)
        const wavePulse2 = uniform(1.0)

        this.soundButton.hoverIntensity = hoverIntensity
        this.soundButton.muteFactor = muteFactor
        this.soundButton.wavePulse1 = wavePulse1
        this.soundButton.wavePulse2 = wavePulse2

        const keyLightDir = vec3(0.45, 0.80, 0.40).normalize()
        const rimLightDir = vec3(-0.6, 0.4, -0.65).normalize()

        // 1. Anillo neón exterior apoyado en el suelo (fijo en y = 0)
        const ringGeo = new THREE.TorusGeometry(0.98, 0.055, 14, 48)
        ringGeo.rotateX(Math.PI * 0.5)
        const ringMat = new THREE.MeshBasicNodeMaterial({ transparent: false })
        ringMat.outputNode = Fn(() =>
        {
            const n = normalWorld.normalize()
            const ndl = max(dot(n, keyLightDir), float(0.0))
            const activeCol = mix(color('#8e52ff'), this.game.reveal.color, ndl.mul(0.6).add(0.4))
            const mutedCol = mix(color('#9c1b3b'), color('#ff4d6d'), ndl.mul(0.6).add(0.4))
            const col = mix(activeCol, mutedCol, muteFactor)
            return vec4(col.mul(hoverIntensity).mul(1.35), float(1.0))
        })()
        this.disposables.geometries.push(ringGeo)
        this.disposables.materials.push(ringMat)

        const outerRing = new THREE.Mesh(ringGeo, ringMat)
        outerRing.position.y = 0.06
        this.soundGroup.add(outerRing)

        // 2. Grupo móvil del botón físico en el suelo (se hunde al hacer clic)
        const buttonTop = new THREE.Group()
        this.soundGroup.add(buttonTop)
        this.soundButton.buttonTop = buttonTop

        // Base cilíndrica biselada apoyada en el suelo
        const padGeo = new THREE.CylinderGeometry(0.86, 0.96, 0.16, 40)
        const padMat = new THREE.MeshBasicNodeMaterial({ transparent: false })
        padMat.outputNode = Fn(() =>
        {
            const n = normalWorld.normalize()
            const ndl = max(dot(n, keyLightDir), float(0.0001))
            const rim = max(dot(n, rimLightDir), float(0.0))
            const sideCol = color('#160d26')
            const topCol = mix(color('#2a1847'), color('#3b2363'), rim.mul(0.5))
            const base = mix(sideCol, topCol, ndl.pow(0.8))
            return vec4(base.mul(hoverIntensity.mul(0.25).add(0.75)), float(1.0))
        })()
        this.disposables.geometries.push(padGeo)
        this.disposables.materials.push(padMat)

        const padMesh = new THREE.Mesh(padGeo, padMat)
        padMesh.position.y = 0.08
        buttonTop.add(padMesh)

        // Aro interior biselado sobre el botón
        const innerRimGeo = new THREE.TorusGeometry(0.76, 0.022, 10, 40)
        innerRimGeo.rotateX(Math.PI * 0.5)
        const innerRimMat = new THREE.MeshBasicNodeMaterial({ transparent: false })
        innerRimMat.outputNode = Fn(() =>
        {
            const col = mix(color('#7b45d9'), color('#c73654'), muteFactor)
            return vec4(col.mul(hoverIntensity), float(1.0))
        })()
        this.disposables.geometries.push(innerRimGeo)
        this.disposables.materials.push(innerRimMat)

        const innerRim = new THREE.Mesh(innerRimGeo, innerRimMat)
        innerRim.position.y = 0.165
        buttonTop.add(innerRim)

        // 3. Ícono 3D del altavoz (extruido hacia arriba en relieve sobre el suelo)
        const speakerShape = new THREE.Shape()
        speakerShape.moveTo(-0.46, -0.14)
        speakerShape.lineTo(-0.22, -0.14)
        speakerShape.lineTo(0.05, -0.35)
        speakerShape.lineTo(0.05, 0.35)
        speakerShape.lineTo(-0.22, 0.14)
        speakerShape.lineTo(-0.46, 0.14)
        speakerShape.closePath()

        const speakerGeo = new THREE.ExtrudeGeometry(speakerShape, {
            depth: 0.14,
            bevelEnabled: true,
            bevelThickness: 0.028,
            bevelSize: 0.02,
            bevelSegments: 2
        })
        speakerGeo.rotateX(-Math.PI * 0.5)

        const speakerMat = new THREE.MeshBasicNodeMaterial({ transparent: false })
        speakerMat.outputNode = Fn(() =>
        {
            const n = normalWorld.normalize()
            const ndl = max(dot(n, keyLightDir), float(0.0001))
            const activeSide = color('#8448e8')
            const activeTop = vec3(1.0, 0.98, 1.0)
            const mutedSide = color('#78283e')
            const mutedTop = vec3(0.95, 0.72, 0.78)
            const top = mix(activeTop, mutedTop, muteFactor)
            const side = mix(activeSide, mutedSide, muteFactor)
            const col = mix(side, top, ndl.pow(0.65))
            return vec4(col.mul(hoverIntensity).mul(1.15), float(1.0))
        })()
        this.disposables.geometries.push(speakerGeo)
        this.disposables.materials.push(speakerMat)

        const speakerMesh = new THREE.Mesh(speakerGeo, speakerMat)
        speakerMesh.position.y = 0.165
        buttonTop.add(speakerMesh)

        // Helper para arcos 3D de ondas de sonido
        const createArcGeometry = (innerR, outerR, startAngle, endAngle) =>
        {
            const shape = new THREE.Shape()
            const segments = 16
            for(let i = 0; i <= segments; i++)
            {
                const a = startAngle + (endAngle - startAngle) * (i / segments)
                const x = Math.cos(a) * outerR
                const y = Math.sin(a) * outerR
                if(i === 0) shape.moveTo(x, y)
                else shape.lineTo(x, y)
            }
            for(let i = segments; i >= 0; i--)
            {
                const a = startAngle + (endAngle - startAngle) * (i / segments)
                const x = Math.cos(a) * innerR
                const y = Math.sin(a) * innerR
                shape.lineTo(x, y)
            }
            shape.closePath()

            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: 0.13,
                bevelEnabled: true,
                bevelThickness: 0.022,
                bevelSize: 0.015,
                bevelSegments: 2
            })
            geo.rotateX(-Math.PI * 0.5)
            return geo
        }

        const makeWaveMaterial = (pulseUniform) =>
        {
            const mat = new THREE.MeshBasicNodeMaterial({ transparent: false })
            mat.outputNode = Fn(() =>
            {
                const n = normalWorld.normalize()
                const ndl = max(dot(n, keyLightDir), float(0.0001))
                const col = mix(color('#9b5cff'), vec3(0.88, 0.98, 1.0), ndl.pow(0.6))
                return vec4(col.mul(pulseUniform).mul(hoverIntensity).mul(1.3), float(1.0))
            })()
            this.disposables.materials.push(mat)
            return mat
        }

        // 4. Ondas de sonido 3D (visibles cuando NO está muteado)
        const wavesGroup = new THREE.Group()
        wavesGroup.position.set(0.02, 0.165, 0)
        buttonTop.add(wavesGroup)

        const wave1Geo = createArcGeometry(0.21, 0.29, -0.72, 0.72)
        const wave2Geo = createArcGeometry(0.37, 0.45, -0.82, 0.82)
        this.disposables.geometries.push(wave1Geo, wave2Geo)

        const wave1Mesh = new THREE.Mesh(wave1Geo, makeWaveMaterial(wavePulse1))
        const wave2Mesh = new THREE.Mesh(wave2Geo, makeWaveMaterial(wavePulse2))
        wavesGroup.add(wave1Mesh, wave2Mesh)
        this.soundButton.wavesGroup = wavesGroup

        // 5. Cruz "X" 3D roja (visible cuando está muteado)
        const muteGroup = new THREE.Group()
        muteGroup.position.set(0.31, 0.24, 0)
        buttonTop.add(muteGroup)

        const xBarGeo = new THREE.BoxGeometry(0.36, 0.14, 0.08)
        const xBarMat = new THREE.MeshBasicNodeMaterial({ transparent: false })
        xBarMat.outputNode = Fn(() =>
        {
            const n = normalWorld.normalize()
            const ndl = max(dot(n, keyLightDir), float(0.0001))
            const col = mix(color('#c71d45'), color('#ff6b8b'), ndl.pow(0.65))
            return vec4(col.mul(hoverIntensity).mul(1.4), float(1.0))
        })()
        this.disposables.geometries.push(xBarGeo)
        this.disposables.materials.push(xBarMat)

        const xBar1 = new THREE.Mesh(xBarGeo, xBarMat)
        xBar1.rotation.y = Math.PI * 0.25
        const xBar2 = new THREE.Mesh(xBarGeo, xBarMat)
        xBar2.rotation.y = -Math.PI * 0.25
        muteGroup.add(xBar1, xBar2)
        this.soundButton.muteGroup = muteGroup

        const applyMuteVisual = (active) =>
        {
            wavesGroup.visible = !active
            muteGroup.visible = active
            gsap.to(muteFactor, { value: active ? 1.0 : 0.0, duration: 0.25, overwrite: true })
        }
        applyMuteVisual(isMuted)

        // Intersect en el suelo (sin solaparse con la esfera central de la J)
        const intersectPos = this.soundBasePos.clone()
        intersectPos.y = 0.22
        const intersectRadius = this.game.quality.level === 0 ? 1.05 : 0.95

        this.soundButton.intersect = this.game.rayCursor.addIntersect({
            active: true,
            shape: new THREE.Sphere(intersectPos, intersectRadius),
            onClick: () =>
            {
                this.game.audio.mute.toggle()

                // Efecto mecánico de pulsación en el suelo
                gsap.killTweensOf(buttonTop.position)
                gsap.timeline()
                    .to(buttonTop.position, { y: -0.075, duration: 0.08, ease: 'power2.out' })
                    .to(buttonTop.position, { y: 0.02, duration: 0.22, ease: 'back.out(3)' })
            },
            onEnter: () =>
            {
                gsap.to(hoverIntensity, { value: 1.45, duration: 0.25, overwrite: true })
                gsap.to(buttonTop.position, { y: 0.03, duration: 0.25, ease: 'power2.out', overwrite: true })
                gsap.to(this.soundGroup.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.25, ease: 'back.out(2)', overwrite: true })
            },
            onLeave: () =>
            {
                gsap.to(hoverIntensity, { value: 1.0, duration: 0.25, overwrite: true })
                gsap.to(buttonTop.position, { y: 0.0, duration: 0.25, ease: 'power2.out', overwrite: true })
                gsap.to(this.soundGroup.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.25, ease: 'power2.out', overwrite: true })
            }
        })

        this.soundButton.onMuteChange = (active) =>
        {
            applyMuteVisual(active)
        }
        this.game.audio.events.on('muteChange', this.soundButton.onMuteChange)
    }

    showLabel()
    {
        this.labelShown = true
        const speedMultiplier = this.game.debug.active ? 4 : 1

        // Animación de entrada elástica para el texto 3D izquierdo
        const startDummy = { scale: 0.001 }
        gsap.to(
            startDummy,
            {
                scale: 1,
                duration: 1.8 / speedMultiplier,
                delay: 0.9 / speedMultiplier,
                ease: 'elastic.out(0.65, 0.55)',
                overwrite: true,
                onUpdate: () =>
                {
                    this.startGroup.scale.setScalar(startDummy.scale)
                }
            }
        )

        // Animación de entrada elástica para el botón de sonido 3D derecho en el suelo
        const soundDummy = { scale: 0.001 }
        gsap.to(
            soundDummy,
            {
                scale: 1,
                duration: 1.6 / speedMultiplier,
                delay: 1.05 / speedMultiplier,
                ease: 'elastic.out(0.65, 0.55)',
                overwrite: true,
                onUpdate: () =>
                {
                    this.soundGroup.scale.setScalar(soundDummy.scale)
                }
            }
        )
    }

    hideLabel()
    {
        this.labelShown = false
        const speedMultiplier = this.game.debug.active ? 4 : 1
        const dummy = { scale: 1 }

        if(this.text?.intersect)
        {
            this.game.rayCursor.removeIntersect(this.text.intersect)
            this.text.intersect = null
        }
        if(this.soundButton?.intersect)
        {
            this.game.rayCursor.removeIntersect(this.soundButton.intersect)
            this.soundButton.intersect = null
        }

        gsap.to(
            dummy,
            {
                scale: 0.001,
                duration: 0.35 / speedMultiplier,
                ease: 'power2.in',
                overwrite: true,
                onUpdate: () =>
                {
                    this.startGroup.scale.setScalar(dummy.scale)
                    this.soundGroup.scale.setScalar(dummy.scale)
                },
                onComplete: () =>
                {
                    this.startGroup.removeFromParent()
                    this.soundGroup.removeFromParent()
                }
            }
        )
    }

    updateProgress(progress)
    {
        this.circle.progress = progress
    }

    update()
    {
        const diff = this.circle.progress - this.circle.smoothedProgress.value
        this.circle.smoothedProgress.value += diff * Math.min(1, this.game.ticker.delta * 4.5)

        const elapsed = this.game.ticker.elapsed

        // Parpadeo rítmico y flotación sutil para "CLICK TO START" 3D
        if(this.text?.blinkUniform)
        {
            const pulse = Math.pow(0.5 + 0.5 * Math.sin(elapsed * 5.0), 1.5)
            this.text.blinkUniform.value = this.text.isHovered
                ? 1.35 + pulse * 0.45
                : 0.28 + pulse * 1.47
        }

        if(this.labelShown && this.startGroup && this.startBasePos)
        {
            this.startGroup.position.y = this.startBasePos.y + Math.sin(elapsed * 2.4) * 0.08
        }

        // Pulso secuencial en las ondas 3D del botón de sonido cuando el audio está activo
        if(this.soundButton?.wavePulse1 && !this.game.audio.mute.active)
        {
            this.soundButton.wavePulse1.value = 0.75 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 4.5))
            this.soundButton.wavePulse2.value = 0.75 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 4.5 - 1.1))
        }
    }

    destroy()
    {
        this.destroyed = true

        this.startGroup.removeFromParent()
        this.soundGroup.removeFromParent()

        if(this.text?.intersect)
            this.game.rayCursor.removeIntersect(this.text.intersect)
        if(this.soundButton?.intersect)
            this.game.rayCursor.removeIntersect(this.soundButton.intersect)

        // Geometries
        this.circle.mesh.geometry.dispose()
        if(this.text?.letterMeshes)
        {
            for(const mesh of this.text.letterMeshes)
                mesh.geometry.dispose()
        }
        for(const geo of this.disposables.geometries)
            geo.dispose()

        // Materials
        this.circle.mesh.material.dispose()
        for(const mat of this.disposables.materials)
            mat.dispose()

        // Textures
        if(this.game.resources?.soundTexture)
            this.game.resources.soundTexture.dispose()

        // Events
        this.game.ticker.events.off('tick', this.update)
        if(this.text?.updateText)
        {
            this.game.inputs.gamepad.events.off('typeChange', this.text.updateText)
            this.game.inputs.events.off('modeChange', this.text.updateText)
        }
        if(this.soundButton?.onMuteChange)
        {
            this.game.audio.events.off('muteChange', this.soundButton.onMuteChange)
        }
    }
}