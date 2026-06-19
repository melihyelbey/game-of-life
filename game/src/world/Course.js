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

// --- moving elevator: a deck that oscillates vertically inside a fixed shaft. Board it at
// the bottom (aligned with the entry), ride up, drive off at the top (aligned with the
// exit) — a timing mechanic. Vertical motion rides on the truck's normal ground-follow, so
// no special carry logic is needed. Returns an extra update(dt) that animates the deck. ---
export function buildLift(opts) {
  const { x0, z0, heading, length: L, width: W, lowY, rise, period = 4, baseY, thickness = 1.2 } = opts;
  const dirX = Math.sin(heading);
  const dirZ = Math.cos(heading);
  const perpX = Math.cos(heading);
  const perpZ = -Math.sin(heading);
  const state = { topY: lowY, t: 0 };

  // live height: the deck's CURRENT top, within the (fixed) footprint
  const height = (x, z) => {
    const rx = x - x0;
    const rz = z - z0;
    const t = rx * dirX + rz * dirZ;
    const lat = rx * perpX + rz * perpZ;
    if (t < 0 || t > L || Math.abs(lat) > W / 2) return null;
    return state.topY;
  };

  const group = new THREE.Group();
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x3a6b86, flatShading: true });
  applyFogRamp(deckMat);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, thickness, L), deckMat);
  deck.rotation.y = heading;
  const cx = x0 + dirX * (L / 2);
  const cz = z0 + dirZ * (L / 2);
  deck.position.set(cx, lowY - thickness / 2, cz);
  group.add(deck);

  // fixed corner posts spanning the full travel = an elevator "shaft" so the motion reads
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2f3b44, flatShading: true });
  applyFogRamp(postMat);
  const highY = lowY + rise;
  const half = W / 2 - 0.5;
  for (const tt of [0.08, 0.92]) {
    for (const lat of [-half, half]) {
      const px = x0 + dirX * (tt * L) + perpX * lat;
      const pz = z0 + dirZ * (tt * L) + perpZ * lat;
      const ph = Math.max(0.5, highY - baseY);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, ph, 0.4), postMat);
      post.position.set(px, baseY + ph / 2, pz);
      group.add(post);
    }
  }

  const update = (dt) => {
    state.t += dt;
    const ph = (state.t / period) * Math.PI * 2;
    state.topY = lowY + rise * (0.5 - 0.5 * Math.cos(ph)); // lowY..highY, starts at lowY
    deck.position.y = state.topY - thickness / 2;
  };

  return { group, feature: { height }, update };
}


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
  // -- Section A: warm-up jump (straight, west) --
  { type: "ramp", length: 22, height: 6, width: 12 },    // gentle launch
  { type: "gap", length: 5 },                            //   JUMP #1
  { type: "platform", length: 20, width: 11 },           // land

  // -- Section B: switchback tower. Climbs on the ramps and steps SOUTH on each U-turn so
  // the lanes never stack on top of each other (the height field can't overlap itself).
  // The thin connectors between corners are narrow balance bridges. --
  { type: "ramp", length: 16, height: 6, width: 10 },    // lane 1 climb (west)
  { type: "corner", turn: Math.PI / 2, size: 11 },       //   -> south
  { type: "platform", length: 14, width: 6 },            //   narrow BRIDGE (steps south)
  { type: "corner", turn: Math.PI / 2, size: 11 },       //   -> east
  { type: "ramp", length: 16, height: 6, width: 10 },    // lane 2 climb (east, offset south)
  { type: "corner", turn: -Math.PI / 2, size: 11 },      //   -> south
  { type: "platform", length: 14, width: 6 },            //   narrow BRIDGE (steps south)
  { type: "corner", turn: -Math.PI / 2, size: 11 },      //   -> west
  { type: "ramp", length: 16, height: 6, width: 10 },    // lane 3 climb (west)

  // -- Section C: moving elevator (timing). Board at the bottom, ride up, drive off the top. --
  { type: "platform", length: 12, width: 10 },           // boarding pad
  { type: "lift", length: 14, width: 11, rise: 12, period: 4.0 }, // ELEVATOR up 12 m
  { type: "platform", length: 14, width: 9 },            // exit pad

  // -- Section D: final jump + summit --
  { type: "ramp", length: 16, height: 5, width: 9 },     // climb
  { type: "gap", length: 5 },                            //   JUMP #2
  { type: "platform", length: 22, width: 16, summit: true }, // summit pad + flag
];

