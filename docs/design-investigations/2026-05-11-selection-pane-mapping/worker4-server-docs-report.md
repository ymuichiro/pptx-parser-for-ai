# Worker 4 server/docs/test cleanup report

## Summary

- Updated the public docs to describe production template authoring as a strict
  semantic-layout-name + `AI_*` Selection Pane contract.
- Removed wording that implied companion manifest files are required for
  server-managed templates or that legacy fallback naming is supported.
- Tightened operator tool descriptions in `server/app.py` so
  `inspect_template`, `propose_mapping`, `finalize_manifest`, and
  `validate_manifest` are documented as strict `AI_*` tools rather than
  heuristic mappers.
- Replaced legacy test fixture generation with the checked-in strict
  `templates/default.pptx` plus generated manifests, and aligned template
  registry tests to strict error codes including `AI_PLACEHOLDER_MISSING` and
  `AI_PLACEHOLDER_UNKNOWN`.

## Files changed

- `APP_SPEC.md`
- `README.md`
- `templates/README.md`
- `src/pptx_yaml_engine/server/app.py`
- `src/pptx_yaml_engine/server/template_registry.py`
- `tests/conftest.py`
- `tests/unit/test_server.py`
- `tests/unit/test_template_registry.py`
- `docs/design-investigations/2026-05-11-selection-pane-mapping/worker4-server-docs-report.md`

## Commands run

1. Baseline targeted tests:
   `uv run pytest tests/unit/test_server.py tests/unit/test_template_registry.py tests/unit/test_cli.py tests/integration/test_yaml_cli.py`
2. Verified strict manifest generation from the checked-in default template:
   `uv run python - <<'PY' ... generate_manifest(Path('templates/default.pptx').read_bytes()) ... PY`
3. Final targeted tests:
   `uv run pytest tests/unit/test_server.py tests/unit/test_template_registry.py tests/unit/test_cli.py tests/integration/test_yaml_cli.py`
4. Requested lint check:
   `uv run ruff check README.md templates/README.md src/pptx_yaml_engine/server/app.py src/pptx_yaml_engine/server/template_registry.py tests/conftest.py tests/unit/test_server.py tests/unit/test_template_registry.py tests/unit/test_cli.py tests/integration/test_yaml_cli.py`

## Failures

- Initial targeted pytest run failed before the cleanup because
  `tests/conftest.py` still fabricated ad hoc non-strict templates/manifests.
  Under the new contract those fixtures raised `MANIFEST_VALIDATION_FAILED`
  and caused downstream server/registry/CLI test failures.
- Final targeted pytest run: none.
- Final Ruff run: none.

## Remaining follow-up

- None from worker 4 scope.
