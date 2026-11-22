/**
 * Robot.js — Robot Low Poly 3D para Folio 2025.
 * Adaptado de c:\proyectos\frontend-portfolio\src\game\src\Game\assets\Robot.js
 */

import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import gsap from 'gsap'

// ─────────────────────────────────────────────────────────────────
//  MATERIALES COMPARTIDOS (Optimización para cero lag)
// ─────────────────────────────────────────────────────────────────
const _matGreyLight = new THREE.MeshStandardMaterial({
    color: 0xdcdcdc,
    roughness: 0.5,
    metalness: 0.2,
    flatShading: true
})

const _matBlueGrey = new THREE.MeshStandardMaterial({
    color: 0x6a8799,
    roughness: 0.5,
    metalness: 0.3,
    flatShading: true
})

const _matDarkGrey = new THREE.MeshStandardMaterial({
    color: 0x2b3e50,
    roughness: 0.6,
    metalness: 0.3,
    flatShading: true
})

const _matBlack = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: true
})

const _matYellow = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xfacc15,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.4,
    flatShading: true
})

function createCylinder(radiusTop, radiusBottom, height, radialSegments, material)
{
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    const mesh = new THREE.Mesh(geo, material)
    mesh.castShadow = true
    mesh.receiveShadow = false
    return mesh
}

function createBox(width, height, depth, material)
{
    const geo = new THREE.BoxGeometry(width, height, depth)
    const mesh = new THREE.Mesh(geo, material)
    mesh.castShadow = true
    mesh.receiveShadow = false
    return mesh
}

