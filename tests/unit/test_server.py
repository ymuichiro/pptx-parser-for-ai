from __future__ import annotations

import json
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from pptx_yaml_engine.server.app import create_app
from pptx_yaml_engine.server.config import ServerConfig
from pptx_yaml_engine.utils.fingerprint import template_fingerprint

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


def _make_config(tmp_path: Path, template_dir: str | None = None) -> ServerConfig:
    return ServerConfig(
        allowed_hosts=["testserver", "127.0.0.1", "localhost"],
        artifact_root_dir=str(tmp_path),
        artifact_ttl_seconds=900,
        host="127.0.0.1",
        max_output_bytes=1_000_000,
        max_request_bytes=1_000_000,
        port=3001,
        public_base_url="http://testserver",
        template_dir=template_dir or str(tmp_path / "templates"),
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


# ---------------------------------------------------------------------------
# Template registry integration: list_templates tool
# ---------------------------------------------------------------------------

_MCP_CALL = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "list_templates",
        "arguments": {},
    },
}

_MCP_RENDER = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "render_presentation",
        "arguments": {
            "template_name": "missing_template",
            "deck": {"version": 1, "slides": []},
        },
    },
}


def _mcp_post(client: TestClient, payload: dict) -> dict:
    resp = client.post(
        "/mcp/",
        json=payload,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_list_templates_returns_empty_when_no_templates(tmp_path: Path) -> None:
    """list_templates returns an empty list when no templates are configured."""
    app = create_app(_make_config(tmp_path))
    with TestClient(app) as client:
        # Initialise the MCP session first
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _MCP_CALL)

    # FastMCP wraps tool results in a content list
    content = body.get("result", {}).get("content", [])
    assert content, f"Expected non-empty content in response: {body}"
    result = json.loads(content[0]["text"])
    assert result["count"] == 0
    assert result["templates"] == []


def test_render_presentation_no_templates_configured(tmp_path: Path) -> None:
    """render_presentation raises NO_TEMPLATES_CONFIGURED when registry is empty."""
    app = create_app(_make_config(tmp_path))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _MCP_RENDER)

    # FastMCP returns tool errors in the content array with isError=True
    content = body.get("result", {}).get("content", [])
    assert content, f"Expected error content: {body}"
    error_text = content[0]["text"]
    assert "NO_TEMPLATES_CONFIGURED" in error_text or "TEMPLATE_NOT_FOUND" in error_text


def test_list_templates_returns_registered_template(tmp_path: Path, template_bytes: bytes, template_manifest: dict) -> None:
    """list_templates returns templates that were loaded from TEMPLATE_DIR."""
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "mytemplate.pptx").write_bytes(template_bytes)
    (tpl_dir / "mytemplate.manifest.json").write_text(json.dumps(template_manifest), encoding="utf-8")

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _MCP_CALL)

    content = body.get("result", {}).get("content", [])
    assert content, f"Expected non-empty content: {body}"
    result = json.loads(content[0]["text"])
    assert result["count"] == 1
    assert result["templates"][0]["name"] == "mytemplate"
