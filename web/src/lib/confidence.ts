// Calibrated "chance of a low-risk season" for a sowing week.
// Recent seasons count more (half-life 5 years), then a correction curve learned
// in backtests maps that share to what actually happened the following year.
// Source: backend/eval/improvements.py (E4a) → backend/models/confidence_curve.json.
import curve from "./confidence-curve.json";

export function calibratedChance(seasons: { year: number; good: boolean }[]): number | null {
  if (!seasons.length) return null;
  const latest = Math.max(...seasons.map((s) => s.year));
  let w = 0;
  let g = 0;
  for (const s of seasons) {
    const wt = Math.pow(0.5, (latest - s.year) / curve.half_life_years);
    w += wt;
    g += s.good ? wt : 0;
  }
  const p = g / w;
  const { x, y } = curve;
  if (p <= x[0]) return y[0];
  if (p >= x[x.length - 1]) return y[y.length - 1];
  for (let i = 1; i < x.length; i++) {
    if (p <= x[i]) {
      const t = x[i] === x[i - 1] ? 1 : (p - x[i - 1]) / (x[i] - x[i - 1]);
      return y[i - 1] + t * (y[i] - y[i - 1]);
    }
  }
  return y[y.length - 1];
}
