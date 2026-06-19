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

  // clamped-to-water corner height at integer grid (cx,cz)
  _corner(cx, cz) {
    const c = Math.max(0, Math.min(this.gridW - 1, cx));
    const r = Math.max(0, Math.min(this.gridH - 1, cz));
    return Math.max(this.water, this.heights[r * this.gridW + c]);
  }

  // bilinear (smooth) elevation in meters — used for body-tilt normals
  _bilinear(col, row) {
    const x0 = Math.floor(col), y0 = Math.floor(row);
    const fx = col - x0, fy = row - y0;
    const a = this._corner(x0, y0), b = this._corner(x0 + 1, y0);
    const d = this._corner(x0, y0 + 1), e = this._corner(x0 + 1, y0 + 1);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy;
  }

  // world (x,z) meters -> terrain height. Interpolates over the SAME triangulation that
  // PlaneGeometry uses (diagonal h01->h10), so the truck sits exactly on the rendered
  // surface instead of floating/sinking where bilinear and the flat triangles disagree.
  getHeight(x, z) {
    const col = (x / this.width) * (this.gridW - 1);
    const row = (z / this.depth) * (this.gridH - 1);
    const x0 = Math.floor(col), y0 = Math.floor(row);
    const fx = col - x0, fy = row - y0;
    const h00 = this._corner(x0, y0);       // (0,0)
    const h10 = this._corner(x0 + 1, y0);   // (1,0)
    const h01 = this._corner(x0, y0 + 1);   // (0,1)
    const h11 = this._corner(x0 + 1, y0 + 1); // (1,1)
    let h;
    if (fx + fy <= 1) {
      h = h00 + (h10 - h00) * fx + (h01 - h00) * fy;
    } else {
      h = h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fy);
    }
    return h * this.vScale;
  }

  // smooth terrain normal at world (x,z) via finite differences on the bilinear surface
  getNormal(x, z, target = new THREE.Vector3()) {
    const e = 3.0; // meters
    const toCol = (wx) => (wx / this.width) * (this.gridW - 1);
    const toRow = (wz) => (wz / this.depth) * (this.gridH - 1);
    const hL = this._bilinear(toCol(x - e), toRow(z)) * this.vScale;
    const hR = this._bilinear(toCol(x + e), toRow(z)) * this.vScale;
    const hD = this._bilinear(toCol(x), toRow(z - e)) * this.vScale;
    const hU = this._bilinear(toCol(x), toRow(z + e)) * this.vScale;
    target.set(hL - hR, 2 * e, hD - hU).normalize();
    return target;
  }

  isInBounds(x, z) {
    return x >= 0 && x <= this.width && z >= 0 && z <= this.depth;
  }
}
