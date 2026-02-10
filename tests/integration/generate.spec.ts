import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { PPTXRenderer } from "../../src";

const fixture = (relativePath: string) => path.resolve(process.cwd(), "tests", "fixtures", relativePath);

describe("PPTXRenderer integration", () => {
  it("generates pptx from file", async () => {
    const renderer = new PPTXRenderer({
      enableQA: true,
      qaConfig: {
        autoFix: false,
        maxIterations: 2
      }
    });

    const outputPath = path.resolve(process.cwd(), ".tmp", "integration", "minimal.pptx");
    const result = await renderer.generateFromFile(fixture("valid/minimal.yaml"), outputPath);

    const stat = await fs.stat(outputPath);
    expect(result.success).toBe(true);
    expect(result.metadata.slideCount).toBe(2);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("generates pptx from object", async () => {
    const renderer = new PPTXRenderer();
    const outputPath = path.resolve(process.cwd(), ".tmp", "integration", "object.pptx");

    const result = await renderer.generate(
      {
        version: "1.0",
        theme: "corporate-blue",
        metadata: {
          title: "obj"
        },
        slides: [
          {
            type: "content",
            title: "content",
            content: [
              { type: "text", content: "hello" },
              {
                type: "chart",
                chartType: "bar",
                data: {
                  labels: ["A", "B"],
                  series: [{ name: "S", values: [10, 20], color: "primary" }]
                }
              }
            ]
          }
        ]
      },
      outputPath
    );

    expect(result.success).toBe(true);
    expect(result.metadata.slideCount).toBe(1);
  });
});
