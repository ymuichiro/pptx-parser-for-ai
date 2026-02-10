# **PowerPoint生成ライブラリ設計書**

## **1. プロジェクト構成**

```
pptx-dsl-renderer/
├── package.json
├── tsconfig.json
├── README.md
├── docs/
│   ├── dsl-specification.md      # DSL仕様書
│   ├── api-reference.md          # APIリファレンス
│   ├── layout-guide.md           # レイアウトガイド
│   └── examples/                 # サンプル集
├── src/
│   ├── index.ts                  # メインエントリーポイント
│   ├── types/                    # 型定義
│   │   ├── dsl.ts               # DSL型定義
│   │   ├── theme.ts             # テーマ型定義
│   │   └── layout.ts            # レイアウト型定義
│   ├── parser/                   # DSLパーサー
│   │   ├── index.ts
│   │   ├── validator.ts         # DSLバリデーション
│   │   └── normalizer.ts        # DSL正規化
│   ├── theme/                    # テーマ管理
│   │   ├── index.ts
│   │   ├── loader.ts            # テーマ読み込み
│   │   └── applier.ts           # テーマ適用
│   ├── layout/                   # レイアウトエンジン
│   │   ├── index.ts
│   │   ├── engine.ts            # レイアウト計算
│   │   ├── constraints.ts       # 制約解決
│   │   └── algorithms/          # レイアウトアルゴリズム
│   │       ├── hierarchical.ts
│   │       ├── force-directed.ts
│   │       └── grid.ts
│   ├── renderers/                # レンダラー
│   │   ├── index.ts
│   │   ├── base-renderer.ts     # 基底クラス
│   │   ├── slide-renderer.ts    # スライド全体
│   │   └── components/          # コンポーネントレンダラー
│   │       ├── text.ts
│   │       ├── table.ts
│   │       ├── chart.ts
│   │       ├── image.ts
│   │       ├── shape.ts
│   │       ├── network-diagram.ts
│   │       └── flowchart.ts
│   ├── qa/                       # 品質保証
│   │   ├── index.ts
│   │   ├── validator.ts         # 出力検証
│   │   └── fixer.ts             # 自動修正
│   └── utils/                    # ユーティリティ
│       ├── color.ts             # 色処理
│       ├── geometry.ts          # 座標計算
│       └── icon-renderer.ts     # アイコン生成
├── themes/                       # デフォルトテーマ
│   ├── corporate-blue.yaml
│   ├── modern-minimal.yaml
│   └── creative-bold.yaml
├── templates/                    # サンプルDSL
│   ├── business-report.yaml
│   ├── product-pitch.yaml
│   └── technical-presentation.yaml
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── examples/
    ├── basic-usage.ts
    ├── custom-theme.ts
    └── network-diagram.ts
```

## **2. DSL仕様（YAML形式）**

### **2-1. 基本構造**

```yaml
# presentation.yaml
version: "1.0"
theme: "corporate-blue"  # またはファイルパス

metadata:
  title: "Q4業績報告"
  author: "山田太郎"
  company: "株式会社サンプル"
  date: "2025-01-15"

slides:
  - type: title
    # スライド内容
  
  - type: content
    # スライド内容
```

### **2-2. スライドタイプ一覧**

```yaml
# タイトルスライド
- type: title
  background: dark  # dark, light, image, gradient
  content:
    title: "Q4業績報告"
    subtitle: "2024年度決算"
    date: "2025年1月15日"
    logo: true  # テーマのロゴを表示

# コンテンツスライド（自動レイアウト）
- type: content
  layout: auto  # auto, single-column, two-column, three-column
  title: "売上サマリー"
  content:
    # 後述

# セクション区切り
- type: section
  title: "第2章"
  subtitle: "市場分析"
  background:
    color: primary
    opacity: 0.9

# ブランクスライド（完全カスタム）
- type: blank
  background: light
  elements:
    # 後述
```

### **2-3. コンテンツ要素**

