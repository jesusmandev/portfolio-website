import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Speaker3D
 *
 * Optimized high-fidelity procedural 3D speaker.
 * - "Melo" woofer design with chrome rings, rubber surround and responsive center dome.
 * - Musical note sprite pool for 60fps performance without garbage collection (Zero-GC).
 * - Proximity detection by squared distance, throttled every 5 frames.
 * - Web Audio API with volume control, musical notes and proportional shaking.
 * - Automatic player dance animation activation on power-on.
 */
export class Speaker3D {
    constructor(scene, camera, options = {}) {
        this.scene  = scene;
        this.camera = camera;

        this.position = options.position
            ? new THREE.Vector3(options.position.x, options.position.y, options.position.z)
            : new THREE.Vector3(-245.95, 0.20, 441.11);

        this.speakerScale = options.scale ?? 32.0;
        this.physicsWorld = options.physicsWorld ?? null;
        this._rigidBody   = null;
        this._collider    = null;

        this._powered        = false;
        this._volume         = 0.5;
        this._shakeIntensity = 0;
        this._lastNoteTime   = 0;
        this._frameCount     = 0;

        this._audioCtx   = null;
        this._gainNode   = null;
        this._srcBuffer  = null;
        this._srcNode    = null;
        this._audioLoaded= false;

        this._raycaster     = new THREE.Raycaster();
        this._mouse         = new THREE.Vector2();
        this._isDragging    = false;
        this._pointerDownPos= { x: 0, y: 0 };

        // Squared proximity
        this.SHOW_DIST_SQ = 65 * 65; // ~65 units
        this.HIDE_DIST_SQ = 120 * 120; // ~120 units
        this._isNearby     = false;

        // Visual references
        this._powerBtnMesh = null;
        this._wooferCones  = [];
        this._dustCaps     = [];
        this._ledMesh      = null;
        this._bodyMesh     = null;
        this._knobMesh     = null;

        // Collection of resources to release in destroy()
        this._disposables = [];

        // Root group
        this._group = new THREE.Group();
        this._group.position.copy(this.position);
        this.scene.add(this._group);

        this._buildGeometry();
        this._initNotePool();
        this._loadAudio();
        this._bindEvents();

        this._buildVolumeUI();
        this._setUIVisible(false);
    }

    // ──────────────────────────────────────────────────────────────────
    //  SPEAKER ("MELA") GEOMETRY AND DESIGN
    // ──────────────────────────────────────────────────────────────────

