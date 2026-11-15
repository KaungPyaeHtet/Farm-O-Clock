import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Screen 2 data source. Pulls real NASA POWER climate data + SRTM elevation
// for a pinned lat/lng and returns tidy, color-coded cards for the UI.
// No API keys required (POWER + OpenTopoData are open).

type Status = "good" | "watch" | "alert";

// Farmer soil reports → approximate top-soil wetness (0-1), same scale as GWETTOP.
const REPORT_WETNESS: Record<string, number> = { dry: 0.2, damp: 0.5, wet: 0.75, flooded: 0.95 };
const PRIOR_REPORTS = 3; // 3 nearby reports ≈ equal weight with the satellite estimate

/** Blend satellite wetness with validated farmer reports within 10 km / 30 days. */
async function withFarmerReports(lat: number, lng: number, sat: number | null) {
  const db = supabase();
  if (!db || sat == null) return { value: sat, reports: 0 };
  const { data } = await db.rpc("observation_summary", { p_lat: lat, p_lng: lng, p_radius_km: 10, p_days: 30 });
  const rows = (data ?? []) as { soil_moisture: string | null; reports: number }[];
  let n = 0;
  let sum = 0;
  for (const r of rows) {
    const w = r.soil_moisture ? REPORT_WETNESS[r.soil_moisture] : undefined;
    if (w == null) continue;
    n += Number(r.reports);
    sum += w * Number(r.reports);
  }
  if (!n) return { value: sat, reports: 0 };
  const k = n / (n + PRIOR_REPORTS);
  return { value: k * (sum / n) + (1 - k) * sat, reports: n };
}

type Metric = {
  value: number | null;
  unit: string;
  status: Status;
  label: string; // plain-language verdict
  farmerReports?: number; // soil moisture only: nearby farmer reports blended in
};

type EnvResponse = {
  lat: number;
  lng: number;
  windowDays: number;
  soilMoisture: Metric;
  rainfall: Metric;
  heat: Metric;
  terrain: Metric;
  source: string;
};

const FILL = -999;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// Average the valid (non-fill) values of a POWER parameter series.
function avg(series: Record<string, number> | undefined): number | null {
  if (!series) return null;
  const vals = Object.values(series).filter((v) => v !== FILL && v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function fetchPower(lat: number, lng: number) {
  const end = new Date();
  end.setDate(end.getDate() - 5); // POWER has a few days of latency
  const start = new Date(end);
  start.setDate(start.getDate() - 35); // ~30-day recent window
  const params = "GWETTOP,PRECTOTCORR,T2M,T2M_MAX";
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}` +
    `&community=AG&longitude=${lng}&latitude=${lat}` +
    `&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`POWER ${res.status}`);
  const json = await res.json();
  return json?.properties?.parameter as Record<
    string,
    Record<string, number>
  >;
}

// Estimate ground slope from 3 SRTM elevation samples (~550 m apart).
async function fetchSlope(lat: number, lng: number): Promise<number | null> {
  try {
    const d = 0.005;
    const locs = `${lat},${lng}|${lat + d},${lng}|${lat},${lng + d}`;
    const res = await fetch(
      `https://api.opentopodata.org/v1/srtm30m?locations=${locs}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const e = json?.results?.map((r: { elevation: number }) => r.elevation);
    if (!e || e.length < 3 || e.some((v: number | null) => v == null))
      return null;
    const mPerDeg = 111320;
    const distN = d * mPerDeg;
    const distE = d * mPerDeg * Math.cos((lat * Math.PI) / 180);
    const gradN = (e[1] - e[0]) / distN;
    const gradE = (e[2] - e[0]) / distE;
    const grad = Math.sqrt(gradN * gradN + gradE * gradE);
    return (Math.atan(grad) * 180) / Math.PI;
  } catch {
    return null;
  }
}

function soilMetric(frac: number | null): Metric {
  if (frac == null)
    return { value: null, unit: "%", status: "watch", label: "No data" };
  const pct = Math.round(frac * 100);
  let status: Status = "good";
  let label = "Healthy moisture";
  if (frac < 0.3) {
    status = "alert";
    label = "Dry — irrigation may be needed";
  } else if (frac > 0.8) {
    status = "watch";
    label = "Very wet — waterlogging risk";
  }
  return { value: pct, unit: "%", status, label };
}

function rainMetric(mmPerDay: number | null): Metric {
  if (mmPerDay == null)
    return { value: null, unit: "mm/day", status: "watch", label: "No data" };
  const v = Math.round(mmPerDay * 10) / 10;
  let status: Status = "good";
  let label = "Moderate rainfall";
  if (mmPerDay < 1) {
    status = "alert";
    label = "Low rainfall — drought-leaning";
  } else if (mmPerDay > 15) {
    status = "watch";
    label = "Heavy rainfall — flood-leaning";
  }
  return { value: v, unit: "mm/day", status, label };
}

function heatMetric(tmax: number | null): Metric {
  if (tmax == null)
    return { value: null, unit: "°C", status: "watch", label: "No data" };
  const v = Math.round(tmax * 10) / 10;
  let status: Status = "good";
  let label = "Comfortable for most crops";
  if (tmax >= 35) {
    status = "alert";
    label = "High heat stress";
  } else if (tmax >= 30) {
    status = "watch";
    label = "Warm — watch heat-sensitive crops";
  }
  return { value: v, unit: "°C (avg max)", status, label };
}

function terrainMetric(slope: number | null): Metric {
  if (slope == null)
    return { value: null, unit: "°", status: "watch", label: "No data" };
  const v = Math.round(slope * 10) / 10;
  let status: Status = "good";
  let label = "Flat — easy to work & retains water";
  if (slope > 8) {
    status = "alert";
    label = "Steep — erosion risk";
  } else if (slope > 3) {
    status = "watch";
    label = "Gentle slope — some runoff";
  }
  return { value: v, unit: "° slope", status, label };
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

  try {
    const [power, slope] = await Promise.all([
      fetchPower(lat, lng),
      fetchSlope(lat, lng),
    ]);

    const soil = await withFarmerReports(lat, lng, avg(power?.GWETTOP));
    const body: EnvResponse = {
      lat,
      lng,
      windowDays: 30,
      soilMoisture: { ...soilMetric(soil.value), farmerReports: soil.reports },
      rainfall: rainMetric(avg(power?.PRECTOTCORR)),
      heat: heatMetric(avg(power?.T2M_MAX)),
      terrain: terrainMetric(slope),
      source: "NASA POWER (daily, ~30-day avg) + SRTM elevation",
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to load NASA data: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
