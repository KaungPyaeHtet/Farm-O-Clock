// Farm O'Clock design tokens — "Paddy Daylight" light, field-ready palette.
// Big tap targets, high contrast, icon beside every label.

/** Standard content card. */
export const card = "rounded-2xl border border-hair bg-surface shadow-sm";

/** Primary action — grass green, white text, large tap target. */
export const primaryBtn =
  "rounded-2xl bg-grass font-bold text-white transition enabled:hover:bg-grass-strong disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30";

/** Secondary / ghost action. */
export const ghostBtn =
  "rounded-2xl border border-hair bg-surface font-bold text-muted transition enabled:hover:bg-black/[0.03] disabled:text-black/25";

/** Status colors (semantic, separate from the grass accent). */
export const STATUS_DOT = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
} as const;

export const STATUS_PILL = {
  good: "bg-grass/12 text-grass",
  watch: "bg-sun/15 text-[#9a6a0c]",
  alert: "bg-clay/12 text-clay",
} as const;

export const STATUS_BAR = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
} as const;

/** One vocabulary for risk everywhere in the app (legend, calendar, cards). */
export const RISK_WORDS = {
  good: { en: "Low risk", my: "အန္တရာယ်နည်း" },
  watch: { en: "Some risk", my: "သတိထားရန်" },
  alert: { en: "High risk", my: "အန္တရာယ်များ" },
  unknown: { en: "No data", my: "ဒေတာမရှိ" },
} as const;
