# pptx-parser-for-ai

Template-driven PowerPoint generation MCP server.

This project maps semantic deck JSON into placeholders from a pre-authored `.pptx` template. The template owns visual design; the deck owns content; the manifest connects semantic slots to PowerPoint placeholder `idx` values.

Server-managed templates are loaded from the templates directory at startup. If
`default.pptx` or `default.potx` is present with a matching
`default.manifest.json`, `render_presentation` uses it automatically when the
caller omits `template_name` or passes `null` / blank input.

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
