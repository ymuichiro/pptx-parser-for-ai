import type { Bounds, StatCalloutElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

export function renderStatCallout(
  slide: SlideAdapter,
  element: StatCalloutElement,
  bounds: Bounds,
  theme: ThemeDefinition
): void {
  const baseColor = resolveThemeColor(theme, element.color ?? "primary", "primary");

  slide.addShape("roundRect", {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fill: { color: baseColor, transparency: 10 },
    line: { color: resolveThemeColor(theme, "text-dark", "text-dark"), width: 1 }
  });

  slide.addText(element.value, {
    x: bounds.x,
    y: bounds.y + 0.15,
    w: bounds.w,
    h: bounds.h * 0.5,
    fontFace: theme.typography.fonts.title,
    fontSize: Math.min(theme.typography.sizes.statValue, 36),
    color: resolveThemeColor(theme, "text-light", "text-light"),
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
    color: resolveThemeColor(theme, "text-light", "text-light"),
    align: "center"
  });
}
