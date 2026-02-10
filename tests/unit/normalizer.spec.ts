import { describe, expect, it } from "vitest";
import { DSLNormalizer } from "../../src/parser/normalizer";
import type { PresentationDSL } from "../../src/types";

describe("DSLNormalizer", () => {
  it("fills defaults for all supported slide and element variants", () => {
    const normalizer = new DSLNormalizer();

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: {
        title: "normalize"
      },
      slides: [
        {
          type: "title",
          content: {
            title: "title"
          }
        },
        {
          type: "content",
          title: "content",
          content: [
            { type: "text", content: "text" },
            { type: "bullet-list", items: ["a"] },
            { type: "image", source: "data:image/png;base64,AA==" },
            { type: "table", headers: ["H"], rows: [[1]] },
            {
              type: "chart",
              chartType: "bar",
              data: {
                labels: ["Q1"],
                series: [{ name: "S", values: [1] }]
              }
            },
            {
              type: "network-diagram",
              layout: "circular",
              nodes: [{ id: "n", label: "N" }],
              edges: []
            },
            {
              type: "flowchart",
              direction: "horizontal",
              steps: [{ id: "s", label: "S" }],
              flows: []
            },
            {
              type: "two-column",
              left: [{ type: "text", content: "left" }],
              right: [{ type: "text", content: "right" }]
            }
          ]
        },
        {
          type: "section",
          title: "section"
        },
        {
          type: "blank",
          elements: [
            { type: "text", content: "blank" },
            {
              type: "custom-shape",
              shape: "rectangle",
              position: { x: 1, y: 1, w: 1, h: 1 }
            }
          ]
        }
      ]
    };

    const normalized = normalizer.normalize(dsl);

    const titleSlide = normalized.slides[0];
    if (titleSlide?.type !== "title") {
      throw new Error("expected title slide");
    }
    expect(titleSlide.background).toBe("light");
    expect(titleSlide.content.logo).toBe(false);

    const contentSlide = normalized.slides[1];
    if (contentSlide?.type !== "content") {
      throw new Error("expected content slide");
    }
    expect(contentSlide.layout).toBe("auto");

    const twoColumn = contentSlide.content.find((element) => element.type === "two-column");
    if (twoColumn?.type !== "two-column") {
      throw new Error("expected two-column");
    }
    expect(twoColumn.ratio).toBe("1:1");

    const sectionSlide = normalized.slides[2];
    if (sectionSlide?.type !== "section") {
      throw new Error("expected section slide");
    }
    expect(sectionSlide.background?.color).toBe("primary");

    const blankSlide = normalized.slides[3];
    if (blankSlide?.type !== "blank") {
      throw new Error("expected blank slide");
    }
    expect(blankSlide.background).toBe("light");
  });
});
