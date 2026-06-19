// HUD: speedometer, objective tracker, POI proximity prompts, and a data-provenance
// badge (real Terrarium data vs procedural placeholder).
import { CONFIG } from "../config.js";

export class Hud {
  constructor(pois, manifest) {
    this.pois = pois;
    this.visited = new Set();
    this.speedEl = document.getElementById("hud-speed");
    this.objEl = document.getElementById("hud-objective");
    this.promptEl = document.getElementById("hud-prompt");
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

    // nearest POI
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of this.pois) {
      const d = Math.hypot(
        p.position.x - vehicle.position.x,
        p.position.z - vehicle.position.z
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }

    if (nearest && nearestDist < CONFIG.poiPromptRadius) {
      if (!this.visited.has(nearest.id)) {
        this.visited.add(nearest.id);
        this._renderCount();
        this._flashObjective(`Logged: ${nearest.name}`);
      }
      this.promptEl.textContent = `${nearest.name} — ${Math.round(nearestDist)} m`;
      this.promptEl.classList.add("show");
    } else if (nearest) {
      this.promptEl.textContent = `Next: ${nearest.name} — ${Math.round(nearestDist)} m`;
      this.promptEl.classList.remove("show");
    }
  }

  _flashObjective(text) {
    if (!this.objEl) return;
    this.objEl.textContent = text;
    this.objEl.classList.add("flash");
    setTimeout(() => this.objEl.classList.remove("flash"), 2200);
  }
}
