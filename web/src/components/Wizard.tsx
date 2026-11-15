"use client";

import { useEffect, useRef, useState } from "react";
import { AlarmClock, Check } from "lucide-react";
import type { CropGoals, LatLng } from "@/lib/types";
import type { LandCover } from "@/app/api/landcover/route";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { primaryBtn, ghostBtn } from "@/lib/ui";
import Screen1Map from "./screens/Screen1Map";
import Screen2Environment from "./screens/Screen2Environment";
import Screen3CropGoals from "./screens/Screen3CropGoals";
import SeasonReplay from "./screens/SeasonReplay";
import SowingCalendar from "./screens/SowingCalendar";
import Screen5RotationCompare from "./screens/Screen5RotationCompare";
import Screen6Guidance from "./screens/Screen6Guidance";

const STEPS: { en: string; my: string }[] = [
  { en: "Field", my: "လယ်" },
  { en: "Conditions", my: "အခြေအနေ" },
  { en: "Crop & goals", my: "သီးနှံ" },
  { en: "Past seasons", my: "ယခင်ရာသီ" },
  { en: "Sowing date", my: "စိုက်ရက်" },
  { en: "Rotations", my: "လှည့်စိုက်" },
  { en: "Your plan", my: "အစီအစဉ်" },
];
const TOTAL = STEPS.length;
const EMPTY_GOALS: CropGoals = { crop: null, goals: [], constraints: [] };

