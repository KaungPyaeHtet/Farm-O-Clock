// Soil loss per rotation with RUSLE: A = R × K × LS × C (t/ha/yr).
//   R  rain erosivity from annual rainfall (Renard & Freimund 1994)
//   K  soil erodibility from SoilGrids texture + organic carbon (Williams 1995, EPIC)
//   LS slope length-steepness from SRTM slope (λ = 50 m field length; Wischmeier & Smith 1978)
//   C  crop cover factor per crop (literature averages; cover crops protect most)

export const C_FACTOR: Record<string, number> = {
  Rice: 0.15, Wheat: 0.25, Maize: 0.4, Soybean: 0.4, Cotton: 0.5, Potato: 0.4, Vegetables: 0.45, Sugarcane: 0.2,
  Sorghum: 0.35, Millet: 0.4, Chickpea: 0.35, "Pigeon pea": 0.3, Cowpea: 0.3, "Mung bean": 0.35, Lentil: 0.3,
  "Field pea": 0.3, "Clover (cover)": 0.05, "Sunn hemp (cover)": 0.08,
};

export type ErosionSite = { annualRainMm: number; slopeDeg: number; sand: number; silt: number; clay: number; socGkg: number };

function rFactor(p: number): number {
  return p <= 850 ? 0.0483 * Math.pow(p, 1.61) : 587.8 - 1.219 * p + 0.004105 * p * p;
}

function kFactor(sand: number, silt: number, clay: number, socGkg: number): number {
  const oc = socGkg / 10; // %
  const sn1 = 1 - sand / 100;
  const fcsand = 0.2 + 0.3 * Math.exp(-0.256 * sand * (1 - silt / 100));
  const fclsi = Math.pow(silt / Math.max(1, clay + silt), 0.3);
  const forgc = 1 - (0.25 * oc) / (oc + Math.exp(3.72 - 2.95 * oc));
  const fhisand = 1 - (0.7 * sn1) / (sn1 + Math.exp(-5.51 + 22.9 * sn1));
  return fcsand * fclsi * forgc * fhisand * 0.1317;
}

function lsFactor(slopeDeg: number, lengthM = 50): number {
  const th = (slopeDeg * Math.PI) / 180;
  const s = Math.tan(th) * 100;
  const m = s >= 5 ? 0.5 : s >= 3.5 ? 0.4 : s >= 1 ? 0.3 : 0.2;
  return Math.pow(lengthM / 22.13, m) * (65.41 * Math.sin(th) ** 2 + 4.56 * Math.sin(th) + 0.065);
}

/** Average soil loss (t/ha/yr) over a rotation. */
export function soilLoss(site: ErosionSite, rotation: string[]): number {
  const rkls = rFactor(site.annualRainMm) * kFactor(site.sand, site.silt, site.clay, site.socGkg) * lsFactor(site.slopeDeg);
  const c = rotation.reduce((a, crop) => a + (C_FACTOR[crop] ?? 0.4), 0) / Math.max(1, rotation.length);
  return rkls * c;
}
