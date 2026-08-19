/**
 * Robot.js — Robot Low Poly 3D optimizado para Three.js.
 *
 * Adaptado para el juego/portfolio.
 *
 * Características:
 *  - Geometría Low Poly procedimental estilizada con sombreado plano (flatShading).
 *  - Materiales compartidos (0 asignaciones duplicadas).
 *  - Animación sutil de respiración y escaneo de cabeza en update(delta).
 *  - Base de los pies apoyada perfectamente en el suelo Y = 0.20.
 *  - Soporte opcional de física con Rapier (physicsWorld).
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────
//  MATERIALES COMPARTIDOS DE MÓDULO (Singletons)
// ─────────────────────────────────────────────────────────────────
const _matGreyLight = new THREE.MeshStandardMaterial({
    color: 0xdcdcdc,
    roughness: 0.5,
    metalness: 0.2,
    flatShading: true
});

const _matBlueGrey = new THREE.MeshStandardMaterial({
    color: 0x6a8799,
    roughness: 0.5,
    metalness: 0.3,
    flatShading: true
});

const _matDarkGrey = new THREE.MeshStandardMaterial({
    color: 0x2b3e50,
    roughness: 0.6,
    metalness: 0.3,
    flatShading: true
});

const _matBlack = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: true
});

const _matYellow = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0x946b00,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.4,
    flatShading: true
});

// Helpers de creación con sombras activadas
function createCylinder(radiusTop, radiusBottom, height, radialSegments, material) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function createBox(width, height, depth, material) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export class Robot3D {
    /**
     * @param {THREE.Scene|THREE.Group} parent - Escena o grupo donde añadir el robot
     * @param {Object} [options]
     * @param {number} [options.x=-44.44] - Posición X
     * @param {number} [options.y=0.20]  - Posición Y (suelo)
     * @param {number} [options.z=520.20] - Posición Z
     * @param {number} [options.scale=3.5] - Escala global (gigante)
     * @param {number} [options.rotationY] - Rotación Y en radianes (por defecto mira hacia X:-48.70, Z:496.16)
     * @param {Object} [options.physicsWorld] - Mundo físico Rapier (opcional)
     */
    constructor(parent, options = {}) {
        this.parent       = parent;
        this.x            = options.x ?? -44.44;
        this.y            = options.y ?? 0.20;
        this.z            = options.z ?? 520.20;
        this.scale        = options.scale ?? 3.5;
        // Dirección hacia X: -48.70, Z: 496.16 desde X: -44.44, Z: 520.20
        // dx = -4.26, dz = -24.04 -> atan2(-4.26, -24.04)
        this.rotationY    = options.rotationY ?? Math.atan2(-4.26, -24.04);
        this.physicsWorld = options.physicsWorld ?? null;

        this._time        = 0;
        this._headMesh    = null;
        this._eyeLens     = null;
        this._chestButton = null;
        this.colliders    = [];

        // Grupo raíz
        this.group = new THREE.Group();
        this.group.name = 'Robot3D';
        this.group.position.set(this.x, this.y, this.z);
        this.group.scale.setScalar(this.scale);
        this.group.rotation.y = this.rotationY;

        this._build();

        if (this.physicsWorld) {
            this._buildPhysics();
        }

        if (this.parent) {
            this.parent.add(this.group);
        }
    }

    _build() {
        // Subgrupo para desplazar la base de los pies al origen (0,0,0) local
        const bodyOffset = new THREE.Group();
        bodyOffset.position.y = 3.82; // Ajustado exactamente a la suela del pie para quedar pegado al suelo
        this.group.add(bodyOffset);

        // ── 1. Cabeza ──────────────────────────────────────────
        const head = createCylinder(1.6, 1.5, 3.5, 12, _matGreyLight);
        head.position.y = 11.5;
        bodyOffset.add(head);
        this._headMesh = head;

        // Ojo
        const eyeBase = createCylinder(0.7, 0.7, 0.2, 12, _matBlack);
        eyeBase.rotation.x = Math.PI / 2;
        eyeBase.position.set(0, 0, 1.5);
        head.add(eyeBase);

        const eyeLens = createCylinder(0.5, 0.5, 0.1, 12, _matYellow);
        eyeLens.rotation.x = Math.PI / 2;
        eyeLens.position.set(0, 0, 1.6);
        head.add(eyeLens);
        this._eyeLens = eyeLens;

        // Cuello
        const neck = createCylinder(0.8, 0.8, 1, 8, _matBlack);
        neck.position.y = 9.5;
        bodyOffset.add(neck);

        // ── 2. Torso Principal ─────────────────────────────────
        const torsoGroup = new THREE.Group();
        torsoGroup.position.y = 7.5;
        bodyOffset.add(torsoGroup);

        const upperTorso = createCylinder(2, 1.8, 3.5, 12, _matBlueGrey);
        torsoGroup.add(upperTorso);

        const chestDetailBase = createBox(0.8, 0.8, 0.2, _matDarkGrey);
        chestDetailBase.position.set(0, -0.5, 1.8);
        torsoGroup.add(chestDetailBase);

        const chestDetailButton = createCylinder(0.2, 0.2, 0.1, 8, _matYellow);
        chestDetailButton.rotation.x = Math.PI / 2;
        chestDetailButton.position.set(0, -0.5, 1.95);
        torsoGroup.add(chestDetailButton);
        this._chestButton = chestDetailButton;

        const waistRing = createCylinder(1.9, 1.9, 0.6, 12, _matBlack);
        waistRing.position.y = -2;
        torsoGroup.add(waistRing);

        const pelvis = createCylinder(1.7, 1.0, 1.5, 12, _matDarkGrey);
        pelvis.position.y = -3;
        torsoGroup.add(pelvis);

        // ── 3. Brazos ──────────────────────────────────────────
        const createArm = (isLeft) => {
            const sign = isLeft ? -1 : 1;

            const shoulderJoint = createCylinder(0.7, 0.7, 1.2, 12, _matBlueGrey);
            shoulderJoint.rotation.z = Math.PI / 2;
            shoulderJoint.position.set(sign * 2.3, 8.5, 0);
            bodyOffset.add(shoulderJoint);

            const shoulderRing = createCylinder(0.9, 0.9, 0.4, 12, _matBlueGrey);
            shoulderRing.rotation.z = Math.PI / 2;
            shoulderRing.position.set(sign * 2.6, 8.5, 0);
            bodyOffset.add(shoulderRing);

            const upperArmPivot = new THREE.Group();
            upperArmPivot.position.set(sign * 2.6, 8.5, 0);
            bodyOffset.add(upperArmPivot);

            const upperArm = createCylinder(0.5, 0.5, 2.5, 8, _matGreyLight);
            upperArm.position.y = -1.25;
            upperArmPivot.add(upperArm);

            const elbowJoint = createCylinder(0.6, 0.6, 0.8, 12, _matBlueGrey);
            elbowJoint.rotation.z = Math.PI / 2;
            elbowJoint.position.set(0, -2.5, 0);
            upperArmPivot.add(elbowJoint);

            const lowerArmPivot = new THREE.Group();
            lowerArmPivot.position.copy(elbowJoint.position);
            upperArmPivot.add(lowerArmPivot);

            const lowerArm = createCylinder(0.4, 0.4, 2.5, 8, _matDarkGrey);
            lowerArm.position.y = -1.25;
            lowerArmPivot.add(lowerArm);

            const handGroup = new THREE.Group();
            handGroup.position.y = -2.8;
            lowerArmPivot.add(handGroup);

            const wrist = createCylinder(0.5, 0.5, 0.4, 8, _matBlack);
            handGroup.add(wrist);

            const finger1 = createBox(0.3, 0.8, 0.3, _matBlack);
            finger1.position.set(-0.3, -0.6, 0);
            finger1.rotation.z = Math.PI / 8;
            handGroup.add(finger1);

            const finger2 = createBox(0.3, 0.8, 0.3, _matBlack);
            finger2.position.set(0.3, -0.6, 0);
            finger2.rotation.z = -Math.PI / 8;
            handGroup.add(finger2);

            upperArmPivot.rotation.x = -Math.PI / 12;
            upperArmPivot.rotation.z = sign * (Math.PI / 16);
            lowerArmPivot.rotation.x = -Math.PI / 10;
        };

        createArm(true);
        createArm(false);

        // ── 4. Piernas ─────────────────────────────────────────
        const createLeg = (isLeft) => {
            const sign = isLeft ? -1 : 1;

            const hipJoint = createCylinder(0.6, 0.6, 0.8, 12, _matBlueGrey);
            hipJoint.rotation.x = Math.PI / 2;
            hipJoint.position.set(sign * 1.0, 4.0, 0);
            bodyOffset.add(hipJoint);

            const thighPivot = new THREE.Group();
            thighPivot.position.copy(hipJoint.position);
            thighPivot.rotation.z = sign * (Math.PI / 16);
            bodyOffset.add(thighPivot);

            const thigh = createCylinder(0.5, 0.5, 3.5, 8, _matGreyLight);
            thigh.position.y = -1.75;
            thighPivot.add(thigh);

            const kneeJoint = createCylinder(0.6, 0.6, 0.8, 12, _matBlueGrey);
            kneeJoint.rotation.x = Math.PI / 2;
            kneeJoint.position.set(0, -3.5, 0);
            thighPivot.add(kneeJoint);

            const calfPivot = new THREE.Group();
            calfPivot.position.copy(kneeJoint.position);
            thighPivot.add(calfPivot);

            const calf = createCylinder(0.4, 0.5, 3.0, 8, _matGreyLight);
            calf.position.y = -1.5;
            calfPivot.add(calf);

            const ankleRing = createCylinder(0.6, 0.6, 0.4, 8, _matBlack);
            ankleRing.position.y = -3.2;
            calfPivot.add(ankleRing);

            const footGeo = new THREE.BoxGeometry(1.2, 1.0, 2.0);
            const posAttr = footGeo.attributes.position;
            for (let i = 0; i < posAttr.count; i++) {
                if (posAttr.getY(i) > 0) {
                    posAttr.setZ(i, posAttr.getZ(i) - 0.5);
                    posAttr.setX(i, posAttr.getX(i) * 0.8);
                }
            }
            footGeo.computeVertexNormals();

            const foot = new THREE.Mesh(footGeo, _matBlueGrey);
            foot.castShadow = true;
            foot.receiveShadow = true;
            foot.position.set(0, -3.9, 0.3);
            calfPivot.add(foot);
        };

        createLeg(true);
        createLeg(false);
    }

    _buildPhysics() {
        if (!this.physicsWorld) return;
        try {
            const windowRapier = typeof window !== 'undefined' ? window.RAPIER : null;
            const rapier = windowRapier;
            if (!rapier) return;

            const bodyRadius = 2.5 * this.scale;
            const bodyHeight = 14.0 * this.scale;

            const bodyDesc = rapier.RigidBodyDesc.fixed()
                .setTranslation(this.x, this.y + bodyHeight / 2, this.z);
            const rigidBody = this.physicsWorld.createRigidBody(bodyDesc);

            const colliderDesc = rapier.ColliderDesc.cylinder(bodyHeight / 2, bodyRadius);
            const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody);
            this.colliders.push(collider);
        } catch (e) {
            console.warn('[Robot3D] Physics creation skipped:', e);
        }
    }

    /**
     * Update loop (animación sutil de respiración y escaneo de cabeza)
     * @param {number} delta - Tiempo transcurrido en segundos desde el último frame
     */
    update(delta) {
        this._time += delta;

        // Escaneo suave de la cabeza de lado a lado
        if (this._headMesh) {
            this._headMesh.rotation.y = Math.sin(this._time * 0.8) * 0.25;
        }

        // Pulso del ojo amarillo
        if (this._eyeLens && _matYellow) {
            _matYellow.emissiveIntensity = 0.5 + Math.sin(this._time * 3.0) * 0.3;
        }
    }

    destroy() {
        if (this.parent) {
            this.parent.remove(this.group);
        }
        this.colliders.forEach(c => {
            if (this.physicsWorld && typeof this.physicsWorld.removeCollider === 'function') {
                this.physicsWorld.removeCollider(c, true);
            }
        });
        this.colliders.length = 0;
    }
}