```yaml
# テキストブロック
- type: text
  content: "ここに本文テキスト"
  style: body  # title, heading, body, caption
  align: left  # left, center, right
  
# 箇条書き
- type: bullet-list
  style: default  # default, pros, cons, checkmark
  items:
    - "第一項目"
    - "第二項目"
    - text: "第三項目"
      sub-items:
        - "サブ項目A"
        - "サブ項目B"

# 番号付きリスト
- type: numbered-list
  items:
    - "ステップ1"
    - "ステップ2"

# 統計値カルーアウト
- type: stat-callout
  value: "¥120億"
  label: "総売上高"
  trend: "+15%"  # オプション
  color: accent  # primary, secondary, accent

# 画像
- type: image
  source: "path/to/image.png"  # または URL, base64
  caption: "図1: 売上推移"
  sizing: contain  # contain, cover, crop
  position: center  # center, left, right

# テーブル
- type: table
  style: default  # default, striped, bordered, minimal
  headers: ["項目", "Q3", "Q4", "変化率"]
  rows:
    - ["売上", "¥100億", "¥120億", "+20%"]
    - ["利益", "¥15億", "¥18億", "+20%"]
  highlight:
    - column: 3
      condition: positive  # positive, negative, threshold
      color: accent

# チャート
- type: chart
  chart-type: bar  # bar, line, pie, doughnut, scatter
  title: "四半期売上推移"
  data:
    labels: ["Q1", "Q2", "Q3", "Q4"]
    series:
      - name: "売上"
        values: [90, 95, 100, 120]
        color: primary
  options:
    show-values: true
    show-legend: false

# ネットワーク図
- type: network-diagram
  layout: hierarchical  # hierarchical, force-directed, circular
  nodes:
    - id: web
      label: "Webサーバー"
      icon: server
      color: primary
    - id: app
      label: "アプリ"
      icon: code
      color: secondary
  edges:
    - from: web
      to: app
      label: "HTTPS"

# フローチャート
- type: flowchart
  direction: horizontal  # horizontal, vertical
  steps:
    - id: start
      label: "開始"
      shape: rounded
    - id: process
      label: "処理"
      shape: rectangle
    - id: decision
      label: "判定"
      shape: diamond
  flows:
    - from: start
      to: process
    - from: process
      to: decision

# アイコングリッド
- type: icon-grid
  columns: 3
  items:
    - icon: target
      title: "目標"
      description: "売上20%増"
    - icon: users
      title: "チーム"
      description: "50名体制"

# 2カラムレイアウト
- type: two-column
  left:
    - type: bullet-list
      items: [...]
  right:
    - type: image
      source: "..."
  ratio: 1:1  # または 2:1, 1:2

# カスタム要素（ブランクスライド用）
- type: custom-shape
  shape: rectangle  # rectangle, circle, triangle, arrow
  position: { x: 1, y: 1, w: 2, h: 1 }
  fill: primary
  border:
    color: text-dark
    width: 2
```

## **3. テーマ定義仕様**

```yaml
# theme.yaml
name: "Corporate Blue"
version: "1.0"

# 色パレット
colors:
  primary: "1E2761"
  secondary: "CADCFC"
  accent: "FF6B35"
  text-dark: "2C2C2C"
  text-light: "FFFFFF"
  background-light: "F8F9FA"
  background-dark: "1E2761"
  success: "10B981"
  warning: "F59E0B"
  error: "EF4444"

# タイポグラフィ
typography:
  fonts:
    title: "Arial Black"
    heading: "Arial"
    body: "Arial"
    caption: "Arial"
  sizes:
    title: 44
    heading: 28
    subheading: 20
    body: 16
    caption: 12
    stat-value: 60
  weights:
    bold: true
    normal: false

# レイアウト
layout:
  slide-size: "16:9"  # 16:9, 16:10, 4:3
  margins:
    default: 0.5
    title-slide: 1.0
  spacing:
    element-gap: 0.3
    paragraph-spacing: 0.15
  grid:
    columns: 12
    gutter: 0.2

# ロゴ
logo:
  source: "path/to/logo.png"
  position: top-right  # top-left, top-right, bottom-left, bottom-right
  size: [1.0, 0.4]
  margin: 0.3

# デフォルトスタイル
defaults:
  title-slide:
    background: background-dark
    title-color: text-light
    subtitle-color: secondary
  
  content-slide:
    background: background-light
    title-color: text-dark
  
  bullet-style:
    character: "•"
    color: accent
    indent: 0.3
  
  table-style:
    header-background: primary
    header-text: text-light
    row-alternate: background-light
    border-color: text-dark

# シャドウ・エフェクト
effects:
  card-shadow:
    type: outer
    blur: 6
    offset: 2
    color: "000000"
    opacity: 0.1
  
  title-underline:
    enabled: false  # AIっぽさを避けるためfalse推奨
```

