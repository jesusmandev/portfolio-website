import * as THREE from 'three/webgpu'
import { color, texture } from 'three/tsl'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import gsap from 'gsap'
import { Game } from '../Game.js'
import { InstancedGroup } from '../InstancedGroup.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

const CRATE_SIZE = 1.06
const SCALE_RATIO = CRATE_SIZE / 2.3
const MAX_CONCURRENT_EXPLOSIONS = 6

export class ExplosiveCrates
{
    constructor()
    {
        this.game = Game.getInstance()

        // Extract ONLY positions/rotations/scales from explosiveCratesModel (discard old orange crate mesh completely)
        this.references = InstancedGroup.getReferencesFromChildren(this.game.resources.explosiveCratesModel.scene.children)

        // Procedural wood & metal materials compatible with Folio WebGPU pipeline
        this._initSharedMaterials()

        // Build new procedural 3D wooden crate base (4 merged meshes = 4 draw calls for all crates)
        const woodenCrateBase = this._buildWoodenCrateBase()

        // Create instanced group using ONLY the new wooden crate base
        this.instancedGroup = new InstancedGroup(this.references, woodenCrateBase)

        // Reusable objects (zero GC allocations per frame)
        this._dummy = new THREE.Object3D()
        this._tempDir = new THREE.Vector3()
        this._tempOffset = new THREE.Vector3()
        this._tempPos = new THREE.Vector3()
        this._tempOrigin = new THREE.Vector3()
        this._raycaster = new THREE.Raycaster()
        this._pointerNdc = new THREE.Vector2()
        this._crateSphere = new THREE.Sphere(new THREE.Vector3(), CRATE_SIZE * 0.68)
        this._hitPoint = new THREE.Vector3()

        // Pre-allocated explosion pools (planks, splinters, brackets, nails, sparks, dust/smoke, shockwaves)
        this._initExplosionPools()

        // Physics objects
        this.items = []

        let i = 0
        for(const reference of this.references)
        {
            const crate = {}
            crate.id = i
            crate.exploded = false
            crate.reference = reference.clone()
            crate.object = this.game.objects.add(
                {
                    model: reference,
                    updateMaterials: false,
                    parent: null,
                },
                {
                    type: 'dynamic',
                    position: reference.position.clone(),
                    rotation: reference.quaternion.clone(),
                    friction: 0.7,
                    mass: 0.02,
                    sleeping: true,
                    colliders: [ { shape: 'cuboid', parameters: [ 0.5, 0.5, 0.5 ], category: 'object' } ],
                    waterGravityMultiplier: - 1,
                    contactThreshold: 0,
                    onCollision: () =>
                    {
                        this.explode(crate)
                    }
                },
            )

            this.items.push(crate)
            i++
        }

        this.setSounds()
        this._setupPointerInteraction()

        // Tick update: physics sync + debris/sparks/smoke/shockwave simulation
        this.game.ticker.events.on('tick', () =>
        {
            for(const crate of this.items)
            {
                if(!crate.object.physical.body.isSleeping() && crate.object.physical.body.isEnabled())
                    crate.object.visual.object3D.needsUpdate = true
            }

            this._updateExplosionEffects()
        }, 10)
    }

    /**
     * Generates procedural wood grain, knots, plank seams and vignette texture on an offscreen canvas
     */
    _createProceduralWoodTexture(options)
    {
        const size = 512
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        const {
            baseHex = '#a66b38',
            darkHex = '#6e411d',
            lightHex = '#c5884e',
            plankCount = 4
        } = options

        // Base wood color
        ctx.fillStyle = baseHex
        ctx.fillRect(0, 0, size, size)

        // Plank tonal variation
        const plankHeight = size / plankCount
        for(let p = 0; p < plankCount; p++)
        {
            const y0 = p * plankHeight
            const shadeAlpha = (Math.random() - 0.5) * 0.14
            ctx.fillStyle = shadeAlpha > 0
                ? `rgba(255, 220, 175, ${shadeAlpha})`
                : `rgba(35, 18, 5, ${Math.abs(shadeAlpha)})`
            ctx.fillRect(0, y0, size, plankHeight)
        }

        // Organic wood grain waves
        for(let i = 0; i < 240; i++)
        {
            const y = Math.random() * size
            const thickness = 0.8 + Math.random() * 2.8
            const waveAmp = 1.5 + Math.random() * 5.0
            const waveFreq = 0.008 + Math.random() * 0.015
            const phase = Math.random() * Math.PI * 2
            const isLight = Math.random() > 0.65

            ctx.beginPath()
            for(let x = 0; x <= size; x += 16)
            {
                const wy = y + Math.sin(x * waveFreq + phase) * waveAmp
                if(x === 0) ctx.moveTo(x, wy)
                else ctx.lineTo(x, wy)
            }
            ctx.strokeStyle = isLight ? lightHex : darkHex
            ctx.globalAlpha = 0.14 + Math.random() * 0.22
            ctx.lineWidth = thickness
            ctx.stroke()
        }
        ctx.globalAlpha = 1.0

        // Natural wood knots
        const knotCount = 3 + Math.floor(Math.random() * 4)
        for(let k = 0; k < knotCount; k++)
        {
            const kx = 40 + Math.random() * (size - 80)
            const ky = 40 + Math.random() * (size - 80)
            const rx = 14 + Math.random() * 18
            const ry = 6 + Math.random() * 8

            for(let ring = 4; ring >= 1; ring--)
            {
                ctx.beginPath()
                ctx.ellipse(kx, ky, rx * (ring / 4), ry * (ring / 4), 0, 0, Math.PI * 2)
                ctx.fillStyle = ring === 1 ? '#3b1f0b' : darkHex
                ctx.globalAlpha = ring === 1 ? 0.55 : 0.16
                ctx.fill()
            }
        }
        ctx.globalAlpha = 1.0

        // Plank separation seams
        if(plankCount > 1)
        {
            for(let p = 1; p < plankCount; p++)
            {
                const seamY = Math.floor(p * plankHeight)
                ctx.fillStyle = 'rgba(28, 14, 5, 0.72)'
                ctx.fillRect(0, seamY - 2, size, 4)
                ctx.fillStyle = 'rgba(255, 210, 150, 0.16)'
                ctx.fillRect(0, seamY + 2, size, 2)
            }
        }

        // Subtle aged border vignette
        const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.72)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(1, 'rgba(25, 12, 4, 0.26)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, size, size)

        const tex = new THREE.CanvasTexture(canvas)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        return tex
    }

