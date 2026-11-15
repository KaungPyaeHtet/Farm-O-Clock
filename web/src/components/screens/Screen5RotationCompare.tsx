"use client";

import { useMemo, useState } from "react";
import type { CropGoals } from "@/lib/types";
import { scoreStrategies, type ScoredStrategy } from "@/lib/strategies";

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
    value >= 66 ? "bg-green-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-neutral-500">
        {icon} {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold text-neutral-700">
        {value}
      </span>
    </div>
  );
}

function StrategyCard({ s }: { s: ScoredStrategy }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        s.isBest
          ? "border-green-500 bg-green-50/40 ring-1 ring-green-500"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-neutral-900">{s.name}</h3>
            {s.isBest && (
              <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                ⭐ Best for your goals
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">{s.tag}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-neutral-900">{s.overall}</div>
          <div className="text-[10px] text-neutral-400">overall</div>
        </div>
      </div>

      {/* 3-year rotation */}
      <div className="mt-3 flex items-center gap-1">
        {s.rotation.map((crop, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700">
              Y{i + 1}: {crop}
            </span>
            {i < s.rotation.length - 1 && (
              <span className="text-neutral-300">→</span>
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
      <h2 className="text-lg font-bold text-neutral-900">Compare strategies</h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Three rotation pathways over 3 years. Drag the sliders to stress-test
        them.
      </p>

      {/* What-if sliders */}
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold text-neutral-700">🌧️ Rain</span>
          <span className="text-xs font-medium text-blue-600">
            {sliderLabel("rain", rain)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={rain}
          onChange={(e) => setRain(+e.target.value)}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-[10px] text-neutral-400">
          <span>Drier</span>
          <span>Wetter</span>
        </div>

        <div className="mt-3 mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold text-neutral-700">🌡️ Heat</span>
          <span className="text-xs font-medium text-red-600">
            {sliderLabel("heat", heat)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={heat}
          onChange={(e) => setHeat(+e.target.value)}
          className="w-full accent-red-600"
        />
        <div className="flex justify-between text-[10px] text-neutral-400">
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
