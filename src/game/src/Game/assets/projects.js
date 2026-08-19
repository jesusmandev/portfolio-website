import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * ProjectsSign — 3D Sign "THESE ARE MY PROJECTS"
 *
 * Module for the 3D scene with Rapier physics, interactive project gallery,
 * softly-lit buttons (VIEW DEMO / VIEW CODE) and arrow navigation.
 */

export const PROJECTS_DATA = [
    {
        id: 1,
        title: "Streaming Account Store",
        category: "WEB APPLICATION",
        categoryColor: "#f59e0b",
        description: "Complete platform to buy and sell streaming service accounts.",
        image: "projects/tienda-streaming.png",
        codeLink: "https://github.com/jesusmandev/platform-to-sell-streaming-accounts.git",
        webLink: "https://jesusmandev.github.io/platform-to-sell-streaming-accounts/"
    },
    {
        id: 2,
        title: "World Food Menu",
        category: "FOOD",
        categoryColor: "#f59e0b",
        description: "Gastronomic menu featuring dishes from around the world with an eye-catching design.",
        image: "projects/menu-comida.png",
        codeLink: "https://github.com/jesusmandev/WorldMenu.git",
        webLink: "https://jesusmandev.github.io/WorldMenu/"
    },
    {
        id: 3,
        title: "Hangman Game",
        category: "GAME",
        categoryColor: "#22c55e",
        description: "Classic game with multiple difficulty levels.",
        image: "projects/juego-ahorcado.png",
        codeLink: "https://github.com/jesusmandev/Hangman-game.git",
        webLink: "https://jesusmandev.github.io/Hangman-game/"
    },
    {
        id: 4,
        title: "GIF App",
        category: "APP",
        categoryColor: "#a855f7",
        description: "Application to search and view GIFs by consuming an external API.",
        image: "projects/app-gifs.png",
        codeLink: "https://github.com/jesusmandev/GIF-app.git",
        webLink: "https://jesusmandev.github.io/GIF-app/"
    },
    {
        id: 5,
        title: "Valentine's Day Card",
        category: "DESIGN",
        categoryColor: "#ec4899",
        description: "Animated interactive card with CSS effects.",
        image: "projects/tarjeta-san-valentin.png",
        codeLink: "https://github.com/jesusmandev/valentine-card.git",
        webLink: "https://jesusmandev.github.io/valentine-card/"
    },
    {
        id: 6,
        title: "Prelcfes Simulator",
        category: "EDUCATION",
        categoryColor: "#6366f1",
        description: "Prelcfes exam simulator with timer and scoring.",
        image: "projects/simulador-prelcfes.png",
        codeLink: "https://github.com/jesusmandev/simulator.git",
        webLink: "https://jesusmandev.github.io/simulator/"
    },
    {
        id: 7,
        title: "Calculator",
        category: "UTILITY",
        categoryColor: "#f59e0b",
        description: "Functional calculator with clean design and complete operations.",
        image: "projects/calculadora.png",
        codeLink: "https://github.com/jesusmandev/calculadora.git",
        webLink: "https://jesusmandev.github.io/calculadora/"
    },
    {
        id: 8,
        title: "Colombian Coffees",
        category: "COLOMBIA ☕",
        categoryColor: "#f59e0b",
        description: "Landing page about Colombian coffee culture.",
        image: "projects/cafe.png",
        codeLink: "https://github.com/jesusmandev/CAFES-COLOMBIANOS.git",
        webLink: "https://jesusmandev.github.io/CAFES-COLOMBIANOS/"
    },
    {
        id: 9,
        title: "Burger Landing Page",
        category: "LANDING PAGE",
        categoryColor: "#ef4444",
        description: "Attractive landing page for a burger restaurant with modern, appetizing design.",
        image: "projects/hamburguesa.png",
        codeLink: "https://github.com/jesusmandev/burger-landing.git",
        webLink: "https://agent-6a1ac44517acbb0fc92284c3--burger-jesu.netlify.app/"
    },
    {
        id: 10,
        title: "Motorcycle Landing Page",
        category: "LANDING PAGE",
        categoryColor: "#3b82f6",
        description: "Dynamic landing page for the H2R motorcycle brand with stunning visual effects.",
        image: "projects/moto.png",
        codeLink: "https://github.com/jesusmandev/landing-page-of-motorbike.git",
        webLink: "https://jesusmandev.github.io/landing-page-of-motorbike/"
    },
    {
        id: 11,
        title: "3D Black Hole",
        category: "3D / GAME",
        categoryColor: "#8b5cf6",
        description: "Interactive 3D simulation of a black hole with gravitational lensing effects and particles.",
        image: "projects/black-hole.png",
        codeLink: "https://github.com/jesusmandev/3D-Black-Hole.git",
        webLink: "https://jesusmandev.github.io/3D-Black-Hole/"
    },
    {
        id: 12,
        title: "Gemini Clone AI",
        category: "AI WEB APP",
        categoryColor: "#3b82f6",
        description: "Interactive AI assistant web application cloning Google Gemini with smart chat interface.",
        image: "projects/gemini.png",
        codeLink: "https://github.com/jesusmandev/gemini-clon.git",
        webLink: "https://agent-6a8492e1e0a9504b48d47baf--gemini-clonado.netlify.app"
    },
    {
        id: 13,
        title: "Hotel Landing Page",
        category: "LANDING PAGE",
        categoryColor: "#06b6d4",
        description: "Elegant, responsive luxury hotel landing page with online booking presentation and interactive room showcase.",
        image: "projects/hotel.png",
        codeLink: "https://github.com/jesusmandev/landing-page-hotel.git",
        webLink: "https://jesusmandev.github.io/landing-page-hotel/"
    },
    {
        id: 14,
        title: "Solar System 3D",
        category: "3D / SPACE",
        categoryColor: "#8b5cf6",
        description: "Interactive 3D simulation of the Solar System with realistic planetary orbits and visual effects.",
        image: "projects/solarSistem.png",
        codeLink: "https://github.com/jesusmandev/solar-sistem.git",
        webLink: "https://jesusmandev.github.io/solar-sistem/"
    }
];

