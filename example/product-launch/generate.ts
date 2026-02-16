import * as path from "node:path";
import { PPTXRenderer } from "../../src";

async function main(): Promise<void> {
  const renderer = new PPTXRenderer({ enableQA: true });

  const inputPath = path.resolve(process.cwd(), "example", "product-launch", "presentation.yaml");
  const outputPath = path.resolve(process.cwd(), "example", "product-launch", "output-product-launch.pptx");

  const result = await renderer.generateFromFile(inputPath, outputPath);
  console.log(`Generated: ${result.outputPath}`);
  console.log(`Slides: ${result.metadata.slideCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
