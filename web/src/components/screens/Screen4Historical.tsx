"use client";

import { useEffect, useState } from "react";
import type { HistoryData, LatLng, Verdict } from "@/lib/types";
import { glass } from "@/lib/ui";

const VERDICT: Record<
  Verdict,
  { title: string; emoji: string; banner: string }
> = {
  normal: {
    title: "Normal season",
    emoji: "✅",
    banner: "border-lime-400/25 bg-lime-400/10 text-lime-200",
  },
  dry: {
    title: "Drier than usual",
    emoji: "🏜️",
    banner: "border-red-400/25 bg-red-400/10 text-red-200",
  },
  wet: {
    title: "Wetter than usual",
    emoji: "🌊",
    banner: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  },
};

function RainChart({ data }: { data: HistoryData }) {
  const max = Math.max(...data.series.map((s) => s.rain), 1);
  const normalPct = (data.rainfall.normal / max) * 100;
  return (
    <div className={`mt-3 ${glass} p-4`}>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>Seasonal rainfall by year (mm)</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-lime-400" /> this year
        </span>
      </div>
      <div className="relative mt-3 flex h-36 items-end gap-[3px]">
        {/* historical average line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-white/35"
          style={{ bottom: `${normalPct}%` }}
        >
          <span className="absolute -top-2 left-0 rounded bg-black/40 px-1 text-[10px] font-medium text-white/60">
            avg {data.rainfall.normal} mm
          </span>
        </div>
        {data.series.map((s) => (
          <div
            key={s.year}
            className="relative flex-1"
            style={{ height: `${(s.rain / max) * 100}%` }}
            title={`${s.year}: ${s.rain} mm`}
          >
            <div
              className={`h-full w-full rounded-t ${
                s.isCurrent ? "bg-lime-400" : "bg-white/20"
              }`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-white/40">
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
    <div className={`${glass} p-4`}>
      <div className="text-xs font-medium text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-xs text-white/50">{sub}</div>
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
      <h2 className="text-lg font-bold text-white">Historical context</h2>
      <p className="mt-0.5 text-sm text-white/50">
        Is this season unusual for your farm?
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          <div className="h-20 animate-pulse rounded-3xl bg-white/5" />
          <div className="h-44 animate-pulse rounded-3xl bg-white/5" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-3xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          Couldn’t load history: {error}
        </div>
      )}

      {data && (
        <>
          {/* Verdict banner */}
          <div
            className={`mt-4 rounded-3xl border p-4 ${VERDICT[data.verdict].banner}`}
          >
            <div className="text-base font-bold">
              {VERDICT[data.verdict].emoji} {VERDICT[data.verdict].title}
            </div>
            <p className="mt-1 text-sm opacity-90">
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

          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
            Source: {data.source}
          </p>
        </>
      )}
    </div>
  );
}
