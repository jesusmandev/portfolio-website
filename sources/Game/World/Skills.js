import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * Skills — Luminous Banners 3D
 * Estandartes ceremoniales de habilidades frontend con física de tela y ondulación.
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

const _sharedGeometries = {};
function getSharedGeo(key, createFn)
{
    if(!_sharedGeometries[key])
    {
        _sharedGeometries[key] = createFn();
    }
    return _sharedGeometries[key];
}

export function createFlagTexture(skill)
{
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#2b2d31');
    bgGrad.addColorStop(1, '#18191c');
    
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 14;
    ctx.strokeStyle = skill.color;
    ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

    skill.drawLogo(ctx, canvas.width / 2, canvas.height / 2 - 200, 450);

    ctx.fillStyle = skill.textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 120px "Segoe UI", sans-serif';
    ctx.fillText(skill.name.toUpperCase(), canvas.width / 2, canvas.height / 2 + 350);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

export class Skills
{
    constructor(options = {})
    {
        this.game = Game.getInstance();

        this.x = options.x ?? -23.13;
        this.y = options.y ?? 0.02; // Pegada al suelo base
        this.z = options.z ?? 58.10;
        this.rotationY = options.rotationY ?? -0.25;
        this.scale = options.scale ?? 0.65; // Proporcionado al mundo de folio-2025

        this.flags = [];
        this._normalFrame = 0;

        this.rootGroup = new THREE.Group();
        this.rootGroup.name = 'SkillsExhibition';
        this.rootGroup.position.set(this.x, this.y, this.z);
        this.rootGroup.rotation.y = this.rotationY;
        this.rootGroup.scale.setScalar(this.scale);
        this.game.scene.add(this.rootGroup);

        this._initFlags();

        // Loop de animación física de tela
        this._onTick = this._onTick.bind(this);
        this.game.ticker.events.on('tick', this._onTick, 6);
    }

    _initFlags()
    {
        const spacing = 3.6; 
        const totalWidth = (SKILLS_DATA.length - 1) * spacing;
        const startX = -totalWidth / 2;

        const poleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xdddddd,
            emissive: 0x333333,
            metalness: 0.85,
            roughness: 0.25
        });
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc00,
            emissive: 0x553800,
            metalness: 0.95,
            roughness: 0.15
        });

        const poleGeo     = getSharedGeo('sk_pole',     () => new THREE.CylinderGeometry(0.05, 0.06, 11, 16));
        const base1Geo    = getSharedGeo('sk_base1',    () => new THREE.CylinderGeometry(0.45, 0.55, 0.18, 16));
        const base2Geo    = getSharedGeo('sk_base2',    () => new THREE.CylinderGeometry(0.28, 0.38, 0.22, 16));
        const base3Geo    = getSharedGeo('sk_base3',    () => new THREE.CylinderGeometry(0.12, 0.28, 0.32, 16));
        const finBaseGeo  = getSharedGeo('sk_finBase',  () => new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12));
        const finSphGeo   = getSharedGeo('sk_finSph',   () => new THREE.SphereGeometry(0.12, 12, 12));
        const finSpikeGeo = getSharedGeo('sk_finSpike', () => new THREE.ConeGeometry(0.05, 0.45, 12));
        const crossGeo    = getSharedGeo('sk_cross',    () => new THREE.CylinderGeometry(0.04, 0.04, 2.7, 12));
        const capGeo      = getSharedGeo('sk_cap',      () => new THREE.SphereGeometry(0.07, 10, 10));
        const ringGeo     = getSharedGeo('sk_ring',     () => new THREE.TorusGeometry(0.045, 0.018, 6, 12));

        const cosY = Math.cos(this.rotationY);
        const sinY = Math.sin(this.rotationY);

        const flagWidth = 2.4;
        const flagHeight = 6.5;
        const halfHeight = flagHeight / 2;

        for (let i = 0; i < SKILLS_DATA.length; i++)
        {
            const skill = SKILLS_DATA[i];
            const group = new THREE.Group();
            const posX = startX + (i * spacing);
            group.position.x = posX;

            const skillScale = skill.scale || 1.0;
            if (skill.scale)
            {
                group.scale.set(skillScale, skillScale, skillScale);
            }

            group.position.y = 5.5 * skillScale;

            // Mástil vertical principal
            const pole = new THREE.Mesh(poleGeo, poleMaterial);
            pole.castShadow = true;
            group.add(pole);

            // Base de 3 niveles
            const baseGroup = new THREE.Group();
            baseGroup.position.y = -5.5;

            const b1 = new THREE.Mesh(base1Geo, poleMaterial);
            b1.position.y = 0.09; b1.castShadow = true;
            baseGroup.add(b1);

            const b2 = new THREE.Mesh(base2Geo, goldMaterial);
            b2.position.y = 0.28; b2.castShadow = true;
            baseGroup.add(b2);

            const b3 = new THREE.Mesh(base3Geo, poleMaterial);
            b3.position.y = 0.54; b3.castShadow = true;
            baseGroup.add(b3);

            group.add(baseGroup);

            // Remate superior dorado
            const finialGroup = new THREE.Group();
            finialGroup.position.y = 5.5;

            const fb = new THREE.Mesh(finBaseGeo, goldMaterial);
            fb.position.y = 0.06; finialGroup.add(fb);

            const fs = new THREE.Mesh(finSphGeo, goldMaterial);
            fs.position.y = 0.22; finialGroup.add(fs);

            const fk = new THREE.Mesh(finSpikeGeo, goldMaterial);
            fk.position.y = 0.52; finialGroup.add(fk);

            group.add(finialGroup);

            // Travesaño horizontal
            const crossbar = new THREE.Mesh(crossGeo, poleMaterial);
            crossbar.rotation.z = Math.PI / 2;
            crossbar.position.set(0, 4.5, 0.16);
            crossbar.castShadow = true;
            group.add(crossbar);

            // Topes dorados en extremos del travesaño
            const capLeft = new THREE.Mesh(capGeo, goldMaterial);
            capLeft.position.set(-1.35, 4.5, 0.16);
            group.add(capLeft);

            const capRight = new THREE.Mesh(capGeo, goldMaterial);
            capRight.position.set(1.35, 4.5, 0.16);
            group.add(capRight);

            // Anillos de suspensión
            for (let ringIdx = -1.1; ringIdx <= 1.1; ringIdx += 0.55)
            {
                const ring = new THREE.Mesh(ringGeo, poleMaterial);
                ring.rotation.y = Math.PI / 2;
                ring.position.set(ringIdx, 4.5, 0.16);
                group.add(ring);
            }

            // Tela del estandarte (MeshBasicMaterial para que los colores y logos se vean vibrantes y nunca negros)
            const geom = new THREE.PlaneGeometry(flagWidth, flagHeight, 18, 24); 
            
            const mat = new THREE.MeshBasicMaterial({ 
                map: createFlagTexture(skill), 
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(0, 4.5 - halfHeight, 0.16); 
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            group.add(mesh);

            this.rootGroup.add(group);

            // Caché de posiciones XY originales para animación de tela
            const posAttr = geom.attributes.position;
            const vertCount = posAttr.count;
            const origXY = new Float32Array(vertCount * 2);
            for (let j = 0; j < vertCount; j++)
            {
                origXY[j * 2]     = posAttr.getX(j);
                origXY[j * 2 + 1] = posAttr.getY(j);
            }

            this.flags.push({
                mesh,
                geom,
                poleMesh: pole,
                posArray: posAttr.array,
                origXY,
                vertCount,
                index: i,
                flagHeight,
                halfHeight
            });
        }

        // Actualizar matrices mundiales exactas para las físicas de Rapier
        this.rootGroup.updateMatrixWorld(true);

        // 1. Colisionadores físicos sólidos en cada uno de los mástiles
        for (let i = 0; i < this.flags.length; i++)
        {
            const f = this.flags[i];
            const poleWorldPos = new THREE.Vector3();
            f.poleMesh.getWorldPosition(poleWorldPos);

            const hh = (11.0 / 2) * this.scale;
            const r  = 0.55 * this.scale;

            this.game.objects.add(null, {
                type: 'fixed',
                position: new THREE.Vector3(poleWorldPos.x, this.y + hh, poleWorldPos.z),
                colliders: [ { shape: 'cuboid', parameters: [ r, hh, r ], category: 'object' } ],
                onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
            });
        }

        // 2. Muro de colisión continuo impenetrable para toda la hilera de habilidades
        const barrierQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        const totalSpan = (SKILLS_DATA.length - 1) * spacing + 2.8;
        const barrierHalfLength = (totalSpan / 2) * this.scale;
        const barrierHalfHeight = 4.0 * this.scale;
        const barrierHalfThickness = 0.55 * this.scale;

        this.game.objects.add(null, {
            type: 'fixed',
            position: new THREE.Vector3(this.x, this.y + barrierHalfHeight, this.z),
            rotation: barrierQuat,
            colliders: [
                {
                    shape: 'cuboid',
                    parameters: [ barrierHalfLength, barrierHalfHeight, barrierHalfThickness ],
                    category: 'object'
                }
            ],
            onCollision: (force, pos) => this.game.audio.groups.get('hitMetal')?.playRandomNext(force, pos)
        });

        // 3. Sonido espacial intenso de múltiples banderas ondeando en la fila de habilidades
        const audioPositions = this.flags.map((f) =>
        {
            const p = new THREE.Vector3();
            f.poleMesh.getWorldPosition(p);
            p.y = this.y + 3.5;
            return p;
        });

        this.flagSound = this.game.audio.register({
            group: 'skillsFlagsSound',
            path: 'sounds/flag/flags.mp3',
            autoplay: true,
            loop: true,
            volume: 0.95,
            positions: audioPositions.length > 0 ? audioPositions : [ new THREE.Vector3(this.x, this.y + 3.5, this.z) ],
            distanceFade: 28,
        });
    }

    _onTick()
    {
        const t = performance.now() * 0.001;
        const doNormals = (++this._normalFrame % 3) === 0;

        for (let fi = 0; fi < this.flags.length; fi++)
        {
            const f = this.flags[fi];
            const arr = f.posArray;
            const origXY = f.origXY;
            const count = f.vertCount;
            const fh = f.flagHeight;
            const hh = f.halfHeight;
            const idx = f.index;

            const tWave1 = t * 3.5 - idx;
            const tWave2 = t * 2.0;

            for (let j = 0; j < count; j++)
            {
                const ox = origXY[j * 2];
                const oy = origXY[j * 2 + 1];
                const yNorm = (hh - oy) / fh;

                if (yNorm > 0.01)
                {
                    const wave1 = Math.sin(ox * 2.0 - tWave1) * 0.16;
                    const wave2 = Math.cos(oy * 1.5 - tWave2) * 0.22;
                    const strength = yNorm * Math.sqrt(yNorm);
                    arr[j * 3 + 2] = (wave1 + wave2) * strength;
                }
                else
                {
                    arr[j * 3 + 2] = 0;
                }
            }

            f.geom.attributes.position.needsUpdate = true;

            if (doNormals)
            {
                f.geom.computeVertexNormals();
            }
        }
    }
}
