"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CloudRain, Thermometer, Star, Sprout, Droplet, ShieldCheck, type LucideIcon } from "lucide-react";
import type { CropGoals, LatLng } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { cropLabel, scoreStrategies, STRATEGY_TEXT as STRAT_TEXT, type FieldInputs, type RotationApi, inputsFromRotation, type ScoredStrategy } from "@/lib/strategies";
import { fetchJson } from "@/lib/fetchJson";
import type { EnvData, SoilData } from "@/lib/types";
import { card } from "@/lib/ui";
import ReactiveField from "@/components/ReactiveField";
import ScenarioNote from "@/components/ScenarioNote";
import { Screen } from "@/components/Screen";

const RATING = {
  good: { dot: "bg-grass", en: "Good", my: "ကောင်း" },
  ok: { dot: "bg-sun", en: "OK", my: "သင့်" },
  poor: { dot: "bg-clay", en: "Poor", my: "ညံ့" },
} as const;
const rate = (v: number) => (v >= 60 ? "good" : v >= 40 ? "ok" : "poor");

function Rating({ Icon, label, value }: { Icon: LucideIcon; label: string; value: number }) {
  const { t } = useLang();
  const r = RATING[rate(value)];
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-paper/60 px-2 py-2">
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} /> {t(r.en, r.my)}
      </span>
    </div>
  );
}

