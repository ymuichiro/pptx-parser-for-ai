import * as path from "node:path";
import type { Bounds, IconGridElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

function hasTraversal(value: string): boolean {
  return path.posix.normalize(value.replace(/\\/g, "/")).split("/").includes("..");
}

function isIconImage(value: string): boolean {
  if (/^data:image\//i.test(value)) {
    return true;
  }

  if (/^https?:\/\//i.test(value)) {
    return false;
  }

  return /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(value) && !hasTraversal(value);
}

export function renderIconGrid(
  slide: SlideAdapter,
  element: IconGridElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const style = resolver.resolveIconGridStyle(element.styleRef ?? "default");
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
      fill: { color: resolver.resolveColor(style.cardFillColor, "surface"), transparency: 6 },
      line: { color: resolver.resolveColor(style.cardBorderColor, "neutral-border"), width: 1 }
    });

    const titleY = y + 0.05;
    const titleX = x + 0.05;
    const titleW = cellW - 0.1;
    const iconSize = Math.min(0.32, Math.max(0.18, Math.min(cellW * 0.18, cellH * 0.28)));
    const canRenderImageIcon = isIconImage(item.icon);

    if (canRenderImageIcon) {
      const imageOptions: Record<string, unknown> = {
        x: titleX,
        y: titleY,
        w: iconSize,
        h: iconSize
      };

      if (/^data:image\//i.test(item.icon)) {
        imageOptions.data = item.icon;
      } else {
        imageOptions.path = item.icon;
      }

      slide.addImage(imageOptions);
    }

    const titleText = canRenderImageIcon ? item.title : `${item.icon} ${item.title}`;
    const adjustedTitleX = canRenderImageIcon ? titleX + iconSize + 0.06 : titleX;
    const adjustedTitleW = canRenderImageIcon ? Math.max(0.2, titleW - iconSize - 0.06) : titleW;
    slide.addText(titleText, {
      x: adjustedTitleX,
      y: canRenderImageIcon ? titleY + 0.02 : titleY,
      w: adjustedTitleW,
      h: 0.25,
      fontFace: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.caption,
      bold: true,
      color: resolver.resolveColor(style.titleColor, "text-dark")
    });

    if (item.description !== undefined) {
      const descriptionY = canRenderImageIcon ? y + 0.05 + iconSize + 0.08 : y + 0.35;
      slide.addText(item.description, {
        x: x + 0.05,
        y: descriptionY,
        w: cellW - 0.1,
        h: Math.max(0.15, cellH - (descriptionY - y) - 0.07),
        fontFace: theme.typography.fonts.body,
        fontSize: theme.typography.sizes.caption,
        color: resolver.resolveColor(style.descriptionColor, "text-dark")
      });
    }
  });
}
