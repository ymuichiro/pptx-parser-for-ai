import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { DSLParser } from "../../src/parser";
import type { ValidationResult } from "../../src/parser/validator";
import { LayoutEngine } from "../../src/layout";
import { renderContentElement } from "../../src/renderers/components";
import { renderImage } from "../../src/renderers/components/image";
import { SlideRenderer } from "../../src/renderers";
import { ThemeLoader } from "../../src/theme/loader";
import {
  PPTXRenderer,
  TemplateImportError,
  TemplateImporter,
  parseImportedTemplatePackage
} from "../../src";
import type {
  ContentElement,
  PresentationDSL,
  QAResult,
  ThemeDefinition
} from "../../src/types";
import type { ImportedTemplatePackage } from "../../src/template-importer";
import type { ComponentRenderContext, SlideAdapter } from "../../src/renderers";
import { MockPresentation, MockSlide } from "../helpers/mock-slide";
import { testTheme } from "../helpers/theme";

function fixture(relativePath: string): string {
  return path.resolve(process.cwd(), "tests", "fixtures", relativePath);
}

function createTempOutputPath(prefix: string, name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix)).then((dir) => path.join(dir, name));
}

function createContentDSL(content: ContentElement[]): PresentationDSL {
  return {
    version: "1.0",
    theme: "corporate-blue",
    metadata: {
      title: "Functional Requirement Test"
    },
    slides: [
      {
        type: "content",
        title: "Content",
        content
      }
    ]
  };
}

function createRendererWithPatchedSetup(
  renderer: PPTXRenderer,
  onTheme: (theme: ThemeDefinition) => void
): void {
  type SetupPresentationSignature = (
    presentation: unknown,
    dsl: PresentationDSL,
    theme: ThemeDefinition
  ) => void;

  type RendererWithSetup = {
    setupPresentation: SetupPresentationSignature;
  };

  const internal = renderer as unknown as RendererWithSetup;
  const originalSetup = internal.setupPresentation.bind(renderer as unknown as RendererWithSetup);

  internal.setupPresentation = (presentation, dsl, theme) => {
    onTheme(theme);
    originalSetup(presentation, dsl, theme);
  };
}

function createRenderContext(theme: ThemeDefinition): ComponentRenderContext {
  const context: ComponentRenderContext = {
    renderElement: async (slide, element, bounds) => {
      await renderContentElement(slide, element, bounds, theme, context);
    }
  };

  return context;
}

function createNestedObject(depth: number): unknown {
  const root: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = root;

  for (let index = 0; index < depth; index += 1) {
    const next: Record<string, unknown> = {};
    cursor["next"] = next;
    cursor = next;
  }

  return root;
}

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

function withSlideSize(templatePackage: ImportedTemplatePackage, slideSize: "16:9" | "16:10" | "4:3"): ImportedTemplatePackage {
  return {
    ...templatePackage,
    theme: {
      ...templatePackage.theme,
      slideSize
    }
  };
}

function presentationXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>',
    "</p:presentation>"
  ].join("\n");
}

function themeXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '  <a:themeElements>',
    '    <a:clrScheme name="Custom">',
    '      <a:dk1><a:srgbClr val="1A1A1A"/></a:dk1>',
    '      <a:lt1><a:srgbClr val="F9F9F9"/></a:lt1>',
    '      <a:accent1><a:srgbClr val="0B5FFF"/></a:accent1>',
    '      <a:accent2><a:srgbClr val="00A99D"/></a:accent2>',
    '      <a:accent3><a:srgbClr val="FF6A00"/></a:accent3>',
    '      <a:accent4><a:srgbClr val="6B46C1"/></a:accent4>',
    '      <a:accent5><a:srgbClr val="0EA5E9"/></a:accent5>',
    '      <a:accent6><a:srgbClr val="84CC16"/></a:accent6>',
    "    </a:clrScheme>",
    '    <a:fontScheme name="Custom Font">',
    '      <a:majorFont><a:latin typeface="Noto Sans"/></a:majorFont>',
    '      <a:minorFont><a:latin typeface="Noto Sans JP"/></a:minorFont>',
    "    </a:fontScheme>",
    "  </a:themeElements>",
    "</a:theme>"
  ].join("\n");
}

