// Shared types used across the Field Shift wizard screens.

export type LatLng = { lat: number; lng: number };

export type Status = "good" | "watch" | "alert";

export type Metric = {
  value: number | null;
  unit: string;
  status: Status;
  label: string;
};

export type GoalId = "water" | "nitrogen" | "erosion" | "income";
export type ConstraintId = "no_machinery" | "frost_sensitive";

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
