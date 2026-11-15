"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CloudSun, CloudRain, Sun } from "lucide-react";
import type { HistoryData, LatLng, ReplayData, ReplayRisk } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { card, RISK_WORDS } from "@/lib/ui";
import { Screen, ErrorBox } from "@/components/Screen";
import { bestUpcoming, fmtDate, fromNow, seasonDates } from "@/lib/season";

const CELL: Record<ReplayRisk, string> = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
  unknown: "bg-hair",
};

const REASON_MY: Record<string, string> = {
  "Favourable season": "အဆင်ပြေသော ရာသီ",
  "Drought stress mid-season": "ရာသီလယ် မိုးခေါင်ဒဏ်",
  "Heavy rain / waterlogging": "မိုးသည်း / ရေဝပ်",
  "Heat stress at flowering": "ပန်းပွင့်ချိန် အပူဒဏ်",
  "No data yet": "ဒေတာ မရှိသေး",
};

/** The Dry / Normal / Wet block from the product flow (last ~90 days vs 20 years). */
function SeasonVerdict({ pin }: { pin: LatLng }) {
  const { t } = useLang();
  const [h, setH] = useState<HistoryData | null>(null);
  useEffect(() => {
    let active = true;
    fetchJson<HistoryData>(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setH(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  if (!h) return <div className={`${card} h-24 animate-pulse`} />;
  const V = {
    dry: { Icon: Sun, cls: "border-clay/30 bg-clay/10 text-clay", en: "Drier than usual", my: "ပုံမှန်ထက် ခြောက်" },
    normal: { Icon: CloudSun, cls: "border-grass/30 bg-grass/10 text-grass-strong", en: "About normal", my: "ပုံမှန်" },
    wet: { Icon: CloudRain, cls: "border-water/30 bg-water/10 text-water", en: "Wetter than usual", my: "ပုံမှန်ထက် စို" },
  }[h.verdict];
  return (
    <div className={`rounded-2xl border p-4 ${V.cls}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80">
        {t(`This year so far (${h.seasonLabel})`, `ယခုနှစ် (${h.seasonLabel})`)}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xl font-extrabold">
        <V.Icon className="h-6 w-6" /> {t(V.en, V.my)}
      </div>
      <p className="mt-1 text-sm text-ink/80">
        {t(
          `${h.rainfall.thisYear} mm of rain vs ${h.rainfall.normal} mm in a typical year.`,
          `မိုး ${h.rainfall.thisYear} မမ — ပုံမှန်နှစ် ${h.rainfall.normal} မမ။`
        )}
      </p>
    </div>
  );
}

export default function SeasonReplay({ pin }: { pin: LatLng }) {
  const { t, lang } = useLang();
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [pickedYear, setPickedYear] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson<ReplayData>(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  const reason = (r: string) => (lang === "my" ? (REASON_MY[r] ?? r) : r);

  // Per sowing week: how many past seasons were low / some / high risk.
  const cols =
    data?.weeks.map((w, i) => {
      const cells = data.years.map((y) => ({ year: y.year, ...y.cells[i] }));
      const count = (r: ReplayRisk) => cells.filter((c) => c.risk === r).length;
      return {
        label: w.label,
        good: count("good"),
        watch: count("watch"),
        alert: count("alert"),
        n: cells.filter((c) => c.risk !== "unknown").length,
        bad: cells.filter((c) => c.risk === "alert"),
      };
    }) ?? [];
  // Best week still ahead in the current/next season (real dates, not just "5 Aug").
  const dates = data ? seasonDates(data.weeks) : [];
  const bestIdx = data ? bestUpcoming(dates, (i) => data.weekAgg[i].chance ?? cols[i]?.good / 20) : 0;
  const sel = picked ?? bestIdx;
  const col = cols[sel];

  return (
    <Screen
      title={t("How past seasons went", "ယခင်ရာသီများ ဘယ်လိုဖြစ်ခဲ့သလဲ")}
      subtitle={t(
        `If you had sown in each week, how the last ${data?.years.length ?? 20} seasons turned out.`,
        `အပတ်တစ်ပတ်စီ စိုက်ခဲ့လျှင် ယခင် ရာသီ ${data?.years.length ?? 20} ခု ဘယ်လိုဖြစ်ခဲ့သလဲ။`
      )}
    >
      {error && <ErrorBox>{t("Couldn’t load past seasons. Please try again.", "ယခင်ရာသီ ဒေတာ မရနိုင်ပါ။")}</ErrorBox>}
      {!data && !error && <div className={`${card} h-72 animate-pulse`} />}

      {data && col && (
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
          {/* Summary: right column on desktop, top on phone */}
          <div className="space-y-3 lg:order-2">
            <SeasonVerdict pin={pin} />
            <div className="flex items-start gap-2 rounded-2xl border border-grass/25 bg-grass/10 p-3">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-grass" />
              <p className="text-sm text-ink">
                {(() => {
                  const dd = dates[bestIdx];
                  const when = dd ? `${fmtDate(dd.date)} (${fromNow(dd.date, t)})` : cols[bestIdx].label;
                  const ch = data.weekAgg[bestIdx]?.chance;
                  return ch != null
                    ? t(
                        `Best time to sow: around ${when}. About ${Math.round(ch * 10)} in 10 seasons go well.`,
                        `အကောင်းဆုံး စိုက်ချိန်: ${when} ဝန်းကျင်။ ရာသီ ၁၀ ခုတွင် ${Math.round(ch * 10)} ခုခန့် အဆင်ပြေသည်။`
                      )
                    : t(
                        `Best time to sow: around ${when}. ${cols[bestIdx].good} of ${cols[bestIdx].n} past seasons were low risk.`,
                        `အကောင်းဆုံး စိုက်ချိန်: ${when} ဝန်းကျင်။ ယခင် ရာသီ ${cols[bestIdx].n} ခုအနက် ${cols[bestIdx].good} ခု အန္တရာယ်နည်းခဲ့သည်။`
                      );
                })()}
              </p>
            </div>
          </div>

          <div className={`mt-3 lg:order-1 lg:mt-0 ${card} p-4 lg:p-6`}>
            {/* Year × week heatmap — same chart on phone and desktop (fixed squares on desktop) */}
            <p className="mb-2 text-xs text-muted lg:text-sm">
              {t("Each square = one past year (row) sown in one week (column). Tap one.", "အကွက် = ယခင်နှစ် (တန်း) × စိုက်သည့်အပတ် (တိုင်)။ တို့ကြည့်ပါ။")}
            </p>
            <div className="lg:mx-auto lg:w-fit">
              {/* week labels (desktop) */}
              <div className="hidden items-end gap-1 pb-1.5 lg:flex">
                <span className="w-12 shrink-0" />
                {cols.map((c, i) => (
                  <span key={i} className="flex w-10 flex-col items-center gap-0.5">
                    {i === bestIdx && (
                      <span className="rounded-full bg-grass px-1.5 py-px text-[9px] font-bold text-white">{t("Best", "အကောင်း")}</span>
                    )}
                    <span className={`text-center text-[10px] leading-tight ${i === sel ? "font-bold text-ink" : "text-muted"}`}>
                      {c.label.split(" ").map((p, k) => (
                        <span key={k} className="block">{p}</span>
                      ))}
                    </span>
                  </span>
                ))}
              </div>
              <div className="space-y-[3px] lg:space-y-1">
                {data.years.map((yr) => (
                  <div key={yr.year} className="flex items-center gap-[3px] lg:gap-1">
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted lg:w-12 lg:pr-1 lg:text-xs">{yr.year}</span>
                    {yr.cells.map((c, ci) => (
                      <button
                        key={ci}
                        onClick={() => {
                          setPicked(ci);
                          setPickedYear(yr.year);
                        }}
                        title={`${yr.year} · ${data.weeks[ci].label}`}
                        aria-label={`${yr.year} ${data.weeks[ci].label}: ${t(RISK_WORDS[c.risk].en, RISK_WORDS[c.risk].my)}`}
                        className={`h-4 flex-1 rounded-[3px] transition hover:opacity-80 lg:h-6 lg:w-10 lg:flex-none lg:rounded-[4px] ${CELL[c.risk]} ${
                          ci === bestIdx ? "ring-1 ring-inset ring-ink/40" : ""
                        } ${pickedYear === yr.year && ci === sel ? "outline outline-2 outline-ink" : ""}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {/* low-risk count per week (desktop) */}
              <div className="mt-1.5 hidden items-center gap-1 lg:flex">
                <span className="w-12 shrink-0 pr-1 text-right text-[10px] text-muted">{t("Low risk", "နည်း")}</span>
                {cols.map((c, i) => (
                  <span key={i} className={`w-10 text-center text-xs tabular-nums ${i === bestIdx ? "font-bold text-grass" : "text-muted"}`}>
                    {c.good}
                  </span>
                ))}
              </div>
              {/* first / last week (phone) */}
              <div className="mt-1.5 flex items-center text-[10px] text-muted lg:hidden">
                <span className="w-8 shrink-0" />
                <span className="ml-[3px]">{data.weeks[0].label}</span>
                <span className="flex-1 text-center">{t("← sowing week →", "← စိုက်သည့်အပတ် →")}</span>
                <span>{data.weeks[data.weeks.length - 1].label}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {(["good", "watch", "alert"] as const).map((r) => (
                <span key={r} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-[3px] ${CELL[r]}`} /> {t(RISK_WORDS[r].en, RISK_WORDS[r].my)}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[3px] ring-1 ring-inset ring-ink/40" /> {t("Best week", "အကောင်းဆုံးအပတ်")}
              </span>
            </div>

            {/* Detail for the selected week */}
            <div className="mt-4 border-t border-hair pt-3 text-sm">
              <p className="font-bold text-ink">
                {t(`Sown around ${col.label}`, `${col.label} ဝန်းကျင် စိုက်လျှင်`)}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted">
                {(["good", "watch", "alert"] as const).map((r) => (
                  <span key={r} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${CELL[r]}`} />
                    <span className="font-semibold text-ink tabular-nums">{col[r]}</span> {t(RISK_WORDS[r].en, RISK_WORDS[r].my)}
                  </span>
                ))}
              </p>
              {pickedYear != null && data.years.find((y) => y.year === pickedYear) && (
                <p className="mt-2 text-ink">
                  <span className="font-semibold">{pickedYear}:</span>{" "}
                  {reason(data.years.find((y) => y.year === pickedYear)!.cells[sel].reason)}
                </p>
              )}
              {col.bad.length > 0 && (
                <p className="mt-2 text-muted">
                  {t("Bad years:", "ဆိုးခဲ့သောနှစ်များ:")}{" "}
                  {col.bad.map((b, k) => (
                    <span key={b.year}>
                      <span className="font-semibold text-ink">{b.year}</span> ({reason(b.reason).toLowerCase()})
                      {k < col.bad.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
