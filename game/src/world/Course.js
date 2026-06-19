// "Ranger Ascent" — a short parkour course that climbs upward: sloped ramps and flat
// platforms (with one jump gap) chained from the ground to a summit flag. Each piece is
// BOTH a low-poly mesh and an analytic HeightField feature, exactly like Ramp.js, so the
// truck physically drives/lands on them. The whole layout is data-driven (LAYOUT below) so
// the course is extended later by editing one array, not the geometry code.
import * as THREE from "three";
import { applyFogRamp } from "../render/FogRamp.js";
import { buildRamp } from "./Ramp.js";

// --- a flat raised pad: box mesh + support posts + a constant-height feature ----------
// opts: { x0, z0 } start edge (low end of the travel axis), heading (travel direction),
//        length, width, topY (world Y of the drive surface), baseY (terrain under it).
export function buildPlatform(opts) {
  const { x0, z0, heading, length: L, width: W, topY, baseY, thickness = 1.2 } = opts;
  const dirX = Math.sin(heading);
  const dirZ = Math.cos(heading);
  const perpX = Math.cos(heading);
  const perpZ = -Math.sin(heading);

  // analytic surface: constant topY inside the rectangular footprint, null outside
  const height = (x, z) => {
    const rx = x - x0;
    const rz = z - z0;
    const t = rx * dirX + rz * dirZ;
    const lat = rx * perpX + rz * perpZ;
    if (t < 0 || t > L || Math.abs(lat) > W / 2) return null;
    return topY;
  };

  const group = new THREE.Group();
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x86603a, flatShading: true });
  applyFogRamp(deckMat);
  // BoxGeometry: local X = width (lateral), local Z = length (travel). A Y-rotation by
  // `heading` maps local +Z to (sin,cos)=travel and local +X to (cos,-sin)=lateral, so the
  // box lines up exactly with the analytic footprint above.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, thickness, L), deckMat);
  deck.rotation.y = heading;
  const cx = x0 + dirX * (L / 2);
  const cz = z0 + dirZ * (L / 2);
  deck.position.set(cx, topY - thickness / 2, cz);
  group.add(deck);

  // support posts down to the terrain, for a trestle-bridge look
  const postMat = new THREE.MeshLambertMaterial({ color: 0x4f361f, flatShading: true });
  applyFogRamp(postMat);
  const half = W / 2 - 0.8;
  for (const tt of [0.18, 0.82]) {
    for (const lat of [-half, half]) {
      const px = x0 + dirX * (tt * L) + perpX * lat;
      const pz = z0 + dirZ * (tt * L) + perpZ * lat;
      const ph = Math.max(0.5, topY - thickness - baseY);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, ph, 0.5), postMat);
      post.position.set(px, baseY + ph / 2, pz);
      group.add(post);
    }
  }

  return { group, feature: { height } };
}

// --- summit flag: a pole with a cloth that starts at the bottom and, when triggered,
// slides up to the top (the player's reward interaction). -----------------------------
export function buildFlag(opts) {
  const { x, z, baseY, poleH = 9, triggerRadius = 7 } = opts;
  const group = new THREE.Group();

  const poleMat = new THREE.MeshLambertMaterial({ color: 0xcfcfcf, flatShading: true });
  applyFogRamp(poleMat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, poleH, 8), poleMat);
  pole.position.set(x, baseY + poleH / 2, z);
  group.add(pole);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), poleMat);
  knob.position.set(x, baseY + poleH + 0.2, z);
  group.add(knob);

  // the cloth: a thin box offset to one side of the pole; we move its Y to "raise" it
  const clothMat = new THREE.MeshBasicMaterial({ color: 0xd83b2a }); // bright, unlit pop
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 2.6), clothMat);
  const bottomY = baseY + 1.0;
  const topY = baseY + poleH - 1.1;
  cloth.position.set(x, bottomY, z + 1.3); // hangs off +Z side of the pole
  group.add(cloth);

  const state = { raising: false, t: 0 };
  const ease = (t) => t * t * (3 - 2 * t); // smoothstep

  return {
    group,
    base: { x, z },
    triggerRadius,
    summitTop: new THREE.Vector3(x, baseY + poleH, z),
    get raised() {
      return state.t >= 1;
    },
    raise() {
      state.raising = true;
    },
    update(dt) {
      if (!state.raising || state.t >= 1) return;
      state.t = Math.min(1, state.t + dt / 1.2); // ~1.2 s to the top
      cloth.position.y = bottomY + (topY - bottomY) * ease(state.t);
    },
  };
}

