// Low-poly vegetation scattered across the real terrain. Firewatch leans on shape and
// silhouette rather than texture, so these are flat-shaded instanced pines + bushes —
// thousands of them for almost no cost via InstancedMesh. Placement uses the height field
// to avoid water, beaches and steep slopes.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { applyFogRamp } from "../render/FogRamp.js";

// Merge several colored part-geometries into one non-indexed geometry with a color attr
// (no addon dependency — we only vendor three core).
function mergeColored(parts) {
  let total = 0;
  const prepped = parts.map(({ geo, color }) => {
    const g = geo.toNonIndexed();
    g.computeVertexNormals();
    total += g.attributes.position.count;
    return { g, color: new THREE.Color(color) };
  });
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const colorArr = new Float32Array(total * 3);
  let o = 0;
  for (const { g, color } of prepped) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      position[(o + i) * 3] = p.getX(i);
      position[(o + i) * 3 + 1] = p.getY(i);
      position[(o + i) * 3 + 2] = p.getZ(i);
      normal[(o + i) * 3] = n.getX(i);
      normal[(o + i) * 3 + 1] = n.getY(i);
      normal[(o + i) * 3 + 2] = n.getZ(i);
      colorArr[(o + i) * 3] = color.r;
      colorArr[(o + i) * 3 + 1] = color.g;
      colorArr[(o + i) * 3 + 2] = color.b;
    }
    o += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));
  return merged;
}

function pineGeometry() {
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5);
  trunk.translate(0, 0.8, 0);
  const lower = new THREE.ConeGeometry(1.5, 2.6, 6);
  lower.translate(0, 2.6, 0);
  const upper = new THREE.ConeGeometry(1.0, 2.0, 6);
  upper.translate(0, 4.0, 0);
  return mergeColored([
    { geo: trunk, color: 0x5b4127 },
    { geo: lower, color: 0x3f6b3a },
    { geo: upper, color: 0x4f7d44 },
  ]);
}

function bushGeometry() {
  const a = new THREE.IcosahedronGeometry(0.9, 0);
  a.translate(0, 0.7, 0);
  return mergeColored([{ geo: a, color: 0x6f8348 }]);
}

function scatterInstanced(geo, count, heightField, opts) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  applyFogRamp(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const seaY = CONFIG.waterLevel * CONFIG.verticalExaggeration;
  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  let placed = 0;
  let guard = 0;
  // deterministic PRNG so the forest is stable between loads
  let seed = opts.seed || 9001;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  while (placed < count && guard < count * 40) {
    guard++;
    const x = rand() * heightField.width;
    const z = rand() * heightField.depth;
    const h = heightField.getHeight(x, z);
    if (h <= seaY + opts.minHeight) continue; // skip water + beach
    heightField.getNormal(x, z, normal);
    if (1 - normal.y > opts.maxSlope) continue; // skip steep cliffs
    const s = opts.scaleMin + rand() * (opts.scaleMax - opts.scaleMin);
    dummy.position.set(x, h - 0.2, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Returns a Group of instanced pines + bushes for the whole map.
export function buildScatter(heightField, density = 1) {
  const group = new THREE.Group();
  group.add(
    scatterInstanced(pineGeometry(), Math.round(900 * density), heightField, {
      minHeight: 2.0, maxSlope: 0.32, scaleMin: 0.8, scaleMax: 1.9, seed: 1234,
    })
  );
  group.add(
    scatterInstanced(bushGeometry(), Math.round(700 * density), heightField, {
      minHeight: 1.0, maxSlope: 0.42, scaleMin: 0.7, scaleMax: 1.6, seed: 5678,
    })
  );
  return group;
}
