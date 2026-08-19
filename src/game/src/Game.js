import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TimeCycle } from './Game/TimeCycle.js';
import { Water } from './Game/Water.js';
import { CityBuilder } from './Game/CityBuilder.js';
import { PhysicsCharacter } from './Game/PhysicsCharacter.js';
import { StormManager } from './Game/StormManager.js';
import { ChunkManager } from './Game/ChunkManager.js';
import { PositionDebugger } from './Game/PositionDebugger.js';
import { WorldText } from './Game/WorldText.js';
import { TextFrontendDeveloper } from './Game/textFrontendDeveloper.js';
import { ProjectSignManager } from './Game/ProjectSignManager.js';
import { ProyectosSign } from './Game/assets/projects.js';
import { Habilidades } from './Game/assets/skills.js';
import { SocialIcons } from './Game/assets/icons.js';
import { SymbolFrontendDev } from './Game/assets/symbolFrontendDev.js';
import { MobileControlsManager } from './Game/MobileControlsManager.js';
import { getDeviceTierConfig } from './Game/DeviceTierManager.js';

export class Game { 
    constructor() {
    this.tierInfo         = getDeviceTierConfig();
    this._physicsEnabled  = false;
    this._controlsEnabled = false;
    this._renderStarted   = false;

    this._groundReady     = { field: false, city: false };
    this._vehicleSpawned  = false;
    this._readyResolve    = null;   // Promise.resolve de initAsync
    this._preloadedEntities = { character: null };
    this.playerMode       = 'character'; // 'character' o 'car'

    // Free camera variables (mouse drag)
    this.cameraAngleX     = 0;
    this.cameraAngleY     = 0;
    this.isDragging       = false;
    this._camYawTarget    = 0;   // Target horizontal camera angle (smoothly follows movement)
    this._camYawCurrent   = 0;   // Current horizontal camera angle
    this._lastMoveAngle   = 0;   // Last character movement angle
    this._camSnapped      = false; // If camera has been positioned initially

    this.audioListenerInitialized = false;

    // ── Footstep Audio (walk/run × city/ground) ─────────────────────────
    this._footAudioReady    = false;  // true when all 4 sounds are loaded
    this._footCurrent       = null;   // Audio currently playing
    this._footWalkCity      = null;
    this._footWalkGround    = null;
    this._footRunCity       = null;
    this._footRunGround     = null;

    // ── Reusable objects for render loop (prevents GC every frame) ─
    this._camOffset    = new THREE.Vector3();
    this._camQuat      = new THREE.Quaternion();
    this._camYUp       = new THREE.Vector3(0, 1, 0); // constant — never modified
    this._camRightAxis = new THREE.Vector3();
    this._camTargetPos = new THREE.Vector3();
    this._carPosVec    = new THREE.Vector3(); // reused in _animate
    this._prevPlayerPos = new THREE.Vector3(); // to detect movement direction
    this._origCamPos   = new THREE.Vector3(); // avoids camera .clone() every frame

    // ── Projects board: when open, camera is controlled by logo.js ─
    this._projectsBoardOpen = false;

    // ── Adaptive resolution ─────────────────────────────────────────
    this._targetPixelRatio = 1.0;
    this._lastRatioTime = performance.now();
    this._animateBound = this._animate.bind(this);
}

// ─────────────────────────────────────────────────────────────────
//  ASYNC INIT
// ─────────────────────────────────────────────────────────────────

/**
 * Configures renderer, scene, physics, and game modules.
 * RAPIER.init() was already called by the Orchestrator before this.
 * @returns {Promise<void>} resolves when ground is ready.
 */
async initAsync() {
    this._initThree();
    this._initPhysics();

    this.chunkManager = new ChunkManager(this.physicsWorld);
    this.timeCycle    = new TimeCycle(this.scene);
    this.stormManager = new StormManager(this.scene, this.camera);
    this.worldText    = new WorldText(this.scene, this.camera, this.physicsWorld);
    this.proyectosSign = new ProyectosSign(this.scene, this.physicsWorld, {
        x: -612.58,
        y: 0.20,
        z: -56.57,
        scale: 4.0
    });

    // Listen for projects board open/close to pause camera-follow
    window.addEventListener('projects:board', (e) => {
        const open = e.detail?.open ?? false;
        this._projectsBoardOpen = open;
        if (!open) {
            // On close, force immediate snap so camera does not
            // make a abrupt jump from sign position to player
            this._camSnapped = false;
        }
    });

    // Store for preloading character
    this._preloadedEntities = {
        character: null
    };

    return new Promise(resolve => {
        this._readyResolve = resolve;

        const trySpawn = async () => {
            if (this._vehicleSpawned) return;
            if (!this._groundReady.field || !this._groundReady.city) return;
            this._vehicleSpawned = true;
            
            console.log('[Game] Preloading character in background...');
            const char = new PhysicsCharacter(this.scene, this.physicsWorld, { controlsDisabled: true });
            this._preloadedEntities.character = char;

            // Temporarily hide visual mesh from scene
            if (char.characterMesh) {
                char.characterMesh.visible = false;
            }

            // Set default reference
            this.vehicle = char;

            // Wait for character to be 100% instantiated and animations ready
            if (char.readyPromise) {
                console.log('[Game] Waiting for character animations to load...');
                await char.readyPromise;
            }

            // Pre-activate physics for all chunks to eliminate walking lag
            if (this.chunkManager) {
                this.chunkManager.preActivateAll();
            }

            // Inicializar cartel interactivo de proyectos y pendones de habilidades
            this.projectSignManager = new ProjectSignManager(this.scene, this.camera);
            this.habilidades = new Habilidades(this.scene, this.physicsWorld, {
                position: { x: -626.28, y: 0.20, z: 195.12 }
            });
            this.socialIcons = new SocialIcons(this.scene, this.physicsWorld, {
                position: { x: 131.11, y: 0.20, z: 214.99 }
            });
            this.symbolFrontendDev = new SymbolFrontendDev(this.scene, {
                position: { x: -682.56, y: 5.5, z: -417.71 },
                scale: 1.35
            });
            
            resolve();   // Game is ready
        };

        // Load City and Ocean
        console.log('[Game] Loading City and Ocean Water...');
        this.cityBuilder = new CityBuilder(this.scene, this.physicsWorld, this.chunkManager, () => {
            this._groundReady.city = true;
            this._groundReady.field = true;

            // Instantiate ocean water directly from Water.js
            this.water = new Water();
            this.water.position.set(-260, -3.2, 0); // Leveled height to beach so it does not flood the city
            this.water.rotation.x = -Math.PI / 2;
            this.water.material.envMapIntensity = 0;
            this.scene.add(this.water);

            console.log('[Game] City and Water ready. Spawning Character...');
            trySpawn();
        }, this.tierInfo.config);

        // Safety net: 45 s max total wait (sequential requires more margin on slow network)
        setTimeout(() => {
            if (!this._vehicleSpawned) {
                console.warn('[Game] Timeout — spawning character anyway.');
                this._groundReady.field = this._groundReady.city = true;
                trySpawn();
            }
        }, 45000);
    });
}

// ─────────────────────────────────────────────────────────────────
//  THREE.JS
// ─────────────────────────────────────────────────────────────────

_initThree() {
    THREE.Cache.enabled = true;   // enable global FileLoader cache

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffcca3, 150, 850);

