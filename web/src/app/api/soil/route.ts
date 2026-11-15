import { NextRequest, NextResponse } from "next/server";
import { withNasaCache } from "@/lib/supabase";
import type { SoilData } from "@/lib/types";

// Soil at the pin from ISRIC SoilGrids (250 m, global, no key), top 30 cm.
// Cached 30 days per ~100 m cell. If SoilGrids is down, the last known result is returned with its date.
export const maxDuration = 60;

const PROPS = ["clay", "sand", "silt", "soc", "phh2o"] as const;
const DEPTHS = [
  { label: "0-5cm", w: 5 },
  { label: "5-15cm", w: 10 },
  { label: "15-30cm", w: 15 },
];

type Layer = { name: string; depths: { label: string; values: { mean: number | null } }[] };

async function query(lat: number, lng: number): Promise<Record<string, number> | null> {
  const qs =
    `lon=${lng}&lat=${lat}&value=mean&` +
    PROPS.map((p) => `property=${p}`).join("&") +
    "&" +
    DEPTHS.map((d) => `depth=${d.label}`).join("&");
  const res = await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?${qs}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`SoilGrids ${res.status}`);
  const layers = ((await res.json())?.properties?.layers ?? []) as Layer[];
  const out: Record<string, number> = {};
  for (const L of layers) {
    let sum = 0;
    let wsum = 0;
    for (const d of DEPTHS) {
      const v = L.depths.find((x) => x.label === d.label)?.values.mean;
      if (v == null) continue;
      sum += v * d.w;
      wsum += d.w;
    }
    if (wsum) out[L.name] = sum / wsum;
  }
  return PROPS.every((p) => p in out) ? out : null; // masked pixel (water, town, rock)
}

/** USDA soil texture triangle. */
function texture(clay: number, sand: number, silt: number): string {
  if (clay >= 40 && silt < 40 && sand <= 45) return "Clay";
  if (clay >= 40 && silt >= 40) return "Silty clay";
  if (clay >= 35 && sand > 45) return "Sandy clay";
  if (clay >= 27 && clay < 40 && sand <= 20) return "Silty clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "Clay loam";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "Sandy clay loam";
  if (silt >= 80 && clay < 12) return "Silt";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "Silt loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "Loam";
  if (silt + 1.5 * clay < 15) return "Sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "Loamy sand";
  return "Sandy loam";
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }
  try {
    let asOf: string | undefined;
    const body = await withNasaCache<SoilData>("soilgrids", lat, lng, 24 * 30, async () => {
      // One retry if SoilGrids errors or times out (bounded: 2 × 12 s), then give up.
      const tryQuery = async (a: number, b: number) => {
        try {
          return await query(a, b);
        } catch {
          return await query(a, b);
        }
      };
      // Try the pin, then nearby points only if it falls on a masked pixel (an outage throws instead).
      let raw: Record<string, number> | null = null;
      for (const [dy, dx] of [[0, 0], [0.01, 0], [0, 0.01], [-0.01, 0], [0, -0.01]]) {
        raw = await tryQuery(lat + dy, lng + dx);
        if (raw) break;
      }
      if (!raw) throw new Error("No soil data at this spot");
      const clay = raw.clay / 10, sand = raw.sand / 10, silt = raw.silt / 10; // g/kg → %
      const soc = raw.soc / 10; // dg/kg → g/kg
      const ph = raw.phh2o / 10;
      const organic = soc < 10 ? "low" : soc < 20 ? "medium" : "good";
      const phLevel = ph < 5.5 ? "acidic" : ph > 7.5 ? "alkaline" : "good";
      // 0-100: organic carbon (60 %) + pH in the 5.5-7.5 crop-friendly band (40 %).
      const socScore = Math.min(100, (soc / 20) * 100);
      const phScore = phLevel === "good" ? 100 : Math.max(0, 100 - Math.abs(ph - (ph < 5.5 ? 5.5 : 7.5)) * 60);
      return {
        texture: texture(clay, sand, silt),
        clay: Math.round(clay), sand: Math.round(sand), silt: Math.round(silt),
        soc: Math.round(soc * 10) / 10, ph: Math.round(ph * 10) / 10,
        organic, phLevel, health: Math.round(0.6 * socScore + 0.4 * phScore),
      } satisfies SoilData;
    }, { cell: 0.001, staleOnError: (d) => (asOf = d) });
    return NextResponse.json(asOf ? { ...body, asOf } : body);
  } catch (err) {
    return NextResponse.json({ error: `Soil data unavailable: ${(err as Error).message}` }, { status: 502 });
  }
}
