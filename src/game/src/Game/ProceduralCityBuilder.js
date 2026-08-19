/**
 * ProceduralCityBuilder — Construye la ciudad 3D proceduralmente con Three.js.
 * ProceduralCityBuilder — Build the 3D city procedurally with Three.js.
 *
 * Extracted from `index copy.html` and adapted to integrate into the game scene.
 * Keeps the same API as CityBuilder (cityGroundMaterials, cityLeafMaterials, 
 * cityBarkMaterials, update(), grassUniforms).
 *
 * The city is built as a THREE.Group and positioned with an offset to fit 
 * into the game world. A Rapier cuboid collider covers the flat ground 
 * so the character can walk on it.
 *
 * COLLISION SETTINGS:
 * - Ground is divided into grass level and plaza/asphalt level.
 * - Automatic colliders are registered for each building from its local 
 *   bounding box, preventing the character from passing through buildings.
 * - Cylindrical colliders are registered for each tree instance.
 * - Decorative grass (shader blades) does not generate collision.
 */
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader }     from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AssetCache }  from '../Intro/AssetCache.js';
import { createTreeManager } from './assets/trees.js';
import { createPalmManager } from './assets/palms.js';
import { FerrisWheel }      from './assets/ferris wheel.js';
import { Bandera }          from './assets/flag.js';
import { FlagsExhibition }  from './assets/flags.js';
import { LogoInteraction }  from './assets/logo.js';
import { TextFrontendDeveloper } from './textFrontendDeveloper.js';
import { TextFreelancer } from './textFreelancer.js';
import { Speaker3D } from './speaker.js';
import { JoystickInteraction } from './assets/joystick.js';
import { RubikCubeInteraction } from './rubikCube.js';
import { SoccerField } from './SoccerField.js';
import { BasketballField } from './Basketball Field.js';
import { Windmill } from './Windmill.js';
import { Robot3D } from './assets/Robot.js';
import { WaterTower } from './assets/tower.js';



// ============================================================
// CONSTANTS (identical to original HTML)
// ============================================================
const BLOCK = 54, ROAD = 14, CELL = BLOCK + ROAD, CITY_PAD = BLOCK * 3 + ROAD * 2;
const MAP_SIZE = 340, ZONE_Y = 0.9;
const P = -CELL, ZQ = 0, N = CELL;
const mapHalf = MAP_SIZE / 2;
const GRASS_BUF = 24, RING_W = 22;
const grassOuterHalf = mapHalf + GRASS_BUF;
const roadInnerHalf = grassOuterHalf;
const roadOuterHalf = roadInnerHalf + RING_W;
const farGrassHalf = roadOuterHalf + 20;
const CITY_EDGE_X = CITY_PAD / 2;

// Visual height of the top face of grass (outside the plaza)
const GRASS_TOP_Y = 0.4;

// ============================================================
// COLORS AND MATERIALS
// ============================================================
const C = {
    dirt: 0x523b26, asphalt: 0x2e2e32, line: 0xdeded8, sidewalk: 0x88888f,
    grass: 0x8fce2a, grassDark: 0x74b826, grassLime: 0x8be61a, grassLimeDark: 0x6ec213, wall: 0xe4e1d9, wallCap: 0xccccc2,
    parking: 0x3c6488, glass: 0x152230, frame: 0x3a3d42, sill: 0x8a8a92,
    plinthDark: 0x55555c, cornice: 0xf0f0ed, metal: 0x7a828a, ac: 0xdbdad5, vent: 0x2a2a2d,
    hospitalMain: 0xf2f2f5, hospitalSec: 0xdedee5, redCross: 0xb52b2b,
    aptA: 0xbdbebf, aptB: 0xa5a5aa, wood: 0x7a5035,
    factoryBrick: 0xb05531, factoryGrey: 0x7a7a82, factoryRoof: 0x3b3d40,
    houseYellow: 0xe3d8b1, houseBlue: 0x8fa4b3, roofTerra: 0xa35a3d, roofDark: 0x4a4f54,
    treeTrunk: 0x4a3424, leavesA: 0x628c3d, leavesB: 0x496e2a
};

function makeMat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...extra });
}

export class ProceduralCityBuilder {
    /**
     * @param {THREE.Scene} scene
     * @param {RAPIER.World} physicsWorld
     * @param {Function} onReady  — called when city is ready
     * @param {Object}  options
     * @param {number}  options.offsetX  — X offset in game world
     * @param {number}  options.offsetY  — Y offset in game world
     * @param {number}  options.offsetZ  — Z offset in game world
     * @param {number}  options.scale    — uniform scale
     */
    constructor(scene, physicsWorld, onReady, options = {}) {
        this.scene        = scene;
        this.physicsWorld = physicsWorld;
        this.onReady      = onReady;

        // City group position/scale in world space
        this.offsetX = options.offsetX ?? -350;
        this.offsetY = options.offsetY ?? -1.0;
        this.offsetZ = options.offsetZ ??  200;
        this.cityScale = options.scale  ??  1.0;

        // Tiering configuration for mobile/desktop performance
        this.tierConfig         = options.tierConfig || null;
        this.MAX_TOTAL_BLADES   = this.tierConfig?.maxGrassBlades ?? 70000;
        this.treeDensityFactor = this.tierConfig?.treeDensityFactor ?? 1.0;
        this.bushDensityFactor = this.tierConfig?.bushDensityFactor ?? 1.0;

        // Material sets for day/night cycle (compatible with CityBuilder API)
        this.cityGroundMaterials = new Set();
        this.cityLeafMaterials   = new Set();
        this.cityBarkMaterials   = new Set();

        // List of grass ShaderMaterials to update the time uniform each frame
        this.grassUniforms = [];

        // EXPLICIT registry of green zones (rectangles in local space of
        // cityGroup). Grass visual mesh always matches these coordinates.
        this._grassZones = [];

        // Geometry cache (prevents duplicates)
        this._geoCache = {};

        // Instanced tree manager (multiple types + procedural foliage)
        this._treeManager = null;

        // Lamp arm geometry (shared)
        this._lampArmGeo = null;

        // Registry of colliders to create in Rapier
        this._colliders = [];
        this._treeColliders = [];
        this._registeredBuildings = new Set();

        // Optimized grass parameters
        this.GRASS_DENSITY = 2.2;          // instances per m²
        this.GRASS_BLADE_H = 1.15;         // taller blades for bushy appearance
        this.GRASS_BATCH   = 18000;        // balanced batches

        this._build();
    }

    // ─────────────────────────────────────────────────────────────────
    //  PUBLIC API
    // ─────────────────────────────────────────────────────────────────

    update(delta, timeCycle, playerPos) {
        const t = performance.now() * 0.001;
        for (const mat of this.grassUniforms) {
            if (mat && mat.uniforms) mat.uniforms.time.value = t;
        }
        if (this._treeManager)  this._treeManager.update(t);
        if (this._palmManager)  this._palmManager.update(t);
        if (this._ferrisWheel)  this._ferrisWheel.update(delta, timeCycle);
        if (this._bandera)      this._bandera.update(delta);
        if (this._flagsExhibition) this._flagsExhibition.update(delta);
        if (this._logo)         this._logo.update(delta, playerPos);
        if (this._logoAboutMe)  this._logoAboutMe.update(delta, playerPos);
        if (this._logoCV)       this._logoCV.update(delta, playerPos);
        if (this._logoRubik)    this._logoRubik.update(delta, playerPos);
        if (this._frontendDeveloperText) this._frontendDeveloperText.update(delta);
        if (this._freelancerText)        this._freelancerText.update(delta);
        if (this._speaker)               this._speaker.update(delta, playerPos);
        if (this._joystick)              this._joystick.update(delta, playerPos);
        if (this._rubikCube)             this._rubikCube.update(playerPos);
        if (this._windmill)              this._windmill.update(delta, playerPos);
        if (this._robot)                 this._robot.update(delta);

        // ── Proximity notifications to locations (LocationNoticeToast) ──────
        let activeNotice = null;
        if (playerPos) {
            const px = playerPos.x;
            const pz = playerPos.z;

            // 1. Basketball Field (World pos photo 1: X: -734.43, Z: -217.75)
            const dxB = px - (-734.43);
            const dzB = pz - (-217.75);
            const nearBasketball = (dxB * dxB + dzB * dzB <= 4900.0); // 70m radius

            // 2. Soccer Field (World pos photo 4: X: 99.37, Z: 28.68)
            const dxS = px - 99.37;
            const dzS = pz - 28.68;
            const nearSoccer = (dxS * dxS + dzS * dzS <= 6400.0); // 80m radius

            // 3. Colombia Flag (World pos photo 3: X: -218.15, Z: 318.23)
            const dxBandera = px - (-218.15);
            const dzBandera = pz - 318.23;
            const nearBandera = (dxBandera * dxBandera + dzBandera * dzBandera <= 900.0); // 30m radius

            // 4. World Flags (World pos photo 2: X: -438.45, Z: 336.82)
            const dxFlags = px - (-438.45);
            const dzFlags = pz - 336.82;
            const nearFlags = (dxFlags * dxFlags + dzFlags * dzFlags <= 1600.0); // 40m radius

            if (nearBasketball) {
                activeNotice = { id: 'basketball', text: 'I like basketball.', icon: '🏀', tag: 'HOBBY', accent: '#ff8800' };
            } else if (nearSoccer) {
                activeNotice = { id: 'soccer', text: 'I like soccer.', icon: '⚽', tag: 'HOBBY', accent: '#00ff88' };
            } else if (nearBandera) {
                activeNotice = { id: 'colombia', text: "I'm from Colombia", icon: '🇨🇴', tag: 'ORIGIN', accent: '#fcd116' };
            } else if (nearFlags) {
                activeNotice = { id: 'flags', text: 'Countries I want to visit', icon: '✈️', tag: 'DESTINATIONS', accent: '#00c3ff' };
            }
        }

        const activeId = activeNotice ? activeNotice.id : null;
        if (activeId !== this._lastNoticeId) {
            this._lastNoticeId = activeId;
            window.dispatchEvent(new CustomEvent('location:notice', { detail: activeNotice }));
        }


        // ── Fireflies and lamppost night state ─────────────────────────────
        const nightFactor = timeCycle ? (timeCycle.nightFactor ?? (timeCycle.isNight ? 1.0 : 0.0)) : 0.0;
        if (this._M && this._M.lampGlow) {
            this._M.lampGlow.emissive.setHex(0xffaa33);
            this._M.lampGlow.emissiveIntensity = 0.1 + nightFactor * 2.5;
        }

        // Firefly animation around lampposts (night only)
        if (this._fireflyMat) {
            this._fireflyMat.opacity = nightFactor * 0.85;
        }
        if (this._fireflyPoints && nightFactor > 0.01 && this._firefliesData) {
            const t = performance.now() * 0.001;
            const pos = this._fireflyPoints.geometry.attributes.position.array;
            for (let i = 0; i < this._firefliesData.length; i++) {
                const d = this._firefliesData[i];
                const angle = t * d.speed + d.phase;
                pos[i * 3]     = d.x + Math.sin(angle) * d.radius;
                pos[i * 3 + 1] = d.y + Math.sin(t * 1.8 + d.phase) * d.heightVar;
                pos[i * 3 + 2] = d.z + Math.cos(angle) * d.radius;
            }
            this._fireflyPoints.geometry.attributes.position.needsUpdate = true;
        }
    }

