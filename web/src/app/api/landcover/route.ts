import { NextRequest, NextResponse } from "next/server";

// What is at this exact spot? ESA WorldCover 2021 (10 m, global) via Microsoft Planetary
// Computer. Used to refuse pins dropped in water. Open sea has no WorldCover tile → water.

const PC = "https://planetarycomputer.microsoft.com/api";
const CLASSES: Record<number, string> = {
  10: "trees", 20: "shrubland", 30: "grassland", 40: "cropland", 50: "built-up", 60: "bare",
  70: "snow", 80: "water", 90: "wetland", 95: "mangroves", 100: "moss",
};

export type LandCover = { water: boolean; cover: string | null; checked: boolean };

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  try {
    const search = await fetch(`${PC}/stac/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collections: ["esa-worldcover"], intersects: { type: "Point", coordinates: [lng, lat] }, limit: 5 }),
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 86400 },
    });
    if (!search.ok) throw new Error(`search ${search.status}`);
    const feats = ((await search.json()).features ?? []) as { id: string; properties: { start_datetime?: string } }[];
    if (!feats.length) return NextResponse.json({ water: true, cover: "water", checked: true } satisfies LandCover);
    const item = feats.sort((a, b) => (b.properties.start_datetime ?? "").localeCompare(a.properties.start_datetime ?? ""))[0].id;
    const pt = await fetch(
      `${PC}/data/v1/item/point/${lng},${lat}?collection=esa-worldcover&item=${encodeURIComponent(item)}&assets=map`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 86400 } }
    );
    if (!pt.ok) throw new Error(`point ${pt.status}`);
    const cls = Math.round(Number((await pt.json()).values?.[0]));
    return NextResponse.json({ water: cls === 80, cover: CLASSES[cls] ?? null, checked: true } satisfies LandCover);
  } catch {
    // Never block the farmer because the check itself failed.
    return NextResponse.json({ water: false, cover: null, checked: false } satisfies LandCover);
  }
}
