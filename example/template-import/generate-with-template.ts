import * as path from "node:path";
import { PPTXRenderer, type PresentationDSL } from "../../src";

async function main(): Promise<void> {
  const templateYamlPath = process.argv[2];
  const outputPath = process.argv[3] ?? path.resolve(process.cwd(), "template-applied.pptx");

  if (templateYamlPath === undefined) {
    console.error(
      "Usage: npx tsx example/template-import/generate-with-template.ts <template.yaml> [output.pptx]"
    );
    process.exitCode = 1;
    return;
  }

  const renderer = new PPTXRenderer({
    templatePackagePath: path.resolve(templateYamlPath)
  });

  const dsl: PresentationDSL = {
    version: "2.0",
    theme: "corporate-blue",
    metadata: {
      title: "Template Applied Example",
      author: "example"
    },
    slides: [
      {
        type: "content",
        title: "Imported Template Layout",
        content: [
          {
            type: "bullet-list",
            items: [
              "Title placeholder style and position are applied",
              "Body placeholder bounds are used for auto-layout",
              "Background assets/objects from template are rendered"
            ]
          }
        ]
      }
    ]
  };

  const result = await renderer.generate(dsl, path.resolve(outputPath));
  console.log("Generated:", result.outputPath);
  console.log("Slides:", result.metadata.slideCount);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
