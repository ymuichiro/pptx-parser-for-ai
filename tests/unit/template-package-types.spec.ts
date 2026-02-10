import { describe, expect, it } from "vitest";
import { parseImportedTemplatePackage } from "../../src/template-importer";
import type { ImportedTemplatePackage } from "../../src/template-importer";

function createTemplatePackage(overrides?: Partial<ImportedTemplatePackage>): ImportedTemplatePackage {
  const base: ImportedTemplatePackage = {
    template: {
      id: "acme",
      source: {
        file: "acme.potx",
        sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        importedAt: "2026-02-10T00:00:00.000Z"
      }
    },
    theme: {
      palette: {
        primary: "0B5FFF",
        secondary: "00A99D",
        accent: "FF6A00",
        "text-dark": "1A1A1A",
        "text-light": "FFFFFF",
        "background-light": "FAFAFA",
        "background-dark": "121212"
      },
      fonts: {
        title: "Noto Sans",
        heading: "Noto Sans",
        body: "Noto Sans JP",
        caption: "Noto Sans JP"
      },
      slideSize: "16:9"
    },
    layout: {
      kind: "title-body",
      placeholders: {
        title: {
          bounds: { x: 1, y: 0.3, w: 8, h: 0.8 },
          style: {
            fontFace: "Noto Sans",
            fontSizePt: 30,
            color: "text-dark"
          }
        },
        body: {
          bounds: { x: 1, y: 1.4, w: 8, h: 3.5 },
          style: {
            fontFace: "Noto Sans JP",
            fontSizePt: 18,
            color: "text-dark"
          }
        }
      }
    },
    background: {
      mode: "editable",
      color: "background-light",
      image: "assets/bg.png",
      objects: [
        {
          type: "shape",
          shape: "rect",
          x: 0,
          y: 0,
          w: 10,
          h: 0.5,
          fill: "primary"
        }
      ]
    },
    manifest: {
      warnings: [],
      unsupported: []
    }
  };

  return {
    ...base,
    ...overrides
  };
}

describe("parseImportedTemplatePackage", () => {
  it("accepts valid imported template package", () => {
    const parsed = parseImportedTemplatePackage(createTemplatePackage());
    expect(parsed.layout.kind).toBe("title-body");
    expect(parsed.background.image).toBe("assets/bg.png");
  });

  it("rejects traversal asset path", () => {
    const input = createTemplatePackage({
      background: {
        mode: "editable",
        image: "../secret.png",
        objects: []
      }
    });

    expect(() => parseImportedTemplatePackage(input)).toThrowError(/assets/i);
  });

  it("rejects absolute asset path on object image source", () => {
    const input = createTemplatePackage({
      background: {
        mode: "editable",
        objects: [
          {
            type: "image",
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            source: "/tmp/absolute.png"
          }
        ]
      }
    });

    expect(() => parseImportedTemplatePackage(input)).toThrowError(/assets/i);
  });
});
