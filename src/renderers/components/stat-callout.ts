import type { Bounds, StatCalloutElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

export function renderStatCallout(
  slide: SlideAdapter,
  element: StatCalloutElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const style = resolver.resolveStatCalloutStyle(element.styleRef ?? "default");
  const fillToken = element.color ?? style.fillColor;
  const cardShadow = theme.effects?.cardShadow;
  const hasFill = fillToken !== undefined;
  const hasBorder = style.borderColor !== undefined;
  const hasShadow = (style.shadow ?? false) && cardShadow !== undefined;

  if (hasFill || hasBorder || hasShadow) {
    const shapeOptions: Record<string, unknown> = {
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h
    };

    if (hasFill) {
      shapeOptions.fill = { color: resolver.resolveColor(fillToken, "primary"), transparency: 8 };
    }

    if (hasBorder) {
      shapeOptions.line = { color: resolver.resolveColor(style.borderColor, "neutral-border"), width: 1 };
    }

    if (hasShadow) {
      shapeOptions.shadow = {
        type: "outer",
        color: resolver.resolveColor(cardShadow.color, "text-dark"),
        blur: cardShadow.blur,
        offset: cardShadow.offset,
        opacity: cardShadow.opacity
      };
    }

    slide.addShape("roundRect", shapeOptions);
  }

  if (style.accentLineColor !== undefined) {
    slide.addShape("line", {
      x: bounds.x + 0.06,
      y: bounds.y + 0.06,
      w: 0,
      h: Math.max(0.1, bounds.h - 0.12),
      line: {
        color: resolver.resolveColor(style.accentLineColor, "accent"),
        width: 1.5
      }
    });
  }

  slide.addText(element.value, {
    x: bounds.x,
    y: bounds.y + 0.12,
    w: bounds.w,
    h: bounds.h * 0.5,
    fontFace: theme.typography.fonts.title,
    fontSize: Math.min(theme.typography.sizes.statValue, 36),
    color: resolver.resolveColor(style.valueColor, "text-light"),
    bold: theme.typography.weights.bold,
    align: "center"
  });

  slide.addText([element.label, element.trend].filter(Boolean).join("  "), {
    x: bounds.x,
    y: bounds.y + bounds.h * 0.65,
    w: bounds.w,
    h: bounds.h * 0.25,
    fontFace: theme.typography.fonts.body,
    fontSize: theme.typography.sizes.caption,
    color: resolver.resolveColor(style.labelColor, "text-light"),
    align: "center"
  });
}
