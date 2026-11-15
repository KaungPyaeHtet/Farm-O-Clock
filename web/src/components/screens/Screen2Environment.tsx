"use client";

import { useEffect, useState } from "react";
import {
  Droplets,
  CloudRain,
  Thermometer,
  Mountain,
  type LucideIcon,
} from "lucide-react";
import type { EnvData, LatLng, Metric } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { card, STATUS_DOT, STATUS_PILL } from "@/lib/ui";

const CARDS: {
  key: keyof Pick<EnvData, "soilMoisture" | "rainfall" | "heat" | "terrain">;
  Icon: LucideIcon;
  en: string;
  my: string;
}[] = [
  { key: "soilMoisture", Icon: Droplets, en: "Soil Moisture", my: "မြေစိုထိုင်းမှု" },
  { key: "rainfall", Icon: CloudRain, en: "Rainfall", my: "မိုးရေချိန်" },
  { key: "heat", Icon: Thermometer, en: "Heat Stress", my: "အပူဒဏ်" },
  { key: "terrain", Icon: Mountain, en: "Terrain Slope", my: "မြေမျောစောက်" },
];

function MetricCard({
  Icon,
  title,
  metric,
}: {
  Icon: LucideIcon;
  title: string;
  metric: Metric;
}) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Icon className="h-4 w-4" /> {title}
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[metric.status]}`} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-ink tabular-nums">
          {metric.value ?? "—"}
        </span>
        <span className="text-sm text-muted">{metric.unit}</span>
      </div>
      <span
        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[metric.status]}`}
      >
        {metric.label}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={`${card} animate-pulse p-4`}>
      <div className="h-4 w-24 rounded bg-hair" />
      <div className="mt-3 h-8 w-16 rounded bg-hair" />
      <div className="mt-3 h-5 w-28 rounded-full bg-hair" />
    </div>
  );
}

export default function Screen2Environment({
  pin,
  onLoaded,
}: {
  pin: LatLng;
  onLoaded?: (data: EnvData) => void;
}) {
  const { t } = useLang();
  const [data, setData] = useState<EnvData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/environment?lat=${pin.lat}&lng=${pin.lng}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<EnvData>;
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        onLoaded?.(d);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.lat, pin.lng]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-extrabold text-ink">
        {t("What the satellites see", "ဂြိုဟ်တုတွေ့မြင်ချက်")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t("Live NASA data for", "NASA ဒေတာ")} 📍 {pin.lat.toFixed(3)},{" "}
        {pin.lng.toFixed(3)}
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-clay/25 bg-clay/10 p-4 text-sm text-clay">
          {t("Couldn’t load NASA data", "NASA ဒေတာ မရနိုင်ပါ")}: {error}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {loading || !data
            ? CARDS.map((c) => <SkeletonCard key={c.key} />)
            : CARDS.map((c) => (
                <MetricCard
                  key={c.key}
                  Icon={c.Icon}
                  title={t(c.en, c.my)}
                  metric={data[c.key]}
                />
              ))}
        </div>
      )}

      {data && (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted/70">
          {t("Source", "ရင်းမြစ်")}: {data.source}
        </p>
      )}
    </div>
  );
}
