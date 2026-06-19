// Builds the flat-shaded low-poly terrain mesh from the elevation grid, plus a flat
// sea plane. Vertex colors come from a height/slope ramp for the Firewatch graphic look.
// The render mesh resolution is decoupled from the physics height field so phones can
// render fewer triangles while collision stays accurate.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { applyFogRamp } from "../render/FogRamp.js";

// Procedural, tileable grass/ground texture generated on a canvas (no image files, so it
// works fully offline). It layers value-noise patches with fine, slightly-angled "blade"
// streaks and a green bias, so the vertex-colored terrain reads as real grass up close
// while sand/rock keep their hue (the texture mean stays near white and only modulates).
function makeGrassTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const tileNoise = (gridN, seedOff) => {
    const g = new Float32Array(gridN * gridN);
    let s = 12345 + seedOff;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (u, v) => {
      const fx = u * gridN, fy = v * gridN;
      const x0 = Math.floor(fx) % gridN, y0 = Math.floor(fy) % gridN;
      const x1 = (x0 + 1) % gridN, y1 = (y0 + 1) % gridN;
      let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); // smoothstep
      const a = g[y0 * gridN + x0], b = g[y0 * gridN + x1];
      const c = g[y1 * gridN + x0], e = g[y1 * gridN + x1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
    };
  };

  // soft mottling (clumps of grass) + fine grain
  const n1 = tileNoise(8, 0), n2 = tileNoise(24, 91), n3 = tileNoise(96, 13);
  // per-column "blade" seeds and a lateral wander so streaks aren't dead straight
  const bladeJitter = tileNoise(220, 7);
  const wander = tileNoise(16, 33);
  const lush = tileNoise(5, 51); // large-scale lush(green) vs dry(yellow) patches

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const patch = 0.5 * n1(u, v) + 0.32 * n2(u, v) + 0.18 * n3(u, v); // 0..1 clumps

      // vertical blade streaks: many thin bright/dark lines, gently bent by `wander`.
      const col = u + (wander(u, v) - 0.5) * 0.06;
      const blade = bladeJitter(col, v * 0.25); // 0..1 per-blade brightness
      const streak = 0.5 + (blade - 0.5) * 0.9; // sharpen the per-blade contrast

      const val = 0.6 * patch + 0.4 * streak;   // 0..1 combined
      const b = 0.72 + val * 0.34;              // brightness ~0.72..1.06 (wider grain)

      // green bias for a grassy look; lush patches greener, dry patches a touch yellow.
      const ls = lush(u, v); // 0 dry .. 1 lush
      const rr = Math.min(1, b * (0.80 + 0.10 * (1 - ls)));
      const gg = Math.min(1, b * (0.98 + 0.04 * ls));
      const bb = Math.min(1, b * (0.62 + 0.06 * ls));
      const i = (y * size + x) * 4;
      d[i] = Math.round(rr * 255);
      d[i + 1] = Math.round(gg * 255);
      d[i + 2] = Math.round(bb * 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function buildTerrain(heightField, meta) {
  const { widthMeters, heightMeters } = meta;

  // Render at exactly the height-field grid resolution so mesh vertices land on the
  // physics surface -> the truck never clips through the visible ground.
  const segX = meta.gridW - 1;
  const segZ = meta.gridH - 1;
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

  const grass = makeGrassTexture();
  grass.repeat.set(widthMeters / 14, heightMeters / 14); // ~14 m per tile -> visible blades
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    map: grass,
  });
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
