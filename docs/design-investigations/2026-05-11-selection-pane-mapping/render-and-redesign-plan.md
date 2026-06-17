# Render path and redesign plan for Selection Pane-driven slot mapping

## Scope

This note investigates how the current renderer targets text/icon/table/chart content, what “always insert into the matching shape” means today, and what would have to change to make PowerPoint Selection Pane names such as `AI_TITLE`, `AI_COL1_HEADING`, and `AI_COL1_BODY` the authoritative slot identifiers.

Primary references:

- `APP_SPEC.md:12-18`, `APP_SPEC.md:90-98`, `APP_SPEC.md:111-126`, `APP_SPEC.md:149-156`, `APP_SPEC.md:256-291`, `APP_SPEC.md:317-323`, `APP_SPEC.md:349-352`, `APP_SPEC.md:447-457`, `APP_SPEC.md:495-505`
- `src/pptx_yaml_engine/output/service.py:66-75`, `src/pptx_yaml_engine/output/service.py:103-218`, `src/pptx_yaml_engine/output/service.py:221-269`
- `src/pptx_yaml_engine/output/validation.py:126-195`
- `src/pptx_yaml_engine/server/app.py:156-318`
- `src/pptx_yaml_engine/server/template_registry.py:67-148`
- `src/pptx_yaml_engine/mapper/service.py:21-81`, `src/pptx_yaml_engine/mapper/service.py:94-152`, `src/pptx_yaml_engine/mapper/service.py:155-180`, `src/pptx_yaml_engine/mapper/service.py:217-332`, `src/pptx_yaml_engine/mapper/service.py:405-518`
- `src/pptx_yaml_engine/layouts.py:9-23`, `src/pptx_yaml_engine/layouts.py:40-188`, `src/pptx_yaml_engine/layouts.py:308-312`
- `tests/unit/test_mapper.py:22-58`, `tests/unit/test_mapper.py:78-164`, `tests/unit/test_mapper.py:204-252`
- `tests/unit/test_template_registry.py:34-47`, `tests/unit/test_template_registry.py:150-199`
- `tests/unit/test_server.py:154-179`, `tests/unit/test_server.py:209-325`
- `tests/unit/test_deck_validation.py:8-35`
- `tests/integration/test_render_flow.py:13-38`
- `tests/integration/test_default_template_asset.py:25-125`
- `templates/default.manifest.json:5-383`

## 1. What “always insert into the matching shape” means today

Today, “matching shape” does **not** mean “find the Selection Pane shape whose name matches the slot at render time.” It means:

1. `inspect_template()` records every layout shape name, but only placeholders receive `placeholder_idx` and `placeholder_type`, and only placeholders participate in mapping (`src/pptx_yaml_engine/mapper/service.py:21-81`).
2. `propose_mapping()` and `finalize_manifest()` produce slot bindings shaped like `{"kind": ..., "placeholder": {"idx": ..., "type": ..., "shape_name": ...}}`. The durable render key is `placeholder.idx`; `shape_name` is carried along as metadata (`src/pptx_yaml_engine/mapper/service.py:144-152`, `src/pptx_yaml_engine/mapper/service.py:405-429`, `src/pptx_yaml_engine/mapper/service.py:456-460`).
3. `render_pptx()` resolves the PowerPoint layout by `ppt_layout_name`, adds a slide from that layout, then `_render_slide()` fetches the target object with `slide.placeholders[idx]` and dispatches by slot kind (`src/pptx_yaml_engine/output/service.py:66-75`, `src/pptx_yaml_engine/output/service.py:197-218`, `src/pptx_yaml_engine/output/service.py:247-265`).
4. Text/list writes call `_write_text()` / `_write_list()`, icons call `insert_picture()`, tables call `insert_table()`, and charts call `insert_chart()` on that placeholder object (`src/pptx_yaml_engine/output/service.py:103-194`).

So the current invariant is:

- **authoring-time slot selection may look at names**
- **validation-time manifest checks only that the `idx` exists**
- **render-time insertion is entirely `idx`-driven**

That is also the contract reflected in the current spec: manifests bind semantic slots to placeholder `idx`, and the normal render path inserts into existing template placeholders/content regions rather than rendering a new slide UI in Python (`APP_SPEC.md:12-18`, `APP_SPEC.md:90-98`, `APP_SPEC.md:111-126`).

