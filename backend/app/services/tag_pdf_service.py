"""Garment Tag PDF rendering.

Generates a printable PDF of garment tags for an order. Each tag has:
  - QR code (top) — encodes the tag code, scannable from any angle.
  - Code128 barcode (middle) — 1D barcode for traditional handheld scanners.
  - Human-readable tag code (bottom) — e.g. WB-2026-XXXX-001.
  - Service + item name underneath for staff reference.

Layout: 4 tags per A4 page (2 columns × 2 rows). Each tag fits a 90 × 130 mm
card which works on either A4 or thermal labels when cropped.
"""

import io
import barcode
from barcode.writer import ImageWriter
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


def _qr_image(data: str) -> ImageReader:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _code128_image(data: str) -> ImageReader:
    code = barcode.get("code128", data, writer=ImageWriter())
    buf = io.BytesIO()
    # Slimmer bars for tag-sized output; no text under (we render our own)
    code.write(buf, options={
        "module_width": 0.3,
        "module_height": 12.0,
        "quiet_zone": 2.0,
        "write_text": False,
        "font_size": 0,
        "text_distance": 0,
    })
    buf.seek(0)
    return ImageReader(buf)


def _draw_tag(c: canvas.Canvas, tag: dict, order_number: str, x: float, y: float, w: float, h: float):
    """Draw a single tag inside the (x, y, w, h) rectangle (PDF coords, mm)."""
    code = tag.get("tag_code", "")
    item_name = tag.get("item_name", "")
    service_name = tag.get("service_name", "")

    # Card border
    c.setStrokeColorRGB(0.85, 0.85, 0.85)
    c.setLineWidth(0.4)
    c.roundRect(x, y, w, h, 2 * mm, stroke=1, fill=0)

    # Header: order number
    c.setFillColorRGB(0.29, 0.36, 0.31)  # forest green
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 4 * mm, y + h - 6 * mm, order_number)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.setFont("Helvetica", 7)
    c.drawRightString(x + w - 4 * mm, y + h - 6 * mm, "WashingBells")

    # QR code (top centre)
    qr = _qr_image(code)
    qr_size = 28 * mm
    c.drawImage(qr, x + (w - qr_size) / 2, y + h - 6 * mm - qr_size,
                qr_size, qr_size, mask="auto")

    # Code128 barcode below QR
    bc = _code128_image(code)
    bc_w = w - 8 * mm
    bc_h = 14 * mm
    c.drawImage(bc, x + 4 * mm, y + 24 * mm, bc_w, bc_h, mask="auto",
                preserveAspectRatio=True)

    # Tag code text
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Courier-Bold", 11)
    c.drawCentredString(x + w / 2, y + 18 * mm, code)

    # Service + item name
    c.setFillColorRGB(0.35, 0.35, 0.35)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x + w / 2, y + 11 * mm, service_name[:40])
    c.setFont("Helvetica", 7)
    c.drawCentredString(x + w / 2, y + 6 * mm, item_name[:48])


def render_tags_pdf(order_number: str, tags: list[dict]) -> bytes:
    """Render the full PDF and return bytes. Lays out 4 tags per A4 page."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    # Tag card size: 90 × 130 mm, 2 columns × 2 rows, centred
    card_w = 90 * mm
    card_h = 130 * mm
    cols = 2
    rows = 2
    h_gap = (page_w - cols * card_w) / (cols + 1)
    v_gap = (page_h - rows * card_h) / (rows + 1)

    if not tags:
        c.setFont("Helvetica", 12)
        c.drawCentredString(page_w / 2, page_h / 2, "No tags to print")
    else:
        for i, tag in enumerate(tags):
            pos = i % (cols * rows)
            if pos == 0 and i > 0:
                c.showPage()
            col = pos % cols
            row = pos // cols  # 0 = top, 1 = bottom
            x = h_gap + col * (card_w + h_gap)
            # PDF y origin is bottom-left; place top row higher
            y = page_h - v_gap - card_h - row * (card_h + v_gap)
            _draw_tag(c, tag, order_number, x, y, card_w, card_h)

    c.save()
    buf.seek(0)
    return buf.read()
