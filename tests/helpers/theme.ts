import type { ThemeDefinition } from "../../src/types";

export const testTheme: ThemeDefinition = {
  name: "Test Theme",
  version: "1.0",
  colors: {
    primary: "1E2761",
    secondary: "CADCFC",
    accent: "FF6B35",
    "text-dark": "2C2C2C",
    "text-light": "FFFFFF",
    "background-light": "F8F9FA",
    "background-dark": "1E2761",
    success: "10B981",
    warning: "F59E0B",
    error: "EF4444"
  },
  typography: {
    fonts: {
      title: "Arial",
      heading: "Arial",
      body: "Arial",
      caption: "Arial"
    },
    sizes: {
      title: 40,
      heading: 24,
      subheading: 18,
      body: 14,
      caption: 11,
      statValue: 48
    },
    weights: {
      bold: true,
      normal: false
    }
  },
  layout: {
    slideSize: "16:9",
    margins: {
      default: 0.5,
      titleSlide: 1
    },
    spacing: {
      elementGap: 0.25,
      paragraphSpacing: 0.1
    },
    grid: {
      columns: 12,
      gutter: 0.2
    }
  },
  defaults: {
    titleSlide: {
      background: "background-dark",
      titleColor: "text-light",
      subtitleColor: "secondary"
    },
    contentSlide: {
      background: "background-light",
      titleColor: "text-dark"
    },
    bulletStyle: {
      character: "•",
      color: "accent",
      indent: 0.3
    },
    tableStyle: {
      headerBackground: "primary",
      headerText: "text-light",
      rowAlternate: "background-light",
      borderColor: "text-dark"
    }
  }
};
