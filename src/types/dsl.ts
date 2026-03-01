import type { LayoutType } from "./layout";
import type { ThemeDefinition } from "./theme";

export interface PresentationDSL {
  version: "2.0";
  theme: string | ThemeDefinition;
  metadata: PresentationMetadata;
  chrome?: PresentationChrome;
  slides: Slide[];
}

export interface PresentationMetadata {
  title: string;
  author?: string;
  company?: string;
  date?: string;
  copyright?: string;
  footerText?: string;
}

export interface DividerChrome {
  enabled?: boolean;
  x?: number;
  y?: number;
  w?: number;
  color?: string;
  width?: number;
}

export interface HeaderChrome {
  divider?: DividerChrome;
}

export interface FooterChrome {
  enabled?: boolean;
  leftText?: string;
  showSlideNumber?: boolean;
  color?: string;
  fontFace?: string;
  fontSize?: number;
  divider?: DividerChrome;
}

export interface PresentationChrome {
  header?: HeaderChrome;
  footer?: FooterChrome;
}

export interface ElementPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Slide = TitleSlide | ContentSlide | SectionSlide | BlankSlide;
export type PresetId = "overview-2x2" | "compare-3col" | "kpi-with-callout";

export type SlideBackground =
  | "dark"
  | "light"
  | {
      color: string;
      opacity?: number;
    };

export interface TitleSlide {
  type: "title";
  background?: SlideBackground;
  content: {
    title: string;
    subtitle?: string;
    date?: string;
    logo?: boolean;
  };
}

export interface ContentSlide {
  type: "content";
  layout?: LayoutType;
  preset?: PresetId;
  title: string;
  content: ContentElement[];
}

export interface SectionSlide {
  type: "section";
  title: string;
  subtitle?: string;
  background?: {
    color: string;
    opacity?: number;
  };
}

export interface BlankSlide {
  type: "blank";
  background?: SlideBackground;
  elements: Array<ContentElement | CustomShapeElement>;
}

export type TextStyle = "title" | "heading" | "body" | "caption";
export type Alignment = "left" | "center" | "right";

export interface ElementQAOptions {
  exclude?: boolean;
}

export interface StylableElement {
  styleRef?: string;
}

export interface TextElement extends StylableElement {
  type: "text";
  content: string;
  slot?: string;
  style?: TextStyle;
  align?: Alignment;
  position?: ElementPosition;
  color?: string;
  fontFace?: string;
  fontSize?: number;
  bold?: boolean;
  valign?: "top" | "mid" | "bottom";
  qa?: ElementQAOptions;
}

export interface BulletItem {
  text: string;
  subItems?: string[];
}

export interface BulletListElement extends StylableElement {
  type: "bullet-list";
  slot?: string;
  style?: "default" | "pros" | "cons" | "checkmark";
  items: Array<string | BulletItem>;
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface NumberedListElement extends StylableElement {
  type: "numbered-list";
  slot?: string;
  items: string[];
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface StatCalloutElement extends StylableElement {
  type: "stat-callout";
  slot?: string;
  value: string;
  label: string;
  trend?: string;
  color?: string;
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface ImageElement extends StylableElement {
  type: "image";
  slot?: string;
  source: string;
  caption?: string;
  sizing?: "contain" | "cover" | "crop";
  position?: "center" | "left" | "right";
  bounds?: ElementPosition;
  frame?: {
    borderColor?: string;
    borderWidth?: number;
    shadow?: boolean;
  };
  captionStyleRef?: string;
  qa?: ElementQAOptions;
}

export interface TableHighlightRule {
  column: number;
  condition: "positive" | "negative" | "threshold";
  color: string;
}

export interface TableElement extends StylableElement {
  type: "table";
  slot?: string;
  style?: "default" | "striped" | "bordered" | "minimal";
  headers: string[];
  rows: Array<Array<string | number>>;
  highlight?: TableHighlightRule[];
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface ChartElement extends StylableElement {
  type: "chart";
  slot?: string;
  chartType: "bar" | "line" | "pie" | "doughnut" | "scatter";
  title?: string;
  position?: ElementPosition;
  data: {
    labels: string[];
    series: ChartSeries[];
  };
  options?: {
    showValues?: boolean;
    showLegend?: boolean;
    valuePrefix?: string;
    valueSuffix?: string;
  };
  qa?: ElementQAOptions;
}

export interface NetworkNode {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface NetworkEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

export interface NetworkDiagramElement extends StylableElement {
  type: "network-diagram";
  slot?: string;
  layout: "hierarchical" | "force-directed" | "circular";
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface FlowchartStep {
  id: string;
  label: string;
  shape?: "rounded" | "rectangle" | "diamond";
}

export interface FlowchartFlow {
  from: string;
  to: string;
  label?: string;
}

export interface FlowchartElement extends StylableElement {
  type: "flowchart";
  slot?: string;
  direction: "horizontal" | "vertical";
  steps: FlowchartStep[];
  flows: FlowchartFlow[];
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface IconGridItem {
  icon: string;
  title: string;
  description?: string;
}

export interface IconGridElement extends StylableElement {
  type: "icon-grid";
  slot?: string;
  columns: number;
  items: IconGridItem[];
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface TwoColumnElement extends StylableElement {
  type: "two-column";
  slot?: string;
  left: ContentElement[];
  right: ContentElement[];
  ratio?: "1:1" | "2:1" | "1:2";
  position?: ElementPosition;
  qa?: ElementQAOptions;
}

export interface CustomShapeElement {
  type: "custom-shape";
  shape: "rectangle" | "circle" | "triangle" | "arrow" | "rounded-rectangle";
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  fill?: string;
  border?: {
    color: string;
    width: number;
  };
  rectRadius?: number;
  qa?: ElementQAOptions;
}

export type ContentElement =
  | TextElement
  | BulletListElement
  | NumberedListElement
  | StatCalloutElement
  | ImageElement
  | TableElement
  | ChartElement
  | NetworkDiagramElement
  | FlowchartElement
  | IconGridElement
  | TwoColumnElement;
