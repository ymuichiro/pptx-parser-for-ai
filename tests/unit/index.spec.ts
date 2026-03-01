import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import { PPTXRenderer } from "../../src";
import type { ImportedTemplatePackage } from "../../src/template-importer";
import type { PresentationDSL, ThemeDefinition } from "../../src/types";
import { testTheme } from "../helpers/theme";

function createDSL(theme: string | ThemeDefinition): PresentationDSL {
  return {
    version: "2.0",
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
          version: "2.0",
          theme: "corporate-blue",
          metadata: { title: "invalid" },
          slides: []
        },
        output
      )
    ).rejects.toThrowError(/Array must contain at least 1 element/);
  });

  it("applies imported template package from object options", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-template-object-"));
    const assetsDir = path.join(tempRoot, "assets");
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(path.join(assetsDir, "bg.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const templatePackage: ImportedTemplatePackage = {
      template: {
        id: "obj-template",
        source: {
          file: "obj-template.potx",
          sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
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
            bounds: { x: 1.0, y: 0.3, w: 8.0, h: 0.8 },
            style: { fontFace: "Noto Sans", fontSizePt: 28, color: "text-dark" }
          },
          body: {
            bounds: { x: 1.0, y: 1.4, w: 8.0, h: 3.6 },
            style: { fontFace: "Noto Sans JP", fontSizePt: 18, color: "text-dark" }
          }
        }
      },
      background: {
        mode: "editable",
        image: "assets/bg.png",
        objects: []
      },
      manifest: {
        warnings: [],
        unsupported: []
      }
    };

    const renderer = new PPTXRenderer({
      templatePackage,
      templateAssetBaseDir: tempRoot
    });

    const output = path.resolve(process.cwd(), ".tmp", "index", "template-object.pptx");
    const result = await renderer.generate(createDSL(testTheme), output);
    expect(result.success).toBe(true);
  });

  it("loads imported template package from YAML path", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-template-path-"));
    const assetsDir = path.join(tempRoot, "assets");
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(path.join(assetsDir, "bg.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const templatePackage: ImportedTemplatePackage = {
      template: {
        id: "path-template",
        source: {
          file: "path-template.potx",
          sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          importedAt: "2026-02-10T00:00:00.000Z"
        }
      },
      theme: {
        palette: {
          primary: "1144AA",
          secondary: "6688CC",
          accent: "FF6A00",
          "text-dark": "202020",
          "text-light": "FFFFFF",
          "background-light": "FAFAFA",
          "background-dark": "111111"
        },
        fonts: {
          title: "Noto Sans",
          heading: "Noto Sans",
          body: "Noto Sans JP",
          caption: "Noto Sans JP"
        },
        slideSize: "4:3"
      },
      layout: {
        kind: "title-body",
        placeholders: {
          title: {
            bounds: { x: 0.8, y: 0.3, w: 8.4, h: 0.7 },
            style: { fontFace: "Noto Sans", fontSizePt: 26, color: "text-dark" }
          },
          body: {
            bounds: { x: 0.8, y: 1.4, w: 8.4, h: 4.2 },
            style: { fontFace: "Noto Sans JP", fontSizePt: 16, color: "text-dark" }
          }
        }
      },
      background: {
        mode: "editable",
        color: "background-light",
        objects: []
      },
      manifest: {
        warnings: [],
        unsupported: []
      }
    };

    const templateYamlPath = path.join(tempRoot, "template.yaml");
    await fs.writeFile(templateYamlPath, yaml.dump(templatePackage, { noRefs: true }), "utf-8");

    const renderer = new PPTXRenderer({
      templatePackagePath: templateYamlPath
    });

    const output = path.resolve(process.cwd(), ".tmp", "index", "template-path.pptx");
    const result = await renderer.generate(createDSL(testTheme), output);
    expect(result.success).toBe(true);

    const outputSecond = path.resolve(process.cwd(), ".tmp", "index", "template-path-second.pptx");
    const resultSecond = await renderer.generate(createDSL(testTheme), outputSecond);
    expect(resultSecond.success).toBe(true);
  });

  it("rejects invalid template renderer options", () => {
    expect(
      () =>
        new PPTXRenderer({
          templatePackage: {
            template: {
              id: "bad",
              source: {
                file: "x.potx",
                sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
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
                title: { bounds: { x: 1, y: 0.3, w: 8, h: 0.7 }, style: { fontFace: "Noto Sans" } },
                body: { bounds: { x: 1, y: 1.4, w: 8, h: 3.5 }, style: { fontFace: "Noto Sans JP" } }
              }
            },
            background: {
              mode: "editable",
              image: "../traversal.png",
              objects: []
            },
            manifest: {
              warnings: [],
              unsupported: []
            }
          },
          templatePackagePath: "template.yaml"
        })
    ).toThrowError(/cannot be used together/i);

    expect(
      () =>
        new PPTXRenderer({
          templatePackage: {
            template: {
              id: "bad2",
              source: {
                file: "x.potx",
                sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
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
                title: { bounds: { x: 1, y: 0.3, w: 8, h: 0.7 }, style: { fontFace: "Noto Sans" } },
                body: { bounds: { x: 1, y: 1.4, w: 8, h: 3.5 }, style: { fontFace: "Noto Sans JP" } }
              }
            },
            background: {
              mode: "editable",
              image: "../traversal.png",
              objects: []
            },
            manifest: {
              warnings: [],
              unsupported: []
            }
          }
        })
    ).toThrowError(/invalid/i);
  });

  it("throws parse error for malformed template package YAML", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-template-malformed-"));
    const templateYamlPath = path.join(tempRoot, "template.yaml");
    await fs.writeFile(templateYamlPath, "template: [", "utf-8");

    const renderer = new PPTXRenderer({
      templatePackagePath: templateYamlPath
    });

    const output = path.resolve(process.cwd(), ".tmp", "index", "template-malformed.pptx");
    await expect(renderer.generate(createDSL(testTheme), output)).rejects.toThrowError(/parse template package yaml/i);
  });

  it("throws validation error for invalid template package structure", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-template-invalid-"));
    const templateYamlPath = path.join(tempRoot, "template.yaml");
    await fs.writeFile(
      templateYamlPath,
      yaml.dump({
        template: {
          id: "broken"
        }
      }),
      "utf-8"
    );

    const renderer = new PPTXRenderer({
      templatePackagePath: templateYamlPath
    });

    const output = path.resolve(process.cwd(), ".tmp", "index", "template-invalid.pptx");
    await expect(renderer.generate(createDSL(testTheme), output)).rejects.toThrowError(/validation failed/i);
  });

  it("throws io error when template package path cannot be read", async () => {
    const renderer = new PPTXRenderer({
      templatePackagePath: path.resolve(process.cwd(), ".tmp", "index", "missing-template.yaml")
    });

    const output = path.resolve(process.cwd(), ".tmp", "index", "template-missing.pptx");
    await expect(renderer.generate(createDSL(testTheme), output)).rejects.toThrowError(/Failed to read template package/i);
  });

  it("retries generation when QA auto-fix reports issues", async () => {
    const renderer = new PPTXRenderer({
      enableQA: true,
      qaConfig: {
        autoFix: true,
        maxIterations: 3
      }
    });

    const qa = (renderer as unknown as { qa: {
      validate: (outputPath: string, dsl: PresentationDSL, theme: ThemeDefinition) => Promise<{ hasIssues: boolean; issues: Array<{ code: string; message: string }> }>;
      fix: (dsl: PresentationDSL) => PresentationDSL;
    } }).qa;

    let validationCount = 0;
    qa.validate = async () => {
      validationCount += 1;
      if (validationCount === 1) {
        return {
          hasIssues: true,
          issues: [{ code: "ALIGNMENT", message: "Needs fix" }]
        };
      }

      return {
        hasIssues: false,
        issues: []
      };
    };
    qa.fix = (dsl: PresentationDSL) => dsl;

    const output = path.resolve(process.cwd(), ".tmp", "index", "qa-retry.pptx");
    const result = await renderer.generate(createDSL(testTheme), output);

    expect(result.success).toBe(true);
    expect(validationCount).toBe(2);
  });

  it("removes temporary output file when writeAtomic fails", async () => {
    const renderer = new PPTXRenderer();
    const output = path.resolve(process.cwd(), ".tmp", "index", "write-failure.pptx");
    const base = output.slice(0, output.length - path.extname(output).length);

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(123456789);

    const presentation = {
      writeFile: async ({ fileName }: { fileName: string }) => {
        await fs.writeFile(fileName, "temp", "utf-8");
        throw new Error("write failed");
      }
    };

    const writeAtomic = (renderer as unknown as {
      writeAtomic: (pres: { writeFile: (arg: { fileName: string }) => Promise<void> }, outputPath: string) => Promise<void>;
    }).writeAtomic.bind(renderer);

    await expect(writeAtomic(presentation, output)).rejects.toThrowError(/Failed to write presentation/i);

    const tempPath = `${base}.123456789.${process.pid}.tmp.pptx`;
    await expect(fs.stat(tempPath)).rejects.toThrowError();
    nowSpy.mockRestore();
  });
});
