import type { LayoutType } from "./layout";
import type { ThemeDefinition } from "./theme";

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

export type Slide = TitleSlide | ContentSlide | SectionSlide | BlankSlide;

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

export interface TextElement {
  type: "text";
  content: string;
  style?: TextStyle;
  align?: Alignment;
}

export interface BulletItem {
  text: string;
  subItems?: string[];
}

export interface BulletListElement {
  type: "bullet-list";
  style?: "default" | "pros" | "cons" | "checkmark";
  items: Array<string | BulletItem>;
}

export interface NumberedListElement {
  type: "numbered-list";
  items: string[];
}

export interface StatCalloutElement {
  type: "stat-callout";
  value: string;
  label: string;
  trend?: string;
  color?: string;
}

export interface ImageElement {
  type: "image";
  source: string;
  caption?: string;
  sizing?: "contain" | "cover" | "crop";
  position?: "center" | "left" | "right";
}

export interface TableHighlightRule {
  column: number;
  condition: "positive" | "negative" | "threshold";
  color: string;
}

export interface TableElement {
  type: "table";
  style?: "default" | "striped" | "bordered" | "minimal";
  headers: string[];
  rows: Array<Array<string | number>>;
  highlight?: TableHighlightRule[];
}

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface ChartElement {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "doughnut" | "scatter";
  title?: string;
  data: {
    labels: string[];
    series: ChartSeries[];
  };
  options?: {
    showValues?: boolean;
    showLegend?: boolean;
  };
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

export interface NetworkDiagramElement {
  type: "network-diagram";
  layout: "hierarchical" | "force-directed" | "circular";
  nodes: NetworkNode[];
  edges: NetworkEdge[];
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

export interface FlowchartElement {
  type: "flowchart";
  direction: "horizontal" | "vertical";
  steps: FlowchartStep[];
  flows: FlowchartFlow[];
}

export interface IconGridItem {
  icon: string;
  title: string;
  description?: string;
}

export interface IconGridElement {
  type: "icon-grid";
  columns: number;
  items: IconGridItem[];
}

export interface TwoColumnElement {
  type: "two-column";
  left: ContentElement[];
  right: ContentElement[];
  ratio?: "1:1" | "2:1" | "1:2";
}

export interface CustomShapeElement {
  type: "custom-shape";
  shape: "rectangle" | "circle" | "triangle" | "arrow";
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
