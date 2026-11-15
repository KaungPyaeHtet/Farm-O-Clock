import { NextRequest, NextResponse } from "next/server";
import { latLng, proxyToBackend } from "@/lib/backend";

// This year's chance of a high-risk season per sowing week (Python risk model).
export async function GET(req: NextRequest) {
  const p = latLng(req);
  if (!p) return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  return proxyToBackend("/v1/outlook", p);
}
