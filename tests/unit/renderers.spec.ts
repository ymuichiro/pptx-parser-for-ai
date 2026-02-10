import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { SlideRenderer } from "../../src/renderers";
import { renderChart } from "../../src/renderers/components/chart";
import { renderFlowchart } from "../../src/renderers/components/flowchart";
import { renderIconGrid } from "../../src/renderers/components/icon-grid";
import { renderImage } from "../../src/renderers/components/image";
import { renderBulletList, renderNumberedList } from "../../src/renderers/components/list";
import { renderNetworkDiagram } from "../../src/renderers/components/network-diagram";
import { renderCustomShape } from "../../src/renderers/components/shape";
import { renderStatCallout } from "../../src/renderers/components/stat-callout";
import { renderTable } from "../../src/renderers/components/table";
import { renderText } from "../../src/renderers/components/text";
import { renderTwoColumn } from "../../src/renderers/components/two-column";
import { renderContentElement } from "../../src/renderers/components";
import type { Bounds, ContentElement, PresentationDSL } from "../../src/types";
import type { SlideAdapter, SlideTemplateContext } from "../../src/renderers";
import { testTheme } from "../helpers/theme";
import { MockPresentation, MockSlide } from "../helpers/mock-slide";

const bounds: Bounds = { x: 0.5, y: 1, w: 4, h: 2 };

const context = {
  renderElement: async (slide: SlideAdapter, element: unknown, nextBounds: Bounds) => {
    await renderContentElement(slide, element, nextBounds, testTheme, context);
  }
};

describe("component renderers", () => {
  it("renders text and list components", () => {
    const slide = new MockSlide();

    renderText(slide, { type: "text", content: "body" }, bounds, testTheme);
    renderBulletList(
      slide,
      {
        type: "bullet-list",
        items: ["a", { text: "b", subItems: ["c"] }]
      },
      bounds,
      testTheme
    );
    renderNumberedList(slide, { type: "numbered-list", items: ["one", "two"] }, bounds, testTheme);

    expect(slide.count("text")).toBe(3);
  });

  it("renders table and chart", () => {
    const slide = new MockSlide();

    renderTable(
      slide,
      {
        type: "table",
        headers: ["A", "B"],
        rows: [[1, 2]]
      },
      bounds,
      testTheme
    );

    renderChart(
      slide,
      {
        type: "chart",
        chartType: "bar",
        title: "chart",
        data: {
          labels: ["Q1", "Q2"],
          series: [{ name: "s", values: [10, 20] }]
        },
        options: {
          showValues: true,
          showLegend: false
        }
      },
      bounds,
      testTheme
    );

    expect(slide.count("table")).toBe(1);
    expect(slide.count("shape")).toBeGreaterThan(0);
  });

  it("renders image and rejects remote image URL", async () => {
    const slide = new MockSlide();
    await renderImage(
      slide,
      {
        type: "image",
        source:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B2C8AAAAASUVORK5CYII=",
        caption: "caption"
      },
      bounds,
      testTheme
    );

    expect(slide.count("image")).toBe(1);
    expect(slide.count("text")).toBe(1);

    await expect(
      renderImage(
        slide,
        {
          type: "image",
          source: "https://example.com/a.png"
        },
        bounds,
        testTheme
      )
    ).rejects.toThrowError(/disabled/i);
  });

  it("renders shape/stat/icon/network/flowchart", () => {
    const slide = new MockSlide();

    renderCustomShape(
      slide,
      {
        type: "custom-shape",
        shape: "rectangle",
        position: { x: 1, y: 1, w: 2, h: 1 },
        fill: "primary"
      },
      bounds,
      testTheme
    );

    renderStatCallout(
      slide,
      {
        type: "stat-callout",
        value: "120",
        label: "value",
        trend: "+10%"
      },
      bounds,
      testTheme
    );

    renderIconGrid(
      slide,
      {
        type: "icon-grid",
        columns: 2,
        items: [
          { icon: "A", title: "Alpha" },
          { icon: "B", title: "Beta" }
        ]
      },
      bounds,
      testTheme
    );

    renderNetworkDiagram(
      slide,
      {
        type: "network-diagram",
        layout: "circular",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" }
        ],
        edges: [{ from: "a", to: "b", label: "link" }]
      },
      bounds,
      testTheme
    );

    renderFlowchart(
      slide,
      {
        type: "flowchart",
        direction: "horizontal",
        steps: [
          { id: "s", label: "Start" },
          { id: "e", label: "End", shape: "diamond" }
        ],
        flows: [{ from: "s", to: "e", label: "go" }]
      },
      bounds,
      testTheme
    );

    expect(slide.count("shape")).toBeGreaterThan(5);
  });

  it("renders two-column and generic dispatcher", async () => {
    const slide = new MockSlide();

    await renderTwoColumn(
      slide,
      {
        type: "two-column",
        ratio: "2:1",
        left: [{ type: "text", content: "left" }],
        right: [{ type: "bullet-list", items: ["right"] }]
      },
      bounds,
      testTheme,
      context
    );

    const elements: ContentElement[] = [
      { type: "text", content: "a" },
      { type: "bullet-list", items: ["b"] },
      { type: "numbered-list", items: ["c"] },
      { type: "table", headers: ["H"], rows: [[1]] },
      {
        type: "chart",
        chartType: "bar",
        data: {
          labels: ["L"],
          series: [{ name: "S", values: [1] }]
        }
      },
      {
        type: "image",
        source:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B2C8AAAAASUVORK5CYII="
      },
      {
        type: "network-diagram",
        layout: "hierarchical",
        nodes: [{ id: "n", label: "N" }],
        edges: []
      },
      {
        type: "flowchart",
        direction: "vertical",
        steps: [{ id: "x", label: "X" }],
        flows: []
      },
      { type: "stat-callout", value: "1", label: "L" },
      { type: "icon-grid", columns: 1, items: [{ icon: "I", title: "T" }] },
      {
        type: "two-column",
        left: [{ type: "text", content: "nested" }],
        right: [{ type: "text", content: "nested" }],
        ratio: "1:1"
      }
    ];

    for (const element of elements) {
      await renderContentElement(slide, element, bounds, testTheme, context);
    }

    await expect(
      renderContentElement(slide, { type: "unknown" }, bounds, testTheme, context)
    ).rejects.toThrowError(/Unsupported/i);

    expect(slide.calls.length).toBeGreaterThan(10);
  });
});

