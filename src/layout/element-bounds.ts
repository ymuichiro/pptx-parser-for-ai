import type { Bounds, ContentElement, CustomShapeElement } from "../types";

export const DEFAULT_BLANK_ELEMENT_BOUNDS: Bounds = {
  x: 0.8,
  y: 0.8,
  w: 8.4,
  h: 4.0
};

function cloneBounds(bounds: Bounds): Bounds {
  return {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h
  };
}

function isBounds(value: unknown): value is Bounds {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Bounds>;
  return (
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.w === "number" &&
    typeof candidate.h === "number"
  );
}

export function resolveElementBounds(element: ContentElement | CustomShapeElement, fallbackBounds: Bounds): Bounds {
  if (element.type === "custom-shape") {
    return cloneBounds(element.position);
  }

  if (isBounds(element.position)) {
    return cloneBounds(element.position);
  }

  if (element.type === "image" && isBounds(element.bounds)) {
    return cloneBounds(element.bounds);
  }

  return cloneBounds(fallbackBounds);
}
