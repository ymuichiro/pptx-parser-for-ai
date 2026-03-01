# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- GitHub Pages documentation site
- OSS release docs (`CONTRIBUTING`, `SECURITY`, `LICENSE`)
- Expanded example templates and generation scripts
- CI, CodeQL, Dependabot, and npm audit workflows

## [2.0.0] - 2026-03-01

### Breaking

- DSL version is now fixed to `2.0`; `version: "1.0"` is rejected.
- Theme schema is now fixed to `version: "2.0"` with required semantic color tokens and `components` style definitions.
- Renderers now resolve visual rules from `theme.components` and no longer rely on MVP-level hardcoded presets.

### Added

- New `styleRef` support for all content elements.
- New image styling fields: `frame` and `captionStyleRef`.
- Preset v2 visual layer: slot surfaces, slot style references, and title underline support.
- QA codes: `LOW_CONTRAST_TEXT`, `MISSING_THEME_TOKEN`, `STYLE_REF_NOT_FOUND`, `PRESET_SLOT_STYLE_MISMATCH`.
- `StyleResolver` layer to centralize color/style token resolution.

### Changed

- Built-in themes upgraded to v2 semantic tokens/components.
- Examples/fixtures/docs migrated to DSL `2.0`.
