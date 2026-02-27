# Template Design Spec (Venture Teal)

## Objective

Define a reusable slide template that keeps visual quality stable without requiring complex YAML.

## Scope

- Use template-driven common decorations instead of absolute positioning in deck YAML.
- Keep content YAML shallow and predictable.
- Ensure margin, readability, and visual consistency in generated PPTX.

## YAML Rules

- Prefer `content` slides with `layout: auto` or `layout: two-column`.
- Avoid `blank` slides except for special cases.
- Do not nest `two-column` inside `two-column`.
- Keep 3-5 primary content elements per slide.
- Use theme tokens for colors and fonts whenever possible.

## Template Responsibilities

The template package defines:

- header divider line (header と本文の分離)
- soft corner circles as background motifs
- title placeholder bounds
- body placeholder bounds
- footer chrome (`leftText` + slide number)
- adaptive footer placement (top on light slides, bottom on dark slides)

These are applied uniformly through `templatePackagePath`, so each slide inherits the same frame.

## DSL Chrome (Templateなしの場合)

`templatePackagePath` を使わない場合でも、DSLの `chrome` で以下を指定可能:

- `chrome.header.divider`: header と main content を分ける線
- `chrome.footer`: ページ番号と左側テキスト
- `metadata.company` / `metadata.copyright` / `metadata.footerText`
  をフッター文言に差し替え可能

## Recommended Layout: 4-Point Spotlight

4つの重要観点を短く強調する用途では、以下の構成を推奨:

- 上段: section label + main title
- 中央: 2x2カード（各カードは `label + icon + value`）
- 下段: 1行の強調メッセージバー

実装例:
- `example/template-gallery/presentation.yaml` の最終スライド

## Placeholder Contract

- `title` placeholder: one-line slide heading area
- `body` placeholder: primary content canvas

All slide content must fit inside these placeholders via auto layout. No per-slide coordinate tuning is expected.

## Tradeoffs

- Exact original PPT decoration parity is not required.
- Deterministic, low-maintenance generation is prioritized over pixel-perfect replication.
