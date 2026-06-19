// Arcade ranger truck. Kinematic ground-following: we integrate speed + heading on the
// XZ plane, snap Y to the terrain, and tilt the body to the slope normal. No rigid-body
// sim — stable, simple, and fun to drive over the real Montauk relief.
import * as THREE from "three";
import { CONFIG } from "../config.js";

export class Vehicle {
  constructor(heightField, startX, startZ) {
    this.hf = heightField;
    this.cfg = CONFIG.vehicle;
    this.position = new THREE.Vector3(startX, 0, startZ);
    this.heading = Math.PI; // face -Z (inland / west) initially; tuned by spawn
    this.speed = 0;
    this.mesh = this._buildMesh();
    this._up = new THREE.Vector3(0, 1, 0);
    this._normal = new THREE.Vector3(0, 1, 0);
    this._quatTilt = new THREE.Quaternion();
    this._snapToGround();
  }

  _buildMesh() {
    const g = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x2f5d3a, flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c20, flatShading: true });
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.4), green);
    body.position.y = 0.95;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 1.8), green);
    cab.position.set(0, 1.7, 0.4);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.1), glass);
    windshield.position.set(0, 1.75, -0.5);
    // light bar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.3), dark);
    bar.position.set(0, 2.2, 0.4);

    g.add(body, cab, windshield, bar);
    for (const [x, z] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.55, z);
      g.add(wheel);
    }
    g.traverse((o) => (o.castShadow = true));
    return g;
  }

  _snapToGround() {
    this.position.y = this.hf.getHeight(this.position.x, this.position.z);
  }

  update(dt, input) {
    const c = this.cfg;

    // longitudinal
    if (input.forward > 0) this.speed += c.accel * dt;
    else if (input.forward < 0) this.speed -= c.accel * dt;
    else this.speed *= Math.pow(c.drag, dt * 60); // coast
    if (input.brake) this.speed *= Math.pow(0.86, dt * 60);
    this.speed = THREE.MathUtils.clamp(this.speed, -c.maxReverse, c.maxSpeed);

    // steering scales with speed so you can't spin in place
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0, 1);
    this.heading += input.steer * c.steerRate * dt * speedFactor * Math.sign(this.speed || 1);

    // integrate on XZ
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.position.x + fx * this.speed * dt;
    let nz = this.position.z + fz * this.speed * dt;

    // keep on the island; bounce speed off the map edge
    if (!this.hf.isInBounds(nx, nz)) {
      this.speed *= -0.3;
    } else {
      this.position.x = nx;
      this.position.z = nz;
    }
    this._snapToGround();

    // orient: yaw to heading, then tilt toward slope normal
    this.hf.getNormal(this.position.x, this.position.z, this._normal);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(this._up, this.heading);
    const tiltTarget = new THREE.Quaternion().setFromUnitVectors(this._up, this._normal);
    // smooth the tilt
    this._quatTilt.slerp(tiltTarget, Math.min(1, c.tiltResponse * dt));
    this.mesh.quaternion.copy(this._quatTilt).multiply(yawQuat);
    this.mesh.position.copy(this.position);
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
