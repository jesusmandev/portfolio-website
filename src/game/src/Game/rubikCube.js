import * as THREE from 'three';

export class RubikCubeInteraction {
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = options.physicsWorld || null;

        // Position of the Monumental 15-meter Cube
        this.cubePosition = new THREE.Vector3(
            options.x ?? 140.60,
            options.y ?? 0.20,
            options.z ?? -269.93
        );

        this.isPlaying = false;

        // Giant Cube Group
        this.cubeGroup = new THREE.Group();
        this.cubeGroup.position.copy(this.cubePosition);
        this.scene.add(this.cubeGroup);

        // Cube 3D engine state
        this.cubies = [];
        this.moveQueue = [];
        this.isAnimating = false;

        // Mouse drag
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isDragging = false;
        this.activeCubie = null;
        this.clickNormal = new THREE.Vector3();
        this.startMouseX = 0;
        this.startMouseY = 0;

        // Focus camera for the 15m Giant Cube
        this.targetCamPos = new THREE.Vector3(this.cubePosition.x, 16.0, this.cubePosition.z + 42);
        this.targetCamLookAt = new THREE.Vector3(this.cubePosition.x, 16.0, this.cubePosition.z);

        this.rotationGroup = this.generateRotationGroup();
        this._buildGiantRubikCube();
        this._bindEvents();
    }

    generateRotationGroup() {
        const half = Math.PI / 2;
        const gens = [
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), half),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), half),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), half)
        ];
        const group = [new THREE.Quaternion()];
        let frontier = [group[0]];
        while (frontier.length > 0) {
            const next = [];
            for (const q of frontier) {
                for (const g of gens) {
                    const nq = q.clone().multiply(g);
                    if (!this.quatInGroup(group, nq)) {
                        group.push(nq);
                        next.push(nq);
                    }
                }
            }
            frontier = next;
        }
        return group;
    }

    quatInGroup(list, q) {
        for (const item of list) {
            if (Math.abs(item.dot(q)) > 0.9999) return true;
        }
        return false;
    }

    snapQuaternion(q) {
        let best = this.rotationGroup[0];
        let bestDot = -Infinity;
        for (const item of this.rotationGroup) {
            const d = Math.abs(item.dot(q));
            if (d > bestDot) {
                bestDot = d;
                best = item;
            }
        }
        return best.clone();
    }

    // ─────────────────────────────────────────────────────────────────
    //  MONUMENTAL 15-METER CUBE (X: 140.60, Y: 0.20, Z: -269.93)
    // ─────────────────────────────────────────────────────────────────
    _buildGiantRubikCube() {
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
        const cyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x00b4db, emissive: 0x0083b0, emissiveIntensity: 0.8, roughness: 0.2 });
        const padMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

        // Clean ground circle without grass (~18 meters radius)
        const padGeo = new THREE.CircleGeometry(18.0, 40);
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.y = 0.02;
        padMesh.receiveShadow = true;
        this.cubeGroup.add(padMesh);

        // 15-meter base pedestal
        const baseGeo = new THREE.CylinderGeometry(12.0, 15.0, 1.2, 40);
        const baseMesh = new THREE.Mesh(baseGeo, metalMat);
        baseMesh.position.y = 0.6;
        baseMesh.receiveShadow = true;
        this.cubeGroup.add(baseMesh);

        // Giant glowing neon ring
        const ringGeo = new THREE.TorusGeometry(12.4, 0.25, 16, 48);
        const ringMesh = new THREE.Mesh(ringGeo, cyanGlowMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 1.21;
        this.cubeGroup.add(ringMesh);

        // Main group for the 15-meter tall Cube
        this.rubikGroup = new THREE.Group();
        this.rubikGroup.position.set(0, 16.0, 0);
        this.rubikGroup.scale.setScalar(5.0); // 3m local * 5.0 = ~15 METERS TALL
        this.cubeGroup.add(this.rubikGroup);

        // Layer rotation pivot
        this.pivot = new THREE.Group();
        this.rubikGroup.add(this.pivot);

        const colors = {
            right: 0xff0000,
            left: 0xff8800,
            top: 0xffffff,
            bottom: 0xffff00,
            front: 0x00ff00,
            back: 0x0000ff
        };

        const blackMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

        const cubeSize = 0.95;
        const spacing = 1.0;
        const offset = (3 - 1) * spacing / 2;

        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    const materials = [
                        blackMaterial, blackMaterial,
                        blackMaterial, blackMaterial,
                        blackMaterial, blackMaterial
                    ];

                    if (x === 2) materials[0] = new THREE.MeshLambertMaterial({ color: colors.right });
                    if (x === 0) materials[1] = new THREE.MeshLambertMaterial({ color: colors.left });
                    if (y === 2) materials[2] = new THREE.MeshLambertMaterial({ color: colors.top });
                    if (y === 0) materials[3] = new THREE.MeshLambertMaterial({ color: colors.bottom });
                    if (z === 2) materials[4] = new THREE.MeshLambertMaterial({ color: colors.front });
                    if (z === 0) materials[5] = new THREE.MeshLambertMaterial({ color: colors.back });

                    const cubie = new THREE.Mesh(geometry, materials);

                    cubie.position.x = (x * spacing) - offset;
                    cubie.position.y = (y * spacing) - offset;
                    cubie.position.z = (z * spacing) - offset;

                    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
                    cubie.add(edges);

                    this.rubikGroup.add(cubie);
                    this.cubies.push(cubie);
                }
            }
        }
    }

    _bindEvents() {
        this._onKeyDown = (e) => {
            if (this.isPlaying) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.endPlay();
                    return;
                }

                if (e.ctrlKey || e.altKey || e.metaKey) return;
                const key = e.key.toLowerCase();
                const validKeys = ['u', 'd', 'r', 'l', 'f', 'b', 'm', 'e', 's'];

                if (validKeys.includes(key)) {
                    e.preventDefault();
                    const isPrime = (e.key === e.key.toUpperCase() && e.key !== e.key.toLowerCase()) || e.shiftKey;

                    let axis, layerIndex, direction;
                    const dirVal = isPrime ? 1 : -1;

                    switch (key) {
                        case 'r': axis = 'x'; layerIndex = 1; direction = dirVal; break;
                        case 'l': axis = 'x'; layerIndex = -1; direction = -dirVal; break;
                        case 'u': axis = 'y'; layerIndex = 1; direction = dirVal; break;
                        case 'd': axis = 'y'; layerIndex = -1; direction = -dirVal; break;
                        case 'f': axis = 'z'; layerIndex = 1; direction = dirVal; break;
                        case 'b': axis = 'z'; layerIndex = -1; direction = -dirVal; break;
                        case 'm': axis = 'x'; layerIndex = 0;  direction = -dirVal; break;
                        case 'e': axis = 'y'; layerIndex = 0;  direction = -dirVal; break;
                        case 's': axis = 'z'; layerIndex = 0;  direction = dirVal;  break;
                    }

                    this.queueMove(axis, layerIndex, direction, 10);
                }
            }
        };

        this._onPointerDown = (e) => {
            if (!this.isPlaying || this.isAnimating || this.moveQueue.length > 0) return;

            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.cubies);

            if (intersects.length > 0) {
                this.isDragging = true;
                this.activeCubie = intersects[0].object;

                const n = intersects[0].face.normal.clone();
                const rotMatrix = new THREE.Matrix4().extractRotation(this.activeCubie.matrixWorld);
                n.applyMatrix4(rotMatrix).round();
                this.clickNormal.copy(n);

                this.startMouseX = e.clientX;
                this.startMouseY = e.clientY;
            }
        };

        this._onPointerMove = (e) => {
            if (!this.isDragging || !this.activeCubie || this.isAnimating) return;

            const dx = e.clientX - this.startMouseX;
            const dy = e.clientY - this.startMouseY;

            if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                this.isDragging = false;
                this.determineAndExecuteMove(dx, dy);
            }
        };

        this._onPointerUp = () => {
            this.isDragging = false;
            this.activeCubie = null;
        };

        this._onShuffle = () => this.shuffleCube();
        this._onEnterPlay = () => this.startPlay();
        this._onExitPlay = () => this.endPlay();

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('rubik:shuffle', this._onShuffle);
        window.addEventListener('rubik:enter-play', this._onEnterPlay);
        window.addEventListener('rubik:exit', this._onExitPlay);
    }

    determineAndExecuteMove(dx, dy) {
        let axisToRotate;
        let direction = 1;

        if (Math.abs(this.clickNormal.x) > 0.5) {
            axisToRotate = Math.abs(dx) > Math.abs(dy) ? 'z' : 'y';
            direction = Math.sign(this.clickNormal.x) * (axisToRotate === 'z' ? Math.sign(-dx) : Math.sign(-dy));
        } else if (Math.abs(this.clickNormal.y) > 0.5) {
            axisToRotate = Math.abs(dx) > Math.abs(dy) ? 'z' : 'x';
            direction = Math.sign(this.clickNormal.y) * (axisToRotate === 'z' ? Math.sign(dx) : Math.sign(-dy));
        } else {
            axisToRotate = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            direction = Math.sign(this.clickNormal.z) * (axisToRotate === 'x' ? Math.sign(dx) : Math.sign(-dy));
        }

        const layerIndex = Math.round(this.activeCubie.position[axisToRotate]);
        this.queueMove(axisToRotate, layerIndex, direction, 15);
    }

    queueMove(axis, layerIndex, direction, speedFrames) {
        this.moveQueue.push({ axis, layerIndex, direction, speedFrames });
        this.processQueue();
    }

    processQueue() {
        if (this.isAnimating || this.moveQueue.length === 0) return;
        const move = this.moveQueue.shift();
        this.executeMove(move.axis, move.layerIndex, move.direction, move.speedFrames);
    }

    executeMove(axis, layerIndex, direction, speedFrames) {
        this.isAnimating = true;

        const layerCubies = this.cubies.filter(c => Math.abs(Math.round(c.position[axis]) - layerIndex) < 0.1);
        layerCubies.forEach(c => this.pivot.attach(c));

        const targetAngle = direction * Math.PI / 2;
        let currentAngle = 0;
        const step = targetAngle / speedFrames;

        const animateSlice = () => {
            if (Math.abs(currentAngle) < Math.abs(targetAngle)) {
                this.pivot.rotation[axis] += step;
                currentAngle += step;
                requestAnimationFrame(animateSlice);
            } else {
                this.pivot.rotation[axis] = targetAngle;
                this.pivot.updateMatrixWorld();

                layerCubies.forEach(c => {
                    this.rubikGroup.attach(c);
                    c.position.x = Math.round(c.position.x);
                    c.position.y = Math.round(c.position.y);
                    c.position.z = Math.round(c.position.z);
                    c.quaternion.copy(this.snapQuaternion(c.quaternion));
                });

                this.pivot.rotation.set(0, 0, 0);
                this.isAnimating = false;
                this.processQueue();
            }
        };
        animateSlice();
    }

    shuffleCube() {
        if (this.isAnimating && this.moveQueue.length > 0) return;

        const axes = ['x', 'y', 'z'];
        const indices = [-1, 1];
        const dirs = [-1, 1];

        for (let i = 0; i < 45; i++) {
            const axis = axes[Math.floor(Math.random() * axes.length)];
            const index = indices[Math.floor(Math.random() * indices.length)];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            this.queueMove(axis, index, dir, 2);
        }
    }

    startPlay() {
        this.isPlaying = true;
        window.dispatchEvent(new CustomEvent('projects:board', { detail: { open: true } }));
        window.dispatchEvent(new CustomEvent('rubik:play-start'));
    }

    endPlay() {
        this.isPlaying = false;
        window.dispatchEvent(new CustomEvent('projects:board', { detail: { open: false } }));
        window.dispatchEvent(new CustomEvent('rubik:play-end'));
    }

    /**
     * Call in update loop
     */
    update(playerPos) {
        // Slow rotation of giant cube when NOT playing
        if (!this.isPlaying && this.rubikGroup) {
            this.rubikGroup.rotation.y += 0.005;
            this.rubikGroup.rotation.x += 0.002;
        }

        // Live focus camera toward the Giant Cube when playing
        if (this.isPlaying && this.camera) {
            this.camera.position.lerp(this.targetCamPos, 0.08);
            this.camera.lookAt(this.targetCamLookAt);
        }
    }
}
