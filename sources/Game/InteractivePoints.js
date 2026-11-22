import * as THREE from 'three/webgpu'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Game } from './Game.js'
import { color, float, Fn, mix, step, uniform, uv, vec2, vec3, vec4, texture } from 'three/tsl'
import gsap from 'gsap'
import { MeshDefaultMaterial } from './Materials/MeshDefaultMaterial.js'

/**
 * Construye una única BufferGeometry compartida con el logo 3D "JM + Corona"
 * (portado fielmente de frontend-portfolio/src/game/src/Game/assets/logo.js).
 */
function buildJMCrownGeometry(font)
{
    const textOptions = {
        font,
        size: 1.6,
        depth: 0.52,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.13,
        bevelSize: 0.07,
        bevelOffset: 0,
        bevelSegments: 3,
    }

    const leftGeo = new TextGeometry('J', textOptions)
    leftGeo.computeBoundingBox()

    const rightGeo = new TextGeometry('M', textOptions)
    rightGeo.computeBoundingBox()

    const leftBox = leftGeo.boundingBox
    const rightBox = rightGeo.boundingBox
    const spacing = 0.13
    const totalWidth = (leftBox.max.x - leftBox.min.x) + (rightBox.max.x - rightBox.min.x) + spacing
    const startX = -totalWidth * 0.5 + (leftBox.max.x - leftBox.min.x) * 0.5
    const height = Math.max(leftBox.max.y - leftBox.min.y, rightBox.max.y - rightBox.min.y)
    const yOffset = -height * 0.42

    const leftPosX = startX - 0.49
    const rightPosX = startX + (leftBox.max.x - leftBox.min.x) + spacing * 0.7
    const letterPosY = yOffset - 0.06

    leftGeo.translate(leftPosX, letterPosY, -0.26)
    rightGeo.translate(rightPosX, letterPosY, -0.26)

    // Ancho, centro y borde superior reales de las letras posicionadas
    const lettersMinX = Math.min(leftPosX + leftBox.min.x, rightPosX + rightBox.min.x)
    const lettersMaxX = Math.max(leftPosX + leftBox.max.x, rightPosX + rightBox.max.x)
    const lettersWidth = lettersMaxX - lettersMinX
    const lettersCenterX = (lettersMinX + lettersMaxX) / 2
    const lettersTopY = (yOffset - 0.08) + Math.max(leftBox.max.y, rightBox.max.y)

    const crownShape = new THREE.Shape()
    crownShape.moveTo(-3.8, 1.0)
    crownShape.lineTo(-4.6, 3.5)
    crownShape.lineTo(-2.5, 2.2)
    crownShape.lineTo(-2.2, 4.9)
    crownShape.lineTo(-0.8, 2.7)
    crownShape.lineTo(0, 6.1)
    crownShape.lineTo(0.8, 2.7)
    crownShape.lineTo(2.2, 4.9)
    crownShape.lineTo(2.5, 2.2)
    crownShape.lineTo(4.6, 3.5)
    crownShape.lineTo(3.8, 1.0)
    crownShape.lineTo(-3.8, 1.0)

    const extrudeSettings = {
        depth: 0.9,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.12,
        bevelThickness: 0.14,
    }

    const crownGeo = new THREE.ExtrudeGeometry(crownShape, extrudeSettings)
    crownGeo.translate(0, 0, -0.45)
    crownGeo.rotateX(Math.PI * 0.02)
    crownGeo.translate(0, 2.5, 0)

    const ring1Shape = new THREE.Shape()
    ring1Shape.moveTo(-3.9, 0.4)
    ring1Shape.lineTo(3.9, 0.4)
    ring1Shape.lineTo(3.9, 0.9)
    ring1Shape.lineTo(-3.9, 0.9)
    const ring1Geo = new THREE.ExtrudeGeometry(ring1Shape, extrudeSettings)
    ring1Geo.translate(0, 1.6, -0.45)

    const ring2Shape = new THREE.Shape()
    ring2Shape.moveTo(-3.5, -0.1)
    ring2Shape.lineTo(3.5, -0.1)
    ring2Shape.lineTo(3.5, 0.2)
    ring2Shape.lineTo(-3.5, 0.2)
    const ring2Geo = new THREE.ExtrudeGeometry(ring2Shape, extrudeSettings)
    ring2Geo.translate(0, 0.9, -0.45)

    const originalCrownWidth = 9.2
    const crownScale = (lettersWidth * 0.9) / originalCrownWidth
    const crownMatrix = new THREE.Matrix4()
        .makeTranslation(lettersCenterX, lettersTopY + 0.15 * crownScale, 0)
        .multiply(new THREE.Matrix4().makeScale(crownScale, crownScale, crownScale))

    crownGeo.applyMatrix4(crownMatrix)
    ring1Geo.applyMatrix4(crownMatrix)
    ring2Geo.applyMatrix4(crownMatrix)

    // Normalizar atributos (non-indexed + position + normal) para mergeGeometries sin errores
    const parts = [ leftGeo, rightGeo, crownGeo, ring1Geo, ring2Geo ].map((g) =>
    {
        const nonIndexed = g.index ? g.toNonIndexed() : g
        nonIndexed.deleteAttribute('uv')
        nonIndexed.computeVertexNormals()
        return nonIndexed
    })

    const merged = mergeGeometries(parts, false)
    for(const g of parts) g.dispose()
    leftGeo.dispose()
    rightGeo.dispose()
    crownGeo.dispose()
    ring1Geo.dispose()
    ring2Geo.dispose()

    merged.computeBoundingBox()
    const center = new THREE.Vector3()
    merged.boundingBox.getCenter(center)
    merged.translate(-center.x, -center.y, -center.z)
    merged.computeBoundingSphere()

    return merged
}

