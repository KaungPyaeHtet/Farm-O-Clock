import { NextRequest, NextResponse } from "next/server";
import { callBackend, latLng } from "@/lib/backend";
import { withNasaCache } from "@/lib/supabase";
import { scoreStrategies } from "@/lib/strategies";

// FAO-56 water need per rotation strategy (Python API). Cached 7 days per cell + crop.
export async function GET(req: NextRequest) {
  const p = latLng(req);
  const crop = new URL(req.url).searchParams.get("crop") ?? "rice";
  if (!p) return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  const rotations = Object.fromEntries(scoreStrategies(crop, [], 50, 50).map((s) => [s.id, s.rotation]));
  try {
    const data = await withNasaCache(`water-${crop}`, p.lat, p.lng, 24 * 7, () =>
      callBackend("/v1/water", { ...p, rotations })
    );
    return NextResponse.json(data);
  } catch (e) {
    const status = (e as { status?: number }).status;
    return NextResponse.json({ error: (e as Error).message }, { status: status ?? 502 });
  }
}
