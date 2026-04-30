from __future__ import annotations

import base64
import binascii

from pptx_yaml_engine.errors import DomainError


def decode_b64(value: str, *, field: str = "template_b64") -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DomainError("INVALID_BASE64", f"{field} is not valid base64", {"field": field}) from exc


def encode_b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")
