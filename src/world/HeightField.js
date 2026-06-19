// Fast terrain queries decoupled from the render mesh. Holds the raw elevation grid and
// provides bilinear height + slope-normal lookups in world meters. The vehicle, camera,
// roads and POIs all sit on the ground via this — far cheaper/steadier than raycasting.
import * as THREE from "three";
import { CONFIG } from "../config.js";

// Bilinear sample of a raw grid at fractional (col,row), clamped to edges.
function bilinear(grid, w, h, col, row) {
  const c = Math.max(0, Math.min(w - 1, col));
  const r = Math.max(0, Math.min(h - 1, row));
  const x0 = Math.floor(c), y0 = Math.floor(r);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = c - x0, fy = r - y0;
  const a = grid[y0 * w + x0], b = grid[y0 * w + x1];
  const d = grid[y1 * w + x0], e = grid[y1 * w + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy;
}

// Resample the elevation grid to a coarser resolution. The terrain mesh and the physics
// height field then share the SAME grid, so the truck rests exactly on the visible
// surface (no clipping through decimated geometry).
export function downsampleHeights(src, meta, target) {
  const dstW = Math.max(2, Math.min(target, meta.gridW));
  const dstH = Math.max(2, Math.min(target, meta.gridH));
  const out = new Float32Array(dstW * dstH);
  for (let r = 0; r < dstH; r++) {
    for (let c = 0; c < dstW; c++) {
      const sc = (c / (dstW - 1)) * (meta.gridW - 1);
      const sr = (r / (dstH - 1)) * (meta.gridH - 1);
      out[r * dstW + c] = bilinear(src, meta.gridW, meta.gridH, sc, sr);
    }
  }
  return { grid: out, meta: { ...meta, gridW: dstW, gridH: dstH } };
}

export class HeightField {
  constructor(heights, meta) {
    this.heights = heights;
    this.gridW = meta.gridW;
    this.gridH = meta.gridH;
    this.width = meta.widthMeters;   // x extent (east)
    this.depth = meta.heightMeters;  // z extent (south)
    this.vScale = CONFIG.verticalExaggeration;
    this.water = CONFIG.waterLevel;
  }

  // raw bilinear elevation (meters) at grid-space (col,row), clamped to edges
  _sampleGrid(col, row) {
    const { gridW, gridH, heights } = this;
    const c = Math.max(0, Math.min(gridW - 1, col));
    const r = Math.max(0, Math.min(gridH - 1, row));
    const x0 = Math.floor(c), y0 = Math.floor(r);
    const x1 = Math.min(gridW - 1, x0 + 1), y1 = Math.min(gridH - 1, y0 + 1);
    const fx = c - x0, fy = r - y0;
    const a = heights[y0 * gridW + x0];
    const b = heights[y0 * gridW + x1];
    const d = heights[y1 * gridW + x0];
    const e = heights[y1 * gridW + x1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy;
  }

  // world (x,z) meters -> terrain height (meters, exaggerated)
  getHeight(x, z) {
    const col = (x / this.width) * (this.gridW - 1);
    const row = (z / this.depth) * (this.gridH - 1);
    return Math.max(this.water, this._sampleGrid(col, row)) * this.vScale;
  }

  // terrain surface normal at world (x,z) via finite differences
  getNormal(x, z, target = new THREE.Vector3()) {
    const e = 2.0; // meters
    const hL = this.getHeight(x - e, z);
    const hR = this.getHeight(x + e, z);
    const hD = this.getHeight(x, z - e);
    const hU = this.getHeight(x, z + e);
    target.set(hL - hR, 2 * e, hD - hU).normalize();
    return target;
  }

  isInBounds(x, z) {
    return x >= 0 && x <= this.width && z >= 0 && z <= this.depth;
  }
}
