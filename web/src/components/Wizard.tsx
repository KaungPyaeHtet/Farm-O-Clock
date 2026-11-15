"use client";

import { useState } from "react";
import type { CropGoals, EnvData, LatLng } from "@/lib/types";
import Screen1Map from "./screens/Screen1Map";
import Screen2Environment from "./screens/Screen2Environment";
import Screen3CropGoals from "./screens/Screen3CropGoals";
import Screen4Historical from "./screens/Screen4Historical";
import Screen5RotationCompare from "./screens/Screen5RotationCompare";
import Screen6Guidance from "./screens/Screen6Guidance";

const TOTAL_STEPS = 6;
const LAST_BUILT_STEP = 6; // all screens built

// Per-step label for the primary "Next" button.
const NEXT_LABEL: Record<number, string> = {
  1: "Continue →",
  2: "Next →",
  3: "Analyze Field →",
  4: "Compare Strategies →",
  5: "Get AI Guidance →",
  6: "↻ Plan another field",
};

export default function Wizard() {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [, setEnv] = useState<EnvData | null>(null);
  const [cropGoals, setCropGoals] = useState<CropGoals>({
    crop: null,
    goals: [],
    constraints: [],
  });

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
      // Final step — start a fresh plan.
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
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white shadow-xl">
      {/* Brand + progress header */}
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            <span>🌾</span> Field&nbsp;Shift
          </h1>
          <span className="text-xs font-medium text-neutral-500">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < step ? "bg-green-600" : "bg-neutral-200"
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
        {step === 4 && pin && <Screen4Historical pin={pin} />}
        {step === 5 && <Screen5RotationCompare cropGoals={cropGoals} />}
        {step === 6 && <Screen6Guidance pin={pin} cropGoals={cropGoals} />}
      </section>

      {/* Sticky footer */}
      <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 pb-5 pt-3">
        {step === 1 &&
          (pin ? (
            <p className="mb-3 text-center text-sm text-neutral-600">
              📍 Farm selected:{" "}
              <span className="font-semibold text-neutral-900">
                {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
              </span>
            </p>
          ) : (
            <p className="mb-3 text-center text-sm text-neutral-400">
              No farm selected yet
            </p>
          ))}
        <div className="flex gap-3">
          <button
            onClick={back}
            disabled={step === 1}
            className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-semibold text-neutral-600 transition enabled:hover:bg-neutral-50 disabled:text-neutral-300"
          >
            Back
          </button>
          <button
            disabled={!canNext}
            onClick={next}
            className="flex-[2] rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {NEXT_LABEL[step] ?? "Next Step →"}
          </button>
        </div>
      </footer>
    </main>
  );
}
