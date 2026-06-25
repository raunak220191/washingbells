"""Tax Invoice PDF rendering.

Renders a GST tax invoice for an order onto a single A4 page:
  - Header: store legal name, GSTIN, address, phone + "TAX INVOICE".
  - Meta: invoice number, date, order number, payment method/status.
  - Bill-to: customer name + phone.
  - Itemised table: item, category, qty, rate, amount.
  - Totals: taxable value, CGST/SGST (or single GST line), grand total.

GST is inclusive of the grand total (see billing_service.compute_gst_inclusive),
so the printed total always equals the order's total_amount.
"""

import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

FOREST = (0.29, 0.36, 0.31)
GREY = (0.4, 0.4, 0.4)
LIGHT = (0.85, 0.85, 0.85)


def _rupee(n) -> str:
    try:
        return f"Rs. {float(n):,.2f}"
    except (TypeError, ValueError):
        return "Rs. 0.00"


def render_invoice_pdf(inv: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4
    left = 18 * mm
    right = page_w - 18 * mm
    y = page_h - 20 * mm

    store = inv.get("store_snapshot", {})
    cust = inv.get("customer_snapshot", {})

    # ── Header ───────────────────────────────────────────────
    c.setFillColorRGB(*FOREST)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(left, y, store.get("name", "WashingBells"))
    c.setFillColorRGB(*GREY)
    c.setFont("Helvetica", 8)
    line_y = y - 5 * mm
    addr = ", ".join(p for p in [store.get("address", ""), store.get("city", "")] if p)
    if addr:
        c.drawString(left, line_y, addr[:90]); line_y -= 4 * mm
    if store.get("phone"):
        c.drawString(left, line_y, f"Phone: {store['phone']}"); line_y -= 4 * mm
    if store.get("gstin"):
        c.drawString(left, line_y, f"GSTIN: {store['gstin']}"); line_y -= 4 * mm

    c.setFillColorRGB(*FOREST)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(right, y, "TAX INVOICE")

    # ── Meta block ───────────────────────────────────────────
    meta_y = y - 5 * mm
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 9)
    created = inv.get("created_at")
    date_str = created.strftime("%d %b %Y, %H:%M") if hasattr(created, "strftime") else str(created or "")
    for label, val in [
        ("Invoice No:", inv.get("invoice_number", "")),
        ("Date:", date_str),
        ("Order:", inv.get("order_number", "")),
        ("Payment:", f"{inv.get('payment_method', '').upper()} ({inv.get('payment_status', '')})"),
    ]:
        c.setFont("Helvetica", 8)
        c.drawRightString(right - 32 * mm, meta_y, label)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(right, meta_y, str(val))
        meta_y -= 4.2 * mm

    y = min(line_y, meta_y) - 6 * mm

    # Divider
    c.setStrokeColorRGB(*LIGHT)
    c.setLineWidth(0.6)
    c.line(left, y, right, y)
    y -= 7 * mm

    # ── Bill to ──────────────────────────────────────────────
    c.setFillColorRGB(*GREY)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(left, y, "BILL TO")
    y -= 4.5 * mm
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left, y, cust.get("name", "Customer"))
    if cust.get("phone"):
        c.setFont("Helvetica", 9)
        c.drawString(left + 70 * mm, y, cust["phone"])
    if inv.get("order_source") == "walk_in":
        c.setFillColorRGB(*FOREST)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(right, y, "WALK-IN")
    y -= 8 * mm

    # ── Items table header ───────────────────────────────────
    col_item = left
    col_cat = left + 78 * mm
    col_qty = left + 108 * mm
    col_rate = left + 130 * mm
    col_amt = right
    c.setFillColorRGB(*FOREST)
    c.rect(left, y - 1.5 * mm, right - left, 6.5 * mm, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(col_item + 2 * mm, y, "ITEM")
    c.drawString(col_cat, y, "CATEGORY")
    c.drawRightString(col_qty + 8 * mm, y, "QTY")
    c.drawRightString(col_rate + 12 * mm, y, "RATE")
    c.drawRightString(col_amt - 1 * mm, y, "AMOUNT")
    y -= 7 * mm

    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 9)
    for it in inv.get("items", []):
        if y < 60 * mm:
            c.showPage()
            y = page_h - 25 * mm
        name = f"{it.get('item_name', '')}"
        svc = it.get("service_name", "")
        c.setFont("Helvetica", 9)
        c.drawString(col_item + 2 * mm, y, name[:42])
        c.setFillColorRGB(*GREY)
        c.setFont("Helvetica", 7)
        c.drawString(col_item + 2 * mm, y - 3.4 * mm, svc[:46])
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 8)
        c.drawString(col_cat, y, str(it.get("category", "unisex")).title())
        c.drawRightString(col_qty + 8 * mm, y, str(it.get("quantity", 1)))
        c.drawRightString(col_rate + 12 * mm, y, _rupee(it.get("price", 0)))
        c.drawRightString(col_amt - 1 * mm, y, _rupee(it.get("subtotal", 0)))
        y -= 8 * mm
        c.setStrokeColorRGB(0.93, 0.93, 0.93)
        c.line(left, y + 2 * mm, right, y + 2 * mm)

    # ── Totals ───────────────────────────────────────────────
    y -= 4 * mm
    label_x = right - 60 * mm
    val_x = right - 1 * mm

    def total_row(label, val, bold=False, color=(0, 0, 0)):
        nonlocal y
        c.setFillColorRGB(*color)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 9 if not bold else 11)
        c.drawString(label_x, y, label)
        c.drawRightString(val_x, y, _rupee(val))
        y -= 5.5 * mm

    # Block 1: amount payable (items → total). These lines genuinely sum.
    total_row("Items Subtotal", inv.get("items_subtotal", 0))
    if inv.get("delivery_fee"):
        total_row("Delivery Fee", inv.get("delivery_fee", 0))
    if inv.get("discount"):
        total_row("Discount", -abs(inv.get("discount", 0)))
    if inv.get("wallet_applied"):
        total_row("Wallet Applied", -abs(inv.get("wallet_applied", 0)))

    c.setStrokeColorRGB(*FOREST)
    c.setLineWidth(1)
    c.line(label_x, y + 2 * mm, val_x, y + 2 * mm)
    y -= 1 * mm
    total_row("TOTAL", inv.get("total", 0), bold=True, color=FOREST)

    # Block 2: tax summary — a breakdown OF the total above, not extra charges.
    if inv.get("gst_enabled") and inv.get("tax_amount"):
        rate = inv.get("gst_rate", 0)
        y -= 2 * mm
        c.setFillColorRGB(*GREY)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(label_x, y, f"TAX SUMMARY  (total is inclusive of GST {rate:g}%)")
        y -= 5 * mm
        total_row("Taxable Value", inv.get("taxable_amount", 0), color=GREY)
        if inv.get("cgst_sgst_split"):
            total_row(f"CGST @ {rate / 2:g}%", inv.get("cgst", 0), color=GREY)
            total_row(f"SGST @ {rate / 2:g}%", inv.get("sgst", 0), color=GREY)
        else:
            total_row(f"GST @ {rate:g}%", inv.get("tax_amount", 0), color=GREY)

    # ── Footer ───────────────────────────────────────────────
    c.setFillColorRGB(*GREY)
    c.setFont("Helvetica", 8)
    c.drawCentredString(page_w / 2, 18 * mm, inv.get("footer", "Thank you for choosing WashingBells."))
    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(page_w / 2, 13 * mm, "This is a computer-generated invoice.")

    c.save()
    buf.seek(0)
    return buf.read()
