import * as fs from "node:fs/promises";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { PPTXRenderer } from "../../src";
import { LayoutEngine } from "../../src/layout";
import { DSLParser } from "../../src/parser";
import type { PresentationDSL } from "../../src/types";
import { testTheme } from "../helpers/theme";

interface Baseline {
  parseMs: number;
  layoutMs: number;
  generateMs: number;
  peakHeapMb: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? sorted[middle] ?? 0) + (sorted[middle] ?? sorted[middle - 1] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
}

function createPerformanceDSL(): PresentationDSL {
  return {
    version: "1.0",
    theme: "corporate-blue",
    metadata: {
      title: "performance"
    },
    slides: Array.from({ length: 20 }).map((_, slideIndex) => ({
      type: "content" as const,
      title: `Slide ${slideIndex + 1}`,
      content: [
        { type: "text" as const, content: `Summary ${slideIndex}` },
        {
          type: "chart" as const,
          chartType: "bar" as const,
          data: {
            labels: ["Q1", "Q2", "Q3", "Q4"],
            series: [
              {
                name: "Revenue",
                values: [110, 120, 130, 140]
              }
            ]
          }
        },
        {
          type: "table" as const,
          headers: ["K", "V"],
          rows: [
            ["a", 1],
            ["b", 2]
          ]
        }
      ]
    }))
  };
}

describe("Performance regression", () => {
  it("stays within baseline thresholds", async () => {
    const baselinePath = path.resolve(process.cwd(), "tests", "fixtures", "performance", "baseline.json");
    const baseline = JSON.parse(await fs.readFile(baselinePath, "utf-8")) as Baseline;

    const parser = new DSLParser();
    const layoutEngine = new LayoutEngine(testTheme);
    const dsl = createPerformanceDSL();

    const parseSamples: number[] = [];
    const layoutSamples: number[] = [];
    let peakHeap = process.memoryUsage().heapUsed;

    for (let index = 0; index < 5; index += 1) {
      const yamlLike = JSON.stringify(dsl);
      const startParse = performance.now();
      const parsed = JSON.parse(yamlLike);
      const validation = parser.validate(parsed);
      if (!validation.isValid) {
        throw new Error(`performance fixture became invalid: ${validation.errors.join(";")}`);
      }
      parser.normalize(parsed);
      parseSamples.push(performance.now() - startParse);

      const startLayout = performance.now();
      dsl.slides.forEach((slide) => {
        if (slide.type === "content") {
          layoutEngine.calculateLayout(slide.content, "auto");
        }
      });
      layoutSamples.push(performance.now() - startLayout);

      peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
    }

    const renderer = new PPTXRenderer();
    const outputPath = path.resolve(process.cwd(), ".tmp", "performance", "perf.pptx");
    const generateStart = performance.now();
    await renderer.generate(dsl, outputPath);
    const generateMs = performance.now() - generateStart;

    const parseMedian = median(parseSamples);
    const layoutMedian = median(layoutSamples);
    const peakHeapMb = peakHeap / 1024 / 1024;

    expect(parseMedian).toBeLessThanOrEqual(baseline.parseMs * 1.1);
    expect(layoutMedian).toBeLessThanOrEqual(baseline.layoutMs * 1.1);
    expect(generateMs).toBeLessThanOrEqual(baseline.generateMs * 1.1);
    expect(peakHeapMb).toBeLessThanOrEqual(baseline.peakHeapMb);
  }, 120_000);
});
