// Field Shift plain-language brief generator (Screen 6).
//
// Deterministic, bilingual (English / Burmese) summary of the recommended
// rotation + a field-check checklist. A fixed template — no external AI service.

import type { GoalId, Verdict } from "./types";
import { cropLabel, type ScoredStrategy } from "./strategies";

export type Lang = "en" | "my";

export type Brief = {
  headline: string;
  body: string[];
  /** One plain sentence: what the plan is chosen for, and why it helps. */
  why: string;
  checklist: string[];
  readAloud: string; // flat text for the voice reader
};

type Bi = { en: string; my: string };

const CROP: Record<string, Bi> = {
  rice: { en: "rice", my: "စပါး" },
  wheat: { en: "wheat", my: "ဂျုံ" },
  maize: { en: "maize", my: "ပြောင်း" },
  soybean: { en: "soybean", my: "ပဲပိစပ်" },
  cotton: { en: "cotton", my: "ဝါ" },
  potato: { en: "potato", my: "အာလူး" },
  vegetables: { en: "vegetables", my: "ဟင်းသီးဟင်းရွက်" },
  sugarcane: { en: "sugarcane", my: "ကြံ" },
};

const GOAL: Record<GoalId, Bi> = {
  water: { en: "saving water", my: "ရေချွေတာရန်" },
  nitrogen: { en: "rebuilding soil nitrogen", my: "မြေဩဇာ ပြန်တည်ဆောက်ရန်" },
  erosion: { en: "preventing erosion", my: "မြေတိုက်စားမှု ကာကွယ်ရန်" },
  income: { en: "extra income", my: "အပို ဝင်ငွေရရန်" },
};

const STRAT: Record<string, Bi> = {
  baseline: { en: "Baseline (current practice)", my: "လက်ရှိ အလေ့အကျင့်" },
  water: { en: "Water-Conserving", my: "ရေချွေတာ" },
  soil: { en: "Soil-Rebuilding", my: "မြေဩဇာ ပြန်တည်ဆောက်ရေး" },
};

const VERDICT: Record<Verdict, Bi> = {
  dry: { en: "drier than usual", my: "ပုံမှန်ထက် ခြောက်သွေ့" },
  normal: { en: "about normal", my: "ပုံမှန်" },
  wet: { en: "wetter than usual", my: "ပုံမှန်ထက် စိုစွတ်" },
};

const WHY: Record<string, Bi> = {
  baseline: {
    en: "Your current practice is simple, but it is more exposed if the weather shifts.",
    my: "လက်ရှိ အလေ့အကျင့်သည် ရိုးရှင်းသော်လည်း ရာသီဥတု ပြောင်းလဲပါက ထိခိုက်လွယ်ပါသည်။",
  },
  water: {
    en: "Adding a drought-tolerant crop lowers water demand and protects you if the rains fail.",
    my: "မိုးခေါင်ဒဏ်ခံ သီးနှံ ထည့်သွင်းခြင်းဖြင့် ရေသုံးစွဲမှု လျော့ကျပြီး မိုးနည်းပါက အကာအကွယ် ဖြစ်စေပါသည်။",
  },
  soil: {
    en: "A nitrogen-fixing crop rebuilds soil fertility and cuts fertilizer costs over time.",
    my: "နိုက်ထရိုဂျင် ပြန်ဖြည့်သော သီးနှံသည် မြေဩဇာကို ပြန်တည်ဆောက်ပြီး ဓာတ်မြေဩဇာ ကုန်ကျစရိတ် လျှော့ချပေးပါသည်။",
  },
};

function pick(bi: Bi, lang: Lang) {
  return bi[lang];
}

export function buildBrief(
  crop: string | null,
  goals: GoalId[],
  best: ScoredStrategy,
  verdict: Verdict | null,
  lang: Lang
): Brief {
  const cropName = pick(CROP[crop ?? "rice"] ?? CROP.rice, lang);
  const stratName = pick(STRAT[best.id], lang);
  const goalText =
    goals.length > 0
      ? goals.map((g) => pick(GOAL[g], lang)).join(lang === "en" ? " and " : "၊ ")
      : lang === "en"
        ? "a healthy harvest"
        : "ကောင်းသော အထွက်";
  const rotation = best.rotation.map((c) => cropLabel(c, lang)).join(" → ");

  const body: string[] = [];
  if (verdict) {
    body.push(
      lang === "en"
        ? `This season looks ${pick(VERDICT[verdict], lang)} for your area.`
        : `ဤရာသီသည် သင့်ဒေသအတွက် ${pick(VERDICT[verdict], lang)} ဖြစ်ပုံရပါသည်။`
    );
  }
  body.push(
    lang === "en"
      ? `For your ${cropName} with a focus on ${goalText}, the best fit is the ${stratName} rotation: ${rotation}.`
      : `${goalText} အတွက် ဦးစားပေးထားသော သင့် ${cropName} အတွက် အသင့်တော်ဆုံးမှာ ${stratName} လှည့်စိုက်နည်း ဖြစ်သည်- ${rotation}။`
  );
  body.push(pick(WHY[best.id], lang));
  const why =
    lang === "en"
      ? `Chosen for ${goalText}. ${pick(WHY[best.id], lang)}`
      : `${goalText} အတွက် ရွေးထားသည်။ ${pick(WHY[best.id], lang)}`;

  // Field-check checklist.
  const partner = cropLabel(best.rotation[1] ?? best.rotation[0], lang);
  const checklist: string[] =
    lang === "en"
      ? [
          `Confirm ${partner} seed is available locally and affordable.`,
          "Check the 10-day local weather forecast before your planting date.",
          "Ask a neighbour or extension worker if this has worked on nearby farms.",
        ]
      : [
          `${partner} မျိုးစေ့ ဒေသတွင် ရနိုင်ပြီး စျေးသင့်မသင့် အတည်ပြုပါ။`,
          "စိုက်ပျိုးမည့်ရက်မတိုင်မီ ၁၀ ရက်စာ ဒေသ မိုးလေဝသ ခန့်မှန်းချက် စစ်ဆေးပါ။",
          "အနီးအနားလယ်များတွင် ဤနည်း အလုပ်ဖြစ်မဖြစ် အိမ်နီးချင်း သို့ စိုက်ပျိုးရေးဝန်ထမ်းအား မေးပါ။",
        ];
  if (verdict === "dry")
    checklist.push(
      lang === "en"
        ? "Make sure you have a backup water source for early growth."
        : "အစောပိုင်း ကြီးထွားမှုအတွက် အရန်ရေအရင်းအမြစ် ရှိစေရန် သေချာပါစေ။"
    );
  if (verdict === "wet")
    checklist.push(
      lang === "en"
        ? "Check your field drainage to avoid waterlogging."
        : "ရေဝပ်မှု မဖြစ်စေရန် လယ်ကွင်း ရေထုတ်မြောင်း စစ်ဆေးပါ။"
    );

  const headline =
    lang === "en" ? "Your planting plan" : "သင့် စိုက်ပျိုးရေး အစီအစဉ်";
  const readAloud = [headline, ...body].join(" ");

  return { headline, body, why, checklist, readAloud };
}
