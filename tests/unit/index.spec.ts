import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { PPTXRenderer } from "../../src";
import type { PresentationDSL, ThemeDefinition } from "../../src/types";
import { testTheme } from "../helpers/theme";

function createDSL(theme: string | ThemeDefinition): PresentationDSL {
  return {
    version: "1.0",
    theme,
    metadata: {
      title: "index"
    },
    slides: [
      {
        type: "content",
        title: "slide",
        content: [{ type: "text", content: "body" }]
      }
    ]
  };
}

describe("PPTXRenderer index", () => {
  it("generates with 4:3 theme layout", async () => {
    const renderer = new PPTXRenderer();
    const theme4by3: ThemeDefinition = {
      ...testTheme,
      layout: {
        ...testTheme.layout,
        slideSize: "4:3"
      }
    };

    const output = path.resolve(process.cwd(), ".tmp", "index", "4by3.pptx");
    const result = await renderer.generate(createDSL(theme4by3), output);
    expect(result.success).toBe(true);
  });

  it("generates with 16:10 custom layout and qa enabled", async () => {
    const renderer = new PPTXRenderer({
      enableQA: true,
      qaConfig: {
        autoFix: true,
        maxIterations: 2
      }
    });

    const theme16by10: ThemeDefinition = {
      ...testTheme,
      layout: {
        ...testTheme.layout,
        slideSize: "16:10"
      }
    };

    const output = path.resolve(process.cwd(), ".tmp", "index", "16by10.pptx");
    const result = await renderer.generate(createDSL(theme16by10), output);
    expect(result.success).toBe(true);
    expect(result.qaResult?.hasIssues ?? false).toBe(false);
  });

  it("throws validation error for invalid dsl", async () => {
    const renderer = new PPTXRenderer();
    const output = path.resolve(process.cwd(), ".tmp", "index", "invalid.pptx");

    await expect(
      renderer.generate(
        {
          version: "1.0",
          theme: "corporate-blue",
          metadata: { title: "invalid" },
          slides: []
        },
        output
      )
    ).rejects.toThrowError(/Array must contain at least 1 element/);
  });
});
