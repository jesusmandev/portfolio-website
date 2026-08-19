/**
 * TransitionManager — controla los overlays de fade entre escenas.
 *
 * Usa GSAP para animar el overlay #transition-overlay del DOM.
 * opacity: 1 = pantalla negra | opacity: 0 = transparente.
 */
import gsap from 'gsap';

export class TransitionManager {
    constructor() {
        this.overlay = document.getElementById('transition-overlay');
        if (!this.overlay) {
            console.error('[TransitionManager] #transition-overlay not found in DOM.');
        }
    }

    /**
     * Hace fade hacia negro.
     * @param {number} duration  segundos
     * @returns {Promise<void>}
     */
    fadeToBlack(duration = 0.8) {
        return new Promise(resolve => {
            if (!this.overlay) { resolve(); return; }
            this.overlay.style.pointerEvents = 'all';
            gsap.to(this.overlay, {
                opacity: 1,
                duration,
                ease: 'power2.inOut',
                onComplete: resolve
            });
        });
    }

    /**
     * Hace fade desde negro a transparente.
     * @param {number} duration  segundos
     * @returns {Promise<void>}
     */
    fadeFromBlack(duration = 1.2) {
        return new Promise(resolve => {
            if (!this.overlay) { resolve(); return; }
            gsap.to(this.overlay, {
                opacity: 0,
                duration,
                ease: 'power2.inOut',
                onComplete: () => {
                    this.overlay.style.pointerEvents = 'none';
                    resolve();
                }
            });
        });
    }

    /** Sets the black overlay instantly (no animation). */
    setBlackInstant() {
        if (!this.overlay) return;
        gsap.set(this.overlay, { opacity: 1 });
        this.overlay.style.pointerEvents = 'all';
    }

    /** Sets the transparent overlay instantly (no animation). */
    setClearInstant() {
        if (!this.overlay) return;
        gsap.set(this.overlay, { opacity: 0 });
        this.overlay.style.pointerEvents = 'none';
    }
}
