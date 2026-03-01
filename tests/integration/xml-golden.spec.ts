import * as fs from "node:fs/promises";
import * as path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { PPTXRenderer } from "../../src";
import type { PresentationDSL } from "../../src/types";

const fixturePath = (name: string): string => path.resolve(process.cwd(), "tests", "fixtures", "golden", name);

function normalizeXml(xml: string): string {
  return xml.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
}

async function extractSlideXml(pptxPath: string, slideNumber = 1): Promise<string> {
  const buffer = await fs.readFile(pptxPath);
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(`ppt/slides/slide${slideNumber}.xml`);
  if (entry === null) {
    throw new Error(`slide${slideNumber}.xml not found in ${pptxPath}`);
  }

  const xml = await entry.async("string");
  return normalizeXml(xml);
}

describe("XML golden", () => {
  it("matches preset-only golden XML", async () => {
    const renderer = new PPTXRenderer({
      enableQA: true
    });

    const dsl: PresentationDSL = {
      version: "2.0",
      theme: "venture-teal",
      metadata: { title: "XML Golden" },
      slides: [
        {
          type: "content",
          title: "Preset Only",
          preset: "compare-3col",
          content: [
            { type: "text", content: "Left", slot: "left" },
            { type: "text", content: "Center", slot: "center" },
            { type: "text", content: "Right", slot: "right" },
            { type: "text", content: "Summary" }
          ]
        }
      ]
    };

    const outputPath = path.resolve(process.cwd(), ".tmp", "integration", "xml-golden-preset-only.pptx");
    await renderer.generate(dsl, outputPath);

    const actualXml = await extractSlideXml(outputPath, 1);
    const expectedXml = normalizeXml(await fs.readFile(fixturePath("preset-only-slide1.xml"), "utf-8"));
    expect(actualXml).toBe(expectedXml);
  });

  it("matches preset+template golden XML", async () => {
    const renderer = new PPTXRenderer({
      enableQA: true,
      templatePackagePath: path.resolve(process.cwd(), "example", "templates", "venture-teal", "template.yaml")
    });

    const dsl: PresentationDSL = {
      version: "2.0",
      theme: "venture-teal",
      metadata: { title: "XML Golden Template" },
      slides: [
        {
          type: "content",
          title: "Preset Template",
          preset: "kpi-with-callout",
          content: [
            {
              type: "chart",
              slot: "kpi",
              chartType: "bar",
              data: {
                labels: ["Q1", "Q2", "Q3"],
                series: [{ name: "Revenue", values: [34, 42, 57] }]
              }
            },
            {
              type: "text",
              slot: "narrative",
              content: "Narrative block"
            },
            {
              type: "stat-callout",
              slot: "callout",
              value: "+28%",
              label: "Growth"
            },
            {
              type: "text",
              slot: "trend",
              content: "Trend insight"
            }
          ]
        }
      ]
    };

    const outputPath = path.resolve(process.cwd(), ".tmp", "integration", "xml-golden-template.pptx");
    await renderer.generate(dsl, outputPath);

    const actualXml = await extractSlideXml(outputPath, 1);
    const expectedXml = normalizeXml(await fs.readFile(fixturePath("preset-template-slide1.xml"), "utf-8"));
    expect(actualXml).toBe(expectedXml);
  });
});
