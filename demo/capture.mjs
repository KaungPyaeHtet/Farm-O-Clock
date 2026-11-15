// Captures real screenshots of the live app for the pitch video. Run: node demo/capture.mjs
// (needs playwright-core and Google Chrome). Output: demo/shots/*.png
import { chromium } from "playwright-core";
const OUT = new URL("./shots/", import.meta.url).pathname;
const URL_ = "https://farm-oclock-five.vercel.app";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function flow(browser, { tag, viewport, scale, lang }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  const shot = (n) => page.screenshot({ path: `${OUT}${tag}-${n}.png` });
  const next = async () => {
    await page.waitForFunction(() => { const b = document.querySelectorAll("footer button"); return !b[b.length - 1].disabled; }, null, { timeout: 90000 });
    await page.locator("footer button").last().click();
    await wait(900);
  };
  await page.goto(URL_, { waitUntil: "networkidle" });
  if (lang === "my") await page.getByRole("button", { name: "မြန်မာ" }).click();
  await wait(2500);
  await shot("01-map-world");
  const input = page.locator("input[placeholder]").first();
  await input.click();
  await input.pressSequentially("Maubin", { delay: 60 });
  await wait(2500);
  await shot("02-map-search");
  await page.locator('button:has-text("Maubin")').first().click();
  await wait(6000);
  await shot("03-map-pin");
  await next();
  await wait(22000);
  await shot("04-conditions");
  await next();
  await page.getByRole("button", { name: lang === "my" ? "စပါး" : "Rice" }).first().click();
  await page.getByRole("button", { name: lang === "my" ? "ရေချွေတာ" : "Save Water" }).first().click();
  await page.getByRole("button", { name: lang === "my" ? "မြေဩဇာ ပြန်တည်" : "Rebuild Nitrogen" }).first().click();
  await wait(600);
  await shot("05-crop");
  await next();
  await wait(9000);
  await shot("06-past");
  await next();
  await wait(9000);
  const sow = page.locator("input[type=range]").first();
  const best = +(await sow.inputValue());
  const max = +(await sow.getAttribute("max"));
  await shot("07-sow-best");
  // slider sweep for animation: a few weeks either side of the best week
  let k = 0;
  for (const i of [Math.max(0, best - 4), best - 2, best, best + 2, Math.min(max, best + 4), best]) {
    if (i < 0 || i > max) continue;
    await sow.fill(String(i));
    await wait(2500);
    await shot(`08-sow-${String(k++).padStart(2, "0")}`);
  }
  await next();
  await wait(12000);
  await shot("09-rot-00");
  const r = page.locator("input[type=range]");
  k = 1;
  for (const [rain, heat] of [[40, 55], [30, 65], [20, 80], [15, 90]]) {
    await r.nth(0).fill(String(rain));
    await r.nth(1).fill(String(heat));
    await wait(1800);
    await shot(`09-rot-${String(k++).padStart(2, "0")}`);
  }
  await r.nth(0).fill("50");
  await r.nth(1).fill("50");
  await wait(1500);
  await next();
  await wait(20000);
  await shot("10-plan");
  if (lang === "en") {
    await page.getByRole("button", { name: "မြန်မာ" }).click();
    await wait(1500);
    await shot("11-plan-my");
  }
  await page.close();
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
await Promise.all([
  flow(browser, { tag: "phone", viewport: { width: 390, height: 844 }, scale: 3, lang: "en" }),
  flow(browser, { tag: "desk", viewport: { width: 1440, height: 900 }, scale: 2, lang: "en" }),
]);
await browser.close();
console.log("done");
