"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CloudSun, CloudRain, Sun } from "lucide-react";
import type { HistoryData, LatLng, ReplayData, ReplayRisk } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { card, RISK_WORDS } from "@/lib/ui";
import { Screen, ErrorBox } from "@/components/Screen";

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
  const sel = picked ?? data?.bestWeekIndex ?? 0;
  const col = cols[sel];
  const maxN = Math.max(1, ...cols.map((c) => c.n));

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
                  const b = cols[data.bestWeekIndex];
                  const ch = data.weekAgg[data.bestWeekIndex]?.chance;
                  return ch != null
                    ? t(
                        `Best time to sow: around ${b.label}. About ${Math.round(ch * 10)} in 10 seasons go well.`,
                        `အကောင်းဆုံး စိုက်ချိန်: ${b.label} ဝန်းကျင်။ ရာသီ ၁၀ ခုတွင် ${Math.round(ch * 10)} ခုခန့် အဆင်ပြေသည်။`
                      )
                    : t(
                        `Best time to sow: around ${b.label}. ${b.good} of ${b.n} past seasons were low risk.`,
                        `အကောင်းဆုံး စိုက်ချိန်: ${b.label} ဝန်းကျင်။ ယခင် ရာသီ ${b.n} ခုအနက် ${b.good} ခု အန္တရာယ်နည်းခဲ့သည်။`
                      );
                })()}
              </p>
            </div>
          </div>

          <div className={`mt-3 lg:order-1 lg:mt-0 ${card} p-4 lg:p-6`}>
            {/* Phone: year × week grid */}
            <div className="lg:hidden">
              <p className="mb-2 text-xs text-muted">
                {t("Each square = one past year (row) sown in one week (column). Tap one.", "အကွက် = ယခင်နှစ် (တန်း) × စိုက်သည့်အပတ် (တိုင်)။ တို့ကြည့်ပါ။")}
              </p>
              <div className="space-y-[3px]">
                {data.years.map((yr) => (
                  <div key={yr.year} className="flex items-center gap-[3px]">
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted">{yr.year}</span>
                    {yr.cells.map((c, ci) => (
                      <button
                        key={ci}
                        onClick={() => {
                          setPicked(ci);
                          setPickedYear(yr.year);
                        }}
                        aria-label={`${yr.year} ${data.weeks[ci].label}`}
                        className={`h-4 flex-1 rounded-[3px] ${CELL[c.risk]} ${
                          ci === data.bestWeekIndex ? "ring-1 ring-inset ring-ink/40" : ""
                        } ${pickedYear === yr.year && ci === sel ? "outline outline-2 outline-ink" : ""}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center text-[10px] text-muted">
                <span className="w-8 shrink-0" />
                <span className="ml-[3px]">{data.weeks[0].label}</span>
                <span className="flex-1 text-center">{t("← sowing week →", "← စိုက်သည့်အပတ် →")}</span>
                <span>{data.weeks[data.weeks.length - 1].label}</span>
              </div>
            </div>

            {/* Desktop: one column per sowing week */}
            <div className="hidden lg:block">
            <div className="flex items-baseline justify-between text-xs text-muted">
              <span>{t(`Seasons (out of ${maxN})`, `ရာသီ (${maxN} ခုအနက်)`)}</span>
              <span className="hidden sm:inline">{t("Tap a week for details", "အသေးစိတ်အတွက် အပတ်ကို တို့ပါ")}</span>
            </div>

            <div className="relative mt-2 h-52 lg:h-64">
              {/* light guide lines at half and full */}
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-hair" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-hair" />
              <div className="absolute inset-0 flex items-end gap-1 lg:gap-2">
                {cols.map((c, i) => {
                  const isBest = i === data.bestWeekIndex;
                  const isSel = i === sel;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setPicked(i);
                        setPickedYear(null);
                      }}
                      aria-label={`${c.label}: ${c.good} ${RISK_WORDS.good.en}, ${c.watch} ${RISK_WORDS.watch.en}, ${c.alert} ${RISK_WORDS.alert.en}`}
                      aria-pressed={isSel}
                      className={`relative flex h-full flex-1 flex-col justify-end rounded-lg px-0.5 pb-0.5 transition ${
                        isSel ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
                      }`}
                    >
                      {isBest && (
                        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-grass px-1.5 py-px text-[9px] font-bold text-white lg:text-[10px]">
                          {t("Best", "အကောင်းဆုံး")}
                        </span>
                      )}
                      <div className="flex flex-col gap-[2px]" style={{ height: `${(c.n / maxN) * 88}%` }}>
                        {(["alert", "watch", "good"] as const).map((r) =>
                          c[r] ? (
                            <div
                              key={r}
                              className={`w-full ${CELL[r]} ${r === "alert" || (r === "watch" && !c.alert) || (r === "good" && !c.alert && !c.watch) ? "rounded-t-[4px]" : ""}`}
                              style={{ flexGrow: c[r] }}
                            />
                          ) : null
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week labels (every other one on small phones) */}
            <div className="mt-1.5 flex gap-1 lg:gap-2">
              {cols.map((c, i) => (
                <span
                  key={i}
                  className={`flex-1 text-center text-[9px] leading-tight tabular-nums lg:text-[11px] ${
                    i === sel ? "font-bold text-ink" : "text-muted"
                  } ${i % 2 ? "invisible sm:visible" : ""}`}
                >
                  {c.label}
                </span>
              ))}
            </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {(["good", "watch", "alert"] as const).map((r) => (
                <span key={r} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-[3px] ${CELL[r]}`} /> {t(RISK_WORDS[r].en, RISK_WORDS[r].my)}
                </span>
              ))}
              <span className="flex items-center gap-1.5 lg:hidden">
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
