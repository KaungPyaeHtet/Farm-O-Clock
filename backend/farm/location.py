"""Everything the API computes for one pinned location.

- scenario(): the 20-season Season Replay (engine v1.1), optionally with the
  what-if sliders applied as a delta-change (rain × k, max temperature + Δ°C).
- outlook():  this year's chance of a high-risk season per sowing week, from
  the logistic risk model, using NASA conditions as of the latest data day.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from farm import replay as R
from farm import risk_model as RM
from farm.power import fetch_daily
from farm.seasonal import monthly_anomalies, window_delta

BASE_YEARS = 20
MAX_LEAD_DAYS = 30  # model was trained on conditions just before sowing
PRIOR = {"rain30": ("PRECTOTCORR", 30, "sum"), "rain60": ("PRECTOTCORR", 60, "sum"),
         "rain90": ("PRECTOTCORR", 90, "sum"), "root30": ("GWETROOT", 30, "mean"),
         "top30": ("GWETTOP", 30, "mean"), "t2m30": ("T2M", 30, "mean"), "tmax30": ("T2M_MAX", 30, "mean")}


def week_label(doy: int) -> str:
    return (date(2021, 1, 1) + timedelta(days=doy - 1)).strftime("%-d %b")


class Location:
    def __init__(self, lat: float, lng: float, today: date | None = None):
        self.lat, self.lng = lat, lng
        today = today or date.today()
        end = today - timedelta(days=5)  # POWER latency
        start = date(R.CLIM_START_YEAR, 1, 1)  # long record anchors the candidate weeks
        self.df = fetch_daily(lat, lng, start.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
        valid = self.df["PRECTOTCORR"].dropna()
        if len(valid) < 365 * 10:
            raise ValueError("Not enough NASA POWER data for this location")
        self.data_end: pd.Timestamp = valid.index.max()
        self.year = self.data_end.year
        # Same 20 calendar years as the web replay grid (current year included; its sowing windows
        # count only once complete — window_metrics returns None for missing data).
        self.base = list(range(self.year - BASE_YEARS + 1, self.year + 1))
        self.rain, self.tmax = self.df["PRECTOTCORR"], self.df["T2M_MAX"]
        self.weeks = R.candidate_weeks(self.rain, list(range(R.CLIM_START_YEAR, self.year + 1)))
        wins = [R.window_metrics(self.rain, self.tmax, y, d) for y in self.base for d in self.weeks]
        self.th = R.fit_thresholds([w for w in wins if w is not None])

    # ---------------------------------------------------------------- replay
    def scenario(self, rain_pct: float = 0.0, heat_c: float = 0.0) -> dict:
        """Replay the last 20 seasons with rain scaled and heat added.
        Thresholds stay at the real climate, so a drier scenario reads as riskier."""
        rain = self.rain * (1 + rain_pct / 100)
        tmax = self.tmax + heat_c
        weeks_out = []
        for i, d in enumerate(self.weeks):
            counts = {"good": 0, "watch": 0, "alert": 0}
            pd_, pf, ph = [], [], []
            for y in self.base:
                w = R.window_metrics(rain, tmax, y, d)
                if w is None:
                    continue
                p = R.risk_probs_v11(w, self.th)
                counts[R.classify(*p)] += 1
                pd_.append(p[0]); pf.append(p[1]); ph.append(p[2])
            n = sum(counts.values())
            weeks_out.append({
                "label": week_label(d), "start_doy": d, "seasons": n,
                "low_risk": counts["good"], "some_risk": counts["watch"], "high_risk": counts["alert"],
                "drought": round(100 * float(np.mean(pd_))) if pd_ else None,
                "flood": round(100 * float(np.mean(pf))) if pf else None,
                "heat": round(100 * float(np.mean(ph))) if ph else None,
            })
        best = int(np.argmax([w["low_risk"] for w in weeks_out]))
        return {"rain_pct": rain_pct, "heat_c": heat_c, "years": [self.base[0], self.base[-1]],
                "weeks": weeks_out, "best_week_index": best}

    def low_risk_count(self, start_doy: int, rain_pct: float = 0.0, heat_c: float = 0.0) -> tuple[int, int]:
        """(low-risk seasons, seasons) for one sowing week under a rain/heat shift."""
        rain = self.rain * (1 + rain_pct / 100) if rain_pct else self.rain
        tmax = self.tmax + heat_c if heat_c else self.tmax
        good = n = 0
        for y in self.base:
            w = R.window_metrics(rain, tmax, y, start_doy)
            if w is None:
                continue
            n += 1
            good += R.classify(*R.risk_probs_v11(w, self.th)) == "good"
        return good, n

    def seasonal_forecast(self, weeks_out: list[dict]) -> bool:
        """Adds week['forecast'] for sowing weeks the seasonal forecast covers. Returns availability."""
        self.forecast_max_lead = None
        try:
            months = monthly_anomalies(self.lat, self.lng)
        except Exception:
            for w in weeks_out:
                w["forecast"] = None
            return False
        if months:
            # Furthest sowing date the forecast can cover (window_delta needs 60 of the 90 days).
            y, m = map(int, max(months).split("-"))
            last_day = (pd.Timestamp(y, m, 1) + pd.offsets.MonthEnd(1)).date()
            self.forecast_max_lead = max(0, (last_day - self.data_end.date()).days - 59)
        for w in weeks_out:
            start = (self.data_end + pd.Timedelta(days=w["lead_days"])).date()
            delta = window_delta(months, start)
            if delta is None:
                w["forecast"] = None
                continue
            good, n = self.low_risk_count(w["start_doy"], delta["rain_pct"], delta["heat_c"])
            usual, _ = self.low_risk_count(w["start_doy"])
            w["forecast"] = {**delta, "low_risk": good, "usual_low_risk": usual, "seasons": n}
        return True

    # --------------------------------------------------------------- outlook
    def _prior(self, end: pd.Timestamp, col: str, k: int, how: str) -> float:
        x = self.df[col][end - pd.Timedelta(days=k - 1): end]
        return float(getattr(x, how)()) if x.count() >= 0.8 * k else np.nan

    def current_conditions(self) -> dict:
        """Conditions over the last 30/60/90 days as anomalies (z) vs the same
        calendar window in the 20 baseline years."""
        out = {}
        for name, (col, k, how) in PRIOR.items():
            now = self._prior(self.data_end, col, k, how)
            hist = []
            for y in self.base:
                try:
                    e = self.data_end.replace(year=y)
                except ValueError:  # 29 Feb
                    e = self.data_end.replace(year=y, day=28)
                hist.append(self._prior(e, col, k, how))
            h = np.array([v for v in hist if not np.isnan(v)])
            sd = h.std() or 1.0
            out[name] = now
            z = (now - h.mean()) / sd if len(h) >= 5 and not np.isnan(now) else np.nan
            out[name + "_z"] = float(np.clip(z, -4, 4)) if not np.isnan(z) else np.nan  # stable series → huge z
        return out

    def outlook(self, model: dict) -> dict:
        cond = self.current_conditions()
        # site-week climatology per hazard, from the baseline seasons
        clim = {t: [] for t in RM.TARGETS}
        for d in self.weeks:
            hits = {t: [] for t in RM.TARGETS}
            for y in self.base:
                w = R.window_metrics(self.rain, self.tmax, y, d)
                if w is None:
                    continue
                pD, pF, pH = R.risk_probs_v11(w, self.th)
                hits["y_alert"].append(R.classify(pD, pF, pH) == "alert")
                hits["y_drought"].append(pD >= 0.9)
                hits["y_flood"].append(pF >= 0.9)
                hits["y_heat"].append(pH >= 0.9)
            for t in RM.TARGETS:
                clim[t].append(float(np.mean(hits[t])) if hits[t] else np.nan)

        annual = float(self.rain[self.rain.index.year.isin(self.base)].mean() * 365)
        rows = []
        for d in self.weeks:
            rows.append({**cond, "doy_sin": np.sin(2 * np.pi * d / 365), "doy_cos": np.cos(2 * np.pi * d / 365),
                         "abs_lat": abs(self.lat), "annual_rain": annual, "year": self.year})
        X = pd.DataFrame(rows)
        end_doy = self.data_end.day_of_year
        weeks_out = []
        for d in self.weeks:
            lead = (d - end_doy) % 365  # days from latest data to the next such sowing date
            weeks_out.append({"label": week_label(d), "start_doy": d, "lead_days": lead,
                              "in_range": lead <= MAX_LEAD_DAYS})
        for t in RM.TARGETS:
            Xt = X.assign(clim=np.nan_to_num(np.array(clim[t]), nan=model["targets"][t]["base_rate"]))
            p = RM.predict(model, Xt, t)
            key = t.removeprefix("y_").replace("alert", "high_risk")
            for i, w in enumerate(weeks_out):
                w[key] = round(float(p[i]), 3)
                w[key + "_usual"] = None if np.isnan(clim[t][i]) else round(clim[t][i], 3)

        forecast_ok = self.seasonal_forecast(weeks_out)

        def z(name):
            v = cond.get(name + "_z")
            return None if v is None or np.isnan(v) else round(float(v), 2)

        return {
            "data_through": self.data_end.date().isoformat(),
            "conditions": {"rain_90d_anomaly": z("rain90"), "rain_30d_anomaly": z("rain30"),
                           "root_zone_wetness_anomaly": z("root30"), "topsoil_wetness_anomaly": z("top30"),
                           "temperature_anomaly": z("t2m30")},
            "weeks": weeks_out,
            "seasonal_forecast": {"available": forecast_ok, "source": "Open-Meteo Seasonal API (CC BY 4.0)",
                                  "max_lead_days": getattr(self, "forecast_max_lead", None)},
            "max_lead_days": MAX_LEAD_DAYS,
            "model": {"version": model["version"], "trained": model["trained"],
                      "held_out_auc": {k.removeprefix("y_"): v["held_out"]["auc"] for k, v in model["targets"].items()}},
            "note": f"Probabilities use NASA conditions up to data_through and are only meaningful for weeks with "
                    f"in_range=true (sowing within {MAX_LEAD_DAYS} days). Other weeks: use the *_usual rates.",
        }
