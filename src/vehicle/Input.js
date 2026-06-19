// Keyboard input state for the truck (WASD + arrows, space = handbrake).
export class Input {
  constructor() {
    this.state = { forward: 0, steer: 0, brake: false };
    this._keys = new Set();
    window.addEventListener("keydown", (e) => this._set(e, true));
    window.addEventListener("keyup", (e) => this._set(e, false));
    window.addEventListener("blur", () => this._keys.clear());
  }

  _set(e, down) {
    const k = e.key.toLowerCase();
    const tracked = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "];
    if (!tracked.includes(k)) return;
    e.preventDefault();
    if (down) this._keys.add(k);
    else this._keys.delete(k);
    this._update();
  }

  _update() {
    const k = this._keys;
    const up = k.has("w") || k.has("arrowup");
    const down = k.has("s") || k.has("arrowdown");
    const left = k.has("a") || k.has("arrowleft");
    const right = k.has("d") || k.has("arrowright");
    this.state.forward = (up ? 1 : 0) - (down ? 1 : 0);
    this.state.steer = (left ? 1 : 0) - (right ? 1 : 0);
    this.state.brake = k.has(" ");
  }
}
