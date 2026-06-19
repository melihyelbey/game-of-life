// Big gradient sky dome. The bottom band matches the fog-far color so distant terrain
// dissolves seamlessly into the horizon (the core Firewatch depth trick).
import * as THREE from "three";
import { CONFIG } from "../config.js";

export function buildSky(radius) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(CONFIG.colors.skyTop) },
      uMid: { value: new THREE.Color(CONFIG.colors.skyMid) },
      uBottom: { value: new THREE.Color(CONFIG.colors.fogFar) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      void main() {
        float h = normalize(vWorld).y;          // -1..1
        vec3 col;
        if (h < 0.0) {
          col = mix(uBottom, uMid, clamp(h + 1.0, 0.0, 1.0));
        } else {
          col = mix(uMid, uTop, smoothstep(0.0, 0.55, h));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}
