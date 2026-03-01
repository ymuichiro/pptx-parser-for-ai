# Template Design Spec

## Objective

再利用可能なスライド設計ルールを明確化し、利用者が「推奨運用」と「例外運用」を判断できる状態を作る。

## Rule Levels

### Must (壊れる/バリデーション必須)

- DSL はスキーマ検証に合格すること。
- `content.preset` を使う場合は定義済み preset ID を使うこと。
- `content.preset` を使う場合、`slot` は preset で定義された名前のみ使うこと。
- `slot` の要素タイプ制約（許容 type）を満たすこと。
- 画像パスは安全なローカルパスまたは data URL を使うこと（既定では remote URL 不可）。

### Should (壊れないが推奨)

- 定型業務スライドは `content + preset` を優先し、`blank` を常用しない。
- `preset` を使わない場合は `layout: auto/two-column` を優先する。
- 1スライドの主要要素は 3-5 個に収める。
- 色・フォントはテーマトークンを優先し、ハードコードを減らす。
- `blank` 利用時は decorative 要素（背景 shape）と情報要素を分離する。

### May (例外許容)

- `blank` を使った絶対座標レイアウト（アートボード/特殊図版）。
- `content` で `bounds` を使った要素単位の微調整。
- preset の `default` slot に複数要素を積む運用（縦スタック）。

## Layout/Preset Selection

| ユースケース | 推奨 |
| --- | --- |
| 定型の KPI/比較/サマリ | `content.preset` |
| 混在要素の一般スライド | `content.layout: auto` |
| テキスト左・図右が明確 | `content.layout: two-column` |
| 例外的な自由配置・ポスター型 | `blank`（制約付き） |

## Preset Catalog (MVP)

- `overview-2x2`: 4カード構成の概観スライド。
- `compare-3col`: 3カラム比較 + 下段サマリ。
- `kpi-with-callout`: KPI領域 + 右側コールアウト。

`preset` 指定時は `layout` より `preset` を優先する。

## Blank Slide Constraints

- `custom-shape` は既定で decorative 扱い（QA overlap 判定から除外）。
- 情報要素同士の過度な重なりは QA 警告対象。
- 要素はスライド境界内に収める。

## Template Responsibilities

テンプレートパッケージは以下を提供する:

- `title/body` placeholder
- background color/image/objects
- optional footer chrome

`preset/layout` で解決した要素 bounds は、template の body placeholder に再マップされる。

## PR Review Checklist

- Must/Should/May のいずれに該当する変更かを説明したか。
- 新規 preset/slot 追加時に validator と docs を同時更新したか。
- `blank` 運用の例外理由（なぜ preset/layout で足りないか）を明記したか。
- `npm run quality:check` を通過したか。