### Important consequence: “matching” can still mean “same placeholder reused”

The renderer explicitly supports multiple semantic slots sharing one placeholder `idx`:

- `_render_slide()` tracks `seen_idx` and switches text/list writes to `append=True` when a second slot points at the same placeholder (`src/pptx_yaml_engine/output/service.py:198-218`).
- The mapper intentionally creates shared-target bindings in some fallback cases, e.g. `appendix_backup.items -> body` and `three_cards_vertical` fallback `combined_text` reuse (`src/pptx_yaml_engine/mapper/service.py:265-272`, `src/pptx_yaml_engine/mapper/service.py:316-327`).
- The shipped default manifest already has one shared target: `appendix_backup.body` and `appendix_backup.items` both point at `idx=13`, `shape_name="slot__body"` (`templates/default.manifest.json:349-380`).

So “always insert into the matching shape” is currently best read as:

> Insert into the placeholder selected by the manifest for that slot, even if multiple slots intentionally share the same placeholder.

It is **not** currently:

> Resolve the target by Selection Pane name and guarantee one semantic slot per named shape.

## 2. Which abstractions would need to change

If Selection Pane names become the new source of truth, the target abstraction has to move from “placeholder idx” to “named bindable target.” Concretely, four places change:

| Layer | Current abstraction | What would need to change |
| --- | --- | --- |
| Inspection | `shape_name` on every shape, but placeholder identity is effectively `placeholder_idx` (`src/pptx_yaml_engine/mapper/service.py:21-81`) | A first-class bindable target model keyed by authoritative name, with placeholder/non-placeholder capability metadata |
| Manifest | `slots[path].placeholder = {idx, type, shape_name}` (`src/pptx_yaml_engine/mapper/service.py:144-152`, `src/pptx_yaml_engine/mapper/service.py:456-460`) | A target reference whose primary key is the name; `idx` becomes a cached locator or one variant of a target union |
| Manifest validation | Confirm `ppt_layout_name` exists and referenced `idx` exists (`src/pptx_yaml_engine/mapper/service.py:467-500`) | Confirm authoritative name exists exactly once, maps to the intended slot, and is compatible with the slot kind; optionally also confirm cached `idx`/`type` still match |
| Render resolution | `slide.placeholders[idx]` (`src/pptx_yaml_engine/output/service.py:66-75`, `src/pptx_yaml_engine/output/service.py:203-218`) | Either keep placeholder-idx rendering but derive/validate that idx from authoritative names, or introduce a new name/shape-based resolver |

`validate_deck()` is much less affected. It validates semantic deck structure and manifest coverage, not low-level target resolution (`src/pptx_yaml_engine/output/validation.py:126-195`, `tests/unit/test_deck_validation.py:8-35`).

## 3. Constraints in the current code that matter for the redesign

### 3.1 Mapping already sees names, but only on placeholders

The mapper already uses names, but only as an authoring-time hint:

- `_slot_from_shape_name()` recognizes only `slot__*`, `slot_*`, `placeholder__*`, and `placeholder_*` prefixes today (`src/pptx_yaml_engine/mapper/service.py:94-128`).
- `_bind_named_slots()` operates only on `placeholders`, not arbitrary shapes (`src/pptx_yaml_engine/mapper/service.py:234-245`).
- `_bind_generic()` then falls back to title/subtitle inference, placeholder kind inference, and geometry grouping (`src/pptx_yaml_engine/mapper/service.py:247-332`).

Current tests lock those heuristics in:

- title/content mapping prefers placeholder type over idx order (`tests/unit/test_mapper.py:78-114`)
- three-card binding is geometry-driven (`tests/unit/test_mapper.py:116-164`)
- localized builtin layout names are normalized during matching/validation (`tests/unit/test_mapper.py:167-252`)

### 3.2 Validation does not treat `shape_name` as authoritative today

`validate_manifest_against_inspection()` builds `idx -> type` from layout placeholders and only checks whether the manifest’s `idx` exists. It does **not** verify that `shape_name` exists, is unique, or still points to the same placeholder (`src/pptx_yaml_engine/mapper/service.py:491-500`).

### 3.3 The shipped assets still reflect the idx-first world

The default manifest is mixed:

