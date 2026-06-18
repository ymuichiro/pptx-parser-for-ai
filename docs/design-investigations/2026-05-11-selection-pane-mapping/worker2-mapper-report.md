# Worker 2 mapper report

## Summary

- Replaced mapper proposal/finalization logic with a strict `AI_*` contract path in `src/pptx_yaml_engine/mapper/service.py`.
- Removed supported legacy binding behavior based on `slot__...` / `placeholder__...`, placeholder type inference, geometry/order sorting, and generic builtin-layout fallback.
- Added explicit slot-to-`AI_*` naming helpers and practical alias tables in `src/pptx_yaml_engine/layouts.py`.
- Rewrote `tests/unit/test_mapper.py` around synthetic inspections that prove strict `AI_*` behavior.

## Files changed

- `src/pptx_yaml_engine/layouts.py`
- `src/pptx_yaml_engine/mapper/service.py`
- `tests/unit/test_mapper.py`
- `docs/design-investigations/2026-05-11-selection-pane-mapping/worker2-mapper-report.md`

## What changed

### `layouts.py`

- Tightened `LAYOUT_ALIASES` so layout resolution uses only semantic names or explicit alias names, not shared generic builtin names like `title_and_content` / `two_content`.
- Added `slot_ai_placeholder_names(layout, path)` as the inspectable source of truth for strict Selection Pane names.
- Kept canonical slot-path-derived names (for example `cards[0].title -> AI_CARDS_1_TITLE`) and added explicit practical aliases where needed (for example `AI_CARD1_TITLE`, `AI_COL1_TITLE`, `AI_COLUMN1_TITLE`, `AI_CARD1_BODY`).

### `mapper/service.py`

- `propose_mapping()` now resolves layouts only by semantic layout name or explicit alias tables, with optional explicit `ruleset.aliases` support.
- Slot binding now only considers placeholder shapes whose Selection Pane name starts with `AI_` and matches the explicit contract from `slot_ai_placeholder_names(...)`.
- Added strict proposal issues for:
  - `AI_PLACEHOLDER_MISSING`
  - `AI_PLACEHOLDER_DUPLICATED`
  - `AI_TARGET_NOT_PLACEHOLDER`
  - `AI_PLACEHOLDER_INCOMPATIBLE`
- `finalize_manifest()` now fails unresolved required slots with `AI_PLACEHOLDER_MISSING` and validates the strict contract before returning.
- `validate_manifest_against_inspection()` now validates:
  - authoritative `shape_name`
  - strict contract membership for that slot
  - placeholder-only targeting
  - uniqueness
  - slot-kind compatibility
  - authoritative name to cached `idx` consistency via `AI_PLACEHOLDER_IDX_MISMATCH`
- Existing fingerprint validation remains intact in `validate_manifest()`.

### `tests/unit/test_mapper.py`

- Removed legacy geometry/type-order tests.
- Added strict tests for:
  - `AI_*` binding success
  - strict layout-name matching
  - missing required `AI_*` placeholders
  - duplicate `AI_*` names
  - `AI_*` names on non-placeholder shapes
  - ignoring legacy non-`AI_*` names
  - `AI_PLACEHOLDER_IDX_MISMATCH`

## Tests run

- `uv run ruff check src/pptx_yaml_engine/layouts.py src/pptx_yaml_engine/mapper/service.py tests/unit/test_mapper.py`
- `uv run pytest tests/unit/test_mapper.py`
- `uv run mypy src`

## Failures

- None in the commands above.

## Follow-up required for template/server workers

- PowerPoint layouts must now be named with the semantic layout name or one of the explicit aliases in `LAYOUT_ALIASES`; shared generic builtin names like `Title and Content` are no longer a supported mapping signal for content semantics.
- Bindable placeholders must now use the strict `AI_*` Selection Pane names from `slot_ai_placeholder_names(...)`; legacy `slot__...` / `placeholder__...` names no longer bind.
- Any templates/manifests/integration tests that still depend on generic builtin layout names, geometry fallback, or legacy placeholder names need to be migrated to the strict contract.

## 2026-05-16 review pass

### Blockers fixed

- `validate_manifest_against_inspection()` now fails manifests that omit required slot bindings for a declared semantic layout. Missing required slot entries now produce `AI_PLACEHOLDER_MISSING` even when the slot is absent from the manifest payload entirely.
- `validate_manifest_against_inspection()` now also fails manifests that omit one or more semantic layouts from `LAYOUT_SPECS` entirely. The validator emits `TEMPLATE_LAYOUT_CONTRACT_MISMATCH` with `expected`, `actual`, and `missing` details instead of silently accepting a partial semantic contract.
- Strict AI contract validation now scans **all** `AI_*` shapes on the selected PowerPoint layout, not just the shape referenced by a manifest slot:
  - duplicate `AI_*` names anywhere on the layout -> `AI_PLACEHOLDER_DUPLICATED`
  - `AI_*` names attached to non-placeholder shapes -> `AI_TARGET_NOT_PLACEHOLDER`
  - unknown `AI_*` names outside the allowed set for that semantic layout -> `AI_PLACEHOLDER_UNKNOWN`
- `finalize_manifest()` now rejects partial proposals that omit semantic layouts required by `LAYOUT_SPECS` instead of silently emitting a partial manifest. The failure code is `TEMPLATE_LAYOUT_CONTRACT_MISMATCH`.

### Tests added/adjusted

- `validate_manifest_against_inspection()` now has explicit unit coverage for:
  - required slot missing from manifest
  - semantic layouts omitted from the manifest contract
  - duplicate `AI_*` name on an unselected optional slot
  - unknown `AI_*` typo on the selected layout
  - `idx` mismatch via direct manifest validation
- `finalize_manifest()` now has explicit unit coverage for:
  - partial proposal rejection when a semantic layout is missing
  - unresolved required slot failure under a complete proposal contract

### Commands run

- `uv run pytest tests/unit/test_mapper.py`
- `uv run ruff check src/pptx_yaml_engine/mapper/service.py tests/unit/test_mapper.py`

### Results

- `pytest`: 13 passed
- `ruff`: passed
