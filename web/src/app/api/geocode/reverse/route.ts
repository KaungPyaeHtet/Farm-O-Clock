import { NextRequest, NextResponse } from "next/server";

// Pin → nearest identifiable place name ("Maubin, Ayeyarwady, Myanmar").
// OpenStreetMap Nominatim reverse geocoding, server-side (User-Agent policy).

type Addr = Record<string, string | undefined>;

function placeName(a: Addr): string | null {
  const local = a.village ?? a.town ?? a.city ?? a.hamlet ?? a.suburb ?? a.municipality ?? a.county;
  const region = a.state ?? a.region ?? a.province ?? a.state_district;
  const parts = [local, region, a.country].filter((x, i, arr) => x && arr.indexOf(x) === i);
  return parts.length ? parts.join(", ") : null;
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const lang = sp.get("lang") === "my" ? "my,en" : "en";
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lng}`,
      {
        headers: { "User-Agent": "FarmOClock/1.0 (NASA Space Apps 2026 hackathon)", "Accept-Language": lang },
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const d = (await res.json()) as { address?: Addr; error?: string };
    return NextResponse.json({
      name: d.address ? placeName(d.address) : null,
      country: d.address?.country_code ? d.address.country_code.toUpperCase() : null,
    });
  } catch {
    return NextResponse.json({ name: null, country: null });
  }
}
