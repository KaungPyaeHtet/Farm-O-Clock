"""E7: Is the data-driven partner crop better than the fixed table? (held-out)

  .venv/bin/python -m eval.partner_eval

For each of the 73 sites and main crops rice + maize:
  - pick partners with farm.rotation using ONLY 1996-2015 (best week from the same years)
  - score the pick and the old table crop on 2016-2024 (thresholds still from 1996-2015)
Metrics: low-risk share of the partner's own seasons, FAO-56 irrigation per season, utility.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from eval.improvements import FIRST_YEAR, fit
from eval.run_eval import SITES, Site
from eval.scale_eval import EXTRA
from farm.rotation import DROUGHT_CANDIDATES, LEGUME_CANDIDATES, TABLE, Field, crop_stats, utility

OUT = Path(__file__).resolve().parent
BASE = list(range(1996, 2016))
TEST = list(range(2016, 2025))
MAINS = ["rice", "maize"]


def main():
    rows = []
    for name, (la, ln) in {**SITES, **EXTRA}.items():
        try:
            s = Site(name, la, ln)
        except Exception as e:
            print("skip", name, e)
            continue
        weeks, th, good, n = fit(s, BASE, list(range(FIRST_YEAR, BASE[-1] + 1)))
        wi = int(np.argmax(good))
        f = Field.from_df(s.df, la)
        for main in MAINS:
            for kind, cands in (("water", DROUGHT_CANDIDATES), ("soil", LEGUME_CANDIDATES)):
                train = [crop_stats(f, c, weeks, wi, BASE) for c in cands if c != main]
                pick = max(train, key=lambda x: utility(x, kind))["crop"]
                table = TABLE[kind][main]
                for label, crop in (("data", pick), ("table", table)):
                    st = crop_stats(f, crop, weeks, wi, BASE, eval_years=TEST)
                    rows.append({"site": name, "main": main, "kind": kind, "method": label, "crop": crop,
                                 "low_risk": st["low_risk"], "irrigation_mm": st["irrigation_mm"],
                                 "utility": utility(st, kind), "same": pick == table})
    df = pd.DataFrame(rows).dropna(subset=["low_risk", "irrigation_mm"])
    res = {}
    for kind in ("water", "soil"):
        d = df[df.kind == kind]
        piv = d.pivot_table(index=["site", "main"], columns="method", values=["low_risk", "irrigation_mm", "utility"])
        win = (piv["utility"]["data"] > piv["utility"]["table"]).mean()
        tie = (piv["utility"]["data"] == piv["utility"]["table"]).mean()
        res[kind] = {
            "cases": int(len(piv)),
            "pick_differs_from_table": round(float(1 - d[d.method == "data"].same.mean()), 3),
            "low_risk_data": round(float(piv["low_risk"]["data"].mean()), 3),
            "low_risk_table": round(float(piv["low_risk"]["table"].mean()), 3),
            "irrigation_mm_data": round(float(piv["irrigation_mm"]["data"].mean())),
            "irrigation_mm_table": round(float(piv["irrigation_mm"]["table"].mean())),
            "utility_data": round(float(piv["utility"]["data"].mean()), 2),
            "utility_table": round(float(piv["utility"]["table"].mean()), 2),
            "data_better_share": round(float(win), 3), "tie_share": round(float(tie), 3),
            "most_picked": d[d.method == "data"].crop.value_counts().head(5).to_dict(),
        }
    (OUT / "partner_eval.json").write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
