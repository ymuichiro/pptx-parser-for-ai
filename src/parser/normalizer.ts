import { DEFAULT_DSL_VERSION, DEFAULT_THEME_NAME } from "../constants";
import type {
  BlankSlide,
  ContentElement,
  ContentSlide,
  FooterChrome,
  PresentationChrome,
  PresentationDSL,
  Slide,
  TitleSlide,
  TwoColumnElement
} from "../types";

function cloneDSL(dsl: PresentationDSL): PresentationDSL {
  if (typeof structuredClone === "function") {
    return structuredClone(dsl);
  }
  return JSON.parse(JSON.stringify(dsl)) as PresentationDSL;
}

function normalizeTwoColumn(element: TwoColumnElement): TwoColumnElement {
  return {
    ...element,
    ratio: element.ratio ?? "1:1",
    left: element.left.map(normalizeContentElement),
    right: element.right.map(normalizeContentElement)
  };
}

function normalizeContentElement(element: ContentElement): ContentElement {
  switch (element.type) {
    case "text":
      return {
        ...element,
        style: element.style ?? "body",
        align: element.align ?? "left"
      };
    case "bullet-list":
      return {
        ...element,
        style: element.style ?? "default"
      };
    case "image":
      return {
        ...element,
        sizing: element.sizing ?? "contain",
        position: element.position ?? "center"
      };
    case "table":
      return {
        ...element,
        style: element.style ?? "default"
      };
    case "chart":
      const normalizedChartOptions: NonNullable<typeof element.options> = {
        showLegend: element.options?.showLegend ?? true,
        showValues: element.options?.showValues ?? false
      };
      if (element.options?.valuePrefix !== undefined) {
        normalizedChartOptions.valuePrefix = element.options.valuePrefix;
      }
      if (element.options?.valueSuffix !== undefined) {
        normalizedChartOptions.valueSuffix = element.options.valueSuffix;
      }
      return {
        ...element,
        options: normalizedChartOptions
      };
    case "network-diagram":
      return {
        ...element,
        layout: element.layout ?? "hierarchical"
      };
    case "flowchart":
      return {
        ...element,
        direction: element.direction ?? "horizontal"
      };
    case "two-column":
      return normalizeTwoColumn(element);
    default:
      return element;
  }
}

function normalizeTitleSlide(slide: TitleSlide): TitleSlide {
  return {
    ...slide,
    background: slide.background ?? "light",
    content: {
      ...slide.content,
      logo: slide.content.logo ?? false
    }
  };
}

function normalizeContentSlide(slide: ContentSlide): ContentSlide {
  return {
    ...slide,
    layout: slide.layout ?? "auto",
    content: slide.content.map(normalizeContentElement)
  };
}

function normalizeBlankSlide(slide: BlankSlide): BlankSlide {
  return {
    ...slide,
    background: slide.background ?? "light",
    elements: slide.elements.map((element) =>
      element.type === "custom-shape"
        ? element
        : normalizeContentElement(element)
    )
  };
}

function normalizeSlide(slide: Slide): Slide {
  switch (slide.type) {
    case "title":
      return normalizeTitleSlide(slide);
    case "content":
      return normalizeContentSlide(slide);
    case "blank":
      return normalizeBlankSlide(slide);
    case "section":
      return {
        ...slide,
        background: slide.background ?? {
          color: "primary",
          opacity: 0.9
        }
      };
  }
}

function normalizeChrome(chrome: PresentationChrome | undefined): PresentationChrome | undefined {
  if (chrome === undefined) {
    return undefined;
  }

  const normalized: PresentationChrome = {};

  if (chrome.header !== undefined) {
    if (chrome.header.divider !== undefined) {
      normalized.header = {
        divider: {
          ...chrome.header.divider,
          enabled: chrome.header.divider.enabled ?? true
        }
      };
    } else {
      normalized.header = {};
    }
  }

  if (chrome.footer !== undefined) {
    const normalizedFooter: FooterChrome = {
      ...chrome.footer,
      enabled: chrome.footer.enabled ?? true,
      showSlideNumber: chrome.footer.showSlideNumber ?? true
    };

    if (chrome.footer.divider !== undefined) {
      normalizedFooter.divider = {
        ...chrome.footer.divider,
        enabled: chrome.footer.divider.enabled ?? true
      };
    }

    normalized.footer = normalizedFooter;
  }

  if (normalized.header === undefined && normalized.footer === undefined) {
    return undefined;
  }

  return normalized;
}

export class DSLNormalizer {
  public normalize(dsl: PresentationDSL): PresentationDSL {
    const cloned = cloneDSL(dsl);
    const normalizedChrome = normalizeChrome(cloned.chrome);

    return {
      ...cloned,
      version: cloned.version || DEFAULT_DSL_VERSION,
      theme: cloned.theme || DEFAULT_THEME_NAME,
      metadata: {
        ...cloned.metadata,
        title: cloned.metadata.title || "Untitled"
      },
      ...(normalizedChrome !== undefined ? { chrome: normalizedChrome } : {}),
      slides: cloned.slides.map(normalizeSlide)
    };
  }
}
