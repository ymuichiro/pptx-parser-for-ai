import * as path from "node:path";
import { PPTXRenderer } from "../../src";

async function main(): Promise<void> {
  const templatePath = path.resolve(process.cwd(), "example", "templates", "venture-teal", "template.yaml");
  const renderer = new PPTXRenderer({
    enableQA: true,
    templatePackagePath: templatePath
  });

  const inputPath = path.resolve(process.cwd(), "example", "security-brief", "presentation.yaml");
  const outputPath = path.resolve(process.cwd(), "example", "security-brief", "output-security-brief.pptx");

  const result = await renderer.generateFromFile(inputPath, outputPath);
  console.log(`Generated: ${result.outputPath}`);
  console.log(`Slides: ${result.metadata.slideCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
