import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { QAEngine } from "../../src/qa";
import type { PresentationDSL } from "../../src/types";
import { testTheme } from "../helpers/theme";

const dsl: PresentationDSL = {
  version: "2.0",
  theme: "corporate-blue",
  metadata: { title: "qa" },
  slides: [
    {
      type: "content",
      title: "slide",
      content: [{ type: "text", content: "body" }]
    }
  ]
};

describe("QAEngine", () => {
  it("returns issue when output file is missing", async () => {
    const qa = new QAEngine();
    const missingPath = path.resolve(process.cwd(), ".tmp", "qa", "missing.pptx");
    const result = await qa.validate(missingPath, dsl, testTheme);

    expect(result.hasIssues).toBe(true);
    expect(result.issues.some((issue) => issue.code === "OUTPUT_NOT_FOUND")).toBe(true);
  });

  it("passes when output file exists", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "dummy.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const result = await qa.validate(outputPath, dsl, testTheme);
    expect(result.hasIssues).toBe(false);
  });

  it("detects out-of-bounds elements on blank slide", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "blank-oob.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const result = await qa.validate(
      outputPath,
      {
        version: "2.0",
        theme: "corporate-blue",
        metadata: { title: "blank-oob" },
        slides: [
          {
            type: "blank",
            elements: [
              {
                type: "text",
                content: "overflow",
                position: { x: 9.6, y: 1.2, w: 1.0, h: 0.8 }
              }
            ]
          }
        ]
      },
      testTheme
    );

    expect(result.hasIssues).toBe(true);
    expect(result.issues.some((issue) => issue.code === "OUT_OF_BOUNDS")).toBe(true);
  });

  it("ignores decorative shapes when checking overlap on blank slide", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "blank-decorative.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const result = await qa.validate(
      outputPath,
      {
        version: "2.0",
        theme: "corporate-blue",
        metadata: { title: "blank-decorative" },
        slides: [
          {
            type: "blank",
            elements: [
              {
                type: "custom-shape",
                shape: "rectangle",
                position: { x: 0.8, y: 1.0, w: 8.4, h: 2.0 },
                fill: "DEE2E6"
              },
              {
                type: "text",
                content: "foreground",
                position: { x: 1.0, y: 1.4, w: 3.0, h: 1.2 }
              }
            ]
          }
        ]
      },
      testTheme
    );

    expect(result.issues.some((issue) => issue.code === "EXCESSIVE_OVERLAP")).toBe(false);
  });

  it("reports excessive overlap for non-decorative elements", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "blank-overlap.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const result = await qa.validate(
      outputPath,
      {
        version: "2.0",
        theme: "corporate-blue",
        metadata: { title: "blank-overlap" },
        slides: [
          {
            type: "blank",
            elements: [
              {
                type: "text",
                content: "A",
                position: { x: 1.0, y: 1.2, w: 4.0, h: 2.0 }
              },
              {
                type: "text",
                content: "B",
                position: { x: 2.0, y: 1.4, w: 4.0, h: 2.0 }
              }
            ]
          }
        ]
      },
      testTheme
    );

    expect(result.hasIssues).toBe(true);
    expect(result.issues.some((issue) => issue.code === "EXCESSIVE_OVERLAP")).toBe(true);
  });

  it("reports LOW_CONTRAST_TEXT for weak contrast text", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "low-contrast.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const lowContrastTheme = {
      ...testTheme,
      colors: {
        ...testTheme.colors,
        "text-dark": "F8F9FA"
      }
    };

    const result = await qa.validate(
      outputPath,
      {
        version: "2.0",
        theme: "corporate-blue",
        metadata: { title: "low-contrast" },
        slides: [
          {
            type: "content",
            title: "contrast",
            content: [{ type: "text", content: "Hard to read", styleRef: "body" }]
          }
        ]
      },
      lowContrastTheme
    );

    expect(result.issues.some((issue) => issue.code === "LOW_CONTRAST_TEXT")).toBe(true);
  });

  it("reports MISSING_THEME_TOKEN when required token is absent", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "missing-token.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const missingTokenTheme = structuredClone(testTheme);
    delete (missingTokenTheme.colors as Record<string, string>)["surface"];

    const result = await qa.validate(outputPath, dsl, missingTokenTheme);
    expect(result.issues.some((issue) => issue.code === "MISSING_THEME_TOKEN")).toBe(true);
  });

  it("reports STYLE_REF_NOT_FOUND when styleRef is undefined in theme", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "style-ref-missing.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const result = await qa.validate(
      outputPath,
      {
        version: "2.0",
        theme: "corporate-blue",
        metadata: { title: "style-ref" },
        slides: [
          {
            type: "content",
            title: "style-ref",
            content: [{ type: "text", content: "body", styleRef: "unknown-style" }]
          }
        ]
      },
      testTheme
    );

    expect(result.issues.some((issue) => issue.code === "STYLE_REF_NOT_FOUND")).toBe(true);
  });

  it("reports PRESET_SLOT_STYLE_MISMATCH when slot style is missing for component", async () => {
    const qa = new QAEngine();
    const outputPath = path.resolve(process.cwd(), ".tmp", "qa", "preset-style-mismatch.pptx");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from("ok"));

    const themeWithoutColumn = structuredClone(testTheme);
    delete (themeWithoutColumn.components.text.styles as Record<string, unknown>).column;

    const result = await qa.validate(
      outputPath,
      {
        version: "2.0",
        theme: "corporate-blue",
        metadata: { title: "preset-style" },
        slides: [
          {
            type: "content",
            preset: "compare-3col",
            title: "preset",
            content: [{ type: "text", content: "left", slot: "left" }]
          }
        ]
      },
      themeWithoutColumn
    );

    expect(result.issues.some((issue) => issue.code === "PRESET_SLOT_STYLE_MISMATCH")).toBe(true);
  });
});
