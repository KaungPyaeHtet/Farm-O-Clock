"use client";

import type { ConstraintId, CropGoals, GoalId } from "@/lib/types";

const CROPS: { id: string; label: string }[] = [
  { id: "rice", label: "🌾 Rice" },
  { id: "wheat", label: "🌾 Wheat" },
  { id: "maize", label: "🌽 Maize" },
  { id: "soybean", label: "🫘 Soybean" },
  { id: "cotton", label: "🧵 Cotton" },
  { id: "potato", label: "🥔 Potato" },
  { id: "vegetables", label: "🍅 Vegetables" },
  { id: "sugarcane", label: "🎋 Sugarcane" },
];

const GOALS: { id: GoalId; label: string; hint: string }[] = [
  { id: "water", label: "💧 Save Water", hint: "Use less irrigation" },
  { id: "nitrogen", label: "🌱 Rebuild Nitrogen", hint: "Restore soil fertility" },
  { id: "erosion", label: "🛡️ Prevent Erosion", hint: "Protect topsoil" },
  { id: "income", label: "💰 Extra Income", hint: "Add a cash crop" },
];

const CONSTRAINTS: { id: ConstraintId; label: string }[] = [
  { id: "no_machinery", label: "🚜 No new specialized machinery" },
  { id: "frost_sensitive", label: "❄️ Frost-sensitive area" },
];

export default function Screen3CropGoals({
  value,
  onChange,
}: {
  value: CropGoals;
  onChange: (next: CropGoals) => void;
}) {
  const goalsFull = value.goals.length >= 2;

  function toggleGoal(id: GoalId) {
    const has = value.goals.includes(id);
    if (has) {
      onChange({ ...value, goals: value.goals.filter((g) => g !== id) });
    } else if (!goalsFull) {
      onChange({ ...value, goals: [...value.goals, id] });
    }
  }

  function toggleConstraint(id: ConstraintId) {
    const has = value.constraints.includes(id);
    onChange({
      ...value,
      constraints: has
        ? value.constraints.filter((c) => c !== id)
        : [...value.constraints, id],
    });
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-bold text-neutral-900">
        Your crop &amp; goals
      </h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Tell us what you grow and what matters most this season.
      </p>

      {/* Current crop */}
      <h3 className="mt-5 text-sm font-semibold text-neutral-700">
        What are you growing now?
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {CROPS.map((c) => {
          const selected = value.crop === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onChange({ ...value, crop: c.id })}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Goals */}
      <div className="mt-6 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          Your top goals
        </h3>
        <span className="text-xs text-neutral-400">
          {value.goals.length}/2 chosen
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {GOALS.map((g) => {
          const selected = value.goals.includes(g.id);
          const disabled = !selected && goalsFull;
          return (
            <button
              key={g.id}
              onClick={() => toggleGoal(g.id)}
              disabled={disabled}
              className={`rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-green-600 bg-green-50"
                  : disabled
                    ? "border-neutral-200 bg-neutral-50 opacity-50"
                    : "border-neutral-300 bg-white hover:bg-neutral-50"
              }`}
            >
              <div className="text-sm font-semibold text-neutral-900">
                {g.label}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">{g.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Constraints */}
      <h3 className="mt-6 text-sm font-semibold text-neutral-700">
        Any constraints?{" "}
        <span className="font-normal text-neutral-400">(optional)</span>
      </h3>
      <div className="mt-2 space-y-2">
        {CONSTRAINTS.map((c) => {
          const selected = value.constraints.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleConstraint(c.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                selected
                  ? "border-green-600 bg-green-50 text-neutral-900"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span>{c.label}</span>
              <span
                className={`grid h-5 w-5 place-items-center rounded-md border text-xs ${
                  selected
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-neutral-300 text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-2" />
    </div>
  );
}
