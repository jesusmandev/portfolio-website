import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Player } from '../Player.js'
import { InteractivePoints } from '../InteractivePoints.js'
import gsap from 'gsap'

export class PlayableRubikCube
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.cubePosition = new THREE.Vector3(
            options.x ?? 5.0,
            options.y ?? 0.05,
            options.z ?? 67.5
        )

        this.isPlaying = false
        this.cubies = []
        this.moveQueue = []
        this.isAnimating = false

        // Raycaster and mouse
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()
        this.isDragging = false
        this.activeCubie = null
        this.clickNormal = new THREE.Vector3()
        this.startMouseX = 0
        this.startMouseY = 0

        // Camera orbit settings
        this.camDistance = options.camDistance ?? 20.0
        this.camPhi = options.camPhi ?? (Math.PI * 0.32)
        this.camAngle = options.camAngle ?? (Math.PI * 0.25)
        this.targetCamLookAt = new THREE.Vector3(this.cubePosition.x, this.cubePosition.y + 4.3, this.cubePosition.z)
        this.targetCamPos = new THREE.Vector3()
        this.updateCameraTarget()

        // Root group
        this.cubeGroup = new THREE.Group()
        this.cubeGroup.position.copy(this.cubePosition)
        this.game.scene.add(this.cubeGroup)

        this.rotationGroup = this.generateRotationGroup()

        this.buildMonument()
        this.buildCollider()
        this.buildInteractivePoint()
        this.buildHUD()
        this.bindEvents()
    }

    updateCameraTarget()
    {
        const offset = new THREE.Vector3().setFromSphericalCoords(this.camDistance, this.camPhi, this.camAngle)
        this.targetCamPos.copy(this.targetCamLookAt).add(offset)
    }

    generateRotationGroup()
    {
        const half = Math.PI / 2
        const gens = [
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), half),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), half),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), half)
        ]
        const group = [new THREE.Quaternion()]
        let frontier = [group[0]]
        while(frontier.length > 0)
        {
            const next = []
            for(const q of frontier)
            {
                for(const g of gens)
                {
                    const nq = q.clone().multiply(g)
                    if(!this.quatInGroup(group, nq))
                    {
                        group.push(nq)
                        next.push(nq)
                    }
                }
            }
            frontier = next
        }
        return group
    }

    quatInGroup(list, q)
    {
        for(const item of list)
        {
            if(Math.abs(item.dot(q)) > 0.9999) return true
        }
        return false
    }

    snapQuaternion(q)
    {
        let best = this.rotationGroup[0]
        let bestDot = -Infinity
        for(const item of this.rotationGroup)
        {
            const d = Math.abs(item.dot(q))
            if(d > bestDot)
            {
                bestDot = d
                best = item
            }
        }
        return best.clone()
    }

    buildMonument()
    {
        // 1. Dark Circular Floor Pad
        const padGeo = new THREE.CircleGeometry(5.2, 48)
        const padMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.85,
            metalness: 0.1
        })
        const padMesh = new THREE.Mesh(padGeo, padMat)
        padMesh.rotation.x = -Math.PI / 2
        padMesh.position.y = 0.02
        padMesh.receiveShadow = true
        this.cubeGroup.add(padMesh)

        // 2. High-Tech Metallic Pedestal Base
        const baseGeo = new THREE.CylinderGeometry(3.8, 4.4, 0.75, 48)
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.25,
            metalness: 0.85
        })
        const baseMesh = new THREE.Mesh(baseGeo, metalMat)
        baseMesh.position.y = 0.38
        baseMesh.receiveShadow = true
        baseMesh.castShadow = true
        this.cubeGroup.add(baseMesh)

        // 3. Glowing Cyan Neon Ring around Pedestal
        const ringGeo = new THREE.TorusGeometry(3.9, 0.12, 16, 64)
        const cyanGlowMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00b4ff,
            emissiveIntensity: 1.5,
            roughness: 0.15
        })
        const ringMesh = new THREE.Mesh(ringGeo, cyanGlowMat)
        ringMesh.rotation.x = Math.PI / 2
        ringMesh.position.y = 0.76
        this.cubeGroup.add(ringMesh)

        // 4. Secondary glowing neon ring on the base edge
        const bottomRingGeo = new THREE.TorusGeometry(4.45, 0.06, 16, 64)
        const bottomRingMesh = new THREE.Mesh(bottomRingGeo, cyanGlowMat)
        bottomRingMesh.rotation.x = Math.PI / 2
        bottomRingMesh.position.y = 0.05
        this.cubeGroup.add(bottomRingMesh)

        // 5. Main Rubik Cube Group
        this.rubikGroup = new THREE.Group()
        this.rubikGroup.position.set(0, 4.3, 0)
        this.rubikGroup.scale.setScalar(1.35) // Monumental ~4.1m tall cube
        this.cubeGroup.add(this.rubikGroup)

        // Layer rotation pivot
        this.pivot = new THREE.Group()
        this.rubikGroup.add(this.pivot)

        // Shared Materials (Optimized: 7 materials total instead of 162 instances)
        const blackMaterial = new THREE.MeshStandardMaterial({
            color: 0x141419,
            roughness: 0.45,
            metalness: 0.4
        })

        const faceMaterials = {
            right:  new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0x440000, emissiveIntensity: 0.25, roughness: 0.3 }),
            left:   new THREE.MeshStandardMaterial({ color: 0xff7700, emissive: 0x441800, emissiveIntensity: 0.25, roughness: 0.3 }),
            top:    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, emissive: 0x222222, emissiveIntensity: 0.20, roughness: 0.3 }),
            bottom: new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0x332800, emissiveIntensity: 0.25, roughness: 0.3 }),
            front:  new THREE.MeshStandardMaterial({ color: 0x00e640, emissive: 0x004411, emissiveIntensity: 0.25, roughness: 0.3 }),
            back:   new THREE.MeshStandardMaterial({ color: 0x0077ff, emissive: 0x001855, emissiveIntensity: 0.25, roughness: 0.3 })
        }

        const cubeSize = 0.94
        const spacing = 1.0
        const offset = (3 - 1) * spacing / 2

        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
        const edgesGeometry = new THREE.EdgesGeometry(geometry)
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x0a0a0f })

        this.cubies = []
        for(let x = 0; x < 3; x++)
        {
            for(let y = 0; y < 3; y++)
            {
                for(let z = 0; z < 3; z++)
                {
                    const materials = [
                        x === 2 ? faceMaterials.right  : blackMaterial,
                        x === 0 ? faceMaterials.left   : blackMaterial,
                        y === 2 ? faceMaterials.top    : blackMaterial,
                        y === 0 ? faceMaterials.bottom : blackMaterial,
                        z === 2 ? faceMaterials.front  : blackMaterial,
                        z === 0 ? faceMaterials.back   : blackMaterial
                    ]

                    const cubie = new THREE.Mesh(geometry, materials)
                    cubie.castShadow = true
                    cubie.receiveShadow = false // Optimization: avoid shadow map self-sampling overhead

                    cubie.position.x = (x * spacing) - offset
                    cubie.position.y = (y * spacing) - offset
                    cubie.position.z = (z * spacing) - offset

                    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial)
                    cubie.add(edges)

                    this.rubikGroup.add(cubie)
                    this.cubies.push(cubie)
                }
            }
        }
    }

    buildCollider()
    {
        if(!this.game.physics) return

        try
        {
            this.physical = this.game.physics.getPhysical({
                type: 'fixed',
                position: this.cubePosition,
                colliders: [
                    // Pedestal cylinder base
                    {
                        shape: 'cylinder',
                        parameters: [ 0.45, 4.6 ], // halfHeight: 0.45, radius: 4.6
                        position: new THREE.Vector3(0, 0.45, 0),
                        category: 'object',
                        friction: 0.6,
                        restitution: 0.1
                    },
                    // Rubik Cube upper body (prevents walking/flying through the cube)
                    {
                        shape: 'cuboid',
                        parameters: [ 2.2, 2.2, 2.2 ], // halfExtents (4.4m x 4.4m x 4.4m)
                        position: new THREE.Vector3(0, 4.3, 0),
                        category: 'object',
                        friction: 0.6,
                        restitution: 0.1
                    }
                ]
            })
        }
        catch(err)
        {
            console.error('[PlayableRubikCube] Physics collider error:', err)
        }
    }

    buildInteractivePoint()
    {
        // Interactive point on the pedestrian approach toward the monument
        this.interactivePoint = this.game.interactivePoints.create(
            new THREE.Vector3(this.cubePosition.x, 1.2, this.cubePosition.z - 5.5),
            'Jugar Cubo Rubik',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.startPlay()
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

    buildHUD()
    {
        this.hud = document.createElement('div')
        this.hud.id = 'rubik-cube-hud'
        this.hud.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
            display: none;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: opacity 0.3s ease;
            opacity: 0;
        `

        this.hud.innerHTML = `
            <!-- Header bar -->
            <div style="position: absolute; top: 1.5rem; left: 50%; transform: translateX(-50%); pointer-events: auto; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 1.25rem; padding: 0.75rem 1.75rem; color: #fff; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center; display: flex; align-items: center; gap: 1rem;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 10px #00f0ff; animation: pulse 2s infinite;"></div>
                <div>
                    <h2 style="margin: 0; font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em;">Cubo de Rubik 3D</h2>
                    <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: #94a3b8;">Arrastra caras con el ratón • Rueda para zoom • Teclas R, L, U, D, F, B • ESC para salir</p>
                </div>
            </div>

            <!-- Controls panel bottom -->
            <div style="position: absolute; bottom: 1.75rem; left: 50%; transform: translateX(-50%); pointer-events: auto; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 1.25rem; padding: 0.85rem 1.25rem; color: #fff; box-shadow: 0 25px 50px rgba(0,0,0,0.5); display: flex; flex-wrap: wrap; items-center; justify-content: center; gap: 0.6rem;">
                <button id="btn-rubik-shuffle" style="cursor: pointer; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 0.6rem 1.1rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; transition: transform 0.15s, background 0.15s;">
                    🔀 Mezclar
                </button>
                <button id="btn-rubik-reset" style="cursor: pointer; background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 0.6rem 1.1rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; transition: background 0.15s;">
                    ↺ Reiniciar
                </button>
                <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.15); margin: 0 0.2rem;"></div>
                <button id="btn-rubik-zoom-in" style="cursor: pointer; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.12); padding: 0.6rem 0.9rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 600;" title="Acercar cámara">
                    🔍 +
                </button>
                <button id="btn-rubik-zoom-out" style="cursor: pointer; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.12); padding: 0.6rem 0.9rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 600;" title="Alejar cámara">
                    🔍 −
                </button>
                <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.15); margin: 0 0.2rem;"></div>
                <button id="btn-rubik-orbit-left" style="cursor: pointer; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.12); padding: 0.6rem 0.9rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 600;" title="Girar vista a la izquierda">
                    ◀ Girar Vista
                </button>
                <button id="btn-rubik-orbit-right" style="cursor: pointer; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.12); padding: 0.6rem 0.9rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 600;" title="Girar vista a la derecha">
                    Girar Vista ▶
                </button>
                <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.15); margin: 0 0.2rem;"></div>
                <button id="btn-rubik-exit" style="cursor: pointer; background: #dc2626; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 0.6rem 1.2rem; border-radius: 0.75rem; font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 0.35rem; transition: background 0.15s;">
                    ✕ Salir (ESC)
                </button>
            </div>
        `

        document.body.appendChild(this.hud)

        // Bind button actions
        this.hud.querySelector('#btn-rubik-shuffle').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.shuffleCube()
        })
        this.hud.querySelector('#btn-rubik-reset').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.resetCube()
        })
        this.hud.querySelector('#btn-rubik-zoom-in').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.adjustZoom(-2)
        })
        this.hud.querySelector('#btn-rubik-zoom-out').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.adjustZoom(2)
        })
        this.hud.querySelector('#btn-rubik-orbit-left').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.rotateView(-1)
        })
        this.hud.querySelector('#btn-rubik-orbit-right').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.rotateView(1)
        })
        this.hud.querySelector('#btn-rubik-exit').addEventListener('click', (e) =>
        {
            e.stopPropagation()
            this.endPlay()
        })
    }

    bindEvents()
    {
        this._onKeyDown = (e) =>
        {
            if(!this.isPlaying) return

            if(e.key === 'Escape')
            {
                e.preventDefault()
                this.endPlay()
                return
            }

            if(e.key === 'ArrowLeft')
            {
                e.preventDefault()
                this.rotateView(-1)
                return
            }

            if(e.key === 'ArrowRight')
            {
                e.preventDefault()
                this.rotateView(1)
                return
            }

            if(e.ctrlKey || e.altKey || e.metaKey) return

            const key = e.key.toLowerCase()
            const validKeys = ['u', 'd', 'r', 'l', 'f', 'b', 'm', 'e', 's']

            if(validKeys.includes(key))
            {
                e.preventDefault()
                const isPrime = (e.key === e.key.toUpperCase() && e.key !== e.key.toLowerCase()) || e.shiftKey

                let axis, layerIndex, direction
                const dirVal = isPrime ? 1 : -1

                switch(key)
                {
                    case 'r': axis = 'x'; layerIndex = 1;  direction = dirVal;  break
                    case 'l': axis = 'x'; layerIndex = -1; direction = -dirVal; break
                    case 'u': axis = 'y'; layerIndex = 1;  direction = dirVal;  break
                    case 'd': axis = 'y'; layerIndex = -1; direction = -dirVal; break
                    case 'f': axis = 'z'; layerIndex = 1;  direction = dirVal;  break
                    case 'b': axis = 'z'; layerIndex = -1; direction = -dirVal; break
                    case 'm': axis = 'x'; layerIndex = 0;  direction = -dirVal; break
                    case 'e': axis = 'y'; layerIndex = 0;  direction = -dirVal; break
                    case 's': axis = 'z'; layerIndex = 0;  direction = dirVal;  break
                }

                this.queueMove(axis, layerIndex, direction, 10)
            }
        }

        this._onPointerDown = (e) =>
        {
            if(!this.isPlaying || this.isAnimating || this.moveQueue.length > 0) return

            const rect = this.game.domElement.getBoundingClientRect()
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

            this.raycaster.setFromCamera(this.mouse, this.game.camera)
            const intersects = this.raycaster.intersectObjects(this.cubies)

            if(intersects.length > 0)
            {
                this.isDragging = true
                this.activeCubie = intersects[0].object

                const n = intersects[0].face.normal.clone()
                const rotMatrix = new THREE.Matrix4().extractRotation(this.activeCubie.matrixWorld)
                n.applyMatrix4(rotMatrix).round()
                this.clickNormal.copy(n)

                this.startMouseX = e.clientX
                this.startMouseY = e.clientY
            }
        }

        this._onPointerMove = (e) =>
        {
            if(!this.isDragging || !this.activeCubie || this.isAnimating) return

            const dx = e.clientX - this.startMouseX
            const dy = e.clientY - this.startMouseY

            if(Math.abs(dx) > 16 || Math.abs(dy) > 16)
            {
                this.isDragging = false
                this.determineAndExecuteMove(dx, dy)
            }
        }

        this._onPointerUp = () =>
        {
            this.isDragging = false
            this.activeCubie = null
        }

        this._onWheel = (e) =>
        {
            if(!this.isPlaying) return
            e.preventDefault()
            const delta = Math.sign(e.deltaY) * 1.5
            this.adjustZoom(delta)
        }

        this._onShuffle = () => this.shuffleCube()
        this._onEnterPlay = () => this.startPlay()
        this._onExitPlay = () => this.endPlay()

        window.addEventListener('keydown', this._onKeyDown)
        window.addEventListener('pointerdown', this._onPointerDown)
        window.addEventListener('pointermove', this._onPointerMove)
        window.addEventListener('pointerup', this._onPointerUp)
        window.addEventListener('wheel', this._onWheel, { passive: false })
        window.addEventListener('rubik:shuffle', this._onShuffle)
        window.addEventListener('rubik:enter-play', this._onEnterPlay)
        window.addEventListener('rubik:exit', this._onExitPlay)
    }

    adjustZoom(delta)
    {
        if(!this.isPlaying) return
        this.camDistance = THREE.MathUtils.clamp(this.camDistance + delta, 14, 30)
        this.updateCameraTarget()
        if(this.game.view?.cinematic)
        {
            this.game.view.cinematic.start(this.targetCamPos, this.targetCamLookAt)
        }
    }

    rotateView(direction = 1)
    {
        if(!this.isPlaying) return

        this.camAngle += direction * (Math.PI * 0.5)
        this.updateCameraTarget()

        if(this.game.view?.cinematic)
        {
            this.game.view.cinematic.start(this.targetCamPos, this.targetCamLookAt)
        }
    }

    determineAndExecuteMove(dx, dy)
    {
        let axisToRotate
        let direction = 1

        if(Math.abs(this.clickNormal.x) > 0.5)
        {
            axisToRotate = Math.abs(dx) > Math.abs(dy) ? 'z' : 'y'
            direction = Math.sign(this.clickNormal.x) * (axisToRotate === 'z' ? Math.sign(-dx) : Math.sign(-dy))
        }
        else if(Math.abs(this.clickNormal.y) > 0.5)
        {
            axisToRotate = Math.abs(dx) > Math.abs(dy) ? 'z' : 'x'
            direction = Math.sign(this.clickNormal.y) * (axisToRotate === 'z' ? Math.sign(dx) : Math.sign(-dy))
        }
        else
        {
            axisToRotate = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
            direction = Math.sign(this.clickNormal.z) * (axisToRotate === 'x' ? Math.sign(dx) : Math.sign(-dy))
        }

        const layerIndex = Math.round(this.activeCubie.position[axisToRotate])
        this.queueMove(axisToRotate, layerIndex, direction, 12)
    }

    queueMove(axis, layerIndex, direction, speedFrames)
    {
        this.moveQueue.push({ axis, layerIndex, direction, speedFrames })
        this.processQueue()
    }

    processQueue()
    {
        if(this.isAnimating || this.moveQueue.length === 0) return
        const move = this.moveQueue.shift()
        this.executeMove(move.axis, move.layerIndex, move.direction, move.speedFrames)
    }

    executeMove(axis, layerIndex, direction, speedFrames)
    {
        this.isAnimating = true

        const layerCubies = this.cubies.filter(c => Math.abs(Math.round(c.position[axis]) - layerIndex) < 0.1)
        layerCubies.forEach(c => this.pivot.attach(c))

        const targetAngle = direction * Math.PI / 2
        let currentAngle = 0
        const step = targetAngle / speedFrames

        const animateSlice = () =>
        {
            if(Math.abs(currentAngle) < Math.abs(targetAngle))
            {
                this.pivot.rotation[axis] += step
                currentAngle += step
                requestAnimationFrame(animateSlice)
            }
            else
            {
                this.pivot.rotation[axis] = targetAngle
                this.pivot.updateMatrixWorld()

                layerCubies.forEach(c =>
                {
                    this.rubikGroup.attach(c)
                    c.position.x = Math.round(c.position.x)
                    c.position.y = Math.round(c.position.y)
                    c.position.z = Math.round(c.position.z)
                    c.quaternion.copy(this.snapQuaternion(c.quaternion))
                })

                this.pivot.rotation.set(0, 0, 0)
                this.isAnimating = false
                this.processQueue()
            }
        }
        animateSlice()
    }

    shuffleCube()
    {
        if(this.isAnimating && this.moveQueue.length > 0) return

        const axes = ['x', 'y', 'z']
        const indices = [-1, 1]
        const dirs = [-1, 1]

        for(let i = 0; i < 35; i++)
        {
            const axis = axes[Math.floor(Math.random() * axes.length)]
            const index = indices[Math.floor(Math.random() * indices.length)]
            const dir = dirs[Math.floor(Math.random() * dirs.length)]
            this.queueMove(axis, index, dir, 2)
        }
    }

    resetCube()
    {
        if(this.isAnimating) return
        this.moveQueue = []

        let i = 0
        const spacing = 1.0
        const offset = (3 - 1) * spacing / 2
        for(let x = 0; x < 3; x++)
        {
            for(let y = 0; y < 3; y++)
            {
                for(let z = 0; z < 3; z++)
                {
                    const cubie = this.cubies[i++]
                    cubie.position.set((x * spacing) - offset, (y * spacing) - offset, (z * spacing) - offset)
                    cubie.quaternion.set(0, 0, 0, 1)
                }
            }
        }
    }

    startPlay()
    {
        if(this.isPlaying) return
        this.isPlaying = true

        // Lock player vehicle/character
        if(this.game.player)
        {
            this.game.player.state = Player.STATE_LOCKED
        }

        // Reset any idle rotation smoothly to 0 so coordinates align
        gsap.to(this.rubikGroup.rotation, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.6,
            ease: 'power2.out'
        })

        // Cinematic Camera zoom animation to the Rubik's Cube
        this.camAngle = Math.PI * 0.25
        this.updateCameraTarget()
        if(this.game.view?.cinematic)
        {
            this.game.view.cinematic.start(this.targetCamPos, this.targetCamLookAt)
        }

        // Show HUD with smooth fade
        this.hud.style.display = 'block'
        requestAnimationFrame(() =>
        {
            this.hud.style.opacity = '1'
        })

        window.dispatchEvent(new CustomEvent('rubik:play-start'))
        window.dispatchEvent(new CustomEvent('rubik:enter-play'))
    }

    endPlay()
    {
        if(!this.isPlaying) return
        this.isPlaying = false

        // Smoothly end cinematic camera and return to player view
        if(this.game.view?.cinematic)
        {
            this.game.view.cinematic.end()
        }

        // Unlock player vehicle/character
        if(this.game.player)
        {
            this.game.player.state = Player.STATE_DEFAULT
        }

        // Hide HUD with smooth fade
        this.hud.style.opacity = '0'
        setTimeout(() =>
        {
            if(!this.isPlaying)
                this.hud.style.display = 'none'
        }, 300)

        window.dispatchEvent(new CustomEvent('rubik:play-end'))
        window.dispatchEvent(new CustomEvent('rubik:exit'))
    }

    update()
    {
        // Slow idle rotation when NOT playing
        if(!this.isPlaying && this.rubikGroup)
        {
            const delta = this.game.ticker?.deltaScaled ?? 0.016
            this.rubikGroup.rotation.y += 0.3 * delta
            this.rubikGroup.rotation.x += 0.1 * delta
        }
    }

    destroy()
    {
        window.removeEventListener('keydown', this._onKeyDown)
        window.removeEventListener('pointerdown', this._onPointerDown)
        window.removeEventListener('pointermove', this._onPointerMove)
        window.removeEventListener('pointerup', this._onPointerUp)
        window.removeEventListener('wheel', this._onWheel)
        window.removeEventListener('rubik:shuffle', this._onShuffle)
        window.removeEventListener('rubik:enter-play', this._onEnterPlay)
        window.removeEventListener('rubik:exit', this._onExitPlay)

        if(this.hud && this.hud.parentElement)
        {
            this.hud.parentElement.removeChild(this.hud)
        }

        if(this.physical?.body && this.game.physics?.world)
        {
            this.game.physics.world.removeRigidBody(this.physical.body)
        }

        this.cubeGroup.removeFromParent()
    }
}
