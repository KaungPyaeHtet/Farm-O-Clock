import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { coords } from "@/lib/validate";

// Farmer field observations (challenge improvement #1).
// POST: save one report.  GET ?lat&lng: validated community summary nearby.
// The satellite reading used to validate a report is fetched HERE (never trusted from the caller);
// without one the report stays "pending". At most MAX_PER_DAY reports per ~200 m spot per day.

const MAX_PER_DAY = 3;

/** Latest NASA POWER topsoil wetness (0-1) at the point: mean of the last 14 valid days, or null. */
async function satelliteWetness(lat: number, lng: number): Promise<number | null> {
  const end = new Date(Date.now() - 3 * 864e5);
  const start = new Date(end.getTime() - 20 * 864e5);
  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  try {
    const r = await fetch(
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=GWETTOP&community=AG&longitude=${lng}&latitude=${lat}` +
        `&start=${ymd(start)}&end=${ymd(end)}&format=JSON`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );
    if (!r.ok) return null;
    const vals = Object.values((await r.json())?.properties?.parameter?.GWETTOP ?? {}).filter(
      (v): v is number => typeof v === "number" && v >= 0 && v <= 1
    );
    const last = vals.slice(-14);
    return last.length ? last.reduce((a, b) => a + b, 0) / last.length : null;
  } catch {
    return null;
  }
}

const SOIL = ["dry", "damp", "wet", "flooded"] as const;
const STAGE = ["bare", "sown", "growing", "flowering", "harvested"] as const;
const HEALTH = ["good", "stressed", "failed"] as const;

function oneOf<T extends readonly string[]>(v: unknown, allowed: T): T[number] | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : null;
}

export async function POST(req: NextRequest) {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const b = await req.json().catch(() => null);
  const p = coords(b);
  if (!p) return NextResponse.json({ error: "valid numeric lat and lng are required" }, { status: 400 });
  const { lat, lng } = p;

  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await db
    .from("observations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .gte("lat", lat - 0.002).lte("lat", lat + 0.002)
    .gte("lng", lng - 0.002).lte("lng", lng + 0.002);
  if ((count ?? 0) >= MAX_PER_DAY) {
    return NextResponse.json({ error: "Enough reports from this spot today. Thank you!" }, { status: 429 });
  }
  const row = {
    lat,
    lng,
    soil_moisture: oneOf(b?.soilMoisture, SOIL),
    flooding: typeof b?.flooding === "boolean" ? b.flooding : null,
    crop_stage: oneOf(b?.cropStage, STAGE),
    crop_health: oneOf(b?.cropHealth, HEALTH),
    note: typeof b?.note === "string" ? b.note.slice(0, 500) : null,
    satellite: {} as Record<string, number>,
  };
  if (!row.soil_moisture && row.flooding === null && !row.crop_stage && !row.crop_health) {
    return NextResponse.json({ error: "nothing to record" }, { status: 400 });
  }

  const sat = await satelliteWetness(lat, lng);
  if (sat != null) row.satellite = { gwettop: Math.round(sat * 1000) / 1000 };

  const { data, error } = await db.from("observations").insert(row).select("id, status").single();
  if (error) return NextResponse.json({ error: "Could not save observation" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const db = supabase();
  if (!db) return NextResponse.json({ summary: [] });
  const sp = new URL(req.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }
  const { data, error } = await db.rpc("observation_summary", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: 10,
    p_days: 30,
  });
  if (error) return NextResponse.json({ error: "Could not load observations" }, { status: 500 });
  return NextResponse.json({ summary: data ?? [] });
}