## **4. TypeScript型定義**

```typescript
// src/types/dsl.ts

export interface PresentationDSL {
  version: string;
  theme: string | ThemeDefinition;
  metadata: PresentationMetadata;
  slides: Slide[];
}

export interface PresentationMetadata {
  title: string;
  author?: string;
  company?: string;
  date?: string;
}

export type Slide = 
  | TitleSlide
  | ContentSlide
  | SectionSlide
  | BlankSlide;

export interface TitleSlide {
  type: 'title';
  background?: Background;
  content: {
    title: string;
    subtitle?: string;
    date?: string;
    logo?: boolean;
  };
}

export interface ContentSlide {
  type: 'content';
  layout?: LayoutType;
  title: string;
  content: ContentElement[];
}

export type ContentElement =
  | TextElement
  | BulletListElement
  | TableElement
  | ChartElement
  | ImageElement
  | NetworkDiagramElement
  | FlowchartElement
  | StatCalloutElement
  | TwoColumnElement
  | IconGridElement;

export interface TextElement {
  type: 'text';
  content: string;
  style?: TextStyle;
  align?: Alignment;
}

export interface BulletListElement {
  type: 'bullet-list';
  style?: BulletStyle;
  items: (string | BulletItem)[];
}

export interface BulletItem {
  text: string;
  subItems?: string[];
}

export interface TableElement {
  type: 'table';
  style?: TableStyle;
  headers: string[];
  rows: (string | number)[][];
  highlight?: HighlightRule[];
}

export interface NetworkDiagramElement {
  type: 'network-diagram';
  layout: 'hierarchical' | 'force-directed' | 'circular';
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkNode {
  id: string;
  label: string;
  icon?: string;
  color?: ColorRef;
}

export interface NetworkEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
}

// ... その他の型定義
```

## **5. コアクラス設計**

### **5-1. メインAPI**

