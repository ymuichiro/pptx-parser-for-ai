import type { Bounds } from "../types";

export function areaOverlaps(a: Bounds, b: Bounds): boolean {
  const horizontalOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
  const verticalOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
  return horizontalOverlap && verticalOverlap;
}

export function isInsideBounds(target: Bounds, container: Bounds): boolean {
  return (
    target.x >= container.x &&
    target.y >= container.y &&
    target.x + target.w <= container.x + container.w &&
    target.y + target.h <= container.y + container.h
  );
}

export function clampBounds(target: Bounds, container: Bounds): Bounds {
  const x = Math.max(container.x, Math.min(target.x, container.x + container.w));
  const y = Math.max(container.y, Math.min(target.y, container.y + container.h));
  const w = Math.max(0.1, Math.min(target.w, container.w - (x - container.x)));
  const h = Math.max(0.1, Math.min(target.h, container.h - (y - container.y)));

  return { x, y, w, h };
}
