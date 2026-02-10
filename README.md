# pptx-parser-for-ai

YAML/TypeScript DSL から PowerPoint (`.pptx`) を生成するライブラリです。

## 機能
- DSL バリデーションと正規化
- テーマ適用（組み込み + カスタム）
- 自動レイアウト（single/two/three-column, auto）
- 主要コンポーネント描画（text, table, chart, image, diagram 等）
- PowerPoint テンプレート（`.pptx/.potx`）からのテーマ/レイアウト/背景インポート
- インポート済みテンプレート（`template.yaml`）を使った生成
- QA 検証と品質ゲート実行

## ドキュメント
- [Usage Guide](./docs/usage-guide.md)
- [API Reference](./docs/api-reference.md)
- [Documentation Index](./docs/index.md)
- [Example Guide](./example/README.md)
- [Development Guideline](./guid.md)
- [Test Standard](./test.md)
- [Plan](./plan.md)
- [Technical Spec](./tech.md)

## 実行方法

```bash
npm install
npm run quality:check
```

サンプル生成:

```bash
npx tsx example/basic/generate.ts
npx tsx example/network/generate.ts
npx tsx example/template-import/generate-with-template.ts ./templates/company/template.yaml
npm run example:test
```
