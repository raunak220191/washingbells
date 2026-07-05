"""D13 — payment timing and instrument are separate, and timing drives flow."""

from conftest import place_order


def test_pay_on_delivery_cash(customer):
    order = place_order(customer, "online",  # method contradicts timing on purpose
                        payment_timing="pay_on_delivery", payment_instrument="cash")
    # timing wins over the legacy payment_method field
    assert order["payment_method"] == "cod"
    assert order["payment_status"] == "cod_pending"
    assert order["status"] == "placed"


def test_pay_now_upi_is_pending_payment(customer):
    order = place_order(customer, "cod",
                        payment_timing="pay_now", payment_instrument="upi")
    assert order["payment_method"] == "online"
    assert order["status"] == "pending_payment"


def test_old_builds_without_timing_unchanged(customer):
    order = place_order(customer, "cod")
    assert order["payment_method"] == "cod"
    assert order["status"] == "placed"