export class InteractivePoints
{
    static ALIGN_LEFT = 1
    static ALIGN_RIGHT = 2

    static STATE_HIDDEN = 3
    static STATE_OPEN = 4
    static STATE_CONCEALED = 5

    constructor()
    {
        this.game = Game.getInstance()

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🔹 Interactive Areas',
                expanded: false,
            })
        }

        this.items = []
        this.activeItem = null
        this.revealed = false
        this.temporaryHidden = true
        this.needsTest = false
        this.sharedLogoGeometry = null

        this.setSounds()
        this.setGeometries()
        this.setMaterials()
        this.loadSharedLogoGeometry()
        this.setInputs()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setSounds()
    {
        this.sounds = {}

        this.sounds.reveal = this.game.audio.register({
            group: 'reveal',
            path: 'sounds/paper/PaperMovement_fNAyV_01-3.mp3',
            autoplay: false,
            volume: 0.25
        })

        this.sounds.conceal = this.game.audio.register({
            group: 'reveal',
            path: 'sounds/paper/PaperMovement_fNAyV_01-2.mp3',
            autoplay: false,
            volume: 0.25
        })
    }

    setGeometries()
    {
        this.geometries = {}

        // Placeholder ligero mientras carga helvetiker_bold (se reemplaza en ~30ms por JM + Corona 3D)
        this.geometries.placeholder = new THREE.OctahedronGeometry(0.45, 0)

        // Label
        this.geometries.label = new THREE.PlaneGeometry(1, 1, 1, 1)
        this.geometries.label.translate(0.5, 0, 0)
    }

    setMaterials()
    {
        this.materials = {}

        // Uniforms
        this.playerPosition = uniform(vec2())
        this.backColor = uniform(color('#251f2b'))
        this.frontColor = uniform(color('#ffffff'))

        // Material compartido WebGPU/TSL para todos los logos 3D JM + Corona (blanco plateado pulido)
        this.logoMaterialIdle = new MeshDefaultMaterial({
            colorNode: color('#f2f4f8'),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        // Material iluminado suave cuando el jugador está cerca / hover
        this.logoMaterialActive = new MeshDefaultMaterial({
            colorNode: color('#ffffff').mul(1.35),
            hasCoreShadows: true,
            hasDropShadows: false,
        })

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.backColor.value, 'backColor')
            this.game.debug.addThreeColorBinding(this.debugPanel, this.frontColor.value, 'lineColor')
        }
    }

    loadSharedLogoGeometry()
    {
        const loader = new FontLoader()
        loader.load('fonts/helvetiker_bold.typeface.json', (font) =>
        {
            this.sharedLogoGeometry = buildJMCrownGeometry(font)

            // Actualizar todos los puntos interactivos ya creados con la geometría 3D JM + Corona
            for(const item of this.items)
            {
                if(item.logoMesh)
                {
                    item.logoMesh.geometry = this.sharedLogoGeometry
                }
            }
        })
    }

    setInputs()
    {
        this.game.inputs.events.on('interact', (action) =>
        {
            if(action.active && this.activeItem && this.activeItem.state === InteractivePoints.STATE_OPEN)
            {
                this.activeItem.interact()
            }
        })

        this.game.inputs.interactiveButtons.events.on('interact', () =>
        {
            if(this.activeItem && this.activeItem.state === InteractivePoints.STATE_OPEN)
            {
                this.activeItem.interact()
            }
        })
    }

    create(
        position,
        text = '',
        align = InteractivePoints.ALIGN_LEFT,
        state = InteractivePoints.STATE_CONCEALED,
        interactCallback = null,
        revealCallback = null,
        concealCallback = null,
        hideCallback = null
    )
    {
        const newPosition = position.clone()

        /**
         * 1. Logo 3D giratorio "JM + Corona" (de pie en el mundo 3D)
         */
        const logoMesh = new THREE.Mesh(
            this.sharedLogoGeometry || this.geometries.placeholder,
            this.logoMaterialIdle
        )
        logoMesh.position.copy(newPosition)
        logoMesh.position.y += 0.10
        logoMesh.rotation.y = Math.random() * Math.PI * 2
        logoMesh.scale.setScalar(0)
        logoMesh.castShadow = true
        logoMesh.receiveShadow = true
        logoMesh.visible = false
        this.game.scene.add(logoMesh)

        const logoBaseY = newPosition.y + 0.10
        const bobPhase = Math.random() * Math.PI * 2

        /**
         * 2. Grupo de etiqueta flotante (Label) mirando hacia la cámara isométrica
         */
        const group = new THREE.Group()
        group.rotation.reorder('YXZ')
        group.rotation.x = -Math.PI * 0.15
        group.rotation.y = Math.PI * 0.25
        group.position.copy(newPosition)
        group.position.y += 0.10
        group.scale.setScalar(0.85)
        this.game.scene.add(group)

        const materials = []

        /**
         * Label (tipografía clásica serif)
         */
        const height = 96
        const textPaddingLeft = align === InteractivePoints.ALIGN_LEFT ? 54 : 28
        const textPaddingRight = align === InteractivePoints.ALIGN_LEFT ? 28 : 54
        const textOffsetVertical = 2
        const font = `700 46px Georgia, "Times New Roman", Times, serif`

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        context.font = font

        const formattedText = text.toUpperCase()
        const textSize = context.measureText(formattedText)
        const width = Math.ceil(textSize.width) + textPaddingLeft + textPaddingRight + 4
        canvas.width = width
        canvas.height = height

        // Fondo oscuro elegante (#1e1828) con borde y líneas clásicas doradas/blancas
        context.fillStyle = '#1e1828'
        context.fillRect(0, 0, width, height)

        context.fillStyle = '#ffffff'
        context.fillRect(10, 6, width - 20, 3)
        context.fillRect(10, height - 9, width - 20, 3)

        context.font = font
        context.fillStyle = '#ffffff'
        context.textAlign = 'start'
        context.textBaseline = 'middle'
        context.fillText(formattedText, textPaddingLeft + 1, height * 0.5 + textOffsetVertical)

        const labelTexture = new THREE.CanvasTexture(canvas)
        labelTexture.colorSpace = THREE.SRGBColorSpace
        labelTexture.minFilter = THREE.LinearFilter
        labelTexture.magFilter = THREE.LinearFilter
        labelTexture.generateMipmaps = false
        labelTexture.needsUpdate = true

        const labelMaterial = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        })
        materials.push(labelMaterial)

        const labelOffset = uniform(align === InteractivePoints.ALIGN_LEFT ? -1 : 1)
        labelMaterial.outputNode = Fn(() =>
        {
            const _uv = vec2(
                uv().x.sub(labelOffset),
                uv().y
            )

            // Samplear SIEMPRE antes de cualquier recorte (requerido por WebGPU WGSL uniform control flow)
            const tex = texture(labelTexture, _uv)
            const inBounds = step(float(0.0), _uv.x).mul(step(_uv.x, float(1.0)))

            return vec4(tex.rgb, float(0.94).mul(inBounds))
        })()

        const label = new THREE.Mesh(
            this.geometries.label,
            labelMaterial
        )
        label.renderOrder = 6
        label.scale.x = 0.75 * width / height
        label.scale.y = 0.75
        label.position.z = -0.05
        label.position.x = align === InteractivePoints.ALIGN_LEFT ? 0.34 : -label.scale.x - 0.34
        label.visible = false
        group.add(label)

        /**
         * Item (escala compacta y discreta)
         */
        const SCALE_CONCEALED = 0.13
        const SCALE_OPEN = 0.18

        const item = {}
        item.position = new THREE.Vector2(position.x, position.z)
        item.logoMesh = logoMesh
        item.logoBaseY = logoBaseY
        item.bobPhase = bobPhase
        item.interactCallback = interactCallback
        item.revealCallback = revealCallback
        item.concealCallback = concealCallback
        item.hideCallback = hideCallback
        item.isIn = false
        item.state = this.temporaryHidden ? InteractivePoints.STATE_HIDDEN : state
        item.recoveryState = state
        item.materials = materials
        this.items.push(item)

        /**
         * Cursor raycast sobre el logo 3D
         */
        const hitCenter = newPosition.clone()
        hitCenter.y += 0.10

        item.intersect = this.game.rayCursor.addIntersect({
            active: false,
            shape: new THREE.Sphere(hitCenter, 0.65),
            onClick: () =>
            {
                if(item.state !== InteractivePoints.STATE_HIDDEN)
                {
                    item.interact()
                }
            },
            onEnter: () =>
            {
                if(item.state !== InteractivePoints.STATE_HIDDEN)
                {
                    if(item !== this.activeItem && this.activeItem !== null)
                    {
                        this.activeItem.conceal()
                    }

                    this.activeItem = item
                    item.reveal()
                }
            },
            onLeave: () =>
            {
                if(
                    this.activeItem === item &&
                    item.state !== InteractivePoints.STATE_HIDDEN
                )
                {
                    item.conceal()
                    this.activeItem = null
                }
            }
        })

        /**
         * Methods
         */
        item.hide = () =>
        {
            if(item.state === InteractivePoints.STATE_HIDDEN)
                return

            item.state = InteractivePoints.STATE_HIDDEN
            item.intersect.active = false

            gsap.to(logoMesh.scale, {
                x: 0,
                y: 0,
                z: 0,
                ease: 'back.in(2.5)',
                duration: 0.45,
                overwrite: true,
                onComplete: () =>
                {
                    logoMesh.visible = false
                    label.visible = false
                }
            })

            gsap.to(labelOffset, { value: align === InteractivePoints.ALIGN_LEFT ? -1 : 1, ease: 'power2.in', duration: 0.45, overwrite: true })

            if(this.activeItem && this.activeItem === item)
                this.activeItem = null

            if(typeof item.hideCallback === 'function')
                item.hideCallback()
        }

        item.reveal = () =>
        {
            if(item.state === InteractivePoints.STATE_OPEN)
                return

            item.state = InteractivePoints.STATE_OPEN
            item.intersect.active = true

            logoMesh.visible = true
            logoMesh.material = this.logoMaterialActive
            label.visible = true

            gsap.to(logoMesh.scale, {
                x: SCALE_OPEN,
                y: SCALE_OPEN,
                z: SCALE_OPEN,
                ease: 'elastic.out(1.2, 0.45)',
                duration: 1.1,
                overwrite: true
            })

            gsap.to(labelOffset, { value: 0, ease: 'power2.out', duration: 0.55, delay: 0.1, overwrite: true })

            this.sounds.reveal.play()

            if(typeof item.revealCallback === 'function')
                item.revealCallback()
        }

        item.conceal = () =>
        {
            if(item.state === InteractivePoints.STATE_CONCEALED)
                return

            const previousState = item.state
            item.state = InteractivePoints.STATE_CONCEALED
            item.intersect.active = true

            logoMesh.visible = true
            logoMesh.material = this.logoMaterialIdle

            const ease = previousState === InteractivePoints.STATE_HIDDEN ? 'elastic.out(1.0, 0.5)' : 'power2.out'
            gsap.to(logoMesh.scale, {
                x: SCALE_CONCEALED,
                y: SCALE_CONCEALED,
                z: SCALE_CONCEALED,
                ease,
                duration: 0.65,
                overwrite: true
            })

            gsap.to(labelOffset, {
                value: align === InteractivePoints.ALIGN_LEFT ? -1 : 1,
                ease: 'power2.in',
                duration: 0.45,
                overwrite: true,
                onComplete: () =>
                {
                    label.visible = false
                }
            })

            this.sounds.conceal.play()

            if(typeof item.concealCallback === 'function')
                item.concealCallback()
        }

        item.interact = () =>
        {
            gsap.to(logoMesh.scale, {
                x: SCALE_OPEN * 1.28,
                y: SCALE_OPEN * 1.28,
                z: SCALE_OPEN * 1.28,
                ease: 'power2.out',
                duration: 0.12,
                overwrite: true,
                onComplete: () =>
                {
                    gsap.to(logoMesh.scale, {
                        x: SCALE_OPEN,
                        y: SCALE_OPEN,
                        z: SCALE_OPEN,
                        ease: 'elastic.out(1.2, 0.5)',
                        duration: 1.0,
                        overwrite: true
                    })
                }
            })

            if(typeof item.interactCallback === 'function')
                item.interactCallback()
        }

        item.show = () =>
        {
            if(item.isIn)
                item.reveal()
            else
                item.conceal()

            this.needsTest = true
        }

        /**
         * Default state
         */
        if(state === InteractivePoints.STATE_CONCEALED)
        {
            if(!this.revealed)
            {
                item.state = InteractivePoints.STATE_HIDDEN
                item.showAfterReveal = true
            }
            else
            {
                item.state = state
                item.intersect.active = true
                logoMesh.visible = true
                logoMesh.scale.setScalar(SCALE_CONCEALED)
            }
        }

        return item
    }

    update()
    {
        const dt = Math.min(this.game.ticker.deltaScaled || 1 / 60, 0.05)
        const elapsed = this.game.ticker.elapsed

        // Animación continua de giro y flotación suave para todos los logos 3D JM + Corona visibles
        for(const item of this.items)
        {
            if(item.logoMesh && item.logoMesh.visible)
            {
                const spinSpeed = item.state === InteractivePoints.STATE_OPEN ? 1.5 : 0.85
                item.logoMesh.rotation.y += dt * spinSpeed
                item.logoMesh.position.y = item.logoBaseY + Math.sin(elapsed * 2.2 + item.bobPhase) * 0.08
            }
        }

        // Player proximity testing
        const distanceTraveled = Math.hypot(
            this.playerPosition.value.x - this.game.player.position2.x,
            this.playerPosition.value.y - this.game.player.position2.y
        )

        if(distanceTraveled > 0.2 || this.needsTest)
        {
            this.needsTest = false
            this.playerPosition.value.copy(this.game.player.position2)

            let distance = Infinity
            let activeItem = null
            for(const item of this.items)
            {
                const itemDistance = Math.hypot(item.position.x - this.game.player.position2.x, item.position.y - this.game.player.position2.y)
                const isIn = itemDistance < 2.5

                if(isIn)
                {
                    if(itemDistance < distance && item.state !== InteractivePoints.STATE_HIDDEN)
                    {
                        distance = itemDistance
                        activeItem = item
                    }
                }
                else
                {
                    if(item.isIn)
                    {
                        item.isIn = false

                        if(item.state !== InteractivePoints.STATE_HIDDEN)
                        {
                            item.conceal()
                        }
                    }
                }
            }

            if(activeItem)
            {
                if(activeItem !== this.activeItem && this.activeItem !== null)
                {
                    this.activeItem.isIn = false
                    this.activeItem.conceal()
                }

                if(!activeItem.isIn || this.activeItem === null)
                {
                    this.activeItem = activeItem
                    activeItem.isIn = true
                    activeItem.reveal()
                }
            }
            else
            {
                this.activeItem = null
            }
        }
    }

    temporaryHide()
    {
        this.temporaryHidden = true

        for(const item of this.items)
        {
            item.recoveryState = item.state
            item.hide()
        }
    }

    recover()
    {
        this.temporaryHidden = false

        for(const item of this.items)
        {
            if(item.recoveryState !== InteractivePoints.STATE_HIDDEN)
                item.show()
        }
    }
}
