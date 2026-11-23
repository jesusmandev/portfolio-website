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

    /**
     * Paso chapoteando en agua poco profunda
     */
    playWaterStep(isRunning = false)
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime
        const duration = isRunning ? 0.14 : 0.10
        const bufferSize = Math.floor(this._ctx.sampleRate * duration)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            const env = Math.sin((i / bufferSize) * Math.PI) * Math.pow(1 - i / bufferSize, 0.9)
            data[i] = (Math.random() * 2 - 1) * env
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime((isRunning ? 1500 : 1200) + Math.random() * 400, now)
        filter.frequency.exponentialRampToValueAtTime(550, now + duration)
        filter.Q.value = 1.4

        const gain = this._ctx.createGain()
        gain.gain.setValueAtTime(isRunning ? 0.24 : 0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this._ctx.destination)
        noise.start(now)

        // Pequeña burbuja/gota líquida
        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()
        const f0 = (isRunning ? 360 : 300) + Math.random() * 140
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f0, now)
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.9, now + 0.045)

        oscGain.gain.setValueAtTime(isRunning ? 0.08 : 0.05, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.055)
    }

    /**
     * Salpicadura al entrar al agua o aterrizar en zona inundada
     */
    playWaterSplash(intensity = 1.0)
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime
        const clamped = Math.min(Math.max(intensity, 0.25), 1.2)
        const duration = 0.26 + clamped * 0.14
        const bufferSize = Math.floor(this._ctx.sampleRate * duration)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            const t = i / bufferSize
            const env = Math.min(1, t * 14) * Math.pow(1 - t, 1.4)
            data[i] = (Math.random() * 2 - 1) * env
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1400 + Math.random() * 350, now)
        filter.frequency.exponentialRampToValueAtTime(380, now + duration)
        filter.Q.value = 0.9

        const gain = this._ctx.createGain()
        gain.gain.setValueAtTime(0.32 * clamped, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this._ctx.destination)
        noise.start(now)

        // Plop grave de inmersión
        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.09)

        oscGain.gain.setValueAtTime(0.14 * clamped, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.12)
    }

    /**
     * Brazada suave al nadar sobre el agua
     */
    playSwimStroke(isSprinting = false)
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime
        const duration = isSprinting ? 0.20 : 0.26
        const bufferSize = Math.floor(this._ctx.sampleRate * duration)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            const t = i / bufferSize
            const env = Math.sin(t * Math.PI)
            data[i] = (Math.random() * 2 - 1) * env
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(520 + Math.random() * 140, now)
        filter.frequency.linearRampToValueAtTime(isSprinting ? 1350 : 1050, now + duration * 0.45)
        filter.frequency.exponentialRampToValueAtTime(420, now + duration)
        filter.Q.value = 1.6

        const gain = this._ctx.createGain()
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.linearRampToValueAtTime(isSprinting ? 0.19 : 0.13, now + duration * 0.3)
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this._ctx.destination)
        noise.start(now)
    }

    /**
     * Sonido de ráfaga de aire al hacer Dash / arranque de Sprint
     */
    playDashSound()
    {
        if(!this._initCtx())
            return

        const now = this._ctx.currentTime
        const duration = 0.22
        const bufferSize = Math.floor(this._ctx.sampleRate * duration)
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < bufferSize; i++)
        {
            const t = i / bufferSize
            const env = Math.min(1, t * 18) * Math.pow(1 - t, 1.7)
            data[i] = (Math.random() * 2 - 1) * env
        }

        const noise = this._ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(650, now)
        filter.frequency.exponentialRampToValueAtTime(2800, now + 0.07)
        filter.frequency.exponentialRampToValueAtTime(480, now + duration)
        filter.Q.value = 1.1

        const noiseGain = this._ctx.createGain()
        noiseGain.gain.setValueAtTime(0.26, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(this._ctx.destination)
        noise.start(now)

        // Impulso tonal sutil que da sensación de velocidad
        const osc = this._ctx.createOscillator()
        const oscGain = this._ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(190, now)
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.08)
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.18)

        oscGain.gain.setValueAtTime(0.11, now)
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19)

        osc.connect(oscGain)
        oscGain.connect(this._ctx.destination)
        osc.start(now)
        osc.stop(now + 0.2)
    }

    /**
     * Mugido suave y cálido de vaca ("Muuu") con volumen atenuado por distancia
     */
    playCowMoo(volumeScale = 0.5, pitchMod = 1.0)
    {
        if(!this._initCtx())
            return

        const vol = Math.min(Math.max(volumeScale, 0.03), 1.0)
        if(vol < 0.04)
            return

        const now = this._ctx.currentTime
        const duration = 0.85 + Math.random() * 0.35

        // Oscilador principal (sawtooth filtrado = timbre vocal bovino cálido)
        const osc = this._ctx.createOscillator()
        const subOsc = this._ctx.createOscillator()
        const filter = this._ctx.createBiquadFilter()
        const gain = this._ctx.createGain()

        const baseFreq = (118 + Math.random() * 20) * pitchMod
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(baseFreq * 0.86, now)
        osc.frequency.linearRampToValueAtTime(baseFreq * 1.12, now + duration * 0.28)
        osc.frequency.linearRampToValueAtTime(baseFreq * 0.96, now + duration * 0.72)
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, now + duration)

        subOsc.type = 'triangle'
        subOsc.frequency.setValueAtTime(baseFreq * 0.5, now)
        subOsc.frequency.linearRampToValueAtTime(baseFreq * 0.56, now + duration * 0.28)
        subOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.38, now + duration)

        // Formante vocal ("mm-uuu")
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(260, now)
        filter.frequency.linearRampToValueAtTime(620, now + duration * 0.32)
        filter.frequency.exponentialRampToValueAtTime(220, now + duration)
        filter.Q.value = 3.2

        gain.gain.setValueAtTime(0.001, now)
        gain.gain.linearRampToValueAtTime(0.16 * vol, now + 0.12)
        gain.gain.setValueAtTime(0.14 * vol, now + duration * 0.65)
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

        osc.connect(filter)
        subOsc.connect(filter)
        filter.connect(gain)
        gain.connect(this._ctx.destination)

        osc.start(now)
        subOsc.start(now)
        osc.stop(now + duration + 0.03)
        subOsc.stop(now + duration + 0.03)
    }
}
