"""Audit F03: the frost-sensitive constraint must change the partner pick (offline, no NASA calls)."""
from farm.rotation import FROST_MAX, utility


def _s(crop, low_risk, frost):
    return {"crop": crop, "low_risk": low_risk, "irrigation_mm": 100.0, "temp_off_c": 0.0, "frost_share": frost}


def test_frost_sensitive_demotes_frosty_crop():
    lentil, pea = _s("lentil", 0.6, 0.35), _s("field pea", 0.5, 0.0)
    assert utility(lentil, "soil") > utility(pea, "soil")  # normal field: higher low-risk share wins
    assert utility(lentil, "soil", frost_sensitive=True) < utility(pea, "soil", frost_sensitive=True)


def test_rare_frost_is_tolerated():
    s = _s("chickpea", 0.5, FROST_MAX)  # exactly 1 in 10 seasons
    assert utility(s, "soil", frost_sensitive=True) == utility(s, "soil")
