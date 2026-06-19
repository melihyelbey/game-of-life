// Big gradient sky dome. The bottom band matches the fog-far color so distant terrain
// dissolves seamlessly into the horizon (the core Firewatch depth trick).
import * as THREE from "three";
import { CONFIG } from "../config.js";

export function buildSky(radius, sunDir = new THREE.Vector3(-0.5, 0.3, 0.2).normalize()) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(CONFIG.colors.skyTop) },
      uMid: { value: new THREE.Color(CONFIG.colors.skyMid) },
      uBottom: { value: new THREE.Color(CONFIG.colors.fogFar) },
      uSunDir: { value: sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color(CONFIG.colors.sun) },
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
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = dir.y;                         // -1..1
        vec3 col;
        if (h < 0.0) {
          col = mix(uBottom, uMid, clamp(h + 1.0, 0.0, 1.0));
        } else {
          col = mix(uMid, uTop, smoothstep(0.0, 0.55, h));
        }
        // sun: broad warm halo + a soft disc
        float s = max(dot(dir, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(s, 90.0) * 0.6;          // halo
        col += uSunColor * smoothstep(0.9965, 0.9992, s) * 0.9; // disc
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}
