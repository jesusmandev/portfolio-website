import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Skills — Premium Luminous Banners 3D (Optimized)
 *
 * Module extracted and adapted for the 3D scene with cloth animations and Rapier physics.
 * Default position X: -561.90, Y: 0.20, Z: 191.24
 *
 * Applied optimizations:
 * - Shared geometries (1 instance per type, not 8 copies)
 * - Cache of original XY positions for cloth animation
 * - Direct access to Float32Array buffer (no getX/getY/setZ per vertex)
 * - computeVertexNormals() throttled (every 3 frames)
 * - Reduced segments on small decorative geometries
 * - Shared materials between all poles
 */

export const SKILLS_DATA = [
    { 
        name: 'HTML5', color: '#E34F26', textColor: '#ffffff',
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.fillStyle = '#E34F26';
            ctx.beginPath(); ctx.moveTo(-45, -50); ctx.lineTo(45, -50); ctx.lineTo(40, 35); ctx.lineTo(0, 50); ctx.lineTo(-40, 35); ctx.fill();
            ctx.fillStyle = '#F06529';
            ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(40, -45); ctx.lineTo(35, 32); ctx.lineTo(0, 45); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(-25, -25); ctx.lineTo(25, -25); ctx.lineTo(23, -10); ctx.lineTo(-10, -10); ctx.lineTo(-8, 5); ctx.lineTo(0, 5); ctx.lineTo(15, 5); ctx.lineTo(12, 25); ctx.lineTo(0, 30); ctx.lineTo(-12, 25); ctx.lineTo(-14, 12); ctx.lineTo(-27, 12); ctx.lineTo(-23, 35); ctx.lineTo(0, 43); ctx.lineTo(23, 35); ctx.lineTo(28, -5); ctx.lineTo(-26, -5); ctx.fill();
            ctx.restore();
        }
    },
    { 
        name: 'CSS3', color: '#1572B6', textColor: '#ffffff',
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.fillStyle = '#1572B6';
            ctx.beginPath(); ctx.moveTo(-45, -50); ctx.lineTo(45, -50); ctx.lineTo(40, 35); ctx.lineTo(0, 50); ctx.lineTo(-40, 35); ctx.fill();
            ctx.fillStyle = '#33A9DC';
            ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(40, -45); ctx.lineTo(35, 32); ctx.lineTo(0, 45); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(-25, -25); ctx.lineTo(25, -25); ctx.lineTo(23, -10); ctx.lineTo(5, -10); ctx.lineTo(3, 5); ctx.lineTo(15, 5); ctx.lineTo(12, 25); ctx.lineTo(0, 30); ctx.lineTo(-12, 25); ctx.lineTo(-14, 12); ctx.lineTo(-27, 12); ctx.lineTo(-23, 35); ctx.lineTo(0, 43); ctx.lineTo(23, 35); ctx.lineTo(26, 15); ctx.lineTo(28, -5); ctx.lineTo(29, -35); ctx.lineTo(-26, -35); ctx.fill();
            ctx.restore();
        }
    },
    { 
        name: 'JavaScript', color: '#F7DF1E', textColor: '#ffffff',
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.fillStyle = '#F7DF1E';
            ctx.fillRect(-45, -45, 90, 90);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 55px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('JS', 40, 45);
            ctx.restore();
        }
    },
    { 
        name: 'TypeScript', color: '#3178C6', textColor: '#ffffff',
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.fillStyle = '#3178C6';
            ctx.fillRect(-45, -45, 90, 90);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 55px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('TS', 40, 45);
            ctx.restore();
        }
    },
    { 
        name: 'React', color: '#61DAFB', textColor: '#ffffff',
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.strokeStyle = '#61DAFB';
            ctx.lineWidth = 7;
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                ctx.ellipse(0, 0, 16, 42, (i * 60) * Math.PI / 180, 0, 2 * Math.PI);
                ctx.stroke();
            }
            ctx.fillStyle = '#61DAFB';
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, 2 * Math.PI); ctx.fill();
            ctx.restore();
        }
    },
    { 
        name: 'Vite', color: '#BD34FE', textColor: '#ffffff', 
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            const grad = ctx.createLinearGradient(-40, -40, 40, 40);
            grad.addColorStop(0, '#41D1FF');
            grad.addColorStop(1, '#BD34FE');
            const gradYellow = ctx.createLinearGradient(-10, -30, 30, 30);
            gradYellow.addColorStop(0, '#FFEA83');
            gradYellow.addColorStop(1, '#FFDD35');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.moveTo(-35, -35); ctx.lineTo(15, -35); ctx.lineTo(40, 45); ctx.lineTo(0, 45); ctx.fill();
            ctx.fillStyle = gradYellow;
            ctx.beginPath(); ctx.moveTo(-10, -25); ctx.lineTo(20, -25); ctx.lineTo(5, 5); ctx.lineTo(25, 5); ctx.lineTo(-15, 35); ctx.lineTo(-5, 10); ctx.lineTo(-25, 10); ctx.fill();
            ctx.restore();
        }
    },
    { 
        name: 'Node.js', color: '#5FA04E', textColor: '#ffffff',
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.fillStyle = '#333';
            ctx.beginPath();
            for(let i=0; i<6; i++) {
                const angle = (i * 60 - 30) * Math.PI / 180;
                const px = Math.cos(angle) * 45;
                const py = Math.sin(angle) * 50;
                if(i===0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#5FA04E';
            ctx.font = 'bold 50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('n', 0, 5);
            ctx.restore();
        }
    },
    { 
        name: 'Three.js', color: '#ffffff', textColor: '#ffffff', scale: 0.7,
        drawLogo: (ctx, x, y, size) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(size/100, size/100);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(0, -35); ctx.lineTo(30, -17.5); ctx.lineTo(30, 17.5); 
            ctx.lineTo(0, 35); ctx.lineTo(-30, 17.5); ctx.lineTo(-30, -17.5); 
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, 35);
            ctx.moveTo(0, 0); ctx.lineTo(30, -17.5);
            ctx.moveTo(0, 0); ctx.lineTo(-30, -17.5);
            ctx.stroke();
            
            ctx.restore();
        }
    }
];

