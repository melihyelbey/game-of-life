// Unified controls: keyboard (WASD / arrows / space) + on-screen touch buttons for
// mobile. Both feed the same {forward, steer, brake} state, merged each read so a phone
// and a desktop play identically.
export class Input {
  constructor() {
    this._kb = { forward: 0, steer: 0, brake: false };
    this._touch = { forward: 0, steer: 0, brake: false };
    this._keys = new Set();

    window.addEventListener("keydown", (e) => this._key(e, true));
    window.addEventListener("keyup", (e) => this._key(e, false));
    window.addEventListener("blur", () => {
      this._keys.clear();
      this._sync();
    });

    this._bindTouch();
  }

  // merged view consumed by the vehicle
  get state() {
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    return {
      forward: clamp(this._kb.forward + this._touch.forward),
      steer: clamp(this._kb.steer + this._touch.steer),
      brake: this._kb.brake || this._touch.brake,
    };
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    const tracked = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "];
    if (!tracked.includes(k)) return;
    e.preventDefault();
    if (down) this._keys.add(k);
    else this._keys.delete(k);
    this._sync();
  }

  _sync() {
    const k = this._keys;
    const up = k.has("w") || k.has("arrowup");
    const down = k.has("s") || k.has("arrowdown");
    const left = k.has("a") || k.has("arrowleft");
    const right = k.has("d") || k.has("arrowright");
    this._kb.forward = (up ? 1 : 0) - (down ? 1 : 0);
    this._kb.steer = (left ? 1 : 0) - (right ? 1 : 0);
    this._kb.brake = k.has(" ");
  }

  // Wire pointer events on the on-screen buttons (works for touch + mouse).
  _bindTouch() {
    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      const press = (e) => {
        e.preventDefault();
        on();
      };
      const release = (e) => {
        e.preventDefault();
        off();
      };
      el.addEventListener("pointerdown", press);
      el.addEventListener("pointerup", release);
      el.addEventListener("pointerleave", release);
      el.addEventListener("pointercancel", release);
    };

    hold("btn-gas", () => (this._touch.forward = 1), () => (this._touch.forward = 0));
    hold("btn-rev", () => (this._touch.forward = -1), () => (this._touch.forward = 0));
    hold("btn-left", () => (this._touch.steer = 1), () => (this._touch.steer = 0));
    hold("btn-right", () => (this._touch.steer = -1), () => (this._touch.steer = 0));
    hold("btn-brake", () => (this._touch.brake = true), () => (this._touch.brake = false));
  }
}
