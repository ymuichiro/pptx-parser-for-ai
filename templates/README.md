# templates/

This directory contains server-managed PowerPoint templates.

## Operator instructions

1. Place your `.pptx` or `.potx` file here, e.g. `corporate.pptx`.
2. Restart the container (or rebuild if templates are baked into the image).

The server loads templates at startup, runs `inspect_template -> propose_mapping
-> finalize_manifest` in memory for each file, and reuses that generated
mapping for later render requests.

Invalid templates do **not** get skipped. Startup fails fast if a template:

- cannot be opened as PowerPoint
- cannot be mapped into the required semantic layouts
- violates the common semantic layout contract shared by all templates
- collides with another template after lowercase stem normalization

## Repository default template

This repository includes a generated `default.pptx` used as the server fallback
template. Regenerate it with:

```bash
.venv/bin/python scripts/make_default_template.py
```

The generator follows the visual direction in `examples/`, but emits a 16:9
PowerPoint template. `default.manifest.json` may be kept as an inspection
artifact, but runtime startup still regenerates mappings in memory and does not
depend on that file.

## File naming rules

- Names are normalised to lowercase; `Acme.pptx` and `acme.pptx` are treated as
  the same template. Duplicate normalized names are a startup error.
- The stem `default` is reserved for fallback selection. If `default.pptx` or
  `default.potx` is present, the server uses it when `render_presentation` is
  called without a usable `template_name`.
- Do not keep both `default.pptx` and `default.potx` in the same directory;
  they normalize to the same template name and will fail startup as a duplicate.

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
