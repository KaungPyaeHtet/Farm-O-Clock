"""E6: More sites + spatial hold-out.

  .venv/bin/python -m eval.scale_eval

- 73 cropland points (the 9 original + 64 more on 5 continents; rural farmland, not cities).
- E6a sowing-window skill (rolling origin 2006-2025, engine as shipped: v1.1 + long anchor),
  by climate band.
- E6b risk model with a SPATIAL hold-out: 5-fold by site — the model never sees the test
  sites during training (tests the "works anywhere on Earth" claim). Train years 1987-2012,
  test years 2013-2025, same features as E3.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from eval.improvements import FIRST_YEAR, fit
from eval.run_eval import FEATURES, SITES, TEST_Y, TEST_YEARS, TRAIN_Y, Site, e3_dataset
from farm import replay as R

OUT = Path(__file__).resolve().parent

EXTRA = {
    # Asia
    "Central Plain, TH": (15.2, 100.2), "Mekong Delta, VN": (10.3, 105.6), "Red River Delta, VN": (20.6, 106.2),
    "Rangpur, BD": (25.8, 89.2), "Mymensingh, BD": (24.9, 90.6), "Terai, NP": (27.0, 85.0),
    "Haryana, IN": (29.3, 76.4), "Uttar Pradesh, IN": (26.5, 82.3), "Vidarbha, IN": (20.5, 78.5),
    "Krishna delta, IN": (16.3, 81.0), "Thanjavur, IN": (10.8, 79.2), "Punjab, PK": (30.5, 73.0),
    "Dry zone, LK": (8.3, 80.5), "Karawang, ID": (-6.3, 107.4), "Central Luzon, PH": (15.5, 120.8),
    "North China Plain, CN": (37.5, 115.5), "Heilongjiang, CN": (46.5, 126.5), "Sichuan, CN": (30.2, 105.2),
    "Battambang, KH": (13.0, 103.0), "Bago, MM": (17.7, 96.1), "Magway, MM": (20.2, 94.9),
    "Khuzestan, IR": (31.8, 48.8), "Konya, TR": (37.9, 32.9), "North Kazakhstan, KZ": (52.5, 70.5),
    # Africa
    "Northern Region, GH": (9.5, -0.9), "Kano, NG": (12.2, 8.3), "Segou, ML": (13.4, -6.2),
    "Kaolack, SN": (14.1, -16.0), "Centre-Nord, BF": (12.8, -1.0), "Singida, TZ": (-5.9, 35.0),
    "Central, MW": (-13.0, 33.5), "Central, ZM": (-14.5, 28.3), "Mashonaland, ZW": (-18.0, 31.5),
    "Free State, ZA": (-27.5, 27.0), "Amhara, ET": (11.0, 38.0), "Eastern, UG": (1.0, 33.5),
    "Gezira, SD": (14.4, 33.2), "Nile Delta, EG": (30.8, 31.0), "Sais, MA": (34.1, -5.1),
    "Highlands, MG": (-19.9, 47.0), "Centre, CI": (7.5, -5.6), "North, CM": (9.8, 13.9),
    # Americas
    "Kansas, US": (38.5, -98.5), "Nebraska, US": (41.2, -98.0), "Illinois, US": (40.2, -88.5),
    "North Dakota, US": (47.5, -98.5), "Central Valley, US": (36.6, -120.2), "High Plains, US": (33.8, -102.2),
    "Saskatchewan, CA": (51.5, -106.5), "Bajio, MX": (20.4, -101.5), "Sinaloa, MX": (25.5, -108.3),
    "Parana, BR": (-24.5, -52.5), "Goias, BR": (-17.5, -50.0), "Rio Grande do Sul, BR": (-28.5, -54.0),
    "Pampas, AR": (-34.0, -61.5), "Cordoba, AR": (-32.5, -63.0), "Soriano, UY": (-33.0, -57.0),
    "Llanos, CO": (4.3, -72.0), "Santa Cruz, BO": (-17.3, -62.5),
    # Europe / Oceania
    "Central, UA": (48.0, 33.0), "Beauce, FR": (48.2, 1.6), "Castilla, ES": (41.9, -4.3),
    "Krasnodar, RU": (45.4, 39.5), "Wheatbelt, AU": (-31.3, 117.3), "Riverina, AU": (-34.5, 147.0),
}


def band(lat: float) -> str:
    a = abs(lat)
    return "tropics (<23.5°)" if a < 23.5 else "subtropics (23.5-35°)" if a < 35 else "temperate (>35°)"


def main():
    allsites = {**SITES, **EXTRA}
    sites = []
    for n, ll in allsites.items():
        try:
            sites.append(Site(n, *ll))
        except Exception as e:  # POWER hiccup: skip the site, report it
            print("skip", n, e)
    print(len(sites), "sites loaded")

    # ---- E6a sowing-window skill by climate band
    rows = []
    for s in sites:
        for Y in TEST_YEARS:
            train = list(range(Y - 20, Y))
            weeks, th, good, n = fit(s, train, list(range(FIRST_YEAR, Y)))
            cls = {}
            for i, d in enumerate(weeks):
                w = s.win(Y, d)
                if w is not None:
                    cls[i] = R.classify(*R.risk_probs_v11(w, th))
            b = int(np.argmax(good))
            if b not in cls:
                continue
            rows.append({"site": s.name, "band": band(s.lat), "rec_good": cls[b] == "good", "rec_alert": cls[b] == "alert",
                         "rand_good": np.mean([c == "good" for c in cls.values()]),
                         "rand_alert": np.mean([c == "alert" for c in cls.values()])})
    e1 = pd.DataFrame(rows)
    by_band = e1.groupby("band")[["rec_good", "rand_good", "rec_alert", "rand_alert"]].mean().round(3)
    by_band["sites"] = e1.groupby("band").site.nunique()
    site_gain = e1.groupby("site").apply(lambda g: g.rec_good.mean() - g.rand_good.mean())
    e6a = {"n_sites": int(e1.site.nunique()), "n_site_years": len(e1),
           "overall": e1[["rec_good", "rand_good", "rec_alert", "rand_alert"]].mean().round(3).to_dict(),
           "by_band": by_band.to_dict("index"),
           "share_of_sites_where_recommendation_beats_random": round(float((site_gain > 0).mean()), 3)}
    print("E6a", json.dumps(e6a, indent=1, default=float))

    # ---- E6b spatial hold-out for the logistic risk model
    data = e3_dataset(sites)
    data = data[data.year.isin(TRAIN_Y + TEST_Y)].copy()
    res = {}
    for tgt in ["y_alert", "y_drought", "y_flood", "y_heat"]:
        clim_tr = data[data.year.isin(TRAIN_Y)].groupby(["site", "week"])[tgt].mean()
        data["clim"] = data.set_index(["site", "week"]).index.map(clim_tr).to_numpy(dtype=float)
        data["clim"] = data["clim"].fillna(data[tgt].mean())
        preds = np.full(len(data), np.nan)
        for tr_idx, te_idx in GroupKFold(n_splits=5).split(data, groups=data.site):
            tr = data.iloc[tr_idx]
            tr = tr[tr.year.isin(TRAIN_Y)]
            m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, C=0.5))
            m.fit(tr[FEATURES + ["clim"]].fillna(0), tr[tgt])
            preds[te_idx] = m.predict_proba(data.iloc[te_idx][FEATURES + ["clim"]].fillna(0))[:, 1]
        test = data.year.isin(TEST_Y).to_numpy()
        y, p, c = data[tgt].to_numpy()[test], preds[test], data["clim"].to_numpy()[test]
        bc = brier_score_loss(y, c)
        res[tgt] = {"base_rate": round(float(y.mean()), 3), "auc_model": round(float(roc_auc_score(y, p)), 3),
                    "auc_climatology": round(float(roc_auc_score(y, c)), 3),
                    "bss_vs_climatology": round(float(1 - brier_score_loss(y, p) / bc), 3), "n_test": int(test.sum())}
    e6b = {"n_sites": int(data.site.nunique()), "folds": 5, "targets": res}
    print("E6b", json.dumps(e6b, indent=1))
    (OUT / "scale_eval.json").write_text(json.dumps({"E6a": e6a, "E6b": e6b}, indent=2, default=float))


if __name__ == "__main__":
    main()
