"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, MousePointerClick } from "lucide-react";
import type { LatLng, ReplayData, ReplayRisk } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { card } from "@/lib/ui";

const CELL: Record<ReplayRisk, string> = {
  good: "bg-grass",
  watch: "bg-sun",
  alert: "bg-clay",
  unknown: "bg-hair",
};

type Selected = {
  year: number;
  weekLabel: string;
  reason: string;
  risk: ReplayRisk;
} | null;

export default function SeasonReplay({ pin }: { pin: LatLng }) {
  const { t } = useLang();
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Selected>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSel(null);
    fetch(`/api/replay?lat=${pin.lat}&lng=${pin.lng}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<ReplayData>;
      })
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  const goodInBest =
    data?.years.filter((y) => y.cells[data.bestWeekIndex]?.risk === "good")
      .length ?? 0;

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-lg font-extrabold text-ink">
        {t("Season Replay", "ရာသီ ပြန်ကစား")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t(
          "20 years replayed — every past season, every sowing week.",
          "၂၀ နှစ် ပြန်ကစား — ရာသီတိုင်း၊ စိုက်ချိန်တိုင်း။"
        )}
      </p>

      {loading && (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-hair/60" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-clay/25 bg-clay/10 p-4 text-sm text-clay">
          {t("Couldn’t build replay", "ပြန်ကစား မတည်ဆောက်နိုင်ပါ")}: {error}
        </div>
      )}

      {data && (
        <>
          {/* Recommendation summary (counts, not percentages) */}
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-grass/25 bg-grass/10 p-3">
            <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-grass" />
            <p className="text-sm text-ink">
              {t(
                `Best sowing window: around ${data.weeks[data.bestWeekIndex].label}. Sown then, ${goodInBest} of the last ${data.years.length} seasons were favourable.`,
                `အကောင်းဆုံး စိုက်ချိန်: ${data.weeks[data.bestWeekIndex].label} ဝန်းကျင်။ ထိုအချိန် စိုက်လျှင် လွန်ခဲ့သော ရာသီ ${data.years.length} ခုအနက် ${goodInBest} ခု အဆင်ပြေခဲ့သည်။`
              )}
            </p>
          </div>

          {/* The grid */}
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-max">
              {data.years.map((yr, ri) => (
                <div
                  key={yr.year}
                  className="replay-row flex items-center gap-[3px]"
                  style={{ animationDelay: `${ri * 55}ms` }}
                >
                  <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted">
                    {yr.year}
                  </span>
                  {yr.cells.map((c, ci) => {
                    const isBest = ci === data.bestWeekIndex;
                    const isSel = sel?.year === yr.year && sel?.weekLabel === data.weeks[ci].label;
                    return (
                      <button
                        key={ci}
                        onClick={() =>
                          setSel({
                            year: yr.year,
                            weekLabel: data.weeks[ci].label,
                            reason: c.reason,
                            risk: c.risk,
                          })
                        }
                        title={`${yr.year} · ${data.weeks[ci].label}`}
                        className={`my-[1px] h-4 w-4 shrink-0 rounded-[3px] ${CELL[c.risk]} ${
                          isBest ? "ring-1 ring-inset ring-ink/40" : ""
                        } ${isSel ? "outline outline-2 outline-ink" : ""}`}
                      />
                    );
                  })}
                </div>
              ))}
              {/* Axis note */}
              <div className="mt-1.5 flex items-center gap-[3px]">
                <span className="w-9 shrink-0" />
                <span className="text-[10px] text-muted">
                  {data.weeks[0].label}
                </span>
                <span className="flex-1" />
                <span className="text-[10px] text-muted">
                  {data.weeks[data.weeks.length - 1].label}
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-grass" /> {t("Favourable", "အဆင်ပြေ")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-sun" /> {t("Risky", "အန္တရာယ်နည်း")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] bg-clay" /> {t("Bad", "ဆိုး")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] ring-1 ring-inset ring-ink/40" /> {t("best week", "အကောင်းဆုံးအပတ်")}
            </span>
          </div>

          {/* Tap detail */}
          <div className={`mt-3 ${card} p-3`}>
            {sel ? (
              <div className="flex items-start gap-2 text-sm">
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${CELL[sel.risk]}`} />
                <p className="text-ink">
                  <span className="font-bold">{sel.year}</span>:{" "}
                  {t("sown", "စိုက်")} {sel.weekLabel} →{" "}
                  <span className="text-muted">{sel.reason}</span>
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <MousePointerClick className="h-4 w-4" />
                {t("Tap any square to replay that season.", "ရာသီ ပြန်ကြည့်ရန် အကွက်တစ်ခုကို တို့ပါ။")}
              </p>
            )}
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted/70">
            {t("Source", "ရင်းမြစ်")}: {data.source}
          </p>
        </>
      )}
    </div>
  );
}
