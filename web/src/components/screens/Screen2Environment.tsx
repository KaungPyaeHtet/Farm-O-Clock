"use client";

import { useEffect, useState } from "react";
import type { EnvData, LatLng, Metric, Status } from "@/lib/types";

const STATUS_STYLES: Record<Status, { dot: string; pill: string }> = {
  good: { dot: "bg-green-500", pill: "bg-green-50 text-green-700" },
  watch: { dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700" },
  alert: { dot: "bg-red-500", pill: "bg-red-50 text-red-700" },
};

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
  const s = STATUS_STYLES[metric.status];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">
          {icon} {title}
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-neutral-900">
          {metric.value ?? "—"}
        </span>
        <span className="text-sm text-neutral-500">{metric.unit}</span>
      </div>
      <span
        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${s.pill}`}
      >
        {metric.label}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="h-4 w-24 rounded bg-neutral-200" />
      <div className="mt-3 h-8 w-16 rounded bg-neutral-200" />
      <div className="mt-3 h-5 w-28 rounded-full bg-neutral-200" />
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
      <h2 className="text-lg font-bold text-neutral-900">
        What the satellites see
      </h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Live NASA data for 📍 {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
          Source: {data.source}
        </p>
      )}
    </div>
  );
}
