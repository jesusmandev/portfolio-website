/**
 * SoccerField.js — Professional 3D Soccer Field module in Three.js.
 *
 * Extracted and structured from the HTML/Three.js prototype to
 * integrate into the game scene and ProceduralCityBuilder.
 */

import * as THREE from 'three';

let cachedGrassTexture = null;

function getGrassTexture(fieldLength, fieldWidth) {
    if (cachedGrassTexture) return cachedGrassTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Base grass with alternating stripes
    context.fillStyle = '#4CAF50';
    context.fillRect(0, 0, 512, 512);

    context.fillStyle = '#45a049';
    const stripeWidth = 64;
    for (let i = 0; i < 512; i += stripeWidth * 2) {
        context.fillRect(i, 0, stripeWidth, 512);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(fieldLength / 10, fieldWidth / 10);
    cachedGrassTexture = texture;
    return texture;
}

export class SoccerField {
    /**
     * @param {THREE.Scene|THREE.Group} parent - Group or scene to add to
     * @param {Object} [options]
     * @param {number} [options.x=144.5] - X position
     * @param {number} [options.y=0.40] - Y position
     * @param {number} [options.z=0] - Z position
     * @param {number} [options.fieldLength=92] - Field length
     * @param {number} [options.fieldWidth=46] - Field width
     * @param {number} [options.rotationY=0] - Optional rotation
     */
    constructor(parent, options = {}) {
        this.parent = parent;
        this.x = options.x ?? 144.5;
        this.y = options.y ?? 0.40;
        this.z = options.z ?? 0;
        this.fieldLength = options.fieldLength ?? 92;
        this.fieldWidth = options.fieldWidth ?? 46;
        this.rotationY = options.rotationY ?? 0;

        // Scale factors according to standard dimensions (105x68)
        this.scaleX = this.fieldLength / 105;
        this.scaleZ = this.fieldWidth / 68;

        this.colliders = []; // Physics colliders registry (for Rapier)

        this.group = new THREE.Group();
        this.group.name = 'SoccerField';
        this.group.position.set(this.x, this.y, this.z);
        if (this.rotationY) this.group.rotation.y = this.rotationY;

        this._build();

        if (this.parent) {
            this.parent.add(this.group);
        }
    }

    _build() {
        const fieldLength = this.fieldLength;
        const fieldWidth  = this.fieldWidth;
        const lineWidth   = 0.45 * Math.min(this.scaleX, this.scaleZ);

        // 1. Pitch (Striped Grass)
        const grassTexture = getGrassTexture(fieldLength, fieldWidth);
        const fieldGeometry = new THREE.PlaneGeometry(fieldLength, fieldWidth);
        const fieldMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        field.rotation.x = -Math.PI / 2;
        field.position.y = 0.02;
        field.receiveShadow = true;
        this.group.add(field);

        // 2. Dark green outer border
        const borderGeometry = new THREE.PlaneGeometry(fieldLength + 6 * this.scaleX, fieldWidth + 4 * this.scaleZ);
        const borderMaterial = new THREE.MeshStandardMaterial({ color: 0x388E3C, roughness: 0.8 });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.01;
        border.receiveShadow = true;
        this.group.add(border);

        // 3. Markings and Lines
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const createLine = (w, h, lx, lz) => {
            const geom = new THREE.PlaneGeometry(w, h);
            const line = new THREE.Mesh(geom, lineMaterial);
            line.rotation.x = -Math.PI / 2;
            line.position.set(lx, 0.03, lz);
            this.group.add(line);
            return line;
        };

        // Perimeter lines
        createLine(fieldLength + lineWidth, lineWidth, 0, fieldWidth / 2);
        createLine(fieldLength + lineWidth, lineWidth, 0, -fieldWidth / 2);
        createLine(lineWidth, fieldWidth - lineWidth, fieldLength / 2, 0);
        createLine(lineWidth, fieldWidth - lineWidth, -fieldLength / 2, 0);

        // Center line
        createLine(lineWidth, fieldWidth - lineWidth, 0, 0);

        // Center circle
        const centerRadius = 9.15 * Math.min(this.scaleX, this.scaleZ);
        const circleGeometry = new THREE.RingGeometry(centerRadius, centerRadius + lineWidth, 64);
        const circle = new THREE.Mesh(circleGeometry, lineMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = 0.03;
        this.group.add(circle);

        // Center spot
        const dotGeom = new THREE.CircleGeometry(0.45 * Math.min(this.scaleX, this.scaleZ), 32);
        const dot = new THREE.Mesh(dotGeom, lineMaterial);
        dot.rotation.x = -Math.PI / 2;
        dot.position.y = 0.03;
        this.group.add(dot);

        // Penalty spots
        const penaltyDistance = 11 * this.scaleX;
        const penaltyDotGeom = new THREE.CircleGeometry(0.35 * Math.min(this.scaleX, this.scaleZ), 32);

        const leftPenaltyDot = new THREE.Mesh(penaltyDotGeom, lineMaterial);
        leftPenaltyDot.rotation.x = -Math.PI / 2;
        leftPenaltyDot.position.set(-fieldLength / 2 + penaltyDistance, 0.03, 0);
        this.group.add(leftPenaltyDot);

        const rightPenaltyDot = new THREE.Mesh(penaltyDotGeom, lineMaterial);
        rightPenaltyDot.rotation.x = -Math.PI / 2;
        rightPenaltyDot.position.set(fieldLength / 2 - penaltyDistance, 0.03, 0);
        this.group.add(rightPenaltyDot);

        // Penalty Area (Penalty Box)
        const penAreaW = 16.5 * 2 * this.scaleZ;
        const penAreaD = 16.5 * this.scaleX;
        const pLen = penAreaD - 1.5 * lineWidth;
        const pCZ = penAreaW / 2 - lineWidth / 2;
        const pCXLeft = -fieldLength / 2 + penAreaD / 2 - lineWidth / 4;
        const pCXRight = fieldLength / 2 - penAreaD / 2 + lineWidth / 4;

        // Left penalty area
        createLine(pLen, lineWidth, pCXLeft, pCZ);
        createLine(pLen, lineWidth, pCXLeft, -pCZ);
        createLine(lineWidth, penAreaW, -fieldLength / 2 + penAreaD - lineWidth / 2, 0);

        // Right penalty area
        createLine(pLen, lineWidth, pCXRight, pCZ);
        createLine(pLen, lineWidth, pCXRight, -pCZ);
        createLine(lineWidth, penAreaW, fieldLength / 2 - penAreaD + lineWidth / 2, 0);

        // Goal Area (Six-Yard Box)
        const goalAreaW = (5.5 * 2 + 7.32) * this.scaleZ;
        const goalAreaD = 5.5 * this.scaleX;
        const gLen = goalAreaD - 1.5 * lineWidth;
        const gCZ = goalAreaW / 2 - lineWidth / 2;
        const gCXLeft = -fieldLength / 2 + goalAreaD / 2 - lineWidth / 4;
        const gCXRight = fieldLength / 2 - goalAreaD / 2 + lineWidth / 4;

        // Left goal area
        createLine(gLen, lineWidth, gCXLeft, gCZ);
        createLine(gLen, lineWidth, gCXLeft, -gCZ);
        createLine(lineWidth, goalAreaW, -fieldLength / 2 + goalAreaD - lineWidth / 2, 0);

        // Right goal area
        createLine(gLen, lineWidth, gCXRight, gCZ);
        createLine(gLen, lineWidth, gCXRight, -gCZ);
        createLine(lineWidth, goalAreaW, fieldLength / 2 - goalAreaD + lineWidth / 2, 0);

        // Penalty arcs
        const arcRadius = 9.15 * Math.min(this.scaleX, this.scaleZ);
        const arcDist = (16.5 - 11) * this.scaleX;
        const angleVal = Math.acos(Math.min(1.0, arcDist / arcRadius));

        // Left arc
        const leftArcGeom = new THREE.RingGeometry(arcRadius, arcRadius + lineWidth, 32, 1, -angleVal, angleVal * 2);
        const leftArc = new THREE.Mesh(leftArcGeom, lineMaterial);
        leftArc.rotation.x = -Math.PI / 2;
        leftArc.position.set(-fieldLength / 2 + penaltyDistance, 0.03, 0);
        this.group.add(leftArc);

        // Right arc
        const rightArcGeom = new THREE.RingGeometry(arcRadius, arcRadius + lineWidth, 32, 1, Math.PI - angleVal, angleVal * 2);
        const rightArc = new THREE.Mesh(rightArcGeom, lineMaterial);
        rightArc.rotation.x = -Math.PI / 2;
        rightArc.position.set(fieldLength / 2 - penaltyDistance, 0.03, 0);
        this.group.add(rightArc);

        // 4. Corner Arcs
        const cornerArcRadius = 1.0 * Math.min(this.scaleX, this.scaleZ);
        const createCornerArc = (cx, cz, startAngle) => {
            const cornerArcGeom = new THREE.RingGeometry(cornerArcRadius, cornerArcRadius + lineWidth, 16, 1, startAngle, Math.PI / 2);
            const cornerArc = new THREE.Mesh(cornerArcGeom, lineMaterial);
            cornerArc.rotation.x = -Math.PI / 2;
            cornerArc.position.set(cx, 0.03, cz);
            this.group.add(cornerArc);
        };

        createCornerArc(-fieldLength / 2, -fieldWidth / 2, 3 * Math.PI / 2);
        createCornerArc(-fieldLength / 2,  fieldWidth / 2, 0);
        createCornerArc( fieldLength / 2, -fieldWidth / 2, Math.PI);
        createCornerArc( fieldLength / 2,  fieldWidth / 2, Math.PI / 2);

        // 5. Corner Flags
        const createCornerFlag = (fx, fz) => {
            const flagGroup = new THREE.Group();
            
            const poleGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
            const pole = new THREE.Mesh(poleGeom, poleMat);
            pole.position.y = 0.75;
            pole.castShadow = true;
            flagGroup.add(pole);

            const clothGeom = new THREE.PlaneGeometry(0.5, 0.38);
            const clothMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
            const cloth = new THREE.Mesh(clothGeom, clothMat);
            cloth.position.set(0.25, 1.3, 0);
            flagGroup.add(cloth);

            flagGroup.position.set(fx, 0.02, fz);
            this.group.add(flagGroup);
        };

        createCornerFlag(-fieldLength / 2, -fieldWidth / 2);
        createCornerFlag(-fieldLength / 2,  fieldWidth / 2);
        createCornerFlag( fieldLength / 2, -fieldWidth / 2);
        createCornerFlag( fieldLength / 2,  fieldWidth / 2);

        // 6. Goals (Soccer Goals with nets)
        const goalWidth     = 7.32 * this.scaleZ;
        const goalHeight    = 2.44;
        const goalDepth     = 2.5 * this.scaleX;
        const postThickness = 0.15;
        const goalMaterial  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

        const createGoal = (xPos, rotationY) => {
            const goalGroup = new THREE.Group();

            // Main posts
            const postGeom = new THREE.BoxGeometry(postThickness, goalHeight, postThickness);
            
            const leftPost = new THREE.Mesh(postGeom, goalMaterial);
            leftPost.position.set(0, goalHeight / 2, goalWidth / 2);
            leftPost.castShadow = true;
            goalGroup.add(leftPost);

            const rightPost = new THREE.Mesh(postGeom, goalMaterial);
            rightPost.position.set(0, goalHeight / 2, -goalWidth / 2);
            rightPost.castShadow = true;
            goalGroup.add(rightPost);

            const crossbarGeom = new THREE.BoxGeometry(postThickness, postThickness, goalWidth + postThickness);
            const crossbar = new THREE.Mesh(crossbarGeom, goalMaterial);
            crossbar.position.set(0, goalHeight, 0);
            crossbar.castShadow = true;
            goalGroup.add(crossbar);

            // Rear net structure
            const depthBarGeom = new THREE.BoxGeometry(goalDepth, postThickness, postThickness);
            
            const topLeftDepth = new THREE.Mesh(depthBarGeom, goalMaterial);
            topLeftDepth.position.set(-goalDepth / 2, goalHeight, goalWidth / 2);
            goalGroup.add(topLeftDepth);

            const topRightDepth = new THREE.Mesh(depthBarGeom, goalMaterial);
            topRightDepth.position.set(-goalDepth / 2, goalHeight, -goalWidth / 2);
            goalGroup.add(topRightDepth);

            const backTopCrossbar = new THREE.Mesh(crossbarGeom, goalMaterial);
            backTopCrossbar.position.set(-goalDepth, goalHeight, 0);
            goalGroup.add(backTopCrossbar);

            const botLeftDepth = new THREE.Mesh(depthBarGeom, goalMaterial);
            botLeftDepth.position.set(-goalDepth / 2, postThickness / 2, goalWidth / 2);
            goalGroup.add(botLeftDepth);

            const botRightDepth = new THREE.Mesh(depthBarGeom, goalMaterial);
            botRightDepth.position.set(-goalDepth / 2, postThickness / 2, -goalWidth / 2);
            goalGroup.add(botRightDepth);
            
            const backBotCrossbar = new THREE.Mesh(crossbarGeom, goalMaterial);
            backBotCrossbar.position.set(-goalDepth, postThickness / 2, 0);
            goalGroup.add(backBotCrossbar);

            const backPostGeom = new THREE.BoxGeometry(postThickness, goalHeight, postThickness);
            const backLeftPost = new THREE.Mesh(backPostGeom, goalMaterial);
            backLeftPost.position.set(-goalDepth, goalHeight / 2, goalWidth / 2);
            goalGroup.add(backLeftPost);

            const backRightPost = new THREE.Mesh(backPostGeom, goalMaterial);
            backRightPost.position.set(-goalDepth, goalHeight / 2, -goalWidth / 2);
            goalGroup.add(backRightPost);

            // Net (Diamond net in line buffer)
            const netMaterial = new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.65 });
            
            const createNetGrid = (w, h, rotX, rotY, rotZ, nx, ny, nz) => {
                const step = 0.35;
                const points = [];
                const xmin = -w / 2, xmax = w / 2;
                const ymin = -h / 2, ymax = h / 2;
                
                const minC1 = ymin - xmax, maxC1 = ymax - xmin;
                for (let c = minC1; c <= maxC1; c += step) {
                    let pts = [];
                    let y_xmin = xmin + c; if (y_xmin >= ymin && y_xmin <= ymax) pts.push({ x: xmin, y: y_xmin });
                    let y_xmax = xmax + c; if (y_xmax >= ymin && y_xmax <= ymax) pts.push({ x: xmax, y: y_xmax });
                    let x_ymin = ymin - c; if (x_ymin > xmin && x_ymin < xmax) pts.push({ x: x_ymin, y: ymin });
                    let x_ymax = ymax - c; if (x_ymax > xmin && x_ymax < xmax) pts.push({ x: x_ymax, y: ymax });

                    if (pts.length === 2) {
                        points.push(new THREE.Vector3(pts[0].x, pts[0].y, 0));
                        points.push(new THREE.Vector3(pts[1].x, pts[1].y, 0));
                    }
                }

                const minC2 = ymin + xmin, maxC2 = ymax + xmax;
                for (let k = minC2; k <= maxC2; k += step) {
                    let pts = [];
                    let y_xmin = -xmin + k; if (y_xmin >= ymin && y_xmin <= ymax) pts.push({ x: xmin, y: y_xmin });
                    let y_xmax = -xmax + k; if (y_xmax >= ymin && y_xmax <= ymax) pts.push({ x: xmax, y: y_xmax });
                    let x_ymin = k - ymin; if (x_ymin > xmin && x_ymin < xmax) pts.push({ x: x_ymin, y: ymin });
                    let x_ymax = k - ymax; if (x_ymax > xmin && x_ymax < xmax) pts.push({ x: x_ymax, y: ymax });

                    if (pts.length === 2) {
                        points.push(new THREE.Vector3(pts[0].x, pts[0].y, 0));
                        points.push(new THREE.Vector3(pts[1].x, pts[1].y, 0));
                    }
                }

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const lineSegments = new THREE.LineSegments(geometry, netMaterial);
                lineSegments.rotation.set(rotX, rotY, rotZ);
                lineSegments.position.set(nx, ny, nz);
                return lineSegments;
            };

            const backNet  = createNetGrid(goalWidth, goalHeight, 0, Math.PI / 2, 0, -goalDepth, goalHeight / 2, 0);
            const topNet   = createNetGrid(goalWidth, goalDepth, Math.PI / 2, 0, Math.PI / 2, -goalDepth / 2, goalHeight, 0);
            const leftNet  = createNetGrid(goalDepth, goalHeight, 0, 0, 0, -goalDepth / 2, goalHeight / 2, goalWidth / 2);
            const rightNet = createNetGrid(goalDepth, goalHeight, 0, 0, 0, -goalDepth / 2, goalHeight / 2, -goalWidth / 2);

            goalGroup.add(backNet, topNet, leftNet, rightNet);
            goalGroup.position.set(xPos, 0, 0);
            if (rotationY) goalGroup.rotation.y = rotationY;

            this.group.add(goalGroup);

            // Register physical colliders in city local coordinates
            const gx = this.x + (rotationY ? -xPos : xPos);
            const gz = this.z;
            this.colliders.push(
                { type: 'box', x: gx, y: this.y + goalHeight / 2, z: gz + goalWidth / 2, hw: postThickness / 2, hh: goalHeight / 2, hd: postThickness / 2 },
                { type: 'box', x: gx, y: this.y + goalHeight / 2, z: gz - goalWidth / 2, hw: postThickness / 2, hh: goalHeight / 2, hd: postThickness / 2 },
                { type: 'box', x: gx, y: this.y + goalHeight, z: gz, hw: postThickness / 2, hh: postThickness / 2, hd: goalWidth / 2 }
            );
        };

        // Left and right goals
        createGoal(-fieldLength / 2, 0);
        createGoal(fieldLength / 2, Math.PI);
    }
}
