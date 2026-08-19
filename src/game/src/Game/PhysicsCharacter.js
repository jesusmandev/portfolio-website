import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { ProceduralSound } from './ProceduralSound.js';

// Mapeos de comandos del usuario
const digitMap = {
    '1': 'Idle_Loop', '2': 'Idle_FoldArms_Loop', '3': 'Idle_Talking_Loop',
    '4': 'Idle_TalkingPhone_Loop', '5': 'Idle_No_Loop', '6': 'Idle_Lantern_Loop',
    '7': 'Idle_Torch_Loop', '8': 'Idle_Rail_Loop', '9': 'Idle_Rail_Call', '0': 'Yes',
};

const letterMap = {
    'a': 'Walk_Loop', 'b': 'Walk_Formal_Loop', 'c': 'Walk_Carry_Loop',
    'd': 'Jog_Fwd_Loop', 'e': 'Sprint_Loop', 'f': 'Crouch_Idle_Loop',
    'g': 'Crouch_Fwd_Loop', 'h': 'Roll', 'i': 'Slide_Start', 'j': 'Slide_Loop',
    'k': 'Slide_Exit', 'l': 'Push_Loop', 'm': 'Jump_Start', 'n': 'Jump_Loop',
    'o': 'Jump_Land', 'p': 'ClimbUp_1m', 'q': 'NinjaJump_Start',
    'r': 'NinjaJump_Idle_Loop', 's': 'NinjaJump_Land', 't': 'Interact',
    'u': 'PickUp_Table', 'v': 'Consume', 'w': 'Chest_Open', 'x': 'Dance_Loop',
    'y': 'Death01', 'z': 'A_TPose',
};

const shiftMap = {
    'a': 'Punch_Jab', 'b': 'Punch_Cross', 'c': 'Melee_Hook', 'd': 'Melee_Hook_Rec',
    'e': 'OverhandThrow', 'f': 'Sword_Attack', 'g': 'Sword_Idle',
    'h': 'Sword_Regular_A', 'i': 'Sword_Regular_A_Rec', 'j': 'Sword_Regular_B',
    'k': 'Sword_Regular_B_Rec', 'l': 'Sword_Regular_C', 'm': 'Sword_Regular_Combo',
    'n': 'Sword_Heavy_Combo', 'o': 'Sword_Block', 'p': 'Sword_Dash',
    'q': 'Shield_Dash', 'r': 'Shield_OneShot', 's': 'Idle_Shield_Loop',
    't': 'Idle_Shield_Break', 'u': 'Hit_Chest', 'v': 'Hit_Head', 'w': 'Hit_Knockback',
};

const altMap = {
    'a': 'Pistol_Aim_Down', 'b': 'Pistol_Aim_Up', 'c': 'Pistol_Aim_Neutral',
    'd': 'Pistol_Idle_Loop', 'e': 'Pistol_Shoot', 'f': 'Pistol_Reload',
    'g': 'Spell_Simple_Enter', 'h': 'Spell_Simple_Exit', 'i': 'Spell_Simple_Idle_Loop',
    'j': 'Spell_Simple_Shoot', 'k': 'Sitting_Enter', 'l': 'Sitting_Exit',
    'm': 'Sitting_Idle_Loop', 'n': 'Sitting_Talking_Loop', 'o': 'LayToIdle',
    'p': 'Driving_Loop', 'q': 'Swim_Idle_Loop', 'r': 'Swim_Fwd_Loop',
    's': 'Fixing_Kneeling', 't': 'TreeChopping_Loop', 'u': 'Farm_Harvest',
    'v': 'Farm_PlantSeed', 'w': 'Farm_Watering', 'x': 'A_TPose_retarget',
};

const locomotionSpeeds = {
    'Walk_Loop': 3.5, 'Walk_Formal_Loop': 3.2, 'Walk_Carry_Loop': 2.8,
    'Jog_Fwd_Loop': 7.0, 'Sprint_Loop': 12.0, 'Crouch_Fwd_Loop': 1.8,
    'Swim_Fwd_Loop': 4.5, 'Slide_Loop': 9.0, 'NinjaJump_Idle_Loop': 5.0,
};

