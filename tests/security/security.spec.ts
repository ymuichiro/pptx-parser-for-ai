import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DSLParser } from "../../src/parser";
import { ThemeLoader } from "../../src/theme/loader";

const fixture = (relativePath: string) => path.resolve(process.cwd(), "tests", "fixtures", relativePath);

describe("Security checks", () => {
  it("rejects image path traversal", async () => {
    const parser = new DSLParser();
    const content = await fs.readFile(fixture("security/path-traversal-image.yaml"), "utf-8");

    expect(() => parser.parse(content)).toThrowError(/path traversal/i);
  });

  it("rejects remote image by default", async () => {
    const parser = new DSLParser();
    const content = await fs.readFile(fixture("security/remote-image.yaml"), "utf-8");

    expect(() => parser.parse(content)).toThrowError(/remote URL/i);
  });

  it("rejects theme path outside allowlist", async () => {
    const loader = new ThemeLoader({
      themeDir: path.resolve(process.cwd(), "themes"),
      allowedRoots: [path.resolve(process.cwd(), "themes")]
    });

    await expect(loader.load("../hack.yaml")).rejects.toThrow();
  });

  it("fails closed for malformed dsl", () => {
    const parser = new DSLParser();
    const malformed = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "x" },
      slides: [{ type: "content", title: "s", content: [{ type: "text" }] }]
    };

    const result = parser.validate(malformed);
    expect(result.isValid).toBe(false);
  });
});