- several builtin layouts still store localized/generic PowerPoint names such as `"タイトル 6"`, `"Subtitle 2"`, `"コンテンツ プレースホルダー 8"`, and `"Picture Placeholder 2"` (`templates/default.manifest.json:5-103`, `templates/default.manifest.json:310-341`)
- custom layouts already use explicit `slot__...` names such as `slot__table`, `slot__left_title`, `slot__card_1_combined_text`, and `slot__chart` (`templates/default.manifest.json:105-258`, `templates/default.manifest.json:285-383`)

This is why the current default template partly benefits from naming already, but still relies on heuristics and placeholder idxs overall.

### 3.4 A pure runtime slide-shape-name renderer is not a drop-in replacement

I also ran a quick runtime check against `templates/default.pptx` by adding slides from the template layouts with `python-pptx`. Two findings matter:

1. Placeholder names from the **layout** do not survive on the instantiated **slide** as stable Selection Pane names. For example, `slot__card_1_combined_text` on the `three_cards_vertical` layout became generic slide placeholder names like `Content Placeholder 2`.
2. Non-placeholder decorative layout shapes did not appear in `slide.shapes` on the generated slide.

That strongly argues against option B as a first step. Even if authoring uses stable layout names, the current render object model exposed by `python-pptx` still naturally resolves placeholders by `idx`, not by a stable slide-shape Selection Pane name.

## 4. Option comparison

### Option A: require `AI_*` names only on PowerPoint placeholders and keep idx-based rendering

**Summary**

- Authoritative slot ID is the Selection Pane name on a placeholder.
- Mapping and validation become name-first.
- Rendering still writes to `slide.placeholders[idx]`.

**What changes**

- Extend `_slot_from_shape_name()` or replace it with an explicit `AI_* -> semantic slot path` parser (`src/pptx_yaml_engine/mapper/service.py:94-128`).
- Make name-based binding run before heuristic binding in `_bind_named_slots()` / `_bind_generic()` (`src/pptx_yaml_engine/mapper/service.py:234-332`).
- Strengthen manifest validation so `shape_name` is checked for existence, uniqueness, and type compatibility, not just `idx` existence (`src/pptx_yaml_engine/mapper/service.py:467-500`).
- Keep `_render_slide()` and the text/icon/table/chart writers mostly unchanged (`src/pptx_yaml_engine/output/service.py:103-218`).

**Pros**

- Smallest code change with the biggest determinism gain.
- Preserves the current `insert_picture()`, `insert_table()`, and `insert_chart()` behavior, which already assumes placeholders (`src/pptx_yaml_engine/output/service.py:137-194`).
- Keeps `render_presentation` and `render_presentation_custom` request/response contracts stable (`src/pptx_yaml_engine/server/app.py:168-318`).
- Fits the current spec more naturally because the app already promises placeholder/content-region insertion instead of arbitrary Python-drawn slide layouts (`APP_SPEC.md:12-18`, `APP_SPEC.md:111-126`).

**Cons**

- Does not support arbitrary text boxes or decorative shapes as bindable targets.
- Still depends on placeholder existence, because the actual render locator remains `idx`.
- If the naming grammar is ambiguous (`AI_COL1_HEADING` can mean different slot paths on different semantic layouts), the mapper still needs a per-layout translation table.

### Option B: allow arbitrary named shapes and add shape-id/name-based rendering

**Summary**

- Authoritative slot ID is a Selection Pane name or shape ID on any shape, not just placeholders.
- Renderer resolves a shape directly rather than going through `slide.placeholders[idx]`.

**What changes**

- Inspection must promote non-placeholder shapes to first-class bindable targets, not just record them passively in `shapes` (`src/pptx_yaml_engine/mapper/service.py:34-72`).
- Manifest needs a target union such as `placeholder` vs `shape`, rather than today’s hardcoded `placeholder` object (`src/pptx_yaml_engine/mapper/service.py:144-152`, `src/pptx_yaml_engine/mapper/service.py:456-460`).
- Renderers must branch by target type:
  - text could use any shape with `text_frame`
  - icon/table/chart would need geometry-based replacement or overlay logic, because non-placeholder shapes do not support the current `insert_*()` APIs (`src/pptx_yaml_engine/output/service.py:137-194`)
- Validation must check shape existence/uniqueness/capability instead of just placeholder idx existence (`src/pptx_yaml_engine/mapper/service.py:467-500`).

**Pros**

- Most flexibility for template authors.
- Makes Selection Pane naming directly visible and intuitive in PowerPoint.

