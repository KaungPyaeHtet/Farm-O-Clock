"use client";

import { useEffect, useState } from "react";
import { Droplets, CloudRain, Thermometer, Mountain, Layers, Leaf, Loader2, type LucideIcon } from "lucide-react";
import type { EnvData, LatLng, Metric, SoilData, Status, VegetationData } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { card, STATUS_BAR, STATUS_PILL } from "@/lib/ui";
import { Screen, ErrorBox } from "@/components/Screen";

type Key = keyof Pick<EnvData, "soilMoisture" | "rainfall" | "heat" | "terrain">;

// Scale for each reading. Zones use the same cut-offs as /api/environment.
const CARDS: {
  key: Key;
  Icon: LucideIcon;
  en: string;
  my: string;
  unit: string;
  min: number;
  max: number;
  zones: { to: number; s: Status }[];
  ends: [string, string, string, string]; // en low, en high, my low, my high
}[] = [
  {
    key: "soilMoisture", Icon: Droplets, en: "Soil moisture", my: "မြေစိုထိုင်းမှု", unit: "%", min: 0, max: 100,
    zones: [{ to: 30, s: "alert" }, { to: 80, s: "good" }, { to: 100, s: "watch" }],
    ends: ["Dry", "Wet", "ခြောက်", "စို"],
  },
  {
    key: "rainfall", Icon: CloudRain, en: "Rain", my: "မိုးရေ", unit: "mm/day", min: 0, max: 20,
    zones: [{ to: 1, s: "alert" }, { to: 15, s: "good" }, { to: 20, s: "watch" }],
    ends: ["None", "Heavy", "မရှိ", "သည်း"],
  },
  {
    key: "heat", Icon: Thermometer, en: "Daytime heat", my: "နေ့အပူ", unit: "°C", min: 15, max: 45,
    zones: [{ to: 30, s: "good" }, { to: 35, s: "watch" }, { to: 45, s: "alert" }],
    ends: ["15°", "45°", "15°", "45°"],
  },
  {
    key: "terrain", Icon: Mountain, en: "Slope", my: "မြေစောင်း", unit: "°", min: 0, max: 15,
    zones: [{ to: 3, s: "good" }, { to: 8, s: "watch" }, { to: 15, s: "alert" }],
    ends: ["Flat", "Steep", "ညီ", "မတ်"],
  },
];

// The API's sentences → one or two words.
const SHORT: Record<string, [string, string]> = {
  "No data": ["No data", "ဒေတာမရှိ"],
  "Healthy moisture": ["Good", "ကောင်း"],
  "Dry — irrigation may be needed": ["Dry", "ခြောက်"],
  "Very wet — waterlogging risk": ["Very wet", "အလွန်စို"],
  "Moderate rainfall": ["Moderate", "အသင့်အတင့်"],
  "Low rainfall — drought-leaning": ["Low", "နည်း"],
  "Heavy rainfall — flood-leaning": ["Heavy", "များ"],
  "Comfortable for most crops": ["Comfortable", "သင့်တော်"],
  "Warm — watch heat-sensitive crops": ["Warm", "နွေး"],
  "High heat stress": ["Very hot", "အလွန်ပူ"],
  "Flat — easy to work & retains water": ["Flat", "ညီညာ"],
  "Gentle slope — some runoff": ["Gentle", "အနည်းငယ်စောင်း"],
  "Steep — erosion risk": ["Steep", "မတ်စောက်"],
};

