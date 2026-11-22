import * as THREE from 'three/webgpu'
import { color, uniform } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Speaker3D adaptado al motor WebGPU/TSL de folio-2025
 */
export class Speaker3D
{
    constructor(options = {})
    {
        this.game = Game.getInstance()
        this.scene = this.game.scene

        this.position = options.position
            ? options.position.clone()
            : new THREE.Vector3(24.01, 0.0, 55.10)

        this.rotation = options.rotation
            ? options.rotation.clone()
            : new THREE.Quaternion()

        this.speakerScale = options.scale ?? 7.5

        this._powered = false
        this._volume = 0.5
        this._shakeIntensity = 0
        this._lastNoteTime = 0
        this._frameCount = 0

        this._audioCtx = null
        this._gainNode = null
        this._srcBuffer = null
        this._srcNode = null
        this._audioLoaded = false

        this._raycaster = new THREE.Raycaster()
        this._mouse = new THREE.Vector2()
        this._isDragging = false
        this._pointerDownPos = { x: 0, y: 0 }

        // Proximidad en escala de este mundo (~10m para mostrar, ~16m para ocultar)
        this.SHOW_DIST_SQ = 10 * 10
        this.HIDE_DIST_SQ = 16 * 16
        this._isNearby = false

        this._powerBtnMesh = null
        this._wooferCones = []
        this._dustCaps = []
        this._ledMesh = null
        this._bodyMesh = null
        this._knobMesh = null

        this._group = new THREE.Group()
        this._group.position.copy(this.position)
        this._group.quaternion.copy(this.rotation)
        this.scene.add(this._group)

        this._buildGeometry()
        this._loadAudio()
        this._bindEvents()
        this._buildVolumeUI()
        this._setUIVisible(false)
    }

    _createMat(hexColor)
    {
        return new MeshDefaultMaterial({
            colorNode: uniform(color(hexColor)),
            hasCoreShadows: true,
            hasDropShadows: true,
            hasWater: true
        })
    }

    _createEmissiveMat(hexColor)
    {
        return new MeshDefaultMaterial({
            colorNode: uniform(color(hexColor)),
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
            hasWater: false
        })
    }

