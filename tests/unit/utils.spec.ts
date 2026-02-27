import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  applyKeynoteChartCompatibilityFix,
  normalizeChartAxisReferences,
  normalizeWorkbookTableReferences
} from "../../src/utils/chart-compat";
import { normalizeHexColor, resolveThemeColor } from "../../src/utils/color";
import { enforceStructuralLimits } from "../../src/utils/deep-limit";
import { areaOverlaps, clampBounds, isInsideBounds } from "../../src/utils/geometry";
import { ensureOutputDir, resolveAndValidatePath } from "../../src/utils/paths";
import { testTheme } from "../helpers/theme";

describe("utils", () => {
  it("normalizes and resolves colors", () => {
    expect(normalizeHexColor("#ff00aa")).toBe("FF00AA");
    expect(resolveThemeColor(testTheme, "primary", "primary")).toBe("1E2761");
    expect(resolveThemeColor(testTheme, undefined, "primary")).toBe("1E2761");
    expect(() => normalizeHexColor("not-a-color")).toThrowError(/Invalid color/);
  });

  it("enforces structural limits", () => {
    const violations = enforceStructuralLimits({ value: "x".repeat(10_001) });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("checks geometry helpers", () => {
    expect(areaOverlaps({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.5, y: 0.5, w: 1, h: 1 })).toBe(true);
    expect(isInsideBounds({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, { x: 0, y: 0, w: 1, h: 1 })).toBe(true);

    const clamped = clampBounds({ x: -1, y: -1, w: 3, h: 3 }, { x: 0, y: 0, w: 1, h: 1 });
    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
    expect(clamped.w).toBeLessThanOrEqual(1);
    expect(clamped.h).toBeLessThanOrEqual(1);
  });

  it("resolves safe paths and creates output directory", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-paths-"));
    const nestedPath = path.join(tempDir, "nested", "file.txt");

    await ensureOutputDir(nestedPath);
    await fs.writeFile(nestedPath, "ok", "utf-8");

    const safePath = await resolveAndValidatePath(nestedPath, [tempDir]);
    expect(safePath.endsWith("file.txt")).toBe(true);

    await expect(resolveAndValidatePath(path.join(tempDir, "..", "escape.txt"), [tempDir])).rejects.toThrow();
  });

  it("removes dangling chart axis IDs while preserving defined ones", () => {
    const danglingAxisXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
      "<c:chart><c:plotArea>" +
      '<c:barChart><c:axId val="1"/><c:axId val="2"/><c:axId val="3"/></c:barChart>' +
      '<c:catAx><c:axId val="1"/></c:catAx>' +
      '<c:valAx><c:axId val="2"/></c:valAx>' +
      "</c:plotArea></c:chart>" +
      "</c:chartSpace>";

    const normalizedDangling = normalizeChartAxisReferences(danglingAxisXml);
    expect(normalizedDangling).toContain('<c:barChart><c:axId val="1"/><c:axId val="2"/></c:barChart>');
    expect(normalizedDangling).not.toContain('<c:axId val="3"/></c:barChart>');

    const definedSeriesAxisXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
      "<c:chart><c:plotArea>" +
      '<c:bar3DChart><c:axId val="1"/><c:axId val="2"/><c:axId val="3"/></c:bar3DChart>' +
      '<c:catAx><c:axId val="1"/></c:catAx>' +
      '<c:valAx><c:axId val="2"/></c:valAx>' +
      '<c:serAx><c:axId val="3"/></c:serAx>' +
      "</c:plotArea></c:chart>" +
      "</c:chartSpace>";

    const normalizedDefined = normalizeChartAxisReferences(definedSeriesAxisXml);
    expect(normalizedDefined).toContain('<c:bar3DChart><c:axId val="1"/><c:axId val="2"/><c:axId val="3"/></c:bar3DChart>');
  });

  it("patches chart XML inside generated pptx archive", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-chart-compat-"));
    const pptxPath = path.join(tempDir, "sample.pptx");

    const chartXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
      "<c:chart><c:plotArea>" +
      '<c:barChart><c:axId val="11"/><c:axId val="22"/><c:axId val="33"/></c:barChart>' +
      '<c:catAx><c:axId val="11"/></c:catAx>' +
      '<c:valAx><c:axId val="22"/></c:valAx>' +
      "</c:plotArea></c:chart>" +
      "</c:chartSpace>";

    const zip = new JSZip();
    zip.file("ppt/charts/chart1.xml", chartXml);
    zip.file("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    const rawArchive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await fs.writeFile(pptxPath, rawArchive);

    await applyKeynoteChartCompatibilityFix(pptxPath);

    const patchedArchive = await fs.readFile(pptxPath);
    const patchedZip = await JSZip.loadAsync(patchedArchive);
    const patchedChartFile = patchedZip.file("ppt/charts/chart1.xml");
    expect(patchedChartFile).not.toBeNull();
    const patchedChartXml = await patchedChartFile!.async("string");

    expect(patchedChartXml).toContain('<c:barChart><c:axId val="11"/><c:axId val="22"/></c:barChart>');
    expect(patchedChartXml).not.toContain('<c:axId val="33"/></c:barChart>');
  });

  it("normalizes invalid workbook table reference", () => {
    const invalidTableXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ref="A1:B5\'" totalsRowShown="0"/>';

    const normalized = normalizeWorkbookTableReferences(invalidTableXml);
    expect(normalized).toContain('ref="A1:B5"');
    expect(normalized).not.toContain('A1:B5\'"');
  });

  it("patches invalid table references in embedded chart workbooks", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-chart-workbook-compat-"));
    const pptxPath = path.join(tempDir, "sample.pptx");

    const workbookZip = new JSZip();
    workbookZip.file(
      "xl/tables/table1.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ref="A1:B5\'" totalsRowShown="0"/>'
    );
    workbookZip.file("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    const workbookBuffer = await workbookZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    const zip = new JSZip();
    zip.file("ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx", workbookBuffer);
    zip.file("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    const rawArchive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await fs.writeFile(pptxPath, rawArchive);

    await applyKeynoteChartCompatibilityFix(pptxPath);

    const patchedArchive = await fs.readFile(pptxPath);
    const patchedZip = await JSZip.loadAsync(patchedArchive);
    const patchedWorkbookFile = patchedZip.file("ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx");
    expect(patchedWorkbookFile).not.toBeNull();

    const patchedWorkbookBuffer = await patchedWorkbookFile!.async("nodebuffer");
    const patchedWorkbookZip = await JSZip.loadAsync(patchedWorkbookBuffer);
    const patchedTable = await patchedWorkbookZip.file("xl/tables/table1.xml")!.async("string");
    expect(patchedTable).toContain('ref="A1:B5"');
    expect(patchedTable).not.toContain("A1:B5'");
  });
});
