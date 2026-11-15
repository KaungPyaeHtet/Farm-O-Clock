"""NASA POWER daily point API client with a local JSON cache."""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import requests

# Serverless hosts (Vercel) only allow writes to /tmp.
CACHE = Path("/tmp/power-cache") if os.environ.get("VERCEL") else Path(__file__).resolve().parent.parent / ".cache"
FILL = -999.0
PARAMS = ["PRECTOTCORR", "T2M_MAX", "T2M", "GWETTOP", "GWETROOT"]
URL = "https://power.larc.nasa.gov/api/temporal/daily/point"


def fetch_daily(lat: float, lng: float, start: str, end: str,
                params: list[str] = PARAMS) -> pd.DataFrame:
    """Return a date-indexed DataFrame, one column per parameter. Fill values (-999) are NaN."""
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / f"{lat:.3f}_{lng:.3f}_{start}_{end}_{'-'.join(params)}.json"
    if key.exists():
        data = json.loads(key.read_text())
    else:
        r = requests.get(URL, params={
            "parameters": ",".join(params), "community": "AG",
            "latitude": lat, "longitude": lng,
            "start": start, "end": end, "format": "JSON",
        }, timeout=180)
        r.raise_for_status()
        data = r.json()["properties"]["parameter"]
        key.write_text(json.dumps(data))
    df = pd.DataFrame({p: pd.Series(data[p]) for p in params})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.replace(FILL, np.nan).astype(float).sort_index()
