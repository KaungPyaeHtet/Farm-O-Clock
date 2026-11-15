"""Build the charts in /reports from eval/results.json (+ cached NASA data).

Run from backend/ after run_eval:  .venv/bin/python -m eval.make_figures
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.colors import ListedColormap  # noqa: E402

from eval.run_eval import SITES, Site  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FIG = ROOT / "reports" / "figures"
RES = json.loads((Path(__file__).parent / "results.json").read_text())

# Validated categorical slots (dataviz reference palette) + app risk colours.
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
GRAY = "#a3a29c"
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#8a8984", "#e6e5e0", "#fcfcfb"
RISK = {"good": "#2f8a3e", "watch": "#cf8912", "alert": "#bf3326", "unknown": "#d2dfbd"}

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "font.family": "sans-serif", "font.size": 10, "axes.edgecolor": GRID,
    "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "axes.titlesize": 12, "axes.titleweight": "bold", "axes.titlecolor": INK,
    "axes.titlelocation": "left", "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8, "axes.axisbelow": True,
    "legend.frameon": False, "legend.fontsize": 9,
})


def short(site: str) -> str:
    return site.split(" (")[0]


def save(fig, name, subtitle=None):
    if subtitle:
        fig.text(0.01, -0.04, subtitle, color=MUTED, fontsize=8, ha="left", va="top")
    fig.savefig(FIG / name, dpi=160, bbox_inches="tight", pad_inches=0.25)
    plt.close(fig)
    print("wrote", name)


# 1 -------------------------------------------------------------------------
def fig_bug():
    rows = RES["E0"]
    sites = list(dict.fromkeys(r["site"] for r in rows))
    v1 = [next(r["alert"] for r in rows if r["site"] == s and r["version"] == "v1") for s in sites]
    v11 = [next(r["alert"] for r in rows if r["site"] == s and r["version"] == "v1.1") for s in sites]
    order = np.argsort(v1)
    y = np.arange(len(sites))
    fig, ax = plt.subplots(figsize=(8, 4.6))
    h = 0.38
    ax.barh(y + h / 2, np.array(v1)[order] * 100, h - 0.04, color=ORANGE, label="v1 (as shipped)")
    ax.barh(y - h / 2, np.array(v11)[order] * 100, h - 0.04, color=BLUE, label="v1.1 (tie fix)")
    for yi, a, b in zip(y, np.array(v1)[order], np.array(v11)[order]):
        ax.text(a * 100 + 1, yi + h / 2, f"{a:.0%}", va="center", fontsize=8, color=INK2)
        ax.text(b * 100 + 1, yi - h / 2, f"{b:.0%}", va="center", fontsize=8, color=INK2)
    ax.set_yticks(y, [short(sites[i]) for i in order])
    ax.set_xlim(0, 110)
    ax.set_xlabel("Share of past seasons rated HIGH RISK (%)")
    ax.grid(axis="y", visible=False)
    ax.set_title("Bug: cool/arid sites were rated high-risk every single season")
    ax.legend(loc="lower right")
    save(fig, "01_bug_alert_share.png", "In-sample 2006–2025, 14 sowing weeks × 20 years per site. Source: NASA POWER daily.")


# 2 -------------------------------------------------------------------------
def fig_grid():
    from eval.run_eval import probs
    from farm import replay as R

    name = "Western Kenya (maize)"
    s = Site(name, *SITES[name])
    years = list(range(2006, 2026))
    cmap = ListedColormap([RISK["good"], RISK["watch"], RISK["alert"], RISK["unknown"]])
    code = {"good": 0, "watch": 1, "alert": 2, "unknown": 3}
    fig, axes = plt.subplots(1, 2, figsize=(10, 5.2), sharey=True)
    for ax, v, title in zip(axes, ("v1", "v1.1"), ("Before fix (v1)", "After fix (v1.1)")):
        f = s.fit(years, v)
        grid = np.full((len(years), R.WEEKS), 3)
        for yi, y in enumerate(years):
            for wi, d in enumerate(f["weeks"]):
                r = s.rate(y, d, f["th"], v)
                grid[yi, wi] = code[r[0]] if r else 3
        ax.imshow(grid, cmap=cmap, vmin=-0.5, vmax=3.5, aspect="auto", interpolation="nearest")
        ax.set_xticks(np.arange(R.WEEKS) - 0.5, minor=True)
        ax.set_yticks(np.arange(len(years)) - 0.5, minor=True)
        ax.grid(which="minor", color=SURFACE, linewidth=2)
        ax.grid(which="major", visible=False)
        ax.tick_params(which="minor", length=0)
        labels = [(np.datetime64("2021-01-01") + np.timedelta64(d - 1, "D")).astype(object).strftime("%d %b") for d in f["weeks"]]
        ax.set_xticks(range(0, R.WEEKS, 3), [labels[i] for i in range(0, R.WEEKS, 3)], fontsize=8)
        ax.set_title(title, fontsize=11)
        ax.set_xlabel("Sowing week")
        ax.spines[:].set_visible(False)
        ax.add_patch(plt.Rectangle((f["best"] - 0.5, -0.5), 1, len(years), fill=False, ec=INK, lw=1.5))
    axes[0].set_yticks(range(0, len(years), 2), years[::2], fontsize=8)
    axes[0].set_ylabel("Past season")
    handles = [plt.Rectangle((0, 0), 1, 1, color=RISK[k]) for k in ("good", "watch", "alert")]
    fig.legend(handles, ["Low risk", "Some risk", "High risk"], loc="upper right", ncol=3, bbox_to_anchor=(0.99, 1.02))
    fig.suptitle("What the app shows for Western Kenya — Season Replay grid", x=0.01, ha="left", fontweight="bold", color=INK, y=1.02)
    save(fig, "02_kenya_grid_before_after.png", "Black outline = recommended sowing week. Each cell = one past season sown that week, 90-day window.")


# 3 -------------------------------------------------------------------------
def fig_sowing():
    e = RES["E1"]["v1.1"]
    names = ["Random week", "Start of wettest\n90 days", "App's\nrecommended week"]
    keys = ["random_week", "start_of_wettest_window", "recommended"]
    good = [e[k]["good"] * 100 for k in keys]
    alert = [e[k]["alert"] * 100 for k in keys]
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.2))
    for ax, vals, title, better in (
        (axes[0], good, "Low-risk seasons (higher is better)", "high"),
        (axes[1], alert, "High-risk seasons (lower is better)", "low"),
    ):
        colors = [GRAY, GRAY, BLUE]
        bars = ax.bar(names, vals, width=0.6, color=colors)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 1, f"{v:.0f}%", ha="center", fontsize=10, color=INK, fontweight="bold")
        ax.set_title(title, fontsize=11)
        ax.set_ylim(0, 75)
        ax.grid(axis="x", visible=False)
        ax.set_ylabel("% of test seasons")
    axes[0].axhline(e["oracle_any_good_week"]["good"] * 100, color=INK2, lw=1.2, ls=(0, (4, 3)))
    axes[0].text(2.32, e["oracle_any_good_week"]["good"] * 100 + 1.5, "best possible\n(hindsight)", fontsize=8, color=INK2, ha="right")
    fig.suptitle("Does sowing in the recommended week help? (180 held-out site-years)", x=0.01, ha="left", fontweight="bold", color=INK)
    save(fig, "03_sowing_window_skill.png", "Rolling origin: each year 2006–2025 judged with thresholds learned only from the 20 years before it. 9 sites.")


# 4 -------------------------------------------------------------------------
def fig_per_site():
    ps = RES["E1"]["v1.1"]["per_site"]
    sites = sorted(ps, key=lambda s: ps[s]["rec_good"] - ps[s]["rand_good"])
    y = np.arange(len(sites))
    rec = np.array([ps[s]["rec_good"] for s in sites]) * 100
    rnd = np.array([ps[s]["rand_good"] for s in sites]) * 100
    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.hlines(y, np.minimum(rec, rnd), np.maximum(rec, rnd), color=GRID, lw=3, zorder=1)
    ax.scatter(rnd, y, s=60, color=GRAY, zorder=2, label="Random week", edgecolor=SURFACE, linewidth=2)
    ax.scatter(rec, y, s=60, color=BLUE, zorder=3, label="Recommended week", edgecolor=SURFACE, linewidth=2)
    for yi, a, b in zip(y, rec, rnd):
        ax.text(max(a, b) + 2, yi, f"{a - b:+.0f} pts", va="center", fontsize=8, color=INK2)
    ax.set_yticks(y, [short(s) for s in sites])
    ax.set_xlim(0, 100)
    ax.set_xlabel("Low-risk seasons (%)")
    ax.grid(axis="y", visible=False)
    ax.set_title("Gain from the recommended sowing week, by site")
    ax.legend(loc="lower right")
    save(fig, "04_per_site_gain.png", "20 held-out years per site (2006–2025). Engine v1.1.")


# 5 -------------------------------------------------------------------------
def fig_calibration():
    fig, ax = plt.subplots(figsize=(5.6, 5.2))
    ax.plot([0, 1], [0, 1], color=MUTED, lw=1, ls=(0, (4, 3)))
    ax.text(0.78, 0.84, "perfectly honest", rotation=45, fontsize=8, color=MUTED, ha="center")
    for v, color, label in (("v1", ORANGE, "v1 (as shipped)"), ("v1.1", BLUE, "v1.1 (tie fix)")):
        rel = [r for r in RES["E1_calibration"][v]["reliability"] if r["n"] >= 20]
        x = [r["mean_pred"] for r in rel]
        yv = [r["observed"] for r in rel]
        n = [r["n"] for r in rel]
        ax.plot(x, yv, color=color, lw=2, label=f"{label} — BSS {RES['E1_calibration'][v]['bss']:+.2f}")
        ax.scatter(x, yv, s=[20 + k / 12 for k in n], color=color, edgecolor=SURFACE, linewidth=2, zorder=3)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xlabel("App says: share of past seasons that were low risk")
    ax.set_ylabel("What actually happened next year")
    ax.set_title("Is the “k of 20 seasons” confidence honest?")
    ax.legend(loc="upper left")
    save(fig, "05_confidence_calibration.png", "Dot size = number of week-forecasts. Bins with <20 forecasts hidden.")


# 6 -------------------------------------------------------------------------
def fig_confusion():
    cm = RES["E2"]["confusion"]  # {next_cat: {verdict_cat: n}}
    labels = ["Dry", "Normal", "Wet"]
    m = np.array([[cm.get(str(o), {}).get(str(p), 0) for o in range(3)] for p in range(3)], float)
    rowpct = m / m.sum(axis=1, keepdims=True)
    seq = ListedColormap(["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"])
    fig, ax = plt.subplots(figsize=(5.8, 4.8))
    ax.imshow(rowpct, cmap=seq, vmin=0, vmax=0.8)
    for i in range(3):
        for j in range(3):
            ax.text(j, i, f"{rowpct[i, j]:.0%}\n(n={int(m[i, j])})", ha="center", va="center", fontsize=9,
                    color="white" if rowpct[i, j] > 0.45 else INK)
    ax.set_xticks(range(3), labels)
    ax.set_yticks(range(3), labels)
    ax.set_xlabel("What the NEXT 90 days turned out to be")
    ax.set_ylabel("Verdict from the LAST 90 days")
    ax.grid(False)
    ax.spines[:].set_visible(False)
    e = RES["E2"]
    ax.set_title(f"Dry/Normal/Wet: weak forecast (Heidke skill {e['heidke_skill']:.2f})")
    save(fig, "06_verdict_persistence.png", f"Rows sum to 100%. n={e['n']} site-weeks, 2006–2025. 0 = chance, 1 = perfect.")


# 7 -------------------------------------------------------------------------
TARGETS = [("y_alert", "Any high-risk\nseason"), ("y_drought", "Severe\ndrought"),
           ("y_flood", "Severe flood /\nwaterlogging"), ("y_heat", "Severe\nheat")]
MODELS = [("climatology", "20-yr average (baseline)", GRAY), ("logistic", "Logistic regression", BLUE), ("xgboost", "XGBoost", ORANGE)]


def fig_auc():
    t = RES["E3"]["targets"]
    fig, ax = plt.subplots(figsize=(9, 4.6))
    x = np.arange(len(TARGETS))
    for k, (m, label, color) in enumerate(MODELS):
        xs = x + (k - 1) * 0.22
        auc = [t[tg][m]["auc"] for tg, _ in TARGETS]
        lo = [t[tg][m]["auc"] - t[tg][m]["auc_ci"][0] for tg, _ in TARGETS]
        hi = [t[tg][m]["auc_ci"][1] - t[tg][m]["auc"] for tg, _ in TARGETS]
        ax.errorbar(xs, auc, yerr=[lo, hi], fmt="o", color=color, ms=8, lw=1.5, capsize=0,
                    mec=SURFACE, mew=2, label=label)
        for xi, a in zip(xs, auc):
            ax.text(xi + 0.04, a, f"{a:.2f}", fontsize=7.5, color=INK2, va="center")
    ax.axhline(0.5, color=MUTED, lw=1, ls=(0, (4, 3)))
    ax.text(3.45, 0.51, "coin flip", fontsize=8, color=MUTED, ha="right")
    ax.set_xticks(x, [lab for _, lab in TARGETS])
    ax.set_ylim(0.35, 1.0)
    ax.set_ylabel("AUC (95% CI)")
    ax.grid(axis="x", visible=False)
    ax.set_title("Predicting the coming season's risk at sowing time")
    ax.legend(loc="upper left", ncol=3)
    save(fig, "07_risk_model_auc.png", "Train 1987–2012, test 2013–2025 (1,638 site-weeks). CI = year-block bootstrap. Higher = better ranking of risky seasons.")


def fig_bss():
    t = RES["E3"]["targets"]
    fig, ax = plt.subplots(figsize=(9, 4.2))
    x = np.arange(len(TARGETS))
    for k, (m, label, color) in enumerate(MODELS[1:]):
        xs = x + (k - 0.5) * 0.34
        v = [t[tg][m]["bss"] * 100 for tg, _ in TARGETS]
        bars = ax.bar(xs, v, 0.32, color=color, label=label)
        for b, val in zip(bars, v):
            ax.text(b.get_x() + b.get_width() / 2, val + (0.8 if val >= 0 else -2.5), f"{val:+.0f}%", ha="center", fontsize=8, color=INK2)
    ax.axhline(0, color=INK2, lw=1)
    ax.set_ylim(-6, 34)
    ax.set_xticks(x, [lab for _, lab in TARGETS])
    ax.set_ylabel("Brier skill vs 20-yr average (%)")
    ax.grid(axis="x", visible=False)
    ax.set_title("How much better than “just use the 20-year average”?")
    ax.legend(loc="upper left")
    save(fig, "08_risk_model_skill.png", "Above 0 = the model's probabilities beat the climatology baseline. Same test set as figure 07.")


def fig_features():
    imp = RES["E3"]["targets"]["y_flood"]["xgb_top_features"]
    nice = {"rain90_z": "Rain last 90 days (anomaly)", "clim": "Site-week 20-yr flood rate",
            "top30_z": "Top-soil wetness last 30 d (anomaly)", "year": "Year (trend)",
            "root30_z": "Root-zone wetness last 30 d (anomaly)", "annual_rain": "Site annual rainfall",
            "abs_lat": "Latitude", "rain30_z": "Rain last 30 days (anomaly)", "root30": "Root-zone wetness"}
    items = sorted(imp.items(), key=lambda kv: kv[1])
    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.barh([nice.get(k, k) for k, _ in items], [v for _, v in items], color=BLUE, height=0.6)
    for i, (_, v) in enumerate(items):
        ax.text(v + 0.3, i, f"{v:.1f}", va="center", fontsize=8, color=INK2)
    ax.grid(axis="y", visible=False)
    ax.set_xlabel("XGBoost gain")
    ax.set_title("What drives the flood-risk prediction")
    save(fig, "09_flood_model_features.png", "Top 6 features by gain. Satellite/reanalysis soil wetness and recent rain carry real signal.")


# 10-14: improvements, yield check, scale, greenness ---------------------------
def _load(name):
    f = Path(__file__).parent / name
    return json.loads(f.read_text()) if f.exists() else None


def fig_calibration_fix():
    d = _load("improvements.json")
    if not d:
        return
    rel = d["E4a_calibration"]["reliability"]
    bss = d["E4a_calibration"]["test_bss_vs_climatology"]
    fig, ax = plt.subplots(figsize=(5.8, 5.2))
    ax.plot([0, 1], [0, 1], color=MUTED, lw=1, ls=(0, (4, 3)))
    ax.text(0.9, 0.95, "perfectly honest", rotation=45, fontsize=8, color=MUTED, ha="center")
    for key, color, label in (("raw k/n", ORANGE, "Before: raw “k of 20”"),
                              ("recency + isotonic (shipped)", BLUE, "After: recent years weighted + calibrated")):
        r = [x for x in rel[key] if x["n"] >= 20]
        ax.plot([x["mean_pred"] for x in r], [x["observed"] for x in r], color=color, lw=2,
                label=f"{label} (skill {bss[key]:+.3f})")
        ax.scatter([x["mean_pred"] for x in r], [x["observed"] for x in r], s=[20 + x["n"] / 12 for x in r],
                   color=color, edgecolor=SURFACE, linewidth=2, zorder=3)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.set_xlabel("App says: chance of a low-risk season")
    ax.set_ylabel("What happened (held-out 2016–2025)")
    ax.set_title("Confidence fix: closer to the honest line")
    ax.legend(loc="upper left", fontsize=8)
    save(fig, "10_confidence_fix.png", "Fitted on 2006–2015, tested on 2016–2025. Skill = Brier skill vs the site's average rate.")


def fig_stability():
    d = _load("improvements.json")
    if not d:
        return
    st = d["E4b_stability"]
    names = {"A current": "Before (rolling 20-yr anchor)", "B smoothed best week": "Smoothed best week",
             "C long-climatology anchor": "Shipped: 40-yr anchor", "D smoothed + long anchor": "Both"}
    keys = list(st)
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
    for ax, metric, title, fmt in ((axes[0], "jumps_over_4_weeks", "Big jumps (>4 weeks) between years", "{:.0f}"),
                                   (axes[1], "p_good", "Low-risk seasons (held-out)", "{:.0%}")):
        vals = [st[k][metric] for k in keys]
        colors = [BLUE if k.startswith("C") else GRAY for k in keys]
        bars = ax.barh([names[k] for k in keys], vals, color=colors, height=0.6)
        for b, v in zip(bars, vals):
            ax.text(b.get_width() * 1.01, b.get_y() + b.get_height() / 2, fmt.format(v), va="center", fontsize=9, color=INK2)
        ax.set_title(title, fontsize=11)
        ax.grid(axis="y", visible=False)
        ax.invert_yaxis()
    axes[1].set_yticklabels([])
    fig.suptitle("Recommended sowing week: steadier from year to year", x=0.01, ha="left", fontweight="bold", color=INK)
    save(fig, "11_sowing_stability.png", "9 sites × 2006–2025, 171 year-to-year pairs. Small cost in low-risk rate (−1 pt) for half the big jumps.")


def fig_yield():
    d = _load("yield_check.json")
    f = Path(__file__).parent / "yield_check_rows.csv"
    if not d or not f.exists():
        return
    df = pd.read_csv(f)
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.axhline(0, color=GRID, lw=1)
    ax.scatter(df.stress_rank * 100, df.yield_anom_pct, s=28, color=BLUE, alpha=0.75, edgecolor=SURFACE, linewidth=1)
    z = np.polyfit(df.stress_rank * 100, df.yield_anom_pct, 1)
    xs = np.array([0, 100])
    ax.plot(xs, np.polyval(z, xs), color=ORANGE, lw=2, label="trend")
    i = df[(df.site.str.startswith("Iowa")) & (df.harvest_year == 2012)]
    if len(i):
        ax.annotate("Iowa 2012 drought", (float(i.stress_rank.iloc[0]) * 100, float(i.yield_anom_pct.iloc[0])),
                    xytext=(55, -20), fontsize=9, color=INK2, arrowprops={"arrowstyle": "-", "color": MUTED})
    ax.set_xlabel("Engine season stress (rank within site, %)")
    ax.set_ylabel("National yield vs trend (%)")
    ax.set_title(f"Higher engine stress → lower real harvests (Spearman {d['pooled_spearman_stress_vs_yield']:+.2f})")
    ax.legend(loc="upper right")
    save(fig, "12_yield_check.png", f"{d['n_site_years']} site-years, 7 sites, FAOSTAT national yields 2006–2024 (detrended). Each year rated with only earlier data.")


def fig_scale():
    d = _load("scale_eval.json")
    if not d:
        return
    bands = d["E6a"]["by_band"]
    names = list(bands)
    x = np.arange(len(names))
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), gridspec_kw={"width_ratios": [1.2, 1]})
    ax = axes[0]
    rec = [bands[n]["rec_good"] * 100 for n in names]
    rnd = [bands[n]["rand_good"] * 100 for n in names]
    ax.bar(x - 0.18, rnd, 0.34, color=GRAY, label="Random week")
    ax.bar(x + 0.18, rec, 0.34, color=BLUE, label="Recommended week")
    for xi, a, b in zip(x, rnd, rec):
        ax.text(xi - 0.18, a + 1, f"{a:.0f}%", ha="center", fontsize=8, color=INK2)
        ax.text(xi + 0.18, b + 1, f"{b:.0f}%", ha="center", fontsize=8, color=INK2)
    ax.set_xticks(x, [f"{n}\n{int(bands[n]['sites'])} sites" for n in names], fontsize=9)
    ax.set_ylabel("Low-risk seasons (%)")
    ax.grid(axis="x", visible=False)
    ax.set_title("Sowing-week skill by climate", fontsize=11)
    ax.set_ylim(0, 50)
    ax.legend(loc="upper left", fontsize=8, ncol=2)
    ax = axes[1]
    t = d["E6b"]["targets"]
    labels = {"y_alert": "Any high-risk", "y_drought": "Drought", "y_flood": "Flood", "y_heat": "Heat"}
    keys = list(labels)
    ax.barh([labels[k] for k in keys], [t[k]["bss_vs_climatology"] * 100 for k in keys], color=BLUE, height=0.55)
    for i, k in enumerate(keys):
        v = t[k]["bss_vs_climatology"] * 100
        ax.text(max(v, 0) + 0.5, i, f"{v:+.0f}%  (AUC {t[k]['auc_model']:.2f})", va="center",
                ha="left", fontsize=8, color=INK2)
    ax.axvline(0, color=INK2, lw=1)
    ax.invert_yaxis()
    ax.grid(axis="y", visible=False)
    ax.set_title("Risk model on unseen regions (skill vs average)", fontsize=11)
    fig.suptitle(f"Does it work anywhere? {d['E6a']['n_sites']} cropland sites on 5 continents", x=0.01, ha="left",
                 fontweight="bold", color=INK)
    save(fig, "13_scale_and_spatial_holdout.png", "Left: held-out years 2006–2025. Right: 5-fold hold-out by site (model never saw the test regions), test years 2013–2025.")


def fig_ndvi():
    from farm.vegetation import ndvi_series
    sites = [("Western Kenya (maize)", 0.28, 34.75), ("Punjab farmland, IN", 30.75, 75.55), ("Ayeyarwady paddy, MM", 16.9, 95.5)]
    fig, axes = plt.subplots(len(sites), 1, figsize=(10, 6.6), sharex=True)
    for ax, (name, la, ln) in zip(axes, sites):
        s = ndvi_series(la, ln)
        ax.axhspan(-0.1, 0.3, color="#d9c48a", alpha=0.25, lw=0)
        ax.plot(s.index, s.values, color=AQUA, lw=1.6)
        ax.scatter(s.index, s.values, s=8, color=AQUA, zorder=3)
        ax.set_ylim(-0.05, 0.95)
        ax.set_ylabel("NDVI", fontsize=8)
        ax.text(0.01, 0.86, name, transform=ax.transAxes, fontsize=10, fontweight="bold", color=INK)
        ax.grid(axis="x", visible=False)
    axes[0].text(0.99, 0.86, "shaded = bare / sparse (NDVI < 0.3)", transform=axes[0].transAxes, ha="right", fontsize=8, color=INK2)
    fig.suptitle("Greenness from MODIS: bare-field periods and crop seasons", x=0.01, ha="left", fontweight="bold", color=INK)
    save(fig, "14_ndvi_greenness.png", "MODIS Terra MOD13Q1 (250 m, 16-day), clear-sky composites only, via Microsoft Planetary Computer.")


def main():
    FIG.mkdir(parents=True, exist_ok=True)
    for f in (fig_bug, fig_grid, fig_sowing, fig_per_site, fig_calibration, fig_confusion, fig_auc, fig_bss, fig_features,
              fig_calibration_fix, fig_stability, fig_yield, fig_scale, fig_ndvi):
        f()


if __name__ == "__main__":
    main()
