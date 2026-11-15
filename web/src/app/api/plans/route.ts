import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { coords } from "@/lib/validate";

// Saves a finished plan (anonymous: field location, crop, goals, the plan shown).
// Feeds the `fields` + `plans` tables so the team can see which crops/regions are planned.
// Idempotent: the client sends a saveId; a retry with the same id returns the first save.
// All-or-nothing: if the plan row fails, the field row is removed again.

const GOALS = ["water", "nitrogen", "erosion", "income"];
const CONSTRAINTS = ["no_machinery", "frost_sensitive"];
const STRATS = ["baseline", "water", "soil"];
const VERDICTS = ["dry", "normal", "wet"];

export async function POST(req: NextRequest) {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const b = await req.json().catch(() => null);
  const p = coords(b);
  if (!p) return NextResponse.json({ error: "valid numeric lat and lng are required" }, { status: 400 });
  const saveId = typeof b?.saveId === "string" && /^[\w-]{8,64}$/.test(b.saveId) ? b.saveId : null;
  if (!saveId) return NextResponse.json({ error: "saveId is required" }, { status: 400 });

  const { data: prior } = await db.from("plans").select("id, field_id").eq("scores->>save_id", saveId).maybeSingle();
  if (prior) return NextResponse.json({ ok: true, field_id: prior.field_id, duplicate: true }, { status: 200 });

  const field = {
    lat: Math.round(p.lat * 1000) / 1000, // ~100 m: enough for the plan, not an exact house location
    lng: Math.round(p.lng * 1000) / 1000,
    crop: typeof b?.crop === "string" ? b.crop.slice(0, 40) : null,
    goals: Array.isArray(b?.goals) ? b.goals.filter((g: unknown) => GOALS.includes(String(g))) : [],
    constraints: Array.isArray(b?.constraints) ? b.constraints.filter((c: unknown) => CONSTRAINTS.includes(String(c))) : [],
    lang: b?.lang === "my" ? "my" : "en",
  };
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : null);
  const { data: f, error: fe } = await db.from("fields").insert(field).select("id").single();
  if (fe || !f) return NextResponse.json({ error: "Could not save field" }, { status: 500 });
  const plan = {
    field_id: f.id,
    sowing_week: typeof b?.sowingWeek === "string" ? b.sowingWeek.slice(0, 40) : null,
    strategy_id: STRATS.includes(b?.strategyId) ? b.strategyId : null,
    verdict: VERDICTS.includes(b?.verdict) ? b.verdict : null,
    scores: {
      ...(typeof b?.scores === "object" && b.scores && !Array.isArray(b.scores) ? b.scores : {}),
      save_id: saveId,
      what_if: { rain: num(b?.whatIf?.rain, 0, 100) ?? 50, heat: num(b?.whatIf?.heat, 0, 100) ?? 50 },
    },
    model: "rules-v1.2+fao56",
  };
  const { error: pe } = await db.from("plans").insert(plan);
  if (pe) {
    await db.from("fields").delete().eq("id", f.id); // no orphan field
    return NextResponse.json({ error: "Could not save plan" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, field_id: f.id }, { status: 201 });
}
