// HUD: speedometer, objective tracker, POI proximity prompts, and a data-provenance
// badge (real Terrarium data vs procedural placeholder).
import { CONFIG } from "../config.js";

export class Hud {
  constructor(pois, manifest) {
    this.pois = pois;
    this.visited = new Set();
    this.speedEl = document.getElementById("hud-speed");
    this.objEl = document.getElementById("hud-objective");
    this.badgeEl = document.getElementById("hud-badge");
    this.countEl = document.getElementById("hud-count");

    if (this.badgeEl) {
      if (manifest.real) {
        this.badgeEl.textContent = "REAL TERRAIN · AWS Terrarium DEM";
        this.badgeEl.classList.add("real");
      } else {
        this.badgeEl.textContent = "PLACEHOLDER TERRAIN · re-run prefetch for real DEM";
        this.badgeEl.classList.add("placeholder");
      }
    }
    this._renderCount();
  }

  _renderCount() {
    if (this.countEl) {
      this.countEl.textContent = `Landmarks logged: ${this.visited.size}/${this.pois.length}`;
    }
  }

  update(vehicle) {
    if (this.speedEl) this.speedEl.textContent = `${Math.round(vehicle.speedKmh)} km/h`;

    // Log a landmark when you get close. No persistent on-screen label — just a brief
    // top-corner confirmation so nothing hovers over the truck.
    for (const p of this.pois) {
      if (this.visited.has(p.id)) continue;
      const d = Math.hypot(
        p.position.x - vehicle.position.x,
        p.position.z - vehicle.position.z
      );
      if (d < CONFIG.poiPromptRadius) {
        this.visited.add(p.id);
        this._renderCount();
        this._flashObjective(`Logged: ${p.name}`);
      }
    }
  }

  // public: show a transient banner (course messages: falls, summit, etc.)
  flash(text) {
    this._flashObjective(text);
  }

  _flashObjective(text) {
    if (!this.objEl) return;
    this.objEl.textContent = text;
    this.objEl.classList.add("flash");
    setTimeout(() => this.objEl.classList.remove("flash"), 2200);
  }
}
