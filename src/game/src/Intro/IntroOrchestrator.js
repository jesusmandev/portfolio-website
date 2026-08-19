/**
 * IntroOrchestrator - director del flujo completo de introduccion.
 *
 * Flujo optimizado:
 *  1. WorldLoadingScreen (octaedro holografico) durante minimo 48 s
 *     + espera a que RAPIER, assets y Game esten 100% listos.
 *     + calienta el renderizador 3D en segundo plano para eliminar el lag.
 *  2. Fade a negro -> destruye pantalla de carga
 *  3. Habilita entidad del personaje y coloca la camara enfrente de el de manera limpia.
 *  4. Portal iris (TerrainCinematic) se abre frente al personaje ya cargado.
 *  5. Cuando el portal se abre por completo -> se dispara la musica de fondo en loop (musica uno y musica dos) y se activan controles/animacion.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { BackgroundLoader }   from './BackgroundLoader.js';
import { AudioManager }       from './AudioManager.js';
import { TransitionManager }  from './TransitionManager.js';
import { WorldLoadingScreen } from './WorldLoadingScreen.js';
import { TerrainCinematic }   from './TerrainCinematic.js';
import { Game }               from '../Game.js';

export class IntroOrchestrator {

    constructor() {
        this.bgLoader    = null;
        this.audioManager= null;
        this.transition  = null;
        this.game        = null;

        this._rapierReady = false;
        this._assetsReady = false;
        this._gameReady   = false;
        this._hasTimedOut = false;
    }

    // ----------------------------------------------------------------
    //  ARRANQUE
    // ----------------------------------------------------------------

    async start() {
        this.transition = new TransitionManager();
        this.transition.setBlackInstant();

        // 1. Pantalla de carga (octaedro holografico)
        this._worldLoadingScreen = new WorldLoadingScreen();
        this._worldLoadingScreen.show();
        this._worldLoadingScreen.setProgress(0);

        // 2. Audio en paralelo (no bloquea)
        this.audioManager = new AudioManager();
        this.audioManager.preload();

        // 3. Precarga total en segundo plano
        this._startBackgroundPreload();

        // 4. Barra animada: espera a que todo este listo (minimo 5 s de animacion)
        //    Con timeout absoluto de 90 s para que nunca se quede colgado.
        const MIN_DISPLAY_MS  = 5000;    // minimo de animacion de carga para garantizar decodificacion total
        const MAX_WAIT_MS     = 90000;   // timeout absoluto de seguridad
        const startTime       = performance.now();

        await new Promise(resolve => {
            // Timeout de seguridad: si a los 90 s no esta listo, entrar de todas formas
            const safetyTimer = setTimeout(() => {
                console.warn('[Orchestrator] Timeout de seguridad alcanzado — entrando al juego.');
                this._hasTimedOut = true;
                resolve();
            }, MAX_WAIT_MS);

            let gameReadyTimestamp = null; // capturado una sola vez cuando _gameReady se activa

            const update = () => {
                const elapsed      = performance.now() - startTime;
                const allReady     = this._assetsReady && this._rapierReady && this._gameReady;
                const minTimePast  = elapsed >= MIN_DISPLAY_MS;

                // Capturar el momento exacto en que el juego quedo listo
                if (this._gameReady && gameReadyTimestamp === null) {
                    gameReadyTimestamp = elapsed;
                }

                // Calcular progreso visual
                let actualProgress;
                if (!this._gameReady) {
                    // Juego todavia cargando: barra crece lentamente hasta 90%
                    actualProgress = Math.min(elapsed / 30000, 1.0) * 0.9;
                } else {
                    // Juego listo: completar barra del punto actual al 99% en ~1 s
                    const sinceReady = elapsed - gameReadyTimestamp;
                    const beforeReady = Math.min(gameReadyTimestamp / 30000, 1.0) * 0.9;
                    actualProgress = beforeReady + Math.min(sinceReady / 1000, 1.0) * (0.99 - beforeReady);
                }

                this._worldLoadingScreen?.setProgress(Math.min(actualProgress, 0.99));

                if (allReady && minTimePast) {
                    clearTimeout(safetyTimer);
                    resolve();
                } else {
                    requestAnimationFrame(update);
                }
            };
            requestAnimationFrame(update);
        });


        // 5-9. Render startup, transition, and portal.
        // Safety guard: if the 90s timeout fired before _tryInitGame() completed,
        // this.game may still be null — recover gracefully instead of crashing.
        if (!this.game) {
            console.warn('[Orchestrator] Game not initialized after timeout — recovering.');
            this._recoverFromStartFailure();
            return;
        }

        try {
            // 5. Precalentamiento del renderizador en segundo plano para evitar tironeo (lag)
            this.game.setPlayerMode('character');
            this.game.recreatePlayerEntity();

            // Sincronizar camara detras/enfrente instantaneamente
            this.game._camSnapped = false;
            this.game._updateFollowCamera();

            // Arrancar render del juego Oculto en background
            this.game.startRender();

            // Esperar 6 segundos con el render ya corriendo para que suban texturas, shaders,
            // fisica y animaciones al 100% — asi cuando el portal abra el personaje ya cae de inmediato.
            this._worldLoadingScreen?.setProgress(1);
            await new Promise(r => setTimeout(r, 6000));

            // 6. Fade a negro -> destruir pantalla de carga
            await this.transition.fadeToBlack(0.5);
            await this._worldLoadingScreen?.hide();
            this._worldLoadingScreen = null;

            // 7. Mostrar canvas del juego
            this.game.showCanvas();

            // Forzar snap de camara frontal de nuevo justo antes de abrir portal
            this.game._camSnapped = false;
            this.game._updateFollowCamera();

            // 8. Portal iris aparece FRENTE al personaje ya cargado (oculto bajo overlay negro)
            this._terrainCinematic = new TerrainCinematic();

            // El portal se muestra de inmediato. Pasamos el callback para cuando se abra del todo:
            this._terrainCinematic.showInstant(this.game.camera, () => {
                console.log('[Orchestrator] Portal completamente abierto. Activando musica y animacion.');

                // 9. Musica de fondo (musica uno y musica dos en loop a volumen suave)
                this.audioManager.play();

                // 10. Activar fisicas y controles (esto disparara automaticamente la animacion "Yes")
                this.game.enablePhysics();
                this.game.enableControls();
            });

            // 9. Fade from black -> reveal the portal
            await this.transition.fadeFromBlack(0.6);
        } catch (err) {
            console.error('[Orchestrator] Render/portal startup failed — recovering to not leave player stuck:', err);
            this._recoverFromStartFailure();
        }
    }

    /**
     * Emergency recovery: if something in the final stretch of start() fails,
     * ensures the player sees the game and can move instead of remaining
     * looking at a black screen or permanent loading.
     */
    _recoverFromStartFailure() {
        try { this._worldLoadingScreen?.hide(); } catch (_) {}
        this._worldLoadingScreen = null;

        try { this.transition?.fadeFromBlack?.(0.3); } catch (_) {}

        if (this.game) {
            try { this.game.setPlayerMode('character'); } catch (_) {}
            try { this.game.recreatePlayerEntity(); } catch (_) {}
            try { this.game._camSnapped = false; } catch (_) {}
            try { this.game._updateFollowCamera(); } catch (_) {}
            try { if (!this.game._renderStarted) this.game.startRender(); } catch (_) {}
            try { this.game.showCanvas(); } catch (_) {}
            try { this.game.enablePhysics(); } catch (_) {}
            try { this.game.enableControls(); } catch (_) {}
        }
    }

    // ----------------------------------------------------------------
    //  PRECARGA EN SEGUNDO PLANO
    // ----------------------------------------------------------------

    _startBackgroundPreload() {
        console.log('[Orchestrator] Iniciando precarga completa del mundo...');

        this.bgLoader = new BackgroundLoader();
        this.bgLoader.start(
            () => {},
            async () => {
                console.log('[Orchestrator] Assets precargados al 100%.');
                this._assetsReady = true;
                this._tryInitGame();
            }
        );

        RAPIER.init().then(() => {
            this._rapierReady = true;
            this._tryInitGame();
        });
    }

    // ----------------------------------------------------------------
    //  INICIALIZAR JUEGO EN SEGUNDO PLANO
    // ----------------------------------------------------------------

    _tryInitGame() {
        if (!this._rapierReady || !this._assetsReady) return;
        if (this._gameReady) return;

        console.log('[Orchestrator] Inicializando Game en segundo plano...');

        this.game = new Game();
        this.game.audioManager = this.audioManager;
        window.game = this.game;
        this.game.setPlayerMode('character');
        
        this.game.initAsync()
            .then(async () => {
                // Esperar a que el personaje real este instanciado y su GLB completamente decodificado
                const character = this.game._preloadedEntities.character;
                if (character && character.readyPromise) {
                    console.log('[Orchestrator] Esperando a que el GLB del personaje e hilos carguen...');
                    // Timeout de seguridad para readyPromise: max 30 s
                    await Promise.race([
                        character.readyPromise,
                        new Promise(r => setTimeout(r, 30000))
                    ]);
                }
                
                this._gameReady = true;
                console.log('[Orchestrator] Game listo, personaje e hilos 100% instanciados.');
                if (this._hasTimedOut) {
                    console.log('[Orchestrator] Game listo tras timeout — revelando automáticamente.');
                    this._recoverFromStartFailure();
                }
            })
            .catch(err => {
                console.error('[Orchestrator] Error en initAsync(), entrando al juego de todas formas:', err);
                this._gameReady = true;
                if (this._hasTimedOut) {
                    this._recoverFromStartFailure();
                }
            });
    }
}