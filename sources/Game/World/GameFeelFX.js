import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * GameFeelFX.js
 *
 * Sistema ligero de micro-partículas 3D y ondas expansivas (solo 2 draw calls con InstancedMesh,
 * sin asignaciones por frame y 100% compatible con WebGPU/WebGL):
 * - Polvo de pisadas al correr y al aterrizar
 * - Salpicaduras y ondas sobre la superficie del agua al entrar/nadar
 * - Ráfaga y estela de chispas durante el Dash / Sprint
 * - Micro-chispas de colores al golpear objetos físicos (</>, letras, etc.)
 */
export class GameFeelFX
{
    constructor()
    {
        this.game = Game.getInstance()

        this.maxParticles = 128
        this.maxRings = 28

        this._dummy = new THREE.Object3D()
        this._tempColor = new THREE.Color()
        this._zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)

        this._particles = []
        this._rings = []
        this._particleCursor = 0
        this._ringCursor = 0
        this._activeParticles = 0
        this._activeRings = 0

        this._initParticles()
        this._initRings()

        this._onTick = this._onTick.bind(this)
        this.game.ticker.events.on('tick', this._onTick, 9)
    }

    _initParticles()
    {
        const geometry = new THREE.IcosahedronGeometry(1, 0)
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff
        })

        this.particleMesh = new THREE.InstancedMesh(geometry, material, this.maxParticles)
        this.particleMesh.name = 'GameFeelFX_Particles'
        this.particleMesh.frustumCulled = false
        this.particleMesh.castShadow = false
        this.particleMesh.receiveShadow = false

        const white = new THREE.Color(0xffffff)
        for(let i = 0; i < this.maxParticles; i++)
        {
            this._particles.push({
                active: false,
                age: 0,
                life: 0.4,
                x: 0, y: 0, z: 0,
                vx: 0, vy: 0, vz: 0,
                gravity: -9.8,
                drag: 2.0,
                scale: 0.1,
                rx: 0, ry: 0, rz: 0,
                vrx: 0, vry: 0, vrz: 0
            })
            this.particleMesh.setMatrixAt(i, this._zeroMatrix)
            this.particleMesh.setColorAt(i, white)
        }

        this.particleMesh.instanceMatrix.needsUpdate = true
        if(this.particleMesh.instanceColor)
            this.particleMesh.instanceColor.needsUpdate = true

        this.game.scene.add(this.particleMesh)
    }

    _initRings()
    {
        const geometry = new THREE.RingGeometry(0.76, 1.0, 24)
        geometry.rotateX(-Math.PI * 0.5)

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        })

        this.ringMesh = new THREE.InstancedMesh(geometry, material, this.maxRings)
        this.ringMesh.name = 'GameFeelFX_Rings'
        this.ringMesh.frustumCulled = false
        this.ringMesh.castShadow = false
        this.ringMesh.receiveShadow = false
        this.ringMesh.renderOrder = 2

        const black = new THREE.Color(0x000000)
        for(let i = 0; i < this.maxRings; i++)
        {
            this._rings.push({
                active: false,
                age: 0,
                life: 0.65,
                x: 0, y: 0, z: 0,
                startRadius: 0.3,
                endRadius: 2.0,
                baseR: 1, baseG: 1, baseB: 1
            })
            this.ringMesh.setMatrixAt(i, this._zeroMatrix)
            this.ringMesh.setColorAt(i, black)
        }

        this.ringMesh.instanceMatrix.needsUpdate = true
        if(this.ringMesh.instanceColor)
            this.ringMesh.instanceColor.needsUpdate = true

        this.game.scene.add(this.ringMesh)
    }

    _spawnParticle(x, y, z, vx, vy, vz, scale, life, colorHex, gravity = -9.8, drag = 2.0)
    {
        const idx = this._particleCursor
        this._particleCursor = (this._particleCursor + 1) % this.maxParticles
        const p = this._particles[idx]

        if(!p.active)
            this._activeParticles++

        p.active = true
        p.age = 0
        p.life = life
        p.x = x
        p.y = y
        p.z = z
        p.vx = vx
        p.vy = vy
        p.vz = vz
        p.gravity = gravity
        p.drag = drag
        p.scale = scale
        p.rx = Math.random() * Math.PI * 2
        p.ry = Math.random() * Math.PI * 2
        p.rz = Math.random() * Math.PI * 2
        p.vrx = (Math.random() - 0.5) * 10
        p.vry = (Math.random() - 0.5) * 10
        p.vrz = (Math.random() - 0.5) * 10

        this._tempColor.setHex(colorHex)
        this.particleMesh.setColorAt(idx, this._tempColor)
        if(this.particleMesh.instanceColor)
            this.particleMesh.instanceColor.needsUpdate = true
    }

    _spawnRing(x, y, z, startRadius, endRadius, life, colorHex, brightness = 0.7)
    {
        const idx = this._ringCursor
        this._ringCursor = (this._ringCursor + 1) % this.maxRings
        const r = this._rings[idx]

        if(!r.active)
            this._activeRings++

        r.active = true
        r.age = 0
        r.life = life
        r.x = x
        r.y = y
        r.z = z
        r.startRadius = startRadius
        r.endRadius = endRadius

        this._tempColor.setHex(colorHex)
        r.baseR = this._tempColor.r * brightness
        r.baseG = this._tempColor.g * brightness
        r.baseB = this._tempColor.b * brightness
    }

    /**
     * Polvo sutil al correr / caminar rápido
     */
    emitFootDust(position, isSprinting = false)
    {
        const count = isSprinting ? 3 : 1
        for(let i = 0; i < count; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const speed = (isSprinting ? 1.4 : 0.7) + Math.random() * 1.1
            this._spawnParticle(
                position.x + (Math.random() - 0.5) * 0.35,
                position.y + 0.08,
                position.z + (Math.random() - 0.5) * 0.35,
                Math.cos(angle) * speed,
                (isSprinting ? 1.1 : 0.6) + Math.random() * 0.8,
                Math.sin(angle) * speed,
                (isSprinting ? 0.11 : 0.075) + Math.random() * 0.045,
                0.30 + Math.random() * 0.18,
                i % 2 === 0 ? 0xf5ecd9 : 0xe4d7bf,
                -1.8,
                3.5
            )
        }
    }

    /**
     * Anillo de polvo al aterrizar de un salto
     */
    emitLandingDust(position, intensity = 1.0)
    {
        const clamped = Math.min(Math.max(intensity, 0.4), 1.4)
        const count = Math.round(7 + clamped * 5)
        for(let i = 0; i < count; i++)
        {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
            const speed = (1.8 + Math.random() * 1.8) * clamped
            this._spawnParticle(
                position.x + Math.cos(angle) * 0.25,
                position.y + 0.09,
                position.z + Math.sin(angle) * 0.25,
                Math.cos(angle) * speed,
                (0.9 + Math.random() * 1.1) * clamped,
                Math.sin(angle) * speed,
                (0.11 + Math.random() * 0.06) * clamped,
                0.35 + Math.random() * 0.20,
                i % 2 === 0 ? 0xf7efe0 : 0xdfd1b8,
                -2.2,
                3.8
            )
        }

        this._spawnRing(
            position.x,
            position.y + 0.05,
            position.z,
            0.35,
            1.65 * clamped,
            0.38,
            0xfff2d6,
            0.35 * clamped
        )
    }

    /**
     * Ráfaga de impulso al activar Dash
     */
    emitDashBurst(position, forwardDir)
    {
        const bx = forwardDir ? -forwardDir.x : 0
        const bz = forwardDir ? -forwardDir.z : -1

        for(let i = 0; i < 12; i++)
        {
            const spreadX = (Math.random() - 0.5) * 2.6
            const spreadZ = (Math.random() - 0.5) * 2.6
            const backSpeed = 3.2 + Math.random() * 4.2
            this._spawnParticle(
                position.x + (Math.random() - 0.5) * 0.5,
                position.y + 0.45 + (Math.random() - 0.5) * 0.7,
                position.z + (Math.random() - 0.5) * 0.5,
                bx * backSpeed + spreadX,
                0.8 + Math.random() * 1.6,
                bz * backSpeed + spreadZ,
                0.08 + Math.random() * 0.06,
                0.28 + Math.random() * 0.18,
                i % 3 === 0 ? 0xffffff : 0x38d9ff,
                -1.5,
                4.2
            )
        }

        this._spawnRing(
            position.x,
            position.y + 0.1,
            position.z,
            0.35,
            2.15,
            0.36,
            0x38d9ff,
            0.75
        )
    }

    /**
     * Estela continua de chispas durante el Dash
     */
    emitDashTrail(position, forwardDir)
    {
        const bx = forwardDir ? -forwardDir.x : 0
        const bz = forwardDir ? -forwardDir.z : -1

        for(let i = 0; i < 2; i++)
        {
            this._spawnParticle(
                position.x + (Math.random() - 0.5) * 0.45,
                position.y + 0.35 + Math.random() * 0.9,
                position.z + (Math.random() - 0.5) * 0.45,
                bx * (1.8 + Math.random() * 1.8) + (Math.random() - 0.5) * 0.8,
                0.3 + Math.random() * 0.6,
                bz * (1.8 + Math.random() * 1.8) + (Math.random() - 0.5) * 0.8,
                0.065 + Math.random() * 0.035,
                0.22 + Math.random() * 0.10,
                i === 0 ? 0x38d9ff : 0xc8f4ff,
                -0.8,
                3.5
            )
        }
    }

    /**
     * Salpicaduras de gotas y ondas sobre el agua
     */
    emitWaterSplash(position, intensity = 1.0)
    {
        const clamped = Math.min(Math.max(intensity, 0.3), 1.4)
        const count = Math.round(5 + clamped * 9)
        const waterY = this.game.water?.surfaceElevation ?? position.y

        for(let i = 0; i < count; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const speed = (1.1 + Math.random() * 2.4) * clamped
            this._spawnParticle(
                position.x + (Math.random() - 0.5) * 0.4,
                waterY + 0.08,
                position.z + (Math.random() - 0.5) * 0.4,
                Math.cos(angle) * speed,
                (2.6 + Math.random() * 3.0) * clamped,
                Math.sin(angle) * speed,
                (0.075 + Math.random() * 0.055) * clamped,
                0.42 + Math.random() * 0.25,
                i % 3 === 0 ? 0xffffff : 0x7ce8ff,
                -14.0,
                1.2
            )
        }

        this._spawnRing(
            position.x,
            waterY + 0.04,
            position.z,
            0.35,
            2.1 * clamped,
            0.68,
            0x9ef0ff,
            0.75 * clamped
        )

        if(clamped >= 0.75)
        {
            this._spawnRing(
                position.x,
                waterY + 0.045,
                position.z,
                0.2,
                1.35 * clamped,
                0.48,
                0xffffff,
                0.55 * clamped
            )
        }
    }

    /**
     * Onda suave en el agua al nadar o caminar en agua poco profunda
     */
    emitWaterRipple(position, scale = 1.0)
    {
        const waterY = this.game.water?.surfaceElevation ?? position.y
        this._spawnRing(
            position.x,
            waterY + 0.035,
            position.z,
            0.32 * scale,
            1.75 * scale,
            0.72,
            0xa8f2ff,
            0.55
        )
    }

    /**
     * Micro-chispas al impactar objetos físicos (</>, letras, cajas, pelotas...)
     */
    emitImpactSparks(position, colorHex = 0x38d9ff, intensity = 1.0)
    {
        const clamped = Math.min(Math.max(intensity, 0.35), 1.3)
        const count = Math.round(5 + clamped * 6)

        for(let i = 0; i < count; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const speed = (2.0 + Math.random() * 3.8) * clamped
            this._spawnParticle(
                position.x + (Math.random() - 0.5) * 0.35,
                position.y + (Math.random() - 0.5) * 0.35,
                position.z + (Math.random() - 0.5) * 0.35,
                Math.cos(angle) * speed,
                (1.8 + Math.random() * 3.0) * clamped,
                Math.sin(angle) * speed,
                (0.065 + Math.random() * 0.045) * clamped,
                0.28 + Math.random() * 0.22,
                i % 3 === 0 ? 0xffffff : colorHex,
                -11.5,
                2.4
            )
        }
    }

    _onTick()
    {
        const delta = Math.min(this.game.ticker.deltaScaled || 1 / 60, 0.05)

        if(this._activeParticles > 0)
        {
            for(let i = 0; i < this.maxParticles; i++)
            {
                const p = this._particles[i]
                if(!p.active)
                    continue

                p.age += delta
                if(p.age >= p.life)
                {
                    p.active = false
                    this._activeParticles--
                    this.particleMesh.setMatrixAt(i, this._zeroMatrix)
                    continue
                }

                const damp = Math.max(0, 1 - p.drag * delta)
                p.vx *= damp
                p.vz *= damp
                p.vy += p.gravity * delta

                p.x += p.vx * delta
                p.y += p.vy * delta
                p.z += p.vz * delta

                p.rx += p.vrx * delta
                p.ry += p.vry * delta
                p.rz += p.vrz * delta

                const progress = p.age / p.life
                // Entrada rápida y encogimiento suave hasta 0
                const scaleFactor = progress < 0.12
                    ? progress / 0.12
                    : Math.pow(1 - (progress - 0.12) / 0.88, 1.35)
                const s = Math.max(0.0001, p.scale * scaleFactor)

                this._dummy.position.set(p.x, p.y, p.z)
                this._dummy.rotation.set(p.rx, p.ry, p.rz)
                this._dummy.scale.setScalar(s)
                this._dummy.updateMatrix()
                this.particleMesh.setMatrixAt(i, this._dummy.matrix)
            }

            this.particleMesh.instanceMatrix.needsUpdate = true
        }

        if(this._activeRings > 0)
        {
            for(let i = 0; i < this.maxRings; i++)
            {
                const r = this._rings[i]
                if(!r.active)
                    continue

                r.age += delta
                if(r.age >= r.life)
                {
                    r.active = false
                    this._activeRings--
                    this.ringMesh.setMatrixAt(i, this._zeroMatrix)
                    this._tempColor.setRGB(0, 0, 0)
                    this.ringMesh.setColorAt(i, this._tempColor)
                    continue
                }

                const progress = r.age / r.life
                const easeOut = 1 - Math.pow(1 - progress, 2.2)
                const radius = r.startRadius + (r.endRadius - r.startRadius) * easeOut
                const fade = Math.pow(1 - progress, 1.8)

                this._dummy.position.set(r.x, r.y, r.z)
                this._dummy.rotation.set(0, 0, 0)
                this._dummy.scale.set(radius, 1, radius)
                this._dummy.updateMatrix()
                this.ringMesh.setMatrixAt(i, this._dummy.matrix)

                this._tempColor.setRGB(r.baseR * fade, r.baseG * fade, r.baseB * fade)
                this.ringMesh.setColorAt(i, this._tempColor)
            }

            this.ringMesh.instanceMatrix.needsUpdate = true
            if(this.ringMesh.instanceColor)
                this.ringMesh.instanceColor.needsUpdate = true
        }
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this._onTick)

        if(this.particleMesh)
        {
            this.game.scene.remove(this.particleMesh)
            this.particleMesh.geometry.dispose()
            this.particleMesh.material.dispose()
        }

        if(this.ringMesh)
        {
            this.game.scene.remove(this.ringMesh)
            this.ringMesh.geometry.dispose()
            this.ringMesh.material.dispose()
        }
    }
}
