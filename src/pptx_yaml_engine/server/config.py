from __future__ import annotations

import os
from dataclasses import dataclass


def _positive_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _hosts() -> list[str]:
    raw = os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost,app.internal")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class ServerConfig:
    allowed_hosts: list[str]
    artifact_root_dir: str
    artifact_ttl_seconds: int
    host: str
    max_output_bytes: int
    max_request_bytes: int
    port: int
    public_base_url: str
    template_dir: str
    enable_operator_tools: bool = False


def load_config() -> ServerConfig:
    return ServerConfig(
        allowed_hosts=_hosts(),
        artifact_root_dir=os.getenv("ARTIFACT_ROOT_DIR", "/tmp/pptx-mcp-artifacts"),
        artifact_ttl_seconds=_positive_int("ARTIFACT_TTL_SECONDS", 900),
        enable_operator_tools=_flag("ENABLE_OPERATOR_TOOLS", False),
        host=os.getenv("LISTEN", "0.0.0.0"),
        max_output_bytes=_positive_int("MAX_OUTPUT_BYTES", 26_214_400),
        max_request_bytes=_positive_int("MAX_REQUEST_BYTES", 2_097_152),
        port=_positive_int("PORT", 3001),
        public_base_url=os.getenv("PUBLIC_BASE_URL", ""),
        template_dir=os.getenv("TEMPLATE_DIR", "/templates"),
    )
