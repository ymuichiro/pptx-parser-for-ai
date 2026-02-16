# Example Usage

This directory provides production-style sample decks and scripts.

## Included examples

- `basic`: business review deck with bullets, stat-callout, and table
- `network`: architecture deck with network-diagram and flowchart
- `template-gallery`: executive strategy deck with chart, icon-grid, and two-column layout
- `security-brief`: security operations weekly report template
- `product-launch`: product launch narrative and funnel metrics
- `template-import`: import a `.pptx/.potx` file as a reusable template package

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
