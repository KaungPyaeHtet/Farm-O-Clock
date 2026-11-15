// Field Shift rotation-strategy model (Screen 5).
//
// Transparent, deterministic heuristic that scores 3 rotation pathways
// against the farmer's crop + goals and a "what-if" climate scenario
// (rain/heat sliders). This is a placeholder for the eventual XGBoost
// model — keep the same scoreStrategies(...) signature so it can be
// swapped in without touching the UI.

import type { GoalId } from "./types";
import { soilLoss } from "./erosion";
import { rotationIncome } from "./economics";

export type StrategyId = "baseline" | "water" | "soil";

export type ScoredStrategy = {
  id: StrategyId;
  name: string;
  tag: string;
  rotation: string[]; // 3-year sequence
  soil: number; // 0-100 (higher better)
  waterThrift: number; // 0-100 (higher = uses less water)
  resilience: number; // 0-100 (higher better)
  overall: number; // 0-100
  goalFit: number; // 0-100 vs the farmer's chosen goals
  soilTrajectory: number[]; // soil health across years 1-3 (0-100)
  irrigationMm: number | null; // FAO-56 extra water over 3 years (null = not measured)
  soilLossT: number | null; // RUSLE t/ha/yr (null = not measured)
  incomeUsd: number | null; // FAO gross income USD/ha/yr (null = unknown)
  isBest: boolean;
};

const CROP_NAME: Record<string, string> = {
  rice: "Rice",
  wheat: "Wheat",
  maize: "Maize",
  soybean: "Soybean",
  cotton: "Cotton",
  potato: "Potato",
  vegetables: "Vegetables",
  sugarcane: "Sugarcane",
};

const DROUGHT_PARTNER: Record<string, string> = {
  rice: "Sorghum",
  wheat: "Chickpea",
  maize: "Sorghum",
  soybean: "Pigeon pea",
  cotton: "Sorghum",
  potato: "Millet",
  vegetables: "Cowpea",
  sugarcane: "Sorghum",
};

const LEGUME_PARTNER: Record<string, string> = {
  rice: "Mung bean",
  wheat: "Lentil",
  maize: "Soybean",
  soybean: "Clover (cover)",
  cotton: "Cowpea",
  potato: "Field pea",
  vegetables: "Clover (cover)",
  sugarcane: "Sunn hemp (cover)",
};

type Profile = {
  soil: number;
  waterNeed: number; // 0-100 (higher = thirstier)
  res: number;
  drought: number; // 0-1 drought tolerance
  nfix: number; // 0-1 nitrogen fixing
  erosion: number; // 0-1 erosion control
  income: number; // 0-100
};

