import * as THREE from 'three/webgpu'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import { PalmTree } from '../PalmTree.js'

export class AchievementsArea extends Area
{
    constructor(model)
    {
        // ─────────────────────────────────────────────────────────────────
        // 1. QUITAR POR COMPLETO LA CASCADA, EL ESTANQUE Y EL PILAR DE PIEDRA
        // ─────────────────────────────────────────────────────────────────
        const toRemove = []
        model.traverse((child) =>
        {
            if(child.name && (
                /^Cube[._]?(089|110)/i.test(child.name) ||
                /^physicalFixed[._]?008/i.test(child.name) ||
                /^(cuboid|hull)/i.test(child.name) ||
                /^ref(Waterfall|Pillar)/i.test(child.name)
            ))
            {
                child.userData.preventAutoAdd = true
                child.visible = false
                toRemove.push(child)
            }
        })

        for(const child of toRemove)
        {
            if(child.parent)
                child.parent.remove(child)
        }

        super(model)

        // Debug panel
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🌴 Palmera CV Area',
                expanded: false,
            })
        }

        // Posición central donde estaba la cascada
        this.position = new THREE.Vector3(69.66, 0.0, 12.0)
        this.interactionRadius = 7.0
        this.isNear = false
        this.isOpen = false

        this.setSounds()
        this.setPalmTree()
        this.setPhysics()
        this.setUI()
        this.setInteractivePoint()
        this.setEvents()
        this.setAchievement()
    }

    setSounds()
    {
        this.sounds = {}

        // Sonido ambiental de chimes mágicos suaves
        this.sounds.chimers = this.game.audio.register({
            path: 'sounds/magic/Mountain Audio - Small Chimes - Loop.mp3',
            autoplay: true,
            loop: true,
            volume: 0.12,
            positions: this.position,
            distanceFade: 22
        })
    }

    setPalmTree()
    {
        this.palmTree = new PalmTree({ position: this.position })
        this.game.scene.add(this.palmTree.group)
        this.objects.hideable.push(this.palmTree.group)
    }

    setPhysics()
    {
        // Colisionador físico sólido para el tronco de la palmera
        this.physicalObject = this.game.objects.add(
            null,
            {
                type: 'fixed',
                category: 'object',
                position: {
                    x: this.position.x,
                    y: this.position.y + 3.0,
                    z: this.position.z
                },
                friction: 0.6,
                restitution: 0.05,
                colliders: [
                    {
                        shape: 'cylinder',
                        parameters: [ 3.0, 1.05 ],
                        category: 'object'
                    }
                ]
            }
        )
    }

    setUI()
    {
        this.createStyles()

        // ─────────────────────────────────────────────────────────────────
        // MODAL DE CV: "Download Resume" (la interacción se muestra con el punto 3D JM + Corona)
        // ─────────────────────────────────────────────────────────────────
        this.modalElement = document.createElement('div')
        this.modalElement.className = 'cv-modal-backdrop'
        this.modalElement.style.display = 'none'

        this.modalElement.innerHTML = `
            <div class="cv-modal-card" id="cvModalCard">
                <!-- Botón de Cerrar (X) -->
                <button class="cv-close-btn" id="cvCloseBtn" title="Close (ESC)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <!-- Título -->
                <h3 class="cv-title">
                    Download Resume
                </h3>

                <!-- Botones de Descarga de CV -->
                <div class="cv-buttons-row">
                    <a href="cv/Espanol.pdf" target="_blank" rel="noopener noreferrer" class="cv-download-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        CV in Spanish
                    </a>

                    <a href="cv/Ingles.pdf" target="_blank" rel="noopener noreferrer" class="cv-download-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        CV in English
                    </a>
                </div>
            </div>
        `
        document.body.appendChild(this.modalElement)

        // Eventos de cierre
        const closeBtn = this.modalElement.querySelector('#cvCloseBtn')
        if(closeBtn)
        {
            closeBtn.addEventListener('click', (e) =>
            {
                e.stopPropagation()
                this.close()
            })
        }

        this.modalElement.addEventListener('click', (e) =>
        {
            if(e.target === this.modalElement)
                this.close()
        })

        const card = this.modalElement.querySelector('#cvModalCard')
        if(card)
        {
            card.addEventListener('click', (e) => e.stopPropagation())
        }
    }

    createStyles()
    {
        if(document.getElementById('cv-modal-styles')) return

        const style = document.createElement('style')
        style.id = 'cv-modal-styles'
        style.textContent = `
            /* CV MODAL */
            .cv-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: rgba(5, 5, 5, 0.82);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                animation: cvFadeIn 0.3s ease-out;
            }
            @keyframes cvFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes cvCardUp {
                from { opacity: 0; transform: translateY(28px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .cv-modal-card {
                position: relative;
                z-index: 10;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.92));
                border: 1px solid rgba(255, 255, 255, 0.12);
                min-height: 250px;
                max-width: 750px;
                width: 92%;
                padding: 55px 32px 50px;
                border-radius: 44px;
                box-shadow: 0 0 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(56, 189, 248, 0.15);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                animation: cvCardUp 0.38s cubic-bezier(0.25, 1, 0.5, 1);
            }
            .cv-close-btn {
                position: absolute;
                top: 24px;
                right: 24px;
                width: 46px;
                height: 46px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #94a3b8;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                transition: all 0.25s ease;
            }
            .cv-close-btn:hover {
                background: rgba(255, 45, 85, 0.2);
                color: #ffffff;
                box-shadow: 0 0 20px rgba(255, 45, 85, 0.4);
                transform: scale(1.08);
            }
            .cv-title {
                font-size: clamp(24px, 4vw, 36px);
                font-weight: 700;
                color: #ffffff;
                text-align: center;
                letter-spacing: 0.04em;
                margin: 0 0 36px 0;
                font-family: 'Inter', -apple-system, sans-serif;
                text-shadow: 0 0 24px rgba(56, 189, 248, 0.45);
            }
            .cv-buttons-row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                gap: 20px;
                width: 100%;
            }
            .cv-download-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                height: 58px;
                padding: 0 34px;
                border-radius: 18px;
                font-size: 18px;
                font-weight: 700;
                font-family: 'Inter', -apple-system, sans-serif;
                border: 1px solid rgba(255, 255, 255, 0.16);
                background: rgba(255, 255, 255, 0.04);
                color: #ffffff;
                text-decoration: none;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
                cursor: pointer;
            }
            .cv-download-btn:hover {
                background: rgba(56, 189, 248, 0.16);
                border-color: rgba(56, 189, 248, 0.6);
                box-shadow: 0 0 30px rgba(56, 189, 248, 0.35);
                transform: translateY(-3px) scale(1.02);
                color: #ffffff;
            }
        `
        document.head.appendChild(style)
    }

    setInteractivePoint()
    {
        const pointPos = new THREE.Vector3(this.position.x, 1.6, this.position.z + 4.0)

        this.interactivePoint = this.game.interactivePoints.create(
            pointPos,
            'Curriculum Vitae',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.open()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setEvents()
    {
        this.onKeyDown = (e) =>
        {
            if(e.code === 'Enter')
            {
                if(this.isNear && !this.isOpen)
                {
                    e.stopImmediatePropagation()
                    this.open()
                }
            }
            else if(e.code === 'Escape')
            {
                if(this.isOpen)
                {
                    e.stopImmediatePropagation()
                    this.close()
                }
            }
        }
        window.addEventListener('keydown', this.onKeyDown, true)
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'achievements')
        })
    }

    open()
    {
        if(this.isOpen) return
        this.isOpen = true

        this.modalElement.style.display = 'flex'
        if(this.interactivePoint)
            this.interactivePoint.hide()

        // Frenar vehículo mientras el modal está abierto
        if(this.game.player?.vehicle)
        {
            this.game.player.vehicle.controls.forward = false
            this.game.player.vehicle.controls.backward = false
            this.game.player.vehicle.controls.left = false
            this.game.player.vehicle.controls.right = false
            this.game.player.vehicle.controls.boost = false
            this.game.player.vehicle.controls.brake = true
        }
    }

    close()
    {
        if(!this.isOpen) return
        this.isOpen = false

        this.modalElement.style.display = 'none'
        if(this.interactivePoint)
            this.interactivePoint.show()
    }

    update()
    {
        const elapsedTime = this.game.ticker.elapsed

        // 1. Animar balanceo orgánico de las hojas de la palmera
        if(this.palmTree)
        {
            this.palmTree.update(elapsedTime)
        }

        // 2. Detección de proximidad para abrir con Enter
        if(!this.game.player) return

        const playerPos = this.game.player.position
        const dx = playerPos.x - this.position.x
        const dz = playerPos.z - (this.position.z + 1.5)
        const distSq = dx * dx + dz * dz

        this.isNear = distSq < (this.interactionRadius * this.interactionRadius)
    }
}
