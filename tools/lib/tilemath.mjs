// Web Mercator / slippy-tile math used to fetch and georeference elevation tiles.
// All formulas follow the OSM "slippy map tilenames" convention.

const EARTH_RADIUS = 6378137; // meters (WGS84 / Web Mercator sphere)
const TILE_SIZE = 256; // px per tile edge

const deg2rad = (d) => (d * Math.PI) / 180;

// lon/lat (degrees) -> fractional slippy tile coords at zoom z
export function lonLatToTile(lon, lat, z) {
  const n = Math.pow(2, z);
  const x = ((lon + 180) / 360) * n;
  const latRad = deg2rad(lat);
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

// integer tile -> lon/lat (degrees) of its NW corner
export function tileToLonLat(x, y, z) {
  const n = Math.pow(2, z);
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lon, lat };
}

// Ground resolution (meters per pixel) for Web Mercator at a given latitude+zoom.
export function metersPerPixel(lat, z) {
  return (2 * Math.PI * EARTH_RADIUS * Math.cos(deg2rad(lat))) / (TILE_SIZE * Math.pow(2, z));
}

// Meters per degree of latitude / longitude at a reference latitude (equirectangular
// local projection used to place roads & POIs in the same planar meter space as terrain).
export function metersPerDegree(lat) {
  const latRad = deg2rad(lat);
  return {
    lon: 111320 * Math.cos(latRad),
    lat: 110540, // close enough over the ~4 km Montauk span
  };
}

// Project a lon/lat to local planar meters relative to a NW origin (x east, z south).
export function projectLocal(lon, lat, originLon, originLat) {
  const m = metersPerDegree(originLat);
  return {
    x: (lon - originLon) * m.lon,
    z: (originLat - lat) * m.lat,
  };
}

export { TILE_SIZE };
