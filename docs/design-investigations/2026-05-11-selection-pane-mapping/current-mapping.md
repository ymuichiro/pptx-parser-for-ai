# Current mapping implementation

## Scope and guardrails

- `APP_SPEC.md` defines the current contract: manifests are auto-generated from template bytes at startup, bind semantic slots to PowerPoint placeholder `idx`, must fingerprint-match the template, and load failure is fatal (`APP_SPEC.md:12-18`, `APP_SPEC.md:111-126`, `APP_SPEC.md:149-156`, `APP_SPEC.md:447-457`).
- `TemplateRegistry.load()` enforces that flow by calling `generate_manifest(template_bytes)` during startup and rejecting templates that do not cover the full semantic layout set (`src/pptx_yaml_engine/server/template_registry.py:67-88`, `src/pptx_yaml_engine/server/template_registry.py:117-146`).

## End-to-end flow today

1. **`inspect_template(template_bytes)`**
   - Opens the PPTX/POTX, walks every slide layout, and records:
     - `layout_name`
     - canonicalized builtin layout name (`builtin_layout_name`)
     - every shape's `shape_name`
     - placeholder-only metadata: `placeholder_idx`, `placeholder_type`
     - normalized geometry (`norm_left`, `norm_top`, `norm_center_x`, etc.)
   - Only shapes with `is_placeholder` become `layout["placeholders"]` (`src/pptx_yaml_engine/mapper/service.py:21-81`).

2. **`propose_mapping(inspection, ruleset=None)`**
   - Iterates every semantic layout in `LAYOUT_SPECS` and picks the best matching PowerPoint layout using `_score_layout()` (`src/pptx_yaml_engine/mapper/service.py:155-181`, `src/pptx_yaml_engine/mapper/service.py:361-402`).
   - Then binds slots with `_bind_generic()`:
     - explicit placeholder names first via `_bind_named_slots()`
     - title/subtitle via placeholder type + top/left ordering
     - remaining content via slot-kind inference and geometry grouping (`src/pptx_yaml_engine/mapper/service.py:217-332`).
   - Missing required slots reduce confidence and flip status to `override_required` (`src/pptx_yaml_engine/mapper/service.py:345-358`, `src/pptx_yaml_engine/mapper/service.py:384-396`).

3. **`finalize_manifest(inspection, proposal, overrides=None)`**
   - Starts only from layouts already present in `proposal["layouts"]`; it does **not** synthesize new semantic layouts from overrides (`src/pptx_yaml_engine/mapper/service.py:432-460`).
   - Merges per-layout overrides for `ppt_layout_name` and per-slot placeholder metadata (`idx`, `type`, `shape_name`, `kind`) (`src/pptx_yaml_engine/mapper/service.py:405-429`).
   - Re-checks required slots and fails hard with `REQUIRED_SLOT_MISSING` if any remain unresolved (`src/pptx_yaml_engine/mapper/service.py:441-448`).

4. **Validation**
   - `validate_manifest_against_inspection()` validates that each `ppt_layout_name` resolves against the inspected layouts and that each referenced placeholder `idx` exists on that layout (`src/pptx_yaml_engine/mapper/service.py:467-500`).
   - `validate_manifest()` additionally checks fingerprint equality (`src/pptx_yaml_engine/mapper/service.py:503-518`).
   - At render time, `validate_deck()` ensures slide `layout` values exist in both `LAYOUT_SPECS` and the manifest (`src/pptx_yaml_engine/output/validation.py:126-195`), then `render_pptx()` resolves the PowerPoint layout name and writes content to `slide.placeholders[idx]` (`src/pptx_yaml_engine/output/service.py:66-75`, `src/pptx_yaml_engine/output/service.py:197-269`).

## Where roles are determined today

### 1. Semantic layout contract

- `LAYOUT_SPECS` is the source of truth for supported semantic layouts and slot paths/kinds/requiredness (`src/pptx_yaml_engine/layouts.py:40-188`).
- `get_slot_spec(layout, path)` is used to validate whether a parsed name maps to a real slot (`src/pptx_yaml_engine/layouts.py:308-312`).

### 2. Layout selection inputs

