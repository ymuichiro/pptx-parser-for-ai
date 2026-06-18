# Subworker render previews

## Status

- Complete: PowerPoint PDF exports were rendered to per-slide PNG previews for visual review.

## Commands

```sh
swift docs/design-investigations/2026-05-21-visual-evaluation/render_pdf_pages.swift docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/test.pdf docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pages 2
swift docs/design-investigations/2026-05-21-visual-evaluation/render_pdf_pages.swift docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/final.pdf docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/final-pages 2
```

## Generated files

- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/contact-sheet.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/final-contact-sheet.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/pages/slide-01.png` through `slide-11.png`
- `docs/design-investigations/2026-05-21-visual-evaluation/pptx-export/final-pages/slide-01.png` through `slide-11.png`
