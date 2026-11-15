"""Backtests for Farm O'Clock's risk engine and a first ML risk model.

Run from backend/:  .venv/bin/python -m eval.run_eval
Writes eval/results.json and eval/results.md (tables used in eval/REPORT.md).

E0  Engine sanity: in-sample share of good/watch/alert per site (v1 as shipped vs v1.1 tie-fix)
E1  Sowing-window backtest (rolling origin): learn from the 20 seasons before year Y,
    recommend a week, then check how that week actually turned out in Y.
E2  "Dry/Normal/Wet" verdict persistence: does the last-90-day verdict predict the next 90 days?
E3  ML risk forecast: climatology vs logistic regression vs XGBoost, trained 1987-2012, tested 2013-2025.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from farm import replay as R
from farm.power import fetch_daily

OUT = Path(__file__).resolve().parent
START, END = "19850101", "20261031"
TEST_YEARS = list(range(2006, 2026))

SITES = {
    "Ayeyarwady delta, MM (rice)": (16.75, 95.65),
    "Mandalay dry zone, MM": (21.45, 95.40),
    "Punjab, IN (wheat/rice)": (30.90, 75.85),
    "Iowa, US (maize/soy)": (42.00, -93.60),
    "Fallon, Nevada, US (alfalfa)": (39.47, -118.78),
    "Western Kenya (maize)": (0.28, 34.75),
    "Mato Grosso, BR (soy)": (-12.55, -55.72),
    "Maradi, Niger (millet)": (13.50, 7.10),
    "Central Ethiopia (teff)": (8.55, 39.25),
}


# ---------- engine variants -------------------------------------------------
def probs(w: R.Window, th: R.Thresholds, version: str):
    return R.risk_probs(w, th) if version == "v1" else R.risk_probs_v11(w, th)


class Site:
    def __init__(self, name, lat, lng):
        self.name, self.lat, self.lng = name, lat, lng
        self.df = fetch_daily(lat, lng, START, END)
        self.rain, self.tmax = self.df["PRECTOTCORR"], self.df["T2M_MAX"]
        self._w: dict = {}

    def win(self, y, doy):
        k = (y, doy)
        if k not in self._w:
            self._w[k] = R.window_metrics(self.rain, self.tmax, y, doy)
        return self._w[k]

    def fit(self, years, version):
        weeks = R.candidate_weeks(self.rain, years)
        wins = [self.win(y, d) for y in years for d in weeks]
        th = R.fit_thresholds([w for w in wins if w is not None])
        good, nval = np.zeros(R.WEEKS), np.zeros(R.WEEKS)
        alert = np.zeros(R.WEEKS)
        for y in years:
            for i, d in enumerate(weeks):
                w = self.win(y, d)
                if w is None:
                    continue
                c = R.classify(*probs(w, th, version))
                nval[i] += 1
                good[i] += c == "good"
                alert[i] += c == "alert"
        return dict(weeks=weeks, th=th, good=good, nval=nval, alert=alert,
                    best=int(np.argmax(good)))

    def rate(self, y, doy, th, version):
        w = self.win(y, doy)
        if w is None:
            return None
        p = probs(w, th, version)
        return R.classify(*p), p


def sow_date(y, doy):
    return date(y, 1, 1) + timedelta(days=doy - 1)


# ---------- E0 + E1 ---------------------------------------------------------
def e0_e1(sites):
    e0, e1 = [], {"v1": [], "v1.1": []}
    calib = {"v1": [], "v1.1": []}
    for s in sites:
        for v in ("v1", "v1.1"):
            yrs = list(range(2006, 2026))
            f = s.fit(yrs, v)
            n = f["nval"].sum()
            e0.append(dict(site=s.name, version=v, good=f["good"].sum() / n,
                           alert=f["alert"].sum() / n))
        for Y in TEST_YEARS:
            train = list(range(Y - 20, Y))
            for v in ("v1", "v1.1"):
                f = s.fit(train, v)
                rated = [s.rate(Y, d, f["th"], v) for d in f["weeks"]]
                valid = [i for i, r in enumerate(rated) if r]
                if not valid:
                    continue
                cls = {i: rated[i][0] for i in valid}
                stress = {i: R.W_D * rated[i][1][0] + R.W_F * rated[i][1][1] + R.W_H * rated[i][1][2]
                          for i in valid}
                order = sorted(valid, key=lambda i: stress[i])
                rank = lambda i: order.index(i) / max(1, len(order) - 1)
                b = f["best"] if f["best"] in cls else valid[0]
                e1[v].append(dict(
                    site=s.name, year=Y,
                    rec_good=cls[b] == "good", rec_alert=cls[b] == "alert", rec_rank=rank(b),
                    rand_good=np.mean([cls[i] == "good" for i in valid]),
                    rand_alert=np.mean([cls[i] == "alert" for i in valid]),
                    wet_good=cls.get(2) == "good", wet_alert=cls.get(2) == "alert",
                    wet_rank=rank(2) if 2 in cls else 0.5,
                    oracle_good=any(c == "good" for c in cls.values()),
                ))
                clim = f["good"].sum() / f["nval"].sum()
                for i in valid:
                    calib[v].append((f["good"][i] / f["nval"][i], clim, float(cls[i] == "good")))
    return e0, e1, calib


def summarise_e1(rows):
    df = pd.DataFrame(rows)
    return {
        "n_site_years": len(df),
        "recommended": dict(good=df.rec_good.mean(), alert=df.rec_alert.mean(), stress_rank=df.rec_rank.mean()),
        "random_week": dict(good=df.rand_good.mean(), alert=df.rand_alert.mean(), stress_rank=0.5),
        "start_of_wettest_window": dict(good=df.wet_good.mean(), alert=df.wet_alert.mean(), stress_rank=df.wet_rank.mean()),
        "oracle_any_good_week": dict(good=df.oracle_good.mean()),
        "per_site": df.groupby("site")[["rec_good", "rand_good", "rec_alert", "rand_alert"]].mean().round(3).to_dict("index"),
    }


def summarise_calib(rows):
    a = np.array(rows)
    p, clim, o = a[:, 0], a[:, 1], a[:, 2]
    bins = np.clip((p * 5).astype(int), 0, 4)
    rel = [dict(bin=f"{b/5:.1f}-{(b+1)/5:.1f}", n=int((bins == b).sum()),
                mean_pred=float(p[bins == b].mean()), observed=float(o[bins == b].mean()))
           for b in range(5) if (bins == b).any()]
    bs, bc = brier_score_loss(o, p), brier_score_loss(o, clim)
    return dict(n=len(o), brier=bs, brier_climo=bc, bss=1 - bs / bc, reliability=rel)


# ---------- E2 --------------------------------------------------------------
def cat(z):
    return 0 if z <= -0.8 else 2 if z >= 0.8 else 1


def e2(sites):
    obs, pred = [], []
    zs = []
    for s in sites:
        rain = s.rain
        for Y in TEST_YEARS:
            train = list(range(Y - 20, Y))
            weeks = R.candidate_weeks(rain, train)
            for d in weeks:
                def sums(y):
                    t = pd.Timestamp(sow_date(y, d))
                    before = rain[t - pd.Timedelta(days=90): t - pd.Timedelta(days=1)]
                    after = rain[t: t + pd.Timedelta(days=89)]
                    if before.count() < 80 or after.count() < 80:
                        return None
                    return before.sum(), after.sum()
                hist = [x for x in (sums(y) for y in train) if x]
                cur = sums(Y)
                if cur is None or len(hist) < 10:
                    continue
                hb, ha = np.array(hist).T
                zb = (cur[0] - hb.mean()) / (hb.std() or 1)
                za = (cur[1] - ha.mean()) / (ha.std() or 1)
                pred.append(cat(zb)); obs.append(cat(za)); zs.append((zb, za))
    pred, obs = np.array(pred), np.array(obs)
    acc = (pred == obs).mean()
    pe = sum((pred == k).mean() * (obs == k).mean() for k in range(3))
    z = np.array(zs)
    cm = pd.crosstab(pd.Series(pred, name="verdict"), pd.Series(obs, name="next_90d")).to_dict()
    return dict(n=len(obs), accuracy=acc, always_normal=(obs == 1).mean(),
                heidke_skill=(acc - pe) / (1 - pe),
                spearman_prior_vs_next=float(pd.Series(z[:, 0]).corr(pd.Series(z[:, 1]), method="spearman")),
                confusion={str(k): {str(kk): int(vv) for kk, vv in v.items()} for k, v in cm.items()})


# ---------- E3 --------------------------------------------------------------
TH_YEARS = list(range(1986, 2006))
TRAIN_Y = list(range(1987, 2013))
TEST_Y = list(range(2013, 2026))


def e3_dataset(sites):
    rows = []
    for si, s in enumerate(sites):
        f = s.fit(TH_YEARS, "v1.1")
        weeks, th = f["weeks"], f["th"]
        df = s.df
        annual = s.rain[s.rain.index.year.isin(TH_YEARS)].mean() * 365

        def prior(y, d, col, k, how):
            t = pd.Timestamp(sow_date(y, d))
            x = df[col][t - pd.Timedelta(days=k): t - pd.Timedelta(days=1)]
            return getattr(x, how)() if x.count() >= 0.8 * k else np.nan

        feats_by = {}
        for y in TRAIN_Y + TEST_Y:
            for i, d in enumerate(weeks):
                r = s.rate(y, d, th, "v1.1")
                if r is None:
                    continue
                cls, (pD, pF, pH) = r
                feats_by[(y, i)] = dict(
                    site=si, year=y, week=i,
                    rain30=prior(y, d, "PRECTOTCORR", 30, "sum"),
                    rain60=prior(y, d, "PRECTOTCORR", 60, "sum"),
                    rain90=prior(y, d, "PRECTOTCORR", 90, "sum"),
                    root30=prior(y, d, "GWETROOT", 30, "mean"),
                    top30=prior(y, d, "GWETTOP", 30, "mean"),
                    t2m30=prior(y, d, "T2M", 30, "mean"),
                    tmax30=prior(y, d, "T2M_MAX", 30, "mean"),
                    y_alert=int(cls == "alert"), y_drought=int(pD >= 0.9),
                    y_flood=int(pF >= 0.9), y_heat=int(pH >= 0.9),
                )
        part = pd.DataFrame(feats_by.values())
        # anomalies vs the threshold-period climatology for the same site-week
        base = part[part.year.isin(TH_YEARS)]
        for c in ["rain30", "rain60", "rain90", "root30", "top30", "t2m30", "tmax30"]:
            g = base.groupby("week")[c]
            mu, sd = part.week.map(g.mean()), part.week.map(g.std()).replace(0, 1)
            part[c + "_z"] = (part[c] - mu) / sd
        doy = part.week.map(dict(enumerate(weeks)))
        part["doy_sin"], part["doy_cos"] = np.sin(2 * np.pi * doy / 365), np.cos(2 * np.pi * doy / 365)
        part["abs_lat"], part["annual_rain"] = abs(s.lat), annual
        rows.append(part)
    return pd.concat(rows, ignore_index=True)


FEATURES = ["rain30_z", "rain60_z", "rain90_z", "root30_z", "top30_z", "t2m30_z", "tmax30_z",
            "root30", "top30", "doy_sin", "doy_cos", "abs_lat", "annual_rain", "year"]


def e3(data):
    tr, te = data[data.year.isin(TRAIN_Y)], data[data.year.isin(TEST_Y)]
    out = {"n_train": len(tr), "n_test": len(te), "targets": {}}
    rng = np.random.default_rng(0)
    for tgt in ["y_alert", "y_drought", "y_flood", "y_heat"]:
        ytr, yte = tr[tgt].to_numpy(), te[tgt].to_numpy()
        clim = tr.groupby(["site", "week"])[tgt].mean()
        p_clim = te.set_index(["site", "week"]).index.map(clim).to_numpy(dtype=float)
        p_clim = np.nan_to_num(p_clim, nan=ytr.mean())
        Xtr, Xte = tr[FEATURES].fillna(0), te[FEATURES].fillna(0)
        # site-week climatology is also a feature for the learned models
        Xtr = Xtr.assign(clim=tr.set_index(["site", "week"]).index.map(clim).to_numpy(dtype=float))
        Xte = Xte.assign(clim=p_clim)
        lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5)).fit(Xtr, ytr)
        xgb = XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.03, subsample=0.8,
                            colsample_bytree=0.8, min_child_weight=5, eval_metric="logloss").fit(Xtr, ytr)
        preds = {"climatology": p_clim, "logistic": lr.predict_proba(Xte)[:, 1],
                 "xgboost": xgb.predict_proba(Xte)[:, 1]}
        bc = brier_score_loss(yte, p_clim)
        res = {"base_rate_test": float(yte.mean())}
        years = te.year.to_numpy()
        for m, p in preds.items():
            auc = roc_auc_score(yte, p) if 0 < yte.sum() < len(yte) else np.nan
            # year-block bootstrap CI for AUC
            boots = []
            uy = np.unique(years)
            for _ in range(300):
                pick = np.concatenate([np.where(years == y)[0] for y in rng.choice(uy, len(uy))])
                if 0 < yte[pick].sum() < len(pick):
                    boots.append(roc_auc_score(yte[pick], p[pick]))
            res[m] = dict(auc=auc, auc_ci=[float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))],
                          brier=brier_score_loss(yte, p), bss=1 - brier_score_loss(yte, p) / bc)
        imp = pd.Series(xgb.get_booster().get_score(importance_type="gain")).sort_values(ascending=False)
        res["xgb_top_features"] = imp.head(6).round(2).to_dict()
        out["targets"][tgt] = res
    return out


# ---------- main ------------------------------------------------------------
def fmt(x):
    return f"{x:.3f}" if isinstance(x, float) else str(x)


def main():
    sites = [Site(n, *ll) for n, ll in SITES.items()]
    print("data loaded")
    e0, e1, calib = e0_e1(sites)
    res = {"E0": e0, "E1": {v: summarise_e1(r) for v, r in e1.items()},
           "E1_calibration": {v: summarise_calib(c) for v, c in calib.items()}}
    print("E1 done")
    res["E2"] = e2(sites)
    print("E2 done")
    data = e3_dataset(sites)
    res["E3"] = e3(data)
    print("E3 done")
    (OUT / "results.json").write_text(json.dumps(res, indent=2, default=float))

    L = ["# Raw results (generated by eval/run_eval.py)\n", "## E0 in-sample class shares (2006-2025)\n",
         "| site | version | good | alert |", "|---|---|---|---|"]
    L += [f"| {r['site']} | {r['version']} | {r['good']:.2f} | {r['alert']:.2f} |" for r in e0]
    for v in ("v1", "v1.1"):
        s = res["E1"][v]
        L += [f"\n## E1 sowing-window backtest — engine {v} ({s['n_site_years']} site-years)\n",
              "| strategy | P(good season) | P(alert season) | mean stress rank (0=best) |", "|---|---|---|---|"]
        for k in ("recommended", "random_week", "start_of_wettest_window"):
            d = s[k]
            L.append(f"| {k} | {d['good']:.3f} | {d['alert']:.3f} | {d['stress_rank']:.3f} |")
        L.append(f"| oracle (best week in hindsight) | {s['oracle_any_good_week']['good']:.3f} | | |")
        c = res["E1_calibration"][v]
        L += [f"\nConfidence calibration ({c['n']} week-forecasts): Brier {c['brier']:.3f}, "
              f"climatology {c['brier_climo']:.3f}, BSS {c['bss']:.3f}\n",
              "| predicted P(good) | n | mean predicted | observed |", "|---|---|---|---|"]
        L += [f"| {r['bin']} | {r['n']} | {r['mean_pred']:.2f} | {r['observed']:.2f} |" for r in c["reliability"]]
    e = res["E2"]
    L += ["\n## E2 Dry/Normal/Wet persistence\n",
          f"n={e['n']}, accuracy {e['accuracy']:.3f}, always-'normal' {e['always_normal']:.3f}, "
          f"Heidke skill {e['heidke_skill']:.3f}, Spearman(prior z, next z) {e['spearman_prior_vs_next']:.3f}"]
    t = res["E3"]
    L += [f"\n## E3 ML risk forecast (train {t['n_train']}, test {t['n_test']} site-weeks)\n",
          "| target | base rate | model | AUC [95% CI] | Brier | BSS vs climatology |", "|---|---|---|---|---|---|"]
    for tgt, r in t["targets"].items():
        for m in ("climatology", "logistic", "xgboost"):
            d = r[m]
            L.append(f"| {tgt} | {r['base_rate_test']:.2f} | {m} | {d['auc']:.3f} "
                     f"[{d['auc_ci'][0]:.2f}, {d['auc_ci'][1]:.2f}] | {d['brier']:.3f} | {d['bss']:+.3f} |")
        L.append(f"| | | xgb top features | {r['xgb_top_features']} | | |")
    (OUT / "results.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))


if __name__ == "__main__":
    main()
