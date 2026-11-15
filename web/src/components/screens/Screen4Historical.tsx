"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Waves,
  CloudRain,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import type { HistoryData, LatLng, Verdict } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { card } from "@/lib/ui";

const VERDICT: Record<
  Verdict,
  { en: string; my: string; Icon: LucideIcon; banner: string }
> = {
  normal: {
    en: "Normal season",
    my: "ပုံမှန်ရာသီ",
    Icon: CheckCircle2,
    banner: "border-grass/25 bg-grass/10 text-grass-strong",
  },
  dry: {
    en: "Drier than usual",
    my: "ပုံမှန်ထက် ခြောက်သွေ့",
    Icon: Flame,
    banner: "border-clay/25 bg-clay/10 text-clay",
  },
  wet: {
    en: "Wetter than usual",
    my: "ပုံမှန်ထက် စိုစွတ်",
    Icon: Waves,
    banner: "border-water/25 bg-water/10 text-water",
  },
};

function RainChart({ data }: { data: HistoryData }) {
  const { t } = useLang();
  const max = Math.max(...data.series.map((s) => s.rain), 1);
  const normalPct = (data.rainfall.normal / max) * 100;
  return (
    <div className={`mt-3 ${card} p-4`}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{t("Seasonal rainfall by year (mm)", "နှစ်အလိုက် ရာသီမိုးရေ (mm)")}</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-grass" /> {t("this year", "ယခုနှစ်")}
        </span>
      </div>
      <div className="relative mt-3 flex h-36 items-end gap-[3px]">
        <div
          className="absolute left-0 right-0 border-t border-dashed border-muted/60"
          style={{ bottom: `${normalPct}%` }}
        >
          <span className="absolute -top-2 left-0 rounded bg-surface px-1 text-[10px] font-semibold text-muted">
            {t("avg", "ပျမ်းမျှ")} {data.rainfall.normal} mm
          </span>
        </div>
        {data.series.map((s) => (
          <div
            key={s.year}
            className="relative flex-1"
            style={{ height: `${(s.rain / max) * 100}%` }}
            title={`${s.year}: ${s.rain} mm`}
          >
            <div
              className={`h-full w-full rounded-t ${
                s.isCurrent ? "bg-grass" : "bg-hair"
              }`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>{data.series[0]?.year}</span>
        <span>{data.series[data.series.length - 1]?.year}</span>
      </div>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
  sub,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}

export default function Screen4Historical({ pin }: { pin: LatLng }) {
  const { t } = useLang();
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<HistoryData>;
      })
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-extrabold text-ink">
        {t("Historical context", "သမိုင်းနောက်ခံ")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t("Is this season unusual for your farm?", "ဤရာသီ သင့်လယ်အတွက် ပုံမှန်မဟုတ်ဘူးလား?")}
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-hair/60" />
          <div className="h-44 animate-pulse rounded-2xl bg-hair/60" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-clay/25 bg-clay/10 p-4 text-sm text-clay">
          {t("Couldn’t load history", "သမိုင်းဒေတာ မရနိုင်ပါ")}: {error}
        </div>
      )}

      {data && (
        <>
          <div className={`mt-4 rounded-2xl border p-4 ${VERDICT[data.verdict].banner}`}>
            <div className="flex items-center gap-2 text-base font-bold">
              {(() => {
                const I = VERDICT[data.verdict].Icon;
                return <I className="h-5 w-5" />;
              })()}
              {t(VERDICT[data.verdict].en, VERDICT[data.verdict].my)}
            </div>
            <p className="mt-1 text-sm opacity-90">
              {t(
                `This ${data.seasonLabel} season sits at the ${data.rainfall.percentile}th percentile of the last ${data.years} years for rainfall.`,
                `ဤ ${data.seasonLabel} ရာသီသည် လွန်ခဲ့သော ${data.years} နှစ်အတွင်း မိုးရေချိန် ${data.rainfall.percentile} ရာခိုင်နှုန်း အဆင့်တွင် ရှိသည်။`
              )}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              Icon={CloudRain}
              label={t("Rainfall this season", "ဤရာသီ မိုးရေ")}
              value={`${data.rainfall.thisYear} mm`}
              sub={`${t("Normal", "ပုံမှန်")}: ${data.rainfall.normal} mm`}
            />
            <Stat
              Icon={Thermometer}
              label={t("Temperature", "အပူချိန်")}
              value={`${data.temperature.anomaly >= 0 ? "+" : ""}${data.temperature.anomaly}°C`}
              sub={`${t("vs", "နှိုင်း")} ${data.years}-yr (${data.temperature.normal}°C)`}
            />
          </div>

          <RainChart data={data} />

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted/70">
            {t("Source", "ရင်းမြစ်")}: {data.source}
          </p>
        </>
      )}
    </div>
  );
}