const COLORS = {
    wood: 0xc48f5a,
    woodDark: 0x8b5a2b,
    woodDeep: 0x5d4037,
    arrow: 0xfff8e1,
    rope: 0xd7ccc8,
    grass: 0x66bb44,
    stone: 0x9e9e9e
};

function createWoodTexture(darker = false) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const ctx = c.getContext('2d');
    const base = darker ? [139, 90, 43] : [196, 143, 90];
    ctx.fillStyle = `rgb(${base.join(',')})`;
    ctx.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 60; i++) {
        const y = Math.random() * 1024;
        ctx.strokeStyle = `rgba(60,40,20,${0.06 + Math.random() * 0.1})`;
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        let cy = y;
        for (let x = 0; x <= 1024; x += 40) {
            cy += (Math.random() - 0.5) * 6;
            ctx.lineTo(x, cy);
        }
        ctx.stroke();
    }

    for (let i = 0; i < 10; i++) {
        const x = Math.random() * 1024, y = Math.random() * 1024, r = 5 + Math.random() * 12;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(60,40,20,0.3)');
        g.addColorStop(1, 'rgba(60,40,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function createBoardTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c48f5a';
    ctx.fillRect(0, 0, 1024, 1024);

    const planks = 5;
    const ph = 1024 / planks;
    for (let p = 0; p < planks; p++) {
        const y = p * ph;
        ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.04})`;
        ctx.fillRect(0, y, 1024, ph);
        ctx.strokeStyle = 'rgba(60,40,20,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
        for (let i = 0; i < 16; i++) {
            const py = y + Math.random() * ph;
            ctx.strokeStyle = `rgba(60,40,20,${0.04 + Math.random() * 0.08})`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath(); ctx.moveTo(0, py);
            let cy = py;
            for (let x = 0; x <= 1024; x += 50) { cy += (Math.random() - 0.5) * 5; ctx.lineTo(x, cy); }
            ctx.stroke();
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function createSideButtonTexture(text, accentColor = '#3b82f6') {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');

    // Elegant dark matte background with subtle wood texture
    ctx.fillStyle = '#1e1b18';
    ctx.fillRect(0, 0, 1024, 512);

    const ph = 512 / 3;
    for (let i = 0; i <= 3; i++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, i * ph); ctx.lineTo(1024, i * ph); ctx.stroke();
    }

    // Bright neumorphic border with accent color
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 18;
    ctx.strokeRect(10, 10, 1004, 492);

    // Subtle inner shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 984, 472);

    // Text with glow
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 100px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 256);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, h / 2);
    s.lineTo(w / 2 - r, h / 2);
    s.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - r);
    s.lineTo(w / 2, -h / 2 + r);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2 - r, -h / 2);
    s.lineTo(-w / 2 + r, -h / 2);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + r);
    s.lineTo(-w / 2, h / 2 - r);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2 + r, h / 2);
    return s;
}

export class ProyectosSign {
    constructor(scene, physicsWorld, options = {}) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        this.position = new THREE.Vector3(
            options.x ?? -612.58,
            options.y ?? 0.20,
            options.z ?? -56.57
        );
        this.scale = options.scale ?? 4.0;
        this.rotationY = options.rotationY ?? 0;

        this.currentIndex = 0;
        this._imgCache = new Map();

        this.rootGroup = new THREE.Group();
        this.rootGroup.position.copy(this.position);
        this.rootGroup.rotation.y = this.rotationY;
        this.rootGroup.scale.setScalar(this.scale);
        this.scene.add(this.rootGroup);

        this.swingGroups = [];
        this.interactiveMeshes = [];
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        // Canvas dinámico para el tablero principal en alta resolución
        this.mainCanvas = document.createElement('canvas');
        this.mainCanvas.width = 1280;
        this.mainCanvas.height = 800;
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.mainTexture = new THREE.CanvasTexture(this.mainCanvas);
        this.mainTexture.colorSpace = THREE.SRGBColorSpace;

        this._build();
        this._buildPhysics();
        this._updateProjectCanvas();

        this._hoveredObj = null;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);

        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
    }

    _updateProjectCanvas() {
        const project = PROJECTS_DATA[this.currentIndex];
        if (!project) return;

        const ctx = this.mainCtx;
        const w = 1280, h = 800;

        const drawContent = (imgElement) => {
        // Dark premium corporate background
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#0c0d14');
            grad.addColorStop(0.5, '#161829');
            grad.addColorStop(1, '#0c0d14');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Outer border with blue glow
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 16;
            ctx.strokeRect(8, 8, w - 16, h - 16);

            // Header - Título principal del cartel
            ctx.font = 'bold 42px "Segoe UI", sans-serif';
            ctx.fillStyle = '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
            ctx.shadowBlur = 14;
            ctx.fillText('THESE ARE MY PROJECTS', w / 2, 54);
            ctx.shadowBlur = 0;

            // Project counter (e.g. "1 / 10")
            ctx.font = 'bold 26px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'right';
            ctx.fillText(`${this.currentIndex + 1} / ${PROJECTS_DATA.length}`, w - 32, 54);

            // Active Project Title
            ctx.font = '800 44px "Segoe UI", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 16;
            ctx.fillText(project.title.toUpperCase(), w / 2, 114);
            ctx.shadowBlur = 0;

            // Category Badge
            ctx.font = 'bold 20px sans-serif';
            const badgeText = project.category.toUpperCase();
            const badgeW = ctx.measureText(badgeText).width + 36;
            const badgeX = w / 2 - badgeW / 2;
            const badgeY = 132;
            ctx.fillStyle = project.categoryColor || '#f59e0b';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(badgeX, badgeY, badgeW, 34, 17);
            } else {
                ctx.fillRect(badgeX, badgeY, badgeW, 34);
            }
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(badgeText, w / 2, badgeY + 24);

            // Project image container (large, proportional to the sign)
            const imgW = 920;
            const imgH = 550;
            const imgX = (w - imgW) / 2;
            const imgY = 190;

            // Image frame
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(imgX - 10, imgY - 10, imgW + 20, imgH + 20);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 5;
            ctx.strokeRect(imgX - 10, imgY - 10, imgW + 20, imgH + 20);

            if (imgElement) {
                ctx.drawImage(imgElement, imgX, imgY, imgW, imgH);
            } else {
                // Fallback mientras carga la imagen
                const fallbackGrad = ctx.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH);
                fallbackGrad.addColorStop(0, '#1e293b');
                fallbackGrad.addColorStop(1, '#0f172a');
                ctx.fillStyle = fallbackGrad;
                ctx.fillRect(imgX, imgY, imgW, imgH);
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 30px sans-serif';
                ctx.fillText("Loading image...", w / 2, imgY + imgH / 2);
            }

            this.mainTexture.needsUpdate = true;
        };

        if (project.image) {
            const cached = this._imgCache.get(project.image);
            if (cached) {
                drawContent(cached);
            } else {
                drawContent(null);
                const img = new Image();
                img.crossOrigin = 'anonymous';
                const rawBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '';
                const baseUrl = rawBase.replace(/\/$/, '');
                const imagePath = project.image.startsWith('/') ? project.image : `/${project.image}`;
                img.src = `${baseUrl}${imagePath}`;
                img.onload = () => {
                    this._imgCache.set(project.image, img);
                    if (PROJECTS_DATA[this.currentIndex] === project) {
                        drawContent(img);
                    }
                };
                img.onerror = (err) => {
                    console.warn(`[ProjectsSign] Error loading image ${img.src}:`, err);
                    this._imgCache.set(project.image, null);
                };
            }
        } else {
            drawContent(null);
        }
    }

    _build() {
        const woodTex = createWoodTexture();
        const darkWoodTex = createWoodTexture(true);
        const boardTex = createBoardTexture();

        const matWood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, bumpMap: woodTex, bumpScale: 0.015 });
        const matDarkWood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.9, bumpMap: darkWoodTex, bumpScale: 0.02 });
        const matBoard = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.8, bumpMap: boardTex, bumpScale: 0.02 });
        
        // Material with soft glow for arrows
        const matArrow = new THREE.MeshStandardMaterial({ 
            color: 0xfff8e1, 
            emissive: new THREE.Color(0xf59e0b),
            emissiveIntensity: 0.4,
            roughness: 0.4, 
            metalness: 0.1 
        });

        const matRope = new THREE.MeshStandardMaterial({ color: COLORS.rope, roughness: 1 });
        const matStone = new THREE.MeshStandardMaterial({ color: COLORS.stone, roughness: 0.9, flatShading: true });
        const matMetal = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.4 });

        const mainGroup = new THREE.Group();
        mainGroup.position.y = 0;

        const mw = 5.6, mh = 3.9, md = 0.55;

        // Main wooden structure
        const boardShape = roundedRectShape(mw, mh, 0.18);
        const boardGeo = new THREE.ExtrudeGeometry(boardShape, {
            depth: md, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.08, bevelSegments: 4
        });
        const board = new THREE.Mesh(boardGeo, matBoard);
        board.position.z = -md / 2;
        board.position.y = 3.5;
        board.castShadow = true;
        board.receiveShadow = true;
        mainGroup.add(board);

        // Main canvas plane where the project image is rendered
        // Placed at z = md/2 + 0.15 (= 0.425) so it sits IN FRONT of the extruded wood face
        const mainDisplayPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(mw * 0.88, mh * 0.85),
            new THREE.MeshStandardMaterial({
                map: this.mainTexture,
                emissiveMap: this.mainTexture,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 0.65, // Excellent day/night lighting
                roughness: 0.2,
                metalness: 0.0
            })
        );
        mainDisplayPlane.position.set(0, 3.5, md / 2 + 0.15);
        mainDisplayPlane.renderOrder = 1;
        mainGroup.add(mainDisplayPlane);

        // Outer frame
        const frameShape = roundedRectShape(mw + 0.36, mh + 0.36, 0.26);
        const frameHole = roundedRectShape(mw + 0.04, mh + 0.04, 0.2);
        frameShape.holes.push(frameHole);
        const frame = new THREE.Mesh(
            new THREE.ExtrudeGeometry(frameShape, { depth: md + 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4 }),
            matDarkWood
        );
        frame.position.z = -(md + 0.18) / 2;
        frame.position.y = 3.5;
        frame.castShadow = true;
        frame.receiveShadow = true;
        mainGroup.add(frame);

        const screw = (x, y, z, parent) => {
            const h = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 0.035, 8),
                new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.5, roughness: 0.5 })
            );
            h.rotation.x = Math.PI / 2;
            h.position.set(x, y, z);
            h.castShadow = true;
            parent.add(h);
        };

        const ox = mw / 2 + 0.14, oy = mh / 2 + 0.14;
        screw(-ox, 3.5 + oy, md / 2 + 0.1, mainGroup);
        screw(ox, 3.5 + oy, md / 2 + 0.1, mainGroup);
        screw(-ox, 3.5 - oy, md / 2 + 0.1, mainGroup);
        screw(ox, 3.5 - oy, md / 2 + 0.1, mainGroup);

        function createPost(x) {
            const g = new THREE.Group();
            const points = [];
            for (let i = 0; i <= 12; i++) {
                const y = (i / 12) * 4.1;
                const r = 0.21 + Math.sin(i * 0.6) * 0.008;
                points.push(new THREE.Vector2(r, y));
            }
            const post = new THREE.Mesh(new THREE.LatheGeometry(points, 16), matDarkWood);
            post.position.y = 0;
            post.castShadow = true;
            post.receiveShadow = true;
            g.add(post);

            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 20), matRope);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 3.15;
            ring.castShadow = true;
            g.add(ring);

            g.position.set(x, 0, 0);
            g.rotation.z = x > 0 ? -0.015 : 0.015;
            return g;
        }

        mainGroup.add(createPost(-1.9));
        mainGroup.add(createPost(1.9));
        this.rootGroup.add(mainGroup);

        // 3D Navigation Arrows (positioned to the sides so they don't block the image)
        function createArrow() {
            const s = new THREE.Shape();
            const sl = 1.55, sw = 0.5, hl = 0.72, hw = 0.82;
            s.moveTo(-sl / 2, sw / 2);
            s.lineTo(sl / 2 - 0.06, sw / 2);
            s.lineTo(sl / 2, hw / 2);
            s.lineTo(sl / 2 + hl, 0);
            s.lineTo(sl / 2, -hw / 2);
            s.lineTo(sl / 2 - 0.06, -sw / 2);
            s.lineTo(-sl / 2, -sw / 2);
            s.closePath();
            const geo = new THREE.ExtrudeGeometry(s, {
                depth: 0.32,
                bevelEnabled: true,
                bevelThickness: 0.09,
                bevelSize: 0.07,
                bevelSegments: 5
            });
            geo.center();
            const mesh = new THREE.Mesh(geo, matArrow.clone());
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        // Left Arrow (Previous) - Positioned lower at the board base (y = 1.85)
        this.leftArrow = createArrow();
        this.leftArrow.rotation.z = Math.PI;
        this.leftArrow.position.set(-2.25, 1.85, md / 2 + 0.28);
        this.leftArrow.scale.setScalar(0.55);
        this.leftArrow.userData = { actionType: 'prev' };
        this.rootGroup.add(this.leftArrow);
        this.interactiveMeshes.push(this.leftArrow);

        // Right Arrow (Next) - Positioned lower at the board base (y = 1.85)
        this.rightArrow = createArrow();
        this.rightArrow.position.set(2.25, 1.85, md / 2 + 0.28);
        this.rightArrow.scale.setScalar(0.55);
        this.rightArrow.userData = { actionType: 'next' };
        this.rootGroup.add(this.rightArrow);
        this.interactiveMeshes.push(this.rightArrow);

        function ropeSegment(p1, p2, thickness = 0.03) {
            const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            mid.x += (Math.random() - 0.5) * 0.04;
            const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
            const geo = new THREE.TubeGeometry(curve, 10, thickness, 6, false);
            const mesh = new THREE.Mesh(geo, matRope);
            mesh.castShadow = true;
            return mesh;
        }

        function createGrassClump(cx, cz, radius) {
            const g = new THREE.Group();
            const count = 12;
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
                const r = Math.random() * radius;
                const x = cx + Math.cos(a) * r;
                const z = cz + Math.sin(a) * r;
                const h = 0.2 + Math.random() * 0.3;
                const blade = new THREE.Mesh(
                    new THREE.ConeGeometry(0.035 + Math.random() * 0.02, h, 5),
                    new THREE.MeshStandardMaterial({
                        color: new THREE.Color().setHSL(0.28 + Math.random() * 0.06, 0.6, 0.38 + Math.random() * 0.12),
                        roughness: 1, flatShading: true
                    })
                );
                blade.position.set(x, h / 2, z);
                blade.rotation.x = (Math.random() - 0.5) * 0.35;
                blade.rotation.z = (Math.random() - 0.5) * 0.35;
                blade.castShadow = true;
                g.add(blade);
            }
            return g;
        }

        function addRocks(parent, cx, cz, radius) {
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * radius;
                const s = 0.1 + Math.random() * 0.15;
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), matStone);
                rock.position.set(cx + Math.cos(a) * r, s * 0.35, cz + Math.sin(a) * r);
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                rock.castShadow = true;
                rock.receiveShadow = true;
                parent.add(rock);
            }
        }

        // Interactive side signs ("VIEW DEMO" and "VIEW CODE") with soft glow
        const createSideSign = (text, side, actionType) => {
            const root = new THREE.Group();
            const dir = side === 'left' ? -1 : 1;
            root.position.set(dir * 4.5, 0, 0);

            const polePoints = [];
            for (let i = 0; i <= 12; i++) {
                const y = (i / 12) * 4.6;
                const r = 0.15 + Math.sin(i * 0.5) * 0.006;
                polePoints.push(new THREE.Vector2(r, y));
            }
            const pole = new THREE.Mesh(new THREE.LatheGeometry(polePoints, 14), matDarkWood);
            pole.position.set(0, 0, -0.25);
            pole.castShadow = true;
            pole.receiveShadow = true;
            root.add(pole);

            const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 0.24), matDarkWood);
            beam.position.set(dir * 0.15, 4.55, 0.08);
            beam.castShadow = true;
            beam.receiveShadow = true;
            root.add(beam);

            const swing = new THREE.Group();
            swing.position.set(dir * 0.3, 4.4, 0.12);
            root.add(swing);

            const sw = 2.0, sh = 0.95, sd = 0.12;

            // Material with soft glow (emissive: 0.35)
            const accentColor = actionType === 'demo' ? '#3b82f6' : '#10b981';
            const emissiveColor = actionType === 'demo' ? 0x2563eb : 0x059669;
            const sideTex = createSideButtonTexture(text, accentColor);

            const matFrontGlow = new THREE.MeshStandardMaterial({ 
                map: sideTex,
                emissiveMap: sideTex,
                emissive: new THREE.Color(emissiveColor),
                emissiveIntensity: 0.35, // Elegant soft glow
                roughness: 0.5,
                metalness: 0.1
            });

            const signBoard = new THREE.Mesh(
                new THREE.BoxGeometry(sw, sh, sd),
                [
                    matWood, matWood, matWood, matWood,
                    matFrontGlow,
                    matWood
                ]
            );
            signBoard.position.y = -0.85;
            signBoard.castShadow = true;
            signBoard.receiveShadow = true;
            signBoard.userData = { actionType, matGlow: matFrontGlow, origEmissive: 0.35 };
            swing.add(signBoard);
            this.interactiveMeshes.push(signBoard);

            const fs = roundedRectShape(sw + 0.1, sh + 0.1, 0.08);
            const fh = roundedRectShape(sw - 0.02, sh - 0.02, 0.06);
            fs.holes.push(fh);
            const sf = new THREE.Mesh(
                new THREE.ExtrudeGeometry(fs, { depth: sd + 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }),
                matDarkWood
            );
            sf.position.set(0, -0.85, -(sd + 0.05) / 2);
            sf.castShadow = true;
            sf.receiveShadow = true;
            swing.add(sf);

            function addGrip(xOffset) {
                const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, sd + 0.08), matMetal);
                strap.position.set(xOffset, -0.375 - 0.15, 0);
                strap.castShadow = true;
                swing.add(strap);

                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16), matMetal);
                ring.position.set(xOffset, -0.375 + 0.06, 0);
                ring.rotation.y = Math.PI / 2;
                ring.castShadow = true;
                swing.add(ring);
            }

            addGrip(-0.75);
            addGrip(0.75);

            const ringX1 = dir * 0.3 - 0.75;
            const ringX2 = dir * 0.3 + 0.75;

            const knotGeo = new THREE.SphereGeometry(0.08, 8, 8);
            const k1 = new THREE.Mesh(knotGeo, matRope); k1.position.set(ringX1, 4.55, 0.22); k1.scale.y = 1.3; root.add(k1);
            const k2 = new THREE.Mesh(knotGeo, matRope); k2.position.set(ringX2, 4.55, 0.22); k2.scale.y = 1.3; root.add(k2);

            const rope1 = ropeSegment(
                new THREE.Vector3(ringX1, 4.55, 0.22),
                new THREE.Vector3(ringX1, 4.4 - 0.375 + 0.06, 0.12)
            );
            root.add(rope1);

            const rope2 = ropeSegment(
                new THREE.Vector3(ringX2, 4.55, 0.22),
                new THREE.Vector3(ringX2, 4.4 - 0.375 + 0.06, 0.12)
            );
            root.add(rope2);

            const grass = createGrassClump(0, 0.1, 0.4);
            grass.position.y = 0;
            root.add(grass);
            addRocks(root, 0, 0.1, 0.5);

            this.rootGroup.add(root);
            this.swingGroups.push({ group: swing, phase: side === 'left' ? 0 : Math.PI });
        };

        createSideSign('VIEW DEMO', 'left', 'demo');
        createSideSign('VIEW CODE', 'right', 'code');

        this.rootGroup.add(createGrassClump(-1.9, 0.15, 0.4));
        this.rootGroup.add(createGrassClump(1.9, 0.15, 0.4));

        const mainDecor = new THREE.Group();
        addRocks(mainDecor, -1.9, 0.15, 0.45);
        addRocks(mainDecor, 1.9, 0.15, 0.45);
        addRocks(mainDecor, 0, 0.2, 0.9);
        this.rootGroup.add(mainDecor);

        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 2.5 + Math.random() * 5;
            this.rootGroup.add(createGrassClump(Math.cos(a) * r, Math.sin(a) * r, 0.35));
        }
    }

    _buildPhysics() {
        if (!this.physicsWorld) return;

        const px = this.position.x;
        const py = this.position.y;
        const pz = this.position.z;
        const sc = this.scale;
        const cosY = Math.cos(this.rotationY);
        const sinY = Math.sin(this.rotationY);

        const createFixedCollider = (localX, localY, localZ, colliderDesc) => {
            const worldX = px + (localX * cosY - localZ * sinY) * sc;
            const worldY = py + localY * sc;
            const worldZ = pz + (localX * sinY + localZ * cosY) * sc;

            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(worldX, worldY, worldZ)
                .setRotation({ x: 0, y: Math.sin(this.rotationY / 2), z: 0, w: Math.cos(this.rotationY / 2) });
            const body = this.physicsWorld.createRigidBody(bodyDesc);
            this.physicsWorld.createCollider(colliderDesc, body);
        };

        createFixedCollider(-1.9, 2.05, 0, RAPIER.ColliderDesc.cylinder(2.05 * sc, 0.25 * sc).setFriction(0.8));
        createFixedCollider(1.9, 2.05, 0, RAPIER.ColliderDesc.cylinder(2.05 * sc, 0.25 * sc).setFriction(0.8));
        createFixedCollider(0, 3.5, 0, RAPIER.ColliderDesc.cuboid(2.9 * sc, 2.0 * sc, 0.35 * sc).setFriction(0.8));
        createFixedCollider(-4.5, 2.3, 0, RAPIER.ColliderDesc.cylinder(2.3 * sc, 0.2 * sc).setFriction(0.8));
        createFixedCollider(4.5, 2.3, 0, RAPIER.ColliderDesc.cylinder(2.3 * sc, 0.2 * sc).setFriction(0.8));
    }

    _onPointerDown(event) {
        if (!event.isPrimary || !this.interactiveMeshes.length || !this.scene.userData.camera) return;

        const camera = this.scene.userData.camera;
        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, camera);
        const hits = this._raycaster.intersectObjects(this.interactiveMeshes);

        if (hits.length > 0) {
            const hitObj = hits[0].object;
            const action = hitObj.userData?.actionType;
            const project = PROJECTS_DATA[this.currentIndex];

            // Temporary bright visual feedback when pressing any button / arrow
            if (hitObj.material) {
                const origIntensity = hitObj.userData?.origEmissive ?? hitObj.material.emissiveIntensity ?? 0.4;
                if (hitObj.material.emissive) {
                    hitObj.material.emissiveIntensity = 1.4;
                    setTimeout(() => {
                        if (hitObj.material) {
                            hitObj.material.emissiveIntensity = origIntensity;
                        }
                    }, 150);
                }
            }

            if (action === 'next') {
                // Right Arrow: Next Project
                this.currentIndex = (this.currentIndex + 1) % PROJECTS_DATA.length;
                this._updateProjectCanvas();
            } else if (action === 'prev') {
                // Left Arrow: Previous Project
                this.currentIndex = (this.currentIndex - 1 + PROJECTS_DATA.length) % PROJECTS_DATA.length;
                this._updateProjectCanvas();
            } else if (action === 'demo') {
                // VIEW DEMO button -> opens the active project's website link
                if (project && project.webLink) {
                    window.open(project.webLink, '_blank');
                }
            } else if (action === 'code') {
                // VIEW CODE button -> opens the active project's repository link
                if (project && project.codeLink) {
                    window.open(project.codeLink, '_blank');
                }
            }
        }
    }

    _onPointerMove(event) {
        if (!this.interactiveMeshes.length || !this.scene.userData.camera) return;

        const camera = this.scene.userData.camera;
        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, camera);
        const hits = this._raycaster.intersectObjects(this.interactiveMeshes);

        if (hits.length > 0) {
            const hitObj = hits[0].object;

            if (this._hoveredObj !== hitObj) {
                if (this._hoveredObj) {
                    this._resetHover(this._hoveredObj);
                }

                this._hoveredObj = hitObj;
                document.body.style.cursor = 'pointer';

                const action = hitObj.userData?.actionType;
                if (hitObj.material && hitObj.material.emissive) {
                    hitObj.material.emissiveIntensity = 1.3; // Se ilumina más
                    if (action === 'demo') {
                        hitObj.material.emissive.setHex(0x38bdf8); // Bright Cyan Blue
                    } else if (action === 'code') {
                        hitObj.material.emissive.setHex(0x34d399); // Neon Emerald Green
                    } else if (action === 'prev' || action === 'next') {
                        hitObj.material.emissive.setHex(0xfde047); // Bright Gold
                    }
                }
            }
        } else {
            if (this._hoveredObj) {
                this._resetHover(this._hoveredObj);
                this._hoveredObj = null;
                document.body.style.cursor = 'auto';
            }
        }
    }

    _resetHover(obj) {
        if (!obj || !obj.material) return;
        const action = obj.userData?.actionType;
        const origIntensity = obj.userData?.origEmissive ?? (action === 'prev' || action === 'next' ? 0.4 : 0.35);

        if (obj.material.emissive) {
            obj.material.emissiveIntensity = origIntensity;
            if (action === 'demo') {
                obj.material.emissive.setHex(0x2563eb);
            } else if (action === 'code') {
                obj.material.emissive.setHex(0x059669);
            } else if (action === 'prev' || action === 'next') {
                obj.material.emissive.setHex(0xf59e0b);
            }
        }
    }

    update(delta, time = 0) {
        const t = time;

        this.swingGroups.forEach(item => {
            item.group.rotation.z = Math.sin(t * 1.2 + item.phase) * 0.05;
            item.group.rotation.x = Math.sin(t * 0.9 + item.phase) * 0.015;
        });

        // Smooth floating animation on navigation arrows
        if (this.leftArrow) {
            this.leftArrow.position.y = 1.85 + Math.sin(t * 1.8) * 0.03;
        }
        if (this.rightArrow) {
            this.rightArrow.position.y = 1.85 + Math.sin(t * 1.8 + 1) * 0.03;
        }
    }

    destroy() {
        window.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        if (this._hoveredObj) {
            document.body.style.cursor = 'auto';
        }
        if (this.mainTexture) this.mainTexture.dispose();
        if (this.rootGroup) {
            this.scene.remove(this.rootGroup);
        }
    }
}