    _initSharedMaterials()
    {
        const innerTex = this._createProceduralWoodTexture({
            baseHex: '#b87a42',
            darkHex: '#73441e',
            lightHex: '#d49a60',
            plankCount: 5
        })

        const frameTex = this._createProceduralWoodTexture({
            baseHex: '#945a2b',
            darkHex: '#593112',
            lightHex: '#b3753f',
            plankCount: 2
        })

        this.materials = {
            innerWood: new MeshDefaultMaterial({
                colorNode: texture(innerTex).rgb,
            }),
            frameWood: new MeshDefaultMaterial({
                colorNode: texture(frameTex).rgb,
            }),
            splinterWood: new MeshDefaultMaterial({
                colorNode: color('#c99258'),
            }),
            nailMetal: new MeshDefaultMaterial({
                colorNode: color('#9ca3af'),
            }),
            cornerBracket: new MeshDefaultMaterial({
                colorNode: color('#333945'),
            })
        }

        for(const mat of Object.values(this.materials))
        {
            mat.userData = { prevent: true }
        }
    }

    /**
     * Builds the detailed wooden crate (inner planks, 12 edge beams, 6 diagonal braces,
     * metal corner nails and 8 steel corner brackets) merged by material into 4 meshes.
     */
    _buildWoodenCrateBase()
    {
        const group = new THREE.Group()
        group.name = 'woodenCrateBase'

        const s = CRATE_SIZE
        const k = SCALE_RATIO
        const innerSize = s - 0.24 * k
        const frameThick = 0.22 * k
        const frameDepth = 0.14 * k
        const half = s / 2 - frameThick / 2

        const matrix = new THREE.Matrix4()
        const euler = new THREE.Euler()
        const quat = new THREE.Quaternion()
        const pos = new THREE.Vector3()
        const unitScale = new THREE.Vector3(1, 1, 1)

        const pushTransformed = (list, baseGeo, x, y, z, rx = 0, ry = 0, rz = 0) =>
        {
            const g = baseGeo.clone()
            pos.set(x, y, z)
            euler.set(rx, ry, rz)
            quat.setFromEuler(euler)
            matrix.compose(pos, quat, unitScale)
            g.applyMatrix4(matrix)
            list.push(g)
        }

        // 1. Inner plank core
        const coreGeo = new THREE.BoxGeometry(innerSize, innerSize, innerSize)
        const coreMesh = new THREE.Mesh(coreGeo, this.materials.innerWood)
        coreMesh.name = 'crateInnerCore'
        coreMesh.castShadow = true
        coreMesh.receiveShadow = true
        coreMesh.frustumCulled = false
        group.add(coreMesh)

        // 2. Frame beams (12 edges) + diagonal braces (6 faces)
        const frameGeos = []
        const colGeo = new THREE.BoxGeometry(frameThick, s, frameThick)
        const beamXGeo = new THREE.BoxGeometry(s - frameThick * 2, frameThick, frameThick)
        const beamZGeo = new THREE.BoxGeometry(frameThick, frameThick, s - frameThick * 2)

        const diagLen = Math.sqrt(2) * (s - frameThick * 1.9)
        const diagWidth = 0.21 * k
        const diagOffset = innerSize / 2 + 0.04 * k
        const diagFBGeo = new THREE.BoxGeometry(diagLen, diagWidth, frameDepth * 0.75)
        const diagLRGeo = new THREE.BoxGeometry(frameDepth * 0.75, diagWidth, diagLen)
        const diagTBGeo = new THREE.BoxGeometry(diagLen, frameDepth * 0.75, diagWidth)

        // 4 vertical corner columns
        const corners = [
            [-half, -half], [half, -half],
            [-half, half], [half, half]
        ]
        for(const [cx, cz] of corners)
            pushTransformed(frameGeos, colGeo, cx, 0, cz)

        // 4 horizontal X beams
        for(const cy of [-half, half])
            for(const cz of [-half, half])
                pushTransformed(frameGeos, beamXGeo, 0, cy, cz)

        // 4 horizontal Z beams
        for(const cy of [-half, half])
            for(const cx of [-half, half])
                pushTransformed(frameGeos, beamZGeo, cx, cy, 0)

        // 6 diagonal braces
        pushTransformed(frameGeos, diagFBGeo, 0, 0, diagOffset, 0, 0, Math.PI / 4)
        pushTransformed(frameGeos, diagFBGeo, 0, 0, -diagOffset, 0, 0, -Math.PI / 4)
        pushTransformed(frameGeos, diagLRGeo, diagOffset, 0, 0, Math.PI / 4, 0, 0)
        pushTransformed(frameGeos, diagLRGeo, -diagOffset, 0, 0, -Math.PI / 4, 0, 0)
        pushTransformed(frameGeos, diagTBGeo, 0, diagOffset, 0, 0, Math.PI / 4, 0)
        pushTransformed(frameGeos, diagTBGeo, 0, -diagOffset, 0, 0, -Math.PI / 4, 0)

        const mergedFrameGeo = mergeGeometries(frameGeos, false)
        for(const g of frameGeos) g.dispose()
        colGeo.dispose()
        beamXGeo.dispose()
        beamZGeo.dispose()
        diagFBGeo.dispose()
        diagLRGeo.dispose()
        diagTBGeo.dispose()

        const frameMesh = new THREE.Mesh(mergedFrameGeo, this.materials.frameWood)
        frameMesh.name = 'crateFrame'
        frameMesh.castShadow = true
        frameMesh.receiveShadow = true
        frameMesh.frustumCulled = false
        group.add(frameMesh)

        // 3. Metal nails on all 6 faces
        const nailGeos = []
        const nailGeo = new THREE.CylinderGeometry(0.036 * k, 0.036 * k, 0.04 * k, 6)
        const nOff = s / 2 - 0.11 * k
        const faceOff = s / 2 + 0.005 * k
        const nailCoords = [-nOff, nOff]

        for(const a of nailCoords)
        {
            for(const b of nailCoords)
            {
                for(const z of [faceOff, -faceOff])
                    pushTransformed(nailGeos, nailGeo, a, b, z, Math.PI / 2, 0, 0)
                for(const x of [faceOff, -faceOff])
                    pushTransformed(nailGeos, nailGeo, x, b, a, 0, 0, Math.PI / 2)
                for(const y of [faceOff, -faceOff])
                    pushTransformed(nailGeos, nailGeo, a, y, b, 0, 0, 0)
            }
        }

        const mergedNailGeo = mergeGeometries(nailGeos, false)
        for(const g of nailGeos) g.dispose()
        nailGeo.dispose()

        const nailMesh = new THREE.Mesh(mergedNailGeo, this.materials.nailMetal)
        nailMesh.name = 'crateNails'
        nailMesh.castShadow = false
        nailMesh.receiveShadow = true
        nailMesh.frustumCulled = false
        group.add(nailMesh)

        // 4. 8 dark metallic corner brackets
        const bracketGeos = []
        const bracketSize = 0.25 * k
        const bGeo = new THREE.BoxGeometry(bracketSize, bracketSize, bracketSize)
        const bOff = s / 2 - bracketSize / 2 + 0.012 * k

        for(const x of [-bOff, bOff])
            for(const y of [-bOff, bOff])
                for(const z of [-bOff, bOff])
                    pushTransformed(bracketGeos, bGeo, x, y, z)

        const mergedBracketGeo = mergeGeometries(bracketGeos, false)
        for(const g of bracketGeos) g.dispose()
        bGeo.dispose()

        const bracketMesh = new THREE.Mesh(mergedBracketGeo, this.materials.cornerBracket)
        bracketMesh.name = 'crateBrackets'
        bracketMesh.castShadow = true
        bracketMesh.receiveShadow = true
        bracketMesh.frustumCulled = false
        group.add(bracketMesh)

        return group
    }

