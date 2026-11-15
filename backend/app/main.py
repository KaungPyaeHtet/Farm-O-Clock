"""Farm O'Clock model API (FastAPI).

Local:  .venv/bin/uvicorn app.main:app --reload --port 8000
Docs:   http://localhost:8000/docs
"""

from __future__ import annotations

import os
from datetime import date
from functools import lru_cache

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from farm import risk_model as RM
from farm.location import Location
from farm.vegetation import ndvi_series, summary as ndvi_summary
from farm.water import CROPS, rotation_water

app = FastAPI(title="Farm O'Clock API", version="1.0")
MODEL = RM.load()
API_KEY = os.environ.get("BACKEND_API_KEY")  # optional shared secret with the web app


def check_key(x_api_key: str | None = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Scenario(Point):
    rain_pct: float = Field(0, ge=-80, le=100, description="Rain change in %, e.g. -30 = 30% drier")
    heat_c: float = Field(0, ge=-6, le=8, description="Added to daily max temperature, °C")


@lru_cache(maxsize=64)
def _location(lat: float, lng: float, day: str) -> Location:
    return Location(lat, lng)


def location(lat: float, lng: float) -> Location:
    # ~1 km rounding so nearby pins share the NASA pull; refresh daily
    try:
        return _location(round(lat, 2), round(lng, 2), date.today().isoformat())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:  # NASA POWER down / timeout
        raise HTTPException(status_code=502, detail=f"NASA data unavailable: {e}") from e


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL["version"]}


@app.post("/v1/outlook", dependencies=[Depends(check_key)])
def outlook(p: Point):
    return location(p.lat, p.lng).outlook(MODEL)


@app.post("/v1/scenario", dependencies=[Depends(check_key)])
def scenario(s: Scenario):
    return location(s.lat, s.lng).scenario(s.rain_pct, s.heat_c)


@lru_cache(maxsize=64)
def _vegetation(lat: float, lng: float, day: str) -> dict:
    return ndvi_summary(ndvi_series(lat, lng))


@app.post("/v1/vegetation", dependencies=[Depends(check_key)])
def vegetation(p: Point):
    """Greenness (MODIS NDVI): cover now vs usual, and months the field is usually bare."""
    try:
        return _vegetation(round(p.lat, 3), round(p.lng, 3), date.today().isoformat())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Satellite imagery unavailable: {e}") from e


class Rotations(Point):
    rotations: dict[str, list[str]] = Field(description='e.g. {"baseline": ["Rice","Rice","Rice"]}')


@app.post("/v1/water", dependencies=[Depends(check_key)])
def water(r: Rotations):
    """FAO-56 crop water need and irrigation need (mm over 3 years) for each rotation,
    sown at this location's recommended week, averaged over the last 20 seasons."""
    loc = location(r.lat, r.lng)
    best = loc.weeks[loc.scenario()["best_week_index"]]
    out = {}
    for sid, crops in r.rotations.items():
        unknown = [c for c in crops if c.lower() not in CROPS]
        if unknown or not 1 <= len(crops) <= 4:
            raise HTTPException(status_code=422, detail=f"unknown crops {unknown}" if unknown else "1-4 crops")
        out[sid] = rotation_water(loc.df, r.lat, crops, best, loc.base)
    return {"sowing_doy": best, "rotations": out,
            "method": "FAO-56 Kc × Hargreaves ET0; effective rain FAO/AGLW; paddy percolation not included"}
