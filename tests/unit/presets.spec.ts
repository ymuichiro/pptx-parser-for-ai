import { describe, expect, it } from "vitest";
import { PresetEngine, getPresetDefinition } from "../../src/presets";
import type { ContentElement } from "../../src/types";

describe("PresetEngine", () => {
  it("maps elements to explicit and default slots", () => {
    const engine = new PresetEngine();
    const elements: ContentElement[] = [
      { type: "text", content: "left", slot: "left" },
      { type: "text", content: "summary-a" },
      { type: "text", content: "summary-b" }
    ];

    const result = engine.calculateLayout(elements, "compare-3col");
    expect(result.areas).toHaveLength(3);
    expect(result.areas[0]?.bounds.x).toBeCloseTo(0.4, 2);
    expect(result.areas[1]?.bounds.y).toBeGreaterThanOrEqual(4.36);
    expect(result.areas[2]?.bounds.y).toBeGreaterThan(result.areas[1]?.bounds.y ?? 0);
  });

  it("includes preset decorations", () => {
    const definition = getPresetDefinition("overview-2x2");
    const engine = new PresetEngine();
    const result = engine.calculateLayout([{ type: "text", content: "a", slot: "card1" }], "overview-2x2");

    expect(result.decorations.length).toBe(definition?.decorations?.length ?? 0);
    expect(result.frame.w).toBeGreaterThan(0);
    expect(result.frame.h).toBeGreaterThan(0);
  });
});
