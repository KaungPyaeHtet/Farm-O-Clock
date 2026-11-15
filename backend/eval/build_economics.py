"""Builds web/src/lib/crop-economics.json: typical yield (t/ha) and farm-gate price (USD/t)
per country and crop, from FAOSTAT bulk files (Production + Producer Prices), mean of the
latest 5 years available. Used for the rotation plans' income score.

  .venv/bin/python -I eval/build_economics.py PROD.zip PRICES.zip OUT.json
"""

import csv
import io
import json
import statistics
import sys
import zipfile

import pycountry

# app crop name → FAO item (proxies noted)
ITEMS = {
    "Rice": "Rice", "Wheat": "Wheat", "Maize": "Maize (corn)", "Soybean": "Soya beans",
    "Cotton": "Seed cotton, unginned", "Potato": "Potatoes", "Vegetables": "Tomatoes",  # proxy
    "Sugarcane": "Sugar cane", "Sorghum": "Sorghum", "Millet": "Millet", "Chickpea": "Chick peas, dry",
    "Pigeon pea": "Pigeon peas, dry", "Cowpea": "Cow peas, dry", "Mung bean": "Beans, dry",  # proxy
    "Lentil": "Lentils, dry", "Field pea": "Peas, dry",
}
FAO2APP = {v: k for k, v in ITEMS.items()}


def m49_to_iso2(m49: str) -> str | None:
    c = pycountry.countries.get(numeric=m49.strip("'").zfill(3))
    return c.alpha_2 if c else None


def read(zpath: str, element: str, unit_scale) -> dict:
    z = zipfile.ZipFile(zpath)
    name = [n for n in z.namelist() if "All_Data" in n and n.endswith(".csv")][0]
    out: dict = {}
    with z.open(name) as f:
        for row in csv.DictReader(io.TextIOWrapper(f, encoding="latin-1")):
            if row["Element"] != element or row["Item"] not in FAO2APP:
                continue
            if row.get("Months") not in (None, "Annual value"):
                continue
            iso = m49_to_iso2(row["Area Code (M49)"])
            try:
                v = float(row["Value"])
            except ValueError:
                continue
            if not iso or v <= 0 or int(row["Year"]) < 2014:
                continue
            out.setdefault((iso, FAO2APP[row["Item"]]), {})[int(row["Year"])] = unit_scale(v, row.get("Unit", ""))
    return out


def recent_mean(series: dict) -> float:
    ys = sorted(series)[-5:]
    return statistics.mean(series[y] for y in ys)


def main():
    prod_zip, price_zip, out = sys.argv[1:4]
    yields = read(prod_zip, "Yield", lambda v, u: v / 1000 if u.startswith("kg") else v / 10000 if u == "100 g/ha" else v)
    prices = read(price_zip, "Producer Price (USD/tonne)", lambda v, u: v)
    countries: dict = {}
    for (iso, crop), ser in yields.items():
        countries.setdefault(iso, {})[crop] = {"yield_t_ha": round(recent_mean(ser), 2)}
    for (iso, crop), ser in prices.items():
        countries.setdefault(iso, {}).setdefault(crop, {})["price_usd_t"] = round(recent_mean(ser))
    world = {}
    for crop in ITEMS:
        ys = [c[crop]["yield_t_ha"] for c in countries.values() if crop in c and "yield_t_ha" in c[crop]]
        ps = [c[crop]["price_usd_t"] for c in countries.values() if crop in c and "price_usd_t" in c[crop]]
        world[crop] = {"yield_t_ha": round(statistics.median(ys), 2) if ys else None,
                       "price_usd_t": round(statistics.median(ps)) if ps else None}
    json.dump({"source": "FAOSTAT Production + Producer Prices (bulk, latest 5 years per country)",
               "proxies": {"Vegetables": "Tomatoes", "Mung bean": "Beans, dry"},
               "world": world, "countries": countries}, open(out, "w"), separators=(",", ":"))
    print(len(countries), "countries;", "world:", {k: (v["yield_t_ha"], v["price_usd_t"]) for k, v in list(world.items())[:6]})
    for iso in ("MM", "IN", "KE", "US", "TH"):
        c = countries.get(iso, {})
        print(iso, {k: (v.get("yield_t_ha"), v.get("price_usd_t")) for k, v in c.items() if k in ("Rice", "Maize", "Chickpea", "Cowpea", "Mung bean", "Sorghum")})


if __name__ == "__main__":
    main()