/**
 * Despliega la imagen public/hello/hello-intro.png desde la parte inferior
 * hacia arriba del centro y corrida a la derecha para no tapar al personaje.
 */
export function showHelloIntroImage() {
    const existing = document.getElementById('hello-intro-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'hello-intro-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'pointer-events: none',
        'z-index: 99999',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'overflow: hidden'
    ].join(';');

    const baseUrl = import.meta.env.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, '') : '';
    const imgUrl = `${baseUrl}/hello/hello-intro.png`;

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = 'Hello Intro';
    img.style.cssText = [
        'max-width: 44vw',
        'max-height: 44vh',
        'object-fit: contain',
        'transform: translate(12vw, 120vh) scale(0.5)',
        'opacity: 0',
        'transition: transform 0.85s cubic-bezier(0.175, 0.885, 0.32, 1.25), opacity 0.6s ease',
        'filter: drop-shadow(0 15px 45px rgba(0,0,0,0.65))'
    ].join(';');

    overlay.appendChild(img);
    document.body.appendChild(overlay);

    // Subir desde abajo a la derecha (24vw) y arriba del centro (sin tapar al personaje)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            img.style.transform = 'translate(24vw, -14vh) scale(0.85)';
            img.style.opacity = '1';
        });
    });

    // A los 3 segundos se desvanece y retira
    setTimeout(() => {
        img.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease-out';
        img.style.transform = 'translate(24vw, -20vh) scale(0.78)';
        img.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 700);
    }, 3000);
}

export class PhysicsCharacter {
    constructor(scene, physicsWorld, opts = {}) {
        this.scene = scene;
        this.world = physicsWorld;
        this.opts = opts;

        // ── Refs for real shader warm-up (renderer.compile) ─────────────
        // Without this, animation warm-up only moves bones on CPU but
        // never compiles the skinned material shader on the GPU. That actual
        // compile happens on the first visible draw call, which coincides with when
        // the player starts moving/turning -> feels like "lag when changing
        // animation" when in reality it is late shader compilation.
        this.renderer = opts.renderer || null;
        this.camera   = opts.camera || null;

        // ── Character scale ─────────────────────────────────────────────
        this.TARGET_HEIGHT = 9.0;
        this.modelLoaded = false;
        this.controlsEnabled = !opts.controlsDisabled;

        this.speed = 0;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        this._targetMoveSpeed = 0;
        this._currentMoveSpeed = 0;

        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.turnSpeed = opts.turnSpeed ?? 5.0;
        this.walkSpeed = opts.walkSpeed ?? 18.0;
        this.runSpeed  = opts.runSpeed  ?? 36.0;
        this.gravity   = -24;
        this.jumpForce = 10.0;

        // Entradas de control
        this.sideInput     = 0;
        this.forwardInput  = 0;
        this.sprintInput   = false;
        this.jumpInput     = false;

        // ── Reusable objects (prevent GC / stutter per frame) ───────────
        // IMPORTANT: Previously these were created with "new" inside update(),
        // which generated thousands of objects per second and was the main cause
        // of the lag/stutter that was perceived as "jumps" when walking.
        this._tmpQuat       = new THREE.Quaternion();
        this._rotDiff       = new THREE.Quaternion();
        this._targetQuat    = new THREE.Quaternion();
        this._yAxis         = new THREE.Vector3(0, 1, 0);
        this._moveDir       = new THREE.Vector3();
        this._gravStep      = new THREE.Vector3();
        this._totalMove     = new THREE.Vector3();
        this._forwardVec    = new THREE.Vector3(0, 0, -1);
        this._rightVec      = new THREE.Vector3(1, 0, 0);
        this._camForward    = new THREE.Vector3();
        this._camRight      = new THREE.Vector3();

        // Sintetizador de audio procedural (pisadas, correr, saltar, aterrizar)
        this.proceduralSound = new ProceduralSound();
        this._stepTimer      = 0.35;

        this.readyPromise = new Promise(resolve => {
            this._resolveReady = resolve;
        });

        // Guardar referencias a handlers para poder removerlos en dispose()
        this._boundKeyDown = this._onKeyDown.bind(this);
        this._boundKeyUp   = this._onKeyUp.bind(this);

        this.setupInput();
        this.loadModel();
    }

