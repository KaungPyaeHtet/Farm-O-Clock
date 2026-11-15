import { NextRequest, NextResponse } from "next/server";
import { latLng, proxyToBackend } from "@/lib/backend";

// Season Replay re-run under the what-if sliders (rain %, heat °C).
export async function GET(req: NextRequest) {
  const p = latLng(req);
  if (!p) return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  const sp = new URL(req.url).searchParams;
  const rain = Math.max(-80, Math.min(100, Number(sp.get("rain") ?? 0) || 0));
  const heat = Math.max(-6, Math.min(8, Number(sp.get("heat") ?? 0) || 0));
  return proxyToBackend("/v1/scenario", { ...p, rain_pct: rain, heat_c: heat });
}
