import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ProceduralSound } from './ProceduralSound.js';
import helvetikerBoldFont from 'three/examples/fonts/helvetiker_bold.typeface.json';

export class WorldText {
    constructor(scene, camera, physicsWorld = null) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        this.proceduralSound = new ProceduralSound();

        this.letterMeshes = [];
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        this.position = new THREE.Vector3(-418.58, 1.88, -137.19);
        this.floorY = 1.85;
        this.startPos = this.position.clone();
        this.endPos   = new THREE.Vector3(-419.36, 1.82, -273.43);

        this.textString = "JESUSDEV.CO";

        // Binds
        this._onPointerDown = this._onPointerDown.bind(this);
        window.addEventListener('pointerdown', this._onPointerDown);

        // Parse local font
        try {
            this.font = new FontLoader().parse(helvetikerBoldFont);
            this.createText();
        } catch (err) {
            console.error('[WorldText] Error parsing helvetiker font:', err);
        }
    }

    createText() {
        // Clean minimal material, no intense emission
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x000000,
            emissiveIntensity: 0,
            roughness: 0.25,
            metalness: 0.15
        });

        // Text options: much larger letters (size 12.0) and greater depth
        const textOptions = {
            font: this.font,
            size: 10.5,          // Slightly smaller to fit closer together
            depth: 1.4,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.22,
            bevelSize: 0.11,
            bevelOffset: 0,
            bevelSegments: 3
        };

        const letterData = [];
        let totalCharsWidth = 0;

        for (let i = 0; i < this.textString.length; i++) {
            const char = this.textString[i];
            if (char === ' ') {
                totalCharsWidth += 3;
                continue;
            }

            const geometry = new TextGeometry(char, textOptions);
            geometry.computeBoundingBox();
            geometry.center();

            const width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
            letterData.push({
                char: char,
                geometry: geometry,
                width: width
            });
            totalCharsWidth += width;
        }

        // Alignment vector
        const segmentVec = new THREE.Vector3().subVectors(this.endPos, this.startPos);
        const segmentLength = segmentVec.length();

        // Calculate automatic spacing
        const numLetters = letterData.length;
        const kern = 0; // Positions now define natural tight spacing
        const spacing = (segmentLength - totalCharsWidth) / Math.max(1, numLetters - 1) + kern;
        const angle = Math.atan2(segmentVec.z, segmentVec.x);

        let accumulatedDist = 0;

        for (let i = 0; i < letterData.length; i++) {
            const data = letterData[i];
            const mesh = new THREE.Mesh(data.geometry, material);

            const distOnSegment = accumulatedDist + data.width / 2;
            const t = distOnSegment / segmentLength;

            // Get the real bounding box to calculate the height above ground
            const size = new THREE.Vector3();
            data.geometry.boundingBox.getSize(size);
            const halfX = size.x / 2;
            const halfY = size.y / 2;
            const halfZ = size.z / 2;

            // Position flush with the ground: Y = floorY + halfY
            const pos = new THREE.Vector3().lerpVectors(this.startPos, this.endPos, t);
            pos.y = this.floorY + halfY + 0.1; // Adjustment to rest exactly on the surface

            mesh.position.copy(pos);
            mesh.rotation.y = -angle;

            // --- DYNAMIC RAPIER PHYSICS ---
            // Start as a dynamic body so it falls and rolls from physical collisions
            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
                .setLinearDamping(0.05)  // Normal fast fall
                .setAngularDamping(0.1); // Smooth physical rotation

            const body = this.physicsWorld.createRigidBody(bodyDesc);

            const colliderDesc = RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
                .setRestitution(0.4) // Lower bounce for heavy feel
                .setFriction(0.6);

            this.physicsWorld.createCollider(colliderDesc, body);

            // Store references
            mesh.userData = {
                body: body,
                initialPos: pos.clone(),
                initialRot: mesh.quaternion.clone(),
                char: data.char,
                halfY: halfY
            };

            this.scene.add(mesh);
            this.letterMeshes.push(mesh);

            accumulatedDist += data.width + spacing;
        }

        console.log(`[WorldText] Created ${this.letterMeshes.length} giant dynamic letters.`);
    }

    _onPointerDown(event) {
        if (event.isPrimary === false) return;

        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, this.camera);
        const intersects = this._raycaster.intersectObjects(this.letterMeshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const body = clickedMesh.userData.body;

            if (body) {
                // Impulse and torque on click
                const fx = (Math.random() - 0.5) * 25.0;
                const fy = 35.0 + Math.random() * 15.0;
                const fz = (Math.random() - 0.5) * 25.0;
                body.applyImpulse({ x: fx, y: fy, z: fz }, true);

                const tx = (Math.random() - 0.5) * 8.0;
                const ty = (Math.random() - 0.5) * 8.0;
                const tz = (Math.random() - 0.5) * 8.0;
                body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);

                // Set initial downward speed indicator so next ground impact fires sound
                clickedMesh.userData.prevVelY = -6.0;
            }
        }
    }

    update(delta) {
        if (!this.letterMeshes.length) return;

        const now = performance.now();
        const cam = this.camera || this.scene?.userData?.camera;

        // Sync Three.js visual meshes with Rapier rigid bodies & detect ground impacts
        for (let i = 0; i < this.letterMeshes.length; i++) {
            const mesh = this.letterMeshes[i];
            const body = mesh.userData.body;
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

                // Impact occurs if falling and close to ground level
                if (deltaY <= 0.35 && (prevVelY < -0.8 || (prevY > groundY + 0.15 && currentY <= groundY + 0.2))) {
                    if (now - mesh.userData.lastImpactTime > 100) {
                        mesh.userData.lastImpactTime = now;

                        const impactSpeed = Math.abs(prevVelY < -0.1 ? prevVelY : currentVelY);
                        const intensity = Math.min(Math.max(impactSpeed / 8.0, 0.25), 1.0);
                        const charCode = (mesh.userData.char || 'A').charCodeAt(0);
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
            mesh.material.dispose();

            if (mesh.userData.body) {
                this.physicsWorld.removeRigidBody(mesh.userData.body);
            }
        }
        this.letterMeshes = [];
    }
}
