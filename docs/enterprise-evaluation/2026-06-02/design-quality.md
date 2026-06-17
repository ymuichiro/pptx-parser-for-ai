# デザイン品質・本番適用性評価

Date: 2026-06-02

## 結論

現行アプリケーションは、`AI_*` Selection Pane 名を使って PowerPoint placeholder に確実に差し込む方式としては実用水準にある。`default.pptx` も枠線なしカード、正円アイコン領域、白地/黒系の premium monochrome tone が実装されており、社内資料や提案下書きには十分使える。

ただし、エンタープライズ本番サービスとして「海外向け・日本人向けの整った PowerPoint を default だけで安定生成できる」と言い切るには未達。主な不足は、日本語フォント/長文収まりの保証、visual regression、artifact のユーザー所有権チェック、仕様ドキュメントと実装 layout 数の不一致。

## 確認した根拠

- `APP_SPEC.md` は template-driven MCP server、`AI_*` strict mapping、legacy fallback 不使用を定義している。
- `scripts/make_default_template.py` は default template の palette、card、watermark、icon badge、layout geometry を生成している。
- `src/pptx_yaml_engine/output/service.py` は slot 別 font size、word wrap、table/chart/icon 挿入を実装している。
- `templates/default.manifest.json` と実 template は整合しており、静的検査で `manifest_valid=True`、枠線破綻なし、正円 icon/badge 破綻なし。
- focused check は通過: `uv run ruff check`, `uv run mypy src`, `uv run pytest tests/integration/test_default_template_asset.py tests/unit/test_template_registry.py tests/unit/test_server.py`。

## 評価

持ち込み template は、全 semantic layout と正しい `AI_*` placeholder を持つ場合に成立する。任意 template をユーザーが upload して即時利用する通常 UI/flow は現仕様では未実装。

default design は方向性として良いが、日本語資料では `Aptos` 固定が弱く、CJK font と長文 stress test が必要。表・グラフ・カードも構造的には描画できるが、PowerPoint export 画像での継続的な visual regression がないため、品質保証としては不足。

artifact download は UUID token + TTL の一時 URL で、推測困難性はある。ただし認証済み user/tenant との所有権検証はなく、「発行ユーザーのみアクセス」は満たしていない。

## Issue 候補

### P0

- なし。現時点で default render や strict `AI_*` mapping を直ちに壊す blocker は確認していない。

### P1

- `SEMANTIC_DECK_SPEC.md` / tool docstring / `LAYOUT_SPECS` / default manifest の layout 数を一致させる。
- 日本語向け font policy、長文 title/card/list/table の capacity validation、PowerPoint export visual regression を追加する。
- artifact download を user/tenant 所有権チェックまたは署名付き token で保護する。
- default template の海外向け/日本語向けサンプル deck を用意し、画像比較で text clipping、watermark overlap、icon distortion、border regression を検出する。

### P2

- `scripts/make_default_template.py` を design tokens、decorations、layout builders に分割する。
- `src/pptx_yaml_engine/output/service.py` の text/table/chart/icon style policy を module 分割する。
- template authoring docs に layout 別 `AI_*` name 一覧、Selection Pane 操作手順、推奨 placeholder type、容量目安を追加する。
- ユーザー upload template を product feature にするかを仕様化し、提供する場合は validation/preview/isolation を設計する。
