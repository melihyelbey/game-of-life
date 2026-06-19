// Spring-damped chase camera that trails behind the truck's heading and stays above the
// terrain so it never clips through hills.
import * as THREE from "three";
import { CONFIG } from "../config.js";

export class ChaseCamera {
  constructor(camera, heightField) {
    this.camera = camera;
    this.hf = heightField;
    this.cfg = CONFIG.camera;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._initialized = false;
  }

  update(dt, vehicle) {
    const c = this.cfg;
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);

    // desired position: behind + above the truck
    const desired = new THREE.Vector3(
      vehicle.position.x - fx * c.distance,
      vehicle.position.y + c.height,
      vehicle.position.z - fz * c.distance
    );
    // never let the camera dip below terrain
    const ground = this.hf.getHeight(desired.x, desired.z) + 2.5;
    if (desired.y < ground) desired.y = ground;

    if (!this._initialized) {
      this._pos.copy(desired);
      this._initialized = true;
    } else {
      this._pos.lerp(desired, Math.min(1, c.stiffness * dt));
    }

    this._look.set(
      vehicle.position.x + fx * c.lookAhead,
      vehicle.position.y + 1.5,
      vehicle.position.z + fz * c.lookAhead
    );

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