// start: { x, z, heading } — the low end of the first segment and the climb direction.
// Returns { group, features, startPose, flag, summitPos, topY, segments }.
export function buildCourse(heightField, start) {
  const group = new THREE.Group();
  const features = [];
  const movers = [];   // pieces with an update(dt) (moving elevators)
  const segments = []; // per-piece metadata (used by tests + ?debug)
  const W = 12;
  const groundAt = (px, pz) => heightField.getHeight(px, pz); // terrain (features not added yet)

  // The course is placed on real, sloped terrain. If we chained heights only from the start
  // ground level, the decks would sink UNDER the terrain wherever the land rises faster than
  // the course climbs (the "buried boards" bug). So we LIFT the whole course onto stilts:
  // sample the highest terrain across the course's footprint and raise every deck above it,
  // then connect the ground to the lifted start with an auto-length entrance ramp. Posts run
  // down to the real terrain, so the structure looks grounded and you can drive under it.
  const startTerrain = groundAt(start.x, start.z);
  const dxh = Math.sin(start.heading), dzh = Math.cos(start.heading);
  const pxh = Math.cos(start.heading), pzh = -Math.sin(start.heading); // lateral
  let maxTerrain = startTerrain;
  for (let f = -12; f <= 240; f += 8) {     // along the climb direction (covers entrance+course)
    for (let l = -80; l <= 80; l += 8) {    // lateral spread (covers the side jog)
      const sx = start.x + dxh * f + pxh * l;
      const sz = start.z + dzh * f + pzh * l;
      if (!heightField.isInBounds(sx, sz)) continue;
      const h = groundAt(sx, sz);
      if (h > maxTerrain) maxTerrain = h;
    }
  }
  const clearance = 2.0;
  let lift = Math.max(0, maxTerrain + clearance - startTerrain);
  if (lift < 2.5) lift = 0; // flat/gentle ground: let the course sit on the terrain

  let flag = null;
  let summitPos = null;
  let x = start.x;
  let z = start.z;
  let heading = start.heading;
  let topY = startTerrain; // current deck height (ground at the entrance foot)

  // entrance ramp: ground -> lifted course start, at a gentle, drivable slope
  if (lift > 0.5) {
    const entLen = Math.max(16, lift / 0.32);
    const piece = buildRamp({
      x0: x, z0: z, heading, length: entLen, height: lift, width: W,
      baseY: startTerrain, groundY: startTerrain,
    });
    group.add(piece.group);
    features.push(piece.feature);
    const ex = x + dxh * entLen, ez = z + dzh * entLen;
    segments.push({
      type: "ramp", heading, length: entLen, width: W,
      start: { x, z }, end: { x: ex, z: ez }, baseY: startTerrain, topY: startTerrain + lift,
    });
    x = ex; z = ez; topY = startTerrain + lift;
  }

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
        groundY: Math.min(groundAt(x, z), sBaseY),
      });
      group.add(piece.group);
      features.push(piece.feature);
      topY = sBaseY + seg.height;
    } else if (seg.type === "lift") {
      const piece = buildLift({
        x0: x, z0: z, heading, length: seg.length, width,
        lowY: sBaseY, rise: seg.rise, period: seg.period,
        baseY: Math.min(groundAt(x, z), sBaseY - 1),
      });
      group.add(piece.group);
      features.push(piece.feature);
      movers.push(piece);
      topY = sBaseY + seg.rise; // exit aligns with the top of the lift's travel
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

  return { group, features, movers, startPose, flag, summitPos, topY, segments };
}