    this.camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 2000
    );
    // Initial position: overridden by CinematicCamera.snapToStart()
    this.camera.position.set(-255, 15, -50);
    this.camera.lookAt(-260, 3, -68);
    this.scene.userData.camera = this.camera;

    const cfg = this.tierInfo.config;
    this.renderer = new THREE.WebGLRenderer({
        antialias: cfg.shadows,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: true  // Resolves depth precision loss with huge far planes
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(cfg.pixelRatio);
    this.renderer.shadowMap.enabled    = cfg.shadows;
    // PCFShadowMap is faster than PCFSoftShadowMap (fewer sample taps).
    // With 1024px map and 200u frustum, shadows still look good.
    this.renderer.shadowMap.type       = THREE.PCFShadowMap;
    // autoUpdate = false + manual needsUpdate every 3 frames:
    // Sunlight doesn't change fast enough to recalculate shadows EVERY frame.
    // This saves ~66% of the GPU shadow pass cost.
    this.renderer.shadowMap.autoUpdate = false;
    this._shadowFrameCount = 0;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
    
    // Key optimization: Disables synchronous shader validations
    // This eliminates getProgramInfoLog / getShaderInfoLog calls that cause lag
    this.renderer.debug.checkShaderErrors = false;

    // Game canvas: starts hidden (intro is on top)
    const el = this.renderer.domElement;
    el.id = 'game-canvas';
    el.style.cssText = [
        'position:fixed', 'top:0', 'left:0',
        'width:100vw',    'height:100vh',
        'z-index:0',      'opacity:0',   // hidden until showCanvas()
        'display:block'
    ].join(';');

    const container = document.getElementById('canvas-container');
    if (container) container.appendChild(el);
    else           document.body.appendChild(el);

    // High precision clock
    this._prevTime = performance.now();

    // ── Fixed timestep for Rapier ─────────────────────────────────────────
    // Rapier needs FIXED simulation steps to be deterministic and avoid
    // jitter when turning/moving. We use a classic accumulator: if frame arrived
    // late, we run up to MAX_SUBSTEPS steps of 1/60 s.
    this._physicsAccumulator = 0;
    this._physicsFixedStep   = 1 / 60;   // 16.67 ms — same as Rapier default
    this._physicsMaxSubsteps = 3;         // Max 3 steps/frame → anti spiral-of-death clamp

    window.addEventListener('resize', this._onWindowResize.bind(this));

    // Camera drag
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // left button drags camera
            this.isDragging = true;
        }
    });
    window.addEventListener('mouseup',   (e) => {
        if (e.button === 0) {
            this.isDragging = false;
        }
    });
    window.addEventListener('mousemove', e => {
        if (!this._controlsEnabled) return;
        if (this.isDragging || e.buttons > 0) {
            this.cameraAngleX -= e.movementX * 0.01;
            this.cameraAngleY -= e.movementY * 0.01;
            this.cameraAngleY  = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.cameraAngleY));
        }
    });

    // ── Position debugging tool (double right-click) ──
    this.positionDebugger = new PositionDebugger(this.scene, this.camera);
}

