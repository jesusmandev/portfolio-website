import * as THREE from 'three/webgpu'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { Game } from '../Game.js'
import { Player } from '../Player.js'
import { ProceduralSound } from '../ProceduralSound.js'

/**
 * Cows.js
 *
 * 4 vacas 3D optimizadas (sin lag) con static/animals/vaca.glb:
 * - Materiales MeshLambertMaterial compartidos + sombra de contacto ligera (0 skinning en shadow pass)
 * - Culling por distancia y throttling de animaciones para mantener 60 FPS incluso en móvil
 * - 2 vacas pacíficas + 2 vacas bravas que recorren todo el mapa y pastan en el césped
 * - Cuando te acercas a una de las 2 vacas bravas, las 2 te persiguen 10s mientras tu personaje
 *   corre automáticamente gritando (mismo grito del tornado: male-scream.mp3).
 * - A los 10s te dejan de perseguir, el personaje cae al suelo (Death01 / tecla Y),
 *   aparece una nubecita de pensamiento sobre su cabeza ("Ufff... ¡de la que me salvé!
 *   Eso me pasa por andar de distraído 😅"), luego se levanta y las vacas ya no atacan más.
 */
export class Cows
{
    constructor(options = {})
    {
        this.game = Game.getInstance()
        this.proceduralSound = new ProceduralSound()

        this.count = options.count ?? 4
        this.mapBound = options.mapBound ?? 74
        this.cows = []
        this.clickMeshes = []
        this._sharedMaterials = new Map()
        this._destroyed = false

        // Estado de la secuencia de persecución (ocurre 1 sola vez; después no atacan más)
        this.chasePhase = 'idle' // 'idle' | 'chasing' | 'collapsed' | 'done'
        this.cowAttackDone = false
        this.chaseElapsed = 0
        this.chaseDuration = 10.0
        this.collapseElapsed = 0
        this.screamTimer = 0
        this._wanderingElapsed = 0
        this._spawnPlayerPos = null
        this._panicAngle = 0
        this._panicSteerTimer = 0
        this._thoughtEl = null
        this._thoughtShown = false

        this._raycaster = new THREE.Raycaster()
        this._mouse = new THREE.Vector2()
        this._tempPos = new THREE.Vector3()
        this._projPos = new THREE.Vector3()

        this._buildHeightLookup()
        this._defineExclusions()
        this._registerSounds()
        this._loadModel()

        this._onTick = this._onTick.bind(this)
        this._onPointerDown = this._onPointerDown.bind(this)

        this.game.ticker.events.on('tick', this._onTick, 1)
        window.addEventListener('pointerdown', this._onPointerDown)
    }

    _registerSounds()
    {
        this.sounds = {}

        // Mismo grito del tornado (AltarArea.js)
        this.sounds.maleScream = this.game.audio.register({
            path: 'sounds/fall/male-scream.mp3',
            autoplay: false,
            loop: false,
            volume: 0.9
        })

        // Mismo sonido de caída al suelo del tornado
        this.sounds.bodyFall = this.game.audio.register({
            path: 'sounds/fall/body-fall.mp3',
            autoplay: false,
            loop: false,
            volume: 0.95
        })
    }

    _buildHeightLookup()
    {
        const terrainGeom = this.game.resources?.terrainModel?.scene?.children?.[0]?.geometry
        if(!terrainGeom || !terrainGeom.attributes?.position)
        {
            this._heights = null
            return
        }

        const pos = terrainGeom.attributes.position
        const total = pos.count
        const rows = Math.round(Math.sqrt(total))
        const size = this.game.terrain?.size || 192
        const heights = new Float32Array(total)

        for(let i = 0; i < total; i++)
        {
            const x = pos.array[i * 3]
            const y = pos.array[i * 3 + 1]
            const z = pos.array[i * 3 + 2]
            const ix = Math.max(0, Math.min(rows - 1, Math.round(((x / size) + 0.5) * (rows - 1))))
            const iz = Math.max(0, Math.min(rows - 1, Math.round(((z / size) + 0.5) * (rows - 1))))
            heights[iz + ix * rows] = y
        }

        this._heights = heights
        this._heightRows = rows
        this._terrainSize = size
    }

    getGroundHeight(x, z)
    {
        if(!this._heights)
            return 0

        const u = (x / this._terrainSize) + 0.5
        const v = (z / this._terrainSize) + 0.5
        if(u <= 0 || u >= 1 || v <= 0 || v >= 1)
            return -2.0

        const fx = u * (this._heightRows - 1)
        const fz = v * (this._heightRows - 1)
        const ix0 = Math.floor(fx)
        const iz0 = Math.floor(fz)
        const ix1 = Math.min(this._heightRows - 1, ix0 + 1)
        const iz1 = Math.min(this._heightRows - 1, iz0 + 1)
        const tx = fx - ix0
        const tz = fz - iz0

        const h00 = this._heights[iz0 + ix0 * this._heightRows]
        const h10 = this._heights[iz0 + ix1 * this._heightRows]
        const h01 = this._heights[iz1 + ix0 * this._heightRows]
        const h11 = this._heights[iz1 + ix1 * this._heightRows]

        const hx0 = h00 + (h10 - h00) * tx
        const hx1 = h01 + (h11 - h01) * tx
        return hx0 + (hx1 - hx0) * tz
    }

