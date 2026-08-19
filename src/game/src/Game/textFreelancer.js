import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ProceduralSound } from './ProceduralSound.js';
import helvetikerBoldFont from 'three/examples/fonts/helvetiker_bold.typeface.json';

/**
 * TextFreelancer
 *
 * Optimized 3D module for the word "FREELANCER" at ground level with dynamic Rapier physics
 * and a lightweight mathematical physics fallback engine.
 * Extracted from the HTML prototype and integrated smoothly and lightly.
 */
export class TextFreelancer {
    constructor(scene, camera, physicsWorld = null, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        this.proceduralSound = new ProceduralSound();

        this.textString = options.text || 'FREELANCER';
        this.fontSize = options.fontSize ?? 10.0;
        this.fontDepth = options.fontDepth ?? 1.4;
        this.floorY = options.floorY ?? 1.76;
        this.position = options.position
            ? new THREE.Vector3(options.position.x, options.position.y, options.position.z)
            : new THREE.Vector3(-159.69, 1.76, 98.07);

        this.letterMeshes = [];
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        this._onPointerDown = this._onPointerDown.bind(this);
        window.addEventListener('pointerdown', this._onPointerDown);

        try {
            this.font = new FontLoader().parse(helvetikerBoldFont);
            this.createText();
        } catch (err) {
            console.error('[textFreelancer] Error parsing font:', err);
        }
    }

    createText() {
        // Clean shared material for maximum rendering performance
        const material = new THREE.MeshStandardMaterial({
            color: 0xffca3a,
            emissive: 0x000000,
            emissiveIntensity: 0,
            roughness: 0.35,
            metalness: 0.15
        });

        // Ultra-optimized geometry (curveSegments: 5, bevelSegments: 2 to reduce vertex consumption)
        const textOptions = {
            font: this.font,
            size: this.fontSize,
            depth: this.fontDepth,
            curveSegments: 5,
            bevelEnabled: true,
            bevelThickness: 0.12,
            bevelSize: 0.06,
            bevelOffset: 0,
            bevelSegments: 2
        };

        const letterData = [];
        let totalWidth = 0;
        const letterSpacing = this.fontSize * 0.15;
        const spaceWidth = this.fontSize * 0.45;

        for (let i = 0; i < this.textString.length; i++) {
            const char = this.textString[i];
            if (char === ' ') {
                letterData.push({ isSpace: true, width: spaceWidth });
                totalWidth += spaceWidth;
                continue;
            }

            const geometry = new TextGeometry(char, textOptions);
            geometry.computeBoundingBox();
            geometry.center();

            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);

            letterData.push({
                isSpace: false,
                char,
                geometry,
                size,
                width: size.x,
                height: size.y,
                depth: size.z
            });

            totalWidth += size.x;
            if (i < this.textString.length - 1) {
                totalWidth += letterSpacing;
            }
        }

        // Continuous horizontal positioning (along the given position)
        let currentX = this.position.x - totalWidth / 2;

        for (let i = 0; i < letterData.length; i++) {
            const item = letterData[i];
            if (item.isSpace) {
                currentX += item.width;
                continue;
            }

            const mesh = new THREE.Mesh(item.geometry, material);

            const halfX = item.width / 2;
            const halfY = item.height / 2;
            const halfZ = item.depth / 2;

            const posX = currentX + halfX;
            const posY = this.floorY + halfY + 0.1;
            const posZ = this.position.z;

            mesh.position.set(posX, posY, posZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Dynamic Rapier physics
            let body = null;
            if (this.physicsWorld) {
                const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(posX, posY, posZ)
                    .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
                    .setLinearDamping(0.05)
                    .setAngularDamping(0.1);

                body = this.physicsWorld.createRigidBody(bodyDesc);

                const colliderDesc = RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
                    .setRestitution(0.5)
                    .setFriction(0.6);

                this.physicsWorld.createCollider(colliderDesc, body);
            }

            mesh.userData = {
                body,
                initialPos: new THREE.Vector3(posX, posY, posZ),
                initialRot: mesh.quaternion.clone(),
                velocity: new THREE.Vector3(0, 0, 0),
                angularVelocity: new THREE.Vector3(0, 0, 0),
                radius: halfY,
                halfX,
                halfY,
                halfZ,
                char: item.char
            };

            this.scene.add(mesh);
            this.letterMeshes.push(mesh);

            currentX += item.width + letterSpacing;
        }
    }

