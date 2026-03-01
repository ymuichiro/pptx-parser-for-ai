import type { Bounds, CustomShapeElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

const shapeMap: Record<CustomShapeElement["shape"], string> = {
  rectangle: "rect",
  circle: "ellipse",
  triangle: "triangle",
  arrow: "chevron",
  "rounded-rectangle": "roundRect"
};

export function renderCustomShape(
  slide: SlideAdapter,
  element: CustomShapeElement,
  fallbackBounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const bounds = element.position ?? fallbackBounds;
  const options: Record<string, unknown> = {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fill: {
      color: resolver.resolveColor(element.fill ?? "primary", "primary")
    }
  };

  if (element.border !== undefined) {
    options.line = {
      color: resolver.resolveColor(element.border.color, "neutral-border"),
      width: element.border.width
    };
  }

  if (theme.effects?.cardShadow !== undefined) {
    options.shadow = {
      type: "outer",
      color: resolver.resolveColor(theme.effects.cardShadow.color, "text-dark"),
      blur: theme.effects.cardShadow.blur,
      offset: theme.effects.cardShadow.offset,
      opacity: theme.effects.cardShadow.opacity
    };
  }

  slide.addShape(shapeMap[element.shape], {
    ...options
  });
}
