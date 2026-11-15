// Gross income per hectare per crop from FAOSTAT: national yield × farm-gate price (USD/t),
// latest 5 years. A country without a reported price uses the world median price.
// Built by backend/eval/build_economics.py → crop-economics.json.
import econ from "./crop-economics.json";

type Entry = { yield_t_ha?: number; price_usd_t?: number };
const E = econ as { world: Record<string, Entry>; countries: Record<string, Record<string, Entry>> };

/** USD per hectare for one season of `crop` in country `iso2`; 0 for cover crops; null if unknown. */
export function revenuePerHa(crop: string, iso2?: string | null): number | null {
  if (crop.includes("(cover)")) return 0; // grown for the soil, not sold
  const c = iso2 ? E.countries[iso2.toUpperCase()]?.[crop] : undefined;
  const w = E.world[crop];
  const y = c?.yield_t_ha ?? w?.yield_t_ha;
  const p = c?.price_usd_t ?? w?.price_usd_t;
  return y != null && p != null ? y * p : null;
}

/** Average yearly gross income (USD/ha) over a rotation, or null if any crop is unknown. */
export function rotationIncome(rotation: string[], iso2?: string | null): number | null {
  const v = rotation.map((c) => revenuePerHa(c, iso2));
  return v.some((x) => x == null) ? null : (v as number[]).reduce((a, b) => a + b, 0) / v.length;
}
