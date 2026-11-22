import * as THREE from 'three/webgpu'
import { color, uniform, vec2, Fn, dot, min, clamp } from 'three/tsl'
import { Game } from './Game.js'
import gsap from 'gsap'

const sdSegment = Fn(([ p, a, b ]) =>
{
    const pa = p.sub(a)
    const ba = b.sub(a)
    const h = dot(pa, ba).div(dot(ba, ba)).clamp(0, 1)
    return pa.sub(ba.mul(h)).length()
})

export const distanceToLetterJ = Fn(([ worldXZ, centerXZ ]) =>
{
    const diff = worldXZ.sub(centerXZ)
    const SQRT2_INV = 0.70710678
    // Invertir rotación isométrica de la cámara para alinear la J de frente a la pantalla
    const lx = diff.x.sub(diff.y).mul(SQRT2_INV)
    const ly = diff.x.add(diff.y).mul(-SQRT2_INV)
    const p = vec2(lx, ly)

    const d0 = sdSegment(p, vec2(-2.6, 2.2), vec2(1.8, 2.2))
    const d1 = sdSegment(p, vec2(0.8, 2.2), vec2(0.8, -0.6))
    const d2 = sdSegment(p, vec2(0.8, -0.6), vec2(0.4, -1.8))
    const d3 = sdSegment(p, vec2(0.4, -1.8), vec2(-0.7, -2.1))
    const d4 = sdSegment(p, vec2(-0.7, -2.1), vec2(-1.8, -1.3))
    const d5 = sdSegment(p, vec2(-1.8, -1.3), vec2(-1.8, -0.1))

    return min(d0, min(d1, min(d2, min(d3, min(d4, d5)))))
})