_initPhysics() {
    this.physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
}

// ─────────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────────

/** Makes game canvas visible (call before fade-from-black). */
showCanvas() {
    if (this.renderer?.domElement) {
        this.renderer.domElement.style.opacity = '1';
    }
}

/** Starts render loop (call when cinematic begins). */
startRender() {
    if (this._renderStarted) return;
    this._renderStarted = true;

    // Initialize audio on user's first click/key
    window.addEventListener('click',   () => this._initUserAudio(), { once: true });
    window.addEventListener('keydown', () => this._initUserAudio(), { once: true });

    this._animateBound();
}

/** Enables Rapier simulation (call when cinematic ends). */
enablePhysics() {
    this._physicsEnabled = true;
    console.log('[Game] Physics enabled.');
}

/** Enables keyboard and follow camera. */
enableControls() {
    this._controlsEnabled = true;

    // Calculate ACTUAL camera yaw relative to character right now,
    // so camera does not jump — stays right where it was during portal.
    let targetX = 0, targetZ = 0;
    if (this.playerMode === 'character' && this.vehicle?.characterMesh) {
        targetX = this.vehicle.characterMesh.position.x;
        targetZ = this.vehicle.characterMesh.position.z;
    } else if (this.vehicle?.chassisBody) {
        const t = this.vehicle.chassisBody.translation();
        targetX = t.x; targetZ = t.z;
    }
    const dx = this.camera.position.x - targetX;
    const dz = this.camera.position.z - targetZ;
    this._camYawCurrent = Math.atan2(dx, dz);
    this._lastMoveAngle  = this._camYawCurrent; // prevents sudden turn on first movement

    // Mark snap as done: camera does NOT move in this instant
    this._camSnapped = true;

    if (this.vehicle) {
        this.vehicle.enableControls();
        if (!this.mobileControls) {
            this.mobileControls = new MobileControlsManager(this, this.vehicle);
        }
        // First the character is in Idle_Loop (normal pose)
        // After 600 ms, 'Yes' animation is played so there is no T-pose
        if (typeof this.vehicle.playAction === 'function') {
            this.vehicle.playAction('Idle_Loop');
            setTimeout(() => {
                if (typeof this.vehicle?.playAction === 'function') {
                    this.vehicle.playAction('Yes');
                }
            }, 600);
        }
    }
    console.log('[Game] Controls activated facing the character without jumps.');
}

rotateCameraBy(deltaYaw) {
    this._camYawCurrent += deltaYaw;
    this._camYawCurrent = this._camYawCurrent - Math.round(this._camYawCurrent / (Math.PI * 2)) * (Math.PI * 2);
}

