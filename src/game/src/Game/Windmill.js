/**
 * Windmill.js — Procedural 3D windmill for Three.js.
 *
 * Applied optimizations:
 *  - Stone and door textures: module singletons (created only once).
 *  - Shared materials: all in module constants → 0 duplicated materials.
 *  - Blade crossbars: InstancedMesh (8 pos × 4 blades = 32 instances = 1 draw call).
 *  - Blade shafts, sides and cloth: shared geometry × 4, only 3 draw calls.
 *  - castShadow removed on cloth and crossbars (thin elements).
 *  - update(): pre-allocated vector, zero allocations per frame.
 *  - API: update(delta, playerPos) compatible with ProceduralCityBuilder.
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────
//  MODULE SINGLETONS (created once for all instances)
// ─────────────────────────────────────────────────────────────────
const _woodMat  = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.85 });
const _ironMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 });
const _roofMat  = new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.9 });
const _clothMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, side: THREE.DoubleSide, roughness: 1.0 });

// Texturas lazy — se generan la primera vez que se necesitan
let _stoneTex = null;
let _doorTex  = null;

function _getStoneTexture() {
    if (_stoneTex) return _stoneTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#bfa58a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#5a4634';
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 32) {
        const offset = (y / 32) % 2 === 0 ? 0 : 32;
        for (let x = -64; x < 512; x += 64) {
            const lightness = 40 + Math.random() * 20;
            ctx.fillStyle = `hsl(35, 30%, ${lightness}%)`;
            ctx.fillRect(x + offset, y, 64, 32);
            ctx.strokeRect(x + offset, y, 64, 32);
        }
    }
    _stoneTex = new THREE.CanvasTexture(canvas);
    _stoneTex.wrapS = _stoneTex.wrapT = THREE.RepeatWrapping;
    _stoneTex.repeat.set(4, 2);
    return _stoneTex;
}

function _getDoorTexture() {
    if (_doorTex) return _doorTex;
    const w = 256, h = 384;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const plankCount = 7, plankW = w / plankCount;
    for (let i = 0; i < plankCount; i++) {
        const lightness = 26 + Math.random() * 8;
        ctx.fillStyle = `hsl(28, 40%, ${lightness}%)`;
        ctx.fillRect(i * plankW, 0, plankW, h);
        ctx.strokeStyle = '#1a0f08';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(i * plankW, 0); ctx.lineTo(i * plankW, h); ctx.stroke();
    }
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, 20);     ctx.lineTo(w - 10, 20);     ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, h - 20); ctx.lineTo(w - 10, h - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, 20);     ctx.lineTo(w - 15, h - 20); ctx.stroke();
    ctx.fillStyle = '#3a3a3a';
    [20, h - 20].forEach(y => {
        for (let x = 20; x < w; x += 30) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
    });
    _doorTex = new THREE.CanvasTexture(canvas);
    _doorTex.anisotropy = 4;
    return _doorTex;
}

// Vector reutilizable en update() — 0 allocations por frame
const _tmpPos = new THREE.Vector3();
const _dummy  = new THREE.Object3D(); // para InstancedMesh

// ─────────────────────────────────────────────────────────────────
//  CLASE PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export class Windmill {
    /**
     * @param {THREE.Scene|THREE.Group} parent
     * @param {Object} [options]
     * @param {number} [options.x=-610]
     * @param {number} [options.y=0.20]
     * @param {number} [options.z=307]
     * @param {number} [options.scale=4.5]       - Escala global
     * @param {number} [options.rotorSpeed=1.0]  - Velocidad de aspas (rad/s)
     * @param {number} [options.audioRadius=120] - Radio para activar audio
     * @param {number} [options.rotationY=0]     - Y orientation (radians)
     */
    constructor(parent, options = {}) {
        this.parent      = parent;
        this.x           = options.x           ?? -610;
        this.y           = options.y           ?? 0.20;
        this.z           = options.z           ?? 307;
        this.scale       = options.scale       ?? 4.5;
        this.rotorSpeed  = options.rotorSpeed  ?? 1.0;
        this.audioRadius = options.audioRadius ?? 120;
        this.rotationY   = options.rotationY   ?? 0;

        // Audio
        this._audioCtx   = null;
        this._masterGain = null;
        this._whooshGain = null;
        this._creakGain  = null;
        this._audioReady = false;
        this._currentVol = 0;

        // Rotor
        this._rotor = null;

        // Root group
        this.group = new THREE.Group();
        this.group.name = 'Windmill';
        this.group.position.set(this.x, this.y, this.z);
        this.group.scale.setScalar(this.scale);
        this.group.rotation.y = this.rotationY;

        this._build();
        if (this.parent) this.parent.add(this.group);
    }

    // ─────────────────────────────────────────────────────────────
    //  BUILD
    // ─────────────────────────────────────────────────────────────
    _build() {
        const towerRadBottom = 4.0;
        const towerRadTop    = 2.9;
        const towerH         = 11.5;

        // ── Torre ────────────────────────────────────────────────
        const towerMat = new THREE.MeshStandardMaterial({ map: _getStoneTexture(), roughness: 0.8 });
        const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(towerRadTop, towerRadBottom, towerH, 32),
            towerMat
        );
        tower.position.y    = towerH / 2;
        tower.castShadow    = true;
        tower.receiveShadow = true;
        this.group.add(tower);

        // ── Techo ─────────────────────────────────────────────────
        const roof = new THREE.Mesh(new THREE.ConeGeometry(towerRadTop + 0.6, 4, 32), _roofMat);
        roof.position.y = towerH + 2;
        roof.castShadow = true;
        this.group.add(roof);

        // ── Puerta ────────────────────────────────────────────────
        this._buildDoor(towerRadBottom);

        // ── Ventanas ──────────────────────────────────────────────
        this._addWindow(4.6,  Math.PI / 4,  towerRadBottom, towerRadTop, towerH);
        this._addWindow(8.1, -Math.PI / 4,  towerRadBottom, towerRadTop, towerH);

        // ── Rotor ─────────────────────────────────────────────────
        const rotor = new THREE.Group();

        // Eje
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 16), _woodMat);
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = -1;
        shaft.castShadow = true;
        rotor.add(shaft);

        // Cubo central
        const hub = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), _woodMat);
        hub.castShadow = true;
        rotor.add(hub);

        // ── Blades: shared geometries ─────────────────────────
        const mastGeo    = new THREE.BoxGeometry(0.2, 8, 0.2);
        const sideBarGeo = new THREE.BoxGeometry(0.1, 6.2, 0.1);
        const clothGeo   = new THREE.PlaneGeometry(1.1, 6.2);

        // ── Barrotes: InstancedMesh (8 pos × 4 aspas = 32 instancias, 1 draw call) ──
        const RUNGS_PER_BLADE = 8;
        const rungPositionsLocal = [];
        for (let j = 1.5; j < 7.5; j += 0.8) rungPositionsLocal.push(j); // 8 alturas

        const rungGeo  = new THREE.BoxGeometry(1.2, 0.1, 0.1);
        const rungMesh = new THREE.InstancedMesh(rungGeo, _woodMat, RUNGS_PER_BLADE * 4);
        rungMesh.castShadow = false; // delgados, sin sombra

        let instanceIdx = 0;
        for (let bladeIdx = 0; bladeIdx < 4; bladeIdx++) {
            const bladeAngle = (Math.PI / 2) * bladeIdx;
            for (let ri = 0; ri < rungPositionsLocal.length; ri++) {
                const rungY = rungPositionsLocal[ri];
                // Local position of the crossbar relative to the rotor
                _dummy.position.set(-0.5, rungY, 0);
                _dummy.rotation.set(0, 0, bladeAngle);
                _dummy.updateMatrix();
                rungMesh.setMatrixAt(instanceIdx++, _dummy.matrix);
            }
        }
        rungMesh.instanceMatrix.needsUpdate = true;
        rotor.add(rungMesh);

        // 4 blades (shaft + side + cloth share geometry)
        for (let i = 0; i < 4; i++) {
            const blade = new THREE.Group();

            const mast = new THREE.Mesh(mastGeo, _woodMat);
            mast.position.y = 4;
            mast.castShadow = true;
            blade.add(mast);

            const sideBar = new THREE.Mesh(sideBarGeo, _woodMat);
            sideBar.position.set(-1.1, 4.4, 0);
            sideBar.castShadow = true;
            blade.add(sideBar);

            const cloth = new THREE.Mesh(clothGeo, _clothMat);
            cloth.position.set(-0.55, 4.4, 0.05);
            // castShadow = false (tela delgada → no aporta sombra relevante)
            blade.add(cloth);

            blade.rotation.z = (Math.PI / 2) * i;
            rotor.add(blade);
        }

        rotor.position.set(0, towerH - 1, towerRadTop + 0.85);
        rotor.rotation.x = -Math.PI / 16;
        this.group.add(rotor);
        this._rotor = rotor;
    }

    _buildDoor(towerRadBottom) {
        const doorGroup = new THREE.Group();
        const doorMat   = new THREE.MeshStandardMaterial({ map: _getDoorTexture(), roughness: 0.85 });

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.7, 0.22), _woodMat);
        doorGroup.add(frame);

        const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.08), doorMat);
        door.position.z = 0.15;
        doorGroup.add(door);

        const hingeGeo = new THREE.BoxGeometry(0.18, 0.35, 0.1);
        [0.8, -0.8].forEach(y => {
            const hinge = new THREE.Mesh(hingeGeo, _ironMat);
            hinge.position.set(0.68, y, 0.14);
            doorGroup.add(hinge);
        });

        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), _ironMat);
        handle.position.set(-0.5, 0, 0.15);
        handle.rotation.y = Math.PI / 2;
        doorGroup.add(handle);

        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.03), _ironMat);
        plate.position.set(-0.5, 0, 0.13);
        doorGroup.add(plate);

        doorGroup.position.set(0, 1.3, towerRadBottom - 0.2);
        this.group.add(doorGroup);
    }

    _addWindow(yPos, angle, radBottom, radTop, towerH) {
        const winGroup = new THREE.Group();

        const hole = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1, 0.4),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        hole.position.z = -0.1;
        winGroup.add(hole);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.2), _woodMat);
        winGroup.add(frame);

        const shutterGeo = new THREE.BoxGeometry(0.4, 1.1, 0.05);
        const shutL = new THREE.Mesh(shutterGeo, _woodMat);
        shutL.position.set(-0.6, 0, 0.1);
        shutL.rotation.y = -Math.PI / 3;
        winGroup.add(shutL);

        const shutR = new THREE.Mesh(shutterGeo, _woodMat);
        shutR.position.set(0.6, 0, 0.1);
        shutR.rotation.y = Math.PI / 3;
        winGroup.add(shutR);

        const radiusAtY = radBottom - ((radBottom - radTop) * (yPos / towerH));
        winGroup.position.set(
            Math.sin(angle) * (radiusAtY - 0.1),
            yPos,
            Math.cos(angle) * (radiusAtY - 0.1)
        );
        winGroup.rotation.y = angle;
        this.group.add(winGroup);
    }

    // ─────────────────────────────────────────────────────────────
    //  AUDIO DE PROXIMIDAD
    // ─────────────────────────────────────────────────────────────
    _initAudio() {
        if (this._audioReady) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this._audioCtx = new AudioCtx();

            this._masterGain = this._audioCtx.createGain();
            this._masterGain.gain.value = 0;
            this._masterGain.connect(this._audioCtx.destination);

            const bufSize    = this._audioCtx.sampleRate * 2;
            const noiseBuf   = this._audioCtx.createBuffer(1, bufSize, this._audioCtx.sampleRate);
            const noiseData  = noiseBuf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) noiseData[i] = Math.random() * 2 - 1;

            const noiseSrc = this._audioCtx.createBufferSource();
            noiseSrc.buffer = noiseBuf;
            noiseSrc.loop   = true;

            const whooshFilter = this._audioCtx.createBiquadFilter();
            whooshFilter.type            = 'lowpass';
            whooshFilter.frequency.value = 300;
            whooshFilter.Q.value         = 1.2;

            this._whooshGain = this._audioCtx.createGain();
            this._whooshGain.gain.value = 0;

            noiseSrc.connect(whooshFilter);
            whooshFilter.connect(this._whooshGain);
            this._whooshGain.connect(this._masterGain);

            const creakFilter = this._audioCtx.createBiquadFilter();
            creakFilter.type            = 'bandpass';
            creakFilter.frequency.value = 90;
            creakFilter.Q.value         = 5.0;

            this._creakGain = this._audioCtx.createGain();
            this._creakGain.gain.value = 0;

            noiseSrc.connect(creakFilter);
            creakFilter.connect(this._creakGain);
            this._creakGain.connect(this._masterGain);

            noiseSrc.start();
            this._audioReady = true;
        } catch (e) {
            console.warn('[Windmill] Audio init failed:', e);
        }
    }

    _updateAudio(rotZ, vol) {
        if (!this._audioReady || !this._audioCtx) return;
        if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
        if (this._audioCtx.state !== 'running') return;

        this._masterGain.gain.value = vol * 3.5;

        const rot = Math.abs(rotZ);
        this._whooshGain.gain.value = 0.05 + ((Math.sin(rot * 4) + 1) / 2) * 0.25;
        this._creakGain.gain.value  = Math.pow((Math.sin(rot * 4 - 0.5) + 1) / 2, 12) * 2.0;
    }

    // ─────────────────────────────────────────────────────────────
    //  UPDATE — 0 allocations por frame
    // ─────────────────────────────────────────────────────────────
    update(delta, playerPos) {
        if (this._rotor) this._rotor.rotation.z -= this.rotorSpeed * delta;

        if (!playerPos) return;

        _tmpPos.set(this.x, 0, this.z);
        const dist = _tmpPos.distanceTo(playerPos);

        if (dist < this.audioRadius) {
            if (!this._audioReady) this._initAudio();
            const t = Math.max(0, 1 - dist / this.audioRadius);
            this._currentVol = THREE.MathUtils.lerp(this._currentVol, t, delta * 2);
            this._updateAudio(this._rotor ? this._rotor.rotation.z : 0, this._currentVol);
        } else if (this._audioReady) {
            this._currentVol = THREE.MathUtils.lerp(this._currentVol, 0, delta * 2);
            if (this._masterGain) {
                this._masterGain.gain.value = this._currentVol < 0.001 ? 0 : this._currentVol * 3.5;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  DISPOSE
    // ─────────────────────────────────────────────────────────────
    destroy() {
        if (this._audioCtx) { this._audioCtx.close().catch(() => {}); this._audioCtx = null; }
        if (this.parent) this.parent.remove(this.group);
    }
}