    _buildGeometry() {
        const s = this.speakerScale / 9.0;

        // Shared materials with stylized finishes
        this._matBodyOn  = new THREE.MeshStandardMaterial({ color: 0x3b5260, roughness: 0.5, metalness: 0.15, flatShading: true });
        this._matBodyOff = new THREE.MeshStandardMaterial({ color: 0x222e36, roughness: 0.7, metalness: 0.05, flatShading: true });
        const matFrame   = new THREE.MeshStandardMaterial({ color: 0x56778a, roughness: 0.4, metalness: 0.2, flatShading: true });
        const matGrille  = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.9, flatShading: true });
        const matSurround= new THREE.MeshStandardMaterial({ color: 0x2d3942, roughness: 0.6, flatShading: true });
        const matChrome  = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.2, metalness: 0.8, flatShading: true });
        const matCone    = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.6, flatShading: true });
        this._matCapOn   = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00cc66, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.5, flatShading: true });
        this._matCapOff  = new THREE.MeshStandardMaterial({ color: 0x7a8e99, roughness: 0.4, metalness: 0.4, flatShading: true });
        const matKnob    = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, roughness: 0.2, metalness: 0.4, flatShading: true });
        const matButton  = new THREE.MeshStandardMaterial({ color: 0x1c2329, roughness: 0.8, flatShading: true });

        this._matBtnOn   = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5, roughness: 0.3, flatShading: true });
        this._matBtnOff  = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.5, flatShading: true });
        this._matLedOn   = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.8, roughness: 0.2, flatShading: true });
        this._matLedOff  = new THREE.MeshStandardMaterial({ color: 0x440000, roughness: 0.6, flatShading: true });

        this._disposables.push(
            this._matBodyOn, this._matBodyOff, matFrame, matGrille, matSurround,
            matChrome, matCone, this._matCapOn, this._matCapOff, matKnob, matButton,
            this._matBtnOn, this._matBtnOff, this._matLedOn, this._matLedOff
        );

        // Base dimensions
        const bW = 2.6 * s, bH = 4.2 * s, bD = 1.4 * s;

        // Main body
        const geoBody = new THREE.BoxGeometry(bW, bH, bD);
        this._disposables.push(geoBody);
        this._bodyMesh = new THREE.Mesh(geoBody, this._matBodyOff);
        this._bodyMesh.position.y = bH / 2;
        this._bodyMesh.castShadow = true;
        this._bodyMesh.receiveShadow = true;
        this._group.add(this._bodyMesh);

        // Rapier 3D Physics Collider — solid obstacle so the character cannot pass through
        if (this.physicsWorld && RAPIER) {
            const halfW = bW / 2;
            const halfH = bH / 2;
            const halfD = bD / 2;

            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(this.position.x, this.position.y + halfH, this.position.z);
            this._rigidBody = this.physicsWorld.createRigidBody(bodyDesc);

            const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD);
            this._collider = this.physicsWorld.createCollider(colliderDesc, this._rigidBody);
        }

        // Black front panel with relief
        const fW = 2.15 * s, fH = 3.6 * s, fD = 0.12 * s;
        const geoFront = new THREE.BoxGeometry(fW, fH, fD);
        this._disposables.push(geoFront);
        const front = new THREE.Mesh(geoFront, matGrille);
        front.position.set(0, bH / 2, bD / 2 + fD / 2 + 0.02 * s);
        front.castShadow = true;
        this._group.add(front);

        const frontFaceZ = bD / 2 + fD + 0.02 * s;

        // Metallic blue protective frame
        const ft = 0.22 * s, fd = 0.16 * s;
        const frameParts = [
            [fW + ft * 2, ft, 0, bH / 2 + fH / 2 + ft / 2],
            [fW + ft * 2, ft, 0, bH / 2 - fH / 2 - ft / 2],
            [ft, fH, -fW / 2 - ft / 2, bH / 2],
            [ft, fH,  fW / 2 + ft / 2, bH / 2],
        ];
        frameParts.forEach(([w, h, x, y]) => {
            const geoF = new THREE.BoxGeometry(w, h, fd);
            this._disposables.push(geoF);
            const m = new THREE.Mesh(geoF, matFrame);
            m.position.set(x, y, bD / 2 + fd / 2);
            this._group.add(m);
        });

        // Stylized woofers ("Mela speakers" with double bevel + surround + responsive center)
        const wooferY = [3.0 * s, 1.25 * s];
        const wR = 0.64 * s;

        const geoSurround = new THREE.CylinderGeometry(wR, wR, 0.1 * s, 20);
        const geoChrome   = new THREE.CylinderGeometry(wR * 1.05, wR * 1.05, 0.04 * s, 20);
        const geoCone     = new THREE.CylinderGeometry(0.24 * s, wR * 0.88, 0.28 * s, 20, 1, true);
        const geoCap      = new THREE.SphereGeometry(0.15 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65);
        this._disposables.push(geoSurround, geoChrome, geoCone, geoCap);

        wooferY.forEach(y => {
            const g = new THREE.Group();
            g.position.set(0, y, frontFaceZ);

            // Anillo exterior cromado brillante
            const chrome = new THREE.Mesh(geoChrome, matChrome);
            chrome.rotation.x = Math.PI / 2;
            chrome.position.z = 0.02 * s;
            g.add(chrome);

            // Rubber surround
            const surround = new THREE.Mesh(geoSurround, matSurround);
            surround.rotation.x = Math.PI / 2;
            surround.position.z = 0.05 * s;
            g.add(surround);

            // Cono del altavoz
            const cone = new THREE.Mesh(geoCone, matCone);
            cone.rotation.x = Math.PI / 2;
            cone.position.z = 0.13 * s;
            g.add(cone);
            this._wooferCones.push(cone);

            // Central dome (Dust Cap) that subtly glows with the music
            const cap = new THREE.Mesh(geoCap, this._matCapOff);
            cap.rotation.x = -Math.PI / 2;
            cap.position.z = 0.22 * s;
            g.add(cap);
            this._dustCaps.push(cap);

            this._group.add(g);
        });

        // Orificio Bass-Reflex (Subwoofer port) en la parte inferior
        const geoPort = new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.15 * s, 16);
        this._disposables.push(geoPort);
        const port = new THREE.Mesh(geoPort, matGrille);
        port.rotation.x = Math.PI / 2;
        port.position.set(0, 0.38 * s, frontFaceZ + 0.02 * s);
        this._group.add(port);

        // Panel de controles superior
        const ctrlY = bH / 2 + fH / 2 + ft / 2;

        // Power LED
        const geoLed = new THREE.SphereGeometry(0.06 * s, 12, 10);
        this._disposables.push(geoLed);
        this._ledMesh = new THREE.Mesh(geoLed, this._matLedOff);
        this._ledMesh.position.set(-0.95 * s, ctrlY, frontFaceZ + 0.07 * s);
        this._group.add(this._ledMesh);

        // Perilla de volumen
        const geoKnob = new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.14 * s, 16);
        this._disposables.push(geoKnob);
        const knob = new THREE.Mesh(geoKnob, matKnob);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(-0.55 * s, ctrlY, frontFaceZ + 0.1 * s);
        this._group.add(knob);
        this._knobMesh = knob;

        // Main power on/off button
        const geoBtn = new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.14 * s, 16);
        this._disposables.push(geoBtn);
        this._powerBtnMesh = new THREE.Mesh(geoBtn, this._matBtnOff);
        this._powerBtnMesh.rotation.x = Math.PI / 2;
        this._powerBtnMesh.position.set(-0.16 * s, ctrlY, frontFaceZ + 0.08 * s);
        this._powerBtnMesh.name = 'speakerPowerButton';
        this._group.add(this._powerBtnMesh);

        // Botones auxiliares decorativos
        const geoMiniBtn = new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.1 * s, 10);
        this._disposables.push(geoMiniBtn);
        for (let i = 0; i < 4; i++) {
            const btn = new THREE.Mesh(geoMiniBtn, matButton);
            btn.rotation.x = Math.PI / 2;
            btn.position.set((0.22 + i * 0.22) * s, ctrlY, frontFaceZ + 0.05 * s);
            this._group.add(btn);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  POOL DE NOTAS MUSICALES (ZERO-GC REUSE)
    // ──────────────────────────────────────────────────────────────────

    _initNotePool() {
        const colors = ['#FF0055', '#00CCFF', '#FFEE00', '#55FF00', '#AA55FF', '#FF8800'];
        this._noteMaterials = colors.map(color => {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(32, 32, 27, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♪', 32, 33);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            this._disposables.push(tex);

            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1, depthWrite: false });
            this._disposables.push(mat);
            return mat;
        });

        // Crear pool reutilizable de 16 sprites
        this._notePool = [];
        for (let i = 0; i < 16; i++) {
            const sprite = new THREE.Sprite(this._noteMaterials[0]);
            sprite.visible = false;
            this.scene.add(sprite);
            this._notePool.push({
                sprite,
                active: false,
                speedY: 0,
                driftX: 0,
                rotSpeed: 0,
                life: 0
            });
        }
    }

    _spawnNote() {
        const note = this._notePool.find(n => !n.active);
        if (!note) return;

        const s = this.speakerScale / 9.0;
        const bH = 4.2 * s;
        const bD = 1.4 * s;

        // Asignar material de color aleatorio del pool
        const mat = this._noteMaterials[Math.floor(Math.random() * this._noteMaterials.length)];
        note.sprite.material = mat;
        note.sprite.position.set(
            this.position.x + (Math.random() - 0.5) * 1.8 * s,
            this.position.y + bH - 0.15 * s,
            this.position.z + bD / 2 + 0.3 * s
        );

        const sc = (0.24 + Math.random() * 0.22) * s;
        note.sprite.scale.set(sc, sc, sc);
        note.sprite.material.opacity = 1;
        note.sprite.material.rotation = (Math.random() - 0.5) * 0.5;
        note.sprite.visible = true;

        note.speedY   = (0.028 + Math.random() * 0.035) * s;
        note.driftX   = (Math.random() - 0.5) * 0.018 * s;
        note.rotSpeed = (Math.random() - 0.5) * 0.09;
        note.life     = 1.0;
        note.active   = true;
    }

    _updateNotes(delta) {
        for (let i = 0; i < this._notePool.length; i++) {
            const n = this._notePool[i];
            if (!n.active) continue;

            n.sprite.position.y += n.speedY;
            n.sprite.position.x += n.driftX;
            n.sprite.material.rotation += n.rotSpeed;
            n.life -= 0.016;
            n.sprite.material.opacity = Math.max(0, n.life);

            if (n.life <= 0) {
                n.active = false;
                n.sprite.visible = false;
            }
        }
    }

    _clearNotes() {
        this._notePool.forEach(n => {
            n.active = false;
            n.sprite.visible = false;
        });
    }

    // ──────────────────────────────────────────────────────────────────
    //  AUDIO WEB API CON PLAYLIST
    // ──────────────────────────────────────────────────────────────────

    _loadAudio() {
        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
        this._tracks = [
            { name: 'After the Fair', url: encodeURI(`${baseUrl}/audios/speaker/After_the_Fair.mp3`) },
            { name: 'Fire Under My Feet', url: encodeURI(`${baseUrl}/audios/speaker/Fuego_bajo_mis_pies.mp3`) },
            { name: 'Midnight at the Plaza', url: encodeURI(`${baseUrl}/audios/speaker/Midnight_at_the_Plaza (1).mp3`) },
            { name: 'Mountains Under the Moon', url: encodeURI(`${baseUrl}/audios/speaker/Montañas_bajo_la_luna.mp3`) }
        ];
        this._currentTrackIdx = 0;
        this._audioBuffers = {};

        this._loadTrackBuffer(this._currentTrackIdx);
    }

    _loadTrackBuffer(idx) {
        if (this._audioBuffers[idx]) {
            this._srcBuffer = this._audioBuffers[idx];
            this._audioLoaded = true;
            return Promise.resolve(this._audioBuffers[idx]);
        }

        const track = this._tracks[idx];
        return fetch(track.url)
            .then(r => r.arrayBuffer())
            .then(buffer => {
                if (!this._audioCtx) {
                    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                return this._audioCtx.decodeAudioData(buffer);
            })
            .then(decoded => {
                this._audioBuffers[idx] = decoded;
                if (idx === this._currentTrackIdx) {
                    this._srcBuffer = decoded;
                    this._audioLoaded = true;
                }
                console.log(`[Speaker3D] Pista cargada: ${track.name}`);
                return decoded;
            })
            .catch(err => console.warn('[Speaker3D] Track load error:', err));
    }

    _startAudio() {
        if (!this._audioLoaded || !this._srcBuffer) {
            this._loadTrackBuffer(this._currentTrackIdx).then(buf => {
                if (buf && this._powered) this._startAudio();
            });
            return;
        }

        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioCtx.state === 'suspended') {
            this._audioCtx.resume();
        }

        this._srcNode = this._audioCtx.createBufferSource();
        this._srcNode.buffer = this._srcBuffer;
        this._srcNode.loop = false; // Allows moving to the next track when it ends

        this._srcNode.onended = () => {
            if (this._powered) {
                this._nextTrack();
            }
        };

        this._gainNode = this._audioCtx.createGain();
        this._gainNode.gain.value = this._volume;

        this._srcNode.connect(this._gainNode);
        this._gainNode.connect(this._audioCtx.destination);
        this._srcNode.start(0);

        this._updateTrackLabel();
    }

    _nextTrack() {
        this._stopAudio();
        this._currentTrackIdx = (this._currentTrackIdx + 1) % this._tracks.length;
        this._audioLoaded = false;
        this._srcBuffer = null;

        this._updateTrackLabel();

        if (this._powered) {
            this._loadTrackBuffer(this._currentTrackIdx).then(buf => {
                if (buf && this._powered) {
                    this._startAudio();
                }
            });
        }
    }

    _updateTrackLabel() {
        const track = this._tracks[this._currentTrackIdx];
        const label = document.getElementById('speaker-track-title');
        if (label && track) {
            label.textContent = track.name;
        }
    }

    _stopAudio() {
        if (this._srcNode) {
            this._srcNode.onended = null;
            try { this._srcNode.stop(); } catch (_) {}
            this._srcNode.disconnect();
            this._srcNode = null;
        }
        if (this._gainNode) {
            this._gainNode.disconnect();
            this._gainNode = null;
        }
    }

    setVolume(vol) {
        this._volume = Math.max(0, Math.min(1, vol));
        if (this._gainNode && this._audioCtx) {
            this._gainNode.gain.setTargetAtTime(this._volume, this._audioCtx.currentTime, 0.04);
        }
        const slider = document.getElementById('speaker-volume-slider');
        if (slider) slider.value = Math.round(this._volume * 100);
        const label = document.getElementById('speaker-volume-label');
        if (label) label.textContent = Math.round(this._volume * 100) + '%';
    }

    // ──────────────────────────────────────────────────────────────────
    //  ENCENDIDO / APAGADO
    // ──────────────────────────────────────────────────────────────────

    _togglePower() {
        this._powered = !this._powered;
        if (this._powered) {
            this._startAudio();
            this._ledMesh.material      = this._matLedOn;
            this._powerBtnMesh.material = this._matBtnOn;
            this._bodyMesh.material     = this._matBodyOn;
            this._dustCaps.forEach(cap => cap.material = this._matCapOn);

            // Automatically activate the character's dance animation (key 'x')
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', bubbles: true }));
        } else {
            this._stopAudio();
            this._clearNotes();
            this._ledMesh.material      = this._matLedOff;
            this._powerBtnMesh.material = this._matBtnOff;
            this._bodyMesh.material     = this._matBodyOff;
            this._dustCaps.forEach(cap => cap.material = this._matCapOff);
        }

        const powerBtn = document.getElementById('speaker-power-btn');
        if (powerBtn) {
            powerBtn.textContent = this._powered ? '🔊 Apagar' : '🔇 Encender';
            powerBtn.style.background = this._powered ? '#00cc55' : '#cc3333';
        }
        const volPanel = document.getElementById('speaker-vol-panel');
        if (volPanel) volPanel.style.display = this._powered ? 'flex' : 'none';
    }

    // ──────────────────────────────────────────────────────────────────
    //  UI EN DOM
    // ──────────────────────────────────────────────────────────────────

    _buildVolumeUI() {
        const panel = document.createElement('div');
        panel.id = 'speaker-ui';
        panel.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 200;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            pointer-events: auto;
        `;

        const btn = document.createElement('button');
        btn.id = 'speaker-power-btn';
        btn.textContent = '🔇 Encender';
        btn.style.cssText = `
            padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
            background: #cc3333; color: #fff; font-weight: bold; font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            transition: background 0.2s, transform 0.1s;
        `;
        btn.addEventListener('click', () => this._togglePower());

        const volPanel = document.createElement('div');
        volPanel.id = 'speaker-vol-panel';
        volPanel.style.cssText = `
            display: none; flex-direction: column; align-items: center; gap: 6px;
            background: rgba(0,0,0,0.75); backdrop-filter: blur(10px);
            border: 1px solid rgba(0,150,255,0.3);
            border-radius: 14px; padding: 12px 18px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            min-width: 170px;
        `;

        const trackTitle = document.createElement('span');
        trackTitle.id = 'speaker-track-title';
        trackTitle.textContent = this._tracks?.[0]?.name || 'Music';
        trackTitle.style.cssText = 'color: #00ff88; font-size: 11px; font-weight: 700; text-align: center; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display: flex; align-items: center; gap: 8px; width: 100%; justify-content: space-between;';

        const label = document.createElement('span');
        label.id = 'speaker-volume-label';
        label.textContent = '50%';
        label.style.cssText = 'color: #fff; font-size: 11px; font-weight: bold; min-width: 32px;';

        const slider = document.createElement('input');
        slider.id = 'speaker-volume-slider';
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = '50';
        slider.style.cssText = 'width: 80px; accent-color: #00FF66; cursor: pointer;';
        slider.addEventListener('input', () => {
            this.setVolume(parseInt(slider.value) / 100);
        });

        const nextBtn = document.createElement('button');
        nextBtn.id = 'speaker-next-btn';
        nextBtn.textContent = '⏭️';
        nextBtn.title = 'Next track';
        nextBtn.style.cssText = 'background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; padding: 3px 8px; cursor: pointer; font-size: 12px; transition: background 0.2s;';
        nextBtn.addEventListener('click', () => this._nextTrack());

        controlsRow.append(label, slider, nextBtn);
        volPanel.append(trackTitle, controlsRow);
        panel.append(btn, volPanel);
        document.body.appendChild(panel);
    }

    _setUIVisible(visible) {
        const ui = document.getElementById('speaker-ui');
        if (ui) ui.style.display = visible ? 'flex' : 'none';
    }

    // ──────────────────────────────────────────────────────────────────
    //  INTERACTIVE EVENTS (3D BUTTON RAYCASTING)
    // ──────────────────────────────────────────────────────────────────

    _bindEvents() {
        const canvas = this.scene.userData?.renderer?.domElement
            || document.querySelector('canvas');
        if (!canvas) return;

        canvas.addEventListener('pointerdown', (e) => {
            this._isDragging = false;
            this._pointerDownPos = { x: e.clientX, y: e.clientY };
        });
        canvas.addEventListener('pointermove', (e) => {
            const dx = e.clientX - this._pointerDownPos.x;
            const dy = e.clientY - this._pointerDownPos.y;
            if (dx * dx + dy * dy > 25) this._isDragging = true;
        });
        canvas.addEventListener('pointerup', (e) => {
            if (this._isDragging) return;
            this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            const cam = this.camera || this.scene.userData?.camera;
            if (!cam) return;
            this._raycaster.setFromCamera(this._mouse, cam);
            const hits = this._raycaster.intersectObjects(this._group.children, true);
            for (const hit of hits) {
                if (hit.object.name === 'speakerPowerButton') {
                    this._togglePower();
                    break;
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────
    //  PROXIMIDAD CON THROTTLING
    // ──────────────────────────────────────────────────────────────────

    _checkProximity(playerPos) {
        if (!playerPos) return;
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const distSq = dx * dx + dz * dz;

        if (!this._isNearby && distSq <= this.SHOW_DIST_SQ) {
            this._isNearby = true;
            this._setUIVisible(true);
        } else if (this._isNearby && distSq > this.HIDE_DIST_SQ) {
            this._isNearby = false;
            this._setUIVisible(false);
            if (this._powered) this._togglePower();
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  CAMERA SHAKE
    // ──────────────────────────────────────────────────────────────────

    _applyShake(delta) {
        const cam = this.camera || this.scene.userData?.camera;
        if (!cam || !this._powered || this._volume <= 0.5) {
            this._shakeIntensity = 0;
            return;
        }

        const t = (this._volume - 0.5) / 0.5;
        this._shakeIntensity = THREE.MathUtils.lerp(this._shakeIntensity, t * 0.28, delta * 8);

        const intensity = this._shakeIntensity;
        cam.position.x += (Math.random() - 0.5) * intensity;
        cam.position.y += (Math.random() - 0.5) * intensity * 0.6;
        cam.position.z += (Math.random() - 0.5) * intensity;
    }

    // ──────────────────────────────────────────────────────────────────
    //  UPDATE LOOP PRINCIPAL (OPTIMIZADO)
    // ──────────────────────────────────────────────────────────────────

    update(delta, playerPos) {
        this._frameCount++;
        const t = performance.now() * 0.001;
        const s = this.speakerScale / 9.0;

        // Distance check throttling every 5 frames
        if (this._frameCount % 5 === 0) {
            this._checkProximity(playerPos);
        }

        // Physical vibration of the speaker itself when volume > 50%
        let spkShakeX = 0, spkShakeZ = 0;
        if (this._powered && this._volume > 0.5) {
            const vFactor = (this._volume - 0.5) / 0.5;
            const shakeAmt = vFactor * 0.22 * s;
            spkShakeX = (Math.random() - 0.5) * shakeAmt;
            spkShakeZ = (Math.random() - 0.5) * shakeAmt;
        }

        this._group.position.x = this.position.x + spkShakeX;
        this._group.position.y = this.position.y + Math.sin(t * 0.8) * 0.05 * s;
        this._group.position.z = this.position.z + spkShakeZ;
        this._group.rotation.y = Math.sin(t * 0.25) * 0.04;

        if (this._powered) {
            // Agile woofer and central dome animation
            const pulse = (Math.sin(t * 14) * 0.5 + 0.5) * this._volume;
            const excursion = 0.07 * s * pulse + 0.02 * s * Math.sin(t * 28);

            this._wooferCones.forEach((cone, i) => {
                cone.position.z = 0.13 * s + excursion * (i === 0 ? 1 : 0.88);
                cone.scale.setScalar(1 + excursion * 0.09);
            });
            this._dustCaps.forEach((cap, i) => {
                cap.position.z = 0.22 * s + excursion * (i === 0 ? 1.1 : 0.95);
            });

            if (this._knobMesh) {
                this._knobMesh.rotation.z = this._volume * Math.PI * 1.2 - Math.PI * 0.6;
            }

            if (t - this._lastNoteTime > 0.18) {
                this._spawnNote();
                this._lastNoteTime = t;
            }

            this._applyShake(delta);
        } else {
            this._wooferCones.forEach(cone => {
                cone.position.z = THREE.MathUtils.lerp(cone.position.z, 0.13 * s, 0.1);
                cone.scale.setScalar(THREE.MathUtils.lerp(cone.scale.x, 1, 0.1));
            });
            this._dustCaps.forEach(cap => {
                cap.position.z = THREE.MathUtils.lerp(cap.position.z, 0.22 * s, 0.1);
            });
        }

        this._updateNotes(delta);
    }

    // ──────────────────────────────────────────────────────────────────
    //  CLEANUP AND MEMORY RELEASE
    // ──────────────────────────────────────────────────────────────────

    destroy() {
        this._stopAudio();
        this._clearNotes();
        this._notePool.forEach(n => this.scene.remove(n.sprite));
        this.scene.remove(this._group);

        const ui = document.getElementById('speaker-ui');
        if (ui) ui.remove();

        if (this.physicsWorld && this._rigidBody) {
            try { this.physicsWorld.removeRigidBody(this._rigidBody); } catch (_) {}
            this._rigidBody = null;
            this._collider = null;
        }

        this._disposables.forEach(d => {
            if (d && typeof d.dispose === 'function') d.dispose();
        });
        this._disposables.length = 0;
    }
}
