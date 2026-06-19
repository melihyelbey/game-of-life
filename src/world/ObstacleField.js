// Uniform spatial hash for solid obstacles (towers + tree trunks). The vehicle only tests
// obstacles in its own cell + the 8 neighbours, so collision stays O(1) even with many
// hundreds of trees.
export class ObstacleField {
  constructor(cellSize = 14) {
    this.cell = cellSize;
    this.map = new Map();
    this._scratch = [];
  }

  _key(cx, cz) {
    return cx + "|" + cz;
  }

  add(x, z, radius) {
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    const k = this._key(cx, cz);
    let arr = this.map.get(k);
    if (!arr) this.map.set(k, (arr = []));
    arr.push({ x, z, radius });
  }

  addMany(items) {
    for (const o of items) this.add(o.x, o.z, o.radius);
  }

  // returns a reused array of obstacles near (x,z)
  queryNear(x, z) {
    const out = this._scratch;
    out.length = 0;
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const arr = this.map.get(this._key(cx + dx, cz + dz));
        if (arr) for (const o of arr) out.push(o);
      }
    }
    return out;
  }
}
