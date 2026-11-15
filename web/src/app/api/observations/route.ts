import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Farmer field observations (challenge improvement #1).
// POST: save one report.  GET ?lat&lng: validated community summary nearby.

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
  const lat = Number(b?.lat);
  const lng = Number(b?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "valid lat and lng are required" }, { status: 400 });
  }
  const row = {
    lat,
    lng,
    soil_moisture: oneOf(b?.soilMoisture, SOIL),
    flooding: typeof b?.flooding === "boolean" ? b.flooding : null,
    crop_stage: oneOf(b?.cropStage, STAGE),
    crop_health: oneOf(b?.cropHealth, HEALTH),
    note: typeof b?.note === "string" ? b.note.slice(0, 500) : null,
    satellite:
      typeof b?.gwettop === "number" ? { gwettop: Math.max(0, Math.min(1, b.gwettop)) } : {},
  };
  if (!row.soil_moisture && row.flooding === null && !row.crop_stage && !row.crop_health) {
    return NextResponse.json({ error: "nothing to record" }, { status: 400 });
  }

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