    /**
     * Pre-allocates InstancedMesh pools for flying wood planks, splinters, brackets, nails,
     * sparks, dust/smoke puffs and shockwave rings so explosions have 0 GC lag.
     */
    _initExplosionPools()
    {
        const k = SCALE_RATIO
        const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1)
        const bracketGeo = new THREE.BoxGeometry(0.18 * k, 0.18 * k, 0.18 * k)
        const nailGeo = new THREE.CylinderGeometry(0.025 * k, 0.025 * k, 0.18 * k, 6)

        const createPoolMesh = (geo, mat, count, castShadow, receiveShadow) =>
        {
            const im = new THREE.InstancedMesh(geo, mat, count)
            im.castShadow = castShadow
            im.receiveShadow = receiveShadow
            im.frustumCulled = false
            im.visible = false
            this._dummy.position.set(0, -100, 0)
            this._dummy.rotation.set(0, 0, 0)
            this._dummy.scale.set(0.0001, 0.0001, 0.0001)
            this._dummy.updateMatrix()
            for(let i = 0; i < count; i++)
                im.setMatrixAt(i, this._dummy.matrix)
            im.instanceMatrix.needsUpdate = true
            this.game.scene.add(im)
            return im
        }

        const counts = {
            framePlanks: 8 * MAX_CONCURRENT_EXPLOSIONS,
            innerPlanks: 8 * MAX_CONCURRENT_EXPLOSIONS,
            splinters: 24 * MAX_CONCURRENT_EXPLOSIONS,
            brackets: 6 * MAX_CONCURRENT_EXPLOSIONS,
            nails: 6 * MAX_CONCURRENT_EXPLOSIONS,
        }