```typescript
// src/index.ts

import PptxGenJS from 'pptxgenjs';
import { PresentationDSL } from './types/dsl';
import { ThemeManager } from './theme';
import { DSLParser } from './parser';
import { SlideRenderer } from './renderers';
import { QAEngine } from './qa';

export class PPTXRenderer {
  private themeManager: ThemeManager;
  private parser: DSLParser;
  private renderer: SlideRenderer;
  private qa?: QAEngine;

  constructor(options?: RendererOptions) {
    this.themeManager = new ThemeManager();
    this.parser = new DSLParser();
    this.renderer = new SlideRenderer();
    
    if (options?.enableQA) {
      this.qa = new QAEngine(options.qaConfig);
    }
  }

  /**
   * DSLファイルからPowerPointを生成
   */
  async generateFromFile(
    dslPath: string,
    outputPath: string
  ): Promise<GenerationResult> {
    // 1. DSL読み込み
    const dsl = await this.parser.parseFile(dslPath);
    
    // 2. 生成
    return this.generate(dsl, outputPath);
  }

  /**
   * DSLオブジェクトからPowerPointを生成
   */
  async generate(
    dsl: PresentationDSL,
    outputPath: string
  ): Promise<GenerationResult> {
    // 1. バリデーション
    const validationResult = this.parser.validate(dsl);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }

    // 2. DSL正規化
    const normalized = this.parser.normalize(dsl);

    // 3. テーマ読み込み
    const theme = await this.themeManager.loadTheme(normalized.theme);

    // 4. プレゼンテーション生成
    const pres = new PptxGenJS();
    this.setupPresentation(pres, normalized, theme);

    // 5. スライド生成
    for (const slide of normalized.slides) {
      await this.renderer.renderSlide(pres, slide, theme);
    }

    // 6. ファイル出力
    await pres.writeFile({ fileName: outputPath });

    // 7. QA（オプション）
    let qaResult;
    if (this.qa) {
      qaResult = await this.qa.validate(outputPath);
      
      // 自動修正が有効な場合
      if (qaResult.hasIssues && this.qa.autoFixEnabled) {
        const fixedDSL = await this.qa.fix(dsl, qaResult.issues);
        return this.generate(fixedDSL, outputPath);
      }
    }

    return {
      success: true,
      outputPath,
      qaResult,
      metadata: {
        slideCount: normalized.slides.length,
        generatedAt: new Date(),
      }
    };
  }

  private setupPresentation(
    pres: PptxGenJS,
    dsl: PresentationDSL,
    theme: Theme
  ): void {
    // レイアウト設定
    const layoutMap = {
      '16:9': 'LAYOUT_16x9',
      '16:10': 'LAYOUT_16x10',
      '4:3': 'LAYOUT_4x3',
    };
    pres.layout = layoutMap[theme.layout.slideSize];

    // メタデータ
    pres.author = dsl.metadata.author || '';
    pres.title = dsl.metadata.title || '';
    pres.company = dsl.metadata.company || '';
  }
}

export interface RendererOptions {
  enableQA?: boolean;
  qaConfig?: QAConfig;
  customRenderers?: CustomRendererMap;
}

export interface GenerationResult {
  success: boolean;
  outputPath: string;
  qaResult?: QAResult;
  metadata: GenerationMetadata;
}
```

### **5-2. DSLパーサー**

```typescript
// src/parser/index.ts

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import { PresentationDSL } from '../types/dsl';
import { DSLValidator } from './validator';
import { DSLNormalizer } from './normalizer';

export class DSLParser {
  private validator: DSLValidator;
  private normalizer: DSLNormalizer;

  constructor() {
    this.validator = new DSLValidator();
    this.normalizer = new DSLNormalizer();
  }

  /**
   * YAMLファイルをパース
   */
  async parseFile(filePath: string): Promise<PresentationDSL> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * YAML文字列をパース
   */
  parse(yamlString: string): PresentationDSL {
    try {
      const dsl = yaml.load(yamlString) as PresentationDSL;
      return dsl;
    } catch (error) {
      throw new ParseError(`Failed to parse DSL: ${error.message}`);
    }
  }

  /**
   * DSLをバリデーション
   */
  validate(dsl: PresentationDSL): ValidationResult {
    return this.validator.validate(dsl);
  }

  /**
   * DSLを正規化（デフォルト値の補完など）
   */
  normalize(dsl: PresentationDSL): PresentationDSL {
    return this.normalizer.normalize(dsl);
  }
}
```

### **5-3. レイアウトエンジン**

