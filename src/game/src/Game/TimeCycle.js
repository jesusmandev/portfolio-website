import * as THREE from 'three';

export class TimeCycle {
    constructor(scene) {
        this.scene = scene;

        // Tiempos en segundos (total = 1020s)
        this.timeSettings = {
            day: 300,
            sunset: 180,
            night: 300,
            sunrise: 240
        };
        this.totalCycleTime = 1020;
        
        // Estado inicial
        this.currentTime = 0; // Segundos
        this.galloPlayed = false; // Bandera para reproducir el gallo solo una vez por amanecer
        this.galloSound = null;
        this.audioLoader = new THREE.AudioLoader();

        this.initSky();
        this.initLights();
    }

    initSky() {
        this.sun = new THREE.Vector3();

        // ── Custom Sky Dome Creation with Shader for Artistic Styles ──
        const skyGeo = new THREE.SphereGeometry(1500, 32, 20);
        
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                timeOfDay:  { value: 0.0 }, // 0: Day, 1: Sunset, 2: Night, 3: Dawn
                transition: { value: 0.0 }  // 0.0 a 1.0
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float timeOfDay;
                uniform float transition;
                varying vec3 vWorldPosition;

                // Hash pseudo-aleatorio simple para las estrellas de noche
                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }

                void main() {
                    vec3 dir = normalize(vWorldPosition);
                    float h = clamp(dir.y, 0.0, 1.0); // Altura en el hemisferio superior

                    // Sky color palettes based exactly on the reference images
                    // Day (Image 2): Solid bright sky blue
                    vec3 cDayTop    = vec3(0.09, 0.45, 0.95); // Azul cielo brillante (#1773f2)
                    vec3 cDayBottom = vec3(0.20, 0.56, 0.98); // Lighter blue (#3290ff)

                    // Sunset / Dawn (Images 3 and 4): Indigo blue to purple/pink gradient
                    vec3 cSunsetTop    = vec3(0.11, 0.19, 0.36); // Dark indigo blue (#1d305c)
                    vec3 cSunsetBottom = vec3(0.50, 0.29, 0.42); // Warm purple/pink (#804a6c)

                    // Noche (Imagen 1): Azul marino oscuro profundo con estrellas
                    vec3 cNightTop    = vec3(0.01, 0.10, 0.18); // Azul marino oscuro (#021a30)
                    vec3 cNightBottom = vec3(0.02, 0.14, 0.24); // Azul marino base (#05243d)

                    vec3 topColor = vec3(0.0);
                    vec3 bottomColor = vec3(0.0);

                    // Smooth interpolation between the 4 phases
                    if (timeOfDay == 0.0) { // Day to Sunset
                        topColor    = mix(cDayTop, cSunsetTop, transition);
                        bottomColor = mix(cDayBottom, cSunsetBottom, transition);
                    } else if (timeOfDay == 1.0) { // Atardecer a Noche
                        topColor    = mix(cSunsetTop, cNightTop, transition);
                        bottomColor = mix(cSunsetBottom, cNightBottom, transition);
                    } else if (timeOfDay == 2.0) { // Noche a Amanecer
                        topColor    = mix(cNightTop, cSunsetTop, transition);
                        bottomColor = mix(cNightBottom, cSunsetBottom, transition);
                    } else { // Dawn to Day
                        topColor    = mix(cSunsetTop, cDayTop, transition);
                        bottomColor = mix(cSunsetBottom, cDayBottom, transition);
                    }

                    vec3 finalColor = mix(bottomColor, topColor, h);

                    // ── Estrellas multicolores en la Noche (Imagen 1) ─────────────────
                    float nightFactor = 0.0;
                    if (timeOfDay == 1.0) {
                        nightFactor = transition; // Aparecen en atardecer -> noche
                    } else if (timeOfDay == 2.0) {
                        nightFactor = 1.0 - transition; // Desaparecen en noche -> amanecer
                    } else if (timeOfDay == 3.0) {
                        nightFactor = 0.0;
                    }
                    
                    bool isNight = (timeOfDay == 2.0);

                    if (isNight || nightFactor > 0.0) {
                        float actualNight = isNight ? 1.0 : nightFactor;
                        // XZ mapping so stars stay fixed on the dome
                        vec2 skyCoords = dir.xz / (dir.y + 0.001) * 320.0;
                        float starVal = hash(floor(skyCoords));
                        
                        if (starVal > 0.994 && dir.y > 0.05) {
                            // Centelleo/Flicker sutil en base a coordenadas para que parpadeen de forma desfasada
                            float starIntensity = sin(skyCoords.x * 2.0 + skyCoords.y * 3.0) * 0.45 + 0.55;
                            
                            // Estrellas de colores pastel sutiles (magenta, cian, amarillo, blanco) como en la Imagen 1
                            vec3 starColor = vec3(1.0);
                            if (starVal > 0.998) {
                                starColor = vec3(0.95, 0.45, 0.85); // Magenta pastel
                            } else if (starVal > 0.997) {
                                starColor = vec3(0.35, 0.95, 0.90); // Cian pastel
                            } else if (starVal > 0.996) {
                                starColor = vec3(0.95, 0.90, 0.45); // Amarillo pastel
                            }
                            
                            finalColor += starColor * (starIntensity * actualNight * 0.9);
                        }
                    }

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false
        });

        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyMesh);

        // ── HD Pastel Artistic Palettes for Day and Night ───────────────────────
        this.palettes = {
            day: {
                dirLight:   new THREE.Color(0xffd2bd),      // Bright warm peach
                ambLight:   new THREE.Color(0xffebd6),      // Warm cream
                hemiSky:    new THREE.Color(0xffcca3),      // Orange pastel sky tone
                hemiGround: new THREE.Color(0x857061),      // Brown/peach ground reflection
                fog:        new THREE.Color(0xffcca3),      // Daytime peach fog
                ground:     new THREE.Color(0xff9e59),      // Warm pastel island peach/salmon ground
                grass:      new THREE.Color(0xd6e35d),      // Lime green/pastel yellow grass
                leafA:      new THREE.Color(0xff8ca3),      // Pastel pink leaves
                leafB:      new THREE.Color(0xff6e4a),      // Pastel orange leaves
                leafC:      new THREE.Color(0xffd066),      // Pastel yellow leaves
                rock:       new THREE.Color(0x8f98a6),      // Pastel bluish-grey rocks
                water:      new THREE.Color(0x0f6b86)       // Ocean blue #0f6b86
            },
            night: {
                dirLight:   new THREE.Color(0x5a709a),      // Luz de luna clara
                ambLight:   new THREE.Color(0x425278),      // Ambiente nocturno suave y claro
                hemiSky:    new THREE.Color(0x405075),      // Hemisferio cielo azul noche
                hemiGround: new THREE.Color(0x202838),      // Hemisferio suelo
                fog:        new THREE.Color(0x1c263b),      // Niebla nocturna suave
                ground:     new THREE.Color(0x4a5068),      // Visible blue/grey ground
                grass:      new THREE.Color(0x446050),      // Visible night grass
                leafA:      new THREE.Color(0x7c62b3),      // Hojas lavanda
                leafB:      new THREE.Color(0xa84d85),      // Hojas magenta suave
                leafC:      new THREE.Color(0x3d3866),      // Indigo blue leaves
                rock:       new THREE.Color(0x454b60),      // Rocas noche
                water:      new THREE.Color(0x1848a0)       // Agua azul noche
            }
        };

        // Colores interpolados activos en cada frame
        this.currentColorGround = new THREE.Color();
        this.currentColorGrass  = new THREE.Color();
        this.currentColorLeafA  = new THREE.Color();
        this.currentColorLeafB  = new THREE.Color();
        this.currentColorLeafC  = new THREE.Color();
        this.currentColorRock   = new THREE.Color();
        this.currentColorWater  = new THREE.Color();

        this._tmpColor = new THREE.Color(); // Reutilizado para operaciones lerp
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Aumentado para que los colores se vean bien
        this.scene.add(this.ambientLight);
        
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); // Luz de cielo/suelo para no dejar zonas completamente oscuras
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 2);
        this.dirLight.castShadow = true;
        // Shadow map 1024×1024: buena calidad con menos costo que 2048 (4× menos texels)
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        
        // Frustum reducido: 200 unidades cubre lo visible alrededor del jugador
        // without wasting resolution in areas outside the field of view
        const d = 200;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 800;
        this.dirLight.shadow.bias = 0.0001;
        this.dirLight.shadow.normalBias = 0.02; // Prevents self-shadowing (black artifact on large geometries)

        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);
    }

    initAudio(listener) {
        this.galloSound = new THREE.Audio(listener);
        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
        this.audioLoader.load(`${baseUrl}/audios/gallo/gallo.mp3`, (buffer) => {
            if (this.galloSound) {
                this.galloSound.setBuffer(buffer);
                this.galloSound.setVolume(0.8);
            }
        });
    }

    update(delta, playerPos = null) {
        if (!delta || isNaN(delta) || delta <= 0) delta = 0.016;
        if (isNaN(this.currentTime)) this.currentTime = 0;
        this.currentTime = (this.currentTime + delta) % this.totalCycleTime;
        
        let phase = '';
        let phaseProgress = 0;

        const { day, sunset, night, sunrise } = this.timeSettings;
        let timeOfDayVal = 0.0;
        
        if (this.currentTime < day) {
            phase = 'day';
            phaseProgress = this.currentTime / day;
            timeOfDayVal = 0.0; // Day to Sunset
        } else if (this.currentTime < day + sunset) {
            phase = 'sunset';
            phaseProgress = (this.currentTime - day) / sunset;
            timeOfDayVal = 1.0; // Atardecer a Noche
        } else if (this.currentTime < day + sunset + night) {
            phase = 'night';
            phaseProgress = (this.currentTime - (day + sunset)) / night;
            timeOfDayVal = 2.0; // Noche a Amanecer
            // Reset flag at night so it can sing again at the next dawn
            this.galloPlayed = false;
        } else {
            phase = 'sunrise';
            phaseProgress = (this.currentTime - (day + sunset + night)) / sunrise;
            timeOfDayVal = 3.0; // Dawn to Day

            // Reproducir gallo al iniciar la fase de amanecer (sunrise)
            if (!this.galloPlayed) {
                this.galloPlayed = true;
                if (this.galloSound && this.galloSound.buffer) {
                    if (this.galloSound.isPlaying) this.galloSound.stop();
                    this.galloSound.play();
                }
            }
        }

        if (isNaN(phaseProgress)) phaseProgress = 0;

        this.updateSunPosition(phase, phaseProgress, playerPos);
        this.updateLighting(phase, phaseProgress);

        // Actualizar los uniformes del shader de cielo
        if (this.skyMesh && this.skyMesh.material && this.skyMesh.material.uniforms) {
            this.skyMesh.material.uniforms.timeOfDay.value = timeOfDayVal;
            this.skyMesh.material.uniforms.transition.value = phaseProgress;
        }
    }

    updateSunPosition(phase, progress, playerPos = null) {
        let elevation = 0;
        let azimuth = 0; // You can make it dynamic if you want the sun to orbit; for simplicity we move it side to side.

        if (phase === 'day') {
            elevation = 90 - (progress * 90); // Va de 90 a 0 (aunque el pico debe ser arriba)
            elevation = Math.max(10, 90 - Math.abs(progress - 0.5) * 180);
        } else if (phase === 'sunset') {
            elevation = 10 - (progress * 20); // 10 a -10
        } else if (phase === 'night') {
            elevation = -10 - (progress * 80); // Sol oculto
        } else if (phase === 'sunrise') {
            elevation = -90 + (progress * 100); // -90 a 10
        }

        const phi = THREE.MathUtils.degToRad(90 - elevation);
        // Make the sun rotate around the Y axis during the day.
        const theta = THREE.MathUtils.degToRad((this.currentTime / this.totalCycleTime) * 360);

        this.sun.setFromSphericalCoords(1, phi, theta);
        
        // Mover la directional light centrada hacia la zona donde se encuentra el jugador
        const cx = playerPos ? playerPos.x : -200;
        const cz = playerPos ? playerPos.z : 0;
        
        this.dirLight.target.position.set(cx, 0, cz);
        this.dirLight.target.updateMatrixWorld();

        this.dirLight.position.set(
            cx + this.sun.x * 400,
            Math.max(50, this.sun.y * 400),
            cz + this.sun.z * 400
        );
    }

    updateLighting(phase, progress) {
        let t = 0; // 0 = day, 1 = night
        if (phase === 'day') {
            t = 0;
            this.dirLight.intensity = 2.2;
            this.ambientLight.intensity = 0.55;
            if (this.hemiLight) this.hemiLight.intensity = 0.6;
        } else if (phase === 'sunset') {
            t = progress;
            this.dirLight.intensity = THREE.MathUtils.lerp(2.2, 0.55, progress);
            this.ambientLight.intensity = THREE.MathUtils.lerp(0.55, 0.70, progress);
            if (this.hemiLight) this.hemiLight.intensity = THREE.MathUtils.lerp(0.6, 0.65, progress);
        } else if (phase === 'night') {
            t = 1;
            this.dirLight.intensity = 0.55;
            this.ambientLight.intensity = 0.70; // Clear ambient light at night
            if (this.hemiLight) this.hemiLight.intensity = 0.65;
        } else if (phase === 'sunrise') {
            t = 1 - progress;
            this.dirLight.intensity = THREE.MathUtils.lerp(0.55, 2.2, progress);
            this.ambientLight.intensity = THREE.MathUtils.lerp(0.70, 0.55, progress);
            if (this.hemiLight) this.hemiLight.intensity = THREE.MathUtils.lerp(0.65, 0.6, progress);
        }

        this.nightFactor = t;
        this.isNight = t > 0.3;

        const d = this.palettes.day;
        const n = this.palettes.night;

        // Interpolar colores de luces y niebla
        this.dirLight.color.lerpColors(d.dirLight, n.dirLight, t);
        this.ambientLight.color.lerpColors(d.ambLight, n.ambLight, t);
        if (this.hemiLight) {
            this.hemiLight.color.lerpColors(d.hemiSky, n.hemiSky, t);
            this.hemiLight.groundColor.lerpColors(d.hemiGround, n.hemiGround, t);
        }

        if (this.scene && this.scene.fog) {
            this.scene.fog.color.lerpColors(d.fog, n.fog, t);
            this.scene.background = this.scene.fog.color;
        }

        // Interpolate aesthetic map colors (read from Environment and CityBuilder)
        this.currentColorGround.lerpColors(d.ground, n.ground, t);
        this.currentColorGrass.lerpColors(d.grass, n.grass, t);
        this.currentColorLeafA.lerpColors(d.leafA, n.leafA, t);
        this.currentColorLeafB.lerpColors(d.leafB, n.leafB, t);
        this.currentColorLeafC.lerpColors(d.leafC, n.leafC, t);
        this.currentColorRock.lerpColors(d.rock, n.rock, t);
        this.currentColorWater.lerpColors(d.water, n.water, t);
    }
}
