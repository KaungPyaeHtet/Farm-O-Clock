"use client";

import { useEffect, useState } from "react";
import { Sun, Waves, Thermometer, CalendarCheck, type LucideIcon } from "lucide-react";
import type { LatLng, ReplayData, ReplayRisk } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { card, RISK_WORDS, STATUS_PILL } from "@/lib/ui";
import { Screen, ErrorBox } from "@/components/Screen";
import OutlookCard from "@/components/OutlookCard";

const STRIP: Record<ReplayRisk, string> = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
  unknown: "bg-hair",
};

/** 0-100 relative score → the same 3 words used everywhere else. */
function level(v: number): Exclude<ReplayRisk, "unknown"> {
  return v < 40 ? "good" : v < 60 ? "watch" : "alert";
}

function RiskBar({ Icon, label, value }: { Icon: LucideIcon; label: string; value: number }) {
  const { t } = useLang();
  const l = level(value);
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-sm text-ink">
        <Icon className="h-4 w-4 text-muted" /> {label}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-hair">
        <div className={`h-full rounded-full transition-all duration-200 ${STRIP[l]}`} style={{ width: `${Math.max(4, value)}%` }} />
      </div>
      <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold ${STATUS_PILL[l]}`}>
        {t(RISK_WORDS[l].en, RISK_WORDS[l].my)}
      </span>
    </div>
  );
}

export default function SowingCalendar({ pin }: { pin: LatLng }) {
  const { t } = useLang();
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    let active = true;
    fetchJson<ReplayData>(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => {
        if (!active) return;
        setData(d);
        setSel(d.bestWeekIndex);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  const agg = data?.weekAgg[sel];

  return (
    <Screen
      title={t("Pick your sowing date", "စိုက်ပျိုးရက် ရွေးပါ")}
      subtitle={t("Slide along the calendar to compare sowing dates.", "စိုက်ရက်များ နှိုင်းယှဉ်ရန် ပြက္ခဒိန်ပေါ် ဆွဲပါ။")}
    >
      {error && <ErrorBox>{t("Couldn’t load the calendar. Please try again.", "ပြက္ခဒိန် မရနိုင်ပါ။")}</ErrorBox>}
      {!data && !error && (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-full bg-hair/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-hair/60" />
        </div>
      )}

      {data && agg && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6">
          <div className={`${card} p-4 lg:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-ink lg:text-3xl">{data.weeks[sel].label}</span>
                {sel === data.bestWeekIndex && (
                  <span className="rounded-full bg-grass px-2 py-0.5 text-[10px] font-bold text-white">
                    {t("Best", "အကောင်းဆုံး")}
                  </span>
                )}
              </div>
              {agg.risk !== "unknown" && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_PILL[agg.risk]}`}>
                  {t(RISK_WORDS[agg.risk].en, RISK_WORDS[agg.risk].my)}
                </span>
              )}
            </div>

            <div className="relative mt-4 h-9">
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
                aria-label={t("Sowing date", "စိုက်ရက်")}
                className="sow-pin absolute inset-0 h-full w-full"
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>{data.weeks[0].label}</span>
              <span>{data.weeks[data.weeks.length - 1].label}</span>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-grass/25 bg-grass/10 p-3">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-grass" />
              <p className="text-sm text-ink">
                {agg.chance != null
                  ? t(
                      `Sown around ${data.weeks[sel].label}: about ${Math.round(agg.chance * 10)} in 10 seasons go well.`,
                      `${data.weeks[sel].label} ဝန်းကျင် စိုက်လျှင် ရာသီ ၁၀ ခုတွင် ${Math.round(agg.chance * 10)} ခုခန့် အဆင်ပြေသည်။`
                    )
                  : t(
                      `Sown around ${data.weeks[sel].label}, ${agg.goodCount} of the last ${data.years.length} seasons were low risk.`,
                      `${data.weeks[sel].label} ဝန်းကျင် စိုက်လျှင် ရာသီ ${data.years.length} ခုအနက် ${agg.goodCount} ခု အန္တရာယ်နည်းခဲ့သည်။`
                    )}
              </p>
            </div>
          </div>

          <div className={`mt-3 lg:mt-0 ${card} p-4 lg:p-6`}>
            <h3 className="mb-3 text-sm font-bold text-ink">
              {t("In past seasons, sown this week", "ယခင်ရာသီများ — ဤအပတ် စိုက်ခဲ့လျှင်")}
            </h3>
            <div className="space-y-3">
              <RiskBar Icon={Sun} label={t("Drought", "မိုးခေါင်")} value={agg.drought} />
              <RiskBar Icon={Waves} label={t("Flooding", "ရေကြီး")} value={agg.flood} />
              <RiskBar Icon={Thermometer} label={t("Heat", "အပူ")} value={agg.heat} />
            </div>
          </div>
          <div className="mt-3 lg:col-span-2 lg:mt-0">
            <OutlookCard pin={pin} startDoy={data.weeks[sel].startDoy} />
          </div>
        </div>
      )}
    </Screen>
  );
}
