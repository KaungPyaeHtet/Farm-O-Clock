// Renders pitch.html frame by frame → farm-oclock-pitch.mp4 (1920x1080, 30 fps, 30 s).
// Run: node demo/render.mjs [fps] [from] [to]   (needs playwright-core, Google Chrome, ffmpeg)
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const fps = +(process.argv[2] ?? 30), from = +(process.argv[3] ?? 0), to = +(process.argv[4] ?? 30);
const frames = `${dir}frames/`;
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`file://${dir}pitch.html`, { waitUntil: "networkidle" });
await page.evaluate(() => window.ready);
const n = Math.round((to - from) * fps);
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.seek(t), from + i / fps);
  await page.screenshot({ path: `${frames}${String(i).padStart(4, "0")}.png` });
  if (i % 60 === 0) process.stdout.write(`${i}/${n} `);
}
await browser.close();
const out = `${dir}farm-oclock-pitch${from || to !== 30 ? `-${from}-${to}` : ""}.mp4`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${frames}%04d.png`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
console.log("\n" + out);
