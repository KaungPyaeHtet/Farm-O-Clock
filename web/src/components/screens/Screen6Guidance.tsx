"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Share2, Check, CalendarCheck, Sprout, CloudSun, Shovel } from "lucide-react";
import type { CropGoals, EnvData, HistoryData, LatLng, ReplayData, SoilData, Verdict } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { cropLabel, scoreStrategies, STRATEGY_TEXT, type FieldInputs, type RotationApi, inputsFromRotation } from "@/lib/strategies";
import { buildBrief } from "@/lib/brief";
import { shareCard } from "@/lib/shareCard";
import { card, primaryBtn } from "@/lib/ui";
import { fetchJson } from "@/lib/fetchJson";
import { Screen } from "@/components/Screen";
import { bestUpcoming, fmtDate, fromNow, seasonDates } from "@/lib/season";

const VERDICT: Record<Verdict, { en: string; my: string; dot: string }> = {
  dry: { en: "Drier than usual", my: "ပုံမှန်ထက် ခြောက်", dot: "bg-clay" },
  normal: { en: "About normal", my: "ပုံမှန်", dot: "bg-grass" },
  wet: { en: "Wetter than usual", my: "ပုံမှန်ထက် စို", dot: "bg-water" },
};

function Fact({ Icon, label, children }: { Icon: typeof Sprout; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-paper/70 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-base font-extrabold leading-tight text-ink">{children}</div>
    </div>
  );
}

