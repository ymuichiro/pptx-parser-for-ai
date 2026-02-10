import * as path from "node:path";
import { TemplateImporter } from "../../src";

async function main(): Promise<void> {
  const input = process.argv[2];
  const output = process.argv[3] ?? path.resolve(process.cwd(), "template-output");

  if (input === undefined) {
    console.error("Usage: npx tsx example/template-import/import.ts <template.pptx|template.potx> [output-dir]");
    process.exitCode = 1;
    return;
  }

  const importer = new TemplateImporter();
  const result = await importer.importFromFile(path.resolve(input), path.resolve(output));

  console.log("Imported template package:", path.resolve(output));
  console.log("Template ID:", result.template.id);
  console.log("Slide Size:", result.theme.slideSize);
  console.log("Primary Color:", result.theme.palette.primary);
  console.log("Warnings:", result.manifest.warnings.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
