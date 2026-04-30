from __future__ import annotations

import contextlib
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response
from starlette.routing import Mount, Route
from starlette.types import ASGIApp, Receive, Scope, Send

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.icons.registry import list_icons as list_icon_registry
from pptx_yaml_engine.layouts import supported_layouts_response
from pptx_yaml_engine.mapper.service import (
    finalize_manifest as finalize_manifest_impl,
)
from pptx_yaml_engine.mapper.service import (
    inspect_template as inspect_template_impl,
)
from pptx_yaml_engine.mapper.service import (
    propose_mapping as propose_mapping_impl,
)
from pptx_yaml_engine.mapper.service import (
    validate_manifest as validate_manifest_impl,
)
from pptx_yaml_engine.output.service import render_pptx as render_pptx_impl
from pptx_yaml_engine.output.validation import validate_deck as validate_deck_impl
from pptx_yaml_engine.server.artifacts import ArtifactStore
from pptx_yaml_engine.server.config import ServerConfig, load_config
from pptx_yaml_engine.server.template_registry import DEFAULT_TEMPLATE_NAME, TemplateRegistry
from pptx_yaml_engine.utils.b64 import decode_b64

logger = logging.getLogger(__name__)


class ContentLengthLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = {key.decode("latin1").lower(): value.decode("latin1") for key, value in scope.get("headers", [])}
            content_length = headers.get("content-length")
            if content_length and int(content_length) > self.max_bytes:
                await JSONResponse({"error": "Request body exceeds size limit"}, status_code=413)(scope, receive, send)
                return
        await self.app(scope, receive, send)


class TrailingSlashNormalizationMiddleware:
    """Rewrite requests whose path exactly matches a mount path (no trailing slash).

    Starlette's Mount responds to e.g. ``POST /mcp`` with a 307 redirect to
    ``/mcp/``.  Some MCP clients do not follow POST redirects, causing every
    request to fail silently.  This middleware normalises the path in-place
    before routing, so both ``/mcp`` and ``/mcp/`` reach the mounted sub-app.
    """

    def __init__(self, app: ASGIApp, mount_path: str) -> None:
        self.app = app
        self._path = mount_path
        self._path_slash = mount_path + "/"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("path") == self._path:
            scope = dict(scope)
            scope["path"] = self._path_slash
            if "raw_path" in scope:
                scope["raw_path"] = self._path_slash.encode("latin1")
        await self.app(scope, receive, send)


def _tool_error(error: DomainError) -> ToolError:
    return ToolError(json.dumps(error.to_dict(), ensure_ascii=False))


def _base_url(config: ServerConfig) -> str:
    if config.public_base_url.strip():
        return config.public_base_url.strip().rstrip("/")
    return f"http://127.0.0.1:{config.port}"


