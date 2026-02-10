import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { TemplateImportError, TemplateImporter, __templateImporterInternals } from "../../src";

describe("TemplateImporter internals", () => {
  it("covers base utility helpers", () => {
    expect(__templateImporterInternals.asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(__templateImporterInternals.asRecord(null)).toBeUndefined();

    expect(__templateImporterInternals.asArray(undefined)).toEqual([]);
    expect(__templateImporterInternals.asArray("x")).toEqual(["x"]);
    expect(__templateImporterInternals.asArray(["x"]).length).toBe(1);

    expect(__templateImporterInternals.asString("ok")).toBe("ok");
    expect(__templateImporterInternals.asString(1)).toBeUndefined();

    expect(__templateImporterInternals.normalizeHex("#ffaa00")).toBe("FFAA00");
    expect(__templateImporterInternals.emuToInches(undefined)).toBeUndefined();
    expect(__templateImporterInternals.emuToInches("abc")).toBeUndefined();
    expect(__templateImporterInternals.emuToInches("914400")).toBe(1);

    expect(__templateImporterInternals.relsPathForPart("ppt/slideLayouts/slideLayout1.xml")).toBe(
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels"
    );
    expect(__templateImporterInternals.resolveTargetPath("ppt/slideLayouts/slideLayout1.xml", "../slideMasters/slideMaster1.xml")).toBe(
      "ppt/slideMasters/slideMaster1.xml"
    );
  });

  it("parses xml and throws on malformed xml", () => {
    const parsed = __templateImporterInternals.parseXml("<root><child/></root>", "x.xml");
    expect(parsed.root).toBeDefined();

    expect(() => __templateImporterInternals.parseXml("<root><", "broken.xml")).toThrowError(TemplateImportError);
  });

  it("extracts color and size related branches", () => {
    const palette = {
      accent1: "111111",
      accent2: "222222",
      accent3: "333333",
      "text-dark": "444444",
      "text-light": "FFFFFF",
      "background-light": "EEEEEE",
      "background-dark": "000000"
    };

    expect(__templateImporterInternals.getColorFromColorNode(undefined, palette)).toBeUndefined();
    expect(__templateImporterInternals.getColorFromColorNode({ srgbClr: { val: "abcdef" } }, palette)).toBe("ABCDEF");
    expect(__templateImporterInternals.getColorFromColorNode({ sysClr: { lastClr: "123456" } }, palette)).toBe("123456");
    expect(__templateImporterInternals.getColorFromColorNode({ schemeClr: { val: "accent1" } }, palette)).toBe("111111");
    expect(__templateImporterInternals.getColorFromColorNode({ schemeClr: { val: "unknown" } }, palette)).toBeUndefined();

    expect(__templateImporterInternals.detectSlideSize({ sldSz: { cx: "12192000", cy: "6858000" } })).toBe("16:9");
    expect(__templateImporterInternals.detectSlideSize({ sldSz: { cx: "12192000", cy: "7620000" } })).toBe("16:10");
    expect(__templateImporterInternals.detectSlideSize({ sldSz: { cx: "9144000", cy: "6858000" } })).toBe("4:3");
    expect(__templateImporterInternals.detectSlideSize({ sldSz: { cx: "0", cy: "0" } })).toBe("16:9");

    expect(__templateImporterInternals.extractColorFromScheme({ srgbClr: { val: "aa11bb" } })).toBe("AA11BB");
    expect(__templateImporterInternals.extractColorFromScheme({ sysClr: { lastClr: "ccddff" } })).toBe("CCDDFF");
    expect(__templateImporterInternals.extractColorFromScheme(undefined)).toBeUndefined();
  });

  it("extracts theme and validates missing schema", () => {
    const theme = __templateImporterInternals.extractTheme({
      themeElements: {
        clrScheme: {
          dk1: { srgbClr: { val: "111111" } },
          lt1: { srgbClr: { val: "F1F1F1" } },
          accent1: { srgbClr: { val: "100000" } },
          accent2: { srgbClr: { val: "200000" } },
          accent3: { srgbClr: { val: "300000" } },
          accent4: { srgbClr: { val: "400000" } },
          accent5: { srgbClr: { val: "500000" } },
          accent6: { srgbClr: { val: "600000" } }
        },
        fontScheme: {
          majorFont: { latin: { typeface: "Major" } },
          minorFont: { latin: { typeface: "Minor" } }
        }
      }
    });

    expect(theme.palette.primary).toBe("100000");
    expect(theme.fonts.title).toBe("Major");
    expect(theme.fonts.body).toBe("Minor");

    expect(() => __templateImporterInternals.extractTheme({})).toThrowError(TemplateImportError);
  });

  it("extracts bounds and placeholder style branches", () => {
    expect(
      __templateImporterInternals.extractBoundsFromXfrm({
        off: { x: "914400", y: "1828800" },
        ext: { cx: "1828800", cy: "914400" }
      })
    ).toEqual({ x: 1, y: 2, w: 2, h: 1 });

    expect(__templateImporterInternals.extractBoundsFromXfrm(undefined)).toBeUndefined();
    expect(__templateImporterInternals.extractBoundsFromXfrm({ off: { x: "abc", y: "1" }, ext: { cx: "1", cy: "1" } })).toBeUndefined();

    expect(__templateImporterInternals.findShapePlaceholderType({ nvSpPr: { nvPr: { ph: { type: "title" } } } })).toBe("title");
    expect(__templateImporterInternals.findShapePlaceholderType({ nvSpPr: { nvPr: { ph: { type: "obj" } } } })).toBe("body");
    expect(__templateImporterInternals.findShapePlaceholderType({ nvSpPr: { cNvPr: { name: "Content Placeholder" } } })).toBe("body");
    expect(__templateImporterInternals.findShapePlaceholderType({ nvSpPr: { cNvPr: { name: "Random" } } })).toBeUndefined();

    const styleA = __templateImporterInternals.extractTextStyleFromShape(
      {
        txBody: {
          p: {
            r: {
              rPr: {
                sz: "2400",
                latin: { typeface: "Inter" },
                solidFill: { srgbClr: { val: "123456" } }
              }
            }
          }
        }
      },
      { "text-dark": "111111" },
      "Arial",
      "text-dark"
    );
    expect(styleA.fontFace).toBe("Inter");
    expect(styleA.fontSizePt).toBe(24);
    expect(styleA.color).toBe("123456");

    const styleB = __templateImporterInternals.extractTextStyleFromShape(
      { txBody: { p: {} } },
      { "text-dark": "111111" },
      "Arial",
      "text-dark"
    );
    expect(styleB.fontFace).toBe("Arial");
    expect(styleB.color).toBe("111111");
  });

  it("extracts background and decorative objects branches", () => {
    const warnings: string[] = [];
    const palette = { primary: "111111", "text-dark": "222222", accent1: "333333" };

    expect(__templateImporterInternals.extractBackground({}, new Map(), palette, warnings)).toEqual({});
    expect(
      __templateImporterInternals.extractBackground(
        { cSld: { bg: { bgPr: { solidFill: { srgbClr: { val: "ffffff" } } } } } },
        new Map(),
        palette,
        warnings
      )
    ).toEqual({ color: "FFFFFF" });

    const unresolvedBackground = __templateImporterInternals.extractBackground(
      { cSld: { bg: { bgPr: { blipFill: { blip: { embed: "rId1" } } } } } },
      new Map(),
      palette,
      warnings
    );
    expect(unresolvedBackground).toEqual({});
    expect(warnings.length).toBeGreaterThan(0);

    const resolvedBackground = __templateImporterInternals.extractBackground(
      { cSld: { bg: { bgPr: { blipFill: { blip: { embed: "rId1" } } } } } },
      new Map([["rId1", "ppt/media/a.png"]]),
      palette,
      warnings
    );
    expect(resolvedBackground.imagePartPath).toBe("ppt/media/a.png");

    expect(__templateImporterInternals.extractShapeText({ txBody: { p: { r: { t: "Hello" } } } })).toBe("Hello");
    expect(__templateImporterInternals.extractShapeText({ txBody: { p: {} } })).toBeUndefined();

    const objects = __templateImporterInternals.extractDecorativeObjects(
      {
        cSld: {
          spTree: {
            sp: [
              {
                nvSpPr: { nvPr: { ph: { type: "title" } } },
                spPr: { xfrm: { off: { x: "1", y: "1" }, ext: { cx: "1", cy: "1" } } }
              },
              {
                nvSpPr: { cNvPr: { name: "No Bounds" } },
                spPr: { xfrm: { off: { x: "oops", y: "1" }, ext: { cx: "1", cy: "1" } } }
              },
              {
                nvSpPr: { cNvPr: { name: "Decorative" } },
                spPr: {
                  xfrm: { off: { x: "914400", y: "914400" }, ext: { cx: "914400", cy: "914400" } },
                  prstGeom: { prst: "ellipse" },
                  solidFill: { srgbClr: { val: "aa00aa" } },
                  ln: { solidFill: { srgbClr: { val: "00aa00" } } }
                },
                txBody: { p: { r: { t: "shape" } } }
              }
            ],
            pic: [
              {
                spPr: { xfrm: { off: { x: "abc", y: "1" }, ext: { cx: "1", cy: "1" } } },
                blipFill: { blip: { embed: "rIdX" } }
              },
              {
                spPr: { xfrm: { off: { x: "914400", y: "1" }, ext: { cx: "1", cy: "1" } } },
                blipFill: { blip: {} }
              },
              {
                spPr: { xfrm: { off: { x: "914400", y: "1" }, ext: { cx: "1", cy: "1" } } },
                blipFill: { blip: { embed: "rIdMissing" } }
              },
              {
                spPr: { xfrm: { off: { x: "914400", y: "1" }, ext: { cx: "1", cy: "1" } } },
                blipFill: { blip: { embed: "rIdOk" } }
              }
            ]
          }
        }
      },
      new Map([["rIdOk", "ppt/media/image.png"]]),
      palette,
      warnings
    );

    expect(objects.some((item) => item.type === "shape")).toBe(true);
    expect(objects.some((item) => item.type === "image")).toBe(true);
  });

  it("covers private relationship and asset branches", async () => {
    const importer = new TemplateImporter() as unknown as {
      readRelationships: (zip: JSZip, partPath: string) => Promise<Map<string, string>>;
      findRelationshipByType: (relationships: Map<string, string>, relationshipTypeSuffix: string) => string | undefined;
      exportAsset: (zip: JSZip, partPath: string, assetsDir: string, cache: Map<string, string>) => Promise<string>;
      readRootXml: (zip: JSZip, partPath: string, rootName: string) => Promise<Record<string, unknown>>;
    };

    const zip = new JSZip();
    zip.file("ppt/slideLayouts/slideLayout1.xml", "<sldLayout><cSld/></sldLayout>");
    zip.file(
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      '<Relationships><Relationship Id="rId1" Target="../slideMasters/slideMaster1.xml"/></Relationships>'
    );
    zip.file("ppt/media/image1.png", Buffer.from([1, 2, 3]));

    const rels = await importer.readRelationships(zip, "ppt/slideLayouts/slideLayout1.xml");
    expect(rels.get("rId1")).toBe("ppt/slideMasters/slideMaster1.xml");

    const noRels = await importer.readRelationships(zip, "ppt/slideLayouts/unknown.xml");
    expect(noRels.size).toBe(0);

    expect(importer.findRelationshipByType(new Map([["x", "ppt/slideMasterA.xml"]]), "slideMaster")).toContain("slideMaster");
    expect(importer.findRelationshipByType(new Map([["x", "ppt/slideMasters/slideMaster1.xml"]]), "missing")).toContain("slideMasters");
    expect(importer.findRelationshipByType(new Map([["x", "ppt/other.xml"]]), "missing")).toBeUndefined();

    const assetsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "template-assets-"));
    const assetsDir = path.join(assetsRoot, "assets");
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(path.join(assetsDir, "image1.png"), Buffer.from([9]));

    const cache = new Map<string, string>();
    const exported = await importer.exportAsset(zip, "ppt/media/image1.png", assetsDir, cache);
    expect(exported).toBe("assets/image1-1.png");

    const cached = await importer.exportAsset(zip, "ppt/media/image1.png", assetsDir, cache);
    expect(cached).toBe("assets/image1-1.png");

    await expect(importer.exportAsset(zip, "ppt/media/missing.png", assetsDir, cache)).rejects.toBeInstanceOf(TemplateImportError);

    await expect(importer.readRootXml(zip, "ppt/missing.xml", "sldLayout")).rejects.toBeInstanceOf(TemplateImportError);

    zip.file("ppt/bad.xml", "<wrongRoot/>");
    await expect(importer.readRootXml(zip, "ppt/bad.xml", "sldLayout")).rejects.toBeInstanceOf(TemplateImportError);
  });
});
