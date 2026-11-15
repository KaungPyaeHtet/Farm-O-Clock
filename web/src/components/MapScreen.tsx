"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { LatLng } from "./FarmMap";

// Leaflet touches `window`, so the map only loads in the browser (ssr: false).
const FarmMap = dynamic(() => import("./FarmMap"), {
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

export default function MapScreen() {
  const [pin, setPin] = useState<LatLng | null>(null);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white shadow-xl">
      {/* Brand + progress header */}
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            <span>🌾</span> Field&nbsp;Shift
          </h1>
          <span className="text-xs font-medium text-neutral-500">Step 1 of 6</span>
        </div>
        {/* 6-step progress bar */}
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i === 0 ? "bg-green-600" : "bg-neutral-200"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Map + instruction */}
      <section className="relative min-h-0 flex-1">
        <FarmMap position={pin} onPick={setPin} />

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
              onClick={() => setPin({ lat: p.lat, lng: p.lng })}
              className="rounded-full border border-neutral-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-green-50 hover:text-green-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Sticky footer */}
      <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 pb-5 pt-3">
        {pin ? (
          <p className="mb-3 text-center text-sm text-neutral-600">
            📍 Farm selected:{" "}
            <span className="font-semibold text-neutral-900">
              {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
            </span>
          </p>
        ) : (
          <p className="mb-3 text-center text-sm text-neutral-400">
            No farm selected yet
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled
            className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-semibold text-neutral-300"
          >
            Back
          </button>
          <button
            disabled={!pin}
            onClick={() =>
              alert(
                "Screens 2–6 (environmental data, risk analysis, rotations…) are coming in the next feature branches! 🚧"
              )
            }
            className="flex-[2] rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            Next Step →
          </button>
        </div>
      </footer>
    </main>
  );
}