    _defineExclusions()
    {
        this._circles = [
            { x: 35.76,  z: 13.41,  r: 8.5  }, // Estatua
            { x: 13.1,   z: 15.8,   r: 7.0  }, // Cartel Proyectos
            { x: 25.95,  z: -18.09, r: 9.5  }, // Plaza Social
            { x: -77.65, z: 39.92,  r: 8.5  }, // Molino
            { x: -15.16, z: -55.32, r: 14.5 }, // Exposición Banderas / Avión
            { x: -23.13, z: 58.10,  r: 12.5 }, // Banderas Skills
            { x: 56.16,  z: 47.36,  r: 4.5  }, // Símbolo </>
            { x: 4.90,   z: -29.21, r: 7.5  }, // Letras FREELANCER
            { x: 75.34,  z: -27.95, r: 12.0 }, // Vórtice del tornado
        ]

        this._boxes = [
            { x: -19.0,   z: -5.0,   hx: 18.0, hz: 12.5 }, // Cancha fútbol
            { x: -37.415, z: -54.505, hx: 9.5,  hz: 16.5 }, // Cancha baloncesto
        ]
    }

    _isPositionBlocked(x, z, margin = 0)
    {
        if(Math.abs(x) > this.mapBound || Math.abs(z) > this.mapBound)
            return true

        if(this.getGroundHeight(x, z) < -0.14)
            return true

        for(const c of this._circles)
        {
            const r = c.r + margin
            const dx = x - c.x
            const dz = z - c.z
            if(dx * dx + dz * dz < r * r)
                return true
        }

        for(const b of this._boxes)
        {
            if(Math.abs(x - b.x) < b.hx + margin && Math.abs(z - b.z) < b.hz + margin)
                return true
        }

        return false
    }

    _pickValidPointNear(cx, cz, minR, maxR)
    {
        for(let attempt = 0; attempt < 36; attempt++)
        {
            const angle = Math.random() * Math.PI * 2
            const radius = minR + Math.random() * (maxR - minR)
            const x = cx + Math.cos(angle) * radius
            const z = cz + Math.sin(angle) * radius
            if(!this._isPositionBlocked(x, z, 1.5))
                return { x, z }
        }
        return { x: 40, z: 34 }
    }

    _pickMapWideWaypoint(fromX, fromZ)
    {
        const longTrip = Math.random() < 0.65
        for(let attempt = 0; attempt < 40; attempt++)
        {
            let x, z
            if(longTrip)
            {
                x = (Math.random() * 2 - 1) * (this.mapBound - 6)
                z = (Math.random() * 2 - 1) * (this.mapBound - 6)
                if(Math.hypot(x - fromX, z - fromZ) < 18)
                    continue
            }
            else
            {
                const angle = Math.random() * Math.PI * 2
                const dist = 12 + Math.random() * 24
                x = fromX + Math.cos(angle) * dist
                z = fromZ + Math.sin(angle) * dist
            }

            if(!this._isPositionBlocked(x, z, 1.5))
                return { x, z }
        }
        return this._pickValidPointNear(0, 0, 12, 55)
    }

    _getSharedMaterial(origMat)
    {
        const key = origMat?.name || 'cow_default'
        if(this._sharedMaterials.has(key))
            return this._sharedMaterials.get(key)

        // Material Lambert ultraligero compartido entre las 4 vacas (sin compilación pesada por clon)
        const col = origMat?.color ? origMat.color.clone() : new THREE.Color(0x553318)
        const mat = new THREE.MeshLambertMaterial({
            color: col
        })
        this._sharedMaterials.set(key, mat)
        return mat
    }

    _loadModel()
    {
        const cached = this.game.resources?.cowModel
        if(cached)
        {
            this._spawnCows(cached)
            return
        }

        const loader = this.game.resourcesLoader.getLoader('gltf')
        loader.load(
            'animals/vaca.glb?cb=1',
            (gltf) =>
            {
                if(this._destroyed)
                    return
                if(this.game.resources)
                    this.game.resources.cowModel = gltf
                this._spawnCows(gltf)
            },
            undefined,
            (err) =>
            {
                console.warn('[Cows] Error cargando animals/vaca.glb:', err)
            }
        )
    }

    _findClip(clips, preferredNames)
    {
        for(const name of preferredNames)
        {
            const exact = clips.find(c => c.name === name)
            if(exact)
                return exact
        }
        return clips[0] || null
    }

