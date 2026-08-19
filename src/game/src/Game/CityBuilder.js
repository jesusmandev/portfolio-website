/**
 * CityBuilder — Fachada que delega en ProceduralCityBuilder.
 *
 * Reemplaza la carga del GLB por la ciudad procedural Three.js
 * extraída de `index copy.html`. Mantiene la misma API pública
 * que el CityBuilder original (cityGroundMaterials, cityLeafMaterials,
 * cityBarkMaterials, update()) para que Game.js no necesite cambios.
 */
import { ProceduralCityBuilder } from './ProceduralCityBuilder.js';

export class CityBuilder {
    /**
     * @param {THREE.Scene}  scene
     * @param {RAPIER.World} physicsWorld
     * @param {*}            chunkManager  — ignorado (la ciudad procedural no usa chunks)
     * @param {Function}     onReady       — callback cuando la ciudad está lista
     */
    constructor(scene, physicsWorld, chunkManager, onReady, tierConfig = null) {
        this.scene        = scene;
        this.physicsWorld = physicsWorld;
        this.onReady      = onReady;

        // Colecciones de materiales (compatibles con ciclo día/noche)
        this.cityGroundMaterials = new Set();
        this.cityLeafMaterials   = new Set();
        this.cityBarkMaterials   = new Set();

        // Construir la ciudad proceduralmente
        this._procCity = new ProceduralCityBuilder(
            scene,
            physicsWorld,
            (builder) => {
                // Combinar colecciones de materiales con las del builder interno
                builder.cityGroundMaterials.forEach(m => this.cityGroundMaterials.add(m));
                builder.cityLeafMaterials.forEach(m   => this.cityLeafMaterials.add(m));
                builder.cityBarkMaterials.forEach(m   => this.cityBarkMaterials.add(m));

                if (this.onReady) this.onReady();
            },
            {
                offsetX: -260,   // alineado con el spawn del personaje
                offsetY: -1.0,
                offsetZ:  0,
                scale:    3.0,   // 3x: ciudad proporcional al personaje de 9u
                tierConfig: tierConfig
            }
        );
    }

    /**
     * Llamar desde Game._animate() cada frame.
     * Actualiza la animación de viento del césped y StatueLights si existen.
     */
    update(delta, timeCycle, playerPos) {
        this._procCity?.update(delta, timeCycle, playerPos);
    }
}