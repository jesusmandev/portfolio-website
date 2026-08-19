import * as THREE from 'three';

// Maximum vertices for lightning line segments (pre-allocated for 0 lag / 0 GC)
const MAX_LIGHTNING_VERTICES = 1200;

export class StormManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // ---------- Phase Timing Configuration ----------
        this.stormInterval = 150; // Cada 150s se inicia el ciclo de tormenta
        
        // Fases de la tormenta:
        // 1. 'CLEAR': Sin tormenta
        // 2. 'WIND_START': El viento empieza a sonar suavemente (6s)
        // 3. 'DARKENING': El cielo empieza a oscurecerse (4s)
        // 4. 'RAIN': Heavy rain falls, lightning, wind (45s)
        // 5. 'CLEARING': La lluvia para, el cielo se aclara (2s)
        this.stormPhase = 'CLEAR';
        this.phaseTimer = 0;
        this.timeSinceLastStorm = 0;

        // Physical and render factors
        this.darknessFactor = 1.0;
        this.windStrength = 0.0;
        this.windTime = 0.0;

        // ---------- Colores reutilizables (Amarillo, Naranja, Azul — SIN Morado) ----------
        this._stormAmbColor  = new THREE.Color(0x1a2233);
        this._clearAmbColor  = new THREE.Color(0xffffff);
        this._stormFogColor  = new THREE.Color(0x0e121d);
        this._flashFogColor  = new THREE.Color(0x102a45); // Azul tormenta durante el destello

        // ---------- Audio Listener y Sonidos ----------
        this.audioInitialized = false;
        this.rainSound = null;
        this.windSound = null;
        this.thunderSound = null;
        this.audioLoader = new THREE.AudioLoader();

        // ---------- Rain (Particle System) ----------
        this.rainCount = 12000;
        this.rainGeometry = new THREE.BufferGeometry();
        this.rainPositions = new Float32Array(this.rainCount * 3);
        
        this.rainBoxSize = 250;
        for (let i = 0; i < this.rainCount * 3; i += 3) {
            this.rainPositions[i]   = (Math.random() - 0.5) * this.rainBoxSize;
            this.rainPositions[i+1] = Math.random() * 120 - 40;
            this.rainPositions[i+2] = (Math.random() - 0.5) * this.rainBoxSize;
        }

        this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
        this.rainMaterial = new THREE.PointsMaterial({
            color: 0x557799,
            size: 0.22,
            transparent: true,
            opacity: 0.0
        });

        this.rainPoints = new THREE.Points(this.rainGeometry, this.rainMaterial);
        this.rainPoints.name = 'rainPoints';
        this.scene.add(this.rainPoints);

        // ---------- Impact Light (Electric Blue / Cyan) ----------
        this.flashLight = new THREE.PointLight(0x00bfff, 0, 800, 1.5);
        this.scene.add(this.flashLight);

        this.lightningGroup = new THREE.Group();
        this.lightningGroup.name = 'lightningGroup';
        this.scene.add(this.lightningGroup);

        this.cameraShakeStrength = 0.0; // Intensidad del temblor

        // ---------- RAYO OPTIMIZADO CON RENDIMIENTO FLUIDO (0 ALLOCATIONS EN IMPACTO) ----------
        // Pre-allocate 3 LineSegment layers (White Core, Blue Halo, Orange/Yellow Glow)
        this.lightningLife = 0;

        const geoCore   = new THREE.BufferGeometry();
        const geoBlue   = new THREE.BufferGeometry();
        const geoOrange = new THREE.BufferGeometry();

        this._posCore   = new Float32Array(MAX_LIGHTNING_VERTICES * 3);
        this._posBlue   = new Float32Array(MAX_LIGHTNING_VERTICES * 3);
        this._posOrange = new Float32Array(MAX_LIGHTNING_VERTICES * 3);

        geoCore.setAttribute('position',   new THREE.BufferAttribute(this._posCore, 3));
        geoBlue.setAttribute('position',   new THREE.BufferAttribute(this._posBlue, 3));
        geoOrange.setAttribute('position', new THREE.BufferAttribute(this._posOrange, 3));

        geoCore.setDrawRange(0, 0);
        geoBlue.setDrawRange(0, 0);
        geoOrange.setDrawRange(0, 0);

        this.matCore   = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        this.matBlue   = new THREE.LineBasicMaterial({ color: 0x00bfff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        this.matOrange = new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

        this.lineCore   = new THREE.LineSegments(geoCore,   this.matCore);
        this.lineBlue   = new THREE.LineSegments(geoBlue,   this.matBlue);
        this.lineOrange = new THREE.LineSegments(geoOrange, this.matOrange);

        this.lineCore.frustumCulled   = false;
        this.lineBlue.frustumCulled   = false;
        this.lineOrange.frustumCulled = false;

        this.lightningGroup.add(this.lineCore);
        this.lightningGroup.add(this.lineBlue);
        this.lightningGroup.add(this.lineOrange);

        // Pre-allocated vector pool for fractal lightning point calculation (avoids GC)
        this._vecPoolIndex = 0;
        this._vecPool = Array.from({ length: 256 }, () => new THREE.Vector3());

        // ---------- Volumetric Spark System (Colors: Yellow, Orange, Blue) ----------
        this.sparkCount = 800;
        this.sparkGeometry = new THREE.BufferGeometry();
        this.sparkPositions = new Float32Array(this.sparkCount * 3);
        this.sparkVelocities = [];
        this.sparkLifes = new Float32Array(this.sparkCount);
        this.sparkColors = new Float32Array(this.sparkCount * 3);

        const colorPalette = [
            new THREE.Color(0x00bfff), // Electric Blue
            new THREE.Color(0x38bdf8), // Azul Cian
            new THREE.Color(0xffea00), // Amarillo Brillante
            new THREE.Color(0xff6600), // Naranja Fuego
            new THREE.Color(0xffd700)  // Amarillo Dorado
        ];

        // Inicializar escondidas bajo el mapa
        for (let i = 0; i < this.sparkCount; i++) {
            this.sparkPositions[i * 3 + 1] = -500;
            this.sparkVelocities.push(new THREE.Vector3());
            this.sparkLifes[i] = 0;

            const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            this.sparkColors[i * 3]     = col.r;
            this.sparkColors[i * 3 + 1] = col.g;
            this.sparkColors[i * 3 + 2] = col.b;
        }

        this.sparkGeometry.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
        this.sparkGeometry.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

        this.sparkMaterial = new THREE.PointsMaterial({
            size: 1.2,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.sparkParticles = new THREE.Points(this.sparkGeometry, this.sparkMaterial);
        this.sparkParticles.name = 'sparkParticles';
        this.scene.add(this.sparkParticles);
    }

    initAudio(listener) {
        if (this.audioInitialized) return;
        this.audioInitialized = true;

        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');

        this.rainSound = new THREE.Audio(listener);
        this.windSound = new THREE.Audio(listener);
        this.thunderSound = new THREE.Audio(listener);

        // Cargar audio de lluvia local
        this.audioLoader.load(`${baseUrl}/audios/agua/lluvia.mp3`, (buffer) => {
            this.rainSound.setBuffer(buffer);
            this.rainSound.setLoop(true);
            this.rainSound.setVolume(0.0);
            if (this.stormPhase === 'RAIN') {
                this.rainSound.play();
            }
        });

        // Cargar audio de viento local
        this.audioLoader.load(`${baseUrl}/audios/viento/viento.wav`, (buffer) => {
            this.windSound.setBuffer(buffer);
            this.windSound.setLoop(true);
            this.windSound.setVolume(0.0);
            if (this.stormPhase !== 'CLEAR') {
                this.windSound.play();
            }
        });

        // Cargar audio de trueno (rayo) local
        this.audioLoader.load(`${baseUrl}/audios/rayo/thunder.mp3`, (buffer) => {
            this.thunderSound.setBuffer(buffer);
            this.thunderSound.setVolume(1.0);
        });
    }

    _allocVec() {
        if (this._vecPoolIndex >= this._vecPool.length) {
            this._vecPoolIndex = 0;
        }
        return this._vecPool[this._vecPoolIndex++];
    }

    _getLightningPointsInPool(start, end, displacement, minDisplacement) {
        let points = [start, end];
        let curDisp = displacement;
        while (curDisp > minDisplacement) {
            const newPoints = [];
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const mid = this._allocVec().addVectors(p1, p2).multiplyScalar(0.5);
                mid.x += (Math.random() - 0.5) * curDisp;
                mid.y += (Math.random() - 0.5) * curDisp;
                mid.z += (Math.random() - 0.5) * curDisp;
                newPoints.push(p1, mid);
            }
            newPoints.push(points[points.length - 1]);
            points = newPoints;
            curDisp *= 0.5;
        }
        return points;
    }

    update(dt, carPos, timeCycle) {
        // Incrementar contadores de fase y ciclo
        this.phaseTimer += dt;
        this.timeSinceLastStorm += dt;

        // 1. State Machine / Phase Management
        switch (this.stormPhase) {
            case 'CLEAR':
                if (this.timeSinceLastStorm >= this.stormInterval) {
                    this.stormPhase = 'WIND_START';
                    this.phaseTimer = 0;
                    console.log('[StormManager] 💨 Empieza a soplar el viento (10s antes de la lluvia)');
                    if (this.windSound && this.windSound.buffer && !this.windSound.isPlaying) {
                        this.windSound.play();
                    }
                }
                break;

            case 'WIND_START':
                if (this.phaseTimer >= 6.0) {
                    this.stormPhase = 'DARKENING';
                    this.phaseTimer = 0;
                    console.log('[StormManager] ☁️ El cielo empieza a oscurecerse (4s antes de la lluvia)');
                }
                break;

            case 'DARKENING':
                if (this.phaseTimer >= 4.0) {
                    this.stormPhase = 'RAIN';
                    this.phaseTimer = 0;
                    console.log('[StormManager] ⛈️ Rain has started!');
                    if (this.rainSound && this.rainSound.buffer && !this.rainSound.isPlaying) {
                        this.rainSound.play();
                    }
                }
                break;

            case 'RAIN':
                if (this.phaseTimer >= 45.0) {
                    this.stormPhase = 'CLEARING';
                    this.phaseTimer = 0;
                    console.log('[StormManager] 🌤️ La lluvia ha terminado, aclarando y apagando viento...');
                }
                break;

            case 'CLEARING':
                if (this.phaseTimer >= 2.0) {
                    this.stormPhase = 'CLEAR';
                    this.timeSinceLastStorm = 0;
                    this.phaseTimer = 0;
                    if (this.windSound && this.windSound.isPlaying) this.windSound.stop();
                    if (this.rainSound && this.rainSound.isPlaying) this.rainSound.stop();
                    console.log('[StormManager] ☀️ Tormenta finalizada por completo.');
                }
                break;
        }

        // 2. Definir valores objetivos de viento, lluvia y oscuridad por fase
        let targetWindStrength = 0.0;
        let targetWindVolume   = 0.0;
        let targetRainOpacity  = 0.0;
        let targetRainVolume   = 0.0;
        let targetDarkness     = 1.0;

        switch (this.stormPhase) {
            case 'CLEAR':
                targetWindStrength = 0.0;
                targetWindVolume   = 0.0;
                targetRainOpacity  = 0.0;
                targetRainVolume   = 0.0;
                targetDarkness     = 1.0;
                break;

            case 'WIND_START':
                targetWindStrength = 0.20;
                targetWindVolume   = 0.25;
                targetRainOpacity  = 0.0;
                targetRainVolume   = 0.0;
                targetDarkness     = 1.0;
                break;

            case 'DARKENING':
                targetWindStrength = THREE.MathUtils.lerp(0.20, 0.65, this.phaseTimer / 4.0);
                targetWindVolume   = THREE.MathUtils.lerp(0.25, 0.65, this.phaseTimer / 4.0);
                targetRainOpacity  = 0.0;
                targetRainVolume   = 0.0;
                targetDarkness     = THREE.MathUtils.lerp(1.0, 0.20, this.phaseTimer / 4.0);
                break;

            case 'RAIN':
                targetWindStrength = 1.0;
                targetWindVolume   = 1.0;
                targetRainOpacity  = 0.65;
                targetRainVolume   = 0.45;
                targetDarkness     = 0.20;
                break;

            case 'CLEARING':
                targetWindStrength = THREE.MathUtils.lerp(1.0, 0.0, this.phaseTimer / 2.0);
                targetWindVolume   = THREE.MathUtils.lerp(1.0, 0.0, this.phaseTimer / 2.0);
                targetRainOpacity  = THREE.MathUtils.lerp(0.65, 0.0, this.phaseTimer / 2.0);
                targetRainVolume   = THREE.MathUtils.lerp(0.45, 0.0, this.phaseTimer / 2.0);
                targetDarkness     = THREE.MathUtils.lerp(0.20, 1.0, this.phaseTimer / 2.0);
                break;
        }

        // Aplicar interpolaciones
        this.windStrength = THREE.MathUtils.lerp(this.windStrength, targetWindStrength, dt * 2.0);
        if (this.stormPhase === 'CLEAR' && this.windStrength < 0.002) {
            this.windStrength = 0.0;
        }
        this.darknessFactor = THREE.MathUtils.lerp(this.darknessFactor, targetDarkness, dt * 1.5);
        this.rainMaterial.opacity = THREE.MathUtils.lerp(this.rainMaterial.opacity, targetRainOpacity, dt * 1.5);

        // Controlar volumen de audios
        if (this.windSound && this.windSound.isPlaying) {
            this.windSound.setVolume(THREE.MathUtils.lerp(this.windSound.getVolume(), targetWindVolume, dt * 2.0));
        }
        if (this.rainSound && this.rainSound.isPlaying) {
            this.rainSound.setVolume(THREE.MathUtils.lerp(this.rainSound.getVolume(), targetRainVolume, dt * 2.0));
        }

        // 3. Modify global lighting
        if (timeCycle) {
            if (timeCycle.ambientLight && !timeCycle.ambientLight.userData.baseIntensity) {
                timeCycle.ambientLight.userData.baseIntensity = timeCycle.ambientLight.intensity;
            }
            if (timeCycle.dirLight && !timeCycle.dirLight.userData.baseIntensity) {
                timeCycle.dirLight.userData.baseIntensity = timeCycle.dirLight.intensity;
            }

            if (timeCycle.ambientLight) {
                const baseAmb = timeCycle.ambientLight.userData.baseIntensity || 0.5;
                timeCycle.ambientLight.intensity = baseAmb * this.darknessFactor;

                const isStormyPhase = (this.stormPhase !== 'CLEAR' && this.stormPhase !== 'WIND_START');
                timeCycle.ambientLight.color.lerp(
                    isStormyPhase ? this._stormAmbColor : this._clearAmbColor,
                    dt * 1.0
                );
            }
            if (timeCycle.dirLight) {
                const baseDir = timeCycle.dirLight.userData.baseIntensity || 2.0;
                timeCycle.dirLight.intensity = baseDir * this.darknessFactor;
            }

            if (this.scene.fog) {
                const isStormyPhase = (this.stormPhase !== 'CLEAR' && this.stormPhase !== 'WIND_START');
                this.scene.fog.color.lerp(
                    isStormyPhase ? this._stormFogColor : timeCycle.ambientLight.color,
                    dt * 1.0
                );
            }
        }

        // 4. Move and deform trees on the GPU (Wind Shader)
        this.windTime += dt * (1.8 + this.windStrength * 2.2);
        this._windMatFrame = (this._windMatFrame || 0) + 1;
        if (this._windMatFrame % 2 === 0 && window.windMaterials && window.windMaterials.length > 0) {
            window.windMaterials.forEach(mat => {
                if (mat.userData && mat.userData.shader) {
                    mat.userData.shader.uniforms.uWindTime.value = this.windTime;
                    mat.userData.shader.uniforms.uWindStrength.value = this.windStrength;
                }
            });
        }

        // 5. Rain particle drop
        if (this.rainMaterial.opacity > 0.001) {
            const refPos = carPos || this.camera.position;
            this.rainPoints.position.copy(refPos);

            const positions = this.rainPoints.geometry.attributes.position.array;

            for (let i = 0; i < this.rainCount * 3; i += 3) {
                positions[i+1] -= (60 + Math.random() * 25) * dt; 
                positions[i]   -= (4.0 + this.windStrength * 12.0) * dt;

                if (positions[i+1] < -60) {
                    positions[i+1] = 80 + Math.random() * 20;
                    positions[i]   = (Math.random() - 0.5) * this.rainBoxSize;
                    positions[i+2] = (Math.random() - 0.5) * this.rainBoxSize;
                }
            }
            this.rainPoints.geometry.attributes.position.needsUpdate = true;
        }

        // 6. Lightning and Thunder (rain phase only) — ULTRA FAST
        if (this.stormPhase === 'RAIN') {
            if (Math.random() > 0.985 || this.flashLight.intensity > 10) {
                if (this.flashLight.intensity < 1.0) {
                    const refPos = carPos || this.camera.position;
                    const offsetAngle = Math.random() * Math.PI * 2;
                    const offsetDist  = 80 + Math.random() * 120;
                    const targetX     = refPos.x + Math.cos(offsetAngle) * offsetDist;
                    const targetZ     = refPos.z + Math.sin(offsetAngle) * offsetDist;

                    // ULTRA-FAST GROUND HEIGHT CALCULATION (No mass raycasting over thousands of meshes)
                    const impactY = 0.20;
                    const hitMap  = true;

                    // Lanzar el rayo fluido
                    this.triggerLightning(targetX, impactY, targetZ, hitMap);

                    if (this.thunderSound && this.thunderSound.buffer) {
                        if (this.thunderSound.isPlaying) this.thunderSound.stop();
                        this.thunderSound.setPlaybackRate(0.75 + Math.random() * 0.35);
                        const delaySec = Math.min(offsetDist / 340, 2.0);
                        setTimeout(() => {
                            if (this.stormPhase === 'RAIN' && this.thunderSound) {
                                this.thunderSound.play();
                            }
                        }, delaySec * 1000);
                    }
                }

                // Parpadeo secundario aleatorio
                if (Math.random() > 0.45) {
                    this.flashLight.intensity *= 0.35;
                    this.lightningLife *= 0.5;
                } else {
                    this.flashLight.intensity *= 1.25;
                    this.lightningLife = Math.min(1.0, this.lightningLife * 1.2);
                }
            }
        }

        // Progressive smooth flash extinction and line fade-out
        if (this.lightningLife > 0) {
            this.lightningLife *= 0.78;
            this.flashLight.intensity *= 0.78;

            this.matCore.opacity   = this.lightningLife * 1.0;
            this.matBlue.opacity   = this.lightningLife * 0.85;
            this.matOrange.opacity = this.lightningLife * 0.50;

            if (this.lightningLife < 0.02) {
                this.lightningLife = 0;
                this.flashLight.intensity = 0;
                this.lineCore.geometry.setDrawRange(0, 0);
                this.lineBlue.geometry.setDrawRange(0, 0);
                this.lineOrange.geometry.setDrawRange(0, 0);
            }
        }

        // Smooth out and extinguish camera shake
        if (this.cameraShakeStrength > 0.001) {
            this.cameraShakeStrength = THREE.MathUtils.lerp(this.cameraShakeStrength, 0.0, dt * 5.0);
        }

        // Spark physics and movement (ground bounce and gravity)
        const posArr = this.sparkGeometry.attributes.position.array;
        for (let i = 0; i < this.sparkCount; i++) {
            if (this.sparkLifes[i] > 0) {
                this.sparkLifes[i] -= dt;
                posArr[i * 3]     += this.sparkVelocities[i].x * dt;
                posArr[i * 3 + 1] += this.sparkVelocities[i].y * dt;
                posArr[i * 3 + 2] += this.sparkVelocities[i].z * dt;

                this.sparkVelocities[i].y -= 42 * dt; // Gravedad

                const floorY = this.sparkParticles.userData.impactY ?? 0.20;
                if (posArr[i * 3 + 1] <= floorY) {
                    posArr[i * 3 + 1] = floorY;
                    this.sparkVelocities[i].y *= -0.45; // Rebote
                    this.sparkVelocities[i].x *= 0.65;  // Friction
                    this.sparkVelocities[i].z *= 0.65;
                }
            } else {
                posArr[i * 3 + 1] = -500; // Esconder
            }
        }
        this.sparkGeometry.attributes.position.needsUpdate = true;

        // Modificar color de la niebla durante flashes
        if (this.stormPhase === 'RAIN' && this.flashLight.intensity > 100 && timeCycle) {
            const flashRatio = Math.min(this.flashLight.intensity / 150000, 1.0);
            if (this.scene.fog) {
                this.scene.fog.color.lerp(this._flashFogColor, flashRatio * 0.8);
            }
        }
    }

    clearLightningGroup() {
        this.lightningLife = 0;
        this.flashLight.intensity = 0;
        this.lineCore.geometry.setDrawRange(0, 0);
        this.lineBlue.geometry.setDrawRange(0, 0);
        this.lineOrange.geometry.setDrawRange(0, 0);
    }

    triggerLightning(targetX, targetY, targetZ, hitMap) {
        this._vecPoolIndex = 0; // Reiniciar pool de vectores

        const startPoint = this._allocVec().set(
            targetX + (Math.random() - 0.5) * 15,
            350,
            targetZ + (Math.random() - 0.5) * 15
        );
        const endPoint = this._allocVec().set(targetX, targetY, targetZ);
        const mainPoints = this._getLightningPointsInPool(startPoint, endPoint, 12, 0.4);

        let vertCount = 0;

        const addSegment = (p1, p2) => {
            if (vertCount + 2 > MAX_LIGHTNING_VERTICES) return;

            const idx = vertCount * 3;

            // White Core (main lightning thickness)
            this._posCore[idx]     = p1.x + (Math.random() - 0.5) * 0.75;
            this._posCore[idx + 1] = p1.y;
            this._posCore[idx + 2] = p1.z + (Math.random() - 0.5) * 0.75;

            this._posCore[idx + 3] = p2.x + (Math.random() - 0.5) * 0.75;
            this._posCore[idx + 4] = p2.y;
            this._posCore[idx + 5] = p2.z + (Math.random() - 0.5) * 0.75;

            // Electric Blue Halo (medium glow)
            this._posBlue[idx]     = p1.x + (Math.random() - 0.5) * 2.4;
            this._posBlue[idx + 1] = p1.y;
            this._posBlue[idx + 2] = p1.z + (Math.random() - 0.5) * 2.4;

            this._posBlue[idx + 3] = p2.x + (Math.random() - 0.5) * 2.4;
            this._posBlue[idx + 4] = p2.y;
            this._posBlue[idx + 5] = p2.z + (Math.random() - 0.5) * 2.4;

            // Resplandor Naranja Fuego (Halo amplio)
            this._posOrange[idx]     = p1.x + (Math.random() - 0.5) * 4.5;
            this._posOrange[idx + 1] = p1.y;
            this._posOrange[idx + 2] = p1.z + (Math.random() - 0.5) * 4.5;

            this._posOrange[idx + 3] = p2.x + (Math.random() - 0.5) * 4.5;
            this._posOrange[idx + 4] = p2.y;
            this._posOrange[idx + 5] = p2.z + (Math.random() - 0.5) * 4.5;

            vertCount += 2;
        };

        // 1. Trazar tronco principal
        for (let i = 0; i < mainPoints.length - 1; i++) {
            addSegment(mainPoints[i], mainPoints[i + 1]);
        }

        // 2. Ramificaciones (zarcillos)
        const numBranches = Math.floor(Math.random() * 5) + 3;
        for (let b = 0; b < numBranches; b++) {
            const attachIdx = Math.floor(Math.random() * Math.max(1, mainPoints.length - 8)) + 4;
            if (attachIdx >= mainPoints.length) continue;

            const bStart = mainPoints[attachIdx];
            const bDir = this._allocVec().set(
                (Math.random() - 0.5) * 35,
                -Math.random() * 25,
                (Math.random() - 0.5) * 35
            );
            const bEnd = this._allocVec().addVectors(bStart, bDir);
            const bPoints = this._getLightningPointsInPool(bStart, bEnd, 6, 0.35);

            for (let i = 0; i < bPoints.length - 1; i++) {
                addSegment(bPoints[i], bPoints[i + 1]);
            }
        }

        // Update pre-allocated geometries without creating or destroying Three.js objects
        const geoCore   = this.lineCore.geometry;
        const geoBlue   = this.lineBlue.geometry;
        const geoOrange = this.lineOrange.geometry;

        geoCore.setDrawRange(0, vertCount);
        geoBlue.setDrawRange(0, vertCount);
        geoOrange.setDrawRange(0, vertCount);

        geoCore.attributes.position.needsUpdate   = true;
        geoBlue.attributes.position.needsUpdate   = true;
        geoOrange.attributes.position.needsUpdate = true;

        // Configure flash light (alternating Electric Blue or Golden Yellow)
        this.flashLight.color.setHex(Math.random() > 0.4 ? 0x00bfff : 0xffaa00);
        this.flashLight.position.copy(endPoint);
        this.flashLight.position.y += 4;
        this.flashLight.intensity = 160000 + Math.random() * 60000;

        this.lightningLife = 1.0;
        this.matCore.opacity   = 1.0;
        this.matBlue.opacity   = 0.85;
        this.matOrange.opacity = 0.50;

        // Fire sparks at the impact position
        this.spawnSparks(endPoint, targetY);

        // Intense camera shake on impact
        if (hitMap) {
            this.cameraShakeStrength = 5.8 + Math.random() * 3.5;
        } else {
            this.cameraShakeStrength = 0.0;
        }
    }

    spawnSparks(impactPos, targetY) {
        this.sparkParticles.userData.impactY = targetY;
        const posArr = this.sparkGeometry.attributes.position.array;

        for (let i = 0; i < this.sparkCount; i++) {
            posArr[i * 3]     = impactPos.x;
            posArr[i * 3 + 1] = impactPos.y + 0.1;
            posArr[i * 3 + 2] = impactPos.z;

            // 3D spark explosion
            const angle     = Math.random() * Math.PI * 2;
            const speed     = 12 + Math.random() * 28;
            const elevation = Math.random() * Math.PI * 0.45;

            this.sparkVelocities[i].set(
                Math.cos(angle) * Math.cos(elevation) * speed,
                Math.sin(elevation) * speed + 6,
                Math.sin(angle) * Math.cos(elevation) * speed
            );

            this.sparkLifes[i] = 0.5 + Math.random() * 1.3;
        }
        this.sparkGeometry.attributes.position.needsUpdate = true;
    }
}
