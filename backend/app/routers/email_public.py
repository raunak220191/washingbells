"""Email public endpoints — unsubscribe / resubscribe.

These are NOT under /admin and don't require auth. The token in the URL is an
HMAC signature over the email address, so it can't be forged.
"""

from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import HTMLResponse
from app.core.database import get_db
from app.services.email_service import (
    verify_unsubscribe_token, record_unsubscribe, record_resubscribe, is_unsubscribed,
)

router = APIRouter(prefix="/email", tags=["Email Public"])


# Small, dependency-free HTML pages so users don't see a JSON error
def _page(title: str, body_html: str) -> HTMLResponse:
    html = f"""<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  <style>
    :root {{ color-scheme: light; }}
    body {{ margin:0; font:14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background:#f5f7f5; color:#333; }}
    .wrap {{ max-width:520px; margin:48px auto; padding:32px 28px;
             background:#fff; border-radius:16px; border:1px solid #e6e6e6;
             box-shadow:0 1px 3px rgba(0,0,0,0.04); }}
    h1 {{ font-size:18px; color:#4A5D4E; margin:0 0 12px; }}
    p {{ color:#555; margin:8px 0; }}
    .badge {{ display:inline-block; padding:4px 8px; border-radius:6px;
              font-size:11px; font-weight:700; text-transform:uppercase;
              background:#D9E7E0; color:#4A5D4E; }}
    a.btn {{ display:inline-block; margin-top:14px; padding:8px 14px;
             background:#4A5D4E; color:#fff; text-decoration:none;
             border-radius:8px; font-weight:600; font-size:13px; }}
    .footer {{ text-align:center; margin-top:18px; font-size:11px; color:#999; }}
  </style>
</head><body>
  <div class="wrap">{body_html}<div class="footer">WashingBells</div></div>
</body></html>"""
    return HTMLResponse(html)


@router.get("/unsubscribe")
async def unsubscribe(token: str = Query(...)):
    """Click-to-unsubscribe landing page. Idempotent."""
    email = verify_unsubscribe_token(token)
    if not email:
        return _page("Invalid link", "<h1>This unsubscribe link is invalid.</h1>"
                     "<p>The link may be corrupt or expired. If you keep receiving emails you don't want, "
                     "reply to one of them and we'll remove you manually.</p>")
    db = get_db()
    already = await is_unsubscribed(db, email)
    if not already:
        await record_unsubscribe(db, email, source="link")
    return _page(
        "Unsubscribed",
        f"<h1>You're unsubscribed.</h1>"
        f"<p><span class='badge'>{email}</span> will no longer receive marketing or "
        f"non-essential emails from WashingBells.</p>"
        f"<p style='margin-top:14px'>Note: we may still send order-receipt and account-security emails "
        f"as required by law.</p>"
        f"<p style='margin-top:14px'>Changed your mind?</p>"
        f"<a class='btn' href='/api/v1/email/resubscribe?token={token}'>Re-subscribe</a>",
    )


@router.get("/resubscribe")
async def resubscribe(token: str = Query(...)):
    email = verify_unsubscribe_token(token)
    if not email:
        return _page("Invalid link", "<h1>This link is invalid.</h1>")
    db = get_db()
    await record_resubscribe(db, email)
    return _page(
        "Re-subscribed",
        f"<h1>Welcome back.</h1>"
        f"<p><span class='badge'>{email}</span> will resume receiving non-essential emails.</p>",
    )