        this.debrisGroups = {
            framePlanks: createPoolMesh(unitBoxGeo, this.materials.frameWood, counts.framePlanks, true, true),
            innerPlanks: createPoolMesh(unitBoxGeo, this.materials.innerWood, counts.innerPlanks, true, true),
            splinters: createPoolMesh(unitBoxGeo, this.materials.splinterWood, counts.splinters, true, false),
            brackets: createPoolMesh(bracketGeo, this.materials.cornerBracket, counts.brackets, false, false),
            nails: createPoolMesh(nailGeo, this.materials.nailMetal, counts.nails, false, false),
        }

        this.debrisCursors = {
            framePlanks: 0,
            innerPlanks: 0,
            splinters: 0,
            brackets: 0,
            nails: 0,
        }

        this.debrisItems = {
            framePlanks: [],
            innerPlanks: [],
            splinters: [],
            brackets: [],
            nails: [],
        }

        for(const [groupKey, count] of Object.entries(counts))
        {
            for(let i = 0; i < count; i++)
            {
                this.debrisItems[groupKey].push({
                    groupKey,
                    index: i,
                    active: false,
                    settled: true,
                    age: 0,
                    maxAge: 6.0,
                    floorY: 0,
                    position: new THREE.Vector3(),
                    rotation: new THREE.Euler(),
                    scale: new THREE.Vector3(1, 1, 1),
                    velocity: new THREE.Vector3(),
                    angularVel: new THREE.Vector3(),
                    halfHeight: 0.05,
                    restitution: 0.4,
                    friction: 0.72,
                })
            }
        }

        // Sparks pool (4 fire-colored InstancedMeshes, 30 instances each)
        const sparkGeo = new THREE.DodecahedronGeometry(1, 0)
        const fireColors = [ 0xfff3b0, 0xffb703, 0xfb8500, 0xff4d00 ]
        const sparksPerColor = 5 * MAX_CONCURRENT_EXPLOSIONS
        this.sparkGroups = fireColors.map((hex) =>
        {
            const mat = new THREE.MeshBasicNodeMaterial({ color: hex })
            return createPoolMesh(sparkGeo, mat, sparksPerColor, false, false)
        })
        this.sparkCursors = fireColors.map(() => 0)
        this.sparkItems = fireColors.map((_, cIdx) =>
        {
            const list = []
            for(let i = 0; i < sparksPerColor; i++)
            {
                list.push({
                    colorIdx: cIdx,
                    index: i,
                    active: false,
                    life: 0,
                    maxLife: 0.5,
                    floorY: 0,
                    baseRadius: 0.05,
                    position: new THREE.Vector3(),
                    velocity: new THREE.Vector3(),
                })
            }
            return list
        })

        // Dust & smoke pool (2 InstancedMeshes: wood dust & grey smoke)
        const smokeGeo = new THREE.DodecahedronGeometry(1, 1)
        const smokePerType = 6 * MAX_CONCURRENT_EXPLOSIONS
        const dustMat = new MeshDefaultMaterial({
            colorNode: color('#c29b70'),
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
        })
        const greySmokeMat = new MeshDefaultMaterial({
            colorNode: color('#52525b'),
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
        })
        this.smokeGroups = [
            createPoolMesh(smokeGeo, dustMat, smokePerType, false, false),
            createPoolMesh(smokeGeo, greySmokeMat, smokePerType, false, false),
        ]
        this.smokeCursors = [ 0, 0 ]
        this.smokeItems = [ 0, 1 ].map((typeIdx) =>
        {
            const list = []
            for(let i = 0; i < smokePerType; i++)
            {
                list.push({
                    typeIdx,
                    index: i,
                    active: false,
                    life: 0,
                    maxLife: 1.1,
                    baseRadius: 0.2,
                    scaleSpeed: 1.5,
                    rotY: 0,
                    position: new THREE.Vector3(),
                    velocity: new THREE.Vector3(),
                })
            }
            return list
        })

