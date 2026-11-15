"use client";

import {
  Wheat,
  Bean,
  Flower2,
  Sprout,
  Carrot,
  Droplet,
  ShieldCheck,
  Coins,
  Tractor,
  Snowflake,
  Check,
  type LucideIcon,
} from "lucide-react";
import type { ConstraintId, CropGoals, GoalId } from "@/lib/types";
import { useLang } from "@/lib/i18n";

const CROPS: { id: string; Icon: LucideIcon; en: string; my: string }[] = [
  { id: "rice", Icon: Wheat, en: "Rice", my: "စပါး" },
  { id: "wheat", Icon: Wheat, en: "Wheat", my: "ဂျုံ" },
  { id: "maize", Icon: Wheat, en: "Maize", my: "ပြောင်း" },
  { id: "soybean", Icon: Bean, en: "Soybean", my: "ပဲပိစပ်" },
  { id: "cotton", Icon: Flower2, en: "Cotton", my: "ဝါ" },
  { id: "potato", Icon: Sprout, en: "Potato", my: "အာလူး" },
  { id: "vegetables", Icon: Carrot, en: "Vegetables", my: "ဟင်းသီးဟင်းရွက်" },
  { id: "sugarcane", Icon: Sprout, en: "Sugarcane", my: "ကြံ" },
];

const GOALS: {
  id: GoalId;
  Icon: LucideIcon;
  en: string;
  my: string;
  hintEn: string;
  hintMy: string;
}[] = [
  { id: "water", Icon: Droplet, en: "Save Water", my: "ရေချွေတာ", hintEn: "Use less irrigation", hintMy: "ရေသွင်း လျှော့ချ" },
  { id: "nitrogen", Icon: Sprout, en: "Rebuild Nitrogen", my: "မြေဩဇာ ပြန်တည်", hintEn: "Restore soil fertility", hintMy: "မြေဩဇာ ပြန်ကောင်း" },
  { id: "erosion", Icon: ShieldCheck, en: "Prevent Erosion", my: "တိုက်စားမှု ကာကွယ်", hintEn: "Protect topsoil", hintMy: "မြေဆီလွှာ ကာကွယ်" },
  { id: "income", Icon: Coins, en: "Extra Income", my: "အပိုဝင်ငွေ", hintEn: "Add a cash crop", hintMy: "ရောင်းသီးနှံ ထည့်" },
];

const CONSTRAINTS: { id: ConstraintId; Icon: LucideIcon; en: string; my: string }[] = [
  { id: "no_machinery", Icon: Tractor, en: "No new specialized machinery", my: "စက်ပစ္စည်းသစ် မလို" },
  { id: "frost_sensitive", Icon: Snowflake, en: "Frost-sensitive area", my: "ဆီးနှင်းဒဏ် ခံရသည့်နေရာ" },
];

export default function Screen3CropGoals({
  value,
  onChange,
}: {
  value: CropGoals;
  onChange: (next: CropGoals) => void;
}) {
  const { t } = useLang();
  const goalsFull = value.goals.length >= 2;

  function toggleGoal(id: GoalId) {
    const has = value.goals.includes(id);
    if (has) onChange({ ...value, goals: value.goals.filter((g) => g !== id) });
    else if (!goalsFull) onChange({ ...value, goals: [...value.goals, id] });
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
      <h2 className="text-lg font-extrabold text-ink">
        {t("Your crop & goals", "သင့်သီးနှံနှင့် ရည်မှန်းချက်")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t(
          "Tell us what you grow and what matters most this season.",
          "ဤရာသီ သင်ဘာစိုက်သလဲ၊ ဘာအရေးကြီးဆုံးလဲ ပြောပြပါ။"
        )}
      </p>

      {/* Current crop */}
      <h3 className="mt-5 text-sm font-bold text-ink">
        {t("What are you growing now?", "အခု ဘာစိုက်နေသလဲ?")}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {CROPS.map(({ id, Icon, en, my }) => {
          const selected = value.crop === id;
          return (
            <button
              key={id}
              onClick={() => onChange({ ...value, crop: id })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                selected
                  ? "border-grass bg-grass text-white"
                  : "border-hair bg-surface text-ink hover:bg-black/[0.03]"
              }`}
            >
              <Icon className="h-4 w-4" /> {t(en, my)}
            </button>
          );
        })}
      </div>

      {/* Goals */}
      <div className="mt-6 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-ink">
          {t("Your top goals", "အဓိက ရည်မှန်းချက်များ")}
        </h3>
        <span className="text-xs text-muted">
          {value.goals.length}/2 {t("chosen", "ရွေးပြီး")}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {GOALS.map(({ id, Icon, en, my, hintEn, hintMy }) => {
          const selected = value.goals.includes(id);
          const disabled = !selected && goalsFull;
          return (
            <button
              key={id}
              onClick={() => toggleGoal(id)}
              disabled={disabled}
              className={`rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-grass bg-grass/10"
                  : disabled
                    ? "border-hair bg-black/[0.02] opacity-45"
                    : "border-hair bg-surface hover:bg-black/[0.03]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Icon className="h-4 w-4 text-grass" /> {t(en, my)}
              </div>
              <div className="mt-0.5 text-xs text-muted">{t(hintEn, hintMy)}</div>
            </button>
          );
        })}
      </div>

      {/* Constraints */}
      <h3 className="mt-6 text-sm font-bold text-ink">
        {t("Any constraints?", "ကန့်သတ်ချက်များ?")}{" "}
        <span className="font-normal text-muted">
          {t("(optional)", "(မဖြစ်မနေ မဟုတ်)")}
        </span>
      </h3>
      <div className="mt-2 space-y-2">
        {CONSTRAINTS.map(({ id, Icon, en, my }) => {
          const selected = value.constraints.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggleConstraint(id)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                selected
                  ? "border-grass bg-grass/10 text-ink"
                  : "border-hair bg-surface text-ink hover:bg-black/[0.03]"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-grass" /> {t(en, my)}
              </span>
              <span
                className={`grid h-5 w-5 place-items-center rounded-md border ${
                  selected
                    ? "border-grass bg-grass text-white"
                    : "border-hair text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-2" />
    </div>
  );
}
