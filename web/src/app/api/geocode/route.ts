import { NextRequest, NextResponse } from "next/server";

// Location search for Screen 1. Proxies OpenStreetMap's Nominatim geocoder
// server-side so we can set a proper User-Agent (per their usage policy) and
// avoid CORS. No API key required.

export type GeoResult = { name: string; lat: number; lng: number };

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=5` +
      `&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FarmOClock/1.0 (NASA Space Apps 2026 hackathon)",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const raw = (await res.json()) as {
      display_name: string;
      lat: string;
      lon: string;
    }[];
    const results: GeoResult[] = raw.map((r) => ({
      name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: `Search failed: ${(err as Error).message}`, results: [] },
      { status: 502 }
    );
  }
}
