"use client";

import { useEffect, useState } from "react";
import { CloudSun, Loader2 } from "lucide-react";
import type { LatLng, OutlookData, OutlookWeek } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";
import { card } from "@/lib/ui";

// "This year's outlook" for the chosen sowing week. Fed by the Python model
// API via /api/outlook. Renders nothing if the backend is not available.

function nearest(weeks: OutlookWeek[], doy: number): OutlookWeek {
  const dist = (a: number) => Math.min(Math.abs(a - doy), 365 - Math.abs(a - doy));
  return weeks.reduce((b, w) => (dist(w.start_doy) < dist(b.start_doy) ? w : b));
}

const HAZARD = {
  drought: { en: "drought", my: "မိုးခေါင်" },
  flood: { en: "flooding", my: "ရေကြီး" },
  heat: { en: "extreme heat", my: "အပူလွန်ကဲ" },
} as const;

export default function OutlookCard({ pin, startDoy }: { pin: LatLng; startDoy: number }) {
  const { t } = useLang();
  const [data, setData] = useState<OutlookData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchJson<OutlookData>(`/api/outlook?lat=${pin.lat}&lng=${pin.lng}`)
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [pin.lat, pin.lng]);

  if (failed) return null;
  if (!data)
    return (
      <div className={`${card} flex items-center gap-2 p-4 text-sm text-muted`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("Checking this year's conditions…", "ယခုနှစ် အခြေအနေ စစ်ဆေးနေသည်…")}
      </div>
    );

  const w = nearest(data.weeks, startDoy);
  const usualOnly = w.high_risk_usual == null ? null : Math.round(w.high_risk_usual * 100);

  // Beyond 30 days: use the seasonal forecast if it covers this sowing window.
  if (!w.in_range && w.forecast) {
    const f = w.forecast;
    const rainWord =
      f.rain_pct <= -10
        ? t(`${-f.rain_pct}% less rain`, `မိုး ${-f.rain_pct}% နည်း`)
        : f.rain_pct >= 10
          ? t(`${f.rain_pct}% more rain`, `မိုး ${f.rain_pct}% များ`)
          : t("normal rain", "မိုး ပုံမှန်");
    const heatWord =
      f.heat_c >= 0.5
        ? t(`${f.heat_c}°C warmer`, `${f.heat_c}°C ပိုပူ`)
        : f.heat_c <= -0.5
          ? t(`${-f.heat_c}°C cooler`, `${-f.heat_c}°C ပိုအေး`)
          : t("normal temperatures", "အပူချိန် ပုံမှန်");
    const worse = f.low_risk < f.usual_low_risk;
    const better = f.low_risk > f.usual_low_risk;
    return (
      <div className={`${card} p-4 lg:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <CloudSun className="h-4 w-4 text-water" /> {t("Seasonal forecast", "ရာသီ ခန့်မှန်းချက်")}
          </h3>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              worse ? "bg-clay/12 text-clay" : better ? "bg-grass/12 text-grass" : "bg-sun/15 text-[#9a6a0c]"
            }`}
          >
            {worse ? t("Worse than usual", "ပုံမှန်ထက် ဆိုး") : better ? t("Better than usual", "ပုံမှန်ထက် ကောင်း") : t("About usual", "ပုံမှန်ခန့်")}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink">
          {t("Expected:", "မျှော်မှန်း:")} <span className="font-semibold">{rainWord}</span>,{" "}
          <span className="font-semibold">{heatWord}</span>
        </p>
        <p className="mt-1 text-sm text-ink">
          <span className="text-2xl font-extrabold tabular-nums">
            {f.low_risk}/{f.seasons}
          </span>{" "}
          {t("past seasons like this went well", "ဤကဲ့သို့ ယခင်ရာသီ အဆင်ပြေခဲ့")}
          <span className="text-muted"> · {t(`usually ${f.usual_low_risk}`, `ပုံမှန် ${f.usual_low_risk}`)}</span>
        </p>
        <p className="mt-2 text-[11px] text-muted">
          {t("Forecasts months ahead are uncertain.", "လများစွာ ကြိုခန့်မှန်းချက်သည် မသေချာပါ။")} Open-Meteo
        </p>
      </div>
    );
  }

  // Too far ahead and no forecast: today's soil and rain don't tell us much yet.
  if (!w.in_range)
    return (
      <div className={`${card} p-4 lg:p-6`}>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <CloudSun className="h-4 w-4 text-water" /> {t("This year's outlook", "ယခုနှစ် အလားအလာ")}
        </h3>
        <p className="mt-2 text-sm text-ink">
          {t("Too early to tell for this week. Check again closer to sowing.", "ဤအပတ်အတွက် စောလွန်းသေးသည်။ စိုက်ချိန်နီးမှ ပြန်ကြည့်ပါ။")}
        </p>
        {usualOnly != null && (
          <p className="mt-1 text-sm text-muted">
            {t(`In a usual year, ${usualOnly}% of seasons sown this week go badly.`, `ပုံမှန်နှစ်တွင် ဤအပတ် စိုက်လျှင် ${usualOnly}% ဆိုးတတ်သည်။`)}
          </p>
        )}
      </div>
    );

  const pct = Math.round(w.high_risk * 100);
  const usual = w.high_risk_usual == null ? null : Math.round(w.high_risk_usual * 100);
  const diff = usual == null ? 0 : pct - usual;
  const trend =
    diff >= 5
      ? { cls: "bg-clay/12 text-clay", en: "Higher than usual", my: "ပုံမှန်ထက် မြင့်" }
      : diff <= -5
        ? { cls: "bg-grass/12 text-grass", en: "Lower than usual", my: "ပုံမှန်ထက် နိမ့်" }
        : { cls: "bg-sun/15 text-[#9a6a0c]", en: "About usual", my: "ပုံမှန်ခန့်" };

  // Biggest worry = hazard most above its usual level.
  const worry = (["drought", "flood", "heat"] as const)
    .map((h) => ({ h, up: w[h] - (w[`${h}_usual`] ?? w[h]) }))
    .sort((a, b) => b.up - a.up)[0];

  const rain = data.conditions.rain_90d_anomaly;
  const recent =
    rain == null
      ? null
      : rain >= 0.8
        ? t("The last 3 months were wetter than usual here.", "ဤနေရာတွင် လွန်ခဲ့သော ၃ လ ပုံမှန်ထက် စိုခဲ့သည်။")
        : rain <= -0.8
          ? t("The last 3 months were drier than usual here.", "ဤနေရာတွင် လွန်ခဲ့သော ၃ လ ပုံမှန်ထက် ခြောက်ခဲ့သည်။")
          : t("Rain over the last 3 months was about normal here.", "ဤနေရာတွင် လွန်ခဲ့သော ၃ လ မိုး ပုံမှန်ခန့် ဖြစ်သည်။");

  return (
    <div className={`${card} p-4 lg:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <CloudSun className="h-4 w-4 text-water" /> {t("This year's outlook", "ယခုနှစ် အလားအလာ")}
        </h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${trend.cls}`}>{t(trend.en, trend.my)}</span>
      </div>
      <p className="mt-2 text-sm text-ink">
        <span className="text-2xl font-extrabold tabular-nums">{pct}%</span>{" "}
        {t("chance of a bad season if you sow this week", "ဤအပတ် စိုက်လျှင် ရာသီဆိုးနိုင်ခြေ")}
        {usual != null && (
          <span className="text-muted">
            {" "}
            · {t(`usually ${usual}%`, `ပုံမှန် ${usual}%`)}
          </span>
        )}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {recent && <li>• {recent}</li>}
        {worry.up >= 0.05 && (
          <li>
            • {t("Main worry this year:", "ယခုနှစ် အဓိက စိုးရိမ်ရသည်မှာ:")}{" "}
            <span className="font-semibold text-ink">{t(HAZARD[worry.h].en, HAZARD[worry.h].my)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