    _spawnCows(gltf)
    {
        const clips = gltf.animations || []

        // Sombra de contacto plana compartida (evita castShadow en 28 SkinnedMeshes -> cero lag)
        this._shadowGeo = new THREE.CircleGeometry(1.25, 14)
        this._shadowGeo.rotateX(-Math.PI * 0.5)
        this._shadowMat = new THREE.MeshBasicMaterial({
            color: 0x0f1622,
            transparent: true,
            opacity: 0.30,
            depthWrite: false
        })

        // 2 vacas pacíficas (una visible cerca del inicio) + 2 vacas bravas más adentro del mapa
        // Así nunca te atacan apenas entras a la web; solo cuando sales a explorar y te acercas a ellas
        const spawnSeeds = [
            { x: 40,  z: 28,  scale: 0.45, pitch: 1.06, initialState: 'eat',  aggressive: false },
            { x: -46, z: 22,  scale: 0.44, pitch: 1.02, initialState: 'walk', aggressive: false },
            { x: 10,  z: -6,  scale: 0.48, pitch: 0.90, initialState: 'eat',  aggressive: true  },
            { x: 4,   z: -14, scale: 0.46, pitch: 0.96, initialState: 'walk', aggressive: true  },
        ]

        const totalToSpawn = Math.min(this.count, spawnSeeds.length)

        for(let i = 0; i < totalToSpawn; i++)
        {
            const seed = spawnSeeds[i]
            const startPos = !this._isPositionBlocked(seed.x, seed.z, 1.2)
                ? { x: seed.x, z: seed.z }
                : this._pickValidPointNear(seed.x, seed.z, 3, 20)

            const model = SkeletonUtils.clone(gltf.scene)
            model.scale.setScalar(seed.scale)

            const groundY = this.getGroundHeight(startPos.x, startPos.z)
            const rotY = Math.random() * Math.PI * 2
            model.position.set(startPos.x, groundY, startPos.z)
            model.rotation.y = rotY

            const cowClickTargets = []
            model.traverse((child) =>
            {
                if(child.isMesh)
                {
                    child.material = this._getSharedMaterial(child.material)
                    child.castShadow = false
                    child.receiveShadow = false
                    child.frustumCulled = true
                    if(child.geometry)
                    {
                        try
                        {
                            child.geometry.computeBoundingSphere()
                        }
                        catch(_) {}
                        if(child.geometry.boundingSphere && !isNaN(child.geometry.boundingSphere.radius))
                            child.geometry.boundingSphere.radius *= 2.5
                    }
                    cowClickTargets.push(child)
                }
            })

            // Disco ligero de sombra en el suelo bajo las patas
            const shadowMesh = new THREE.Mesh(this._shadowGeo, this._shadowMat)
            shadowMesh.scale.set(0.85, 1, 1.35)
            shadowMesh.position.set(startPos.x, groundY + 0.03, startPos.z)
            shadowMesh.rotation.y = rotY
            this.game.scene.add(shadowMesh)

            this.game.scene.add(model)

            const mixer = new THREE.AnimationMixer(model)
            const actions = {}

            const clipMap = {
                walk:     this._findClip(clips, ['Walk', 'AnimalArmature|Walk']),
                gallop:   this._findClip(clips, ['Gallop', 'AnimalArmature|Gallop']),
                eat:      this._findClip(clips, ['Eating', 'AnimalArmature|Eating']),
                idle:     this._findClip(clips, ['Idle', 'AnimalArmature|Idle']),
                idle2:    this._findClip(clips, ['Idle_2', 'AnimalArmature|Idle_2']),
                headlow:  this._findClip(clips, ['Idle_Headlow', 'AnimalArmature|Idle_Headlow']),
                headbutt: this._findClip(clips, ['Attack_Headbutt', 'AnimalArmature|Attack_Headbutt']),
            }

            for(const [key, clip] of Object.entries(clipMap))
            {
                if(clip)
                    actions[key] = mixer.clipAction(clip)
            }

            const waypoint = this._pickMapWideWaypoint(startPos.x, startPos.z)

            const cow = {
                id: i,
                aggressive: seed.aggressive,
                model,
                shadowMesh,
                mixer,
                actions,
                currentAction: null,
                currentActionKey: null,
                x: startPos.x,
                y: groundY,
                z: startPos.z,
                rotY,
                scale: seed.scale,
                pitch: seed.pitch,
                walkSpeed: 2.1 + Math.random() * 0.65,
                gallopSpeed: 13.8 + (i % 2) * 0.6, // Un poco más lentas que el jugador en pánico (16.2) para corretearlo de cerca
                state: seed.initialState,
                stateTimer: seed.initialState === 'eat' ? (5 + Math.random() * 6) : (10 + Math.random() * 14),
                targetX: waypoint.x,
                targetZ: waypoint.z,
                mooTimer: 8 + Math.random() * 14,
                animAccum: Math.random() * 0.05,
                stuckTimer: 0,
                lastCheckX: startPos.x,
                lastCheckZ: startPos.z,
                spookCooldown: 0
            }

            for(const mesh of cowClickTargets)
            {
                mesh.userData.cow = cow
                this.clickMeshes.push(mesh)
            }

            this._playAction(cow, seed.initialState === 'eat' ? 'eat' : 'walk', true)
            mixer.update(Math.random() * 2.0)

            this.cows.push(cow)
        }
    }

    _playAction(cow, key, immediate = false)
    {
        const action = cow.actions[key] || cow.actions.idle
        if(!action || cow.currentActionKey === key)
            return

        const isOnce = key === 'headbutt'
        action.reset()
        action.setLoop(isOnce ? THREE.LoopOnce : THREE.LoopRepeat, isOnce ? 1 : Infinity)
        action.clampWhenFinished = isOnce

        if(key === 'walk')
            action.timeScale = 0.85 + (cow.walkSpeed - 2.1) * 0.35
        else if(key === 'gallop')
            action.timeScale = 1.45
        else if(key === 'eat')
            action.timeScale = 0.85
        else
            action.timeScale = 1.0

        if(cow.currentAction && !immediate)
        {
            cow.currentAction.fadeOut(0.24)
            action.fadeIn(0.24).play()
        }
        else
        {
            if(cow.currentAction)
                cow.currentAction.stop()
            action.play()
        }

        cow.currentAction = action
        cow.currentActionKey = key
    }

    _enterState(cow, newState)
    {
        cow.state = newState

        if(newState === 'walk')
        {
            const wp = this._pickMapWideWaypoint(cow.x, cow.z)
            cow.targetX = wp.x
            cow.targetZ = wp.z
            cow.stateTimer = 14 + Math.random() * 18
            cow.stuckTimer = 0
            this._playAction(cow, 'walk')
        }
        else if(newState === 'eat')
        {
            cow.stateTimer = 6.0 + Math.random() * 7.5
            this._playAction(cow, 'eat')
        }
        else if(newState === 'idle')
        {
            cow.stateTimer = 2.8 + Math.random() * 4.2
            const idlePick = Math.random()
            const key = idlePick < 0.4 ? 'idle' : (idlePick < 0.75 ? 'idle2' : 'headlow')
            this._playAction(cow, key)
        }
        else if(newState === 'chase')
        {
            cow.stateTimer = this.chaseDuration
            this._playAction(cow, 'gallop')
        }
        else if(newState === 'flee')
        {
            cow.stateTimer = 2.2 + Math.random() * 1.4
            cow.spookCooldown = 5.5
            this._playAction(cow, 'gallop')
        }
        else if(newState === 'greet')
        {
            cow.stateTimer = 1.4
            this._playAction(cow, 'headbutt')
        }
    }

