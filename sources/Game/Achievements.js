import { uniform } from 'three/tsl'
import { Events } from './Events.js'

/**
 * Achievements deshabilitados (stub seguro para evitar errores en llamadas legacy).
 */
export class Achievements
{
    constructor()
    {
        this.events = new Events()
        this.groups = new Map()
        this.globalProgress = {
            achieved: false,
            achievedCount: 0,
            totalCount: 0,
            ratioUniform: uniform(0),
            update: () => {},
            reset: () => {},
        }
        this.rewards = {
            items: new Map(),
            current: { name: 'default' },
            default: { name: 'default' },
            set: () => false,
            update: () => {},
        }
        this.storage = {
            save: () => {},
            get: () => ({}),
        }
    }

    setProgress() {}
    addProgress() {}
    reset() {}
}
