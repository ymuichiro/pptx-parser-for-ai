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
import type { SlideAdapter } from "../../src/renderers";
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
});
