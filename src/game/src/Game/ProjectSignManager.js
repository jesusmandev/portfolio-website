import * as THREE from 'three';

export class ProjectSignManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.projects = [
            {
                id: 1,
                title: "Streaming Accounts Store",
                category: "WEB APPLICATION",
                categoryColor: "#f59e0b",
                description: "Complete platform for buying and selling streaming service accounts.",
                image: "projects/tienda-streaming.png",
                codeLink: "https://github.com/jesusmandev/platform-to-sell-streaming-accounts.git",
                webLink: "https://jesusmandev.github.io/platform-to-sell-streaming-accounts/"
            },
            {
                id: 2,
                title: "World Food Menu",
                category: "FOOD",
                categoryColor: "#f59e0b",
                description: "Gastronomic menu featuring world dishes and eye-catching design.",
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
                title: "GIFs Application",
                category: "APP",
                categoryColor: "#a855f7",
                description: "Application for searching and viewing GIFs using an external API.",
                image: "projects/app-gifs.png",
                codeLink: "https://github.com/jesusmandev/GIF-app.git",
                webLink: "https://jesusmandev.github.io/GIF-app/"
            },
            {
                id: 5,
                title: "Valentine's Card",
                category: "DESIGN",
                categoryColor: "#ec4899",
                description: "Interactive animated card with CSS effects.",
                image: "projects/tarjeta-san-valentin.png",
                codeLink: "https://github.com/jesusmandev/valentine-card.git",
                webLink: "https://jesusmandev.github.io/valentine-card/"
            },
            {
                id: 6,
                title: "Pre-ICFES Simulator",
                category: "EDUCATION",
                categoryColor: "#6366f1",
                description: "Pre-ICFES exam simulator with timer and scoring.",
                image: "projects/simulador-prelcfes.png",
                codeLink: "https://github.com/jesusmandev/simulator.git",
                webLink: "https://jesusmandev.github.io/simulator/"
            },
            {
                id: 7,
                title: "Calculator",
                category: "UTILITY",
                categoryColor: "#f59e0b",
                description: "Functional calculator with a clean design and full operations.",
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
                description: "Attractive landing page for a burger restaurant with a modern, appetizing design.",
                image: "projects/hamburguesa.png",
                codeLink: "https://github.com/jesusmandev/burger-landing.git",
                webLink: "https://agent-6a1ac44517acbb0fc92284c3--burger-jesu.netlify.app/"
            },
            {
                id: 10,
                title: "Motorcycle Landing Page",
                category: "LANDING PAGE",
                categoryColor: "#3b82f6",
                description: "Dynamic landing page for the H2R motorcycle brand with striking visual effects.",
                image: "projects/moto.png",
                codeLink: "https://github.com/jesusmandev/landing-page-of-motorbike.git",
                webLink: "https://jesusmandev.github.io/landing-page-of-motorbike/"
            },
            {
                id: 11,
                title: "3D Black Hole",
                category: "3D / GAME",
                categoryColor: "#8b5cf6",
                description: "3D interactive simulation of a black hole with gravitational lensing and particle effects.",
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

        this.currentIndex = 0;

        // 3D object references
        this.signBoardMesh = null;   // Sign12
        this.arrowRightMesh = null;  // group1140289422
        this.arrowLeftMesh = null;   // group1140289422.001
        this.demoButtonMesh = null;  // Sign13
        this.codeButtonMesh = null;  // Sign13.001

        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 512;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        this._interactiveObjects = [];

        this._boundPointerDown = this._onPointerDown.bind(this);
        window.addEventListener('pointerdown', this._boundPointerDown);

        this.findMeshes();
        this.updateBoard();
    }

    findMeshes() {
        console.log('[ProjectSignManager] Searching for project sign components...');
        this.scene.traverse(child => {
            if (child.isMesh) {
                const name = child.name;
                
                // Sign12 is the main board
                if (name === 'Sign12') {
                    this.signBoardMesh = child;
                    console.log('[ProjectSignManager] Found Sign12');
                }
                // group1140289422 is the right arrow
                else if (name === 'group1140289422') {
                    this.arrowRightMesh = child;
                    this._interactiveObjects.push(child);
                    console.log('[ProjectSignManager] Found right arrow');
                }
                // group1140289422.001 is the left arrow
                else if (name === 'group1140289422.001') {
                    this.arrowLeftMesh = child;
                    this._interactiveObjects.push(child);
                    console.log('[ProjectSignManager] Found left arrow');
                }
                // Sign13 is View Demo
                else if (name === 'Sign13') {
                    this.demoButtonMesh = child;
                    this._interactiveObjects.push(child);
                    console.log('[ProjectSignManager] Found Sign13 (Demo)');
                }
                // Sign13.001 is View Code
                else if (name === 'Sign13.001') {
                    this.codeButtonMesh = child;
                    this._interactiveObjects.push(child);
                    console.log('[ProjectSignManager] Found Sign13.001 (Code)');
                }
            }
        });

        // Configurar textura dinámica en el cartel principal
        if (this.signBoardMesh) {
            this.signBoardMesh.material = new THREE.MeshStandardMaterial({
                map: this.texture,
                emissiveMap: this.texture,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 0.65, // Brillo excelente de día y noche
                roughness: 0.3,
                metalness: 0.1
            });
            this.signBoardMesh.material.needsUpdate = true;
        }

        // Highlight interactivity for buttons/arrows
        this._interactiveObjects.forEach(obj => {
            if (obj.material) {
                obj.material = obj.material.clone();
                obj.material.emissive = new THREE.Color(0x3b82f6);
                obj.material.emissiveIntensity = 0.5;
            }
        });
    }

    _onPointerDown(event) {
        if (event.isPrimary === false) return;

        this._mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this._mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, this.camera);
        const intersects = this._raycaster.intersectObjects(this._interactiveObjects);

        if (intersects.length > 0) {
            const clickedObj = intersects[0].object;
            console.log('[ProjectSignManager] Clicked mesh:', clickedObj.name);

            // Efecto visual rápido de feedback de click
            if (clickedObj.material && clickedObj.material.emissive) {
                const origIntensity = clickedObj.material.emissiveIntensity;
                clickedObj.material.emissiveIntensity = 3.0;
                setTimeout(() => {
                    if (clickedObj.material) {
                        clickedObj.material.emissiveIntensity = origIntensity;
                    }
                }, 150);
            }

            const project = this.projects[this.currentIndex];

            if (clickedObj.name === 'group1140289422') {
                // Right arrow: next
                this.currentIndex = (this.currentIndex + 1) % this.projects.length;
                this.updateBoard();
            } else if (clickedObj.name === 'group1140289422.001') {
                // Left arrow: previous
                this.currentIndex = (this.currentIndex - 1 + this.projects.length) % this.projects.length;
                this.updateBoard();
            } else if (clickedObj.name === 'Sign13') {
                // View Demo
                if (project && project.webLink) {
                    window.open(project.webLink, '_blank');
                }
            } else if (clickedObj.name === 'Sign13.001') {
                // View Code
                if (project && project.codeLink) {
                    window.open(project.codeLink, '_blank');
                }
            }
        }
    }

    updateBoard() {
        const project = this.projects[this.currentIndex];
        if (!project) return;

        // Inicializar caché de imágenes (solo una vez)
        if (!this._imgCache) this._imgCache = new Map();

        const _drawContent = (imgElement) => {
            // Fondo degradado premium
            const grad = this.ctx.createLinearGradient(0, 0, 1024, 512);
            grad.addColorStop(0, '#0a0b12');
            grad.addColorStop(0.5, '#121324');
            grad.addColorStop(1, '#0a0b12');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, 1024, 512);

            // Borde elegante
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 12;
            this.ctx.strokeRect(6, 6, 1012, 500);

            // Indicador de proyecto (X / N)
            this.ctx.font = 'bold 18px sans-serif';
            this.ctx.fillStyle = 'rgba(255,255,255,0.45)';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`${this.currentIndex + 1} / ${this.projects.length}`, 1004, 36);

            // Título del proyecto
            this.ctx.font = 'bold 44px sans-serif';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
            this.ctx.shadowBlur = 20;
            this.ctx.fillText(project.title.toUpperCase(), 512, 80);
            this.ctx.shadowBlur = 0;

            // Categoría (Badge)
            this.ctx.fillStyle = project.categoryColor || '#f59e0b';
            this.ctx.font = 'bold 20px sans-serif';
            const badgeText = project.category.toUpperCase();
            const textWidth = this.ctx.measureText(badgeText).width;
            this.ctx.fillRect(512 - textWidth/2 - 16, 110, textWidth + 32, 34);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(badgeText, 512, 134);

            if (imgElement) {
                const targetW = 660;
                const targetH = 290;
                const imgX = 512 - targetW / 2;
                const imgY = 180;
                this.ctx.fillStyle = '#1e293b';
                this.ctx.fillRect(imgX - 6, imgY - 6, targetW + 12, targetH + 12);
                this.ctx.drawImage(imgElement, imgX, imgY, targetW, targetH);
            } else {
                this.drawFallback(project, false); // false = no marcar needsUpdate, lo hace _drawContent
            }

            // Un único upload de textura al GPU
            this.texture.needsUpdate = true;
        };

        if (project.image) {
            const cached = this._imgCache.get(project.image);
            if (cached) {
                // Imagen ya cargada: dibujar inmediatamente sin latencia
                _drawContent(cached);
            } else {
                // Dibujar fondo + texto mientras carga la imagen (sin imagen aún)
                _drawContent(null);

                const img = new Image();
                img.crossOrigin = 'anonymous';
                const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
                img.src = `${baseUrl}/${project.image}`;
                img.onload = () => {
                    console.log(`[ProjectSignManager] Imagen cargada con éxito: ${img.src}`);
                    this._imgCache.set(project.image, img);
                    // Solo redibujar si aún es el mismo proyecto
                    if (this.projects[this.currentIndex] === project) {
                        _drawContent(img);
                    }
                };
                img.onerror = () => {
                    console.error(`[ProjectSignManager] Error al cargar la imagen: ${img.src}`);
                    this._imgCache.set(project.image, null); // marcar como fallido para no reintentar
                };
            }
        } else {
            _drawContent(null);
        }
    }

    drawFallback(project, setNeedsUpdate = true) {
        const targetW = 660;
        const targetH = 290;
        const imgX = 512 - targetW / 2;
        const imgY = 180;

        const fallbackGrad = this.ctx.createLinearGradient(imgX, imgY, imgX + targetW, imgY + targetH);
        fallbackGrad.addColorStop(0, '#1e293b');
        fallbackGrad.addColorStop(1, '#0f172a');
        this.ctx.fillStyle = fallbackGrad;
        this.ctx.fillRect(imgX, imgY, targetW, targetH);

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '24px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Preview not available", 512, imgY + targetH/2);
        if (setNeedsUpdate) this.texture.needsUpdate = true;
    }

    destroy() {
        window.removeEventListener('pointerdown', this._boundPointerDown);
        this.texture.dispose();
        if (this.signBoardMesh && this.signBoardMesh.material) {
            this.signBoardMesh.material.dispose();
        }
    }
}
