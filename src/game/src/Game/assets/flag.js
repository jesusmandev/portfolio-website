/**
 * flag.js
 *
 * 3D Colombia Flag module with physics and wind animation.
 *
 * Features:
 *  - Metallic flagpole with golden tip.
 *  - Flag with official colors (Yellow 50%, Blue 25%, Red 25%).
 *  - Smooth wind animation via vertex shader deformation.
 *  - Full integration with Three.js lighting and shadows (MeshStandardMaterial + onBeforeCompile).
 *  - Rigid Rapier physics collider to prevent the character from passing through the pole.
 *  - Optimized for web performance with no allocations in the update loop.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ─────────────────────────────────────────────────────────────────
//  CACHED COLOMBIA FLAG TEXTURE
// ─────────────────────────────────────────────────────────────────

let cachedFlagTexture = null;

function getColombiaFlagTexture() {
    if (cachedFlagTexture) return cachedFlagTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 341; // Official 2:3 ratio
    const ctx = canvas.getContext('2d');

    // Yellow (#FCD116) - Upper half (50%)
    ctx.fillStyle = '#FCD116';
    ctx.fillRect(0, 0, 512, 170.5);

    // Blue (#003893) - Middle stripe (25%)
    ctx.fillStyle = '#003893';
    ctx.fillRect(0, 170.5, 512, 85.25);

    // Red (#CE1126) - Bottom stripe (25%)
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(0, 255.75, 512, 85.25);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    cachedFlagTexture = texture;
    return texture;
}

// ─────────────────────────────────────────────────────────────────
//  MAIN CLASS
// ─────────────────────────────────────────────────────────────────

export class Bandera {
    /**
     * @param {THREE.Scene} scene
     * @param {object}      [options]
     * @param {number}      [options.x=-307.49]
     * @param {number}      [options.y=0.20]
     * @param {number}      [options.z=377.35]
     * @param {number}      [options.scale=2.5]
     * @param {object}      [options.physicsWorld=null] - Rapier.World instance
     */
    constructor(scene, options = {}) {
        this.scene = scene;

        this._wx           = options.x            ?? -307.49;
        this._wy           = options.y            ?? 0.20;
        this._wz           = options.z            ?? 377.35;
        this._scale        = options.scale        ?? 2.5;
        this._physicsWorld = options.physicsWorld ?? null;

        this._time        = 0;
        this._flagMaterial= null;
        this._physicsBody = null;

        this._build();
    }

    // ─────────────────────────────────────────────────────────────────
    //  3D STRUCTURE CONSTRUCTION
    // ─────────────────────────────────────────────────────────────────

    _build() {
        const poleHeight   = 15;
        const poleRadius   = 0.15;
        const knobRadius   = 0.3;
        const flagWidth    = 7.5;
        const flagHeight   = 5.0;

        // ── Root group positioned in world space ───────────────────────
        this._root = new THREE.Group();
        this._root.position.set(this._wx, this._wy, this._wz);
        this._root.scale.setScalar(this._scale);
        this.scene.add(this._root);

        // ── Materials ──────────────────────────────────────────────────
        const poleMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.85,
            roughness: 0.2,
        });

        const knobMat = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Gold
            metalness: 0.9,
            roughness: 0.1,
        });

        // ── Flagpole ──────────────────────────────────────────────────────────
        const poleGeo = new THREE.CylinderGeometry(poleRadius * 0.8, poleRadius, poleHeight, 16);
        const poleMesh = new THREE.Mesh(poleGeo, poleMat);
        poleMesh.position.y = poleHeight / 2;
        poleMesh.castShadow = true;
        poleMesh.receiveShadow = true;
        this._root.add(poleMesh);

        // ── Golden top knob ──────────────────────────────────────────
        const knobGeo = new THREE.SphereGeometry(knobRadius, 16, 16);
        const knobMesh = new THREE.Mesh(knobGeo, knobMat);
        knobMesh.position.y = poleHeight + knobRadius * 0.5;
        knobMesh.castShadow = true;
        this._root.add(knobMesh);

        // ── Flag Cloth ───────────────────────────────────────────────
        const flagGeo = new THREE.PlaneGeometry(flagWidth, flagHeight, 32, 20);
        // Translate origin to left edge to attach it to the pole
        flagGeo.translate(flagWidth / 2, 0, 0);

        const flagTex = getColombiaFlagTexture();
        const flagMat = new THREE.MeshStandardMaterial({
            map: flagTex,
            side: THREE.DoubleSide,
            roughness: 0.6,
            metalness: 0.05,
        });

        // Inject wind animation into the Vertex Shader
        flagMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            flagMat.userData.shader = shader;

            shader.vertexShader = `
                uniform float uTime;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float windIntensity = uv.x;
                float wave = sin(position.x * 1.5 + uTime * 3.2) * 0.45 * windIntensity;
                wave += sin(position.y * 2.2 + uTime * 4.1) * 0.12 * windIntensity;
                transformed.z += wave;
                `
            );
        };

        this._flagMaterial = flagMat;

        const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        // ── Place the flag at the top of the pole ──────────────────
        flagMesh.position.set(0, poleHeight - flagHeight / 2 - 0.3, 0);
        flagMesh.castShadow = true;
        flagMesh.receiveShadow = true;
        this._root.add(flagMesh);

        // ── Physics Collider (Rapier) ─────────────────────────────
        this._createPhysics(poleHeight, poleRadius);
    }

    _createPhysics(poleHeight, poleRadius) {
        if (!this._physicsWorld || !RAPIER) return;

        const sc = this._scale;
        const totalHeight = poleHeight * sc;
        const radius = Math.max(poleRadius * sc * 2, 0.4); // Comfortable radius for collision

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
            this._wx,
            this._wy + totalHeight / 2,
            this._wz
        );
        this._physicsBody = this._physicsWorld.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(totalHeight / 2, radius)
            .setFriction(0.6)
            .setRestitution(0.0);

        this._physicsWorld.createCollider(colliderDesc, this._physicsBody);
    }

    // ─────────────────────────────────────────────────────────────────
    //  PUBLIC API: update
    // ─────────────────────────────────────────────────────────────────

    /**
     * Call every frame in the main render loop.
     * @param {number} delta - elapsed seconds
     */
    update(delta) {
        this._time += delta;

        if (this._flagMaterial && this._flagMaterial.userData.shader) {
            this._flagMaterial.userData.shader.uniforms.uTime.value = this._time;
        }
    }

    /**
     * Removes the object from the scene and frees GPU/physics memory.
     */
    dispose() {
        if (this._root) this.scene.remove(this._root);
        if (this._physicsWorld && this._physicsBody) {
            this._physicsWorld.removeRigidBody(this._physicsBody);
        }
        if (this._flagMaterial) this._flagMaterial.dispose();
    }
}