    _build() {
        // City root group
        this._cityGroup = new THREE.Group();
        this._cityGroup.name = 'CityGroup';
        this._cityGroup.position.set(this.offsetX, this.offsetY, this.offsetZ);
        this._cityGroup.scale.setScalar(this.cityScale);
        this.scene.add(this._cityGroup);

        this._lampHeadPositions = [];

        // Shared materials
        this._M = this._buildMaterials();

        // Instanced meshes for trees/bushes
        this._initTreeInstances();

        // Build city geometry
        this._buildGround();
        this._buildStreetConnectors();
        this._buildPerimeterRing();
        this._buildBeachSkirt();
        this._buildMainBlocks();
        this._buildPerimeterTrees();
        this._buildStreetLamps();
        this._buildUrbanFurniture();
        this._buildNeighborhoods();
        this._cleanWaterTowerZone();

        // Build soccer field in east green zone
        this._soccerField = new SoccerField(this._cityGroup, {
            x: 144.5,
            y: 0.40,
            z: 0,
            fieldLength: 92,
            fieldWidth: 46
        });
        if (this._soccerField.colliders) {
            this._colliders.push(...this._soccerField.colliders);
        }

        // Build basketball field with pole outside the blue zone
        this._basketballField = new BasketballField(this._cityGroup, {
            x: -145.0,
            y: 0.40,
            z: -65.0,
            courtWidth: 84,
            courtLength: 32,
            rotationY: 0
        });
        if (this._basketballField.colliders) {
            this._colliders.push(...this._basketballField.colliders);
        }

        // ── Windmill (in world, outside cityGroup) ──────────────
        // rotationY: blades point towards X:-599,Z:267 from X:-610,Z:307
        // dx=11, dz=-40  →  atan2(11, -40) ≈ 2.87 rad  (≈ 165°)
        this._windmill = new Windmill(this.scene, {
            x: -610,
            y: 0.20,
            z: 307,
            scale: 5.0,
            rotorSpeed: 1.2,
            audioRadius: 130,
            rotationY: Math.atan2(11, -40)
        });

        // ── Giant Low Poly Robot ──────────────────────────────────────────
        // Position: X: -44.44, Y: 0.20, Z: 520.20
        // Facing towards X: -48.70, Z: 496.16 (dx = -4.26, dz = -24.04)
        this._robot = new Robot3D(this.scene, {
            x: -44.44,
            y: 0.20,
            z: 520.20,
            scale: 3.5,
            rotationY: Math.atan2(-4.26, -24.04),
            physicsWorld: this.physicsWorld
        });
        if (this._robot.colliders) {
            this._colliders.push(...this._robot.colliders);
        }

        // Finalize tree/bush instances
        this._finalizeInstances();

        // Gather building and tree colliders BEFORE merging
        this._collectColliders();

        // Generate grass INSIDE cityGroup
        this._buildGrassFields();

        // Physics: ground + buildings + trees
        this._addGroundPhysics();

        if (this.onReady) this.onReady(this);
        console.log('[ProceduralCityBuilder] City built correctly.');

        // Large tree at fixed world position (outside cityGroup)
        this._placeBigTree(7.77, 0.20, -356.69);

        // Ferris Wheel — position according to visual indicator (0.20, 0.20, 336.33), larger and with physics collision
        this._ferrisWheel = new FerrisWheel(this.scene, {
            physicsWorld: this.physicsWorld,
            x: 0.20,
            y: 0.20,
            z: 336.33,
            scale: 2.2
        });

        // Colombia Flag — position according to visual indicator (-218.80, 0.20, 319.82) with physics collision
        this._bandera = new Bandera(this.scene, {
            physicsWorld: this.physicsWorld,
            x: -218.80,
            y: 0.20,
            z: 319.82,
            scale: 1.0
        });

        // Airplane Exhibition with World Flags (X: -459.61, Y: 0.20, Z: 355.43)
        this._flagsExhibition = new FlagsExhibition(this.scene, {
            physicsWorld: this.physicsWorld,
            x: -459.61,
            y: 0.20,
            z: 355.43,
            airplaneScale: 25.0
        });

        // ── Large 3D Water Tower (Position X: 166.00, Y: 0.20, Z: -426.84) ──
        // Remove houses or buildings from the map that match that area
        const towerPos = new THREE.Vector3(166.00, 0, -426.84);
        const tempWPos = new THREE.Vector3();
        this._cityGroup.traverse(child => {
            if (child.isGroup && child.userData && child.userData.isBuilding) {
                child.getWorldPosition(tempWPos);
                if (Math.hypot(tempWPos.x - towerPos.x, tempWPos.z - towerPos.z) < 40) {
                    child.visible = false;
                    child.position.set(0, -9999, 0); // Hide and remove from area
                }
            }
        });

        this._waterTower = new WaterTower(this.scene, {
            physicsWorld: this.physicsWorld,
            x: 166.00,
            y: 0.20,
            z: -426.84,
            scale: 4.2
        });
        if (this._waterTower.colliders) {
            this._colliders.push(...this._waterTower.colliders);
        }

        // Interactive JM Logo for projects
        this._logo = new LogoInteraction(this.scene, this.scene.userData.camera, {
            x: -614.93,
            y: 0.20,
            z: -34.58,
            radius: 18
        });

        // Second interactive JM Logo at requested position (X: -257.04, Y: 3.50, Z: -178.42) for About Me (FlameModal.jsx)
        this._logoAboutMe = new LogoInteraction(this.scene, this.scene.userData.camera, {
            x: -257.04,
            y: 0.20,
            z: -178.42,
            radius: 18,
            mode: 'aboutMe'
        });

        // Third interactive JM Logo at (X: -41.02, Y: 0.20, Z: -331.21) for Resume (CVModal.jsx)
        this._logoCV = new LogoInteraction(this.scene, this.scene.userData.camera, {
            x: -41.02,
            y: 0.20,
            z: -331.21,
            radius: 18,
            mode: 'cv'
        });

        // Fourth interactive JM Logo at (X: 132.29, Y: 0.20, Z: -236.59) — 3D Rubik's Cube
        this._logoRubik = new LogoInteraction(this.scene, this.scene.userData.camera, {
            x: 132.29,
            y: 0.20,
            z: -236.59,
            radius: 18,
            mode: 'rubik'
        });

        this._frontendDeveloperText = new TextFrontendDeveloper(this.scene, this.scene.userData.camera, this.physicsWorld, {
            text: 'FRONTEND DEVELOPER',
            fontSize: 10.0,
            fontDepth: 1.4,
            floorY: 1.70,
            position: new THREE.Vector3(-366.47, 1.70, -441.90)
        });

        this._freelancerText = new TextFreelancer(this.scene, this.scene.userData.camera, this.physicsWorld, {
            text: 'FREELANCER',
            fontSize: 10.0,
            fontDepth: 1.4,
            floorY: 1.76,
            position: new THREE.Vector3(-159.69, 1.76, 98.07)
        });

        // Interactive 3D Speaker — position according to image with adjusted size
        this._speaker = new Speaker3D(this.scene, this.scene.userData.camera, {
            position: { x: -245.95, y: 0.20, z: 441.11 },
            scale: 22.0,
            physicsWorld: this.physicsWorld
        });

        // Interactive 3D Joystick with Controls Guide — position (X: -318.73, Y: 1.70, Z: -96.23)
        this._joystick = new JoystickInteraction(this.scene, this.scene.userData.camera, {
            physicsWorld: this.physicsWorld,
            x: -318.73,
            y: 1.70,
            z: -96.23
        });

        // Interactive 3D Rubik's Cube — position according to image (X: 140.60, Y: 0.20, Z: -269.93)
        this._rubikCube = new RubikCubeInteraction(this.scene, this.scene.userData.camera, {
            physicsWorld: this.physicsWorld,
            x: 140.60,
            y: 0.20,
            z: -269.93
        });

        // Initialize floating fireflies on lampposts for nighttime
        this._initFireflies();
    }


    // ─────────────────────────────────────────────────────────────────
    //  ÁRBOL GRANDE GLB (posición mundial fija)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Coloca el BIGTREE2-COMPRESSED.glb directamente en la escena
     * usando coordenadas de mundo absolutas.
     * @param {number} wx  Posición X en el mundo
     * @param {number} wy  Posición Y en el mundo (base del tronco)
     * @param {number} wz  Posición Z en el mundo
     */
    _placeBigTree(wx, wy, wz) {
        const BIG_TREE_URL = '/big tree/ARBOL Gigantesco.glb';

        const _place = (gltf) => {
            const root = gltf.scene.clone();
            root.position.set(wx, wy, wz);
            root.scale.setScalar(10);
            root.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow    = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(root);
            console.log(`[ProceduralCityBuilder] Large tree placed at (${wx}, ${wy}, ${wz}).`);
        };

        if (AssetCache.has(BIG_TREE_URL)) {
            _place(AssetCache.get(BIG_TREE_URL));
        } else {
            const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
            const loader = new GLTFLoader();
            loader.setMeshoptDecoder(MeshoptDecoder);
            loader.load(
                `${baseUrl}${BIG_TREE_URL}`,
                (gltf) => { AssetCache.set(BIG_TREE_URL, gltf); _place(gltf); },
                undefined,
                (err) => console.error('[ProceduralCityBuilder] Error cargando big tree:', err)
            );
        }
    }

    _buildMaterials() {
        const mat = (color, extra = {}) => {
            const m = makeMat(color, extra);
            this.cityGroundMaterials.add(m);
            return m;
        };
        const leaf = (color, extra = {}) => {
            const m = makeMat(color, extra);
            this.cityLeafMaterials.add(m);
            return m;
        };
        const bark = (color, extra = {}) => {
            const m = makeMat(color, extra);
            this.cityBarkMaterials.add(m);
            return m;
        };

        return {
            asphalt:  mat(C.asphalt),
            sidewalk: mat(C.sidewalk),
            grass:    mat(C.grass),
            grassDark:mat(C.grassDark),
            grassLime:mat(C.grassLime),
            grassLimeDark:mat(C.grassLimeDark),
            dirt:     mat(C.dirt),
            lightDirt:mat(0x8b5a2b),
            parking:  mat(C.parking),
            line:     mat(C.line),
            wall:     mat(C.wall),
            wallCap:  mat(C.wallCap),
            glass:    mat(C.glass, { roughness: 0.15, metalness: 0.85 }),
            frame:    mat(C.frame),
            sill:     mat(C.sill),
            plinth:   mat(C.plinthDark),
            cornice:  mat(C.cornice),
            metal:    mat(C.metal, { roughness: 0.4, metalness: 0.7 }),
            ac:       mat(C.ac),
            vent:     mat(C.vent),
            red:      mat(C.redCross),
            wood:     bark(C.wood, { roughness: 0.9 }),
            hosp1:    mat(C.hospitalMain),
            hosp2:    mat(C.hospitalSec),
            apt1:     mat(C.aptA),
            apt2:     mat(C.aptB),
            facBrick: mat(C.factoryBrick),
            facGrey:  mat(C.factoryGrey),
            facRoof:  mat(C.factoryRoof),
            house1:   mat(C.houseYellow),
            house2:   mat(C.houseBlue),
            roof1:    mat(C.roofTerra),
            roof2:    mat(C.roofDark),
            trunk:    bark(C.treeTrunk, { flatShading: true }),
            leafA:    leaf(C.leavesA, { flatShading: true }),
            leafB:    leaf(C.leavesB, { flatShading: true }),
            truss:    mat(0xa8481f, { roughness: 0.55, metalness: 0.35 }),
            trussRail:mat(0xe6e2d8, { roughness: 0.6, metalness: 0.2 }),
            concrete: mat(0x9b9b95, { roughness: 0.9 }),
            lampGlow: mat(0xfff0be, { emissive: 0xffdd80, emissiveIntensity: 0.9, roughness: 0.3 }),
        };
    }

    // ─────────────────────────────────────────────────────────────────
    //  GEO CACHE
    // ─────────────────────────────────────────────────────────────────

