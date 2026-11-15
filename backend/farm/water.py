"""Crop water use per rotation (FAO-56 single crop coefficient method).

ET0: Hargreaves-Samani (FAO-56 eq. 52) from NASA POWER daily Tmax/Tmean, with
Tmin ≈ 2·Tmean − Tmax. ETc = Kc(stage) × ET0. Effective rain: FAO/USDA monthly
formula. Irrigation need = Σ max(0, ETc − effective rain), averaged over 20 seasons.
Kc and stage lengths: FAO-56 Tables 11-12 (approximate for crops not listed there).
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

# (L_ini, L_dev, L_mid, L_late) days, (Kc_ini, Kc_mid, Kc_end)
CROPS: dict[str, tuple[tuple[int, int, int, int], tuple[float, float, float]]] = {
    "rice": ((30, 30, 60, 30), (1.05, 1.20, 0.90)),
    "wheat": ((20, 25, 60, 30), (0.40, 1.15, 0.40)),
    "maize": ((25, 40, 40, 30), (0.30, 1.20, 0.60)),
    "soybean": ((20, 30, 60, 25), (0.40, 1.15, 0.50)),
    "cotton": ((30, 50, 55, 45), (0.35, 1.18, 0.60)),
    "potato": ((25, 30, 45, 30), (0.50, 1.15, 0.75)),
    "vegetables": ((30, 40, 40, 25), (0.60, 1.15, 0.80)),
    "sugarcane": ((35, 60, 190, 80), (0.40, 1.25, 0.75)),
    "sorghum": ((20, 35, 40, 30), (0.30, 1.00, 0.55)),
    "chickpea": ((20, 25, 35, 25), (0.40, 1.00, 0.35)),
    "pigeon pea": ((20, 30, 60, 40), (0.40, 1.00, 0.45)),
    "millet": ((15, 25, 40, 25), (0.30, 1.00, 0.30)),
    "cowpea": ((20, 30, 30, 20), (0.40, 1.05, 0.60)),
    "mung bean": ((20, 30, 30, 20), (0.40, 1.05, 0.60)),
    "lentil": ((20, 30, 60, 40), (0.40, 1.10, 0.30)),
    "clover (cover)": ((10, 30, 60, 20), (0.40, 0.90, 0.85)),
    "field pea": ((15, 25, 35, 15), (0.50, 1.15, 0.30)),
    "sunn hemp (cover)": ((20, 30, 40, 20), (0.40, 1.00, 0.60)),
}


def kc_curve(crop: str) -> np.ndarray:
    (li, ld, lm, ll), (ki, km, ke) = CROPS[crop]
    return np.concatenate([
        np.full(li, ki), np.linspace(ki, km, ld, endpoint=False),
        np.full(lm, km), np.linspace(km, ke, ll),
    ])


def et0_hargreaves(df: pd.DataFrame, lat: float) -> pd.Series:
    """FAO-56 eq. 52; Ra from eqs. 21-25 (mm/day equivalent)."""
    tmax, tmean = df["T2M_MAX"], df["T2M"]
    tmin = 2 * tmean - tmax
    j = df.index.day_of_year.to_numpy()
    phi = np.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * j / 365)
    dec = 0.409 * np.sin(2 * np.pi * j / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    ra = (24 * 60 / np.pi) * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    ra_mm = 0.408 * ra
    et0 = 0.0023 * (tmean + 17.8) * np.sqrt(np.clip(tmax - tmin, 0, None)) * ra_mm
    return pd.Series(np.clip(et0, 0, None), index=df.index)


def effective_rain_daily(rain: pd.Series) -> pd.Series:
    """FAO/AGLW monthly formula applied per month, spread back to days."""
    monthly = rain.resample("MS").sum()
    pe = np.where(monthly <= 70, np.clip(0.6 * monthly - 10, 0, None), 0.8 * monthly - 24)
    frac = pd.Series(np.where(monthly > 0, pe / monthly.replace(0, np.nan), 0), index=monthly.index).fillna(0)
    return rain * frac.reindex(rain.index, method="ffill").fillna(0)


def season_water(df: pd.DataFrame, lat: float, crop: str, start_doy: int, years: list[int]) -> dict:
    """Mean crop water need, effective rain and irrigation need (mm) for one season."""
    kc = kc_curve(crop)
    et0 = et0_hargreaves(df, lat)
    pe = effective_rain_daily(df["PRECTOTCORR"].fillna(0))
    need, rain, irr = [], [], []
    for y in years:
        start = date(y, 1, 1) + timedelta(days=start_doy - 1)
        idx = pd.date_range(start, periods=len(kc))
        e = et0.reindex(idx)
        if e.isna().mean() > 0.2:
            continue
        etc = kc * e.fillna(e.mean()).to_numpy()
        p = pe.reindex(idx).fillna(0).to_numpy()
        need.append(etc.sum()); rain.append(p.sum()); irr.append(np.clip(etc - p, 0, None).sum())
    if not need:
        return {"need_mm": None, "effective_rain_mm": None, "irrigation_mm": None, "days": len(kc)}
    return {"need_mm": round(float(np.mean(need))), "effective_rain_mm": round(float(np.mean(rain))),
            "irrigation_mm": round(float(np.mean(irr))), "days": len(kc)}


def rotation_water(df: pd.DataFrame, lat: float, rotation: list[str], start_doy: int, years: list[int]) -> dict:
    """3-year totals for a rotation (one season per year, sown at start_doy)."""
    seasons = [season_water(df, lat, c.lower(), start_doy, years) for c in rotation]
    ok = [s for s in seasons if s["irrigation_mm"] is not None]
    return {
        "seasons": seasons,
        "need_mm": sum(s["need_mm"] for s in ok) if ok else None,
        "effective_rain_mm": sum(s["effective_rain_mm"] for s in ok) if ok else None,
        "irrigation_mm": sum(s["irrigation_mm"] for s in ok) if ok else None,
    }
