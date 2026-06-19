// Bake real Montauk Point topography into static assets the game loads offline.
//
//   node tools/prefetch.mjs
//
// Downloads AWS Terrarium elevation tiles for the Montauk bbox, stitches + crops them
// to the area of interest, downsamples to a manageable grid, and writes:
//   assets/baked/heightmap.png       (elevation packed into R=hi byte, G=lo byte)
//   assets/baked/heightmap.meta.json (grid dims, bbox, min/max elev, meters)
//   assets/baked/manifest.json       (real vs placeholder provenance)
//
// If the elevation host is unreachable it falls back to a procedural Montauk-shaped
// heightmap so the game still runs (manifest.real = false -> HUD shows a badge).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { lonLatToTile, metersPerPixel, metersPerDegree } from "./lib/tilemath.mjs";
import { stitchTiles, sampleGrid } from "./lib/terrarium.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../assets/baked");

// --- Area of interest: Montauk Point State Park + Camp Hero + the lighthouse ---
const BBOX = { south: 41.045, west: -71.895, north: 41.085, east: -71.84 };
const ZOOM = 14;
const TARGET = 512; // output grid edge (vertices = TARGET x TARGET)

function centerLat() {
  return (BBOX.south + BBOX.north) / 2;
}

// Resample a source grid (cropped float elevations) to TARGET x TARGET via bilinear.
function resample(srcGrid, srcW, srcH, x0, y0, cropW, cropH) {
  const out = new Float32Array(TARGET * TARGET);
  for (let r = 0; r < TARGET; r++) {
    for (let c = 0; c < TARGET; c++) {
      const sc = x0 + (c / (TARGET - 1)) * (cropW - 1);
      const sr = y0 + (r / (TARGET - 1)) * (cropH - 1);
      out[r * TARGET + c] = sampleGrid(srcGrid, srcW, srcH, sc, sr);
    }
  }
  return out;
}

async function fetchReal() {
  const z = ZOOM;
  const nw = lonLatToTile(BBOX.west, BBOX.north, z);
  const se = lonLatToTile(BBOX.east, BBOX.south, z);
  const xMin = Math.floor(nw.x);
  const xMax = Math.floor(se.x);
  const yMin = Math.floor(nw.y);
  const yMax = Math.floor(se.y);
  console.log(`Fetching Terrarium z${z} tiles x[${xMin}..${xMax}] y[${yMin}..${yMax}] ...`);
  const { grid, width, height } = await stitchTiles(z, xMin, xMax, yMin, yMax);

  // Pixel window of the exact bbox within the stitched mosaic.
  const x0 = (nw.x - xMin) * 256;
  const y0 = (nw.y - yMin) * 256;
  const x1 = (se.x - xMin) * 256;
  const y1 = (se.y - yMin) * 256;
  const cropW = x1 - x0;
  const cropH = y1 - y0;

  const elev = resample(grid, width, height, x0, y0, cropW, cropH);
  // Terrarium includes ocean bathymetry (deep negatives). The ranger drives on land,
  // so clamp anything below sea level to 0 for a crisp coastline and full land precision.
  for (let i = 0; i < elev.length; i++) if (elev[i] < 0) elev[i] = 0;
  return { elev, real: true };
}

// Procedural fallback: an east-tapering peninsula ringed by sea level with gentle hills.
function fakeMontauk() {
  const elev = new Float32Array(TARGET * TARGET);
  let seed = 1337;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // a few random gradient-noise lobes
  const lobes = Array.from({ length: 24 }, () => ({
    cx: rand(), cy: rand(), r: 0.08 + rand() * 0.18, a: 8 + rand() * 22,
  }));
  for (let r = 0; r < TARGET; r++) {
    for (let c = 0; c < TARGET; c++) {
      const u = c / (TARGET - 1);
      const v = r / (TARGET - 1);
      // peninsula mask: land tapers toward the east point
      const taper = 0.34 - 0.18 * u; // narrower to the east
      const dy = Math.abs(v - 0.5);
      const land = Math.max(0, 1 - Math.pow(dy / taper, 2)) * Math.min(1, (1 - u) * 3.2 + 0.15);
      let h = 0;
      for (const lo of lobes) {
        const d = Math.hypot(u - lo.cx, v - lo.cy);
        h += lo.a * Math.max(0, 1 - d / lo.r);
      }
      elev[r * TARGET + c] = land > 0.02 ? Math.max(0, h * land) : 0;
    }
  }
  return { elev, real: false };
}

function packAndWrite(elev, real) {
  let min = Infinity, max = -Infinity;
  for (const v of elev) { if (v < min) min = v; if (v > max) max = v; }
  if (max - min < 1) max = min + 1; // avoid divide-by-zero on flat data
  const range = max - min;

  const png = new PNG({ width: TARGET, height: TARGET });
  for (let i = 0; i < TARGET * TARGET; i++) {
    const norm = Math.round(((elev[i] - min) / range) * 65535);
    png.data[i * 4] = (norm >> 8) & 255;     // R = high byte
    png.data[i * 4 + 1] = norm & 255;        // G = low byte
    png.data[i * 4 + 2] = 0;                 // B unused
    png.data[i * 4 + 3] = 255;
  }

  const lat0 = centerLat();
  const mpp = metersPerPixel(lat0, ZOOM);
  const mpd = metersPerDegree(lat0);
  const widthMeters = (BBOX.east - BBOX.west) * mpd.lon;
  const heightMeters = (BBOX.north - BBOX.south) * mpd.lat;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "heightmap.png"), PNG.sync.write(png));

  const meta = {
    gridW: TARGET, gridH: TARGET,
    minElev: min, maxElev: max,
    bbox: BBOX, zoom: ZOOM,
    metersPerPixel: mpp,
    widthMeters, heightMeters,
    originLon: BBOX.west, originLat: BBOX.north,
  };
  writeFileSync(resolve(OUT_DIR, "heightmap.meta.json"), JSON.stringify(meta, null, 2));
  writeFileSync(
    resolve(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        real,
        source: real ? `AWS Terrarium z${ZOOM} (opentopography / mapzen)` : "procedural fallback",
        location: "Montauk Point, NY",
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(
    `Wrote heightmap ${TARGET}x${TARGET}  elev ${min.toFixed(1)}..${max.toFixed(1)} m  ` +
      `area ${(widthMeters / 1000).toFixed(2)}x${(heightMeters / 1000).toFixed(2)} km  real=${real}`
  );
}

(async () => {
  let result;
  try {
    result = await fetchReal();
  } catch (err) {
    console.warn(`\n!! Real elevation fetch failed (${err.message}); using procedural fallback.\n`);
    result = fakeMontauk();
  }
  packAndWrite(result.elev, result.real);
})();
