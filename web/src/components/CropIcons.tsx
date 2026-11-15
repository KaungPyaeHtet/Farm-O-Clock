// Crop icons drawn in the same style as lucide (24px grid, 2px round strokes)
// for crops lucide doesn't have, so every crop chip looks different.

type P = { className?: string };
const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Rice: a stalk whose grain head droops over. */
export function RiceIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 22c0-7 2.5-12 8-15" />
      <path d="M14 7c3.5-.5 5.5 1.8 5.5 5.5" />
      <path d="M6 22c1.5-3.5 4-5.5 7.5-6" />
      <circle cx="16.8" cy="7.6" r="0.9" fill="currentColor" />
      <circle cx="19" cy="9.6" r="0.9" fill="currentColor" />
      <circle cx="19.8" cy="12.6" r="0.9" fill="currentColor" />
      <circle cx="19.2" cy="15.4" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Maize: a cob with kernels, wrapped in two husk leaves. */
export function MaizeIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.5c2.3 0 3.6 3.2 3.6 7.5S14.3 17.5 12 17.5 8.4 14.3 8.4 10 9.7 2.5 12 2.5z" />
      <path d="M10.2 7h3.6M9.6 10.2h4.8M10.2 13.4h3.6" />
      <path d="M8.6 12c-2.8 1.6-3.9 5-3.4 9.5 2.6-.8 5-2 6.8-4" />
      <path d="M15.4 12c2.8 1.6 3.9 5 3.4 9.5-2.6-.8-5-2-6.8-4" />
    </svg>
  );
}

/** Cotton: an open fluffy boll on its sepals. */
export function CottonIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5a3 3 0 0 1 3 2.6 3 3 0 0 1 2.5 5.3A3 3 0 0 1 12 13.6a3 3 0 0 1-5.5-2.2A3 3 0 0 1 9 6.1a3 3 0 0 1 3-2.6z" />
      <path d="M7.5 13.5 5 17M16.5 13.5 19 17M12 14v7.5" />
    </svg>
  );
}

/** Potato: a lumpy tuber with eyes. */
export function PotatoIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6.2 7.4c2.6-3.5 9.4-4.3 12.4-1 3 3.2 1.9 9.5-1.6 12.2-3.6 2.8-9.6 2.4-11.5-.8-1.7-2.9-1.6-7.7.7-10.4z" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" />
      <circle cx="14.6" cy="12.4" r="0.8" fill="currentColor" />
      <circle cx="11" cy="15.4" r="0.8" fill="currentColor" />
    </svg>
  );
}

/** Sugarcane: two jointed stalks with a leaf. */
export function SugarcaneIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M9 22V4M15 22V8" />
      <path d="M7.5 9h3M7.5 15h3M13.5 13h3M13.5 18.5h3" />
      <path d="M9 6c2.5-2.2 6-2.6 9-1.3" />
      <path d="M15 9.5c1.8-1.6 4-2 5.5-1.4" />
    </svg>
  );
}