/** Allows configuring whether to play with the car or the character. */
setPlayerMode(mode) {
    this.playerMode = mode;
    console.log('[Game] Player mode set to:', mode);
}

/**
 * Toggles visibility and physical activation of preloaded entities.
 * Avoids any hot asynchronous re-creation to eliminate lag when pressing start.
 */
recreatePlayerEntity() {
    console.log('[Game] Selecting preloaded entity. Mode:', this.playerMode);
    
    const character = this._preloadedEntities?.character;
    this.vehicle = character;
    if (character) {
        if (character.characterMesh) character.characterMesh.visible = true;
        character.controlsEnabled = true;
        if (character.chassisBody && character.world) {
            const RAY_START_Y = 200;
            const SPAWN_X = -260, SPAWN_Z = -78;
            const ray = new RAPIER.Ray({ x: SPAWN_X, y: RAY_START_Y, z: SPAWN_Z }, { x: 0, y: -1, z: 0 });
            const hit = character.world.castRay(ray, 300, true);
            const groundY = hit ? (RAY_START_Y - hit.timeOfImpact) : 1.70;
            const spawnCenterY = groundY + character.TARGET_HEIGHT * 0.5 + 4.5;
            character.chassisBody.setNextKinematicTranslation({ x: SPAWN_X, y: spawnCenterY, z: SPAWN_Z });
        }
    }
}

// ─────────────────────────────────────────────────────────────────
//  AUDIO
// ─────────────────────────────────────────────────────────────────

_initUserAudio() {
    if (this.audioListenerInitialized) return;
    this.audioListenerInitialized = true;

    const am = this.audioManager;
    if (am && am.ctx) {
        // Set the global audio context in Three.js so that the listener
        // and all sound objects share the same audio context from AudioManager.
        THREE.AudioContext.setContext(am.ctx);
    }

    const listener = new THREE.AudioListener();

    this.camera.add(listener);
    this.stormManager?.initAudio(listener);
    this.timeCycle?.initAudio(listener);

    this._footAudioReady = true;

    // ── Load ocean sound (water.mp3) with proximity activation ──
    const oceanAudioLoader = new THREE.AudioLoader();
    const oceanSrc = import.meta.env.BASE_URL.replace(/\/$/, '') + '/audios/agua/water.mp3';
    const oceanSound = new THREE.Audio(listener);
    oceanAudioLoader.load(oceanSrc, (buffer) => {
        oceanSound.setBuffer(buffer);
        oceanSound.setLoop(true);
        oceanSound.setVolume(0.0);
        oceanSound.play();
        this._oceanSound = oceanSound;
        console.log('[Ocean Audio] water.mp3 loaded and playing at volume 0');
    });
}

// ─────────────────────────────────────────────────────────────────
//  FOLLOW CAMERA
// ─────────────────────────────────────────────────────────────────

