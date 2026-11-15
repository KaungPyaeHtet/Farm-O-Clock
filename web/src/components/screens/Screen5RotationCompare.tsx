"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Droplet,
  ShieldCheck,
  CloudRain,
  Thermometer,
  Star,
  TrendingUp,
  TrendingDown,
  Wheat,
  Bean,
  Flower2,
  Sprout,
  Carrot,
  Leaf,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { CropGoals } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { scoreStrategies, type ScoredStrategy } from "@/lib/strategies";
import { card } from "@/lib/ui";
import ReactiveField from "@/components/ReactiveField";

function cropIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("cover") || n.includes("clover") || n.includes("hemp")) return Leaf;
  if (/(bean|pea|lentil|chickpea|cowpea|gram|soy)/.test(n)) return Bean;
  if (n.includes("cotton")) return Flower2;
  if (n.includes("potato")) return Sprout;
  if (n.includes("veg") || n.includes("carrot")) return Carrot;
  if (/(rice|wheat|maize|sorghum|millet|cane|corn)/.test(n)) return Wheat;
  return Sprout;
}

function RotationTimeline({ rotation }: { rotation: string[] }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-1">
      {rotation.map((crop, i) => {
        const Icon = cropIcon(crop);
        const isPartner = i === 1;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1" style={{ width: 58 }}>
              <div
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  isPartner ? "bg-grass text-white" : "bg-grass/15 text-grass"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-center text-[10px] leading-tight text-muted">
                {crop}
              </span>
            </div>
            {i < rotation.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-hair" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SoilTrajectory({ traj, label }: { traj: number[]; label: string }) {
  const rising = traj[traj.length - 1] >= traj[0];
  const Trend = rising ? TrendingUp : TrendingDown;
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Sprout className="h-3.5 w-3.5" /> {label}
        </span>
        <Trend className={`h-4 w-4 ${rising ? "text-grass" : "text-clay"}`} />
      </div>
      <div className="flex h-12 items-end gap-1.5">
        {traj.map((v, i) => (
          <motion.div
            key={i}
            className={`flex-1 rounded-t ${rising ? "bg-grass" : "bg-clay"}`}
            animate={{ height: `${Math.max(10, v)}%` }}
            transition={{ duration: 0.35 }}
          />
        ))}
      </div>
      <div className="mt-0.5 flex gap-1.5">
        {traj.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-muted">
            Y{i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bar({ Icon, label, value }: { Icon: LucideIcon; label: string; value: number }) {
  const color = value >= 66 ? "bg-grass" : value >= 40 ? "bg-sun" : "bg-clay";
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-28 shrink-0 items-center gap-1 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair">
        <motion.div
          className={`h-full rounded-full ${color}`}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-bold text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}

function StrategyCard({
  s,
  rank,
  labels,
}: {
  s: ScoredStrategy;
  rank: number;
  labels: { soil: string; water: string; res: string; best: string; overall: string };
}) {
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={`rounded-2xl border p-4 ${
        s.isBest ? "border-grass bg-grass/[0.07] ring-1 ring-grass/50" : "border-hair bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">#{rank}</span>
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

      <RotationTimeline rotation={s.rotation} />
      <SoilTrajectory traj={s.soilTrajectory} label={labels.soil} />

      <div className="mt-3 space-y-1.5">
        <Bar Icon={Droplet} label={labels.water} value={s.waterThrift} />
        <Bar Icon={ShieldCheck} label={labels.res} value={s.resilience} />
      </div>
    </motion.div>
  );
}

export default function Screen5RotationCompare({ cropGoals }: { cropGoals: CropGoals }) {
  const { t } = useLang();
  const [rain, setRain] = useState(50);
  const [heat, setHeat] = useState(50);

  const strategies = useMemo(
    () =>
      scoreStrategies(cropGoals.crop, cropGoals.goals, rain, heat).sort(
        (a, b) => b.goalFit - a.goalFit || b.overall - a.overall
      ),
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
    soil: t("Soil health over 3 yrs", "၃ နှစ် မြေကျန်းမာရေး"),
    water: t("Water thrift", "ရေချွေတာ"),
    res: t("Resilience", "ခံနိုင်ရည်"),
    best: t("Best for your goals", "သင့်အတွက် အကောင်းဆုံး"),
    overall: t("overall", "စုစုပေါင်း"),
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-extrabold text-ink">
        {t("3 possible futures", "ဖြစ်နိုင်ခြေ ၃ မျိုး")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t(
          "Drag the sliders — the cards re-rank for your goals.",
          "ဆလိုက်ဒါ ဆွဲပါ — ကတ်များ သင့်ရည်မှန်းချက်အလိုက် ပြန်စီသည်။"
        )}
      </p>

      {/* Reactive field picture */}
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

      {/* Re-ranking strategy cards */}
      <div className="mt-3 flex flex-col gap-3 pb-2">
        {strategies.map((s, i) => (
          <StrategyCard key={s.id} s={s} rank={i + 1} labels={labels} />
        ))}
      </div>
    </div>
  );
}
