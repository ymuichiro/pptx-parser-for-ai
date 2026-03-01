import * as fs from "node:fs/promises";
import type { BlankSlide, Bounds, ContentElement, PresentationDSL, QAResult, ThemeDefinition } from "../types";
import { DEFAULT_BLANK_ELEMENT_BOUNDS, LayoutEngine, resolveElementBounds } from "../layout";
import { DEFAULT_PRESET_SLOT, PresetEngine, getPresetDefinition } from "../presets";
import { isInsideBounds } from "../utils/geometry";
import { normalizeHexColor } from "../utils/color";

const DEFAULT_OVERLAP_THRESHOLD = 0.35;

const REQUIRED_THEME_TOKENS = [
  "primary",
  "secondary",
  "accent",
  "text-dark",
  "text-light",
  "muted-text",
  "background-light",
  "background-dark",
  "neutral-border",
  "surface",
  "surface-muted",
  "surface-strong",
  "success",
  "warning",
  "error"
] as const;

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

function resolveColorHex(theme: ThemeDefinition, tokenOrLiteral: string | undefined, fallback: string): string {
  const raw = tokenOrLiteral ?? fallback;
  const mapped = theme.colors[raw] ?? raw;
  try {
    return normalizeHexColor(mapped);
  } catch {
    const fallbackMapped = theme.colors[fallback] ?? "000000";
    try {
      return normalizeHexColor(fallbackMapped);
    } catch {
      return "000000";
    }
  }
}

function channelLuminance(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return channelLuminance(r) * 0.2126 + channelLuminance(g) * 0.7152 + channelLuminance(b) * 0.0722;
}

function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function componentKeyForElement(element: ContentElement): keyof ThemeDefinition["components"] {
  switch (element.type) {
    case "text":
      return "text";
    case "bullet-list":
    case "numbered-list":
      return "list";
    case "table":
      return "table";
    case "chart":
      return "chart";
    case "image":
      return "image";
    case "stat-callout":
      return "statCallout";
    case "icon-grid":
      return "iconGrid";
    case "flowchart":
      return "flowchart";
    case "network-diagram":
      return "network";
    case "two-column":
      return "twoColumn";
  }
}

function collectElements(elements: ContentElement[]): Array<{ element: ContentElement; indexPath: string }> {
  const collected: Array<{ element: ContentElement; indexPath: string }> = [];

  const walk = (items: ContentElement[], prefix: string): void => {
    items.forEach((item, index) => {
      const path = `${prefix}[${index}]`;
      collected.push({ element: item, indexPath: path });
      if (item.type === "two-column") {
        walk(item.left, `${path}.left`);
        walk(item.right, `${path}.right`);
      }
    });
  };

  walk(elements, "content");
  return collected;
}

function validateRequiredThemeTokens(theme: ThemeDefinition, issues: QAResult["issues"]): void {
  for (const token of REQUIRED_THEME_TOKENS) {
    if (theme.colors[token] === undefined) {
      issues.push({
        code: "MISSING_THEME_TOKEN",
        message: `Theme is missing required token '${token}'`
      });
    }
  }
}

function validateStyleRefs(
  slide: Extract<PresentationDSL["slides"][number], { type: "content" }> | Extract<PresentationDSL["slides"][number], { type: "blank" }> | undefined,
  slideIndex: number,
  theme: ThemeDefinition,
  issues: QAResult["issues"]
): void {
  if (slide === undefined) {
    return;
  }

  const content = slide.type === "content" ? slide.content : slide.elements.filter((item): item is ContentElement => item.type !== "custom-shape");
  const collected = collectElements(content);

  for (const { element, indexPath } of collected) {
    const componentKey = componentKeyForElement(element);
    const styleRef = element.styleRef;
    if (styleRef !== undefined && theme.components[componentKey].styles[styleRef] === undefined) {
      issues.push({
        code: "STYLE_REF_NOT_FOUND",
        message: `Style ref '${styleRef}' was not found for component '${componentKey}' (${indexPath})`,
        slideIndex
      });
    }

    if (element.type === "image" && element.captionStyleRef !== undefined) {
      if (theme.components.text.styles[element.captionStyleRef] === undefined) {
        issues.push({
          code: "STYLE_REF_NOT_FOUND",
          message: `Caption style ref '${element.captionStyleRef}' was not found for text component (${indexPath})`,
          slideIndex
        });
      }
    }
  }
}

