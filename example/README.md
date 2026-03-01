# Example Usage

This directory provides production-style sample decks and scripts.

## Included examples

- `basic`: business review deck with bullets, stat-callout, and table
- `network`: architecture deck with network-diagram and flowchart
- `template-gallery`: premium strategy deck
- `security-brief`: security operations weekly report template
- `product-launch`: launch blueprint with icon-driven GTM narrative
- `template-import`: import a `.pptx/.potx` file as a reusable template package
- `templates/venture-teal/template.yaml`: shared template for common decorations and placeholder bounds

Preset-aware authoring:
- `content.preset` (`overview-2x2` / `compare-3col` / `kpi-with-callout`) と `slot` を使うと、`blank` の絶対座標を減らせます。

## Run all examples

```bash
npm run example:test
```

## Run individual examples

```bash
npx tsx example/basic/generate.ts
npx tsx example/network/generate.ts
npx tsx example/template-gallery/generate.ts
npx tsx example/security-brief/generate.ts
npx tsx example/product-launch/generate.ts
```

## Run template import flow

```bash
npx tsx example/template-import/import.ts ./input/company-template.potx ./templates/company
npx tsx example/template-import/generate-with-template.ts ./templates/company/template.yaml ./output/template-applied.pptx
```
