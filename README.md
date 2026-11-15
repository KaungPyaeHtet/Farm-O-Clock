<p align="center">
  <img src="web/src/app/icon.svg" width="96" alt="Farm O'Clock logo" />
</p>

# Farm O'Clock — NASA Space Apps 2026

**Challenge:** "Field Shift: Adapting Farms with NASA Data" · **Live app:** https://farm-oclock-five.vercel.app

A mobile-first web app for farmers and extension workers. You drop a pin on a field anywhere on Earth. The app
replays 20 years of NASA data for that spot to rate drought, flood and heat risk for each sowing week, helps you
pick a sowing date, compares 3 crop-rotation plans under "what if" weather, and ends with a plain-language
English / Burmese plan and a field-check checklist. It supports the farmer's own judgment and never replaces it.

## What the app does (7 steps)

| Step | Screen | What the farmer sees |
|---|---|---|
| 1 | Field (`Screen1Map`) | Search a place, tap the map or "Use my location". Pins on water are refused; towns get a warning. |
| 2 | Conditions (`Screen2Environment`) | Last 30 days: soil moisture, rain, heat, slope, green cover (with the date of the last clear satellite photo), soil type. |
| 3 | Crop & goals (`Screen3CropGoals`) | 8 crops, 1–2 goals (save water, rebuild nitrogen, prevent erosion, extra income), constraints (no new machinery, frost-sensitive). |
| 4 | Past seasons (`SeasonReplay`) | Year × sowing-week risk grid for the last 20 seasons, and whether the last 3 months were Dry / Normal / Wet. |
| 5 | Sowing date (`SowingCalendar`) | Upcoming sowing weeks as real dates, "N in 10 seasons go well", and this year's outlook (see below). |
| 6 | Rotations (`Screen5RotationCompare`) | Baseline / Water-Conserving / Soil-Rebuilding plans, with "What if…?" rain and heat sliders that re-rank them. |
| 7 | Your plan (`Screen6Guidance`) | Sow date, plan, why, checklist, soil check question, shareable plan card. Uses the date, what-if and constraints chosen earlier. |

**This year's outlook** (step 5) depends on how far away the sowing date is:
- ≤ 30 days: chance of a bad season from our risk model, using this year's NASA soil and rain.
- up to ~3–4 months: seasonal rain/heat forecast (Open-Meteo) applied to the 20 past seasons.
- further: what usually happens at that week, and the dates when the forecast and the full check become available.

## Run it

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm test         # history windows, constraints, input checks
```

No API keys are needed for the core app; every data source is open. Optional:
- **Python model API** (`backend/`, FastAPI): outlook, what-if re-run, rotation crops, greenness.
  `cd backend && .venv/bin/uvicorn app.main:app --port 8000`, then set `BACKEND_URL=http://localhost:8000` in `web/.env.local`.
  Tests: `.venv/bin/python -m pytest`. Without it, those panels are hidden.
- **Supabase**: NASA data cache, saved plans, farmer field reports. Run `supabase/schema.sql` in the Supabase SQL editor,
  then fill `web/.env.local` from `web/.env.example`.

Deploy: `vercel deploy --prod --yes` inside `web/` or `backend/` (two Vercel projects). Merge `main` first.

## Structure

```
web/src/
  app/
    page.tsx                  -> renders <Wizard/>
    icon.svg, favicon.ico, apple-icon.png, opengraph-image.png -> logo + link preview
    api/                      -> server routes (Next.js)
      geocode/, geocode/reverse  place search + pin -> "Town, Region, Country" (Nominatim)
      landcover/              -> ESA WorldCover: refuse water, warn on buildings
      environment/            -> 30-day soil moisture, rain, heat (NASA POWER) + slope (SRTM)
      soil/                   -> SoilGrids texture + soil health (last known result if SoilGrids is down)
      vegetation/             -> green cover, MODIS NDVI (via the Python API)
      replay/                 -> 20-season × 14-sowing-week risk grid (NASA POWER)
      history/                -> last 90 days vs the same 90 days in 20 past years: Dry / Normal / Wet
      outlook/, scenario/, rotation/ -> Python model API (risk outlook, what-if re-run, rotation crops + water)
      observations/           -> farmer field reports (validated against satellite, rate-limited)
      plans/                  -> save finished plans (idempotent)
      warm/                   -> wakes the Python API when the app opens
  components/
    Wizard.tsx                -> 7-step flow; owns the plan state (pin, crop/goals/constraints, sowing week, what-if)
    screens/                  -> one file per step
  lib/
    strategies.ts             -> rotation scoring (rules + measured water, soil, erosion, income)
    brief.ts                  -> EN / Burmese plan text + checklist (fixed template, no AI)
    shareCard.ts              -> shareable PNG plan card
    season.ts, confidence.ts  -> real sowing dates; calibrated "N in 10" chance
web/tests/                    -> npm test
backend/                      -> Python: FastAPI model API, engine (parity-tested with the web), risk model, evals
reports/                      -> accuracy report + charts
supabase/schema.sql           -> database schema
```

## Data sources

- **NASA POWER** daily point API (`community=AG`): `PRECTOTCORR` (rain), `T2M`, `T2M_MAX`, `GWETTOP`, `GWETROOT`
- **NASA MODIS NDVI** (MOD13Q1, 250 m, via Microsoft Planetary Computer): green cover
- **NASA SRTM** 30 m elevation (via OpenTopoData): slope
- **SoilGrids** (ISRIC): soil texture, organic carbon, pH · **ESA WorldCover**: land cover
- **Open-Meteo** seasonal forecast · **FAOSTAT** yields and prices (income estimate)
- **OpenStreetMap Nominatim**: place names · **Esri**: map imagery

## Accuracy and limits

Backtests at 73 sites and all model results are in [`backend/eval/REPORT.md`](backend/eval/REPORT.md) and
[`reports/`](reports/). Known limits:
- The risk model has no skill for drought in regions it was not trained on; outlook chances are only shown ≤ 30 days ahead.
- The seasonal forecast (30 days – ~4 months) is not validated by us.
- Rotation scores are rules plus measured inputs, not a trained model. "No new machinery" is a rule (plans adding a new
  crop score lower); "frost-sensitive" uses NASA temperature to avoid partner crops that met frost in > 1 of 10 seasons.
- Not integrated yet: SMAP and GPM IMERG (need an Earthdata login), ECOSTRESS, OpenET, local market prices.

## AI use

The app itself uses no AI/LLM. How AI tools were used to build it: [`AI_DECLARATION.md`](AI_DECLARATION.md).

## Team

The team's checklist is in [`tasks.md`](tasks.md).