_updateFollowCamera() {
    // When project board is open, logo.js controls the camera
    if (this._projectsBoardOpen) return;
    if (!this._controlsEnabled) return;
    if (!this.vehicle) return;

    let targetX = 0, targetY = 0, targetZ = 0;

    if (this.playerMode === 'character' && this.vehicle.characterMesh) {
        const meshPos = this.vehicle.characterMesh.position;
        targetX = meshPos.x;
        targetY = meshPos.y + (this.vehicle.TARGET_HEIGHT * 0.5);
        targetZ = meshPos.z;
    } else if (this.vehicle.chassisBody) {
        const carPos = this.vehicle.chassisBody.translation();
        targetX = carPos.x; targetY = carPos.y; targetZ = carPos.z;
    } else {
        return;
    }

    const isCharacter = this.playerMode === 'character';
    const camDelta = Math.min(this._lastDelta ?? 0.016, 0.05);

    // ── Detect player movement direction ─────────────────────
    const playerMoved = (
        Math.abs(targetX - this._prevPlayerPos.x) > 0.01 ||
        Math.abs(targetZ - this._prevPlayerPos.z) > 0.01
    );

    if (playerMoved && !this.isDragging) {
        // Calculate movement angle on XZ plane
        const dx = targetX - this._prevPlayerPos.x;
        const dz = targetZ - this._prevPlayerPos.z;
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
            this._lastMoveAngle = Math.atan2(dx, dz);
        }
        // Camera rotates VERY SLOWLY towards front of movement (behind character)
        // Target angle = movement direction + PI (behind)
        const angleBehind = this._lastMoveAngle + Math.PI;
        // Adjust angle difference to choose the shortest path
        let diff = angleBehind - this._camYawCurrent;
        // Normalize diff to [-PI, PI] safely.
        // We use the direct mathematical formula: round to the nearest multiple of 2PI.
        diff = diff - Math.round(diff / (Math.PI * 2)) * (Math.PI * 2);
        // Only rotate if the difference is large (prevents micro-jitter)
        if (Math.abs(diff) > 0.05) {
            this._camYawCurrent += diff * camDelta * 0.8; // Very smooth
            // Normalize _camYawCurrent to [-PI, PI] to avoid infinite accumulation
            // which would cause diff to be huge in future frames
            // (bug: browser freeze when rotating left repeatedly).
            this._camYawCurrent = this._camYawCurrent - Math.round(this._camYawCurrent / (Math.PI * 2)) * (Math.PI * 2);
        }
    }

    this._prevPlayerPos.set(targetX, targetY, targetZ);

    // ── Control manual del ratón (override del auto-rotate) ──────────────
    if (this.isDragging) {
        this._camYawCurrent += (this.cameraAngleX - this._camYawCurrent) * 0.3;
    }

    // Combinamos el yaw actual con el drag del ratón
    const totalYaw = this._camYawCurrent + (this.isDragging ? 0 : this.cameraAngleX);
    if (!this.isDragging) {
        this.cameraAngleX += (0 - this.cameraAngleX) * 0.05;
        this.cameraAngleY += (0 - this.cameraAngleY) * 0.05;
    }

    // ── Offset de cámara ─────────────────────────────────────────────────
    const scaleFactor = isCharacter ? (this.vehicle.TARGET_HEIGHT / 9.0) : 1.0;
    
    // Distancia de la cámara al jugador
    const camDist   = (isCharacter ? 14 : 18) * scaleFactor;
    const camHeight = (isCharacter ?  9 : 12) * scaleFactor;

    // Posición de la cámara usando ángulo de yaw
    const camX = targetX + Math.sin(totalYaw) * camDist;
    const camZ = targetZ + Math.cos(totalYaw) * camDist;
    const camY = targetY + camHeight;

    this._camTargetPos.set(camX, camY, camZ);

    // ── Snap / seguimiento suave ──────────────────────────────────────────
    if (!this._camSnapped) {
        // Primera vez: snap instantáneo SIN forzar yaw (el yaw ya fue calculado
        // en enableControls() desde la posición real de la cámara)
        this._camSnapped = true;
        this.camera.position.copy(this._camTargetPos);
    } else {
        // Easing suave — cuanto más cerca, más rápido sigue
        const camAlpha = 1.0 - Math.pow(0.001, camDelta * 3.5);
        this.camera.position.lerp(this._camTargetPos, Math.min(camAlpha, 0.12));
    }
    
    // Mirar al jugador
    const lookY = isCharacter ? targetY + this.vehicle.TARGET_HEIGHT * 0.1 : targetY + 1.0;
    this.camera.lookAt(targetX, lookY, targetZ);
}

// ─────────────────────────────────────────────────────────────────
//  LOOP PRINCIPAL
// ─────────────────────────────────────────────────────────────────

_animate() {
    requestAnimationFrame(this._animateBound);

    const now   = performance.now();
    if (!this._prevTime) this._prevTime = now;
    const frameTime = now - this._prevTime;
    const delta = (isNaN(frameTime) || frameTime <= 0) ? 0.016 : Math.min(frameTime / 1000, 0.1);
    this._prevTime = now;
    this._lastDelta = delta;

    try {
        this._animateStep(now, frameTime, delta);
        this._animateFailCount = 0;
    } catch (err) {
        // Blindaje: si algo revienta aquí (geometría inválida, objeto null,
        // etc.) el rAF de arriba YA quedó programado, así que sin este
        // try/catch el loop entero se pone a tronar el MISMO error en
        // cada frame para siempre (justo lo que se veía en consola).
        // Con esto: se loguea UNA vez por falla real (no se spamea) y el
        // juego intenta seguir vivo en vez de quedar en un loop de errores.
        this._animateFailCount = (this._animateFailCount || 0) + 1;
        if (this._animateFailCount <= 3 || this._animateFailCount % 120 === 0) {
            console.error(`[Game] Error en _animate() (fallo #${this._animateFailCount}):`, err);
        }
        // Si falla de forma sostenida (10 frames seguidos, ~1/6 s a 60fps),
        // algo está roto de verdad y seguir intentando renderizar cada
        // frame solo satura la consola sin arreglar nada: pausamos el
        // render hasta que se pueda diagnosticar, en vez de spamear infinito.
        if (this._animateFailCount === 10) {
            console.error('[Game] _animate() falló 10 frames seguidos — pausando el render para no saturar la consola. Revisa el error de arriba.');
        }
        if (this._animateFailCount >= 10) {
            return;
        }
    }
}

