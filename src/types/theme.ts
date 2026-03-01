export type SlideSize = "16:9" | "16:10" | "4:3";

export interface NamedComponentStyles<T> {
  defaultStyleRef: string;
  styles: Record<string, T>;
}

export interface ThemeFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ThemeDividerChrome {
  enabled?: boolean;
  x?: number;
  y?: number;
  w?: number;
  color?: string;
  width?: number;
}

export interface ThemeHeaderChrome {
  divider?: ThemeDividerChrome;
}

export interface ThemeFooterChrome {
  enabled?: boolean;
  leftText?: string;
  showSlideNumber?: boolean;
  color?: string;
  fontFace?: string;
  fontSize?: number;
  divider?: ThemeDividerChrome;
}

export interface ThemeChromeDefaults {
  header?: ThemeHeaderChrome;
  footer?: ThemeFooterChrome;
}

export interface TextComponentStyle {
  fontFace?: string;
  fontSize?: number;
  color: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "mid" | "bottom";
  lineSpacingMultiple?: number;
  paragraphSpacing?: number;
}

export interface ListComponentStyle {
  fontFace?: string;
  fontSize?: number;
  color: string;
  bulletCharacter: string;
  bulletColor: string;
  indent: number;
  lineSpacingMultiple?: number;
  paragraphSpacing?: number;
}

export interface TableComponentStyle {
  headerBackground: string;
  headerText: string;
  rowAlternate: string;
  borderColor: string;
  textColor?: string;
  fontFace?: string;
  fontSize?: number;
}

export interface ChartComponentStyle {
  seriesPalette?: string[];
  axisLabelColor: string;
  gridColor: string;
  dataLabelColor: string;
  titleColor: string;
  legendColor: string;
  labelFontSize?: number;
  dataLabelFontSize?: number;
}

export interface ImageComponentStyle {
  frameFillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  captionColor: string;
  captionFontFace?: string;
  captionFontSize?: number;
  shadow?: boolean;
}

export interface StatCalloutComponentStyle {
  fillColor: string;
  borderColor: string;
  valueColor: string;
  labelColor: string;
  trendColor?: string;
  accentLineColor?: string;
  shadow?: boolean;
}

export interface IconGridComponentStyle {
  cardFillColor: string;
  cardBorderColor: string;
  titleColor: string;
  descriptionColor: string;
}

export interface FlowchartComponentStyle {
  stepFillColor: string;
  stepBorderColor: string;
  stepTextColor: string;
  edgeColor: string;
  labelColor: string;
}

export interface NetworkComponentStyle {
  nodeFillColor: string;
  nodeBorderColor: string;
  nodeTextColor: string;
  edgeColor: string;
  labelColor: string;
}

export interface TwoColumnComponentStyle {
  gap: number;
  columnFillColor?: string;
  columnBorderColor?: string;
}

export interface PresetSurfaceComponentStyle {
  shape?: "rectangle" | "rounded-rectangle";
  fillColor: string;
  borderColor?: string;
  borderWidth?: number;
  rectRadius?: number;
}

export interface ThemeDefinition {
  name: string;
  version: "2.0";
  colors: Record<string, string>;
  typography: {
    fonts: {
      title: string;
      heading: string;
      body: string;
      caption: string;
    };
    sizes: {
      title: number;
      heading: number;
      subheading: number;
      body: number;
      caption: number;
      statValue: number;
    };
    weights: {
      bold: boolean;
      normal: boolean;
    };
  };
  layout: {
    slideSize: SlideSize;
    margins: {
      default: number;
      titleSlide: number;
    };
    spacing: {
      elementGap: number;
      paragraphSpacing: number;
    };
    grid: {
      columns: number;
      gutter: number;
    };
  };
  logo?: {
    source: string;
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    size: [number, number];
    margin: number;
  };
  defaults: {
    titleSlide: {
      background: string;
      titleColor: string;
      subtitleColor: string;
    };
    contentSlide: {
      background: string;
      titleColor: string;
      titleFrame: ThemeFrame;
      bodyFrame: ThemeFrame;
    };
    bulletStyle: {
      character: string;
      color: string;
      indent: number;
    };
    tableStyle: {
      headerBackground: string;
      headerText: string;
      rowAlternate: string;
      borderColor: string;
    };
  };
  components: {
    text: NamedComponentStyles<TextComponentStyle>;
    list: NamedComponentStyles<ListComponentStyle>;
    table: NamedComponentStyles<TableComponentStyle>;
    chart: NamedComponentStyles<ChartComponentStyle>;
    image: NamedComponentStyles<ImageComponentStyle>;
    statCallout: NamedComponentStyles<StatCalloutComponentStyle>;
    iconGrid: NamedComponentStyles<IconGridComponentStyle>;
    flowchart: NamedComponentStyles<FlowchartComponentStyle>;
    network: NamedComponentStyles<NetworkComponentStyle>;
    twoColumn: NamedComponentStyles<TwoColumnComponentStyle>;
    preset: NamedComponentStyles<PresetSurfaceComponentStyle>;
  };
  chromeDefaults?: ThemeChromeDefaults;
  effects?: {
    cardShadow?: {
      type: "outer";
      blur: number;
      offset: number;
      color: string;
      opacity: number;
    };
    titleUnderline?: {
      enabled: boolean;
      color?: string;
      width?: number;
    };
  };
}
