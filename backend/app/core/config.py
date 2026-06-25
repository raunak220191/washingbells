from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
import yaml


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "washingbells"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # MSG91 — SMS & OTP provider. Configured via dev.yaml (msg91: section).
    MSG91_AUTH_KEY: str = ""                                  # MSG91 Auth Key
    MSG91_BASE_URL: str = "https://control.msg91.com/api/v5"
    MSG91_DEFAULT_COUNTRY_CODE: str = "91"                    # prepended to 10-digit numbers
    MSG91_SENDER_ID: str = ""                                 # 6-char DLT-approved header
    MSG91_OTP_TEMPLATE_ID: str = ""                           # DLT template id for OTP service
    MSG91_OTP_LENGTH: int = 6
    MSG91_OTP_EXPIRY_MINUTES: int = 10
    MSG91_INVITE_TEMPLATE_ID: str = ""                        # Flow template id for invitation SMS

    # App URLs used in invitation SMS
    RIDER_APP_INVITE_URL: str = "https://washingbells.in/rider-app"
    STORE_APP_INVITE_URL: str = "https://washingbells.in/store-app"

    # SendGrid (email)
    SENDGRID_API_KEY: str = ""
    SENDGRID_INBOUND_PARSE_KEY: str = ""  # shared secret for inbound webhook
    EMAIL_FROM_ADDRESS: str = ""
    EMAIL_FROM_NAME: str = "WashingBells"
    EMAIL_REPLY_TO: str = ""
    EMAIL_ADMIN_ADDRESS: str = ""
    EMAIL_ENABLED: bool = False

    # Public URL the backend is reachable at (used for unsubscribe links)
    PUBLIC_BASE_URL: str = ""

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = ""

    # App
    DEBUG: bool = True

    class Config:
        env_file = ".env"


def _load_yaml_config() -> dict:
    """Load dev.yaml sections into <SECTION>_<KEY> settings kwargs.

    dev.yaml lives at the backend root (alongside requirements.txt). Values
    here take precedence over .env / defaults. Each top-level section maps to a
    prefix, e.g. `msg91.auth_key` → MSG91_AUTH_KEY, `razorpay.key_id` →
    RAZORPAY_KEY_ID.
    """
    path = Path(__file__).resolve().parents[2] / "dev.yaml"
    if not path.exists():
        return {}
    with open(path, "r") as f:
        data = yaml.safe_load(f) or {}
    out: dict = {}
    for section in ("msg91", "razorpay"):
        for key, value in (data.get(section) or {}).items():
            if value is not None and value != "":
                out[f"{section.upper()}_{key.upper()}"] = value
    return out


@lru_cache()
def get_settings() -> Settings:
    return Settings(**_load_yaml_config())
