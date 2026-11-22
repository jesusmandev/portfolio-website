import { Game } from './Game.js'

/**
 * ProceduralSound.js
 *
 * Sintetizador de audio procedural nativo usando Web Audio API.
 * Genera sonidos dinámicos de pasos (caminar, correr), salto y aterrizaje.
 */
export class ProceduralSound
{
    constructor()
    {
        this._ctx = null
    }

    _isMuted()
    {
        const game = Game.getInstance()
        return !!(game && game.audio && game.audio.mute && game.audio.mute.active)
    }

    _initCtx()
    {
        if(this._isMuted())
            return false

        if(!this._ctx)
        {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            if(AudioCtx)
                this._ctx = new AudioCtx()
        }

        if(this._ctx && this._ctx.state === 'suspended')
        {
            this._ctx.resume().catch(() => {})
        }

        return !!this._ctx
    }

    playWalkStep()
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime

        // 1. Ruido de fricción de calzado / contacto con el suelo
        const bufferSize = Math.floor(this._ctx.sampleRate * 0.028)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8)
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1600 + Math.random() * 350
        filter.Q.value = 1.6

        const noiseGain = this._ctx.createGain()
        noiseGain.gain.setValueAtTime(0.14 + Math.random() * 0.03, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this._ctx.destination)
        noise.start(now)

        // 2. Impacto de peso / golpe grave
        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()

        const baseFreq = 70 + (Math.random() - 0.5) * 12
        osc.frequency.setValueAtTime(baseFreq, now)
        osc.frequency.exponentialRampToValueAtTime(24, now + 0.038)

        oscGain.gain.setValueAtTime(0.16, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.042)
    }

    playRunStep()
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime

        // 1. Ruido de fricción al correr
        const bufferSize = Math.floor(this._ctx.sampleRate * 0.035)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5)
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 2100 + Math.random() * 450
        filter.Q.value = 1.3

        const noiseGain = this._ctx.createGain()
        noiseGain.gain.setValueAtTime(0.24 + Math.random() * 0.05, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this._ctx.destination)
        noise.start(now)

        // 2. Impacto grave al correr
        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()

        osc.frequency.setValueAtTime(95 + (Math.random() - 0.5) * 15, now)
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.052)

        oscGain.gain.setValueAtTime(0.28, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.052)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.056)
    }

    playJumpSound()
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime

        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(130, now)
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.14)

        oscGain.gain.setValueAtTime(0.22, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.145)
    }

    playLandSound()
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime

        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()

        osc.frequency.setValueAtTime(135, now)
        osc.frequency.exponentialRampToValueAtTime(18, now + 0.085)

        oscGain.gain.setValueAtTime(0.42, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.09)

        const bufferSize = Math.floor(this._ctx.sampleRate * 0.045)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.2)
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1400

        const noiseGain = this._ctx.createGain()
        noiseGain.gain.setValueAtTime(0.28, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this._ctx.destination)
        noise.start(now)
    }

    /**
     * Play 3D Letter Impact Sound (Heavy solid 3D letter hitting the ground)
     * @param {number} intensity - Impact force scaling (0.1 to 1.0)
     * @param {number} pitchMod - Pitch multiplier for character variation (0.8 to 1.2)
     */
    playLetterImpactSound(intensity = 1.0, pitchMod = 1.0)
    {
        if(!this._initCtx()) return
        if(!this._ctx) return

        const now = this._ctx.currentTime
        const clampedIntensity = Math.min(Math.max(intensity, 0.1), 1.0)
        const volume = 0.40 * clampedIntensity

        // 1. Low Thud (Heavy mass impact)
        const lowOsc = this._ctx.createOscillator()
        const lowGain = this._ctx.createGain()

        const startFreq = (160 + Math.random() * 30) * pitchMod
        const endFreq = 28 * pitchMod
        const duration = 0.07 + clampedIntensity * 0.05

        lowOsc.type = 'sine'
        lowOsc.frequency.setValueAtTime(startFreq, now)
        lowOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration)

        lowGain.gain.setValueAtTime(volume, now)
        lowGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

        lowOsc.connect(lowGain)
        lowGain.connect(this._ctx.destination)
        lowOsc.start(now)
        lowOsc.stop(now + duration + 0.01)

        // 2. Mid body punch (Solid material clack/thud)
        const midOsc = this._ctx.createOscillator()
        const midGain = this._ctx.createGain()

        midOsc.type = 'triangle'
        midOsc.frequency.setValueAtTime(230 * pitchMod, now)
        midOsc.frequency.exponentialRampToValueAtTime(45 * pitchMod, now + 0.045)

        midGain.gain.setValueAtTime(volume * 0.65, now)
        midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)

        midOsc.connect(midGain)
        midGain.connect(this._ctx.destination)
        midOsc.start(now)
        midOsc.stop(now + 0.05)

        // 3. Ground contact noise (asphalt/concrete surface friction)
        const bufferSize = Math.floor(this._ctx.sampleRate * 0.038)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5)
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = (1500 + Math.random() * 450) * pitchMod
        filter.Q.value = 1.3

        const noiseGain = this._ctx.createGain()
        noiseGain.gain.setValueAtTime(volume * 0.45, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.036)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this._ctx.destination)
        noise.start(now)
    }
}
