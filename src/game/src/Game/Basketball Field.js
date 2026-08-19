/**
 * Basketball Field.js — 3D Basketball Court module in Three.js.
 */

import * as THREE from 'three';

export class BasketballField {
    /**
     * @param {THREE.Scene|THREE.Group} parent
     * @param {Object} [options]
     * @param {THREE.Scene|THREE.Group} parent
     * @param {Object} [options]
     * @param {number} [options.x=-155.0] - Center X
     * @param {number} [options.y=0.40]
     * @param {number} [options.z=-65.0] - Center Z
     * @param {number} [options.courtWidth=84] - Length (X axis)
     * @param {number} [options.courtLength=32] - Width (Z axis)
     * @param {number} [options.rotationY=0]
     */
    constructor(parent, options = {}) {
        this.parent = parent;
        this.x = options.x ?? -155.0;
        this.y = options.y ?? 0.40;
        this.z = options.z ?? -65.0;
        this.courtWidth  = options.courtWidth  ?? 84;
        this.courtLength = options.courtLength ?? 32;
        this.rotationY   = options.rotationY   ?? 0;

        this.scaleX = this.courtWidth  / 28;
        this.scaleZ = this.courtLength / 15;
        this.basketHeight = 10.0; // VERY tall post

        this.colliders = [];

        this.group = new THREE.Group();
        this.group.name = 'BasketballField';
        this.group.position.set(this.x, this.y, this.z);
        if (this.rotationY) this.group.rotation.y = this.rotationY;

        this._build();
        if (this.parent) this.parent.add(this.group);
    }

