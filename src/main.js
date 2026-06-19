// Montauk Ranger — bootstrap. Loads baked Montauk data, builds the Firewatch-styled
// scene, and runs the drive loop.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { loadWorld } from "./world/DataLoader.js";
import { HeightField, downsampleHeights } from "./world/HeightField.js";
import { buildTerrain } from "./world/Terrain.js";
import { buildScatter } from "./world/Scatter.js";
import { ObstacleField } from "./world/ObstacleField.js";
import { buildRoads } from "./world/Roads.js";
import { buildPOIs } from "./world/PointsOfInterest.js";
import { buildSky } from "./world/Sky.js";
import { buildLighting } from "./render/Lighting.js";
import { Vehicle } from "./vehicle/Vehicle.js";
import { Input } from "./vehicle/Input.js";
import { ChaseCamera } from "./vehicle/ChaseCamera.js";
import { Loading } from "./ui/Loading.js";
import { Hud } from "./ui/Hud.js";

async function main() {
  const loading = new Loading();
  let world;
  try {
    world = await loadWorld((p, label) => loading.set(p, label));
  } catch (err) {
    console.error(err);
    loading.error("Failed to load map data. Run `node tools/prefetch.mjs` then reload.");
    return;
  }

  const { meta, manifest, heights, roads } = world;

  // coarse pointer + no hover => treat as a touch device (phones/tablets)
  const isMobile =
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isMobile) document.body.classList.add("is-mobile");

  // Resample elevation to the render resolution so the terrain mesh and the physics
  // height field share ONE surface — the truck rests exactly on the visible ground.
  const res =
    (isMobile ? CONFIG.terrain.segmentsMobile : CONFIG.terrain.segmentsDesktop) + 1;
  const surf = downsampleHeights(heights, meta, res);
  const heightField = new HeightField(surf.grid, surf.meta);
  const surfMeta = surf.meta;

  // --- renderer / scene / camera ---
  const canvas = document.getElementById("game");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const worldSize = Math.max(meta.widthMeters, meta.heightMeters);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.5,
    worldSize * 8
  );

  // --- world content ---
  scene.add(buildSky(worldSize * 4));
  scene.add(buildLighting(worldSize));
  scene.add(buildTerrain(heightField, surfMeta));
  const scatter = buildScatter(heightField, isMobile ? 0.5 : 1);
  scene.add(scatter.group);
  scene.add(buildRoads(roads, heightField));
  const { group: poiGroup, pois } = buildPOIs(roads, heightField);
  scene.add(poiGroup);

  // spatial collision field: solid landmarks (boxes/circles) + tree trunks
  const obstacleField = new ObstacleField(14);
  obstacleField.addMany(pois.map((p) => p.collider));
  obstacleField.addMany(scatter.colliders);

  // --- spawn the ranger near the lighthouse parking, facing inland (west) ---
  const lighthouse = pois.find((p) => p.id === "lighthouse");
  const spawn = lighthouse
    ? { x: lighthouse.position.x - 60, z: lighthouse.position.z + 20 }
    : { x: meta.widthMeters * 0.6, z: meta.heightMeters * 0.5 };
  const vehicle = new Vehicle(heightField, spawn.x, spawn.z);
  vehicle.heading = -Math.PI / 2; // face west, toward the park
  vehicle.obstacleField = obstacleField;
  scene.add(vehicle.mesh);

  const input = new Input();
  const chase = new ChaseCamera(camera, heightField);
  const hud = new Hud(pois, manifest);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loading.hide();

  // optional debug handle (only when the page is opened with ?debug) for verification
  if (new URLSearchParams(location.search).has("debug")) {
    window.__game = { vehicle, pois, heightField };
  }

  // --- main loop ---
  const baseFov = CONFIG.camera.fov;
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    vehicle.update(dt, input.state);
    chase.update(dt, vehicle);
    hud.update(vehicle);

    // subtle FOV widening with speed for a sense of momentum
    const targetFov = baseFov + (Math.abs(vehicle.speed) / CONFIG.vehicle.maxSpeed) * 9;
    camera.fov += (targetFov - camera.fov) * Math.min(1, 3 * dt);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}

main();
