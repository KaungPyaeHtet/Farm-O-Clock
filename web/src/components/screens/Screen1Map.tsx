"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { useLang } from "@/lib/i18n";

// Leaflet touches `window`, so the map only loads in the browser (ssr: false).
const FarmMap = dynamic(() => import("@/components/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#cdd9c0] text-sm text-muted">
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
  const { t } = useLang();
  return (
    <div className="relative h-full w-full">
      <FarmMap position={pin} onPick={onPick} />

      {/* Floating instruction card */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-ink/80 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg backdrop-blur">
          <MapPin className="h-4 w-4 shrink-0" />
          {t("Tap the map to drop your farm pin", "သင့်လယ်ကို ပြမည့် မြေပုံပေါ် တို့ပါ")}
        </div>
      </div>

      {/* Preset region chips */}
      <div className="absolute bottom-3 left-1/2 z-[1000] flex -translate-x-1/2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick({ lat: p.lat, lng: p.lng })}
            className="rounded-full border border-white/15 bg-ink/75 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur transition hover:bg-grass"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
