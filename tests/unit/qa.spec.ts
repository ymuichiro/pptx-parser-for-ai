import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { QAEngine } from "../../src/qa";
import type { PresentationDSL } from "../../src/types";
import { testTheme } from "../helpers/theme";

const dsl: PresentationDSL = {
  version: "1.0",
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
        version: "1.0",
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
        version: "1.0",
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
        version: "1.0",
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
});