```typescript
// src/layout/engine.ts

import { ContentElement, Theme } from '../types';
import { LayoutConstraints } from './constraints';

export class LayoutEngine {
  private constraints: LayoutConstraints;
  private slideWidth: number;
  private slideHeight: number;

  constructor(theme: Theme) {
    this.constraints = new LayoutConstraints(theme);
    
    const dimensions = this.getSlideSize(theme.layout.slideSize);
    this.slideWidth = dimensions.width;
    this.slideHeight = dimensions.height;
  }

  /**
   * コンテンツ要素の配置を計算
   */
  calculateLayout(
    elements: ContentElement[],
    layoutType: LayoutType
  ): LayoutResult {
    switch (layoutType) {
      case 'auto':
        return this.autoLayout(elements);
      case 'single-column':
        return this.singleColumnLayout(elements);
      case 'two-column':
        return this.twoColumnLayout(elements);
      case 'three-column':
        return this.threeColumnLayout(elements);
      default:
        return this.autoLayout(elements);
    }
  }

  private autoLayout(elements: ContentElement[]): LayoutResult {
    // 要素の種類と数から最適レイアウトを自動決定
    const hasImage = elements.some(e => e.type === 'image');
    const hasDiagram = elements.some(e => 
      e.type === 'network-diagram' || e.type === 'flowchart'
    );
    const textElements = elements.filter(e => 
      e.type === 'text' || e.type === 'bullet-list'
    );

    // 判定ロジック
    if (hasDiagram && textElements.length > 0) {
      // 図 + テキスト → 2カラム
      return this.twoColumnLayout(elements);
    } else if (elements.length <= 3 && hasImage) {
      // 少数要素 + 画像 → 2カラム
      return this.twoColumnLayout(elements);
    } else if (elements.every(e => e.type === 'stat-callout')) {
      // 全て統計値 → グリッド
      return this.gridLayout(elements);
    } else {
      // デフォルト → 1カラム
      return this.singleColumnLayout(elements);
    }
  }

  private singleColumnLayout(elements: ContentElement[]): LayoutResult {
    const margin = this.constraints.minMargin;
    const gap = this.constraints.elementGap;
    
    const contentArea = {
      x: margin,
      y: 1.0, // タイトル分を確保
      w: this.slideWidth - 2 * margin,
      h: this.slideHeight - 1.0 - margin
    };

    const elementHeight = (contentArea.h - gap * (elements.length - 1)) / elements.length;

    return {
      areas: elements.map((element, index) => ({
        element,
        bounds: {
          x: contentArea.x,
          y: contentArea.y + index * (elementHeight + gap),
          w: contentArea.w,
          h: elementHeight
        }
      }))
    };
  }

  private twoColumnLayout(elements: ContentElement[]): LayoutResult {
    const margin = this.constraints.minMargin;
    const gap = this.constraints.elementGap;
    
    const contentY = 1.0;
    const contentH = this.slideHeight - contentY - margin;
    const columnW = (this.slideWidth - 2 * margin - gap) / 2;

    // 要素を左右に振り分け
    const { left, right } = this.distributeElements(elements);

    const leftAreas = this.arrangeColumn(left, {
      x: margin,
      y: contentY,
      w: columnW,
      h: contentH
    });

    const rightAreas = this.arrangeColumn(right, {
      x: margin + columnW + gap,
      y: contentY,
      w: columnW,
      h: contentH
    });

    return {
      areas: [...leftAreas, ...rightAreas]
    };
  }

  private distributeElements(elements: ContentElement[]): {
    left: ContentElement[];
    right: ContentElement[];
  } {
    // 画像・図は右、テキストは左を優先
    const left: ContentElement[] = [];
    const right: ContentElement[] = [];

    for (const element of elements) {
      if (element.type === 'image' || 
          element.type === 'network-diagram' ||
          element.type === 'flowchart' ||
          element.type === 'chart') {
        right.push(element);
      } else {
        left.push(element);
      }
    }

    // どちらかが空の場合は均等に分配
    if (left.length === 0 || right.length === 0) {
      const half = Math.ceil(elements.length / 2);
      return {
        left: elements.slice(0, half),
        right: elements.slice(half)
      };
    }

    return { left, right };
  }

  private getSlideSize(size: string): { width: number; height: number } {
    const sizes = {
      '16:9': { width: 10, height: 5.625 },
      '16:10': { width: 10, height: 6.25 },
      '4:3': { width: 10, height: 7.5 }
    };
    return sizes[size] || sizes['16:9'];
  }
}

export interface LayoutResult {
  areas: ElementArea[];
}

export interface ElementArea {
  element: ContentElement;
  bounds: Bounds;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
```

### **5-4. コンポーネントレンダラー（例: ネットワーク図）**