    _tryPlayMoo(cow, force = false)
    {
        const playerPos = this.game.physicalVehicle?.position || this.game.player?.position
        if(!playerPos)
            return

        const dist = Math.hypot(cow.x - playerPos.x, cow.z - playerPos.z)
        const maxHearDist = force ? 55 : 30
        if(dist > maxHearDist)
            return

        const attenuation = Math.max(0.12, 1 - dist / maxHearDist)
        this.proceduralSound.playCowMoo(attenuation * (force ? 0.95 : 0.55), cow.pitch)
    }

    _triggerScream()
    {
        if(!this.sounds?.maleScream)
            return
        try
        {
            this.sounds.maleScream.howl.stop()
            this.sounds.maleScream.play()
        }
        catch(_) {}
    }

    _stopScream()
    {
        if(!this.sounds?.maleScream)
            return
        try
        {
            this.sounds.maleScream.howl.stop()
        }
        catch(_) {}
    }

    /**
     * Inicia la persecución de 10 segundos con las 2 vacas bravas y huida automática gritando
     */
    _startCowAttackSequence(triggerCow, playerPos)
    {
        this.chasePhase = 'chasing'
        this.chaseElapsed = 0
        this.screamTimer = 3.1
        this._panicSteerTimer = 0

        // Dirección inicial de huida: alejándose de la vaca atacante
        const awayX = playerPos.x - triggerCow.x
        const awayZ = playerPos.z - triggerCow.z
        this._panicAngle = Math.atan2(awayX, awayZ)

        // Bloquear controles del jugador y activar huida automática en PhysicsVehicle
        if(this.game.player)
            this.game.player.state = Player.STATE_LOCKED

        if(this.game.physicalVehicle?.panicOverride)
        {
            this.game.physicalVehicle.panicOverride.active = true
            this.game.physicalVehicle.panicOverride.speed = 16.2
            this.game.physicalVehicle.panicOverride.dir.set(
                Math.sin(this._panicAngle),
                0,
                Math.cos(this._panicAngle)
            )
        }

        // Activar a las 2 vacas bravas en modo persecución
        let idx = 0
        for(const cow of this.cows)
        {
            if(!cow.aggressive)
                continue

            // Si la segunda vaca brava está muy lejos del jugador (> 28m), acercarla un poco detrás de la primera
            const d = Math.hypot(cow.x - playerPos.x, cow.z - playerPos.z)
            if(cow !== triggerCow && d > 28)
            {
                const sideAngle = this._panicAngle + Math.PI + (idx === 0 ? 0.45 : -0.45)
                const spawnX = playerPos.x + Math.sin(sideAngle) * 11.5
                const spawnZ = playerPos.z + Math.cos(sideAngle) * 11.5
                if(!this._isPositionBlocked(spawnX, spawnZ, 0.5))
                {
                    cow.x = spawnX
                    cow.z = spawnZ
                    cow.y = Math.max(-0.08, this.getGroundHeight(cow.x, cow.z))
                }
            }

            this._enterState(cow, 'chase')
            idx++
        }

        // Mugido fuerte de ataque + grito del tornado
        this._tryPlayMoo(triggerCow, true)
        this._triggerScream()
    }

    /**
     * Termina la persecución a los 10s: las vacas se van, el personaje cae (Death01) y sale la nubecita
     */
    _finishChaseAndCollapse(playerPos)
    {
        this.chasePhase = 'collapsed'
        this.collapseElapsed = 0
        this._thoughtShown = false

        // Detener el grito del tornado
        this._stopScream()

        // Apagar huida automática (mantiene STATE_LOCKED mientras está en el suelo)
        if(this.game.physicalVehicle?.panicOverride)
            this.game.physicalVehicle.panicOverride.active = false

        // Las 2 vacas bravas dejan de atacar y se alejan pacíficamente para siempre
        for(const cow of this.cows)
        {
            if(!cow.aggressive)
                continue
            cow.aggressive = false
            const awayX = cow.x - playerPos.x
            const awayZ = cow.z - playerPos.z
            const awayLen = Math.hypot(awayX, awayZ) || 1
            const retreatX = cow.x + (awayX / awayLen) * 26
            const retreatZ = cow.z + (awayZ / awayLen) * 26
            const wp = !this._isPositionBlocked(retreatX, retreatZ, 1.0)
                ? { x: retreatX, z: retreatZ }
                : this._pickMapWideWaypoint(cow.x, cow.z)

            cow.state = 'walk'
            cow.targetX = wp.x
            cow.targetZ = wp.z
            cow.stateTimer = 18
            this._playAction(cow, 'walk')
        }

        // Sonido de caída + animación de la tecla Y (Death01)
        if(this.sounds?.bodyFall)
        {
            try { this.sounds.bodyFall.play() } catch(_) {}
        }
        this.game.physicalVehicle?.proceduralSound?.playLandSound()

        if(this.game.world?.visualVehicle)
        {
            this.game.world.visualVehicle.playAction('Death01')
        }

        this._tempPos.set(playerPos.x, Math.max(0, playerPos.y - 1.1), playerPos.z)
        this.game.world?.gameFeelFX?.emitLandingDust(this._tempPos, 1.1)
    }

