import type { Bounds, IconGridElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

export function renderIconGrid(slide: SlideAdapter, element: IconGridElement, bounds: Bounds, theme: ThemeDefinition): void {
  const columns = Math.max(1, element.columns);
  const rows = Math.ceil(element.items.length / columns);
  const cellW = bounds.w / columns;
  const cellH = bounds.h / Math.max(1, rows);

  element.items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = bounds.x + col * cellW;
    const y = bounds.y + row * cellH;

    slide.addShape("roundRect", {
      x,
      y,
      w: cellW - 0.05,
      h: cellH - 0.05,
      fill: { color: resolveThemeColor(theme, "secondary", "secondary"), transparency: 10 },
      line: { color: resolveThemeColor(theme, "primary", "primary"), width: 1 }
    });

    slide.addText(`${item.icon} ${item.title}`, {
      x: x + 0.05,
      y: y + 0.05,
      w: cellW - 0.1,
      h: 0.25,
      fontFace: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.caption,
      bold: true,
      color: resolveThemeColor(theme, "text-dark", "text-dark")
    });

    if (item.description !== undefined) {
      slide.addText(item.description, {
        x: x + 0.05,
        y: y + 0.35,
        w: cellW - 0.1,
        h: cellH - 0.4,
        fontFace: theme.typography.fonts.body,
        fontSize: theme.typography.sizes.caption,
        color: resolveThemeColor(theme, "text-dark", "text-dark")
      });
    }
  });
}
