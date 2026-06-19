// A takeoff ramp ("bridge") for testing the jump mechanic. It is BOTH a visual wedge mesh
// and an analytic height feature added to the HeightField, so the truck drives up the
// physical surface and launches off the top edge. The mesh and the height function are
// built from the same parameters so they always match exactly.
import * as THREE from "three";
import { applyFogRamp } from "../render/FogRamp.js";

// opts: { x0, z0 } start (low end, on the ground), heading (radians, direction of climb),
//        length, height, width, baseY (ground height at the start)
export function buildRamp(opts) {
  const { x0, z0, heading, length: L, height: H, width: W, baseY } = opts;
  const dirX = Math.sin(heading);
  const dirZ = Math.cos(heading);
  const perpX = Math.cos(heading);   // right vector
  const perpZ = -Math.sin(heading);

  // --- analytic surface: project (x,z) onto the ramp axis ---
  const height = (x, z) => {
    const rx = x - x0;
    const rz = z - z0;
    const t = rx * dirX + rz * dirZ;      // along axis
    const lat = rx * perpX + rz * perpZ;  // across axis
    if (t < 0 || t > L || Math.abs(lat) > W / 2) return null;
    return baseY + (t / L) * H;           // linear climb
  };

  // --- visual mesh: a right-triangle prism (deck = the sloped hypotenuse) ---
  const half = W / 2;
  // corners in world space
  const p = (t, lat, y) => [
    x0 + dirX * t + perpX * lat,
    y,
    z0 + dirZ * t + perpZ * lat,
  ];
  const lowL = p(0, -half, baseY);
  const lowR = p(0, half, baseY);
  const topL = p(L, -half, baseY + H);
  const topR = p(L, half, baseY + H);
  const baseTopL = p(L, -half, baseY);   // bottom of the back wall
  const baseTopR = p(L, half, baseY);
  const baseLowL = p(0, -half, baseY - 0.2);
  const baseLowR = p(0, half, baseY - 0.2);

  const verts = [];
  const pushTri = (a, b, c) => verts.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { pushTri(a, b, c); pushTri(a, c, d); };

  quad(lowL, lowR, topR, topL);          // deck (drive surface)
  quad(baseTopL, baseTopR, topR, topL);  // back wall (the launch lip)
  pushTri(lowL, topL, baseTopL);         // left side
  pushTri(lowR, baseTopR, topR);         // right side
  quad(baseLowL, baseLowR, lowR, lowL);  // small front lip into the ground

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();

  const deckMat = new THREE.MeshLambertMaterial({
    color: 0x7a5230,
    flatShading: true,
    side: THREE.DoubleSide, // visible from every angle (front included)
  });
  applyFogRamp(deckMat);
  const mesh = new THREE.Mesh(geo, deckMat);

  // wooden support posts under the high end, for a bridge look
  const group = new THREE.Group();
  group.add(mesh);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x4f361f, flatShading: true });
  applyFogRamp(postMat);
  for (const tt of [0.55, 0.8]) {
    for (const lat of [-half + 0.6, half - 0.6]) {
      const postH = baseY + (tt / 1) * H * 1; // approx height under deck at fraction tt*L
      const ph = (tt * H);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, ph, 0.5), postMat);
      const pos = p(tt * L, lat, baseY + ph / 2);
      post.position.set(pos[0], pos[1], pos[2]);
      group.add(post);
    }
  }

  return { group, feature: { height } };
}
