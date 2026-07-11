"""F1 — Item images: one image per item, store/rider managed (upgrade_last TASK 1).

Runs against the live local stack like every other test here (see conftest).
"""

import asyncio
import io

import httpx
import pytest
from PIL import Image

from conftest import login

RIDER_PHONE = "+919100000001"


def _png_bytes(size=(1600, 1200), color=(0, 98, 65)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def rider():
    return login(RIDER_PHONE)


@pytest.fixture(scope="module")
def target_item(customer):
    """Any catalog item id (string ids live inside services docs)."""
    r = customer.get("/services")
    assert r.status_code == 200
    for svc in r.json():
        if svc["items"]:
            return svc["items"][0]
    pytest.fail("no catalog items seeded")


def _upload(api, item_id, content=None, content_type="image/png", filename="a.png"):
    files = {"file": (filename, content if content is not None else _png_bytes(), content_type)}
    return api.client.post(f"/items/{item_id}/image", files=files)


def test_customer_cannot_upload(customer, target_item):
    assert _upload(customer, target_item["id"]).status_code == 403


def test_bad_content_type_rejected(store_owner, target_item):
    r = _upload(store_owner, target_item["id"], content=b"%PDF-1.4",
                content_type="application/pdf", filename="a.pdf")
    assert r.status_code == 415


def test_oversize_rejected(store_owner, target_item):
    r = _upload(store_owner, target_item["id"], content=b"x" * (5 * 1024 * 1024 + 1))
    assert r.status_code == 413


def test_corrupt_image_rejected(store_owner, target_item):
    r = _upload(store_owner, target_item["id"], content=b"not-an-image")
    assert r.status_code == 400


def test_unknown_item_404(store_owner):
    assert _upload(store_owner, "item_does_not_exist").status_code == 404


def test_store_upload_processed_and_visible(store_owner, customer, target_item):
    r = _upload(store_owner, target_item["id"])
    assert r.status_code == 200, r.text
    url = r.json()["image_url"]
    assert url.startswith("/api/v1/upload/") and url.endswith("/raw")

    # raw endpoint serves a WebP resized to <= 800px, publicly (no auth header)
    raw = httpx.get("http://localhost:8000" + url, timeout=30)
    assert raw.status_code == 200
    assert raw.headers["content-type"] == "image/webp"
    img = Image.open(io.BytesIO(raw.content))
    assert max(img.size) <= 800

    # image_url present in the customer-facing serializer
    services = customer.get("/services").json()
    item = next(i for s in services for i in s["items"] if i["id"] == target_item["id"])
    assert item["image_url"] == url


def test_rider_reupload_replaces_old(rider, db, target_item):
    first = _upload(rider, target_item["id"]).json()["image_url"]
    second = _upload(rider, target_item["id"]).json()["image_url"]
    assert first != second

    async def _count():
        return await db.uploads.count_documents(
            {"context": "item_image", "item_id": target_item["id"]})
    loop = asyncio.new_event_loop()
    try:
        assert loop.run_until_complete(_count()) == 1
    finally:
        loop.close()
    # old URL is gone
    assert httpx.get("http://localhost:8000" + first, timeout=30).status_code == 404


def test_delete_resets_to_placeholder(store_owner, customer, db, target_item):
    _upload(store_owner, target_item["id"])
    r = store_owner.client.delete(f"/items/{target_item['id']}/image")
    assert r.status_code == 200 and r.json()["image_url"] is None

    services = customer.get("/services").json()
    item = next(i for s in services for i in s["items"] if i["id"] == target_item["id"])
    assert item["image_url"] is None

    async def _count():
        return await db.uploads.count_documents(
            {"context": "item_image", "item_id": target_item["id"]})
    loop = asyncio.new_event_loop()
    try:
        assert loop.run_until_complete(_count()) == 0
    finally:
        loop.close()