describe("SlideRenderer", () => {
  it("renders all slide types", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: {
        title: "render"
      },
      slides: [
        {
          type: "title",
          content: {
            title: "Title",
            subtitle: "Sub",
            date: "2026-02-10",
            logo: false
          }
        },
        {
          type: "content",
          title: "Content",
          content: [{ type: "text", content: "Body" }]
        },
        {
          type: "section",
          title: "Section",
          subtitle: "Divider",
          background: {
            color: "primary",
            opacity: 1
          }
        },
        {
          type: "blank",
          elements: [
            {
              type: "custom-shape",
              shape: "rectangle",
              position: { x: 1, y: 1, w: 2, h: 1 }
            }
          ]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme);
    expect(presentation.slides.length).toBe(4);

    const totalCalls = presentation.slides.reduce((sum, slide) => sum + slide.calls.length, 0);
    expect(totalCalls).toBeGreaterThan(4);
  });

  it("handles alternate background branches and logo rendering", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();
    const themeWithLogo = {
      ...testTheme,
      logo: {
        source: "assets/logo.png",
        position: "top-right" as const,
        size: [1, 0.3] as [number, number],
        margin: 0.1
      }
    };

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: { title: "branches" },
      slides: [
        {
          type: "title",
          background: "dark",
          content: { title: "t", logo: true }
        },
        {
          type: "title",
          background: { color: "accent", opacity: 0.8 },
          content: { title: "t2", logo: false }
        },
        {
          type: "blank",
          background: { color: "secondary", opacity: 1 },
          elements: [{ type: "text", content: "x" }]
        },
        {
          type: "blank",
          background: "light",
          elements: [{ type: "text", content: "y" }]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, themeWithLogo);
    const imageCalls = presentation.slides.flatMap((slide) => slide.calls).filter((call) => call.kind === "image");
    expect(imageCalls.length).toBeGreaterThan(0);
  });

  it("applies imported template background and placeholder bounds on content slide", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "renderer-template-context-"));
    const assetsDir = path.join(tempRoot, "assets");
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(path.join(assetsDir, "header.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const templateContext: SlideTemplateContext = {
      assetBaseDir: tempRoot,
      templatePackage: {
        template: {
          id: "sample",
          source: {
            file: "sample.potx",
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
              bounds: { x: 1.2, y: 0.25, w: 7.6, h: 0.7 },
              style: {
                fontFace: "Noto Sans",
                fontSizePt: 30,
                color: "primary"
              }
            },
            body: {
              bounds: { x: 1.0, y: 1.4, w: 8.0, h: 3.5 },
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
          objects: [
            {
              type: "shape",
              shape: "rect",
              x: 0,
              y: 0,
              w: 10,
              h: 0.4,
              fill: "primary"
            },
            {
              type: "image",
              x: 8.8,
              y: 0,
              w: 1.2,
              h: 0.4,
              source: "assets/header.png"
            }
          ]
        },
        manifest: {
          warnings: [],
          unsupported: []
        }
      }
    };

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: { title: "template" },
      slides: [
        {
          type: "content",
          title: "Template Styled",
          content: [{ type: "text", content: "Body text" }]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme, templateContext);

    const slide = presentation.slides[0];
    if (slide === undefined) {
      throw new Error("expected slide");
    }

    const shapeCalls = slide.calls.filter((call) => call.kind === "shape");
    const imageCalls = slide.calls.filter((call) => call.kind === "image");
    const textCalls = slide.calls.filter((call) => call.kind === "text");
    expect(shapeCalls.length).toBeGreaterThanOrEqual(2);
    expect(imageCalls.length).toBe(1);
    expect(textCalls.length).toBeGreaterThanOrEqual(2);

    const titleCall = textCalls[0];
    if (titleCall?.kind !== "text") {
      throw new Error("expected title text call");
    }
    const titleOptions = (titleCall.payload as { options?: Record<string, unknown> }).options;
    expect(titleOptions?.x).toBe(1.2);
    expect(titleOptions?.y).toBe(0.25);
    expect(titleOptions?.fontFace).toBe("Noto Sans");
    expect(titleOptions?.fontSize).toBe(30);

    const bodyCall = textCalls[textCalls.length - 1];
    if (bodyCall?.kind !== "text") {
      throw new Error("expected body text call");
    }
    const bodyOptions = (bodyCall.payload as { options?: Record<string, unknown> }).options;
    expect((bodyOptions?.x as number) >= 1.0).toBe(true);
    expect((bodyOptions?.y as number) >= 1.4).toBe(true);
    expect((bodyOptions?.w as number) <= 8.01).toBe(true);
    expect((bodyOptions?.h as number) <= 3.51).toBe(true);
  });

  it("fails closed when template image path contains traversal", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: { title: "invalid-template-path" },
      slides: [
        {
          type: "content",
          title: "Invalid",
          content: [{ type: "text", content: "x" }]
        }
      ]
    };

    const templateContext: SlideTemplateContext = {
      assetBaseDir: process.cwd(),
      templatePackage: {
        template: {
          id: "invalid",
          source: {
            file: "invalid.potx",
            sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
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
              bounds: { x: 1, y: 0.3, w: 8, h: 0.7 },
              style: { fontFace: "Noto Sans" }
            },
            body: {
              bounds: { x: 1, y: 1.5, w: 8, h: 3.2 },
              style: { fontFace: "Noto Sans JP" }
            }
          }
        },
        background: {
          mode: "editable",
          image: "../secrets.png",
          objects: []
        },
        manifest: {
          warnings: [],
          unsupported: []
        }
      }
    };

    await expect(renderer.renderSlides(presentation, dsl, testTheme, templateContext)).rejects.toThrowError(
      /invalid/i
    );
  });
});
