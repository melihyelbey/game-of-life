// Low-poly landmarks placed at their real Montauk coordinates (baked as GeoJSON points):
// the lighthouse, the Camp Hero radar tower, and a Firewatch-style ranger lookout.
import * as THREE from "three";
import { CONFIG } from "../config.js";
import { applyFogRamp } from "../render/FogRamp.js";

function mat(color) {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
  applyFogRamp(m);
  return m;
}

function lighthouse() {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.0, 22, 12), mat(0xf2f2f0));
  tower.position.y = 11;
  // signature brown daymark band
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.6, 5, 12), mat(0x7a4a2a));
  band.position.y = 11;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 10), mat(0x2b2b30));
  lamp.position.y = 23.5;
  const light = new THREE.PointLight(0xfff2c0, 2.2, 260, 1.5);
  light.position.y = 24;
  g.add(tower, band, lamp, light);
  return g;
}

function radarTower() {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), mat(0x6b6f74));
  legs.position.y = 13;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 16), mat(0x55585c));
  deck.position.y = 27;
  const dish = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 2), mat(0xd8d8d2));
  dish.position.set(0, 35, 0);
  g.add(legs, deck, dish);
  return g;
}

function lookoutTower() {
  const g = new THREE.Group();
  const woodA = mat(0x8a5a32);
  const woodB = mat(0xb5814f);
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 0.5), woodA);
    leg.position.set(x, 6, z);
    g.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 8), woodB);
  cabin.position.y = 13.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3, 4), mat(0x6b4a2a));
  roof.position.y = 16.5;
  roof.rotation.y = Math.PI / 4;
  const lamp = new THREE.PointLight(0xffd07a, 1.6, 120, 2);
  lamp.position.y = 13.5;
  g.add(cabin, roof, lamp);
  return g;
}

const BUILDERS = { lighthouse, radar: radarTower, lookout: lookoutTower };

// Returns { group, pois: [{id,name,position:Vector3}] }
export function buildPOIs(geojson, heightField) {
  const group = new THREE.Group();
  const pois = [];
  for (const f of geojson.features) {
    if (!f.properties.poi) continue;
    const [x, z] = f.geometry.coordinates;
    const y = heightField.getHeight(x, z);
    const build = BUILDERS[f.properties.id] || lookoutTower;
    const obj = build();
    obj.position.set(x, y, z);
    group.add(obj);
    pois.push({ id: f.properties.id, name: f.properties.name, position: new THREE.Vector3(x, y, z) });
  }
  return { group, pois };
}
