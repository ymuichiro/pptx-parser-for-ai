---
layout: home
title: pptx-parser-for-ai
---

Generate enterprise-ready PowerPoint files from a declarative YAML/TypeScript DSL.

## Highlights

- Schema-first and fail-closed parsing
- Deterministic rendering for CI/CD
- Built-in QA validation pipeline
- Theme system and template import support (`.pptx/.potx`)
- Security-first defaults

## Get started

```bash
npm install pptx-parser-for-ai
```

```ts
import { PPTXRenderer } from "pptx-parser-for-ai";

const renderer = new PPTXRenderer({ enableQA: true });
await renderer.generateFromFile("./presentation.yaml", "./output.pptx");
```

- [Getting Started](./getting-started)
- [Examples](./examples)
- [API](./api)
- [Security](./security)
