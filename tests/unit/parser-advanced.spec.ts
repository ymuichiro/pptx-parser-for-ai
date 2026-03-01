import { describe, expect, it } from "vitest";
import { DSLValidator } from "../../src/parser/validator";

describe("DSLValidator semantic checks", () => {
  it("detects table/chart/flowchart inconsistencies", () => {
    const validator = new DSLValidator({ allowRemoteImages: true });
    const dsl = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "semantic" },
      slides: [
        {
          type: "content",
          title: "bad",
          content: [
            {
              type: "table",
              headers: ["A", "B"],
              rows: [[1]]
            },
            {
              type: "chart",
              chartType: "bar",
              data: {
                labels: ["Q1", "Q2"],
                series: [{ name: "S", values: [1] }]
              }
            },
            {
              type: "flowchart",
              direction: "horizontal",
              steps: [{ id: "s", label: "start" }],
              flows: [{ from: "s", to: "x" }]
            }
          ]
        }
      ]
    };

    const result = validator.validate(dsl);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("column count mismatch"))).toBe(true);
    expect(result.errors.some((error) => error.includes("value count mismatch"))).toBe(true);
    expect(result.errors.some((error) => error.includes("unknown step"))).toBe(true);
  });

  it("validates two-column recursively", () => {
    const validator = new DSLValidator({ allowRemoteImages: true });
    const dsl = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "two-column" },
      slides: [
        {
          type: "content",
          title: "ok",
          content: [
            {
              type: "two-column",
              left: [{ type: "text", content: "a" }],
              right: [
                {
                  type: "network-diagram",
                  layout: "hierarchical",
                  nodes: [{ id: "n", label: "N" }],
                  edges: [{ from: "n", to: "n" }]
                }
              ],
              ratio: "1:1"
            }
          ]
        }
      ]
    };

    const result = validator.validate(dsl);
    expect(result.isValid).toBe(true);
  });

  it("detects preset slot violations", () => {
    const validator = new DSLValidator({ allowRemoteImages: true });
    const dsl = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "preset-invalid" },
      slides: [
        {
          type: "content",
          preset: "overview-2x2",
          title: "Preset",
          content: [
            { type: "text", content: "a", slot: "card1" },
            {
              type: "chart",
              chartType: "bar",
              slot: "card1",
              data: {
                labels: ["Q1"],
                series: [{ name: "S", values: [1] }]
              }
            },
            { type: "text", content: "x", slot: "missing-slot" }
          ]
        }
      ]
    };

    const result = validator.validate(dsl);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("duplicates slot"))).toBe(true);
    expect(result.errors.some((error) => error.includes("not allowed in slot"))).toBe(true);
    expect(result.errors.some((error) => error.includes("undefined slot"))).toBe(true);
  });

  it("accepts valid preset slot mapping", () => {
    const validator = new DSLValidator({ allowRemoteImages: true });
    const dsl = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "preset-valid" },
      slides: [
        {
          type: "content",
          preset: "compare-3col",
          title: "Preset",
          content: [
            { type: "text", content: "L", slot: "left" },
            { type: "bullet-list", items: ["C"], slot: "center" },
            { type: "numbered-list", items: ["R1"], slot: "right" },
            { type: "text", content: "Summary" }
          ]
        }
      ]
    };

    const result = validator.validate(dsl);
    expect(result.isValid).toBe(true);
  });
});
