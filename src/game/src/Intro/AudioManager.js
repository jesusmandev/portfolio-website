/**
 * AudioManager — Gestion de las 2 pistas de audio de fondo en secuencia y loop ("musica uno" y "musica dos").
 *
 * Flujo:
 *  1. play() -> Inicia el loop de musica uno y dos a volumen minimo pero audible (0.12).
 *  2. Al terminar uno -> Reproduce "musica dos.mp3" a volumen minimo.
 *  3. Al terminar dos -> Vuelve a "musica uno.mp3", ciclando infinitamente.
 */
import gsap from 'gsap';

// Module Guard: survives Vite HMR/hot-reload.
// Guarantees only ONE AudioContext active at all times.
let _activeAudioManager = null;

export class AudioManager {
    constructor() {
        // Si hay una instancia previa activa (HMR), destruirla antes de crear la nueva
        if (_activeAudioManager && _activeAudioManager !== this) {
            try { _activeAudioManager.stopInstant(); } catch (_) {}
        }
        _activeAudioManager = this;

        this.ctx = null;
        this.gainNode = null;
        this.currentSource = null;
        
        this.buffers = {
            uno: null,
            dos: null
        };

        this.footstepBuffers = {
            walkCity: null,
            walkGround: null,
            runCity: null,
            runGround: null
        };
        
        this.isPlaying = false;
        this._volumeProxy = { value: 0 };
        this._sessionId = 0;  // Se incrementa en stopInstant para invalidar retries pendientes
    }

    /**
     * Precarga y decodifica las pistas de audio de fondo en paralelo diferido.
     */
    async preload() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            const loadAndDecode = async (filename, key) => {
                const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
                const response = await fetch(`${baseUrl}/audios/inicio/${filename}`);
                const rawBuffer = await response.arrayBuffer();
                
                return new Promise((resolve) => {
                    this.ctx.decodeAudioData(
                        rawBuffer,
                        (decoded) => {
                            this.buffers[key] = decoded;
                            console.log(`[AudioManager] Decodificado: ${filename}`);
                            resolve();
                        },
                        (err) => {
                            console.warn(`[AudioManager] Error decodificando ${filename}:`, err);
                            resolve();
                        }
                    );
                });
            };

            // Precarga paralela diferida de musica uno y musica dos
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => {
                    Promise.all([
                        loadAndDecode('musica uno.mp3', 'uno'),
                        loadAndDecode('musica dos.mp3', 'dos')
                    ]);
                }, { timeout: 3000 });
            } else {
                setTimeout(() => {
                    Promise.all([
                        loadAndDecode('musica uno.mp3', 'uno'),
                        loadAndDecode('musica dos.mp3', 'dos')
                    ]);
                }, 500);
            }

        } catch (e) {
            console.warn('[AudioManager] Error al inicializar audio context / precarga:', e);
        }
    }

    /**
     * Inicia la reproduccion de la secuencia de fondo.
     */
    play() {
        if (this.isPlaying || !this.ctx) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const bgVolume = 0.12; // Volumen minimo pero medio perceptible

        this.isPlaying = true;
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0;
        this.gainNode.connect(this.ctx.destination);

        // Iniciar directamente el loop de musica uno y dos
        this._startInfiniteBackgroundLoop(bgVolume);

        // Fade in inicial
        this._volumeProxy.value = 0;
        this.targetMusicVolume = bgVolume;
        gsap.to(this._volumeProxy, {
            value: bgVolume,
            duration: 2.0,
            ease: 'power2.out',
            onUpdate: () => {
                if (this.gainNode && this.isPlaying) {
                    this.gainNode.gain.value = this._volumeProxy.value;
                }
            }
        });
    }

    /**
     * Reproduce una pista concreta de la secuencia.
     */
    _playTrack(key, targetVolume, onEndedCallback) {
        // Si ya no estamos activos o el contexto fue destruido, ignorar completamente
        if (!this.isPlaying || !this.ctx) return;

        if (!this.buffers[key]) {
            // Buffer not ready yet: retry in 100ms with session guard
            const sessionId = this._sessionId;
            setTimeout(() => {
                if (this._sessionId === sessionId) {
                    this._playTrack(key, targetVolume, onEndedCallback);
                }
            }, 100);
            return;
        }

        // Detener cualquier source previo para evitar solapamiento
        if (this.currentSource) {
            this.currentSource.onended = null; // desconectar callback anterior
            try { this.currentSource.stop(); } catch (_) {}
            this.currentSource = null;
        }

        this._currentKey = key;
        this.targetMusicVolume = targetVolume;
        
        if (this.gainNode) {
            this.gainNode.gain.value = targetVolume;
        }

        this.currentSource = this.ctx.createBufferSource();
        this.currentSource.buffer = this.buffers[key];
        this.currentSource.connect(this.gainNode);
        
        const sessionId = this._sessionId;
        this.currentSource.onended = () => {
            // Only propagate if we are still in the same session (stopInstant was not called)
            if (this.isPlaying && this._sessionId === sessionId && onEndedCallback) {
                onEndedCallback();
            }
        };

        this.currentSource.start(0);
        console.log(`[AudioManager] Reproduciendo: ${key} (Volumen: ${targetVolume})`);
    }

    /**
     * Inicia la alternancia constante entre musica uno y musica dos a volumen minimo.
     */
    _startInfiniteBackgroundLoop(targetVolume = 0.12) {
        const loopUno = () => {
            if (!this.isPlaying) return;
            this._playTrack('uno', targetVolume, () => {
                loopDos();
            });
        };

        const loopDos = () => {
            if (!this.isPlaying) return;
            this._playTrack('dos', targetVolume, () => {
                loopUno();
            });
        };

        // Comenzar con musica uno
        loopUno();
    }

    /**
     * Detiene la reproduccion por completo con un fade-out suave.
     */
    stop() {
        if (!this.isPlaying || !this.gainNode) return;

        gsap.to(this._volumeProxy, {
            value: 0,
            duration: 1.5,
            ease: 'power2.in',
            onUpdate: () => {
                if (this.gainNode) {
                    this.gainNode.gain.value = this._volumeProxy.value;
                }
            },
            onComplete: () => {
                this.isPlaying = false;
                try {
                    this.currentSource?.stop();
                } catch (_) {}
                this.currentSource = null;
            }
        });
    }

    /**
     * Stops playback instantly and destroys the AudioContext to release hardware.
     */
    stopInstant() {
        this._sessionId++;  // Invalida todos los setTimeout de retry pendientes
        this.isPlaying = false;
        try {
            this.currentSource?.stop();
        } catch (_) {}
        this.currentSource = null;
        if (this.ctx) {
            try {
                this.ctx.close();
            } catch (_) {}
            this.ctx = null;
        }
    }

    /**
     * Permite atenuar temporalmente la musica (ducking)
     * @param {number} factor multiplicador del volumen (de 0.0 a 1.0)
     */
    setDuckingFactor(factor) {
        if (!this.isPlaying || !this.gainNode) return;
        const currentTarget = this.targetMusicVolume ?? 0.12;
        this.gainNode.gain.value = currentTarget * factor;
    }
}
