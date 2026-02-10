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
});