    _onPointerDown(event) {
        if (event.isPrimary === false) return;

        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const cam = this.camera || this.scene.userData?.camera;
        if (!cam) return;

        this._raycaster.setFromCamera(this._mouse, cam);
        const intersects = this._raycaster.intersectObjects(this.letterMeshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const body = clickedMesh.userData?.body;

            if (body) {
                // Dynamic Rapier physics impulse and torque
                const fx = (Math.random() - 0.5) * 25.0;
                const fy = 35.0 + Math.random() * 15.0;
                const fz = (Math.random() - 0.5) * 25.0;
                body.applyImpulse({ x: fx, y: fy, z: fz }, true);

                const tx = (Math.random() - 0.5) * 15.0;
                const ty = (Math.random() - 0.5) * 15.0;
                const tz = (Math.random() - 0.5) * 15.0;
                body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);

                clickedMesh.userData.prevVelY = -6.0;
            } else if (clickedMesh.userData) {
                // Pure mathematical physics fallback
                const phys = clickedMesh.userData;
                phys.velocity.y = 8 + Math.random() * 5;
                phys.velocity.x = (Math.random() - 0.5) * 10;
                phys.velocity.z = (Math.random() - 0.5) * 15;
                phys.angularVelocity.set(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15
                );
            }

            // Feedback visual parpadeo blanco
            if (clickedMesh.material) {
                const origColor = clickedMesh.material.color.getHex();
                clickedMesh.material = clickedMesh.material.clone();
                clickedMesh.material.color.setHex(0xffffff);
                setTimeout(() => {
                    clickedMesh.material.color.setHex(origColor);
                }, 150);
            }
        }
    }

    update(delta) {
        if (!this.letterMeshes.length) return;

        const GRAVITY = 25.0;
        const BOUNCE_RESTITUTION = 0.5;
        const FRICTION = 0.9;
        const ANGULAR_DAMPING = 0.95;

        const now = performance.now();
        const cam = this.camera || this.scene?.userData?.camera;

        for (let i = 0; i < this.letterMeshes.length; i++) {
            const mesh = this.letterMeshes[i];
            const body = mesh.userData?.body;

            if (body) {
                const translation = body.translation();
                const rotation = body.rotation();
                const linvel = body.linvel();

                mesh.position.set(translation.x, translation.y, translation.z);
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

                // Ground impact detection
                const halfY = mesh.userData.halfY || 5.0;
                const groundY = this.floorY + halfY;
                const currentY = translation.y;
                const currentVelY = linvel.y;

                if (mesh.userData.prevY === undefined) {
                    mesh.userData.prevY = currentY;
                    mesh.userData.prevVelY = currentVelY;
                    mesh.userData.lastImpactTime = 0;
                }

                const prevVelY = mesh.userData.prevVelY;
                const prevY = mesh.userData.prevY;
                const deltaY = currentY - groundY;

                if (deltaY <= 0.35 && (prevVelY < -0.8 || (prevY > groundY + 0.15 && currentY <= groundY + 0.2))) {
                    if (now - mesh.userData.lastImpactTime > 100) {
                        mesh.userData.lastImpactTime = now;

                        const impactSpeed = Math.abs(prevVelY < -0.1 ? prevVelY : currentVelY);
                        const intensity = Math.min(Math.max(impactSpeed / 8.0, 0.25), 1.0);
                        const charCode = (mesh.userData.char || 'F').charCodeAt(0);
                        const pitchMod = 0.85 + (charCode % 7) * 0.05;

                        const dist = cam ? cam.position.distanceTo(mesh.position) : 0;
                        const distFactor = Math.max(0, 1 - dist / 350);

                        if (distFactor > 0.02) {
                            this.proceduralSound.playLetterImpactSound(intensity * distFactor, pitchMod);
                        }
                    }
                }

                mesh.userData.prevY = currentY;
                mesh.userData.prevVelY = currentVelY;

            } else if (mesh.userData) {
                // Integrated mathematical fallback physics
                const phys = mesh.userData;
                const dt = Math.min(delta, 0.1);

                phys.velocity.y -= GRAVITY * dt;

                mesh.position.x += phys.velocity.x * dt;
                mesh.position.y += phys.velocity.y * dt;
                mesh.position.z += phys.velocity.z * dt;

                mesh.rotation.x += phys.angularVelocity.x * dt;
                mesh.rotation.y += phys.angularVelocity.y * dt;
                mesh.rotation.z += phys.angularVelocity.z * dt;

                const groundLevel = this.floorY + phys.halfY;
                if (mesh.position.y < groundLevel) {
                    const impactSpeed = Math.abs(phys.velocity.y);
                    if (impactSpeed > 0.8 && (now - (phys.lastImpactTime || 0) > 100)) {
                        phys.lastImpactTime = now;
                        const intensity = Math.min(Math.max(impactSpeed / 8.0, 0.25), 1.0);
                        const charCode = (phys.char || 'F').charCodeAt(0);
                        const pitchMod = 0.85 + (charCode % 7) * 0.05;
                        const dist = cam ? cam.position.distanceTo(mesh.position) : 0;
                        const distFactor = Math.max(0, 1 - dist / 350);

                        if (distFactor > 0.02) {
                            this.proceduralSound.playLetterImpactSound(intensity * distFactor, pitchMod);
                        }
                    }

                    mesh.position.y = groundLevel;
                    phys.velocity.y = Math.abs(phys.velocity.y) * BOUNCE_RESTITUTION;
                    phys.velocity.x *= FRICTION;
                    phys.velocity.z *= FRICTION;
                    phys.angularVelocity.multiplyScalar(ANGULAR_DAMPING);

                    if (Math.abs(phys.velocity.y) < 0.5) phys.velocity.y = 0;
                    if (phys.angularVelocity.length() < 0.1) phys.angularVelocity.set(0, 0, 0);
                }
            }
        }
    }

    destroy() {
        window.removeEventListener('pointerdown', this._onPointerDown);

        for (const mesh of this.letterMeshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.letterMeshes = [];
    }
}
