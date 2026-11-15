import { NextRequest, NextResponse } from "next/server";
import { withNasaCache } from "@/lib/supabase";

// Screen 4 data source. Pulls ~20 years of NASA POWER daily data for a
// lat/lng, then checks whether THIS season's rainfall & temperature are
// unusual (Dry / Wet / Normal) versus the historical baseline.
// No API keys required.

const FILL = -999;
const WINDOW_DAYS = 90;
const LATENCY_DAYS = 5;
const HISTORY_YEARS = 20;
const MIN_DAYS = 70; // min valid days (of 90) for a season to count

type Verdict = "dry" | "normal" | "wet";

type HistoryResponse = {
  lat: number;
  lng: number;
  seasonLabel: string;
  years: number;
  verdict: Verdict;
  rainfall: { thisYear: number; normal: number; percentile: number };
  temperature: { thisYear: number; normal: number; anomaly: number };
  series: { year: number; rain: number; temp: number; isCurrent: boolean }[];
  source: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

const DAY = 86_400_000;

/** Same calendar day `back` years earlier (29 Feb → 28 Feb). */
function yearsBack(d: Date, back: number): Date {
  const y = d.getUTCFullYear() - back;
  const m = d.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/** The 90-day window ending on `end`, as POWER keys (YYYYMMDD). Crosses New Year when it must. */
function windowKeys(end: Date): string[] {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => ymd(new Date(end.getTime() - (WINDOW_DAYS - 1 - i) * DAY)));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function std(xs: number[], m: number): number {
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
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
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
  // Oldest window starts 90 days before the same date HISTORY_YEARS ago (may be the previous December).
  const fetchStart = new Date(yearsBack(end, HISTORY_YEARS).getTime() - WINDOW_DAYS * DAY);
  const currentYear = end.getUTCFullYear();

  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M` +
      `&community=AG&longitude=${lng}&latitude=${lat}` +
      `&start=${ymd(fetchStart)}&end=${ymd(end)}&format=JSON`;
    // Raw POWER response cached per ~0.1° cell for 24 h (no-op without Supabase).
    const json = await withNasaCache("power-history", lat, lng, 24, async () => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`POWER ${res.status}`);
      return res.json();
    });
    const rainSeries: Record<string, number> =
      json?.properties?.parameter?.PRECTOTCORR ?? {};
    const tempSeries: Record<string, number> =
      json?.properties?.parameter?.T2M ?? {};

    // One complete 90-day window per season, ending on the same date each year (labelled by its end year).
    const byYear: Record<number, { rain: number[]; temp: number[] }> = {};
    for (let back = 0; back <= HISTORY_YEARS; back++) {
      const wEnd = yearsBack(end, back);
      const v = (byYear[wEnd.getUTCFullYear()] = { rain: [] as number[], temp: [] as number[] });
      for (const k of windowKeys(wEnd)) {
        const rain = rainSeries[k];
        const temp = tempSeries[k];
        if (rain === undefined || temp === undefined || rain === FILL || temp === FILL) continue;
        v.rain.push(rain);
        v.temp.push(temp);
      }
    }

    const series = Object.entries(byYear)
      .filter(([, v]) => v.rain.length >= MIN_DAYS)
      .map(([y, v]) => ({
        year: +y,
        // seasonal total mm, scaled to the full window if a few days are missing
        rain: Math.round((v.rain.reduce((a, b) => a + b, 0) * WINDOW_DAYS) / v.rain.length),
        temp: Math.round(mean(v.temp) * 10) / 10,
        isCurrent: +y === currentYear,
      }))
      .sort((a, b) => a.year - b.year);

    const current = series.find((s) => s.isCurrent);
    const historical = series.filter((s) => !s.isCurrent);
    if (!current || historical.length < 3) {
      throw new Error("Not enough historical data for this location");
    }

    const histRain = historical.map((s) => s.rain);
    const histTemp = historical.map((s) => s.temp);
    const rainMean = mean(histRain);
    const rainStd = std(histRain, rainMean) || 1;
    const tempMean = mean(histTemp);

    const z = (current.rain - rainMean) / rainStd;
    const verdict: Verdict = z <= -0.8 ? "dry" : z >= 0.8 ? "wet" : "normal";
    const percentile = Math.round(
      (histRain.filter((r) => r <= current.rain).length / histRain.length) * 100
    );

    const body: HistoryResponse = {
      lat,
      lng,
      seasonLabel: `${MONTHS[start.getUTCMonth()]}–${MONTHS[end.getUTCMonth()]}`,
      years: historical.length,
      verdict,
      rainfall: {
        thisYear: current.rain,
        normal: Math.round(rainMean),
        percentile,
      },
      temperature: {
        thisYear: current.temp,
        normal: Math.round(tempMean * 10) / 10,
        anomaly: Math.round((current.temp - tempMean) * 10) / 10,
      },
      series,
      source: `NASA POWER daily, ${historical.length}-season baseline`,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to load history: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
