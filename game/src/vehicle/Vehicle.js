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
    this.vy = 0;             // vertical velocity (jumps / gravity)
    this.airborne = false;
    this.airVel = { x: 0, z: 0 }; // ballistic horizontal velocity while airborne
    this._pitch = 0;         // smoothed body pitch (flight arc)
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

  // Teleport the truck to a fresh pose and clear all motion (used to send the player back
  // to the start of the parkour course after a fall).
  respawn(x, z, heading = this.heading) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.vy = 0;
    this.airborne = false;
    this.airVel.x = 0;
    this.airVel.z = 0;
    this._pitch = 0;
    this._snapToGround();
    this.mesh.position.copy(this.position);
  }

  update(dt, input) {
    const c = this.cfg;
    const grounded = !this.airborne;

    // ---------- longitudinal control (only on the ground) ----------
    if (grounded) {
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

      // slope gravity: climbing a hill steals speed, descending adds it (real-ish).
      const fx0 = Math.sin(this.heading), fz0 = Math.cos(this.heading);
      const e = 2.5;
      const hHere = this.hf.getHeight(this.position.x, this.position.z);
      const hAhead = this.hf.getHeight(this.position.x + fx0 * e, this.position.z + fz0 * e);
      const slope = (hAhead - hHere) / e;
      const sinT = slope / Math.sqrt(1 + slope * slope);
      this.speed -= c.gravity * c.slopePull * sinT * dt;

      this.speed = THREE.MathUtils.clamp(this.speed, -c.maxReverse, c.maxSpeed);
      if (Math.abs(this.speed) < 0.02 && input.forward === 0) this.speed = 0;
    }

    // ---------- steering (full on ground, reduced in air) ----------
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0, 1);
    const steerAuth = grounded ? 1 : 0.5;
    const steerInput = input.steer * (this.speed < 0 ? -1 : 1);
    this.heading += steerInput * c.steerRate * dt * speedFactor * steerAuth;

    // ---------- horizontal velocity ----------
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let velX, velZ;
    if (grounded) {
      velX = fx * this.speed;
      velZ = fz * this.speed;
    } else {
      // ballistic flight: keep takeoff velocity, allow a little air steering
      const airSpeed = Math.hypot(this.airVel.x, this.airVel.z);
      const k = Math.min(1, c.airControl * dt);
      this.airVel.x += (fx * airSpeed - this.airVel.x) * k;
      this.airVel.z += (fz * airSpeed - this.airVel.z) * k;
      velX = this.airVel.x;
      velZ = this.airVel.z;
    }
    let nx = this.position.x + velX * dt;
    let nz = this.position.z + velZ * dt;

    // Solid collision (towers + trees). Resolve against circles and axis-aligned boxes by
    // pushing out along the contact normal, and only damp the velocity component heading
    // INTO the obstacle so tangential motion is preserved (you slide past edges instead of
    // sticking, and can't dive into square-tower corners).
    if (this.obstacleField) {
      const r = this.carRadius;
      const near = this.obstacleField.queryNear(nx, nz);
      for (const o of near) {
        let nrmX = 0, nrmZ = 0, hit = false;
        if (o.halfX !== undefined) {
          // box: closest point on the AABB to the car centre
          const cpx = Math.max(o.x - o.halfX, Math.min(nx, o.x + o.halfX));
          const cpz = Math.max(o.z - o.halfZ, Math.min(nz, o.z + o.halfZ));
          let dx = nx - cpx, dz = nz - cpz;
          let d = Math.hypot(dx, dz);
          if (d > 1e-4 && d < r) {
            nrmX = dx / d; nrmZ = dz / d;
            nx = cpx + nrmX * r; nz = cpz + nrmZ * r;
            hit = true;
          } else if (d <= 1e-4) {
            // centre inside the box -> eject along the axis of least penetration
            const penX = o.halfX + r - Math.abs(nx - o.x);
            const penZ = o.halfZ + r - Math.abs(nz - o.z);
            if (penX < penZ) {
              nrmX = nx >= o.x ? 1 : -1;
              nx = o.x + nrmX * (o.halfX + r);
            } else {
              nrmZ = nz >= o.z ? 1 : -1;
              nz = o.z + nrmZ * (o.halfZ + r);
            }
            hit = true;
          }
        } else {
          const dx = nx - o.x, dz = nz - o.z;
          const minDist = o.radius + r;
          const dist = Math.hypot(dx, dz);
          if (dist < minDist && dist > 1e-4) {
            nrmX = dx / dist; nrmZ = dz / dist;
            nx = o.x + nrmX * minDist; nz = o.z + nrmZ * minDist;
            hit = true;
          }
        }
        if (hit) {
          // damp only motion heading INTO the obstacle (slide along edges)
          const heelingIn = velX * nrmX + velZ * nrmZ; // <0 => moving inward
          if (heelingIn < 0) {
            this.speed *= -0.2;
            this.airVel.x *= -0.2;
            this.airVel.z *= -0.2;
          }
        }
      }
    }

    let inBounds = true;
    if (!this.hf.isInBounds(nx, nz)) {
      inBounds = false;
      this.speed *= -0.3; // soft bounce off the island edge
    } else {
      // Don't let the truck drive INTO a raised feature's near-vertical face (a ramp's
      // back wall or sides). The deck is a gentle slope and passes; a wall is a sudden
      // step up far steeper than we could climb. Without this the ground teleports up
      // under the truck and the slope-launch logic below flings it into the air when you
      // hit the ramp from behind. Bump off it like any solid obstacle instead.
      const fNew = this.hf.getFeatureHeight(nx, nz);
      const horiz = Math.hypot(nx - this.position.x, nz - this.position.z);
      const isWall = grounded && fNew !== null &&
        (fNew - this.position.y) > horiz * c.maxClimbSlope + 0.05;
      if (isWall) {
        this.speed *= -0.2; // scrub speed, keep the old (x,z) so we stay below the lip
      } else {
        this.position.x = nx;
        this.position.z = nz;
      }
    }

    // ---------- vertical: jumps + gravity (the classic car-game airtime) ----------
    const groundY = this.hf.getHeight(this.position.x, this.position.z);
    this.vy -= c.gravity * dt;
    let ny = this.position.y + this.vy * dt;

    if (ny <= groundY + 0.06) {
      // on / hitting the ground
      ny = groundY;
      if (this.airborne) {
        // landed: convert ballistic velocity back to ground speed along the heading
        const land = Math.hypot(this.airVel.x, this.airVel.z);
        this.speed = (this.speed < 0 ? -1 : 1) * land;
        if (-this.vy > 14) this.speed *= 0.88; // scrub a little on a hard landing
        this.airborne = false;
      }
      // Follow the ground via the slope the truck JUST CLIMBED (backward difference over a
      // few metres), not the raw frame-to-frame height jump. vy = speed * slope:
      //  - climbing a hill/ramp builds upward velocity that flings you off the crest (the
      //    backward slope is still positive at the lip, so the launch is preserved),
      //  - a surface that simply steps up under you (driving onto the ramp) ramps the slope
      //    in smoothly instead of producing a one-frame spike, so it no longer flings you.
      const e2 = 2.6;
      const fxh = Math.sin(this.heading), fzh = Math.cos(this.heading);
      const hBehind = this.hf.getHeight(this.position.x - fxh * e2, this.position.z - fzh * e2);
      const slopeF = (groundY - hBehind) / e2;
      const cap = Math.abs(this.speed) * 1.5 + 8;
      this.vy = THREE.MathUtils.clamp(this.speed * slopeF, -cap, cap);
    } else {
      // leaving / in the air
      if (!this.airborne) {
        this.airborne = true;
        this.airVel.x = velX; // snapshot takeoff velocity
        this.airVel.z = velZ;
      }
    }
    this.position.y = ny;

    // ---------- orientation ----------
    const targetRoll = grounded ? -input.steer * speedFactor * 0.12 : this._roll * 0.9;
    this._roll += (targetRoll - this._roll) * Math.min(1, 8 * dt);
    const yawQuat = this._tmpQuat.setFromAxisAngle(this._up, this.heading);
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this._roll);

    if (this.airborne) {
      // pitch the nose to the flight arc (up while rising, down while falling)
      const horiz = Math.hypot(velX, velZ);
      const targetPitch = Math.atan2(this.vy, Math.max(horiz, 3));
      this._pitch += (targetPitch - this._pitch) * Math.min(1, c.airPitch * dt);
      this._quatTilt.slerp(new THREE.Quaternion(), Math.min(1, 3 * dt)); // level out roll-tilt
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this._pitch);
      this.mesh.quaternion.copy(this._quatTilt).multiply(yawQuat).multiply(pitchQuat).multiply(rollQuat);
    } else {
      this.hf.getNormal(this.position.x, this.position.z, this._normal);
      const tiltTarget = new THREE.Quaternion().setFromUnitVectors(this._up, this._normal);
      this._quatTilt.slerp(tiltTarget, Math.min(1, c.tiltResponse * dt));
      this._pitch *= 0.8;
      this.mesh.quaternion.copy(this._quatTilt).multiply(yawQuat).multiply(rollQuat);
    }
    this.mesh.position.copy(this.position);

    // --- wheels: spin with travel, steer the fronts ---
    this._wheelSpin -= (Math.hypot(velX, velZ) * Math.sign(this.speed || 1) * dt) / 0.55;
    for (const w of this.allWheels) w.rotation.x = this._wheelSpin;
    this._steerVis += (input.steer * 0.5 - this._steerVis) * Math.min(1, 10 * dt);
    for (const p of this.frontWheels) p.rotation.y = this._steerVis;
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
