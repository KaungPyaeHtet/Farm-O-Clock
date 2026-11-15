"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CloudSun, CloudRain, Sun, Waves, Thermometer } from "lucide-react";
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

            {/* Detail for the selected week: split bar + bad years grouped by cause */}
            {(() => {
              const total = Math.max(1, col.good + col.watch + col.alert);
              const CAUSES = [
                { key: "Drought stress mid-season", Icon: Sun, en: "Drought mid-season", my: "ရာသီလယ် မိုးခေါင်", tint: "text-clay" },
                { key: "Heavy rain / waterlogging", Icon: Waves, en: "Heavy rain / waterlogging", my: "မိုးသည်း / ရေဝပ်", tint: "text-water" },
                { key: "Heat stress at flowering", Icon: Thermometer, en: "Heat at flowering", my: "ပန်းပွင့်ချိန် အပူ", tint: "text-[#9a6a0c]" },
              ];
              const groups = CAUSES.map((c) => ({ ...c, years: col.bad.filter((b) => b.reason === c.key).map((b) => b.year) })).filter(
                (g) => g.years.length
              );
              const picked = pickedYear != null ? data.years.find((y) => y.year === pickedYear)?.cells[sel] : null;
              return (
                <div className="mt-4 border-t border-hair pt-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-bold text-ink">{t(`If sown around ${col.label}`, `${col.label} ဝန်းကျင် စိုက်ခဲ့လျှင်`)}</p>
                    <p className="text-xs text-muted">{t(`${total} past seasons`, `ယခင် ရာသီ ${total} ခု`)}</p>
                  </div>

                  {/* split bar */}
                  <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded-full">
                    {(["good", "watch", "alert"] as const).map((r) =>
                      col[r] ? <div key={r} className={CELL[r]} style={{ width: `${(col[r] / total) * 100}%` }} /> : null
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {(["good", "watch", "alert"] as const).map((r) => (
                      <div key={r} className="rounded-xl bg-paper/70 py-1.5">
                        <div className="text-lg font-extrabold tabular-nums text-ink">{col[r]}</div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-muted">
                          <span className={`h-2 w-2 rounded-full ${CELL[r]}`} /> {t(RISK_WORDS[r].en, RISK_WORDS[r].my)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* the square the farmer tapped */}
                  {picked && (
                    <p className="mt-3 flex items-center gap-2 rounded-xl border border-ink/15 px-3 py-2 text-sm text-ink">
                      <span className={`h-3 w-3 shrink-0 rounded-[3px] ${CELL[picked.risk]}`} />
                      <span className="font-bold tabular-nums">{pickedYear}</span>
                      <span className="text-muted">{reason(picked.reason)}</span>
                    </p>
                  )}

                  {/* what went wrong, grouped by cause */}
                  {groups.length > 0 && (
                    <div className="mt-3 space-y-2.5">
                      <p className="text-xs font-semibold text-muted">{t("What went wrong in the high-risk years", "အန္တရာယ်များခဲ့သောနှစ်များတွင် ဖြစ်ခဲ့သည်")}</p>
                      {groups.map((g) => (
                        <div key={g.key}>
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <g.Icon className={`h-4 w-4 ${g.tint}`} /> {t(g.en, g.my)}
                            <span className="font-normal text-muted">· {t(`${g.years.length} year${g.years.length > 1 ? "s" : ""}`, `${g.years.length} နှစ်`)}</span>
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5 pl-5">
                            {g.years.map((y) => (
                              <button
                                key={y}
                                onClick={() => setPickedYear(y)}
                                className={`rounded-full px-2 py-0.5 text-xs tabular-nums transition ${
                                  y === pickedYear ? "bg-ink text-white" : "bg-clay/10 text-ink hover:bg-clay/20"
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </Screen>
  );
}
