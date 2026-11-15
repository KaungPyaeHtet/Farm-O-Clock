import { NextRequest, NextResponse } from "next/server";
import { callBackend, latLng } from "@/lib/backend";
import { withNasaCache } from "@/lib/supabase";

// Data-driven rotation plans for this pin (Python /v1/rotation): partner crops picked from
// 20 years of NASA data + FAO-56 water + crop temperature fit. Cached 7 days per cell + crop.
const CROPS = ["rice", "wheat", "maize", "soybean", "cotton", "potato", "vegetables", "sugarcane"];

export async function GET(req: NextRequest) {
  const p = latLng(req);
  const crop = (new URL(req.url).searchParams.get("crop") ?? "rice").toLowerCase();
  if (!p) return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  if (!CROPS.includes(crop)) return NextResponse.json({ error: "unknown crop" }, { status: 400 });
  try {
    const data = await withNasaCache(`rotation-${crop}`, p.lat, p.lng, 24 * 7, () => callBackend("/v1/rotation", { ...p, crop }));
    return NextResponse.json(data);
  } catch (e) {
    const status = (e as { status?: number }).status;
    return NextResponse.json({ error: (e as Error).message }, { status: status ?? 502 });
  }
}