**Cons**

- Much larger rewrite.
- Fights the current `python-pptx` object model used by this repo: the code writes to generated slide placeholders, and runtime evidence shows layout names do not survive there as stable slide-shape names.
- High risk for table/chart/icon behavior, because current insertion depends on placeholder-native APIs.
- More likely to stretch the current spec rule that normal rendering must not draw new layout decoration in Python (`APP_SPEC.md:125-126`), because replacing arbitrary shapes often means delete/add/overlay behavior rather than filling an existing placeholder.

## 5. Recommended first implementation path

**Recommend Option A first: authoritative `AI_*` names on placeholders, but keep idx-based rendering.**

That is the best practical path because it removes mapping ambiguity without rewriting the output engine.

### Proposed implementation sequence

1. **Define a canonical AI naming grammar against existing semantic slot paths.**
   - `LAYOUT_SPECS` remains the slot source of truth (`src/pptx_yaml_engine/layouts.py:40-188`).
   - The naming grammar should compile to those slot paths, not invent a second slot taxonomy.
   - If product wants names like `AI_COL1_HEADING` / `AI_COL1_BODY`, keep a per-layout translation table and document it explicitly.
   - Safer long-term alternatives are slot-path-like names such as `AI_TITLE`, `AI_SUBTITLE`, `AI_LEFT_TITLE`, `AI_LEFT_DESCRIPTION`, `AI_RIGHT_TITLE`, `AI_RIGHT_DESCRIPTION`, `AI_CARD1_ICON`, `AI_CARD1_BODY`, `AI_TABLE`, `AI_CHART`, `AI_BODY`, `AI_REFERENCES`.

2. **Make AI names the highest-precedence binding signal.**
   - For a layout with required `AI_*` placeholder names, bind those first and skip geometry/type heuristics for required slots.
   - Preserve the current fallback order for legacy templates:
     1. `AI_*`
     2. current `slot__*` / `placeholder__*`
     3. current alias/type/geometry heuristics

3. **Keep manifest rendering-compatible in the first iteration.**
   - Keep the existing manifest slot shape for now:
     - `slots[path].placeholder.idx`
     - `slots[path].placeholder.type`
     - `slots[path].placeholder.shape_name`
   - But change the semantics:
     - `shape_name` becomes authoritative
     - `idx` becomes the cached render locator
     - `type` remains a capability check
   - This avoids breaking `TemplateRegistry`, `render_presentation`, and `render_presentation_custom` while still changing the source of truth (`src/pptx_yaml_engine/server/template_registry.py:67-148`, `src/pptx_yaml_engine/server/app.py:168-318`).

4. **Strengthen manifest validation before render, not during write.**
   - `validate_manifest_against_inspection()` should verify:
     - the target name exists on the selected layout
     - it exists exactly once
     - it is a placeholder in v1
     - its `idx` matches the manifest
     - its placeholder type is compatible with the slot kind
   - This is the right place because render-time slide objects do not preserve the same author-facing names reliably.

5. **Keep the output writers unchanged in v1.**
   - `_write_text`, `_write_list`, `_write_icon`, `_write_table`, and `_write_chart` can stay as-is because they already operate on placeholder objects (`src/pptx_yaml_engine/output/service.py:103-194`).
   - The only render-path change needed in v1 should be at most clearer error reporting if a prevalidated target somehow fails.

6. **Delay arbitrary-shape rendering until there is a concrete need that placeholders cannot satisfy.**
   - If that need arrives later, introduce a manifest v2 target union rather than overloading the current `placeholder` object.

## 6. APP_SPEC sections that must change if Selection Pane names become the source of truth

If this is not just an implementation detail but the new contract, these sections need updates:

| APP_SPEC section | Why it must change |
| --- | --- |
| `APP_SPEC.md:12-18` (application purpose) | It currently says the manifest binds semantic slots to PowerPoint placeholder `idx`. That would need to say Selection Pane identifiers are authoritative, with placeholder idx retained only as an internal render locator if option A is chosen. |
| `APP_SPEC.md:90-98` (domain terms) | `Manifest` and `Placeholder idx` are currently defined in idx-first terms. Add a term for authoritative slot identifier / Selection Pane name. |
| `APP_SPEC.md:111-126` (business rules) | Add the operator rule for stable `AI_*` naming. Also explicitly decide whether v1 supports only placeholders or arbitrary shapes. |
| `APP_SPEC.md:149-156` (template registration flow) | Startup failure conditions should include missing/duplicate/invalid AI target names when strict mode is active. |
| `APP_SPEC.md:256-291` (tool/API section) | `inspect_template`, `propose_mapping`, `finalize_manifest`, and `validate_manifest` semantics change materially even if `render_presentation` input does not. |
| `APP_SPEC.md:317-323`, `APP_SPEC.md:349-352` (data model) | `TemplateEntry.manifest` and slide-to-slot binding wording should describe named targets rather than only placeholder idxs. |
| `APP_SPEC.md:401-419` (AI/tooling guidance) | Operator guidance should mention the authoritative naming scheme when preparing templates. |
| `APP_SPEC.md:447-457` (error model) | Current targeting errors are idx-centric. Name-centric validation needs its own documented error cases. |
| `APP_SPEC.md:495-505` (test policy) | Required tests need to cover AI-name validation and render determinism. |

## 7. API/tool contract changes

### Contracts that can stay stable in the recommended path

- `render_presentation(deck, template_name, file_name)` can remain unchanged (`src/pptx_yaml_engine/server/app.py:168-243`).
- `render_presentation_custom(template_b64, manifest, deck, file_name)` can remain unchanged (`src/pptx_yaml_engine/server/app.py:295-320`).
- `validate_deck(deck, manifest)` likely stays unchanged because deck payloads remain semantic, not target-addressed (`src/pptx_yaml_engine/output/validation.py:126-195`).

### Contracts that should change or gain stronger semantics

- `inspect_template`
  - Option A: no required schema break, but docs should explicitly say `shape_name` is the authoring identifier and only placeholders are bindable in v1.
  - Option B: would need to expose bindable non-placeholder shape capabilities clearly.
- `propose_mapping`
  - add explicit name-first precedence
  - ideally surface whether a slot came from `ai_name`, `legacy_name`, or heuristic binding
- `finalize_manifest`
  - should reject unresolved required AI slots in strict mode
  - should preserve authoritative names in the finalized manifest
- `validate_manifest`
  - should validate `shape_name`/uniqueness/type compatibility, not just `idx`

## 8. Manifest schema changes

### Recommended v1-compatible change

Keep the current manifest shape but redefine meaning:

```json
{
  "slots": {
    "title": {
      "kind": "text",
      "placeholder": {
        "idx": 0,
        "type": "TITLE",
        "shape_name": "AI_TITLE"
      }
    }
  }
}
```

Recommended semantics:

- `shape_name`: authoritative identifier
- `idx`: cached render lookup for `slide.placeholders[idx]`
- `type`: compatibility hint/validation input

This likely does **not** require an immediate public tool signature change, but it **does** materially change manifest semantics, so a `manifest_version` bump should still be considered if external callers persist manifests (`src/pptx_yaml_engine/mapper/service.py:456-460`).

### Option B schema direction

If arbitrary shapes are added later, the schema should become explicit instead of overloading `placeholder`:

```json
{
  "slots": {
    "title": {
      "kind": "text",
      "target": {
        "mode": "placeholder",
        "name": "AI_TITLE",
        "idx": 0,
        "type": "TITLE"
      }
    }
  }
}
```

and eventually:

```json
{
  "target": {
    "mode": "shape",
    "name": "AI_COL1_BODY",
    "shape_kind": "text_box"
  }
}
```

I would **not** do that in the first implementation.

## 9. Validation changes

The main validation work should land in `validate_manifest_against_inspection()` (`src/pptx_yaml_engine/mapper/service.py:467-500`).

Recommended new checks:

1. **Authoritative-name existence**
   - fail if required `shape_name` is absent from the chosen layout
2. **Uniqueness**
   - fail if the same authoritative name appears more than once on one layout
3. **Placeholder-only check in v1**
   - fail if an `AI_*` target resolves to a non-placeholder when using option A
4. **Kind/type compatibility**
   - text/list -> text-capable placeholder
   - icon -> picture placeholder
   - table -> table placeholder
   - chart -> chart placeholder
5. **Name-to-idx consistency**
   - if manifest caches `idx`, verify that the named target’s actual idx matches it
6. **Strict-mode required coverage**
   - if a layout opts into AI naming, required slots should not quietly fall back to heuristics