_animateStep(now, frameTime, delta) {
    if (this._physicsEnabled) {
        // Fixed-timestep acumulador: pasos fijos de 1/60 s, máximo 3 por frame.
        // Esto elimina el jitter al girar/avanzar que causaba el delta variable.
        this._physicsAccumulator += delta;
        let substeps = 0;
        while (this._physicsAccumulator >= this._physicsFixedStep && substeps < this._physicsMaxSubsteps) {
            this.physicsWorld.step();
            this._physicsAccumulator -= this._physicsFixedStep;
            substeps++;
        }
        // Descartar acumulación residual para no generar burst de steps
        // tras un frame muy largo (e.g. cambio de pestaña)
        if (this._physicsAccumulator > this._physicsFixedStep * 2) {
            this._physicsAccumulator = 0;
        }
    }

    // Actualizar el personaje (mixer + físicas + movimiento)
    const chunkUpdatePos = this.vehicle?.characterMesh
        ? (this._carPosVec.copy(this.vehicle.characterMesh.position), this._carPosVec)
        : null;

    this.timeCycle?.update(delta, chunkUpdatePos);
    this.worldText?.update(delta);
    this.proyectosSign?.update(delta, now * 0.001);
    this.habilidades?.update(delta, now * 0.001);
    this.socialIcons?.update(delta, now * 0.001, this.camera, this.timeCycle);
    this.symbolFrontendDev?.update(now);
    // El mixer SIEMPRE actualiza (incluso antes de activar física)
    // para que Idle_Loop se vea desde que el portal empieza a abrirse.
    if (this._physicsEnabled) {
        this.vehicle?.update?.(delta, this.camera);
    } else if (this.vehicle?.mixer) {
        // Solo el mixer, sin física ni movimiento
        this.vehicle.mixer.update(delta);
    }

    if (this.water?.material?.uniforms) {
        if (this.water.material.uniforms.time) this.water.material.uniforms.time.value += delta;
        if (this.timeCycle?.currentColorWater && this.water.material.uniforms.waterColor) {
            this.water.material.uniforms.waterColor.value.copy(this.timeCycle.currentColorWater);
        }
    }
    this.stormManager?.update?.(delta, chunkUpdatePos, this.timeCycle);
    this.cityBuilder?.update?.(delta, this.timeCycle, chunkUpdatePos);
    // chunkManager.update() está desactivado intencionalmente:
    // preActivateAll() ya activó todos los chunks durante la carga.
    // Llamar update() en caliente provocaría recrear/destruir trimesh BVHs
    // mientras el jugador camina, generando lag (spikes de frame-time).

    this._updateFollowCamera();
    this._updateFootstepAudio(chunkUpdatePos);
    this._updateOceanAudio(chunkUpdatePos, delta);

    // Resolución fija en 1.0 — pixel ratio constante para evitar reescalados mid-frame

    // Guardar posición original de la cámara (reutilizamos vector para evitar GC)
    this._origCamPos.copy(this.camera.position);
    
    // Aplicar temblor de cámara (StormManager) si está activo
    if (this.stormManager && this.stormManager.cameraShakeStrength > 0.01) {
        const shake = this.stormManager.cameraShakeStrength;
        this.camera.position.x += (Math.random() - 0.5) * shake;
        this.camera.position.y += (Math.random() - 0.5) * shake;
        this.camera.position.z += (Math.random() - 0.5) * shake;
    }

    // Actualizar sombras cada 3 frames (throttle) para reducir costo de shadow pass
    this._shadowFrameCount = (this._shadowFrameCount || 0) + 1;
    if (this._shadowFrameCount % 3 === 0) {
        this.renderer.shadowMap.needsUpdate = true;
    }

    // Render
    this.renderer.render(this.scene, this.camera);

    // Restaurar posición original para la física/suavizado del siguiente frame
    this.camera.position.copy(this._origCamPos);

    // Actualizar título dinámico en el navegador
    if (chunkUpdatePos) {
        this._updateTitle(now, chunkUpdatePos);
    }
}

