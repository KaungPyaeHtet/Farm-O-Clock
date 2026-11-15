"""E4: model improvements, tested on the same rolling-origin backtest as E1.

  .venv/bin/python -m eval.improvements

E4a  Confidence calibration: raw "k of n seasons" vs shrinkage vs recency-weighting vs isotonic.
     Fitted on 2006-2015, tested on 2016-2025. Exports models/confidence_curve.json for the app.
E4b  Sowing-window stability: does the recommended week jump between years? Compares
     A current | B smoothed best week (3-week average) | C weeks anchored to a long (all-years-so-far)
     climatology | D = B + C.
Writes eval/improvements.json (used by reports + the app's constants).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.metrics import brier_score_loss

from eval.run_eval import SITES, TEST_YEARS, Site
from farm import replay as R

OUT = Path(__file__).resolve().parent
FIRST_YEAR = 1985
HALF_LIFE = 5


def fit(s: Site, train: list[int], clim_years: list[int]):
    weeks = R.candidate_weeks(s.rain, clim_years)
    wins = [s.win(y, d) for y in train for d in weeks]
    th = R.fit_thresholds([w for w in wins if w is not None])
    good = np.zeros(R.WEEKS)
    n = np.zeros(R.WEEKS)
    for y in train:
        for i, d in enumerate(weeks):
            w = s.win(y, d)
            if w is None:
                continue
            n[i] += 1
            good[i] += R.classify(*R.risk_probs_v11(w, th)) == "good"
    return weeks, th, good, n


def smooth_best(good: np.ndarray) -> int:
    g = np.convolve(np.pad(good, 1, mode="edge"), np.ones(3) / 3, "valid")
    return int(np.argmax(g))


def circ_days(a: int, b: int) -> int:
    d = abs(a - b) % 365
    return min(d, 365 - d)


def main():
    sites = [Site(n, *ll) for n, ll in SITES.items()]
    cal_rows = []  # (year, [(train_year, good)], site_rate, observed) — variant C weeks
    variants = {k: {"good": [], "alert": [], "doys": {}} for k in "ABCD"}
    for s in sites:
        for Y in TEST_YEARS:
            train = list(range(Y - 20, Y))
            for v in "ABCD":
                clim = list(range(FIRST_YEAR, Y)) if v in "CD" else train
                weeks, th, good, n = fit(s, train, clim)
                best = smooth_best(good) if v in "BD" else int(np.argmax(good))
                w = s.win(Y, weeks[best])
                if w is None:
                    continue
                c = R.classify(*R.risk_probs_v11(w, th))
                variants[v]["good"].append(c == "good")
                variants[v]["alert"].append(c == "alert")
                variants[v]["doys"].setdefault(s.name, []).append(weeks[best])
                if v == "C":
                    cls = {}
                    for y in train:
                        for d in weeks:
                            wy = s.win(y, d)
                            if wy is not None:
                                cls[(y, d)] = R.classify(*R.risk_probs_v11(wy, th)) == "good"
                    m_site = float(np.mean(list(cls.values())))
                    for d in weeks:
                        wy = s.win(Y, d)
                        if wy is None:
                            continue
                        hist = [(y, cls[(y, d)]) for y in train if (y, d) in cls]
                        cal_rows.append((Y, hist, m_site, float(R.classify(*R.risk_probs_v11(wy, th)) == "good")))

    # ---- E4a calibration: raw count vs shrinkage vs recency weighting vs isotonic
    from sklearn.isotonic import IsotonicRegression

    Yv = np.array([r[0] for r in cal_rows]); o = np.array([r[3] for r in cal_rows]); m = np.array([r[2] for r in cal_rows])

    def p_rec(h):
        out = []
        for Yr, hist, _, _ in cal_rows:
            w = np.array([0.5 ** ((Yr - 1 - y) / h) for y, _ in hist]); g = np.array([gg for _, gg in hist], float)
            out.append((w * g).sum() / w.sum())
        return np.array(out)

    fit_m, test_m = Yv <= 2015, Yv > 2015
    raw, rec = p_rec(1e9), p_rec(HALF_LIFE)
    kk = np.array([sum(g for _, g in r[1]) for r in cal_rows]); nn = np.array([len(r[1]) for r in cal_rows])
    iso = lambda x: IsotonicRegression(out_of_bounds="clip", y_min=0.02, y_max=0.98).fit(x[fit_m], o[fit_m])
    preds = {"raw k/n": raw, "shrinkage s=5": (kk + 5 * m) / (nn + 5), f"recency (half-life {HALF_LIFE}y)": rec,
             "isotonic(raw)": iso(raw).predict(raw), "recency + isotonic (shipped)": iso(rec).predict(rec)}
    bc = brier_score_loss(o[test_m], m[test_m])

    def reliability(p):
        out = []
        for lo in np.arange(0, 1, 0.2):
            msk = test_m & (p >= lo) & (p < lo + 0.2 + (lo >= 0.8) * 0.01)
            if msk.sum() >= 20:
                out.append({"bin": f"{lo:.1f}-{lo + 0.2:.1f}", "n": int(msk.sum()),
                            "mean_pred": float(p[msk].mean()), "observed": float(o[msk].mean())})
        return out

    e4a = {"test_bss_vs_climatology": {k: 1 - brier_score_loss(o[test_m], p[test_m]) / bc for k, p in preds.items()},
           "reliability": {k: reliability(p) for k, p in preds.items() if k in ("raw k/n", "recency + isotonic (shipped)")}}
    # Production curve: refit on ALL test years, export knots for the app.
    final = IsotonicRegression(out_of_bounds="clip", y_min=0.02, y_max=0.98).fit(rec, o)
    curve = {"half_life_years": HALF_LIFE, "x": [round(float(v), 4) for v in final.X_thresholds_],
             "y": [round(float(v), 4) for v in final.y_thresholds_],
             "note": "p = interp(recency-weighted share of low-risk seasons, x, y). From eval/improvements.py E4a."}
    (OUT.parent / "models" / "confidence_curve.json").write_text(json.dumps(curve, indent=1))

    # ---- E4b stability
    e4b = {}
    for v, r in variants.items():
        shifts = [circ_days(a_, b_) for doys in r["doys"].values() for a_, b_ in zip(doys, doys[1:])]
        e4b[v] = {"p_good": float(np.mean(r["good"])), "p_alert": float(np.mean(r["alert"])),
                  "mean_shift_days": float(np.mean(shifts)), "jumps_over_4_weeks": int(sum(x > 28 for x in shifts)),
                  "year_pairs": len(shifts)}
    names = {"A": "current", "B": "smoothed best week", "C": "long-climatology anchor", "D": "smoothed + long anchor"}
    res = {"E4a_calibration": e4a, "E4b_stability": {f"{k} {names[k]}": v for k, v in e4b.items()}}
    (OUT / "improvements.json").write_text(json.dumps(res, indent=2, default=float))
    print(json.dumps(res, indent=1, default=lambda x: round(float(x), 3)))


if __name__ == "__main__":
    main()
