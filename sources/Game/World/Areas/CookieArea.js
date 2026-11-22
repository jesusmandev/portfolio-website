import * as THREE from 'three/webgpu'
import { Area } from './Area.js'
import { FerrisWheel } from '../FerrisWheel.js'

export class CookieArea extends Area
{
    constructor(model)
    {
        // Calcular posición exacta donde estaba el horno de galletas antes de limpiar el área
        let centerX = model.position.x - 0.96
        let centerZ = model.position.z - 3.31

        for(const child of [...model.children])
        {
            if(child.name.toLowerCase().includes('cookiephysicalfixed'))
            {
                centerX = model.position.x + child.position.x
                centerZ = model.position.z + child.position.z
            }

            // Conservar únicamente las zonas de referencia (bounding/frustum); eliminar horno, galletas, mesa, soplador y letreros
            const isZoneRef = /^refzone/i.test(child.name)
            if(!isZoneRef)
            {
                child.userData.preventAutoAdd = true
                child.visible = false
                model.remove(child)
            }
        }

        super(model)

        // Mantener siempre visible y girando la Rueda de la Fortuna
        if(this.frustum)
            this.frustum.alwaysVisible = true

        // Crear Rueda de la Fortuna 3D en el lugar exacto del antiguo horno y mesa de galletas
        this.ferrisWheel = new FerrisWheel({
            x: centerX,
            y: 0.0,
            z: centerZ,
            scale: 0.36,
            rotationY: Math.PI * 0.18,
            spinSpeed: 0.45
        })

        this.setAchievement()
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'cookie')
        })
    }

    update()
    {
        if(this.ferrisWheel)
            this.ferrisWheel.update()
    }
}
