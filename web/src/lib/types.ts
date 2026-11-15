// Shared types used across the Field Shift wizard screens.

export type LatLng = { lat: number; lng: number };

export type Status = "good" | "watch" | "alert";

export type Metric = {
  value: number | null;
  unit: string;
  status: Status;
  label: string;
  /** soil moisture only: number of nearby farmer reports blended in */
  farmerReports?: number;
};

export type GoalId = "water" | "nitrogen" | "erosion" | "income";
export type ConstraintId = "no_machinery" | "frost_sensitive";

/** The what-if sliders (0-100, 50 = as expected). Shared by the Rotations and Plan screens. */
export type WhatIf = { rain: number; heat: number };
/** The farmer's sowing week: index into the replay weeks + its day of year. */
export type SowPick = { idx: number; doy: number };

export type CropGoals = {
  crop: string | null;
  goals: GoalId[]; // 1–2 primary goals
  constraints: ConstraintId[]; // optional
};

export type EnvData = {
  lat: number;
  lng: number;
  windowDays: number;
  soilMoisture: Metric;
  rainfall: Metric;
  heat: Metric;
  terrain: Metric;
  source: string;
};

export type Verdict = "dry" | "normal" | "wet";

export type ReplayRisk = "good" | "watch" | "alert" | "unknown";

export type ReplayData = {
  lat: number;
  lng: number;
  growDays: number;
  weeks: { label: string; startDoy: number }[];
  years: { year: number; cells: { risk: ReplayRisk; reason: string }[] }[];
  weekAgg: {
    drought: number;
    flood: number;
    heat: number;
    risk: ReplayRisk;
    goodCount: number;
    /** calibrated chance (0-1) that a season sown this week is low risk */
    chance: number | null;
  }[];
  bestWeekIndex: number;
  source: string;
};

export type HistoryData = {
  lat: number;
  lng: number;
  seasonLabel: string;
  years: number;
  verdict: Verdict;
  rainfall: { thisYear: number; normal: number; percentile: number };
  temperature: { thisYear: number; normal: number; anomaly: number };
  series: { year: number; rain: number; temp: number; isCurrent: boolean }[];
  source: string;
};

/** Python model API — /api/outlook (risk-logreg-v1). Probabilities 0-1. */
export type OutlookWeek = {
  label: string;
  start_doy: number;
  /** days from the latest NASA data to this sowing date; outlook only meaningful when in_range */
  lead_days: number;
  in_range: boolean;
  /** seasonal-forecast shift for this sowing window, if the forecast covers it */
  forecast: { rain_pct: number; heat_c: number; low_risk: number; usual_low_risk: number; seasons: number } | null;
  high_risk: number;
  high_risk_usual: number | null;
  drought: number;
  drought_usual: number | null;
  flood: number;
  flood_usual: number | null;
  heat: number;
  heat_usual: number | null;
};

export type OutlookData = {
  data_through: string;
  conditions: Record<string, number | null>;
  weeks: OutlookWeek[];
  seasonal_forecast: { available: boolean; source: string; max_lead_days?: number | null };
  /** the NASA-conditions outlook is valid for sowing up to this many days after data_through */
  max_lead_days?: number;
  model: { version: string; trained: string; held_out_auc: Record<string, number> };
  note: string;
};

/** Python model API — /api/scenario. Counts are past seasons out of `seasons`. */
export type ScenarioData = {
  rain_pct: number;
  heat_c: number;
  years: [number, number];
  weeks: {
    label: string;
    start_doy: number;
    seasons: number;
    low_risk: number;
    some_risk: number;
    high_risk: number;
  }[];
  best_week_index: number;
};

/** /api/soil — ISRIC SoilGrids, top 30 cm. */
export type SoilData = {
  texture: string; // USDA class, e.g. "Clay loam"
  clay: number; // %
  sand: number; // %
  silt: number; // %
  soc: number; // organic carbon, g/kg
  ph: number;
  organic: "low" | "medium" | "good";
  phLevel: "acidic" | "good" | "alkaline";
  health: number; // 0-100 soil-health score
  asOf?: string; // set when SoilGrids was down and this is the last known result (ISO time)
};

/** /api/vegetation — MODIS NDVI greenness at the pin. */
export type VegetationData = {
  cover: "green" | "sparse" | "bare" | "water";
  views: number;
  latest?: { date: string; ndvi: number };
  usual_for_date?: number | null;
  difference?: number | null;
  stressed?: boolean;
  bare_months?: string[];
  monthly_ndvi?: Record<string, number | null>;
};
