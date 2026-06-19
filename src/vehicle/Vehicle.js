// Arcade ranger truck. Kinematic ground-following: we integrate speed + heading on the
// XZ plane, snap Y to the terrain, and tilt the body to the slope normal. No rigid-body
// sim — stable, simple, and fun to drive over the real Montauk relief. Visual flourishes:
// spinning wheels, steered front wheels, and speed/steer-based body roll.
import * as THREE from "three";
import { CONFIG } from "../config.js";

export class Vehicle {
  constructor(heightField, startX, startZ) {
    this.hf = heightField;
    this.cfg = CONFIG.vehicle;
    this.position = new THREE.Vector3(startX, 0, startZ);
    this.heading = Math.PI;
    this.speed = 0;
    this.obstacleField = null; // spatial hash of solid landmarks + trees
    this.carRadius = 1.2;
    this._wheelSpin = 0;
    this._roll = 0;        // smoothed body roll from steering
    this._steerVis = 0;    // smoothed visual steer angle for front wheels
    this.frontWheels = [];
    this.allWheels = [];
    this.mesh = this._buildMesh();
    this._up = new THREE.Vector3(0, 1, 0);
    this._normal = new THREE.Vector3(0, 1, 0);
    this._quatTilt = new THREE.Quaternion();
    this._tmpQuat = new THREE.Quaternion();
    this._snapToGround();
  }

  _buildMesh() {
    const g = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x32683f, flatShading: true });
    const greenDark = new THREE.MeshLambertMaterial({ color: 0x244c2e, flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c20, flatShading: true });
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8, flatShading: true });
    const amber = new THREE.MeshBasicMaterial({ color: 0xffcaa0 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), green);
    body.position.y = 0.95;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 2.0), greenDark);
    bed.position.set(0, 1.05, -1.0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 1.7), green);
    cab.position.set(0, 1.6, 0.55);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.62, 0.12), glass);
    windshield.position.set(0, 1.68, -0.28);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.28), dark);
    bar.position.set(0, 2.12, 0.55);
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.24), amber);
    beacon.position.set(0, 2.26, 0.55);
    // headlights
    for (const x of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.1), amber);
      hl.position.set(x, 0.95, 2.21);
      g.add(hl);
    }

    g.add(body, bed, cab, windshield, bar, beacon);

    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 14);
    wheelGeo.rotateZ(Math.PI / 2); // axle along X
    for (const [x, z, front] of [[-1.0, 1.45, true], [1.0, 1.45, true], [-1.0, -1.45, false], [1.0, -1.45, false]]) {
      // pivot group lets us steer (yaw) the front wheels without losing spin
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.55, z);
      const wheel = new THREE.Mesh(wheelGeo, dark);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.44, 8), green);
      hub.rotation.z = Math.PI / 2;
      pivot.add(wheel, hub);
      g.add(pivot);
      this.allWheels.push(wheel);
      if (front) this.frontWheels.push(pivot);
    }

    g.traverse((o) => (o.castShadow = true));
    return g;
  }

  _snapToGround() {
    this.position.y = this.hf.getHeight(this.position.x, this.position.z);
  }

  update(dt, input) {
    const c = this.cfg;

    // longitudinal: throttle / brake-reverse / gentle coast
    if (input.forward > 0) {
      this.speed += c.accel * dt;
    } else if (input.forward < 0) {
      this.speed -= c.accel * 0.85 * dt; // brake, then accelerate into reverse
    } else {
      // coast: light aero drag (per-second) + constant rolling resistance to a stop
      this.speed *= Math.pow(c.drag, dt);
      const rr = c.rollResist * dt;
      if (Math.abs(this.speed) <= rr) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * rr;
    }
    if (input.brake) {
      const bd = c.brake * dt;
      if (Math.abs(this.speed) <= bd) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * bd;
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -c.maxReverse, c.maxSpeed);
    if (Math.abs(this.speed) < 0.02) this.speed = 0;

    // steering scales with speed so you can't pivot in place; invert when reversing
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0, 1);
    const steerInput = input.steer * (this.speed < 0 ? -1 : 1);
    this.heading += steerInput * c.steerRate * dt * speedFactor;

    // integrate on XZ
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.position.x + fx * this.speed * dt;
    let nz = this.position.z + fz * this.speed * dt;

    // Solid collision (towers + trees). Push out to the boundary and only damp the
    // velocity component heading INTO the obstacle — tangential motion is preserved so
    // you slide smoothly past instead of sticking when grazing an edge.
    if (this.obstacleField) {
      const near = this.obstacleField.queryNear(nx, nz);
      for (const o of near) {
        const dx = nx - o.x;
        const dz = nz - o.z;
        const minDist = o.radius + this.carRadius;
        const dist = Math.hypot(dx, dz);
        if (dist < minDist && dist > 1e-4) {
          const nrmX = dx / dist;
          const nrmZ = dz / dist;
          nx = o.x + nrmX * minDist; // place exactly on the boundary
          nz = o.z + nrmZ * minDist;
          const heelingIn = fx * nrmX + fz * nrmZ; // <0 => moving into the obstacle
          if (this.speed * heelingIn < 0) this.speed *= -0.2; // head-on bump
          // grazing (heelingIn ~ 0): keep speed -> slides around
        }
      }
    }

    if (!this.hf.isInBounds(nx, nz)) {
      this.speed *= -0.3; // soft bounce off the island edge
    } else {
      this.position.x = nx;
      this.position.z = nz;
    }
    this._snapToGround();

    // --- orientation: yaw to heading, tilt to slope, add steer roll ---
    this.hf.getNormal(this.position.x, this.position.z, this._normal);
    const targetRoll = -input.steer * speedFactor * 0.12;
    this._roll += (targetRoll - this._roll) * Math.min(1, 8 * dt);

    const yawQuat = this._tmpQuat.setFromAxisAngle(this._up, this.heading);
    const tiltTarget = new THREE.Quaternion().setFromUnitVectors(this._up, this._normal);
    this._quatTilt.slerp(tiltTarget, Math.min(1, c.tiltResponse * dt));
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this._roll);
    this.mesh.quaternion.copy(this._quatTilt).multiply(yawQuat).multiply(rollQuat);
    this.mesh.position.copy(this.position);

    // --- wheels: spin with travel, steer the fronts ---
    this._wheelSpin -= (this.speed * dt) / 0.55;
    for (const w of this.allWheels) w.rotation.x = this._wheelSpin;
    this._steerVis += (input.steer * 0.5 - this._steerVis) * Math.min(1, 10 * dt);
    for (const p of this.frontWheels) p.rotation.y = this._steerVis;
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
