// Builds the flat-shaded low-poly terrain mesh from the elevation grid, plus a flat
// sea plane. Vertex colors come from a height/slope ramp for the Firewatch graphic look.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { applyFogRamp } from "../render/FogRamp.js";

export function buildTerrain(heightField, meta) {
  const { gridW, gridH, widthMeters, heightMeters } = meta;

  // Plane in XZ. Segments = grid-1 so each grid sample is a vertex.
  const geo = new THREE.PlaneGeometry(widthMeters, heightMeters, gridW - 1, gridH - 1);
  geo.rotateX(-Math.PI / 2); // lie flat, Y up

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cLow = new THREE.Color(CONFIG.colors.terrainLow);
  const cMid = new THREE.Color(CONFIG.colors.terrainMid);
  const cHigh = new THREE.Color(CONFIG.colors.terrainHigh);
  const cWater = new THREE.Color(CONFIG.colors.water);
  const maxH = meta.maxElev * CONFIG.verticalExaggeration || 1;
  const tmp = new THREE.Color();

  // PlaneGeometry centers on origin; shift so local meter space starts at (0,0) in the
  // NW corner, matching the baked roads/POIs.
  const offX = widthMeters / 2;
  const offZ = heightMeters / 2;

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + offX;
    const wz = pos.getZ(i) + offZ;
    const h = heightField.getHeight(wx, wz);
    pos.setY(i, h);

    // color ramp by normalized height; near-zero reads as beach/water edge
    const t = Math.min(1, h / maxH);
    if (h <= CONFIG.waterLevel * CONFIG.verticalExaggeration + 0.05) {
      tmp.copy(cWater);
    } else if (t < 0.45) {
      tmp.copy(cLow).lerp(cMid, t / 0.45);
    } else {
      tmp.copy(cMid).lerp(cHigh, (t - 0.45) / 0.55);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // Non-indexed + flat shading => crisp per-triangle facets (the Firewatch look).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  applyFogRamp(mat);

  // Shift geometry so its NW corner sits at world origin -> world coords == local meters.
  flat.translate(offX, 0, offZ);
  const mesh = new THREE.Mesh(flat, mat);
  mesh.receiveShadow = true;

  // --- flat sea plane sized larger than the map so the horizon is all water ---
  const seaSize = Math.max(widthMeters, heightMeters) * 6;
  const seaGeo = new THREE.PlaneGeometry(seaSize, seaSize);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.water });
  applyFogRamp(seaMat);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(widthMeters / 2, CONFIG.waterLevel * CONFIG.verticalExaggeration - 0.15, heightMeters / 2);

  const group = new THREE.Group();
  group.add(mesh, sea);
  return group;
}
