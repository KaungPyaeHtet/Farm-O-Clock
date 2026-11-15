"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/types";

// Leaflet touches `window`, so the map only loads in the browser (ssr: false).
const FarmMap = dynamic(() => import("@/components/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-neutral-100 text-sm text-neutral-500">
      Loading map…
    </div>
  ),
});

// A few preset farm regions so you can demo without hunting on the map.
const PRESETS: { label: string; lat: number; lng: number }[] = [
  { label: "🇲🇲 Yangon", lat: 16.87, lng: 96.2 },
  { label: "🇮🇳 Punjab", lat: 30.9, lng: 75.8 },
  { label: "🇺🇸 Iowa", lat: 42.0, lng: -93.5 },
];

export default function Screen1Map({
  pin,
  onPick,
}: {
  pin: LatLng | null;
  onPick: (p: LatLng) => void;
}) {
  return (
    <div className="relative h-full w-full">
      <FarmMap position={pin} onPick={onPick} />

      {/* Floating instruction card */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
        <div className="rounded-full bg-neutral-900/85 px-4 py-2 text-center text-sm font-medium text-white shadow-lg backdrop-blur">
          🗺️ Tap the map to drop your farm pin
        </div>
      </div>

      {/* Preset region chips */}
      <div className="absolute bottom-3 left-1/2 z-[1000] flex -translate-x-1/2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick({ lat: p.lat, lng: p.lng })}
            className="rounded-full border border-neutral-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-green-50 hover:text-green-700"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
