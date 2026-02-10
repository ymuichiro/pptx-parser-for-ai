import * as path from "node:path";
import { PPTXRenderer } from "../../src";

async function main(): Promise<void> {
  const renderer = new PPTXRenderer({
    enableQA: true,
    qaConfig: {
      autoFix: false,
      maxIterations: 2
    }
  });

  const inputPath = path.resolve(process.cwd(), "example", "basic", "presentation.yaml");
  const outputPath = path.resolve(process.cwd(), "example", "basic", "output-basic.pptx");

  const result = await renderer.generateFromFile(inputPath, outputPath);
  console.log(`Generated: ${result.outputPath}`);
  console.log(`Slides: ${result.metadata.slideCount}`);
  console.log(`QA issues: ${result.qaResult?.issues.length ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
