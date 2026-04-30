# templates/

This directory contains server-managed PowerPoint templates.

## Operator instructions

1. Place your `.pptx` or `.potx` file here, e.g. `corporate.pptx`.
2. Generate the companion manifest using the MCP operator tools:
   ```
   inspect_template  →  propose_mapping  →  finalize_manifest
   ```
3. Save the resulting JSON as `<stem>.manifest.json` in this directory,
   e.g. `corporate.manifest.json`.
4. Restart the container (or rebuild if templates are baked into the image).

The server loads templates at startup. Templates with a missing or stale manifest
are skipped with a warning — they do not cause the server to fail.

## File naming rules

- Template file and manifest file must share the same stem:
  `acme.pptx` ↔ `acme.manifest.json`
- Names are normalised to lowercase; `Acme.pptx` and `acme.pptx` are treated as
  the same template (only the first one found is loaded).
- The stem `default` is reserved for fallback selection. If `default.pptx` or
  `default.potx` is present with `default.manifest.json`, the server uses it
  when `render_presentation` is called without a usable `template_name`.
- Do not keep both `default.pptx` and `default.potx` in the same directory;
  they normalize to the same template name and one will be skipped as a
  duplicate.

## Selecting a template at render time

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "render_presentation",
    "arguments": {
        "deck": { ... },
        "file_name": "output.pptx"
      }
    }
  }
```

Use `list_templates` to see which templates are available and which semantic
layouts each one supports.

To force a specific template, pass its stem as `template_name`, for example
`"corporate"`. If `template_name` is omitted, `null`, empty, or whitespace-only,
the server falls back to the template named `default`.
