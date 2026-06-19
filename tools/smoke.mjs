// Headless smoke test: serve the game, load it, drive a few seconds, capture console
// errors + screenshots. Not shipped — a dev verification helper.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:8080/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "load" });

// wait for the loading overlay to be hidden (world built) or time out
let loaded = false;
try {
  await page.waitForFunction(
    () => {
      const el = document.getElementById("loading");
      return el && (el.classList.contains("hidden") || el.style.display === "none");
    },
    { timeout: 20000 }
  );
  loaded = true;
} catch {
  loaded = false;
}

await page.screenshot({ path: "tools/shot-start.png" });

// drive forward + steer for a few seconds
await page.keyboard.down("w");
await page.waitForTimeout(2500);
await page.keyboard.down("a");
await page.waitForTimeout(1500);
await page.keyboard.up("a");
await page.keyboard.up("w");
await page.screenshot({ path: "tools/shot-drive.png" });

const hud = await page.evaluate(() => ({
  speed: document.getElementById("hud-speed")?.textContent,
  badge: document.getElementById("hud-badge")?.textContent,
  count: document.getElementById("hud-count")?.textContent,
  prompt: document.getElementById("hud-prompt")?.textContent,
}));

await browser.close();

console.log("loaded:", loaded);
console.log("HUD:", JSON.stringify(hud));
console.log("errors:", errors.length ? errors : "none");
process.exit(loaded && errors.length === 0 ? 0 : 1);
