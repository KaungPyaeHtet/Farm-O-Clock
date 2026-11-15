"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import type { LatLng, ScenarioData } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { fetchJson } from "@/lib/fetchJson";

// Under the what-if sliders: re-runs the past 20 seasons with the slider
// changes (Python /v1/scenario) and says what that does to the best sowing
// week. Renders nothing if the model backend is not available.

export default function ScenarioNote({ pin, rain, heat }: { pin: LatLng; rain: number; heat: number }) {
  const { t } = useLang();
  const rainPct = Math.round(rain - 50); // slider 0..100 → -50..+50 %
  const heatC = Math.round(((heat - 50) / 50) * 6 * 10) / 10; // → -6..+6 °C (same as slider label)
  const [res, setRes] = useState<{ key: string; base: ScenarioData; now: ScenarioData } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${rainPct}:${heatC}`;

  useEffect(() => {
    let active = true;
    const url = (r: number, h: number) => `/api/scenario?lat=${pin.lat}&lng=${pin.lng}&rain=${r}&heat=${h}`;
    const id = setTimeout(() => {
      Promise.all([fetchJson<ScenarioData>(url(0, 0)), fetchJson<ScenarioData>(url(rainPct, heatC))])
        .then(([base, now]) => active && setRes({ key, base, now }))
        .catch(() => active && setFailed(true));
    }, 400);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [pin.lat, pin.lng, rainPct, heatC, key]);

  if (failed) return null;
  const loading = !res || res.key !== key;
  if (!res)
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("Checking sowing dates…", "စိုက်ရက်များ စစ်ဆေးနေသည်…")}
      </p>
    );

  const bw = res.now.weeks[res.now.best_week_index];
  const baseBest = res.base.weeks[res.base.best_week_index];
  const unchanged = rainPct === 0 && heatC === 0;
  const moved = bw.label !== baseBest.label;

  return (
    <div className={`mt-4 flex items-start gap-2 rounded-xl bg-grass/10 p-3 text-sm text-ink transition ${loading ? "opacity-50" : ""}`}>
      <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-grass" />
      <p>
        {unchanged
          ? t(
              `Best sowing week: around ${bw.label} (${bw.low_risk} of ${bw.seasons} past seasons low risk).`,
              `အကောင်းဆုံး စိုက်ချိန်: ${bw.label} ဝန်းကျင် (ယခင် ${bw.seasons} ရာသီအနက် ${bw.low_risk} ခု အန္တရာယ်နည်း)။`
            )
          : t(
              `In this kind of season, the best week ${moved ? `moves to ${bw.label}` : `stays around ${bw.label}`}: ${bw.low_risk} of ${bw.seasons} seasons low risk (normally ${baseBest.low_risk}).`,
              `ဤကဲ့သို့ ရာသီတွင် အကောင်းဆုံးအပတ် ${moved ? `${bw.label} သို့ ပြောင်း` : `${bw.label} ဝန်းကျင်`}: ${bw.seasons} ရာသီအနက် ${bw.low_risk} ခု အန္တရာယ်နည်း (ပုံမှန် ${baseBest.low_risk})။`
            )}
      </p>
    </div>
  );
}