// ─────────────────────────────────────────────────────────────────
//  AUDIO DE PASOS (superficie + estado de locomoción)
// ─────────────────────────────────────────────────────────────────

_updateFootstepAudio(pos) {
    if (!this._footAudioReady || !pos) return;
    if (this.playerMode !== 'character') {
        // En modo coche siempre silenciamos los pasos y restauramos música
        this._stopAllFootsteps();
        this.audioManager?.setDuckingFactor(1.0);
        return;
    }

    const character = this.vehicle;
    if (!character || !character.modelLoaded) return;

    // ── Determinar estado de locomoción ──────────────────────────────────
    const clipName = character.currentAction?.getClip?.()?.name ?? null;
    const isWalking  = clipName === 'Walk_Loop';
    const isRunning  = clipName === 'Sprint_Loop';
    const isMoving   = isWalking || isRunning;

    if (!isMoving) {
        this.audioManager?.setDuckingFactor(1.0);
        return;
    }

    // Bajar el volumen de la música de fondo al 70% cuando camina/corre para destacar los pasos
    this.audioManager?.setDuckingFactor(0.70);
}

_stopAllFootsteps() {
    this._footCurrent = null;
}

// ─────────────────────────────────────────────────────────────────
//  AUDIO DEL OCÉANO / AGUA (PROXIMIDAD 5-6 METROS)
// ─────────────────────────────────────────────────────────────────

_updateOceanAudio(pos, delta) {
    if (!this._oceanSound || !pos) return;

    // Posiciones exactas de las 4 orillas de la playa en coordenadas mundo:
    // El mapa tiene centro en (-260, 0). El borde de la playa esta a farGrassHalf * scale = 236 * 3 = 708u
    // Norte: Z = -708, Sur: Z = +708, Este: X = -260+708 = +448, Oeste: X = -260-708 = -968
    const BEACH_N_Z = -708;
    const BEACH_S_Z =  708;
    const BEACH_E_X =  448;
    const BEACH_W_X = -968;

    // Distancia minima del personaje a cualquiera de las 4 orillas
    const distN = Math.abs(pos.z - BEACH_N_Z);
    const distS = Math.abs(pos.z - BEACH_S_Z);
    const distE = Math.abs(pos.x - BEACH_E_X);
    const distW = Math.abs(pos.x - BEACH_W_X);
    const nearestBeach = Math.min(distN, distS, distE, distW);

    // Solo contar si el personaje esta dentro del area del mapa (o en la playa)
    const inMapArea = pos.x > BEACH_W_X && pos.x < BEACH_E_X && pos.z > BEACH_N_Z && pos.z < BEACH_S_Z;

    // Activar audio cuando este a menos de 15 unidades de cualquier playa (aprox 5 metros)
    const triggerDist = 15.0;
    let targetVolume = 0.0;

    if (inMapArea && nearestBeach <= triggerDist) {
        // Fade in suave conforme se acerca: a 15u empieza, a 0u suena al maximo
        const factor = 1.0 - (nearestBeach / triggerDist);
        targetVolume = factor * 1.0; // Volumen maximo al llegar a la orilla
    }

    // Interpolar volumen suavemente para fade in/out
    if (this._oceanSound.buffer) {
        const currentVol = this._oceanSound.getVolume();
        const newVol = currentVol + (targetVolume - currentVol) * Math.min(1.0, delta * 3.0);
        this._oceanSound.setVolume(newVol);
        if (!this._oceanSound.isPlaying && newVol > 0.01) {
            this._oceanSound.play();
        }
    }
}

_updateTitle(now, pos) {
    if (!this._lastTitleTime) {
        this._lastTitleTime = 0;
        this._titleFrame = 0;
    }

    // Limitar la actualización a cada 350ms para no sobrecargar el navegador
    if (now - this._lastTitleTime > 350) {
        this._lastTitleTime = now;
        this._titleFrame = (this._titleFrame + 1) % 2;

        const runner = this._titleFrame === 0 ? '🏃‍♂️' : '🚶‍♂️';
        
        document.title = `jesus's portfolio ${runner} 🏙️ 🏢 🏕️`;
    }
}

_onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
}
}