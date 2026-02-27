import type { Bounds, TextElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

export function renderText(slide: SlideAdapter, element: TextElement, bounds: Bounds, theme: ThemeDefinition): void {
  const fontMap: Record<string, string> = {
    title: theme.typography.fonts.title,
    heading: theme.typography.fonts.heading,
    body: theme.typography.fonts.body,
    caption: theme.typography.fonts.caption
  };

  const sizeMap: Record<string, number> = {
    title: theme.typography.sizes.title,
    heading: theme.typography.sizes.heading,
    body: theme.typography.sizes.body,
    caption: theme.typography.sizes.caption
  };

  const style = element.style ?? "body";

  slide.addText(element.content, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontFace: element.fontFace ?? fontMap[style],
    fontSize: element.fontSize ?? sizeMap[style],
    color: resolveThemeColor(theme, element.color ?? "text-dark", "text-dark"),
    bold: element.bold ?? false,
    align: element.align ?? "left",
    valign: element.valign ?? "top"
  });
}
