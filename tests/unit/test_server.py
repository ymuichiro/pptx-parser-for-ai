from __future__ import annotations

from pathlib import Path

from starlette.testclient import TestClient

from pptx_yaml_engine.server.app import create_app
from pptx_yaml_engine.server.config import ServerConfig

_MCP_INIT = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "test", "version": "1.0"},
    },
}


def _make_config(tmp_path: Path) -> ServerConfig:
    return ServerConfig(
        allowed_hosts=["testserver", "127.0.0.1", "localhost"],
        artifact_root_dir=str(tmp_path),
        artifact_ttl_seconds=900,
        host="127.0.0.1",
        max_output_bytes=1_000_000,
        max_request_bytes=1_000_000,
        port=3001,
        public_base_url="http://testserver",
    )


def test_health_endpoint(tmp_path: Path) -> None:
    app = create_app(_make_config(tmp_path))
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.text == "ok"


def test_mcp_no_trailing_slash_not_redirected(tmp_path: Path) -> None:
    """POST /mcp (without trailing slash) must not return a 307 redirect.

    Some MCP clients do not follow POST redirects, so the server must handle
    both /mcp and /mcp/ identically without issuing a redirect.
    """
    app = create_app(_make_config(tmp_path))
    with TestClient(app, follow_redirects=False) as client:
        r_slash = client.post("/mcp/", json=_MCP_INIT)
        r_no_slash = client.post("/mcp", json=_MCP_INIT)

    assert r_no_slash.status_code != 307, "POST /mcp must not return a 307 redirect"
    assert r_no_slash.status_code == r_slash.status_code, (
        f"POST /mcp ({r_no_slash.status_code}) must behave the same as "
        f"POST /mcp/ ({r_slash.status_code})"
    )