    _buildGeometry()
    {
        const s = this.speakerScale / 9.0

        this._matBodyOn   = this._createMat('#3b5260')
        this._matBodyOff  = this._createMat('#222e36')
        const matFrame    = this._createMat('#56778a')
        const matGrille   = this._createMat('#141618')
        const matSurround = this._createMat('#2d3942')
        const matChrome   = this._createMat('#d0d8e0')
        const matCone     = this._createMat('#111315')
        this._matCapOn    = this._createEmissiveMat('#00ff88', 2.2)
        this._matCapOff   = this._createMat('#7a8e99')
        const matKnob     = this._createMat('#e0e6ed')
        const matButton   = this._createMat('#1c2329')

        this._matBtnOn    = this._createEmissiveMat('#00ff66', 2.5)
        this._matBtnOff   = this._createMat('#ff3344')
        this._matLedOn    = this._createEmissiveMat('#00ff66', 3.0)
        this._matLedOff   = this._createMat('#440000')

        const bW = 2.6 * s, bH = 4.2 * s, bD = 1.4 * s

        // Cuerpo principal
        const geoBody = new THREE.BoxGeometry(bW, bH, bD)
        this._bodyMesh = new THREE.Mesh(geoBody, this._matBodyOff)
        this._bodyMesh.position.y = bH / 2
        this._bodyMesh.castShadow = true
        this._bodyMesh.receiveShadow = true
        this._group.add(this._bodyMesh)

        // Colisionador físico fijo en Rapier3D
        this.physicalObject = this.game.objects.add(
            null,
            {
                type: 'fixed',
                position: new THREE.Vector3(this.position.x, this.position.y + bH / 2, this.position.z),
                rotation: this.rotation,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ bW / 2, bH / 2, bD / 2 ],
                        category: 'object'
                    }
                ]
            }
        )

        // Panel frontal negro con relieve
        const fW = 2.15 * s, fH = 3.6 * s, fD = 0.12 * s
        const geoFront = new THREE.BoxGeometry(fW, fH, fD)
        const front = new THREE.Mesh(geoFront, matGrille)
        front.position.set(0, bH / 2, bD / 2 + fD / 2 + 0.02 * s)
        front.castShadow = true
        front.receiveShadow = true
        this._group.add(front)

        const frontFaceZ = bD / 2 + fD + 0.02 * s

        // Marco protector azul metálico
        const ft = 0.22 * s, fd = 0.16 * s
        const frameParts = [
            [fW + ft * 2, ft, 0, bH / 2 + fH / 2 + ft / 2],
            [fW + ft * 2, ft, 0, bH / 2 - fH / 2 - ft / 2],
            [ft, fH, -fW / 2 - ft / 2, bH / 2],
            [ft, fH,  fW / 2 + ft / 2, bH / 2],
        ]
        frameParts.forEach(([w, h, x, y]) =>
        {
            const geoF = new THREE.BoxGeometry(w, h, fd)
            const m = new THREE.Mesh(geoF, matFrame)
            m.position.set(x, y, bD / 2 + fd / 2)
            m.castShadow = true
            m.receiveShadow = true
            this._group.add(m)
        })

        // Woofers estilizados ("Mela speakers")
        const wooferY = [3.0 * s, 1.25 * s]
        const wR = 0.64 * s

        const geoSurround = new THREE.CylinderGeometry(wR, wR, 0.1 * s, 20)
        const geoChrome   = new THREE.CylinderGeometry(wR * 1.05, wR * 1.05, 0.04 * s, 20)
        const geoCone     = new THREE.CylinderGeometry(0.24 * s, wR * 0.88, 0.28 * s, 20, 1, true)
        const geoCap      = new THREE.SphereGeometry(0.15 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65)

        wooferY.forEach((y) =>
        {
            const g = new THREE.Group()
            g.position.set(0, y, frontFaceZ)

            const chrome = new THREE.Mesh(geoChrome, matChrome)
            chrome.rotation.x = Math.PI / 2
            chrome.position.z = 0.02 * s
            g.add(chrome)

            const surround = new THREE.Mesh(geoSurround, matSurround)
            surround.rotation.x = Math.PI / 2
            surround.position.z = 0.05 * s
            g.add(surround)

            const cone = new THREE.Mesh(geoCone, matCone)
            cone.rotation.x = Math.PI / 2
            cone.position.z = 0.13 * s
            g.add(cone)
            this._wooferCones.push(cone)

            const cap = new THREE.Mesh(geoCap, this._matCapOff)
            cap.rotation.x = -Math.PI / 2
            cap.position.z = 0.22 * s
            g.add(cap)
            this._dustCaps.push(cap)

            this._group.add(g)
        })

        // Orificio Bass-Reflex
        const geoPort = new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.15 * s, 16)
        const port = new THREE.Mesh(geoPort, matGrille)
        port.rotation.x = Math.PI / 2
        port.position.set(0, 0.38 * s, frontFaceZ + 0.02 * s)
        this._group.add(port)

        // Panel de controles superior
        const ctrlY = bH / 2 + fH / 2 + ft / 2

        // Power LED
        const geoLed = new THREE.SphereGeometry(0.06 * s, 12, 10)
        this._ledMesh = new THREE.Mesh(geoLed, this._matLedOff)
        this._ledMesh.position.set(-0.95 * s, ctrlY, frontFaceZ + 0.07 * s)
        this._group.add(this._ledMesh)

        // Perilla de volumen
        const geoKnob = new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.14 * s, 16)
        const knob = new THREE.Mesh(geoKnob, matKnob)
        knob.rotation.x = Math.PI / 2
        knob.position.set(-0.55 * s, ctrlY, frontFaceZ + 0.1 * s)
        this._group.add(knob)
        this._knobMesh = knob

        // Botón principal de encendido/apagado
        const geoBtn = new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.14 * s, 16)
        this._powerBtnMesh = new THREE.Mesh(geoBtn, this._matBtnOff)
        this._powerBtnMesh.rotation.x = Math.PI / 2
        this._powerBtnMesh.position.set(-0.16 * s, ctrlY, frontFaceZ + 0.08 * s)
        this._powerBtnMesh.name = 'speakerPowerButton'
        this._group.add(this._powerBtnMesh)

        // Botones auxiliares decorativos
        const geoMiniBtn = new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.1 * s, 10)
        for(let i = 0; i < 4; i++)
        {
            const btn = new THREE.Mesh(geoMiniBtn, matButton)
            btn.rotation.x = Math.PI / 2
            btn.position.set((0.22 + i * 0.22) * s, ctrlY, frontFaceZ + 0.05 * s)
            this._group.add(btn)
        }
    }

    _loadAudio()
    {
        this._tracks = [
            { name: 'After the Fair', url: encodeURI('./audios/speaker/After_the_Fair.mp3') },
            { name: 'Fire Under My Feet', url: encodeURI('./audios/speaker/Fuego_bajo_mis_pies.mp3') },
            { name: 'Midnight at the Plaza', url: encodeURI('./audios/speaker/Midnight_at_the_Plaza (1).mp3') },
            { name: 'Mountains Under the Moon', url: encodeURI('./audios/speaker/Montañas_bajo_la_luna.mp3') }
        ]
        this._currentTrackIdx = 0
        this._audioBuffers = {}

        this._loadTrackBuffer(this._currentTrackIdx)
    }

    _loadTrackBuffer(idx)
    {
        if(this._audioBuffers[idx])
        {
            this._srcBuffer = this._audioBuffers[idx]
            this._audioLoaded = true
            return Promise.resolve(this._audioBuffers[idx])
        }

        const track = this._tracks[idx]
        return fetch(track.url)
            .then(r => r.arrayBuffer())
            .then(buffer =>
            {
                if(!this._audioCtx)
                {
                    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
                }
                return this._audioCtx.decodeAudioData(buffer)
            })
            .then(decoded =>
            {
                this._audioBuffers[idx] = decoded
                if(idx === this._currentTrackIdx)
                {
                    this._srcBuffer = decoded
                    this._audioLoaded = true
                }
                return decoded
            })
            .catch(err => console.warn('[Speaker3D] Track load error:', err))
    }

    _startAudio()
    {
        if(!this._audioLoaded || !this._srcBuffer)
        {
            this._loadTrackBuffer(this._currentTrackIdx).then(buf =>
            {
                if(buf && this._powered)
                    this._startAudio()
            })
            return
        }

        if(!this._audioCtx)
        {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        }
        if(this._audioCtx.state === 'suspended')
        {
            this._audioCtx.resume()
        }

        this._stopAudio()

        this._srcNode = this._audioCtx.createBufferSource()
        this._srcNode.buffer = this._srcBuffer
        this._srcNode.loop = false

        this._srcNode.onended = () =>
        {
            if(this._powered)
            {
                this.nextTrack()
            }
        }

        this._gainNode = this._audioCtx.createGain()
        this._gainNode.gain.value = this._volume

        this._srcNode.connect(this._gainNode)
        this._gainNode.connect(this._audioCtx.destination)
        this._srcNode.start(0)

        this._updateTrackLabel()
    }

    nextTrack()
    {
        this._stopAudio()
        this._currentTrackIdx = (this._currentTrackIdx + 1) % this._tracks.length
        this._audioLoaded = false
        this._srcBuffer = null

        this._updateTrackLabel()

        if(this._powered)
        {
            this._loadTrackBuffer(this._currentTrackIdx).then(buf =>
            {
                if(buf && this._powered)
                {
                    this._startAudio()
                }
            })
        }
        else
        {
            this.togglePower()
        }
    }

    _updateTrackLabel()
    {
        const track = this._tracks[this._currentTrackIdx]
        const label = document.getElementById('speaker-track-title')
        if(label && track)
        {
            label.textContent = track.name
        }
    }

    _stopAudio()
    {
        if(this._srcNode)
        {
            this._srcNode.onended = null
            try { this._srcNode.stop() } catch(_) {}
            this._srcNode.disconnect()
            this._srcNode = null
        }
        if(this._gainNode)
        {
            this._gainNode.disconnect()
            this._gainNode = null
        }
    }

    setVolume(vol)
    {
        this._volume = Math.max(0, Math.min(1, vol))
        if(this._gainNode && this._audioCtx)
        {
            this._gainNode.gain.setTargetAtTime(this._volume, this._audioCtx.currentTime, 0.04)
        }
        const slider = document.getElementById('speaker-volume-slider')
        if(slider)
            slider.value = Math.round(this._volume * 100)
        const label = document.getElementById('speaker-volume-label')
        if(label)
            label.textContent = Math.round(this._volume * 100) + '%'
    }

    togglePower()
    {
        this._powered = !this._powered
        if(this._powered)
        {
            this._startAudio()
            this._ledMesh.material      = this._matLedOn
            this._powerBtnMesh.material = this._matBtnOn
            this._bodyMesh.material     = this._matBodyOn
            this._dustCaps.forEach(cap => cap.material = this._matCapOn)

            // Activar animación de baile del personaje ('Dance_Loop')
            if(this.game.world?.visualVehicle?.playAction)
            {
                this.game.world.visualVehicle.playAction('Dance_Loop')
            }
        }
        else
        {
            this._stopAudio()
            this._ledMesh.material      = this._matLedOff
            this._powerBtnMesh.material = this._matBtnOff
            this._bodyMesh.material     = this._matBodyOff
            this._dustCaps.forEach(cap => cap.material = this._matCapOff)
        }

        const powerBtn = document.getElementById('speaker-power-btn')
        if(powerBtn)
        {
            powerBtn.textContent = this._powered ? '🔊 Apagar' : '🔇 Encender'
            powerBtn.style.background = this._powered ? '#00cc55' : '#cc3333'
        }
        const volPanel = document.getElementById('speaker-vol-panel')
        if(volPanel)
            volPanel.style.display = this._powered ? 'flex' : 'none'
    }

    _buildVolumeUI()
    {
        const existing = document.getElementById('speaker-ui')
        if(existing)
            existing.remove()

        const panel = document.createElement('div')
        panel.id = 'speaker-ui'
        panel.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            pointer-events: auto; font-family: "Segoe UI", system-ui, sans-serif;
        `

        const btn = document.createElement('button')
        btn.id = 'speaker-power-btn'
        btn.textContent = '🔇 Encender'
        btn.style.cssText = `
            padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
            background: #cc3333; color: #fff; font-weight: bold; font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            transition: background 0.2s, transform 0.1s;
        `
        btn.addEventListener('click', () => this.togglePower())

        const volPanel = document.createElement('div')
        volPanel.id = 'speaker-vol-panel'
        volPanel.style.cssText = `
            display: none; flex-direction: column; align-items: center; gap: 6px;
            background: rgba(0,0,0,0.75); backdrop-filter: blur(10px);
            border: 1px solid rgba(0,150,255,0.3);
            border-radius: 14px; padding: 12px 18px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            min-width: 170px;
        `

        const trackTitle = document.createElement('span')
        trackTitle.id = 'speaker-track-title'
        trackTitle.textContent = this._tracks?.[0]?.name || 'Music'
        trackTitle.style.cssText = 'color: #00ff88; font-size: 11px; font-weight: 700; text-align: center; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'

        const controlsRow = document.createElement('div')
        controlsRow.style.cssText = 'display: flex; align-items: center; gap: 8px; width: 100%; justify-content: space-between;'

        const label = document.createElement('span')
        label.id = 'speaker-volume-label'
        label.textContent = '50%'
        label.style.cssText = 'color: #fff; font-size: 11px; font-weight: bold; min-width: 32px;'

        const slider = document.createElement('input')
        slider.id = 'speaker-volume-slider'
        slider.type = 'range'
        slider.min = '0'
        slider.max = '100'
        slider.value = '50'
        slider.style.cssText = 'width: 80px; accent-color: #00FF66; cursor: pointer;'
        slider.addEventListener('input', () =>
        {
            this.setVolume(parseInt(slider.value) / 100)
        })

        const nextBtn = document.createElement('button')
        nextBtn.id = 'speaker-next-btn'
        nextBtn.textContent = '⏭️'
        nextBtn.title = 'Siguiente pista'
        nextBtn.style.cssText = 'background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; padding: 3px 8px; cursor: pointer; font-size: 12px; transition: background 0.2s;'
        nextBtn.addEventListener('click', () => this.nextTrack())

        controlsRow.append(label, slider, nextBtn)
        volPanel.append(trackTitle, controlsRow)
        panel.append(btn, volPanel)
        document.body.appendChild(panel)
    }

    _setUIVisible(visible)
    {
        const ui = document.getElementById('speaker-ui')
        if(ui)
            ui.style.display = visible ? 'flex' : 'none'
    }

    _bindEvents()
    {
        const canvas = this.game.canvasElement || document.querySelector('canvas')
        if(!canvas)
            return

        canvas.addEventListener('pointerdown', (e) =>
        {
            this._isDragging = false
            this._pointerDownPos = { x: e.clientX, y: e.clientY }
        })
        canvas.addEventListener('pointermove', (e) =>
        {
            const dx = e.clientX - this._pointerDownPos.x
            const dy = e.clientY - this._pointerDownPos.y
            if(dx * dx + dy * dy > 25)
                this._isDragging = true
        })
        canvas.addEventListener('pointerup', (e) =>
        {
            if(this._isDragging)
                return
            this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1
            this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
            const cam = this.game.view?.camera
            if(!cam)
                return
            this._raycaster.setFromCamera(this._mouse, cam)
            const hits = this._raycaster.intersectObjects(this._group.children, true)
            for(const hit of hits)
            {
                if(hit.object.name === 'speakerPowerButton')
                {
                    this.togglePower()
                    break
                }
            }
        })
    }

    _checkProximity(playerPos)
    {
        if(!playerPos)
            return
        const dx = playerPos.x - this.position.x
        const dz = playerPos.z - this.position.z
        const distSq = dx * dx + dz * dz

        if(!this._isNearby && distSq <= this.SHOW_DIST_SQ)
        {
            this._isNearby = true
            this._setUIVisible(true)
        }
        else if(this._isNearby && distSq > this.HIDE_DIST_SQ)
        {
            this._isNearby = false
            this._setUIVisible(false)
            if(this._powered)
                this.togglePower()
        }
    }

    update(delta, playerPos)
    {
        this._frameCount++
        const t = this.game.ticker.elapsed
        const s = this.speakerScale / 9.0

        if(this._frameCount % 5 === 0)
        {
            this._checkProximity(playerPos)
        }

        let spkShakeX = 0, spkShakeZ = 0
        if(this._powered && this._volume > 0.5)
        {
            const vFactor = (this._volume - 0.5) / 0.5
            const shakeAmt = vFactor * 0.12 * s
            spkShakeX = (Math.random() - 0.5) * shakeAmt
            spkShakeZ = (Math.random() - 0.5) * shakeAmt
        }

        this._group.position.x = this.position.x + spkShakeX
        this._group.position.y = this.position.y + Math.sin(t * 0.8) * 0.04 * s
        this._group.position.z = this.position.z + spkShakeZ

        if(this._powered)
        {
            const pulse = (Math.sin(t * 14) * 0.5 + 0.5) * this._volume
            const excursion = 0.07 * s * pulse + 0.02 * s * Math.sin(t * 28)

            this._wooferCones.forEach((cone, i) =>
            {
                cone.position.z = 0.13 * s + excursion * (i === 0 ? 1 : 0.88)
                cone.scale.setScalar(1 + excursion * 0.09)
            })
            this._dustCaps.forEach((cap, i) =>
            {
                cap.position.z = 0.22 * s + excursion * (i === 0 ? 1.1 : 0.95)
            })

            if(this._knobMesh)
            {
                this._knobMesh.rotation.z = this._volume * Math.PI * 1.2 - Math.PI * 0.6
            }
        }
        else
        {
            this._wooferCones.forEach(cone =>
            {
                cone.position.z = THREE.MathUtils.lerp(cone.position.z, 0.13 * s, 0.1)
                cone.scale.setScalar(THREE.MathUtils.lerp(cone.scale.x, 1, 0.1))
            })
            this._dustCaps.forEach(cap =>
            {
                cap.position.z = THREE.MathUtils.lerp(cap.position.z, 0.22 * s, 0.1)
            })
        }
    }
}
