# Subworker Visual Audit: Enterprise PPTX Output

Date: 2026-05-24

## Scope

This audit checks whether the current PPTX generation flow can produce a polished, enterprise-usable PowerPoint deck. I did not modify implementation code, templates, or manifest files.

Before reviewing output quality, I read `APP_SPEC.md` and used its current contract as the baseline:

- Normal rendering must use server-managed templates and semantic deck JSON.
- The production mapping contract is PowerPoint layout name plus authoritative `AI_*` Selection Pane placeholder names.
- Legacy geometry, placeholder type, `slot__...`, or naming fallback must not be reintroduced.
- Runtime rendering must insert content into existing template placeholders; it must not draw a new slide UI outside the template.

## Inputs Reviewed

- `examples/enterprise-eval/ai-governance-readiness.yaml`
- `examples/enterprise-eval/ai-governance-readiness.app-rendered.pptx`
- `docs/design-investigations/2026-05-21-visual-evaluation/reference-enterprise-slide.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/ai-governance-readiness.app-rendered.pptx.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/test.pdf`

## Additional Evidence Generated

The existing PowerPoint PDF export was rendered into per-slide PNGs using Swift, PDFKit, and AppKit because Python `fitz` and `Quartz` were unavailable.

Generated files:

- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-01.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-02.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-03.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-04.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-05.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-06.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-07.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-08.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-09.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-10.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pdfkit-pages/page-11.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/contact-sheet.png`

The generated PPTX contains 11 slides with these layouts:

1. `cover_title`
2. `section_divider`
3. `agenda`
4. `comparison_2col`
5. `three_cards_vertical`
6. `chart_basic`
7. `table_basic`
8. `list_basic`
9. `image_caption`
10. `appendix_backup`
11. `closing_end`

## Conclusion

The current app can generate a valid PPTX and the strict `AI_*` placeholder contract appears to route content to the intended slides. However, the current output is **not enterprise-ready** as a production PowerPoint generator.

The blocker is visual quality and text containment, not the Selection Pane mapping model. Several representative content slides have obvious text overlap, oversized typography, clipping, and weak information hierarchy. These issues would be unacceptable in corporate or executive-facing usage.

## Reference Comparison

The reference image, `reference-enterprise-slide.png`, sets a reasonable enterprise quality target:

- Large but controlled title hierarchy.
- Calm white background with restrained top accent.
- Two balanced content panels with enough internal padding.
- Body text sized for reading, not shouting.
- Bullets have clear spacing and consistent alignment.
- Footer and metadata are quiet.
- No text overlap or clipping.

The generated PPTX has some of the same palette direction, mainly navy plus orange accent, but it does not maintain the same layout discipline. It uses much larger inherited PowerPoint placeholder text, causing normal enterprise-length sentences to collide with other content.

## Slide-Level Findings

### Slide 01: `cover_title`

Acceptable but not premium. The cover is clean and readable, with consistent navy/orange branding. The top navy band is heavy and consumes too much vertical space compared with the reference. It is usable internally, but it feels closer to a basic template than a polished enterprise deck.

### Slide 02: `section_divider`

Acceptable. The dark navy section divider is coherent, readable, and visually controlled. It is not the problem area.

### Slide 03: `agenda`

Readable, but the agenda text is oversized and sparse. It lacks the tighter editorial hierarchy expected in a professional deck. Still acceptable for a simple internal slide.

### Slide 04: `comparison_2col`

Not acceptable. This is the clearest failure.

- The left and right descriptions overlap with bullet lists.
- Body text is far too large for the placeholder area.
- The card panels cannot contain ordinary executive-summary sentences.
- The icon placeholders compete with text and do not add useful hierarchy.
- The layout resembles a placeholder stress test rather than a finished corporate slide.

This slide fails the enterprise-readiness bar.

### Slide 05: `three_cards_vertical`

Not acceptable.

- Card body text is oversized and consumes nearly the full card.
- The subtitle collides visually with the top of the cards.
- The icon headers are too tall and visually dominant.
- The cards do not have enough internal breathing room.
- Normal workstream descriptions become difficult to scan.

The underlying three-card concept is good, but the current implementation needs template and text-style work before it can be used in production.

### Slide 06: `chart_basic`

Partially acceptable.

- The chart is readable and not clipped.
- The chart styling is close to default Office output and does not fully match the reference quality target.
- Axis labels and gridlines are heavy relative to the slide.
- Series colors are acceptable but not well integrated with the broader navy/accent system.

This slide is usable but not polished.

### Slide 07: `table_basic`

Partially acceptable, but not production-polished.

- The table content is readable.
- Cell typography is too large, causing rows to feel cramped.
- Table styling is basic Office styling rather than a deliberate enterprise table style.
- Header weight and row spacing need refinement.

This can pass for an internal draft, but not for a production-quality generator.

### Slide 08: `list_basic`

Readable but visually weak.

- Bullets are far too large for a business slide.
- The slide wastes vertical space and lacks secondary hierarchy.
- Long bullet lines wrap into large blocks that are difficult to scan.

No clipping was observed here, but the typography is not enterprise-calibrated.

### Slide 09: `image_caption`

Partially acceptable.

- The layout is readable.
- The icon is very large and black, making it visually heavier than the surrounding message.
- The generated icon does not feel like a polished enterprise illustration or diagram.

This slide should be improved with theme-aware icon color, sizing, and optional background treatment.

### Slide 10: `appendix_backup`

Not acceptable.

- The left-side item list overflows below the slide boundary.
- Text scale is too large across body, references, and items.
- The right-side references occupy excessive vertical space.
- The slide cannot handle a normal appendix checklist without clipping.

This is a production blocker.

### Slide 11: `closing_end`

Acceptable. The closing slide is coherent and readable. Like the cover, it is usable but visually heavy because of large navy bands.

## Evaluation By Quality Criterion

| Criterion | Assessment |
| --- | --- |
| Whitespace | Inconsistent. Cover and divider have abundant whitespace, while content slides collide or overflow. |
| Information hierarchy | Weak on body slides. Titles, subtitles, descriptions, bullets, icons, and tables are not proportioned consistently. |
| Text volume handling | Failing. Normal enterprise-length content overlaps or clips on `comparison_2col`, `three_cards_vertical`, and `appendix_backup`. |
| Color | Directionally corporate, but heavy navy blocks and default chart/table colors reduce polish. |
| Alignment | Base grid is present, but content collisions break perceived alignment. |
| Readability | High contrast, but oversized text makes several slides harder to scan and causes clipping. |
| Template consistency | Cover/divider/closing are coherent; body slide typography and component styling are inconsistent. |

## Likely Root Causes

### 1. Renderer inserts text but does not control fitting

Relevant file:

- `src/pptx_yaml_engine/output/service.py`

Observed functions:

- `_write_text`
- `_write_list`
- `_write_table`
- `_write_chart`
- `_write_icon`

The renderer clears and writes placeholder text, but it does not set text frame behavior such as:

- word wrapping policy
- margins
- automatic text fitting
- slot-specific maximum font size
- fallback behavior when content cannot fit

It therefore relies heavily on the inherited placeholder styles in the PowerPoint template. In the current default template, those inherited styles are too large for several semantic slots.

### 2. Default template generator does not style every bindable body placeholder

Relevant file:

- `scripts/make_default_template.py`

The script defines an enterprise palette and custom geometry, but the typography contract is incomplete. Some placeholders receive explicit `_set_ph_lst_style(...)`, but several high-risk content placeholders appear to inherit the source PowerPoint layout's large default text style:

- `comparison_2col` descriptions and bullet placeholders
- `three_cards_vertical` card descriptions
- `appendix_backup` body, references, and item placeholders
- `list_basic` main list
- table cell text after insertion

This explains why ordinary sentences render at presentation-title scale.

### 3. Text overflow is not treated as a validation failure

Relevant files:

- `src/pptx_yaml_engine/output/validation.py`
- `src/pptx_yaml_engine/layouts.py`
- `SEMANTIC_DECK_SPEC.md`

The deck is schema-valid, but the resulting slides are visually invalid. For production use, the app should not silently emit PPTX files with overlapped or clipped text. Either the renderer must reliably fit text within the existing placeholders, or validation must reject content that exceeds each layout's declared capacity.

### 4. Tables, charts, and icons are too close to default Office styling

Relevant files:

- `src/pptx_yaml_engine/output/service.py`
- `src/pptx_yaml_engine/icons/registry.py`
- `scripts/make_default_template.py`

Charts and tables are readable but not refined. Icons render correctly enough to be recognizable, but their default scale/color is visually heavy. For enterprise output, chart/table/icon rendering should be theme-aware and consistent with the template palette.

## Recommended Improvement Plan

### Priority 1: Make text containment a production invariant

The app should never produce a slide with obvious overlap or clipping under normal deck content.

Recommended work:

- In `src/pptx_yaml_engine/output/service.py`, set text frame wrapping and margins consistently when writing text/list slots.
- Add slot-aware font policies or use PowerPoint text fitting for body/list slots while respecting the existing template placeholder.
- Add overflow detection or validation for known bounded structures, such as maximum list item count, maximum card description length, maximum appendix item count, and maximum table row/column count.
- If content cannot fit reliably, return a structured validation error instead of creating a visually broken PPTX.

This stays compatible with `APP_SPEC.md` because it still inserts into existing placeholders and does not reintroduce heuristic mapping.

### Priority 2: Rework default template typography in `scripts/make_default_template.py`

The default template should be regenerated after applying explicit typography to every bindable placeholder.

Recommended changes:

- Define typography tokens in the template generator, for example title, subtitle, body, small body, card title, card body, table body, caption.
- Apply `_set_ph_lst_style(...)` to all text/object placeholders, not only titles and subtitles.
- Reduce title/body scale across content slides.
- Give comparison descriptions and bullet blocks separate vertical zones that cannot collide.
- Reduce three-card header height and icon size; increase body padding.
- Increase appendix item area or reduce appendix body/reference font sizes.
- Regenerate `templates/default.pptx` and `templates/default.manifest.json` from the generator.

### Priority 3: Theme table, chart, and icon output

Recommended work:

- In `_write_table`, apply header fill, body font size, row height, and subdued borders after `insert_table`.
- In `_write_chart`, apply template-aware series colors, lighter gridlines, and smaller axis fonts.
- In `_write_icon`, default unspecified icon color to the enterprise navy or a template-defined color, and reduce default icon prominence in the default template's picture placeholders.

### Priority 4: Add a visual regression gate

Recommended work:

- Keep this enterprise eval deck as a production visual fixture.
- Add a reproducible preview generation path for macOS local review using PowerPoint PDF export plus Swift PDFKit rendering, or provide a documented equivalent.
- Store or generate a contact sheet for review before release.
- Add automated assertions for obvious failures where possible, such as slide count, placeholder content presence, and approximate content length limits.

## Production Readiness Decision

Current decision: **Not production-ready for enterprise/corporate PowerPoint generation.**

The strict `AI_*` Selection Pane architecture is the correct direction and should remain the foundation. The current blocker is the quality layer: template typography, text fitting, overflow validation, and theme-aware component rendering.

Once the default template and text containment behavior are corrected, the same strict mapping architecture can support production-grade output. The current generated deck should be treated as functional evidence for the pipeline, not as release-quality visual output.