    _showThoughtBubble()
    {
        if(this._thoughtEl)
            this._thoughtEl.remove()

        // Nube de pensamiento orgánica y volumétrica realista (SVG multicapa con sombreado suave)
        const existingStyle = document.getElementById('cow-thought-bubble-styles')
        if(existingStyle)
            existingStyle.remove()

        const style = document.createElement('style')
        style.id = 'cow-thought-bubble-styles'
        style.textContent = `
            @keyframes cowThoughtDrift {
                0%, 100% { transform: translate(-50%, -100%) translateY(0px); }
                50% { transform: translate(-50%, -100%) translateY(-7px); }
            }
            @keyframes cowDotPop {
                0% { opacity: 0; transform: scale(0.3); }
                100% { opacity: 1; transform: scale(1); }
            }
            .cow-thought-wrap {
                position: fixed;
                left: 50%;
                top: 38%;
                z-index: 60;
                pointer-events: none;
                opacity: 0;
                transform: translate(-50%, -100%) scale(0.72);
                transition: opacity 0.45s ease, transform 0.5s cubic-bezier(0.2, 1.25, 0.35, 1);
                display: flex;
                flex-direction: column;
                align-items: center;
                filter: drop-shadow(0 18px 28px rgba(10, 22, 46, 0.30)) drop-shadow(0 4px 10px rgba(15, 35, 70, 0.16));
            }
            .cow-thought-wrap.is-visible {
                opacity: 1;
                animation: cowThoughtDrift 3.0s ease-in-out infinite;
            }
            .cow-thought-stage {
                position: relative;
                width: min(360px, 88vw);
                aspect-ratio: 380 / 215;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .cow-thought-svg {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                overflow: visible;
            }
            .cow-thought-text {
                position: relative;
                z-index: 2;
                width: 72%;
                margin-top: 6px;
                text-align: center;
                font-family: "Nunito", system-ui, -apple-system, sans-serif;
                color: #1c2c44;
                line-height: 1.32;
                text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
            }
            .cow-thought-lead {
                display: block;
                font-size: clamp(13px, 3.4vw, 15.5px);
                font-weight: 900;
                color: #122645;
                margin-bottom: 3px;
                letter-spacing: -0.01em;
            }
            .cow-thought-sub {
                display: block;
                font-size: clamp(11.5px, 3vw, 13.5px);
                font-weight: 700;
                font-style: italic;
                color: #3d5475;
            }
            .cow-thought-trail {
                position: relative;
                width: 70px;
                height: 46px;
                margin-top: -10px;
            }
            .cow-thought-puff {
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f6fd 58%, #cfe0f5 100%);
                box-shadow:
                    inset -2px -3px 5px rgba(120, 158, 206, 0.45),
                    inset 2px 2px 4px rgba(255, 255, 255, 0.95),
                    0 5px 12px rgba(10, 24, 52, 0.22);
                opacity: 0;
            }
            .cow-thought-wrap.is-visible .cow-thought-puff {
                animation: cowDotPop 0.35s cubic-bezier(0.2, 1.3, 0.4, 1) forwards;
            }
            .cow-thought-puff.p1 { width: 22px; height: 18px; left: 26px; top: 2px;  animation-delay: 0.05s; }
            .cow-thought-puff.p2 { width: 14px; height: 12px; left: 16px; top: 22px; animation-delay: 0.14s; }
            .cow-thought-puff.p3 { width: 9px;  height: 8px;  left: 10px; top: 36px; animation-delay: 0.22s; }
        `
        document.head.appendChild(style)

        const el = document.createElement('div')
        el.className = 'cow-thought-wrap'
        el.innerHTML = `
            <div class="cow-thought-stage">
                <svg class="cow-thought-svg" viewBox="0 0 380 215" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <defs>
                        <radialGradient id="cloudBodyGrad" cx="46%" cy="24%" r="76%">
                            <stop offset="0%" stop-color="#ffffff"/>
                            <stop offset="56%" stop-color="#f5f9ff"/>
                            <stop offset="86%" stop-color="#dfecfa"/>
                            <stop offset="100%" stop-color="#c9def4"/>
                        </radialGradient>
                        <radialGradient id="cloudHighlightGrad" cx="50%" cy="20%" r="65%">
                            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>
                            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                        </radialGradient>
                        <linearGradient id="cloudRimGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#a8c8ea" stop-opacity="0.7"/>
                        </linearGradient>
                    </defs>
                    <!-- Silueta orgánica de nube esponjosa -->
                    <path d="M98 182
                             C68 184, 42 168, 38 143
                             C16 135, 10 107, 25 88
                             C22 62, 46 40, 74 44
                             C87 22, 120 14, 146 28
                             C168 10, 212 10, 234 29
                             C262 16, 298 27, 308 53
                             C338 50, 364 73, 361 102
                             C375 122, 365 153, 340 160
                             C334 182, 306 194, 279 186
                             C258 200, 224 201, 202 189
                             C178 201, 144 199, 124 186
                             C115 186, 106 184, 98 182 Z"
                          fill="url(#cloudBodyGrad)"
                          stroke="url(#cloudRimGrad)"
                          stroke-width="2.2"
                          stroke-linejoin="round"/>
                    <!-- Volumen interno superior (brillo algodonoso de luz natural) -->
                    <ellipse cx="145" cy="64" rx="74" ry="30" fill="url(#cloudHighlightGrad)"/>
                    <ellipse cx="242" cy="68" rx="64" ry="26" fill="url(#cloudHighlightGrad)"/>
                    <ellipse cx="90" cy="96" rx="44" ry="24" fill="url(#cloudHighlightGrad)" opacity="0.7"/>
                    <!-- Sombra suave en la base interior para dar volumen 3D real -->
                    <path d="M56 152 C92 178, 152 184, 198 176 C248 184, 308 176, 336 150 C316 178, 266 192, 202 186 C142 194, 82 182, 56 152 Z"
                          fill="#b7d2ee" opacity="0.38"/>
                </svg>
                <div class="cow-thought-text">
                    <span class="cow-thought-lead">Ufff… ¡de la que me salvé! 😮‍💨</span>
                    <span class="cow-thought-sub">Eso me pasa por andar de distraído…</span>
                </div>
            </div>
            <div class="cow-thought-trail" aria-hidden="true">
                <span class="cow-thought-puff p1"></span>
                <span class="cow-thought-puff p2"></span>
                <span class="cow-thought-puff p3"></span>
            </div>
        `
        document.body.appendChild(el)
        this._thoughtEl = el

        this._updateThoughtBubblePosition()
        requestAnimationFrame(() =>
        {
            if(this._thoughtEl)
                this._thoughtEl.classList.add('is-visible')
        })
    }

