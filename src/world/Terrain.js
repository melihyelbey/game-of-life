// Builds the flat-shaded low-poly terrain mesh from the elevation grid, plus a flat
// sea plane. Vertex colors come from a height/slope ramp for the Firewatch graphic look.
// The render mesh resolution is decoupled from the physics height field so phones can
// render fewer triangles while collision stays accurate.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { applyFogRamp } from "../render/FogRamp.js";

export function buildTerrain(heightField, meta, segments = 384) {
  const { widthMeters, heightMeters } = meta;

  const segX = Math.min(segments, meta.gridW - 1);
  const segZ = Math.min(segments, meta.gridH - 1);
  const geo = new THREE.PlaneGeometry(widthMeters, heightMeters, segX, segZ);
  geo.rotateX(-Math.PI / 2); // lie flat, Y up

  const offX = widthMeters / 2;
  const offZ = heightMeters / 2;

  // Sample the height field (full resolution) at each mesh vertex.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + offX;
    const wz = pos.getZ(i) + offZ;
    pos.setY(i, heightField.getHeight(wx, wz));
  }
  geo.translate(offX, 0, offZ); // NW corner at world origin -> world coords == local meters

  // Non-indexed + flat shading => crisp per-triangle facets (the Firewatch look).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();

  // Per-face color from a height/slope ramp, with a touch of per-facet variation so the
  // low-poly surface reads as faceted rather than flat-painted.
  const fpos = flat.attributes.position;
  const fnorm = flat.attributes.normal;
  const colors = new Float32Array(fpos.count * 3);
  const cBeach = new THREE.Color(CONFIG.colors.terrainLow);
  const cScrub = new THREE.Color(CONFIG.colors.terrainMid);
  const cBluff = new THREE.Color(CONFIG.colors.terrainHigh);
  const cRock = new THREE.Color(0x6b6256);
  const cWater = new THREE.Color(CONFIG.colors.water);
  const vScale = CONFIG.verticalExaggeration;
  const seaY = CONFIG.waterLevel * vScale;
  const maxH = (meta.maxElev * vScale) || 1;
  const tmp = new THREE.Color();

  for (let f = 0; f < fpos.count; f += 3) {
    // face height = average of its 3 verts; slope from face normal
    const hy = (fpos.getY(f) + fpos.getY(f + 1) + fpos.getY(f + 2)) / 3;
    const slope = 1 - Math.abs(fnorm.getY(f)); // 0 flat .. 1 vertical
    const t = Math.min(1, hy / maxH);

    if (hy <= seaY + 0.4) {
      tmp.copy(cWater).lerp(cBeach, Math.min(1, (hy - seaY) / 0.4 + 0.2));
    } else if (t < 0.18) {
      tmp.copy(cBeach).lerp(cScrub, t / 0.18);       // dune/beach -> scrub
    } else if (t < 0.6) {
      tmp.copy(cScrub).lerp(cBluff, (t - 0.18) / 0.42); // scrub -> warm bluff
    } else {
      tmp.copy(cBluff);
    }
    // steep faces lean toward exposed rock/earth
    if (slope > 0.45) tmp.lerp(cRock, Math.min(0.6, (slope - 0.45) * 1.4));

    // subtle per-facet brightness jitter (deterministic by face index)
    const jitter = 0.94 + ((Math.sin(f * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.12;
    tmp.multiplyScalar(jitter);

    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = tmp.r;
      colors[(f + k) * 3 + 1] = tmp.g;
      colors[(f + k) * 3 + 2] = tmp.b;
    }
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  applyFogRamp(mat);
  const mesh = new THREE.Mesh(flat, mat);

  // --- flat sea plane sized larger than the map so the horizon is all water ---
  const seaSize = Math.max(widthMeters, heightMeters) * 6;
  const seaGeo = new THREE.PlaneGeometry(seaSize, seaSize);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.water });
  applyFogRamp(seaMat);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(widthMeters / 2, seaY - 0.15, heightMeters / 2);

  const group = new THREE.Group();
  group.add(mesh, sea);
  return group;
}
