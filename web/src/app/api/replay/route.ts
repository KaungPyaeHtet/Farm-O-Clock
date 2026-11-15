import { NextRequest, NextResponse } from "next/server";

// Season Replay engine (Screen 4 centrepiece).
// Pulls ~20 years of NASA POWER daily data and, for each past year × each
// candidate sowing week, replays the following ~90-day growing period to
// rate drought / flood / heat risk as good / watch / alert.
// No API keys required.

const FILL = -999;
const HISTORY_YEARS = 20;
const LATENCY_DAYS = 5;
const GROW_DAYS = 90;
const WEEKS = 14; // candidate sowing weeks
const MIN_VALID = 70; // min valid days in a growing window to rate it

type Risk = "good" | "watch" | "alert" | "unknown";
type Cell = { risk: Risk; reason: string };

type ReplayResponse = {
  lat: number;
  lng: number;
  growDays: number;
  weeks: { label: string; startDoy: number }[];
  years: { year: number; cells: Cell[] }[];
  // Per-week aggregate (0-100) across all years — drives the sowing calendar.
  weekAgg: {
    drought: number;
    flood: number;
    heat: number;
    risk: Risk;
    goodCount: number;
  }[];
  bestWeekIndex: number;
  source: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
function keyOf(d: Date): string {
  return ymd(d);
}
function doyToLabel(doy: number): string {
  // Non-leap reference date for a readable "D Mon" label.
  const d = new Date(Date.UTC(2021, 0, 1));
  d.setUTCDate(doy);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function minSlidingSum(xs: number[], win: number): number {
  if (xs.length < win) return sum(xs);
  let s = sum(xs.slice(0, win));
  let min = s;
  for (let i = win; i < xs.length; i++) {
    s += xs[i] - xs[i - win];
    if (s < min) min = s;
  }
  return min;
}
function maxSlidingSum(xs: number[], win: number): number {
  if (xs.length < win) return sum(xs);
  let s = sum(xs.slice(0, win));
  let max = s;
  for (let i = win; i < xs.length; i++) {
    s += xs[i] - xs[i - win];
    if (s > max) max = s;
  }
  return max;
}
/** Rank of v within sorted ascending arr → 0..1 (higher = larger). */
function pct(sorted: number[], v: number): number {
  if (sorted.length <= 1) return 0.5;
  let lo = 0;
  for (const x of sorted) if (x <= v) lo++;
  return lo / sorted.length;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params are required" },
      { status: 400 }
    );
  }

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - LATENCY_DAYS);
  const fetchStart = new Date(Date.UTC(end.getUTCFullYear() - HISTORY_YEARS, 0, 1));

  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MAX` +
      `&community=AG&longitude=${lng}&latitude=${lat}` +
      `&start=${ymd(fetchStart)}&end=${ymd(end)}&format=JSON`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`POWER ${res.status}`);
    const json = await res.json();
    const rain: Record<string, number> = json?.properties?.parameter?.PRECTOTCORR ?? {};
    const tmax: Record<string, number> = json?.properties?.parameter?.T2M_MAX ?? {};

    // Climatology: mean rainfall per day-of-year, to locate the growing window.
    const doyRain = new Array(367).fill(0);
    const doyCount = new Array(367).fill(0);
    for (const k of Object.keys(rain)) {
      const v = rain[k];
      if (v === FILL) continue;
      const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)));
      const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
      doyRain[doy] += v;
      doyCount[doy] += 1;
    }
    const clim = doyRain.map((s, i) => (doyCount[i] ? s / doyCount[i] : 0));

    // Find the GROW_DAYS window (wrapping) with the most climatological rain.
    let bestStart = 1;
    let bestSum = -1;
    for (let start = 1; start <= 365; start++) {
      let s = 0;
      for (let j = 0; j < GROW_DAYS; j++) s += clim[((start - 1 + j) % 365) + 1];
      if (s > bestSum) {
        bestSum = s;
        bestStart = start;
      }
    }
    // Candidate sowing weeks begin ~2 weeks before the wettest window.
    const firstSow = ((bestStart - 14 + 365) % 365) || 365;
    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const startDoy = ((firstSow - 1 + i * 7) % 365) + 1;
      return { label: doyToLabel(startDoy), startDoy };
    });

    // Gather a growing window's daily series starting at a given calendar date.
    function windowSeries(startDate: Date) {
      const r: number[] = [];
      const h: number[] = [];
      for (let j = 0; j < GROW_DAYS; j++) {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + j);
        const kk = keyOf(d);
        const rv = rain[kk];
        const hv = tmax[kk];
        if (rv === undefined || rv === FILL) continue;
        r.push(rv);
        h.push(hv === FILL || hv === undefined ? 30 : hv);
      }
      return { r, h };
    }

    const years = Array.from({ length: HISTORY_YEARS }, (_, i) => end.getUTCFullYear() - HISTORY_YEARS + 1 + i);

    // First pass: raw metrics per (year, week).
    type Raw = { driest30: number; wettest7: number; hotDays: number; valid: number };
    const raw: Raw[][] = [];
    const dSamp: number[] = [];
    const fSamp: number[] = [];
    const hSamp: number[] = [];
    for (const y of years) {
      const row: Raw[] = [];
      for (const w of weeks) {
        const start = new Date(Date.UTC(y, 0, 1));
        start.setUTCDate(start.getUTCDate() + (w.startDoy - 1));
        const { r, h } = windowSeries(start);
        if (r.length < MIN_VALID) {
          row.push({ driest30: NaN, wettest7: NaN, hotDays: NaN, valid: r.length });
          continue;
        }
        const driest30 = minSlidingSum(r, 30);
        const wettest7 = maxSlidingSum(r, 7);
        const hotDays = h.filter((t) => t >= 35).length;
        row.push({ driest30, wettest7, hotDays, valid: r.length });
        dSamp.push(driest30);
        fSamp.push(wettest7);
        hSamp.push(hotDays);
      }
      raw.push(row);
    }

    const dSorted = [...dSamp].sort((a, b) => a - b);
    const fSorted = [...fSamp].sort((a, b) => a - b);
    const hSorted = [...hSamp].sort((a, b) => a - b);

    // Per-week accumulators for the sowing-calendar aggregate.
    const wk = weeks.map(() => ({ d: 0, f: 0, h: 0, n: 0, good: 0 }));

    // Second pass: rate each cell by its worst percentile risk.
    const yearsOut = years.map((y, yi) => {
      const cells: Cell[] = raw[yi].map((m, ci) => {
        if (Number.isNaN(m.driest30)) return { risk: "unknown", reason: "No data yet" };
        const pD = 1 - pct(dSorted, m.driest30); // low rain in driest spell = high drought
        const pF = pct(fSorted, m.wettest7); // high burst rain = flood
        const pH = pct(hSorted, m.hotDays); // more hot days = heat
        // Blend of the three risks, plus a "one severe risk ruins the season"
        // override so a catastrophic flood/drought still reads red.
        const combined = 0.45 * pD + 0.3 * pF + 0.25 * pH;
        const severe = Math.max(pD, pF, pH);
        const risk: Risk =
          severe >= 0.9 || combined >= 0.6
            ? "alert"
            : severe >= 0.72 || combined >= 0.44
              ? "watch"
              : "good";
        let reason = "Favourable season";
        if (risk !== "good") {
          if (pD === severe) reason = "Drought stress mid-season";
          else if (pF === severe) reason = "Heavy rain / waterlogging";
          else reason = "Heat stress at flowering";
        }
        wk[ci].d += pD;
        wk[ci].f += pF;
        wk[ci].h += pH;
        wk[ci].n += 1;
        if (risk === "good") wk[ci].good += 1;
        return { risk, reason };
      });
      return { year: y, cells };
    });

    const r100 = (x: number) => Math.round(x * 100);
    const weekAgg = wk.map((a) => {
      const d = a.n ? a.d / a.n : 0;
      const f = a.n ? a.f / a.n : 0;
      const h = a.n ? a.h / a.n : 0;
      const combined = 0.45 * d + 0.3 * f + 0.25 * h;
      const risk: Risk =
        combined >= 0.55 ? "alert" : combined >= 0.42 ? "watch" : "good";
      return {
        drought: r100(d),
        flood: r100(f),
        heat: r100(h),
        risk,
        goodCount: a.good,
      };
    });

    // Best sowing week = column with the most "good" seasons.
    let bestWeekIndex = 0;
    let bestGood = -1;
    for (let w = 0; w < weeks.length; w++) {
      if (wk[w].good > bestGood) {
        bestGood = wk[w].good;
        bestWeekIndex = w;
      }
    }

    const body: ReplayResponse = {
      lat,
      lng,
      growDays: GROW_DAYS,
      weeks,
      years: yearsOut,
      weekAgg,
      bestWeekIndex,
      source: `NASA POWER daily, ${years.length}-season replay (${GROW_DAYS}-day growing window)`,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to build season replay: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
