"""Season-risk model: logistic regression per hazard, stored as plain JSON.

Feature definitions match backend/eval/run_eval.py (E3) so the evaluated model
and the served model are the same thing. JSON (not pickle) keeps the server
free of sklearn-version coupling: inference is a dot product.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "risk_logreg_v1.json"

FEATURES = ["rain30_z", "rain60_z", "rain90_z", "root30_z", "top30_z", "t2m30_z", "tmax30_z",
            "root30", "top30", "doy_sin", "doy_cos", "abs_lat", "annual_rain", "year", "clim"]
TARGETS = ["y_alert", "y_drought", "y_flood", "y_heat"]


def save(models: dict, meta: dict, path: Path = MODEL_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"features": FEATURES, "targets": models, **meta}, indent=1))


def load(path: Path = MODEL_PATH) -> dict:
    return json.loads(path.read_text())


def predict(model: dict, X: pd.DataFrame, target: str) -> np.ndarray:
    """P(target) for each row. X must contain model['features'] (NaN -> 0, as in training)."""
    m = model["targets"][target]
    feats = model["features"]
    x = X[feats].fillna(0).to_numpy(float)
    z = (x - np.array(m["mean"])) / np.array(m["scale"])
    logit = z @ np.array(m["coef"]) + m["intercept"]
    return 1 / (1 + np.exp(-logit))
