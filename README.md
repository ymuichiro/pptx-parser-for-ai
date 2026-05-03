# pptx-parser-for-ai

Template-driven PowerPoint generation MCP server.

This project maps semantic deck JSON into placeholders from a pre-authored `.pptx` template. The template owns visual design; the deck owns content; the manifest connects semantic slots to PowerPoint placeholder `idx` values.

Server-managed templates are loaded from the templates directory at startup.
Each `.pptx` / `.potx` is inspected once, mapped once, and the generated
mapping is reused for later render requests. If `default.pptx` or `default.potx`
is present, `render_presentation` uses it automatically when the caller omits
`template_name` or passes `null` / blank input.

The repository ships with a generated production-oriented `templates/default.pptx`.
Its source is `scripts/make_default_template.py`, and the visual direction is
derived from the reference PNGs in `examples/`. The examples are 4:3 screenshots,
but the generated PowerPoint template is 16:9.

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

## Local YAML -> PPTX generation

For manual/operator rendering from local assets, use the dedicated CLI with a
template file, a finalized manifest JSON, and a deck YAML file:

```bash
uv run pptx-template-render \
  --template templates/default.pptx \
  --manifest templates/default.manifest.json \
  --deck examples/review/sample-deck.yaml \
  --output examples/review/sample-deck.generated.pptx
```

This command uses the mapper's finalized manifest as the contract between the
semantic deck YAML and the PowerPoint template placeholders.

## Tools

- `list_supported_layouts`
- `list_icons`
- `inspect_template`
- `propose_mapping`
- `finalize_manifest`
- `validate_manifest`
- `validate_deck`
- `render_presentation`

Use `list_templates` to inspect the templates currently loaded on the server.

Deck image fields accept only `icon` objects:

```json
{"pack": "heroicons", "name": "cloud-arrow-up", "variant": "outline", "color": "#2563EB"}
```

Paths, base64 images, uploaded assets, and arbitrary image URLs are intentionally unsupported.
