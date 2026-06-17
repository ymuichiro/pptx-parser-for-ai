# Selection Pane / AI_* テンプレート可搬性 簡易評価

## 結論

Selection Pane の `AI_*` 名を使うことで、shape の役割判定はかなり確実になっている。ただし現時点で「ルールさえ守れば、どのようなテンプレートでもユーザーが自由にアップロードして使える」とは言えない。

正確には、現在の通常フローはサーバー管理テンプレート前提である。運用者が `.pptx` / `.potx` を `TEMPLATE_DIR` に配置し、起動時に layout name + `AI_*` placeholder 名から strict manifest を生成する。ユーザー持ち込み template を直接受ける `render_presentation_custom` は operator / advanced flow で、既定では無効である。

## 現時点で使えるテンプレート

- サポート対象 semantic layout をすべて持つ。
- PowerPoint slide layout 名が semantic layout 名または許可 alias と一致する。
- 差し込み対象が PowerPoint placeholder である。
- required slot に許可された `AI_*` Selection Pane 名が付いている。
- `AI_*` 名が重複、未知名、typo、non-placeholder ではない。
- icon / table / chart は PICTURE / TABLE / CHART placeholder として作られている。

## 現時点で使えない・使いにくいテンプレート

- PowerPoint の通常 text box / 図形 / 装飾 shape に `AI_*` 名を付けただけのテンプレート。
- 一部 layout だけを持つ企業テンプレート。
- ユーザーが実行時にアップロードして即利用する self-service template。
- 任意画像、企業ロゴ、写真を deck payload から自由に差し込む用途。
- 汎用 layout 名 `Title Slide` / `Title and Content` のまま semantic layout 名を付けていないテンプレート。

## Evidence

- `APP_SPEC.md:41-55`: 通常フローはユーザーアップロードを前提にせず、custom render は高度用途。
- `APP_SPEC.md:117-138`: 通常フローは template directory、`AI_*` mapping、PowerPoint placeholder のみ、任意画像不可を不変条件にしている。
- `src/pptx_yaml_engine/server/config.py:41-49`: operator tools は既定で無効。
- `src/pptx_yaml_engine/server/app.py:169-241`: `render_presentation` は registry の server-managed template を使う。
- `src/pptx_yaml_engine/server/app.py:245-347`: `render_presentation_custom` は operator tools 有効時のみ公開。
- `src/pptx_yaml_engine/mapper/service.py:204-252`: `AI_*` の unknown / duplicate / non-placeholder を検証。
- `src/pptx_yaml_engine/mapper/service.py:255-364`: slot と `AI_*` placeholder の一意性・type 互換性を検証。
- `src/pptx_yaml_engine/mapper/service.py:453-502`:全 semantic layout と required slot が未解決なら manifest finalized 不可。
- `src/pptx_yaml_engine/output/service.py:69-77`: render target は `slide.placeholders[idx]`。
- `src/pptx_yaml_engine/output/service.py:339-456`: icon / table / chart は placeholder insert API 前提。
- `src/pptx_yaml_engine/server/template_registry.py:68-82`: template は `LAYOUT_SPECS` 全体を満たす必要がある。

## Issue 候補

### P0

- End-user template upload / self-service onboarding の product contract を決める。現状は server-managed template 前提なので、ユーザーが任意 template をアップロードして使う本番機能にはなっていない。

### P1

- partial template support を検討する。現状は全 semantic layout 必須で、企業テンプレートの段階導入には重い。
- placeholder-only 制約を補う authoring UX を整備する。通常 shape ではなく PowerPoint placeholder 化する必要があるため、検査レポート、修正ガイド、必要 `AI_*` 一覧が必要。
- `SEMANTIC_DECK_SPEC.md` と実装の layout 数不整合を解消する。ドキュメントは 15 layout、現行 `LAYOUT_SPECS` は 11 layout。

### P2

- template portability checklist と sample authoring package を作る。
- operator/custom flow の安全な利用手順をドキュメント化する。
- default template の日本語・海外向け visual regression を追加する。
