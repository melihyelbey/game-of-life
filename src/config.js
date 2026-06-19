// Central tuning for Montauk Ranger. All world geometry lives in a single planar
// meter space whose origin is the terrain's NW corner (x -> east, z -> south), matching
// the baked assets in assets/baked/.

export const CONFIG = {
  assets: {
    heightmap: "assets/baked/heightmap.png",
    meta: "assets/baked/heightmap.meta.json",
    roads: "assets/baked/roads.geojson",
    manifest: "assets/baked/manifest.json",
  },

  // Montauk's real relief is gentle (~36 m). Exaggerate vertically so driving has drama.
  verticalExaggeration: 1.6,
  waterLevel: 0.0, // meters; sea rendered as a flat plane at this height

  // Firewatch-inspired dusk palette ------------------------------------------------
  colors: {
    skyTop: 0x1f3a5f,      // deep dusk blue
    skyMid: 0xd98a5a,      // warm amber band
    skyBottom: 0xf2c98a,   // pale gold horizon
    fogNear: 0x8fb3c4,     // cool near haze
    fogFar: 0xe8a06a,      // warm dusk orange (matches horizon)
    sun: 0xffd9a0,
    ambientSky: 0x9fb6d4,
    ambientGround: 0x4a3b2a,
    terrainLow: 0xc8b27a,  // sandy lowland / dune
    terrainMid: 0x6f8b54,  // scrub green
    terrainHigh: 0x8a6b46, // warm bluff earth
    water: 0x35617a,
    road: 0x4a4540,
    trail: 0xb08a55,
  },

  fog: { near: 120, far: 2600 },

  vehicle: {
    maxSpeed: 28,        // m/s forward (~100 km/h)
    maxReverse: 9,
    accel: 18,           // m/s^2
    brake: 34,
    drag: 0.9,           // passive deceleration factor toward 0
    steerRate: 1.7,      // rad/s at full lock
    grip: 3.2,           // how fast heading aligns to travel
    rideHeight: 0.9,     // body center above ground
    tiltResponse: 4.0,   // how fast body aligns to slope normal
  },

  camera: {
    distance: 12,
    height: 6,
    lookAhead: 6,
    stiffness: 4.5,      // spring follow
    fov: 60,
  },

  poiPromptRadius: 90,   // meters within which a POI shows its prompt
};
