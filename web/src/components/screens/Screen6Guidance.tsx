"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Share2, Check, CalendarCheck, Sprout, CloudSun, Shovel } from "lucide-react";
import type { CropGoals, EnvData, HistoryData, LatLng, ReplayData, SoilData, SowPick, Verdict, WhatIf } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { cropLabel, rotationUrl, scoreStrategies, STRATEGY_TEXT, whatIfLabel, type FieldInputs, type RotationApi, inputsFromRotation } from "@/lib/strategies";
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
  sow,
  whatIf,
}: {
  pin: LatLng | null;
  place: string;
  country: string | null;
  cropGoals: CropGoals;
  /** The week chosen on the Sowing screen (null → best week still ahead). */
  sow: SowPick | null;
  /** The what-if weather from the Rotations screen (50/50 = as expected). */
  whatIf: WhatIf;
}) {
  const { lang, t } = useLang();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [recentLabel, setRecentLabel] = useState<string | null>(null); // e.g. "Aug–Nov"
  const [frostShare, setFrostShare] = useState<number | null>(null);
  const [soilState, setSoilState] = useState<"loading" | "ok" | "down">("loading");
  const [soilAsOf, setSoilAsOf] = useState<string | null>(null);
  const [soilNearKm, setSoilNearKm] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveTry, setSaveTry] = useState(0);
  const [dampState, setDampState] = useState<"idle" | "sending" | "sent" | "failed" | "limit">("idle");
  const frost = cropGoals.constraints.includes("frost_sensitive");
  const whatIfText = whatIfLabel(whatIf.rain, whatIf.heat, t);
  const [sowing, setSowing] = useState<string | null>(null);
  const [sowMeta, setSowMeta] = useState<{ date: Date; chance: number | null } | null>(null);
  const [soilText, setSoilText] = useState<{ texture: string; organic: string } | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [damp, setDamp] = useState<boolean | null>(null);
  const [inputs, setInputs] = useState<FieldInputs>({});

  const best = useMemo(() => {
    // Same what-if and constraints as the Rotations screen, so the plan matches the card the farmer saw.
    const scored = scoreStrategies(cropGoals.crop, cropGoals.goals, whatIf.rain, whatIf.heat, {
      ...inputs,
      country,
      constraints: cropGoals.constraints,
    });
    return scored.find((s) => s.isBest) ?? scored[0];
  }, [cropGoals.crop, cropGoals.goals, cropGoals.constraints, whatIf.rain, whatIf.heat, inputs, country]);

  useEffect(() => {
    if (!pin) return;
    let active = true;
    fetchJson<HistoryData>(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        setVerdict(d.verdict);
        setRecentLabel(d.seasonLabel ?? null);
      })
      .catch(() => {});
    fetchJson<RotationApi>(rotationUrl(pin, cropGoals.crop ?? "rice", sow, frost))
      .then((d) => {
        if (!active) return;
        setInputs((i) => ({ ...i, ...inputsFromRotation(d) }));
        setFrostShare(d.main_frost_share ?? null);
      })
      .catch(() => {});
    fetchJson<SoilData>(`/api/soil?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        setInputs((i) => ({ ...i, soilHealth: d.health, soilTex: { sand: d.sand, silt: d.silt, clay: d.clay, soc: d.soc } }));
        setSoilText({ texture: d.texture, organic: d.organic });
        setSoilAsOf(d.asOf ?? null);
        setSoilNearKm(d.nearbyKm ?? null);
        setSoilState("ok");
      })
      .catch(() => active && setSoilState("down"));
    fetchJson<EnvData>(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        if (d.terrain.value != null) setInputs((i) => ({ ...i, slopeDeg: d.terrain.value as number }));
      })
      .catch(() => {});
    fetchJson<ReplayData>(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        const dates = seasonDates(d.weeks);
        // The farmer's chosen week from the Sowing screen; the best week still ahead only if none.
        const i =
          sow && sow.idx < d.weeks.length && d.weeks[sow.idx].startDoy === sow.doy
            ? sow.idx
            : bestUpcoming(dates, (k) => d.weekAgg[k].chance ?? d.weekAgg[k].goodCount / 20);
        setSowing(dates[i] ? fmtDate(dates[i].date) : (d.weeks[i]?.label ?? null));
        if (dates[i]) setSowMeta({ date: dates[i].date, chance: d.weekAgg[i]?.chance ?? null });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pin, cropGoals.crop, sow, frost]);

  const brief = useMemo(
    () => buildBrief(cropGoals.crop, cropGoals.goals, best, verdict, lang, { constraints: cropGoals.constraints, frostShare }),
    [cropGoals.crop, cropGoals.goals, cropGoals.constraints, best, verdict, lang, frostShare]
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

  // Save the finished plan (anonymous) to Supabase `fields` + `plans`. Marked saved only when the
  // server says so; the same saveId is reused on retry so a plan is never stored twice.
  const savedKey = useRef<string | null>(null);
  const saveIds = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!pin || !sowing || !verdict) return;
    const key = JSON.stringify([pin.lat, pin.lng, cropGoals, best.id, sowing, whatIf, lang]);
    if (savedKey.current === `${key}#${saveTry}`) return;
    savedKey.current = `${key}#${saveTry}`;
    const saveId = (saveIds.current[key] ??= crypto.randomUUID());
    let active = true;
    setSaveState("saving");
    fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saveId,
        whatIf,
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
    })
      .then((r) => active && setSaveState(r.ok ? "saved" : r.status === 503 ? "idle" : "failed")) // 503 = no database here
      .catch(() => active && setSaveState("failed"));
    return () => {
      active = false;
    };
  }, [pin, sowing, verdict, cropGoals, best, lang, whatIf, saveTry]);

  // Farmer ground truth → community observations (no-op without a database).
  function answerDamp(v: boolean) {
    setDamp(v);
    if (!pin) return;
    setDampState("sending");
    fetch("/api/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The server looks up the satellite reading itself; the client never supplies it.
      body: JSON.stringify({ lat: pin.lat, lng: pin.lng, soilMoisture: v ? "damp" : "dry" }),
    })
      .then((r) => setDampState(r.ok ? "sent" : r.status === 429 ? "limit" : r.status === 503 ? "idle" : "failed"))
      .catch(() => setDampState("failed"));
  }

  function share() {
    const rel = sowMeta ? fromNow(sowMeta.date, t) : null;
    const inTen = sowMeta?.chance != null ? Math.round(sowMeta.chance * 10) : null;
    const sub = [
      rel,
      inTen != null ? t(`about ${inTen} in 10 seasons go well`, `ရာသီ ၁၀ ခုတွင် ${inTen} ခုခန့် အဆင်ပြေ`) : null,
      whatIfText ? t(`plan for: ${whatIfText}`, `အစီအစဉ်: ${whatIfText}`) : null,
    ]
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
          label: t("LAST 3 MONTHS", "လွန်ခဲ့သော ၃ လ"),
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
            : t("Not available", "မရနိုင်ပါ"),
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
              <Fact Icon={CloudSun} label={t(`Last 3 months${recentLabel ? ` (${recentLabel})` : ""}`, `လွန်ခဲ့သော ၃ လ${recentLabel ? ` (${recentLabel})` : ""}`)}>
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
            {whatIfText && (
              <p className="mt-2 rounded-xl bg-sun/15 px-3 py-2 text-xs font-semibold text-[#9a6a0c]">
                {t(
                  `Made for your what-if: ${whatIfText}. Go back to Rotations and set the sliders to "As expected" for a normal-weather plan.`,
                  `သင့် "ဖြစ်ခဲ့လျှင်" အတွက် ပြုလုပ်ထားသည်: ${whatIfText}။ ပုံမှန်ရာသီဥတု အစီအစဉ်အတွက် လှည့်စိုက် စာမျက်နှာသို့ ပြန်သွားပြီး ဆလိုက်ဒါကို "မျှော်လင့်အတိုင်း" ထားပါ။`
                )}
              </p>
            )}
            {soilState === "down" && (
              <p className="mt-2 text-xs text-[#9a6a0c]">
                {t(
                  "Soil map unavailable right now: soil scores use typical values, not your field's soil.",
                  "မြေဆီလွှာ မြေပုံ ယခု မရနိုင်ပါ: မြေ အဆင့်များသည် ပုံမှန်တန်ဖိုးများ ဖြစ်သည်။"
                )}
              </p>
            )}
            {soilState === "ok" && soilAsOf && (
              <p className="mt-2 text-xs text-muted">
                {soilNearKm != null
                  ? t(`Soil: from a spot ~${soilNearKm} km away, ${fmtDate(new Date(soilAsOf))} (soil map is down now).`,
                      `မြေ: ~${soilNearKm} ကီလိုမီတာ အကွာ နေရာမှ၊ ${fmtDate(new Date(soilAsOf))} (မြေပုံ ယခု မရပါ)။`)
                  : t(`Soil: last known result from ${fmtDate(new Date(soilAsOf))} (soil map is down now).`,
                      `မြေ: ${fmtDate(new Date(soilAsOf))} ရက်က နောက်ဆုံးရလဒ် (မြေပုံ ယခု မရပါ)။`)}
              </p>
            )}
          </div>

          <button onClick={share} className={`mt-3 flex w-full items-center justify-center gap-2 py-3.5 text-sm ${primaryBtn}`}>
            <Share2 className="h-4 w-4" /> {t("Share my plan", "အစီအစဉ် မျှဝေမည်")}
          </button>
          {saveState === "saved" && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted">
              <Check className="h-3.5 w-3.5 text-grass" /> {t("Plan saved", "အစီအစဉ် သိမ်းပြီး")}
            </p>
          )}
          {saveState === "failed" && (
            <p className="mt-2 text-center text-xs text-[#9a6a0c]">
              {t("Couldn't save your plan.", "အစီအစဉ် မသိမ်းနိုင်ပါ။")}{" "}
              <button onClick={() => setSaveTry((n) => n + 1)} className="font-bold underline">
                {t("Try again", "ထပ်ကြိုးစားမည်")}
              </button>
            </p>
          )}
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
                  {t("Check drainage — the last 3 months were wetter than usual.", "ရေထုတ်မြောင်း စစ်ပါ — လွန်ခဲ့သော ၃ လ ပုံမှန်ထက် စိုခဲ့သည်။")}
                </p>
              )}
              {dampState === "sent" && (
                <p className="mt-1 text-[11px] text-muted">
                  {t("Thanks — your answer helps farms nearby.", "ကျေးဇူးပါ — သင့်အဖြေ အနီးရှိလယ်များကို ကူညီသည်။")}
                </p>
              )}
              {dampState === "limit" && (
                <p className="mt-1 text-[11px] text-muted">
                  {t("We already have today's reports from this spot. Thank you!", "ဤနေရာမှ ယနေ့ အစီရင်ခံစာ ရပြီးပါပြီ။ ကျေးဇူးပါ!")}
                </p>
              )}
              {dampState === "failed" && damp != null && (
                <p className="mt-1 text-[11px] text-[#9a6a0c]">
                  {t("Couldn't send your answer.", "သင့်အဖြေ မပို့နိုင်ပါ။")}{" "}
                  <button onClick={() => answerDamp(damp)} className="font-bold underline">
                    {t("Try again", "ထပ်ကြိုးစားမည်")}
                  </button>
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
