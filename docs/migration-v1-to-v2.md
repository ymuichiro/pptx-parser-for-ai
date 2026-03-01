# Migration Guide: v1 -> v2

## Overview

`v2.0.0` introduces a breaking schema update for both DSL and themes.

## Required updates

1. Change DSL version:

```yaml
version: "2.0"
```

2. Change theme version:

```yaml
version: "2.0"
```

3. Add required semantic color tokens in `theme.colors`:

- `primary`
- `secondary`
- `accent`
- `text-dark`
- `text-light`
- `muted-text`
- `background-light`
- `background-dark`
- `neutral-border`
- `surface`
- `surface-muted`
- `surface-strong`
- `success`
- `warning`
- `error`

4. Add `theme.components` blocks for:

- `text`
- `list`
- `table`
- `chart`
- `image`
- `statCallout`
- `iconGrid`
- `flowchart`
- `network`
- `twoColumn`
- `preset`

## DSL field migration

| v1 | v2 |
| --- | --- |
| `version: "1.0"` | `version: "2.0"` |
| (none) | `styleRef?: string` on all content elements |
| `image` (basic) | `image.frame?: { borderColor, borderWidth, shadow }` |
| `image` (basic caption) | `image.captionStyleRef?: string` |
| `custom-shape` (basic) | `custom-shape.rectRadius?: number` (`rounded-rectangle` 用) |

## Theme field migration

| v1 | v2 |
| --- | --- |
| `version: "1.0"` | `version: "2.0"` |
| `colors` (minimal) | `colors` with required semantic tokens |
| `defaults` only | `defaults` + `components` named styles |
| optional effects (unused) | `effects` are consumed by renderers |
| (none) | `defaults.contentSlide.titleFrame/bodyFrame` |
| (none) | `chromeDefaults` (`header/footer` の既定) |
| `preset` style (shape/fill/border) | `preset` style + `rectRadius` |

## Behavior changes

- `styleRef` is resolved by component type via theme named styles.
- Presets apply visual slot surfaces and slot style refs.
- Content slide title/body frame are controlled by `theme.defaults.contentSlide.*Frame`.
- Chrome resolution is deterministic: `DSL` > `template` > `theme.chromeDefaults`.
- QA now validates visual quality (`LOW_CONTRAST_TEXT`, `MISSING_THEME_TOKEN`, `STYLE_REF_NOT_FOUND`, `PRESET_SLOT_STYLE_MISMATCH`).

## Validation checklist

Run:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run example:test
npm run build
```
