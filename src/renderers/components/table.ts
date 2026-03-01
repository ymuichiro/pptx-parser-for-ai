import type { Bounds, TableElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

export function renderTable(
  slide: SlideAdapter,
  element: TableElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const rows: Array<Array<string | number>> = [element.headers, ...element.rows];
  const style = resolver.resolveTableStyle(element.styleRef ?? element.style ?? "default");

  slide.addTable(rows, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    border: {
      color: resolver.resolveColor(style.borderColor, "neutral-border"),
      pt: 1
    },
    fontFace: style.fontFace ?? theme.typography.fonts.body,
    fontSize: style.fontSize ?? theme.typography.sizes.body,
    color: resolver.resolveColor(style.textColor ?? "text-dark", "text-dark"),
    fill: resolver.resolveColor(style.rowAlternate, "surface")
  });
}
