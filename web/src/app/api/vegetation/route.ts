import { NextRequest, NextResponse } from "next/server";
import { callBackend, latLng } from "@/lib/backend";
import { withNasaCache } from "@/lib/supabase";
import type { VegetationData } from "@/lib/types";

// Field greenness (MODIS NDVI via the Python API). Cached 7 days per ~100 m cell (250 m pixels).
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const p = latLng(req);
  if (!p) return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  try {
    const data = await withNasaCache<VegetationData>("ndvi", p.lat, p.lng, 24 * 7, () =>
      callBackend<VegetationData>("/v1/vegetation", p), { cell: 0.001 }
    );
    return NextResponse.json(data);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 502;
    return NextResponse.json({ error: (e as Error).message }, { status: status === 503 ? 503 : status });
  }
}
