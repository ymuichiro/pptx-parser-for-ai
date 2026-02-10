import type { ContentElement } from "./dsl";

export type LayoutType = "auto" | "single-column" | "two-column" | "three-column";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementArea {
  element: ContentElement;
  bounds: Bounds;
}

export interface LayoutResult {
  areas: ElementArea[];
}
