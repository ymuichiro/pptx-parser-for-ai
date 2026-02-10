# API Reference

## Export

```ts
import {
  PPTXRenderer,
  type RendererOptions,
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

### `generateFromFile(dslPath: string, outputPath: string): Promise<GenerationResult>`
- YAML DSL ファイルを読み込み、`.pptx` を生成

### `generate(dsl: PresentationDSL, outputPath: string): Promise<GenerationResult>`
- DSL オブジェクトから `.pptx` を生成

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
