"""Backtest the sowing-window recommendation at ANY location.

  .venv/bin/python -m eval.check_site 16.75 95.65            # Ayeyarwady delta
  .venv/bin/python -m eval.check_site 0.28 34.75 --name Kenya

For each year 2006-2025 it learns from the 20 years before, recommends a week,
then checks how that week actually turned out. Engine v1.1 (same as the app).
"""

import argparse

import numpy as np

from eval.run_eval import TEST_YEARS, Site
from farm import replay as R


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lat", type=float)
    ap.add_argument("lng", type=float)
    ap.add_argument("--name", default="custom site")
    a = ap.parse_args()
    s = Site(a.name, a.lat, a.lng)
    print(f"\n{a.name} ({a.lat}, {a.lng}) — held-out years {TEST_YEARS[0]}–{TEST_YEARS[-1]}\n")
    print(f"{'year':<6}{'recommended':<14}{'outcome':<10}{'low-risk weeks that year'}")
    rec_good, rand_good = [], []
    for Y in TEST_YEARS:
        f = s.fit(list(range(Y - 20, Y)), "v1.1")
        rated = [s.rate(Y, d, f["th"], "v1.1") for d in f["weeks"]]
        valid = [r[0] for r in rated if r]
        if not valid or rated[f["best"]] is None:
            continue
        out = rated[f["best"]][0]
        rec_good.append(out == "good")
        rand_good.append(np.mean([c == "good" for c in valid]))
        d = f["weeks"][f["best"]]
        label = (np.datetime64("2021-01-01") + np.timedelta64(d - 1, "D")).astype(object).strftime("%d %b")
        print(f"{Y:<6}{label:<14}{ {'good': 'LOW', 'watch': 'SOME', 'alert': 'HIGH'}[out]:<10}"
              f"{sum(c == 'good' for c in valid)}/{len(valid)}")
    print(f"\nRecommended week low-risk: {np.mean(rec_good):.0%}   random week: {np.mean(rand_good):.0%}   "
          f"gain: {100 * (np.mean(rec_good) - np.mean(rand_good)):+.0f} pts over {len(rec_good)} years\n")


if __name__ == "__main__":
    main()
