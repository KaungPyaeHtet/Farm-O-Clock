"use client";

import { useEffect, useState } from "react";
import { Sun, Waves, Thermometer, CalendarCheck, type LucideIcon } from "lucide-react";
import type { LatLng, ReplayData, ReplayRisk } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { card } from "@/lib/ui";

const STRIP: Record<ReplayRisk, string> = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
  unknown: "bg-hair",
};

function levelColor(v: number) {
  return v < 40 ? "bg-grass" : v < 60 ? "bg-sun" : "bg-clay";
}

function RiskBar({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-20 shrink-0 items-center gap-1.5 text-sm text-ink">
        <Icon className="h-4 w-4 text-muted" /> {label}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-hair">
        <div
          className={`h-full rounded-full transition-all duration-200 ${levelColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-bold text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function SowingCalendar({ pin }: { pin: LatLng }) {
  const { t } = useLang();
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<ReplayData>;
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        setSel(d.bestWeekIndex);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  const agg = data?.weekAgg[sel];
  const verdictText: Record<ReplayRisk, string> = {
    good: t("Favourable sowing date", "အဆင်ပြေသော စိုက်ရက်"),
    watch: t("Some risk at this date", "ဤရက်တွင် အန္တရာယ်အနည်းငယ်"),
    alert: t("Risky sowing date", "အန္တရာယ်ရှိသော စိုက်ရက်"),
    unknown: "—",
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-extrabold text-ink">
        {t("Pick your sowing date", "စိုက်ပျိုးရက် ရွေးပါ")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t(
          "Drag the pin along the calendar. The risk bars update live.",
          "ပြက္ခဒိန်ပေါ် ပင်ကို ဆွဲပါ။ အန္တရာယ်ဘားများ ချက်ချင်း ပြောင်းသည်။"
        )}
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          <div className="h-10 animate-pulse rounded-full bg-hair/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-hair/60" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-clay/25 bg-clay/10 p-4 text-sm text-clay">
          {t("Couldn’t load calendar", "ပြက္ခဒိန် မရနိုင်ပါ")}: {error}
        </div>
      )}

      {data && agg && (
        <>
          {/* Selected date headline */}
          <div className="mt-4 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-ink">
                {data.weeks[sel].label}
              </span>
              {sel === data.bestWeekIndex && (
                <span className="rounded-full bg-grass px-2 py-0.5 text-[10px] font-bold text-white">
                  {t("best", "အကောင်းဆုံး")}
                </span>
              )}
            </div>
            <span className="text-sm font-semibold text-muted">
              {verdictText[agg.risk]}
            </span>
          </div>

          {/* The calendar strip + draggable pin */}
          <div className="relative mt-3 h-9">
            <div className="absolute inset-x-0 top-1/2 flex h-5 -translate-y-1/2 gap-[2px] overflow-hidden rounded-full">
              {data.weekAgg.map((a, i) => (
                <div key={i} className={`flex-1 ${STRIP[a.risk]}`} />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={data.weeks.length - 1}
              step={1}
              value={sel}
              onChange={(e) => setSel(+e.target.value)}
              aria-label="Sowing date"
              className="sow-pin absolute inset-0 h-full w-full"
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>{data.weeks[0].label}</span>
            <span>{data.weeks[data.weeks.length - 1].label}</span>
          </div>

          {/* Favourability count */}
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-grass/25 bg-grass/10 p-3">
            <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-grass" />
            <p className="text-sm text-ink">
              {t(
                `Sown around ${data.weeks[sel].label}, ${agg.goodCount} of the last ${data.years.length} seasons were favourable.`,
                `${data.weeks[sel].label} ဝန်းကျင် စိုက်လျှင် လွန်ခဲ့သော ရာသီ ${data.years.length} ခုအနက် ${agg.goodCount} ခု အဆင်ပြေခဲ့သည်။`
              )}
            </p>
          </div>

          {/* Live risk bars */}
          <div className={`mt-3 space-y-3 ${card} p-4`}>
            <RiskBar Icon={Sun} label={t("Drought", "မိုးခေါင်")} value={agg.drought} />
            <RiskBar Icon={Waves} label={t("Flood", "ရေကြီး")} value={agg.flood} />
            <RiskBar Icon={Thermometer} label={t("Heat", "အပူ")} value={agg.heat} />
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted/70">
            {t("Risk = how often this was a problem in the last", "အန္တရာယ် = လွန်ခဲ့သော")}{" "}
            {data.years.length} {t("seasons", "ရာသီအတွင်း ဖြစ်ခဲ့သည့် အကြိမ်ရေ")}
          </p>
        </>
      )}
    </div>
  );
}