    enableControls() {
        this.controlsEnabled = true;
        if (this.characterMesh) {
            this.characterMesh.visible = true;
        }
        this.sideInput     = 0;
        this.forwardInput  = 0;
        this.sprintInput   = false;
        this.jumpInput     = false;
    }

    setupInput() {
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup',   this._boundKeyUp);
    }

    _onKeyDown(e) {
            if (!this.controlsEnabled) return;

            // Barra espaciadora → saltar
            if (e.key === ' ' || e.key === 'Spacebar') {
                this.jumpInput = true;
                return;
            }

            // Movement and rotation
            if (e.key === 'a' || e.key === 'ArrowLeft')  { this.sideInput = -1; return; }
            if (e.key === 'd' || e.key === 'ArrowRight') { this.sideInput =  1; return; }
            if (e.key === 'w' || e.key === 'ArrowUp')    { this.forwardInput  =  1; return; }
            if (e.key === 's' || e.key === 'ArrowDown')  { this.forwardInput  = -1; return; }
            if (e.key === 'Shift') { this.sprintInput = true; return; }

            // Animaciones manuales
            const k = e.key.toLowerCase();
            let clipName = null;

            if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
                clipName = digitMap[e.key] || letterMap[k];
            } else if (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
                clipName = shiftMap[k];
            } else if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                clipName = altMap[k];
            }

            if (clipName) {
                e.preventDefault();
                this.playAction(clipName);
            }
    }

    _onKeyUp(e) {
            if (!this.controlsEnabled) return;

            if (e.key === 'Shift')                       { this.sprintInput = false; return; }
            if (e.key === 'a' || e.key === 'ArrowLeft')  this.sideInput = 0;
            if (e.key === 'd' || e.key === 'ArrowRight') this.sideInput = 0;
            if (e.key === 'w' || e.key === 'ArrowUp')    this.forwardInput = 0;
            if (e.key === 's' || e.key === 'ArrowDown')  this.forwardInput = 0;
            if (e.key === ' ' || e.key === 'Spacebar')   this.jumpInput = false;
    }

    /** Releases all resources: listeners, mixer, Rapier physics body. */
    dispose() {
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup',   this._boundKeyUp);

        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.characterMesh);
        }

        if (this.chassisBody && this.world) {
            try { this.world.removeRigidBody(this.chassisBody); } catch(_) {}
            this.chassisBody = null;
        }

        if (this.characterMesh && this.scene) {
            this.scene.remove(this.characterMesh);
        }

        this.characterMesh = null;
        this.actions = {};
        console.log('[PhysicsCharacter] dispose() completado.');
    }

    loadModel() {
        const loader = new GLTFLoader();
        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');

        loader.load(`${baseUrl}/personaje/model.glb`, (gltf) => {
            const model = gltf.scene;

            // Ocultar temporalmente hasta que los shaders compilen
            model.visible = false;

            model.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    // frustumCulled = true (por defecto) para que Three.js
                    // does not render the mesh when it is out of camera view.
                    // We expand the bounding sphere to avoid popping in close cameras.
                    if (c.geometry && c.geometry.attributes && c.geometry.attributes.position && c.geometry.attributes.position.count > 0) {
                        try {
                            c.geometry.computeBoundingSphere();
                        } catch (_) {}
                        if (!c.geometry.boundingSphere || isNaN(c.geometry.boundingSphere.radius)) {
                            c.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
                        } else {
                            c.geometry.boundingSphere.radius *= 2.5;
                        }
                    }
                }
            });

            model.scale.setScalar(this.TARGET_HEIGHT / 1.8);
            this.scene.add(model);

            // ── Real foot↔origin offset ─────────────────────────────────────────
            // PREVIOUSLY the code assumed "position.y = physics_Y - TARGET_HEIGHT*0.5",
            // meaning the origin (0,0,0) of the .glb is at the VERTICAL CENTER
            // of the character. If the model (like most Mixamo exports)
            // has its origin at the FEET, that offset causes the character to sink.
            // FIX: Instead of a hardcoded offset, we compute
            // the real bounding box (already scaled) to find where the feet are
            // relative to the origin.
            model.updateMatrixWorld(true);
            const bbox = new THREE.Box3().setFromObject(model);
            // bbox is in WORLD space but with model.position still at (0,0,0),
            // so bbox.min.y = distance from the model origin down to its feet.
            this._feetOffsetY = bbox.min.y;
            console.log(`[PhysicsCharacter] bbox del modelo: min.y=${bbox.min.y.toFixed(3)}, max.y=${bbox.max.y.toFixed(3)} (alto real=${(bbox.max.y - bbox.min.y).toFixed(3)}, esperado=${this.TARGET_HEIGHT})`);

            // Initial character position.
            // We calculate the capsule center (SPAWN_BODY_Y) from the
            // superficie REAL del suelo de Rapier. El cityGroup tiene:
            //   offsetY  = -1.0
            //   ZONE_Y   =  0.9  (plaza/asfalto, espacio local)
            //   GRASS_TOP_Y = 0.4 (grass, local space)
            // spawnX=-260 → espacio local del cityGroup = -260 - (-350) = 90
            // CITY_PAD/2 = 95, así que 90 < 95 → estamos en la PLAZA
            // Superficie de plaza en coords mundo = offsetY + ZONE_Y = -1.0 + 0.9 = -0.1
            // Initial character position shifted further back (Z: -78) and higher (+4.5m)
            const spawnX = -260, spawnZ = -78;
            const capsuleHalfHeight0 = this.TARGET_HEIGHT * 0.28;
            const capsuleRadius0     = this.TARGET_HEIGHT * 0.22;
            const capsuleTotalHalf   = capsuleHalfHeight0 + capsuleRadius0; // 4.5
            const plazaSurfaceWorldY = 1.70;
            const SPAWN_BODY_Y = plazaSurfaceWorldY + capsuleTotalHalf + 4.5;
            const spawnCapsuleBottomY = SPAWN_BODY_Y - capsuleTotalHalf;
            model.position.set(spawnX, spawnCapsuleBottomY - (this._feetOffsetY || 0), spawnZ);
            this.characterMesh = model;
            this._introState = 'falling';

            // Animador
            this.mixer = new THREE.AnimationMixer(model);
            this.mixer.addEventListener('finished', e => this.onActionFinished(e));

            // Physics body (capsule)
            const capsuleHalfHeight = this.TARGET_HEIGHT * 0.28;
            const capsuleRadius     = this.TARGET_HEIGHT * 0.22;
            this._capsuleHalfHeight = capsuleHalfHeight;
            this._capsuleRadius     = capsuleRadius;

            const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
                .setTranslation(spawnX, SPAWN_BODY_Y, spawnZ);
            this.chassisBody = this.world.createRigidBody(rbDesc);

            const colDesc = RAPIER.ColliderDesc.capsule(capsuleHalfHeight, capsuleRadius)
                .setFriction(0)               // friction is managed by the characterController
                .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
            this.chassisCollider = this.world.createCollider(colDesc, this.chassisBody);

            // ── Controlador de personaje Rapier ─────────────────────────────
            const controllerOffset = 0.05;
            this.characterController = this.world.createCharacterController(controllerOffset);
            this.characterController.setApplyImpulsesToDynamicBodies(true);
            if (typeof this.characterController.setUp === 'function') {
                this.characterController.setUp({ x: 0, y: 1, z: 0 });
            }
            this.characterController.setSlideEnabled(true);
            this.characterController.setMaxSlopeClimbAngle(65 * Math.PI / 180);
            this.characterController.setMinSlopeSlideAngle(35 * Math.PI / 180);

            // AUTOSTEP: Permite subir bordillos, aceras, escalones y desniveles de hasta 4.5m sin atascarse
            this.characterController.enableAutostep(
                4.5,
                0.001,
                true
            );

            // SNAP TO GROUND: Mantiene al personaje pegado al suelo al bajar bordillos y desniveles
            this.characterController.enableSnapToGround(2.5);

            // Cargar y registrar animaciones desde animations.glb
            loader.load(`${baseUrl}/personaje/animations.glb`, (animGltf) => {
                if (animGltf.animations && animGltf.animations.length > 0) {
                    animGltf.animations.forEach(clip => {
                        this.actions[clip.name] = this.mixer.clipAction(clip);
                    });
                }

                this.modelLoaded = true;
                this.playAction('Idle_Loop');

                // Pre-warm skinning shaders to avoid lag when changing animations during gameplay
                // Bone warm-up: runs through the most-used poses in the game to
                // que sus PropertyMixer queden "calientes" antes de jugar.
                // NOTE: this alone does NOT compile shaders on the GPU, it only prepares
                // el estado de huesos en CPU. El compile real va abajo.
                const posesToWarm = [
                    'Idle_Loop', 'Walk_Loop', 'Sprint_Loop', 'Jump_Loop',
                    'Jump_Start', 'Jump_Land', 'Roll', 'Crouch_Idle_Loop'
                ];
                posesToWarm.forEach(name => {
                    const act = this.actions[name];
                    if (act) {
                        act.play();
                        this.mixer.update(0.001);
                        act.stop();
                    }
                });

                // Volver al estado idle antes de compilar/mostrar, para no
                // "flashear" ninguna de las poses de warm-up.
                this.playAction('Idle_Loop');
                this.mixer.update(0);

                // ── Real GPU shader compilation ────────────────────────
                // renderer.compile() traverses the scene graph and links the
                // shader programs (including skinning and shadow variants)
                // synchronously, BEFORE the model is visible. This moves the
                // "first draw" hitch to a controlled moment in loading,
                // rather than feeling like scattered lag during gameplay.
                if (this.renderer && this.camera) {
                    try {
                        this.renderer.compile(this.scene, this.camera);
                    } catch (err) {
                        console.warn('[PhysicsCharacter] renderer.compile() failed, will compile on-the-fly:', err);
                    }
                }

                // Resolve the promise that the character is fully loaded and positioned
                if (typeof this._resolveReady === 'function') {
                    this._resolveReady();
                }
            }, undefined, (err) => {
                console.warn('[PhysicsCharacter] Failed to load animations.glb, using fallback:', err);
                gltf.animations.forEach(clip => {
                    this.actions[clip.name] = this.mixer.clipAction(clip);
                });
                this.modelLoaded = true;
                this.playAction('Idle_Loop');
                this.mixer.update(0);

                if (this.renderer && this.camera) {
                    try {
                        this.renderer.compile(this.scene, this.camera);
                    } catch (err) {
                        console.warn('[PhysicsCharacter] renderer.compile() failed, will compile on-the-fly:', err);
                    }
                }

                if (typeof this._resolveReady === 'function') {
                    this._resolveReady();
                }
            });

            // Hacer visible el modelo tras un breve delay para dar tiempo al GPU
            setTimeout(() => {
                if (model) {
                    model.visible = this.controlsEnabled || !this.opts.controlsDisabled;
                }
            }, 300);
        });
    }

    playAction(name) {
        const action = this.actions[name];
        if (!action) return;
        if (this.currentAction === action) return;

        const isLoop = name.endsWith('_Loop') || name === 'Sword_Idle' || name === 'A_TPose';
        const fadeDuration = 0.09;

        action.reset();
        action.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
        action.clampWhenFinished = !isLoop;
        let timeScale = isLoop ? 1.0 : 1.08;
        if (name === 'Walk_Loop') {
            timeScale = 1.35;
        } else if (name === 'Sprint_Loop') {
            timeScale = 1.15;
        }
        action.timeScale = timeScale;

        if (this.currentAction) {
            this.currentAction.fadeOut(fadeDuration);
        }
        action.fadeIn(fadeDuration).play();
        this.currentAction = action;

        if (name === 'Yes') {
            showHelloIntroImage();
        }
    }

    onActionFinished(e) {
        const name = e.action.getClip().name;
        if (name === 'Death01') return;

        if (name === 'Sword_Block' && this._introState === 'landing') {
            this._introState = 'handGesture';
            this.playAction('Yes');
        } else if (name === 'Yes' && this._introState === 'handGesture') {
            this._introState = 'done';
            this.playAction('Idle_Loop');
        } else {
            const isLoop = name.endsWith('_Loop') || name === 'Sword_Idle' || name === 'A_TPose';
            if (!isLoop) {
                this.playAction('Idle_Loop');
            }
        }
    }

    update(delta, camera) {
        if (!this.modelLoaded || !this.chassisBody) return;

        // ── Clamp de delta ───────────────────────────────────────────────────
        // Un spike de frame puede hacer que el personaje salte o se “pegue” en
        // un milisegundo si el delta se usa sin límite. Usamos un tope más
        // estricto para mantener el movimiento estable a 60fps sin cambiar la
        // sensación ni la respuesta del control.
        const MAX_DELTA = 0.033; // ~1 frame a 30fps / 2 frames a 60fps
        const stableDelta = Math.min(delta, MAX_DELTA);

        if (this.mixer) this.mixer.update(delta);
        delta = stableDelta;

        // Detect landing to start the entry animation sequence
        if (this._introState === 'falling' && this.isGrounded) {
            this._introState = 'landing';
            this.playAction('Sword_Block');
        }

        const translation = this.chassisBody.translation();
        const rotation    = this.chassisBody.rotation();
        this._tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);

        // ── Camera-relative movement ────────────────────────────────────────────────────────
        this._moveDir.set(0, 0, 0);

        if (this.controlsEnabled) {
            // Reusing instance vectors instead of creating new ones
            // every frame (that was the cause of the stutter/lag).
            this._forwardVec.set(0, 0, -1);
            this._rightVec.set(1, 0, 0);

            if (camera) {
                this._camForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
                this._camForward.y = 0;
                this._camForward.normalize();

                this._camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
                this._camRight.y = 0;
                this._camRight.normalize();

                this._forwardVec.copy(this._camForward);
                this._rightVec.copy(this._camRight);
            }

            const fInput = this.forwardInput || 0;
            const sInput = this.sideInput || 0;

            if (fInput !== 0 || sInput !== 0) {
                this._moveDir.addScaledVector(this._forwardVec, fInput);
                this._moveDir.addScaledVector(this._rightVec, sInput);
                this._moveDir.normalize();

                this._targetMoveSpeed = this.sprintInput ? this.runSpeed : this.walkSpeed;
                this._currentMoveSpeed += (this._targetMoveSpeed - this._currentMoveSpeed) * Math.min(1, delta * 18.0);
                this._moveDir.multiplyScalar(this._currentMoveSpeed * delta);

                // Immediately rotate toward the movement direction with fast response
                const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z);
                this._targetQuat.setFromAxisAngle(this._yAxis, targetAngle);

                const turnRate = Math.min(1, delta * 18.0);
                this._tmpQuat.slerp(this._targetQuat, turnRate);

                this.chassisBody.setNextKinematicRotation({
                    x: this._tmpQuat.x,
                    y: this._tmpQuat.y,
                    z: this._tmpQuat.z,
                    w: this._tmpQuat.w
                });

                if (this.sprintInput) {
                    this.playAction('Sprint_Loop');
                } else {
                    this.playAction('Walk_Loop');
                }
            } else {
                this._targetMoveSpeed = 0;
                this._currentMoveSpeed += (0 - this._currentMoveSpeed) * Math.min(1, delta * 16.0);
                const currentClip = this.currentAction ? this.currentAction.getClip().name : null;
                if (currentClip === 'Walk_Loop' || currentClip === 'Sprint_Loop') {
                    this.playAction('Idle_Loop');
                }
            }

            // Procedural footstep audio playback (walk vs run)
            const isMoving = (fInput !== 0 || sInput !== 0);

            if (isMoving && this.isGrounded) {
                this._stepTimer += delta;
                const stepInterval = this.sprintInput ? 0.25 : 0.42;
                if (this._stepTimer >= stepInterval) {
                    this._stepTimer = 0;
                    if (this.sprintInput) {
                        this.proceduralSound?.playRunStep();
                    } else {
                        this.proceduralSound?.playWalkStep();
                    }
                }
            } else {
                this._stepTimer = 0.38;
            }
        }

        const wasGrounded = this.isGrounded;

        // ── Gravedad & salto ────────────────────────────────────────────────
        this.verticalVelocity += this.gravity * delta;
        if (this.verticalVelocity < -40) this.verticalVelocity = -40;

        if (this.controlsEnabled && this.jumpInput && this.isGrounded) {
            this.verticalVelocity = this.jumpForce;
            this.isGrounded = false;
            this.playAction('Jump_Loop');
            this.proceduralSound?.playJumpSound();
        }

        // If on the ground and not jumping, don't accumulate large
        // negative vertical velocity: this allows Rapier's snap-to-ground to
        // seguir el terreno en bajadas sin que se sienta un "empujón" hacia
        // abajo en cada frame.
        if (this.isGrounded && this.verticalVelocity < 0) {
            this.verticalVelocity = 0; // 0 para permitir que autostep suba desniveles libremente
        }

        this._gravStep.set(0, this.verticalVelocity * delta, 0);
        this._totalMove.addVectors(this._moveDir, this._gravStep);

        const hasMovement = this._totalMove.lengthSq() > 0.0001 || !this.isGrounded || this.verticalVelocity !== 0;

        // Avoid calling computeColliderMovement() when the character is
        // quieto sobre el suelo y no hay ninguna vel vertical. Eso elimina trabajo
        // innecesario y reduce los micro-stutters sin cambiar el control ni el
        // desplazamiento real del personaje.
        let computed = { x: 0, y: 0, z: 0 };
        if (hasMovement) {
            this.characterController.computeColliderMovement(
                this.chassisCollider,
                { x: this._totalMove.x, y: this._totalMove.y, z: this._totalMove.z }
            );
            computed = this.characterController.computedMovement();
        }

        const nextPos = {
            x: translation.x + computed.x,
            y: translation.y + computed.y,
            z: translation.z + computed.z
        };

        this.chassisBody.setNextKinematicTranslation(nextPos);

        // Grounded real que reporta Rapier (autostep + snap incluidos), en vez
        // del cálculo casero anterior basado en un umbral aproximado.
        this.isGrounded = this.characterController.computedGrounded();
        if (this.isGrounded && this.verticalVelocity < 0) {
            this.verticalVelocity = 0;
        }

        // Landing detection after a jump
        if (!wasGrounded && this.isGrounded) {
            this.proceduralSound?.playLandSound();
        }

        // ── Sincronizar mesh visual ───────────────────────────────────────────
        const capsuleBottomY = nextPos.y - (this._capsuleHalfHeight + this._capsuleRadius);
        const targetMeshY = capsuleBottomY - (this._feetOffsetY || 0);
        this.characterMesh.position.set(nextPos.x, targetMeshY, nextPos.z);
        this.characterMesh.quaternion.copy(this._tmpQuat);
    }
}