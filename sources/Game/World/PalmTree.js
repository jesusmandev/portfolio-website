/**
 * PalmTree.js — Palmera 3D Procedural Ultra-Optimizada (Cero Lag)
 * Con césped natural en la base y cocos caídos en el suelo.
 */

import * as THREE from 'three/webgpu'

export class PalmTree
{
    constructor(options = {})
    {
        this.position = options.position || new THREE.Vector3(0, 0, 0)
        this.group = new THREE.Group()
        this.group.position.copy(this.position)

        this.leaves = []
        this.init()
    }

    init()
    {
        // ─────────────────────────────────────────────────────────────────
        // 1. TRONCO ESCULPIDO CON ANILLOS Y VERTEX COLORS (Cero texturas, Cero lag)
        // ─────────────────────────────────────────────────────────────────
        const trunkHeight = 11
        const trunkRadiusBottom = 1.05
        const trunkRadiusTop = 0.38
        const trunkSegments = 18

        const trunkGeo = new THREE.CylinderGeometry(trunkRadiusTop, trunkRadiusBottom, trunkHeight, 14, trunkSegments)
        const positionAttribute = trunkGeo.attributes.position
        const vertex = new THREE.Vector3()

        const trunkColors = new Float32Array(positionAttribute.count * 3)
        const colBase = new THREE.Color('#dcd294')     // Color cálido madera de palmera
        const colRing = new THREE.Color('#586622')     // Verde oliva oscuro en las hendiduras de los anillos
        const colRoot = new THREE.Color('#8c7f4c')     // Base ligeramente más terrosa cerca del suelo

        for(let i = 0; i < positionAttribute.count; i++)
        {
            vertex.fromBufferAttribute(positionAttribute, i)
            const yPercent = (vertex.y + trunkHeight / 2) / trunkHeight
            const numRings = 10
            const crevice = Math.pow(Math.abs(Math.cos(yPercent * Math.PI * numRings)), 8)
            const radiusModifier = 1.0 + (0.03 * crevice)

            vertex.x *= radiusModifier
            vertex.z *= radiusModifier

            positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z)

            // Pintar colores en vértices (degradado exacto entre madera y anillos)
            const ringFactor = Math.pow(Math.abs(Math.cos(yPercent * Math.PI * numRings)), 5)
            const c = colBase.clone().lerp(colRing, ringFactor * 0.85)
            if(yPercent < 0.15)
            {
                c.lerp(colRoot, (0.15 - yPercent) / 0.15)
            }

            trunkColors[i * 3 + 0] = c.r
            trunkColors[i * 3 + 1] = c.g
            trunkColors[i * 3 + 2] = c.b
        }
        trunkGeo.computeVertexNormals()
        trunkGeo.setAttribute('color', new THREE.BufferAttribute(trunkColors, 3))

