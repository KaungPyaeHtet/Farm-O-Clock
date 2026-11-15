# Farm O'Clock — NASA Space Apps 2026

A mobile-first web app for farmers and extension workers. You drop a pin on a field anywhere
on Earth. The app pulls 20+ years of NASA data for that spot, replays past seasons to estimate
drought, flood and heat risk, and recommends a sowing window. It also compares 3 crop-rotation
strategies and ends with a plain-language English/Burmese brief and a field-check checklist.

## Run it

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

No API keys are needed. Every data source is open. Supabase is optional: it adds a NASA data cache and farmer
observations. Run `supabase/schema.sql` in the Supabase SQL editor, then fill `web/.env.local` from `web/.env.example`.
The team's to-do list is in [`tasks.md`](tasks.md). Model accuracy is in [`backend/eval/REPORT.md`](backend/eval/REPORT.md).

## Structure

```
web/src/
  app/
    page.tsx                  -> renders <Wizard/>
    api/                      -> backend (Next.js route handlers, server-side)
      geocode/route.ts        -> place search (OpenStreetMap Nominatim)
      environment/route.ts    -> 30-day soil moisture, rain, heat (NASA POWER) + slope (SRTM)
      replay/route.ts         -> 20-year x 14-sowing-week risk replay (NASA POWER)
      history/route.ts        -> this season vs 20-yr baseline: Dry / Normal / Wet
      observations/route.ts   -> farmer field reports (Supabase)
  components/
    Wizard.tsx                -> 7-step flow, state, back-button handling
    screens/                  -> one file per step (see below)
  lib/
    strategies.ts             -> rotation scoring heuristic (placeholder for the ML model)
    brief.ts                  -> EN/Burmese brief + checklist template (placeholder for an LLM)
    shareCard.ts              -> shareable PNG plan card
    i18n.tsx                  -> EN / Burmese toggle
    supabase.ts, fetchJson.ts -> server DB client + NASA cache; client request cache
backend/                      -> Python: engine port, tests, backtests (eval/REPORT.md), model plan
supabase/schema.sql           -> database schema to paste into Supabase
```

| Step | Screen | Data |
|---|---|---|
| 1 | `Screen1Map` — search or drop a pin | `/api/geocode` |
| 2 | `Screen2Environment` — soil moisture, rain, heat, slope cards | `/api/environment` |
| 3 | `Screen3CropGoals` — crop, 1–2 goals, constraints | local |
| 4 | `SeasonReplay` — years x sowing-weeks risk grid + Dry/Normal/Wet block | `/api/replay`, `/api/history` |
| 5 | `SowingCalendar` — draggable sowing date + confidence | `/api/replay` |
| 6 | `Screen5RotationCompare` — 3 strategies + Rain/Heat what-if sliders | `lib/strategies.ts` |
| 7 | `Screen6Guidance` — brief, terms, checklist, voice, share, soil check | `/api/history`, `/api/replay`, `/api/observations`, `lib/brief.ts` |

## Data sources in use

- **NASA POWER** (daily point API, `community=AG`): `GWETTOP` (topsoil wetness), `PRECTOTCORR`
  (rain), `T2M`, `T2M_MAX`
- **SRTM 30 m elevation**, through OpenTopoData, for slope
- **OpenStreetMap Nominatim** for geocoding

## Not built yet

- The rotation scores use rules plus measured FAO-56 water use and SoilGrids soil data. The plan text is a fixed
  English/Burmese template; by choice, the app uses no AI/LLM API.
- Not integrated yet: SMAP and GPM IMERG (need an Earthdata login), ECOSTRESS, OpenET, market prices.
