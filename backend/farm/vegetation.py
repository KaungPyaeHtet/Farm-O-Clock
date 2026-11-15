"""Field greenness from MODIS NDVI (MOD13Q1 + MYD13Q1, 250 m, 16-day; Microsoft Planetary Computer).

- bare-field periods: calendar months whose typical NDVI is below BARE (mostly bare soil)
- crop stress: latest clear composite vs the same time of year in earlier years
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from farm.power import CACHE

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
BARE = 0.30  # NDVI below this ≈ bare / very sparse cover
STRESS = -0.10  # this much below the usual NDVI for the date = stressed
YEARS = 4


POINT = "https://planetarycomputer.microsoft.com/api/data/v1/item/point/{lng},{lat}"


def _search(lat: float, lng: float, start: date, end: date) -> list[dict]:
    """STAC search (plain HTTP, paginated) for MODIS Terra 16-day composites over the point."""
    body = {"collections": ["modis-13Q1-061"], "intersects": {"type": "Point", "coordinates": [lng, lat]},
            "datetime": f"{start.isoformat()}/{end.isoformat()}", "limit": 250}
    url, feats = f"{STAC}/search", []
    while url:
        r = requests.post(url, json=body, timeout=30)
        r.raise_for_status()
        page = r.json()
        feats += page.get("features", [])
        nxt = next((l for l in page.get("links", []) if l.get("rel") == "next"), None)
        url, body = (nxt["href"], nxt.get("body", body)) if nxt else (None, None)
    return [f for f in feats if f["id"].startswith("MOD13Q1")]  # Terra only: same 16-day cadence, half the reads


def _read(feat: dict, lat: float, lng: float) -> tuple[str, float | None]:
    """Pixel value via Planetary Computer's data API — no GDAL/rasterio needed (serverless-friendly)."""
    day = feat["properties"]["start_datetime"][:10]
    try:
        r = requests.get(POINT.format(lat=lat, lng=lng), timeout=30, params={
            "collection": "modis-13Q1-061", "item": feat["id"],
            "assets": ["250m_16_days_NDVI", "250m_16_days_pixel_reliability"]})
        r.raise_for_status()
        ndvi_raw, rel = r.json()["values"][:2]
        ndvi = ndvi_raw * 0.0001
        ok = rel in (0, 1) and -0.2 <= ndvi <= 1  # 0 good, 1 marginal, 2 snow, 3 cloud
        return day, ndvi if ok else None
    except Exception:
        return day, None


def ndvi_series(lat: float, lng: float, years: int = YEARS) -> pd.Series:
    """Clear-sky NDVI time series at a point (cached per day)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    key = Path(CACHE) / f"ndvi_{lat:.3f}_{lng:.3f}_{years}_{date.today().isoformat()}.json"
    if key.exists():
        data = json.loads(key.read_text())
    else:
        feats = _search(lat, lng, date.today() - timedelta(days=365 * years), date.today())
        with ThreadPoolExecutor(max_workers=16) as ex:
            data = dict(ex.map(lambda f: _read(f, lat, lng), feats))
        key.write_text(json.dumps(data))
    return pd.Series({pd.Timestamp(k): v for k, v in data.items() if v is not None}).sort_index()


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def summary(s: pd.Series) -> dict:
    if len(s) < 20:
        raise ValueError("Not enough clear satellite views here")
    if float(s.median()) < 0.1:
        return {"cover": "water", "views": int(len(s))}  # pin is on a river/lake/sea pixel
    monthly = s.groupby(s.index.month).median().reindex(range(1, 13))
    bare = [MONTHS[m - 1] for m, v in monthly.items() if pd.notna(v) and v < BARE]
    latest_t, latest = s.index[-1], float(s.iloc[-1])
    # usual = earlier years, within ±16 days of the same day-of-year
    doy = latest_t.day_of_year
    prev = s[(s.index.year < latest_t.year)]
    d = np.abs(((prev.index.day_of_year - doy) + 182) % 365 - 182)
    usual_vals = prev[d <= 16]
    usual = float(usual_vals.median()) if len(usual_vals) >= 3 else None
    diff = None if usual is None else latest - usual
    return {
        "latest": {"date": latest_t.date().isoformat(), "ndvi": round(latest, 3)},
        "usual_for_date": None if usual is None else round(usual, 3),
        "difference": None if diff is None else round(diff, 3),
        "stressed": bool(diff is not None and diff <= STRESS),
        "cover": "bare" if latest < BARE else "sparse" if latest < 0.5 else "green",
        "bare_months": bare,
        "monthly_ndvi": {MONTHS[m - 1]: (None if pd.isna(v) else round(float(v), 3)) for m, v in monthly.items()},
        "views": int(len(s)),
    }