```typescript
// src/renderers/components/network-diagram.ts

import PptxGenJS from 'pptxgenjs';
import { NetworkDiagramElement, Theme, Bounds } from '../../types';
import { HierarchicalLayout } from '../../layout/algorithms/hierarchical';
import { ForceDirectedLayout } from '../../layout/algorithms/force-directed';

export class NetworkDiagramRenderer {
  private nodeWidth = 1.5;
  private nodeHeight = 0.8;

  async render(
    slide: PptxGenJS.Slide,
    element: NetworkDiagramElement,
    bounds: Bounds,
    theme: Theme
  ): Promise<void> {
    // 1. レイアウト計算
    const positions = this.calculateLayout(element, bounds);

    // 2. エッジ描画（ノードの下に）
    this.renderEdges(slide, element.edges, positions, theme);

    // 3. ノード描画
    await this.renderNodes(slide, element.nodes, positions, theme);
  }

  private calculateLayout(
    element: NetworkDiagramElement,
    bounds: Bounds
  ): Map<string, NodePosition> {
    const algorithm = element.layout;

    if (algorithm === 'hierarchical') {
      const layout = new HierarchicalLayout(
        this.nodeWidth,
        this.nodeHeight
      );
      return layout.calculate(element.nodes, element.edges, bounds);
    } else if (algorithm === 'force-directed') {
      const layout = new ForceDirectedLayout(
        this.nodeWidth,
        this.nodeHeight
      );
      return layout.calculate(element.nodes, element.edges, bounds);
    } else {
      // circular
      return this.circularLayout(element.nodes, bounds);
    }
  }

  private renderEdges(
    slide: PptxGenJS.Slide,
    edges: NetworkEdge[],
    positions: Map<string, NodePosition>,
    theme: Theme
  ): void {
    for (const edge of edges) {
      const fromPos = positions.get(edge.from);
      const toPos = positions.get(edge.to);

      if (!fromPos || !toPos) continue;

      // ノードの中心座標
      const fromX = fromPos.x + this.nodeWidth / 2;
      const fromY = fromPos.y + this.nodeHeight / 2;
      const toX = toPos.x + this.nodeWidth / 2;
      const toY = toPos.y + this.nodeHeight / 2;

      // 接続線
      slide.addShape('line', {
        x: fromX,
        y: fromY,
        w: toX - fromX,
        h: toY - fromY,
        line: {
          color: theme.colors['text-dark'],
          width: 2,
          dashType: edge.style === 'dashed' ? 'dash' : undefined
        }
      });

      // ラベル（あれば）
      if (edge.label) {
        const labelX = (fromX + toX) / 2 - 0.3;
        const labelY = (fromY + toY) / 2 - 0.15;

        slide.addText(edge.label, {
          x: labelX,
          y: labelY,
          w: 0.6,
          h: 0.3,
          fontSize: 10,
          fontFace: theme.typography.fonts.body,
          color: theme.colors['text-dark'],
          align: 'center',
          valign: 'middle',
          fill: { color: theme.colors['background-light'] }
        });
      }
    }
  }

  private async renderNodes(
    slide: PptxGenJS.Slide,
    nodes: NetworkNode[],
    positions: Map<string, NodePosition>,
    theme: Theme
  ): Promise<void> {
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const color = theme.colors[node.color || 'primary'];

      // ノードの背景
      slide.addShape('rect', {
        x: pos.x,
        y: pos.y,
        w: this.nodeWidth,
        h: this.nodeHeight,
        fill: { color },
        line: {
          color: theme.colors['text-dark'],
          width: 2
        }
      });

      // ラベル
      slide.addText(node.label, {
        x: pos.x,
        y: pos.y,
        w: this.nodeWidth,
        h: this.nodeHeight,
        fontSize: theme.typography.sizes.body,
        fontFace: theme.typography.fonts.body,
        color: theme.colors['text-light'],
        bold: true,
        align: 'center',
        valign: 'middle'
      });

      // アイコン（オプション）
      if (node.icon) {
        await this.renderIcon(slide, node.icon, pos, theme);
      }
    }
  }

  private circularLayout(
    nodes: NetworkNode[],
    bounds: Bounds
  ): Map<string, NodePosition> {
    const positions = new Map<string, NodePosition>();
    const count = nodes.length;
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const radius = Math.min(bounds.w, bounds.h) / 2 - this.nodeWidth;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle) - this.nodeWidth / 2;
      const y = centerY + radius * Math.sin(angle) - this.nodeHeight / 2;

      positions.set(node.id, { x, y });
    });

    return positions;
  }
}

interface NodePosition {
  x: number;
  y: number;
}
```

