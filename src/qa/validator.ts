import * as fs from "node:fs/promises";
import type { PresentationDSL, QAResult, ThemeDefinition } from "../types";
import { LayoutEngine } from "../layout";
import { isInsideBounds } from "../utils/geometry";

export class QAValidator {
  public async validate(outputPath: string, dsl: PresentationDSL, theme: ThemeDefinition): Promise<QAResult> {
    const issues: QAResult["issues"] = [];

    try {
      const stat = await fs.stat(outputPath);
      if (stat.size <= 0) {
        issues.push({
          code: "EMPTY_OUTPUT",
          message: "Generated PPTX file is empty"
        });
      }
    } catch {
      issues.push({
        code: "OUTPUT_NOT_FOUND",
        message: `Output file does not exist: ${outputPath}`
      });
    }

    const layoutEngine = new LayoutEngine(theme);
    const slideBounds = layoutEngine.getSlideBounds();

    dsl.slides.forEach((slide, slideIndex) => {
      if (slide.type !== "content") {
        return;
      }

      const layoutResult = layoutEngine.calculateLayout(slide.content, slide.layout ?? "auto");
      layoutResult.areas.forEach((area, elementIndex) => {
        if (!isInsideBounds(area.bounds, slideBounds)) {
          issues.push({
            code: "OUT_OF_BOUNDS",
            message: "Layout area exceeded slide bounds",
            slideIndex,
            elementIndex
          });
        }
      });
    });

    return {
      hasIssues: issues.length > 0,
      issues
    };
  }
}
