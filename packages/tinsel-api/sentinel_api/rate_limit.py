"""Rate limiting configuration for the TINSEL sentinel_api.

Three tiers:
    demo    — 10 req / minute per IP  (unauthenticated /analyse endpoints)
    write   — 20 req / minute per org (POST /register — expensive, vault + ESMFold)
    read    — 100 req / minute per org (all other authenticated endpoints)

The key function uses the X-API-Key header value for authenticated routes
(per-org limiting) and falls back to the client IP for unauthenticated routes.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from sentinel_api.config import settings


def _key_func(request: Request) -> str:
    """Return X-API-Key for authenticated requests, remote IP otherwise."""
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Limit per organisation key, not per IP, so an org can run multiple
        # services from different IPs without hitting per-IP limits.
        return f"key:{api_key}"
    return f"ip:{get_remote_address(request)}"


# Disabled under SENTINEL_ENV=test. Every test shares one API key, so the
# limiter counts the whole suite as a single client: the write tier allows 20
# registrations per minute, and the suite was already close enough to that
# ceiling that adding four tests started returning 429 from unrelated cases.
# A limit that fails tests by arithmetic on the number of tests is a flake
# generator, not a guard. A test that wants to exercise the limiter should set
# limiter.enabled = True for its own duration.
limiter = Limiter(key_func=_key_func, enabled=settings.sentinel_env != "test")

# Convenience decorators for the three tiers.
# Usage: @rate_limit_demo / @rate_limit_write / @rate_limit_read
rate_limit_demo = limiter.limit("10/minute")   # unauthenticated demo endpoints
rate_limit_write = limiter.limit("20/minute")  # POST /register (expensive)
rate_limit_read = limiter.limit("100/minute")  # authenticated read endpoints