    _build() {
        const W  = this.courtWidth;
        const L  = this.courtLength;
        const BH = this.basketHeight; // post height

        // ── 1. Apron (dark outer floor) ──────────────────────────────
        const apronMat = new THREE.MeshStandardMaterial({ color: 0x2d4735, roughness: 0.8 });
        const apron    = new THREE.Mesh(new THREE.PlaneGeometry(W + 5, L + 5), apronMat);
        apron.rotation.x = -Math.PI / 2;
        apron.position.y = 0.01;
        apron.receiveShadow = true;
        this.group.add(apron);

        // ── 2. Court surface (wood) ───────────────────────────
        const courtMat = new THREE.MeshStandardMaterial({ color: 0xdfb175, roughness: 0.7 });
        const court    = new THREE.Mesh(new THREE.PlaneGeometry(W, L), courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.02;
        court.receiveShadow = true;
        this.group.add(court);

        // ── 3. Lines ─────────────────────────────────────────────────────
        const lineMat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lineWidth = 0.14 * Math.min(this.scaleX, this.scaleZ);

        const addLine = (w, h, lx, lz) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
            m.rotation.x = -Math.PI / 2;
            m.position.set(lx, 0.03, lz);
            this.group.add(m);
        };

        // Outer borders
        addLine(W, lineWidth,  0,  L / 2);
        addLine(W, lineWidth,  0, -L / 2);
        addLine(lineWidth, L,  W / 2, 0);
        addLine(lineWidth, L, -W / 2, 0);
        // Center line
        addLine(lineWidth, L, 0, 0);

        // Center circle
        const cr = 1.75 * Math.min(this.scaleX, this.scaleZ);
        const cRing = new THREE.Mesh(
            new THREE.RingGeometry(cr - lineWidth / 2, cr + lineWidth / 2, 64),
            lineMat
        );
        cRing.rotation.x = -Math.PI / 2;
        cRing.position.y = 0.03;
        this.group.add(cRing);

        // Key area (paint)
        const addKeyArea = (isRight) => {
            const sign      = isRight ? 1 : -1;
            const kw        = 4.9 * this.scaleZ;
            const kl        = 5.8 * this.scaleX;
            const kCenterX  = sign * (W / 2 - kl / 2);
            addLine(kl, lineWidth, kCenterX,  kw / 2);
            addLine(kl, lineWidth, kCenterX, -kw / 2);
            addLine(lineWidth, kw, sign * (W / 2 - kl), 0);
            const ftr = 1.8 * this.scaleZ;
            const ftRing = new THREE.Mesh(
                new THREE.RingGeometry(ftr - lineWidth / 2, ftr + lineWidth / 2, 32, 1, 0, Math.PI),
                lineMat
            );
            ftRing.rotation.x  = -Math.PI / 2;
            ftRing.rotation.z  = isRight ? Math.PI / 2 : -Math.PI / 2;
            ftRing.position.set(sign * (W / 2 - kl), 0.03, 0);
            this.group.add(ftRing);
        };
        addKeyArea(true);
        addKeyArea(false);

        // 3-point line
        const add3ptLine = (isRight) => {
            const sign   = isRight ? 1 : -1;
            const hoopX  = sign * (W / 2 - 1.575 * this.scaleX);
            const radius = 8.5 * Math.min(this.scaleX, this.scaleZ);
            const zOff   = Math.min(L / 2 - 0.2, 6.6 * this.scaleZ);
            const ratio  = Math.min(1, Math.max(-1, zOff / radius));
            const angle  = Math.asin(ratio);
            const tStart = isRight ? Math.PI - angle : Math.PI * 2 - angle;
            const arc = new THREE.Mesh(
                new THREE.RingGeometry(radius - lineWidth / 2, radius + lineWidth / 2, 32, 1, tStart, angle * 2),
                lineMat
            );
            arc.rotation.x = -Math.PI / 2;
            arc.position.set(hoopX, 0.03, 0);
            this.group.add(arc);
            const dx   = Math.cos(angle) * radius;
            const exX  = hoopX - sign * dx;
            const sLen = Math.abs(sign * W / 2 - exX);
            const sCX  = (sign * W / 2 + exX) / 2;
            addLine(sLen, lineWidth, sCX,  zOff);
            addLine(sLen, lineWidth, sCX, -zOff);
        };
        add3ptLine(true);
        add3ptLine(false);

        // ── 4. Basketball hoop system ─────────────────────────────────────────
        // Structure: vertical post OUTSIDE the court -> horizontal arm
        // inward -> backboard hangs from the end of the arm.
        // The post does NOT touch the backboard.

        const addHoopSystem = (isRight) => {
            const sg   = new THREE.Group();
            const sign = isRight ? 1 : -1;

            const poleMat  = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.15 });
            const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, roughness: 0.05 });
            const orangeMat= new THREE.MeshStandardMaterial({ color: 0xff4500, roughness: 0.25 });
            const netMat   = new THREE.MeshBasicMaterial({ color: 0xeeeeee, wireframe: true });

            // X position of the post — right OUTSIDE the baseline
            const poleX    = sign * (W / 2 + 1.8);
            // Height where the arm extends from the post (top of post)
            const armY     = BH;
            // X of backboard — inside the baseline
            const boardX   = sign * (W / 2 - 1.5);
            // X of hoop ring — slightly further in than the backboard
            const ringX    = sign * (W / 2 - 2.0);

            // Tapered post (thicker at base)
            const poleGeo = new THREE.CylinderGeometry(0.18, 0.40, BH, 16);
            const pole    = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(poleX, BH / 2, 0);
            pole.castShadow = true;
            sg.add(pole);

            // Horizontal arm from poleX to boardX
            const armLen = Math.abs(poleX - boardX);
            const armGeo = new THREE.BoxGeometry(armLen, 0.22, 0.22);
            const arm    = new THREE.Mesh(armGeo, poleMat);
            // Center of arm between post and backboard
            arm.position.set((poleX + boardX) / 2, armY, 0);
            arm.castShadow = true;
            sg.add(arm);

            // Backboard — hangs BELOW the end of the arm
            const boardH = 1.6;
            const boardZ = 2.2;
            const boardGeo = new THREE.BoxGeometry(0.12, boardH, boardZ);
            const board    = new THREE.Mesh(boardGeo, boardMat);
            board.position.set(boardX, armY - boardH * 0.4, 0);
            board.castShadow = true;
            sg.add(board);

            // Inner red rectangle on backboard
            const innerEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.7, 0.5));
            const innerRect  = new THREE.LineSegments(innerEdges, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 }));
            innerRect.rotation.y = sign * -Math.PI / 2;
            innerRect.position.set(boardX - sign * 0.07, armY - boardH * 0.4 - 0.15, 0);
            sg.add(innerRect);

            // Orange rim
            const ringRadius = 0.35;
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(ringRadius, 0.035, 16, 32),
                orangeMat
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(ringX, armY - boardH * 0.4 - 0.5, 0);
            ring.castShadow = true;
            sg.add(ring);

            // Rim->backboard support
            const suppLen = Math.abs(boardX - ringX);
            const supp = new THREE.Mesh(new THREE.BoxGeometry(suppLen, 0.06, 0.10), orangeMat);
            supp.position.set((boardX + ringX) / 2, armY - boardH * 0.4 - 0.5, 0);
            sg.add(supp);

            // Net
            const net = new THREE.Mesh(
                new THREE.CylinderGeometry(ringRadius, ringRadius * 0.6, 0.8, 16, 4, true),
                netMat
            );
            net.position.set(ringX, armY - boardH * 0.4 - 0.9, 0);
            sg.add(net);

            this.group.add(sg);

            // Colliders
            this.colliders.push({ type: 'cylinder', x: this.x + poleX, y: this.y + BH / 2, z: this.z, r: 0.45, hh: BH / 2 });
        };

        addHoopSystem(true);
        addHoopSystem(false);


    }
}
