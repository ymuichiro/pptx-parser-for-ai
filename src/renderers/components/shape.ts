import type { Bounds, CustomShapeElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

const shapeMap: Record<CustomShapeElement["shape"], string> = {
  rectangle: "rect",
  circle: "ellipse",
  triangle: "triangle",
  arrow: "chevron"
};

export function renderCustomShape(
  slide: SlideAdapter,
  element: CustomShapeElement,
  fallbackBounds: Bounds,
  theme: ThemeDefinition
): void {
  const bounds = element.position ?? fallbackBounds;

  slide.addShape(shapeMap[element.shape], {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fill: {
      color: resolveThemeColor(theme, element.fill ?? "primary", "primary")
    },
    line: {
      color: resolveThemeColor(theme, element.border?.color ?? "text-dark", "text-dark"),
      width: element.border?.width ?? 1
    }
  });
}