def create_mcp(config: ServerConfig, artifact_store: ArtifactStore, template_registry: TemplateRegistry) -> FastMCP:
    transport_hosts = sorted(
        {
            host
            for allowed in config.allowed_hosts
            for host in (allowed, f"{allowed}:*")
            if allowed != "*"
        }
    )
    transport_origins = sorted(
        {
            origin
            for host in config.allowed_hosts
            if host != "*"
            for origin in (f"http://{host}", f"http://{host}:*", f"https://{host}", f"https://{host}:*")
        }
    )
    mcp = FastMCP(
        "pptx-template-engine",
        instructions=(
            "Generate PowerPoint files by mapping semantic deck JSON into a pre-authored "
            "PowerPoint template manifest. Use icon refs only for visual/image slots."
        ),
        json_response=True,
        stateless_http=True,
        streamable_http_path="/",
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=transport_hosts,
            allowed_origins=transport_origins,
        ),
    )

    @mcp.tool()
    def list_supported_layouts() -> dict[str, Any]:
        """Return the 15 supported semantic PowerPoint layouts and their slot contracts."""
        return supported_layouts_response()

    @mcp.tool()
    def list_icons(pack: str | None = None, variant: str | None = None, query: str | None = None) -> dict[str, Any]:
        """List built-in icon names. Only these icon refs are allowed in deck payloads."""
        try:
            return list_icon_registry(pack=pack, variant=variant, query=query)
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def inspect_template(template_b64: str) -> dict[str, Any]:
        """Inspect a .pptx/.potx template and return layouts, placeholders, geometry, and fingerprint."""
        try:
            return {"inspection": inspect_template_impl(decode_b64(template_b64))}
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def propose_mapping(inspection: dict[str, Any], ruleset: dict[str, Any] | None = None) -> dict[str, Any]:
        """Generate a semantic layout/slot mapping proposal from an inspection result."""
        try:
            return {"proposal": propose_mapping_impl(inspection, ruleset)}
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def finalize_manifest(
        inspection: dict[str, Any],
        proposal: dict[str, Any],
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Finalize a template manifest. Required unresolved slots fail explicitly."""
        try:
            return {"manifest": finalize_manifest_impl(inspection, proposal, overrides)}
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def validate_manifest(template_b64: str, manifest: dict[str, Any]) -> dict[str, Any]:
        """Validate that a manifest still matches the supplied template bytes."""
        try:
            return validate_manifest_impl(decode_b64(template_b64), manifest)
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def validate_deck(deck: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
        """Validate deck JSON against the semantic schema and a finalized manifest."""
        try:
            return validate_deck_impl(deck, manifest)
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def list_templates() -> dict[str, Any]:
        """List templates available on this server for use with render_presentation.

        Each entry shows the template name, a human-readable description, and the
        set of semantic layout keys (e.g. ``cover_title``, ``list_basic``) that
        the template supports.  Pass the ``name`` value to render_presentation.
        """
        templates = template_registry.list()
        return {"templates": templates, "count": len(templates)}

    @mcp.tool()
    def render_presentation(
        deck: dict[str, Any],
        template_name: str | None = None,
        file_name: str | None = None,
    ) -> dict[str, Any]:
        """Render a PowerPoint file using a server-managed template.

        Call list_templates() first to discover available template names and
        which semantic layouts each one supports. Build the deck using only
        layouts that appear in the chosen template's supported_layouts list.
        If ``template_name`` is omitted, ``null``, empty, or whitespace-only,
        the server falls back to the template named ``default``.

        On success returns a temporary ``download_url`` (valid for ~15 minutes)
        together with slide_count and expiry metadata.
        """
        normalized_name = template_registry.normalize_name(template_name)
        entry = template_registry.resolve(template_name)
        if entry is None:
            available = [e["name"] for e in template_registry.list()]
            if not available:
                raise _tool_error(
                    DomainError(
                        "NO_TEMPLATES_CONFIGURED",
                        "No templates are available on this server. "
                        "The operator must place .pptx files and companion .manifest.json "
                        "files in the template directory.",
                        )
                    )
            if normalized_name in {None, DEFAULT_TEMPLATE_NAME}:
                raise _tool_error(
                    DomainError(
                        "DEFAULT_TEMPLATE_NOT_FOUND",
                        "No default template is available on this server. "
                        "Add default.pptx or default.potx with a companion "
                        "default.manifest.json file to the template directory.",
                        {"requested": template_name, "default": DEFAULT_TEMPLATE_NAME, "available": available},
                    )
                )
            raise _tool_error(
                DomainError(
                    "TEMPLATE_NOT_FOUND",
                    f"Template '{normalized_name}' not found.",
                    {"requested": template_name, "normalized": normalized_name, "available": available},
                )
            )
        try:
            pptx_bytes = render_pptx_impl(entry.template_bytes, entry.manifest, deck)
            artifact = artifact_store.publish(
                pptx_bytes,
                file_name or deck.get("meta", {}).get("title", "presentation.pptx"),
                _base_url(config),
            )
            return {
                "success": True,
                **artifact,
                "slideCount": len(deck.get("slides", [])),
            }
        except DomainError as exc:
            raise _tool_error(exc) from exc

    @mcp.tool()
    def render_presentation_custom(
        template_b64: str,
        manifest: dict[str, Any],
        deck: dict[str, Any],
        file_name: str | None = None,
    ) -> dict[str, Any]:
        """Render a PowerPoint using a caller-supplied template and manifest.

        This is the advanced / operator tool.  For regular use, prefer
        render_presentation() with a server-managed template instead.

        ``template_b64`` must be the base-64-encoded bytes of a ``.pptx`` or
        ``.potx`` file.  ``manifest`` must be a finalized manifest whose
        ``template_fingerprint`` matches the supplied template bytes.
        """
        try:
            pptx_bytes = render_pptx_impl(decode_b64(template_b64), manifest, deck)
            artifact = artifact_store.publish(
                pptx_bytes,
                file_name or deck.get("meta", {}).get("title", "presentation.pptx"),
                _base_url(config),
            )
            return {
                "success": True,
                **artifact,
                "slideCount": len(deck.get("slides", [])),
            }
        except DomainError as exc:
            raise _tool_error(exc) from exc

    return mcp


async def health(_request: Request) -> Response:
    return PlainTextResponse("ok")


def artifact_endpoint(artifact_store: ArtifactStore) -> Callable[[Request], Awaitable[Response]]:
    async def read_artifact(request: Request) -> Response:
        token = request.path_params["token"]
        artifact = artifact_store.read(token)
        if artifact is None:
            return JSONResponse({"error": "Artifact not found"}, status_code=404)
        data = artifact.file_path.read_bytes()
        return Response(
            data,
            media_type=artifact.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{artifact.file_name}"',
                "Content-Length": str(len(data)),
                "Cache-Control": "private, no-store, max-age=0",
            },
        )

    return read_artifact


def create_app(config: ServerConfig | None = None) -> Starlette:
    resolved = config or load_config()
    artifact_store = ArtifactStore(
        root_dir=resolved.artifact_root_dir,
        ttl_seconds=resolved.artifact_ttl_seconds,
        max_output_bytes=resolved.max_output_bytes,
    )
    template_registry = TemplateRegistry(resolved.template_dir)
    mcp = create_mcp(resolved, artifact_store, template_registry)

    @contextlib.asynccontextmanager
    async def lifespan(_app: Starlette) -> AsyncIterator[None]:
        artifact_store.init()
        warnings = template_registry.load()
        for warning in warnings:
            logger.warning("Template registry: %s", warning)
        if not warnings:
            logger.info("Template registry loaded %d template(s).", len(template_registry))
        async with mcp.session_manager.run():
            yield
        artifact_store.stop()

    app = Starlette(
        routes=[
            Route("/health", health, methods=["GET"]),
            Route("/artifacts/{token}", artifact_endpoint(artifact_store), methods=["GET"]),
            Mount("/mcp", app=mcp.streamable_http_app()),
        ],
        lifespan=lifespan,
    )
    app.add_middleware(ContentLengthLimitMiddleware, max_bytes=resolved.max_request_bytes)
    app.add_middleware(TrailingSlashNormalizationMiddleware, mount_path="/mcp")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=resolved.allowed_hosts)
    return app


app = create_app()


def main() -> None:
    config = load_config()
    uvicorn.run(
        "pptx_yaml_engine.server.app:create_app",
        factory=True,
        host=config.host,
        port=config.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
