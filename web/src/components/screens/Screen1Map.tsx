"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Search, MapPin, X, Loader2, LocateFixed } from "lucide-react";
import type { LatLng } from "@/lib/types";
import type { GeoResult } from "@/app/api/geocode/route";
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

export default function Screen1Map({
  pin,
  onPick,
}: {
  pin: LatLng | null;
  onPick: (p: LatLng, name?: string) => Promise<boolean> | void;
}) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const skipNext = useRef(false);

  // Debounced geocode search.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) return; // short input is cleared in onQuery
    const id = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { results?: GeoResult[] }) => {
          setResults(d.results ?? []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 450);
    return () => clearTimeout(id);
  }, [query]);

  function onQuery(v: string) {
    setQuery(v);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
    } else setLoading(true);
  }

  // "Use my location": the phone's GPS drops the pin; the farmer can then drag it onto the field.
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocError(t("This device can't share its location.", "ဤစက်က တည်နေရာ မပေးနိုင်ပါ။"));
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocError(t("Couldn't get your location. Allow location, or tap the map.", "တည်နေရာ မရပါ။ ခွင့်ပြုပါ သို့မဟုတ် မြေပုံပေါ် တို့ပါ။"));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function choose(r: GeoResult) {
    skipNext.current = true;
    const short = r.name.split(",").slice(0, 2).join(", ");
    setQuery(short);
    setResults([]);
    setOpen(false);
    onPick({ lat: r.lat, lng: r.lng }, r.name.split(",").map((x) => x.trim()).filter((x, i, a) => i < 2 || i === a.length - 1).join(", "));
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative h-full w-full">
      <FarmMap position={pin} onPick={(p) => onPick(p)} />

      {/* Search bar */}
      <div className="absolute left-1/2 top-3 z-[1000] w-[min(92%,22rem)] lg:top-5 lg:w-[30rem] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-2xl border border-hair bg-surface px-3 py-2.5 shadow-lg">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder={t("Search a place or village…", "နေရာ သို့ ရွာ ရှာပါ…")}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
          ) : query ? (
            <button onClick={clear} aria-label="Clear">
              <X className="h-4 w-4 shrink-0 text-muted" />
            </button>
          ) : null}
        </div>

        {/* Results dropdown */}
        {open && results.length > 0 && (
          <div className="mt-1.5 overflow-hidden rounded-2xl border border-hair bg-surface shadow-xl">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => choose(r)}
                className="flex w-full items-start gap-2 border-b border-hair px-3 py-2.5 text-left text-sm text-ink transition last:border-0 hover:bg-grass/10"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-grass" />
                <span className="leading-snug">
                  {r.name.split(",").slice(0, 3).join(", ")}
                </span>
              </button>
            ))}
          </div>
        )}
        {open && !loading && results.length === 0 && query.trim().length >= 2 && (
          <div className="mt-1.5 rounded-2xl border border-hair bg-surface px-3 py-2.5 text-sm text-muted shadow-xl">
            {t("No places found", "နေရာ မတွေ့ပါ")}
          </div>
        )}
      </div>

      {/* Use my location + hint */}
      <div className="absolute bottom-4 left-1/2 z-[1000] flex w-[min(92%,22rem)] -translate-x-1/2 flex-col items-center gap-2">
        {locError && (
          <p className="rounded-xl bg-surface px-3 py-2 text-center text-xs font-semibold text-clay shadow">{locError}</p>
        )}
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center gap-2 rounded-full bg-grass px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-grass-strong disabled:opacity-70"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? t("Finding you…", "ရှာနေသည်…") : t("Use my location", "ကျွန်ုပ်၏ တည်နေရာ")}
        </button>
        <div className="pointer-events-none flex items-center gap-1.5 rounded-full border border-white/15 bg-ink/75 px-3 py-1.5 text-xs font-semibold text-white shadow backdrop-blur">
          <MapPin className="h-3.5 w-3.5" />
          {pin
            ? t("Drag the pin onto your field to adjust", "ပင်ကို သင့်လယ်ပေါ် ဆွဲ၍ ချိန်ပါ")
            : t("or tap the map to drop a pin", "သို့မဟုတ် မြေပုံပေါ် တို့ပါ")}
        </div>
      </div>
    </div>
  );
}
