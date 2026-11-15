# Farm O'Clock: accuracy and skill report (v0)

> Charts, CSV tables and a plain-language write-up are in [`reports/README.md`](../../reports/README.md) at the repo root.

**Date:** 2026-11-15. **Reproduce:** `cd backend && .venv/bin/python -m eval.run_eval`. It takes about 30 s once
NASA POWER data is cached. Raw numbers are in `results.md` and `results.json`.

## Setup

- **Data:** NASA POWER daily data (`PRECTOTCORR`, `T2M_MAX`, `T2M`, `GWETTOP`, `GWETROOT`), 1985-01-01 to 2026-10-31.
- **Sites:** 9 farming regions with different climates. They are listed in `run_eval.py` under `SITES`: the Ayeyarwady delta, the Mandalay dry
  zone, Punjab, Iowa, Fallon NV (irrigated alfalfa), Western Kenya, Mato Grosso, Maradi in Niger and the Ethiopian highlands.
- **Engine:** `farm/replay.py` is a port of `web/src/app/api/replay/route.ts` and follows the same rules.
- **No leakage:** every test year is rated using thresholds learned only from earlier years (rolling origin).
- **Caveat (ground truth):** "good" and "alert" here are the engine's own climate-stress definitions. They are not
  crop yields. So the report measures whether the engine is *consistent and predictive about weather stress*. It does not show that farmers
  get better harvests. See the "Next validation" section.
- **Caveat (sample size):** the 14 sowing weeks overlap, so samples within a year are correlated. The effective sample size is closer to
  180 site-years than 2,520. The confidence intervals use a year-block bootstrap for that reason.

## E0: Bug found in the shipped engine (fix before the demo)

Heat risk is the percentile of "days ≥ 35 °C". Where that count is almost always 0, the TS `pct()` gives a value of 0 the
**top** percentile, so every season becomes a "severe heat" alert. Drought has the same tie problem in arid places.

| Site | v1 (shipped): good / alert | v1.1 (fixed): good / alert |
|---|---|---|
| Fallon, Nevada | 0.00 / **1.00** | 0.44 / 0.22 |
| Western Kenya | 0.00 / **1.00** | 0.46 / 0.21 |
| Central Ethiopia | 0.00 / **1.00** | 0.49 / 0.21 |
| Mato Grosso | 0.00 / 0.48 | 0.41 / 0.31 |
| Ayeyarwady delta | 0.15 / 0.42 | 0.31 / 0.29 |

**Fix (v1.1):** use mid-rank percentiles for ties, `(count(<v) + count(<=v)) / 2n`, and set `pH = 0` when there were 0 hot days.
This is about 5 lines in `route.ts`. All later results use v1.1 unless they say otherwise.

## E1: Does the recommended sowing week beat the alternatives?

There are 180 site-years (9 sites × test years 2006–2025). For each year, the engine learned from the previous 20 years and then the actual season was scored.

| Strategy | P(good season) | P(alert season) | Mean stress rank (0 = best of the 14 weeks) |
|---|---|---|---|
| **Engine recommendation** | **0.39** | **0.29** | **0.36** |
| Start of the wettest 90-day window | 0.32 | 0.36 | 0.39 |
| Random week | 0.28 | 0.39 | 0.50 |
| Oracle (best week in hindsight) | 0.63 | — | — |

**What this means:** the recommendation has real skill. Compared with a random week, it gives about 40 % more good seasons
and about 25 % fewer alert seasons. It still captures only about a third of the possible gain (0.28 → 0.39, against an oracle of 0.63). The shipped v1 engine scored
0.14 vs 0.10 good.

**Is the confidence calibrated?** The app's "X of 20 seasons were favourable" is checked here against what happened the following year.

| Predicted P(good) | n | Observed |
|---|---|---|
| 0.0–0.2 | 660 | 0.16 |
| 0.2–0.4 | 1007 | 0.23 |
| 0.4–0.6 | 489 | 0.41 |
| 0.6–0.8 | 354 | **0.47** |

The Brier skill score vs climatology is +0.04. The confidence ranks weeks correctly, but it is **over-confident at the top**: "13 of 20"
works out to roughly a coin flip next year. Show the confidence with shrinkage (see the model plan) or as bands such as "about half
of years", not a raw fraction.

## E2: Does "this season looks Dry/Wet" predict the next 90 days?

| Metric | Value |
|---|---|
| Accuracy (3 classes) | 0.50 (always guessing "normal" gives 0.45) |
| Heidke skill score | **0.20** (0 = chance, 1 = perfect) |
| Spearman correlation, prior-90-day vs next-90-day rain anomaly | 0.43 |

The verdict persists modestly, mostly because of soil and season memory. It is fair to say "the last 3 months were dry". Do **not** present it as a forecast.
Pair it with a real seasonal forecast (Meteomatics, ECMWF SEAS5) for that.

## E3: First ML risk model (the "XGBoost" step in the product flow)

The models predict, at sowing time, whether the next 90 days will be an alert season or a severe drought, flood or heat season. Features use only data from before
sowing: rain anomalies over the prior 30, 60 and 90 days, root-zone and topsoil wetness, temperature anomalies, season, latitude, annual rain, year
and site-week climatology. The models train on 1987–2012 (3,276 site-weeks) and test on 2013–2025 (1,638).

| Target (test base rate) | Climatology AUC | Logistic AUC / BSS | XGBoost AUC / BSS |
|---|---|---|---|
| Any alert (0.53) | 0.66 | **0.69** / +0.15 | 0.67 / +0.11 |
| Severe drought (0.12) | 0.81 | 0.82 / −0.01 | **0.85** / +0.08 |
| Severe flood / waterlogging (0.36) | 0.68 | **0.78** / +0.28 | 0.77 / **+0.30** |
| Severe heat (0.04) | 0.57 | **0.90** / +0.19 | 0.72 / +0.03 |

**What this means:**

1. Adding pre-sowing satellite and reanalysis state beats plain climatology, with BSS from +0.08 to +0.30. Flood risk improves most. The prior 90-day rain and
   topsoil wetness anomalies are the top XGBoost features.
2. XGBoost does **not** clearly beat logistic regression with only about 3k rows. Ship logistic regression first. It is explainable and calibrated,
   and it wins on heat, where there are only about 65 positive cases. Move to XGBoost once there are more sites and features.
3. `year` is a top-5 feature: hazard rates are rising over time. Fixed 20-year baselines will under-state current heat risk.

## Next validation (in priority order)

1. **Yield ground truth.** Score recommended vs farmer-typical sowing dates against yield anomalies: GDHY global yields, USDA NASS county yields,
   FAO district statistics, and Myanmar DoA township data if available. This is the test judges will care about.
2. **Satellite vs reanalysis.** Compare POWER `GWETTOP` against SMAP L3/L4 soil moisture (correlation, anomaly correlation) and
   POWER rain against GPM IMERG, at the 9 sites.
3. **More sites:** 50–100 points sampled from cropland masks (ESA WorldCereal, GFSAD). Report skill per climate zone.
4. **Spatial hold-out:** train on some sites and test on unseen ones, because the app works "anywhere on Earth".
5. **Parity test:** the Python engine must match the TS `/api/replay` output exactly at fixed sites.