    _updateThoughtBubblePosition()
    {
        if(!this._thoughtEl)
            return

        const cam = this.game.view?.camera || this.game.camera
        const playerPos = this.game.physicalVehicle?.position || this.game.player?.position
        if(!cam || !playerPos)
            return

        this._projPos.set(playerPos.x, playerPos.y + 0.55, playerPos.z)
        this._projPos.project(cam)

        if(this._projPos.z < 1)
        {
            const sx = (this._projPos.x * 0.5 + 0.5) * window.innerWidth
            const sy = (-this._projPos.y * 0.5 + 0.5) * window.innerHeight
            const halfW = Math.min(190, window.innerWidth * 0.48)
            const clampedX = Math.max(halfW, Math.min(window.innerWidth - halfW, sx))
            const clampedY = Math.max(210, Math.min(window.innerHeight - 60, sy - 18))
            this._thoughtEl.style.left = `${clampedX.toFixed(1)}px`
            this._thoughtEl.style.top = `${clampedY.toFixed(1)}px`
        }
    }

    _hideThoughtBubble()
    {
        if(!this._thoughtEl)
            return

        const el = this._thoughtEl
        this._thoughtEl = null
        el.classList.remove('is-visible')
        setTimeout(() =>
        {
            if(el.parentNode)
                el.parentNode.removeChild(el)
        }, 380)
    }

    _standUpAndFinishSequence()
    {
        this.chasePhase = 'done'
        this.cowAttackDone = true
        this._hideThoughtBubble()

        // Levantarse suavemente del suelo y devolver control al jugador
        if(this.game.world?.visualVehicle)
        {
            this.game.world.visualVehicle.playAction('Idle_Loop')
        }

        if(this.game.player)
        {
            this.game.player.state = Player.STATE_DEFAULT
        }
    }

    _onPointerDown(event)
    {
        if(event.isPrimary === false || this.clickMeshes.length === 0)
            return

        if(this.chasePhase === 'chasing' || this.chasePhase === 'collapsed')
            return

        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        const cam = this.game.view?.camera || this.game.camera
        if(!cam)
            return

        this._raycaster.setFromCamera(this._mouse, cam)
        const hits = this._raycaster.intersectObjects(this.clickMeshes, false)
        if(hits.length > 0)
        {
            const cow = hits[0].object.userData?.cow
            if(cow)
            {
                this._tryPlayMoo(cow, true)
                this._enterState(cow, 'greet')
                this._tempPos.set(cow.x, cow.y + 1.5, cow.z)
                this.game.world?.gameFeelFX?.emitImpactSparks(this._tempPos, 0xfff0b8, 0.85)
            }
        }
    }

    _onTick()
    {
        if(this.cows.length === 0)
            return

        const delta = Math.min(this.game.ticker.deltaScaled || 1 / 60, 0.05)
        const playerPos = this.game.physicalVehicle?.position || this.game.player?.position
        const waterY = this.game.water?.surfaceElevation ?? -0.3
        const isMobile = this.game.quality?.level === 1

        // Contar tiempo real explorando el mundo (después de terminar la intro)
        const isWandering = !!(this.game.inputs?.filters?.has('wandering'))
        if(isWandering && playerPos)
        {
            this._wanderingElapsed += delta
            if(!this._spawnPlayerPos)
                this._spawnPlayerPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z)
        }
        const distWalkedFromSpawn = (this._spawnPlayerPos && playerPos)
            ? Math.hypot(playerPos.x - this._spawnPlayerPos.x, playerPos.z - this._spawnPlayerPos.z)
            : 0
        const canTriggerCowAttack = isWandering && this._wanderingElapsed >= 10.0 && distWalkedFromSpawn >= 10.0

