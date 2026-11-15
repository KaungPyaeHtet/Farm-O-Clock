import { NextRequest, NextResponse } from "next/server";
import { callBackend, latLng } from "@/lib/backend";
import { withNasaCache } from "@/lib/supabase";

// Data-driven rotation plans for this pin (Python /v1/rotation): partner crops picked from
// 20 years of NASA data + FAO-56 water + crop temperature fit. Cached 7 days per cell + crop.
const CROPS = ["rice", "wheat", "maize", "soybean", "cotton", "potato", "vegetables", "sugarcane"];

export async function GET(req: NextRequest) {
  const p = latLng(req);
  const sp = new URL(req.url).searchParams;
  const crop = (sp.get("crop") ?? "rice").toLowerCase();
  const doyRaw = sp.get("doy");
  const doy = doyRaw == null ? null : Number(doyRaw);
  if (doy != null && !(Number.isInteger(doy) && doy >= 1 && doy <= 366))
    return NextResponse.json({ error: "doy must be a day of year" }, { status: 400 });
  const frost = sp.get("frost") === "1";
  if (!p) return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  if (!CROPS.includes(crop)) return NextResponse.json({ error: "unknown crop" }, { status: 400 });
  try {
    const data = await withNasaCache(`rotation-${crop}-${doy ?? "best"}-${frost ? "frost" : "any"}`, p.lat, p.lng, 24 * 7, () =>
      callBackend("/v1/rotation", { ...p, crop, ...(doy != null ? { start_doy: doy } : {}), frost_sensitive: frost })
    );
    return NextResponse.json(data);
  } catch (e) {
    const status = (e as { status?: number }).status;
    return NextResponse.json({ error: (e as Error).message }, { status: status ?? 502 });
  }
}
