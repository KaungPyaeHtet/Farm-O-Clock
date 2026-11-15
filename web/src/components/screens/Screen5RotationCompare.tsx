"use client";

import { useMemo, useState } from "react";
import { Sprout, Droplet, ShieldCheck, CloudRain, Thermometer, Star, type LucideIcon } from "lucide-react";
import type { CropGoals } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { scoreStrategies, type ScoredStrategy } from "@/lib/strategies";
import { card } from "@/lib/ui";
import ReactiveField from "@/components/ReactiveField";

function Bar({ Icon, label, value }: { Icon: LucideIcon; label: string; value: number }) {
  const color = value >= 66 ? "bg-grass" : value >= 40 ? "bg-sun" : "bg-clay";
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-28 shrink-0 items-center gap-1 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-bold text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}

function StrategyCard({ s, labels }: { s: ScoredStrategy; labels: { soil: string; water: string; res: string; best: string; overall: string } }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        s.isBest ? "border-grass bg-grass/[0.07] ring-1 ring-grass/50" : "border-hair bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink">{s.name}</h3>
            {s.isBest && (
              <span className="flex items-center gap-1 rounded-full bg-grass px-2 py-0.5 text-[10px] font-bold text-white">
                <Star className="h-3 w-3 fill-white" /> {labels.best}
              </span>
            )}
          </div>
          <p className="text-xs text-muted">{s.tag}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-ink tabular-nums">{s.overall}</div>
          <div className="text-[10px] text-muted">{labels.overall}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {s.rotation.map((crop, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="rounded-md bg-grass/10 px-2 py-1 text-[11px] font-semibold text-ink">
              Y{i + 1}: {crop}
            </span>
            {i < s.rotation.length - 1 && <span className="text-hair">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        <Bar Icon={Sprout} label={labels.soil} value={s.soil} />
        <Bar Icon={Droplet} label={labels.water} value={s.waterThrift} />
        <Bar Icon={ShieldCheck} label={labels.res} value={s.resilience} />
      </div>
    </div>
  );
}

export default function Screen5RotationCompare({ cropGoals }: { cropGoals: CropGoals }) {
  const { t } = useLang();
  const [rain, setRain] = useState(50);
  const [heat, setHeat] = useState(50);

  const strategies = useMemo(
    () => scoreStrategies(cropGoals.crop, cropGoals.goals, rain, heat),
    [cropGoals.crop, cropGoals.goals, rain, heat]
  );

  function sliderLabel(kind: "rain" | "heat", v: number): string {
    if (kind === "rain") {
      if (v === 50) return t("As expected", "မျှော်လင့်အတိုင်း");
      const pct = Math.round((Math.abs(50 - v) / 50) * 100);
      return v < 50 ? `${pct}% ${t("drier", "ပိုခြောက်")}` : `${pct}% ${t("wetter", "ပိုစို")}`;
    }
    if (v === 50) return t("Normal", "ပုံမှန်");
    const d = Math.round(((v - 50) / 50) * 6 * 10) / 10;
    return d > 0 ? `+${d}°C ${t("hotter", "ပိုပူ")}` : `${d}°C ${t("cooler", "ပိုအေး")}`;
  }

  const labels = {
    soil: t("Soil health", "မြေကျန်းမာ"),
    water: t("Water thrift", "ရေချွေတာ"),
    res: t("Resilience", "ခံနိုင်ရည်"),
    best: t("Best for your goals", "သင့်အတွက် အကောင်းဆုံး"),
    overall: t("overall", "စုစုပေါင်း"),
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-extrabold text-ink">
        {t("Compare strategies", "နည်းလမ်းများ နှိုင်းယှဉ်")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t(
          "Three rotation pathways over 3 years. Drag the sliders to stress-test them.",
          "၃ နှစ်စာ လှည့်စိုက်နည်း ၃ မျိုး။ ဆလိုက်ဒါ ဆွဲ၍ စမ်းသပ်ပါ။"
        )}
      </p>

      {/* Reactive field picture — shows the chosen scenario at a glance */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-hair">
        <ReactiveField rain={rain} heat={heat} />
      </div>

      {/* What-if sliders */}
      <div className={`mt-3 ${card} p-4`}>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-bold text-ink">
            <CloudRain className="h-4 w-4 text-water" /> {t("Rain", "မိုး")}
          </span>
          <span className="text-xs font-semibold text-water">{sliderLabel("rain", rain)}</span>
        </div>
        <input type="range" min={0} max={100} value={rain} onChange={(e) => setRain(+e.target.value)} className="w-full accent-water" />
        <div className="flex justify-between text-[10px] text-muted">
          <span>{t("Drier", "ပိုခြောက်")}</span>
          <span>{t("Wetter", "ပိုစို")}</span>
        </div>

        <div className="mt-3 mb-1 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-bold text-ink">
            <Thermometer className="h-4 w-4 text-clay" /> {t("Heat", "အပူ")}
          </span>
          <span className="text-xs font-semibold text-clay">{sliderLabel("heat", heat)}</span>
        </div>
        <input type="range" min={0} max={100} value={heat} onChange={(e) => setHeat(+e.target.value)} className="w-full accent-clay" />
        <div className="flex justify-between text-[10px] text-muted">
          <span>{t("Cooler", "ပိုအေး")}</span>
          <span>{t("Hotter", "ပိုပူ")}</span>
        </div>
      </div>

      <div className="mt-3 space-y-3 pb-2">
        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} labels={labels} />
        ))}
      </div>
    </div>
  );
}
