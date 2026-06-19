// Minimal loading-screen controller bound to the #loading overlay in index.html.
export class Loading {
  constructor() {
    this.el = document.getElementById("loading");
    this.bar = document.getElementById("loading-bar");
    this.label = document.getElementById("loading-label");
  }
  set(progress, label) {
    if (this.bar) this.bar.style.width = `${Math.round(progress * 100)}%`;
    if (this.label && label) this.label.textContent = label;
  }
  hide() {
    if (this.el) {
      this.el.classList.add("hidden");
      setTimeout(() => (this.el.style.display = "none"), 800);
    }
  }
  error(msg) {
    if (this.label) this.label.textContent = msg;
    if (this.bar) this.bar.style.background = "#c0533a";
  }
}
