"""B2 — customers are never asked to TYPE coordinates.

The app captures GPS / a map pin, or the server geocodes the typed address
when GOOGLE_MAPS_API_KEY is set. Since upgrade_last TASK 3.2, a NEW address
that still has no coordinates after the geocode attempt is REJECTED with a
clear 400 (unlocatable addresses made the geospatial store matching silently
return nothing). Old documents stay nullable; the app prompts to pin them.
"""


def _addr_body(**over):
    return {
        "label": "other",
        "full_address": "12 MG Road, Sector 14",
        "city": "Gurugram",
        "state": "Haryana",
        "pincode": "122001",
        **over,
    }


def test_address_without_coordinates_is_rejected_clearly(customer):
    # Locally (no GOOGLE_MAPS_API_KEY) the server geocode returns None, so a
    # coordinate-less address must fail loudly — not save with null coords and
    # later match zero stores in silence. (With a key configured the server
    # would geocode it and this saves fine.)
    r = customer.post("/addresses", json=_addr_body())
    assert r.status_code in (201, 400), r.text[:300]
    if r.status_code == 400:
        assert "pin" in r.json()["detail"].lower()
    else:  # geocode key present in this environment → coords must be real
        assert isinstance(r.json()["latitude"], float)
        customer.client.delete(f"/addresses/{r.json()['id']}")


def test_address_with_gps_passthrough(customer):
    r = customer.post("/addresses", json=_addr_body(latitude=28.47, longitude=77.03))
    assert r.status_code == 201, r.text[:300]
    created = r.json()
    assert created["latitude"] == 28.47
    assert created["longitude"] == 77.03
    customer.client.delete(f"/addresses/{created['id']}")


def test_zero_coords_treated_as_missing(customer):
    # Old builds sent 0/0 when GPS was denied — that's the sentinel, not a
    # place. Same contract as no-coords: geocode or reject, never save 0/0.
    r = customer.post("/addresses", json=_addr_body(latitude=0, longitude=0))
    assert r.status_code in (201, 400), r.text[:300]
    if r.status_code == 201:
        assert r.json()["latitude"] != 0
        customer.client.delete(f"/addresses/{r.json()['id']}")
