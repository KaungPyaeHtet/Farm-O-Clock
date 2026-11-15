# Farm O'Clock — task checklist

Work top to bottom. Tick `[x]` as you go. **P0** = before the demo, **P1** = makes it strong, **P2** = nice to have.
Detail: `backend/README.md` (API, models, deploy), `reports/README.md` (accuracy + charts), `CLAUDE.md` (structure).

## Done (2026-11-15 session)
- [x] Brought `kaung/test` up to `origin/main`; removed test/boilerplate files; wrote root README, `CLAUDE.md`, memory notes
- [x] Found and fixed the risk-engine bug (Kenya/Ethiopia/Nevada were always "high risk"), in both TS and Python
- [x] Python backtests, 9 charts and CSVs → `reports/`; per-site checker `python -m eval.check_site LAT LNG`
- [x] **Python model API** (FastAPI): `/v1/outlook` (this year's risk per sowing week) + `/v1/scenario` (sliders re-run 20 seasons); Dockerfile; 11 tests
- [x] Web ↔ backend connected: `/api/outlook`, `/api/scenario` proxies; panels hide themselves if the backend is off
- [x] Outlook only shows % when sowing is ≤ 30 days away ("Too early to tell" otherwise); found in testing
- [x] Supabase: `supabase/schema.sql`, NASA-data cache, `/api/observations`; soil-damp answer saved as a farmer report
- [x] UI: EN/မြန်မာ switch (replaced "Science"), wide desktop layout, one risk vocabulary, no "how it's built" text
- [x] (later in session) Sections 3–8 below: deployed, models improved, NASA data added, validated on 73 sites, slides
- [x] Screens: place names instead of coordinates; condition cards with scales; past seasons heatmap; simpler rotation cards; new field illustration with rain animation; distinct crop icons; Plan page rebuilt (at-a-glance + checklist + share)

## 1. Before the demo (P0)
- [ ] **(you)** Click through all 7 steps on **phone width and desktop width**, in **both languages**, at 3 places (e.g. Maubin MM, Western Kenya, Mato Grosso BR) — I couldn't test the screens in a browser
- [x] Commit + push: merged straight into `main` (commits `a5a78b9`, `abc7791`, `867b7aa`; fast-forward, no PR)
- [ ] **(you)** Ask the frontend teammate to rebase `deva/redesign-agripulse` onto the new `main` (most screens changed)
- [x] Fixed the last lint error (`Screen1Map.tsx` search effect) — web app now lints clean
- [ ] **(you)** Optional: update the git remote to the renamed repo: `git remote set-url origin https://github.com/KaungPyaeHtet/NASA-2026-Challenge.git`
- [ ] **(you)** Optional: connect both Vercel projects to GitHub (Project → Settings → Git) so pushes auto-deploy; today I deploy with the CLI

## 2. Supabase (P0)
- [x] Supabase → SQL Editor → paste **`supabase/schema.sql`** → Run (verified 2026-11-15: 5 tables, function, private bucket)
- [ ] Rotate the legacy **JWT secret** (it was pasted in chat): Project Settings → JWT Keys
- [x] Put the **`sb_secret_…`** key in `web/.env.local` (done) and `backend/.env` (still empty; only needed for `upload_results`) (`SUPABASE_SECRET_KEY=`), and never in chat or git
- [x] Restart `npm run dev`; open step 4 twice for one place: 2nd load fast + rows in `nasa_cache` (2.8 s → 0.6 s)
- [x] Step 7 → answer the soil question → a row appears in `observations` (tested via API, auto-validated; test row deleted)

## 3. Deploy (P0)
- [x] Backend → **Vercel** (Python/FastAPI): https://farm-oclock-api.vercel.app — key-protected (`x-api-key`); Docker image also builds and runs (Cloud Run / Render still possible)
- [x] Web → **Vercel**: https://farm-oclock-five.vercel.app — env vars `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BACKEND_URL`, `BACKEND_API_KEY` set
- [ ] **(you)** Point the free **GoDaddy** domain at Vercel: tell me the domain and I'll add it on Vercel's side; then set the DNS records Vercel shows in GoDaddy
- [ ] Before presenting: open the app once (Vercel functions cold-start)

## 4. Models (P1) — all done 2026-11-15
- [x] Calibrated confidence: recent years weighted + correction curve → skill +0.071 vs +0.008 raw; app shows "about N in 10 seasons" (`eval/improvements.py`, `models/confidence_curve.json`)
- [x] Sowing-week jumps: candidate weeks anchored to the 1985+ record → big jumps 22 → 12 (crop-calendar anchoring still a possible upgrade)
- [x] Parity test `tests/test_parity.py`: Python == live web engine, 3 sites × 280 cells (found + fixed float-tie mismatches)
- [x] Seasonal forecast (Open-Meteo, 6 months, anomalies) for sowing weeks 30 days–6 months out — skill **not yet validated**
- [x] Farmer reports blended into soil moisture (10 km / 30 days; tested end to end, test rows deleted)

## 5. More NASA data (P1)
- [ ] **(you)** Create a free NASA Earthdata login (urs.earthdata.nasa.gov) → Generate Token → paste after `EARTHDATA_TOKEN=` in `backend/.env` (slot already added) → tell me, then I build: SMAP L4 soil moisture vs POWER `GWETTOP`
- [ ] **(blocked on the same login)** GPM IMERG rain vs POWER `PRECTOTCORR`
- [x] MODIS NDVI (Planetary Computer) → "Green cover" card: now vs usual (stress), usual bare months, water-pin warning
- [x] SoilGrids → "Soil" card (texture, organic matter, pH) + soil-health start of each rotation

## 6. Rotation model (P1)
- [x] FAO-56 Kc × Hargreaves ET₀ water use per rotation (`farm/water.py`) → measured "Water" rating + "extra water needed" line; now served through `/v1/rotation` (web `/api/water` removed); `scoreStrategies(...)` shape kept
- [x] Partner crops data-driven per pin (`farm/rotation.py`): low-risk share of the crop's own season + FAO-56 irrigation + ECOCROP temperature fit; field pea no longer picked in hot climates
- [x] Tried AquaCrop-OSPy: runs (20 seasons in 6 s) but uncalibrated misses Iowa 2012 (−4 % vs ~−25 %) → **not shipped**; revisit with district yields
- [x] Burmese names for every rotation crop
- [ ] **(you / a native speaker)** Check the less common Burmese crop names in `web/src/lib/strategies.ts` (`CROP_MY`: cover crops, pulses)

## 7. Plan text (P2)
- [x] Decided: no AI/LLM API and no "Listen" voice in the app. The plan text is the built-in English/Burmese template (`web/src/lib/brief.ts`)
- [x] Share picture redesigned: cards (sow date + chance, season, plan, extra water, soil, 3-year tiles, numbered checklist), no emoji

## 7b. Later in the session (2026-11-15) — all done
- [x] Sowing dates are real future dates ("5 Aug 2027 · in 9 months"); passed weeks greyed; "best" = best week still ahead (`web/src/lib/season.ts`)
- [x] Past seasons: the year × week heatmap on phone AND desktop (fixed-size squares, week labels, low-risk count per week)
- [x] Map: country/city/town labels over the satellite photo, "Use my location" button, draggable pin
- [x] Rotation partner crops picked from data per pin (not a fixed table); resilience from measured low-risk share; held-out: better in 95 % / 79 % of cases (`eval/partner_eval.py`)
- [x] Pins in water are refused (ESA WorldCover 10 m; tap, drag, location, search); towns get a warning
- [x] Plan reason shows this pin's own numbers (seasons that went well, water saved)
- [x] Supabase fully used: `nasa_cache`, `observations`, now also `fields` + `plans` (each finished plan, anonymous, ~100 m) and `model_evals` (scores uploaded)

## 8. Validation and pitch (P1)
- [x] Yield ground truth: FAOSTAT national yields → engine stress vs yield Spearman −0.30 (133 site-years), Iowa 2012 caught; recommended-week outcome **not** visible in national yields (`eval/yield_check.py`)
- [x] 73 sites + spatial hold-out (`eval/scale_eval.py`): recommended week 36 % vs 28 % low-risk; unseen regions flood +13 %, heat +16 %, drought 0 %
- [x] Slides: 9-slide results deck (link in chat) — share it from its Share menu for teammates
- [x] Corrected project summary written (in chat): removed SMAP/ECOSTRESS/GPM, XGBoost and "voice" claims; added 73-site and FAOSTAT evidence
- [ ] **(you)** Paste the corrected summary into the Space Apps submission
- [ ] Optional: add the new results to the deck (data-driven partner crops 95 % / 79 %, water-pin check) — say if you want it
- [ ] Next validation: district- or field-level yields (Myanmar DoA, USDA NASS county with an API key) to test the sowing week itself
- [ ] Possible next: data-driven erosion/income scores (still fixed rules), crop-calendar anchoring for sowing weeks
