// Loads the baked Montauk assets (heightmap PNG, metadata, roads, provenance) and
// decodes the elevation PNG back into a Float32 grid of meters.
import { CONFIG } from "../config.js";

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function decodeHeightmap(img, meta) {
  const { gridW, gridH, minElev, maxElev } = meta;
  const canvas = document.createElement("canvas");
  canvas.width = gridW;
  canvas.height = gridH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, gridW, gridH);
  const range = maxElev - minElev;
  const grid = new Float32Array(gridW * gridH);
  for (let i = 0; i < gridW * gridH; i++) {
    const norm = (data[i * 4] << 8) | data[i * 4 + 1]; // R hi, G lo
    grid[i] = minElev + (norm / 65535) * range;
  }
  return grid;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

// Returns { meta, manifest, heights (Float32Array), roads (geojson) }
export async function loadWorld(onProgress = () => {}) {
  onProgress(0.05, "Reading map metadata");
  const [meta, manifest, roads] = await Promise.all([
    loadJSON(CONFIG.assets.meta),
    loadJSON(CONFIG.assets.manifest),
    loadJSON(CONFIG.assets.roads),
  ]);

  onProgress(0.4, "Loading Montauk topography");
  const img = await loadImage(CONFIG.assets.heightmap);

  onProgress(0.7, "Decoding elevation");
  const heights = decodeHeightmap(img, meta);

  onProgress(1.0, "Ready");
  return { meta, manifest, heights, roads };
}