export default function Screen6Guidance({
  pin,
  place,
  country,
  cropGoals,
}: {
  pin: LatLng | null;
  place: string;
  country: string | null;
  cropGoals: CropGoals;
}) {
  const { lang, t } = useLang();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [sowing, setSowing] = useState<string | null>(null);
  const [sowMeta, setSowMeta] = useState<{ date: Date; chance: number | null } | null>(null);
  const [soilText, setSoilText] = useState<{ texture: string; organic: string } | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [damp, setDamp] = useState<boolean | null>(null);
  const [satWet, setSatWet] = useState<number | null>(null);
  const [inputs, setInputs] = useState<FieldInputs>({});

  const best = useMemo(() => {
    const scored = scoreStrategies(cropGoals.crop, cropGoals.goals, 50, 50, { ...inputs, country });
    return scored.find((s) => s.isBest) ?? scored[0];
  }, [cropGoals.crop, cropGoals.goals, inputs, country]);

  useEffect(() => {
    if (!pin) return;
    let active = true;
    fetchJson<HistoryData>(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setVerdict(d.verdict))
      .catch(() => {});
    fetchJson<RotationApi>(`/api/rotation?lat=${pin.lat}&lng=${pin.lng}&crop=${cropGoals.crop ?? "rice"}`)
      .then((d) => active && setInputs((i) => ({ ...i, ...inputsFromRotation(d) })))
      .catch(() => {});
    fetchJson<SoilData>(`/api/soil?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        setInputs((i) => ({ ...i, soilHealth: d.health, soilTex: { sand: d.sand, silt: d.silt, clay: d.clay, soc: d.soc } }));
        setSoilText({ texture: d.texture, organic: d.organic });
      })
      .catch(() => {});
    fetchJson<EnvData>(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        if (d.soilMoisture.value != null) setSatWet(d.soilMoisture.value / 100);
        if (d.terrain.value != null) setInputs((i) => ({ ...i, slopeDeg: d.terrain.value as number }));
      })
      .catch(() => {});
    fetchJson<ReplayData>(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        const dates = seasonDates(d.weeks);
        const i = bestUpcoming(dates, (k) => d.weekAgg[k].chance ?? d.weekAgg[k].goodCount / 20);
        setSowing(dates[i] ? fmtDate(dates[i].date) : (d.weeks[i]?.label ?? null));
        if (dates[i]) setSowMeta({ date: dates[i].date, chance: d.weekAgg[i]?.chance ?? null });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pin, cropGoals.crop]);

  const brief = useMemo(
    () => buildBrief(cropGoals.crop, cropGoals.goals, best, verdict, lang),
    [cropGoals.crop, cropGoals.goals, best, verdict, lang]
  );
  const planName = t(...STRATEGY_TEXT[best.id].name);

  // Add this pin's own numbers (from /api/rotation) to the reason, when they've loaded.
  const evidence = (() => {
    const lr = inputs.lowRisk;
    if (!lr || lr[best.id] == null) return "";
    const n = Math.round(lr[best.id]! * 20);
    const base = lr.baseline != null ? Math.round(lr.baseline * 20) : null;
    const wBest = inputs.water?.[best.id]?.irrigation_mm;
    const wBase = inputs.water?.baseline?.irrigation_mm;
    const crop = cropLabel(best.rotation[0], lang);
    const parts: string[] = [];
    parts.push(
      best.id !== "baseline" && base != null
        ? t(`Here, this plan’s crops went well in ${n} of 20 past seasons (${crop} alone: ${base}).`,
            `ဤနေရာတွင် ဤအစီအစဉ်၏ သီးနှံများ ယခင် ရာသီ ၂၀ အနက် ${n} ခု အဆင်ပြေခဲ့သည် (${crop} တစ်မျိုးတည်း: ${base})။`)
        : t(`Here, ${crop} went well in ${n} of 20 past seasons.`, `ဤနေရာတွင် ${crop} သည် ယခင် ရာသီ ၂၀ အနက် ${n} ခု အဆင်ပြေခဲ့သည်။`)
    );
    if (best.id !== "baseline" && wBest != null && wBase != null && wBase - wBest >= 50) {
      const saved = Math.round((wBase - wBest) / 10) * 10;
      parts.push(t(`It needs about ${saved.toLocaleString()} mm less extra water over 3 years.`,
                   `၃ နှစ်တွင် ထပ်လိုရေ ${saved.toLocaleString()} မမ ခန့် လျော့သည်။`));
    }
    return " " + parts.join(" ");
  })();
  const whyText = brief.why + evidence;
  const checklist = brief.checklist;

  // Save the finished plan once (anonymous) to Supabase `fields` + `plans` (no-op without a database).
  const savedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!pin || !sowing || !verdict) return;
    const key = JSON.stringify([pin.lat, pin.lng, cropGoals.crop, cropGoals.goals, best.id, sowing]);
    if (savedKey.current === key) return;
    savedKey.current = key;
    fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pin.lat,
        lng: pin.lng,
        crop: cropGoals.crop,
        goals: cropGoals.goals,
        constraints: cropGoals.constraints,
        lang,
        sowingWeek: sowing,
        strategyId: best.id,
        verdict,
        scores: { soil: best.soil, water: best.waterThrift, resilience: best.resilience, irrigation_mm: best.irrigationMm },
      }),
    }).catch(() => {});
  }, [pin, sowing, verdict, cropGoals, best, lang]);

  // Farmer ground truth → community observations (no-op without a database).
  function answerDamp(v: boolean) {
    setDamp(v);
    if (!pin) return;
    fetch("/api/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pin.lat,
        lng: pin.lng,
        soilMoisture: v ? "damp" : "dry",
        ...(satWet != null ? { gwettop: satWet } : {}),
      }),
    }).catch(() => {});
  }

  function share() {
    const rel = sowMeta ? fromNow(sowMeta.date, t) : null;
    const inTen = sowMeta?.chance != null ? Math.round(sowMeta.chance * 10) : null;
    const sub = [rel, inTen != null ? t(`about ${inTen} in 10 seasons go well`, `ရာသီ ၁၀ ခုတွင် ${inTen} ခုခန့် အဆင်ပြေ`) : null]
      .filter(Boolean)
      .join(" · ");
    const water = best.irrigationMm;
    const ORGANIC: Record<string, [string, string]> = { good: ["good", "ကောင်း"], medium: ["medium", "အလယ်အလတ်"], low: ["low", "နည်း"] };
    shareCard({
      brand: t("FARM O’CLOCK · PLANTING PLAN", "FARM O’CLOCK · စိုက်ပျိုးရေး အစီအစဉ်"),
      place: place || t("Your field", "သင့်လယ်"),
      dateLine: t(`Made ${fmtDate(new Date())}`, `ပြုလုပ်သည့်ရက် ${fmtDate(new Date())}`),
      hero: { label: t("SOW AROUND", "စိုက်ရန်"), value: sowing ?? "—", sub: sub || undefined },
      stats: [
        {
          label: t("THIS SEASON", "ဤရာသီ"),
          value: verdict ? t(VERDICT[verdict].en, VERDICT[verdict].my) : "—",
          tone: verdict === "dry" ? "alert" : verdict === "wet" ? "info" : "good",
        },
        { label: t("PLAN", "အစီအစဉ်"), value: planName },
        {
          label: t("EXTRA WATER, 3 YEARS", "ထပ်လိုရေ (၃ နှစ်)"),
          value: water == null ? "—" : water < 50 ? t("Rain covers it", "မိုးဖြင့် လုံလောက်") : `${water.toLocaleString()} mm`,
          tone: water == null ? undefined : water < 300 ? "good" : water < 1200 ? "watch" : "alert",
        },
        {
          label: t("SOIL", "မြေ"),
          value: soilText
            ? `${soilText.texture} · ${t("organic", "အော်ဂဲနစ်")} ${t(...(ORGANIC[soilText.organic] ?? [soilText.organic, soilText.organic]))}`
            : "—",
        },
      ],
      rotationTitle: t("3-YEAR CROP PLAN", "၃ နှစ် သီးနှံ အစီအစဉ်"),
      rotation: best.rotation.map((c, i) => ({
        label: t(`Year ${i + 1}`, `နှစ် ${i + 1}`),
        value: cropLabel(c, lang),
        highlight: i === 1 && best.id !== "baseline",
      })),
      checklistTitle: t("Before you plant", "မစိုက်ခင်"),
      checklist: [t("Dig 15 cm: the soil should feel damp", "၁၅ စင်တီမီတာ တူးပါ: မြေ စိုနေရမည်"), ...checklist],
      footer: t("NASA POWER · MODIS · SoilGrids  —  farm-oclock-five.vercel.app", "NASA POWER · MODIS · SoilGrids  —  farm-oclock-five.vercel.app"),
      shareTitle: "Farm O’Clock",
    });
  }

  const checkBox = (on: boolean) => (
    <span
      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
        on ? "border-grass bg-grass text-white" : "border-hair text-transparent"
      }`}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );

  return (
    <Screen title={brief.headline} subtitle={place ? t(`Near ${place}`, `${place} အနီး`) : undefined}>
      <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-8">
        {/* The plan */}
        <div>
          <div className={`${card} p-4 lg:p-5`}>
            <h3 className="text-sm font-bold text-ink">{t("At a glance", "အကျဉ်းချုပ်")}</h3>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact Icon={CalendarCheck} label={t("Sow around", "စိုက်ရန်")}>
                {sowing ?? "…"}
              </Fact>
              <Fact Icon={CloudSun} label={t("This season", "ဤရာသီ")}>
                {verdict ? (
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${VERDICT[verdict].dot}`} />
                    {t(VERDICT[verdict].en, VERDICT[verdict].my)}
                  </span>
                ) : (
                  "…"
                )}
              </Fact>
              <div className="col-span-2 sm:col-span-1">
                <Fact Icon={Sprout} label={t("Plan", "အစီအစဉ်")}>
                  {planName}
                </Fact>
              </div>
            </div>

            <ol className="mt-3 grid grid-cols-3 gap-1.5">
              {best.rotation.map((crop, i) => {
                const changed = i === 1 && best.id !== "baseline";
                return (
                  <li
                    key={i}
                    className={`rounded-xl px-2 py-1.5 text-center ${changed ? "bg-grass text-white" : "bg-grass/10 text-ink"}`}
                  >
                    <span className={`block text-[10px] font-semibold ${changed ? "text-white/80" : "text-muted"}`}>
                      {t(`Year ${i + 1}`, `နှစ် ${i + 1}`)}
                    </span>
                    <span className="text-sm font-bold leading-tight">{cropLabel(crop, lang)}</span>
                  </li>
                );
              })}
            </ol>

            <p className="mt-3 text-sm leading-relaxed text-muted">{whyText}</p>
          </div>

          <button onClick={share} className={`mt-3 flex w-full items-center justify-center gap-2 py-3.5 text-sm ${primaryBtn}`}>
            <Share2 className="h-4 w-4" /> {t("Share my plan", "အစီအစဉ် မျှဝေမည်")}
          </button>
        </div>

        {/* Field check */}
        <div className="mt-6 lg:mt-0">
          <h3 className="text-sm font-bold text-ink">{t("Before you plant", "မစိုက်ခင်")}</h3>
          <div className="mt-2 space-y-2">
            <div className={`${card} p-3`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Shovel className="h-4 w-4 text-grass" />
                {t("Dig 15 cm. Is the soil damp?", "၁၅ စင်တီမီတာ တူးပါ။ မြေ စိုနေသလား?")}
              </p>
              <div className="mt-2 flex gap-2">
                {[
                  { v: true, en: "Yes, damp", my: "စိုသည်" },
                  { v: false, en: "No, dry", my: "ခြောက်သည်" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    onClick={() => answerDamp(o.v)}
                    aria-pressed={damp === o.v}
                    className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                      damp === o.v ? "border-grass bg-grass text-white" : "border-hair bg-surface text-ink"
                    }`}
                  >
                    {t(o.en, o.my)}
                  </button>
                ))}
              </div>
              {damp === false && (
                <p className="mt-2 text-xs text-[#9a6a0c]">
                  {t("Wait for rain or water before sowing.", "မစိုက်ခင် မိုး သို့ ရေ စောင့်ပါ။")}
                </p>
              )}
              {damp === true && verdict === "wet" && (
                <p className="mt-2 text-xs text-[#9a6a0c]">
                  {t("Check drainage — the season is wetter than usual.", "ရေထုတ်မြောင်း စစ်ပါ — ရာသီ ပုံမှန်ထက် စိုသည်။")}
                </p>
              )}
              {damp != null && (
                <p className="mt-1 text-[11px] text-muted">
                  {t("Thanks — your answer helps farms nearby.", "ကျေးဇူးပါ — သင့်အဖြေ အနီးရှိလယ်များကို ကူညီသည်။")}
                </p>
              )}
            </div>

            {checklist.map((item, i) => {
              const on = !!checked[i];
              return (
                <button
                  key={i}
                  onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  aria-pressed={on}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${
                    on ? "border-grass/50 bg-grass/10 text-muted line-through" : "border-hair bg-surface text-ink"
                  }`}
                >
                  {checkBox(on)}
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        {t(
          "This plan supports your own judgment. Check your field and ask local experts before planting.",
          "ဤအစီအစဉ်သည် သင့်ဆုံးဖြတ်ချက်ကို ကူညီရန်သာ။ မစိုက်ခင် လယ်ကို စစ်ပြီး ဒေသကျွမ်းကျင်သူများကို မေးပါ။"
        )}
      </p>
    </Screen>
  );
}