export class Reveal
{
    constructor()
    {
        this.game = Game.getInstance()
        
        this.step = -1
        const respawn = this.game.respawns.getDefault()
        this.position = respawn.position.clone()
        this.position2Uniform = uniform(vec2(this.position.x, this.position.z))
        this.distance = uniform(0)
        this.thickness = uniform(0.08)
        this.color = uniform(color('#e88eff'))
        this.intensity = uniform(5.5)
        this.intensityMultiplier = 1
        this.sound = this.game.audio.register({
            path: 'sounds/reveal/reveal-1.mp3',
            autoplay: false,
            loop: false,
            volume: 0.5,
            preload: true
        })

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '📜 Reveal',
                expanded: false,
            })

            this.debugPanel.addBinding(this.distance, 'value', { label: 'distance', min: 0, max: 20, step: 0.01 })
            this.debugPanel.addBinding(this.thickness, 'value', { label: 'thickness', min: 0, max: 1, step: 0.001 })
            // this.game.debug.addThreeColorBinding(this.debugPanel, this.color.value, 'color')
            this.debugPanel.addBinding(this.intensity, 'value', { label: 'intensity', min: 1, max: 20, step: 0.001 })
        }

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 10)
    }

    updateStep(step)
    {
        const speedMultiplier = location.hash.match(/skip/i) ? 4 : 1

        // Step 0
        if(step === 0)
        {
            // Intro loader => Hide circle
            this.game.world.intro.circle.hide(() =>
            {
                // Grid
                this.game.world.grid.show()

                // Reveal (abre la silueta en forma de J)
                this.distance.value = 0

                gsap.to(
                    this.distance,
                    {
                        value: 1.6,
                        ease: 'back.out(1.7)',
                        duration: 2 / speedMultiplier,
                        overwrite: true,
                    }
                )

                // View
                this.game.view.zoom.smoothedRatio = 0.6
                this.game.view.zoom.baseRatio = 0.6

                gsap.to(
                    this.game.view.zoom,
                    {
                        baseRatio: 0.3,
                        // smoothedRatio: 0.4,
                        ease: 'power1.inOut',
                        duration: 1.25 / speedMultiplier,
                        overwrite: true,
                    }
                )

                // Intro loader => Show label and sound button
                this.game.world.intro.setText()
                this.game.world.intro.setSoundButton()
                this.game.ticker.wait(1, () =>
                {
                    this.game.world.intro.showLabel()
                })

                // Trees
                if(this.game.world.cherryTrees)
                    this.game.world.cherryTrees.leaves.seeThroughMultiplier = 1.0
                if(this.game.world.startBlueTree)
                    this.game.world.startBlueTree.leaves.seeThroughMultiplier = 1.0

                // Click
                if(location.hash.match(/skip/i))
                {
                    this.updateStep(1)
                }
                else
                {
                    // Next function
                    const next = () =>
                    {
                        this.updateStep(1)
                        this.game.inputs.events.off('introStart', inputCallback)
                        this.game.rayCursor.removeIntersect(intersect)
                    }

                    // Input callback
                    const inputCallback = () =>
                    {
                        next()
                    }

                    // Intsect
                    const position = this.position.clone()
                    position.y = 0
                    
                    const intersect = this.game.rayCursor.addIntersect({
                        active: true,
                        shape: new THREE.Sphere(position, 3.5),
                        onClick: next,
                        onEnter: () =>
                        {
                            gsap.to(this, { intensityMultiplier: 1.22, duration: 0.2, overwrite: true })
                        },
                        onLeave: () =>
                        {
                            gsap.to(this, { intensityMultiplier: 1, duration: 0.2, overwrite: true })
                        }
                    })
                    
                    // Inputs (for gamepad and keyboard)
                    this.game.inputs.addActions([
                        { name: 'introStart', categories: [ 'intro' ], keys: [ 'Gamepad.cross', 'Keyboard.Enter', 'Keyboard.ArrowUp', 'Keyboard.ArrowDown', 'Keyboard.KeyW', 'Keyboard.KeyD' ] },
                    ])

            // { name: 'forward',               categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowUp', 'Keyboard.KeyW', 'Gamepad.up', 'Gamepad.r2' ] },
            // { name: 'right',                 categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowRight', 'Keyboard.KeyD', 'Gamepad.right' ] },
                    this.game.inputs.events.on('introStart', inputCallback)
                }
            })
        }
        else if(step === 1)
        {
            // Audio
            this.game.audio.init()
            this.sound.play()

            // Reveal
            gsap.to(
                this.distance,
                {
                    value: 30,
                    ease: 'back.in(1.3)',
                    duration: 2 / speedMultiplier,
                    overwrite: true,
                    onComplete: () =>
                    {
                        this.distance.value = 99999
                    }
                }
            )

            // Intro loader => Hide label
            this.game.world.intro.hideLabel()

            // Inputs
            this.game.inputs.filters.clear()
            this.game.inputs.filters.add('wandering')

            // View
            this.game.view.focusPoint.isTracking = true
            this.game.view.focusPoint.magnet.active = false

            // View
            gsap.to(
                this.game.view.zoom,
                {
                    baseRatio: 0,
                    // smoothedRatio: 0,
                    ease: 'back.in(1.5)',
                    duration: 1.75 / speedMultiplier,
                    overwrite: true,
                    onComplete: () =>
                    {
                        this.updateStep(2)
                    }
                }
            )

            // Cherry trees & Start Blue tree
            if(this.game.world.cherryTrees)
            {
                gsap.to(
                    this.game.world.cherryTrees.leaves,
                    {
                        seeThroughMultiplier: 1,
                        ease: 'power1.inOut',
                        duration: 2 / speedMultiplier,
                        overwrite: true
                    }
                )
            }
            if(this.game.world.startBlueTree)
            {
                gsap.to(
                    this.game.world.startBlueTree.leaves,
                    {
                        seeThroughMultiplier: 1,
                        ease: 'power1.inOut',
                        duration: 2 / speedMultiplier,
                        overwrite: true
                    }
                )
            }
        }
        else if(step === 2)
        {
            this.game.interactivePoints.recover()
            
            this.game.world.step(2)
            this.game.world.grid.destroy()
            this.game.world.intro.destroy()
            this.game.world.intro = null

            this.game.overlay.moveOnTop()

            this.game.server.start()

            this.game.menu.preopen()

            this.game.ticker.events.off('tick', this.update)
        }

        this.step = step
    }

    update()
    {
        this.color.value.copy(this.game.dayCycles.properties.revealColor.value)
        this.intensity.value = this.game.dayCycles.properties.revealIntensity.value * this.intensityMultiplier
    }
}