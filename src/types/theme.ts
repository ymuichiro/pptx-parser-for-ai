export type SlideSize = "16:9" | "16:10" | "4:3";

export interface ThemeDefinition {
  name: string;
  version: string;
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
    };
  };
}
