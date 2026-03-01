import type { ThemeDefinition } from "../../src/types";

export const testTheme: ThemeDefinition = {
  name: "Test Theme",
  version: "2.0",
  colors: {
    primary: "1E2761",
    secondary: "CADCFC",
    accent: "FF6B35",
    "text-dark": "2C2C2C",
    "text-light": "FFFFFF",
    "muted-text": "6B7280",
    "background-light": "F8F9FA",
    "background-dark": "1E2761",
    "neutral-border": "DEE2E6",
    surface: "FFFFFF",
    "surface-muted": "F3F4F6",
    "surface-strong": "E5E7EB",
    success: "10B981",
    warning: "F59E0B",
    error: "EF4444"
  },
  typography: {
    fonts: {
      title: "Noto Sans JP",
      heading: "Noto Sans JP",
      body: "Noto Sans JP",
      caption: "Noto Sans JP"
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
      titleColor: "text-dark",
      titleFrame: { x: 0.4, y: 0.24, w: 9.2, h: 0.56 },
      bodyFrame: { x: 0.4, y: 1.24, w: 9.2, h: 4.0 }
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
      borderColor: "neutral-border"
    }
  },
  components: {
    text: {
      defaultStyleRef: "body",
      styles: {
        title: { color: "text-light", fontFace: "Arial", fontSize: 40, bold: true, align: "center", valign: "mid" },
        heading: { color: "text-dark", fontFace: "Arial", fontSize: 24, bold: true },
        body: { color: "text-dark", fontFace: "Arial", fontSize: 14 },
        caption: { color: "muted-text", fontFace: "Arial", fontSize: 11 },
        default: { color: "text-dark", fontFace: "Arial", fontSize: 14 },
        card: { color: "text-dark", fontFace: "Arial", fontSize: 14 },
        column: { color: "text-dark", fontFace: "Arial", fontSize: 13 },
        summary: { color: "primary", fontFace: "Arial", fontSize: 12 },
        kpi: { color: "primary", fontFace: "Arial", fontSize: 18, bold: true },
        highlight: { color: "primary", fontFace: "Arial", fontSize: 13, bold: true }
      }
    },
    list: {
      defaultStyleRef: "default",
      styles: {
        default: { color: "text-dark", fontFace: "Arial", fontSize: 14, bulletCharacter: "•", bulletColor: "accent", indent: 0.3 },
        pros: { color: "text-dark", fontFace: "Arial", fontSize: 14, bulletCharacter: "✓", bulletColor: "success", indent: 0.3 },
        cons: { color: "text-dark", fontFace: "Arial", fontSize: 14, bulletCharacter: "✗", bulletColor: "error", indent: 0.3 },
        checkmark: { color: "text-dark", fontFace: "Arial", fontSize: 14, bulletCharacter: "✓", bulletColor: "accent", indent: 0.3 },
        card: { color: "text-dark", fontFace: "Arial", fontSize: 13, bulletCharacter: "•", bulletColor: "accent", indent: 0.25 },
        column: { color: "text-dark", fontFace: "Arial", fontSize: 12, bulletCharacter: "•", bulletColor: "primary", indent: 0.22 },
        summary: { color: "primary", fontFace: "Arial", fontSize: 12, bulletCharacter: "•", bulletColor: "accent", indent: 0.2 },
        kpi: { color: "primary", fontFace: "Arial", fontSize: 13, bulletCharacter: "•", bulletColor: "accent", indent: 0.2 },
        highlight: { color: "primary", fontFace: "Arial", fontSize: 13, bulletCharacter: "•", bulletColor: "accent", indent: 0.2 }
      }
    },
    table: {
      defaultStyleRef: "default",
      styles: {
        default: { headerBackground: "primary", headerText: "text-light", rowAlternate: "surface", borderColor: "neutral-border", textColor: "text-dark", fontFace: "Arial", fontSize: 12 },
        card: { headerBackground: "primary", headerText: "text-light", rowAlternate: "surface", borderColor: "neutral-border", textColor: "text-dark", fontFace: "Arial", fontSize: 11 },
        column: { headerBackground: "primary", headerText: "text-light", rowAlternate: "surface", borderColor: "neutral-border", textColor: "text-dark", fontFace: "Arial", fontSize: 11 },
        summary: { headerBackground: "surface-strong", headerText: "text-dark", rowAlternate: "surface-muted", borderColor: "neutral-border", textColor: "text-dark", fontFace: "Arial", fontSize: 11 },
        kpi: { headerBackground: "primary", headerText: "text-light", rowAlternate: "surface", borderColor: "accent", textColor: "text-dark", fontFace: "Arial", fontSize: 11 },
        highlight: { headerBackground: "accent", headerText: "text-light", rowAlternate: "surface", borderColor: "accent", textColor: "text-dark", fontFace: "Arial", fontSize: 11 }
      }
    },
    chart: {
      defaultStyleRef: "default",
      styles: {
        default: { axisLabelColor: "muted-text", gridColor: "neutral-border", dataLabelColor: "text-dark", titleColor: "text-dark", legendColor: "muted-text", seriesPalette: ["primary", "accent", "success"], labelFontSize: 11, dataLabelFontSize: 11 },
        card: { axisLabelColor: "muted-text", gridColor: "neutral-border", dataLabelColor: "text-dark", titleColor: "text-dark", legendColor: "muted-text", seriesPalette: ["primary", "accent", "success"], labelFontSize: 10, dataLabelFontSize: 10 },
        column: { axisLabelColor: "muted-text", gridColor: "neutral-border", dataLabelColor: "text-dark", titleColor: "primary", legendColor: "muted-text", seriesPalette: ["primary", "accent", "success"], labelFontSize: 10, dataLabelFontSize: 10 },
        summary: { axisLabelColor: "primary", gridColor: "neutral-border", dataLabelColor: "primary", titleColor: "primary", legendColor: "muted-text", seriesPalette: ["accent", "primary", "success"], labelFontSize: 10, dataLabelFontSize: 10 },
        kpi: { axisLabelColor: "muted-text", gridColor: "neutral-border", dataLabelColor: "primary", titleColor: "primary", legendColor: "muted-text", seriesPalette: ["accent", "primary", "success"], labelFontSize: 11, dataLabelFontSize: 12 },
        highlight: { axisLabelColor: "primary", gridColor: "neutral-border", dataLabelColor: "primary", titleColor: "primary", legendColor: "primary", seriesPalette: ["accent", "primary", "success"], labelFontSize: 10, dataLabelFontSize: 11 }
      }
    },
    image: {
      defaultStyleRef: "default",
      styles: {
        default: { frameFillColor: "surface", borderColor: "neutral-border", borderWidth: 0.8, captionColor: "muted-text", captionFontFace: "Arial", captionFontSize: 10, shadow: false },
        card: { frameFillColor: "surface", borderColor: "neutral-border", borderWidth: 1, captionColor: "muted-text", captionFontFace: "Arial", captionFontSize: 10, shadow: true },
        column: { frameFillColor: "surface", borderColor: "neutral-border", borderWidth: 1, captionColor: "muted-text", captionFontFace: "Arial", captionFontSize: 10, shadow: false },
        summary: { frameFillColor: "surface-muted", borderColor: "neutral-border", borderWidth: 0.8, captionColor: "primary", captionFontFace: "Arial", captionFontSize: 10, shadow: false },
        kpi: { frameFillColor: "surface", borderColor: "accent", borderWidth: 1.2, captionColor: "primary", captionFontFace: "Arial", captionFontSize: 10, shadow: true },
        highlight: { frameFillColor: "surface", borderColor: "accent", borderWidth: 1.2, captionColor: "primary", captionFontFace: "Arial", captionFontSize: 10, shadow: true }
      }
    },
    statCallout: {
      defaultStyleRef: "default",
      styles: {
        default: { fillColor: "primary", borderColor: "neutral-border", valueColor: "text-light", labelColor: "text-light", trendColor: "text-light", accentLineColor: "accent", shadow: true },
        card: { fillColor: "primary", borderColor: "neutral-border", valueColor: "text-light", labelColor: "text-light", trendColor: "text-light", accentLineColor: "accent", shadow: true },
        column: { fillColor: "primary", borderColor: "neutral-border", valueColor: "text-light", labelColor: "text-light", trendColor: "text-light", accentLineColor: "accent", shadow: false },
        summary: { fillColor: "surface-strong", borderColor: "neutral-border", valueColor: "primary", labelColor: "primary", trendColor: "primary", accentLineColor: "accent", shadow: false },
        kpi: { fillColor: "accent", borderColor: "accent", valueColor: "text-light", labelColor: "text-light", trendColor: "text-light", accentLineColor: "text-light", shadow: true },
        highlight: { fillColor: "surface-strong", borderColor: "accent", valueColor: "primary", labelColor: "primary", trendColor: "primary", accentLineColor: "accent", shadow: true },
        callout: { valueColor: "primary", labelColor: "primary", trendColor: "primary", shadow: false }
      }
    },
    iconGrid: {
      defaultStyleRef: "default",
      styles: {
        default: { cardFillColor: "surface", cardBorderColor: "neutral-border", titleColor: "text-dark", descriptionColor: "muted-text" },
        card: { cardFillColor: "surface", cardBorderColor: "neutral-border", titleColor: "text-dark", descriptionColor: "muted-text" },
        column: { cardFillColor: "surface", cardBorderColor: "neutral-border", titleColor: "text-dark", descriptionColor: "muted-text" },
        summary: { cardFillColor: "surface-muted", cardBorderColor: "neutral-border", titleColor: "primary", descriptionColor: "primary" },
        kpi: { cardFillColor: "surface", cardBorderColor: "accent", titleColor: "primary", descriptionColor: "primary" },
        highlight: { cardFillColor: "surface", cardBorderColor: "accent", titleColor: "primary", descriptionColor: "primary" }
      }
    },
    flowchart: {
      defaultStyleRef: "default",
      styles: {
        default: { stepFillColor: "surface", stepBorderColor: "primary", stepTextColor: "text-dark", edgeColor: "neutral-border", labelColor: "text-dark" },
        card: { stepFillColor: "surface", stepBorderColor: "primary", stepTextColor: "text-dark", edgeColor: "neutral-border", labelColor: "text-dark" },
        column: { stepFillColor: "surface", stepBorderColor: "neutral-border", stepTextColor: "text-dark", edgeColor: "neutral-border", labelColor: "text-dark" },
        summary: { stepFillColor: "surface-muted", stepBorderColor: "neutral-border", stepTextColor: "primary", edgeColor: "primary", labelColor: "primary" },
        kpi: { stepFillColor: "surface", stepBorderColor: "accent", stepTextColor: "primary", edgeColor: "accent", labelColor: "primary" },
        highlight: { stepFillColor: "surface", stepBorderColor: "accent", stepTextColor: "primary", edgeColor: "accent", labelColor: "primary" }
      }
    },
    network: {
      defaultStyleRef: "default",
      styles: {
        default: { nodeFillColor: "primary", nodeBorderColor: "neutral-border", nodeTextColor: "text-light", edgeColor: "neutral-border", labelColor: "text-dark" },
        card: { nodeFillColor: "primary", nodeBorderColor: "neutral-border", nodeTextColor: "text-light", edgeColor: "neutral-border", labelColor: "text-dark" },
        column: { nodeFillColor: "primary", nodeBorderColor: "neutral-border", nodeTextColor: "text-light", edgeColor: "neutral-border", labelColor: "text-dark" },
        summary: { nodeFillColor: "surface-strong", nodeBorderColor: "neutral-border", nodeTextColor: "primary", edgeColor: "primary", labelColor: "primary" },
        kpi: { nodeFillColor: "accent", nodeBorderColor: "accent", nodeTextColor: "text-light", edgeColor: "accent", labelColor: "primary" },
        highlight: { nodeFillColor: "surface-strong", nodeBorderColor: "accent", nodeTextColor: "primary", edgeColor: "accent", labelColor: "primary" }
      }
    },
    twoColumn: {
      defaultStyleRef: "default",
      styles: {
        default: { gap: 0.2, columnFillColor: "surface", columnBorderColor: "neutral-border" },
        card: { gap: 0.18, columnFillColor: "surface", columnBorderColor: "neutral-border" },
        column: { gap: 0.16, columnFillColor: "surface", columnBorderColor: "neutral-border" },
        summary: { gap: 0.2, columnFillColor: "surface-muted", columnBorderColor: "neutral-border" },
        kpi: { gap: 0.2, columnFillColor: "surface", columnBorderColor: "accent" },
        highlight: { gap: 0.2, columnFillColor: "surface", columnBorderColor: "accent" }
      }
    },
    preset: {
      defaultStyleRef: "card",
      styles: {
        card: { shape: "rounded-rectangle", fillColor: "surface", borderColor: "neutral-border", borderWidth: 0.8, rectRadius: 0.08 },
        column: { shape: "rounded-rectangle", fillColor: "surface", borderColor: "neutral-border", borderWidth: 0.8, rectRadius: 0.08 },
        "summary-strip": { shape: "rounded-rectangle", fillColor: "surface-muted", borderColor: "neutral-border", borderWidth: 0.8, rectRadius: 0.08 },
        "callout-panel": { shape: "rounded-rectangle", fillColor: "surface-strong", borderColor: "neutral-border", borderWidth: 0.8, rectRadius: 0.08 }
      }
    }
  },
  chromeDefaults: {
    header: {
      divider: {
        enabled: true,
        x: 0.4,
        y: 1.18,
        w: 9.2,
        color: "neutral-border",
        width: 0.8
      }
    },
    footer: {
      enabled: true,
      showSlideNumber: true,
      color: "muted-text",
      fontFace: "Noto Sans JP",
      fontSize: 10,
      divider: {
        enabled: true,
        x: 0.4,
        y: 5.42,
        w: 9.2,
        color: "neutral-border",
        width: 0.8
      }
    }
  },
  effects: {
    cardShadow: {
      type: "outer",
      blur: 6,
      offset: 2,
      color: "000000",
      opacity: 0.1
    },
    titleUnderline: {
      enabled: true,
      color: "accent",
      width: 1.2
    }
  }
};