function MetricCard({ c, metric }: { c: (typeof CARDS)[number]; metric: Metric }) {
  const { t } = useLang();
  const span = c.max - c.min;
  const pos = metric.value == null ? null : Math.max(0, Math.min(1, (metric.value - c.min) / span));
  const widths = c.zones.map((z, i) => ((z.to - (i ? c.zones[i - 1].to : c.min)) / span) * 100);
  return (
    <div className={`${card} p-4 lg:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <c.Icon className="h-4 w-4" /> {t(c.en, c.my)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_PILL[metric.status]}`}>
          {t(...(SHORT[metric.label] ?? [metric.label, metric.label]))}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-ink tabular-nums lg:text-4xl">{metric.value ?? "—"}</span>
        <span className="text-sm text-muted">{c.unit}</span>
      </div>

      {/* Scale: coloured zones + marker for this field */}
      <div className="relative mt-3 h-2">
        <div className="flex h-full gap-[2px] overflow-hidden rounded-full">
          {c.zones.map((z, i) => (
            <div key={z.to} className={`${STATUS_BAR[z.s]} opacity-35`} style={{ width: `${widths[i]}%` }} />
          ))}
        </div>
        {pos != null && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow"
            style={{ left: `${pos * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{t(c.ends[0], c.ends[2])}</span>
        <span>{t(c.ends[1], c.ends[3])}</span>
      </div>
      {!!metric.farmerReports && (
        <p className="mt-2 text-[11px] font-semibold text-grass">
          {t(`Adjusted with ${metric.farmerReports} farmer report${metric.farmerReports > 1 ? "s" : ""} nearby`, `အနီးရှိ လယ်သမား အစီရင်ခံချက် ${metric.farmerReports} ခုဖြင့် ချိန်ညှိထား`)}
        </p>
      )}
    </div>
  );
}

const TEXTURE_MY: Record<string, string> = {
  Clay: "ရွှံ့မြေ", "Silty clay": "နုန်းရွှံ့မြေ", "Sandy clay": "သဲရွှံ့မြေ", "Silty clay loam": "နုန်းရွှံ့နုန်းမြေ",
  "Clay loam": "ရွှံ့နုန်းမြေ", "Sandy clay loam": "သဲရွှံ့နုန်းမြေ", Silt: "နုန်းမြေ", "Silt loam": "နုန်းနုန်းမြေ",
  Loam: "နုန်းမြေ", Sand: "သဲမြေ", "Loamy sand": "နုန်းသဲမြေ", "Sandy loam": "သဲနုန်းမြေ",
};

function SoilCard({ soil }: { soil: SoilData }) {
  const { t } = useLang();
  const org = {
    good: { s: "good" as Status, en: "Good", my: "ကောင်း" },
    medium: { s: "watch" as Status, en: "Medium", my: "အလယ်အလတ်" },
    low: { s: "alert" as Status, en: "Low", my: "နည်း" },
  }[soil.organic];
  const ph = {
    good: { s: "good" as Status, en: "Good", my: "ကောင်း" },
    acidic: { s: "watch" as Status, en: "Acidic", my: "အက်ဆစ်" },
    alkaline: { s: "watch" as Status, en: "Alkaline", my: "အယ်ကာလိုင်း" },
  }[soil.phLevel];
  const parts = [
    { k: "clay", v: soil.clay, en: "Clay", my: "ရွှံ့", cls: "bg-[#8a5a3c]" },
    { k: "silt", v: soil.silt, en: "Silt", my: "နုန်း", cls: "bg-[#b9946b]" },
    { k: "sand", v: soil.sand, en: "Sand", my: "သဲ", cls: "bg-[#e3cc9a]" },
  ];
  return (
    <div className={`${card} col-span-2 p-4 lg:p-5`}>
      <div>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Layers className="h-4 w-4" /> {t("Soil", "မြေဆီလွှာ")}
        </span>
        <div className="mt-1 text-2xl font-extrabold text-ink">{t(soil.texture, TEXTURE_MY[soil.texture] ?? soil.texture)}</div>
      </div>
      <div className="mt-3">
        <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
          {parts.map((p) => (
            <div key={p.k} className={p.cls} style={{ width: `${p.v}%` }} />
          ))}
        </div>
        <div className="mt-1 flex gap-3 text-[11px] text-muted">
          {parts.map((p) => (
            <span key={p.k} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${p.cls}`} /> {t(p.en, p.my)} {p.v}%
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_PILL[org.s]}`}>
          {t("Organic matter", "အော်ဂဲနစ်")}: {t(org.en, org.my)}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_PILL[ph.s]}`}>
          pH {soil.ph}: {t(ph.en, ph.my)}
        </span>
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_MY = ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"];

/** "Jan, Feb, Mar, Oct" → "Jan–Mar, Oct" */
function monthRanges(ms: string[], names: string[]): string {
  const idx = ms.map((m) => MONTHS.indexOf(m)).filter((i) => i >= 0).sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < idx.length; i++) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    out.push(i === j ? names[idx[i]] : `${names[idx[i]]}–${names[idx[j]]}`);
    i = j;
  }
  return out.join(", ");
}