// --- confetti: a one-shot particle burst (THREE.Points) for the summit celebration ----
export function buildConfetti(maxParticles = 220) {
  const positions = new Float32Array(maxParticles * 3);
  const colors = new Float32Array(maxParticles * 3);
  const vel = new Float32Array(maxParticles * 3);
  const life = new Float32Array(maxParticles);
  for (let i = 0; i < maxParticles; i++) positions[i * 3 + 1] = -9999; // parked offscreen

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.7,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;

  const palette = [0xff5252, 0xffd54f, 0x4fc3f7, 0x81c784, 0xba68c8, 0xff8a65];
  let active = 0;
  const tmp = new THREE.Color();

  return {
    points,
    burst(origin) {
      points.visible = true;
      active = maxParticles;
      for (let i = 0; i < maxParticles; i++) {
        positions[i * 3] = origin.x + (Math.random() - 0.5) * 1.5;
        positions[i * 3 + 1] = origin.y + Math.random() * 1.0;
        positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 1.5;
        const ang = Math.random() * Math.PI * 2;
        const spd = 4 + Math.random() * 7;
        vel[i * 3] = Math.cos(ang) * spd * 0.6;
        vel[i * 3 + 1] = 7 + Math.random() * 9; // up
        vel[i * 3 + 2] = Math.sin(ang) * spd * 0.6;
        life[i] = 2.2 + Math.random() * 1.6;
        tmp.set(palette[(Math.random() * palette.length) | 0]);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    update(dt) {
      if (!points.visible) return;
      let alive = 0;
      for (let i = 0; i < maxParticles; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -9999;
          continue;
        }
        vel[i * 3 + 1] -= 16 * dt; // gravity
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        alive++;
      }
      active = alive;
      geo.attributes.position.needsUpdate = true;
      if (active === 0) points.visible = false;
    },
  };
}

// --- the course layout: edit this array to lengthen/reshape the parkour. Segments chain
// head-to-tail; each takes its baseY from the previous piece's top. ---------------------
// Segment types:
//   "ramp"     sloped climb — drive up and launch off the lip. {length, height, width?}
//   "platform" flat pad — land on / run along.                 {length, width?, summit?}
//   "gap"      empty space the truck must JUMP across.          {length}
//   "corner"   square turn pad straddling the bend; rotates the
//              travel direction by `turn` (radians).            {turn, size?}
// Design notes for difficulty: corners force you to land and re-aim (air-steering is weak),
// narrow platforms (small width) punish sloppy landings, and every gap sits right after a
// ramp so you launch with real air. A fall sends you all the way back to the start.
const LAYOUT = [
  { type: "ramp", length: 22, height: 6, width: 12 },    // 1 gentle launch (west)
  { type: "gap", length: 5 },                            //   JUMP #1
  { type: "platform", length: 20, width: 11 },           // 2 land (generous)
  { type: "corner", turn: Math.PI / 2, size: 12 },       //   bend LEFT (now south)
  { type: "ramp", length: 20, height: 6, width: 10 },    // 3 climb
  { type: "gap", length: 5 },                            //   JUMP #2
  { type: "platform", length: 18, width: 8 },            // 4 NARROW land (lateral precision)
  { type: "corner", turn: -Math.PI / 2, size: 12 },      //   bend RIGHT (back west)
  { type: "ramp", length: 20, height: 6, width: 9 },     // 5 climb
  { type: "gap", length: 6 },                            //   JUMP #3
  { type: "platform", length: 18, width: 8 },            // 6 NARROW land
  { type: "ramp", length: 18, height: 6, width: 9 },     // 7 climb
  { type: "gap", length: 5 },                            //   JUMP #4
  { type: "platform", length: 18, width: 9 },            // 8 land
  { type: "ramp", length: 16, height: 5, width: 10 },    // 9 final climb
  { type: "platform", length: 22, width: 16, summit: true }, // 10 summit pad + flag
];

// start: { x, z, heading } — the low end of the first segment and the climb direction.
// Returns { group, features, startPose, flag, summitPos, topY, segments }.
export function buildCourse(heightField, start) {
  const group = new THREE.Group();
  const features = [];
  const segments = []; // per-piece metadata (used by tests + ?debug)
  const W = 12;

  let x = start.x;
  let z = start.z;
  let heading = start.heading;
  let topY = heightField.getHeight(x, z); // current drive-surface height (ground at start)
  const groundAt = (px, pz) => heightField.getHeight(px, pz);

  let flag = null;
  let summitPos = null;

  for (const seg of LAYOUT) {
    if (seg.type === "corner") {
      // square pad centred on the bend so the incoming and outgoing pieces both overlap it
      const newHeading = heading + (seg.turn || 0);
      const ndx = Math.sin(newHeading), ndz = Math.cos(newHeading);
      const S = seg.size || 12;
      const x0 = x - ndx * (S / 2);
      const z0 = z - ndz * (S / 2);
      const piece = buildPlatform({
        x0, z0, heading: newHeading, length: S, width: S, topY,
        baseY: Math.min(groundAt(x, z), topY - 1),
      });
      group.add(piece.group);
      features.push(piece.feature);
      segments.push({ type: "corner", heading: newHeading, topY, size: S, center: { x, z } });
      // advance to the far edge of the pad and adopt the new heading
      x += ndx * (S / 2);
      z += ndz * (S / 2);
      heading = newHeading;
      continue;
    }

    if (seg.turn) heading += seg.turn;
    const dirX = Math.sin(heading);
    const dirZ = Math.cos(heading);
    const width = seg.width || W;
    const sx = x, sz = z, sBaseY = topY;

    if (seg.type === "ramp") {
      const piece = buildRamp({
        x0: x, z0: z, heading, length: seg.length, height: seg.height, width, baseY: sBaseY,
      });
      group.add(piece.group);
      features.push(piece.feature);
      topY = sBaseY + seg.height;
    } else if (seg.type === "platform") {
      const piece = buildPlatform({
        x0: x, z0: z, heading, length: seg.length, width, topY,
        baseY: Math.min(groundAt(x, z), topY - 1),
      });
      group.add(piece.group);
      features.push(piece.feature);
      if (seg.summit) {
        const fx = x + dirX * (seg.length * 0.6);
        const fz = z + dirZ * (seg.length * 0.6);
        flag = buildFlag({ x: fx, z: fz, baseY: topY });
        group.add(flag.group);
        summitPos = new THREE.Vector3(fx, topY, fz);
      }
    }
    // advance the cursor to the end of this segment (gaps just move the cursor)
    x += dirX * seg.length;
    z += dirZ * seg.length;
    segments.push({
      type: seg.type, heading, length: seg.length, width,
      start: { x: sx, z: sz }, end: { x, z }, baseY: sBaseY, topY,
    });
  }

  // respawn pose: a short run-up behind the first segment, facing up the course
  const startPose = {
    x: start.x - Math.sin(start.heading) * 18,
    z: start.z - Math.cos(start.heading) * 18,
    heading: start.heading,
  };

  return { group, features, startPose, flag, summitPos, topY, segments };
}
