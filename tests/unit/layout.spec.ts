import { describe, expect, it } from "vitest";
import { LayoutEngine } from "../../src/layout";
import type { ContentElement } from "../../src/types";
import { testTheme } from "../helpers/theme";

describe("LayoutEngine", () => {
  it("creates deterministic two-column layout for mixed content", () => {
    const engine = new LayoutEngine(testTheme);
    const elements: ContentElement[] = [
      { type: "text", content: "hello" },
      { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" }
    ];

    const first = engine.calculateLayout(elements, "auto");
    const second = engine.calculateLayout(elements, "auto");

    expect(first).toEqual(second);
    expect(first.areas.length).toBe(2);
  });

  it("keeps all areas inside slide bounds", () => {
    const engine = new LayoutEngine(testTheme);
    const elements: ContentElement[] = Array.from({ length: 6 }).map((_, index) => ({
      type: "text",
      content: `item-${index}`
    }));
    const result = engine.calculateLayout(elements, "three-column");

    const bounds = engine.getSlideBounds();
    result.areas.forEach((area) => {
      expect(area.bounds.x).toBeGreaterThanOrEqual(bounds.x);
      expect(area.bounds.y).toBeGreaterThanOrEqual(bounds.y);
      expect(area.bounds.x + area.bounds.w).toBeLessThanOrEqual(bounds.w + bounds.x + 0.0001);
      expect(area.bounds.y + area.bounds.h).toBeLessThanOrEqual(bounds.h + bounds.y + 0.0001);
    });
  });

  it("selects three-column for stat-only auto layout", () => {
    const engine = new LayoutEngine(testTheme);
    const elements: ContentElement[] = [
      { type: "stat-callout", value: "1", label: "a" },
      { type: "stat-callout", value: "2", label: "b" },
      { type: "stat-callout", value: "3", label: "c" }
    ];

    const result = engine.calculateLayout(elements, "auto");
    expect(result.areas.length).toBe(3);
    const uniqueX = new Set(result.areas.map((area) => area.bounds.x.toFixed(2)));
    expect(uniqueX.size).toBeGreaterThan(1);
  });

  it("falls back to split distribution when one side is empty in two-column", () => {
    const engine = new LayoutEngine(testTheme);
    const elements: ContentElement[] = [
      { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" },
      { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" },
      { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" }
    ];

    const result = engine.calculateLayout(elements, "two-column");
    expect(result.areas.length).toBe(3);
    const left = result.areas.filter((area) => area.bounds.x < 4.5).length;
    const right = result.areas.filter((area) => area.bounds.x >= 4.5).length;
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });

  it("returns empty layout for empty input", () => {
    const engine = new LayoutEngine(testTheme);
    const result = engine.calculateLayout([], "auto");
    expect(result.areas).toHaveLength(0);
  });

  it("uses single-column when auto layout has only text", () => {
    const engine = new LayoutEngine(testTheme);
    const elements: ContentElement[] = [{ type: "text", content: "only-text" }];
    const result = engine.calculateLayout(elements, "auto");
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0]?.bounds.x).toBeCloseTo(testTheme.layout.margins.default, 1);
  });

  it("throws on unsupported layout type", () => {
    const engine = new LayoutEngine(testTheme);
    const elements: ContentElement[] = [{ type: "text", content: "x" }];
    expect(() => engine.calculateLayout(elements, "unsupported" as unknown as "auto")).toThrowError(/Unsupported layout/);
  });
});
