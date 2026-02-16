# AGENTS.md - Coding Agent Guidelines

This document provides essential information for AI coding agents working on the pptx-parser-for-ai codebase.

## Project Overview

A TypeScript library that generates PowerPoint (`.pptx`) files from YAML/TypeScript DSL. Core responsibilities: DSL parsing, validation, normalization, theme application, auto-layout, and rendering via pptxgenjs.

## Build/Lint/Test Commands

```bash
# Build
npm run build                  # Clean build to dist/

# Lint
npm run lint                   # ESLint on src/, tests/, example/

# Type Check
npm run typecheck              # TypeScript --noEmit

# Run All Tests
npm run test                   # All test suites + example tests

# Run Specific Test Suites
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:security          # Security tests + npm audit
npm run test:coverage          # Tests with coverage

# Run Single Test File
npx vitest run tests/unit/parser.spec.ts
npx vitest run tests/unit/parser.spec.ts --reporter=verbose

# Run Specific Test by Pattern
npx vitest run -t "parses a valid DSL"

# Full Quality Check (run before PR)
npm run quality:check
```

## TypeScript Configuration

- Target: ES2022, Module: CommonJS
- Strict mode enabled with: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`
- Node.js >= 20.0.0 required
- Use `type` imports for types: `import type { Foo } from "./types"`

## Code Style Guidelines

### Imports

```typescript
// Node.js built-ins first (with node: prefix)
import * as fs from "node:fs/promises";
import * as path from "node:path";

// External packages
import * as yaml from "js-yaml";
import PptxGenJS from "pptxgenjs";

// Internal modules (relative)
import { DEFAULT_THEME_NAME } from "./constants";
import { ParseError, ValidationError } from "./errors";
import type { PresentationDSL } from "../types";
```

### Type Annotations

- All public API parameters and return types must be explicitly typed
- Use `type` imports for type-only imports (required by ESLint)
- Use union types for discriminants: `type Slide = TitleSlide | ContentSlide | SectionSlide`
- Use `readonly` for immutable arrays/objects where appropriate

### Naming Conventions

- **Classes**: PascalCase (`DSLParser`, `ThemeManager`, `PPTXRenderer`)
- **Interfaces/Types**: PascalCase (`PresentationDSL`, `Slide`, `ContentElement`)
- **Functions/Methods**: camelCase (`parseFile`, `resolveThemeColor`)
- **Constants**: UPPER_SNAKE_CASE for globals, camelCase for locals
- **Files**: kebab-case (`slide-renderer.ts`, `base-renderer.ts`)
- **Test files**: `*.spec.ts` (e.g., `parser.spec.ts`)

### Error Handling

Use typed errors from `src/errors.ts`. Never throw generic `Error`:

```typescript
// Correct
throw new ValidationError(["Invalid field: x"]);
throw new ParseError("Failed to parse YAML", cause);
throw new IOError("Failed to read file", cause);
throw new ThemeError("Theme not found");

// Error types available:
// - ParseError, ValidationError, ThemeError
// - LayoutError, RenderError, IOError, QAError, TemplateImportError
```

- Always preserve cause chain: `new ParseError(message, originalError)`
- Never catch and swallow errors silently
- Use `try/catch` with proper error transformation

### Control Flow

- Use `switch` with `never` exhaustiveness check for union types:

```typescript
type SlideType = "title" | "content" | "section";
switch (slide.type) {
  case "title": // ...
  case "content": // ...
  case "section": // ...
  default: {
    const _exhaustive: never = slide;
    throw new Error(`Unknown slide type: ${_exhaustive}`);
  }
}
```

### Null/Undefined Handling

- Use `??` for default values (not `||`)
- Use optional chaining: `obj?.property`
- Check for `undefined` explicitly with `!== undefined` or `?:`
- Array access requires handling: `arr[0]` returns `T | undefined`

### Comments

- Comments are in English or Japanese
- Avoid inline comments explaining "what" - focus on "why"
- No TODO comments without explicit approval

## Security Guidelines

- **Path validation**: Always use `path.resolve()` and verify paths stay within allowed directories
- **YAML parsing**: Use `yaml.JSON_SCHEMA` to prevent code execution
- **Remote URLs**: Disabled by default; opt-in with explicit validation
- **Input limits**: Strings max 10,000 chars, arrays max 10,000 elements, nesting depth max 20
- **File writes**: Use atomic write (write to temp, then rename)

## Testing Standards

### Test Structure

```typescript
import { describe, expect, it } from "vitest";
import { DSLParser } from "../../src/parser";
import type { PresentationDSL } from "../../src/types";

const fixture = (relativePath: string) => 
  path.resolve(process.cwd(), "tests", "fixtures", relativePath);

describe("ModuleName", () => {
  it("does something correctly", async () => {
    // Arrange
    const parser = new DSLParser();
    
    // Act
    const result = parser.parse(content);
    
    // Assert
    expect(result.metadata.title).toBe("Expected");
  });
});
```

### Test Categories

- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - End-to-end DSL to PPTX generation
- `tests/security/` - Path traversal, malformed input, SSRF
- `tests/performance/` - Benchmarks and regression detection
- `tests/fuzz/` - Random input testing
- `tests/fixtures/` - Test DSL files (`valid/`, `invalid/`, `security/`)

### Coverage Requirements

- Overall: 85% statements, 80% branches
- Critical paths (parser, layout, renderers): 90% statements, 85% branches

## Module Structure

```
src/
├── index.ts           # Public API exports
├── constants.ts       # Global constants
├── errors.ts          # Typed error classes
├── types/             # Type definitions (dsl.ts, theme.ts, layout.ts, qa.ts)
├── parser/            # DSL parsing, validation, normalization
├── theme/             # Theme loading and management
├── layout/            # Layout engine and algorithms
├── renderers/         # Slide rendering (base + components)
├── qa/                # Quality assurance (validation + auto-fix)
├── template-importer/ # Template package handling
└── utils/             # Shared utilities (color, geometry, paths)
```

## Determinism

This library must produce identical output for identical input:

- No Date.now() or Math.random() in core logic
- No environment-dependent values in output
- Tests verify output consistency

## Dependencies

Current stack (do not add alternatives without justification):

- `pptxgenjs` - PPTX generation
- `js-yaml` - YAML parsing (with JSON_SCHEMA for safety)
- `zod` - Schema validation
- `fast-xml-parser` - XML handling
- `jszip` - ZIP operations

Dev dependencies: `vitest`, `typescript`, `eslint`, `tsx`

## Key Principles

1. **Secure by Default**: Dangerous features require explicit opt-in
2. **Fail Closed**: Invalid input throws typed errors, never silently passes
3. **Deterministic**: Same input + version = same output
4. **Small Surface**: Minimal public API, internal pure functions preferred
5. **No I/O in Core Logic**: I/O only at boundaries (file read/write, theme load)
