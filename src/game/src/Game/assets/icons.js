/**
 * icons.js — Iconos Sociales 3D de Alta Fidelidad (Pedestales con Neón)
 *
 * Módulo extraído y adaptado para la escena 3D con pedestales cilíndricos,
 * anillos de neón resplandecientes y físicas opcionales de Rapier.
 *
 * Posición predeterminada: X: 192.66, Y: 0.20, Z: 207.63
 */
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ─────────────────────────────────────────────────────────────────────────────
//  SVG PATHS OFICIALES (viewBox 0 0 24 24)
// ─────────────────────────────────────────────────────────────────────────────
const SVG_PATHS = {
    tiktok: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    whatsapp: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
    linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    instagram: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12c0 3.259.014 3.668.072 4.948.058 1.265.273 2.18.63 2.88.34.73.78 1.35 1.384 1.955.605.604 1.224 1.043 1.955 1.384.7.357 1.614.57 2.88.63 1.28.058 1.688.072 4.948.072s3.668-.014 4.948-.072c1.265-.06 2.18-.273 2.88-.63.73-.34 1.35-.78 1.955-1.384.604-.605 1.043-1.224 1.384-1.955.357-.7.57-1.614.63-2.88.058-1.28.072-1.688.072-4.948s-.014-3.668-.072-4.948c-.06-1.265-.273-2.18-.63-2.88A6.358 6.358 0 0021.384 2.014 6.358 6.358 0 0019.43.63C18.72.273 17.814.06 16.548 0 15.268-.012 14.859 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 01-.899 1.382 3.744 3.744 0 01-1.38.896c-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.716 3.716 0 01-1.379-.899 3.644 3.644 0 01-.9-1.38c-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z",
    github: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    mail: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
};

// ─────────────────────────────────────────────────────────────────────────────
//  DIBUJO CANVASTEXTURE
// ─────────────────────────────────────────────────────────────────────────────
function drawIconOnCanvas(ctx, s, pathData, bgFn, fgColor, viewBoxSize = 24, iconScale = 0.55) {
    bgFn(ctx, s);
    const p = new Path2D(pathData);
    const sizeOfIcon = s * iconScale;
    const scale = sizeOfIcon / viewBoxSize;
    const offset = (s - sizeOfIcon) / 2;
    ctx.save();
    ctx.translate(offset, offset);
    ctx.scale(scale, scale);
    ctx.fillStyle = fgColor;
    ctx.fill(p);
    ctx.restore();
}

function drawMail(ctx, s) {
    drawIconOnCanvas(ctx, s, SVG_PATHS.mail, (c, sz) => {
        c.fillStyle = '#1877F2';
        c.fillRect(0, 0, sz, sz);
    }, '#ffffff');
}

function drawLinkedIn(ctx, s) {
    drawIconOnCanvas(ctx, s, SVG_PATHS.linkedin, (c, sz) => {
        c.fillStyle = '#0A66C2';
        c.fillRect(0, 0, sz, sz);
    }, '#ffffff');
}

function drawInstagram(ctx, s) {
    drawIconOnCanvas(ctx, s, SVG_PATHS.instagram, (c, sz) => {
        const g = c.createLinearGradient(0, sz, sz, 0);
        g.addColorStop(0.0, '#f9ce34');
        g.addColorStop(0.25, '#ee2a7b');
        g.addColorStop(0.55, '#d62976');
        g.addColorStop(0.75, '#962fbf');
        g.addColorStop(1.0, '#4f5bd5');
        c.fillStyle = g;
        c.fillRect(0, 0, sz, sz);
    }, '#ffffff');
}

function drawTikTok(ctx, s) {
    ctx.fillStyle = '#010101';
    ctx.fillRect(0, 0, s, s);

    const vb = 24;
    const iconScale = 0.55;
    const sizeOfIcon = s * iconScale;
    const scale = sizeOfIcon / vb;
    const offset = (s - sizeOfIcon) / 2;
    const p = new Path2D(SVG_PATHS.tiktok);

    ctx.save();
    ctx.translate(offset - s * 0.015, offset - s * 0.015);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#00f2ea';
    ctx.fill(p);
    ctx.restore();

    ctx.save();
    ctx.translate(offset + s * 0.015, offset + s * 0.015);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ff0050';
    ctx.fill(p);
    ctx.restore();

    ctx.save();
    ctx.translate(offset, offset);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fill(p);
    ctx.restore();
}

