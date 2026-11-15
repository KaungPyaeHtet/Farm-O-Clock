"use client";

import { useEffect, useState } from "react";
import type { HistoryData, LatLng, Verdict } from "@/lib/types";

const VERDICT: Record<
  Verdict,
  { title: string; emoji: string; banner: string; bar: string }
> = {
  normal: {
    title: "Normal season",
    emoji: "✅",
    banner: "border-green-200 bg-green-50 text-green-800",
    bar: "bg-green-500",
  },
  dry: {
    title: "Drier than usual",
    emoji: "🏜️",
    banner: "border-red-200 bg-red-50 text-red-800",
    bar: "bg-red-500",
  },
  wet: {
    title: "Wetter than usual",
    emoji: "🌊",
    banner: "border-amber-200 bg-amber-50 text-amber-800",
    bar: "bg-amber-500",
  },
};

function RainChart({ data }: { data: HistoryData }) {
  const max = Math.max(...data.series.map((s) => s.rain), 1);
  const normalPct = (data.rainfall.normal / max) * 100;
  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Seasonal rainfall by year (mm)</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-600" /> this year
        </span>
      </div>
      <div className="relative mt-3 flex h-36 items-end gap-[3px]">
        {/* historical average line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-neutral-400"
          style={{ bottom: `${normalPct}%` }}
        >
          <span className="absolute -top-2 left-0 rounded bg-white/90 px-1 text-[10px] font-medium text-neutral-500">
            avg {data.rainfall.normal} mm
          </span>
        </div>
        {data.series.map((s) => (
          <div
            key={s.year}
            className="group relative flex-1"
            style={{ height: `${(s.rain / max) * 100}%` }}
            title={`${s.year}: ${s.rain} mm`}
          >
            <div
              className={`h-full w-full rounded-t ${
                s.isCurrent ? "bg-green-600" : "bg-neutral-300"
              }`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-neutral-400">
        <span>{data.series[0]?.year}</span>
        <span>{data.series[data.series.length - 1]?.year}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-900">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}

export default function Screen4Historical({ pin }: { pin: LatLng }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<HistoryData>;
      })
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-bold text-neutral-900">Historical context</h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Is this season unusual for your farm?
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="h-44 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load history: {error}
        </div>
      )}

      {data && (
        <>
          {/* Verdict banner */}
          <div
            className={`mt-4 rounded-2xl border p-4 ${VERDICT[data.verdict].banner}`}
          >
            <div className="text-base font-bold">
              {VERDICT[data.verdict].emoji} {VERDICT[data.verdict].title}
            </div>
            <p className="mt-1 text-sm">
              This {data.seasonLabel} season sits at the{" "}
              <strong>{data.rainfall.percentile}th percentile</strong> of the
              last {data.years} years for rainfall.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              label="🌧️ Rainfall this season"
              value={`${data.rainfall.thisYear} mm`}
              sub={`Normal: ${data.rainfall.normal} mm`}
            />
            <Stat
              label="🌡️ Temperature"
              value={`${data.temperature.anomaly >= 0 ? "+" : ""}${data.temperature.anomaly}°C`}
              sub={`vs ${data.years}-yr normal (${data.temperature.normal}°C)`}
            />
          </div>

          <RainChart data={data} />

          <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
            Source: {data.source}
          </p>
        </>
      )}
    </div>
  );
}
