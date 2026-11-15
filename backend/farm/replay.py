"""Python port of the Season Replay engine (web/src/app/api/replay/route.ts).

Same rules as the TypeScript engine, with one difference: you can give it the
*training* years explicitly. That lets the evaluation rate a held-out year using
only thresholds learned from earlier years.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

GROW_DAYS = 90
WEEKS = 14
MIN_VALID = 70
HOT_C = 35.0
W_D, W_F, W_H = 0.45, 0.30, 0.25


def min_sliding_sum(xs: np.ndarray, win: int) -> float:
    if len(xs) < win:
        return float(xs.sum())
    return float(np.convolve(xs, np.ones(win), "valid").min())


def max_sliding_sum(xs: np.ndarray, win: int) -> float:
    if len(xs) < win:
        return float(xs.sum())
    return float(np.convolve(xs, np.ones(win), "valid").max())


def pct(sorted_arr: np.ndarray, v: float) -> float:
    """Share of sample <= v (matches TS `pct`)."""
    if len(sorted_arr) <= 1:
        return 0.5
    return float(np.searchsorted(sorted_arr, v, side="right")) / len(sorted_arr)


def candidate_weeks(rain: pd.Series, years: list[int]) -> list[int]:
    """Start day-of-year of the 14 candidate sowing weeks, from rainfall climatology."""
    sub = rain[rain.index.year.isin(years)].dropna()
    clim = sub.groupby(sub.index.day_of_year).mean().reindex(range(1, 367), fill_value=0.0).to_numpy()
    c365 = clim[:365]
    sums = np.array([c365[(np.arange(GROW_DAYS) + s) % 365].sum() for s in range(365)])
    best_start = int(np.argmax(sums)) + 1  # first max, like TS
    first = ((best_start - 14 + 365) % 365) or 365
    return [((first - 1 + i * 7) % 365) + 1 for i in range(WEEKS)]


@dataclass
class Window:
    driest30: float
    wettest7: float
    hot_days: float


def window_metrics(rain: pd.Series, tmax: pd.Series, year: int, start_doy: int) -> Window | None:
    start = date(year, 1, 1) + timedelta(days=start_doy - 1)
    idx = pd.date_range(start, periods=GROW_DAYS)
    r = rain.reindex(idx)
    ok = r.notna().to_numpy()
    rv = r.to_numpy()[ok]
    if len(rv) < MIN_VALID:
        return None
    hv = tmax.reindex(idx).to_numpy()[ok]
    hv = np.where(np.isnan(hv), 30.0, hv)
    # rounded to 0.01 mm (POWER precision) so float noise can't break ties; matches the web engine
    return Window(round(min_sliding_sum(rv, 30), 2), round(max_sliding_sum(rv, 7), 2), float((hv >= HOT_C).sum()))


@dataclass
class Thresholds:
    d: np.ndarray
    f: np.ndarray
    h: np.ndarray


def fit_thresholds(windows: list[Window]) -> Thresholds:
    return Thresholds(
        np.sort([w.driest30 for w in windows]),
        np.sort([w.wettest7 for w in windows]),
        np.sort([w.hot_days for w in windows]),
    )


def risk_probs(w: Window, th: Thresholds) -> tuple[float, float, float]:
    return 1 - pct(th.d, w.driest30), pct(th.f, w.wettest7), pct(th.h, w.hot_days)


def classify(pD: float, pF: float, pH: float) -> str:
    combined = W_D * pD + W_F * pF + W_H * pH
    severe = max(pD, pF, pH)
    if severe >= 0.9 or combined >= 0.6:
        return "alert"
    if severe >= 0.72 or combined >= 0.44:
        return "watch"
    return "good"


# ---- v1.1 (current, matches web/src/app/api/replay/route.ts) ----------------
def pct_mid(sorted_arr: np.ndarray, v: float) -> float:
    """Mid-rank percentile: ties share the middle rank instead of the top."""
    if len(sorted_arr) <= 1:
        return 0.5
    lo = np.searchsorted(sorted_arr, v, "left")
    hi = np.searchsorted(sorted_arr, v, "right")
    return float(lo + hi) / 2 / len(sorted_arr)


def risk_probs_v11(w: Window, th: Thresholds) -> tuple[float, float, float]:
    pD = 1 - pct_mid(th.d, w.driest30)
    pF = pct_mid(th.f, w.wettest7)
    pH = 0.0 if w.hot_days == 0 else pct_mid(th.h, w.hot_days)
    return pD, pF, pH


@dataclass
class ReplayResult:
    weeks: list[int]
    grid: dict[tuple[int, int], str]  # (year, week_idx) -> risk
    good_count: list[int]
    n_valid: list[int]
    best_week: int
    thresholds: Thresholds
    week_mean: list[tuple[float, float, float]]  # mean pD, pF, pH per week


def replay(df: pd.DataFrame, years: list[int]) -> ReplayResult:
    rain, tmax = df["PRECTOTCORR"], df["T2M_MAX"]
    weeks = candidate_weeks(rain, years)
    wins = {(y, i): window_metrics(rain, tmax, y, s) for y in years for i, s in enumerate(weeks)}
    th = fit_thresholds([w for w in wins.values() if w is not None])
    grid, good, nval = {}, [0] * WEEKS, [0] * WEEKS
    acc = [[0.0, 0.0, 0.0] for _ in range(WEEKS)]
    for (y, i), w in wins.items():
        if w is None:
            grid[(y, i)] = "unknown"
            continue
        p = risk_probs(w, th)
        grid[(y, i)] = classify(*p)
        nval[i] += 1
        good[i] += grid[(y, i)] == "good"
        for k in range(3):
            acc[i][k] += p[k]
    best = int(np.argmax(good))
    mean = [tuple(a / n if n else 0.0 for a in acc[i]) for i, n in enumerate(nval)]
    return ReplayResult(weeks, grid, good, nval, best, th, mean)


# ---- Mirror of web/src/app/api/replay/route.ts (checked by tests/test_parity.py) -------
CLIM_START_YEAR = 1985
HISTORY_YEARS = 20


def calibrated_chance(seasons: list[tuple[int, bool]], curve: dict) -> float | None:
    """Same as web/src/lib/confidence.ts: recency-weighted share → isotonic curve."""
    if not seasons:
        return None
    latest = max(y for y, _ in seasons)
    w = np.array([0.5 ** ((latest - y) / curve["half_life_years"]) for y, _ in seasons])
    g = np.array([1.0 if ok else 0.0 for _, ok in seasons])
    p = float((w * g).sum() / w.sum())
    x, y = curve["x"], curve["y"]
    if p <= x[0]:
        return y[0]
    if p >= x[-1]:
        return y[-1]
    for i in range(1, len(x)):
        if p <= x[i]:
            t = 1.0 if x[i] == x[i - 1] else (p - x[i - 1]) / (x[i] - x[i - 1])
            return y[i - 1] + t * (y[i] - y[i - 1])
    return y[-1]


def replay_like_web(df: pd.DataFrame, end_year: int, curve: dict) -> dict:
    """Engine v1.1 exactly as the web route computes it (weeks from the 1985+ record,
    grid over the last 20 calendar years ending at end_year)."""
    rain, tmax = df["PRECTOTCORR"], df["T2M_MAX"]
    weeks = candidate_weeks(rain, list(range(CLIM_START_YEAR, end_year + 1)))
    years = list(range(end_year - HISTORY_YEARS + 1, end_year + 1))
    wins = {(y, i): window_metrics(rain, tmax, y, d) for y in years for i, d in enumerate(weeks)}
    th = fit_thresholds([w for w in wins.values() if w is not None])
    grid, agg = {}, [{"d": 0.0, "f": 0.0, "h": 0.0, "n": 0, "good": 0, "seasons": []} for _ in weeks]
    for (y, i), w in wins.items():
        if w is None:
            grid[(y, i)] = "unknown"
            continue
        pD, pF, pH = risk_probs_v11(w, th)
        r = classify(pD, pF, pH)
        grid[(y, i)] = r
        a = agg[i]
        a["d"] += pD; a["f"] += pF; a["h"] += pH; a["n"] += 1
        a["good"] += r == "good"
        a["seasons"].append((y, r == "good"))
    week_agg = []
    for a in agg:
        n = a["n"] or 1
        d, f, h = a["d"] / n, a["f"] / n, a["h"] / n
        comb = W_D * d + W_F * f + W_H * h
        week_agg.append({"drought": round(100 * d), "flood": round(100 * f), "heat": round(100 * h),
                         "risk": "alert" if comb >= 0.55 else "watch" if comb >= 0.42 else "good",
                         "goodCount": a["good"], "chance": calibrated_chance(a["seasons"], curve)})
    best = int(np.argmax([a["good"] for a in agg]))
    return {"weeks": weeks, "years": years, "grid": grid, "weekAgg": week_agg, "bestWeekIndex": best}
