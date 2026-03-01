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
const tallSvgData = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"></svg>'
).toString("base64")}`;
const wideSvgData = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"></svg>'
).toString("base64")}`;

const context = {
  renderElement: async (slide: SlideAdapter, element: unknown, nextBounds: Bounds) => {
    await renderContentElement(slide, element, nextBounds, testTheme, context);
  }
};

function readImageOptions(slide: MockSlide, index: number): Record<string, unknown> {
  const call = slide.calls.filter((entry) => entry.kind === "image")[index];
  if (call?.kind !== "image") {
    throw new Error(`expected image call at index ${index}`);
  }

  const payload = call.payload as { options?: Record<string, unknown> };
  if (payload.options === undefined) {
    throw new Error(`expected image options at index ${index}`);
  }

  return payload.options;
}

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
    expect(slide.count("chart")).toBe(1);
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

  it("respects contain sizing with left/center/right anchors", async () => {
    const slide = new MockSlide();

    await renderImage(
      slide,
      {
        type: "image",
        source: tallSvgData,
        sizing: "contain",
        position: "left"
      },
      bounds,
      testTheme
    );

    await renderImage(
      slide,
      {
        type: "image",
        source: tallSvgData,
        sizing: "contain",
        position: "center"
      },
      bounds,
      testTheme
    );

    await renderImage(
      slide,
      {
        type: "image",
        source: tallSvgData,
        sizing: "contain",
        position: "right"
      },
      bounds,
      testTheme
    );

    const left = readImageOptions(slide, 0);
    const center = readImageOptions(slide, 1);
    const right = readImageOptions(slide, 2);

    expect(left.x).toBeCloseTo(0.5, 5);
    expect(center.x).toBeCloseTo(2.0, 5);
    expect(right.x).toBeCloseTo(3.5, 5);
    expect(left.y).toBeCloseTo(1.0, 5);
    expect(left.w).toBeCloseTo(1.0, 5);
    expect(left.h).toBeCloseTo(2.0, 5);
    expect(left.sizing).toBeUndefined();
  });

  it("uses anchor-aware crop sizing for cover and crop modes", async () => {
    const slide = new MockSlide();

    await renderImage(
      slide,
      {
        type: "image",
        source: wideSvgData,
        sizing: "cover",
        position: "left"
      },
      bounds,
      testTheme
    );

    await renderImage(
      slide,
      {
        type: "image",
        source: wideSvgData,
        sizing: "cover",
        position: "right"
      },
      bounds,
      testTheme
    );

    await renderImage(
      slide,
      {
        type: "image",
        source: wideSvgData,
        sizing: "crop",
        position: "center"
      },
      bounds,
      testTheme
    );

    const leftCover = readImageOptions(slide, 0);
    const rightCover = readImageOptions(slide, 1);
    const centerCrop = readImageOptions(slide, 2);
    const leftSizing = leftCover.sizing as { type: string; x: number; y: number; w: number; h: number };
    const rightSizing = rightCover.sizing as { type: string; x: number; y: number; w: number; h: number };
    const centerSizing = centerCrop.sizing as { type: string; x: number; y: number; w: number; h: number };

    expect(leftCover.x).toBe(bounds.x);
    expect(leftCover.y).toBe(bounds.y);
    expect(leftCover.w).toBe(bounds.w);
    expect(leftCover.h).toBe(bounds.h);
    expect(leftSizing.type).toBe("crop");
    expect(rightSizing.type).toBe("crop");
    expect(centerSizing.type).toBe("crop");
    expect(leftSizing.x).toBeCloseTo(0, 5);
    expect(centerSizing.x).toBeCloseTo(50, 5);
    expect(rightSizing.x).toBeCloseTo(100, 5);
    expect(leftSizing.w).toBeCloseTo(200, 5);
    expect(leftSizing.h).toBeCloseTo(100, 5);
    expect(leftSizing.y).toBeCloseTo(0, 5);
  });

  it("prioritizes image bounds over layout bounds", async () => {
    const slide = new MockSlide();
    await renderImage(
      slide,
      {
        type: "image",
        source: wideSvgData,
        sizing: "cover",
        bounds: { x: 2.2, y: 1.8, w: 3.3, h: 1.1 }
      },
      bounds,
      testTheme
    );

    const options = readImageOptions(slide, 0);
    expect(options.x).toBeCloseTo(2.2, 5);
    expect(options.y).toBeCloseTo(1.8, 5);
    expect(options.w).toBeCloseTo(3.3, 5);
    expect(options.h).toBeCloseTo(1.1, 5);
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

  it("renders icon-grid image icons for local/data sources only", () => {
    const slide = new MockSlide();

    renderIconGrid(
      slide,
      {
        type: "icon-grid",
        columns: 3,
        items: [
          { icon: "example/assets/icons/car-solid.png", title: "Local" },
          {
            icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B2C8AAAAASUVORK5CYII=",
            title: "Inline"
          },
          { icon: "https://example.com/icon.png", title: "Remote" }
        ]
      },
      bounds,
      testTheme
    );

    expect(slide.count("image")).toBe(2);
    expect(slide.count("text")).toBe(3);
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

  it("renders preset content slots and decorations", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: { title: "preset-render" },
      slides: [
        {
          type: "content",
          preset: "compare-3col",
          title: "Preset slide",
          content: [
            { type: "text", content: "Left", slot: "left" },
            { type: "text", content: "Center", slot: "center" },
            { type: "text", content: "Right", slot: "right" },
            { type: "text", content: "Summary" }
          ]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme);
    const slide = presentation.slides[0];
    if (slide === undefined) {
      throw new Error("expected slide");
    }

    const shapeCalls = slide.calls.filter((call) => call.kind === "shape");
    expect(shapeCalls.length).toBeGreaterThanOrEqual(3);

    const textEntries = slide.calls
      .filter((call) => call.kind === "text")
      .map((call) => call.payload as { text: string; options?: Record<string, unknown> });
    const left = textEntries.find((entry) => entry.text === "Left");
    const center = textEntries.find((entry) => entry.text === "Center");
    const right = textEntries.find((entry) => entry.text === "Right");
    const summary = textEntries.find((entry) => entry.text === "Summary");

    expect((left?.options?.x as number) < (center?.options?.x as number)).toBe(true);
    expect((center?.options?.x as number) < (right?.options?.x as number)).toBe(true);
    expect((summary?.options?.y as number) >= 4.25).toBe(true);
  });

  it("remaps preset bounds into template body placeholder", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();
    const templateContext: SlideTemplateContext = {
      assetBaseDir: process.cwd(),
      templatePackage: {
        template: {
          id: "preset-template",
          source: {
            file: "sample.potx",
            sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            importedAt: "2026-03-01T00:00:00.000Z"
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
              bounds: { x: 1.1, y: 0.25, w: 7.8, h: 0.7 },
              style: { fontFace: "Noto Sans", fontSizePt: 28, color: "primary" }
            },
            body: {
              bounds: { x: 1.0, y: 1.4, w: 8.0, h: 3.5 },
              style: { fontFace: "Noto Sans JP", fontSizePt: 18, color: "text-dark" }
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
      }
    };

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: { title: "preset-template" },
      slides: [
        {
          type: "content",
          preset: "compare-3col",
          title: "Preset + Template",
          content: [
            { type: "text", content: "Left", slot: "left" },
            { type: "text", content: "Center", slot: "center" },
            { type: "text", content: "Right", slot: "right" }
          ]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme, templateContext);
    const slide = presentation.slides[0];
    if (slide === undefined) {
      throw new Error("expected slide");
    }

    const textCalls = slide.calls
      .filter((call) => call.kind === "text")
      .map((call) => call.payload as { text: string; options?: Record<string, unknown> })
      .filter((entry) => ["Left", "Center", "Right"].includes(entry.text));

    expect(textCalls.length).toBe(3);
    textCalls.forEach((entry) => {
      const x = entry.options?.x as number;
      const y = entry.options?.y as number;
      const w = entry.options?.w as number;
      const h = entry.options?.h as number;
      expect(x).toBeGreaterThanOrEqual(1.0);
      expect(y).toBeGreaterThanOrEqual(1.4);
      expect(x + w).toBeLessThanOrEqual(9.01);
      expect(y + h).toBeLessThanOrEqual(4.91);
    });
  });

  it("applies template objects to title/section and renders footer chrome", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const templateContext: SlideTemplateContext = {
      assetBaseDir: process.cwd(),
      templatePackage: {
        template: {
          id: "chrome-sample",
          source: {
            file: "sample.potx",
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
              h: 0.08,
              fill: "accent"
            },
            {
              type: "shape",
              shape: "rect",
              x: 0,
              y: 5.2,
              w: 10,
              h: 0.4,
              fill: "background-dark"
            }
          ]
        },
        chrome: {
          footer: {
            leftText: "Footer Text",
            showSlideNumber: true,
            color: "text-light",
            fontFace: "Noto Sans JP",
            fontSizePt: 11
          }
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
      metadata: { title: "template-chrome" },
      slides: [
        {
          type: "title",
          content: { title: "Title Slide" }
        },
        {
          type: "section",
          title: "Section Slide"
        },
        {
          type: "content",
          title: "Content Slide",
          content: [{ type: "text", content: "Body" }]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme, templateContext);
    expect(presentation.slides.length).toBe(3);

    presentation.slides.forEach((slide, index) => {
      expect(slide.count("shape")).toBeGreaterThan(1);
      const texts = slide.calls
        .filter((call) => call.kind === "text")
        .flatMap((call) => {
          const payload = call.payload as { text: string | Array<{ text: string }> };
          return typeof payload.text === "string" ? [payload.text] : payload.text.map((item) => item.text);
        });
      expect(texts).toContain("Footer Text");
      expect(texts).toContain(String(index + 1));
    });
  });

  it("uses adaptive footer placement and default color when template footer color is omitted", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const templateContext: SlideTemplateContext = {
      assetBaseDir: process.cwd(),
      templatePackage: {
        template: {
          id: "adaptive-footer",
          source: {
            file: "sample.potx",
            sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            importedAt: "2026-02-10T00:00:00.000Z"
          }
        },
        theme: {
          palette: {
            primary: "0B5FFF",
            secondary: "00A99D",
            accent: "FF6A00",
            "text-dark": "2C2C2C",
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
          objects: []
        },
        chrome: {
          footer: {
            leftText: "Footer Text",
            showSlideNumber: true,
            fontFace: "Noto Sans JP",
            fontSizePt: 10
          }
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
      metadata: { title: "adaptive-footer-check" },
      slides: [
        {
          type: "title",
          background: "dark",
          content: { title: "Title Slide" }
        },
        {
          type: "content",
          title: "Content Slide",
          content: [{ type: "text", content: "Body" }]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme, templateContext);

    const titleFooterCall = presentation.slides[0]?.calls.find((call) => {
      if (call.kind !== "text") {
        return false;
      }
      const payload = call.payload as { text: string };
      return payload.text === "Footer Text";
    });
    const contentFooterCall = presentation.slides[1]?.calls.find((call) => {
      if (call.kind !== "text") {
        return false;
      }
      const payload = call.payload as { text: string };
      return payload.text === "Footer Text";
    });
    const titlePageNumberCall = presentation.slides[0]?.calls.find((call) => {
      if (call.kind !== "text") {
        return false;
      }
      const payload = call.payload as { text: string };
      return payload.text === "1";
    });
    const contentPageNumberCall = presentation.slides[1]?.calls.find((call) => {
      if (call.kind !== "text") {
        return false;
      }
      const payload = call.payload as { text: string };
      return payload.text === "2";
    });

    if (
      titleFooterCall?.kind !== "text" ||
      contentFooterCall?.kind !== "text" ||
      titlePageNumberCall?.kind !== "text" ||
      contentPageNumberCall?.kind !== "text"
    ) {
      throw new Error("expected footer text calls");
    }

    const titleFooterOptions = (titleFooterCall.payload as { options?: Record<string, unknown> }).options;
    const contentFooterOptions = (contentFooterCall.payload as { options?: Record<string, unknown> }).options;
    const titlePageNumberOptions = (titlePageNumberCall.payload as { options?: Record<string, unknown> }).options;
    const contentPageNumberOptions = (contentPageNumberCall.payload as { options?: Record<string, unknown> }).options;

    expect((titleFooterOptions?.y as number) < 1).toBe(true);
    expect((contentFooterOptions?.y as number) < 1).toBe(true);
    expect((titlePageNumberOptions?.y as number) > 5).toBe(true);
    expect((contentPageNumberOptions?.y as number) < 1).toBe(true);
    expect(titleFooterOptions?.color).toBe("FFFFFF");
    expect(contentFooterOptions?.color).toBe("2C2C2C");
  });

  it("renders DSL chrome header divider and footer with metadata placeholders", async () => {
    const renderer = new SlideRenderer();
    const presentation = new MockPresentation();

    const dsl: PresentationDSL = {
      version: "1.0",
      theme: "corporate-blue",
      metadata: {
        title: "dsl-chrome",
        company: "Contoso Mobility",
        copyright: "Copyright (c) 2026 Contoso Mobility"
      },
      chrome: {
        header: {
          divider: {
            enabled: true,
            y: 1.18,
            color: "DDDDDD",
            width: 1
          }
        },
        footer: {
          enabled: true,
          leftText: "{company} | {copyright}",
          showSlideNumber: true,
          color: "text-dark",
          divider: {
            enabled: true,
            y: 5.42,
            color: "DDDDDD",
            width: 1
          }
        }
      },
      slides: [
        {
          type: "content",
          title: "Overview",
          content: [{ type: "text", content: "Body" }]
        }
      ]
    };

    await renderer.renderSlides(presentation, dsl, testTheme);
    const slide = presentation.slides[0];
    if (slide === undefined) {
      throw new Error("expected slide");
    }

    const lineCalls = slide.calls.filter((call) => {
      if (call.kind !== "shape") {
        return false;
      }
      const payload = call.payload as { shapeName?: string };
      return payload.shapeName === "line";
    });
    expect(lineCalls.length).toBe(2);

    const texts = slide.calls
      .filter((call) => call.kind === "text")
      .flatMap((call) => {
        const payload = call.payload as { text: string | Array<{ text: string }> };
        return typeof payload.text === "string" ? [payload.text] : payload.text.map((item) => item.text);
      });

    expect(texts).toContain("Contoso Mobility | Copyright (c) 2026 Contoso Mobility");
    expect(texts).toContain("1");
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
