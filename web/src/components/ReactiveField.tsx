"use client";

// Illustrated field that reacts to the what-if sliders. One flat style for
// every element: soft rounded shapes, no outlines, one shared palette.
//   rain < 50  → drier: pale cracked soil, yellowing plants, haze
//   rain > 50  → wetter: clouds roll in, rain falls, puddles in the rows
//   heat > 50  → hotter: bigger orange sun, warm sky, shimmer, wilting

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
const fade = { transition: "fill .35s ease, opacity .35s ease" } as const;

// Rain drops: fixed positions (no randomness → stable SSR/CSR markup).
const DROPS = Array.from({ length: 22 }, (_, i) => ({
  x: 48 + ((i * 53) % 236),
  y: 66 + ((i * 29) % 34),
  delay: -((i * 0.37) % 1.1),
  order: (i * 7) % 22, // which drops appear first as rain increases
}));

function Cloud({ x, y, s, fill, opacity }: { x: number; y: number; s: number; fill: string; opacity: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity} style={fade}>
      <circle cx={-16} cy={4} r={11} fill={fill} style={fade} />
      <circle cx={0} cy={-4} r={15} fill={fill} style={fade} />
      <circle cx={17} cy={3} r={12} fill={fill} style={fade} />
      <rect x={-27} y={3} width={56} height={12} rx={6} fill={fill} style={fade} />
    </g>
  );
}

// One leaf: a soft almond shape pointing along +x from the origin.
const LEAF = "M0 0 C5 -5.5 13 -5.5 17 0 C13 4 5 4 0 0Z";

function Plant({
  x,
  y,
  s,
  stress,
  heat,
  leaf,
  leafDark,
  stem,
}: {
  x: number;
  y: number;
  s: number;
  stress: number;
  heat: number;
  leaf: string;
  leafDark: string;
  stem: string;
}) {
  const h = 34 - stress * 6; // shorter when stressed
  const lean = heat * 5 + stress * 3; // tips over a little in heat
  const droop = stress * 38; // leaves rotate downwards
  const tx = lean;
  const ty = -h;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={1.5} rx={10} ry={2.6} fill="#000" opacity={0.12} />
      <path d={`M0 0 Q ${lean * 0.2} ${-h * 0.55} ${tx} ${ty}`} fill="none" stroke={stem} strokeWidth={2.6} strokeLinecap="round" style={{ transition: "stroke .35s ease" }} />
      {/* lower pair */}
      <path d={LEAF} fill={leafDark} transform={`translate(${lean * 0.15} ${-h * 0.42}) rotate(${-28 + droop})`} style={fade} />
      <path d={LEAF} fill={leafDark} transform={`translate(${lean * 0.15} ${-h * 0.42}) scale(-1 1) rotate(${-28 + droop})`} style={fade} />
      {/* upper pair */}
      <path d={LEAF} fill={leaf} transform={`translate(${tx * 0.75} ${-h * 0.8}) rotate(${-38 + droop}) scale(0.85)`} style={fade} />
      <path d={LEAF} fill={leaf} transform={`translate(${tx * 0.75} ${-h * 0.8}) scale(-1 1) rotate(${-38 + droop}) scale(0.85)`} style={fade} />
      {/* bud */}
      <ellipse cx={tx} cy={ty} rx={3.6} ry={4.6} fill={leaf} transform={`rotate(${lean * 2} ${tx} ${ty})`} style={fade} />
    </g>
  );
}

