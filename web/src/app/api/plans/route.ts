import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Saves a finished plan (anonymous: field location, crop, goals, the plan shown).
// Feeds the `fields` + `plans` tables so the team can see which crops/regions are planned.

const GOALS = ["water", "nitrogen", "erosion", "income"];
const CONSTRAINTS = ["no_machinery", "frost_sensitive"];
const STRATS = ["baseline", "water", "soil"];
const VERDICTS = ["dry", "normal", "wet"];

export async function POST(req: NextRequest) {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const b = await req.json().catch(() => null);
  const lat = Number(b?.lat);
  const lng = Number(b?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "valid lat and lng are required" }, { status: 400 });
  }
  const field = {
    lat: Math.round(lat * 1000) / 1000, // ~100 m: enough for the plan, not an exact house location
    lng: Math.round(lng * 1000) / 1000,
    crop: typeof b?.crop === "string" ? b.crop.slice(0, 40) : null,
    goals: Array.isArray(b?.goals) ? b.goals.filter((g: unknown) => GOALS.includes(String(g))) : [],
    constraints: Array.isArray(b?.constraints) ? b.constraints.filter((c: unknown) => CONSTRAINTS.includes(String(c))) : [],
    lang: b?.lang === "my" ? "my" : "en",
  };
  const { data: f, error: fe } = await db.from("fields").insert(field).select("id").single();
  if (fe || !f) return NextResponse.json({ error: "Could not save field" }, { status: 500 });
  const plan = {
    field_id: f.id,
    sowing_week: typeof b?.sowingWeek === "string" ? b.sowingWeek.slice(0, 40) : null,
    strategy_id: STRATS.includes(b?.strategyId) ? b.strategyId : null,
    verdict: VERDICTS.includes(b?.verdict) ? b.verdict : null,
    scores: typeof b?.scores === "object" && b.scores ? b.scores : {},
    model: "rules-v1.1+fao56",
  };
  const { error: pe } = await db.from("plans").insert(plan);
  if (pe) return NextResponse.json({ error: "Could not save plan" }, { status: 500 });
  return NextResponse.json({ ok: true, field_id: f.id }, { status: 201 });
}