function layoutXml(includeBodyPlaceholder: boolean): string {
  const bodyPlaceholder = includeBodyPlaceholder
    ? [
        "    <p:sp>",
        "      <p:nvSpPr>",
        '        <p:cNvPr id="3" name="Content Placeholder 2"/>',
        "        <p:cNvSpPr/>",
        '        <p:nvPr><p:ph type="body"/></p:nvPr>',
        "      </p:nvSpPr>",
        "      <p:spPr>",
        "        <a:xfrm>",
        '          <a:off x="457200" y="1371600"/>',
        '          <a:ext cx="8229600" cy="3657600"/>',
        "        </a:xfrm>",
        "      </p:spPr>",
        "      <p:txBody>",
        "        <a:bodyPr/>",
        "        <a:lstStyle/>",
        "        <a:p>",
        "          <a:r>",
        '            <a:rPr sz="2000"><a:latin typeface="Noto Sans JP"/></a:rPr>',
        "            <a:t>Body</a:t>",
        "          </a:r>",
        "        </a:p>",
        "      </p:txBody>",
        "    </p:sp>"
      ].join("\n")
    : "";

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    "  <p:cSld>",
    "    <p:bg>",
    "      <p:bgPr>",
    '        <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>',
    "      </p:bgPr>",
    "    </p:bg>",
    "    <p:spTree>",
    "    <p:sp>",
    "      <p:nvSpPr>",
    '        <p:cNvPr id="2" name="Title Placeholder 1"/>',
    "        <p:cNvSpPr/>",
    '        <p:nvPr><p:ph type="title"/></p:nvPr>',
    "      </p:nvSpPr>",
    "      <p:spPr>",
    "        <a:xfrm>",
    '          <a:off x="457200" y="228600"/>',
    '          <a:ext cx="8229600" cy="914400"/>',
    "        </a:xfrm>",
    "      </p:spPr>",
    "      <p:txBody>",
    "        <a:bodyPr/>",
    "        <a:lstStyle/>",
    "        <a:p>",
    "          <a:r>",
    '            <a:rPr sz="3200"><a:latin typeface="Noto Sans"/></a:rPr>',
    "            <a:t>Title</a:t>",
    "          </a:r>",
    "        </a:p>",
    "      </p:txBody>",
    "    </p:sp>",
    bodyPlaceholder,
    "    </p:spTree>",
    "  </p:cSld>",
    "</p:sldLayout>"
  ].join("\n");
}

function slideMasterXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "  <p:cSld>",
    "    <p:bg>",
    "      <p:bgPr>",
    "        <a:blipFill>",
    '          <a:blip r:embed="rId1"/>',
    "          <a:stretch><a:fillRect/></a:stretch>",
    "        </a:blipFill>",
    "      </p:bgPr>",
    "    </p:bg>",
    "    <p:spTree>",
    "      <p:sp>",
    "        <p:nvSpPr>",
    '          <p:cNvPr id="10" name="Decorative Rectangle"/>',
    "          <p:cNvSpPr/>",
    "          <p:nvPr/>",
    "        </p:nvSpPr>",
    "        <p:spPr>",
    "          <a:xfrm>",
    '            <a:off x="0" y="0"/>',
    '            <a:ext cx="12192000" cy="457200"/>',
    "          </a:xfrm>",
    '          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '          <a:solidFill><a:srgbClr val="0B5FFF"/></a:solidFill>',
    "        </p:spPr>",
    "      </p:sp>",
    "    </p:spTree>",
    "  </p:cSld>",
    "</p:sldMaster>"
  ].join("\n");
}

function layoutRelsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>',
    "</Relationships>"
  ].join("\n");
}

function masterRelsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>',
    "</Relationships>"
  ].join("\n");
}

