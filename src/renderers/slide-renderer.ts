import * as path from "node:path";
import { RenderError } from "../errors";
import type {
  Bounds,
  ContentSlide,
  ElementArea,
  FooterChrome,
  PresentationMetadata,
  PresentationChrome,
  PresentationDSL,
  Slide,
  ThemeDefinition,
  TitleSlide
} from "../types";
import { LayoutEngine } from "../layout";
import type { ImportedTemplateImageObject, ImportedTemplatePackage, ImportedTemplateShapeObject } from "../template-importer/types";
import type { ComponentRenderContext, SlideAdapter } from "./base-renderer";
import { renderContentElement } from "./components";
import { resolveThemeColor } from "../utils/color";
import { SLIDE_DIMENSIONS } from "../constants";

export interface PresentationAdapter {
  addSlide(): SlideAdapter;
}

export interface SlideTemplateContext {
  templatePackage: ImportedTemplatePackage;
  assetBaseDir: string;
}

interface SlideRenderContext {
  slideIndex: number;
  totalSlides: number;
  metadata: PresentationMetadata;
  chrome?: PresentationChrome;
  footerOnDarkBackground?: boolean;
}

function applyBackground(slide: SlideAdapter, theme: ThemeDefinition, tokenOrLiteral: string): void {
  const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: dimensions.width,
    h: dimensions.height,
    fill: {
      color: resolveThemeColor(theme, tokenOrLiteral, "background-light")
    },
    line: {
      color: resolveThemeColor(theme, tokenOrLiteral, "background-light"),
      width: 0
    }
  });
}

function resolveTemplateAssetPath(assetBaseDir: string, relativeAssetPath: string): string {
  const normalized = path.posix.normalize(relativeAssetPath.replace(/\\/g, "/"));
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new RenderError(`Template asset path is invalid: ${relativeAssetPath}`);
  }

  return path.resolve(assetBaseDir, normalized);
}

function mapImportedShape(shapeName: string): string {
  const normalized = shapeName.toLowerCase();
  const shapeMap: Record<string, string> = {
    rect: "rect",
    rectangle: "rect",
    roundrect: "roundRect",
    ellipse: "ellipse",
    oval: "ellipse",
    triangle: "triangle",
    rttriangle: "rtTriangle",
    chevron: "chevron",
    diamond: "diamond",
    pentagon: "pentagon",
    hexagon: "hexagon",
    line: "line"
  };

  return shapeMap[normalized] ?? "rect";
}

function applyTemplateBackground(
  slide: SlideAdapter,
  theme: ThemeDefinition,
  templateContext: SlideTemplateContext,
  fallbackColor: string
): void {
  const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
  const templateBackground = templateContext.templatePackage.background;

  if (templateBackground.image !== undefined) {
    slide.addImage({
      path: resolveTemplateAssetPath(templateContext.assetBaseDir, templateBackground.image),
      x: 0,
      y: 0,
      w: dimensions.width,
      h: dimensions.height
    });
  } else if (templateBackground.color !== undefined) {
    applyBackground(slide, theme, templateBackground.color);
  } else {
    applyBackground(slide, theme, fallbackColor);
  }

  applyTemplateBackgroundObjects(slide, theme, templateContext);
}

function applyTemplateBackgroundObjects(slide: SlideAdapter, theme: ThemeDefinition, templateContext: SlideTemplateContext): void {
  const templateBackground = templateContext.templatePackage.background;

  for (const backgroundObject of templateBackground.objects) {
    if (backgroundObject.type === "shape") {
      renderTemplateShapeObject(slide, theme, backgroundObject);
      continue;
    }

    renderTemplateImageObject(slide, templateContext.assetBaseDir, backgroundObject);
  }
}

function renderTemplateShapeObject(slide: SlideAdapter, theme: ThemeDefinition, shapeObject: ImportedTemplateShapeObject): void {
  const options: Record<string, unknown> = {
    x: shapeObject.x,
    y: shapeObject.y,
    w: shapeObject.w,
    h: shapeObject.h
  };

  if (shapeObject.fill !== undefined) {
    options.fill = {
      color: resolveThemeColor(theme, shapeObject.fill, "background-light")
    };
  }

  if (shapeObject.lineColor !== undefined) {
    options.line = {
      color: resolveThemeColor(theme, shapeObject.lineColor, "text-dark"),
      width: 1
    };
  }

  slide.addShape(mapImportedShape(shapeObject.shape), options);

  if (shapeObject.text !== undefined) {
    slide.addText(shapeObject.text, {
      x: shapeObject.x,
      y: shapeObject.y,
      w: shapeObject.w,
      h: shapeObject.h,
      fontFace: theme.typography.fonts.body,
      fontSize: theme.typography.sizes.body,
      color: resolveThemeColor(theme, "text-dark", "text-dark"),
      valign: "mid",
      align: "center"
    });
  }
}