export default function Wizard() {
  const { lang, setLang, t } = useLang();
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  // Pin from search → use the searched name; pin from a map tap → look up the nearest place.
  // Every pin (tap, drag, "my location", search) is checked against ESA WorldCover first:
  // water is refused outright; a town gets a gentle "move onto your field" note.
  const [checking, setChecking] = useState(false);
  const [pinMsg, setPinMsg] = useState<"water" | "town" | null>(null);
  const pickSeq = useRef(0);
  async function pick(p: LatLng, name?: string): Promise<boolean> {
    const seq = ++pickSeq.current;
    setChecking(true);
    setPinMsg(null);
    const lc = await fetchJson<LandCover>(`/api/landcover?lat=${p.lat.toFixed(5)}&lng=${p.lng.toFixed(5)}`).catch(() => null);
    if (seq !== pickSeq.current) return false; // a newer tap won
    setChecking(false);
    if (lc?.water) {
      setPinMsg("water");
      return false;
    }
    if (lc?.cover === "built-up") setPinMsg("town");
    setPin(p);
    setPlace(name ?? null);
    setCountry(null);
    fetchJson<{ name: string | null; country: string | null }>(`/api/geocode/reverse?lat=${p.lat.toFixed(4)}&lng=${p.lng.toFixed(4)}`)
      .then((d) => {
        if (seq !== pickSeq.current) return;
        setCountry(d.country ?? null);
        if (!name) setPlace((cur) => cur ?? d.name ?? null);
      })
      .catch(() => {});
    return true;
  }
  const placeLabel = place ?? (pin ? `${pin.lat.toFixed(2)}, ${pin.lng.toFixed(2)}` : "");
  const [cropGoals, setCropGoals] = useState<CropGoals>(EMPTY_GOALS);

  const nextLabel: Record<number, string> = {
    1: t("Continue", "ဆက်သွားမည်"),
    2: t("Next", "နောက်တစ်ဆင့်"),
    3: t("Analyze field", "လယ်ကို သုံးသပ်မည်"),
    4: t("Next: pick sowing date →", "နောက်: စိုက်ရက်ရွေး →"),
    5: t("Compare rotations", "လှည့်စိုက်နည်း နှိုင်းယှဉ်မည်"),
    6: t("See my plan", "အစီအစဉ် ကြည့်မည်"),
    7: t("Plan another field", "နောက်လယ် စီစဉ်မည်"),
  };

  const canNext =
    step === 1 ? !!pin && !checking : step === 3 ? !!cropGoals.crop && cropGoals.goals.length >= 1 : true;

  // Wake the model backend as soon as the app opens (it sleeps when idle).
  useEffect(() => {
    fetch("/api/warm").catch(() => {});
  }, []);

  // Browser/phone Back moves between steps instead of leaving the app.
  useEffect(() => {
    window.history.replaceState({ focStep: 1 }, "");
    const onPop = (e: PopStateEvent) =>
      setStep((e.state as { focStep?: number } | null)?.focStep ?? 1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function goToStep(ns: number) {
    window.history.pushState({ focStep: ns }, "");
    setStep(ns);
  }

  function next() {
    if (step < TOTAL) return goToStep(step + 1);
    setPin(null);
    setPlace(null);
    setCropGoals(EMPTY_GOALS);
    goToStep(1);
  }

  const langBtn = (l: "en" | "my", label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
        lang === l ? "bg-grass text-white" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex h-dvh w-full flex-col bg-paper">
      <header className="shrink-0 border-b border-hair bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 pb-3 lg:px-8 lg:py-4">
          <h1 className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-grass text-white">
              <AlarmClock className="h-5 w-5" />
            </span>
            Farm&nbsp;O&apos;Clock
          </h1>

          {/* Desktop: named stepper */}
          <ol className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const here = n === step;
              return (
                <li key={n} className="flex items-center gap-1">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                      here ? "bg-grass text-white" : done ? "text-grass" : "text-muted/70"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                        here ? "bg-white/25" : done ? "bg-grass text-white" : "border border-hair"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : n}
                    </span>
                    {t(s.en, s.my)}
                  </span>
                  {n < TOTAL && <span className="h-px w-3 bg-hair" />}
                </li>
              );
            })}
          </ol>

          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-hair p-0.5">
            {langBtn("en", "EN")}
            {langBtn("my", "မြန်မာ")}
          </div>
        </div>

        {/* Phone: progress bar + current step name */}
        <div className="px-4 pb-3 lg:hidden">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-grass" : "bg-hair"}`} />
            ))}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-muted">
            {t("Step", "အဆင့်")} {step}/{TOTAL} · {t(STEPS[step - 1].en, STEPS[step - 1].my)}
          </p>
        </div>
      </header>

      <section className="relative min-h-0 flex-1">
        {step === 1 && <Screen1Map pin={pin} onPick={pick} />}
        {step === 2 && pin && <Screen2Environment pin={pin} place={placeLabel} />}
        {step === 3 && <Screen3CropGoals value={cropGoals} onChange={setCropGoals} />}
        {step === 4 && pin && <SeasonReplay pin={pin} />}
        {step === 5 && pin && <SowingCalendar pin={pin} />}
        {step === 6 && <Screen5RotationCompare cropGoals={cropGoals} pin={pin} country={country} />}
        {step === 7 && <Screen6Guidance pin={pin} place={placeLabel} country={country} cropGoals={cropGoals} />}
      </section>

      <footer className="shrink-0 border-t border-hair bg-surface">
        <div className="mx-auto max-w-6xl px-4 pt-3 pb-5 lg:flex lg:items-center lg:gap-4 lg:px-8 lg:py-4">
          {step === 1 && (
            <p className="mb-3 text-center text-sm text-muted lg:mb-0 lg:flex-1 lg:text-left">
              {checking ? (
                <span className="text-muted">{t("Checking this spot…", "ဤနေရာကို စစ်နေသည်…")}</span>
              ) : pinMsg === "water" ? (
                <span className="font-semibold text-clay">
                  {t("That spot is water. Tap on land: your field.", "ထိုနေရာသည် ရေပြင် ဖြစ်သည်။ ကုန်းမြေ (သင့်လယ်) ပေါ် တို့ပါ။")}
                </span>
              ) : pin ? (
                <>
                  📍 {t("Your field", "သင့်လယ်")}:{" "}
                  <span className="font-bold text-ink">
                    {place ? `${t("near", "အနီး")} ${place}` : t("finding the nearest place…", "အနီးဆုံးနေရာ ရှာနေသည်…")}
                  </span>
                  {pinMsg === "town" && (
                    <span className="block text-xs font-semibold text-[#9a6a0c]">
                      {t("This looks like a town or buildings. Drag the pin onto your field.", "မြို့ သို့ အဆောက်အအုံ ဖြစ်ပုံရသည်။ ပင်ကို သင့်လယ်ပေါ် ဆွဲပါ။")}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted/70">{t("No field selected yet", "လယ်မရွေးရသေးပါ")}</span>
              )}
            </p>
          )}
          <div className="flex gap-3 lg:ml-auto lg:w-[26rem]">
            <button
              onClick={() => window.history.back()}
              disabled={step === 1}
              className={`flex-1 py-3.5 text-sm ${ghostBtn}`}
            >
              {t("Back", "နောက်သို့")}
            </button>
            <button disabled={!canNext} onClick={next} className={`flex-[2] py-3.5 text-sm ${primaryBtn}`}>
              {nextLabel[step]}
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
