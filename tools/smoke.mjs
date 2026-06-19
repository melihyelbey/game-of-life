// Headless smoke test: serve the game, load it on desktop AND emulated mobile, drive a
// few seconds (keyboard on desktop, on-screen buttons on mobile), capture console errors
// + screenshots. Not shipped — a dev verification helper.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:8080/";

async function run(label, contextOpts, drive) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: "load" });

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
  } catch {}

  await drive(page);
  await page.screenshot({ path: `tools/shot-${label}.png` });

  const info = await page.evaluate(() => ({
    speed: document.getElementById("hud-speed")?.textContent,
    badge: document.getElementById("hud-badge")?.textContent,
    count: document.getElementById("hud-count")?.textContent,
    touchVisible: getComputedStyle(document.getElementById("touch")).display !== "none",
    mobileClass: document.body.classList.contains("is-mobile"),
  }));

  await browser.close();
  const ok = loaded && errors.length === 0;
  console.log(`[${label}] loaded=${loaded} ok=${ok} HUD=${JSON.stringify(info)}`);
  if (errors.length) console.log(`[${label}] errors:`, errors);
  return ok;
}

// desktop: keyboard
const desktopOk = await run(
  "desktop",
  { viewport: { width: 1280, height: 720 } },
  async (page) => {
    await page.keyboard.down("w");
    await page.waitForTimeout(2200);
    await page.keyboard.down("a");
    await page.waitForTimeout(1200);
    await page.keyboard.up("a");
    await page.keyboard.up("w");
  }
);

// mobile: touch buttons
const press = async (page, sel, ms) => {
  const box = await page.locator(sel).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
};
const mobileOk = await run(
  "mobile",
  { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  async (page) => {
    // hold gas, then gas + steer (sequential since single mouse pointer)
    await press(page, "#btn-gas", 2200);
    await press(page, "#btn-left", 1000);
  }
);

console.log(desktopOk && mobileOk ? "SMOKE PASS" : "SMOKE FAIL");
process.exit(desktopOk && mobileOk ? 0 : 1);