        // Shockwave rings pool
        const ringGeo = new THREE.RingGeometry(0.45 * k, 0.72 * k, 36)
        this.shockwaves = []
        for(let i = 0; i < MAX_CONCURRENT_EXPLOSIONS; i++)
        {
            const ringMat = new THREE.MeshBasicNodeMaterial({
                color: 0xffb74d,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
            })
            const mesh = new THREE.Mesh(ringGeo, ringMat)
            mesh.rotation.x = -Math.PI / 2
            mesh.visible = false
            mesh.frustumCulled = false
            this.game.scene.add(mesh)
            this.shockwaves.push({
                mesh,
                active: false,
                life: 0,
                maxLife: 0.48,
                maxScale: 7.0,
            })
        }
        this.shockwaveCursor = 0
        this.hasActiveEffects = false
    }

    /**
     * Spawns flying wooden planks, splinters, brackets, nails, sparks, dust/smoke and shockwave ring
     */
    _spawnWoodenExplosionBurst(centerPos, hitPoint = null)
    {
        const k = SCALE_RATIO
        const floorY = Math.max(0, centerPos.y - CRATE_SIZE * 0.5)

        if(hitPoint)
            this._tempOrigin.copy(hitPoint).lerp(centerPos, 0.65)
        else
            this._tempOrigin.copy(centerPos)

        const spawnDebris = (groupKey, count) =>
        {
            const pool = this.debrisItems[groupKey]
            const im = this.debrisGroups[groupKey]
            im.visible = true

            for(let n = 0; n < count; n++)
            {
                const idx = this.debrisCursors[groupKey]
                this.debrisCursors[groupKey] = (idx + 1) % pool.length
                const item = pool[idx]

                let spread = 0.9
                if(groupKey === 'framePlanks' || groupKey === 'innerPlanks')
                {
                    const length = (0.65 + Math.random() * 1.45) * k
                    const width = (0.16 + Math.random() * 0.24) * k
                    const thick = (0.08 + Math.random() * 0.11) * k
                    item.scale.set(length, thick, width)
                    item.halfHeight = thick * 0.6
                    item.restitution = 0.36 + Math.random() * 0.12
                    item.friction = 0.72
                    item.angularVel.set(
                        (Math.random() - 0.5) * 16,
                        (Math.random() - 0.5) * 16,
                        (Math.random() - 0.5) * 16
                    )
                }
                else if(groupKey === 'splinters')
                {
                    spread = 0.85
                    const length = (0.25 + Math.random() * 0.68) * k
                    const width = (0.04 + Math.random() * 0.08) * k
                    const thick = (0.03 + Math.random() * 0.05) * k
                    item.scale.set(length, thick, width)
                    item.halfHeight = thick * 0.7
                    item.restitution = 0.42
                    item.friction = 0.68
                    item.angularVel.set(
                        (Math.random() - 0.5) * 26,
                        (Math.random() - 0.5) * 26,
                        (Math.random() - 0.5) * 26
                    )
                }
                else
                {
                    const isBracket = groupKey === 'brackets'
                    item.scale.set(1, 1, 1)
                    item.halfHeight = (isBracket ? 0.09 : 0.04) * k
                    item.restitution = 0.52
                    item.friction = 0.76
                    item.angularVel.set(
                        (Math.random() - 0.5) * 24,
                        (Math.random() - 0.5) * 24,
                        (Math.random() - 0.5) * 24
                    )
                }

                this._tempOffset.set(
                    (Math.random() - 0.5) * CRATE_SIZE * spread,
                    (Math.random() - 0.5) * CRATE_SIZE * spread,
                    (Math.random() - 0.5) * CRATE_SIZE * spread
                )
                item.position.copy(centerPos).add(this._tempOffset)
                item.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                )

                this._tempDir.copy(item.position).sub(this._tempOrigin)
                if(this._tempDir.lengthSq() < 0.005)
                    this._tempDir.set(Math.random() - 0.5, 1, Math.random() - 0.5)
                this._tempDir.normalize()

                let speed, upBoost
                if(groupKey === 'splinters')
                {
                    speed = (7.0 + Math.random() * 9.5) * k * 1.4
                    upBoost = (4.2 + Math.random() * 5.8) * k * 1.4
                }
                else if(groupKey === 'brackets' || groupKey === 'nails')
                {
                    speed = (6.2 + Math.random() * 8.0) * k * 1.4
                    upBoost = (4.5 + Math.random() * 4.2) * k * 1.4
                }
                else
                {
                    speed = (5.0 + Math.random() * 6.8) * k * 1.4
                    upBoost = (3.8 + Math.random() * 4.8) * k * 1.4
                }

                item.velocity.copy(this._tempDir).multiplyScalar(speed)
                item.velocity.y += upBoost
                item.floorY = floorY
                item.age = 0
                item.maxAge = 5.5 + Math.random() * 2.0
                item.settled = false
                item.active = true

                this._dummy.position.copy(item.position)
                this._dummy.rotation.copy(item.rotation)
                this._dummy.scale.copy(item.scale)
                this._dummy.updateMatrix()
                im.setMatrixAt(item.index, this._dummy.matrix)
            }
            im.instanceMatrix.needsUpdate = true
        }

        spawnDebris('framePlanks', 8)
        spawnDebris('innerPlanks', 8)
        spawnDebris('splinters', 24)
        spawnDebris('brackets', 6)
        spawnDebris('nails', 6)

        // Sparks (5 per color = 20 glowing sparks)
        for(let cIdx = 0; cIdx < this.sparkGroups.length; cIdx++)
        {
            const im = this.sparkGroups[cIdx]
            const pool = this.sparkItems[cIdx]
            im.visible = true

            for(let n = 0; n < 5; n++)
            {
                const idx = this.sparkCursors[cIdx]
                this.sparkCursors[cIdx] = (idx + 1) % pool.length
                const p = pool[idx]

                p.active = true
                p.life = 0
                p.maxLife = 0.35 + Math.random() * 0.4
                p.floorY = floorY
                p.baseRadius = (0.06 + Math.random() * 0.14) * k
                p.position.set(
                    centerPos.x + (Math.random() - 0.5) * 0.5,
                    centerPos.y + (Math.random() - 0.5) * 0.5,
                    centerPos.z + (Math.random() - 0.5) * 0.5
                )

                this._tempDir.set(
                    Math.random() - 0.5,
                    Math.random() * 0.9 + 0.15,
                    Math.random() - 0.5
                ).normalize()
                p.velocity.copy(this._tempDir).multiplyScalar((5.5 + Math.random() * 10.5) * k * 1.4)

                this._dummy.position.copy(p.position)
                this._dummy.rotation.set(0, 0, 0)
                this._dummy.scale.setScalar(p.baseRadius)
                this._dummy.updateMatrix()
                im.setMatrixAt(p.index, this._dummy.matrix)
            }
            im.instanceMatrix.needsUpdate = true
        }

        // Dust & smoke puffs (6 dust + 6 grey smoke)
        for(let tIdx = 0; tIdx < 2; tIdx++)
        {
            const im = this.smokeGroups[tIdx]
            const pool = this.smokeItems[tIdx]
            im.visible = true

            for(let n = 0; n < 6; n++)
            {
                const idx = this.smokeCursors[tIdx]
                this.smokeCursors[tIdx] = (idx + 1) % pool.length
                const p = pool[idx]

                p.active = true
                p.life = 0
                p.maxLife = 0.85 + Math.random() * 0.75
                p.baseRadius = (0.24 + Math.random() * 0.34) * k
                p.scaleSpeed = 1.2 + Math.random() * 0.65
                p.rotY = Math.random() * Math.PI
                p.position.set(
                    centerPos.x + (Math.random() - 0.5) * 0.7,
                    centerPos.y + (Math.random() - 0.5) * 0.5,
                    centerPos.z + (Math.random() - 0.5) * 0.7
                )

                this._tempDir.set(
                    Math.random() - 0.5,
                    0.35 + Math.random() * 0.85,
                    Math.random() - 0.5
                ).normalize()
                p.velocity.copy(this._tempDir).multiplyScalar((2.0 + Math.random() * 3.8) * k * 1.4)

                this._dummy.position.copy(p.position)
                this._dummy.rotation.set(0, p.rotY, 0)
                this._dummy.scale.setScalar(p.baseRadius)
                this._dummy.updateMatrix()
                im.setMatrixAt(p.index, this._dummy.matrix)
            }
            im.instanceMatrix.needsUpdate = true
        }

        // Ground shockwave ring
        const sw = this.shockwaves[this.shockwaveCursor]
        this.shockwaveCursor = (this.shockwaveCursor + 1) % this.shockwaves.length
        sw.active = true
        sw.life = 0
        sw.maxLife = 0.48
        sw.maxScale = 6.5
        sw.mesh.position.set(centerPos.x, floorY + 0.04, centerPos.z)
        sw.mesh.scale.setScalar(1)
        sw.mesh.material.opacity = 0.85
        sw.mesh.visible = true

        this.hasActiveEffects = true
    }

    _updateExplosionEffects()
    {
        if(!this.hasActiveEffects)
            return

        const dt = Math.min(this.game.ticker.deltaScaled * 0.5, 0.05)
        if(dt <= 0)
            return

        let stillActive = false
        const gravity = -19.5
        const airDrag = Math.pow(0.96, dt * 10)

        // 1. Update solid wooden & metal debris
        for(const [groupKey, pool] of Object.entries(this.debrisItems))
        {
            const im = this.debrisGroups[groupKey]
            let dirty = false
            let groupHasActive = false

            for(let i = 0; i < pool.length; i++)
            {
                const item = pool[i]
                if(!item.active)
                    continue

                groupHasActive = true
                stillActive = true
                item.age += dt

                // Expire & hide piece cleanly after maxAge
                if(item.age >= item.maxAge)
                {
                    item.active = false
                    item.settled = true
                    this._dummy.position.set(0, -100, 0)
                    this._dummy.scale.set(0.0001, 0.0001, 0.0001)
                    this._dummy.updateMatrix()
                    im.setMatrixAt(item.index, this._dummy.matrix)
                    dirty = true
                    continue
                }

                // Fade out smoothly by shrinking during last 1.0 second
                const timeLeft = item.maxAge - item.age
                const shrink = timeLeft < 1.0 ? Math.max(0.001, timeLeft) : 1.0

                if(!item.settled)
                {
                    item.velocity.y += gravity * dt
                    item.velocity.multiplyScalar(airDrag)

                    item.position.addScaledVector(item.velocity, dt)
                    item.rotation.x += item.angularVel.x * dt
                    item.rotation.y += item.angularVel.y * dt
                    item.rotation.z += item.angularVel.z * dt

                    const minY = item.floorY + item.halfHeight
                    if(item.position.y <= minY)
                    {
                        item.position.y = minY
                        if(item.velocity.y < 0)
                            item.velocity.y = -item.velocity.y * item.restitution

                        item.velocity.x *= item.friction
                        item.velocity.z *= item.friction
                        item.angularVel.multiplyScalar(0.68)

                        if(
                            Math.abs(item.velocity.y) < 0.28 &&
                            (item.velocity.x * item.velocity.x + item.velocity.z * item.velocity.z) < 0.04
                        )
                        {
                            item.velocity.set(0, 0, 0)
                            item.angularVel.set(0, 0, 0)
                            item.rotation.x = Math.round(item.rotation.x / (Math.PI / 2)) * (Math.PI / 2)
                            item.rotation.z = Math.round(item.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
                            item.settled = true
                        }
                    }

                    this._dummy.position.copy(item.position)
                    this._dummy.rotation.copy(item.rotation)
                    this._dummy.scale.copy(item.scale).multiplyScalar(shrink)
                    this._dummy.updateMatrix()
                    im.setMatrixAt(item.index, this._dummy.matrix)
                    dirty = true
                }
                else if(shrink < 1.0)
                {
                    this._dummy.position.copy(item.position)
                    this._dummy.rotation.copy(item.rotation)
                    this._dummy.scale.copy(item.scale).multiplyScalar(shrink)
                    this._dummy.updateMatrix()
                    im.setMatrixAt(item.index, this._dummy.matrix)
                    dirty = true
                }
            }

            if(dirty)
                im.instanceMatrix.needsUpdate = true
            im.visible = groupHasActive
        }

        // 2. Update sparks
        for(let cIdx = 0; cIdx < this.sparkGroups.length; cIdx++)
        {
            const im = this.sparkGroups[cIdx]
            const pool = this.sparkItems[cIdx]
            let dirty = false
            let groupHasActive = false

            for(let i = 0; i < pool.length; i++)
            {
                const p = pool[i]
                if(!p.active)
                    continue

                p.life += dt
                if(p.life >= p.maxLife)
                {
                    p.active = false
                    this._dummy.position.set(0, -100, 0)
                    this._dummy.scale.set(0.0001, 0.0001, 0.0001)
                    this._dummy.updateMatrix()
                    im.setMatrixAt(p.index, this._dummy.matrix)
                    dirty = true
                    continue
                }

                groupHasActive = true
                stillActive = true

                const progress = p.life / p.maxLife
                p.velocity.y += -12.0 * dt
                p.position.addScaledVector(p.velocity, dt)

                if(p.position.y < p.floorY + 0.04)
                {
                    p.position.y = p.floorY + 0.04
                    p.velocity.y *= -0.45
                    p.velocity.x *= 0.7
                    p.velocity.z *= 0.7
                }

                const s = Math.max(0.001, 1 - progress) * p.baseRadius
                this._dummy.position.copy(p.position)
                this._dummy.rotation.set(0, 0, 0)
                this._dummy.scale.setScalar(s)
                this._dummy.updateMatrix()
                im.setMatrixAt(p.index, this._dummy.matrix)
                dirty = true
            }

            if(dirty)
                im.instanceMatrix.needsUpdate = true
            im.visible = groupHasActive
        }

        // 3. Update dust & smoke puffs
        const smokeDrag = Math.pow(0.25, dt)
        for(let tIdx = 0; tIdx < this.smokeGroups.length; tIdx++)
        {
            const im = this.smokeGroups[tIdx]
            const pool = this.smokeItems[tIdx]
            let dirty = false
            let groupHasActive = false

            for(let i = 0; i < pool.length; i++)
            {
                const p = pool[i]
                if(!p.active)
                    continue

                p.life += dt
                if(p.life >= p.maxLife)
                {
                    p.active = false
                    this._dummy.position.set(0, -100, 0)
                    this._dummy.scale.set(0.0001, 0.0001, 0.0001)
                    this._dummy.updateMatrix()
                    im.setMatrixAt(p.index, this._dummy.matrix)
                    dirty = true
                    continue
                }

                groupHasActive = true
                stillActive = true

                const progress = p.life / p.maxLife
                p.velocity.multiplyScalar(smokeDrag)
                p.velocity.y += 1.1 * dt
                p.position.addScaledVector(p.velocity, dt)
                p.rotY += 0.8 * dt

                // Expand first, then shrink smoothly to zero at end of life
                const fadeOut = progress > 0.45 ? Math.max(0.001, 1 - (progress - 0.45) / 0.55) : 1
                const s = (1 + progress * p.scaleSpeed) * p.baseRadius * fadeOut
                this._dummy.position.copy(p.position)
                this._dummy.rotation.set(0, p.rotY, 0)
                this._dummy.scale.setScalar(s)
                this._dummy.updateMatrix()
                im.setMatrixAt(p.index, this._dummy.matrix)
                dirty = true
            }

            if(dirty)
                im.instanceMatrix.needsUpdate = true
            im.visible = groupHasActive
        }

        // 4. Update shockwave rings
        for(let i = 0; i < this.shockwaves.length; i++)
        {
            const sw = this.shockwaves[i]
            if(!sw.active)
                continue

            sw.life += dt
            if(sw.life >= sw.maxLife)
            {
                sw.active = false
                sw.mesh.visible = false
                continue
            }

            stillActive = true
            const progress = sw.life / sw.maxLife
            const eased = 1 - Math.pow(1 - progress, 3)
            sw.mesh.scale.setScalar(1 + eased * sw.maxScale)
            sw.mesh.material.opacity = (1 - progress) * 0.8
        }

        this.hasActiveEffects = stillActive
    }

    _clearExplosionEffects()
    {
        this.hasActiveEffects = false
        this._dummy.position.set(0, -100, 0)
        this._dummy.scale.set(0.0001, 0.0001, 0.0001)
        this._dummy.updateMatrix()

        for(const [groupKey, pool] of Object.entries(this.debrisItems))
        {
            const im = this.debrisGroups[groupKey]
            for(let i = 0; i < pool.length; i++)
            {
                pool[i].active = false
                pool[i].settled = true
                im.setMatrixAt(i, this._dummy.matrix)
            }
            im.instanceMatrix.needsUpdate = true
            im.visible = false
        }

        for(let cIdx = 0; cIdx < this.sparkGroups.length; cIdx++)
        {
            const im = this.sparkGroups[cIdx]
            const pool = this.sparkItems[cIdx]
            for(let i = 0; i < pool.length; i++)
            {
                pool[i].active = false
                im.setMatrixAt(i, this._dummy.matrix)
            }
            im.instanceMatrix.needsUpdate = true
            im.visible = false
        }

        for(let tIdx = 0; tIdx < this.smokeGroups.length; tIdx++)
        {
            const im = this.smokeGroups[tIdx]
            const pool = this.smokeItems[tIdx]
            for(let i = 0; i < pool.length; i++)
            {
                pool[i].active = false
                im.setMatrixAt(i, this._dummy.matrix)
            }
            im.instanceMatrix.needsUpdate = true
            im.visible = false
        }

        for(const sw of this.shockwaves)
        {
            sw.active = false
            sw.mesh.visible = false
        }
    }

    /**
     * Allows clicking/tapping directly on any wooden crate in the world to detonate it
     */
    _setupPointerInteraction()
    {
        let startX = 0
        let startY = 0
        let downTime = 0

        window.addEventListener('pointerdown', (e) =>
        {
            if(e.button !== 0) return
            startX = e.clientX
            startY = e.clientY
            downTime = performance.now()
        })

        window.addEventListener('pointerup', (e) =>
        {
            if(e.button !== 0) return
            const canvas = this.game.rendering?.renderer?.domElement
            if(canvas && e.target !== canvas) return

            const dist = Math.hypot(e.clientX - startX, e.clientY - startY)
            if(dist > 8 || performance.now() - downTime > 450)
                return

            const camera = this.game.view?.camera
            if(!camera) return

            const rect = (canvas || document.body).getBoundingClientRect()
            this._pointerNdc.set(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            )
            this._raycaster.setFromCamera(this._pointerNdc, camera)

            let closestCrate = null
            let closestDistSq = Infinity
            let closestHit = null

            for(const crate of this.items)
            {
                if(crate.exploded) continue
                const t = crate.object.physical.body.translation()
                this._crateSphere.center.set(t.x, t.y, t.z)

                if(this._raycaster.ray.intersectSphere(this._crateSphere, this._hitPoint))
                {
                    const dSq = this._raycaster.ray.origin.distanceToSquared(this._hitPoint)
                    if(dSq < closestDistSq)
                    {
                        closestDistSq = dSq
                        closestCrate = crate
                        closestHit = this._hitPoint.clone()
                    }
                }
            }

            if(closestCrate)
                this.explode(closestCrate, closestHit, true)
        })
    }

    setSounds()
    {
        this.sounds = {}

        // Click sound
        this.sounds.triggerClick = this.game.audio.register({
            path: 'sounds/clicks/Source Metal Clicks Delicate Light Sharp Clip Mid 07.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.1,
            positions: new THREE.Vector3(),
            onPlay: (item, coordinates) =>
            {
                item.positions[0].copy(coordinates)
                item.volume = 1
                item.rate = 0.7 + Math.random() * 1.3
            }
        })

        const paths = [
            'sounds/explosions/SmallImpactMediumE PE281202.mp3',
            'sounds/explosions/SmallImpactMediumE PE281203.mp3'
        ]

        this.sounds.explosions = []

        for(const path of paths)
        {
            this.sounds.explosions.push(
                this.game.audio.register({
                    path: path,
                    autoplay: false,
                    loop: false,
                    volume: 0.4,
                    antiSpam: 0.2,
                    positions: new THREE.Vector3(),
                    distanceFade: 25,
                    onPlay: (item, coordinates) =>
                    {
                        item.positions[0].copy(coordinates)
                        item.volume = 1
                        item.rate = 0.9 + Math.random() * 0.3
                    }
                })
            )
        }
    }

    explode(crate, hitPoint = null, immediate = false)
    {
        if(crate.exploded)
            return

        crate.exploded = true

        const detonate = () =>
        {
            const bodyPos = crate.object.physical.body.translation()
            this._tempPos.set(bodyPos.x, bodyPos.y, bodyPos.z)

            // Sound
            this.sounds.explosions[Math.floor(Math.random() * this.sounds.explosions.length)].play(this._tempPos)

            // Flying wooden planks, splinters, brackets, nails, sparks, dust/smoke & shockwave ring
            this._spawnWoodenExplosionBurst(this._tempPos, hitPoint)

            // Game fireball + physics blast impulse & chain reaction
            this.game.world.fireballs.create(this._tempPos)

            // Disable & hide crate instance
            this.game.objects.disable(crate.object)
            crate.object.visual.object3D.position.y += 100
            crate.object.visual.object3D.needsUpdate = true

            // Achievements
            this.game.achievements.setProgress('explosiveCrates', crate.id)
        }

        if(immediate)
        {
            detonate()
        }
        else
        {
            this.sounds.triggerClick.play(crate.reference.position)
            gsap.delayedCall(0.4, detonate)
        }
    }

    reset()
    {
        this._clearExplosionEffects()

        for(const crate of this.items)
        {
            this.game.objects.resetObject(crate.object)
            crate.exploded = false

            this.game.ticker.wait(2, () =>
            {
                crate.object.physical.body.setEnabled(true)
            })
        }

        this.instancedGroup.needsUpdate = true

        // Disable every other object to prevent explosion trigger
        this.game.objects.list.forEach((object) =>
        {
            if(
                object.physical &&
                (object.physical.type === 'dynamic' || object.physical.type === 'kinematicPositionBased') &&
                object.physical.body.isEnabled()
            )
            {
                object.physical.body.setEnabled(false)

                // Wait a second and reactivate
                this.game.ticker.wait(1, () =>
                {
                    object.physical.body.setEnabled(true)

                    // Sleep
                    if(object.physical.initialState.sleeping)
                        object.physical.body.sleep()
                })
            }
        })
    }
}
