import * as fs from "node:fs/promises";
import JSZip from "jszip";
import { IOError } from "../errors";

const CHART_XML_PATH = /^ppt\/charts\/chart\d+\.xml$/;
const EMBEDDED_WORKBOOK_PATH = /^ppt\/embeddings\/[^/]+\.xlsx$/i;
const WORKBOOK_TABLE_XML_PATH = /^xl\/tables\/[^/]+\.xml$/;
const CHART_SECTION_PATTERN = /<c:([A-Za-z0-9]+Chart)\b[^>]*>[\s\S]*?<\/c:\1>/g;
const AXIS_REF_PATTERN = /<c:axId val="([^"]+)"\/>/g;
const DEFINED_AXIS_PATTERN = /<c:(?:catAx|valAx|dateAx|serAx)\b[^>]*>[\s\S]*?<c:axId val="([^"]+)"\/>/g;
const BROKEN_TABLE_REF_PATTERN = /(\bref="[^"]+)'"/g;

function collectDefinedAxisIds(chartXml: string): Set<string> {
  const axisIds = new Set<string>();
  for (const match of chartXml.matchAll(DEFINED_AXIS_PATTERN)) {
    const axisId = match[1];
    if (axisId !== undefined) {
      axisIds.add(axisId);
    }
  }
  return axisIds;
}

export function normalizeChartAxisReferences(chartXml: string): string {
  const definedAxisIds = collectDefinedAxisIds(chartXml);
  if (definedAxisIds.size === 0) {
    return chartXml;
  }

  return chartXml.replace(CHART_SECTION_PATTERN, (chartSection) =>
    chartSection.replace(AXIS_REF_PATTERN, (axisRefTag, axisId) => (definedAxisIds.has(axisId) ? axisRefTag : ""))
  );
}

export function normalizeWorkbookTableReferences(tableXml: string): string {
  return tableXml.replace(BROKEN_TABLE_REF_PATTERN, "$1\"");
}

export async function applyKeynoteChartCompatibilityFix(pptxPath: string): Promise<void> {
  let archiveBuffer: Buffer;
  try {
    archiveBuffer = await fs.readFile(pptxPath);
  } catch (error) {
    throw new IOError(`Failed to read presentation for chart compatibility patch: ${pptxPath}`, error);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archiveBuffer);
  } catch (error) {
    throw new IOError(`Failed to parse presentation archive for chart compatibility patch: ${pptxPath}`, error);
  }

  let modified = false;
  for (const filePath of Object.keys(zip.files)) {
    if (!CHART_XML_PATH.test(filePath)) {
      continue;
    }
    const file = zip.file(filePath);
    if (file === null) {
      continue;
    }

    const chartXml = await file.async("string");
    const normalizedXml = normalizeChartAxisReferences(chartXml);
    if (normalizedXml !== chartXml) {
      zip.file(filePath, normalizedXml);
      modified = true;
    }
  }

  for (const filePath of Object.keys(zip.files)) {
    if (!EMBEDDED_WORKBOOK_PATH.test(filePath)) {
      continue;
    }
    const file = zip.file(filePath);
    if (file === null) {
      continue;
    }

    const workbookBuffer = await file.async("nodebuffer");

    let workbookZip: JSZip;
    try {
      workbookZip = await JSZip.loadAsync(workbookBuffer);
    } catch (error) {
      throw new IOError(`Failed to parse embedded workbook for chart compatibility patch: ${filePath}`, error);
    }

    let workbookModified = false;
    for (const workbookFilePath of Object.keys(workbookZip.files)) {
      if (!WORKBOOK_TABLE_XML_PATH.test(workbookFilePath)) {
        continue;
      }
      const workbookFile = workbookZip.file(workbookFilePath);
      if (workbookFile === null) {
        continue;
      }

      const tableXml = await workbookFile.async("string");
      const normalizedTableXml = normalizeWorkbookTableReferences(tableXml);
      if (normalizedTableXml !== tableXml) {
        workbookZip.file(workbookFilePath, normalizedTableXml);
        workbookModified = true;
      }
    }

    if (!workbookModified) {
      continue;
    }

    let patchedWorkbookBuffer: Buffer;
    try {
      patchedWorkbookBuffer = await workbookZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    } catch (error) {
      throw new IOError(`Failed to generate patched workbook archive for chart compatibility: ${filePath}`, error);
    }

    zip.file(filePath, patchedWorkbookBuffer);
    modified = true;
  }

  if (!modified) {
    return;
  }

  let patchedBuffer: Buffer;
  try {
    patchedBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (error) {
    throw new IOError(`Failed to generate patched presentation archive: ${pptxPath}`, error);
  }

  try {
    await fs.writeFile(pptxPath, patchedBuffer);
  } catch (error) {
    throw new IOError(`Failed to write patched presentation archive: ${pptxPath}`, error);
  }
}
