// AgriPulse-style design tokens — dark-green glassmorphism + lime accent.
// Reused across every screen so the restyle stays consistent.

/** Translucent frosted card on the dark-green backdrop. */
export const glass =
  "rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-md";

/** Smaller frosted surface (chips, inner tiles). */
export const glassSoft =
  "rounded-2xl border border-white/10 bg-white/[0.05]";

/** Primary action — bright lime, dark text. */
export const primaryBtn =
  "rounded-2xl bg-lime-400 font-semibold text-green-950 transition enabled:hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30";

/** Secondary / ghost action. */
export const ghostBtn =
  "rounded-2xl border border-white/15 font-semibold text-white/70 transition enabled:hover:bg-white/5 disabled:text-white/20";

/** Status dot / bar colors, tuned to pop on the dark theme. */
export const STATUS_DOT = {
  good: "bg-lime-400",
  watch: "bg-amber-400",
  alert: "bg-red-400",
} as const;

export const STATUS_PILL = {
  good: "bg-lime-400/15 text-lime-300",
  watch: "bg-amber-400/15 text-amber-300",
  alert: "bg-red-400/15 text-red-300",
} as const;

export const STATUS_BAR = {
  good: "bg-lime-400",
  watch: "bg-amber-400",
  alert: "bg-red-400",
} as const;