        // 1. GESTIÓN DE LA SECUENCIA DE PERSECUCIÓN Y COLAPSO
        if(this.chasePhase === 'chasing' && playerPos)
        {
            this.chaseElapsed += delta

            // Repetir el grito del tornado durante la huida si termina el clip
            this.screamTimer -= delta
            if(this.screamTimer <= 0 && this.chaseElapsed < this.chaseDuration - 0.8)
            {
                this.screamTimer = 3.1
                this._triggerScream()
            }

            // Calcular dirección segura de huida evitando bordes, ríos y obstáculos
            this._panicSteerTimer -= delta
            const probeX = playerPos.x + Math.sin(this._panicAngle) * 5.0
            const probeZ = playerPos.z + Math.cos(this._panicAngle) * 5.0

            if(this._isPositionBlocked(probeX, probeZ, 1.5))
            {
                // Girar hacia el lado despejado (probando varios ángulos)
                const offsets = [0.65, -0.65, 1.25, -1.25, 1.9, -1.9, Math.PI]
                for(const off of offsets)
                {
                    const testAngle = this._panicAngle + off
                    const tx = playerPos.x + Math.sin(testAngle) * 6.0
                    const tz = playerPos.z + Math.cos(testAngle) * 6.0
                    if(!this._isPositionBlocked(tx, tz, 1.2))
                    {
                        this._panicAngle = testAngle
                        break
                    }
                }
            }
            else if(this._panicSteerTimer <= 0)
            {
                // Ligero zig-zag natural de pánico
                this._panicSteerTimer = 1.1 + Math.random() * 0.8
                this._panicAngle += (Math.random() - 0.5) * 0.55
            }

            if(this.game.physicalVehicle?.panicOverride)
            {
                this.game.physicalVehicle.panicOverride.dir.set(
                    Math.sin(this._panicAngle),
                    0,
                    Math.cos(this._panicAngle)
                )
            }

            if(this.chaseElapsed >= this.chaseDuration)
            {
                this._finishChaseAndCollapse(playerPos)
            }
        }
        else if(this.chasePhase === 'collapsed')
        {
            this.collapseElapsed += delta

            // A los 0.75s en el suelo aparece la nubecita de pensamiento
            if(!this._thoughtShown && this.collapseElapsed >= 0.75)
            {
                this._thoughtShown = true
                this._showThoughtBubble()
            }

            if(this._thoughtEl)
                this._updateThoughtBubblePosition()

            // Mantener al personaje en el suelo leyendo su pensamiento y luego levantarse
            if(this.collapseElapsed >= 5.3)
            {
                this._standUpAndFinishSequence()
            }
        }

