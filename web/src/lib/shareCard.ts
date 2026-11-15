// Generates a shareable PNG planting-plan card (English or Burmese) and
// hands it to the OS share sheet (Viber / Messenger / …) or downloads it.
// Drawn directly on a canvas — no library — so it works offline and renders
// the Burmese (Noto Sans Myanmar) script that next/font already loaded.

export type ShareCardData = {
  subtitle: string;
  location: string;
  lines: { label: string; value: string }[];
  checklistTitle: string;
  checklist: string[];
  footer: string;
  shareTitle: string;
};

const W = 760;
const PAD = 46;

function fontStack(): string {
  const root = getComputedStyle(document.documentElement);
  const jak = root.getPropertyValue("--font-jakarta").trim();
  const mya = root.getPropertyValue("--font-myanmar").trim();
  return `${jak || "system-ui"}, ${mya || "sans-serif"}, sans-serif`;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareCard(d: ShareCardData): Promise<void> {
  await (document.fonts?.ready ?? Promise.resolve());
  const FAM = fontStack();
  const innerW = W - PAD * 2;

  // --- Measuring pass to compute total height ---
  const m = document.createElement("canvas").getContext("2d")!;
  const lineBlocks = d.lines.map((l) => {
    m.font = `700 29px ${FAM}`;
    return wrap(m, l.value, innerW);
  });
  m.font = `500 27px ${FAM}`;
  const checkBlocks = d.checklist.map((c) => wrap(m, c, innerW - 46));

  let H = 168; // header
  H += 54; // location
  for (const b of lineBlocks) H += 34 + b.length * 38 + 16;
  H += 20 + 46; // checklist title
  for (const b of checkBlocks) H += Math.max(44, b.length * 34) + 14;
  H += 32; // gap before footer
  H += 90; // footer

  // --- Draw pass ---
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#f8fbef";
  ctx.fillRect(0, 0, W, H);

  // Header band
  ctx.fillStyle = "#2f8a3e";
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 40px ${FAM}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("🌾 Farm O’Clock", PAD, 68);
  ctx.font = `600 26px ${FAM}`;
  ctx.globalAlpha = 0.92;
  ctx.fillText(d.subtitle, PAD, 108);
  ctx.globalAlpha = 1;

  let y = 150 + 50;
  ctx.fillStyle = "#58693f";
  ctx.font = `600 24px ${FAM}`;
  ctx.fillText(`📍 ${d.location}`, PAD, y);
  y += 30;

  // Lines (label + value)
  d.lines.forEach((l, i) => {
    y += 30;
    ctx.fillStyle = "#58693f";
    ctx.font = `700 20px ${FAM}`;
    ctx.fillText(l.label.toUpperCase(), PAD, y);
    y += 36;
    ctx.fillStyle = "#15200d";
    ctx.font = `700 29px ${FAM}`;
    for (const ln of lineBlocks[i]) {
      ctx.fillText(ln, PAD, y);
      y += 38;
    }
    y += 16;
  });

  // Checklist
  y += 14;
  ctx.fillStyle = "#15200d";
  ctx.font = `800 26px ${FAM}`;
  ctx.fillText(`✅ ${d.checklistTitle}`, PAD, y);
  y += 40;
  ctx.font = `500 27px ${FAM}`;
  d.checklist.forEach((_, i) => {
    const block = checkBlocks[i];
    const boxY = y - 22;
    ctx.strokeStyle = "#9fb47f";
    ctx.lineWidth = 2.5;
    roundRect(ctx, PAD, boxY, 26, 26, 7);
    ctx.stroke();
    ctx.fillStyle = "#15200d";
    let ly = y;
    for (const ln of block) {
      ctx.fillText(ln, PAD + 46, ly);
      ly += 34;
    }
    y += Math.max(44, block.length * 34) + 14;
  });

  // Footer
  ctx.fillStyle = "#e7eed9";
  ctx.fillRect(0, H - 66, W, 66);
  ctx.fillStyle = "#58693f";
  ctx.font = `600 22px ${FAM}`;
  ctx.fillText(d.footer, PAD, H - 26);

  // Export + share/download
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), "image/png")
  );
  const file = new File([blob], "farm-oclock-plan.png", { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: d.shareTitle });
      return;
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
