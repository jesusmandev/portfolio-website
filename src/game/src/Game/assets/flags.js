import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { AssetCache } from '../../Intro/AssetCache.js';
import { addTrimeshPhysics } from '../TrimeshCollider.js';

/**
 * flags.js
 * Exposición de Banderas del Mundo + Avión Grande 3D (Optimizado).
 * Posicionado por defecto en X: -459.61, Y: 0.20, Z: 355.43
 */

// ── DIBUJO DE BANDERAS ESPECÍFICAS EN CANVAS 2D ───────────────────

function drawItalia(ctx, w, h) {
    ctx.fillStyle = '#009246'; ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = '#CE2B37'; ctx.fillRect((w / 3) * 2, 0, w / 3, h);
}

function drawAlemania(ctx, w, h) {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#FFCC00'; ctx.fillRect(0, (h / 3) * 2, w, h / 3);
}

function drawEspana(ctx, w, h) {
    // Franjas: Roja (1/4), Amarilla (2/4), Roja (1/4)
    ctx.fillStyle = '#AA151B'; ctx.fillRect(0, 0, w, h / 4);
    ctx.fillStyle = '#F1BF00'; ctx.fillRect(0, h / 4, w, h / 2);
    ctx.fillStyle = '#AA151B'; ctx.fillRect(0, (h / 4) * 3, w, h / 4);
    
    // Escudo de España
    const cx = w * 0.33;
    const cy = h / 2;
    const shieldHeight = h * 0.35;
    const shieldWidth = shieldHeight * 0.8;
    
    ctx.save();
    ctx.translate(cx, cy);

    // Fondo del escudo (Forma principal)
    ctx.beginPath();
    ctx.moveTo(-shieldWidth / 2, -shieldHeight / 2);
    ctx.lineTo(shieldWidth / 2, -shieldHeight / 2);
    ctx.lineTo(shieldWidth / 2, shieldHeight / 4);
    ctx.bezierCurveTo(shieldWidth / 2, shieldHeight / 2, 0, shieldHeight / 2 * 1.2, 0, shieldHeight / 2 * 1.2);
    ctx.bezierCurveTo(0, shieldHeight / 2 * 1.2, -shieldWidth / 2, shieldHeight / 2, -shieldWidth / 2, shieldHeight / 4);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Cuadrantes (clip)
    ctx.clip();

    // 1. Castilla (Rojo con castillo amarillo)
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(-shieldWidth / 2, -shieldHeight / 2, shieldWidth / 2, shieldHeight / 2);
    ctx.fillStyle = '#F1BF00';
    const castleS = shieldWidth * 0.25;
    ctx.fillRect(-shieldWidth / 4 - castleS / 2, -shieldHeight / 4 - castleS / 2 + 5, castleS, castleS);
    ctx.fillRect(-shieldWidth / 4 - castleS / 2, -shieldHeight / 4 - castleS / 2, castleS / 3, 5);
    ctx.fillRect(-shieldWidth / 4 - castleS / 6, -shieldHeight / 4 - castleS / 2, castleS / 3, 5);
    ctx.fillRect(-shieldWidth / 4 + castleS / 6, -shieldHeight / 4 - castleS / 2, castleS / 3, 5);

    // 2. León (Blanco con león púrpura)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, -shieldHeight / 2, shieldWidth / 2, shieldHeight / 2);
    ctx.fillStyle = '#A2006D';
    ctx.beginPath();
    ctx.arc(shieldWidth / 4, -shieldHeight / 4 + 5, shieldWidth * 0.12, 0, Math.PI * 2);
    ctx.arc(shieldWidth / 4 - 10, -shieldHeight / 4 - 10, shieldWidth * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // 3. Aragón (Barras amarillas y rojas)
    ctx.fillStyle = '#F1BF00';
    ctx.fillRect(-shieldWidth / 2, 0, shieldWidth / 2, shieldHeight / 2);
    ctx.fillStyle = '#AA151B';
    for (let i = 1; i < 4; i += 2) {
        ctx.fillRect(-shieldWidth / 2 + (shieldWidth / 8) * i, 0, shieldWidth / 8, shieldHeight / 2);
    }

    // 4. Navarra (Rojo con cadenas doradas)
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(0, 0, shieldWidth / 2, shieldHeight / 2);
    ctx.strokeStyle = '#F1BF00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(shieldWidth / 2, shieldHeight / 2);
    ctx.moveTo(shieldWidth / 2, 0); ctx.lineTo(0, shieldHeight / 2);
    ctx.moveTo(shieldWidth / 4, 0); ctx.lineTo(shieldWidth / 4, shieldHeight / 2);
    ctx.moveTo(0, shieldHeight / 4); ctx.lineTo(shieldWidth / 2, shieldHeight / 4);
    ctx.stroke();

    // Granada (Base)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-shieldWidth / 4, shieldHeight / 2 * 0.9);
    ctx.lineTo(shieldWidth / 4, shieldHeight / 2 * 0.9);
    ctx.lineTo(0, shieldHeight / 2 * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#009246';
    ctx.beginPath(); ctx.arc(0, shieldHeight / 2 * 0.95, 3, 0, Math.PI * 2); ctx.fill();

    // Borbón-Anjou
    ctx.fillStyle = '#0033A0';
    ctx.beginPath();
    ctx.arc(0, 0, shieldWidth * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#AA151B';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#F1BF00';
    ctx.fillRect(-4, -4, 3, 3);
    ctx.fillRect(2, -4, 3, 3);
    ctx.fillRect(-1, 2, 3, 3);

    ctx.restore();

    // Columnas de Hércules
    const colWidth = shieldWidth * 0.15;
    const colHeight = shieldHeight * 0.9;
    const colDist = shieldWidth * 0.8;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - colDist, cy - colHeight / 2, colWidth, colHeight);
    ctx.fillRect(cx + colDist - colWidth, cy - colHeight / 2, colWidth, colHeight);
    
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(cx - colDist - 2, cy - colHeight / 2 - 5, colWidth + 4, 5);
    ctx.fillRect(cx - colDist - 2, cy + colHeight / 2, colWidth + 4, 5);
    ctx.fillRect(cx + colDist - colWidth - 2, cy - colHeight / 2 - 5, colWidth + 4, 5);
    ctx.fillRect(cx + colDist - colWidth - 2, cy + colHeight / 2, colWidth + 4, 5);

    // Corona real
    ctx.fillStyle = '#F1BF00';
    ctx.beginPath();
    ctx.moveTo(cx - shieldWidth / 2, cy - shieldHeight / 2 - 5);
    ctx.lineTo(cx + shieldWidth / 2, cy - shieldHeight / 2 - 5);
    ctx.lineTo(cx + shieldWidth / 2 + 10, cy - shieldHeight / 2 - 25);
    ctx.lineTo(cx + shieldWidth / 4, cy - shieldHeight / 2 - 15);
    ctx.lineTo(cx, cy - shieldHeight / 2 - 30);
    ctx.lineTo(cx - shieldWidth / 4, cy - shieldHeight / 2 - 15);
    ctx.lineTo(cx - shieldWidth / 2 - 10, cy - shieldHeight / 2 - 25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(cx - shieldWidth / 2, cy - shieldHeight / 2 - 8, shieldWidth, 3);
}

function drawSuiza(ctx, w, h) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, w, h);
    
    const cw = w * 0.15;
    const ch = h * 0.6;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect((w - cw) / 2, (h - ch) / 2, cw, ch);
    ctx.fillRect((w - ch) / 2, (h - cw) / 2, ch, cw);
}

function drawCanada(ctx, w, h) {
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, 0, w / 4, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 4, 0, w / 2, h);
    ctx.fillStyle = '#FF0000'; ctx.fillRect((w / 4) * 3, 0, w / 4, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    
    const s = h * 0.46; 
    
    ctx.moveTo(0, -0.85 * s);
    ctx.lineTo(0.12 * s, -0.35 * s);
    ctx.lineTo(0.32 * s, -0.55 * s);
    ctx.lineTo(0.28 * s, -0.20 * s);
    ctx.lineTo(0.72 * s, -0.35 * s);
    ctx.lineTo(0.55 * s, -0.05 * s);
    ctx.lineTo(0.95 * s, 0.05 * s);
    ctx.lineTo(0.60 * s, 0.20 * s);
    ctx.lineTo(0.75 * s, 0.45 * s);
    ctx.lineTo(0.35 * s, 0.35 * s);
    ctx.lineTo(0.40 * s, 0.65 * s);
    ctx.lineTo(0.06 * s, 0.55 * s);
    
    ctx.lineTo(0.06 * s, 0.95 * s);
    ctx.lineTo(-0.06 * s, 0.95 * s);
    
    ctx.lineTo(-0.06 * s, 0.55 * s);
    ctx.lineTo(-0.40 * s, 0.65 * s);
    ctx.lineTo(-0.35 * s, 0.35 * s);
    ctx.lineTo(-0.75 * s, 0.45 * s);
    ctx.lineTo(-0.60 * s, 0.20 * s);
    ctx.lineTo(-0.95 * s, 0.05 * s);
    ctx.lineTo(-0.55 * s, -0.05 * s);
    ctx.lineTo(-0.72 * s, -0.35 * s);
    ctx.lineTo(-0.28 * s, -0.20 * s);
    ctx.lineTo(-0.32 * s, -0.55 * s);
    ctx.lineTo(-0.12 * s, -0.35 * s);
    
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function drawUSA(ctx, w, h) {
    const stripeHeight = h / 13;
    for (let i = 0; i < 13; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#FFFFFF';
        ctx.fillRect(0, i * stripeHeight, w, stripeHeight);
    }

    const cantonWidth = w * 0.4;
    const cantonHeight = stripeHeight * 7;
    ctx.fillStyle = '#3C3B6E';
    ctx.fillRect(0, 0, cantonWidth, cantonHeight);

    ctx.fillStyle = '#FFFFFF';
    const starRadius = stripeHeight * 0.35;
    const hGap = cantonWidth / 12;
    const vGap = cantonHeight / 10;

    for (let row = 1; row <= 9; row++) {
        let cols = (row % 2 !== 0) ? 6 : 5;
        let startX = (row % 2 !== 0) ? hGap : hGap * 2;
        for (let col = 0; col < cols; col++) {
            const cx = startX + col * hGap * 2;
            const cy = row * vGap;
            drawStar(ctx, cx, cy, 5, starRadius, starRadius * 0.4);
        }
    }
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

function createCanvasTexture(drawFunction) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    drawFunction(ctx, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// ── CLASE PRINCIPAL ───────────────────────────────────────────────

export class FlagsExhibition {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [options]
     * @param {number} [options.x=-459.61]
     * @param {number} [options.y=0.20]
     * @param {number} [options.z=355.43]
     * @param {number} [options.airplaneScale=25.0]
     * @param {object} [options.physicsWorld=null]
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.wx = options.x ?? -459.61;
        this.wy = options.y ?? 0.20;
        this.wz = options.z ?? 355.43;
        this.airplaneScale = options.airplaneScale ?? 25.0;
        this.physicsWorld = options.physicsWorld ?? null;

        this.group = new THREE.Group();
        this.group.position.set(this.wx, this.wy, this.wz);
        this.scene.add(this.group);

        this.flags = [];
        this.frameCount = 0;

        this._initAirplane();
        this._initFlags();
    }

    _initAirplane() {
        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
        const airplaneUrl = `${baseUrl}/airplane/Airplane.glb`;

        const loadAirplaneMesh = (gltfScene) => {
            const airplane = gltfScene.clone(true);
            
            // Habilitar sombras y asegurar materiales correctos
            airplane.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            airplane.scale.setScalar(this.airplaneScale);
            airplane.rotation.y = Math.PI / 4; // Diagonal para vista panorámica

            // Calcular bounding box para dejar las ruedas/base a ras del suelo (Y: 0.20)
            const initialBox = new THREE.Box3().setFromObject(airplane);
            airplane.position.set(0, -initialBox.min.y, 0);

            this.group.add(airplane);

            // Agregar física Trimesh exacta a las superficies reales del avión
            if (this.physicsWorld) {
                this.group.updateMatrixWorld(true);
                addTrimeshPhysics(airplane, this.physicsWorld, 'Airplane');
            }
        };

        if (AssetCache.has(airplaneUrl)) {
            loadAirplaneMesh(AssetCache.get(airplaneUrl).scene);
        } else {
            const loader = new GLTFLoader();
            if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
            loader.load(
                airplaneUrl,
                (gltf) => {
                    AssetCache.set(airplaneUrl, gltf);
                    loadAirplaneMesh(gltf.scene);
                },
                undefined,
                (err) => {
                    console.error('[FlagsExhibition] Error cargando Airplane.glb:', err);
                }
            );
        }
    }

    _initFlags() {
        // Banderas posicionadas dentro de la zona verde
        const flagConfigs = [
            // Izquierda
            { name: "Canadá",  texture: createCanvasTexture(drawCanada),   pos: [-48, 0, -18] },
            { name: "USA",     texture: createCanvasTexture(drawUSA),      pos: [-58, 0,   0] },
            { name: "Italia",  texture: createCanvasTexture(drawItalia),   pos: [-48, 0,  18] },
            // Derecha
            { name: "Suiza",   texture: createCanvasTexture(drawSuiza),    pos: [ 48, 0, -18] },
            { name: "Alemania",texture: createCanvasTexture(drawAlemania), pos: [ 58, 0,   0] },
            { name: "España",  texture: createCanvasTexture(drawEspana),   pos: [ 48, 0,  18] }
        ];

        const flagWidth = 7.0;
        const flagHeight = 3.5;
        const poleHeight = 14.0;

        // Geometrías compartidas para los mástiles
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, poleHeight, 16);
        const baseGeo = new THREE.CylinderGeometry(0.6, 0.75, 0.45, 16);
        const knobGeo = new THREE.SphereGeometry(0.28, 12, 12);

        const poleMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.85, roughness: 0.2 });
        const knobMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.1 });

        const flagGeoTemplate = new THREE.PlaneGeometry(flagWidth, flagHeight, 44, 28);

        flagConfigs.forEach((data, index) => {
            const [relX, relY, relZ] = data.pos;

            // 1. Mástil
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(relX - flagWidth / 2 - 0.12, poleHeight / 2, relZ);
            pole.castShadow = true;
            this.group.add(pole);

            // Base mástil
            const base = new THREE.Mesh(baseGeo, poleMat);
            base.position.set(pole.position.x, 0.22, relZ);
            this.group.add(base);

            // Perilla dorada arriba
            const knob = new THREE.Mesh(knobGeo, knobMat);
            knob.position.set(pole.position.x, poleHeight + 0.15, relZ);
            this.group.add(knob);

            // 2. Bandera
            const flagMat = new THREE.MeshStandardMaterial({
                map: data.texture,
                side: THREE.DoubleSide,
                roughness: 0.45,
                metalness: 0.05
            });

            const mesh = new THREE.Mesh(flagGeoTemplate.clone(), flagMat);
            // Posicionar la bandera pegada al mástil en la parte superior
            mesh.position.set(relX, poleHeight - flagHeight / 2 - 0.3, relZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Guardar posiciones originales de los vértices (copia optimizada)
            mesh.userData.originalPositions = new Float32Array(mesh.geometry.attributes.position.array);
            mesh.userData.offset = index * Math.PI * 0.6;
            mesh.userData.flagWidth = flagWidth;

            this.group.add(mesh);
            this.flags.push(mesh);

            // Colisiones físicas para los mástiles si physicsWorld está activo
            if (this.physicsWorld) {
                const worldPoleX = this.wx + pole.position.x;
                const worldPoleZ = this.wz + relZ;
                const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(worldPoleX, this.wy + poleHeight / 2, worldPoleZ);
                const body = this.physicsWorld.createRigidBody(rigidBodyDesc);
                const colliderDesc = RAPIER.ColliderDesc.cylinder(poleHeight / 2, 0.6);
                this.physicsWorld.createCollider(colliderDesc, body);
            }
        });
    }

    update(delta) {
        this.frameCount++;
        const time = performance.now() * 0.001;

        // Animar las banderas de forma fluida con acceso directo a Float32Array
        for (let idx = 0; idx < this.flags.length; idx++) {
            const flag = this.flags[idx];
            const positionAttr = flag.geometry.attributes.position;
            const pos = positionAttr.array;
            const orig = flag.userData.originalPositions;
            const count = positionAttr.count;
            const offset = flag.userData.offset;
            const width = flag.userData.flagWidth;

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const x = orig[i3];
                
                // Normalizado de 0 (pegado al mástil) a 1 (extremo libre)
                const normalizedX = (x + width / 2) / width;
                
                // Movimiento senoidal de viento
                const wave = Math.sin(normalizedX * 6 - time * 4 + offset) * (normalizedX * 0.45);
                const waveY = Math.cos(normalizedX * 3 - time * 2) * (normalizedX * 0.12);

                pos[i3 + 2] = orig[i3 + 2] + wave;
                pos[i3 + 1] = orig[i3 + 1] + waveY;
            }

            positionAttr.needsUpdate = true;
            // Throttle de recálculo de normales para óptimo rendimiento
            if (this.frameCount % 2 === 0) {
                flag.geometry.computeVertexNormals();
            }
        }
    }
}
