import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ProceduralSound } from './ProceduralSound.js';
import helvetikerBoldFont from 'three/examples/fonts/helvetiker_bold.typeface.json';

/**
 * TextFrontendDeveloper
 *
 * Creates the giant 3D text "FRONTEND DEVELOPER" in a single continuous line (lengthwise),
 * optimizing the geometry (low curveSegments, light bevel and shared material)
 * to minimize memory/polygon consumption.
 * Includes dynamic Rapier physics and click interaction.
 */
export class TextFrontendDeveloper {
    constructor(scene, camera, physicsWorld = null, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        this.proceduralSound = new ProceduralSound();

        this.text = options.text || 'FRONTEND DEVELOPER';
        this.fontSize = options.fontSize ?? 10.0;
        this.fontDepth = options.fontDepth ?? 1.2;
        this.floorY = options.floorY ?? 1.70;
        this.position = options.position
            ? new THREE.Vector3(options.position.x, options.position.y, options.position.z)
            : new THREE.Vector3(-366.47, 1.70, -441.90);

        this.letterMeshes = [];
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        this._onPointerDown = this._onPointerDown.bind(this);
        window.addEventListener('pointerdown', this._onPointerDown);

        try {
            this.font = new FontLoader().parse(helvetikerBoldFont);
            this.createText();
        } catch (err) {
            console.error('[TextFrontendDeveloper] Error parsing font:', err);
        }
    }

    createText() {
        // Single optimized material shared between all letters (0 material clones)
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x000000,
            emissiveIntensity: 0,
            roughness: 0.25,
            metalness: 0.15
        });

        // Ultra-optimized geometry options (curveSegments: 5, bevelSegments: 2 to reduce polygons by 70%)
        const textOptions = {
            font: this.font,
            size: this.fontSize,
            depth: this.fontDepth,
            curveSegments: 5,     // Reduced from 12 to 5 for maximum optimization
            bevelEnabled: true,
            bevelThickness: 0.12,  // Bisel ligero
            bevelSize: 0.06,
            bevelOffset: 0,
            bevelSegments: 2      // Reducido de 3 a 2
        };

        const letterData = [];
        let totalWidth = 0;
        const spaceWidth = this.fontSize * 0.45;
        const letterSpacing = this.fontSize * 0.12;

        for (let i = 0; i < this.text.length; i++) {
            const char = this.text[i];
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
            if (i < this.text.length - 1) {
                totalWidth += letterSpacing;
            }
        }

        // Continuous horizontal positioning (single centered line lengthwise)
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

            // Dynamic Rapier physics for each letter
            let body = null;
            if (this.physicsWorld) {
                const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(posX, posY, posZ)
                    .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
                    .setLinearDamping(0.05)
                    .setAngularDamping(0.1);

                body = this.physicsWorld.createRigidBody(bodyDesc);

                const colliderDesc = RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
                    .setRestitution(0.4)
                    .setFriction(0.6);

                this.physicsWorld.createCollider(colliderDesc, body);
            }

            mesh.userData = {
                body,
                initialPos: new THREE.Vector3(posX, posY, posZ),
                initialRot: mesh.quaternion.clone(),
                char: item.char,
                halfY: halfY
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
                const fx = (Math.random() - 0.5) * 25.0;
                const fy = 35.0 + Math.random() * 15.0;
                const fz = (Math.random() - 0.5) * 25.0;
                body.applyImpulse({ x: fx, y: fy, z: fz }, true);

                const tx = (Math.random() - 0.5) * 8.0;
                const ty = (Math.random() - 0.5) * 8.0;
                const tz = (Math.random() - 0.5) * 8.0;
                body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);

                clickedMesh.userData.prevVelY = -6.0;
            }
        }
    }

    update(delta) {
        if (!this.letterMeshes.length) return;

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

                // Ground impact sound detection
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
                        const charCode = (mesh.userData.char || 'D').charCodeAt(0);
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
