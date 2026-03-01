import * as fs from "node:fs/promises";
import type { BlankSlide, Bounds, PresentationDSL, QAResult, ThemeDefinition } from "../types";
import { DEFAULT_BLANK_ELEMENT_BOUNDS, LayoutEngine, resolveElementBounds } from "../layout";
import { PresetEngine } from "../presets";
import { isInsideBounds } from "../utils/geometry";

const DEFAULT_OVERLAP_THRESHOLD = 0.35;

interface QAResolvedElement {
  index: number;
  element: BlankSlide["elements"][number];
  bounds: Bounds;
}

function boundsArea(bounds: Bounds): number {
  return Math.max(0, bounds.w) * Math.max(0, bounds.h);
}

function intersectionArea(a: Bounds, b: Bounds): number {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);

  return Math.max(0, right - x) * Math.max(0, bottom - y);
}

function overlapRatio(a: Bounds, b: Bounds): number {
  const areaA = boundsArea(a);
  const areaB = boundsArea(b);
  if (areaA <= 0 || areaB <= 0) {
    return 0;
  }

  return intersectionArea(a, b) / Math.min(areaA, areaB);
}

function isDecorativeElement(element: BlankSlide["elements"][number]): boolean {
  if (element.qa?.exclude === true) {
    return true;
  }

  return element.type === "custom-shape";
}

function validateOutOfBounds(
  bounds: Bounds,
  slideBounds: Bounds,
  issues: QAResult["issues"],
  slideIndex: number,
  elementIndex: number
): void {
  if (!isInsideBounds(bounds, slideBounds)) {
    issues.push({
      code: "OUT_OF_BOUNDS",
      message: "Layout area exceeded slide bounds",
      slideIndex,
      elementIndex
    });
  }
}

function validateBlankOverlap(
  resolvedElements: QAResolvedElement[],
  issues: QAResult["issues"],
  slideIndex: number,
  threshold: number
): void {
  const candidates = resolvedElements.filter(({ element }) => !isDecorativeElement(element));
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const left = candidates[leftIndex];
    if (left === undefined) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const right = candidates[rightIndex];
      if (right === undefined) {
        continue;
      }

      const ratio = overlapRatio(left.bounds, right.bounds);
      if (ratio <= threshold) {
        continue;
      }

      issues.push({
        code: "EXCESSIVE_OVERLAP",
        message: `Elements ${left.index} and ${right.index} overlap excessively (${(ratio * 100).toFixed(1)}%)`,
        slideIndex,
        elementIndex: left.index
      });
    }
  }
}

function validateBlankSlide(slide: BlankSlide, slideIndex: number, slideBounds: Bounds, issues: QAResult["issues"]): void {
  const resolved = slide.elements.map((element, elementIndex) => ({
    index: elementIndex,
    element,
    bounds: resolveElementBounds(element, DEFAULT_BLANK_ELEMENT_BOUNDS)
  }));

  resolved.forEach((item) => {
    validateOutOfBounds(item.bounds, slideBounds, issues, slideIndex, item.index);
  });

  validateBlankOverlap(resolved, issues, slideIndex, DEFAULT_OVERLAP_THRESHOLD);
}

function validateContentSlide(
  slide: Extract<PresentationDSL["slides"][number], { type: "content" }>,
  slideIndex: number,
  layoutEngine: LayoutEngine,
  presetEngine: PresetEngine,
  slideBounds: Bounds,
  issues: QAResult["issues"]
): void {
  const areas =
    slide.preset !== undefined
      ? presetEngine.calculateLayout(slide.content, slide.preset).areas
      : layoutEngine.calculateLayout(slide.content, slide.layout ?? "auto").areas;

  areas.forEach((area, elementIndex) => {
    const effectiveBounds = resolveElementBounds(area.element, area.bounds);
    validateOutOfBounds(effectiveBounds, slideBounds, issues, slideIndex, elementIndex);
  });
}

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
    const presetEngine = new PresetEngine();
    const slideBounds = layoutEngine.getSlideBounds();

    dsl.slides.forEach((slide, slideIndex) => {
      if (slide.type === "content") {
        validateContentSlide(slide, slideIndex, layoutEngine, presetEngine, slideBounds, issues);
      }

      if (slide.type === "blank") {
        validateBlankSlide(slide, slideIndex, slideBounds, issues);
      }
    });

    return {
      hasIssues: issues.length > 0,
      issues
    };
  }
}
