---
layout: page
title: Examples
permalink: /examples/
---

The repository contains practical templates and scripts under `example/`.

## Run all examples

```bash
npm run example:test
```

## Generate specific examples

```bash
npx tsx example/basic/generate.ts
npx tsx example/network/generate.ts
npx tsx example/template-gallery/generate.ts
npx tsx example/security-brief/generate.ts
npx tsx example/product-launch/generate.ts
```

## Template import flow

```bash
npx tsx example/template-import/import.ts ./input/company-template.potx ./templates/company
npx tsx example/template-import/generate-with-template.ts ./templates/company/template.yaml ./output/template-applied.pptx
```
