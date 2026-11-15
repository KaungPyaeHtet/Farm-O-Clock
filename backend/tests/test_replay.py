"""Unit tests for the replay engine port. Run: .venv/bin/pytest -q"""

import numpy as np
import pandas as pd

from farm.replay import (
    Window, candidate_weeks, classify, fit_thresholds, max_sliding_sum,
    min_sliding_sum, pct, replay, risk_probs, window_metrics,
)


def test_sliding_sums():
    xs = np.array([1, 0, 0, 5, 5, 0], float)
    assert min_sliding_sum(xs, 2) == 0
    assert max_sliding_sum(xs, 2) == 10
    assert min_sliding_sum(xs, 10) == xs.sum()  # shorter than window -> total


def test_pct_matches_ts_semantics():
    s = np.array([1, 2, 3, 4], float)
    assert pct(s, 0) == 0 and pct(s, 2) == 0.5 and pct(s, 9) == 1
    assert pct(np.array([3.0]), 1) == 0.5


def test_classify_thresholds():
    assert classify(0.1, 0.1, 0.1) == "good"
    assert classify(0.95, 0, 0) == "alert"       # one severe hazard wins
    assert classify(0.75, 0, 0) == "watch"
    assert classify(0.7, 0.7, 0.7) == "alert"    # combined >= 0.6


def test_direction_of_risk():
    th = fit_thresholds([Window(d, 50, 2) for d in range(0, 100, 5)])
    dry = risk_probs(Window(0, 50, 2), th)[0]
    wet = risk_probs(Window(95, 50, 2), th)[0]
    assert dry > wet  # less rain in driest spell -> higher drought risk


def _synthetic(years=range(2000, 2010), wet_doy=(150, 240)):
    idx = pd.date_range(f"{years[0]}-01-01", f"{years[-1]}-12-31")
    rng = np.random.default_rng(0)
    doy = idx.day_of_year.to_numpy()
    rain = np.where((doy >= wet_doy[0]) & (doy <= wet_doy[1]), 8.0, 0.5) * rng.uniform(0.5, 1.5, len(idx))
    return pd.DataFrame({"PRECTOTCORR": rain, "T2M_MAX": 30.0}, index=idx)


def test_candidate_weeks_start_before_wet_season():
    df = _synthetic()
    w = candidate_weeks(df["PRECTOTCORR"], list(range(2000, 2010)))
    assert len(w) == 14 and 125 <= w[0] <= 145  # ~2 weeks before doy 150


def test_missing_data_is_unknown():
    df = _synthetic()
    df.loc["2005", "PRECTOTCORR"] = np.nan
    assert window_metrics(df["PRECTOTCORR"], df["T2M_MAX"], 2005, 150) is None
    res = replay(df, list(range(2000, 2010)))
    assert all(res.grid[(2005, i)] == "unknown" for i in range(14))
    assert all(n == 9 for n in res.n_valid)
