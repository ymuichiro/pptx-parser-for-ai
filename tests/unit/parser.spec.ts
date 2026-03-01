import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DSLParser } from "../../src/parser";
import type { PresentationDSL } from "../../src/types";

const fixture = (relativePath: string) => path.resolve(process.cwd(), "tests", "fixtures", relativePath);

describe("DSLParser", () => {
  it("parses a valid DSL", async () => {
    const parser = new DSLParser();
    const content = await fs.readFile(fixture("valid/minimal.yaml"), "utf-8");
    const parsed = parser.parse(content);

    expect(parsed.metadata.title).toBe("Minimal");
    expect(parsed.slides.length).toBe(2);
  });

  it("rejects unknown fields", async () => {
    const parser = new DSLParser();
    const content = await fs.readFile(fixture("invalid/unknown-field.yaml"), "utf-8");

    expect(() => parser.parse(content)).toThrowError(/unrecognized key/i);
  });

  it("rejects invalid edge references", async () => {
    const parser = new DSLParser();
    const content = await fs.readFile(fixture("invalid/invalid-edge.yaml"), "utf-8");
    const parsedYaml = parser.parse.bind(parser, content);

    expect(parsedYaml).toThrowError(/unknown node/i);
  });

  it("blocks remote image source by default", async () => {
    const parser = new DSLParser();
    const content = await fs.readFile(fixture("security/remote-image.yaml"), "utf-8");

    expect(() => parser.parse(content)).toThrowError(/remote URL is disabled/i);
  });

  it("allows remote image when explicitly enabled", async () => {
    const parser = new DSLParser({ allowRemoteImages: true });
    const content = await fs.readFile(fixture("security/remote-image.yaml"), "utf-8");

    expect(() => parser.parse(content)).not.toThrow();
  });

  it("normalizes defaults", async () => {
    const parser = new DSLParser();
    const raw: PresentationDSL = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "normalize" },
      slides: [
        {
          type: "content",
          title: "title",
          content: [{ type: "text", content: "hello" }]
        }
      ]
    };

    const result = parser.validate(raw);
    expect(result.isValid).toBe(true);

    const normalized = parser.normalize(raw);
    const slide = normalized.slides[0];
    if (slide?.type !== "content") {
      throw new Error("expected content slide");
    }

    expect(slide.layout).toBe("auto");
    const text = slide.content[0];
    if (text?.type !== "text") {
      throw new Error("expected text element");
    }
    expect(text.style).toBe("body");
    expect(text.align).toBe("left");
  });

  it("accepts chrome config and footer metadata fields", () => {
    const parser = new DSLParser();
    const raw: PresentationDSL = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: {
        title: "chrome",
        company: "Contoso",
        copyright: "Copyright (c) 2026 Contoso"
      },
      chrome: {
        header: {
          divider: {
            y: 1.2,
            color: "DDDDDD"
          }
        },
        footer: {
          leftText: "{company} | {copyright}",
          divider: {
            y: 5.42,
            color: "DDDDDD"
          }
        }
      },
      slides: [
        {
          type: "content",
          title: "x",
          content: [{ type: "text", content: "y" }]
        }
      ]
    };

    const result = parser.validate(raw);
    expect(result.isValid).toBe(true);

    const normalized = parser.normalize(raw);
    expect(normalized.chrome?.header?.divider?.enabled).toBe(true);
    expect(normalized.chrome?.footer?.enabled).toBe(true);
    expect(normalized.chrome?.footer?.showSlideNumber).toBe(true);
  });

  it("rejects overlong strings", () => {
    const parser = new DSLParser();
    const huge = "x".repeat(10_001);
    const result = parser.validate({
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: huge },
      slides: []
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("String length"))).toBe(true);
  });

  it("rejects unknown preset id", () => {
    const parser = new DSLParser();
    const result = parser.validate({
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "preset" },
      slides: [
        {
          type: "content",
          title: "x",
          preset: "unknown-preset",
          content: [{ type: "text", content: "y" }]
        }
      ]
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("preset"))).toBe(true);
  });

  it("rejects legacy DSL version 1.0", () => {
    const parser = new DSLParser();
    const result = parser.validate({
      version: "1.0",
      theme: "corporate-blue",
      metadata: { title: "legacy" },
      slides: [
        {
          type: "content",
          title: "x",
          content: [{ type: "text", content: "y" }]
        }
      ]
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.includes("version"))).toBe(true);
  });

  it("accepts custom-shape rectRadius for rounded rectangles", () => {
    const parser = new DSLParser();
    const result = parser.validate({
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "shape-radius" },
      slides: [
        {
          type: "blank",
          elements: [
            {
              type: "custom-shape",
              shape: "rounded-rectangle",
              position: { x: 1, y: 1, w: 2, h: 1 },
              rectRadius: 0.08
            }
          ]
        }
      ]
    });

    expect(result.isValid).toBe(true);
  });
});
