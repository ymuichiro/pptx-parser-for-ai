import type { Bounds, TextElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

export function renderText(
  slide: SlideAdapter,
  element: TextElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const styleRef = element.styleRef ?? element.style ?? "body";
  const style = resolver.resolveTextStyle(styleRef);

  slide.addText(element.content, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontFace: element.fontFace ?? style.fontFace ?? theme.typography.fonts.body,
    fontSize: element.fontSize ?? style.fontSize ?? theme.typography.sizes.body,
    color: resolver.resolveColor(element.color ?? style.color, "text-dark"),
    bold: element.bold ?? style.bold ?? false,
    align: element.align ?? style.align ?? "left",
    valign: element.valign ?? style.valign ?? "top",
    margin: 0
  });
}
