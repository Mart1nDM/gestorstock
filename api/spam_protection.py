import os
import logging

from fastapi import HTTPException
from httpx import Client as HttpxClient

log = logging.getLogger(__name__)

try:
    from .deps import load_env_file
except ImportError:
    from deps import load_env_file

load_env_file()

TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "").strip()
_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def turnstile_enabled() -> bool:
    return bool(TURNSTILE_SECRET_KEY)


def verify_turnstile(token: str | None, remote_ip: str | None = None) -> bool:
    """Validate a Cloudflare Turnstile token. Returns True when disabled or valid."""
    if not turnstile_enabled():
        return True

    if not token:
        return False

    payload: dict = {
        "secret": TURNSTILE_SECRET_KEY,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        with HttpxClient(timeout=15.0) as client:
            resp = client.post(_SITEVERIFY_URL, data=payload)
            result = resp.json()
        if not result.get("success"):
            log.warning("Turnstile verification FAILED | remoteip=%s | response=%s", remote_ip, result)
        else:
            log.info("Turnstile verification OK | remoteip=%s", remote_ip)
        return bool(result.get("success"))
    except Exception as exc:
        log.error("Turnstile verification ERROR | remoteip=%s | exception=%s", remote_ip, exc)
        return False


def require_turnstile(token: str | None, remote_ip: str | None = None) -> None:
    """Raise HTTPException 400 when the Turnstile token is invalid and Turnstile is enabled."""
    if not verify_turnstile(token, remote_ip):
        raise HTTPException(status_code=403, detail="No se pudo verificar que no sos un robot. Intentalo de nuevo.")
