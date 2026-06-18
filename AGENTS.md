# Copilot Instructions

## Source of truth: `APP_SPEC.md`

- Before making any code changes, always read and follow the root-level `APP_SPEC.md`.
- Treat `APP_SPEC.md` as the current source of truth for the application's purpose, scope, domain terms, business rules, user flows, API contracts, data model, authentication/authorization rules, AI/LLM behavior, testing policy, and unresolved decisions.
- If chat history, inline comments, README content, or implementation details conflict with `APP_SPEC.md`, prefer `APP_SPEC.md` unless explicitly instructed otherwise.
- Do not invent missing requirements. If a requirement is unclear or underspecified, add it to the unresolved decisions section of `APP_SPEC.md` or ask for clarification before implementing behavior that depends on it.
- When a change introduces, removes, or materially changes application behavior, update `APP_SPEC.md` in the same change set.
- For large or risky changes, propose the `APP_SPEC.md` update before modifying implementation code.
- Security, authorization, data deletion, external data transfer, billing, and AI/LLM behavior changes must be reflected in `APP_SPEC.md`.
- Keep `APP_SPEC.md` concise. Do not use it as a full implementation log, meeting memo, or exhaustive design document.

## Build, test, and lint commands

- Install dependencies: `uv sync --all-groups`
- Run the MCP server locally: `uv run pptx-template-mcp`
- Build the container image used by the local stack: `docker compose build app`
- Start the local stack: `docker compose up -d --build` or `make up`
- Lint: `uv run ruff check`
- Type-check: `uv run mypy src`
- Run the full test suite: `uv run pytest`
- Run a single test: `uv run pytest tests/unit/test_server.py::test_health_endpoint`
- Run a single integration test: `uv run pytest tests/integration/test_render_flow.py::test_inspect_finalize_render_all_layouts`

## High-level architecture

- `src/pptx_yaml_engine/layouts.py` is the semantic contract for the whole system. It defines the supported semantic slide layouts, each layout's required/optional fields, slot paths, slot kinds, `AI_*` authoring names, aliases, capacity guidance, and example payload shape.
- The operator/template-authoring pipeline lives in `src/pptx_yaml_engine/mapper/service.py`: `inspect_template` reads PowerPoint layouts/placeholders and fingerprints the template, `propose_mapping` strictly maps semantic layouts from PowerPoint layout names plus authoritative `AI_*` Selection Pane placeholder names, `finalize_manifest` applies overrides and fails if required slots are unresolved, and `validate_manifest`/`validate_manifest_against_inspection` keep manifests aligned with the actual template bytes.
- Runtime serving happens in `src/pptx_yaml_engine/server/app.py`. A Starlette app exposes `/health` and `/artifacts/{token}` and mounts FastMCP at `/mcp`. The MCP tools wrap the mapping pipeline plus render/validation tools, and the `/mcp` mount is normalized so clients can use both `/mcp` and `/mcp/` without a redirect.
- Server-managed templates are loaded on startup by `src/pptx_yaml_engine/server/template_registry.py`. The registry scans `TEMPLATE_DIR` for `.pptx`/`.potx` files, generates a strict manifest in memory from template bytes, validates the generated fingerprint against the template bytes, and exposes template summaries for `list_templates` and `render_presentation`.
- Rendering is split across `src/pptx_yaml_engine/output/validation.py` and `src/pptx_yaml_engine/output/service.py`. Deck JSON is validated against both `LAYOUT_SPECS` and the chosen manifest, then `render_pptx` clears the template's existing slides, finds the mapped PowerPoint layout by name, fills placeholder `idx` bindings with text/list/table/chart/icon content, and publishes the generated file through the artifact store.

## Key conventions

- Deck payloads must use `layout`, not `type`. Validation is intentionally strict: unknown keys are rejected, layout names must exist in `LAYOUT_SPECS`, and if a manifest is supplied the layout must also exist in `manifest["layouts"]`.
- Visual/image slots accept only built-in icon references such as `{"pack": "heroicons", "name": "cloud-arrow-up", "variant": "outline", "color": "#2563EB"}`. Local paths, uploaded assets, arbitrary URLs, and base64 image payloads are intentionally unsupported.
- Template files and manifests are paired by stem: `name.pptx` or `name.potx` must sit next to `name.manifest.json`. Template names are normalized to lowercase, and bad templates are skipped with warnings at startup instead of failing the whole server.
- `default.pptx` or `default.potx` with `default.manifest.json` is the fallback template. `render_presentation` treats omitted, `null`, empty, and whitespace-only `template_name` values as "use default".
- For regular rendering flows, prefer `list_templates` + `render_presentation` with server-managed templates. `render_presentation_custom` is the operator-oriented path for caller-supplied template bytes and manifests.
- If you change template mapping logic, remember that `finalize_manifest` only emits semantic layouts that were already present in `propose_mapping`. Overrides can fix an existing proposed layout, but they cannot introduce a brand-new semantic layout from scratch.
- Placeholder naming is the production contract. Author templates with documented `AI_*` Selection Pane names only; `slot__...`, `placeholder__...`, placeholder-type-only, and geometry fallback mapping are not supported production behavior.
- Errors are surfaced as structured `DomainError` payloads with `code`, `message`, and `details`. Validators return `{"valid": bool, "issues": [...]}`; render/tool entry points raise `DomainError` when invalid input should fail the operation.
