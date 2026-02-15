# API Reference

## Export

```ts
import {
  PPTXRenderer,
  TemplateImporter,
  parseImportedTemplatePackage,
  type RendererOptions,
  type TemplateImportOptions,
  type ImportedTemplatePackage,
  type GenerationResult,
  type PresentationDSL,
  type ThemeDefinition,
  ValidationError,
  ParseError,
  ThemeError,
  LayoutError,
  RenderError,
  IOError
} from "pptx-parser-for-ai";
```

## Class: `PPTXRenderer`

### `new PPTXRenderer(options?: RendererOptions)`

`RendererOptions`
- `enableQA?: boolean`
- `qaConfig?: { autoFix?: boolean; maxIterations?: number }`
- `allowRemoteImages?: boolean`
- `themeDir?: string`
- `templatePackage?: ImportedTemplatePackage`
- `templatePackagePath?: string` (`template.yaml` のパス)
- `templateAssetBaseDir?: string` (`templatePackage` オブジェクト利用時の `assets/` 基準ディレクトリ)

### `generateFromFile(dslPath: string, outputPath: string): Promise<GenerationResult>`
- YAML DSL ファイルを読み込み、`.pptx` を生成

### `generate(dsl: PresentationDSL, outputPath: string): Promise<GenerationResult>`
- DSL オブジェクトから `.pptx` を生成
- `templatePackage` / `templatePackagePath` を設定した場合、以下を反映:
  - palette/fonts/slideSize をテーマへマージ
  - content slide の title/body placeholder を配置に反映
  - 背景色/背景画像/装飾オブジェクトを反映

## Class: `TemplateImporter`

### `new TemplateImporter(options?: TemplateImportOptions)`

`TemplateImportOptions`
- `templateId?: string`

### `importFromFile(templatePath: string, outputDir: string): Promise<ImportedTemplatePackage>`
- `.pptx` / `.potx` からテンプレート情報を抽出
- `outputDir` に `template.yaml`, `manifest.json`, `assets/` を出力

`ImportedTemplatePackage` 主な構造
- `template`: id, source（file, sha256, importedAt）
- `theme`: palette, fonts, slideSize
- `layout`: kind (`title-body`), placeholders (title/body)
- `background`: color/image/objects
- `manifest`: warnings/unsupported

### `parseImportedTemplatePackage(input: unknown): ImportedTemplatePackage`
- `template.yaml` を厳格検証（Fail Closed）
- `assets/` 参照は相対パスのみ許可（絶対パス・`..` を拒否）

## Result: `GenerationResult`
- `success: boolean`
- `outputPath: string`
- `qaResult?: { hasIssues: boolean; issues: QAIssue[] }`
- `metadata: { slideCount: number; generatedAt: Date }`

## Core DSL Types
- `PresentationDSL`
- `Slide` (`title` / `content` / `section` / `blank`)
- `ContentElement`
  - `text`
  - `bullet-list`
  - `numbered-list`
  - `stat-callout`
  - `image`
  - `table`
  - `chart`
  - `network-diagram`
  - `flowchart`
  - `icon-grid`
  - `two-column`

詳細型定義:
- `src/types/dsl.ts`
- `src/types/theme.ts`
- `src/types/qa.ts`

## Error Types
- `ParseError`: YAML 解析失敗
- `ValidationError`: スキーマ/意味検証失敗
- `ThemeError`: テーマ読込・解決失敗
- `LayoutError`: レイアウト計算失敗
- `RenderError`: 要素描画失敗
- `IOError`: 入出力失敗
