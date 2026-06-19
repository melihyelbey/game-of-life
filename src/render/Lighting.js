// Warm dusk lighting: a low golden key light, a soft cool fill from the opposite side,
// and a sky/ground hemisphere to lift the shadows just enough for the graphic look.
import * as THREE from "three";
import { CONFIG } from "../config.js";

export function buildLighting(worldSize) {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(CONFIG.colors.sun, 2.3);
  sun.position.set(-worldSize * 0.5, worldSize * 0.3, worldSize * 0.2);
  sun.target.position.set(worldSize * 0.5, 0, worldSize * 0.5);
  group.add(sun, sun.target);

  // cool rim/fill from the dusk side, keeps shadowed slopes from going muddy
  const fill = new THREE.DirectionalLight(0x6f86b0, 0.5);
  fill.position.set(worldSize * 0.5, worldSize * 0.25, -worldSize * 0.3);
  group.add(fill);

  const hemi = new THREE.HemisphereLight(
    CONFIG.colors.ambientSky,
    CONFIG.colors.ambientGround,
    1.15
  );
  group.add(hemi);

  return group;
}
