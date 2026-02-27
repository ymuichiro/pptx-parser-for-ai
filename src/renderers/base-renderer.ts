import type { Bounds, ThemeDefinition } from "../types";

export interface SlideAdapter {
  addText(text: string | Array<{ text: string; options?: Record<string, unknown> }>, options?: Record<string, unknown>): void;
  addShape(shapeName: string, options: Record<string, unknown>): void;
  addImage(options: Record<string, unknown>): void;
  addTable(rows: Array<Array<string | number>>, options: Record<string, unknown>): void;
  addChart(chartType: string, data: Array<Record<string, unknown>>, options: Record<string, unknown>): void;
}

export interface ComponentRenderContext {
  renderElement: (
    slide: SlideAdapter,
    element: unknown,
    bounds: Bounds,
    theme: ThemeDefinition
  ) => Promise<void>;
}
