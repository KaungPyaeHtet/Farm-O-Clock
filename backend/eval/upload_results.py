"""Upload eval/results.json to Supabase `model_evals` so scores are versioned.

Usage (from backend/):
  SUPABASE_URL=... SUPABASE_SECRET_KEY=... .venv/bin/python -m eval.upload_results v1.1 "note"
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import requests


def main():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SECRET_KEY first (see backend/.env.example).")
    version = sys.argv[1] if len(sys.argv) > 1 else subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    metrics = json.loads((Path(__file__).parent / "results.json").read_text())
    r = requests.post(
        f"{url.rstrip('/')}/rest/v1/model_evals",
        headers={"apikey": key, "Content-Type": "application/json", "Prefer": "return=representation"},
        json={"model": "replay-engine+risk-models", "version": version, "metrics": metrics,
              "notes": sys.argv[2] if len(sys.argv) > 2 else None},
        timeout=60,
    )
    r.raise_for_status()
    print("uploaded", r.json()[0]["id"])


if __name__ == "__main__":
    main()
