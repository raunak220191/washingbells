"""B2 — customers are never asked for coordinates.

The app captures GPS or geocodes on-device; the server geocodes typed
addresses when GOOGLE_MAPS_API_KEY is set. Locally (no key) the address must
still save cleanly with null coordinates — never crash, never invent a
wrong-city default (the old client pinned no-GPS addresses to Ludhiana).
"""

from conftest import login


def _addr_body(**over):
    return {
        "label": "other",
        "full_address": "12 MG Road, Sector 14",
        "city": "Gurugram",
        "state": "Haryana",
        "pincode": "122001",
        **over,
    }


def test_address_saves_without_coordinates(customer):
    r = customer.post("/addresses", json=_addr_body())
    assert r.status_code == 201, r.text[:300]
    created = r.json()
    # No key locally → server geocode is skipped; coords must be null, not a
    # fabricated default. With a key configured they'd be real values.
    assert created["latitude"] is None or isinstance(created["latitude"], float)
    assert created["latitude"] != 30.9, "must not fabricate the old Ludhiana default"
    customer.client.delete(f"/addresses/{created['id']}")


def test_address_with_gps_passthrough(customer):
    r = customer.post("/addresses", json=_addr_body(latitude=28.47, longitude=77.03))
    assert r.status_code == 201, r.text[:300]
    created = r.json()
    assert created["latitude"] == 28.47
    assert created["longitude"] == 77.03
    customer.client.delete(f"/addresses/{created['id']}")


def test_zero_coords_treated_as_missing(customer):
    # Old builds sent 0/0 when GPS was denied — that's the sentinel, not a place
    r = customer.post("/addresses", json=_addr_body(latitude=0, longitude=0))
    assert r.status_code == 201, r.text[:300]
    assert r.json()["latitude"] != 0
    customer.client.delete(f"/addresses/{r.json()['id']}")