    _boxGeo(w, h, d) {
        const k = `b_${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
        if (!this._geoCache[k]) this._geoCache[k] = new THREE.BoxGeometry(w, h, d);
        return this._geoCache[k];
    }

    _cylGeo(rt, rb, h, s) {
        const k = `c_${rt.toFixed(2)}_${rb.toFixed(2)}_${h.toFixed(2)}_${s}`;
        if (!this._geoCache[k]) this._geoCache[k] = new THREE.CylinderGeometry(rt, rb, h, s);
        return this._geoCache[k];
    }

    _addGrassZone(cx, cz, halfW, halfD, y, holeHalfW = 0, holeHalfD = 0, density = null, skipFn = null) {
        this._grassZones.push({ cx, cz, halfW, halfD, y, holeHalfW, holeHalfD, density, skipFn });
    }

    _addGrassZoneLocal(parentX, parentZ, parentRotY, localX, localZ, halfW, halfD, y) {
        const c = Math.cos(parentRotY), s = Math.sin(parentRotY);
        const corners = [
            [localX - halfW, localZ - halfD], [localX + halfW, localZ - halfD],
            [localX + halfW, localZ + halfD], [localX - halfW, localZ + halfD]
        ];
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [lx, lz] of corners) {
            const wx = parentX + lx * c - lz * s;
            const wz = parentZ + lx * s + lz * c;
            minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
            minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
        }
        this._addGrassZone((minX + maxX) / 2, (minZ + maxZ) / 2, (maxX - minX) / 2, (maxZ - minZ) / 2, y);
    }

    _addGrassFrameZones(innerHalf, outerHalf, y) {
        const stripDepth = outerHalf - innerHalf;
        const mid = (outerHalf + innerHalf) / 2;
        this._addGrassZone(0, -mid, outerHalf, stripDepth / 2, y);
        this._addGrassZone(0,  mid, outerHalf, stripDepth / 2, y);
        this._addGrassZone( mid, 0, stripDepth / 2, outerHalf, y);
        this._addGrassZone(-mid, 0, stripDepth / 2, outerHalf, y);
    }

    _addMesh(geo, mat, x, y, z, parent, cast = true, rec = true) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow  = cast;
        mesh.receiveShadow = rec;
        (parent || this._cityGroup).add(mesh);
        return mesh;
    }

    // ─────────────────────────────────────────────────────────────────
    //  REGISTRO DE COLISIONADORES
    // ─────────────────────────────────────────────────────────────────

    _markBuilding(group) {
        if (group && group.isGroup) group.userData.isBuilding = true;
    }

    _registerBoxCollider(x, y, z, hw, hh, hd) {
        this._colliders.push({ type: 'box', x, y, z, hw, hh, hd });
    }

    _registerCylinderCollider(x, z, r, hh, baseY = GRASS_TOP_Y) {
        this._colliders.push({ type: 'cylinder', x, y: baseY + hh, z, r, hh });
    }

    _collectColliders() {
        this._cityGroup.updateMatrixWorld(true);
        const invScale = 1 / this.cityScale;
        const cityPos = this._cityGroup.position;
        const box = new THREE.Box3();

        this._cityGroup.traverse(obj => {
            if (obj.isGroup && obj.userData.isBuilding && !this._registeredBuildings.has(obj.uuid)) {
                this._registeredBuildings.add(obj.uuid);

                // Bounding box del edificio excluyendo la placa base de la manzana/acera
                box.makeEmpty();
                obj.traverse(child => {
                    if (child.isMesh) {
                        const isBaseSlab = (child.position.y <= 0.25 && child.material && (
                            child.material === this._M.sidewalk ||
                            child.material === this._M.parking ||
                            child.material === this._M.grassLime ||
                            child.material === this._M.grassLimeDark ||
                            child.material === this._M.plinth
                        ));
                        if (!isBaseSlab) {
                            box.expandByObject(child);
                        }
                    }
                });

                if (box.isEmpty()) return;

                const cMin = box.min.clone().sub(cityPos).multiplyScalar(invScale);
                const cMax = box.max.clone().sub(cityPos).multiplyScalar(invScale);
                const cCenter = new THREE.Vector3().addVectors(cMin, cMax).multiplyScalar(0.5);
                const cSize = new THREE.Vector3().subVectors(cMax, cMin);

                if (cSize.x < 0.1 || cSize.y < 0.1 || cSize.z < 0.1) return;

                // Ignorar colisionadores procedurales en la zona de la Torre de Agua (X: 166.00, Z: -426.84)
                const wCenterX = cCenter.x * this.cityScale + cityPos.x;
                const wCenterZ = cCenter.z * this.cityScale + cityPos.z;
                if (Math.hypot(wCenterX - 166.00, wCenterZ - (-426.84)) < 55.0) return;

                const onHardSurface = Math.abs(cCenter.x) < roadOuterHalf && Math.abs(cCenter.z) < roadOuterHalf;
                const surfaceY = onHardSurface ? ZONE_Y : GRASS_TOP_Y;

                const childMinY = Math.max(cMin.y, surfaceY);
                const childMaxY = cMax.y;
                if (childMaxY <= childMinY) return;

                const cy = (childMinY + childMaxY) / 2;
                const chh = (childMaxY - childMinY) / 2;
                this._registerBoxCollider(cCenter.x, cy, cCenter.z, cSize.x / 2, chh, cSize.z / 2);
            }
        });

        for (const c of this._treeColliders) {
            this._registerCylinderCollider(c.x, c.z, c.r, c.hh, c.y - c.hh);
        }

        console.log(`[PCB] Colliders recopilados: ${this._colliders.length}`);
    }

    // ─────────────────────────────────────────────────────────────────
    //  INSTANCED TREE / BUSH
    // ─────────────────────────────────────────────────────────────────

    _isOnRoad(x, z) {
        const hw = ROAD / 2;
        if (Math.abs(Math.abs(x) - CELL / 2) < hw + 1) return true;
        if (Math.abs(Math.abs(z) - CELL / 2) < hw + 1) return true;
        const ax = Math.abs(x), az = Math.abs(z);
        if (ax >= roadInnerHalf && ax <= roadOuterHalf) return true;
        if (az >= roadInnerHalf && az <= roadOuterHalf) return true;
        return false;
    }

    _initTreeInstances() {
        this._treeManager = createTreeManager(this.scene, this._cityGroup, 450, {
            cityLeafMaterials: this.cityLeafMaterials,
            cityBarkMaterials: this.cityBarkMaterials
        });
        this._palmManager = createPalmManager(this.scene, this._cityGroup, 300, {
            cityLeafMaterials: this.cityLeafMaterials,
            cityBarkMaterials: this.cityBarkMaterials
        });
    }

    _isInFountain(x, z) {
        // 1. Fuente y Plaza del Parque Central en (0, P) = (0, -68), radio de exclusión amplio (25m)
        if (Math.hypot(x - ZQ, z - P) < 25) return true;

        // 2. Kiosco/Glorieta del Parque en (-20, -88)
        if (Math.hypot(x - (ZQ - 20), z - (P - 20)) < 12) return true;

        // 3. Isla/Plaza Central en (0, 0), radio 18m
        if (Math.hypot(x, z) < 18) return true;

        // 4. Plazas de distritos cívicos/comerciales
        const districtCenter = (CITY_EDGE_X + grassOuterHalf) / 2 - 2;
        if (Math.hypot(x - (-districtCenter), z - (-districtCenter)) < 18) return true;
        if (Math.hypot(x - districtCenter, z - (-districtCenter)) < 18) return true;

        return false;
    }

    _isInParking(x, z) {
        // Exclusión total para todos los parqueaderos de base azul (bloques BLOCK x BLOCK)
        for (const px of [P, N]) {
            for (const pz of [P, N]) {
                if (Math.abs(x - px) < BLOCK / 2 + 3 && Math.abs(z - pz) < BLOCK / 2 + 3) {
                    return true;
                }
            }
        }
        return false;
    }

    _isInSoccerField(x, z) {
        return x >= 88 && x <= 200 && Math.abs(z) <= 28;
    }

    _isInBasketballCourt(x, z) {
        // centro (-145, -65), halfW=42+margin -> -192 a -100; halfL=16+margin -> -85 a -45
        return x >= -192 && x <= -100 && z >= -85 && z <= -45;
    }

    _isInSportsZone(x, z) {
        return this._isInSoccerField(x, z) || this._isInBasketballCourt(x, z);
    }

    _addPalm(x, z, scale = 1) {
        if (this.treeDensityFactor < 1.0 && Math.random() > this.treeDensityFactor) return;
        if (this._isOnRoad(x, z) || this._isInFountain(x, z) || this._isInParking(x, z) || this._isInBuilding(x, z) || this._isInSportsZone(x, z)) return;
        const onPlaza = Math.abs(x) < CITY_PAD / 2 && Math.abs(z) < CITY_PAD / 2;
        const baseY = onPlaza ? ZONE_Y : GRASS_TOP_Y;

        const finalScale = scale * (0.65 + Math.random() * 0.4);
        this._palmManager.addPalm(x, z, finalScale, baseY);

        const rr = 0.4 * finalScale;
        const hh = 1.8 * finalScale;
        this._treeColliders.push({ x, y: baseY + hh, z, r: rr, hh });
    }

    _isInBuilding(x, z) {
        // 1. Edificios principales de los bloques centrales
        if (Math.abs(x - P) < 26 && Math.abs(z - ZQ) < 24) return true; // Apartamentos
        if (Math.abs(x - N) < 22 && Math.abs(z - ZQ) < 26) return true; // Fábrica
        if (Math.abs(x - ZQ) < 24 && Math.abs(z - N) < 20) return true; // Hospital
        if (Math.abs(x - ZQ) < 22 && Math.abs(z - ZQ) < 20) return true; // Isla central

        // 2. Casas y edificios de los distritos periféricos
        const districtCenter = (CITY_EDGE_X + grassOuterHalf) / 2 - 2;
        const dists = [
            [ districtCenter,  districtCenter],
            [-districtCenter,  districtCenter],
            [ districtCenter, -districtCenter],
            [-districtCenter, -districtCenter],
        ];

        for (const [dcx, dcz] of dists) {
            if (dcx < 0 && dcz < 0) continue; // Libre de colisiones para el nuevo área plana
            const lots = [[-11, -11], [11, -11], [-11, 11], [11, 11], [0, -18], [0, 18], [0, 0]];
            for (const [lx, lz] of lots) {
                if (Math.hypot(x - (dcx + lx), z - (dcz + lz)) < 9.5) return true;
            }
        }

        return false;
    }

    _addTree(x, z, scale = 1) {
        if (this.treeDensityFactor < 1.0 && Math.random() > this.treeDensityFactor) return;
        if (this._isOnRoad(x, z) || this._isInFountain(x, z) || this._isInParking(x, z) || this._isInBuilding(x, z) || this._isInSportsZone(x, z)) return;
        const onPlaza = Math.abs(x) < CITY_PAD / 2 && Math.abs(z) < CITY_PAD / 2;
        const baseY = onPlaza ? ZONE_Y : GRASS_TOP_Y;

        // ~25% de los árboles colocados en la ciudad serán palmeras
        if (Math.random() < 0.25) {
            this._addPalm(x, z, scale);
            return;
        }

        // Quitar un 12% de los árboles tupitos/frondosos colocados en la escena
        if (Math.random() < 0.12) return;

        // Variación extra de tamaño por árbol: entre 70% y 155% de la escala pedida,
        // para que se note la mezcla de árboles grandes y pequeños en el mapa.
        const finalScale = scale * (0.7 + Math.random() * 0.85);

        // ~20% de árboles son del estilo tree4 (azul/lavanda), el resto son mezcla normal
        let typeIndex = null; // null = aleatorio entre tipos 0-6
        const r = Math.random();
        if (r < 0.10) typeIndex = 8;       // 10% Sauce Azul
        else if (r < 0.20) typeIndex = 9;  // 10% Lavanda Compacto

        // ~15% de árboles naturales (no arbustos ni sauce/lavanda) se colocan secos (sin hojas)
        const dry = typeIndex === null && Math.random() < 0.15;

        this._treeManager.addTree(x, z, finalScale, typeIndex, baseY, dry);

        const rr = 0.55 * finalScale;
        const hh = 2.0 * finalScale;
        this._treeColliders.push({ x, y: baseY + hh, z, r: rr, hh });
    }

    _addBush(x, z, scale = 1) {
        if (this.bushDensityFactor < 1.0 && Math.random() > this.bushDensityFactor) return;
        if (this._isOnRoad(x, z) || this._isInFountain(x, z) || this._isInParking(x, z) || this._isInBuilding(x, z) || this._isInSportsZone(x, z)) return;
        const onPlaza = Math.abs(x) < CITY_PAD / 2 && Math.abs(z) < CITY_PAD / 2;
        const baseY = onPlaza ? ZONE_Y : GRASS_TOP_Y;

        // Tipo 7: arbusto decorativo compacto
        this._treeManager.addTree(x, z, scale * 0.55, 7, baseY);

        const r = 0.45 * scale;
        const hh = 0.8 * scale;
        this._treeColliders.push({ x, y: baseY + hh, z, r, hh });
    }

    _finalizeInstances() {
        this._treeManager.finalize();
        this._palmManager.finalize();
    }

    // ─────────────────────────────────────────────────────────────────
    //  GROUND & STREETS

    _buildGround() {
        const M = this._M;
        const city = this._cityGroup;

        // Terreno base
        this._addMesh(this._boxGeo(MAP_SIZE, 15, MAP_SIZE), M.dirt, 0, -7.5, 0, city);
        // BASE DE CÉSPED visual base (plana, barata)
        this._addMesh(this._boxGeo(MAP_SIZE, 0.4, MAP_SIZE), M.grassDark, 0, 0.2, 0, city);

        // Sección específica delimitada por la carretera (Norte: Z de -170 a -81, X de -34 a +34)
        // Solo la mitad Oeste (X < 0) es de color café claro sin briznas de césped
        const secW = 34;                 // Ancho de cada mitad (de -34 a 0, y de 0 a +34)
        const secD = 170 - 81;           // Profundidad (89u, entre Z=-170 y Z=-81)
        const secZ = (-170 + -81) / 2;   // Centro Z = -125.5
        this._addMesh(this._boxGeo(secW, 0.41, secD), M.lightDirt, -secW / 2, 0.205, secZ, city);
        this._addMesh(this._boxGeo(secW, 0.41, secD), M.grassDark,  secW / 2, 0.205, secZ, city);

        this._addMesh(this._boxGeo(CITY_PAD, 0.9, CITY_PAD), M.asphalt, 0, 0.45, 0, city);

        // Marcas de carretera
        const roadAxes = [-CELL / 2, CELL / 2];
        roadAxes.forEach(cx => {
            for (let i = -90; i <= 90; i += 12) {
                this._addMesh(this._boxGeo(1.1, 0.02, 5), M.line, cx, ZONE_Y + 0.011, i, city);
                this._addMesh(this._boxGeo(5, 0.02, 1.1), M.line, i, ZONE_Y + 0.011, cx, city);
            }
        });

        roadAxes.forEach(cx => roadAxes.forEach(cz => {
            for (let i = -5; i <= 5; i += 2.2)
                this._addMesh(this._boxGeo(1, 0.02, 10), M.line, cx + i, ZONE_Y + 0.011, cz, city);
        }));

        const blockCenters = [-CELL, 0, CELL];
        blockCenters.forEach(cx => {
            blockCenters.forEach(cz => {
                // Aceras verticales (Oeste y Este) que cubren los 54u del borde exterior de la manzana
                this._addMesh(this._boxGeo(1.5, 0.15, BLOCK), M.sidewalk, cx - 26.25, ZONE_Y + 0.075, cz, city, false);
                this._addMesh(this._boxGeo(1.5, 0.15, BLOCK), M.sidewalk, cx + 26.25, ZONE_Y + 0.075, cz, city, false);
                // Aceras horizontales (Norte y Sur) encajadas milimétricamente entre las aceras verticales (51u)
                this._addMesh(this._boxGeo(BLOCK - 3.0, 0.15, 1.5), M.sidewalk, cx, ZONE_Y + 0.075, cz - 26.25, city, false);
                this._addMesh(this._boxGeo(BLOCK - 3.0, 0.15, 1.5), M.sidewalk, cx, ZONE_Y + 0.075, cz + 26.25, city, false);
            });
        });

        // ZONA VERDE BASE: hombros entre la plaza central y el anillo interior.
        // Evitamos los distritos, el parque y las calles conectoras para que el
        // césped no quede tapado debajo de otros meshes.
        const districtCenter = (CITY_EDGE_X + grassOuterHalf) / 2 - 2;
        const skipDistritoSlab = (x, z) => {
            for (const sx of [-1, 1]) {
                for (const sz of [-1, 1]) {
                    const cx = sx * districtCenter, cz = sz * districtCenter;
                    if (Math.abs(x - cx) < 21 && Math.abs(z - cz) < 21) return true;
                }
            }
            return false;
        };
        const skipPark = (x, z) => Math.abs(x - ZQ) < BLOCK / 2 && Math.abs(z - P) < BLOCK / 2;
        const skipConnectors = (x, z) => {
            const hw = ROAD / 2 + 1;
            // Verticales (z = ±34) desde plaza hasta anillo
            if (Math.abs(Math.abs(z) - CELL / 2) < hw && Math.abs(x) > CITY_EDGE_X && Math.abs(x) < roadInnerHalf) return true;
            // Horizontales (x = ±34) desde plaza hasta anillo
            if (Math.abs(Math.abs(x) - CELL / 2) < hw && Math.abs(z) > CITY_EDGE_X && Math.abs(z) < roadInnerHalf) return true;
            return false;
        };
        const skipSportsZone = (x, z) => this._isInSportsZone(x, z);
        const skipGrassBase = (x, z) => skipDistritoSlab(x, z) || skipPark(x, z) || skipConnectors(x, z) || skipSportsZone(x, z) || this._isOnRoad(x, z);

        this._addGrassZone(0, 0, MAP_SIZE / 2, MAP_SIZE / 2, 0.4, CITY_PAD / 2, CITY_PAD / 2, 1.4, skipGrassBase);
    }

    _buildRoadConnector(axis, fixedCoord, start, end, width) {
        const M = this._M;
        const city = this._cityGroup;
        const len = Math.abs(end - start);
        const mid = (start + end) / 2;
        const step = (end > start ? 8 : -8);
        if (axis === 'x') {
            this._addMesh(this._boxGeo(len, 0.9, width), M.asphalt, mid, 0.45, fixedCoord, city);
            this._addMesh(this._boxGeo(len, 0.15, 1.8), M.sidewalk, mid, ZONE_Y + 0.075, fixedCoord + (width / 2 + 0.9), city, false);
            this._addMesh(this._boxGeo(len, 0.15, 1.8), M.sidewalk, mid, ZONE_Y + 0.075, fixedCoord - (width / 2 + 0.9), city, false);
            for (let i = start + step / 2; (step > 0 ? i < end : i > end); i += step)
                this._addMesh(this._boxGeo(4, 0.02, 0.6), M.line, i, 0.911, fixedCoord, city);
        } else {
            this._addMesh(this._boxGeo(width, 0.9, len), M.asphalt, fixedCoord, 0.45, mid, city);
            this._addMesh(this._boxGeo(1.8, 0.15, len), M.sidewalk, fixedCoord + (width / 2 + 0.9), ZONE_Y + 0.075, mid, city, false);
            this._addMesh(this._boxGeo(1.8, 0.15, len), M.sidewalk, fixedCoord - (width / 2 + 0.9), ZONE_Y + 0.075, mid, city, false);
            for (let i = start + step / 2; (step > 0 ? i < end : i > end); i += step)
                this._addMesh(this._boxGeo(0.6, 0.02, 4), M.line, fixedCoord, 0.911, i, city);
        }
    }

    _buildStreetConnectors() {
        this._buildRoadConnector('z',  CELL / 2,   CITY_EDGE_X,  roadInnerHalf, ROAD);
        this._buildRoadConnector('z', -CELL / 2,   CITY_EDGE_X,  roadInnerHalf, ROAD);
        this._buildRoadConnector('z',  CELL / 2,  -CITY_EDGE_X, -roadInnerHalf, ROAD);
        this._buildRoadConnector('z', -CELL / 2,  -CITY_EDGE_X, -roadInnerHalf, ROAD);
        this._buildRoadConnector('x', -CELL / 2,  -CITY_EDGE_X, -roadInnerHalf, ROAD);
        this._buildRoadConnector('x',  CELL / 2,  -CITY_EDGE_X, -roadInnerHalf, ROAD);
        this._buildRoadConnector('x', -CELL / 2,   CITY_EDGE_X,  roadInnerHalf, ROAD);
        this._buildRoadConnector('x',  CELL / 2,   CITY_EDGE_X,  roadInnerHalf, ROAD);
    }

    _buildCityBridge(x, z, axis = 'x', length = 48, width = 16) {
        const M = this._M;
        const city = this._cityGroup;
        const group = new THREE.Group();
        group.position.set(x, ZONE_Y, z);
        if (axis === 'z') group.rotation.y = Math.PI / 2;

        const bridgeMat    = M.cornice  || new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.8 });
        const darkMetalMat = M.metal    || new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.4 });
        const asphaltMat   = M.asphalt  || new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

        // Tablero de asfalto
        const deck = new THREE.Mesh(this._boxGeo(length, 1.2, width), asphaltMat);
        deck.position.y = 0.6; deck.castShadow = deck.receiveShadow = true;
        group.add(deck);

        // Aceras elevadas
        const sidewalkL = new THREE.Mesh(this._boxGeo(length, 0.4, 1.8), M.sidewalk);
        sidewalkL.position.set(0, 1.3, width / 2 - 0.9); sidewalkL.castShadow = true;
        group.add(sidewalkL);
        const sidewalkR = new THREE.Mesh(this._boxGeo(length, 0.4, 1.8), M.sidewalk);
        sidewalkR.position.set(0, 1.3, -width / 2 + 0.9); sidewalkR.castShadow = true;
        group.add(sidewalkR);

        // Barandillas metálicas
        const railHeight = 1.4;
        const railGeo = this._boxGeo(length, 0.25, 0.25);
        const topRailL = new THREE.Mesh(railGeo, darkMetalMat);
        topRailL.position.set(0, 1.5 + railHeight, width / 2 - 0.15);
        topRailL.castShadow = true;
        group.add(topRailL);
        const topRailR = new THREE.Mesh(railGeo, darkMetalMat);
        topRailR.position.set(0, 1.5 + railHeight, -width / 2 + 0.15);
        topRailR.castShadow = true;
        group.add(topRailR);

        const postCount = 20;
        const postGeo = this._boxGeo(0.12, railHeight, 0.12);
        for (let i = 0; i <= postCount; i++) {
            const px = -length / 2 + (i / postCount) * length;
            const pL = new THREE.Mesh(postGeo, darkMetalMat);
            pL.position.set(px, 1.5 + railHeight / 2, width / 2 - 0.15);
            pL.castShadow = true;
            group.add(pL);
            const pR = new THREE.Mesh(postGeo, darkMetalMat);
            pR.position.set(px, 1.5 + railHeight / 2, -width / 2 + 0.15);
            pR.castShadow = true;
            group.add(pR);
        }

        // Columnas / pilares del puente
        const pierCount = 3;
        for (let i = 0; i < pierCount; i++) {
            const px = -length / 3 + i * (length / 3);
            const pier = new THREE.Mesh(this._boxGeo(3.5, 12, width + 1.2), bridgeMat);
            pier.position.set(px, -5.4, 0); pier.castShadow = pier.receiveShadow = true;
            group.add(pier);
        }

        // Farolas iluminadas en el puente
        [-length / 3, 0, length / 3].forEach(px => {
            this._addStreetLamp(px,  width / 2 - 0.5, -Math.PI / 2, 1.5, group, 0.9);
            this._addStreetLamp(px, -width / 2 + 0.5,  Math.PI / 2, 1.5, group, 0.9);
        });

        city.add(group);
    }

    // ─────────────────────────────────────────────────────────────────
    //  PERIMETER RING
    // ─────────────────────────────────────────────────────────────────

    _buildFrame(innerHalf, outerHalf, thickness, yCenter, mat, isGrass = false) {
        const outerFull = outerHalf * 2;
        const stripDepth = outerHalf - innerHalf;
        const mid = (outerHalf + innerHalf) / 2;
        const city = this._cityGroup;
        this._addMesh(this._boxGeo(outerFull, thickness, stripDepth), mat, 0, yCenter, -mid, city);
        this._addMesh(this._boxGeo(outerFull, thickness, stripDepth), mat, 0, yCenter,  mid, city);
        this._addMesh(this._boxGeo(stripDepth, thickness, outerFull), mat, mid, yCenter, 0, city);
        this._addMesh(this._boxGeo(stripDepth, thickness, outerFull), mat, -mid, yCenter, 0, city);
        if (isGrass) this._addGrassFrameZones(innerHalf, outerHalf, yCenter + thickness / 2);
    }

    _buildStripWithGaps(axis, fixedCoord, from, to, depth, thickness, yCenter, mat, gaps) {
        const city = this._cityGroup;
        gaps = gaps.slice().sort((a, b) => a.pos - b.pos);
        let cursor = Math.min(from, to);
        const limit = Math.max(from, to);
        const addSeg = (a, b) => {
            if (b - a <= 0.01) return;
            const len = b - a, mid = (a + b) / 2;
            if (axis === 'x') this._addMesh(this._boxGeo(len, thickness, depth), mat, mid, yCenter, fixedCoord, city);
            else               this._addMesh(this._boxGeo(depth, thickness, len), mat, fixedCoord, yCenter, mid, city);
        };
        for (const gap of gaps) {
            const gapStart = gap.pos - gap.width / 2, gapEnd = gap.pos + gap.width / 2;
            if (gapStart > cursor) addSeg(cursor, gapStart);
            cursor = Math.max(cursor, gapEnd);
        }
        if (cursor < limit) addSeg(cursor, limit);
    }

    _buildPerimeterRing() {
        const M = this._M;
        this._buildFrame(mapHalf, farGrassHalf, 14, -7, M.dirt);
        this._buildFrame(mapHalf, grassOuterHalf, 0.4, 0.2, M.grassDark, true);
        this._buildFrame(roadInnerHalf, roadOuterHalf, 0.9, 0.45, M.asphalt);
        this._buildFrame(roadOuterHalf, roadOuterHalf + 0.8, 1.0, 0.5, M.sidewalk);

        const CONN_GAPS      = [{ pos: -34, width: ROAD }, { pos: 34, width: ROAD }];
        const CONN_GAPS_EAST = [{ pos: -34, width: ROAD }, { pos: 34, width: 16 }];
        const curbMid = roadInnerHalf - 0.4;
        this._buildStripWithGaps('x', -curbMid, -roadInnerHalf, roadInnerHalf, 0.8, 1.0, 0.5, M.sidewalk, CONN_GAPS);
        this._buildStripWithGaps('x',  curbMid, -roadInnerHalf, roadInnerHalf, 0.8, 1.0, 0.5, M.sidewalk, CONN_GAPS);
        this._buildStripWithGaps('z', -curbMid, -roadInnerHalf, roadInnerHalf, 0.8, 1.0, 0.5, M.sidewalk, CONN_GAPS);
        this._buildStripWithGaps('z',  curbMid, -roadInnerHalf, roadInnerHalf, 0.8, 1.0, 0.5, M.sidewalk, CONN_GAPS_EAST);
        this._buildFrame(roadOuterHalf + 0.8, farGrassHalf, 0.4, 0.2, M.grassDark, true);

        // Marcas de carretera del anillo
        const ringMid = (roadInnerHalf + roadOuterHalf) / 2;
        for (let i = -roadOuterHalf + 6; i <= roadOuterHalf - 6; i += 10) {
            const city = this._cityGroup;
            this._addMesh(this._boxGeo(5, 0.02, 1.1), M.line, i, 0.911, -ringMid, city);
            this._addMesh(this._boxGeo(5, 0.02, 1.1), M.line, i, 0.911,  ringMid, city);
            this._addMesh(this._boxGeo(1.1, 0.02, 5), M.line, -ringMid, 0.911, i, city);
            this._addMesh(this._boxGeo(1.1, 0.02, 5), M.line,  ringMid, 0.911, i, city);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  BEACH SKIRT (BAJADA TIPO PLAYA DIFUMINADA DE VERDE A ARENA)
    // ─────────────────────────────────────────────────────────────────

    _buildBeachSkirt() {
        const rInner = farGrassHalf;       // 236 (inicio en el borde del césped)
        const rOuter = farGrassHalf + 52;  // 288 (se extiende profundamente por debajo del agua)
        const yTop = 0.4;
        const yBottom = -2.4;              // Sumergido profundamente para eliminar cualquier borde recto

        const colGrass   = new THREE.Color(C.grassDark); // 0x74b826
        const colSand    = new THREE.Color(0xd8c596);    // Arena cálida
        const colSandWet = new THREE.Color(0x9e8c60);    // Arena húmeda sumergida

        const positions = [];
        const colors = [];
        const indices = [];

        const STEPS_V = 14;
        const SEG_H = 28;

        const ringVertices = [];

        for (let v = 0; v <= STEPS_V; v++) {
            const t = v / STEPS_V;
            const r = rInner + t * (rOuter - rInner);
            const y = yTop + t * (yBottom - yTop);

            // Gradiente: césped (t=0) a arena en la orilla (t=0.4) y arena húmeda bajo agua (t=1.0)
            let c;
            if (t < 0.4) {
                const factor = t / 0.4;
                const smoothF = factor * factor * (3 - 2 * factor);
                c = colGrass.clone().lerp(colSand, smoothF);
            } else {
                const factor = (t - 0.4) / 0.6;
                const smoothF = factor * factor * (3 - 2 * factor);
                c = colSand.clone().lerp(colSandWet, smoothF);
            }

            const ring = [];
            for (let i = 0; i < SEG_H; i++) {
                const x = -r + (i / SEG_H) * (2 * r);
                ring.push({ x, y, z: -r, color: c });
            }
            for (let i = 0; i < SEG_H; i++) {
                const z = -r + (i / SEG_H) * (2 * r);
                ring.push({ x: r, y, z, color: c });
            }
            for (let i = 0; i < SEG_H; i++) {
                const x = r - (i / SEG_H) * (2 * r);
                ring.push({ x, y, z: r, color: c });
            }
            for (let i = 0; i < SEG_H; i++) {
                const z = r - (i / SEG_H) * (2 * r);
                ring.push({ x: -r, y, z, color: c });
            }
            ringVertices.push(ring);
        }

        const numPerRing = 4 * SEG_H;

        for (let v = 0; v <= STEPS_V; v++) {
            const ring = ringVertices[v];
            for (let i = 0; i < numPerRing; i++) {
                const p = ring[i];
                positions.push(p.x, p.y, p.z);
                colors.push(p.color.r, p.color.g, p.color.b);
            }
        }

        for (let v = 0; v < STEPS_V; v++) {
            const row1 = v * numPerRing;
            const row2 = (v + 1) * numPerRing;
            for (let i = 0; i < numPerRing; i++) {
                const nextI = (i + 1) % numPerRing;
                const a = row1 + i;
                const b = row1 + nextI;
                const c = row2 + i;
                const d = row2 + nextI;
                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.05,
            side: THREE.DoubleSide
        });
        this.cityGroundMaterials.add(mat);

        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this._cityGroup.add(mesh);

        // ── FISICA EXACTA DE LA PLAYA (TRIMESH EN LOS 4 LADOS DEL MAPA) ──────────
        // Crea una superficie de colisión 3D milimétrica en Rapier para los 4 lados de la playa
        if (this.physicsWorld) {
            const sc = this.cityScale;
            const ox = this.offsetX;
            const oy = this.offsetY;
            const oz = this.offsetZ;

            const physPositions = new Float32Array(positions.length);
            for (let i = 0; i < positions.length; i += 3) {
                physPositions[i]     = ox + positions[i] * sc;
                physPositions[i + 1] = oy + positions[i + 1] * sc;
                physPositions[i + 2] = oz + positions[i + 2] * sc;
            }
            const physIndices = new Uint32Array(indices);

            const beachBody = this.physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc.fixed()
            );
            const beachCollider = RAPIER.ColliderDesc.trimesh(physPositions, physIndices)
                .setFriction(0.85).setRestitution(0.0);
            this.physicsWorld.createCollider(beachCollider, beachBody);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  BUILDING HELPERS
    // ─────────────────────────────────────────────────────────────────

    _buildVolume(parent, x, y, z, w, h, d, cBody, cPlinth, cCol, cCornice) {
        const g = new THREE.Group(); g.position.set(x, y, z);
        this._addMesh(this._boxGeo(w, h, d), cBody, 0, h / 2, 0, g);
        const pH = 0.3;
        this._addMesh(this._boxGeo(w + 0.3, pH, d + 0.3), cPlinth, 0, pH / 2, 0, g);
        const cW = 0.6;
        const cx2 = w / 2 + 0.05, cz2 = d / 2 + 0.05;
        [[cx2, cz2], [-cx2, cz2], [cx2, -cz2], [-cx2, -cz2]].forEach(([px, pz]) => {
            this._addMesh(this._boxGeo(cW, h, cW), cCol, px, h / 2, pz, g);
        });
        if (h > 10) { for (let fy = 4; fy < h - 2; fy += 4.5) this._addMesh(this._boxGeo(w + 0.1, 0.4, d + 0.1), cPlinth, 0, fy, 0, g); }
        this._addMesh(this._boxGeo(w + 0.8, 0.6, d + 0.8), cCornice, 0, h - 0.3, 0, g);
        const pW = 0.5, pY = h + 0.5;
        this._addMesh(this._boxGeo(w + 0.2, 1.2, pW), cBody, 0, pY,  d / 2 - pW / 2, g);
        this._addMesh(this._boxGeo(w + 0.2, 1.2, pW), cBody, 0, pY, -d / 2 + pW / 2, g);
        this._addMesh(this._boxGeo(pW, 1.2, d - pW * 2), cBody,  w / 2 - pW / 2, pY, 0, g);
        this._addMesh(this._boxGeo(pW, 1.2, d - pW * 2), cBody, -w / 2 + pW / 2, pY, 0, g);
        parent.add(g); return g;
    }

    _addWindow(parent, x, y, z, w, h, rotY, isBalcony = false) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
        this._addMesh(this._boxGeo(w, h, 0.1), M.glass, 0, h / 2, 0.05, g);
        const fw = 0.12, fd = 0.2;
        this._addMesh(this._boxGeo(fw, h + fw * 2, fd), M.frame, -w / 2 - fw / 2, h / 2, fd / 2, g);
        this._addMesh(this._boxGeo(fw, h + fw * 2, fd), M.frame,  w / 2 + fw / 2, h / 2, fd / 2, g);
        this._addMesh(this._boxGeo(w, fw, fd), M.frame, 0, h + fw / 2, fd / 2, g);
        this._addMesh(this._boxGeo(w + 0.3, 0.15, fd + 0.1), M.sill, 0, -0.075, fd / 2 + 0.05, g);
        if (isBalcony) {
            const bD = 1.4;
            this._addMesh(this._boxGeo(w + 0.6, 0.25, bD), M.cornice, 0, -0.1, bD / 2, g);
            const railY = 0.6, railT = 0.08;
            this._addMesh(this._boxGeo(w + 0.6, railT, railT), M.metal, 0, railY, bD - railT, g);
            this._addMesh(this._boxGeo(railT, railT, bD), M.metal,  w / 2 + 0.25, railY, bD / 2, g);
            this._addMesh(this._boxGeo(railT, railT, bD), M.metal, -w / 2 - 0.25, railY, bD / 2, g);
            for (let px = -w / 2; px <= w / 2; px += 0.4)
                this._addMesh(this._boxGeo(railT, railY, railT), M.metal, px, railY / 2, bD - railT, g);
        }
        parent.add(g);
    }

    _addHVAC(parent, x, y, z, scale = 1) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
        this._addMesh(this._boxGeo(2.4, 1.2, 1.8), M.ac, 0, 0.6, 0, g);
        this._addMesh(this._boxGeo(2.6, 0.2, 2.0), M.plinth, 0, 0.1, 0, g);
        this._addMesh(this._cylGeo(0.6, 0.6, 0.3, 12), M.vent, -0.5, 1.3, 0, g);
        this._addMesh(this._cylGeo(0.6, 0.6, 0.3, 12), M.vent,  0.5, 1.3, 0, g);
        for (let i = -0.4; i <= 0.4; i += 0.2)
            this._addMesh(this._boxGeo(2.45, 0.05, 1.85), M.vent, 0, 0.6 + i, 0, g);
        parent.add(g);
    }

    _addPipes(parent, startX, y, startZ, length, axis = 'x') {
        const M = this._M;
        const p1 = this._cylGeo(0.15, 0.15, length, 6);
        const p2 = this._cylGeo(0.15, 0.15, length, 6);
        const m1 = this._addMesh(p1, M.metal, startX, y, startZ, parent);
        const m2 = this._addMesh(p2, M.metal, startX + (axis === 'z' ? 0.4 : 0), y, startZ + (axis === 'x' ? 0.4 : 0), parent);
        if (axis === 'x') { m1.rotation.z = Math.PI / 2; m2.rotation.z = Math.PI / 2; }
        else               { m1.rotation.x = Math.PI / 2; m2.rotation.x = Math.PI / 2; }
    }

    _addRoofStairs(parent, x, y, z, rotY) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
        this._addMesh(this._boxGeo(3, 3, 4), M.wall, 0, 1.5, 0, g);
        this._addMesh(this._boxGeo(3.4, 0.3, 4.4), M.plinth, 0, 3.1, 0, g);
        this._addMesh(this._boxGeo(1.2, 2.2, 0.1), M.vent, 0, 1.1, 2.05, g);
        parent.add(g);
    }

    // ─────────────────────────────────────────────────────────────────
    //  BUILDING FUNCTIONS
    // ─────────────────────────────────────────────────────────────────

    _buildHospital(cx, cz) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(cx, ZONE_Y, cz);
        this._addMesh(this._boxGeo(BLOCK, 0.04, BLOCK), M.sidewalk, 0, 0.02, 0, g);
        this._buildVolume(g,  0, 0.5,  0, 36, 26, 18, M.hosp1, M.plinth, M.hosp2, M.wallCap);
        this._buildVolume(g, -12, 0.5, 2, 14, 18, 28, M.hosp1, M.plinth, M.hosp2, M.wallCap);
        this._buildVolume(g,  12, 0.5, 2, 14, 18, 28, M.hosp1, M.plinth, M.hosp2, M.wallCap);
        for (let x = -5; x <= 5; x += 3) {
            for (let y = 4; y <= 22; y += 4) {
                this._addWindow(g, x, y,  9, 2.2, 2.6, 0);
                this._addWindow(g, x, y, -9, 2.2, 2.6, Math.PI);
            }
        }
        for (const x of [-15, -9, 9, 15]) {
            for (let y = 4; y <= 14; y += 4) {
                this._addWindow(g, x, y,  16, 2.2, 2.6, 0);
                this._addWindow(g, x, y, -12, 2.2, 2.6, Math.PI);
            }
        }
        this._addMesh(this._boxGeo(14, 1.2, 6), M.cornice, 0, 5, 12, g);
        this._addMesh(this._cylGeo(0.2, 0.2, 5, 8), M.metal, -6, 2.5, 14, g);
        this._addMesh(this._cylGeo(0.2, 0.2, 5, 8), M.metal,  6, 2.5, 14, g);
        this._addMesh(this._boxGeo(10, 0.5, 6), M.asphalt, 0, 0.25, 12, g);
        this._addMesh(this._boxGeo(1.2, 4.5, 0.6), M.red, 0, 15, 9.1, g);
        this._addMesh(this._boxGeo(4.5, 1.2, 0.6), M.red, 0, 15, 9.1, g);
        const hY = 28;
        this._addMesh(this._boxGeo(24, 0.6, 24), M.asphalt, 0, hY, 0, g);
        const heliMat = makeMat(0xd9c24e); this.cityGroundMaterials.add(heliMat);
        const heli = new THREE.Mesh(this._cylGeo(9, 9, 0.1, 32), heliMat);
        heli.position.set(0, hY + 0.35, 0); g.add(heli);
        this._addMesh(this._boxGeo(1.6, 0.2, 8), M.asphalt, -3, hY + 0.45, 0, g);
        this._addMesh(this._boxGeo(1.6, 0.2, 8), M.asphalt,  3, hY + 0.45, 0, g);
        this._addMesh(this._boxGeo(6, 0.2, 1.6), M.asphalt,  0, hY + 0.45, 0, g);
        this._addHVAC(g, -12, 18.5,  0, 1.5); this._addHVAC(g, -12, 18.5, -6, 1.5);
        this._addHVAC(g,  12, 18.5,  0, 1.5); this._addHVAC(g,  12, 18.5,  6, 1.5);
        this._addPipes(g, 10, 19, 0, 10, 'z');
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    _buildFactory(cx, cz) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(cx, ZONE_Y, cz);
        this._addMesh(this._boxGeo(BLOCK, 0.04, BLOCK), M.sidewalk, 0, 0.02, 0, g);
        this._buildVolume(g, -4, 0.5,  0, 32, 18, 40, M.facBrick, M.plinth, M.facGrey, M.wallCap);
        this._buildVolume(g, 18, 0.5,  4, 12, 12, 20, M.facGrey,  M.plinth, M.facBrick, M.wallCap);
        for (let z = -12; z <= 12; z += 12) {
            const saw = new THREE.Group(); saw.position.set(-4, 18.5, z);
            const slope = this._addMesh(this._boxGeo(30, 0.6, 12), M.facRoof, 0, 2.5, 0, saw);
            slope.rotation.x = Math.PI / 7;
            this._addMesh(this._boxGeo(30, 5, 0.4), M.glass, 0, 2.5, 5.8, saw);
            for (let x = -14; x <= 14; x += 2.8)
                this._addMesh(this._boxGeo(0.2, 5.2, 0.6), M.frame, x, 2.5, 5.8, saw);
            g.add(saw);
        }
        for (let z = -16; z <= 16; z += 8)
            this._addMesh(this._boxGeo(1.2, 18, 1.2), M.facGrey, -20.2, 9.5, z, g);
        for (let z = -14; z <= 14; z += 7)
            this._addWindow(g, -20, 10, z, 4, 8, -Math.PI / 2);
        this._addMesh(this._boxGeo(20, 1.5, 6), M.asphalt, 12, 0.75, 20, g);
        for (let x = 6; x <= 16; x += 5) {
            this._addMesh(this._boxGeo(3.6, 4.5, 0.3), M.vent, x, 3.75, 20, g);
            this._addMesh(this._boxGeo(0.4, 4.5, 0.6), M.metal, x - 2, 3.75, 20.2, g);
            this._addMesh(this._boxGeo(0.4, 4.5, 0.6), M.metal, x + 2, 3.75, 20.2, g);
        }
        this._addMesh(this._cylGeo(4, 4, 16, 16), M.facGrey, 16, 8.5, -12, g);
        this._addMesh(this._cylGeo(0, 4.2, 4, 16), M.wallCap, 16, 18.5, -12, g);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2)
            this._addMesh(this._cylGeo(0.3, 0.3, 18, 6), M.metal, 16 + Math.cos(a) * 4.2, 9, -12 + Math.sin(a) * 4.2, g);
        this._addPipes(g, 16, 13, -12, 18, 'x');
        this._addPipes(g, 7, 13, -12, 14, 'z');
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    _buildApartments(cx, cz) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(cx, ZONE_Y, cz);
        this._addMesh(this._boxGeo(BLOCK, 0.04, BLOCK), M.sidewalk, 0, 0.02, 0, g);
        this._buildVolume(g, 0, 0.5, 0, 42, 8, 36, M.apt1, M.plinth, M.apt2, M.wallCap);
        for (let x = -15; x <= 15; x += 6) this._addWindow(g, x, 3.5, 18, 4.5, 4.5, 0);
        this._addMesh(this._boxGeo(44, 0.8, 4), M.cornice, 0, 6.5, 19, g);
        this._buildVolume(g, -9, 8.5, -3, 18, 32, 24, M.apt2, M.plinth, M.apt1, M.wallCap);
        for (let y = 12; y <= 36; y += 4) {
            this._addWindow(g, -9, y,   9, 3, 2.5, 0, true);
            this._addWindow(g, -18, y, -3, 3, 2.5, -Math.PI / 2, true);
            this._addWindow(g, -9, y, -15, 3, 2.5, Math.PI);
        }
        this._addRoofStairs(g, -9, 40.5, 0, 0); this._addHVAC(g, -13, 40.5, -5, 1);
        this._buildVolume(g, 11, 8.5, 2, 16, 20, 20, M.apt1, M.plinth, M.apt2, M.wallCap);
        for (let y = 12; y <= 24; y += 4) {
            this._addWindow(g, 11, y, 12, 4, 2.5, 0, true);
            this._addWindow(g, 19, y,  2, 2, 2.5, Math.PI / 2);
        }
        this._addRoofStairs(g, 11, 28.5, 0, Math.PI / 2); this._addHVAC(g, 11, 28.5, -5, 1);
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    _buildComplexHouse(x, z, rotY) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, ZONE_Y, z); g.rotation.y = rotY;
        this._addMesh(this._boxGeo(14.4, 0.2, 12.4), M.plinth, 0, 0.1, 0, g);
        this._addMesh(this._boxGeo(8.4, 0.2, 8.4), M.plinth, -11, 0.1, 2, g);
        this._addMesh(this._boxGeo(14, 9, 12), M.house1, 0, 5.1, 0, g);
        this._addMesh(this._boxGeo(8, 8, 8), M.house2, -11, 4.6, 2, g);
        const colProps = [[7.1, 6.1], [-7.1, 6.1], [7.1, -6.1], [-7.1, -6.1]];
        colProps.forEach(([cx2, cz2]) => this._addMesh(this._boxGeo(0.6, 9, 0.6), M.wallCap, cx2, 5.1, cz2, g));
        const roofShape = new THREE.Shape();
        roofShape.moveTo(-8, 0); roofShape.lineTo(8, 0); roofShape.lineTo(0, 6); roofShape.lineTo(-8, 0);
        const rGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 14, bevelEnabled: false }); rGeo.translate(0, 0, -7);
        this._addMesh(rGeo, M.roof1, 0, 9.6, 0, g);
        this._addMesh(this._boxGeo(16, 0.5, 14.2), M.wallCap, 0, 9.6, 0, g);
        const rGeo2 = new THREE.ExtrudeGeometry(roofShape, { depth: 9, bevelEnabled: false }); rGeo2.translate(0, 0, -4.5);
        const sideRoof = this._addMesh(rGeo2, M.roof1, -11, 8.6, 2, g);
        sideRoof.rotation.y = Math.PI / 2; sideRoof.scale.set(0.6, 0.6, 1);
        this._addMesh(this._boxGeo(2.4, 14, 2.4), M.facBrick, 7, 7, -3, g);
        this._addMesh(this._boxGeo(2.8, 1, 2.8), M.plinth, 7, 14.5, -3, g);
        this._addMesh(this._cylGeo(0.4, 0.4, 1.5, 6), M.metal, 6.5, 15.5, -2.5, g);
        this._addMesh(this._cylGeo(0.4, 0.4, 1.5, 6), M.metal, 7.5, 15.5, -3.5, g);
        this._addMesh(this._boxGeo(8, 0.8, 4), M.wood, 0, 1.4, 8, g);
        this._addMesh(this._boxGeo(0.4, 4, 0.4), M.wallCap, -3.8, 3.8, 9.8, g);
        this._addMesh(this._boxGeo(0.4, 4, 0.4), M.wallCap,  3.8, 3.8, 9.8, g);
        this._addMesh(this._boxGeo(9, 0.1, 0.1), M.wood, 0, 0.75, 8.6, g);
        this._addMesh(this._boxGeo(9, 0.1, 0.1), M.wood, 0, 0.35, 8.6, g);
        this._addMesh(this._boxGeo(1.6, 0.06, 2.4), M.sidewalk, 0, 0.06, 8.4, g);
        this._addWindow(g,  0, 3.4, 6, 2, 4.4, 0);
        this._addWindow(g, -11, 4,  6, 2, 3,   0);
        this._addWindow(g, -4, 5.5, 6, 2, 2.5, 0);
        this._addWindow(g,  4, 5.5, 6, 2, 2.5, 0);
        this._addWindow(g,  7, 4,   3, 2, 3, Math.PI / 2);
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    _buildCentralIsland(cx, cz) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(cx, ZONE_Y, cz);
        this._addMesh(this._boxGeo(BLOCK - 8, 0.04, BLOCK - 8), M.sidewalk, 0, 0.02, 0, g);
        this._cityGroup.add(g);
        this._buildComplexHouse(cx + 9, cz - 10, 0);
        this._buildComplexHouse(cx + 9, cz + 10, Math.PI);
        for (const z of [-10, 10]) {
            const apt = new THREE.Group(); apt.position.set(cx - 12, ZONE_Y, cz + z);
            this._buildVolume(apt, 0, 0.5, 0, 16, 14, 16, M.hosp2, M.plinth, M.apt2, M.wallCap);
            for (const i of [-3, 3]) {
                this._addWindow(apt, i, 4.5, 8, 3, 3, 0);
                this._addWindow(apt, i, 9.5, 8, 3, 3, 0);
            }
            this._addWindow(apt, 0, 2.5, 8, 2.5, 4, 0);
            this._addMesh(this._boxGeo(6, 0.5, 2), M.cornice, 0, 5, 9, apt);
            this._addHVAC(apt, 0, 15, 0, 0.8);
            this._cityGroup.add(apt);
            this._markBuilding(apt);
        }
    }

    _buildParking(cx, cz) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(cx, ZONE_Y, cz);
        this._addMesh(this._boxGeo(BLOCK, 0.04, BLOCK), M.parking, 0, 0.02, 0, g);
        for (let r = 0; r < 2; r++) {
            const rz = -BLOCK / 2 + 10 + r * (BLOCK - 20);
            for (let i = 0; i <= 6; i++) {
                const lx = -BLOCK / 2 + 6 + i * ((BLOCK - 12) / 6);
                this._addMesh(this._boxGeo(0.3, 0.05, 11), M.line, lx, 0.045, rz, g);
            }
        }
        this._buildVolume(g, -20, 0.04, 20, 4, 4, 4, M.wall, M.plinth, M.wallCap, M.metal);
        this._addWindow(g, -20, 2.04, 22, 2, 1.5, 0);
        this._addMesh(this._boxGeo(10, 0.4, 0.4), M.metal, -14, 1.14, 20, g);
        this._cityGroup.add(g);
    }

    _buildPark(cx, cz) {
        const M = this._M;
        const PARK_Y = ZONE_Y;
        const g = new THREE.Group(); g.position.set(cx, PARK_Y, cz);
        this._addMesh(this._boxGeo(BLOCK, 0.04, BLOCK), M.grassLime, 0, 0.02, 0, g);
        this._addMesh(this._boxGeo(BLOCK - 12, 0.05, BLOCK - 12), M.sidewalk, 0, 0.025, 0, g);
        this._addMesh(this._boxGeo(BLOCK - 24, 0.06, BLOCK - 24), M.grassLimeDark, 0, 0.03, 0, g);
        // ── Estatua GLB (reemplaza la fuente) ──────────────────────────
        const STATUE_URL = '/estatua/estatua-v1.glb';
        const _placeStatue = (gltf) => {
            const statue = gltf.scene.clone();
            const box    = new THREE.Box3().setFromObject(statue);
            const size   = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            // Base al nivel del suelo del parque (fY = 0.06 sobre PARK_Y)
            statue.position.set(-center.x, 0.06 - box.min.y, -center.z);
            // Escalar a 11 unidades de alto
            statue.scale.setScalar(11 / size.y);
            statue.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow    = true;
                    child.receiveShadow = true;
                }
            });
            g.add(statue);
        };
        if (AssetCache.has(STATUE_URL)) {
            _placeStatue(AssetCache.get(STATUE_URL));
        } else {
            const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
            const statueLoader = new GLTFLoader();
            statueLoader.setMeshoptDecoder(MeshoptDecoder);
            statueLoader.load(
                `${baseUrl}${STATUE_URL}`,
                (gltf) => { AssetCache.set(STATUE_URL, gltf); _placeStatue(gltf); },
                undefined,
                (err) => console.error('[ProceduralCityBuilder] Error cargando estatua.glb:', err)
            );
        }
        this._cityGroup.add(g);
        for (const i of [-15, 15]) {
            this._addBush(cx + i, cz + 15, 1.2); this._addBush(cx + i, cz - 15, 1.2);
        }
        for (const i of [-20, 20]) {
            this._addTree(cx + i, cz + 20, 1); this._addTree(cx + i, cz - 20, 1);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  STREET LAMP
    // ─────────────────────────────────────────────────────────────────

    _addStreetLamp(x, z, rotY, baseY = 0, parent = null, scale = 1) {
        if (this._isOnRoad(x, z)) return;
        const M = this._M;
        const city = parent || this._cityGroup;
        const g = new THREE.Group(); g.name = 'streetLamp'; g.userData.isLamp = true; g.position.set(x, baseY, z); g.rotation.y = rotY; g.scale.setScalar(scale);

        this._addMesh(this._cylGeo(0.28, 0.55, 1.05, 12), M.metal, 0, 0.52, 0, g);
        this._addMesh(this._cylGeo(0.09, 0.16, 6.4, 10), M.metal, 0, 4.15, 0, g);
        this._addMesh(this._cylGeo(0.17, 0.17, 0.16, 10), M.metal, 0, 6.55, 0, g);

        if (!this._lampArmGeo) {
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, 6.9, 0),
                new THREE.Vector3(0.7, 7.35, 0),
                new THREE.Vector3(1.6, 7.3, 0),
                new THREE.Vector3(2.15, 6.95, 0),
                new THREE.Vector3(2.15, 6.62, 0)
            ]);
            this._lampArmGeo = new THREE.TubeGeometry(curve, 14, 0.05, 6);
        }
        this._addMesh(this._lampArmGeo, M.metal, 0, 0, 0, g);
        this._addMesh(this._cylGeo(0.045, 0.055, 0.7, 6), M.metal, 2.15, 6.95, 0, g);
        this._addMesh(this._boxGeo(0.85, 0.14, 0.35), M.metal, 2.15, 6.4, 0, g);
        this._addMesh(this._boxGeo(0.62, 0.1, 0.24), M.lampGlow, 2.15, 6.28, 0, g);
        this._addMesh(this._boxGeo(0.9, 0.06, 0.4), M.plinth, 2.15, 6.5, 0, g);

        // Registrar posición del foco de esta farola
        if (!this._lampHeadPositions) this._lampHeadPositions = [];
        const hx = x + Math.cos(rotY) * 2.15 * scale;
        const hy = baseY + 6.28 * scale;
        const hz = z - Math.sin(rotY) * 2.15 * scale;
        this._lampHeadPositions.push({ x: hx, y: hy, z: hz });

        city.add(g);
    }

    _initFireflies() {
        if (!this._lampHeadPositions || this._lampHeadPositions.length === 0) return;
        this._firefliesData = [];

        // 3-4 luciérnagas por farola
        for (const hp of this._lampHeadPositions) {
            const count = 3 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                this._firefliesData.push({
                    x: hp.x,
                    y: hp.y,
                    z: hp.z,
                    radius: 0.6 + Math.random() * 1.6,
                    speed: 0.8 + Math.random() * 1.4,
                    phase: Math.random() * Math.PI * 2,
                    heightVar: 0.3 + Math.random() * 0.9
                });
            }
        }

        const total = this._firefliesData.length;
        const posArr = new Float32Array(total * 3);
        for (let i = 0; i < total; i++) {
            const d = this._firefliesData[i];
            posArr[i * 3]     = d.x;
            posArr[i * 3 + 1] = d.y;
            posArr[i * 3 + 2] = d.z;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

        this._fireflyMat = new THREE.PointsMaterial({
            color: 0xccff44, // Amarillo-verde resplandeciente de luciérnaga
            size: 0.7,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this._fireflyPoints = new THREE.Points(geo, this._fireflyMat);
        this._cityGroup.add(this._fireflyPoints);
    }

    // ─────────────────────────────────────────────────────────────────
    //  MAIN BLOCKS
    // ─────────────────────────────────────────────────────────────────

    _buildMainBlocks() {
        this._buildParking(P, P);   this._buildPark(ZQ, P);       this._buildParking(N, P);
        this._buildApartments(P, ZQ); this._buildCentralIsland(ZQ, ZQ); this._buildFactory(N, ZQ);
        this._buildParking(P, N);   this._buildHospital(ZQ, N);   this._buildParking(N, N);
    }

    // ─────────────────────────────────────────────────────────────────
    //  PERIMETER TREES & LAMPS
    // ─────────────────────────────────────────────────────────────────

    _buildPerimeterTrees() {
        for (let i = -95; i <= 95; i += 16) {
            this._addTree(i, -MAP_SIZE / 2 + 9, 0.8 + Math.random() * 0.4);
            this._addTree(i,  MAP_SIZE / 2 - 9, 0.8 + Math.random() * 0.4);
            this._addTree(-MAP_SIZE / 2 + 9, i, 0.8 + Math.random() * 0.4);
            this._addTree( MAP_SIZE / 2 - 9, i, 0.8 + Math.random() * 0.4);
        }

        for (let i = -farGrassHalf + 8; i <= farGrassHalf - 8; i += 24) {
            this._addTree(i, -farGrassHalf + 7, 0.9);
            this._addTree(i,  farGrassHalf - 7, 0.9);
            this._addTree(-farGrassHalf + 7, i, 0.9);
            this._addTree( farGrassHalf - 7, i, 0.9);
        }

        const cAvenues = [-CELL / 2, CELL / 2];
        cAvenues.forEach(cAxis => {
            for (let i = -84; i <= 84; i += 14) {
                if (Math.abs(i) < 32) continue;
                this._addTree(cAxis + (ROAD / 2 + 5), i, 0.7 + Math.random() * 0.3);
                this._addTree(cAxis - (ROAD / 2 + 5), i, 0.7 + Math.random() * 0.3);
            }
        });

        for (let i = -grassOuterHalf + 6; i <= grassOuterHalf - 6; i += 14) {
            this._addTree(i, -grassOuterHalf + 5, 0.6 + Math.random() * 0.3);
            this._addTree(i,  grassOuterHalf - 5, 0.6 + Math.random() * 0.3);
            this._addTree(-grassOuterHalf + 5, i, 0.6 + Math.random() * 0.3);
            this._addTree( grassOuterHalf - 5, i, 0.6 + Math.random() * 0.3);
        }
    }

    _buildStreetLamps() {
        const lampR = roadOuterHalf + 1.4;
        for (let i = -lampR + 8; i <= lampR - 8; i += 16) {
            this._addStreetLamp(i, -lampR,  Math.PI / 2);
            this._addStreetLamp(i,  lampR, -Math.PI / 2);
            this._addStreetLamp(-lampR, i, 0);
            this._addStreetLamp( lampR, i, Math.PI);
        }

        for (let i = -lampR + 8; i <= lampR - 8; i += 16) {
            this._addBush(i, -lampR + 3, 0.7); this._addBush(i,  lampR - 3, 0.7);
            this._addBush(-lampR + 3, i, 0.7); this._addBush( lampR - 3, i, 0.7);
        }

        const half = ROAD / 2 + 2.2;
        for (let i = -84; i <= 84; i += 14) {
            if (Math.abs(i) < 44) continue;
            this._addStreetLamp(CELL / 2 - half, i, 0, ZONE_Y);
            this._addStreetLamp(CELL / 2 + half, i, Math.PI, ZONE_Y);
            this._addStreetLamp(-CELL / 2 - half, i, 0, ZONE_Y);
            this._addStreetLamp(-CELL / 2 + half, i, Math.PI, ZONE_Y);
            this._addStreetLamp(i,  CELL / 2 - half, -Math.PI / 2, ZONE_Y);
            this._addStreetLamp(i,  CELL / 2 + half,  Math.PI / 2, ZONE_Y);
            this._addStreetLamp(i, -CELL / 2 - half, -Math.PI / 2, ZONE_Y);
            this._addStreetLamp(i, -CELL / 2 + half,  Math.PI / 2, ZONE_Y);
        }
        [[-CELL / 2, -CELL / 2], [CELL / 2, -CELL / 2], [-CELL / 2, CELL / 2], [CELL / 2, CELL / 2]].forEach(([ix, iz]) => {
            this._addStreetLamp(ix + half, iz + half, -Math.PI / 4, ZONE_Y);
            this._addStreetLamp(ix - half, iz - half,  Math.PI * 3 / 4, ZONE_Y);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    //  URBAN FURNITURE
    // ─────────────────────────────────────────────────────────────────

    _addBench(x, z, rotY, parent = null, baseY = ZONE_Y) {
        return;
    }

    _addTrashcan(x, z, parent = null, baseY = ZONE_Y) {
        if (this._isOnRoad(x, z)) return;
        const city = parent || this._cityGroup;
        const M = this._M;
        this._addMesh(this._cylGeo(0.32, 0.28, 0.85, 8), M.vent, x, baseY + 0.42, z, city);
        this._addMesh(this._cylGeo(0.36, 0.36, 0.06, 8), M.metal, x, baseY + 0.85, z, city);
    }

    _addPlanter(x, z, parent = null, scale = 1, baseY = ZONE_Y) {
        if (this._isOnRoad(x, z)) return;
        const M = this._M;
        const city = parent || this._cityGroup;
        const g = new THREE.Group(); g.position.set(x, baseY, z); g.scale.setScalar(scale);
        this._addMesh(this._boxGeo(1.5, 0.55, 1.5), M.plinth, 0, 0.28, 0, g);
        this._addMesh(this._boxGeo(1.1, 0.4, 1.1), M.leafB, 0, 0.6, 0, g);
        city.add(g);
    }

    _addBollard(x, z, parent = null, baseY = ZONE_Y) {
        if (this._isOnRoad(x, z)) return;
        const city = parent || this._cityGroup;
        const M = this._M;
        this._addMesh(this._cylGeo(0.13, 0.13, 0.78, 8), M.metal, x, baseY + 0.4, z, city);
        this._addMesh(this._cylGeo(0.16, 0.16, 0.07, 8), M.plinth, x, baseY + 0.035, z, city);
    }

    _addCrosswalk(cx, cz, axis, length, parent = null) {
        const city = parent || this._cityGroup;
        const M = this._M;
        for (let i = -length / 2 + 1; i <= length / 2 - 1; i += 2) {
            if (axis === 'x') this._addMesh(this._boxGeo(1.2, 0.02, 0.9), M.line, cx + i, 0.912, cz, city);
            else               this._addMesh(this._boxGeo(0.9, 0.02, 1.2), M.line, cx, 0.912, cz + i, city);
        }
    }

    _addFlagpole(x, z, parent = null) {
        const city = parent || this._cityGroup;
        const M = this._M;
        this._addMesh(this._cylGeo(0.08, 0.1, 7, 8), M.metal, x, ZONE_Y + 3.5, z, city);
        const flagMat = makeMat(0xb54040); this.cityGroundMaterials.add(flagMat);
        this._addMesh(this._boxGeo(1.4, 0.9, 0.05), flagMat, x + 0.75, ZONE_Y + 6.2, z, city);
    }

    _buildUrbanFurniture() {
        [[-CELL / 2, -CELL / 2], [CELL / 2, -CELL / 2], [-CELL / 2, CELL / 2], [CELL / 2, CELL / 2]].forEach(([ix, iz]) => {
            this._addCrosswalk(ix, iz - ROAD, 'x', ROAD - 2);
            this._addCrosswalk(ix, iz + ROAD, 'x', ROAD - 2);
            this._addCrosswalk(ix - ROAD, iz, 'z', ROAD - 2);
            this._addCrosswalk(ix + ROAD, iz, 'z', ROAD - 2);
        });

        const blockCenters = [[P, P], [ZQ, P], [N, P], [P, ZQ], [ZQ, ZQ], [N, ZQ], [P, N], [ZQ, N], [N, N]];
        blockCenters.forEach(([bx, bz], idx) => {
            const edge = BLOCK / 2 + 1.8;
            this._addTrashcan(bx + (idx % 2 === 0 ? edge : -edge), bz - edge + 4);
            this._addBollard(bx + edge, bz + edge - 6);
            this._addBollard(bx + edge, bz + edge - 8.6);
            this._addPlanter(bx - edge + 2, bz - edge + 2, null, 1.1);
            this._addPlanter(bx + edge - 2, bz + edge - 2, null, 1.1);
        });

        this._extendPark(ZQ, P);
    }

    _extendPark(cx, cz) {
        const M = this._M;
        const city = this._cityGroup;
        const PARK_Y = ZONE_Y;
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
            const path = this._addMesh(this._boxGeo(16, 0.08, 3), M.sidewalk, cx + sx * 10, PARK_Y + 0.04, cz + sz * 10, city, false);
            path.rotation.y = sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4;
        });
        const gx = cx - 20, gz = cz - 20;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4)
            this._addMesh(this._cylGeo(0.18, 0.18, 3, 8), M.wallCap, gx + Math.cos(a) * 3.2, PARK_Y + 1.55, gz + Math.sin(a) * 3.2, city);
        this._addMesh(this._cylGeo(3.6, 3.6, 0.3, 16), M.cornice, gx, PARK_Y + 3.15, gz, city);
        this._addMesh(this._cylGeo(0.2, 0.2, 1.2, 8), M.metal, gx, PARK_Y + 3.85, gz, city);
        this._addMesh(this._cylGeo(3.6, 0.3, 1.4, 16), M.roof2, gx, PARK_Y + 4.55, gz, city);
        this._addBench(gx, gz, 0, city, PARK_Y);
        this._addBench(cx + 9, cz + 9, -Math.PI / 4, city, PARK_Y);
        this._addBench(cx - 9, cz - 9,  Math.PI * 3 / 4, city, PARK_Y);
        this._addBench(cx + 9, cz - 9,  Math.PI / 4, city, PARK_Y);
        this._addPlanter(cx + 5, cz + 5, city, 1.2, PARK_Y); this._addPlanter(cx - 5, cz + 5, city, 1.2, PARK_Y);
        this._addPlanter(cx + 5, cz - 5, city, 1.2, PARK_Y); this._addPlanter(cx - 5, cz - 5, city, 1.2, PARK_Y);
        this._addTrashcan(cx + 6, cz + 12, city, PARK_Y); this._addTrashcan(cx - 6, cz - 12, city, PARK_Y);
        const flowerMat = makeMat(0xd06a6a, { flatShading: true }); this.cityGroundMaterials.add(flowerMat);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6)
            this._addMesh(this._cylGeo(0.4, 0.4, 0.3, 8), flowerMat, cx + Math.cos(a) * 12, PARK_Y + 0.21, cz + Math.sin(a) * 12, city);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 5)
            this._addTree(cx + Math.cos(a) * 22, cz + Math.sin(a) * 22, 0.9 + Math.random() * 0.3);
        this._addBush(cx + 4, cz + 15, 1); this._addBush(cx - 4, cz - 15, 1);
        this._addBush(cx + 15, cz - 4, 1); this._addBush(cx - 15, cz + 4, 1);
        this._addStreetLamp(cx + 18, cz + 18, -Math.PI * 3 / 4, PARK_Y);
        this._addStreetLamp(cx - 18, cz + 18,  Math.PI * 3 / 4, PARK_Y);
        this._addStreetLamp(cx + 18, cz - 18, -Math.PI / 4, PARK_Y);
    }

    // ─────────────────────────────────────────────────────────────────
    //  SMALL HOUSES & COMMERCE
    // ─────────────────────────────────────────────────────────────────

    _addSmallHouse(x, z, rotY, variant = 0) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, ZONE_Y, z); g.rotation.y = rotY;
        const w = 7.5 + (variant % 3) * 0.8, d = 6.5 + (variant % 2) * 1.2, h = 4.6 + (variant % 2) * 0.6;
        const bodyMat = variant % 2 === 0 ? M.house1 : M.house2;
        const roofMat = variant % 2 === 0 ? M.roof1  : M.roof2;
        const hasGarage = variant % 3 === 0;
        this._addMesh(this._boxGeo(w + 0.5, 0.55, d + 0.5), M.plinth, 0, 0.28, 0, g);
        this._addMesh(this._boxGeo(w, h, d), bodyMat, 0, h / 2 + 0.55, 0, g);
        const roofShape = new THREE.Shape();
        roofShape.moveTo(-w / 2 - 0.5, 0); roofShape.lineTo(w / 2 + 0.5, 0);
        roofShape.lineTo(0, 2.8); roofShape.lineTo(-w / 2 - 0.5, 0);
        const rGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 1, bevelEnabled: false });
        rGeo.translate(0, 0, -(d + 1) / 2);
        this._addMesh(rGeo, roofMat, 0, h + 0.55, 0, g);
        this._addMesh(this._boxGeo(1, 2.4, 1), M.facBrick, w / 2 - 1.6, h + 1.4, -d / 2 + 1.6, g);
        this._addWindow(g, 0, 1.9, d / 2, 1.3, 2.6, 0);
        this._addWindow(g, -w / 2 + 1.9, h / 2 + 0.9, d / 2, 1.5, 1.7, 0);
        this._addWindow(g,  w / 2 - 1.9, h / 2 + 0.9, d / 2, 1.5, 1.7, 0);
        this._addWindow(g, 0, h / 2 + 0.9, -d / 2, 1.6, 1.7, Math.PI);
        if (hasGarage) {
            this._addMesh(this._boxGeo(4.2, 3, 4.6), M.wallCap, w / 2 + 2.4, 1.5 + 0.55, -0.3, g);
            this._addMesh(this._boxGeo(3.4, 2.2, 0.12), M.metal, w / 2 + 2.4, 1.1 + 0.55, 2.05, g);
            this._addMesh(this._boxGeo(4.6, 0.25, 5), M.asphalt, w / 2 + 2.4, 0.13, -0.3, g);
        }
        this._addMesh(this._boxGeo(w + 3, 0.05, d / 2), M.grass, 0, 0.05, -d / 2 - d / 4, g);
        this._addGrassZoneLocal(x, z, rotY, 0, -d / 2 - d / 4, (w + 3) / 2, d / 4, ZONE_Y + 0.05 + 0.025);
        for (let fx = -w / 2 - 1.5; fx <= w / 2 + 1.5; fx += 1.5)
            this._addMesh(this._boxGeo(0.1, 0.85, 0.1), M.wood, fx, 0.42, d / 2 + 2.6, g);
        this._addMesh(this._boxGeo(w + 3, 0.1, 0.1), M.wood, 0, 0.75, d / 2 + 2.6, g);
        this._addMesh(this._boxGeo(w + 3, 0.1, 0.1), M.wood, 0, 0.35, d / 2 + 2.6, g);
        this._addMesh(this._boxGeo(1.6, 0.06, 2.4), M.sidewalk, 0, 0.06, d / 2 + 1.4, g);
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    _addSmallCommerce(x, z, rotY, w, d, h, bodyMat, signColor) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, ZONE_Y, z); g.rotation.y = rotY;
        this._buildVolume(g, 0, 0, 0, w, h, d, bodyMat, M.plinth, M.wallCap, M.cornice);
        this._addWindow(g, 0, 2.4, d / 2, w - 2.4, 3.6, 0);
        const signMat = makeMat(signColor); this.cityGroundMaterials.add(signMat);
        this._addMesh(this._boxGeo(w + 1, 0.5, 1.6), signMat, 0, 4.6, d / 2 + 0.7, g);
        const sign2Mat = makeMat(signColor, { emissive: signColor, emissiveIntensity: 0.15 });
        this.cityGroundMaterials.add(sign2Mat);
        this._addMesh(this._boxGeo(w - 1, 1.1, 0.3), sign2Mat, 0, h - 1.2, d / 2 + 0.2, g);
        if (h > 8) for (let y = 8; y < h - 2; y += 4) this._addWindow(g, 0, y, d / 2, w - 3.5, 2, 0);
        this._addHVAC(g, 0, h + 0.4, 0, 0.8);
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    _addCivicBuilding(x, z, rotY, w, d, h, bodyMat, accentMat) {
        const M = this._M;
        const g = new THREE.Group(); g.position.set(x, ZONE_Y, z); g.rotation.y = rotY;
        this._buildVolume(g, 0, 0, 0, w, h, d, bodyMat, M.plinth, accentMat, M.cornice);
        for (let cx2 = -w / 2 + 2; cx2 <= w / 2 - 2; cx2 += (w - 4))
            this._addMesh(this._cylGeo(0.5, 0.5, h * 0.55, 10), M.wallCap, cx2, h * 0.275, d / 2 + 1.4, g);
        this._addMesh(this._boxGeo(w - 1, 0.6, 3.4), M.cornice, 0, h * 0.55 + 0.3, d / 2 + 1.2, g);
        this._addWindow(g, -w / 4, h * 0.4, d / 2, 2.6, 3, 0);
        this._addWindow(g,  w / 4, h * 0.4, d / 2, 2.6, 3, 0);
        this._addMesh(this._boxGeo(2, 3.6, 0.1), M.frame, 0, 1.9, d / 2 + 0.05, g);
        this._addHVAC(g, w / 3, h + 0.4, 0, 1);
        this._cityGroup.add(g);
        this._markBuilding(g);
    }

    // ─────────────────────────────────────────────────────────────────
    //  NEIGHBORHOODS
    // ─────────────────────────────────────────────────────────────────

    _buildNeighborhood(signX, signZ) {
        const M = this._M;
        const city = this._cityGroup;
        const districtCenter = (CITY_EDGE_X + grassOuterHalf) / 2 - 2;
        const cx = signX * districtCenter;
        const cz = signZ * districtCenter;
        this._addMesh(this._boxGeo(38, 0.5, 38), M.grassDark, cx, 0.65, cz, city);
        this._addGrassZone(cx, cz, 19, 19, 0.9);
        this._addMesh(this._boxGeo(30, 0.12, 3.4), M.sidewalk, cx, ZONE_Y + 0.06, cz, city, false);
        this._addMesh(this._boxGeo(3.4, 0.12, 30), M.sidewalk, cx, ZONE_Y + 0.06, cz, city, false);
        const lots = [[-11, -11], [11, -11], [-11, 11], [11, 11], [0, -18], [0, 18]];
        lots.forEach(([lx, lz], i) => {
            this._addSmallHouse(cx + lx, cz + lz, (i % 2 === 0 ? 0 : Math.PI), i);
            this._addTree(cx + lx + signX * 6, cz + lz + signZ * 5, 0.8 + Math.random() * 0.3);
            this._addBush(cx + lx - signX * 4, cz + lz + signZ * 4.5, 0.9);
        });
        this._addBench(cx + 4, cz,  Math.PI / 2, city);
        this._addBench(cx - 4, cz, -Math.PI / 2, city);
        this._addTrashcan(cx + 2, cz + 2, city);
        this._addPlanter(cx + 1.8, cz - 1.8, city, 1);
        this._addPlanter(cx - 1.8, cz + 1.8, city, 1);
        this._addStreetLamp(cx, cz - 16, 0, ZONE_Y);
        this._addStreetLamp(cx, cz + 16, Math.PI, ZONE_Y);
        this._addStreetLamp(cx - 16, cz,  Math.PI / 2, ZONE_Y);
        this._addStreetLamp(cx + 16, cz, -Math.PI / 2, ZONE_Y);
        for (let i = -16; i <= 16; i += 8) {
            this._addTree(cx + i, cz + signZ * 17, 0.9);
            this._addTree(cx + signX * 17, cz + i, 0.9);
        }
    }

    _buildCommerceDistrict(cx, cz) {
        const M = this._M;
        const city = this._cityGroup;
        this._addMesh(this._boxGeo(38, 0.5, 38), M.grassDark, cx, 0.65, cz, city);
        this._addGrassZone(cx, cz, 19, 19, 0.9);
        this._addMesh(this._boxGeo(30, 0.12, 3.4), M.sidewalk, cx, ZONE_Y + 0.06, cz, city, false);
        this._addMesh(this._boxGeo(3.4, 0.12, 30), M.sidewalk, cx, ZONE_Y + 0.06, cz, city, false);
        this._addSmallCommerce(cx - 11, cz - 11, 0,       9,  7,  6, M.apt1,  0xd9622f);
        this._addSmallCommerce(cx + 11, cz - 11, 0,       10, 8,  6, M.apt2,  0x4a8f5c);
        this._addSmallCommerce(cx - 11, cz + 11, Math.PI, 12, 9,  9, M.hosp2, 0x2f6fa8);
        this._addSmallCommerce(cx + 11, cz + 11, Math.PI, 9,  7, 11, M.apt1,  0x8a6cc4);
        this._addBench(cx + 4, cz,  Math.PI / 2, city);
        this._addBench(cx - 4, cz, -Math.PI / 2, city);
        this._addTrashcan(cx + 2, cz + 3, city); this._addTrashcan(cx - 2, cz - 3, city);
        this._addPlanter(cx + 1.8, cz - 1.8, city, 1.1); this._addPlanter(cx - 1.8, cz + 1.8, city, 1.1);
        this._addBollard(cx + 3, cz + 3, city); this._addBollard(cx - 3, cz - 3, city);
        this._addStreetLamp(cx, cz - 16, 0, ZONE_Y); this._addStreetLamp(cx, cz + 16, Math.PI, ZONE_Y);
        this._addStreetLamp(cx - 16, cz,  Math.PI / 2, ZONE_Y); this._addStreetLamp(cx + 16, cz, -Math.PI / 2, ZONE_Y);
        for (let i = -16; i <= 16; i += 8) {
            this._addTree(cx + i, cz + 17, 0.85);
            this._addTree(cx + 17, cz + i, 0.85);
        }
    }

    _buildCivicDistrict(cx, cz) {
        // Farolas repartidas pegadas al terreno (GROUND_FLUSH_Y = 0.40 equivale a Y = 0.20 mundial)
        const GROUND_FLUSH_Y = 0.40;
        const lampOffset = 16;
        const lampAngles = [
            { x: cx - lampOffset, z: cz - lampOffset, rot: 0 },
            { x: cx + lampOffset, z: cz - lampOffset, rot: Math.PI },
            { x: cx - lampOffset, z: cz + lampOffset, rot: Math.PI / 2 },
            { x: cx + lampOffset, z: cz + lampOffset, rot: -Math.PI / 2 }
        ];

        lampAngles.forEach(l => {
            if (!this._isOnRoad(l.x, l.z)) {
                this._addStreetLamp(l.x, l.z, l.rot, GROUND_FLUSH_Y);
            }
        });
    }

    _buildNeighborhoods() {
        const districtCenter = (CITY_EDGE_X + grassOuterHalf) / 2 - 2;
        this._buildNeighborhood(1, 1);
        this._buildNeighborhood(-1, 1);
        this._buildCommerceDistrict( districtCenter, -districtCenter);
        this._buildCivicDistrict   (-districtCenter, -districtCenter);
    }

    _cleanWaterTowerZone() {
        const towerPos = new THREE.Vector3(166.00, 0, -426.84);
        const tempWPos = new THREE.Vector3();
        const CLEANUP_RADIUS = 55.0;

        const toRemove = [];
        this._cityGroup.traverse(child => {
            if (child === this._cityGroup) return;

            child.getWorldPosition(tempWPos);
            const dist = Math.hypot(tempWPos.x - towerPos.x, tempWPos.z - towerPos.z);

            if (dist < CLEANUP_RADIUS) {
                const isLamp = child.name === 'streetLamp' || child.userData?.isLamp === true || (child.parent && child.parent.userData?.isLamp);
                const isWaterTower = child.name === 'WaterTower' || (child.parent && child.parent.name === 'WaterTower');
                if (!isLamp && !isWaterTower) {
                    toRemove.push(child);
                }
            }
        });

        toRemove.forEach(child => {
            child.visible = false;
            child.position.set(0, -9999, 0);
            if (child.parent) {
                try { child.parent.remove(child); } catch (_) {}
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    //  GRASS FIELDS (instanced shader)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Crea un campo de césped instanciado tipo "manojo de hojas anchas".
     * Cada instancia = 16 hojas quad-anchas (5 vértices/2 triángulos) formando un tupido manojo
     * tropical. Al aumentar vértices por instancia en lugar de instancias, el rendimiento
     * se mantiene igual (mismos draw calls) pero visualmente el césped es mucho más denso.
     */
    _createGrassFromPoints(points, bladeH = 1.0, scaleFactor = 1.0) {
        // 16 hojas por manojo, cada hoja = 5 vértices (2 triángulos: cuadro con punta)
        // Layout: base-izq, base-der, medio-izq, medio-der, punta
        // Triángulo 1: 0,1,2  Triángulo 2: 1,3,2  Triángulo 3: 2,3,4 (narrows to tip)
        const BLADES = 16;
        const VERTS_PER_BLADE = 5; // base-L, base-R, mid-L, mid-R, tip
        const VPC = BLADES * VERTS_PER_BLADE;
        const vertices = new Float32Array(VPC * 3);
        const colors   = new Float32Array(VPC * 3);

        // Índices manuales para los 3 triángulos por hoja
        const indexData = [];
        for (let b = 0; b < BLADES; b++) {
            const base = b * VERTS_PER_BLADE;
            // tri 1: baseL, baseR, midL
            indexData.push(base+0, base+1, base+2);
            // tri 2: baseR, midR, midL
            indexData.push(base+1, base+3, base+2);
            // tri 3: midL, midR, tip
            indexData.push(base+2, base+3, base+4);
        }

        const hRef = bladeH;
        const colBase = new THREE.Color(0x5ab810);  // verde base saturado
        const colMid  = new THREE.Color(0x8ad920);  // verde medio brillante
        const colTip  = new THREE.Color(0xc8f535);  // amarillo-verde en la punta
        let vi = 0;

        for (let i = 0; i < BLADES; i++) {
            // Distribuir hojas en ángulos con ligera variación aleatoria
            const a = (i / BLADES) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
            // Inclinación (lean): hojas muy inclinadas para aspecto tropical denso
            const lean = 0.50 + Math.random() * 0.80;
            const h = hRef * (0.65 + Math.random() * 0.55);
            // Hojas más anchas en la base, se van angostando
            const wBase = 0.16 + Math.random() * 0.14;
            const wMid  = wBase * 0.55;
            const sinA = Math.sin(a), cosA = Math.cos(a);
            const sinL = Math.sin(lean), cosL = Math.cos(lean);
            // Radio de desplazamiento desde el centro del manojo
            const rBase = 0.04 + Math.random() * 0.18;

            // 5 puntos de la hoja en espacio local (sin rotación aún)
            const bpts = [
                [-wBase, 0,      0],   // 0: base izquierda
                [ wBase, 0,      0],   // 1: base derecha
                [-wMid,  h*0.5,  0],   // 2: medio izquierda
                [ wMid,  h*0.5,  0],   // 3: medio derecha
                [ 0,     h,      0],   // 4: punta
            ];

            for (let k = 0; k < bpts.length; k++) {
                const [px, py, pz] = bpts[k];
                // Aplicar lean (inclinación hacia afuera)
                const y1 = py * cosL - pz * sinL;
                const z1 = py * sinL + pz * cosL;
                // Aplicar rotación horizontal del ángulo
                const x2 = px * cosA + z1 * sinA;
                const z2 = -px * sinA + z1 * cosA;
                vertices[vi * 3]     = x2 + sinA * rBase;
                vertices[vi * 3 + 1] = y1;
                vertices[vi * 3 + 2] = z2 + cosA * rBase;

                // Color: base más oscuro, medio brillante, punta amarilla
                const t = Math.max(0, Math.min(1, y1 / hRef));
                const c = t < 0.5
                    ? colBase.clone().lerp(colMid, t * 2)
                    : colMid.clone().lerp(colTip, (t - 0.5) * 2);
                const vary = 0.80 + Math.random() * 0.40;
                colors[vi * 3]     = c.r * vary;
                colors[vi * 3 + 1] = c.g * vary;
                colors[vi * 3 + 2] = c.b * vary;
                vi++;
            }
        }

        // Buffer de índices (compartido por todos los manojos via InstancedBufferGeometry)
        const indices = new Uint16Array(indexData);

        const count = points.length;
        const offsets = new Float32Array(count * 3);
        const scales  = new Float32Array(count);
        const aRot    = new Float32Array(count * 2);

        for (let i = 0; i < count; i++) {
            const p = points[i];
            offsets[i * 3]     = p.x;
            offsets[i * 3 + 1] = p.y;
            offsets[i * 3 + 2] = p.z;
            scales[i] = p.scale * scaleFactor;
            const rot = Math.random() * Math.PI * 2;
            aRot[i * 2]     = Math.cos(rot);
            aRot[i * 2 + 1] = Math.sin(rot);
        }

        const instGeo = new THREE.InstancedBufferGeometry();
        instGeo.setIndex(new THREE.BufferAttribute(indices, 1));
        instGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        instGeo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
        instGeo.setAttribute('offset',   new THREE.InstancedBufferAttribute(offsets, 3));
        instGeo.setAttribute('scale',    new THREE.InstancedBufferAttribute(scales, 1));
        instGeo.setAttribute('aRot',     new THREE.InstancedBufferAttribute(aRot, 2));
        instGeo.instanceCount = count;

        const grassMat = new THREE.ShaderMaterial({
            vertexShader: `
                #include <common>
                attribute vec3 offset;
                attribute float scale;
                attribute vec2 aRot;
                attribute vec3 aColor;
                uniform float time;
                varying vec3 vColor;
                #include <logdepthbuf_pars_vertex>
                void main(){
                    vColor = aColor;
                    float wind  = sin(time*0.8 + offset.x*0.15 + offset.z*0.12);
                    float windZ = sin(time*0.6 + offset.z*0.13 + 1.5708);
                    vec3 pos = position;
                    pos.x += wind*0.22*position.y;
                    pos.z += windZ*0.10*position.y;
                    float c=aRot.x, s=aRot.y;
                    mat3 rot=mat3(c,0,s, 0,1,0, -s,0,c);
                    vec3 fp = (rot*(pos*scale)) + offset;
                    gl_Position = projectionMatrix*modelViewMatrix*vec4(fp,1.0);
                    #include <logdepthbuf_vertex>
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                #include <logdepthbuf_pars_fragment>
                void main(){
                    #include <logdepthbuf_fragment>
                    gl_FragColor = vec4(vColor,1.0);
                }
            `,
            uniforms: { time: { value: 0 } },
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(instGeo, grassMat);
        mesh.castShadow    = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;

        // Bounding sphere real del batch para evitar culling incorrecto
        const center = new THREE.Vector3();
        for (const p of points) center.add(new THREE.Vector3(p.x, p.y, p.z));
        center.divideScalar(count);
        let maxR = 0;
        let maxScale = 0;
        for (const p of points) {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dz = p.z - center.z;
            maxR = Math.max(maxR, Math.sqrt(dx*dx + dy*dy + dz*dz));
            maxScale = Math.max(maxScale, p.scale);
        }
        instGeo.boundingSphere = new THREE.Sphere(center, maxR + bladeH * maxScale * 3 + 2);

        this._cityGroup.add(mesh);
        return grassMat;
    }

    _buildGrassFields() {
        this._buildGrassFromZones();
    }

    _buildGrassFromZones() {
        const allPoints = [];

        for (const zone of this._grassZones) {
            const { cx, cz, halfW, halfD, y, holeHalfW, holeHalfD } = zone;
            const zoneDensity = zone.density !== null && zone.density !== undefined ? zone.density : this.GRASS_DENSITY;
            const holeArea = (holeHalfW && holeHalfD) ? holeHalfW * 2 * holeHalfD * 2 : 0;
            const area = halfW * 2 * halfD * 2 - holeArea;
            const nPoints = Math.max(1, Math.round(area * zoneDensity));
            let placed = 0, attempts = 0;
            while (placed < nPoints && attempts < nPoints * 6) {
                attempts++;
                const px = cx + (Math.random() * 2 - 1) * halfW;
                const pz = cz + (Math.random() * 2 - 1) * halfD;
                // En la sección delimitada por la carretera (Z entre -170 y -81, X entre -34 y +34),
                // solo la mitad Oeste (px < 0) NO tiene briznas de césped
                if (px >= -34 && px < 0 && pz >= -170 && pz <= -81) continue;
                if (holeHalfW && holeHalfD && Math.abs(px - cx) < holeHalfW && Math.abs(pz - cz) < holeHalfD) continue;
                if (zone.skipFn && zone.skipFn(px, pz)) continue;
                if (this._isInSportsZone(px, pz)) continue;
                if (this._isOnRoad(px, pz)) continue;
                // Excluir la zona del Avión y las Banderas (-459.61, 355.43)
                if (Math.abs(px - (-459.61)) < 70 && Math.abs(pz - 355.43) < 40) continue;
                // Excluir el círculo sin césped alrededor del Cubo de Rubik Monumental (World 140.60, -269.93 -> Local 133.53, -89.98)
                if (Math.hypot(px - 133.53, pz - (-89.98)) < 6.5) continue;
                allPoints.push({ x: px, y, z: pz, scale: 0.55 + Math.random() * 0.45 });
                placed++;
            }
        }

        if (allPoints.length === 0) return;

        // Log de depuración: rangos de X y Z para comprobar distribución
        {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of allPoints) {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
            }
            console.log(`[PCB] Césped allPoints: ${allPoints.length} | X=[${minX.toFixed(1)}, ${maxX.toFixed(1)}] Z=[${minZ.toFixed(1)}, ${maxZ.toFixed(1)}]`);
        }

        const MAX_TOTAL_BLADES = this.MAX_TOTAL_BLADES;  // límite optimizado por tier de dispositivo
        let finalPoints = allPoints;
        if (allPoints.length > MAX_TOTAL_BLADES) {
            // Fisher-Yates shuffle correcto (el sort aleatorio es muy sesgado)
            for (let i = allPoints.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allPoints[i], allPoints[j]] = [allPoints[j], allPoints[i]];
            }
            finalPoints = allPoints.slice(0, MAX_TOTAL_BLADES);
            console.warn(`[PCB] Césped limitado de ${allPoints.length} a ${MAX_TOTAL_BLADES} briznas para proteger rendimiento (Tier: ${this.tierConfig?.tierName || 'Alta/Desktop'}).`);
        }

        for (let i = 0; i < finalPoints.length; i += this.GRASS_BATCH) {
            const batch = finalPoints.slice(i, i + this.GRASS_BATCH);
            this.grassUniforms.push(this._createGrassFromPoints(batch, this.GRASS_BLADE_H, 1.0));
        }

        console.log(`[PCB] Césped generado: ${finalPoints.length} briznas en ${Math.ceil(finalPoints.length / this.GRASS_BATCH)} batches`);
    }

    // ─────────────────────────────────────────────────────────────────
    //  RAPIER PHYSICS
    // ─────────────────────────────────────────────────────────────────

    _addGroundPhysics() {
        if (!this.physicsWorld) return;

        const sc  = this.cityScale;
        const ox  = this.offsetX;
        const oy  = this.offsetY;
        const oz  = this.offsetZ;

        // ── 1. ZONA CIUDAD (PISO DE CÉSPED Y CIUDAD HASTA EL INICIO DE LA PLAYA: 708u) ──────
        const innerGrassHalfXZ = farGrassHalf * sc; // 236 * 3 = 708
        const grassSurfaceY = oy + GRASS_TOP_Y * sc; // 0.20
        const grassBody = this.physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc.fixed().setTranslation(ox, grassSurfaceY - 8, oz)
        );
        this.physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(innerGrassHalfXZ, 8, innerGrassHalfXZ)
                .setFriction(0.85).setRestitution(0.0),
            grassBody
        );

        // ── 2. PLAZA Y ZONA VERDE (PARQUE DE LA ESTATUA / CENTRO DE LA CIUDAD) ──
        // Altura Y = 1.70 (oy + ZONE_Y * sc = -1.0 + 0.9 * 3.0 = 1.70)
        // Se elimina el offset sobrante (+3) para que la colisión quede pegada exactamente al borde visual.
        const plazaHalfXZ = (CITY_PAD / 2) * sc;
        const plazaSurfaceY = oy + ZONE_Y * sc; // 1.70
        const plazaBody = this.physicsWorld.createRigidBody(
            RAPIER.RigidBodyDesc.fixed().setTranslation(ox, plazaSurfaceY - 4, oz)
        );
        this.physicsWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(plazaHalfXZ, 4, plazaHalfXZ)
                .setFriction(0.85).setRestitution(0.0),
            plazaBody
        );

        // ── 3. CALLES Y CARRETERAS (ALTURA DE LAS LÍNEAS BLANCAS Y ACERAS) ───────────────
        // Superficie nivelada exactamente a 1.70 (líneas blancas de las calles) con bloque de 4u de grosor.
        // Los límites coinciden exactamente con el borde exterior de la acera/vía.
        const roadSurfaceY = plazaSurfaceY; // 1.70
        const roadThickness = 4.0;
        const connHalfLen = (roadInnerHalf - CITY_EDGE_X) / 2;
        const connHalfW = (ROAD / 2) * sc;

        for (const z of [CELL / 2, -CELL / 2]) {
            for (const side of [-1, 1]) {
                const cx = side * (CITY_EDGE_X + connHalfLen);
                const body = this.physicsWorld.createRigidBody(
                    RAPIER.RigidBodyDesc.fixed().setTranslation(ox + cx * sc, roadSurfaceY - roadThickness, oz + z * sc)
                );
                this.physicsWorld.createCollider(
                    RAPIER.ColliderDesc.cuboid(connHalfLen * sc, roadThickness, connHalfW)
                        .setFriction(0.85).setRestitution(0.0),
                    body
                );
            }
        }
        for (const x of [CELL / 2, -CELL / 2]) {
            for (const side of [-1, 1]) {
                const cz = side * (CITY_EDGE_X + connHalfLen);
                const body = this.physicsWorld.createRigidBody(
                    RAPIER.RigidBodyDesc.fixed().setTranslation(ox + x * sc, roadSurfaceY - roadThickness, oz + cz * sc)
                );
                this.physicsWorld.createCollider(
                    RAPIER.ColliderDesc.cuboid(connHalfW, roadThickness, connHalfLen * sc)
                        .setFriction(0.85).setRestitution(0.0),
                    body
                );
            }
        }

        const ringOuterEdge = roadOuterHalf + 0.8;
        const ringMid = (roadInnerHalf + ringOuterEdge) / 2;
        const ringHalfW = (ringOuterEdge - roadInnerHalf) / 2;
        for (const z of [ringMid, -ringMid]) {
            const body = this.physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc.fixed().setTranslation(ox, roadSurfaceY - roadThickness, oz + z * sc)
            );
            this.physicsWorld.createCollider(
                RAPIER.ColliderDesc.cuboid(ringOuterEdge * sc, roadThickness, ringHalfW * sc)
                    .setFriction(0.85).setRestitution(0.0),
                body
            );
        }
        for (const x of [ringMid, -ringMid]) {
            const body = this.physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc.fixed().setTranslation(ox + x * sc, roadSurfaceY - roadThickness, oz)
            );
            this.physicsWorld.createCollider(
                RAPIER.ColliderDesc.cuboid(ringHalfW * sc, roadThickness, ringOuterEdge * sc)
                    .setFriction(0.85).setRestitution(0.0),
                body
            );
        }

        console.log(`[PCB] Suelo — césped Y=${grassSurfaceY.toFixed(2)}, plaza/carretera Y=${plazaSurfaceY.toFixed(2)}`);

        for (const c of this._colliders) {
            const wx = ox + c.x * sc;
            const wy = oy + c.y * sc;
            const wz = oz + c.z * sc;
            const body = this.physicsWorld.createRigidBody(
                RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy, wz)
            );
            if (c.type === 'cylinder') {
                this.physicsWorld.createCollider(
                    RAPIER.ColliderDesc.cylinder(c.hh * sc, c.r * sc)
                        .setFriction(0.6).setRestitution(0.0),
                    body
                );
            } else {
                this.physicsWorld.createCollider(
                    RAPIER.ColliderDesc.cuboid(c.hw * sc, c.hh * sc, c.hd * sc)
                        .setFriction(0.8).setRestitution(0.0),
                    body
                );
            }
        }

        console.log(`[PCB] Colliders de edificios/árboles añadidos: ${this._colliders.length}`);
    }
}