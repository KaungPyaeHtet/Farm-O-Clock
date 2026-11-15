import { NextRequest, NextResponse } from "next/server";

// Screen 4 data source. Pulls ~20 years of NASA POWER daily data for a
// lat/lng, then checks whether THIS season's rainfall & temperature are
// unusual (Dry / Wet / Normal) versus the historical baseline.
// No API keys required.

const FILL = -999;
const WINDOW_DAYS = 90;
const LATENCY_DAYS = 5;
const HISTORY_YEARS = 20;
const MIN_DAYS = 30; // min valid days for a year to count

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

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

function parseKey(k: string) {
  const year = +k.slice(0, 4);
  const month = +k.slice(4, 6) - 1;
  const day = +k.slice(6, 8);
  return { year, date: new Date(Date.UTC(year, month, day)) };
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
  const fetchStart = new Date(Date.UTC(end.getUTCFullYear() - HISTORY_YEARS, 0, 1));

  const doyStart = dayOfYear(start);
  const doyEnd = dayOfYear(end);
  const currentYear = end.getUTCFullYear();
  // Season window does not wrap new year for the current real dates; this
  // handles both the normal and (approx) wrapping case.
  const inWindow = (doy: number) =>
    doyStart <= doyEnd
      ? doy >= doyStart && doy <= doyEnd
      : doy >= doyStart || doy <= doyEnd;

  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M` +
      `&community=AG&longitude=${lng}&latitude=${lat}` +
      `&start=${ymd(fetchStart)}&end=${ymd(end)}&format=JSON`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`POWER ${res.status}`);
    const json = await res.json();
    const rainSeries: Record<string, number> =
      json?.properties?.parameter?.PRECTOTCORR ?? {};
    const tempSeries: Record<string, number> =
      json?.properties?.parameter?.T2M ?? {};

    // Bucket in-window days by calendar year.
    const byYear: Record<number, { rain: number[]; temp: number[] }> = {};
    for (const k of Object.keys(rainSeries)) {
      const { year, date } = parseKey(k);
      if (!inWindow(dayOfYear(date))) continue;
      const rain = rainSeries[k];
      const temp = tempSeries[k];
      if (rain === FILL || temp === FILL) continue;
      (byYear[year] ??= { rain: [], temp: [] }).rain.push(rain);
      byYear[year]!.temp.push(temp);
    }

    const series = Object.entries(byYear)
      .filter(([, v]) => v.rain.length >= MIN_DAYS)
      .map(([y, v]) => ({
        year: +y,
        rain: Math.round(v.rain.reduce((a, b) => a + b, 0)), // seasonal total mm
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