export default function ReactiveField({ rain, heat }: { rain: number; heat: number }) {
  const dry = clamp01((50 - rain) / 50);
  const wet = clamp01((rain - 50) / 50);
  const hot = clamp01((heat - 50) / 50);
  const cool = clamp01((50 - heat) / 50);
  const stress = clamp01(Math.max(dry * 0.85, hot * 0.9, wet > 0.8 ? (wet - 0.8) * 1.2 : 0));

  // Sky: clear → warm haze (hot) → overcast (wet)
  let skyTop = mix("#bfe2f4", "#f3cf98", hot);
  let skyBot = mix("#eaf5e2", "#fbe9cc", hot);
  skyTop = mix(skyTop, "#a9b9c7", wet * 0.85);
  skyBot = mix(skyBot, "#d9e1e3", wet * 0.85);
  skyTop = mix(skyTop, "#d8e8f0", cool * 0.4);

  const sunCore = mix("#ffd45c", "#ff8a3d", hot);
  const sunR = 15 + hot * 5;

  const cloudFill = mix("#ffffff", "#8e9fae", wet);
  const hills = mix(mix("#9fca7f", "#d8c48a", Math.max(dry, hot * 0.7)), "#8fb57a", wet * 0.5);
  const hillsFar = mix(hills, skyBot, 0.45);

  const soil = mix(mix("#8a6440", "#cfb27c", dry), "#5e4329", wet);
  const furrow = mix(soil, "#000000", 0.18);
  const ridge = mix(soil, "#ffffff", 0.1);

  const leaf =
    stress < 0.5 ? mix("#4f9e43", "#c9a73a", stress * 2) : mix("#c9a73a", "#a06a32", (stress - 0.5) * 2);
  const leafDark = mix(leaf, "#1f3a14", 0.22);
  const stem = mix("#4a7a33", "#8a6a33", stress);

  const visibleDrops = Math.round(wet * DROPS.length);

  return (
    <svg viewBox="0 0 320 200" className="block h-auto w-full" role="img" aria-label="Your field under this weather">
      <defs>
        <linearGradient id="rf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} style={{ transition: "stop-color .35s ease" }} />
          <stop offset="1" stopColor={skyBot} style={{ transition: "stop-color .35s ease" }} />
        </linearGradient>
        <clipPath id="rf-frame">
          <rect width="320" height="200" />
        </clipPath>
      </defs>

      <g clipPath="url(#rf-frame)">
        {/* Sky */}
        <rect width="320" height="200" fill="url(#rf-sky)" />

        {/* Sun (behind clouds) */}
        <g opacity={1 - wet * 0.75} style={fade}>
          <circle cx={258} cy={44} r={sunR + 12 + hot * 8} fill={sunCore} opacity={0.18 + hot * 0.12} style={fade} />
          <circle cx={258} cy={44} r={sunR + 5} fill={sunCore} opacity={0.3} style={fade} />
          <circle cx={258} cy={44} r={sunR} fill={sunCore} style={fade} />
        </g>

        {/* Clouds: a light one always, rain clouds roll in when wet */}
        <Cloud x={92} y={38} s={1} fill={cloudFill} opacity={0.85 * (1 - hot * 0.8) + wet * 0.15} />
        <Cloud x={238} y={52} s={1.15} fill={cloudFill} opacity={wet} />
        <Cloud x={168} y={34} s={1.3} fill={mix(cloudFill, "#7a8b9a", 0.25)} opacity={clamp01(wet * 1.4 - 0.2)} />
        <Cloud x={45} y={56} s={0.9} fill={cloudFill} opacity={clamp01(wet * 1.6 - 0.6)} />

        {/* Rain */}
        <g stroke="#5b9fd0" strokeWidth={2} strokeLinecap="round">
          {DROPS.map((d, i) => (
            <line
              key={i}
              className="rf-drop"
              x1={d.x}
              y1={d.y}
              x2={d.x - 2}
              y2={d.y + 8}
              opacity={d.order < visibleDrops ? 0.85 : 0}
              style={{ animationDelay: `${d.delay}s`, transition: "opacity .3s ease" }}
            />
          ))}
        </g>

        {/* Distant hills */}
        <path d="M0 122 C 50 102 95 108 140 116 C 190 125 230 100 320 112 L320 140 L0 140 Z" fill={hillsFar} style={fade} />
        <path d="M0 132 C 60 118 120 120 175 128 C 230 136 270 122 320 126 L320 150 L0 150 Z" fill={hills} style={fade} />

        {/* Heat shimmer */}
        <g opacity={hot * 0.7} stroke="#fff6e0" strokeWidth={1.6} fill="none" strokeLinecap="round" style={fade}>
          <path className="rf-shimmer" d="M30 112 q 8 -4 16 0 t 16 0 t 16 0" />
          <path className="rf-shimmer" style={{ animationDelay: "-1.2s" }} d="M150 106 q 8 -4 16 0 t 16 0 t 16 0" />
          <path className="rf-shimmer" style={{ animationDelay: "-0.6s" }} d="M235 116 q 8 -4 16 0 t 16 0 t 16 0" />
        </g>

        {/* Field soil */}
        <path d="M0 140 C 80 134 220 134 320 140 L320 200 L0 200 Z" fill={soil} style={fade} />
        {/* Crop rows (ridges + furrows), widening towards the viewer */}
        {[
          { y: 152, w: 1.4 },
          { y: 168, w: 2 },
          { y: 188, w: 2.8 },
        ].map((r) => (
          <g key={r.y}>
            <path d={`M-10 ${r.y} C 100 ${r.y - 4} 220 ${r.y - 4} 330 ${r.y}`} stroke={furrow} strokeWidth={r.w * 2.2} fill="none" style={{ transition: "stroke .35s ease" }} />
            <path d={`M-10 ${r.y - r.w * 1.8} C 100 ${r.y - 4 - r.w * 1.8} 220 ${r.y - 4 - r.w * 1.8} 330 ${r.y - r.w * 1.8}`} stroke={ridge} strokeWidth={r.w} fill="none" opacity={0.6} style={{ transition: "stroke .35s ease" }} />
          </g>
        ))}

        {/* Dry cracks */}
        <g opacity={dry} stroke={mix(soil, "#5a4022", 0.55)} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" style={fade}>
          <path d="M28 176 l8 5 l-3 7 m3 -7 l7 -2" />
          <path d="M118 158 l9 4 l-2 6 m2 -6 l8 1" />
          <path d="M205 180 l-7 6 l4 7 m-4 -7 l-8 -1" />
          <path d="M282 160 l7 5 l-3 6" />
        </g>

        {/* Puddles sit in the furrows */}
        {[
          { cx: 104, cy: 167, rx: 20 },
          { cx: 168, cy: 188, rx: 24 },
          { cx: 232, cy: 167, rx: 18 },
        ].map((p, i) => (
          <g key={i} opacity={clamp01(wet * 1.3 - i * 0.15)} style={fade}>
            <ellipse cx={p.cx} cy={p.cy} rx={p.rx * (0.55 + wet * 0.45)} ry={3.6 + wet * 1.4} fill="#6fa9d1" />
            <ellipse cx={p.cx - p.rx * 0.2} cy={p.cy - 1} rx={p.rx * 0.35 * (0.55 + wet * 0.45)} ry={1.1} fill="#cfe7f6" />
          </g>
        ))}

        {/* Plants: back row smaller, front row larger */}
        {[40, 104, 168, 232, 296].map((x) => (
          <Plant key={`b${x}`} x={x} y={150} s={0.72} stress={stress} heat={hot} leaf={leaf} leafDark={leafDark} stem={stem} />
        ))}
        {[72, 136, 200, 264].map((x) => (
          <Plant key={`f${x}`} x={x} y={182} s={1.05} stress={stress} heat={hot} leaf={leaf} leafDark={leafDark} stem={stem} />
        ))}
      </g>
    </svg>
  );
}
