// Bake the Montauk road/trail network + points of interest into roads.geojson.
//
//   node tools/bake-roads.mjs
//
// OSM's Overpass API is blocked by this environment's network egress allowlist, so the
// network is hand-authored from the real Montauk Point layout (lat/lon) and projected
// into the same local-meter space as the terrain. If overpass-api.de is ever whitelisted
// this can be swapped for a live Overpass fetch with no change to the runtime.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectLocal } from "./lib/tilemath.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../assets/baked");
const meta = JSON.parse(readFileSync(resolve(OUT_DIR, "heightmap.meta.json"), "utf8"));
const { originLon, originLat } = meta;

// Real-world Montauk reference coordinates (lon, lat). The point is at the far east.
const LIGHTHOUSE = [-71.85733, 41.07097];
const RADAR_TOWER = [-71.8745, 41.0719]; // Camp Hero AN/FPS-35 "radar" (Montauk AFS)

// Polylines following the actual road geometry, west -> east.
const FEATURES = [
  {
    name: "Montauk Point State Parkway (NY-27)",
    type: "road",
    coords: [
      [-71.8930, 41.0668],
      [-71.8880, 41.0690],
      [-71.8820, 41.0702],
      [-71.8760, 41.0710],
      [-71.8700, 41.0712],
      [-71.8640, 41.0710],
      [-71.8600, 41.0706],
      [-71.8585, 41.0708], // lighthouse parking
    ],
  },
  {
    name: "Lighthouse parking loop",
    type: "road",
    coords: [
      [-71.8585, 41.0708],
      [-71.8578, 41.0712],
      [-71.8572, 41.0709],
      [-71.8576, 41.0703],
      [-71.8585, 41.0703],
      [-71.8585, 41.0708],
    ],
  },
  {
    name: "Camp Hero entrance road",
    type: "road",
    coords: [
      [-71.8760, 41.0710],
      [-71.8762, 41.0680],
      [-71.8758, 41.0655],
      [-71.8740, 41.0640],
      [-71.8710, 41.0635],
    ],
  },
  {
    name: "Radar tower spur",
    type: "road",
    coords: [
      [-71.8762, 41.0700],
      [-71.8748, 41.0712],
      [-71.8745, 41.0719],
    ],
  },
  {
    name: "Seal Haulout Trail",
    type: "trail",
    coords: [
      [-71.8585, 41.0703],
      [-71.8590, 41.0670],
      [-71.8600, 41.0640],
      [-71.8625, 41.0610],
    ],
  },
  {
    name: "Money Pond Trail",
    type: "trail",
    coords: [
      [-71.8600, 41.0706],
      [-71.8625, 41.0735],
      [-71.8660, 41.0758],
    ],
  },
];

// Points of interest: lighthouse + radar tower (real) + a Firewatch-style ranger
// lookout placed on a prominent rise inland.
const POIS = [
  { id: "lighthouse", name: "Montauk Point Lighthouse", lonlat: LIGHTHOUSE },
  { id: "radar", name: "Camp Hero Radar Tower", lonlat: RADAR_TOWER },
  { id: "lookout", name: "Ranger Lookout Tower", lonlat: [-71.8715, 41.0735] },
];

function lineFeature(f) {
  return {
    type: "Feature",
    properties: { name: f.name, roadType: f.type },
    geometry: {
      type: "LineString",
      coordinates: f.coords.map(([lon, lat]) => {
        const p = projectLocal(lon, lat, originLon, originLat);
        return [p.x, p.z];
      }),
    },
  };
}

function poiFeature(p) {
  const xy = projectLocal(p.lonlat[0], p.lonlat[1], originLon, originLat);
  return {
    type: "Feature",
    properties: { id: p.id, name: p.name, poi: true },
    geometry: { type: "Point", coordinates: [xy.x, xy.z] },
  };
}

const geojson = {
  type: "FeatureCollection",
  crs: "local-meters (origin = terrain NW corner; x east, z south)",
  features: [...FEATURES.map(lineFeature), ...POIS.map(poiFeature)],
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "roads.geojson"), JSON.stringify(geojson, null, 2));
console.log(`Wrote roads.geojson: ${FEATURES.length} ways, ${POIS.length} POIs (local meters).`);
