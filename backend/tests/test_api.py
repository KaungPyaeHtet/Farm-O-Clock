"""API tests — offline (NASA POWER is replaced by a synthetic climate)."""

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

import farm.location as loc
from app import main


def fake_power(lat, lng, start, end, params=None):
    idx = pd.date_range(pd.Timestamp(start), pd.Timestamp(end))
    rng = np.random.default_rng(int(abs(lat * 100)))
    doy = idx.day_of_year.to_numpy()
    wet = (doy > 150) & (doy < 260)
    rain = np.where(wet, 9.0, 0.6) * rng.gamma(1.2, 1.0, len(idx))
    tmax = 30 + 5 * np.sin(2 * np.pi * (doy - 100) / 365) + rng.normal(0, 2, len(idx))
    return pd.DataFrame({"PRECTOTCORR": rain, "T2M_MAX": tmax, "T2M": tmax - 7,
                         "GWETTOP": np.clip(0.3 + rain / 40, 0, 1), "GWETROOT": np.clip(0.4 + rain / 60, 0, 1)}, index=idx)


def fake_seasonal(lat, lng):
    # 12 months, 20% drier and +1.5 °C than the model's normal
    from datetime import date
    out, d = {}, date.today().replace(day=1)
    for _ in range(12):
        out[d.strftime("%Y-%m")] = {"p_anom": -20.0, "p_mean": 80.0, "t_anom": 1.5}
        d = (d.replace(day=28) + __import__("datetime").timedelta(days=4)).replace(day=1)
    return out


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(loc, "fetch_daily", fake_power)
    monkeypatch.setattr(loc, "monthly_anomalies", fake_seasonal)
    main._location.cache_clear()
    return TestClient(main.app)


def test_health(client):
    assert client.get("/health").json()["ok"] is True


def test_outlook_shape_and_ranges(client):
    r = client.post("/v1/outlook", json={"lat": 16.7, "lng": 95.6})
    assert r.status_code == 200
    o = r.json()
    assert len(o["weeks"]) == 14
    assert all(w["in_range"] == (w["lead_days"] <= 30) for w in o["weeks"])
    for w in o["weeks"]:
        for k in ("high_risk", "drought", "flood", "heat"):
            assert 0 <= w[k] <= 1
    fc = [w["forecast"] for w in o["weeks"] if w["forecast"]]
    assert o["seasonal_forecast"]["available"] and fc
    assert all(f["rain_pct"] == -20 and f["heat_c"] == 1.5 for f in fc)  # -20/(80-(-20)) = -20 %


def test_scenario_drier_is_not_safer(client):
    base = client.post("/v1/scenario", json={"lat": 16.7, "lng": 95.6}).json()
    dry = client.post("/v1/scenario", json={"lat": 16.7, "lng": 95.6, "rain_pct": -50}).json()
    assert sum(w["drought"] for w in dry["weeks"]) > sum(w["drought"] for w in base["weeks"])
    hot = client.post("/v1/scenario", json={"lat": 16.7, "lng": 95.6, "heat_c": 6}).json()
    assert sum(w["high_risk"] for w in hot["weeks"]) >= sum(w["high_risk"] for w in base["weeks"])


def test_validation(client):
    assert client.post("/v1/scenario", json={"lat": 95, "lng": 0}).status_code == 422
    assert client.post("/v1/scenario", json={"lat": 0, "lng": 0, "rain_pct": -500}).status_code == 422


def test_api_key(client, monkeypatch):
    monkeypatch.setattr(main, "API_KEY", "s3cret")
    assert client.post("/v1/outlook", json={"lat": 1, "lng": 1}).status_code == 401
    ok = client.post("/v1/outlook", json={"lat": 1, "lng": 1}, headers={"x-api-key": "s3cret"})
    assert ok.status_code == 200


def test_vegetation(client, monkeypatch):
    import farm.vegetation as veg
    idx = pd.date_range("2022-11-01", "2026-10-31", freq="16D")
    ndvi = 0.5 + 0.3 * np.sin(2 * np.pi * (idx.month.to_numpy() - 4) / 12)  # green Jul, bare Jan
    monkeypatch.setattr(main, "ndvi_series", lambda lat, lng: pd.Series(ndvi, index=idx))
    main._vegetation.cache_clear()
    v = client.post("/v1/vegetation", json={"lat": 1, "lng": 1}).json()
    assert v["cover"] in ("green", "sparse", "bare") and "Jan" in v["bare_months"] and "Jul" not in v["bare_months"]
    monkeypatch.setattr(main, "ndvi_series", lambda lat, lng: pd.Series(0.0, index=idx))
    main._vegetation.cache_clear()
    assert client.post("/v1/vegetation", json={"lat": 2, "lng": 2}).json()["cover"] == "water"


def test_water(client):
    r = client.post("/v1/water", json={"lat": 16.7, "lng": 95.6, "rotations": {
        "baseline": ["Rice", "Rice", "Rice"], "water": ["Rice", "Sorghum", "Rice"]}})
    assert r.status_code == 200
    w = r.json()["rotations"]
    assert w["water"]["need_mm"] < w["baseline"]["need_mm"]  # sorghum needs less than rice
    assert client.post("/v1/water", json={"lat": 1, "lng": 1, "rotations": {"x": ["Banana"]}}).status_code == 422


def test_rotation(client):
    r = client.post("/v1/rotation", json={"lat": 16.7, "lng": 95.6, "crop": "rice"})
    assert r.status_code == 200
    plans = r.json()["plans"]
    assert plans["baseline"]["rotation"] == ["Rice"] * 3
    assert plans["water"]["rotation"][1] != "Rice" and plans["soil"]["rotation"][1] != "Rice"
    for p in plans.values():
        assert p["water"]["irrigation_mm"] is not None and 0 <= p["low_risk_share"] <= 1
    assert client.post("/v1/rotation", json={"lat": 1, "lng": 1, "crop": "banana"}).status_code == 422
