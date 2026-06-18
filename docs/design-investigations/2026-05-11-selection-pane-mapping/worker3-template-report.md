# Worker 3 template report

## Summary

- Migrated the default template generator to emit **one semantic PowerPoint layout per `LAYOUT_SPECS` semantic layout**.
- Replaced legacy `slot__...` placeholder names in the generated default template with strict canonical `AI_*` Selection Pane names derived from `slot_ai_placeholder_names(...)`.
- Regenerated `templates/default.pptx` and `templates/default.manifest.json` from the script, and the regenerated manifest now passes `generate_manifest()` and `validate_manifest()`.
- Updated the integration tests to assert the strict AI contract and to validate rendered content through manifest-derived slot bindings instead of old hard-coded placeholder idx/order assumptions.

## Files changed

- `scripts/make_default_template.py`
- `templates/default.pptx`
- `templates/default.manifest.json`
- `tests/integration/test_default_template_asset.py`
- `tests/integration/test_render_flow.py`
- `docs/design-investigations/2026-05-11-selection-pane-mapping/worker3-template-report.md`

## Template/manifest result

- Layout names in the generated default template are now:
  - `cover_title`
  - `section_divider`
  - `agenda`
  - `list_basic`
  - `table_basic`
  - `comparison_2col`
  - `three_cards_vertical`
  - `closing_end`
  - `chart_basic`
  - `image_caption`
  - `appendix_backup`
- Manifest slot coverage after regeneration:
  - `cover_title`: `title`, `subtitle`, `date`, `organization`, `author`
  - `section_divider`: `title`, `subtitle`, `section_no`
  - `agenda`: `title`, `subtitle`, `items`
  - `list_basic`: `title`, `subtitle`, `items`
  - `table_basic`: `title`, `subtitle`, `table`, `caption`
  - `comparison_2col`: `title`, `subtitle`, `left.icon`, `left.title`, `left.description`, `left.bullets`, `right.icon`, `right.title`, `right.description`, `right.bullets`
  - `three_cards_vertical`: `title`, `subtitle`, `cards[0].icon`, `cards[0].title`, `cards[0].description`, `cards[1].icon`, `cards[1].title`, `cards[1].description`, `cards[2].icon`, `cards[2].title`, `cards[2].description`
  - `closing_end`: `title`, `subtitle`, `message`, `contact`, `cta`
  - `chart_basic`: `title`, `subtitle`, `chart`, `caption`
  - `image_caption`: `title`, `subtitle`, `icon`, `caption`, `attribution`
  - `appendix_backup`: `title`, `subtitle`, `body`, `items`, `references`
- `three_cards_vertical` intentionally does **not** bind `cards[*].combined_text`; the default template now uses separate title/description placeholders to avoid duplicate rendering.

## Commands run

- `uv sync --all-groups`
- `uv run pytest tests/integration/test_default_template_asset.py tests/integration/test_render_flow.py` *(baseline, before migration)*
- `uv run ruff check scripts/make_default_template.py`
- `uv run python -m py_compile scripts/make_default_template.py`
- `uv run python scripts/make_default_template.py`
- `uv run python - <<'PY' ... inspect_template / generate_manifest / validate_manifest ... PY`
- `uv run ruff check --fix tests/integration/test_default_template_asset.py tests/integration/test_render_flow.py`
- `uv run ruff check scripts/make_default_template.py tests/integration/test_default_template_asset.py tests/integration/test_render_flow.py`
- `uv run pytest tests/integration/test_default_template_asset.py tests/integration/test_render_flow.py`

## Failures

### Baseline failures before migration

- `templates/default.pptx` could not satisfy the strict mapper contract:
  - generic builtin layout names no longer resolved for `agenda` / `list_basic`
  - required strict `AI_*` placeholders were missing
  - checked-in manifest still referenced legacy `slot__...` names
- Resulting failures included:
  - `PPT_LAYOUT_NOT_FOUND`
  - `AI_PLACEHOLDER_MISSING`
  - `MANIFEST_VALIDATION_FAILED`
  - registry startup failure when loading `default.pptx`

### Final status

- No remaining failures in:
  - `uv run ruff check scripts/make_default_template.py tests/integration/test_default_template_asset.py tests/integration/test_render_flow.py`
  - `uv run pytest tests/integration/test_default_template_asset.py tests/integration/test_render_flow.py`

## Follow-up needed for server/docs workers

- No template-side blocker remains for strict default-template loading/rendering.
- Server/docs workers should assume the default app path now uses:
  - semantic PowerPoint layout names
  - strict canonical `AI_*` placeholder names
  - a checked-in manifest that matches `generate_manifest(default.pptx)`
- Any remaining user-facing docs, examples, screenshots, or operational notes that still mention `slot__...`, `placeholder__...`, or shared generic builtin layout-name mapping should be updated to the strict semantic/`AI_*` contract.
