// Shareable planting-plan picture (English or Burmese), drawn on a canvas so it
// works offline and uses the Burmese font next/font already loaded. Portrait
// 1080×(auto) cards: minimal text, maximum information, no emoji.

export type Tone = "good" | "watch" | "alert" | "info";

export type ShareCardData = {
  brand: string; // "FARM O’CLOCK · PLANTING PLAN"
  place: string;
  dateLine: string; // "Made 15 Nov 2026"
  hero: { label: string; value: string; sub?: string };
  stats: { label: string; value: string; tone?: Tone }[]; // up to 4, shown 2×2
  rotationTitle: string;
  rotation: { label: string; value: string; highlight?: boolean }[];
  checklistTitle: string;
  checklist: string[];
  footer: string;
  shareTitle: string;
};

const W = 1080;
const PAD = 64;
const GAP = 24;
const C = {
  bg: "#F5F7EE",
  dark: "#17240F",
  ink: "#17240F",
  muted: "#58693F",
  card: "#FFFFFF",
  line: "#D8E3C6",
  green: "#2F8A3E",
  greenSoft: "#9FD8A9",
  tone: { good: "#2F8A3E", watch: "#CF8912", alert: "#BF3326", info: "#2B79A8" } as Record<Tone, string>,
};

function fontStack(): string {
  const root = getComputedStyle(document.documentElement);
  const jak = root.getPropertyValue("--font-jakarta").trim();
  const mya = root.getPropertyValue("--font-myanmar").trim();
  return `${jak || "system-ui"}, ${mya || "sans-serif"}, sans-serif`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Lays out (and, if `draw`, paints) the card. Returns the total height. */
export function render(ctx: CanvasRenderingContext2D, d: ShareCardData, F: string, draw: boolean): number {
  const IW = W - PAD * 2;
  const text = (s: string, x: number, y: number, font: string, color: string) => {
    if (!draw) return;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };
  const card = (x: number, y: number, w: number, h: number, fill = C.card, stroke: string | null = C.line) => {
    if (!draw) return;
    roundRect(ctx, x, y, w, h, 24);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  ctx.textBaseline = "alphabetic";

  // Header
  ctx.font = `700 54px ${F}`;
  const placeLines = wrap(ctx, d.place, IW).slice(0, 2);
  const headerH = 64 + 26 + 28 + placeLines.length * 64 + 16 + 30 + 52;
  if (draw) {
    ctx.fillStyle = C.dark;
    ctx.fillRect(0, 0, W, headerH);
  }
  let y = 64 + 26;
  text(d.brand, PAD, y, `700 24px ${F}`, C.greenSoft);
  y += 28;
  for (const l of placeLines) {
    y += 64;
    text(l, PAD, y - 12, `700 54px ${F}`, "#F5F7EE");
  }
  y += 16 + 30;
  text(d.dateLine, PAD, y - 4, `500 26px ${F}`, "#C9D6BC");
  y = headerH + 40;

  // Hero card: when to sow
  ctx.font = `600 30px ${F}`;
  const subLines = d.hero.sub ? wrap(ctx, d.hero.sub, IW - 80) : [];
  const heroH = 40 + 24 + 20 + 92 + (subLines.length ? 18 + subLines.length * 40 : 0) + 40;
  card(PAD, y, IW, heroH, C.green, null);
  let hy = y + 40 + 24;
  text(d.hero.label, PAD + 40, hy, `700 24px ${F}`, "#D9F0DC");
  hy += 20 + 80;
  text(d.hero.value, PAD + 40, hy, `800 84px ${F}`, "#FFFFFF");
  hy += 12;
  for (const l of subLines) {
    hy += 40;
    text(l, PAD + 40, hy, `600 30px ${F}`, "#E8F5E4");
  }
  y += heroH + GAP;

  // Stats 2×2
  const colW = (IW - GAP) / 2;
  for (let r = 0; r < d.stats.length; r += 2) {
    const pair = d.stats.slice(r, r + 2);
    ctx.font = `700 36px ${F}`;
    const blocks = pair.map((s) => wrap(ctx, s.value, colW - 64 - (s.tone ? 30 : 0)).slice(0, 3));
    const h = 32 + 22 + 16 + Math.max(...blocks.map((b) => b.length)) * 46 + 28;
    pair.forEach((s, k) => {
      const x = PAD + k * (colW + GAP);
      card(x, y, colW, h);
      text(s.label, x + 32, y + 32 + 22, `700 22px ${F}`, C.muted);
      let vy = y + 32 + 22 + 16;
      blocks[k].forEach((l, li) => {
        vy += 46;
        const tx = x + 32 + (s.tone ? 30 : 0);
        if (draw && s.tone && li === 0) {
          ctx.beginPath();
          ctx.arc(x + 32 + 9, vy - 13, 9, 0, Math.PI * 2);
          ctx.fillStyle = C.tone[s.tone];
          ctx.fill();
        }
        text(l, tx, vy - 4, `700 36px ${F}`, C.ink);
      });
    });
    y += h + GAP;
  }

  // Rotation tiles
  y += 8;
  text(d.rotationTitle, PAD, y + 22, `700 22px ${F}`, C.muted);
  y += 22 + 16;
  const n = Math.max(1, d.rotation.length);
  const tileW = (IW - GAP * (n - 1)) / n;
  ctx.font = `700 32px ${F}`;
  const tileBlocks = d.rotation.map((r) => wrap(ctx, r.value, tileW - 40).slice(0, 2));
  const tileH = 28 + 22 + 10 + Math.max(...tileBlocks.map((b) => b.length)) * 40 + 26;
  d.rotation.forEach((r, i) => {
    const x = PAD + i * (tileW + GAP);
    card(x, y, tileW, tileH, r.highlight ? C.green : "#E7EED9", null);
    text(r.label, x + 24, y + 28 + 22, `600 22px ${F}`, r.highlight ? "#D9F0DC" : C.muted);
    let ty = y + 28 + 22 + 10;
    for (const l of tileBlocks[i]) {
      ty += 40;
      text(l, x + 24, ty - 4, `700 32px ${F}`, r.highlight ? "#FFFFFF" : C.ink);
    }
  });
  y += tileH + GAP + 8;

  // Checklist card with numbered steps
  ctx.font = `500 28px ${F}`;
  const items = d.checklist.slice(0, 5).map((c) => wrap(ctx, c, IW - 64 - 64));
  const listH = 36 + 32 + 20 + items.reduce((a, b) => a + Math.max(48, b.length * 38) + 14, 0) + 22;
  card(PAD, y, IW, listH);
  let ly = y + 36 + 30;
  text(d.checklistTitle, PAD + 32, ly, `800 32px ${F}`, C.ink);
  ly += 20;
  items.forEach((lines, i) => {
    const top = ly + 8;
    if (draw) {
      ctx.beginPath();
      ctx.arc(PAD + 32 + 20, top + 20, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#E7EED9";
      ctx.fill();
      ctx.font = `800 22px ${F}`;
      ctx.fillStyle = C.green;
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), PAD + 32 + 20, top + 28);
      ctx.textAlign = "left";
    }
    let tY = top + 30;
    for (const l of lines) {
      text(l, PAD + 32 + 64, tY, `500 28px ${F}`, C.ink);
      tY += 38;
    }
    ly += Math.max(48, lines.length * 38) + 14;
  });
  y += listH + 32;

  // Footer
  text(d.footer, PAD, y + 24, `500 22px ${F}`, C.muted);
  return y + 24 + 48;
}

export async function shareCard(d: ShareCardData): Promise<void> {
  await (document.fonts?.ready ?? Promise.resolve());
  const F = fontStack();
  const m = document.createElement("canvas").getContext("2d")!;
  const H = Math.ceil(render(m, d, F, false));

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  render(ctx, d, F, true);

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const file = new File([blob], "farm-oclock-plan.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: d.shareTitle });
      return;
    } catch {
      // cancelled or failed — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
