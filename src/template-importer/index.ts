import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { TemplateImportError } from "../errors";
import type { Bounds } from "../types";
import type {
  ImportedTemplateImageObject,
  ImportedTemplateObject,
  ImportedTemplatePackage,
  ImportedTemplateShapeObject,
  TemplateImportOptions
} from "./types";

const EMU_PER_INCH = 914400;
const SLIDE_LAYOUT_PATH_PATTERN = /^ppt\/slideLayouts\/slideLayout\d+\.xml$/;
const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

type XmlRecord = Record<string, unknown>;

type ThemeExtraction = {
  palette: Record<string, string>;
  fonts: {
    title: string;
    heading: string;
    body: string;
    caption: string;
  };
};

type PlaceholderExtraction = {
  bounds: Bounds;
  style: {
    fontFace: string;
    fontSizePt?: number;
    color?: string;
  };
};

type BackgroundExtraction = {
  color?: string;
  imagePartPath?: string;
};

type InternalObject =
  | (Omit<ImportedTemplateShapeObject, "type"> & { type: "shape" })
  | { type: "image"; x: number; y: number; w: number; h: number; imagePartPath: string };

function asRecord(value: unknown): XmlRecord | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return value as XmlRecord;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return undefined;
}

function normalizeHex(value: string): string {
  return value.replace(/^#/, "").trim().toUpperCase();
}

function emuToInches(value: unknown): number | undefined {
  const raw = asString(value);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed / EMU_PER_INCH;
}

function relsPathForPart(partPath: string): string {
  const directory = path.posix.dirname(partPath);
  const fileName = path.posix.basename(partPath);
  return path.posix.join(directory, "_rels", `${fileName}.rels`);
}

function resolveTargetPath(partPath: string, target: string): string {
  return path.posix.normalize(path.posix.join(path.posix.dirname(partPath), target));
}

function parseXml(content: string, filePath: string): XmlRecord {
  try {
    const parsed = XML_PARSER.parse(content) as XmlRecord;
    return parsed;
  } catch (error) {
    throw new TemplateImportError(`Failed to parse XML: ${filePath}`, error);
  }
}

function getColorFromColorNode(colorNode: unknown, palette: Record<string, string>): string | undefined {
  const node = asRecord(colorNode);
  if (node === undefined) {
    return undefined;
  }

  const srgb = asRecord(node.srgbClr);
  const srgbValue = asString(srgb?.val);
  if (srgbValue !== undefined) {
    return normalizeHex(srgbValue);
  }

  const sys = asRecord(node.sysClr);
  const sysValue = asString(sys?.lastClr);
  if (sysValue !== undefined) {
    return normalizeHex(sysValue);
  }

  const scheme = asRecord(node.schemeClr);
  const schemeValue = asString(scheme?.val);
  if (schemeValue === undefined) {
    return undefined;
  }

  const schemeMap: Record<string, string> = {
    accent1: "accent1",
    accent2: "accent2",
    accent3: "accent3",
    accent4: "accent4",
    accent5: "accent5",
    accent6: "accent6",
    dk1: "text-dark",
    dk2: "text-dark",
    lt1: "text-light",
    lt2: "text-light",
    tx1: "text-dark",
    tx2: "text-light",
    bg1: "background-light",
    bg2: "background-dark"
  };

  const token = schemeMap[schemeValue];
  if (token === undefined) {
    return undefined;
  }

  return palette[token];
}

function detectSlideSize(presentationRoot: XmlRecord): "16:9" | "16:10" | "4:3" {
  const sldSz = asRecord(presentationRoot.sldSz);
  const cx = Number(asString(sldSz?.cx));
  const cy = Number(asString(sldSz?.cy));

  if (!Number.isFinite(cx) || !Number.isFinite(cy) || cy === 0) {
    return "16:9";
  }

  const ratio = cx / cy;
  const candidates = [
    { label: "16:9" as const, ratio: 16 / 9 },
    { label: "16:10" as const, ratio: 16 / 10 },
    { label: "4:3" as const, ratio: 4 / 3 }
  ];

  const nearest = candidates.reduce((best, candidate) => {
    const bestDiff = Math.abs(best.ratio - ratio);
    const currentDiff = Math.abs(candidate.ratio - ratio);
    return currentDiff < bestDiff ? candidate : best;
  });

  return nearest.label;
}

function extractColorFromScheme(colorContainer: unknown): string | undefined {
  const container = asRecord(colorContainer);
  if (container === undefined) {
    return undefined;
  }

  const srgb = asRecord(container.srgbClr);
  const srgbValue = asString(srgb?.val);
  if (srgbValue !== undefined) {
    return normalizeHex(srgbValue);
  }

  const sys = asRecord(container.sysClr);
  const sysValue = asString(sys?.lastClr);
  if (sysValue !== undefined) {
    return normalizeHex(sysValue);
  }

  return undefined;
}

function extractTheme(themeRoot: XmlRecord): ThemeExtraction {
  const themeElements = asRecord(themeRoot.themeElements);
  const clrScheme = asRecord(themeElements?.clrScheme);
  const fontScheme = asRecord(themeElements?.fontScheme);

  if (clrScheme === undefined || fontScheme === undefined) {
    throw new TemplateImportError("Theme file does not include required themeElements definitions");
  }

  const palette = {
    "text-dark": extractColorFromScheme(clrScheme.dk1) ?? extractColorFromScheme(clrScheme.tx1) ?? "2C2C2C",
    "text-light": extractColorFromScheme(clrScheme.lt1) ?? extractColorFromScheme(clrScheme.tx2) ?? "FFFFFF",
    "background-light": extractColorFromScheme(clrScheme.lt1) ?? "FFFFFF",
    "background-dark": extractColorFromScheme(clrScheme.dk1) ?? "1E2761",
    accent1: extractColorFromScheme(clrScheme.accent1) ?? "1E2761",
    accent2: extractColorFromScheme(clrScheme.accent2) ?? "CADCFC",
    accent3: extractColorFromScheme(clrScheme.accent3) ?? "FF6B35",
    accent4: extractColorFromScheme(clrScheme.accent4) ?? "10B981",
    accent5: extractColorFromScheme(clrScheme.accent5) ?? "F59E0B",
    accent6: extractColorFromScheme(clrScheme.accent6) ?? "EF4444"
  };

  const majorFont = asRecord(fontScheme.majorFont);
  const minorFont = asRecord(fontScheme.minorFont);
  const majorLatin = asRecord(majorFont?.latin);
  const minorLatin = asRecord(minorFont?.latin);
  const titleFont = asString(majorLatin?.typeface) ?? "Arial";
  const bodyFont = asString(minorLatin?.typeface) ?? "Arial";

  return {
    palette: {
      primary: palette.accent1,
      secondary: palette.accent2,
      accent: palette.accent3,
      ...palette
    },
    fonts: {
      title: titleFont,
      heading: titleFont,
      body: bodyFont,
      caption: bodyFont
    }
  };
}

function extractBoundsFromXfrm(xfrm: XmlRecord | undefined): Bounds | undefined {
  if (xfrm === undefined) {
    return undefined;
  }

  const off = asRecord(xfrm.off);
  const ext = asRecord(xfrm.ext);

  const x = emuToInches(off?.x);
  const y = emuToInches(off?.y);
  const w = emuToInches(ext?.cx);
  const h = emuToInches(ext?.cy);

  if (x === undefined || y === undefined || w === undefined || h === undefined) {
    return undefined;
  }

  return { x, y, w, h };
}

function extractBoundsFromShape(shape: XmlRecord): Bounds | undefined {
  const spPr = asRecord(shape.spPr);
  const xfrm = asRecord(spPr?.xfrm);
  return extractBoundsFromXfrm(xfrm);
}

function findShapePlaceholderType(shape: XmlRecord): "title" | "body" | undefined {
  const nvSpPr = asRecord(shape.nvSpPr);
  const nvPr = asRecord(nvSpPr?.nvPr);
  const ph = asRecord(nvPr?.ph);
  const type = asString(ph?.type);

  if (type === "title" || type === "ctrTitle") {
    return "title";
  }

  if (type === "body" || type === "obj" || type === "subTitle") {
    return "body";
  }

  const cNvPr = asRecord(nvSpPr?.cNvPr);
  const name = asString(cNvPr?.name)?.toLowerCase() ?? "";
  if (name.includes("title")) {
    return "title";
  }

  if (name.includes("content") || name.includes("body")) {
    return "body";
  }

  return undefined;
}

function extractTextStyleFromShape(
  shape: XmlRecord,
  palette: Record<string, string>,
  defaultFontFace: string,
  defaultColorToken: string
): PlaceholderExtraction["style"] {
  const txBody = asRecord(shape.txBody);
  const paragraphs = asArray(txBody?.p as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
  const firstParagraph = paragraphs[0];

  const runs = asArray(firstParagraph?.r as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
  const firstRun = runs[0];
  const rPr = asRecord(firstRun?.rPr) ?? asRecord(firstParagraph?.endParaRPr);

  const latin = asRecord(rPr?.latin);
  const fontFace = asString(latin?.typeface) ?? defaultFontFace;

  const sizeRaw = Number(asString(rPr?.sz));
  const fontSizePt = Number.isFinite(sizeRaw) ? sizeRaw / 100 : undefined;

  const color = getColorFromColorNode(rPr?.solidFill, palette) ?? palette[defaultColorToken];

  const style: PlaceholderExtraction["style"] = {
    fontFace
  };

  if (fontSizePt !== undefined) {
    style.fontSizePt = fontSizePt;
  }

  if (color !== undefined) {
    style.color = color;
  }

  return style;
}

function extractBackground(
  slideRoot: XmlRecord,
  relationships: Map<string, string>,
  palette: Record<string, string>,
  warnings: string[]
): BackgroundExtraction {
  const cSld = asRecord(slideRoot.cSld);
  const bg = asRecord(cSld?.bg);
  const bgPr = asRecord(bg?.bgPr);

  if (bgPr === undefined) {
    return {};
  }

  const color = getColorFromColorNode(bgPr.solidFill, palette);

  const blipFill = asRecord(bgPr.blipFill);
  const blip = asRecord(blipFill?.blip);
  const embed = asString(blip?.embed);
  if (embed === undefined) {
    const background: BackgroundExtraction = {};
    if (color !== undefined) {
      background.color = color;
    }
    return background;
  }

  const target = relationships.get(embed);
  if (target === undefined) {
    warnings.push(`Background image relationship '${embed}' was not resolved.`);
    const background: BackgroundExtraction = {};
    if (color !== undefined) {
      background.color = color;
    }
    return background;
  }

  const background: BackgroundExtraction = {
    imagePartPath: target
  };
  if (color !== undefined) {
    background.color = color;
  }

  return background;
}

function extractShapeText(shape: XmlRecord): string | undefined {
  const txBody = asRecord(shape.txBody);
  const paragraphs = asArray(txBody?.p as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
  const fragments: string[] = [];

  for (const paragraph of paragraphs) {
    const runs = asArray(paragraph.r as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
    for (const run of runs) {
      const text = asString(run.t);
      if (text !== undefined) {
        fragments.push(text);
      }
    }
  }

  if (fragments.length === 0) {
    return undefined;
  }

  return fragments.join(" ");
}

function extractDecorativeObjects(
  slideRoot: XmlRecord,
  relationships: Map<string, string>,
  palette: Record<string, string>,
  warnings: string[]
): InternalObject[] {
  const cSld = asRecord(slideRoot.cSld);
  const spTree = asRecord(cSld?.spTree);
  if (spTree === undefined) {
    return [];
  }

  const result: InternalObject[] = [];

  const shapes = asArray(spTree.sp as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
  for (const shape of shapes) {
    if (findShapePlaceholderType(shape) !== undefined) {
      continue;
    }

    const bounds = extractBoundsFromShape(shape);
    if (bounds === undefined) {
      warnings.push("Skipped shape without valid bounds.");
      continue;
    }

    const spPr = asRecord(shape.spPr);
    const prstGeom = asRecord(spPr?.prstGeom);
    const geometry = asString(prstGeom?.prst) ?? "rect";

    const fill = getColorFromColorNode(spPr?.solidFill, palette);
    const ln = asRecord(spPr?.ln);
    const lineColor = getColorFromColorNode(ln?.solidFill, palette);

    const shapeObject: InternalObject = {
      type: "shape",
      shape: geometry,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h
    };

    if (fill !== undefined) {
      shapeObject.fill = fill;
    }

    if (lineColor !== undefined) {
      shapeObject.lineColor = lineColor;
    }

    const text = extractShapeText(shape);
    if (text !== undefined) {
      shapeObject.text = text;
    }

    result.push(shapeObject);
  }

  const pictures = asArray(spTree.pic as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
  for (const picture of pictures) {
    const spPr = asRecord(picture.spPr);
    const xfrm = asRecord(spPr?.xfrm);
    const bounds = extractBoundsFromXfrm(xfrm);

    if (bounds === undefined) {
      warnings.push("Skipped picture without valid bounds.");
      continue;
    }

    const blipFill = asRecord(picture.blipFill);
    const blip = asRecord(blipFill?.blip);
    const embed = asString(blip?.embed);

    if (embed === undefined) {
      warnings.push("Skipped picture without relationship id.");
      continue;
    }

    const target = relationships.get(embed);
    if (target === undefined) {
      warnings.push(`Skipped picture with unresolved relationship '${embed}'.`);
      continue;
    }

    result.push({
      type: "image",
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      imagePartPath: target
    });
  }

  return result;
}

export class TemplateImporter {
  private readonly options: TemplateImportOptions;

  public constructor(options?: TemplateImportOptions) {
    this.options = options ?? {};
  }

  public async importFromFile(templatePath: string, outputDir: string): Promise<ImportedTemplatePackage> {
    const resolvedTemplatePath = path.resolve(templatePath);
    const extension = path.extname(resolvedTemplatePath).toLowerCase();

    if (extension !== ".pptx" && extension !== ".potx") {
      throw new TemplateImportError("Template file must be .pptx or .potx");
    }

    let templateBuffer: Buffer;
    try {
      templateBuffer = await fs.readFile(resolvedTemplatePath);
    } catch (error) {
      throw new TemplateImportError(`Failed to read template file: ${resolvedTemplatePath}`, error);
    }

    const sha256 = crypto.createHash("sha256").update(templateBuffer).digest("hex");
    const zip = await JSZip.loadAsync(templateBuffer);

    const presentationRoot = await this.readRootXml(zip, "ppt/presentation.xml", "presentation");
    const themeRoot = await this.readRootXml(zip, "ppt/theme/theme1.xml", "theme");

    const theme = extractTheme(themeRoot);
    const slideSize = detectSlideSize(presentationRoot);

    const layoutParts = Object.keys(zip.files)
      .filter((filePath) => SLIDE_LAYOUT_PATH_PATTERN.test(filePath))
      .sort((left, right) => left.localeCompare(right));

    if (layoutParts.length === 0) {
      throw new TemplateImportError("No slide layout files found in template.");
    }

    const warnings: string[] = [];
    const unsupported: string[] = [];

    const selectedLayout = await this.selectTitleBodyLayout(zip, layoutParts, theme, warnings);
    if (selectedLayout === undefined) {
      throw new TemplateImportError("No compatible title+body layout found. Exactly one title and one body placeholder are required.");
    }

    const layoutRels = await this.readRelationships(zip, selectedLayout.layoutPartPath);
    const masterPartPath = this.findRelationshipByType(layoutRels, "slideMaster");
    if (masterPartPath === undefined) {
      throw new TemplateImportError("Selected layout does not reference a slide master.");
    }

    const masterRoot = await this.readRootXml(zip, masterPartPath, "sldMaster");
    const masterRels = await this.readRelationships(zip, masterPartPath);

    const layoutBackground = extractBackground(selectedLayout.layoutRoot, layoutRels, theme.palette, warnings);
    const masterBackground = extractBackground(masterRoot, masterRels, theme.palette, warnings);

    const internalBackgroundImage = layoutBackground.imagePartPath ?? masterBackground.imagePartPath;
    const backgroundColor = layoutBackground.color ?? masterBackground.color;

    const objects = [
      ...extractDecorativeObjects(masterRoot, masterRels, theme.palette, warnings),
      ...extractDecorativeObjects(selectedLayout.layoutRoot, layoutRels, theme.palette, warnings)
    ];

    const resolvedOutputDir = path.resolve(outputDir);
    const assetsDir = path.join(resolvedOutputDir, "assets");
    await fs.mkdir(assetsDir, { recursive: true });

    const exportedAssetPathMap = new Map<string, string>();

    const backgroundImage =
      internalBackgroundImage === undefined
        ? undefined
        : await this.exportAsset(zip, internalBackgroundImage, assetsDir, exportedAssetPathMap);

    const exportedObjects: ImportedTemplateObject[] = [];
    for (const item of objects) {
      if (item.type === "shape") {
        exportedObjects.push(item);
        continue;
      }

      const source = await this.exportAsset(zip, item.imagePartPath, assetsDir, exportedAssetPathMap);
      const imageObject: ImportedTemplateImageObject = {
        type: "image",
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        source
      };
      exportedObjects.push(imageObject);
    }

    const templateId = this.options.templateId ?? path.basename(resolvedTemplatePath, extension);
    const background: ImportedTemplatePackage["background"] = {
      mode: "editable",
      objects: exportedObjects
    };
    if (backgroundColor !== undefined) {
      background.color = backgroundColor;
    }
    if (backgroundImage !== undefined) {
      background.image = backgroundImage;
    }

    const packageContent: ImportedTemplatePackage = {
      template: {
        id: templateId,
        source: {
          file: path.basename(resolvedTemplatePath),
          sha256,
          importedAt: new Date().toISOString()
        }
      },
      theme: {
        palette: theme.palette,
        fonts: theme.fonts,
        slideSize
      },
      layout: {
        kind: "title-body",
        placeholders: {
          title: selectedLayout.title,
          body: selectedLayout.body
        }
      },
      background,
      manifest: {
        warnings,
        unsupported
      }
    };

    await fs.mkdir(resolvedOutputDir, { recursive: true });
    await fs.writeFile(path.join(resolvedOutputDir, "template.yaml"), yaml.dump(packageContent, { noRefs: true, lineWidth: 120 }), "utf-8");
    await fs.writeFile(path.join(resolvedOutputDir, "manifest.json"), JSON.stringify(packageContent.manifest, null, 2), "utf-8");

    return packageContent;
  }

  private async selectTitleBodyLayout(
    zip: JSZip,
    layoutParts: string[],
    theme: ThemeExtraction,
    warnings: string[]
  ): Promise<
    | {
        layoutPartPath: string;
        layoutRoot: XmlRecord;
        title: PlaceholderExtraction;
        body: PlaceholderExtraction;
      }
    | undefined
  > {
    for (const layoutPartPath of layoutParts) {
      const layoutRoot = await this.readRootXml(zip, layoutPartPath, "sldLayout");
      const cSld = asRecord(layoutRoot.cSld);
      const spTree = asRecord(cSld?.spTree);
      if (spTree === undefined) {
        continue;
      }

      const shapes = asArray(spTree.sp as XmlRecord | XmlRecord[] | undefined).map(asRecord).filter(Boolean) as XmlRecord[];
      const titleCandidates: PlaceholderExtraction[] = [];
      const bodyCandidates: PlaceholderExtraction[] = [];

      for (const shape of shapes) {
        const placeholderType = findShapePlaceholderType(shape);
        if (placeholderType === undefined) {
          continue;
        }

        const bounds = extractBoundsFromShape(shape);
        if (bounds === undefined) {
          warnings.push(`Skipped placeholder in ${layoutPartPath} due to invalid bounds.`);
          continue;
        }

        if (placeholderType === "title") {
          titleCandidates.push({
            bounds,
            style: extractTextStyleFromShape(shape, theme.palette, theme.fonts.title, "text-dark")
          });
          continue;
        }

        bodyCandidates.push({
          bounds,
          style: extractTextStyleFromShape(shape, theme.palette, theme.fonts.body, "text-dark")
        });
      }

      if (titleCandidates.length === 1 && bodyCandidates.length === 1) {
        const title = titleCandidates[0];
        const body = bodyCandidates[0];
        if (title === undefined || body === undefined) {
          continue;
        }

        return {
          layoutPartPath,
          layoutRoot,
          title,
          body
        };
      }
    }

    return undefined;
  }

  private async readRootXml(zip: JSZip, partPath: string, expectedRootName: string): Promise<XmlRecord> {
    const file = zip.file(partPath);
    if (file === null) {
      throw new TemplateImportError(`Missing required OOXML part: ${partPath}`);
    }

    const xml = await file.async("text");
    const parsed = parseXml(xml, partPath);
    const root = asRecord(parsed[expectedRootName]);

    if (root === undefined) {
      throw new TemplateImportError(`Unexpected XML structure in ${partPath}. Missing root '${expectedRootName}'.`);
    }

    return root;
  }

  private async readRelationships(zip: JSZip, partPath: string): Promise<Map<string, string>> {
    const relsPath = relsPathForPart(partPath);
    const relsFile = zip.file(relsPath);
    if (relsFile === null) {
      return new Map();
    }

    const relsXml = await relsFile.async("text");
    const relsParsed = parseXml(relsXml, relsPath);
    const relationshipsRoot = asRecord(relsParsed.Relationships);
    const relationEntries = asArray(relationshipsRoot?.Relationship as XmlRecord | XmlRecord[] | undefined)
      .map(asRecord)
      .filter(Boolean) as XmlRecord[];

    const relMap = new Map<string, string>();
    for (const relation of relationEntries) {
      const id = asString(relation.Id);
      const target = asString(relation.Target);
      if (id === undefined || target === undefined) {
        continue;
      }

      relMap.set(id, resolveTargetPath(partPath, target));
    }

    return relMap;
  }

  private findRelationshipByType(relationships: Map<string, string>, relationshipTypeSuffix: string): string | undefined {
    // Relationship type is only available in rels XML attributes; path suffix fallback is acceptable for constrained importer.
    for (const target of relationships.values()) {
      if (target.includes(relationshipTypeSuffix)) {
        return target;
      }
    }

    for (const target of relationships.values()) {
      if (target.includes("slideMasters")) {
        return target;
      }
    }

    return undefined;
  }

  private async exportAsset(
    zip: JSZip,
    partPath: string,
    assetsDir: string,
    exportedAssetPathMap: Map<string, string>
  ): Promise<string> {
    const normalizedPartPath = path.posix.normalize(partPath);
    const cached = exportedAssetPathMap.get(normalizedPartPath);
    if (cached !== undefined) {
      return cached;
    }

    const file = zip.file(normalizedPartPath);
    if (file === null) {
      throw new TemplateImportError(`Referenced asset not found in template: ${normalizedPartPath}`);
    }

    const sourceBuffer = await file.async("nodebuffer");
    const baseName = path.basename(normalizedPartPath);
    const extension = path.extname(baseName);
    const nameWithoutExtension = path.basename(baseName, extension);

    let candidateName = baseName;
    let serial = 1;
    while (true) {
      try {
        await fs.access(path.join(assetsDir, candidateName));
        candidateName = `${nameWithoutExtension}-${serial}${extension}`;
        serial += 1;
      } catch {
        break;
      }
    }

    const outputPath = path.join(assetsDir, candidateName);
    await fs.writeFile(outputPath, sourceBuffer);

    const relativePath = path.posix.join("assets", candidateName);
    exportedAssetPathMap.set(normalizedPartPath, relativePath);
    return relativePath;
  }
}

export const __templateImporterInternals = Object.freeze({
  asRecord,
  asArray,
  asString,
  normalizeHex,
  emuToInches,
  relsPathForPart,
  resolveTargetPath,
  parseXml,
  getColorFromColorNode,
  detectSlideSize,
  extractColorFromScheme,
  extractTheme,
  extractBoundsFromXfrm,
  extractBoundsFromShape,
  findShapePlaceholderType,
  extractTextStyleFromShape,
  extractBackground,
  extractShapeText,
  extractDecorativeObjects
});

export { parseImportedTemplatePackage } from "./types";
export type { ImportedTemplatePackage, TemplateImportOptions } from "./types";
