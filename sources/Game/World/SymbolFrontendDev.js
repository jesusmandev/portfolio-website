import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * SymbolFrontendDev
 * 
 * Genera el símbolo 3D "</>" flotante optimizado con material polished sky blue.
 * Reutiliza mallas, materiales y geometrías sin fugas de memoria.
 */
export class SymbolFrontendDev
{
    constructor(options = {})
    {
        this.game = Game.getInstance()

        this.position = options.position
            ? new THREE.Vector3(options.position.x, options.position.y, options.position.z)
            : new THREE.Vector3(56.16, 1.35, 47.36)

        this.scale = options.scale ?? 0.18
        this.baseY = this.position.y
        this.baseRotY = options.rotationY ?? (-Math.PI * 0.65) // Orientado hacia el banco y el camino

        this.group = new THREE.Group()
        this.group.name = 'SymbolFrontendDev'
        this.group.position.copy(this.position)
        this.group.scale.setScalar(this.scale)
        this.group.rotation.y = this.baseRotY

        this._createSymbol()
        this.game.scene.add(this.group)

        // Loop de animación flotante
        this._onTick = this._onTick.bind(this)
        this.game.ticker.events.on('tick', this._onTick, 6)
    }

    _createSymbol()
    {
        const COLOR_SKY_BLUE = 0x00c3ff

        // Material pulido optimizado compatible con WebGPU
        const polishedMaterial = new THREE.MeshStandardMaterial({
            color: COLOR_SKY_BLUE,
            roughness: 0.15,
            metalness: 0.35,
            emissive: 0x0077aa,
            emissiveIntensity: 0.45,
            side: THREE.DoubleSide
        })

        const depth = 1.0
        const thickness = 1.2
        const length = 5
        const angle = Math.PI / 4

        const createBracket = (flip) =>
        {
            const shape = new THREE.Shape()
            const innerOffset = thickness / Math.cos(angle)
            const halfLen = length * Math.sin(angle)
            const height = length * Math.cos(angle)

            shape.moveTo(0, 0)
            shape.lineTo(halfLen, height)
            shape.lineTo(halfLen + thickness * Math.cos(angle), height - thickness * Math.sin(angle))
            shape.lineTo(innerOffset, 0)
            shape.lineTo(halfLen + thickness * Math.cos(angle), -height + thickness * Math.sin(angle))
            shape.lineTo(halfLen, -height)
            shape.lineTo(0, 0)

            const extrudeSettings = {
                depth: depth,
                bevelEnabled: true,
                bevelSegments: 2,
                steps: 1,
                bevelSize: 0.06,
                bevelThickness: 0.06
            }

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
            geometry.computeBoundingBox()
            const centerOffset = -0.5 * (geometry.boundingBox.max.z - geometry.boundingBox.min.z)
            geometry.translate(0, 0, centerOffset)

            const mesh = new THREE.Mesh(geometry, polishedMaterial)
            if(flip)
            {
                mesh.rotation.y = Math.PI
            }
            mesh.castShadow = true
            mesh.receiveShadow = true
            return mesh
        }

        // Left Bracket '<'
        const leftBracket = createBracket(false)
        leftBracket.position.x = -7.5
        this.group.add(leftBracket)

        // Slash '/'
        const slashShape = new THREE.Shape()
        const sW = thickness * 0.8
        const sH = length * 2.1

        slashShape.moveTo(-sW / 2, -sH / 2)
        slashShape.lineTo(sW / 2, -sH / 2)
        slashShape.lineTo(sW / 2, sH / 2)
        slashShape.lineTo(-sW / 2, sH / 2)
        slashShape.lineTo(-sW / 2, -sH / 2)

        const slashGeo = new THREE.ExtrudeGeometry(slashShape, {
            depth: depth,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.06,
            bevelThickness: 0.06
        })
        slashGeo.translate(0, 0, -depth / 2)

        const slashMesh = new THREE.Mesh(slashGeo, polishedMaterial)
        slashMesh.rotation.z = -Math.PI / 8
        slashMesh.castShadow = true
        slashMesh.receiveShadow = true
        slashMesh.position.x = 0
        this.group.add(slashMesh)

        // Right Bracket '>'
        const rightBracket = createBracket(true)
        rightBracket.position.x = 7.5
        this.group.add(rightBracket)

        // Luz puntual tenue color cian para dar ambiente
        const light = new THREE.PointLight(0x00c3ff, 1.5, 6.0)
        light.position.set(0, 0, 0.5)
        this.group.add(light)
    }

    /**
     * Animación de flotado y sutil rotación
     */
    _onTick()
    {
        if(!this.group) return
        const timeSec = performance.now() * 0.0015
        this.group.position.y = this.baseY + Math.sin(timeSec * 1.5) * 0.15
        this.group.rotation.y = this.baseRotY + Math.sin(timeSec * 0.8) * 0.25
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this._onTick)

        if(this.group)
        {
            this.game.scene.remove(this.group)
            this.group.traverse((child) =>
            {
                if(child.geometry) child.geometry.dispose()
                if(child.material)
                {
                    if(Array.isArray(child.material)) child.material.forEach(m => m.dispose())
                    else child.material.dispose()
                }
            })
            this.group = null
        }
    }
}
