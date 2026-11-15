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
