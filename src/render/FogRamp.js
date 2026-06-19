// Firewatch-style distance fog: instead of one fog color, the fog blends from a cool
// near haze to a warm far color as a function of camera distance, so distant terrain
// dissolves into the (matching) horizon. Implemented by patching standard materials via
// onBeforeCompile so we keep Three's lighting + flat shading.
import * as THREE from "three";
import { CONFIG } from "../config.js";

const shared = {
  uFogNear: { value: CONFIG.fog.near },
  uFogFar: { value: CONFIG.fog.far },
  uFogColorNear: { value: new THREE.Color(CONFIG.colors.fogNear) },
  uFogColorFar: { value: new THREE.Color(CONFIG.colors.fogFar) },
};

export function getFogUniforms() {
  return shared;
}

// Patch a material in place so its fragments get the distance-ramped fog.
export function applyFogRamp(material) {
  material.fog = true; // guarantees the <fog_vertex>/<fog_fragment> include hooks exist
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFogNear = shared.uFogNear;
    shader.uniforms.uFogFar = shared.uFogFar;
    shader.uniforms.uFogColorNear = shared.uFogColorNear;
    shader.uniforms.uFogColorFar = shared.uFogColorFar;

    shader.vertexShader =
      "varying float vRampDepth;\n" +
      shader.vertexShader.replace(
        "#include <fog_vertex>",
        "vRampDepth = -mvPosition.z;"
      );

    shader.fragmentShader =
      "uniform float uFogNear;\nuniform float uFogFar;\n" +
      "uniform vec3 uFogColorNear;\nuniform vec3 uFogColorFar;\n" +
      "varying float vRampDepth;\n" +
      shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `
        float fogF = smoothstep(uFogNear, uFogFar, vRampDepth);
        vec3 rampColor = mix(uFogColorNear, uFogColorFar, fogF);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, rampColor, fogF);
        `
      );
  };
  // make sure the #include <fog_vertex> exists so our replace hits; standard materials
  // include it. needsUpdate ensures recompilation if material was already used.
  material.needsUpdate = true;
  return material;
}