export class Robot3D
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.x = options.x ?? 52.75
        this.y = options.y ?? 0.05
        this.z = options.z ?? -11.10
        this.scale = options.scale ?? 0.65
        this.rotationY = options.rotationY ?? 2.45 // Orientado hacia el camino de entrada

        this._time = 0
        this._headMesh = null
        this._eyeLens = null
        this._chestButton = null
        this._rightArmPivot = null
        this._torsoGroup = null

        // Grupo raíz
        this.group = new THREE.Group()
        this.group.name = 'Robot3D'
        this.group.position.set(this.x, this.y, this.z)
        this.group.scale.setScalar(this.scale)
        this.group.rotation.y = this.rotationY

        this._build()
        this._buildPhysics()

        this.game.scene.add(this.group)
    }

    _build()
    {
        // Subgrupo para desplazar la base de los pies al suelo
        const bodyOffset = new THREE.Group()
        bodyOffset.position.y = 3.82
        this.group.add(bodyOffset)

        // ── 1. Cabeza ──────────────────────────────────────────
        const head = createCylinder(1.6, 1.5, 3.5, 12, _matGreyLight)
        head.position.y = 11.5
        bodyOffset.add(head)
        this._headMesh = head

        // Ojo
        const eyeBase = createCylinder(0.7, 0.7, 0.2, 12, _matBlack)
        eyeBase.rotation.x = Math.PI / 2
        eyeBase.position.set(0, 0, 1.5)
        head.add(eyeBase)

        const eyeLens = createCylinder(0.5, 0.5, 0.1, 12, _matYellow)
        eyeLens.rotation.x = Math.PI / 2
        eyeLens.position.set(0, 0, 1.6)
        head.add(eyeLens)
        this._eyeLens = eyeLens

        // Cuello
        const neck = createCylinder(0.8, 0.8, 1, 8, _matBlack)
        neck.position.y = 9.5
        bodyOffset.add(neck)

        // ── 2. Torso Principal ─────────────────────────────────
        const torsoGroup = new THREE.Group()
        torsoGroup.position.y = 7.5
        bodyOffset.add(torsoGroup)
        this._torsoGroup = torsoGroup

        const upperTorso = createCylinder(2, 1.8, 3.5, 12, _matBlueGrey)
        torsoGroup.add(upperTorso)

        const chestDetailBase = createBox(0.8, 0.8, 0.2, _matDarkGrey)
        chestDetailBase.position.set(0, -0.5, 1.8)
        torsoGroup.add(chestDetailBase)

        const chestDetailButton = createCylinder(0.2, 0.2, 0.1, 8, _matYellow)
        chestDetailButton.rotation.x = Math.PI / 2
        chestDetailButton.position.set(0, -0.5, 1.95)
        torsoGroup.add(chestDetailButton)
        this._chestButton = chestDetailButton

        const waistRing = createCylinder(1.9, 1.9, 0.6, 12, _matBlack)
        waistRing.position.y = -2
        torsoGroup.add(waistRing)

        const pelvis = createCylinder(1.7, 1.0, 1.5, 12, _matDarkGrey)
        pelvis.position.y = -3
        torsoGroup.add(pelvis)

        // ── 3. Brazos ──────────────────────────────────────────
        const createArm = (isLeft) =>
        {
            const sign = isLeft ? -1 : 1

            const shoulderJoint = createCylinder(0.7, 0.7, 1.2, 12, _matBlueGrey)
            shoulderJoint.rotation.z = Math.PI / 2
            shoulderJoint.position.set(sign * 2.3, 8.5, 0)
            bodyOffset.add(shoulderJoint)

            const shoulderRing = createCylinder(0.9, 0.9, 0.4, 12, _matBlueGrey)
            shoulderRing.rotation.z = Math.PI / 2
            shoulderRing.position.set(sign * 2.6, 8.5, 0)
            bodyOffset.add(shoulderRing)

            const upperArmPivot = new THREE.Group()
            upperArmPivot.position.set(sign * 2.6, 8.5, 0)
            bodyOffset.add(upperArmPivot)

            if(!isLeft)
            {
                this._rightArmPivot = upperArmPivot
            }

            const upperArm = createCylinder(0.5, 0.5, 2.5, 8, _matGreyLight)
            upperArm.position.y = -1.25
            upperArmPivot.add(upperArm)

            const elbowJoint = createCylinder(0.6, 0.6, 0.8, 12, _matBlueGrey)
            elbowJoint.rotation.z = Math.PI / 2
            elbowJoint.position.set(0, -2.5, 0)
            upperArmPivot.add(elbowJoint)

            const lowerArmPivot = new THREE.Group()
            lowerArmPivot.position.copy(elbowJoint.position)
            upperArmPivot.add(lowerArmPivot)

            const lowerArm = createCylinder(0.4, 0.4, 2.5, 8, _matDarkGrey)
            lowerArm.position.y = -1.25
            lowerArmPivot.add(lowerArm)

            const handGroup = new THREE.Group()
            handGroup.position.y = -2.8
            lowerArmPivot.add(handGroup)

            const wrist = createCylinder(0.5, 0.5, 0.4, 8, _matBlack)
            handGroup.add(wrist)

            const finger1 = createBox(0.3, 0.8, 0.3, _matBlack)
            finger1.position.set(-0.3, -0.6, 0)
            finger1.rotation.z = Math.PI / 8
            handGroup.add(finger1)

            const finger2 = createBox(0.3, 0.8, 0.3, _matBlack)
            finger2.position.set(0.3, -0.6, 0)
            finger2.rotation.z = -Math.PI / 8
            handGroup.add(finger2)

            upperArmPivot.rotation.x = -Math.PI / 12
            upperArmPivot.rotation.z = sign * (Math.PI / 16)
            lowerArmPivot.rotation.x = -Math.PI / 10
        }

        createArm(true)
        createArm(false)

        // ── 4. Piernas ─────────────────────────────────────────
        const createLeg = (isLeft) =>
        {
            const sign = isLeft ? -1 : 1

            const hipJoint = createCylinder(0.6, 0.6, 0.8, 12, _matBlueGrey)
            hipJoint.rotation.x = Math.PI / 2
            hipJoint.position.set(sign * 1.0, 4.0, 0)
            bodyOffset.add(hipJoint)

            const thighPivot = new THREE.Group()
            thighPivot.position.copy(hipJoint.position)
            thighPivot.rotation.z = sign * (Math.PI / 16)
            bodyOffset.add(thighPivot)

            const thigh = createCylinder(0.5, 0.5, 3.5, 8, _matGreyLight)
            thigh.position.y = -1.75
            thighPivot.add(thigh)

            const kneeJoint = createCylinder(0.6, 0.6, 0.8, 12, _matBlueGrey)
            kneeJoint.rotation.x = Math.PI / 2
            kneeJoint.position.set(0, -3.5, 0)
            thighPivot.add(kneeJoint)

            const calfPivot = new THREE.Group()
            calfPivot.position.copy(kneeJoint.position)
            thighPivot.add(calfPivot)

            const calf = createCylinder(0.4, 0.5, 3.0, 8, _matGreyLight)
            calf.position.y = -1.5
            calfPivot.add(calf)

            const ankleRing = createCylinder(0.6, 0.6, 0.4, 8, _matBlack)
            ankleRing.position.y = -3.2
            calfPivot.add(ankleRing)

            const footGeo = new THREE.BoxGeometry(1.2, 1.0, 2.0)
            const posAttr = footGeo.attributes.position
            for(let i = 0; i < posAttr.count; i++)
            {
                if(posAttr.getY(i) > 0)
                {
                    posAttr.setZ(i, posAttr.getZ(i) - 0.5)
                    posAttr.setX(i, posAttr.getX(i) * 0.8)
                }
            }
            footGeo.computeVertexNormals()

            const foot = new THREE.Mesh(footGeo, _matBlueGrey)
            foot.castShadow = true
            foot.receiveShadow = false
            foot.position.set(0, -3.9, 0.3)
            calfPivot.add(foot)
        }

        createLeg(true)
        createLeg(false)
    }

    _buildPhysics()
    {
        if(!this.game.physics) return

        try
        {
            const bodyRadius = 2.4 * this.scale
            const bodyHeight = 15.5 * this.scale

            this.physical = this.game.physics.getPhysical({
                type: 'fixed',
                position: new THREE.Vector3(this.x, this.y, this.z),
                colliders: [
                    {
                        shape: 'cylinder',
                        parameters: [ bodyHeight * 0.5, bodyRadius ], // halfHeight, radius
                        position: new THREE.Vector3(0, bodyHeight * 0.5, 0),
                        category: 'object',
                        friction: 0.6,
                        restitution: 0.1
                    }
                ]
            })
        }
        catch(e)
        {
            console.warn('[Robot3D] Physics creation skipped:', e)
        }
    }

    /**
     * Animación de saludo del robot cuando el jugador interactúa
     */
    salute()
    {
        if(!this._rightArmPivot) return

        const tl = gsap.timeline()
        tl.to(this._rightArmPivot.rotation, {
            x: -Math.PI * 0.7,
            z: Math.PI * 0.3,
            duration: 0.4,
            ease: 'back.out(1.5)'
        })
        tl.to(this._rightArmPivot.rotation, {
            z: Math.PI * 0.15,
            duration: 0.2,
            repeat: 3,
            yoyo: true,
            ease: 'sine.inOut'
        })
        tl.to(this._rightArmPivot.rotation, {
            x: -Math.PI / 12,
            z: Math.PI / 16,
            duration: 0.5,
            ease: 'power2.out'
        })

        // Destello rápido en el ojo
        gsap.to(_matYellow, {
            emissiveIntensity: 2.5,
            duration: 0.15,
            repeat: 3,
            yoyo: true
        })
    }

    /**
     * Update loop (animación sutil de respiración y escaneo de cabeza)
     */
    update(delta = 0.016)
    {
        this._time += delta

        // Escaneo suave de la cabeza de lado a lado
        if(this._headMesh)
        {
            this._headMesh.rotation.y = Math.sin(this._time * 0.8) * 0.25
        }

        // Respiración sutil del torso
        if(this._torsoGroup)
        {
            this._torsoGroup.position.y = 7.5 + Math.sin(this._time * 1.5) * 0.06
        }

        // Pulso del ojo y botón amarillo
        if(this._eyeLens && _matYellow)
        {
            _matYellow.emissiveIntensity = 0.6 + Math.sin(this._time * 3.0) * 0.3
        }
    }

    destroy()
    {
        if(this.physical?.body && this.game.physics?.world)
        {
            this.game.physics.world.removeRigidBody(this.physical.body)
        }
        this.group.removeFromParent()
    }
}
