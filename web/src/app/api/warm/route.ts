import { NextResponse } from "next/server";

// Called once when the app opens: wakes the Python model API (serverless functions
// sleep when idle) so it is ready by the time the farmer reaches the model screens.
export async function GET() {
  const base = process.env.BACKEND_URL;
  if (!base) return NextResponse.json({ warm: false });
  const t = Date.now();
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/health`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    return NextResponse.json({ warm: r.ok, ms: Date.now() - t });
  } catch {
    return NextResponse.json({ warm: false, ms: Date.now() - t });
  }
}
