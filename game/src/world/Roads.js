// Drapes the baked road/trail network over the terrain as lifted ribbon meshes.
// GeoJSON coords are already in local meters (x east, z south) == world coords.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { applyFogRamp } from "../render/FogRamp.js";

const LIFT = 0.25; // meters above terrain to avoid z-fighting
const STEP = 12;   // meters; densify polylines so ribbons hug the terrain

// Resample a polyline so no segment is longer than STEP — otherwise a ribbon bridges
// straight across dips/rises in the real terrain (floating or cutting through hills).
function densify(coords) {
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [x0, z0] = coords[i - 1];
    const [x1, z1] = coords[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / STEP));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  }
  return out;
}

function ribbonForLine(rawCoords, halfWidth, heightField) {
  const coords = densify(rawCoords);
  const positions = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (let i = 0; i < coords.length; i++) {
    // tangent: average of adjacent segment directions
    const cur = coords[i];
    const prev = coords[Math.max(0, i - 1)];
    const next = coords[Math.min(coords.length - 1, i + 1)];
    dir.set(next[0] - prev[0], 0, next[1] - prev[1]);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();
    const side = new THREE.Vector3().crossVectors(up, dir).normalize();

    a.set(cur[0] - side.x * halfWidth, 0, cur[1] - side.z * halfWidth);
    b.set(cur[0] + side.x * halfWidth, 0, cur[1] + side.z * halfWidth);
    a.y = heightField.getHeight(a.x, a.z) + LIFT;
    b.y = heightField.getHeight(b.x, b.z) + LIFT;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);

    if (i < coords.length - 1) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { positions, indices };
}

export function buildRoads(geojson, heightField) {
  const group = new THREE.Group();
  const buckets = {
    road: { positions: [], indices: [], color: CONFIG.colors.road, half: 4 },
    trail: { positions: [], indices: [], color: CONFIG.colors.trail, half: 1.4 },
  };

  for (const f of geojson.features) {
    if (f.geometry.type !== "LineString") continue;
    const type = f.properties.roadType === "trail" ? "trail" : "road";
    const bucket = buckets[type];
    const { positions, indices } = ribbonForLine(
      f.geometry.coordinates,
      bucket.half,
      heightField
    );
    const base = bucket.positions.length / 3;
    bucket.positions.push(...positions);
    for (const idx of indices) bucket.indices.push(base + idx);
  }

  for (const key of Object.keys(buckets)) {
    const b = buckets[key];
    if (b.positions.length === 0) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
    geo.setIndex(b.indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({
      color: b.color,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    applyFogRamp(mat);
    group.add(new THREE.Mesh(geo, mat));
  }
  return group;
}
