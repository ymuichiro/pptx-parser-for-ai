from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

import yaml
from starlette.testclient import TestClient

from pptx_yaml_engine.server.app import create_app
from pptx_yaml_engine.server.config import ServerConfig

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "examples" / "enterprise-eval"
DECK_PATH = OUT_DIR / "ai-governance-readiness.yaml"
OUTPUT_PATH = OUT_DIR / "ai-governance-readiness.app-rendered.pptx"


def _config() -> ServerConfig:
    return ServerConfig(
        allowed_hosts=["testserver", "127.0.0.1", "localhost"],
        artifact_root_dir=str(ROOT / "docs" / "design-investigations" / "2026-05-21-visual-evaluation" / "artifacts"),
        artifact_ttl_seconds=1800,
        enable_operator_tools=False,
        host="127.0.0.1",
        max_output_bytes=26_214_400,
        max_request_bytes=4_194_304,
        port=3108,
        public_base_url="http://testserver",
        template_dir=str(ROOT / "templates"),
    )


def _tool_text(body: dict) -> str:
    content = body.get("result", {}).get("content", [])
    if not content:
        raise RuntimeError(f"Empty MCP content: {body}")
    return content[0]["text"]


def main() -> None:
    deck = yaml.safe_load(DECK_PATH.read_text(encoding="utf-8"))
    app = create_app(_config())
    with TestClient(app) as client:
        init = client.post(
            "/mcp/",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "visual-eval", "version": "1.0"},
                },
            },
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        init.raise_for_status()
        render = client.post(
            "/mcp/",
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "render_presentation",
                    "arguments": {"deck": deck, "file_name": OUTPUT_PATH.name},
                },
            },
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        render.raise_for_status()
        payload = json.loads(_tool_text(render.json()))
        download_url = payload["downloadUrl"]
        artifact = client.get(urlparse(download_url).path)
        artifact.raise_for_status()
        OUTPUT_PATH.write_bytes(artifact.content)
        print(json.dumps({"success": True, "slideCount": payload["slideCount"], "output": str(OUTPUT_PATH)}))


if __name__ == "__main__":
    main()
