# Farm O'Clock: Python backend (model API + evaluation)

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest                          # 11 tests (engine + API, offline)
.venv/bin/uvicorn app.main:app --reload --port 8000  # API -> http://localhost:8000/docs
.venv/bin/python -m eval.run_eval                    # backtests -> eval/results.json
.venv/bin/python -m eval.make_figures                # charts -> ../reports/figures
.venv/bin/python train_risk.py                       # refit models/risk_logreg_v1.json
```

## API (`app/main.py`)

| Route | Body | Returns |
|---|---|---|
| `GET /health` | – | `{ok, model}` |
| `POST /v1/outlook` | `{lat, lng}` | For each of 14 sowing weeks: chance of a high-risk / drought / flood / heat season this year, plus the usual rate. `in_range` is true only for weeks ≤ 30 days ahead; the UI shows "too early" otherwise |
| `POST /v1/scenario` | `{lat, lng, rain_pct, heat_c}` | The 20-season replay re-run with rain × (1 + rain_pct/100) and max temp + heat_c. Returns low/some/high counts per week and the best week |

- The web app calls these only through its own server routes (`/api/outlook`, `/api/scenario` → `web/src/lib/backend.ts`), so the browser never sees the backend URL or key.
- Optional shared secret: set `BACKEND_API_KEY` on both sides (header `x-api-key`).
- The model is JSON (`models/risk_logreg_v1.json`): scaler + logistic coefficients, so the server needs no sklearn.
- Layout: `farm/power.py` (NASA client + cache), `farm/replay.py` (engine v1.1), `farm/location.py` (per-pin analysis),
  `farm/risk_model.py` (features + predict), `eval/` (backtests, figures, `check_site`).

## Deploy to Google Cloud Run (Space Apps GCP credits)

```bash
gcloud auth login && gcloud config set project <your-project-id>
cd backend
gcloud run deploy farm-oclock-api --source . --region asia-southeast1 \
  --allow-unauthenticated --memory 1Gi --set-env-vars BACKEND_API_KEY=<long-random-string>
```
Then in Vercel (and `web/.env.local`): `BACKEND_URL=https://farm-oclock-api-....run.app` and the same `BACKEND_API_KEY`.
The same `Dockerfile` also runs on Render or Hugging Face Spaces. Open the app once before a demo: Cloud Run sleeps when idle.

## Model plan (what to build, mapped to the challenge brief)

| Feature in app | Model | Why |
|---|---|---|
| Flood/drought/heat risk for a sowing date | **Logistic regression now, then XGBoost/LightGBM** with monotonic constraints + isotonic calibration | E3: beats climatology (BSS up to +0.30). Monotonic constraints keep it explainable ("wetter soil → more flood risk") |
| "Confidence" on sowing window | **Beta-binomial shrinkage** of "good in k of n years" + per-zone isotonic calibration | E1 shows the raw k/n is over-confident above 0.6 |
| Upcoming season Dry/Normal/Wet | Blend: persistence (E2, HSS 0.20) + **Meteomatics or ECMWF SEAS5** seasonal forecast, weighted by skill | Persistence alone is weak; this is challenge improvement #2 |
| Recurring patterns (improvement #3) | **Change-point / trend tests** (Mann-Kendall, Sen's slope) on onset date, dry spells and hot days; **k-means/HDBSCAN** to cluster season types | "Your monsoon onset has moved 9 days later since 2000" is easy to explain |
| Bare-field periods, crop stress | **NDVI/EVI time series** (MODIS MOD13Q1, Landsat/Sentinel-2 via Planetary Computer) + phenology fitting (TIMESAT-style double-logistic) | The brief explicitly asks about bare-field periods and vegetation stress |
| Water demand per strategy | **FAO-56 Penman-Monteith ET₀ × crop coefficients (Kc)**, checked against OpenET/ECOSTRESS ET | Physically based and defensible, replaces the hand-tuned `waterThrift` |
| Rotation soil/yield trajectory | Process model: **AquaCrop-OSPy** (pip `aquacrop`) or **DSSAT via `DSSATTools`**, run per strategy and per what-if scenario | Gives real numbers behind the 3 strategy cards instead of the heuristics in `strategies.ts` |
| Rain/Heat sliders | Re-run the risk model/AquaCrop with perturbed weather (delta-change: rain × k, T + Δ) | Today the sliders do not touch the risk model |
| Field observations (improvement #1) | **Bayesian update / Kalman-style bias correction** of model soil moisture using farmer reports, with outlier filtering | Explicit uncertainty; the farmer sees their report move the estimate |
| Plain-language brief | Built-in English/Burmese template (decision: no LLM API in the app) | Replaces the template in `lib/brief.ts`; also translates into Burmese |

Add features in this order: SMAP L4 root-zone soil moisture, GPM IMERG rain, MODIS NDVI anomaly, SRTM slope,
SoilGrids texture/organic carbon (global, unlike the US-only Web Soil Survey), and GRACE groundwater trend. Resample everything to
one grid (for example 0.1°, dekadal) before modelling. The brief asks for this explicitly.

## Tests to add

- **Unit:** `tests/test_replay.py` (done). Add percentile tie handling and slider monotonicity: more rain must never increase drought risk.
- **Parity:** the Python engine must equal TS `/api/replay` at 3 fixed sites, with cached POWER JSON as fixtures.
- **Backtests:** E1–E3 in `eval/` (done). Add yield-anomaly validation and a spatial hold-out (see REPORT "Next validation").
- **Data QA:** fill values, missing-day ratio, POWER vs SMAP/IMERG agreement, and stale-data alarm when the latency exceeds 10 days.
- **API contract:** pytest + `httpx` against FastAPI. The response schema must match `web/src/lib/types.ts`.
- **Scores to report** on the demo/README: P(good) uplift vs random week, Brier skill score, AUC with CI, and reliability diagram.

## Hosting (free / hackathon credits)

| Piece | Use | Why |
|---|---|---|
| Next.js frontend | **Vercel Hobby** (free) | Zero-config for Next 16; API routes keep working |
| Python API (FastAPI + model) | **Google Cloud Run** (Space Apps GCP credits; free tier 2M req/month, scales to zero) | Runs a Docker container, so xgboost/numpy install fine; no server to manage |
| Database (farmer observations, cached NASA pulls, saved plans) | **Supabase** free Postgres (+ PostGIS, auth, storage) | Good fit for improvement #1. Supabase Edge Functions are Deno/TypeScript, so they **cannot** host the Python model |
| Satellite data processing | **Microsoft Planetary Computer** (free STAC: Landsat, Sentinel-2, MODIS, ERA5, NASADEM) | Pull NDVI etc. without Earthdata download pain |
| Weather forecast | **Meteomatics** API (Space Apps access) | Forecast input for improvement #2 |
| Domain | **GoDaddy** free domain, pointed at Vercel | Skip GoDaddy hosting: it is shared web hosting and cannot run the Python model |

Precompute and cache. A 40-year POWER pull takes seconds, so store results per ~0.1° grid cell in Supabase. That keeps the demo fast.
Alternatives if GCP credits are a hassle: Hugging Face Spaces (free, Docker) or Render free tier. Render's free tier cold-starts after it has been idle.
