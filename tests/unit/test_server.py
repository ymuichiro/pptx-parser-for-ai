from __future__ import annotations

import json
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from pptx_yaml_engine.server.app import create_app
from pptx_yaml_engine.server.config import ServerConfig
from pptx_yaml_engine.errors import DomainError
import pptx_yaml_engine.server.template_registry as template_registry_module

_VALID_DECK = {
    "version": 1,
    "slides": [{"layout": "cover_title", "title": "Cover", "subtitle": "Subtitle"}],
}

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
            "deck": _VALID_DECK,
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


def _tool_text(body: dict) -> str:
    content = body.get("result", {}).get("content", [])
    assert content, f"Expected non-empty content: {body}"
    return content[0]["text"]


def _tool_json(body: dict) -> dict:
    return json.loads(_tool_text(body))


def _render_call(arguments: dict) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": 10,
        "method": "tools/call",
        "params": {
            "name": "render_presentation",
            "arguments": arguments,
        },
    }


def test_list_templates_returns_empty_when_no_templates(tmp_path: Path) -> None:
    """list_templates returns an empty list when no templates are configured."""
    app = create_app(_make_config(tmp_path))
    with TestClient(app) as client:
        # Initialise the MCP session first
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _MCP_CALL)

    result = _tool_json(body)
    assert result["count"] == 0
    assert result["templates"] == []


def test_render_presentation_no_templates_configured(tmp_path: Path) -> None:
    """render_presentation raises NO_TEMPLATES_CONFIGURED when registry is empty."""
    app = create_app(_make_config(tmp_path))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _MCP_RENDER)

    error_text = _tool_text(body)
    assert "NO_TEMPLATES_CONFIGURED" in error_text or "TEMPLATE_NOT_FOUND" in error_text


def test_list_templates_returns_registered_template(tmp_path: Path, template_bytes: bytes, template_manifest: dict) -> None:
    """list_templates returns templates that were loaded from TEMPLATE_DIR."""
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "mytemplate.pptx").write_bytes(template_bytes)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _MCP_CALL)

    result = _tool_json(body)
    assert result["count"] == 1
    assert result["templates"][0]["name"] == "mytemplate"


def test_render_presentation_uses_default_template_when_name_omitted(
    tmp_path: Path, template_bytes: bytes, template_manifest: dict
) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "default.pptx").write_bytes(template_bytes)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _render_call({"deck": _VALID_DECK}))

    result = _tool_json(body)
    assert result["success"] is True
    assert result["slideCount"] == 1


@pytest.mark.parametrize("template_name", [None, "", "   "])
def test_render_presentation_blank_or_null_template_name_uses_default(
    tmp_path: Path, template_bytes: bytes, template_manifest: dict, template_name: str | None
) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "default.pptx").write_bytes(template_bytes)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _render_call({"deck": _VALID_DECK, "template_name": template_name}))

    result = _tool_json(body)
    assert result["success"] is True
    assert result["slideCount"] == 1


def test_render_presentation_explicit_named_template_still_works(
    tmp_path: Path, template_bytes: bytes, template_manifest: dict
) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "named.pptx").write_bytes(template_bytes)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _render_call({"deck": _VALID_DECK, "template_name": "named"}))

    result = _tool_json(body)
    assert result["success"] is True
    assert result["slideCount"] == 1


@pytest.mark.parametrize("arguments", [{"deck": _VALID_DECK}, {"deck": _VALID_DECK, "template_name": None}, {"deck": _VALID_DECK, "template_name": ""}])
def test_render_presentation_missing_default_template_returns_clear_error(
    tmp_path: Path, template_bytes: bytes, template_manifest: dict, arguments: dict
) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "named.pptx").write_bytes(template_bytes)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _render_call(arguments))

    error_text = _tool_text(body)
    assert "DEFAULT_TEMPLATE_NOT_FOUND" in error_text


def test_render_presentation_missing_named_template_still_returns_template_not_found(
    tmp_path: Path, template_bytes: bytes, template_manifest: dict
) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "default.pptx").write_bytes(template_bytes)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))
    with TestClient(app) as client:
        client.post("/mcp/", json=_MCP_INIT, headers={"Accept": "application/json", "Content-Type": "application/json"})
        body = _mcp_post(client, _render_call({"deck": _VALID_DECK, "template_name": "missing_template"}))

    error_text = _tool_text(body)
    assert "TEMPLATE_NOT_FOUND" in error_text


def test_app_startup_fails_fast_for_invalid_template(tmp_path: Path) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "broken.pptx").write_bytes(b"not-a-powerpoint")

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))

    with pytest.raises(Exception):
        with TestClient(app):
            pass


def test_app_startup_fails_fast_for_template_contract_mismatch(
    tmp_path: Path, template_bytes: bytes, monkeypatch: pytest.MonkeyPatch
) -> None:
    tpl_dir = tmp_path / "templates"
    tpl_dir.mkdir()
    (tpl_dir / "broken_contract.pptx").write_bytes(template_bytes)

    def fake_generate_manifest(_template_bytes: bytes) -> dict[str, object]:
        raise DomainError(
            "TEMPLATE_LAYOUT_CONTRACT_MISMATCH",
            "Template does not satisfy the required semantic layout contract.",
            {"expected": ["cover_title"], "actual": []},
        )

    monkeypatch.setattr(template_registry_module, "generate_manifest", fake_generate_manifest)

    app = create_app(_make_config(tmp_path, template_dir=str(tpl_dir)))

    with pytest.raises(Exception):
        with TestClient(app):
            pass
