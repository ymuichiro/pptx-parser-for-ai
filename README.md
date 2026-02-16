# pptx-parser-for-ai

[![CI](https://github.com/ymuichiro/pptx-parser-for-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/ymuichiro/pptx-parser-for-ai/actions/workflows/ci.yml)
[![Security](https://github.com/ymuichiro/pptx-parser-for-ai/actions/workflows/security.yml/badge.svg)](https://github.com/ymuichiro/pptx-parser-for-ai/actions/workflows/security.yml)
[![Docs](https://github.com/ymuichiro/pptx-parser-for-ai/actions/workflows/pages.yml/badge.svg)](https://github.com/ymuichiro/pptx-parser-for-ai/actions/workflows/pages.yml)

`pptx-parser-for-ai` is a secure, deterministic PowerPoint generator for Node.js and TypeScript.
It transforms a declarative YAML/TypeScript DSL into `.pptx` files, with built-in validation, layouting, and quality checks.

## Why this project

- Deterministic generation for CI/CD and enterprise workflows
- Strict schema validation (fail closed)
- Security-first defaults (remote images disabled by default)
- Reusable themes and template import support (`.pptx` / `.potx`)

## Install

```bash
npm install pptx-parser-for-ai
```

## Quick start

```ts
import { PPTXRenderer } from "pptx-parser-for-ai";

const renderer = new PPTXRenderer({ enableQA: true });
await renderer.generateFromFile("./presentation.yaml", "./output.pptx");
```

## Documentation

- Website: https://ymuichiro.github.io/pptx-parser-for-ai/
- Usage guide: `docs/usage-guide.md`
- API reference: `docs/api-reference.md`
- Examples: `example/README.md`
- Security policy: `SECURITY.md`

## Development

```bash
npm install
npm run quality:check
```

Useful commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:security`
- `npm run build`

## Publishing to npm

```bash
npm run build
npm publish --access public
```

## License

MIT License. See `LICENSE`.
