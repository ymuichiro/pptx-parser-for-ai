# APP_SPEC update for strict Selection Pane mapping

## APP_SPEC sections changed

- `## 1. アプリケーション概要`
  - Replaced the old idx-first description with a strict contract: manifests are generated from PowerPoint layout names plus authoritative `AI_*` placeholder Selection Pane names, while `idx` remains an internal render locator.
- `## 2. 非目的・やらないこと`
  - Explicitly removed legacy fallback behavior from product scope: `slot__...` / `placeholder__...` naming, placeholder-type heuristics, geometry inference, and arbitrary non-placeholder shape rendering.
- `## 3. 現在の機能一覧`
  - Reworded inspection / mapping / validation features so they describe strict `AI_*` Selection Pane handling rather than generic manifest generation.
- `## 4. ドメイン用語`
  - Added `AI placeholder name` as the authoritative contract term and demoted `Placeholder idx` to an internal cached locator.
- `## 5. 主要な業務ルール・不変条件`
  - Added the core product rules: template authors must name bindable placeholders with `AI_*`; mapping is generated only from layout name + `AI_*` name; v1 supports placeholders only; startup must fail on missing / duplicated / non-placeholder / incompatible / idx-inconsistent targets.
- `## 6. ユーザーフロー`
  - Updated template registration to require author-assigned `AI_*` placeholder names and made strict validation failures explicit in the startup flow.
- `## 8. API仕様`
  - Updated tool semantics so `inspect_template`, `propose_mapping`, `finalize_manifest`, and `validate_manifest` all assume the strict `AI_*` naming contract.
- `## 9. データモデル`
  - Clarified that manifests store authoritative `AI_*` names plus cached `idx`, and that slide slots bind through that contract.
- `## 11. AI機能・LLM利用方針`
  - Removed any implication that production can rely on auto-inference from legacy naming or geometry.
- `## 13. エラーハンドリング方針`
  - Added explicit error conditions for strict Selection Pane validation failures.
- `## 15. テスト方針`
  - Added required coverage for strict `AI_*` contract enforcement and for rejecting legacy fallback mapping as supported behavior.

## Required implementation follow-up

1. Update template inspection and manifest generation so the supported mapping path is strictly `PowerPoint layout name + AI_* placeholder name -> placeholder idx`.
2. Remove legacy supported behavior from mapper logic and tests: no production fallback from `slot__...`, `placeholder__...`, placeholder type, geometry, or left/right/card inference.
3. Keep placeholder `idx` only as a cached render locator if desired, but make `shape_name` / `AI_*` target name the authoritative manifest contract everywhere validation reasons about correctness.
4. Make startup/template registration fail hard when required `AI_*` placeholders are missing, duplicated, non-placeholder, incompatible with the slot kind, or inconsistent with the cached `idx`.
5. Keep v1 rendering scoped to PowerPoint placeholders only; do not add arbitrary non-placeholder shape targeting as part of this redesign.
6. Update templates, manifests, and tests so every supported semantic layout is authored and validated against the strict `AI_*` naming contract.

## Unresolved decisions

None found in APP_SPEC scope. The remaining work is implementation follow-up to codify the exact `AI_*` name set in code, templates, and tests without reintroducing fallback behavior.
