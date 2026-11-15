"use client";

import { useEffect, useMemo, useState } from "react";
import { Volume2, Square, Share2, Check, CalendarCheck, Sprout, CloudSun, Shovel } from "lucide-react";
import type { CropGoals, EnvData, HistoryData, LatLng, ReplayData, SoilData, Verdict } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { cropLabel, scoreStrategies, STRATEGY_TEXT, type FieldInputs } from "@/lib/strategies";
import { buildBrief } from "@/lib/brief";
import { shareCard } from "@/lib/shareCard";
import { card, primaryBtn } from "@/lib/ui";
import { fetchJson } from "@/lib/fetchJson";
import { Screen } from "@/components/Screen";

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
  cropGoals,
}: {
  pin: LatLng | null;
  place: string;
  cropGoals: CropGoals;
}) {
  const { lang, t } = useLang();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [sowing, setSowing] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [speaking, setSpeaking] = useState(false);
  const [damp, setDamp] = useState<boolean | null>(null);
  const [satWet, setSatWet] = useState<number | null>(null);
  const [inputs, setInputs] = useState<FieldInputs>({});
  const [noVoice, setNoVoice] = useState(false);

  const best = useMemo(() => {
    const scored = scoreStrategies(cropGoals.crop, cropGoals.goals, 50, 50, inputs);
    return scored.find((s) => s.isBest) ?? scored[0];
  }, [cropGoals.crop, cropGoals.goals, inputs]);

  useEffect(() => {
    if (!pin) return;
    let active = true;
    fetchJson<HistoryData>(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setVerdict(d.verdict))
      .catch(() => {});
    fetchJson<{ rotations: FieldInputs["water"] }>(`/api/water?lat=${pin.lat}&lng=${pin.lng}&crop=${cropGoals.crop ?? "rice"}`)
      .then((d) => active && setInputs((i) => ({ ...i, water: d.rotations })))
      .catch(() => {});
    fetchJson<SoilData>(`/api/soil?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setInputs((i) => ({ ...i, soilHealth: d.health })))
      .catch(() => {});
    fetchJson<EnvData>(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && d.soilMoisture.value != null && setSatWet(d.soilMoisture.value / 100))
      .catch(() => {});
    fetchJson<ReplayData>(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setSowing(d.weeks[d.bestWeekIndex]?.label ?? null))
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

  const whyText = brief.why;
  const checklist = brief.checklist;

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function toggleSpeak() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang === "my" ? "my" : "en"));
    if (lang === "my" && voices.length && !voice) {
      setNoVoice(true); // phone has no Burmese voice — tell the farmer instead of reading silence
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = [
      brief.headline,
      sowing ? t(`Sow around ${sowing}.`, `${sowing} ဝန်းကျင် စိုက်ပါ။`) : "",
      ...brief.body,
    ].join(" ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "my" ? "my-MM" : "en-US";
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

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
    shareCard({
      subtitle: t("Your planting plan", "သင့် စိုက်ပျိုးရေး အစီအစဉ်"),
      location: place || t("Your field", "သင့်လယ်"),
      lines: [
        ...(sowing ? [{ label: t("Sow around", "စိုက်ရန်"), value: sowing }] : []),
        { label: t("Plan", "အစီအစဉ်"), value: `${planName}: ${best.rotation.map((c) => cropLabel(c, lang)).join(" → ")}` },
        { label: t("This season", "ဤရာသီ"), value: verdict ? t(VERDICT[verdict].en, VERDICT[verdict].my) : "—" },
      ],
      checklistTitle: t("Check before you plant", "မစိုက်ခင် စစ်ဆေးပါ"),
      checklist: [t("Soil is damp 15 cm down", "မြေ ၁၅ စင်တီမီတာ အောက်တွင် စိုနေသည်"), ...checklist],
      footer: t("Powered by NASA Earth data", "NASA ကမ္ဘာ့ဒေတာဖြင့်"),
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{t("At a glance", "အကျဉ်းချုပ်")}</h3>
              <button
                onClick={toggleSpeak}
                aria-label={speaking ? t("Stop reading", "ဖတ်ခြင်း ရပ်") : t("Read aloud", "ဖတ်ပြ")}
                className="inline-flex items-center gap-1.5 rounded-full border border-grass/40 px-3 py-1.5 text-xs font-semibold text-grass transition hover:bg-grass/10"
              >
                {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {speaking ? t("Stop", "ရပ်") : t("Listen", "နားထောင်")}
              </button>
            </div>

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
            {noVoice && (
              <p className="mt-2 rounded-lg bg-sun/15 p-2 text-xs text-[#9a6a0c]">
                {t(
                  "This phone has no Burmese voice. Add “Myanmar (Burmese)” in the phone's text-to-speech settings, or switch to English.",
                  "ဤဖုန်းတွင် မြန်မာအသံ မရှိပါ။ ဖုန်း၏ စာဖတ်အသံ ဆက်တင်တွင် မြန်မာဘာသာ ထည့်ပါ၊ သို့မဟုတ် English သို့ ပြောင်းပါ။"
                )}
              </p>
            )}
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