// ──────────────────────────────────────────────────────────────────────────────
// SHARED GEOMETRIES — a single instance per type, reused by all banners.
// This reduces the VRAM footprint from ~40 geometries to ~10.
// ──────────────────────────────────────────────────────────────────────────────
const _sharedGeometries = {};

function getSharedGeo(key, createFn) {
    if (!_sharedGeometries[key]) {
        _sharedGeometries[key] = createFn();
    }
    return _sharedGeometries[key];
}

export function createFlagTexture(skill) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#2b2d31');
    bgGrad.addColorStop(1, '#18191c');
    
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 10;
    ctx.strokeStyle = skill.color;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    skill.drawLogo(ctx, canvas.width / 2, canvas.height / 2 - 200, 450);

    ctx.fillStyle = skill.textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 120px "Segoe UI", sans-serif';
    ctx.fillText(skill.name.toUpperCase(), canvas.width / 2, canvas.height / 2 + 350);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
}

export class Habilidades {
    constructor(scene, physicsWorld = null, options = {}) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        // Position specified: X: -626.28, Y: 0.20, Z: 195.12
        this.position = options.position || { x: -626.28, y: 0.20, z: 195.12 };
        this.rotationY = options.rotationY ?? 0;
        // Scale adjusted to 0.38 to match the height of the game's streetlights (~4.2m)
        this.scale = options.scale ?? 2.38;

        this.flags = [];
        this._normalFrame = 0; // computeVertexNormals throttle counter

        this.rootGroup = new THREE.Group();
        this.rootGroup.position.set(this.position.x, this.position.y, this.position.z);
        this.rootGroup.rotation.y = this.rotationY;
        this.rootGroup.scale.setScalar(this.scale);
        this.scene.add(this.rootGroup);

