import * as path from "node:path";
import type { ZodError } from "zod";
import { DEFAULT_DSL_VERSION } from "../constants";
import { ValidationError } from "../errors";
import { presentationDSLSchema } from "./schema";
import { enforceStructuralLimits } from "../utils/deep-limit";
import type { ContentElement, PresentationDSL, Slide } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface DSLValidatorOptions {
  allowRemoteImages?: boolean;
}

function isRemoteUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

function hasPathTraversal(source: string): boolean {
  const normalized = path.posix.normalize(source.replace(/\\/g, "/"));
  return normalized.split("/").includes("..");
}

function validateTableRows(element: ContentElement, errors: string[], location: string): void {
  if (element.type !== "table") {
    return;
  }

  const headerCount = element.headers.length;
  element.rows.forEach((row, rowIndex) => {
    if (row.length !== headerCount) {
      errors.push(`${location}.rows[${rowIndex}] column count mismatch (expected ${headerCount}, got ${row.length})`);
    }
  });
}

function validateChart(element: ContentElement, errors: string[], location: string): void {
  if (element.type !== "chart") {
    return;
  }

  const labelCount = element.data.labels.length;
  element.data.series.forEach((series, seriesIndex) => {
    if (series.values.length !== labelCount) {
      errors.push(`${location}.data.series[${seriesIndex}] value count mismatch (expected ${labelCount}, got ${series.values.length})`);
    }
  });
}

function validateNetworkDiagram(element: ContentElement, errors: string[], location: string): void {
  if (element.type !== "network-diagram") {
    return;
  }

  const nodeIds = new Set(element.nodes.map((node) => node.id));
  element.edges.forEach((edge, edgeIndex) => {
    if (!nodeIds.has(edge.from)) {
      errors.push(`${location}.edges[${edgeIndex}].from references unknown node '${edge.from}'`);
    }

    if (!nodeIds.has(edge.to)) {
      errors.push(`${location}.edges[${edgeIndex}].to references unknown node '${edge.to}'`);
    }
  });
}

function validateFlowchart(element: ContentElement, errors: string[], location: string): void {
  if (element.type !== "flowchart") {
    return;
  }

  const stepIds = new Set(element.steps.map((step) => step.id));
  element.flows.forEach((flow, flowIndex) => {
    if (!stepIds.has(flow.from)) {
      errors.push(`${location}.flows[${flowIndex}].from references unknown step '${flow.from}'`);
    }

    if (!stepIds.has(flow.to)) {
      errors.push(`${location}.flows[${flowIndex}].to references unknown step '${flow.to}'`);
    }
  });
}

function validateImage(element: ContentElement, errors: string[], location: string, allowRemoteImages: boolean): void {
  if (element.type !== "image") {
    return;
  }

  if (isRemoteUrl(element.source) && !allowRemoteImages) {
    errors.push(`${location}.source remote URL is disabled by default`);
  }

  if (!isRemoteUrl(element.source) && hasPathTraversal(element.source)) {
    errors.push(`${location}.source contains path traversal segments`);
  }
}

function traverseElements(
  elements: ContentElement[],
  errors: string[],
  basePath: string,
  allowRemoteImages: boolean
): void {
  elements.forEach((element, elementIndex) => {
    const location = `${basePath}[${elementIndex}]`;
    validateTableRows(element, errors, location);
    validateChart(element, errors, location);
    validateNetworkDiagram(element, errors, location);
    validateFlowchart(element, errors, location);
    validateImage(element, errors, location, allowRemoteImages);

    if (element.type === "two-column") {
      traverseElements(element.left, errors, `${location}.left`, allowRemoteImages);
      traverseElements(element.right, errors, `${location}.right`, allowRemoteImages);
    }
  });
}

function validateSlides(slides: Slide[], allowRemoteImages: boolean): string[] {
  const errors: string[] = [];
  slides.forEach((slide, slideIndex) => {
    if (slide.type === "content") {
      traverseElements(slide.content, errors, `slides[${slideIndex}].content`, allowRemoteImages);
    }

    if (slide.type === "blank") {
      const contentElements = slide.elements.filter((item): item is ContentElement => item.type !== "custom-shape");
      traverseElements(contentElements, errors, `slides[${slideIndex}].elements`, allowRemoteImages);
    }
  });
  return errors;
}

export class DSLValidator {
  private readonly allowRemoteImages: boolean;

  public constructor(options?: DSLValidatorOptions) {
    this.allowRemoteImages = options?.allowRemoteImages ?? false;
  }

  public validate(input: unknown): ValidationResult {
    const structuralViolations = enforceStructuralLimits(input);
    if (structuralViolations.length > 0) {
      return {
        isValid: false,
        errors: structuralViolations.map((violation) => `${violation.path}: ${violation.reason}`)
      };
    }

    const parsed = presentationDSLSchema.safeParse(input);
    if (!parsed.success) {
      return {
        isValid: false,
        errors: this.formatZodErrors(parsed.error)
      };
    }

    const dsl = parsed.data as PresentationDSL;
    const semanticErrors: string[] = [];

    if (dsl.version !== DEFAULT_DSL_VERSION) {
      semanticErrors.push(`Unsupported DSL version '${dsl.version}'. Supported version is '${DEFAULT_DSL_VERSION}'.`);
    }

    semanticErrors.push(...validateSlides(dsl.slides, this.allowRemoteImages));

    return {
      isValid: semanticErrors.length === 0,
      errors: semanticErrors
    };
  }

  public assertValid(input: unknown): PresentationDSL {
    const result = this.validate(input);
    if (!result.isValid) {
      throw new ValidationError(result.errors);
    }

    return input as PresentationDSL;
  }

  private formatZodErrors(error: ZodError): string[] {
    return error.issues.map((issue) => {
      const pathString = issue.path.length > 0 ? issue.path.join(".") : "$";
      return `${pathString}: ${issue.message}`;
    });
  }
}
