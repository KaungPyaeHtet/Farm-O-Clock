"use client";

import { useEffect, useMemo, useState } from "react";
import { Sun, Waves, Thermometer, CalendarCheck, type LucideIcon } from "lucide-react";
import type { LatLng, ReplayData, ReplayRisk, SowPick } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { card, RISK_WORDS, STATUS_PILL } from "@/lib/ui";
import { Screen, ErrorBox } from "@/components/Screen";
import OutlookCard from "@/components/OutlookCard";
import { bestUpcoming, fmtDate, fromNow, nextYear, seasonDates } from "@/lib/season";

const STRIP: Record<ReplayRisk, string> = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
  unknown: "bg-hair",
};

/** Risk word for a sowing week from its calibrated chance of a low-risk season (same seasons as the grid). */
function weekLevel(a: { chance: number | null; goodCount: number; risk: ReplayRisk }, n: number): ReplayRisk {
  const p = a.chance ?? (n ? a.goodCount / n : null);
  if (p == null) return a.risk;
  return p >= 0.45 ? "good" : p >= 0.25 ? "watch" : "alert";
}

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

export default function SowingCalendar({
  pin,
  picked: pickedProp,
  onPick,
}: {
  pin: LatLng;
  picked: SowPick | null;
  onPick: (p: SowPick) => void;
}) {
  const { t } = useLang();
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now()); // read the clock once, not on every render

  useEffect(() => {
    let active = true;
    fetchJson<ReplayData>(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  // Real dates for the current/next season; best = best week that is still ahead.
  const dates = useMemo(() => (data ? seasonDates(data.weeks) : []), [data]);
  const best = data ? bestUpcoming(dates, (i) => data.weekAgg[i].chance ?? data.weekAgg[i].goodCount / 20) : 0;
  const sel = pickedProp && data && pickedProp.idx < data.weeks.length ? pickedProp.idx : best;
  // Report the shown week (the default "best" too) so the rest of the plan uses exactly this date.
  useEffect(() => {
    if (data && (pickedProp?.idx !== sel || pickedProp?.doy !== data.weeks[sel].startDoy))
      onPick({ idx: sel, doy: data.weeks[sel].startDoy });
  }, [data, sel, pickedProp, onPick]);
  const agg = data?.weekAgg[sel];
  const selLevel: ReplayRisk = data && agg ? weekLevel(agg, data.years.length) : "unknown";
  // High-risk seasons for this week in the grid's 20 seasons (shown as the "usual" in the outlook card).
  const pastCells = data ? data.years.map((y) => y.cells[sel]?.risk).filter((r) => r && r !== "unknown") : [];
  const pastBad = pastCells.filter((r) => r === "alert").length;
  const pastTotal = pastCells.length;
  const d = dates[sel];
  const anyPassed = dates.some((x) => x.passed);
  const usualBestPassed = data ? dates[data.bestWeekIndex]?.passed && data.bestWeekIndex !== best : false;
  const todayPos = (() => {
    if (!dates.length || !anyPassed) return null;
    const first = dates[0].date.getTime();
    const span = dates[dates.length - 1].date.getTime() + 7 * 86_400_000 - first;
    return Math.min(1, Math.max(0, (now - first) / span));
  })();

  return (
    <Screen
      title={t("Pick your sowing date", "စိုက်ပျိုးရက် ရွေးပါ")}
      subtitle={
        dates.length
          ? anyPassed
            ? t(
                `Sowing season is on now: until ${fmtDate(dates[dates.length - 1].date)}.`,
                `စိုက်ရာသီ ယခု ရောက်နေသည်: ${fmtDate(dates[dates.length - 1].date)} အထိ။`
              )
            : t(
                `Next sowing season: ${fmtDate(dates[0].date)} – ${fmtDate(dates[dates.length - 1].date)} (${fromNow(dates[0].date, t)}).`,
                `နောက်စိုက်ရာသီ: ${fmtDate(dates[0].date)} – ${fmtDate(dates[dates.length - 1].date)} (${fromNow(dates[0].date, t)})။`
              )
          : t("Slide along the calendar to compare sowing dates.", "စိုက်ရက်များ နှိုင်းယှဉ်ရန် ပြက္ခဒိန်ပေါ် ဆွဲပါ။")
      }
    >
      {error && <ErrorBox>{t("Couldn’t load the calendar. Please try again.", "ပြက္ခဒိန် မရနိုင်ပါ။")}</ErrorBox>}
      {!data && !error && (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-full bg-hair/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-hair/60" />
        </div>
      )}

      {data && agg && d && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6">
          <div className={`${card} p-4 lg:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-2xl font-extrabold lg:text-3xl ${d.passed ? "text-muted line-through" : "text-ink"}`}>
                  {fmtDate(d.date)}
                </span>
                {d.passed ? (
                  <span className="rounded-full bg-hair px-2 py-0.5 text-[10px] font-bold text-muted">
                    {t("Passed this season", "ဤရာသီ ကျော်လွန်ပြီ")}
                  </span>
                ) : (
                  <span className="rounded-full bg-water/12 px-2 py-0.5 text-[10px] font-bold text-water">{fromNow(d.date, t)}</span>
                )}
                {sel === best && (
                  <span className="rounded-full bg-grass px-2 py-0.5 text-[10px] font-bold text-white">
                    {t("Best", "အကောင်းဆုံး")}
                  </span>
                )}
              </div>
              {selLevel !== "unknown" && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_PILL[selLevel]}`}>
                  {t(RISK_WORDS[selLevel].en, RISK_WORDS[selLevel].my)}
                </span>
              )}
            </div>

            <div className="relative mt-4 h-9">
              <div className="absolute inset-x-0 top-1/2 flex h-5 -translate-y-1/2 gap-[2px] overflow-hidden rounded-full">
                {data.weekAgg.map((a, i) => (
                  <div key={i} className={`flex-1 ${STRIP[weekLevel(a, data.years.length)]} ${dates[i]?.passed ? "opacity-25" : ""}`} />
                ))}
              </div>
              {todayPos != null && (
                <div className="pointer-events-none absolute -top-1 bottom-0 w-0.5 bg-ink" style={{ left: `${todayPos * 100}%` }}>
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap text-ink">
                    {t("Today", "ယနေ့")}
                  </span>
                </div>
              )}
              <input
                type="range"
                min={0}
                max={data.weeks.length - 1}
                step={1}
                value={sel}
                onChange={(e) => data && onPick({ idx: +e.target.value, doy: data.weeks[+e.target.value].startDoy })}
                aria-label={t("Sowing date", "စိုက်ရက်")}
                className="sow-pin absolute inset-0 h-full w-full"
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>{fmtDate(dates[0].date)}</span>
              <span>{fmtDate(dates[dates.length - 1].date)}</span>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-grass/25 bg-grass/10 p-3">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-grass" />
              <p className="text-sm text-ink">
                {d.passed
                  ? t(
                      `This date has passed for this season. Next chance: ${fmtDate(nextYear(d.date))}.`,
                      `ဤရက် ဤရာသီအတွက် ကျော်လွန်ပြီ။ နောက်အခွင့်: ${fmtDate(nextYear(d.date))}။`
                    )
                  : agg.chance != null
                    ? t(
                        `Sown around ${fmtDate(d.date)}: about ${Math.round(agg.chance * 10)} in 10 seasons go well.`,
                        `${fmtDate(d.date)} ဝန်းကျင် စိုက်လျှင် ရာသီ ၁၀ ခုတွင် ${Math.round(agg.chance * 10)} ခုခန့် အဆင်ပြေသည်။`
                      )
                    : t(
                        `Sown around ${fmtDate(d.date)}, ${agg.goodCount} of the last ${data.years.length} seasons were low risk.`,
                        `${fmtDate(d.date)} ဝန်းကျင် စိုက်လျှင် ရာသီ ${data.years.length} ခုအနက် ${agg.goodCount} ခု အန္တရာယ်နည်းခဲ့သည်။`
                      )}
              </p>
            </div>
            {usualBestPassed && (
              <p className="mt-2 text-xs text-muted">
                {t(
                  `The usual best week (${fmtDate(dates[data.bestWeekIndex].date)}) has passed; this is the best one still ahead.`,
                  `ပုံမှန် အကောင်းဆုံးအပတ် (${fmtDate(dates[data.bestWeekIndex].date)}) ကျော်လွန်ပြီ။ ဤအပတ်သည် ကျန်ရှိသေးသော အကောင်းဆုံး ဖြစ်သည်။`
                )}
              </p>
            )}
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
            <OutlookCard
              pin={pin}
              startDoy={data.weeks[sel].startDoy}
              sowDate={d.passed ? nextYear(d.date) : d.date}
              pastGood={agg.goodCount}
              pastBad={pastBad}
              pastTotal={pastTotal}
            />
          </div>
        </div>
      )}
    </Screen>
  );
}