        this._initFlags();
    }

    _initFlags() {
        const spacing = 3.5; 
        const totalWidth = (SKILLS_DATA.length - 1) * spacing;
        const startX = -totalWidth / 2;

        // ── Shared materials (only 2 for all poles) ──
        const poleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xdddddd, metalness: 0.8, roughness: 0.2
        });
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc00, metalness: 0.9, roughness: 0.15
        });

        // ── Shared geometries (created once, referenced N times) ──
        // Reduced radial segments on small pieces where it's not noticeable
        const poleGeo     = getSharedGeo('pole',     () => new THREE.CylinderGeometry(0.04, 0.05, 11, 8));
        const base1Geo    = getSharedGeo('base1',    () => new THREE.CylinderGeometry(0.4, 0.45, 0.15, 8));
        const base2Geo    = getSharedGeo('base2',    () => new THREE.CylinderGeometry(0.25, 0.35, 0.2, 8));
        const base3Geo    = getSharedGeo('base3',    () => new THREE.CylinderGeometry(0.1, 0.25, 0.3, 8));
        const finBaseGeo  = getSharedGeo('finBase',  () => new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6));
        const finSphGeo   = getSharedGeo('finSph',   () => new THREE.SphereGeometry(0.09, 8, 8));
        const finSpikeGeo = getSharedGeo('finSpike', () => new THREE.ConeGeometry(0.04, 0.4, 6));
        const crossGeo    = getSharedGeo('cross',    () => new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6));
        const capGeo      = getSharedGeo('cap',      () => new THREE.SphereGeometry(0.05, 6, 6));
        const ringGeo     = getSharedGeo('ring',     () => new THREE.TorusGeometry(0.04, 0.015, 4, 8));

        // Precompute sin/cos of rotation once for collisions
        const cosY = Math.cos(this.rotationY);
        const sinY = Math.sin(this.rotationY);

        const flagWidth = 2.4;
        const flagHeight = 6.5;
        const halfHeight = flagHeight / 2;

        for (let i = 0; i < SKILLS_DATA.length; i++) {
            const skill = SKILLS_DATA[i];
            const group = new THREE.Group();
            const posX = startX + (i * spacing);
            group.position.x = posX;

            const skillScale = skill.scale || 1.0;
            if (skill.scale) {
                group.scale.set(skillScale, skillScale, skillScale);
            }

            group.position.y = 5.5 * skillScale;

            // ── Main pole ──
            const pole = new THREE.Mesh(poleGeo, poleMaterial);
            pole.castShadow = true; pole.receiveShadow = true;
            group.add(pole);

            // ── Base (3 pieces) ──
            const baseGroup = new THREE.Group();
            baseGroup.position.y = -5.5;

            const b1 = new THREE.Mesh(base1Geo, poleMaterial);
            b1.position.y = 0.075; b1.castShadow = true; b1.receiveShadow = true;
            baseGroup.add(b1);

            const b2 = new THREE.Mesh(base2Geo, goldMaterial);
            b2.position.y = 0.25; b2.castShadow = true; b2.receiveShadow = true;
            baseGroup.add(b2);

            const b3 = new THREE.Mesh(base3Geo, poleMaterial);
            b3.position.y = 0.5; b3.castShadow = true; b3.receiveShadow = true;
            baseGroup.add(b3);

            group.add(baseGroup);

            // ── Top finial ──
            const finialGroup = new THREE.Group();
            finialGroup.position.y = 5.5;

            const fb = new THREE.Mesh(finBaseGeo, goldMaterial);
            fb.position.y = 0.05; finialGroup.add(fb);

            const fs = new THREE.Mesh(finSphGeo, goldMaterial);
            fs.position.y = 0.2; finialGroup.add(fs);

            const fk = new THREE.Mesh(finSpikeGeo, goldMaterial);
            fk.position.y = 0.5; finialGroup.add(fk);

            group.add(finialGroup);

            // ── Horizontal crossbar ──
            const crossbar = new THREE.Mesh(crossGeo, poleMaterial);
            crossbar.rotation.z = Math.PI / 2;
            crossbar.position.set(0, 4.5, 0.16);
            crossbar.castShadow = true;
            group.add(crossbar);

            // ── End caps ──
            const capLeft = new THREE.Mesh(capGeo, goldMaterial);
            capLeft.position.set(-1.3, 4.5, 0.16);
            group.add(capLeft);

            const capRight = new THREE.Mesh(capGeo, goldMaterial);
            capRight.position.set(1.3, 4.5, 0.16);
            group.add(capRight);

            // ── Rings (5 total, fixed positions) ──
            for (let ringIdx = -1.1; ringIdx <= 1.1; ringIdx += 0.55) {
                const ring = new THREE.Mesh(ringGeo, poleMaterial);
                ring.rotation.y = Math.PI / 2;
                ring.position.set(ringIdx, 4.5, 0.16);
                group.add(ring);
            }

            // ── Flag (own geometry because it deforms per vertex) ──
            const geom = new THREE.PlaneGeometry(flagWidth, flagHeight, 15, 20); 
            
            const mat = new THREE.MeshStandardMaterial({ 
                map: createFlagTexture(skill), 
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
            });
            
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(0, 4.5 - halfHeight, 0.16); 
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            this.rootGroup.add(group);

            // ── Rapier Collision (one cylinder per pole) ──
            if (this.physicsWorld && RAPIER) {
                try {
                    const worldX = this.position.x + (posX * cosY) * this.scale;
                    const worldY = this.position.y + (5.5 * skillScale) * this.scale;
                    const worldZ = this.position.z + (posX * sinY) * this.scale;

                    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(worldX, worldY, worldZ);
                    const body = this.physicsWorld.createRigidBody(bodyDesc);
                    const hh = 5.5 * skillScale * this.scale;
                    const r  = 0.4 * skillScale * this.scale;
                    const colliderDesc = RAPIER.ColliderDesc.cuboid(r, hh, r).setFriction(0.8);
                    this.physicsWorld.createCollider(colliderDesc, body);
                } catch (e) {
                    console.warn('[Skills] Error creating Rapier collider:', e);
                }
            }

            // ── Cache of original XY positions for animation ──
            // Avoids calling getX()/getY() on each vertex each frame.
            const posAttr = geom.attributes.position;
            const vertCount = posAttr.count;
            const origXY = new Float32Array(vertCount * 2);
            for (let j = 0; j < vertCount; j++) {
                origXY[j * 2]     = posAttr.getX(j);
                origXY[j * 2 + 1] = posAttr.getY(j);
            }

            this.flags.push({
                mesh,
                geom,
                posArray: posAttr.array,   // Direct reference to Float32Array
                origXY,                     // Cache of original X,Y values
                vertCount,
                index: i,
                flagHeight,
                halfHeight
            });
        }
    }

    /**
     * Updates the banner waving animation.
     * Optimizations vs. original version:
     * - Direct Float32Array access (no getX/getY/setZ per vertex)
     * - Cache of original XY positions (only Z is animated)
     * - computeVertexNormals() only every 3 frames (imperceptible visually)
     * - Pre-calculation of constants outside the inner loop
     */
    update(delta, time = 0) {
        const t = time;
        const doNormals = (++this._normalFrame % 3) === 0;

        for (let fi = 0; fi < this.flags.length; fi++) {
            const f = this.flags[fi];
            const arr = f.posArray;
            const origXY = f.origXY;
            const count = f.vertCount;
            const fh = f.flagHeight;
            const hh = f.halfHeight;
            const idx = f.index;

            // Frame constants pre-calculated outside the vertex loop
            const tWave1 = t * 3.5 - idx;  // negado para simplificar sin → -sin = sin(-x)
            const tWave2 = t * 2.0;

            for (let j = 0; j < count; j++) {
                const ox = origXY[j * 2];
                const oy = origXY[j * 2 + 1];
                const yNorm = (hh - oy) / fh;

                if (yNorm > 0.01) {
                    const wave1 = Math.sin(ox * 2.0 - tWave1) * 0.15;
                    const wave2 = Math.cos(oy * 1.5 - tWave2) * 0.2;
                    // Math.pow(yNorm, 1.5) ≈ yNorm * sqrt(yNorm) — más rápido
                    const strength = yNorm * Math.sqrt(yNorm);
                    // Acceso directo: stride = 3, offset Z = j*3+2
                    arr[j * 3 + 2] = (wave1 + wave2) * strength;
                } else {
                    arr[j * 3 + 2] = 0;
                }
            }

            f.geom.attributes.position.needsUpdate = true;

            // Recalculate normals only every 3 frames to reduce CPU cost
            if (doNormals) {
                f.geom.computeVertexNormals();
            }
        }
    }

    destroy() {
        if (this.rootGroup) {
            this.scene.remove(this.rootGroup);
        }
        this.flags.forEach(f => {
            f.geom.dispose();
            if (f.mesh.material.map) f.mesh.material.map.dispose();
            f.mesh.material.dispose();
        });
        this.flags.length = 0;
    }
}
