"use client";

import { useEffect, useState } from "react";
import type { EnvData, LatLng, Metric } from "@/lib/types";
import { glass, STATUS_DOT, STATUS_PILL } from "@/lib/ui";

const CARDS: {
  key: keyof Pick<EnvData, "soilMoisture" | "rainfall" | "heat" | "terrain">;
  icon: string;
  title: string;
}[] = [
  { key: "soilMoisture", icon: "💧", title: "Soil Moisture" },
  { key: "rainfall", icon: "🌧️", title: "Rainfall" },
  { key: "heat", icon: "🌡️", title: "Heat Stress" },
  { key: "terrain", icon: "⛰️", title: "Terrain Slope" },
];

function MetricCard({
  icon,
  title,
  metric,
}: {
  icon: string;
  title: string;
  metric: Metric;
}) {
  return (
    <div className={`${glass} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/60">
          {icon} {title}
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[metric.status]}`} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white">
          {metric.value ?? "—"}
        </span>
        <span className="text-sm text-white/50">{metric.unit}</span>
      </div>
      <span
        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[metric.status]}`}
      >
        {metric.label}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={`${glass} animate-pulse p-4`}>
      <div className="h-4 w-24 rounded bg-white/10" />
      <div className="mt-3 h-8 w-16 rounded bg-white/10" />
      <div className="mt-3 h-5 w-28 rounded-full bg-white/10" />
    </div>
  );
}

export default function Screen2Environment({
  pin,
  onLoaded,
}: {
  pin: LatLng;
  onLoaded?: (data: EnvData) => void;
}) {
  const [data, setData] = useState<EnvData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<EnvData>;
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        onLoaded?.(d);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // onLoaded intentionally excluded to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.lat, pin.lng]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-bold text-white">What the satellites see</h2>
      <p className="mt-0.5 text-sm text-white/50">
        Live NASA data for 📍 {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
      </p>

      {error ? (
        <div className="mt-6 rounded-3xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          Couldn’t load NASA data: {error}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {loading || !data
            ? CARDS.map((c) => <SkeletonCard key={c.key} />)
            : CARDS.map((c) => (
                <MetricCard
                  key={c.key}
                  icon={c.icon}
                  title={c.title}
                  metric={data[c.key]}
                />
              ))}
        </div>
      )}

      {data && (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
          Source: {data.source}
        </p>
      )}
    </div>
  );
}