function StrategyCard({ s }: { s: ScoredStrategy }) {
  const { t, lang } = useLang();
  const text = STRAT_TEXT[s.id];
  const soilEnd = s.soilTrajectory[s.soilTrajectory.length - 1];
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={`flex h-full flex-col rounded-2xl border p-4 lg:p-5 ${
        s.isBest ? "border-grass bg-grass/[0.07] ring-1 ring-grass/50" : "border-hair bg-surface"
      }`}
    >
      {/* Badge row: reserved on desktop so all three titles line up */}
      {s.isBest ? (
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-grass px-2 py-0.5 text-[11px] font-bold text-white">
          <Star className="h-3 w-3 fill-white" /> {t("Best for your goals", "သင့်အတွက် အကောင်းဆုံး")}
        </span>
      ) : (
        <span aria-hidden className="mb-2 hidden h-[20px] lg:block" />
      )}
      <h3 className="text-base font-bold text-ink">{t(...text.name)}</h3>

      {/* 3-year plan: three equal tiles, never wraps unevenly */}
      <ol className="mt-3 grid grid-cols-3 gap-1.5">
        {s.rotation.map((crop, i) => {
          const changed = i === 1 && s.id !== "baseline";
          return (
            <li
              key={i}
              className={`flex min-h-[3.25rem] flex-col justify-center rounded-xl px-2 py-1.5 text-center ${
                changed ? "bg-grass text-white" : "bg-grass/10 text-ink"
              }`}
            >
              <span className={`text-[10px] font-semibold ${changed ? "text-white/80" : "text-muted"}`}>
                {t(`Year ${i + 1}`, `နှစ် ${i + 1}`)}
              </span>
              <span className="text-sm font-bold leading-tight">{cropLabel(crop, lang)}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t(...text.why)}</p>
      {s.irrigationMm != null && (
        <p className="mt-2 text-xs text-ink">
          <Droplet className="mr-1 inline h-3.5 w-3.5 text-water" />
          {s.irrigationMm < 50
            ? t("Rain covers almost all the water this plan needs.", "ဤအစီအစဉ်အတွက် ရေကို မိုးက အများစု ဖြည့်ပေးသည်။")
            : t(
                `Extra water needed: about ${s.irrigationMm.toLocaleString()} mm over 3 years`,
                `ထပ်လိုသောရေ: ၃ နှစ်တွင် ${s.irrigationMm.toLocaleString()} မမ ခန့်`
              )}
        </p>
      )}

      {(s.incomeUsd != null || (s.soilLossT != null && s.soilLossT >= 1)) && (
        <p className="mt-1 text-xs text-muted">
          {s.incomeUsd != null && t(`Income: about $${Math.round(s.incomeUsd / 10) * 10}/ha a year`, `ဝင်ငွေ: တစ်နှစ် ဟက်တာလျှင် $${Math.round(s.incomeUsd / 10) * 10} ခန့်`)}
          {s.incomeUsd != null && s.soilLossT != null && s.soilLossT >= 1 && " · "}
          {s.soilLossT != null && s.soilLossT >= 1 && t(`Soil loss: about ${s.soilLossT.toFixed(0)} t/ha a year`, `မြေဆုံးရှုံး: တစ်နှစ် ဟက်တာလျှင် ${s.soilLossT.toFixed(0)} တန်ခန့်`)}
        </p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Rating Icon={Sprout} label={t("Soil", "မြေ")} value={soilEnd} />
        <Rating Icon={Droplet} label={t("Water", "ရေ")} value={s.waterThrift} />
        <Rating Icon={ShieldCheck} label={t("Weather", "ရာသီဥတု")} value={s.resilience} />
      </div>
    </motion.div>
  );
}

export default function Screen5RotationCompare({ cropGoals, pin, country }: { cropGoals: CropGoals; pin: LatLng | null; country: string | null }) {
  const { t } = useLang();
  const [rain, setRain] = useState(50);
  const [heat, setHeat] = useState(50);
  const [inputs, setInputs] = useState<FieldInputs>({});

  // Measured field inputs (optional): FAO-56 water per plan + SoilGrids soil health.
  useEffect(() => {
    if (!pin) return;
    let active = true;
    const crop = cropGoals.crop ?? "rice";
    fetchJson<RotationApi>(`/api/rotation?lat=${pin.lat}&lng=${pin.lng}&crop=${crop}`)
      .then((d) => active && setInputs((i) => ({ ...i, ...inputsFromRotation(d) })))
      .catch(() => {});
    fetchJson<EnvData>(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && d.terrain.value != null && setInputs((i) => ({ ...i, slopeDeg: d.terrain.value as number })))
      .catch(() => {});
    fetchJson<SoilData>(`/api/soil?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setInputs((i) => ({ ...i, soilHealth: d.health, soilTex: { sand: d.sand, silt: d.silt, clay: d.clay, soc: d.soc } })))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pin, cropGoals.crop]);

  const strategies = useMemo(
    () =>
      scoreStrategies(cropGoals.crop, cropGoals.goals, rain, heat, { ...inputs, country }).sort(
        (a, b) => b.goalFit - a.goalFit || b.overall - a.overall
      ),
    [cropGoals.crop, cropGoals.goals, rain, heat, inputs, country]
  );

  function sliderLabel(kind: "rain" | "heat", v: number): string {
    if (kind === "rain") {
      const pct = Math.round(v - 50); // same mapping the season re-run uses
      if (pct === 0) return t("As expected", "မျှော်လင့်အတိုင်း");
      return pct < 0 ? `${-pct}% ${t("less rain", "မိုးနည်း")}` : `${pct}% ${t("more rain", "မိုးများ")}`;
    }
    const d = Math.round(((v - 50) / 50) * 6 * 10) / 10;
    if (d === 0) return t("Normal", "ပုံမှန်");
    return d > 0 ? `+${d}°C ${t("hotter", "ပိုပူ")}` : `${d}°C ${t("cooler", "ပိုအေး")}`;
  }

  return (
    <Screen
      title={t("Compare 3 rotation plans", "လှည့်စိုက်နည်း ၃ မျိုး နှိုင်းယှဉ်")}
      subtitle={t(
        "What if the season is drier, wetter or hotter? Move the sliders and watch the plans re-rank.",
        "ရာသီ ပိုခြောက်၊ ပိုစို၊ ပိုပူလျှင်? ဆလိုက်ဒါ ရွှေ့ပြီး အစီအစဉ်များ ပြန်စီသည်ကို ကြည့်ပါ။"
      )}
    >
     <div className="md:grid md:grid-cols-2 md:gap-4">
      {/* Reactive field picture */}
      <div className="overflow-hidden rounded-2xl border border-hair">
        <ReactiveField rain={rain} heat={heat} />
      </div>

      {/* What-if sliders */}
      <div className={`mt-3 md:mt-0 md:flex md:flex-col md:justify-center ${card} p-4 lg:p-6`}>
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
        {pin && <ScenarioNote pin={pin} rain={rain} heat={heat} />}
      </div>

     </div>

      {/* Re-ranking strategy cards */}
      <div className="mt-3 grid items-stretch gap-3 lg:mt-4 lg:grid-cols-3 lg:gap-4">
        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} />
        ))}
      </div>
    </Screen>
  );
}
