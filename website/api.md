---
layout: page
title: API
permalink: /api/
---

## Main exports

- `PPTXRenderer`
- `TemplateImporter`
- `parseImportedTemplatePackage`
- `ValidationError`, `ParseError`, `ThemeError`, `LayoutError`, `RenderError`, `IOError`

## `PPTXRenderer`

```ts
new PPTXRenderer(options?: RendererOptions)
```

Important options:

- `enableQA?: boolean`
- `qaConfig?: { autoFix?: boolean; maxIterations?: number }`
- `allowRemoteImages?: boolean`
- `themeDir?: string`
- `templatePackagePath?: string`

Methods:

- `generateFromFile(dslPath, outputPath)`
- `generate(dsl, outputPath)`

For full type details, see `docs/api-reference.md`.
