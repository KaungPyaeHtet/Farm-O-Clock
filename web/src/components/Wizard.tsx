"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";
import type { CropGoals, EnvData, LatLng } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { primaryBtn, ghostBtn } from "@/lib/ui";
import Screen1Map from "./screens/Screen1Map";
import Screen2Environment from "./screens/Screen2Environment";
import Screen3CropGoals from "./screens/Screen3CropGoals";
import SeasonReplay from "./screens/SeasonReplay";
import SowingCalendar from "./screens/SowingCalendar";
import Screen5RotationCompare from "./screens/Screen5RotationCompare";
import Screen6Guidance from "./screens/Screen6Guidance";

const TOTAL_STEPS = 7;
const LAST_BUILT_STEP = 7;

export default function Wizard() {
  const { t } = useLang();
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [, setEnv] = useState<EnvData | null>(null);
  const [cropGoals, setCropGoals] = useState<CropGoals>({
    crop: null,
    goals: [],
    constraints: [],
  });

  const nextLabel: Record<number, string> = {
    1: t("Continue", "ဆက်သွားမည်"),
    2: t("Next", "နောက်တစ်ဆင့်"),
    3: t("Analyze Field", "လယ်ကို သုံးသပ်မည်"),
    4: t("Pick Sowing Date", "စိုက်ရက် ရွေးမည်"),
    5: t("Compare Strategies", "နည်းလမ်းများ နှိုင်းယှဉ်မည်"),
    6: t("Get AI Guidance", "AI လမ်းညွှန် ရယူမည်"),
    7: t("↻ Plan another field", "↻ နောက်လယ် စီစဉ်မည်"),
  };

  const canNext =
    step === 1
      ? !!pin
      : step === 3
        ? !!cropGoals.crop && cropGoals.goals.length >= 1
        : true;

  function next() {
    if (step < LAST_BUILT_STEP) {
      setStep((s) => s + 1);
    } else {
      setPin(null);
      setEnv(null);
      setCropGoals({ crop: null, goals: [], constraints: [] });
      setStep(1);
    }
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-paper shadow-xl">
      {/* Brand + language + progress header */}
      <header className="shrink-0 border-b border-hair bg-surface px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-grass text-white">
              <AlarmClock className="h-5 w-5" />
            </span>
            Farm&nbsp;O&apos;Clock
          </h1>
          <span className="text-xs font-semibold text-muted">
            {t("Step", "အဆင့်")} {step}/{TOTAL_STEPS}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < step ? "bg-grass" : "bg-hair"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Screen content */}
      <section className="relative min-h-0 flex-1">
        {step === 1 && <Screen1Map pin={pin} onPick={setPin} />}
        {step === 2 && pin && (
          <Screen2Environment pin={pin} onLoaded={setEnv} />
        )}
        {step === 3 && (
          <Screen3CropGoals value={cropGoals} onChange={setCropGoals} />
        )}
        {step === 4 && pin && <SeasonReplay pin={pin} />}
        {step === 5 && pin && <SowingCalendar pin={pin} />}
        {step === 6 && <Screen5RotationCompare cropGoals={cropGoals} />}
        {step === 7 && <Screen6Guidance pin={pin} cropGoals={cropGoals} />}
      </section>

      {/* Sticky footer */}
      <footer className="shrink-0 border-t border-hair bg-surface px-4 pb-5 pt-3">
        {step === 1 &&
          (pin ? (
            <p className="mb-3 text-center text-sm text-muted">
              📍 {t("Farm selected", "လယ်ရွေးပြီး")}:{" "}
              <span className="font-bold text-ink">
                {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
              </span>
            </p>
          ) : (
            <p className="mb-3 text-center text-sm text-muted/70">
              {t("No farm selected yet", "လယ်မရွေးရသေးပါ")}
            </p>
          ))}
        <div className="flex gap-3">
          <button
            onClick={back}
            disabled={step === 1}
            className={`flex-1 py-3.5 text-sm ${ghostBtn}`}
          >
            {t("Back", "နောက်သို့")}
          </button>
          <button
            disabled={!canNext}
            onClick={next}
            className={`flex-[2] py-3.5 text-sm ${primaryBtn}`}
          >
            {nextLabel[step] ?? t("Next", "နောက်တစ်ဆင့်")}
          </button>
        </div>
      </footer>
    </main>
  );
}
