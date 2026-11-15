// Field Shift rotation-strategy model (Screen 5).
//
// Transparent, deterministic heuristic that scores 3 rotation pathways
// against the farmer's crop + goals and a "what-if" climate scenario
// (rain/heat sliders). This is a placeholder for the eventual XGBoost
// model — keep the same scoreStrategies(...) signature so it can be
// swapped in without touching the UI.

import type { GoalId } from "./types";

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
export function scoreStrategies(
  crop: string | null,
  goals: GoalId[],
  rain: number,
  heat: number
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
      rotation: [cropName, DROUGHT_PARTNER[c] ?? "Sorghum", cropName],
    },
    soil: {
      name: "Soil-Rebuilding",
      tag: "Nitrogen-fixing / cover crop",
      rotation: [cropName, LEGUME_PARTNER[c] ?? "Lentil", cropName],
    },
  };

  const scored = (Object.keys(PROFILES) as StrategyId[]).map((id) => {
    const p = PROFILES[id];
    const soil = clamp(p.soil + p.nfix * 8 - hot * 12 - dry * 6 - wet * 4);
    const waterThrift = clamp(100 - p.waterNeed - dry * 35 * (1 - p.drought));
    const resilience = clamp(
      p.res - dry * 45 * (1 - p.drought) - hot * 35 * (1 - p.drought) - wet * 18
    );
    const overall = clamp((soil + waterThrift + resilience) / 3);

    // Goal fit: average of the metrics tied to the farmer's chosen goals.
    const goalMetric: Record<GoalId, number> = {
      water: waterThrift,
      nitrogen: soil,
      erosion: clamp(p.erosion * 100 - dry * 10),
      income: p.income,
    };
    const goalFit = goals.length
      ? clamp(goals.reduce((a, g) => a + goalMetric[g], 0) / goals.length)
      : overall;

    // Soil-health trajectory over 3 years. Baseline (monocrop) degrades;
    // the legume/cover-crop option rebuilds soil year on year.
    const perYear =
      id === "soil" ? 9 + p.nfix * 4 : id === "water" ? 3 : -4;
    const adj = perYear - (dry + hot) * 2.5;
    const start = clamp(48 + p.nfix * 6 + p.erosion * 6 - dry * 5 - hot * 4);
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
      isBest: false,
    };
  });

  // Mark the best fit for the farmer's goals (ties broken by overall).
  let best = scored[0];
  for (const s of scored) {
    if (s.goalFit > best.goalFit || (s.goalFit === best.goalFit && s.overall > best.overall)) {
      best = s;
    }
  }
  best.isBest = true;

  return scored;
}
