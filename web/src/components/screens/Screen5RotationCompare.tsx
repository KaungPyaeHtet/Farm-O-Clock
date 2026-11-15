"use client";

import { useMemo, useState } from "react";
import type { CropGoals } from "@/lib/types";
import { scoreStrategies, type ScoredStrategy } from "@/lib/strategies";
import { glass } from "@/lib/ui";

function Bar({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  const color =
    value >= 66 ? "bg-lime-400" : value >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-white/55">
        {icon} {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold text-white/80">
        {value}
      </span>
    </div>
  );
}

function StrategyCard({ s }: { s: ScoredStrategy }) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        s.isBest
          ? "border-lime-400 bg-lime-400/[0.07] ring-1 ring-lime-400/60"
          : "border-white/10 bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">{s.name}</h3>
            {s.isBest && (
              <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-semibold text-green-950">
                ⭐ Best for your goals
              </span>
            )}
          </div>
          <p className="text-xs text-white/50">{s.tag}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{s.overall}</div>
          <div className="text-[10px] text-white/40">overall</div>
        </div>
      </div>

      {/* 3-year rotation */}
      <div className="mt-3 flex items-center gap-1">
        {s.rotation.map((crop, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80">
              Y{i + 1}: {crop}
            </span>
            {i < s.rotation.length - 1 && (
              <span className="text-white/30">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="mt-3 space-y-1.5">
        <Bar icon="🌱" label="Soil health" value={s.soil} />
        <Bar icon="💧" label="Water thrift" value={s.waterThrift} />
        <Bar icon="🛡️" label="Resilience" value={s.resilience} />
      </div>
    </div>
  );
}

function sliderLabel(kind: "rain" | "heat", v: number): string {
  if (kind === "rain") {
    if (v === 50) return "As expected";
    const pct = Math.round((Math.abs(50 - v) / 50) * 100);
    return v < 50 ? `${pct}% drier` : `${pct}% wetter`;
  }
  if (v === 50) return "Normal";
  const d = Math.round(((v - 50) / 50) * 6 * 10) / 10;
  return d > 0 ? `+${d}°C hotter` : `${d}°C cooler`;
}

export default function Screen5RotationCompare({
  cropGoals,
}: {
  cropGoals: CropGoals;
}) {
  const [rain, setRain] = useState(50);
  const [heat, setHeat] = useState(50);

  const strategies = useMemo(
    () => scoreStrategies(cropGoals.crop, cropGoals.goals, rain, heat),
    [cropGoals.crop, cropGoals.goals, rain, heat]
  );

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-bold text-white">Compare strategies</h2>
      <p className="mt-0.5 text-sm text-white/50">
        Three rotation pathways over 3 years. Drag the sliders to stress-test
        them.
      </p>

      {/* What-if sliders */}
      <div className={`mt-4 ${glass} p-4`}>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold text-white/80">🌧️ Rain</span>
          <span className="text-xs font-medium text-sky-300">
            {sliderLabel("rain", rain)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={rain}
          onChange={(e) => setRain(+e.target.value)}
          className="w-full accent-sky-400"
        />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>Drier</span>
          <span>Wetter</span>
        </div>

        <div className="mt-3 mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold text-white/80">🌡️ Heat</span>
          <span className="text-xs font-medium text-red-300">
            {sliderLabel("heat", heat)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={heat}
          onChange={(e) => setHeat(+e.target.value)}
          className="w-full accent-red-400"
        />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>Cooler</span>
          <span>Hotter</span>
        </div>
      </div>

      {/* Strategy cards */}
      <div className="mt-3 space-y-3 pb-2">
        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}