## **6. 使用例**

```typescript
// examples/basic-usage.ts

import { PPTXRenderer } from 'pptx-dsl-renderer';

async function main() {
  const renderer = new PPTXRenderer({
    enableQA: true,
    qaConfig: {
      autoFix: true,
      maxIterations: 3
    }
  });

  // DSLファイルから生成
  const result = await renderer.generateFromFile(
    './presentation.yaml',
    './output.pptx'
  );

  console.log('✅ Generated:', result.outputPath);
  console.log('📊 Slides:', result.metadata.slideCount);
  
  if (result.qaResult?.hasIssues) {
    console.log('⚠️  Issues found:', result.qaResult.issues);
  }
}

main();
```

```typescript
// examples/programmatic-usage.ts

import { PPTXRenderer, PresentationDSL } from 'pptx-dsl-renderer';

async function main() {
  const renderer = new PPTXRenderer();

  // プログラムでDSLを構築
  const dsl: PresentationDSL = {
    version: '1.0',
    theme: 'corporate-blue',
    metadata: {
      title: 'システム設計書',
      author: 'エンジニアリングチーム',
      date: '2025-01-15'
    },
    slides: [
      {
        type: 'title',
        content: {
          title: 'システム設計書',
          subtitle: 'マイクロサービスアーキテクチャ',
          date: '2025年1月15日'
        }
      },
      {
        type: 'content',
        title: 'アーキテクチャ概要',
        layout: 'auto',
        content: [
          {
            type: 'network-diagram',
            layout: 'hierarchical',
            nodes: [
              { id: 'web', label: 'Webサーバー', icon: 'server', color: 'primary' },
              { id: 'app', label: 'アプリ', icon: 'code', color: 'secondary' },
              { id: 'db', label: 'DB', icon: 'database', color: 'accent' }
            ],
            edges: [
              { from: 'web', to: 'app', label: 'HTTPS' },
              { from: 'app', to: 'db', label: 'SQL' }
            ]
          }
        ]
      }
    ]
  };

  await renderer.generate(dsl, './output.pptx');
}

main();
```

## **7. 実装フェーズ**

### **Phase 1: コア機能（2週間）**
- [ ] 型定義（`types/`）
- [ ] DSLパーサー（`parser/`）
- [ ] テーマ管理（`theme/`）
- [ ] 基本レンダラー（テキスト、タイトル）
- [ ] メインAPI（`index.ts`）

### **Phase 2: レイアウトエンジン（1週間）**
- [ ] レイアウト計算（`layout/engine.ts`）
- [ ] 制約解決（`layout/constraints.ts`）
- [ ] 自動レイアウト判定

### **Phase 3: コンポーネント実装（2週間）**
- [ ] テーブルレンダラー
- [ ] チャートレンダラー
- [ ] 画像レンダラー
- [ ] ネットワーク図レンダラー
- [ ] フローチャートレンダラー

### **Phase 4: 高度な機能（1週間）**
- [ ] 階層的レイアウトアルゴリズム
- [ ] Force-directedアルゴリズム
- [ ] アイコンレンダリング
- [ ] QAエンジン

### **Phase 5: テスト・ドキュメント（1週間）**
- [ ] ユニットテスト
- [ ] 統合テスト
- [ ] APIドキュメント
- [ ] サンプル集

**合計: 7週間**

## **8. パッケージング**

```json
// package.json
{
  "name": "pptx-dsl-renderer",
  "version": "1.0.0",
  "description": "Enterprise PowerPoint generator from declarative DSL",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "docs": "typedoc"
  },
  "dependencies": {
    "pptxgenjs": "^3.12.0",
    "js-yaml": "^4.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-icons": "^5.0.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/js-yaml": "^4.0.5",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```