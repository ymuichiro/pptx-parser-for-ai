import type { Bounds, BulletListElement, NumberedListElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

const BULLET_CHAR_MAP: Record<string, string> = {
  default: "•",
  pros: "✓",
  cons: "✗",
  checkmark: "✓"
};

export function renderBulletList(
  slide: SlideAdapter,
  element: BulletListElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const styleRef = element.styleRef ?? element.style ?? "default";
  const style = resolver.resolveListStyle(styleRef);
  const bulletChar = BULLET_CHAR_MAP[element.style ?? "default"] ?? style.bulletCharacter;
  const indent = " ".repeat(Math.max(0, Math.round(style.indent * 4)));
  const lines: string[] = [];

  element.items.forEach((item) => {
    if (typeof item === "string") {
      lines.push(`${bulletChar} ${item}`);
      return;
    }

    lines.push(`${bulletChar} ${item.text}`);
    item.subItems?.forEach((subItem) => {
      lines.push(`${indent}${style.bulletCharacter} ${subItem}`);
    });
  });

  slide.addText(lines.join("\n"), {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontFace: style.fontFace ?? theme.typography.fonts.body,
    fontSize: style.fontSize ?? theme.typography.sizes.body,
    color: resolver.resolveColor(style.color, "text-dark"),
    breakLine: false,
    margin: 0,
    valign: "top"
  });
}

export function renderNumberedList(
  slide: SlideAdapter,
  element: NumberedListElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const style = resolver.resolveListStyle(element.styleRef ?? "default");
  const lines = element.items.map((item, index) => `${index + 1}. ${item}`);

  slide.addText(lines.join("\n"), {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontFace: style.fontFace ?? theme.typography.fonts.body,
    fontSize: style.fontSize ?? theme.typography.sizes.body,
    color: resolver.resolveColor(style.color, "text-dark"),
    breakLine: false,
    margin: 0,
    valign: "top"
  });
}
