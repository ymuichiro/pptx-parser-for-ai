# pptx-parser-for-ai

Template-driven PowerPoint generation MCP server.

This project renders semantic deck JSON into pre-authored `.pptx` / `.potx`
templates. In production, each PowerPoint slide layout must be named for a
supported semantic layout such as `cover_title`, `agenda`, or `table_basic`,
and each bindable placeholder must use the authoritative `AI_*` Selection Pane
name for that semantic slot. The server generates and validates manifests from
template bytes at startup; normal rendering does not depend on companion
manifest files living beside the template.

Server-managed templates are loaded from `templates/` at startup. Each template
is inspected once, mapped once from PowerPoint layout names plus strict `AI_*`
placeholder names, and reused for later render requests. If `default.pptx` or
`default.potx` is present, `render_presentation` uses it automatically when the
caller omits `template_name` or passes `null` / blank input.

The repository ships with a production-oriented strict template at
`templates/default.pptx`. Its source is `scripts/make_default_template.py`, and
the visual direction is derived from the reference PNGs in `examples/`. The
examples are 4:3 screenshots, but the generated PowerPoint template is 16:9.

## Production template authoring

1. Create one PowerPoint slide layout for each supported semantic layout and
   name the layout with that semantic key.
2. In PowerPoint's Selection Pane, rename every bindable placeholder to the
   required `AI_*` name for that layout.
3. Place the `.pptx` / `.potx` file in `templates/` and restart the server.

Do not rely on generic built-in layout names such as `Title Slide` /
`Title and Content`, and do not rely on legacy `slot__...`,
`placeholder__...`, placeholder-type-only, or geometry fallback behavior.
Startup fails if the strict `AI_*` contract is incomplete or invalid.

The authoring checklist is machine-readable through `list_supported_layouts`.
Each layout entry includes:

- `templateAuthoring.powerPointLayoutNames`: semantic layout name and accepted
  aliases for the PowerPoint layout.
- `slots[].aiNames`: Selection Pane names accepted for that semantic slot.
- `slots[].compatiblePlaceholderTypes`: placeholder types that can receive the
  slot.
- `slots[].capacityGuidance`: practical content limits for keeping slides
  readable.

The complete static authoring table is also documented in
`templates/README.md`.

## Run

```bash
uv sync --all-groups
uv run pptx-template-mcp
```

The Streamable HTTP MCP endpoint is mounted at:

```text
http://127.0.0.1:3001/mcp
```

Health and generated artifacts are available at `/health` and `/artifacts/{token}`.

## Docker / Cloudflare Tunnel

Create `.env` first:

```bash
make init-env
```

Minimum settings for named-tunnel publishing:

- `CLOUDFLARE_TUNNEL_TOKEN`
- `ALLOWED_HOSTS`
- `PUBLIC_BASE_URL`

The shipped `.env.example` is already aligned to the current public host:

```env
APP_PORT=13001
ALLOWED_HOSTS=127.0.0.1,localhost,app.internal,generate-slide.notelligent.app
ENABLE_OPERATOR_TOOLS=false
PUBLIC_BASE_URL=https://generate-slide.notelligent.app
```

Start the local Docker stack:

```bash
make up
```

Start the named Cloudflare Tunnel together with the app:

```bash
make up-tunnel
```

Stop the stack:

```bash
make down
```

Local Docker endpoints:

- MCP endpoint: `http://127.0.0.1:13001/mcp`
- Health check: `http://127.0.0.1:13001/health`

Named Tunnel target:

- Hostname: `generate-slide.notelligent.app`
- Service URL: `http://app:3001`
- Path: empty

Operational checks:

- `https://generate-slide.notelligent.app/health` returns `200`
- `https://generate-slide.notelligent.app/mcp` accepts MCP initialize/tool calls
- `render_presentation` returns `downloadUrl` values rooted at `https://generate-slide.notelligent.app`
- Public deployment should expose only the end-user tool set:
  - `list_supported_layouts`
  - `list_icons`
  - `list_templates`
  - `render_presentation`

If you need template inspection / manifest-authoring tools for operator work,
set `ENABLE_OPERATOR_TOOLS=true` and restart the app.

## Local YAML -> PPTX generation

For local/operator rendering from local assets, use the dedicated CLI with the
exact template file, a finalized manifest generated from that same template, and
a deck YAML file. This is separate from the server-managed runtime, which
regenerates manifests in memory at startup and does not require
`name.manifest.json` companion files in `templates/`.

```bash
uv run pptx-template-render \
  --template templates/default.pptx \
  --manifest templates/default.manifest.json \
  --deck examples/review/sample-deck.yaml \
  --output examples/review/sample-deck.generated.pptx
```

This command uses a finalized strict manifest as the contract between the
semantic deck YAML and the template's `AI_*` placeholders.

## Tools

Public tools:

- `list_supported_layouts`
- `list_icons`
- `list_templates`
- `render_presentation`

Operator-only tools when `ENABLE_OPERATOR_TOOLS=true`:

- `inspect_template`
- `propose_mapping`
- `finalize_manifest`
- `validate_manifest`
- `validate_deck`
- `render_presentation_custom`

Use `list_templates` to inspect the templates currently loaded on the server.
The operator-only inspection/mapping tools assume the strict `AI_*` naming
contract and are not legacy fallback mappers.

Deck image fields accept only `icon` objects:

```json
{"pack": "heroicons", "name": "cloud-arrow-up", "variant": "outline", "color": "#2563EB"}
```

Paths, base64 images, uploaded assets, and arbitrary image URLs are intentionally unsupported.