function drawWhatsApp(ctx, s) {
    drawIconOnCanvas(ctx, s, SVG_PATHS.whatsapp, (c, sz) => {
        c.fillStyle = '#25D366';
        c.fillRect(0, 0, sz, sz);
    }, '#ffffff');
}

function drawGitHub(ctx, s) {
    drawIconOnCanvas(ctx, s, SVG_PATHS.github, (c, sz) => {
        c.fillStyle = '#181717';
        c.fillRect(0, 0, sz, sz);
    }, '#ffffff');
}

function createHighResTexture(drawFn) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    drawFn(ctx, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
    return texture;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATOS DE ICONOS SOCIALES CON ENLACES OFICIALES
// ─────────────────────────────────────────────────────────────────────────────
export const SOCIAL_ICONS_DATA = [
    { name: 'WhatsApp', draw: drawWhatsApp, color: '#25D366', link: 'https://wa.me/573042962947' },
    { name: 'GitHub',   draw: drawGitHub,   color: '#ffffff', link: 'https://github.com/jesusmandev' },
    { name: 'Mail',     draw: drawMail,     color: '#1877F2', link: null }, // Abre el modal de contacto
    { name: 'LinkedIn', draw: drawLinkedIn, color: '#0A66C2', link: 'https://www.linkedin.com/in/jesus-manuel-martinez-serpa-088ab33a0' },
    { name: 'Instagram',draw: drawInstagram,color: '#ee2a7b', link: 'https://www.instagram.com/jesusdev.co' },
    { name: 'TikTok',   draw: drawTikTok,   color: '#ffffff', link: 'https://www.tiktok.com/@jesusdev.co' }
];

// ─────────────────────────────────────────────────────────────────────────────
//  CLASE PRINCIPAL SOCIALICONS
// ─────────────────────────────────────────────────────────────────────────────
export class SocialIcons {
    /**
     * @param {THREE.Scene} scene
     * @param {*} physicsWorld  — Rapier World opcional
     * @param {Object} opts
     */
    constructor(scene, physicsWorld = null, opts = {}) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        // Posición especificada: X: 131.11, Y: 0.20, Z: 214.99
        this.position = opts.position || { x: 131.11, y: 0.20, z: 214.99 };
        this.scale = opts.scale || 1.0;
        this.rotationY = opts.rotationY || 0;

        this.rootGroup = new THREE.Group();
        this.rootGroup.position.set(this.position.x, this.position.y, this.position.z);
        this.rootGroup.rotation.y = this.rotationY;
        this.rootGroup.scale.setScalar(this.scale);
        this.scene.add(this.rootGroup);

        this.iconItems = [];
        this.colliders = [];
        this.disposables = [];
        this.interactiveMeshes = [];

        // Raycaster e interacción del ratón
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-999, -999);
        this.hoveredIndex = -1;

        this._setupEvents();
        this._build();
    }

    _setupEvents() {
        this._onPointerMove = (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };

        this._onPointerDown = (e) => {
            if (this.hoveredIndex !== -1 && this.iconItems[this.hoveredIndex]) {
                const item = this.iconItems[this.hoveredIndex];
                const data = item.data;

                if (data.name === 'Mail' || !data.link) {
                    // Disparar evento para abrir el modal de contacto azul (social media.jsx)
                    window.dispatchEvent(new CustomEvent('open-mail-modal'));
                } else if (data.link) {
                    // Redirigir a la red social en nueva pestaña
                    window.open(data.link, '_blank', 'noopener,noreferrer');
                }
            }
        };

        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerdown', this._onPointerDown);
    }

    _build() {
        const darkMaterial = new THREE.MeshStandardMaterial({
            color: 0x111115,
            roughness: 0.3,
            metalness: 0.8,
        });
        this.disposables.push(darkMaterial);

        // Geometrías a escala del personaje (~9 unidades de altura total)
        const baseGeo1 = new THREE.CylinderGeometry(4.2, 4.2, 0.8, 32);
        const baseGeo2 = new THREE.CylinderGeometry(3.6, 3.6, 0.8, 32);
        const neonRingGeo = new THREE.TorusGeometry(3.9, 0.1, 16, 48);
        const btnGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16);
        const btnBaseGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.12, 16);

        const radius = 3.2; // Moneda de ~6.4u de diámetro (escala del personaje)
        const thickness = 0.7;
        const iconGeometry = new THREE.CylinderGeometry(radius, radius, thickness, 32);
        iconGeometry.rotateX(Math.PI / 2);

        this.disposables.push(baseGeo1, baseGeo2, neonRingGeo, btnGeo, btnBaseGeo, iconGeometry);

        const count = SOCIAL_ICONS_DATA.length;
        // Separación amplia en media luna (radio de arco 48u para separar bien los pedestales)
        const arcRadius = 48.0; 
        const totalAngle = Math.PI * 0.75; // Abanco de ~135 grados para separación amplia

        SOCIAL_ICONS_DATA.forEach((icon, i) => {
            const iconGroup = new THREE.Group();
            
            // Ángulo para cada icono a lo largo de la media luna
            const angle = (i / (count - 1) - 0.5) * totalAngle;
            const posX = Math.sin(angle) * arcRadius;
            const posZ = (1 - Math.cos(angle)) * (arcRadius * 0.45);

            iconGroup.position.set(posX, 0, posZ);
            // Orientar cada pedestal hacia el centro de la media luna
            iconGroup.rotation.y = -angle * 0.85;

            // 1. Base inferior (cilindro oscuro)
            const base1 = new THREE.Mesh(baseGeo1, darkMaterial);
            base1.position.y = 0.4;
            base1.castShadow = true;
            base1.receiveShadow = true;
            iconGroup.add(base1);

            // 2. Anillo de neón brillante
            const neonMat = new THREE.MeshStandardMaterial({
                color: icon.color,
                emissive: icon.color,
                emissiveIntensity: 2.2,
                toneMapped: false
            });
            this.disposables.push(neonMat);

            const neonRing = new THREE.Mesh(neonRingGeo, neonMat);
            neonRing.rotation.x = Math.PI / 2;
            neonRing.position.y = 0.9;
            iconGroup.add(neonRing);

            // Luz suave ambiental bajo el pedestal
            const ringLight = new THREE.PointLight(icon.color, 3.2, 8.0);
            ringLight.position.set(0, 0.8, 0);
            ringLight.castShadow = false;
            iconGroup.add(ringLight);

            // 3. Base media
            const base2 = new THREE.Mesh(baseGeo2, darkMaterial);
            base2.position.y = 1.4;
            base2.castShadow = true;
            base2.receiveShadow = true;
            iconGroup.add(base2);

            // 4. Botón/conector luminoso en el frontal
            const btn = new THREE.Mesh(btnGeo, neonMat);
            btn.position.set(0, 1.9, 1.1);
            iconGroup.add(btn);

            const btnBase = new THREE.Mesh(btnBaseGeo, darkMaterial);
            btnBase.position.set(0, 1.75, 1.1);
            iconGroup.add(btnBase);

            // 5. Moneda/Icono circular
            const texture = createHighResTexture(icon.draw);
            this.disposables.push(texture);

            const faceMat = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.2,
                metalness: 0.1,
            });

            const rimColor = icon.name === 'TikTok' ? 0x222222 : new THREE.Color(icon.color).lerp(new THREE.Color(0xffffff), 0.2);
            const rimMat = new THREE.MeshStandardMaterial({
                color: rimColor,
                roughness: 0.3,
                metalness: 0.2,
            });
            this.disposables.push(faceMat, rimMat);

            const iconMesh = new THREE.Mesh(iconGeometry, [rimMat, faceMat, faceMat]);
            const basePosY = 1.8 + radius;
            iconMesh.position.y = basePosY;
            iconMesh.castShadow = true;
            iconMesh.receiveShadow = true;
            iconMesh.userData = { iconIndex: i };
            iconGroup.add(iconMesh);

            this.rootGroup.add(iconGroup);
            this.interactiveMeshes.push(iconMesh, base1, base2);

            this.iconItems.push({
                index: i,
                group: iconGroup,
                iconMesh: iconMesh,
                neonMat: neonMat,
                ringLight: ringLight,
                btn: btn,
                basePosY: basePosY,
                currentScale: 1.0,
                targetScale: 1.0,
                data: icon
            });

            // ── Colisionador físico Rapier para cada pedestal en la curva ──
            if (this.physicsWorld && RAPIER) {
                try {
                    const worldX = this.position.x + posX * this.scale;
                    const worldY = this.position.y + 1.8 * this.scale;
                    const worldZ = this.position.z + posZ * this.scale;

                    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(worldX, worldY, worldZ);
                    const body = this.physicsWorld.createRigidBody(bodyDesc);
                    const colliderDesc = RAPIER.ColliderDesc.cylinder(
                        1.8 * this.scale,
                        4.2 * this.scale
                    ).setFriction(0.8);
                    this.physicsWorld.createCollider(colliderDesc, body);
                    this.colliders.push(body);
                } catch (e) {
                    console.warn('[SocialIcons] Error al crear colisionador Rapier:', e);
                }
            }
        });
    }

    /**
     * Bucle de animación por frame (invocar desde _animate en Game.js).
     */
    update(delta, time = 0, camera = null, timeCycle = null) {
        const t = time;
        const nightFactor = timeCycle ? (timeCycle.nightFactor ?? (timeCycle.isNight ? 1.0 : 0.0)) : 0.0;

        // Raycasting para detectar hover con el cursor
        if (camera && this.interactiveMeshes.length > 0) {
            this.raycaster.setFromCamera(this.mouse, camera);
            const intersects = this.raycaster.intersectObjects(this.interactiveMeshes);

            let newHovered = -1;
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj && obj.userData.iconIndex === undefined && obj.parent) {
                    obj = obj.parent;
                }
                if (obj && obj.userData.iconIndex !== undefined) {
                    newHovered = obj.userData.iconIndex;
                }
            }

            if (newHovered !== this.hoveredIndex) {
                this.hoveredIndex = newHovered;
                document.body.style.cursor = newHovered !== -1 ? 'pointer' : 'default';
            }
        }

        // Actualizar cada icono (flotación + ampliación + neón solo en la noche)
        this.iconItems.forEach((item, i) => {
            const isHovered = (i === this.hoveredIndex);
            item.targetScale = isHovered ? 1.35 : 1.0;

            // Escala suave en hover
            item.currentScale += (item.targetScale - item.currentScale) * Math.min(1.0, delta * 10);
            item.group.scale.setScalar(item.currentScale * this.scale);

            // Flotación flotante suave
            const floatY = Math.sin(t * 1.5 + i * 0.8) * 0.08;
            item.iconMesh.position.y = item.basePosY + floatY;

            // Bamboleo o rotación suave
            const rotY = isHovered ? Math.sin(t * 3.0) * 0.25 : Math.sin(t * 1.2 + i * 0.5) * 0.15;
            item.iconMesh.rotation.y = rotY;

            // Pulso del neón — BRILLA SOLO DE NOCHE
            const baseEmissive = isHovered ? 4.5 : 2.5;
            const pulse = (Math.sin(t * 3.0 + i) * 0.5 + baseEmissive) * nightFactor;
            item.neonMat.emissiveIntensity = Math.max(0.05, pulse);
            item.ringLight.intensity = pulse * (isHovered ? 1.2 : 0.75);
        });
    }

    destroy() {
        if (this._onPointerMove) window.removeEventListener('pointermove', this._onPointerMove);
        if (this._onPointerDown) window.removeEventListener('pointerdown', this._onPointerDown);

        if (this.rootGroup) {
            this.scene.remove(this.rootGroup);
        }
        this.disposables.forEach(d => {
            if (d.dispose) d.dispose();
        });
        this.disposables = [];
        this.iconItems = [];
        this.interactiveMeshes = [];
    }
}
