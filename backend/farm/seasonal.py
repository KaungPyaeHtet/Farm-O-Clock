"""Seasonal forecast (Open-Meteo Seasonal API, no key; CC BY 4.0, non-commercial use).

We only use the *anomalies* (forecast minus the forecast model's own climate), so the
model's rainfall bias versus NASA POWER cancels out. For a sowing date we turn the months
covering its 90-day growing window into a delta: rain_pct (% wetter/drier) and heat_c (°C),
which farm.location applies to the 20 past seasons, exactly like the what-if sliders.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import requests

from farm.power import CACHE

URL = "https://seasonal-api.open-meteo.com/v1/seasonal"
RAIN_CLAMP = (-60.0, 100.0)
HEAT_CLAMP = (-4.0, 6.0)


def monthly_anomalies(lat: float, lng: float) -> dict[str, dict]:
    """{'2026-11': {'p_anom': mm, 'p_mean': mm, 't_anom': K}, ...} — cached per day."""
    CACHE.mkdir(parents=True, exist_ok=True)
    key = Path(CACHE) / f"seasonal_{lat:.2f}_{lng:.2f}_{date.today().isoformat()}.json"
    if key.exists():
        return json.loads(key.read_text())
    r = requests.get(URL, params={"latitude": lat, "longitude": lng,
                                  "monthly": "precipitation_anomaly,precipitation_mean,temperature_2m_anomaly"},
                     timeout=30)
    r.raise_for_status()
    m = r.json()["monthly"]
    out = {}
    for i, t in enumerate(m["time"]):
        pa, pm, ta = m["precipitation_anomaly"][i], m["precipitation_mean"][i], m["temperature_2m_anomaly"][i]
        if None not in (pa, pm, ta):
            out[t[:7]] = {"p_anom": pa, "p_mean": pm, "t_anom": ta}
    key.write_text(json.dumps(out))
    return out


def window_delta(months: dict[str, dict], start: date, days: int = 90, min_cover: int = 60) -> dict | None:
    """Rain % and heat °C for the growing window starting at `start`, or None if the
    forecast covers fewer than `min_cover` of its days."""
    covered, p_anom, p_clim, t_sum = 0, 0.0, 0.0, 0.0
    for k in range(days):
        d = start + timedelta(days=k)
        m = months.get(d.strftime("%Y-%m"))
        if not m:
            continue
        n_days = ((d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)).day
        covered += 1
        p_anom += m["p_anom"] / n_days
        p_clim += (m["p_mean"] - m["p_anom"]) / n_days
        t_sum += m["t_anom"]
    if covered < min_cover:
        return None
    rain_pct = 100 * p_anom / p_clim if p_clim > 1 else 0.0  # dry-season windows: ignore tiny totals
    return {
        "rain_pct": round(max(RAIN_CLAMP[0], min(RAIN_CLAMP[1], rain_pct))),
        "heat_c": round(max(HEAT_CLAMP[0], min(HEAT_CLAMP[1], t_sum / covered)), 1),
        "days_covered": covered,
    }