function renderTemplateImageObject(slide: SlideAdapter, assetBaseDir: string, imageObject: ImportedTemplateImageObject): void {
  slide.addImage({
    path: resolveTemplateAssetPath(assetBaseDir, imageObject.source),
    x: imageObject.x,
    y: imageObject.y,
    w: imageObject.w,
    h: imageObject.h
  });
}

function calculateAreaFrame(areas: ElementArea[]): Bounds | undefined {
  const firstArea = areas[0];
  if (firstArea === undefined) {
    return undefined;
  }

  let minX = firstArea.bounds.x;
  let minY = firstArea.bounds.y;
  let maxX = firstArea.bounds.x + firstArea.bounds.w;
  let maxY = firstArea.bounds.y + firstArea.bounds.h;

  for (const area of areas.slice(1)) {
    minX = Math.min(minX, area.bounds.x);
    minY = Math.min(minY, area.bounds.y);
    maxX = Math.max(maxX, area.bounds.x + area.bounds.w);
    maxY = Math.max(maxY, area.bounds.y + area.bounds.h);
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
}

function remapBounds(sourceBounds: Bounds, sourceFrame: Bounds, targetFrame: Bounds): Bounds {
  if (sourceFrame.w <= 0 || sourceFrame.h <= 0) {
    return targetFrame;
  }

  return {
    x: targetFrame.x + ((sourceBounds.x - sourceFrame.x) / sourceFrame.w) * targetFrame.w,
    y: targetFrame.y + ((sourceBounds.y - sourceFrame.y) / sourceFrame.h) * targetFrame.h,
    w: (sourceBounds.w / sourceFrame.w) * targetFrame.w,
    h: (sourceBounds.h / sourceFrame.h) * targetFrame.h
  };
}

function remapAreasToPlaceholder(areas: ElementArea[], targetPlaceholderBounds: Bounds): ElementArea[] {
  const sourceFrame = calculateAreaFrame(areas);
  if (sourceFrame === undefined) {
    return areas;
  }

  return areas.map((area) => ({
    element: area.element,
    bounds: remapBounds(area.bounds, sourceFrame, targetPlaceholderBounds)
  }));
}

function interpolateFooterText(template: string, metadata: PresentationMetadata): string {
  const replacements: Record<string, string> = {
    title: metadata.title,
    author: metadata.author ?? "",
    company: metadata.company ?? "",
    date: metadata.date ?? "",
    copyright: metadata.copyright ?? "",
    footerText: metadata.footerText ?? ""
  };

  return template
    .replace(/\{(title|author|company|date|copyright|footerText)\}/g, (_match, key: string) => replacements[key] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export class SlideRenderer {
  public async renderSlides(
    pres: PresentationAdapter,
    dsl: PresentationDSL,
    theme: ThemeDefinition,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    for (const [slideIndex, slide] of dsl.slides.entries()) {
      const context: SlideRenderContext = {
        slideIndex,
        totalSlides: dsl.slides.length,
        metadata: dsl.metadata
      };
      if (dsl.chrome !== undefined) {
        context.chrome = dsl.chrome;
      }

      await this.renderSlide(pres, slide, theme, templateContext, context);
    }
  }

  public async renderSlide(
    pres: PresentationAdapter,
    slideDefinition: Slide,
    theme: ThemeDefinition,
    templateContext?: SlideTemplateContext,
    renderContext?: SlideRenderContext
  ): Promise<void> {
    const slide = pres.addSlide();
    const footerOnDarkBackground = this.shouldRenderFooterOnDarkBackground(slideDefinition);

    if (slideDefinition.type === "title") {
      await this.renderTitleSlide(slide, slideDefinition, theme, templateContext);
    } else if (slideDefinition.type === "content") {
      await this.renderContentSlide(slide, slideDefinition, theme, templateContext);
    } else if (slideDefinition.type === "section") {
      await this.renderSectionSlide(slide, slideDefinition, theme, templateContext);
    } else {
      await this.renderBlankSlide(slide, slideDefinition, theme, templateContext);
    }

    if (renderContext !== undefined) {
      this.renderHeaderDivider(slide, theme, {
        ...renderContext,
        footerOnDarkBackground
      });
      this.renderFooter(slide, theme, templateContext, {
        ...renderContext,
        footerOnDarkBackground
      });
    }
  }

  private renderHeaderDivider(slide: SlideAdapter, theme: ThemeDefinition, renderContext: SlideRenderContext): void {
    if (renderContext.footerOnDarkBackground === true) {
      return;
    }

    const divider = renderContext.chrome?.header?.divider;
    if (divider?.enabled !== true) {
      return;
    }

    const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
    const x = divider.x ?? 0.4;
    const y = divider.y ?? 1.22;
    const w = divider.w ?? Math.max(0.1, dimensions.width - x * 2);
    const lineColor = resolveThemeColor(theme, divider.color ?? "DEE2E6", "text-dark");
    const lineWidth = divider.width ?? 0.8;

    slide.addShape("line", {
      x,
      y,
      w,
      h: 0,
      line: {
        color: lineColor,
        width: lineWidth
      }
    });
  }

  private shouldRenderFooterOnDarkBackground(slideDefinition: Slide): boolean {
    if (slideDefinition.type === "title" || slideDefinition.type === "section") {
      return true;
    }

    if (slideDefinition.type !== "blank") {
      return false;
    }

    const { background } = slideDefinition;
    if (typeof background === "string") {
      return background === "dark";
    }

    if (background?.color !== undefined) {
      const normalized = background.color.toLowerCase();
      return normalized.includes("dark") || normalized === "primary";
    }

    return false;
  }

  private async renderTitleSlide(
    slide: SlideAdapter,
    definition: TitleSlide,
    theme: ThemeDefinition,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    const defaultBg = theme.defaults.titleSlide.background;
    const fallbackBg =
      typeof definition.background === "string"
        ? definition.background === "dark"
          ? "background-dark"
          : "background-light"
        : definition.background?.color ?? defaultBg;

    if (templateContext !== undefined) {
      applyBackground(slide, theme, fallbackBg);
      applyTemplateBackgroundObjects(slide, theme, templateContext);
    } else if (typeof definition.background === "string") {
      applyBackground(slide, theme, definition.background === "dark" ? "background-dark" : "background-light");
    } else if (definition.background !== undefined) {
      applyBackground(slide, theme, definition.background.color);
    } else {
      applyBackground(slide, theme, defaultBg);
    }

    const titleColor =
      templateContext === undefined
        ? resolveThemeColor(theme, theme.defaults.titleSlide.titleColor, "text-light")
        : resolveThemeColor(theme, "text-light", "text-light");
    const subtitleColor =
      templateContext === undefined
        ? resolveThemeColor(theme, theme.defaults.titleSlide.subtitleColor, "secondary")
        : resolveThemeColor(theme, "text-light", "text-light");

    slide.addText(definition.content.title, {
      x: 0.7,
      y: 1.6,
      w: 8.6,
      h: 1.2,
      fontFace: theme.typography.fonts.title,
      fontSize: theme.typography.sizes.title,
      bold: true,
      color: titleColor,
      align: "center",
      valign: "mid"
    });

    if (definition.content.subtitle !== undefined) {
      slide.addText(definition.content.subtitle, {
        x: 0.7,
        y: 3.0,
        w: 8.6,
        h: 0.6,
        fontFace: theme.typography.fonts.heading,
        fontSize: theme.typography.sizes.subheading,
        color: subtitleColor,
        align: "center"
      });
    }

    if (definition.content.date !== undefined) {
      slide.addText(definition.content.date, {
        x: 0.7,
        y: 3.8,
        w: 8.6,
        h: 0.3,
        fontFace: theme.typography.fonts.caption,
        fontSize: theme.typography.sizes.caption,
        color: subtitleColor,
        align: "center"
      });
    }

    if (definition.content.logo === true && theme.logo !== undefined) {
      slide.addImage({
        path: theme.logo.source,
        x: 10 - theme.logo.size[0] - theme.logo.margin,
        y: theme.logo.margin,
        w: theme.logo.size[0],
        h: theme.logo.size[1]
      });
    }
  }

  private async renderContentSlide(
    slide: SlideAdapter,
    definition: ContentSlide,
    theme: ThemeDefinition,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    if (templateContext !== undefined) {
      applyTemplateBackground(slide, theme, templateContext, theme.defaults.contentSlide.background);
    } else {
      applyBackground(slide, theme, theme.defaults.contentSlide.background);
    }

    const titlePlaceholder = templateContext?.templatePackage.layout.placeholders.title;
    slide.addText(definition.title, {
      x: titlePlaceholder?.bounds.x ?? 0.5,
      y: titlePlaceholder?.bounds.y ?? 0.2,
      w: titlePlaceholder?.bounds.w ?? 9,
      h: titlePlaceholder?.bounds.h ?? 0.5,
      fontFace: titlePlaceholder?.style.fontFace ?? theme.typography.fonts.heading,
      fontSize: titlePlaceholder?.style.fontSizePt ?? theme.typography.sizes.heading,
      bold: true,
      color: resolveThemeColor(theme, titlePlaceholder?.style.color ?? theme.defaults.contentSlide.titleColor, "text-dark")
    });

    const engine = new LayoutEngine(theme);
    const result = engine.calculateLayout(definition.content, definition.layout ?? "auto");
    const bodyBounds = templateContext?.templatePackage.layout.placeholders.body.bounds;
    const areas = bodyBounds !== undefined ? remapAreasToPlaceholder(result.areas, bodyBounds) : result.areas;

    const context: ComponentRenderContext = {
      renderElement: async (nestedSlide, nestedElement, bounds, nestedTheme) => {
        await renderContentElement(nestedSlide, nestedElement, bounds, nestedTheme, context);
      }
    };

    for (const area of areas) {
      await renderContentElement(slide, area.element, area.bounds, theme, context);
    }
  }

  private async renderSectionSlide(
    slide: SlideAdapter,
    definition: Extract<Slide, { type: "section" }>,
    theme: ThemeDefinition,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    const fallbackBg = definition.background?.color ?? "primary";
    if (templateContext !== undefined) {
      applyBackground(slide, theme, fallbackBg);
      applyTemplateBackgroundObjects(slide, theme, templateContext);
    } else {
      applyBackground(slide, theme, fallbackBg);
    }

    const titleColor =
      templateContext === undefined
        ? resolveThemeColor(theme, "text-light", "text-light")
        : resolveThemeColor(theme, theme.defaults.contentSlide.titleColor, "text-dark");
    const subtitleColor =
      templateContext === undefined
        ? resolveThemeColor(theme, "secondary", "secondary")
        : resolveThemeColor(theme, "accent", "accent");

    slide.addText(definition.title, {
      x: 1,
      y: 2,
      w: 8,
      h: 1,
      fontFace: theme.typography.fonts.title,
      fontSize: theme.typography.sizes.title,
      bold: true,
      align: "center",
      color: titleColor
    });

    if (definition.subtitle !== undefined) {
      slide.addText(definition.subtitle, {
        x: 1,
        y: 3.2,
        w: 8,
        h: 0.4,
        fontFace: theme.typography.fonts.heading,
        fontSize: theme.typography.sizes.subheading,
        align: "center",
        color: subtitleColor
      });
    }
  }

  private async renderBlankSlide(
    slide: SlideAdapter,
    definition: Extract<Slide, { type: "blank" }>,
    theme: ThemeDefinition,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    const bg = definition.background;
    if (typeof bg === "string") {
      applyBackground(slide, theme, bg === "dark" ? "background-dark" : "background-light");
    } else if (bg !== undefined) {
      applyBackground(slide, theme, bg.color);
    } else {
      applyBackground(slide, theme, "background-light");
    }

    if (templateContext !== undefined) {
      applyTemplateBackgroundObjects(slide, theme, templateContext);
    }

    const context: ComponentRenderContext = {
      renderElement: async (nestedSlide, nestedElement, bounds, nestedTheme) => {
        await renderContentElement(nestedSlide, nestedElement, bounds, nestedTheme, context);
      }
    };

    for (const element of definition.elements) {
      const defaultBounds = {
        x: 0.8,
        y: 0.8,
        w: 8.4,
        h: 4.0
      };
      const positionedBounds =
        element.type === "custom-shape"
          ? element.position
          : ("position" in element && typeof element.position === "object" ? element.position : undefined) ??
            ("bounds" in element && typeof element.bounds === "object" ? element.bounds : undefined);
      const bounds = positionedBounds ?? defaultBounds;
      await renderContentElement(slide, element, bounds, theme, context);
    }
  }

  private renderFooter(
    slide: SlideAdapter,
    theme: ThemeDefinition,
    templateContext: SlideTemplateContext | undefined,
    renderContext: SlideRenderContext
  ): void {
    const templateFooter = templateContext?.templatePackage.chrome?.footer;
    if (templateFooter !== undefined) {
      this.renderTemplateFooter(slide, theme, renderContext, templateFooter);
      return;
    }

    const footer = renderContext.chrome?.footer;
    if (footer?.enabled !== true) {
      return;
    }

    const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
    const defaultColorToken =
      renderContext.footerOnDarkBackground === true
        ? "text-light"
        : theme.colors["muted-text"] !== undefined
          ? "muted-text"
          : "text-dark";
    const textColor = resolveThemeColor(theme, footer.color ?? defaultColorToken, defaultColorToken);
    const fontFace = footer.fontFace ?? theme.typography.fonts.caption;
    const fontSize = footer.fontSize ?? theme.typography.sizes.caption;
    const leftText = this.resolveFooterLeftText(renderContext.metadata, footer);
    const divider = footer.divider;

    if (divider?.enabled === true) {
      const dividerX = divider.x ?? 0.4;
      const dividerY = divider.y ?? dimensions.height - 0.205;
      const dividerW = divider.w ?? Math.max(0.1, dimensions.width - dividerX * 2);
      slide.addShape("line", {
        x: dividerX,
        y: dividerY,
        w: dividerW,
        h: 0,
        line: {
          color: resolveThemeColor(theme, divider.color ?? "DEE2E6", "text-dark"),
          width: divider.width ?? 0.8
        }
      });
    }

    if (leftText !== undefined && leftText.length > 0) {
      slide.addText(leftText, {
        x: 0.4,
        y: dimensions.height - 0.14,
        w: dimensions.width - 1.0,
        h: 0.12,
        fontFace,
        fontSize,
        color: textColor
      });
    }

    if (footer.showSlideNumber ?? true) {
      slide.addText(String(renderContext.slideIndex + 1), {
        x: dimensions.width - 0.3,
        y: dimensions.height - 0.14,
        w: 0.24,
        h: 0.12,
        fontFace,
        fontSize,
        bold: true,
        color: textColor,
        align: "right"
      });
    }
  }

  private renderTemplateFooter(
    slide: SlideAdapter,
    theme: ThemeDefinition,
    renderContext: SlideRenderContext,
    footer: NonNullable<NonNullable<SlideTemplateContext["templatePackage"]["chrome"]>["footer"]>
  ): void {
    const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
    const defaultColorToken = renderContext.footerOnDarkBackground ? "text-light" : "text-dark";
    const textColor = resolveThemeColor(theme, footer.color ?? defaultColorToken, defaultColorToken);
    const fontFace = footer.fontFace ?? theme.typography.fonts.caption;
    const fontSize = footer.fontSizePt ?? theme.typography.sizes.caption;
    const leftTextY = 0.12;
    const pageNumberY = renderContext.footerOnDarkBackground ? dimensions.height - 0.24 : 0.12;

    if (footer.leftText !== undefined) {
      slide.addText(footer.leftText, {
        x: 0.1,
        y: leftTextY,
        w: 2.8,
        h: 0.16,
        fontFace,
        fontSize,
        color: textColor
      });
    }

    if (footer.showSlideNumber ?? true) {
      slide.addText(String(renderContext.slideIndex + 1), {
        x: dimensions.width - 0.3,
        y: pageNumberY,
        w: 0.24,
        h: 0.16,
        fontFace,
        fontSize,
        bold: true,
        color: textColor,
        align: "right"
      });
    }
  }

  private resolveFooterLeftText(metadata: PresentationMetadata, footer: FooterChrome): string | undefined {
    if (footer.leftText !== undefined) {
      return interpolateFooterText(footer.leftText, metadata);
    }

    if (metadata.footerText !== undefined) {
      return interpolateFooterText(metadata.footerText, metadata);
    }

    const parts = [metadata.company, metadata.copyright].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0
    );

    if (parts.length === 0) {
      return undefined;
    }

    return parts.join(" | ");
  }
}