        // 2. ACTUALIZAR LAS 4 VACAS
        for(const cow of this.cows)
        {
            cow.stateTimer -= delta
            if(cow.spookCooldown > 0)
                cow.spookCooldown -= delta

            const distToPlayer = playerPos
                ? Math.hypot(cow.x - playerPos.x, cow.z - playerPos.z)
                : 999

            // Culling y throttling de animación para CERO lag
            const isChasingNow = cow.state === 'chase'
            const isVisible = isChasingNow || distToPlayer < 68
            cow.model.visible = isVisible
            if(cow.shadowMesh)
                cow.shadowMesh.visible = isVisible

            if(isVisible)
            {
                const targetStep = isChasingNow
                    ? (isMobile ? 0.033 : 0.0)
                    : (distToPlayer < 30 ? (isMobile ? 0.033 : 0.0) : 0.055)

                cow.animAccum += delta
                if(cow.animAccum >= targetStep)
                {
                    cow.mixer.update(cow.animAccum)
                    cow.animAccum = 0
                }
            }

            // Detectar si el jugador ya lleva un rato explorando y se acerca a una de las 2 vacas bravas (solo una vez)
            if(
                cow.aggressive &&
                canTriggerCowAttack &&
                !this.cowAttackDone &&
                this.chasePhase === 'idle' &&
                playerPos &&
                distToPlayer < 7.5 &&
                !this.game.physicalVehicle?.isSwimming &&
                (!this.game.player || this.game.player.state === Player.STATE_DEFAULT)
            )
            {
                this._startCowAttackSequence(cow, playerPos)
            }

            // Mugido ocasional cuando está cerca
            cow.mooTimer -= delta
            if(cow.mooTimer <= 0)
            {
                cow.mooTimer = 15 + Math.random() * 18
                if(distToPlayer < 30 && cow.state !== 'chase' && this.chasePhase !== 'chasing')
                    this._tryPlayMoo(cow, false)
            }

            // Lógica de persecución activa (las 2 vacas bravas galopando detrás del jugador)
            if(cow.state === 'chase' && playerPos)
            {
                // Cada vaca apunta ligeramente a un flanco detrás del jugador para no apilarse
                const flankOffset = cow.id % 2 === 0 ? 1.4 : -1.4
                const backX = playerPos.x - Math.sin(this._panicAngle) * 2.8 + Math.cos(this._panicAngle) * flankOffset
                const backZ = playerPos.z - Math.cos(this._panicAngle) * 2.8 - Math.sin(this._panicAngle) * flankOffset

                const dx = backX - cow.x
                const dz = backZ - cow.z
                const dist = Math.hypot(dx, dz) || 1
                const dirX = dx / dist
                const dirZ = dz / dist

                const desiredAngle = Math.atan2(dirX, dirZ)
                let angleDiff = desiredAngle - cow.rotY
                while(angleDiff > Math.PI) angleDiff -= Math.PI * 2
                while(angleDiff < -Math.PI) angleDiff += Math.PI * 2
                cow.rotY += angleDiff * Math.min(1, delta * 8.5)

                // Ajustar velocidad dinámicamente para mantenerse justo pisándole los talones
                const chaseSpeed = dist > 7.5 ? 17.5 : (dist < 2.2 ? 12.0 : cow.gallopSpeed)
                cow.x += Math.sin(cow.rotY) * chaseSpeed * delta
                cow.z += Math.cos(cow.rotY) * chaseSpeed * delta
            }
            else if(cow.state === 'walk' || cow.state === 'flee')
            {
                const speed = cow.state === 'flee' ? 6.0 : cow.walkSpeed
                const dx = cow.targetX - cow.x
                const dz = cow.targetZ - cow.z
                const distToTarget = Math.hypot(dx, dz)

                if(distToTarget < 2.2 || cow.stateTimer <= 0)
                {
                    const nextState = cow.state === 'flee'
                        ? 'idle'
                        : (Math.random() < 0.75 ? 'eat' : 'idle')
                    this._enterState(cow, nextState)
                }
                else
                {
                    let dirX = dx / distToTarget
                    let dirZ = dz / distToTarget

                    // Separación entre vacas
                    for(const other of this.cows)
                    {
                        if(other === cow)
                            continue
                        const ox = cow.x - other.x
                        const oz = cow.z - other.z
                        const od = Math.hypot(ox, oz)
                        if(od > 0.01 && od < 4.0)
                        {
                            const push = (4.0 - od) / 4.0
                            dirX += (ox / od) * push * 1.1
                            dirZ += (oz / od) * push * 1.1
                        }
                    }

                    // Separación suave del jugador (vacas pacíficas o tras terminar el ataque)
                    if(playerPos && distToPlayer > 0.01 && distToPlayer < 2.8)
                    {
                        const px = cow.x - playerPos.x
                        const pz = cow.z - playerPos.z
                        const push = (2.8 - distToPlayer) / 2.8
                        dirX += (px / distToPlayer) * push * 1.2
                        dirZ += (pz / distToPlayer) * push * 1.2
                    }

                    const norm = Math.hypot(dirX, dirZ) || 1
                    dirX /= norm
                    dirZ /= norm

                    const lookAhead = 2.6
                    if(this._isPositionBlocked(cow.x + dirX * lookAhead, cow.z + dirZ * lookAhead, 0.6))
                    {
                        const leftX = -dirZ, leftZ = dirX
                        const rightX = dirZ, rightZ = -dirX
                        if(!this._isPositionBlocked(cow.x + leftX * lookAhead, cow.z + leftZ * lookAhead, 0.5))
                        {
                            dirX = leftX; dirZ = leftZ
                        }
                        else if(!this._isPositionBlocked(cow.x + rightX * lookAhead, cow.z + rightZ * lookAhead, 0.5))
                        {
                            dirX = rightX; dirZ = rightZ
                        }
                        else
                        {
                            const wp = this._pickMapWideWaypoint(cow.x, cow.z)
                            cow.targetX = wp.x
                            cow.targetZ = wp.z
                            continue
                        }
                    }

                    const desiredAngle = Math.atan2(dirX, dirZ)
                    let angleDiff = desiredAngle - cow.rotY
                    while(angleDiff > Math.PI) angleDiff -= Math.PI * 2
                    while(angleDiff < -Math.PI) angleDiff += Math.PI * 2
                    cow.rotY += angleDiff * Math.min(1, delta * 3.4)

                    const nextX = cow.x + Math.sin(cow.rotY) * speed * delta
                    const nextZ = cow.z + Math.cos(cow.rotY) * speed * delta

                    if(!this._isPositionBlocked(nextX, nextZ, 0.2))
                    {
                        cow.x = nextX
                        cow.z = nextZ
                    }
                    else
                    {
                        const wp = this._pickMapWideWaypoint(cow.x, cow.z)
                        cow.targetX = wp.x
                        cow.targetZ = wp.z
                    }

                    cow.stuckTimer += delta
                    if(cow.stuckTimer > 3.0)
                    {
                        const moved = Math.hypot(cow.x - cow.lastCheckX, cow.z - cow.lastCheckZ)
                        cow.lastCheckX = cow.x
                        cow.lastCheckZ = cow.z
                        cow.stuckTimer = 0
                        if(moved < 0.8)
                        {
                            const wp = this._pickMapWideWaypoint(cow.x, cow.z)
                            cow.targetX = wp.x
                            cow.targetZ = wp.z
                        }
                    }
                }
            }
            else if(cow.state === 'eat')
            {
                if(cow.stateTimer <= 0)
                    this._enterState(cow, Math.random() < 0.75 ? 'walk' : 'idle')
            }
            else if(cow.state === 'idle' || cow.state === 'greet')
            {
                if(cow.stateTimer <= 0)
                    this._enterState(cow, Math.random() < 0.70 ? 'walk' : 'eat')
            }

            // Altura exacta del terreno + sombra de contacto
            const groundY = Math.max(-0.08, this.getGroundHeight(cow.x, cow.z))
            const floodBoost = waterY > groundY + 0.35 ? (waterY - groundY - 0.35) * 0.6 : 0
            cow.y = groundY + floodBoost

            if(isVisible)
            {
                cow.model.position.set(cow.x, cow.y, cow.z)
                cow.model.rotation.y = cow.rotY
                if(cow.shadowMesh)
                {
                    cow.shadowMesh.position.set(cow.x, groundY + 0.03, cow.z)
                    cow.shadowMesh.rotation.y = cow.rotY
                }
            }
        }
    }

    destroy()
    {
        this._destroyed = true
        this._stopScream()
        this._hideThoughtBubble()

        if(this.game.physicalVehicle?.panicOverride)
            this.game.physicalVehicle.panicOverride.active = false

        this.game.ticker.events.off('tick', this._onTick)
        window.removeEventListener('pointerdown', this._onPointerDown)

        for(const cow of this.cows)
        {
            if(cow.mixer)
                cow.mixer.stopAllAction()
            if(cow.model)
                this.game.scene.remove(cow.model)
            if(cow.shadowMesh)
                this.game.scene.remove(cow.shadowMesh)
        }

        this._sharedMaterials.forEach((mat) => mat.dispose())
        this._sharedMaterials.clear()
        if(this._shadowGeo) this._shadowGeo.dispose()
        if(this._shadowMat) this._shadowMat.dispose()

        this.cows = []
        this.clickMeshes = []
    }
}