const PROFILES: Record<StrategyId, Profile> = {
  baseline: { soil: 45, waterNeed: 72, res: 42, drought: 0.15, nfix: 0, erosion: 0.2, income: 52 },
  water: { soil: 58, waterNeed: 42, res: 70, drought: 0.8, nfix: 0.25, erosion: 0.45, income: 56 },
  soil: { soil: 82, waterNeed: 52, res: 66, drought: 0.5, nfix: 0.9, erosion: 0.82, income: 46 },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * @param rain 0-100 slider, 50 = as expected (lower = drier)
 * @param heat 0-100 slider, 50 = normal (higher = hotter)
 */
/** Measured inputs from the model API (optional — rule-based fallback without them). */
export type FieldInputs = {
  /** FAO-56 water per strategy over 3 years, from /api/water */
  water?: Partial<Record<StrategyId, { need_mm: number; effective_rain_mm: number; irrigation_mm: number }>>;
  /** SoilGrids 0-100 soil-health score, from /api/soil */
  soilHealth?: number;
  /** Data-driven partner crops for this pin (display names), from /api/rotation */
  partners?: { water?: string; soil?: string };
  /** Share of past seasons that were low risk for each plan's crops at this pin (0-1), from /api/rotation */
  lowRisk?: Partial<Record<StrategyId, number>>;
  /** For RUSLE soil loss: yearly rain (from /api/rotation), slope (SRTM), soil texture (SoilGrids) */
  annualRainMm?: number;
  slopeDeg?: number;
  soilTex?: { sand: number; silt: number; clay: number; soc: number };
  /** ISO-2 country for FAO yields x prices (income) */
  country?: string | null;
};

/** Shape of /api/rotation → FieldInputs. */
export type RotationApi = {
  plans: Record<StrategyId, { rotation: string[]; water: { need_mm: number; effective_rain_mm: number; irrigation_mm: number }; low_risk_share: number | null }>;
};
export function inputsFromRotation(r: RotationApi): FieldInputs {
  return {
    water: Object.fromEntries(Object.entries(r.plans).map(([k, v]) => [k, v.water])) as FieldInputs["water"],
    partners: { water: r.plans.water?.rotation[1], soil: r.plans.soil?.rotation[1] },
    annualRainMm: (r as RotationApi & { annual_rain_mm?: number }).annual_rain_mm,
    lowRisk: Object.fromEntries(
      Object.entries(r.plans).filter(([, v]) => v.low_risk_share != null).map(([k, v]) => [k, v.low_risk_share as number])
    ) as FieldInputs["lowRisk"],
  };
}

export function scoreStrategies(
  crop: string | null,
  goals: GoalId[],
  rain: number,
  heat: number,
  inputs: FieldInputs = {}
): ScoredStrategy[] {
  const c = crop ?? "rice";
  const cropName = CROP_NAME[c] ?? "Your crop";
  const dryness = (50 - rain) / 50; // >0 drier
  const heatX = (heat - 50) / 50; // >0 hotter
  const dry = Math.max(0, dryness);
  const wet = Math.max(0, -dryness);
  const hot = Math.max(0, heatX);

  const meta: Record<StrategyId, { name: string; tag: string; rotation: string[] }> = {
    baseline: {
      name: "Baseline",
      tag: "Keep current practice",
      rotation: [cropName, cropName, cropName],
    },
    water: {
      name: "Water-Conserving",
      tag: "Drought-resilient rotation",
      rotation: [cropName, inputs.partners?.water ?? DROUGHT_PARTNER[c] ?? "Sorghum", cropName],
    },
    soil: {
      name: "Soil-Rebuilding",
      tag: "Nitrogen-fixing / cover crop",
      rotation: [cropName, inputs.partners?.soil ?? LEGUME_PARTNER[c] ?? "Lentil", cropName],
    },
  };

  const site =
    inputs.annualRainMm != null && inputs.slopeDeg != null && inputs.soilTex
      ? { annualRainMm: inputs.annualRainMm, slopeDeg: inputs.slopeDeg, ...inputs.soilTex, socGkg: inputs.soilTex.soc }
      : null;
  const lossOf = (rot: string[]) => (site ? soilLoss(site, rot) : null);
  const baseIncome = inputs.country !== undefined ? rotationIncome(meta.baseline.rotation, inputs.country) : null;
  const incomeScore = (rot: string[]) => {
    const v = inputs.country !== undefined ? rotationIncome(rot, inputs.country) : null;
    return v != null && baseIncome ? clamp((50 * v) / baseIncome) : null;
  };

  const scored = (Object.keys(PROFILES) as StrategyId[]).map((id) => {
    const p = PROFILES[id];
    const soil = clamp(p.soil + p.nfix * 8 - hot * 12 - dry * 6 - wet * 4);
    // Water: measured FAO-56 irrigation need when available. Sliders: less rain → the missing
    // effective rain must be irrigated; +1 °C ≈ +2.5 % crop water use (Hargreaves).
    const w = inputs.water?.[id];
    const rainPct = rain - 50; // same mapping as the slider label (−50 … +50 %)
    const heatC = ((heat - 50) / 50) * 6;
    const irrigationMm = w
      ? Math.max(0, Math.round(w.irrigation_mm - (rainPct / 100) * w.effective_rain_mm + w.need_mm * 0.025 * heatC))
      : null;
    const waterThrift =
      irrigationMm != null
        ? clamp(100 - irrigationMm / 3 / 8) // 800 mm extra water per season → 0
        : clamp(100 - p.waterNeed - dry * 35 * (1 - p.drought));
    // Measured: how often this plan's crops had low-risk seasons here (0.5 share → 100). Else the rule value.
    const baseRes = inputs.lowRisk?.[id] != null ? clamp(inputs.lowRisk[id]! * 200) : p.res;
    const resilience = clamp(
      baseRes - dry * 45 * (1 - p.drought) - hot * 35 * (1 - p.drought) - wet * 18
    );
    const overall = clamp((soil + waterThrift + resilience) / 3);

    // Goal fit: average of the metrics tied to the farmer's chosen goals.
    const goalMetric: Record<GoalId, number> = {
      water: waterThrift,
      nitrogen: soil,
      // Measured when inputs are there: RUSLE soil loss (11 t/ha/yr = 50) and FAO income vs keeping the current crop.
      erosion: lossOf(meta[id].rotation) != null ? clamp(100 - lossOf(meta[id].rotation)! * 4.5 - dry * 10) : clamp(p.erosion * 100 - dry * 10),
      income: incomeScore(meta[id].rotation) ?? p.income,
    };
    const goalFit = goals.length
      ? clamp(goals.reduce((a, g) => a + goalMetric[g], 0) / goals.length)
      : overall;

    // Soil-health trajectory over 3 years. Baseline (monocrop) degrades;
    // the legume/cover-crop option rebuilds soil year on year.
    const perYear =
      id === "soil" ? 9 + p.nfix * 4 : id === "water" ? 3 : -4;
    const adj = perYear - (dry + hot) * 2.5;
    const baseSoil = inputs.soilHealth != null ? 0.5 * 48 + 0.5 * inputs.soilHealth : 48; // measured soil pulls the start
    const start = clamp(baseSoil + p.nfix * 6 + p.erosion * 6 - dry * 5 - hot * 4);
    const soilTrajectory = [0, 1, 2].map((y) => clamp(start + y * adj));

    return {
      id,
      ...meta[id],
      soil,
      waterThrift,
      resilience,
      overall,
      goalFit,
      soilTrajectory,
      irrigationMm,
      soilLossT: lossOf(meta[id].rotation),
      incomeUsd: inputs.country !== undefined ? rotationIncome(meta[id].rotation, inputs.country) : null,
      isBest: false,
    };
  });

  // Mark the best plan. Order: goal fit (shifted toward weather resilience when the what-if
  // sliders move — up to 80 % at the slider ends), then goal intent (Save Water → the water
  // plan; goalFit ties a lot in wet rice regions), then overall.
  const shift = 0.8 * Math.min(1, Math.max(Math.abs(dryness), Math.abs(heatX)));
  const pickScore = (s: (typeof scored)[number]) => s.goalFit * (1 - shift) + s.resilience * shift;
  const GOAL_HOME: Record<GoalId, StrategyId> = {
    water: "water",
    nitrogen: "soil",
    erosion: "soil",
    income: "baseline",
  };
  const intent = (id: StrategyId) => goals.filter((g) => GOAL_HOME[g] === id).length;
  let best = scored[0];
  for (const s of scored) {
    const d = pickScore(s) - pickScore(best) || intent(s.id) - intent(best.id) || s.overall - best.overall;
    if (d > 0) best = s;
  }
  best.isBest = true;

  return scored;
}

// Plain-language names + one-line "why", shared by the Rotations and Plan screens.
type Bi = [string, string];
export const STRATEGY_TEXT: Record<string, { name: Bi; why: Bi }> = {
  baseline: {
    name: ["Keep current practice", "လက်ရှိအတိုင်း ဆက်စိုက်"],
    why: ["Simple, but the soil wears out and a bad year hits harder.", "ရိုးရှင်းသော်လည်း မြေဆီလွှာ ယိုယွင်းပြီး ဆိုးသောနှစ်တွင် ထိခိုက်များသည်။"],
  },
  water: {
    name: ["Water-saving rotation", "ရေချွေတာ လှည့်စိုက်"],
    why: ["A drought-tolerant crop in year 2 uses less water and protects you if the rain fails.", "ဒုတိယနှစ်တွင် မိုးခေါင်ဒဏ်ခံသီးနှံ စိုက်၍ ရေနည်းနည်းသုံးပြီး မိုးနည်းလျှင် ကာကွယ်ပေးသည်။"],
  },
  soil: {
    name: ["Soil-building rotation", "မြေဩဇာ တည်ဆောက် လှည့်စိုက်"],
    why: ["A legume in year 2 puts nitrogen back into the soil, so you need less fertilizer.", "ဒုတိယနှစ်တွင် ပဲမျိုးစိုက်၍ မြေထဲ နိုက်ထရိုဂျင် ပြန်ဖြည့်ပြီး ဓာတ်မြေဩဇာ လျော့သုံးရသည်။"],
  },
};


// Burmese names for every crop that can appear in a rotation (6.2). Please have a native
// speaker check the less common ones (cover crops, pulses).
const CROP_MY: Record<string, string> = {
  Rice: "စပါး", Wheat: "ဂျုံ", Maize: "ပြောင်း", Soybean: "ပဲပိစပ်", Cotton: "ဝါ", Potato: "အာလူး",
  Vegetables: "ဟင်းသီးဟင်းရွက်", Sugarcane: "ကြံ", Sorghum: "ပြောင်းလူး", Chickpea: "ကုလားပဲ",
  "Pigeon pea": "ပဲစင်းငုံ", Millet: "လူး", Cowpea: "ပဲလွန်း", "Mung bean": "ပဲတီစိမ်း", Lentil: "ပဲနီလေး",
  "Clover (cover)": "ကလိုဗာ (မြေဖုံး)", "Field pea": "စားတော်ပဲ", "Sunn hemp (cover)": "ပိုက်ဆံပင် (မြေဖုံး)",
  "Your crop": "သင့်သီးနှံ",
};

export function cropLabel(name: string, lang: "en" | "my"): string {
  return lang === "my" ? (CROP_MY[name] ?? name) : name;
}
