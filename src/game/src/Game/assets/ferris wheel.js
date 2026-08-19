/**
 * FerrisWheel.js  —  Versión optimizada con escala y colisión física.
 *
 * Características:
 *  - Renderizado optimizado con InstancedMesh (2 draw calls para bombillas).
 *  - Iluminación nocturna mediante 8 PointLights estratégicas.
 *  - Escala global mediante `options.scale`.
 *  - Soporte de física con Rapier (`options.physicsWorld`) para evitar traspasarla.
 *  - Animación suave y rotación nocturna integrada con TimeCycle.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ─────────────────────────────────────────────────────────────────
//  HELPER: tubo entre dos puntos (sin alocaciones extra en update)
// ─────────────────────────────────────────────────────────────────

const _V0 = new THREE.Vector3();
const _V1 = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

function _tube(p1, p2, radius, material, parent, segs = 6) {
    _V0.subVectors(p2, p1);
    const len = _V0.length();
    if (len < 0.001) return null;
    const geo  = new THREE.CylinderGeometry(radius, radius, len, segs);
    const mesh = new THREE.Mesh(geo, material);
    _V1.addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(_V1);
    mesh.quaternion.setFromUnitVectors(_UP, _V0.normalize());
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

function v(x, y, z) { return new THREE.Vector3(x, y, z); }

// ─────────────────────────────────────────────────────────────────
//  CLASE PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export class FerrisWheel {
    /**
     * @param {THREE.Scene} scene
     * @param {object}      [options]
     * @param {number}      [options.x=0.20]
     * @param {number}      [options.y=0.20]
     * @param {number}      [options.z=336.33]
     * @param {number}      [options.scale=1.8]
     * @param {object}      [options.physicsWorld=null]  - Instancia de Rapier.World
     */
    constructor(scene, options = {}) {
        this.scene = scene;

        this._wx           = options.x            ?? 0.20;
        this._wy           = options.y            ?? 0.20;
        this._wz           = options.z            ?? 336.33;
        this._scale        = options.scale        ?? 1.8;
        this._physicsWorld = options.physicsWorld ?? null;

        this._time       = 0;
        this._nightAlpha = 0;   // 0 = día, 1 = noche

        this._wheelGroup   = null;
        this._cabins       = [];   // [{cabin}]
        this._bulbInstBig  = null; // InstancedMesh bombillas grandes
        this._bulbInstSml  = null; // InstancedMesh bombillas pequeñas
        this._bulbsBig     = [];   // [{angle, flicker offset}]
        this._bulbsSml     = [];
        this._nightLights  = [];   // PointLights compartidas (solo 8)
        this._physicsBody  = null;

        // Color temporal reutilizado en update (evita GC)
        this._tmpColor = new THREE.Color();
        this._tmpM4    = new THREE.Matrix4();

        this._build();
    }

    // ─────────────────────────────────────────────────────────────────
    //  CONSTRUCCIÓN
    // ─────────────────────────────────────────────────────────────────

    _build() {
        // ── Dimensiones base ─────────────────────────────────────────
        const radius      = 17;
        const wheelThick  = 3.2;
        const halfT       = wheelThick / 2;
        const rimTube     = 0.28;
        const spokeCount  = 12;
        const cabinCount  = 12;
        const innerRadius = radius * 0.55;

        // ── Materiales compartidos ───────────────────────────────────
        const mat = {
            support:  new THREE.MeshStandardMaterial({ color: 0xc84c4c, roughness: 0.55 }),
            rim:      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4, metalness: 0.25 }),
            innerRim: new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4, metalness: 0.2 }),
            spoke:    new THREE.MeshStandardMaterial({ color: 0xc84c4c, roughness: 0.55 }),
            hub:      new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.35, metalness: 0.35 }),
            axle:     new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.35, metalness: 0.6 }),
            strut:    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5,  metalness: 0.3 }),
            armHang:  new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5,  metalness: 0.4 }),
            winMat:   new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2,  metalness: 0.4 }),
            roofMat:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
        };

        this._bulbMat = new THREE.MeshStandardMaterial({
            color:             0xffffff,
            emissive:          0xffffff,
            emissiveIntensity: 0,
            roughness:         0.1,
            metalness:         0.1,
            vertexColors:      false,
            toneMapped:        false,
        });

        // ── Grupo raíz (contiene TODA la estructura y escala uniformemente) ──
        this._root = new THREE.Group();
        this._root.position.set(this._wx, this._wy, this._wz);
        this._root.scale.setScalar(this._scale);
        this.scene.add(this._root);

        // ── Grupo giratorio (elevado dentro del root) ───────────────
        const wg = new THREE.Group();
        wg.position.set(0, radius + 6, 0);
        this._root.add(wg);
        this._wheelGroup = wg;

        // ── Geometrías reutilizadas ──────────────────────────────────
        const outerTorusGeo = new THREE.TorusGeometry(radius,      rimTube,          10, 60);
        const innerTorusGeo = new THREE.TorusGeometry(innerRadius, rimTube * 0.75,   10, 48);
        const hubCapGeo     = new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24);
        const bodyGeo       = new THREE.CylinderGeometry(1.2, 1.0, 1.5, 8);
        const winGeo        = new THREE.BoxGeometry(2.2, 0.6, 1.7);
        const roofGeo       = new THREE.BoxGeometry(2.5, 0.25, 1.7);
        const railGeo       = new THREE.TorusGeometry(1.1, 0.07, 6, 12);
        const armGeo        = new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6);
        const legGeo        = new THREE.BoxGeometry(1.2, 26, 0.9);
        const footGeo       = new THREE.BoxGeometry(5.5, 0.8, 2);

        // ── Aros ─────────────────────────────────────────────────────
        const mkTorus = (geo, posZ) => {
            const m = new THREE.Mesh(geo, mat.rim);
            m.position.z = posZ;
            m.castShadow = true;
            wg.add(m);
        };
        mkTorus(outerTorusGeo,  halfT);
        mkTorus(outerTorusGeo, -halfT);
        mkTorus(innerTorusGeo,  halfT);
        mkTorus(innerTorusGeo, -halfT);

        // ── Conectores entre caras ───────────────────────────────────
        for (let i = 0; i < spokeCount; i++) {
            const a = (i / spokeCount) * Math.PI * 2;
            const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
            _tube(v(x, y,  halfT), v(x, y, -halfT), 0.14, mat.rim, wg);
        }

        // ── Hub ──────────────────────────────────────────────────────
        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(1.4, 1.4, wheelThick + 0.6, 24),
            mat.hub
        );
        hub.rotation.x = Math.PI / 2;
        hub.castShadow = true;
        wg.add(hub);

        [halfT + 0.15, -halfT - 0.15].forEach(z => {
            const c = new THREE.Mesh(hubCapGeo, mat.hub);
            c.rotation.x = Math.PI / 2;
            c.position.z = z;
            wg.add(c);
        });

        // ── Radios exteriores ────────────────────────────────────────
        for (let i = 0; i < spokeCount; i++) {
            const a = (i / spokeCount) * Math.PI * 2;
            const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
            _tube(v(0, 0,  halfT), v(x, y,  halfT), 0.16, mat.spoke, wg);
            _tube(v(0, 0, -halfT), v(x, y, -halfT), 0.16, mat.spoke, wg);
        }

        // ── Radios interiores + conectores transversales ──────────────
        for (let i = 0; i < spokeCount; i++) {
            const a  = (i / spokeCount) * Math.PI * 2;
            const a2 = ((i + 1) / spokeCount) * Math.PI * 2;
            const xi  = Math.cos(a)  * innerRadius, yi  = Math.sin(a)  * innerRadius;
            const xi2 = Math.cos(a2) * innerRadius, yi2 = Math.sin(a2) * innerRadius;

            _tube(v(0, 0,  halfT), v(xi,  yi,   halfT), 0.2,  mat.innerRim, wg);
            _tube(v(0, 0, -halfT), v(xi,  yi,  -halfT), 0.2,  mat.innerRim, wg);
            _tube(v(xi, yi, 0),    v(xi2, yi2,  0),     0.14, mat.innerRim, wg);
        }

        // ── Triangulación exterior ↔ interior ────────────────────────
        for (let i = 0; i < spokeCount; i++) {
            const a1 = (i / spokeCount) * Math.PI * 2;
            const a2 = ((i + 1) / spokeCount) * Math.PI * 2;
            const aM = (a1 + a2) / 2;

            [halfT, -halfT].forEach(z => {
                _tube(
                    v(Math.cos(aM) * innerRadius, Math.sin(aM) * innerRadius, z),
                    v(Math.cos(aM) * radius,      Math.sin(aM) * radius,      z),
                    0.1, mat.spoke, wg
                );
                _tube(
                    v(Math.cos(a1) * radius,      Math.sin(a1) * radius,      z),
                    v(Math.cos(a2) * innerRadius, Math.sin(a2) * innerRadius, z),
                    0.1, mat.spoke, wg
                );
            });
        }

        // ── Eje ──────────────────────────────────────────────────────
        const axle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 12, 16),
            mat.axle
        );
        axle.rotation.x = Math.PI / 2;
        axle.position.set(0, radius + 6, 0);
        axle.castShadow = true;
        this._root.add(axle);

        // ── Cabinas ──────────────────────────────────────────────────
        const cabinColors = [
            0x3a86ff, 0xff6b6b, 0xffd93d, 0x06d6a0,
            0x8338ec, 0xff9f1c, 0xff006e, 0x00bbf9,
            0x2ec4b6, 0xe71d36, 0x3d5a80, 0xffbe0b,
        ];
        const cabinMatCache = new Map();
        const getCabinMat = c => {
            if (!cabinMatCache.has(c))
                cabinMatCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
            return cabinMatCache.get(c);
        };

        for (let i = 0; i < cabinCount; i++) {
            const a = (i / cabinCount) * Math.PI * 2;
            const holder = new THREE.Group();
            holder.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
            wg.add(holder);

            // Soporte en V
            const armM = mat.armHang;
            const lArm = new THREE.Mesh(armGeo, armM);
            lArm.position.set(-0.35, -0.55, 0); lArm.rotation.z = 0.35; lArm.castShadow = true;
            holder.add(lArm);
            const rArm = new THREE.Mesh(armGeo, armM);
            rArm.position.set( 0.35, -0.55, 0); rArm.rotation.z = -0.35; rArm.castShadow = true;
            holder.add(rArm);

            // Cabina
            const color  = cabinColors[i % cabinColors.length];
            const cabin  = new THREE.Group();
            cabin.position.y = -1.9;
            holder.add(cabin);

            const body = new THREE.Mesh(bodyGeo, getCabinMat(color));
            body.castShadow = body.receiveShadow = true;
            cabin.add(body);

            const win = new THREE.Mesh(winGeo, mat.winMat);
            win.position.y = 0.05;
            cabin.add(win);

            const roof = new THREE.Mesh(roofGeo, mat.roofMat);
            roof.position.y = 0.95; roof.castShadow = true;
            cabin.add(roof);

            const rail = new THREE.Mesh(railGeo, mat.strut);
            rail.rotation.x = Math.PI / 2; rail.position.y = -0.45;
            cabin.add(rail);

            this._cabins.push({ cabin });
        }

        // ── Soportes en A (dentro del root) ──────────────────────────
        [halfT + 0.8, -halfT - 0.8].forEach(dz => {
            const g = new THREE.Group();
            g.position.set(0, 0, dz);

            const lLeg = new THREE.Mesh(legGeo, mat.support);
            lLeg.position.set(-3, 13, 0); lLeg.rotation.z = -0.32; lLeg.castShadow = true;
            g.add(lLeg);

            const rLeg = new THREE.Mesh(legGeo, mat.support);
            rLeg.position.set( 3, 13, 0); rLeg.rotation.z =  0.32; rLeg.castShadow = true;
            g.add(rLeg);

            [-8, 8].forEach(x => {
                const f = new THREE.Mesh(footGeo, mat.support);
                f.position.set(x, 0.4, 0); f.castShadow = true;
                g.add(f);
            });

            this._root.add(g);
        });

        // Plataforma (dentro del root)
        const platform = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, wheelThick + 3), mat.axle);
        platform.position.set(0, radius + 6, 0);
        platform.castShadow = true;
        this._root.add(platform);

        // ── Bombillas: InstancedMesh ─────────────────────────────────
        const lightPalette = [
            0xff0000, 0xffff00, 0x00ff00, 0x00ffff,
            0x0000ff, 0xff00ff, 0xffa500, 0xff69b4,
        ];

        const bigPositions = [];
        const smlPositions = [];

        // Aro exterior (48 × 2 caras)
        for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const c = lightPalette[i % lightPalette.length];
            const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
            bigPositions.push({ x, y, z:  halfT + 0.28, color: c, phase: i * 0.2 });
            bigPositions.push({ x, y, z: -halfT - 0.28, color: c, phase: i * 0.2 + 0.1 });
        }
        // Aro interior (24 × 2 caras)
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const c = lightPalette[(i + 2) % lightPalette.length];
            const x = Math.cos(a) * innerRadius, y = Math.sin(a) * innerRadius;
            bigPositions.push({ x, y, z:  halfT + 0.18, color: c, phase: i * 0.3 });
            bigPositions.push({ x, y, z: -halfT - 0.18, color: c, phase: i * 0.3 + 0.15 });
        }
        // Radios (bombillas pequeñas)
        for (let i = 0; i < spokeCount; i++) {
            const a = (i / spokeCount) * Math.PI * 2;
            for (let r = radius * 0.3; r < radius; r += 3.5) {
                const c = lightPalette[Math.floor(r) % lightPalette.length];
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                smlPositions.push({ x, y, z:  halfT + 0.1, color: c, phase: r * 0.4 + i * 0.15 });
                smlPositions.push({ x, y, z: -halfT - 0.1, color: c, phase: r * 0.4 + i * 0.15 + 0.08 });
            }
        }

        const bigBulbGeo = new THREE.SphereGeometry(0.26, 7, 7);
        const smlBulbGeo = new THREE.SphereGeometry(0.18, 5, 5);
        const matBig = this._bulbMat;
        const matSml = this._bulbMat.clone();

        this._bulbInstBig = new THREE.InstancedMesh(bigBulbGeo, matBig, bigPositions.length);
        this._bulbInstBig.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this._bulbInstBig.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(bigPositions.length * 3), 3
        );
        this._bulbInstBig.castShadow = false;

        this._bulbInstSml = new THREE.InstancedMesh(smlBulbGeo, matSml, smlPositions.length);
        this._bulbInstSml.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this._bulbInstSml.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(smlPositions.length * 3), 3
        );
        this._bulbInstSml.castShadow = false;

        const positionInstances = (instMesh, positions, store) => {
            const dummy = new THREE.Object3D();
            for (let i = 0; i < positions.length; i++) {
                const { x, y, z, color, phase } = positions[i];
                dummy.position.set(x, y, z);
                dummy.updateMatrix();
                instMesh.setMatrixAt(i, dummy.matrix);
                instMesh.setColorAt(i, new THREE.Color(0x000000));
                store.push({ color: new THREE.Color(color), phase });
            }
            instMesh.instanceMatrix.needsUpdate = true;
            instMesh.instanceColor.needsUpdate  = true;
        };

        positionInstances(this._bulbInstBig, bigPositions, this._bulbsBig);
        positionInstances(this._bulbInstSml, smlPositions, this._bulbsSml);

        wg.add(this._bulbInstBig);
        wg.add(this._bulbInstSml);

        // ── Luces de noche: 8 PointLights compartidas en anillo ────────
        const nightLightColors = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffa500, 0xff69b4];
        for (let i = 0; i < 8; i++) {
            const a  = (i / 8) * Math.PI * 2;
            const pl = new THREE.PointLight(nightLightColors[i], 0, 28);
            pl.position.set(Math.cos(a) * radius * 0.85, Math.sin(a) * radius * 0.85, 0);
            wg.add(pl);
            this._nightLights.push(pl);
        }

        // ── Colisionador físico (Rapier) para no traspasar la estructura ──
        this._createPhysics();
    }

    _createPhysics() {
        if (!this._physicsWorld || !RAPIER) return;

        const sc = this._scale;
        const wheelThick = 3.2;
        const halfT = wheelThick / 2;

        // Cubo rígido que cubre las patas y la base para evitar que el jugador la atraviese
        const hw = 9.5 * sc;
        const hh = 14.0 * sc;
        const hd = (halfT + 1.5) * sc;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
            this._wx,
            this._wy + hh,
            this._wz
        );
        this._physicsBody = this._physicsWorld.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hw, hh, hd)
            .setFriction(0.8)
            .setRestitution(0.0);
        
        this._physicsWorld.createCollider(colliderDesc, this._physicsBody);
    }

    // ─────────────────────────────────────────────────────────────────
    //  API PÚBLICA: update
    // ─────────────────────────────────────────────────────────────────

    update(delta, timeCycle) {
        this._time += delta;

        let targetAlpha = 0;
        if (timeCycle) {
            const { day } = timeCycle.timeSettings;
            targetAlpha = timeCycle.currentTime >= day ? 1.0 : 0.0;
        }

        this._nightAlpha += (targetAlpha - this._nightAlpha) * Math.min(delta * 0.5, 1);
        const alpha = this._nightAlpha;

        if (this._wheelGroup && alpha > 0.001) {
            this._wheelGroup.rotation.z -= 0.008 * alpha;
        }

        const wRot = this._wheelGroup ? this._wheelGroup.rotation.z : 0;
        for (let i = 0; i < this._cabins.length; i++) {
            this._cabins[i].cabin.rotation.z = -wRot;
        }

        const lightTarget = alpha > 0.01 ? 12 * alpha : 0;
        for (let i = 0; i < this._nightLights.length; i++) {
            this._nightLights[i].intensity = lightTarget;
        }

        if (alpha < 0.005) {
            if (this._bulbInstBig.material.emissiveIntensity > 0) {
                this._bulbInstBig.material.emissiveIntensity = 0;
                this._bulbInstSml.material.emissiveIntensity = 0;
            }
            return;
        }

        const t = this._time;
        const col = this._tmpColor;

        this._bulbInstBig.material.emissiveIntensity = alpha * 2.5;
        this._bulbInstSml.material.emissiveIntensity = alpha * 2.0;

        const frameSkip = Math.round(this._time * 60) % 3;

        if (frameSkip === 0) {
            for (let i = 0; i < this._bulbsBig.length; i++) {
                const { color, phase } = this._bulbsBig[i];
                const bright = (1.0 + Math.sin(t * 4 + phase)) * 0.5 * alpha;
                col.copy(color).multiplyScalar(bright + 0.05 * alpha);
                this._bulbInstBig.setColorAt(i, col);
            }
            this._bulbInstBig.instanceColor.needsUpdate = true;
        }

        if (frameSkip === 1) {
            for (let i = 0; i < this._bulbsSml.length; i++) {
                const { color, phase } = this._bulbsSml[i];
                const bright = (1.0 + Math.sin(t * 4 + phase)) * 0.5 * alpha;
                col.copy(color).multiplyScalar(bright + 0.05 * alpha);
                this._bulbInstSml.setColorAt(i, col);
            }
            this._bulbInstSml.instanceColor.needsUpdate = true;
        }
    }

    dispose() {
        if (this._root) this.scene.remove(this._root);
        if (this._physicsWorld && this._physicsBody) {
            this._physicsWorld.removeRigidBody(this._physicsBody);
        }
        this._bulbInstBig?.geometry.dispose();
        this._bulbInstSml?.geometry.dispose();
        this._bulbMat?.dispose();
    }
}
