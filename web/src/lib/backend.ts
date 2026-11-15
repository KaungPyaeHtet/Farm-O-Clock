import "server-only";
import { NextResponse } from "next/server";

// Server-side bridge to the Python model API (backend/, FastAPI on Cloud Run).
// If BACKEND_URL is not set the routes answer 503 and the UI simply hides the
// model panels — the rest of the app keeps working on its own NASA calls.

export async function proxyToBackend(path: string, body: unknown) {
  const base = process.env.BACKEND_URL;
  if (!base) return NextResponse.json({ error: "Model backend not configured" }, { status: 503 });
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.BACKEND_API_KEY ? { "x-api-key": process.env.BACKEND_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000), // first call pulls ~20 yrs of NASA data
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data?.detail ?? `Backend ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: `Backend unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}

export function latLng(req: Request): { lat: number; lng: number } | null {
  const sp = new URL(req.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Call the model API and return its JSON (throws on error). For routes that cache the result. */
export async function callBackend<T>(path: string, body: unknown): Promise<T> {
  const base = process.env.BACKEND_URL;
  if (!base) throw new Error("Model backend not configured");
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.BACKEND_API_KEY ? { "x-api-key": process.env.BACKEND_API_KEY } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000), // first NDVI pull reads ~90 satellite images
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.detail ?? `Backend ${res.status}`), { status: res.status });
  return data as T;
}
