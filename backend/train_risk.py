"""Train the production risk model on all years (1987-2025) and save JSON.

  .venv/bin/python train_risk.py

Held-out skill of this exact model type is in reports/README.md (E3: trained
1987-2012, tested 2013-2025). Production refits on everything.
"""

import json
from datetime import date
from pathlib import Path

from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from eval.run_eval import SITES, TEST_Y, TRAIN_Y, Site, e3_dataset
from farm import risk_model as RM


def main():
    sites = [Site(n, *ll) for n, ll in SITES.items()]
    data = e3_dataset(sites)
    data = data[data.year.isin(TRAIN_Y + TEST_Y)].copy()
    held_out = json.loads((Path(__file__).parent / "eval" / "results.json").read_text())["E3"]["targets"]
    models = {}
    for tgt in RM.TARGETS:
        clim = data.groupby(["site", "week"])[tgt].transform("mean")
        X = data.assign(clim=clim)[RM.FEATURES].fillna(0)
        pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5)).fit(X, data[tgt])
        sc, lr = pipe[0], pipe[1]
        models[tgt] = {
            "mean": sc.mean_.tolist(), "scale": sc.scale_.tolist(),
            "coef": lr.coef_[0].tolist(), "intercept": float(lr.intercept_[0]),
            "base_rate": float(data[tgt].mean()),
            "held_out": {k: held_out[tgt]["logistic"][k] for k in ("auc", "bss")},
        }
        print(f"{tgt:10s} base {data[tgt].mean():.2f}  held-out AUC {held_out[tgt]['logistic']['auc']:.2f}")
    RM.save(models, {
        "version": "risk-logreg-v1",
        "trained": date.today().isoformat(),
        "sites": list(SITES),
        "years": [min(TRAIN_Y), max(TEST_Y)],
        "rows": int(len(data)),
        "notes": "Labels = engine v1.1 hazards vs 1986-2005 thresholds; see reports/README.md",
    })
    print("saved", RM.MODEL_PATH)


if __name__ == "__main__":
    main()