function validatePresetSlotStyles(
  slide: Extract<PresentationDSL["slides"][number], { type: "content" }>,
  slideIndex: number,
  theme: ThemeDefinition,
  issues: QAResult["issues"]
): void {
  if (slide.preset === undefined) {
    return;
  }

  const preset = getPresetDefinition(slide.preset);
  if (preset === undefined) {
    return;
  }

  const slotMap = new Map(preset.slots.map((slot) => [slot.name, slot]));
  slide.content.forEach((element, elementIndex) => {
    const slotName = element.slot ?? DEFAULT_PRESET_SLOT;
    const slot = slotMap.get(slotName);
    if (slot === undefined || slot.styleRef === undefined || element.styleRef !== undefined) {
      return;
    }

    const componentKey = componentKeyForElement(element);
    if (theme.components[componentKey].styles[slot.styleRef] === undefined) {
      issues.push({
        code: "PRESET_SLOT_STYLE_MISMATCH",
        message: `Preset slot '${slotName}' style '${slot.styleRef}' is not defined for component '${componentKey}'`,
        slideIndex,
        elementIndex
      });
    }
  });
}

function validateContrastOnContentSlide(
  slide: Extract<PresentationDSL["slides"][number], { type: "content" }>,
  slideIndex: number,
  theme: ThemeDefinition,
  issues: QAResult["issues"]
): void {
  const backgroundHex = resolveColorHex(theme, theme.defaults.contentSlide.background, "background-light");
  const entries = collectElements(slide.content);

  entries.forEach(({ element }, elementIndex) => {
    if (element.type !== "text" && element.type !== "bullet-list" && element.type !== "numbered-list") {
      return;
    }

    let textColor = "text-dark";
    let threshold = 4.5;

    if (element.type === "text") {
      if (element.style === "title" || element.style === "heading") {
        threshold = 3.0;
      }
      if (element.color !== undefined) {
        textColor = element.color;
      } else if (element.styleRef !== undefined) {
        textColor = theme.components.text.styles[element.styleRef]?.color ?? "text-dark";
      } else {
        textColor = theme.components.text.styles[element.style ?? "body"]?.color ?? "text-dark";
      }
    } else {
      if (element.styleRef !== undefined) {
        textColor = theme.components.list.styles[element.styleRef]?.color ?? "text-dark";
      } else {
        const listStyleRef = element.type === "bullet-list" ? (element.style ?? "default") : "default";
        textColor = theme.components.list.styles[listStyleRef]?.color ?? "text-dark";
      }
    }

    const textHex = resolveColorHex(theme, textColor, "text-dark");
    const ratio = contrastRatio(textHex, backgroundHex);
    if (ratio < threshold) {
      issues.push({
        code: "LOW_CONTRAST_TEXT",
        message: `Text contrast ratio ${ratio.toFixed(2)} is below threshold ${threshold.toFixed(1)}`,
        slideIndex,
        elementIndex
      });
    }
  });
}

function validateBlankContrast(
  slide: Extract<PresentationDSL["slides"][number], { type: "blank" }>,
  slideIndex: number,
  theme: ThemeDefinition,
  issues: QAResult["issues"]
): void {
  const backgroundToken =
    typeof slide.background === "string"
      ? slide.background === "dark"
        ? "background-dark"
        : "background-light"
      : slide.background?.color ?? "background-light";

  const backgroundHex = resolveColorHex(theme, backgroundToken, "background-light");
  const elements = slide.elements.filter((item): item is ContentElement => item.type !== "custom-shape");

  elements.forEach((element, elementIndex) => {
    if (element.type !== "text") {
      return;
    }

    const textColor =
      element.color ??
      (element.styleRef !== undefined
        ? theme.components.text.styles[element.styleRef]?.color
        : theme.components.text.styles[element.style ?? "body"]?.color) ??
      "text-dark";
    const textHex = resolveColorHex(theme, textColor, "text-dark");
    const threshold = element.style === "title" || element.style === "heading" ? 3.0 : 4.5;
    const ratio = contrastRatio(textHex, backgroundHex);

    if (ratio < threshold) {
      issues.push({
        code: "LOW_CONTRAST_TEXT",
        message: `Blank slide text contrast ratio ${ratio.toFixed(2)} is below threshold ${threshold.toFixed(1)}`,
        slideIndex,
        elementIndex
      });
    }
  });
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

    validateRequiredThemeTokens(theme, issues);

    const layoutEngine = new LayoutEngine(theme);
    const presetEngine = new PresetEngine();
    const slideBounds = layoutEngine.getSlideBounds();

    dsl.slides.forEach((slide, slideIndex) => {
      if (slide.type === "content") {
        validateContentSlide(slide, slideIndex, layoutEngine, presetEngine, slideBounds, issues);
        validateStyleRefs(slide, slideIndex, theme, issues);
        validatePresetSlotStyles(slide, slideIndex, theme, issues);
        validateContrastOnContentSlide(slide, slideIndex, theme, issues);
      }

      if (slide.type === "blank") {
        validateBlankSlide(slide, slideIndex, slideBounds, issues);
        validateStyleRefs(slide, slideIndex, theme, issues);
        validateBlankContrast(slide, slideIndex, theme, issues);
      }
    });

    return {
      hasIssues: issues.length > 0,
      issues
    };
  }
}
