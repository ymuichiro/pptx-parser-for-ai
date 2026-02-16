# Functional Requirements

本ドキュメントは、現行実装（`src/**`）と既存テスト（`tests/**`）を基準にした機能要件一覧です。  
各要件の達成基準は、E2E/統合/単体テストでそのまま検証できる粒度で記述しています。

| 要件番号 | 要件名 | 達成基準 |
| --- | --- | --- |
| FR-001 | YAML DSL ファイルからの生成 | `PPTXRenderer.generateFromFile(dslPath, outputPath)` 実行時、妥当な DSL ファイルを入力すると `success=true` を返し、`outputPath` に 0 バイトより大きい `.pptx` が生成されること。 |
| FR-002 | DSL オブジェクトからの生成 | `PPTXRenderer.generate(dsl, outputPath)` 実行時、妥当な DSL オブジェクトを入力すると `success=true` を返し、`metadata.slideCount` が入力スライド数と一致すること。 |
| FR-003 | DSL スキーマ厳格検証 | DSL は strict schema で検証され、未知フィールド・型不正・必須項目不足を含む入力は検証エラーとして失敗すること。 |
| FR-004 | DSL 意味整合性検証 | `table` 列数不整合、`chart` ラベル数と系列値数の不整合、`network-diagram` ノード参照不整合、`flowchart` ステップ参照不整合を検知して失敗すること。 |
| FR-005 | DSL 構造上限の強制 | 文字列長（10,000 超）、配列長（10,000 超）、ネスト深度（20 超）の入力を検知し、検証エラーとして失敗すること。 |
| FR-006 | DSL 画像入力の安全制約 | 画像 `source` はデフォルトでリモート URL を拒否し、`allowRemoteImages=true` 設定時のみ許可すること。ローカルパスの `..` を含むパストラバーサルは常に拒否すること。 |
| FR-007 | DSL 正規化 | 正規化処理で、未指定の既定値（例: content slide の `layout=auto`、text の `style=body`/`align=left`、title/blank 背景既定値、two-column `ratio=1:1` など）が補完されること。 |
| FR-008 | テーマ解決（組み込み/カスタム） | テーマ名指定で `themes/*.yaml` の組み込みテーマを読み込めること。テーマファイルパス指定時は YAML を読み込み、テーマスキーマを満たす場合のみ利用できること。 |
| FR-009 | テーマ読み込みのパス制約 | テーマファイルは allowlist されたルート配下のみ読み込み可能であり、ルート外参照・パストラバーサルは拒否されること。 |
| FR-010 | レイアウト計算 | レイアウト種別 `auto/single-column/two-column/three-column` をサポートし、`auto` は要素構成に応じて適切なレイアウトを選択すること。未対応レイアウト指定は失敗すること。 |
| FR-011 | レイアウト境界保証 | レイアウト計算で得られる全要素領域がスライド境界内に収まること。 |
| FR-012 | スライド種別描画 | `title` / `content` / `section` / `blank` の各スライドが描画できること。 |
| FR-013 | コンテンツ要素描画 | `text`、`bullet-list`、`numbered-list`、`stat-callout`、`image`、`table`、`chart`、`network-diagram`、`flowchart`、`icon-grid`、`two-column` を描画できること。`blank` では `custom-shape` を描画できること。 |
| FR-014 | 描画時画像ソースの安全制約 | 画像描画時にリモート URL を拒否し、`..` を含むローカルパスを拒否すること。`data:image/*` および安全なローカルパスは描画できること。 |
| FR-015 | テンプレートインポート | `TemplateImporter.importFromFile(.pptx/.potx, outputDir)` 実行時、`template.yaml` / `manifest.json` / `assets/*` を出力し、テーマ・プレースホルダ・背景情報を含むテンプレートパッケージを返すこと。 |
| FR-016 | テンプレートインポートの Fail Closed | title/body プレースホルダ条件（title 1件、body 1件）を満たすレイアウトが見つからない場合、インポートは失敗すること。 |
| FR-017 | インポート済みテンプレートパッケージ検証 | `parseImportedTemplatePackage` は strict schema 検証を行い、`assets/` 配下の相対パスのみ許可し、絶対パス・`..` を含むパスを拒否すること。 |
| FR-018 | テンプレート適用生成 | `templatePackage` または `templatePackagePath` 指定時、テーマ（palette/fonts/slideSize）をマージし、content slide の title/body プレースホルダと背景（色/画像/装飾オブジェクト）を生成結果に反映すること。 |
| FR-019 | QA 検証と結果返却 | `enableQA=true` の場合、出力ファイル存在/サイズとレイアウト境界の検証を実行し、`GenerationResult.qaResult` に結果を返すこと。 |
| FR-020 | QA 自動修正リトライ | `qaConfig.autoFix=true` かつ問題検知時、`qaConfig.maxIterations` の範囲で再生成をリトライすること。 |
| FR-021 | 出力のアトミック書き込み | 生成ファイルは一時ファイルへ書き出し後にリネームで確定すること。書き込み失敗時は一時ファイルを削除し、IO エラーとして失敗すること。 |

