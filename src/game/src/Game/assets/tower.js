/**
 * tower.js — Módulo 3D de la Torre de Agua en Three.js con colisión física Rapier.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class WaterTower {
    /**
     * @param {THREE.Scene} scene
     * @param {Object} [options]
     * @param {number} [options.x=166.00]
     * @param {number} [options.y=0.20]
     * @param {number} [options.z=-426.84]
     * @param {number} [options.scale=3.5]
     * @param {RAPIER.World} [options.physicsWorld=null]
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.x = options.x ?? 166.00;
        this.y = options.y ?? 0.20;
        this.z = options.z ?? -426.84;
        this.scale = options.scale ?? 3.5;
        this.physicsWorld = options.physicsWorld ?? null;

        this.group = new THREE.Group();
        this.group.name = 'WaterTower';
        this.group.position.set(this.x, this.y, this.z);
        this.group.scale.setScalar(this.scale);

        this.colliders = [];
        this._build();
        this.scene.add(this.group);
    }

    _build() {
        // Materiales optimizados con PBR Standard
        const matBase    = new THREE.MeshStandardMaterial({ color: 0xa8c0d0, roughness: 0.6, metalness: 0.1 });
        const matSteel   = new THREE.MeshStandardMaterial({ color: 0x9bafc0, roughness: 0.35, metalness: 0.6 });
        const matTank    = new THREE.MeshStandardMaterial({ color: 0x29b6d4, roughness: 0.35, metalness: 0.2 });
        const matBottom  = new THREE.MeshStandardMaterial({ color: 0xd0e8ef, roughness: 0.4, metalness: 0.1 });
        const matRoof    = new THREE.MeshStandardMaterial({ color: 0xd6e8f0, roughness: 0.3, metalness: 0.1 });
        const matRoofTop = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });

        // ── 1. Plataforma Base ──────────────────────────────────────────
        const platGeo = new THREE.BoxGeometry(11, 0.4, 11);
        const platform = new THREE.Mesh(platGeo, matBase);
        platform.position.set(0, 0.2, 0);
        platform.castShadow = true;
        platform.receiveShadow = true;
        this.group.add(platform);

        // ── 2. Estructura de Torre (Vigas, Patas, Anillos, Cruces) ──────
        const steelGeometries = [];

        const legH   = 7.5;
        const legR   = 0.18;
        const spread = 3.3;
        const topR   = 1.5;

        const legBasePos = [
            [ spread, 0, spread],
            [-spread, 0, spread],
            [-spread, 0,-spread],
            [ spread, 0,-spread],
        ];
        const legTopPos = [
            [ topR, legH, topR],
            [-topR, legH, topR],
            [-topR, legH, -topR],
            [ topR, legH, -topR],
        ];

        // Helper para crear geometrías orientadas
        const createBarGeo = (p1, p2, radius) => {
            const dir = new THREE.Vector3().subVectors(p2, p1);
            const len = dir.length();
            const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            const geo = new THREE.CylinderGeometry(radius, radius, len, 6);

            const dummy = new THREE.Object3D();
            dummy.position.copy(mid);
            dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            dummy.updateMatrix();

            geo.applyMatrix4(dummy.matrix);
            return geo;
        };

        // 2a. Columnas principales inclinadas
        legBasePos.forEach((b, i) => {
            const p1 = new THREE.Vector3(...b).setY(0.4);
            const p2 = new THREE.Vector3(...legTopPos[i]);
            steelGeometries.push(createBarGeo(p1, p2, legR));
        });

        // 2b. Pies / Bases de columnas
        legBasePos.forEach(b => {
            const footGeo = new THREE.BoxGeometry(0.7, 0.18, 0.7);
            footGeo.translate(b[0], 0.45, b[2]);
            steelGeometries.push(footGeo);
        });

        // 2c. Anillos horizontales
        const ringLevels = [1.8, 3.8, 5.8];
        ringLevels.forEach(y => {
            const f = y / legH;
            const rr = spread + (topR - spread) * f;
            const corners = [
                [ rr, y,  rr],
                [-rr, y,  rr],
                [-rr, y, -rr],
                [ rr, y, -rr],
            ];
            corners.forEach((c, i) => {
                const next = corners[(i + 1) % 4];
                steelGeometries.push(createBarGeo(new THREE.Vector3(...c), new THREE.Vector3(...next), 0.10));
            });
        });

        // 2d. Cruces diagonales
        const allLevels = [0.4, 1.8, 3.8, 5.8, legH];
        const faces = [
            [0, 1], [1, 2], [2, 3], [3, 0]
        ];

        faces.forEach(([a, b]) => {
            for (let li = 0; li < allLevels.length - 1; li++) {
                const y0 = allLevels[li];
                const y1 = allLevels[li + 1];
                const f0 = y0 / legH, f1 = y1 / legH;
                const r0 = spread + (topR - spread) * f0;
                const r1 = spread + (topR - spread) * f1;

                const baseAngles = [
                    Math.atan2(legBasePos[a][2], legBasePos[a][0]),
                    Math.atan2(legBasePos[b][2], legBasePos[b][0]),
                ];

                const p00 = new THREE.Vector3(r0 * Math.cos(baseAngles[0]), y0, r0 * Math.sin(baseAngles[0]));
                const p01 = new THREE.Vector3(r0 * Math.cos(baseAngles[1]), y0, r0 * Math.sin(baseAngles[1]));
                const p10 = new THREE.Vector3(r1 * Math.cos(baseAngles[0]), y1, r1 * Math.sin(baseAngles[0]));
                const p11 = new THREE.Vector3(r1 * Math.cos(baseAngles[1]), y1, r1 * Math.sin(baseAngles[1]));

                steelGeometries.push(createBarGeo(p00, p11, 0.08));
                steelGeometries.push(createBarGeo(p01, p10, 0.08));
            }
        });

        // 2e. Plataforma superior de la estructura
        const platTopGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.22, 16);
        platTopGeo.translate(0, legH + 0.11, 0);
        steelGeometries.push(platTopGeo);

        // Fusionar geometrías de acero en 1 solo Mesh para máximo rendimiento
        if (steelGeometries.length > 0) {
            const mergedSteelGeo = mergeGeometries(steelGeometries, false);
            const steelMesh = new THREE.Mesh(mergedSteelGeo, matSteel);
            steelMesh.castShadow = true;
            steelMesh.receiveShadow = true;
            this.group.add(steelMesh);
        }

        // ── 3. Tanque y Cúpula ──────────────────────────────────────────
        const tankGroup = new THREE.Group();
        tankGroup.position.set(0, legH + 0.22, 0);
        this.group.add(tankGroup);

        // Cuerpo del tanque
        const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 3.8, 24), matTank);
        tankBody.position.y = 2.4;
        tankBody.castShadow = true;
        tankBody.receiveShadow = true;
        tankGroup.add(tankBody);

        // Fondo redondeado
        const bottomGeo = new THREE.SphereGeometry(1.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const tankBottom = new THREE.Mesh(bottomGeo, matBottom);
        tankBottom.position.y = 0.5;
        tankBottom.rotation.x = Math.PI;
        tankBottom.castShadow = true;
        tankBottom.receiveShadow = true;
        tankGroup.add(tankBottom);

        // Banda inferior
        const tankBand = new THREE.Mesh(new THREE.CylinderGeometry(1.87, 1.87, 0.45, 24), matBottom);
        tankBand.position.y = 0.95;
        tankBand.castShadow = true;
        tankBand.receiveShadow = true;
        tankGroup.add(tankBand);

        // Techo cónico
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.8, 24), matRoof);
        roof.position.y = 5.2;
        roof.castShadow = true;
        roof.receiveShadow = true;
        tankGroup.add(roof);

        // Punta del techo
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 12), matRoofTop);
        tip.position.y = 6.18;
        tip.castShadow = true;
        tankGroup.add(tip);

        // ── 4. Colisionadores Físicos Rapier ────────────────────────────
        if (this.physicsWorld && typeof RAPIER !== 'undefined' && RAPIER.ColliderDesc) {
            try {
                // Base cuboid collider
                const platHalfW = (11 * this.scale) / 2;
                const platHalfH = (0.4 * this.scale) / 2;
                const platBodyDesc = RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(this.x, this.y + platHalfH, this.z);
                const platBody = this.physicsWorld.createRigidBody(platBodyDesc);
                const platColDesc = RAPIER.ColliderDesc.cuboid(platHalfW, platHalfH, platHalfW)
                    .setFriction(0.7);
                this.physicsWorld.createCollider(platColDesc, platBody);

                // Structure & Tank cylinder collider
                const structRadius = (2.2 * this.scale);
                const structHalfH  = ((legH + 6) * this.scale) / 2;
                const structBodyDesc = RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(this.x, this.y + structHalfH, this.z);
                const structBody = this.physicsWorld.createRigidBody(structBodyDesc);
                
                const structColDesc = RAPIER.ColliderDesc.cuboid(structRadius, structHalfH, structRadius);
                this.physicsWorld.createCollider(structColDesc, structBody);
            } catch (e) {
                console.warn('[WaterTower] Physics creation error handled gracefully:', e);
            }
        }
    }
}
