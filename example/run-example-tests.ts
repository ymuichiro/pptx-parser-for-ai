import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PPTXRenderer } from "../src";

async function assertFileExists(filePath: string): Promise<void> {
  const stat = await fs.stat(filePath);
  if (stat.size <= 0) {
    throw new Error(`Generated file is empty: ${filePath}`);
  }
}

async function run(): Promise<void> {
  const renderer = new PPTXRenderer({
    enableQA: true,
    qaConfig: {
      autoFix: false,
      maxIterations: 2
    }
  });

  const outputDir = path.resolve(process.cwd(), ".tmp", "example");
  await fs.mkdir(outputDir, { recursive: true });

  const testCases = [
    {
      input: path.resolve(process.cwd(), "example", "basic", "presentation.yaml"),
      output: path.join(outputDir, "basic-output.pptx")
    },
    {
      input: path.resolve(process.cwd(), "example", "network", "presentation.yaml"),
      output: path.join(outputDir, "network-output.pptx")
    },
    {
      input: path.resolve(process.cwd(), "example", "template-gallery", "presentation.yaml"),
      output: path.join(outputDir, "template-gallery-output.pptx")
    },
    {
      input: path.resolve(process.cwd(), "example", "security-brief", "presentation.yaml"),
      output: path.join(outputDir, "security-brief-output.pptx")
    },
    {
      input: path.resolve(process.cwd(), "example", "product-launch", "presentation.yaml"),
      output: path.join(outputDir, "product-launch-output.pptx")
    }
  ];

  for (const testCase of testCases) {
    const result = await renderer.generateFromFile(testCase.input, testCase.output);
    if (!result.success) {
      throw new Error(`Generation failed: ${testCase.input}`);
    }
    await assertFileExists(testCase.output);
  }

  console.log("example tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
