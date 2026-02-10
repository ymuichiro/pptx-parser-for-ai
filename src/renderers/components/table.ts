import type { Bounds, TableElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

export function renderTable(slide: SlideAdapter, element: TableElement, bounds: Bounds, theme: ThemeDefinition): void {
  const rows: Array<Array<string | number>> = [element.headers, ...element.rows];

  slide.addTable(rows, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    border: {
      color: resolveThemeColor(theme, theme.defaults.tableStyle.borderColor, "text-dark"),
      pt: 1
    },
    fontFace: theme.typography.fonts.body,
    fontSize: theme.typography.sizes.body,
    color: resolveThemeColor(theme, "text-dark", "text-dark"),
    fill: resolveThemeColor(theme, theme.defaults.tableStyle.rowAlternate, "background-light")
  });
}
