// Decode AWS "Terrarium" RGB-encoded elevation tiles and stitch them into a grid.
// Tiles: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
// Decode (per pixel): elevation_m = (R * 256 + G + B / 256) - 32768
import { PNG } from "pngjs";
import { TILE_SIZE } from "./tilemath.mjs";

const TERRARIUM_BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

export function tileUrl(z, x, y) {
  return `${TERRARIUM_BASE}/${z}/${x}/${y}.png`;
}

// Fetch one tile and return a Float32Array (TILE_SIZE*TILE_SIZE) of elevations in meters.
export async function fetchTileElevations(z, x, y) {
  const res = await fetch(tileUrl(z, x, y));
  if (!res.ok) throw new Error(`tile ${z}/${x}/${y} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const png = PNG.sync.read(buf);
  const out = new Float32Array(TILE_SIZE * TILE_SIZE);
  for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
    const r = png.data[i * 4];
    const g = png.data[i * 4 + 1];
    const b = png.data[i * 4 + 2];
    out[i] = r * 256 + g + b / 256 - 32768;
  }
  return out;
}

// Stitch a rectangular range of tiles into one big elevation grid.
// Returns { grid, width, height } where grid[row*width + col] is meters.
export async function stitchTiles(z, xMin, xMax, yMin, yMax) {
  const tilesX = xMax - xMin + 1;
  const tilesY = yMax - yMin + 1;
  const width = tilesX * TILE_SIZE;
  const height = tilesY * TILE_SIZE;
  const grid = new Float32Array(width * height);
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      const tile = await fetchTileElevations(z, tx, ty);
      const ox = (tx - xMin) * TILE_SIZE;
      const oy = (ty - yMin) * TILE_SIZE;
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          grid[(oy + py) * width + (ox + px)] = tile[py * TILE_SIZE + px];
        }
      }
    }
  }
  return { grid, width, height };
}

// Bilinear sample of a grid at fractional (col,row).
export function sampleGrid(grid, width, height, col, row) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(col)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(row)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = col - x0;
  const fy = row - y0;
  const a = grid[y0 * width + x0];
  const b = grid[y0 * width + x1];
  const c = grid[y1 * width + x0];
  const d = grid[y1 * width + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}
