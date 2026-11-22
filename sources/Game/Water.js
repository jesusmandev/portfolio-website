import { uniform } from 'three/tsl'
import { Game } from './Game.js'
import { lerp } from './utilities/maths.js'

export class Water
{
    constructor()
    {
        this.game = Game.getInstance()

        this.baseSurfaceElevation = -0.3
        this.maxRainSurfaceElevation = 1.25 // Sube +1.55m (inundación dramática hasta +1.25m de altura al llover)
        this.surfaceElevation = this.baseSurfaceElevation
        this.depthElevation = -1.5

        this.rainRiseRatio = 0
        this.surfaceElevationUniform = uniform(this.surfaceElevation)
        this.surfaceThicknessUniform = uniform(0.013)
        this.rainRiseRatioUniform = uniform(0)

        // Actualizar nivel del agua dinámicamente con la lluvia
        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '💧 Water',
                expanded: false,
            })
            debugPanel.addBinding(this.surfaceElevationUniform, 'value', { label: 'surfaceElevation', min: -1, max: 2.0, step: 0.01 })
            debugPanel.addBinding(this.surfaceThicknessUniform, 'value', { label: 'amplitude', min: 0, max: 0.5, step: 0.001 })
            debugPanel.addBinding(this, 'rainRiseRatio', { label: 'rainRiseRatio', readonly: true })
        }
    }

    update()
    {
        const dt = Math.min(this.game.ticker.deltaScaled || 1 / 60, 0.1)
        const rainIntensity = this.game.weather?.rain?.value ?? 0

        if(rainIntensity > 0.05)
        {
            // Mientras llueve, el nivel de estanques y ríos sube con fuerza y se desborda hacia arriba
            this.rainRiseRatio = Math.min(1, this.rainRiseRatio + dt * 0.065 * rainIntensity)
        }
        else if(this.rainRiseRatio > 0)
        {
            // Al parar la lluvia, el agua drena suavemente de vuelta a su cauce normal (-0.30m)
            this.rainRiseRatio = Math.max(0, this.rainRiseRatio - dt * 0.04)
        }

        this.surfaceElevation = lerp(this.baseSurfaceElevation, this.maxRainSurfaceElevation, this.rainRiseRatio)
        this.surfaceElevationUniform.value = this.surfaceElevation
        this.rainRiseRatioUniform.value = this.rainRiseRatio
    }
}