- **Layout names:** `_score_layout()` normalizes `layout["layout_name"]` and matches against the semantic name directly (`semantic_name`) (`src/pptx_yaml_engine/mapper/service.py:155-166`).
- **Aliases:** `LAYOUT_ALIASES` provides semantic-to-layout-name aliases such as `title_slide`, `title_and_content`, `two_content`, etc.; `propose_mapping()` can extend them with `ruleset["aliases"]` (`src/pptx_yaml_engine/layouts.py:191-212`, `src/pptx_yaml_engine/mapper/service.py:364-369`).
- **Localized builtin names:** canonicalization of Office builtin layout names happens in `canonical_builtin_layout_name()` / `normalize_layout_lookup_name()` / `layout_names_match()` (`src/pptx_yaml_engine/utils/layout_names.py:5-81`). Tests cover Japanese-to-English normalization (`tests/unit/test_layout_names.py:13-31`, `tests/unit/test_mapper.py:167-252`).
- **Placeholder shape names as layout hints:** `_score_layout()` concatenates placeholder `shape_name` values and gives `shape_name_hint` if the semantic token appears in them (`src/pptx_yaml_engine/mapper/service.py:159-170`).
- **Type-count heuristics:** when names do not help, `_score_layout()` falls back to coarse placeholder-type counts and placeholder counts (`TITLE`, `BODY`, `OBJECT`, `PICTURE`, `TABLE`, `CHART`) (`src/pptx_yaml_engine/mapper/service.py:161-180`).

### 3. Slot binding inputs

- **Explicit placeholder names:** `_slot_from_shape_name()` recognizes only `slot__*`, `slot_*`, `placeholder__*`, `placeholder_*` prefixes, then rewrites patterns like `card_1_`, `left_`, `right_`, `metric_` into semantic slot paths (`src/pptx_yaml_engine/mapper/service.py:94-128`).
- **Only placeholders participate:** `_bind_named_slots()` and `_bind_generic()` consume `placeholders`, not arbitrary shapes (`src/pptx_yaml_engine/mapper/service.py:234-245`, `src/pptx_yaml_engine/mapper/service.py:247-250`).
- **Placeholder kind inference:** `_shape_kind()` infers slot kind from `placeholder_type` unless a `SlotSpec` already fixes it (`src/pptx_yaml_engine/mapper/service.py:131-141`).
- **Title/subtitle detection:** `_top_title()` and `_subtitle()` prioritize placeholder type (`TITLE`, `SUBTITLE`) and otherwise sort geometrically by `norm_top`, `norm_left` (`src/pptx_yaml_engine/mapper/service.py:183-204`).
- **Remaining content assignment:** `_content_shapes()` removes already-used/title/date/footer/slide-number placeholders, then semantic-specific code binds first text/table/chart/icon placeholders or splits content geometrically (`src/pptx_yaml_engine/mapper/service.py:206-214`, `src/pptx_yaml_engine/mapper/service.py:251-332`).

### 4. Placeholder `idx` usage

- `idx` becomes the durable manifest key in `_placeholder_binding()` (`src/pptx_yaml_engine/mapper/service.py:144-152`).
- Validation only requires that the `idx` exists on the matched layout; it does **not** validate `shape_name` or `type` fidelity (`src/pptx_yaml_engine/mapper/service.py:492-500`).
- Rendering is entirely `idx`-driven via `slide.placeholders[idx]`, including picture/table/chart insertion (`src/pptx_yaml_engine/output/service.py:66-75`, `src/pptx_yaml_engine/output/service.py:137-194`, `src/pptx_yaml_engine/output/service.py:203-218`).

## Heuristics that an `AI_*` Selection Pane naming scheme would reduce

If templates use stable explicit names like `AI_TITLE`, `AI_COL1_HEADING`, `AI_COL1_BODY`, the following code becomes unnecessary or should fall behind explicit-name matching:

- Layout alias and builtin-name guesswork for many cases (`LAYOUT_ALIASES`, localized builtin normalization, `_score_layout()` name/type heuristics) (`src/pptx_yaml_engine/layouts.py:191-212`, `src/pptx_yaml_engine/mapper/service.py:155-181`, `src/pptx_yaml_engine/utils/layout_names.py:5-81`).
- Title/subtitle inference from placeholder type + top-left ordering (`src/pptx_yaml_engine/mapper/service.py:183-231`).
- Generic first-text / second-text fallbacks for agenda, list, table, chart, image, appendix, closing (`src/pptx_yaml_engine/mapper/service.py:274-330`).
- Geometry-based left/right and 3-card grouping (`src/pptx_yaml_engine/mapper/service.py:290-323`). Tests explicitly codify these heuristics today (`tests/unit/test_mapper.py:78-164`).
- Confidence penalties caused by unresolved required slots after heuristic binding (`src/pptx_yaml_engine/mapper/service.py:384-396`).

