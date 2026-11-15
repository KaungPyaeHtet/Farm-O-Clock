"use client";

// A small illustrated field that reacts to the what-if sliders:
// low rain -> cracked dry soil, high rain -> puddles, high heat -> drooping
// plants + a fierce sun. "Farmers understand a picture faster than a chart."

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function hex(n: number) {
  return Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, "0");
}
function mix(c1: string, c2: string, t: number) {
  const a = [1, 3, 5].map((i) => parseInt(c1.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(c2.slice(i, i + 2), 16));
  return `#${hex(lerp(a[0], b[0], t))}${hex(lerp(a[1], b[1], t))}${hex(lerp(a[2], b[2], t))}`;
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export default function ReactiveField({
  rain,
  heat,
}: {
  rain: number;
  heat: number;
}) {
  const dry = clamp01((50 - rain) / 50);
  const wet = clamp01((rain - 50) / 50);
  const hot = clamp01((heat - 50) / 50);
  const stress = Math.max(dry * 0.8, hot);

  // Sky warms and hazes as it gets hotter.
  const skyTop = mix("#bfe3f5", "#f4c98a", hot);
  const skyBottom = mix("#e8f3df", "#f7e3bf", hot);
  // Soil goes from dark-damp to pale-dry.
  const soil = mix("#6b5230", "#cdb78a", dry);
  const sunFill = mix("#ffd24d", "#ff7a2f", hot);
  const sunR = 13 + hot * 7;
  // Plant health colour: green -> amber -> scorched.
  const leaf = stress < 0.5 ? mix("#3f8f3e", "#cf9a12", stress * 2) : mix("#cf9a12", "#9a5a25", (stress - 0.5) * 2);
  const stem = mix("#4f7a33", "#8a6a2f", stress);

  function Plant({ x }: { x: number }) {
    const bend = hot * 11 + dry * 4;
    const sag = stress * 15;
    const topX = x + bend;
    const topY = 70 + sag;
    const cx = x + bend * 0.4;
    return (
      <g style={{ transition: "all .25s ease" }}>
        <path
          d={`M${x} 108 Q ${cx} 90 ${topX} ${topY}`}
          fill="none"
          stroke={stem}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <ellipse cx={topX - 7} cy={topY + 3} rx={6} ry={3.4} fill={leaf} transform={`rotate(-25 ${topX - 7} ${topY + 3})`} />
        <ellipse cx={topX + 7} cy={topY + 1} rx={6} ry={3.4} fill={leaf} transform={`rotate(25 ${topX + 7} ${topY + 1})`} />
        <ellipse cx={topX} cy={topY - 5} rx={5} ry={3} fill={leaf} />
      </g>
    );
  }

  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="Field conditions">
      <defs>
        <linearGradient id="rf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
      </defs>

      {/* Sky + sun */}
      <rect x="0" y="0" width="240" height="150" rx="14" fill="url(#rf-sky)" />
      <circle cx="198" cy="34" r={sunR} fill={sunFill} style={{ transition: "all .25s ease" }} />

      {/* Rain streaks when wet */}
      <g opacity={wet} style={{ transition: "opacity .25s ease" }}>
        {[40, 75, 110, 150, 185].map((x, i) => (
          <line key={i} x1={x} y1={20 + (i % 2) * 8} x2={x - 4} y2={34 + (i % 2) * 8} stroke="#5aa6d6" strokeWidth="2" strokeLinecap="round" />
        ))}
      </g>

      {/* Ground */}
      <path d="M0 96 Q 120 86 240 96 L240 150 L0 150 Z" fill={soil} style={{ transition: "fill .25s ease" }} />

      {/* Dry cracks */}
      <g opacity={dry} stroke={mix("#6b5230", "#8a6a3a", 0.3)} strokeWidth="1.3" fill="none" style={{ transition: "opacity .25s ease" }}>
        <path d="M30 120 l10 8 l-6 10" />
        <path d="M95 126 l8 10 l10 -4" />
        <path d="M150 122 l-8 9 l4 11" />
        <path d="M200 128 l9 7 l-4 9" />
      </g>

      {/* Puddles when wet */}
      <g opacity={wet} style={{ transition: "opacity .25s ease" }}>
        <ellipse cx="70" cy="128" rx="24" ry="6" fill="#6fb3dd" opacity="0.85" />
        <ellipse cx="170" cy="134" rx="30" ry="7" fill="#6fb3dd" opacity="0.85" />
      </g>

      {/* Plants */}
      <Plant x={60} />
      <Plant x={120} />
      <Plant x={180} />
    </svg>
  );
}
