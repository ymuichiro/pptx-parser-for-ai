# Repository Guidelines

## Project Structure & Module Organization
- `src/`: core TypeScript library modules (`parser/`, `layout/`, `renderers/`, `theme/`, `qa/`, `template-importer/`, `presets/`).
- `tests/`: automated tests by scope (`unit/`, `integration/`, `security/`, `performance/`, `fuzz/`) plus shared fixtures in `tests/fixtures/`.
- `example/`: runnable sample generators and YAML decks used for usage validation.
- `themes/`: built-in YAML themes distributed with the package.
- `docs/`: usage, API, migration, and release documentation.
- `dist/`: generated build output. Treat as build artifact, not source.

## Build, Test, and Development Commands
- `npm install`: install dependencies (Node.js `>=20`).
- `npm run build`: clean and compile TypeScript into `dist/`.
- `npm run lint`: run ESLint across `src/`, `tests/`, and `example/`.
- `npm run typecheck`: strict TypeScript checks with no emit.
- `npm run test`: run unit, integration, security, and example tests.
- `npm run test:coverage`: run tests with coverage thresholds.
- `npm run quality:check`: full local gate before PR/publish.

## Coding Style & Naming Conventions
- Language: strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled).
- Formatting: 2-space indentation, semicolons, double quotes.
- Imports: prefer `import type` where applicable (`@typescript-eslint/consistent-type-imports`).
- Safety: avoid `any`; `@typescript-eslint/no-explicit-any` and `no-floating-promises` are enforced.
- Naming: keep modules and tests descriptive (example: `src/template-importer/types.ts`, `tests/unit/parser.spec.ts`).

## Testing Guidelines
- Framework: Vitest (`tests/**/*.spec.ts`, Node environment).
- Coverage minimums: lines/statements `85%`, branches/functions `80%`.
- Place tests near the right scope folder (`tests/unit`, `tests/integration`, etc.).
- Add or update fixtures under `tests/fixtures/` when behavior depends on DSL/YAML/XML inputs.

## Visual QA Workflow (Mandatory)
- Scope: any task that generates or modifies visual output (`.pptx`, preview `.png`, chart/layout/theme/preset/template changes).
- Always generate the latest output first, then open and inspect the produced image(s) yourself before reporting completion.
- If any issue is found (layout break, clipping, double borders, inconsistent radius, stray lines, low contrast, style drift), do not report completion.
- Instead, autonomously diagnose and implement fixes, regenerate output, and re-check the updated image(s).
- Repeat the fix -> regenerate -> visual re-check loop until no obvious visual defects remain.
- After visual pass is clean, run relevant quality gates (`lint`, `typecheck`, related unit/integration/example tests).
- Only after both visual self-review and quality checks pass, provide the completion report and attach the final preview image/path.
- Never present a preview as "done" if known visual issues are still present.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history (`fix(footer): ...`, `docs(example): ...`, `feat!: ...`).
- Keep commits focused and reviewable; avoid mixing unrelated refactors.
- PRs should include: clear scope, linked issue (if any), and test evidence (commands run).
- For breaking/API-facing changes, update `docs/api-reference.md` and `CHANGELOG.md`.

## Security & Configuration Tips
- Prefer default secure behavior: remote images are disabled unless explicitly enabled.
- Run `npm run security:all` for security-sensitive changes.
- Do not commit secrets or private assets in `example/`, `themes/`, or fixtures.