async function createTemplateArchive(
  outputPath: string,
  options: {
    includeLayout: boolean;
    includeBodyPlaceholder: boolean;
  }
): Promise<void> {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", presentationXml());
  zip.file("ppt/theme/theme1.xml", themeXml());

  if (options.includeLayout) {
    zip.file("ppt/slideLayouts/slideLayout1.xml", layoutXml(options.includeBodyPlaceholder));
    zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", layoutRelsXml());
  }

  zip.file("ppt/slideMasters/slideMaster1.xml", slideMasterXml());
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", masterRelsXml());
  zip.file("ppt/media/image1.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(outputPath, buffer);
}

function createMinimalValidDSL(): PresentationDSL {
  return {
    version: "1.0",
    theme: "corporate-blue",
    metadata: {
      title: "QA Test"
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

describe("Functional requirements coverage", () => {
  describe("FR-001 / FR-002: generation entry points", () => {
    it("generates PPTX from file fixtures and object payloads with multiple cases", async () => {
      const renderer = new PPTXRenderer();

      const fileCases: Array<{ fixturePath: string; expectedSlideCount: number; outputName: string }> = [
        { fixturePath: fixture("valid/minimal.yaml"), expectedSlideCount: 2, outputName: "minimal.pptx" },
        { fixturePath: fixture("valid/network.yaml"), expectedSlideCount: 1, outputName: "network.pptx" }
      ];

      for (const testCase of fileCases) {
        const outputPath = await createTempOutputPath("fr-001-", testCase.outputName);
        const result = await renderer.generateFromFile(testCase.fixturePath, outputPath);
        const stat = await fs.stat(outputPath);

        expect(result.success).toBe(true);
        expect(result.metadata.slideCount).toBe(testCase.expectedSlideCount);
        expect(stat.size).toBeGreaterThan(0);
      }

      const objectCases: Array<{ dsl: PresentationDSL; expectedSlideCount: number; outputName: string }> = [
        {
          outputName: "object-1.pptx",
          expectedSlideCount: 1,
          dsl: {
            version: "1.0",
            theme: "corporate-blue",
            metadata: { title: "single" },
            slides: [
              {
                type: "content",
                title: "one",
                content: [{ type: "text", content: "body" }]
              }
            ]
          }
        },
        {
          outputName: "object-2.pptx",
          expectedSlideCount: 2,
          dsl: {
            version: "1.0",
            theme: "corporate-blue",
            metadata: { title: "multi" },
            slides: [
              {
                type: "title",
                content: {
                  title: "top",
                  subtitle: "sub"
                }
              },
              {
                type: "content",
                title: "two",
                content: [
                  {
                    type: "chart",
                    chartType: "bar",
                    data: {
                      labels: ["Q1", "Q2"],
                      series: [{ name: "S", values: [10, 20] }]
                    }
                  }
                ]
              }
            ]
          }
        }
      ];

      for (const testCase of objectCases) {
        const outputPath = await createTempOutputPath("fr-002-", testCase.outputName);
        const result = await renderer.generate(testCase.dsl, outputPath);

        expect(result.success).toBe(true);
        expect(result.metadata.slideCount).toBe(testCase.expectedSlideCount);
      }
    });
  });

  describe("FR-003 / FR-004 / FR-005 / FR-006 / FR-007: parser and normalizer", () => {
    it("FR-003 validates strict schema with multiple invalid payload types", () => {
      const parser = new DSLParser();

      const schemaCases: Array<{ payload: unknown; expectedMessage: string }> = [
        {
          payload: {
            version: "1.0",
            theme: "corporate-blue",
            metadata: { title: "x" },
            slides: [
              {
                type: "content",
                title: "title",
                content: [{ type: "text", content: "body", unknown: true }]
              }
            ]
          },
          expectedMessage: "unrecognized"
        },
        {
          payload: {
            version: "1.0",
            theme: "corporate-blue",
            metadata: { title: "x" },
            slides: [
              {
                type: "content",
                title: "title",
                content: [{ type: "text" }]
              }
            ]
          },
          expectedMessage: "content"
        },
        {
          payload: {
            version: "1.0",
            theme: "corporate-blue",
            metadata: { title: "x" },
            slides: [
              {
                type: "content",
                content: [{ type: "text", content: "body" }]
              }
            ]
          },
          expectedMessage: "title"
        }
      ];

      for (const testCase of schemaCases) {
        const result = parser.validate(testCase.payload);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((error) => error.toLowerCase().includes(testCase.expectedMessage))).toBe(true);
      }
    });

    it("FR-004 validates semantic consistency with multiple mismatch scenarios", () => {
      const parser = new DSLParser({ allowRemoteImages: true });

      const semanticCases: Array<{ content: ContentElement[]; expectedMessage: string }> = [
        {
          expectedMessage: "column count mismatch",
          content: [
            {
              type: "table",
              headers: ["A", "B"],
              rows: [[1]]
            }
          ]
        },
        {
          expectedMessage: "value count mismatch",
          content: [
            {
              type: "chart",
              chartType: "bar",
              data: {
                labels: ["Q1", "Q2"],
                series: [{ name: "S", values: [1] }]
              }
            }
          ]
        },
        {
          expectedMessage: "unknown node",
          content: [
            {
              type: "network-diagram",
              layout: "hierarchical",
              nodes: [{ id: "n1", label: "N1" }],
              edges: [{ from: "n1", to: "missing" }]
            }
          ]
        },
        {
          expectedMessage: "unknown step",
          content: [
            {
              type: "flowchart",
              direction: "horizontal",
              steps: [{ id: "s1", label: "Start" }],
              flows: [{ from: "s1", to: "missing" }]
            }
          ]
        }
      ];

      for (const testCase of semanticCases) {
        const result = parser.validate(createContentDSL(testCase.content));
        expect(result.isValid).toBe(false);
        expect(result.errors.some((error) => error.includes(testCase.expectedMessage))).toBe(true);
      }
    });

    it("FR-005 enforces structural limits across string, array, and nesting depth", () => {
      const parser = new DSLParser();

      const cases: Array<{ payload: unknown; expectedMessage: string }> = [
        {
          payload: {
            version: "1.0",
            theme: "corporate-blue",
            metadata: { title: "x".repeat(10_001) },
            slides: []
          },
          expectedMessage: "string length"
        },
        {
          payload: {
            items: Array.from({ length: 10_001 }, (_, index) => index)
          },
          expectedMessage: "array length"
        },
        {
          payload: createNestedObject(25),
          expectedMessage: "nesting depth"
        }
      ];

      for (const testCase of cases) {
        const result = parser.validate(testCase.payload);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((error) => error.toLowerCase().includes(testCase.expectedMessage))).toBe(true);
      }
    });

    it("FR-006 enforces image security rules with multiple parser options", () => {
      const defaultParser = new DSLParser();
      const remoteAllowedParser = new DSLParser({ allowRemoteImages: true });

      const validationCases: Array<{
        parser: DSLParser;
        dsl: PresentationDSL;
        expectedValid: boolean;
        expectedError?: string;
      }> = [
        {
          parser: defaultParser,
          dsl: createContentDSL([{ type: "image", source: "https://example.com/remote.png" }]),
          expectedValid: false,
          expectedError: "remote URL"
        },
        {
          parser: remoteAllowedParser,
          dsl: createContentDSL([{ type: "image", source: "https://example.com/remote.png" }]),
          expectedValid: true
        },
        {
          parser: remoteAllowedParser,
          dsl: createContentDSL([{ type: "image", source: "../secrets.png" }]),
          expectedValid: false,
          expectedError: "path traversal"
        }
      ];

      for (const testCase of validationCases) {
        const result = testCase.parser.validate(testCase.dsl);
        expect(result.isValid).toBe(testCase.expectedValid);
        if (testCase.expectedError !== undefined) {
          expect(result.errors.some((error) => error.toLowerCase().includes(testCase.expectedError?.toLowerCase() ?? ""))).toBe(true);
        }
      }
    });

    it("FR-007 normalizes defaults for multiple slide and element variants", () => {
      const parser = new DSLParser();

      const input: PresentationDSL = {
        version: "1.0",
        theme: "corporate-blue",
        metadata: { title: "normalize" },
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
              {
                type: "two-column",
                left: [{ type: "text", content: "left" }],
                right: [{ type: "text", content: "right" }]
              }
            ]
          },
          {
            type: "blank",
            elements: [{ type: "text", content: "blank" }]
          }
        ]
      };

      const normalized = parser.normalize(input);
      const titleSlide = normalized.slides[0];
      const contentSlide = normalized.slides[1];
      const blankSlide = normalized.slides[2];

      if (titleSlide?.type !== "title" || contentSlide?.type !== "content" || blankSlide?.type !== "blank") {
        throw new Error("Unexpected normalized slide types");
      }

      expect(titleSlide.background).toBe("light");
      expect(titleSlide.content.logo).toBe(false);
      expect(contentSlide.layout).toBe("auto");
      expect(contentSlide.content[0]).toMatchObject({ type: "text", style: "body", align: "left" });

      const twoColumn = contentSlide.content[1];
      if (twoColumn?.type !== "two-column") {
        throw new Error("Expected two-column element");
      }
      expect(twoColumn.ratio).toBe("1:1");
      expect(blankSlide.background).toBe("light");
    });
  });

  describe("FR-008 / FR-009: theme loading and path constraints", () => {
    it("FR-008 loads built-in and custom theme references", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fr-008-theme-"));
      const customThemePath = path.join(tempDir, "custom.yaml");

      await fs.writeFile(
        customThemePath,
        [
          "name: Custom Theme",
          'version: "1.0"',
          "colors:",
          '  primary: "111111"',
          '  secondary: "EEEEEE"',
          '  accent: "FF0000"',
          '  text-dark: "111111"',
          '  text-light: "FFFFFF"',
          '  background-light: "FAFAFA"',
          '  background-dark: "111111"',
          '  success: "00AA00"',
          '  warning: "CC8800"',
          '  error: "AA0000"',
          "typography:",
          "  fonts:",
          "    title: Arial",
          "    heading: Arial",
          "    body: Arial",
          "    caption: Arial",
          "  sizes:",
          "    title: 30",
          "    heading: 20",
          "    subheading: 16",
          "    body: 12",
          "    caption: 10",
          "    statValue: 40",
          "  weights:",
          "    bold: true",
          "    normal: false",
          "layout:",
          '  slideSize: "16:9"',
          "  margins:",
          "    default: 0.5",
          "    titleSlide: 0.7",
          "  spacing:",
          "    elementGap: 0.2",
          "    paragraphSpacing: 0.1",
          "  grid:",
          "    columns: 12",
          "    gutter: 0.2",
          "defaults:",
          "  titleSlide:",
          "    background: background-dark",
          "    titleColor: text-light",
          "    subtitleColor: secondary",
          "  contentSlide:",
          "    background: background-light",
          "    titleColor: text-dark",
          "  bulletStyle:",
          '    character: "•"',
          "    color: accent",
          "    indent: 0.3",
          "  tableStyle:",
          "    headerBackground: primary",
          "    headerText: text-light",
          "    rowAlternate: background-light",
          "    borderColor: text-dark"
        ].join("\n"),
        "utf-8"
      );

      const loader = new ThemeLoader({
        themeDir: path.resolve(process.cwd(), "themes"),
        allowedRoots: [path.resolve(process.cwd()), tempDir]
      });

      const cases = [
        { themeRef: "corporate-blue", expectedName: "Corporate Blue" },
        { themeRef: customThemePath, expectedName: "Custom Theme" }
      ];

      for (const testCase of cases) {
        const theme = await loader.load(testCase.themeRef);
        expect(theme.name).toBe(testCase.expectedName);
      }
    });

    it("FR-009 rejects theme files outside allowlisted roots in multiple path patterns", async () => {
      const allowedRoot = path.resolve(process.cwd(), "themes");
      const loader = new ThemeLoader({
        themeDir: allowedRoot,
        allowedRoots: [allowedRoot]
      });

      const blockedCases = ["../outside.yaml", path.resolve(process.cwd(), "outside.yaml")];

      for (const blockedPath of blockedCases) {
        await expect(loader.load(blockedPath)).rejects.toThrowError(/not allowed|outside/i);
      }
    });
  });

  describe("FR-010 / FR-011: layout behavior", () => {
    it("FR-010 supports layout strategies and rejects unsupported values", () => {
      const engine = new LayoutEngine(testTheme);

      const explicitCases: Array<{ layout: "single-column" | "two-column" | "three-column"; minAreas: number }> = [
        { layout: "single-column", minAreas: 2 },
        { layout: "two-column", minAreas: 2 },
        { layout: "three-column", minAreas: 3 }
      ];

      const baseElements: ContentElement[] = [
        { type: "text", content: "a" },
        { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" },
        { type: "stat-callout", value: "1", label: "metric" }
      ];

      for (const testCase of explicitCases) {
        const result = engine.calculateLayout(baseElements, testCase.layout);
        expect(result.areas.length).toBeGreaterThanOrEqual(testCase.minAreas);
      }

      const autoMixed = engine.calculateLayout(
        [
          { type: "text", content: "x" },
          { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" }
        ],
        "auto"
      );
      expect(autoMixed.areas).toHaveLength(2);

      const autoStat = engine.calculateLayout(
        [
          { type: "stat-callout", value: "1", label: "a" },
          { type: "stat-callout", value: "2", label: "b" },
          { type: "stat-callout", value: "3", label: "c" }
        ],
        "auto"
      );
      const distinctX = new Set(autoStat.areas.map((area) => area.bounds.x.toFixed(2)));
      expect(distinctX.size).toBeGreaterThan(1);

      expect(() => engine.calculateLayout(baseElements, "unsupported" as unknown as "auto")).toThrowError(/Unsupported layout/);
    });

    it("FR-011 keeps computed areas inside slide bounds across multiple slide sizes", () => {
      const themes: ThemeDefinition[] = [
        testTheme,
        {
          ...testTheme,
          layout: {
            ...testTheme.layout,
            slideSize: "4:3"
          }
        }
      ];

      for (const theme of themes) {
        const engine = new LayoutEngine(theme);
        const result = engine.calculateLayout(
          Array.from({ length: 6 }).map((_, index) => ({ type: "text", content: `item-${index}` })),
          "three-column"
        );
        const bounds = engine.getSlideBounds();

        for (const area of result.areas) {
          expect(area.bounds.x).toBeGreaterThanOrEqual(bounds.x);
          expect(area.bounds.y).toBeGreaterThanOrEqual(bounds.y);
          expect(area.bounds.x + area.bounds.w).toBeLessThanOrEqual(bounds.x + bounds.w + 0.0001);
          expect(area.bounds.y + area.bounds.h).toBeLessThanOrEqual(bounds.y + bounds.h + 0.0001);
        }
      }
    });
  });

  describe("FR-012 / FR-013 / FR-014: renderer behavior and content coverage", () => {
    it("FR-012 renders all slide types for multiple slide sets", async () => {
      const renderer = new SlideRenderer();

      const dslCases: PresentationDSL[] = [
        {
          version: "1.0",
          theme: "corporate-blue",
          metadata: { title: "all slides" },
          slides: [
            { type: "title", content: { title: "Title", subtitle: "Sub" } },
            { type: "content", title: "Content", content: [{ type: "text", content: "Body" }] },
            { type: "section", title: "Section", subtitle: "Divider" },
            {
              type: "blank",
              elements: [{ type: "custom-shape", shape: "rectangle", position: { x: 1, y: 1, w: 2, h: 1 } }]
            }
          ]
        },
        {
          version: "1.0",
          theme: "corporate-blue",
          metadata: { title: "alternate" },
          slides: [
            { type: "title", background: "dark", content: { title: "Another", logo: false } },
            { type: "content", title: "Content", content: [{ type: "text", content: "Body" }] },
            { type: "section", title: "Section", background: { color: "primary", opacity: 0.9 } },
            { type: "blank", background: "light", elements: [{ type: "text", content: "free" }] }
          ]
        }
      ];

      for (const dsl of dslCases) {
        const presentation = new MockPresentation();
        await renderer.renderSlides(presentation, dsl, testTheme);
        expect(presentation.slides.length).toBe(4);
      }
    });

    it("FR-013 renders all supported content elements with multiple payload sets", async () => {
      const slide = new MockSlide();
      const context = createRenderContext(testTheme);
      const bounds = { x: 0.5, y: 1, w: 4, h: 2 };

      const contentCases: ContentElement[] = [
        { type: "text", content: "text" },
        { type: "bullet-list", items: ["a", "b"] },
        { type: "numbered-list", items: ["1", "2"] },
        { type: "stat-callout", value: "120", label: "value" },
        { type: "image", source: "data:image/png;base64,iVBORw0KGgo=" },
        { type: "table", headers: ["H1", "H2"], rows: [[1, 2]] },
        {
          type: "chart",
          chartType: "bar",
          data: {
            labels: ["A", "B"],
            series: [{ name: "S", values: [1, 2] }]
          }
        },
        {
          type: "network-diagram",
          layout: "circular",
          nodes: [
            { id: "a", label: "A" },
            { id: "b", label: "B" }
          ],
          edges: [{ from: "a", to: "b" }]
        },
        {
          type: "flowchart",
          direction: "vertical",
          steps: [{ id: "s", label: "Start" }],
          flows: []
        },
        {
          type: "icon-grid",
          columns: 2,
          items: [{ icon: "A", title: "Alpha" }]
        },
        {
          type: "two-column",
          left: [{ type: "text", content: "left" }],
          right: [{ type: "text", content: "right" }],
          ratio: "1:1"
        }
      ];

      for (const element of contentCases) {
        await renderContentElement(slide, element, bounds, testTheme, context);
      }

      await renderContentElement(
        slide,
        { type: "custom-shape", shape: "circle", position: { x: 1, y: 1, w: 1, h: 1 }, fill: "primary" },
        bounds,
        testTheme,
        context
      );

      expect(slide.calls.length).toBeGreaterThan(10);
    });

    it("FR-014 enforces image rendering safety for remote and traversal paths", async () => {
      const slide = new MockSlide();
      const bounds = { x: 0.5, y: 1, w: 4, h: 2 };

      const cases: Array<{ source: string; shouldReject: boolean }> = [
        {
          source: "data:image/png;base64,iVBORw0KGgo=",
          shouldReject: false
        },
        {
          source: "assets/image.png",
          shouldReject: false
        },
        {
          source: "https://example.com/image.png",
          shouldReject: true
        },
        {
          source: "../secret.png",
          shouldReject: true
        }
      ];

      for (const testCase of cases) {
        const action = renderImage(
          slide,
          {
            type: "image",
            source: testCase.source
          },
          bounds,
          testTheme
        );

        if (testCase.shouldReject) {
          await expect(action).rejects.toThrowError(/disabled|traversal/i);
        } else {
          await expect(action).resolves.toBeUndefined();
        }
      }
    });
  });

  describe("FR-015 / FR-016 / FR-017: template import and package validation", () => {
    it("FR-015 imports template archives for both .potx and .pptx", async () => {
      const importer = new TemplateImporter({ templateId: "acme" });

      const extensionCases = [".potx", ".pptx"] as const;

      for (const extension of extensionCases) {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fr-015-import-"));
        const templatePath = path.join(tempRoot, `source${extension}`);
        const outputDir = path.join(tempRoot, "output");

        await createTemplateArchive(templatePath, {
          includeLayout: true,
          includeBodyPlaceholder: true
        });

        const imported = await importer.importFromFile(templatePath, outputDir);

        expect(imported.template.id).toBe("acme");
        expect(imported.layout.kind).toBe("title-body");
        expect(imported.background.objects.length).toBeGreaterThanOrEqual(1);

        await expect(fs.stat(path.join(outputDir, "template.yaml"))).resolves.toBeDefined();
        await expect(fs.stat(path.join(outputDir, "manifest.json"))).resolves.toBeDefined();
      }
    });

    it("FR-016 fails closed for incompatible or missing layout structures", async () => {
      const importer = new TemplateImporter();
      const cases: Array<{ includeLayout: boolean; includeBodyPlaceholder: boolean; fileName: string }> = [
        {
          includeLayout: true,
          includeBodyPlaceholder: false,
          fileName: "missing-body.potx"
        },
        {
          includeLayout: false,
          includeBodyPlaceholder: false,
          fileName: "missing-layout.potx"
        }
      ];

      for (const testCase of cases) {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fr-016-import-"));
        const templatePath = path.join(tempRoot, testCase.fileName);
        const outputDir = path.join(tempRoot, "output");

        await createTemplateArchive(templatePath, {
          includeLayout: testCase.includeLayout,
          includeBodyPlaceholder: testCase.includeBodyPlaceholder
        });

        await expect(importer.importFromFile(templatePath, outputDir)).rejects.toBeInstanceOf(TemplateImportError);
      }
    });

    it("FR-017 validates imported template package schema and asset path constraints", () => {
      const valid = createTemplatePackage();
      expect(parseImportedTemplatePackage(valid).layout.kind).toBe("title-body");

      const invalidCases: ImportedTemplatePackage[] = [
        createTemplatePackage({
          background: {
            mode: "editable",
            image: "../secret.png",
            objects: []
          }
        }),
        createTemplatePackage({
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
        }),
        createTemplatePackage({
          background: {
            mode: "editable",
            image: "bg.png",
            objects: []
          }
        })
      ];

      for (const invalidPackage of invalidCases) {
        expect(() => parseImportedTemplatePackage(invalidPackage)).toThrowError(/assets/i);
      }
    });
  });

  describe("FR-018 / FR-019 / FR-020 / FR-021: template apply, QA, and atomic output", () => {
    it("FR-018 merges template theme for object and path inputs with multiple slide sizes", async () => {
      const dsl = createMinimalValidDSL();
      const baseTemplate = createTemplatePackage({
        background: {
          mode: "editable",
          color: "background-light",
          objects: []
        }
      });

      const cases: Array<{
        slideSize: "16:9" | "16:10" | "4:3";
        createRenderer: (tempRoot: string, templatePackage: ImportedTemplatePackage) => Promise<PPTXRenderer>;
        outputName: string;
      }> = [
        {
          slideSize: "4:3",
          outputName: "object-template.pptx",
          createRenderer: async (tempRoot, templatePackage) => {
            await fs.mkdir(path.join(tempRoot, "assets"), { recursive: true });
            await fs.writeFile(path.join(tempRoot, "assets", "bg.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

            return new PPTXRenderer({
              templatePackage,
              templateAssetBaseDir: tempRoot
            });
          }
        },
        {
          slideSize: "16:10",
          outputName: "path-template.pptx",
          createRenderer: async (tempRoot, templatePackage) => {
            await fs.mkdir(path.join(tempRoot, "assets"), { recursive: true });
            await fs.writeFile(path.join(tempRoot, "assets", "bg.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
            const templatePath = path.join(tempRoot, "template.yaml");
            await fs.writeFile(templatePath, yaml.dump(templatePackage), "utf-8");

            return new PPTXRenderer({
              templatePackagePath: templatePath
            });
          }
        }
      ];

      for (const testCase of cases) {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fr-018-template-"));
        const templatePackage = withSlideSize(baseTemplate, testCase.slideSize);
        const renderer = await testCase.createRenderer(tempRoot, templatePackage);
        let capturedSlideSize: ThemeDefinition["layout"]["slideSize"] | undefined;

        createRendererWithPatchedSetup(renderer, (theme) => {
          capturedSlideSize = theme.layout.slideSize;
        });

        const outputPath = path.join(tempRoot, testCase.outputName);
        const result = await renderer.generate(dsl, outputPath);

        expect(result.success).toBe(true);
        expect(capturedSlideSize).toBe(testCase.slideSize);
      }
    });

    it("FR-019 returns qaResult for passing and failing QA states", async () => {
      const passingRenderer = new PPTXRenderer({ enableQA: true });
      const passingOutput = await createTempOutputPath("fr-019-pass-", "pass.pptx");
      const passingResult = await passingRenderer.generate(createMinimalValidDSL(), passingOutput);

      expect(passingResult.qaResult).toBeDefined();
      expect(passingResult.qaResult?.hasIssues).toBe(false);

      type QAEngineInternal = {
        validate: (outputPath: string, dsl: PresentationDSL, theme: ThemeDefinition) => Promise<QAResult>;
        fix: (dsl: PresentationDSL, issues: QAResult["issues"]) => PresentationDSL;
      };

      type RendererWithQA = { qa?: QAEngineInternal };
      const failingRenderer = new PPTXRenderer({ enableQA: true });
      const internal = failingRenderer as unknown as RendererWithQA;
      const qa = internal.qa;

      if (qa === undefined) {
        throw new Error("QA engine is not initialized");
      }

      qa.validate = async () => ({
        hasIssues: true,
        issues: [{ code: "SIMULATED", message: "simulated issue" }]
      });

      const failingOutput = await createTempOutputPath("fr-019-fail-", "fail.pptx");
      const failingResult = await failingRenderer.generate(createMinimalValidDSL(), failingOutput);

      expect(failingResult.qaResult).toBeDefined();
      expect(failingResult.qaResult?.hasIssues).toBe(true);
      expect(failingResult.qaResult?.issues[0]?.code).toBe("SIMULATED");
    });

    it("FR-020 retries QA autofix according to maxIterations with multiple retry profiles", async () => {
      type QAEngineInternal = {
        validate: (outputPath: string, dsl: PresentationDSL, theme: ThemeDefinition) => Promise<QAResult>;
        fix: (dsl: PresentationDSL, issues: QAResult["issues"]) => PresentationDSL;
      };
      type RendererWithQA = { qa?: QAEngineInternal };

      const cases: Array<{
        maxIterations: number;
        sequence: boolean[];
        expectedValidateCalls: number;
      }> = [
        {
          maxIterations: 1,
          sequence: [true, false],
          expectedValidateCalls: 1
        },
        {
          maxIterations: 3,
          sequence: [true, true, false],
          expectedValidateCalls: 3
        }
      ];

      for (const testCase of cases) {
        const renderer = new PPTXRenderer({
          enableQA: true,
          qaConfig: {
            autoFix: true,
            maxIterations: testCase.maxIterations
          }
        });
        const internal = renderer as unknown as RendererWithQA;
        const qa = internal.qa;

        if (qa === undefined) {
          throw new Error("QA engine is not initialized");
        }

        let callCount = 0;
        qa.validate = async () => {
          const next = testCase.sequence[callCount] ?? true;
          callCount += 1;

          return {
            hasIssues: next,
            issues: next ? [{ code: "RETRY", message: "retry me" }] : []
          };
        };
        qa.fix = (dsl) => dsl;

        const output = await createTempOutputPath("fr-020-", `retry-${testCase.maxIterations}.pptx`);
        const result = await renderer.generate(createMinimalValidDSL(), output);

        expect(result.success).toBe(true);
        expect(callCount).toBe(testCase.expectedValidateCalls);
      }
    });

    it("FR-021 writes atomically and cleans temp files for success and failure cases", async () => {
      type AtomicWriter = {
        writeFile: (options: { fileName: string }) => Promise<void>;
      };
      type RendererWithWriteAtomic = {
        writeAtomic: (presentation: AtomicWriter, outputPath: string) => Promise<void>;
      };

      const renderer = new PPTXRenderer();
      const internal = renderer as unknown as RendererWithWriteAtomic;

      const cases: Array<{
        shouldFail: boolean;
        suffix: string;
      }> = [
        { shouldFail: false, suffix: "success" },
        { shouldFail: true, suffix: "failure" }
      ];

      for (const testCase of cases) {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fr-021-"));
        const outputPath = path.join(tempRoot, `${testCase.suffix}.pptx`);
        const extension = path.extname(outputPath);
        const base = outputPath.slice(0, outputPath.length - extension.length);

        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(999999);
        const tempPath = `${base}.999999.${process.pid}.tmp${extension || ".pptx"}`;

        const presentation: AtomicWriter = {
          writeFile: async ({ fileName }) => {
            await fs.writeFile(fileName, "temporary", "utf-8");
            if (testCase.shouldFail) {
              throw new Error("simulated write failure");
            }
          }
        };

        if (testCase.shouldFail) {
          await expect(internal.writeAtomic(presentation, outputPath)).rejects.toThrowError(/Failed to write presentation/i);
          await expect(fs.stat(tempPath)).rejects.toThrow();
        } else {
          await expect(internal.writeAtomic(presentation, outputPath)).resolves.toBeUndefined();
          const content = await fs.readFile(outputPath, "utf-8");
          expect(content).toBe("temporary");
          await expect(fs.stat(tempPath)).rejects.toThrow();
        }

        nowSpy.mockRestore();
      }
    });
  });

  describe("Cross-check: fuzz/perf entry validation with multiple payloads", () => {
    it("keeps parser.validate non-throwing for both valid and invalid unknown inputs", () => {
      const parser = new DSLParser();

      const payloads: unknown[] = [
        createMinimalValidDSL(),
        {
          version: "1.0",
          theme: "corporate-blue",
          metadata: { title: "x" },
          slides: [{ type: "content", title: "t", content: [{ type: "text" }] }]
        },
        {
          random: "payload"
        }
      ];

      for (const payload of payloads) {
        const run = (): ValidationResult => parser.validate(payload);
        expect(run).not.toThrow();
      }
    });
  });
});
