"""Data-driven partner crops for the rotation plans.

Instead of a fixed table (rice → sorghum everywhere), score every candidate at the pin:
  - low_risk:  share of past seasons that were low-risk for THAT crop's own season length
               (engine v1.1 rules; thresholds from the same base years), sown at the location's best week
  - irrigation: FAO-56 extra water per season (Kc × Hargreaves ET0 − effective rain)
and pick the best by a simple utility. Fast numpy windows (no pandas reindex per window).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

from farm import replay as R
from farm.water import CROPS, effective_rain_daily, et0_hargreaves, kc_curve

DROUGHT_CANDIDATES = ["sorghum", "millet", "chickpea", "pigeon pea", "cowpea"]
LEGUME_CANDIDATES = ["mung bean", "cowpea", "soybean", "lentil", "chickpea", "field pea", "clover (cover)", "sunn hemp (cover)"]

# The old fixed table (web/src/lib/strategies.ts), kept for comparison in eval/partner_eval.py.
TABLE = {
    "water": {"rice": "sorghum", "wheat": "chickpea", "maize": "sorghum", "soybean": "pigeon pea", "cotton": "sorghum",
              "potato": "millet", "vegetables": "cowpea", "sugarcane": "sorghum"},
    "soil": {"rice": "mung bean", "wheat": "lentil", "maize": "soybean", "soybean": "clover (cover)", "cotton": "cowpea",
             "potato": "field pea", "vegetables": "clover (cover)", "sugarcane": "sunn hemp (cover)"},
}


# Optimal mean-temperature range over the crop's season (°C), FAO ECOCROP (rounded).
# Outside it a crop yields poorly whatever the rain: e.g. field pea and lentil are cool-season.
TEMP_OPT = {
    "sorghum": (27, 35), "millet": (25, 35), "chickpea": (15, 29), "pigeon pea": (18, 30), "cowpea": (20, 33),
    "mung bean": (20, 33), "soybean": (20, 33), "lentil": (15, 25), "field pea": (12, 22),
    "clover (cover)": (12, 26), "sunn hemp (cover)": (20, 33),
}


def display(name: str) -> str:
    """'mung bean' → 'Mung bean' (matches web cropLabel keys)."""
    return name[:1].upper() + name[1:]


@dataclass
class Field:
    """Daily series as numpy arrays + a date → index lookup, for fast window slicing."""
    start: pd.Timestamp
    rain: np.ndarray
    tmax: np.ndarray
    et0: np.ndarray
    pe: np.ndarray
    tmean: np.ndarray

    @classmethod
    def from_df(cls, df: pd.DataFrame, lat: float) -> "Field":
        df = df.asfreq("D")
        return cls(df.index[0], df["PRECTOTCORR"].to_numpy(float), df["T2M_MAX"].to_numpy(float),
                   et0_hargreaves(df, lat).to_numpy(float), effective_rain_daily(df["PRECTOTCORR"].fillna(0)).to_numpy(float),
                   df["T2M"].to_numpy(float))

    def idx(self, d: date) -> int:
        return (pd.Timestamp(d) - self.start).days

    def metrics(self, y: int, doy: int, days: int) -> R.Window | None:
        i = self.idx(date(y, 1, 1) + timedelta(days=doy - 1))
        if i < 0 or i + days > len(self.rain):
            return None
        r, h = self.rain[i:i + days], self.tmax[i:i + days]
        ok = ~np.isnan(r)
        if ok.sum() < int(days * 0.78):
            return None
        rv, hv = r[ok], np.where(np.isnan(h[ok]), 30.0, h[ok])
        return R.Window(round(R.min_sliding_sum(rv, 30), 2), round(R.max_sliding_sum(rv, 7), 2), float((hv >= R.HOT_C).sum()))

    def irrigation(self, y: int, doy: int, kc: np.ndarray) -> float | None:
        i = self.idx(date(y, 1, 1) + timedelta(days=doy - 1))
        if i < 0 or i + len(kc) > len(self.et0):
            return None
        e = self.et0[i:i + len(kc)]
        if np.isnan(e).mean() > 0.2:
            return None
        e = np.where(np.isnan(e), np.nanmean(e), e)
        return float(np.clip(kc * e - self.pe[i:i + len(kc)], 0, None).sum())


def crop_stats(f: Field, crop: str, weeks: list[int], week_idx: int, base: list[int], eval_years: list[int] | None = None) -> dict:
    """Low-risk share and irrigation need for `crop` sown at weeks[week_idx].
    Thresholds come from `base` years (all candidate weeks); scored on `eval_years` (default: base)."""
    kc = kc_curve(crop)
    days = min(len(kc), 200)  # risk window: the crop's season (long crops capped)
    wins = [f.metrics(y, d, days) for y in base for d in weeks]
    th = R.fit_thresholds([w for w in wins if w is not None])
    ys = eval_years or base
    d = weeks[week_idx]
    good = n = 0
    for y in ys:
        w = f.metrics(y, d, days)
        if w is None:
            continue
        n += 1
        good += R.classify(*R.risk_probs_v11(w, th)) == "good"
    irr = [x for x in (f.irrigation(y, d, kc) for y in ys) if x is not None]
    temps = []
    for y in ys:
        i = f.idx(date(y, 1, 1) + timedelta(days=d - 1))
        if 0 <= i and i + len(kc) <= len(f.tmean):
            temps.append(np.nanmean(f.tmean[i:i + len(kc)]))
    t = float(np.mean(temps)) if temps else None
    lo, hi = TEMP_OPT.get(crop, (-99, 99))
    off = 0.0 if t is None else max(0.0, lo - t, t - hi)  # °C outside the optimal range
    return {"crop": crop, "low_risk": good / n if n else None, "seasons": n,
            "irrigation_mm": float(np.mean(irr)) if irr else None, "days": len(kc),
            "season_temp_c": None if t is None else round(t, 1), "temp_off_c": round(off, 1)}


def utility(s: dict, kind: str) -> float:
    """Water plan: 100 mm extra water ≈ 10 points of low-risk share. Soil plan: water matters half as much.
    Each °C the season is outside the crop's optimal temperature costs 10 points."""
    if s["low_risk"] is None or s["irrigation_mm"] is None:
        return -1e9
    return 100 * s["low_risk"] - s["irrigation_mm"] / (10 if kind == "water" else 20) - 10 * s.get("temp_off_c", 0)


def pick_partners(f: Field, main: str, weeks: list[int], week_idx: int, base: list[int]) -> dict:
    out = {}
    for kind, cands in (("water", DROUGHT_CANDIDATES), ("soil", LEGUME_CANDIDATES)):
        stats = [crop_stats(f, c, weeks, week_idx, base) for c in cands if c != main and c in CROPS]
        stats.sort(key=lambda s: utility(s, kind), reverse=True)
        pick = stats[0]["crop"]
        if kind == "soil" and pick == out["water"]["pick"] and len(stats) > 1:
            pick = stats[1]["crop"]  # keep the two plans different (next-best legume)
        out[kind] = {"pick": pick, "candidates": stats}
    return out
