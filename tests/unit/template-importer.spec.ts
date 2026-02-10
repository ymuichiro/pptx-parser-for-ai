import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { TemplateImportError, TemplateImporter } from "../../src";
import type { ImportedTemplatePackage } from "../../src/template-importer";

function presentationXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>',
    '</p:presentation>'
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
    '    </a:clrScheme>',
    '    <a:fontScheme name="Custom Font">',
    '      <a:majorFont><a:latin typeface="Noto Sans"/></a:majorFont>',
    '      <a:minorFont><a:latin typeface="Noto Sans JP"/></a:minorFont>',
    '    </a:fontScheme>',
    '  </a:themeElements>',
    '</a:theme>'
  ].join("\n");
}

function layoutXml(includeBodyPlaceholder: boolean): string {
  const bodyPlaceholder = includeBodyPlaceholder
    ? [
        '    <p:sp>',
        '      <p:nvSpPr>',
        '        <p:cNvPr id="3" name="Content Placeholder 2"/>',
        '        <p:cNvSpPr/>',
        '        <p:nvPr><p:ph type="body"/></p:nvPr>',
        '      </p:nvSpPr>',
        '      <p:spPr>',
        '        <a:xfrm>',
        '          <a:off x="457200" y="1371600"/>',
        '          <a:ext cx="8229600" cy="3657600"/>',
        '        </a:xfrm>',
        '      </p:spPr>',
        '      <p:txBody>',
        '        <a:bodyPr/>',
        '        <a:lstStyle/>',
        '        <a:p>',
        '          <a:r>',
        '            <a:rPr sz="2000"><a:latin typeface="Noto Sans JP"/></a:rPr>',
        '            <a:t>Body</a:t>',
        '          </a:r>',
        '        </a:p>',
        '      </p:txBody>',
        '    </p:sp>'
      ].join("\n")
    : "";

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '  <p:cSld>',
    '    <p:bg>',
    '      <p:bgPr>',
    '        <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>',
    '      </p:bgPr>',
    '    </p:bg>',
    '    <p:spTree>',
    '    <p:sp>',
    '      <p:nvSpPr>',
    '        <p:cNvPr id="2" name="Title Placeholder 1"/>',
    '        <p:cNvSpPr/>',
    '        <p:nvPr><p:ph type="title"/></p:nvPr>',
    '      </p:nvSpPr>',
    '      <p:spPr>',
    '        <a:xfrm>',
    '          <a:off x="457200" y="228600"/>',
    '          <a:ext cx="8229600" cy="914400"/>',
    '        </a:xfrm>',
    '      </p:spPr>',
    '      <p:txBody>',
    '        <a:bodyPr/>',
    '        <a:lstStyle/>',
    '        <a:p>',
    '          <a:r>',
    '            <a:rPr sz="3200"><a:latin typeface="Noto Sans"/></a:rPr>',
    '            <a:t>Title</a:t>',
    '          </a:r>',
    '        </a:p>',
    '      </p:txBody>',
    '    </p:sp>',
    bodyPlaceholder,
    '    </p:spTree>',
    '  </p:cSld>',
    '</p:sldLayout>'
  ].join("\n");
}

function slideMasterXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '  <p:cSld>',
    '    <p:bg>',
    '      <p:bgPr>',
    '        <a:blipFill>',
    '          <a:blip r:embed="rId1"/>',
    '          <a:stretch><a:fillRect/></a:stretch>',
    '        </a:blipFill>',
    '      </p:bgPr>',
    '    </p:bg>',
    '    <p:spTree>',
    '      <p:sp>',
    '        <p:nvSpPr>',
    '          <p:cNvPr id="10" name="Decorative Rectangle"/>',
    '          <p:cNvSpPr/>',
    '          <p:nvPr/>',
    '        </p:nvSpPr>',
    '        <p:spPr>',
    '          <a:xfrm>',
    '            <a:off x="0" y="0"/>',
    '            <a:ext cx="12192000" cy="457200"/>',
    '          </a:xfrm>',
    '          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '          <a:solidFill><a:srgbClr val="0B5FFF"/></a:solidFill>',
    '        </p:spPr>',
    '      </p:sp>',
    '      <p:pic>',
    '        <p:nvPicPr>',
    '          <p:cNvPr id="20" name="Decorative Image"/>',
    '          <p:cNvPicPr/>',
    '          <p:nvPr/>',
    '        </p:nvPicPr>',
    '        <p:blipFill><a:blip r:embed="rId1"/></p:blipFill>',
    '        <p:spPr>',
    '          <a:xfrm>',
    '            <a:off x="9144000" y="0"/>',
    '            <a:ext cx="3048000" cy="1143000"/>',
    '          </a:xfrm>',
    '        </p:spPr>',
    '      </p:pic>',
    '    </p:spTree>',
    '  </p:cSld>',
    '</p:sldMaster>'
  ].join("\n");
}

function layoutRelsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>',
    '</Relationships>'
  ].join("\n");
}

function masterRelsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>',
    '</Relationships>'
  ].join("\n");
}

async function createTemplateArchive(outputPath: string, includeBodyPlaceholder: boolean): Promise<void> {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", presentationXml());
  zip.file("ppt/theme/theme1.xml", themeXml());
  zip.file("ppt/slideLayouts/slideLayout1.xml", layoutXml(includeBodyPlaceholder));
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", layoutRelsXml());
  zip.file("ppt/slideMasters/slideMaster1.xml", slideMasterXml());
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", masterRelsXml());
  zip.file("ppt/media/image1.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(outputPath, buffer);
}

describe("TemplateImporter", () => {
  it("imports theme/layout/background/assets into template package", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-template-import-"));
    const templatePath = path.join(root, "source.potx");
    const outputDir = path.join(root, "output");
    await createTemplateArchive(templatePath, true);

    const importer = new TemplateImporter({ templateId: "acme" });
    const imported = await importer.importFromFile(templatePath, outputDir);

    expect(imported.template.id).toBe("acme");
    expect(imported.theme.slideSize).toBe("16:9");
    expect(imported.theme.palette.primary).toBe("0B5FFF");
    expect(imported.theme.fonts.title).toBe("Noto Sans");
    expect(imported.layout.placeholders.title.style.fontFace).toBe("Noto Sans");
    expect(imported.layout.placeholders.body.style.fontFace).toBe("Noto Sans JP");
    expect(imported.background.image).toMatch(/^assets\//);
    expect(imported.background.objects.some((item) => item.type === "shape")).toBe(true);
    expect(imported.background.objects.some((item) => item.type === "image")).toBe(true);

    const yamlPath = path.join(outputDir, "template.yaml");
    const manifestPath = path.join(outputDir, "manifest.json");
    const assetPath = path.join(outputDir, imported.background.image ?? "");

    await expect(fs.stat(yamlPath)).resolves.toBeDefined();
    await expect(fs.stat(manifestPath)).resolves.toBeDefined();
    await expect(fs.stat(assetPath)).resolves.toBeDefined();

    const yamlRaw = await fs.readFile(yamlPath, "utf-8");
    const yamlData = yaml.load(yamlRaw) as ImportedTemplatePackage;
    expect(yamlData.layout.kind).toBe("title-body");
    expect(yamlData.layout.placeholders.title.bounds.w).toBeGreaterThan(0);
  });

  it("fails closed when title/body placeholders are not satisfied", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-template-import-invalid-"));
    const templatePath = path.join(root, "invalid.potx");
    const outputDir = path.join(root, "output");
    await createTemplateArchive(templatePath, false);

    const importer = new TemplateImporter();

    await expect(importer.importFromFile(templatePath, outputDir)).rejects.toBeInstanceOf(TemplateImportError);
  });
});