Notably, the shipped default template already shows the benefit of explicit slot names on custom layouts: `comparison_2col`, `three_cards_vertical`, `table_basic`, `chart_basic`, and `appendix_backup` persist `slot__...` names in the generated manifest, while builtin layouts like `Title Slide` / `Title and Content` still rely on generic placeholder names and heuristics (`templates/default.manifest.json:5-129`, `templates/default.manifest.json:130-259`, `templates/default.manifest.json:285-383`).

## PowerPoint / python-pptx constraints that matter

1. **Selection Pane names are available now, but only as `shape.name`.** `inspect_template()` already records `shape_name` for every layout shape (`src/pptx_yaml_engine/mapper/service.py:41-54`).
2. **Current proposal logic ignores non-placeholder shapes.** Even though every shape has a name, slot binding operates on `layout["placeholders"]` only (`src/pptx_yaml_engine/mapper/service.py:71-72`, `src/pptx_yaml_engine/mapper/service.py:236-244`, `src/pptx_yaml_engine/mapper/service.py:382-383`).
3. **Current manifest/render pipeline requires placeholder `idx`.** `idx` is only populated when `shape.is_placeholder` is true (`src/pptx_yaml_engine/mapper/service.py:55-62`), and render-time lookup is `slide.placeholders[idx]` (`src/pptx_yaml_engine/output/service.py:66-75`).
4. **Picture/table/chart insertion depends on placeholder capabilities.** The code expects `insert_picture()`, `insert_table()`, and `insert_chart()` on the target placeholder; arbitrary named shapes are not supported by the current renderer (`src/pptx_yaml_engine/output/service.py:141-148`, `src/pptx_yaml_engine/output/service.py:156-163`, `src/pptx_yaml_engine/output/service.py:187-194`).
5. **Layout names still matter independently of shape naming.** The manifest stores `ppt_layout_name`, and both validation and rendering must resolve it, including localized builtin names (`src/pptx_yaml_engine/mapper/service.py:470-480`, `src/pptx_yaml_engine/utils/pptx.py:25-35`, `src/pptx_yaml_engine/output/service.py:249-265`).

## Practical implementation direction

- **Keep the manifest/render contract `idx`-based initially.** That preserves compatibility with the current renderer and avoids a full rewrite of output targeting.
- **Make Selection Pane naming the first-class signal in `propose_mapping()`.** Add an explicit parser for `AI_*` names and run it before alias/type/geometry heuristics.
- **Prefer named placeholders, not named arbitrary shapes, in v1 of the redesign.** That fits the existing `idx`-based manifest and render path.
- **Use legacy heuristics only as fallback for old templates.** The safest migration path is: `AI_*` explicit mapping first, current `slot__*` second, current alias/geometry heuristics last.
- **Add stronger validation if names become authoritative.** Today validation checks only `idx` existence; if the naming scheme becomes contractual, validation should also confirm expected `shape_name` patterns and possibly placeholder type.
- **Consider separating two concerns in the redesign:** layout identification (which PPT layout backs a semantic layout) and slot identification (which placeholder fills each semantic slot). `AI_*` naming is most valuable for slot identification; layout-name canonicalization may still be needed for final render resolution.

## Useful test evidence for the redesign

- Placeholder type beats idx ordering for title/content layouts: `tests/unit/test_mapper.py:78-114`.
- Three-card mapping is currently geometry-driven, not idx-driven: `tests/unit/test_mapper.py:116-164`.
- Localized builtin layout names are normalized during match/validation: `tests/unit/test_mapper.py:167-252`, `tests/unit/test_layout_names.py:13-31`.
- Registry startup fails if auto-generated mapping is incomplete or broken: `tests/unit/test_template_registry.py:150-199`.
- End-to-end render still assumes stable placeholder idx values in the produced deck: `tests/integration/test_default_template_asset.py:67-125`, `tests/integration/test_render_flow.py:13-38`.