function GreenCard({ veg, loading }: { veg: VegetationData | null; loading: boolean }) {
  const { t, lang } = useLang();
  const [today] = useState(() => Date.now());
  const head = (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
      <Leaf className="h-4 w-4" /> {t("Green cover", "အပင်ဖုံးလွှမ်းမှု")}
    </span>
  );
  if (loading)
    return (
      <div className={`${card} col-span-2 p-4 lg:p-5`}>
        {head}
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("Checking satellite photos…", "ဂြိုဟ်တုဓာတ်ပုံ စစ်နေသည်…")}
        </p>
      </div>
    );
  if (!veg) return null;
  if (veg.cover === "water")
    return (
      <div className={`${card} col-span-2 p-4 lg:p-5`}>
        {head}
        <p className="mt-2 text-sm font-semibold text-clay">
          {t("This spot looks like water. Move the pin onto your field.", "ဤနေရာ ရေပြင်ဖြစ်ပုံရသည်။ ပင်ကို သင့်လယ်ပေါ် ရွှေ့ပါ။")}
        </p>
      </div>
    );
  const word = { green: ["Green", "စိမ်း"], sparse: ["Patchy", "ကျဲ"], bare: ["Bare", "ဗလာ"] }[veg.cover] as [string, string];
  const diff = veg.difference ?? 0;
  const vs: { s: Status; en: string; my: string } = veg.stressed
    ? { s: "alert", en: "Less green than usual", my: "ပုံမှန်ထက် စိမ်းနည်း" }
    : diff >= 0.1
      ? { s: "good", en: "Greener than usual", my: "ပုံမှန်ထက် ပိုစိမ်း" }
      : { s: "good", en: "Usual for this time", my: "ဤအချိန်အတွက် ပုံမှန်" };
  const monthly = veg.monthly_ndvi ?? {};
  const shot = veg.latest ? new Date(veg.latest.date) : null;
  const now = shot ? shot.getUTCMonth() : -1;
  // cloudy places can go months without a clear photo: then "vs usual" is not about now
  const fresh = !!shot && today - shot.getTime() < 60 * 864e5;
  const shotDate = shot
    ? `${shot.getUTCDate()} ${(lang === "my" ? MONTHS_MY : MONTHS)[now].slice(0, lang === "my" ? undefined : 3)} ${shot.getUTCFullYear()}`
    : "";
  return (
    <div className={`${card} col-span-2 p-4 lg:p-5`}>
      <div className="flex items-center justify-between gap-2">
        {head}
        {fresh && veg.usual_for_date != null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_PILL[vs.s]}`}>{t(vs.en, vs.my)}</span>
        )}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-ink">{t(...word)}</div>
      {/* 12-month greenness strip: green = covered, tan = usually bare */}
      <div className="mt-3 flex h-10 items-end gap-[3px]">
        {MONTHS.map((m, i) => {
          const v = monthly[m];
          return (
            <div
              key={m}
              title={`${m}: ${v ?? "—"}`}
              className={`flex-1 rounded-t-[3px] ${v == null ? "bg-hair" : v < 0.3 ? "bg-[#d9c48a]" : "bg-grass/70"} ${
                i === now ? "outline outline-2 outline-ink" : ""
              }`}
              style={{ height: `${Math.max(8, Math.min(100, ((v ?? 0) / 0.9) * 100))}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-[9px] text-muted">
        {(lang === "my" ? MONTHS_MY : MONTHS).map((m) => (
          <span key={m} className="flex-1 text-center">{m.slice(0, 3)}</span>
        ))}
      </div>
      {shot && (
        <p className="mt-2 text-xs text-muted">
          {t("Last clear photo:", "နောက်ဆုံး ကြည်လင်သောဓာတ်ပုံ:")} <span className="font-semibold text-ink">{shotDate}</span>
          {!fresh && t(" (often cloudy here)", " (ဤနေရာ မကြာခဏ တိမ်ထူသည်)")}
        </p>
      )}
      {!!veg.bare_months?.length && (
        <p className="mt-2 text-xs text-muted">
          {t("Usually bare:", "ပုံမှန် ဗလာဖြစ်ချိန်:")}{" "}
          <span className="font-semibold text-ink">
            {monthRanges(veg.bare_months, lang === "my" ? MONTHS_MY : MONTHS)}
          </span>
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={`${card} animate-pulse p-4`}>
      <div className="h-4 w-24 rounded bg-hair" />
      <div className="mt-3 h-8 w-16 rounded bg-hair" />
      <div className="mt-4 h-2 w-full rounded-full bg-hair" />
    </div>
  );
}

export default function Screen2Environment({ pin, place }: { pin: LatLng; place: string }) {
  const { t } = useLang();
  const [data, setData] = useState<EnvData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [veg, setVeg] = useState<VegetationData | null>(null);
  const [vegLoading, setVegLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchJson<VegetationData>(`/api/vegetation?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setVeg(d))
      .catch(() => {})
      .finally(() => active && setVegLoading(false));
    fetchJson<SoilData>(`/api/soil?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setSoil(d))
      .catch(() => {});
    fetchJson<EnvData>(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  return (
    <Screen
      title={t("What the satellites see", "ဂြိုဟ်တု တွေ့မြင်ချက်")}
      subtitle={t(`Near ${place} · last 30 days`, `${place} အနီး · နောက်ဆုံး ရက် ၃၀`)}
    >
      {error ? (
        <ErrorBox>{t("Couldn’t load NASA data. Please try again.", "NASA ဒေတာ မရနိုင်ပါ။ ထပ်စမ်းပါ။")}</ErrorBox>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {!data
            ? CARDS.map((c) => <SkeletonCard key={c.key} />)
            : CARDS.map((c) => <MetricCard key={c.key} c={c} metric={data[c.key]} />)}
          {soil && <SoilCard soil={soil} />}
          <GreenCard veg={veg} loading={vegLoading} />
        </div>
      )}
    </Screen>
  );
}
