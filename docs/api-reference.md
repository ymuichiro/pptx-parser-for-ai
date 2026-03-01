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

`QAIssue.code` 例:
- `OUTPUT_NOT_FOUND`
- `EMPTY_OUTPUT`
- `OUT_OF_BOUNDS`
- `EXCESSIVE_OVERLAP`
- `LOW_CONTRAST_TEXT`
- `MISSING_THEME_TOKEN`
- `STYLE_REF_NOT_FOUND`
- `PRESET_SLOT_STYLE_MISMATCH`

## Core DSL Types
- `PresentationDSL`
  - `version`: `2.0` 固定
  - `metadata`: `title/author/company/date` に加え `copyright`, `footerText` を指定可能
  - `chrome?`
    - `header.divider`: ヘッダー領域と本文を分離する区切り線
    - `footer`: 左テキスト + ページ番号 + 任意の区切り線
- `Slide` (`title` / `content` / `section` / `blank`)
- `content` slide
  - `layout?`: `auto|single-column|two-column|three-column`
  - `preset?`: `overview-2x2|compare-3col|kpi-with-callout`
  - `preset` 指定時は `layout` より優先
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
  - 共通で `slot?`（preset 使用時の配置先）、`styleRef?`（theme.components の named style）、`qa.exclude?`（QA 判定除外）を指定可能

`image` の描画仕様:
- `sizing`
  - `contain`: アスペクト比を維持して全体表示（余白あり）
  - `cover`: 指定領域を埋めるようにトリミング
  - `crop`: 明示トリミング（現行は `cover` と同じく領域埋め + トリミング）
- `position` (`left` / `center` / `right`)
  - `contain` 時の水平配置に使用
  - `cover` / `crop` 時の水平トリミングアンカーに使用
- `bounds`
  - `blank` slide: そのまま配置座標として使用
  - `content` slide: レイアウト計算結果より優先して上書き可能
- `frame`
  - `borderColor` / `borderWidth` / `shadow` を画像枠スタイルとして指定可能
- `captionStyleRef`
  - 画像キャプションの text style（`theme.components.text`）を指定可能

`theme` の主な v2 仕様:
- `version: "2.0"` 固定
- 必須 semantic color token（`primary`, `surface`, `neutral-border` など）
- `components` セクションで各 renderer の named style を定義

`preset` の検証仕様:
- 未定義 preset ID は `ValidationError`
- 未定義 slot / 重複 slot / slot と要素 type の不一致は `ValidationError`

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
