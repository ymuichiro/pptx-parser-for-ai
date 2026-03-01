import * as path from "node:path";
import { PPTXRenderer } from "../../src";

async function main(): Promise<void> {
  const base = path.resolve(process.cwd(), "example", "preset-v2");

  const renderer = new PPTXRenderer({
    enableQA: true
  });

  const outputPath = path.resolve(base, "output-preset-v2.pptx");
  const result = await renderer.generateFromFile(path.resolve(base, "presentation.yaml"), outputPath);
  console.log(`Generated: ${result.outputPath}`);

  const rendererWithTemplate = new PPTXRenderer({
    enableQA: true,
    templatePackagePath: path.resolve(process.cwd(), "example", "templates", "venture-teal", "template.yaml")
  });

  const templateOutputPath = path.resolve(base, "output-preset-v2-with-template.pptx");
  const templateResult = await rendererWithTemplate.generateFromFile(
    path.resolve(base, "presentation-with-template.yaml"),
    templateOutputPath
  );
  console.log(`Generated: ${templateResult.outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
