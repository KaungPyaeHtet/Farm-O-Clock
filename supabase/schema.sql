-- =====================================================================
-- Farm O'Clock — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
--
-- Security model: Row Level Security is ON for every table and there are
-- NO public (anon) policies. The browser never talks to Supabase directly;
-- only our server code (Next.js API routes on Vercel, Python on Cloud Run)
-- does, using the SECRET key, which bypasses RLS. So nothing is readable or
-- writable with the public/publishable key.
-- =====================================================================

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Fields: a pinned farm + what the farmer told us (screen 1 + 3)
-- ---------------------------------------------------------------------
create table if not exists public.fields (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  geom        extensions.geography(point, 4326)
              generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  crop        text,
  goals       text[] not null default '{}',
  constraints text[] not null default '{}',
  lang        text not null default 'en' check (lang in ('en', 'my'))
);
create index if not exists fields_geom_idx on public.fields using gist (geom);

-- ---------------------------------------------------------------------
-- 2. Plans: the recommendation we showed (screens 5–7)
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  field_id     uuid not null references public.fields(id) on delete cascade,
  sowing_week  text,                       -- e.g. '8 Jun'
  strategy_id  text check (strategy_id in ('baseline', 'water', 'soil')),
  verdict      text check (verdict in ('dry', 'normal', 'wet')),
  scores       jsonb not null default '{}', -- strategy scores at time of advice
  model        text not null default 'rules-v1.1'
);
create index if not exists plans_field_idx on public.plans (field_id);

-- ---------------------------------------------------------------------
-- 3. Field observations from farmers (improvement #1: ground truth that
--    calibrates the satellite estimate for the whole community)
-- ---------------------------------------------------------------------
create table if not exists public.observations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  observed_on   date not null default current_date,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  geom          extensions.geography(point, 4326)
                generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  field_id      uuid references public.fields(id) on delete set null,
  soil_moisture text check (soil_moisture in ('dry', 'damp', 'wet', 'flooded')),
  flooding      boolean,
  crop_stage    text check (crop_stage in ('bare', 'sown', 'growing', 'flowering', 'harvested')),
  crop_health   text check (crop_health in ('good', 'stressed', 'failed')),
  note          text check (char_length(note) <= 500),
  photo_path    text,                       -- path in the 'observation-photos' bucket
  -- what the satellites said at that spot when the farmer reported (for validation)
  satellite     jsonb not null default '{}',
  status        text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  status_reason text
);
create index if not exists observations_geom_idx on public.observations using gist (geom);
create index if not exists observations_day_idx  on public.observations (observed_on desc);

-- Simple automatic validation: reject impossible dates; flag reports that
-- disagree strongly with satellite soil wetness for human/model review.
create or replace function public.validate_observation()
returns trigger language plpgsql as $$
declare sat_wet double precision := (new.satellite ->> 'gwettop')::double precision;
begin
  if new.observed_on > current_date + 1 or new.observed_on < current_date - 30 then
    new.status := 'rejected';
    new.status_reason := 'observation date out of range';
  elsif sat_wet is not null and (
        (new.soil_moisture = 'flooded' and sat_wet < 0.2) or
        (new.soil_moisture = 'dry'     and sat_wet > 0.9)) then
    new.status := 'pending';
    new.status_reason := 'disagrees with satellite — needs review';
  elsif new.soil_moisture is not null then
    new.status := 'validated';
    new.status_reason := 'consistent with satellite range';
  end if;
  return new;
end $$;

drop trigger if exists observations_validate on public.observations;
create trigger observations_validate
  before insert on public.observations
  for each row execute function public.validate_observation();

-- Community summary near a point (used by GET /api/observations).
-- Returns counts only — no individual reports, no notes.
create or replace function public.observation_summary(
  p_lat double precision, p_lng double precision,
  p_radius_km double precision default 10, p_days int default 30)
returns table (soil_moisture text, reports bigint, latest date)
language sql stable as $$
  select o.soil_moisture, count(*)::bigint, max(o.observed_on)
  from public.observations o
  where o.status = 'validated'
    and o.observed_on >= current_date - p_days
    and extensions.st_dwithin(
          o.geom,
          extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          p_radius_km * 1000)
  group by o.soil_moisture
$$;

-- ---------------------------------------------------------------------
-- 4. NASA data cache: one row per endpoint × ~0.1° grid cell
--    (a 20-year POWER pull takes seconds; cache it for the demo)
-- ---------------------------------------------------------------------
create table if not exists public.nasa_cache (
  key         text primary key,            -- e.g. 'replay:16.8:95.7'
  endpoint    text not null,
  lat_cell    double precision not null,
  lng_cell    double precision not null,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists nasa_cache_expiry_idx on public.nasa_cache (expires_at);

-- ---------------------------------------------------------------------
-- 5. Model evaluations (backend/eval results, so scores are versioned)
-- ---------------------------------------------------------------------
create table if not exists public.model_evals (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  model       text not null,               -- e.g. 'replay-engine', 'risk-logreg'
  version     text not null,               -- e.g. 'v1.1', git sha
  metrics     jsonb not null,              -- contents of eval/results.json
  notes       text
);

-- ---------------------------------------------------------------------
-- 6. Photo storage bucket (private)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('observation-photos', 'observation-photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 7. Lock it down: RLS on, no anon/authenticated policies.
-- ---------------------------------------------------------------------
alter table public.fields       enable row level security;
alter table public.plans        enable row level security;
alter table public.observations enable row level security;
alter table public.nasa_cache   enable row level security;
alter table public.model_evals  enable row level security;

revoke execute on function public.observation_summary(double precision, double precision, double precision, int) from public, anon, authenticated;
revoke execute on function public.validate_observation() from public, anon, authenticated;

-- Housekeeping you can schedule later (Database → Cron):
--   delete from public.nasa_cache where expires_at < now();
