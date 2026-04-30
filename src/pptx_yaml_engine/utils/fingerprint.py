from __future__ import annotations

import hashlib


def template_fingerprint(template_bytes: bytes) -> str:
    return f"sha256:{hashlib.sha256(template_bytes).hexdigest()}"
