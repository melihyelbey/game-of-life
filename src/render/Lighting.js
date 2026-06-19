// Warm dusk lighting: a low golden key light plus a sky/ground hemisphere fill.
import * as THREE from "three";
import { CONFIG } from "../config.js";

export function buildLighting(worldSize) {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(CONFIG.colors.sun, 2.1);
  sun.position.set(-worldSize * 0.4, worldSize * 0.35, worldSize * 0.25);
  sun.target.position.set(worldSize * 0.5, 0, worldSize * 0.5);
  group.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(
    CONFIG.colors.ambientSky,
    CONFIG.colors.ambientGround,
    0.9
  );
  group.add(hemi);

  return group;
}
