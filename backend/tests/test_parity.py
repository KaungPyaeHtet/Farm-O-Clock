"""Parity: Python engine == the web app's /api/replay, cell by cell, at 3 sites.

Runs only when PARITY_WEB_URL is set (needs the web app + live NASA POWER):
  PARITY_WEB_URL=http://localhost:3000 .venv/bin/python -m pytest tests/test_parity.py -v
"""

import json
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

from farm import replay as R
from farm.power import fetch_daily

WEB = os.environ.get("PARITY_WEB_URL")
SITES = [(16.7, 95.6), (0.3, 34.7), (-12.5, -55.7)]  # Ayeyarwady, W. Kenya, Mato Grosso (0.1° → same cache cell)

pytestmark = pytest.mark.skipif(not WEB, reason="set PARITY_WEB_URL to run the parity test")


@pytest.mark.parametrize("lat,lng", SITES)
def test_replay_matches_web(lat, lng):
    from pathlib import Path

    curve = json.loads((Path(__file__).parent.parent / "models" / "confidence_curve.json").read_text())
    web = requests.get(f"{WEB}/api/replay", params={"lat": lat, "lng": lng}, timeout=120).json()
    end = datetime.now(timezone.utc).date() - timedelta(days=5)
    df = fetch_daily(lat, lng, f"{R.CLIM_START_YEAR}0101", end.strftime("%Y%m%d"), ["PRECTOTCORR", "T2M_MAX"])
    py = R.replay_like_web(df, end.year, curve)

    assert [w["startDoy"] for w in web["weeks"]] == py["weeks"]
    assert [y["year"] for y in web["years"]] == py["years"]
    cells = [(y["year"], i, c["risk"]) for y in web["years"] for i, c in enumerate(y["cells"])]
    mismatched = [(yr, i, r, py["grid"][(yr, i)]) for yr, i, r in cells if py["grid"][(yr, i)] != r]
    assert not mismatched, f"{len(mismatched)}/{len(cells)} cells differ, e.g. {mismatched[:3]}"
    assert web["bestWeekIndex"] == py["bestWeekIndex"]
    for w, p in zip(web["weekAgg"], py["weekAgg"]):
        assert w["risk"] == p["risk"] and w["goodCount"] == p["goodCount"]
        for k in ("drought", "flood", "heat"):
            assert abs(w[k] - p[k]) <= 1  # JS Math.round vs Python banker's rounding
        assert (w["chance"] is None) == (p["chance"] is None)
        if w["chance"] is not None:
            assert abs(w["chance"] - p["chance"]) < 1e-6
