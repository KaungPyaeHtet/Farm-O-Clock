"""E5: Do the engine's risk ratings line up with real harvests?

  .venv/bin/python -m eval.yield_check

Ground truth: FAOSTAT national yields (eval/fao_yields.csv, extracted from the public
FAOSTAT bulk file), detrended per country-crop (% above/below the linear trend).
For each site and year 2006-2024 (rolling origin, engine v1.1 + long-climatology anchor):
  - season stress  = mean combined drought/flood/heat stress over the 14 sowing weeks
  - recommended    = outcome of the recommended week (low / some / high risk)
Caveat: one point vs a national average is coarse; this tests direction, not precision.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from eval.improvements import FIRST_YEAR, fit
from eval.run_eval import SITES, Site
from farm import replay as R

OUT = Path(__file__).resolve().parent
MAP = {  # site -> (FAO country, FAO item)
    "Ayeyarwady delta, MM (rice)": ("Myanmar", "Rice"),
    "Punjab, IN (wheat/rice)": ("India", "Rice"),
    "Iowa, US (maize/soy)": ("United States of America", "Maize (corn)"),
    "Western Kenya (maize)": ("Kenya", "Maize (corn)"),
    "Mato Grosso, BR (soy)": ("Brazil", "Soya beans"),
    "Maradi, Niger (millet)": ("Niger", "Millet"),
    "Central Ethiopia (teff)": ("Ethiopia", "Maize (corn)"),
}
YEARS = list(range(2006, 2025))


def detrended(fao: pd.DataFrame, country: str, item: str) -> pd.Series:
    d = fao[(fao.country == country) & (fao.item == item)].set_index("year")["yield"].sort_index()
    trend = np.polyval(np.polyfit(d.index, d.values, 1), d.index)
    return pd.Series(100 * (d.values - trend) / trend, index=d.index)


def spearman(a, b) -> float:
    return float(pd.Series(a).corr(pd.Series(b), method="spearman"))


def main():
    fao = pd.read_csv(OUT / "fao_yields.csv")
    rows = []
    for name, (country, item) in MAP.items():
        s = Site(name, *SITES[name])
        anom = detrended(fao, country, item)
        for Y in YEARS:
            train = list(range(Y - 20, Y))
            weeks, th, good, n = fit(s, train, list(range(FIRST_YEAR, Y)))
            stresses, best = [], int(np.argmax(good))
            rec = None
            for i, d in enumerate(weeks):
                w = s.win(Y, d)
                if w is None:
                    continue
                p = R.risk_probs_v11(w, th)
                stresses.append(R.W_D * p[0] + R.W_F * p[1] + R.W_H * p[2])
                if i == best:
                    rec = R.classify(*p)
            if not stresses:
                continue
            # harvest year = year the growing window ends (southern-hemisphere seasons cross new year)
            harvest = (date(Y, 1, 1) + timedelta(days=weeks[best] - 1 + R.GROW_DAYS)).year
            if harvest in anom.index:
                rows.append({"site": name, "country": country, "item": item, "year": Y, "harvest_year": harvest,
                             "stress": float(np.mean(stresses)), "recommended": rec, "yield_anom_pct": float(anom[harvest])})
    df = pd.DataFrame(rows)
    per_site = {}
    for name, g in df.groupby("site"):
        per_site[name] = {"n": len(g), "spearman_stress_vs_yield": round(spearman(g.stress, g.yield_anom_pct), 3),
                          "worst_stress_year": int(g.loc[g.stress.idxmax(), "harvest_year"]),
                          "yield_anom_that_year_pct": round(float(g.loc[g.stress.idxmax(), "yield_anom_pct"]), 1)}
    # pooled: rank within site so sites with different variability are comparable
    df["stress_rank"] = df.groupby("site").stress.rank(pct=True)
    df["yield_rank"] = df.groupby("site").yield_anom_pct.rank(pct=True)
    by_class = df.groupby("recommended").yield_anom_pct.agg(["mean", "count"]).round(2).to_dict("index")
    top = df[df.stress_rank >= 0.8].yield_anom_pct.mean()
    rest = df[df.stress_rank < 0.8].yield_anom_pct.mean()
    res = {
        "n_site_years": len(df),
        "pooled_spearman_stress_vs_yield": round(spearman(df.stress_rank, df.yield_rank), 3),
        "yield_anom_pct_in_top20pct_stress_years": round(float(top), 2),
        "yield_anom_pct_in_other_years": round(float(rest), 2),
        "yield_anom_by_recommended_week_outcome": by_class,
        "per_site": per_site,
        "source": "FAOSTAT Production_Crops_Livestock (Dec 2025 bulk), national yields, linear-detrended",
    }
    (OUT / "yield_check.json").write_text(json.dumps(res, indent=2))
    df.to_csv(OUT / "yield_check_rows.csv", index=False)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
