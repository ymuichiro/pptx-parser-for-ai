import type { Bounds, BulletListElement, NumberedListElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

export function renderBulletList(
  slide: SlideAdapter,
  element: BulletListElement,
  bounds: Bounds,
  theme: ThemeDefinition
): void {
  const bulletCharMap: Record<string, string> = {
    default: theme.defaults.bulletStyle.character,
    pros: "✓",
    cons: "✗",
    checkmark: "✓"
  };

  const bulletType = element.style ?? "default";
  const lines: string[] = [];

  element.items.forEach((item) => {
    if (typeof item === "string") {
      lines.push(`${bulletCharMap[bulletType]} ${item}`);
      return;
    }

    lines.push(`${bulletCharMap[bulletType]} ${item.text}`);
    item.subItems?.forEach((subItem) => {
      lines.push(`   ${theme.defaults.bulletStyle.character} ${subItem}`);
    });
  });

  slide.addText(lines.join("\n"), {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontFace: theme.typography.fonts.body,
    fontSize: theme.typography.sizes.body,
    color: resolveThemeColor(theme, "text-dark", "text-dark"),
    breakLine: false,
    margin: 0,
    valign: "top"
  });
}

export function renderNumberedList(
  slide: SlideAdapter,
  element: NumberedListElement,
  bounds: Bounds,
  theme: ThemeDefinition
): void {
  const lines = element.items.map((item, index) => `${index + 1}. ${item}`);

  slide.addText(lines.join("\n"), {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontFace: theme.typography.fonts.body,
    fontSize: theme.typography.sizes.body,
    color: resolveThemeColor(theme, "text-dark", "text-dark"),
    breakLine: false,
    margin: 0,
    valign: "top"
  });
}