        const trunkMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.82,
            metalness: 0.0
        })

        const trunk = new THREE.Mesh(trunkGeo, trunkMat)
        trunk.position.y = trunkHeight / 2
        trunk.castShadow = true
        trunk.receiveShadow = true
        this.group.add(trunk)

        // ─────────────────────────────────────────────────────────────────
        // 3. MATERIAL Y GEOMETRÍA COMPARTIDA PARA COCOS
        // ─────────────────────────────────────────────────────────────────
        const coconutGeo = new THREE.SphereGeometry(0.25, 10, 8)
        const coconutMat = new THREE.MeshStandardMaterial({
            color: 0x6e4522,
            roughness: 0.85,
            metalness: 0.0
        })

        // ─────────────────────────────────────────────────────────────────
        // 4. COCOS EN EL SUELO (Directamente sobre el césped natural del mapa)
        // ─────────────────────────────────────────────────────────────────
        const groundCoconuts = [
            { x: 1.15, z: 0.65, rotX: 0.35, rotZ: 0.55 },
            { x: -1.25, z: -0.45, rotX: -0.45, rotZ: 0.25 },
            { x: 0.45, z: -1.35, rotX: 0.2, rotZ: -0.65 },
            { x: -0.65, z: 1.15, rotX: -0.3, rotZ: -0.4 }
        ]

        for(const gc of groundCoconuts)
        {
            const coconut = new THREE.Mesh(coconutGeo, coconutMat)
            coconut.position.set(gc.x, 0.12, gc.z)
            coconut.rotation.set(gc.rotX, Math.random() * Math.PI, gc.rotZ)
            coconut.scale.set(1.05, 1.2, 1.0)
            coconut.castShadow = true
            coconut.receiveShadow = true
            this.group.add(coconut)
        }

        // ─────────────────────────────────────────────────────────────────
        // 5. CORONA Y COCOS EN LA COPA
        // ─────────────────────────────────────────────────────────────────
        const topOfTrunk = new THREE.Vector3(0, trunkHeight, 0)

        const crownGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.6, 12)
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x65732a, roughness: 1.0 })
        const crown = new THREE.Mesh(crownGeo, crownMat)
        crown.position.copy(topOfTrunk)
        crown.position.y += 0.2
        this.group.add(crown)

        // Cocos en la copa
        const coconutsGroup = new THREE.Group()
        coconutsGroup.position.copy(topOfTrunk)
        coconutsGroup.position.y -= 0.15
        this.group.add(coconutsGroup)

        const numCoconuts = 6
        for(let i = 0; i < numCoconuts; i++)
        {
            const coconut = new THREE.Mesh(coconutGeo, coconutMat)
            const angle = (i / numCoconuts) * Math.PI * 2
            const radius = 0.35

            coconut.position.x = Math.cos(angle) * radius
            coconut.position.z = Math.sin(angle) * radius
            coconut.position.y = (Math.random() - 0.5) * 0.25
            coconut.scale.set(1, 1.15, 1)
            coconut.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
            coconut.castShadow = true
            coconutsGroup.add(coconut)
        }

        // ─────────────────────────────────────────────────────────────────
        // 7. HOJAS DEFORMADAS Y ULTRA-OPTIMIZADAS (10x16 segmentos = 160 verts)
        // ─────────────────────────────────────────────────────────────────
        this.leavesGroup = new THREE.Group()
        this.leavesGroup.position.copy(topOfTrunk)
        this.leavesGroup.position.y += 0.3
        this.group.add(this.leavesGroup)

        const leafCount = 28
        const leafLength = 7.0
        const leafWidth = 2.4

        // 10x16 da cortes estilizados perfectos consumiendo 10 veces menos memoria y GPU
        const baseLeafGeo = new THREE.PlaneGeometry(leafWidth, leafLength, 10, 16)
        baseLeafGeo.translate(0, leafLength / 2, 0)

        const leafPos = baseLeafGeo.attributes.position
        const leafVert = new THREE.Vector3()
        const colors = new Float32Array(leafPos.count * 3)

        for(let i = 0; i < leafPos.count; i++)
        {
            leafVert.fromBufferAttribute(leafPos, i)
            const originalX = leafVert.x
            const lengthPercent = leafVert.y / leafLength
            const distFromCenter = Math.abs(originalX) / (leafWidth / 2)

            // 1. Curva de gravedad
            leafVert.z = Math.pow(lengthPercent, 1.8) * 3.5

            // 2. Silueta ovalada estilizada con tallo fino
            let widthFactor = 0
            let leafP = 0
            if(lengthPercent < 0.1)
            {
                widthFactor = 0.08
            }
            else
            {
                leafP = (lengthPercent - 0.1) / 0.9
                widthFactor = Math.sin(Math.pow(leafP, 0.7) * Math.PI)
            }

            // 3. Cortes / mordiscos
            if(leafP > 0)
            {
                const numCuts = 7
                const sideOffset = originalX > 0 ? 0 : Math.PI
                const cutShape = Math.sin((leafP * Math.PI * numCuts) + sideOffset)
                if(cutShape > 0.5 && distFromCenter > 0.1)
                {
                    const carveIntensity = (cutShape - 0.5) * 2.0
                    widthFactor -= Math.pow(carveIntensity, 0.8) * 0.7 * distFromCenter
                }
            }

            leafVert.x *= Math.max(0.02, widthFactor)

            // 4. Hundimiento transversal en 'V'
            leafVert.z -= Math.abs(leafVert.x) * 0.3

            leafPos.setXYZ(i, leafVert.x, leafVert.y, leafVert.z)

            // 5. Colores por vértice (Vertex Colors)
            const edgeColor = new THREE.Color(0x3bd61e)
            const veinColor = new THREE.Color(0xa7eb54)

            const mixAmount = Math.min(1.0, distFromCenter * 3.5)
            const finalColor = veinColor.clone().lerp(edgeColor, mixAmount)

            colors[i * 3 + 0] = finalColor.r
            colors[i * 3 + 1] = finalColor.g
            colors[i * 3 + 2] = finalColor.b
        }
        baseLeafGeo.computeVertexNormals()
        baseLeafGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const leafMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.75,
            side: THREE.DoubleSide
        })

        for(let i = 0; i < leafCount; i++)
        {
            const leaf = new THREE.Mesh(baseLeafGeo, leafMat)
            leaf.rotation.order = 'YXZ'

            if(i < 12)
            {
                // Capa 1 (Inferior)
                leaf.rotation.y = (i / 12) * Math.PI * 2
                leaf.rotation.x = Math.PI / 2 + 0.2
                leaf.scale.setScalar(1.0 + (Math.random() * 0.08))
            }
            else if(i < 22)
            {
                // Capa 2 (Media)
                leaf.rotation.y = ((i - 12) / 10) * Math.PI * 2 + 0.3
                leaf.rotation.x = Math.PI / 2 - 0.05
                leaf.scale.setScalar(0.85)
            }
            else
            {
                // Capa 3 (Superior/Centro)
                leaf.rotation.y = ((i - 22) / 6) * Math.PI * 2 + 0.15
                leaf.rotation.x = Math.PI / 2 - 0.35
                leaf.scale.setScalar(0.6)
            }

            leaf.rotation.y += (Math.random() - 0.5) * 0.08
            leaf.castShadow = true
            leaf.receiveShadow = false // Optimización: desactivar receiveShadow en hojas para evitar sampling masivo

            this.leavesGroup.add(leaf)

            this.leaves.push({
                mesh: leaf,
                initialRotX: leaf.rotation.x,
                speedOffset: Math.random() * Math.PI * 2
            })
        }
    }

    update(elapsedTime = 0)
    {
        // Optimización matemática: calcular el tiempo una sola vez fuera del bucle
        const t = elapsedTime * 1.5
        for(let i = 0; i < this.leaves.length; i++)
        {
            const leafData = this.leaves[i]
            leafData.mesh.rotation.x = leafData.initialRotX + Math.sin(t + leafData.speedOffset) * 0.035
        }

        if(this.leavesGroup)
        {
            this.leavesGroup.rotation.y = Math.sin(elapsedTime * 0.5) * 0.025
        }
    }
}