Likely new error codes:

- `AUTHORITATIVE_TARGET_NOT_FOUND`
- `DUPLICATE_TARGET_NAME`
- `TARGET_KIND_MISMATCH`
- `TARGET_NAME_IDX_MISMATCH`
- `NON_PLACEHOLDER_TARGET_UNSUPPORTED`

These would supplement, not replace, current errors such as `PLACEHOLDER_IDX_NOT_FOUND` and `PPT_LAYOUT_NOT_FOUND` (`APP_SPEC.md:447-457`).

## 10. Test impact

### Tests that would need updates or additions

1. **Mapper unit tests**
   - add AI-name parser tests alongside the current `slot__*` coverage
   - prove AI names beat type/geometry heuristics
   - prove missing/duplicate AI names fail correctly
   - prove manifest validation fails on `shape_name`/`idx` mismatch
   - current heuristic tests remain useful as legacy fallback coverage (`tests/unit/test_mapper.py:78-164`)

2. **Template registry tests**
   - add startup-failure tests when strict AI-name coverage is incomplete, similar to current contract-mismatch/mapping-failure tests (`tests/unit/test_template_registry.py:150-199`)

3. **Server tests**
   - `render_presentation` request/response tests probably stay the same
   - operator-tool exposure tests stay the same unless tool schemas change (`tests/unit/test_server.py:154-179`, `tests/unit/test_server.py:209-325`)

4. **Integration render tests**
   - add a fixture/template whose placeholders are explicitly AI-named
   - assert content lands in the intended semantic targets without relying on current geometry fallback (`tests/integration/test_render_flow.py:13-38`)

5. **Default template asset tests**
   - if the shipped default template is migrated, these tests must be updated because they currently assert idx-oriented outcomes and reflect a mix of generic and `slot__*` naming (`tests/integration/test_default_template_asset.py:67-125`, `templates/default.manifest.json:5-383`)

### Tests that likely do not need conceptual change

- deck schema tests, because deck payloads stay semantic rather than target-addressed (`tests/unit/test_deck_validation.py:8-35`)

## 11. Migration risks

1. **The current template estate is not AI-named yet.**
   - The shipped default manifest shows a mix of generic localized names and `slot__*` names, not `AI_*` (`templates/default.manifest.json:5-383`).
   - A strict AI-only rollout would break startup for current templates because registry load fails fast on incomplete mapping (`src/pptx_yaml_engine/server/template_registry.py:67-148`, `tests/unit/test_template_registry.py:150-199`).

2. **Selection Pane names are great for mapping, but not obviously safe for runtime slide lookup.**
   - The current renderer writes against generated slide placeholders by `idx` (`src/pptx_yaml_engine/output/service.py:66-75`, `src/pptx_yaml_engine/output/service.py:203-218`).
   - Runtime checks on the default template show layout names do not survive on instantiated slides as stable placeholder names.

3. **Option B creates a chart/table/icon problem immediately.**
   - Current chart/table/icon insertion is placeholder-native (`src/pptx_yaml_engine/output/service.py:137-194`).
   - Arbitrary named shapes would force geometry-based replacement or overlay code, with higher risk to theme fidelity and template behavior.

4. **Layout resolution is still a separate problem.**
   - Even with perfect slot naming, the manifest still has to resolve the correct PowerPoint layout by name (`src/pptx_yaml_engine/output/service.py:249-265`, `src/pptx_yaml_engine/utils/pptx.py:25-35`).
   - AI naming solves slot targeting more directly than layout selection.

5. **Ambiguous AI vocabularies can recreate today’s heuristic problem in another form.**
   - Names like `AI_COL1_HEADING` and `AI_COL1_BODY` can work, but only if the translation to semantic slot paths is fixed per semantic layout.
   - If the naming grammar is not one-to-one with `LAYOUT_SPECS`, the mapper will still need interpretation logic.

## Bottom line

The current renderer already has a clean insertion engine, but it is keyed by placeholder `idx`, not by Selection Pane name. The most practical redesign is therefore:

- make `AI_*` placeholder names authoritative at **inspection/mapping/validation** time
- keep `idx` as the **render-time locator**
- keep arbitrary named-shape rendering out of the first implementation

That path gives deterministic “write to the intended slot” behavior without rewriting the output engine around a part of `python-pptx` that the current runtime behavior does not expose reliably.
