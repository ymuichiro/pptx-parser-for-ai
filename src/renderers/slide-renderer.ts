import * as path from "node:path";
import { RenderError } from "../errors";
import type {
  Bounds,
  ContentElement,
  ContentSlide,
  CustomShapeElement,
  ElementArea,
  FooterChrome,
  PresentationChrome,
  PresentationDSL,
  PresentationMetadata,
  Slide,
  ThemeDefinition,
  TitleSlide
} from "../types";
import { DEFAULT_BLANK_ELEMENT_BOUNDS, LayoutEngine, resolveElementBounds } from "../layout";
import { SLIDE_DIMENSIONS } from "../constants";
import { PresetEngine, type PresetLayoutResult } from "../presets";
import { StyleResolver } from "../theme/style-resolver";
import type { ImportedTemplateImageObject, ImportedTemplatePackage, ImportedTemplateShapeObject } from "../template-importer/types";
import type { ComponentRenderContext, SlideAdapter } from "./base-renderer";
import { renderContentElement } from "./components";

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

function applyBackground(slide: SlideAdapter, theme: ThemeDefinition, resolver: StyleResolver, tokenOrLiteral: string): void {
  const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
  const color = resolver.resolveColor(tokenOrLiteral, "background-light");
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: dimensions.width,
    h: dimensions.height,
    fill: {
      color
    },
    line: {
      color,
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
  resolver: StyleResolver,
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
    applyBackground(slide, theme, resolver, templateBackground.color);
  } else {
    applyBackground(slide, theme, resolver, fallbackColor);
  }

  applyTemplateBackgroundObjects(slide, theme, resolver, templateContext);
}

function applyTemplateBackgroundObjects(
  slide: SlideAdapter,
  theme: ThemeDefinition,
  resolver: StyleResolver,
  templateContext: SlideTemplateContext
): void {
  const templateBackground = templateContext.templatePackage.background;

  for (const backgroundObject of templateBackground.objects) {
    if (backgroundObject.type === "shape") {
      renderTemplateShapeObject(slide, theme, resolver, backgroundObject);
      continue;
    }

    renderTemplateImageObject(slide, templateContext.assetBaseDir, backgroundObject);
  }
}

function renderTemplateShapeObject(
  slide: SlideAdapter,
  theme: ThemeDefinition,
  resolver: StyleResolver,
  shapeObject: ImportedTemplateShapeObject
): void {
  const options: Record<string, unknown> = {
    x: shapeObject.x,
    y: shapeObject.y,
    w: shapeObject.w,
    h: shapeObject.h
  };

  if (shapeObject.fill !== undefined) {
    options.fill = {
      color: resolver.resolveColor(shapeObject.fill, "background-light")
    };
  }

  if (shapeObject.lineColor !== undefined) {
    options.line = {
      color: resolver.resolveColor(shapeObject.lineColor, "text-dark"),
      width: 1
    };
  }

  slide.addShape(mapImportedShape(shapeObject.shape), options);

  if (shapeObject.text !== undefined) {
    const style = resolver.resolveTextStyle("body");
    slide.addText(shapeObject.text, {
      x: shapeObject.x,
      y: shapeObject.y,
      w: shapeObject.w,
      h: shapeObject.h,
      fontFace: style.fontFace ?? theme.typography.fonts.body,
      fontSize: style.fontSize ?? theme.typography.sizes.body,
      color: resolver.resolveColor(style.color, "text-dark"),
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

function clampBoundsToReference(bounds: Bounds, reference: Bounds): Bounds {
  const minX = Math.max(bounds.x, reference.x);
  const minY = Math.max(bounds.y, reference.y);
  const maxX = Math.min(bounds.x + bounds.w, reference.x + reference.w);
  const maxY = Math.min(bounds.y + bounds.h, reference.y + reference.h);

  if (maxX <= minX || maxY <= minY) {
    return reference;
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
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

function remapCustomShape(shape: CustomShapeElement, sourceFrame: Bounds, targetFrame: Bounds): CustomShapeElement {
  return {
    ...shape,
    position: remapBounds(shape.position, sourceFrame, targetFrame)
  };
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

function setElementStyleRef(element: ContentElement, styleRef: string | undefined): ContentElement {
  if (styleRef === undefined || element.styleRef !== undefined) {
    return element;
  }

  return {
    ...element,
    styleRef
  };
}

function buildPresetSurfaceShapes(result: PresetLayoutResult, resolver: StyleResolver): CustomShapeElement[] {
  return result.slotSurfaceDefinitions.map((slotSurface) => {
    const style = resolver.resolvePresetSurfaceStyle(slotSurface.styleRef);
    const base: CustomShapeElement = {
      type: "custom-shape",
      shape: style.shape ?? "rounded-rectangle",
      position: slotSurface.bounds,
      fill: style.fillColor,
      qa: { exclude: true }
    };

    if (style.rectRadius !== undefined) {
      base.rectRadius = style.rectRadius;
    }

    if (style.borderColor !== undefined) {
      base.border = {
        color: style.borderColor,
        width: style.borderWidth ?? 1
      };
    }

    return base;
  });
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
    const resolver = new StyleResolver(theme);
    const footerOnDarkBackground = this.shouldRenderFooterOnDarkBackground(slideDefinition);

    if (slideDefinition.type === "title") {
      await this.renderTitleSlide(slide, slideDefinition, theme, resolver, templateContext);
    } else if (slideDefinition.type === "content") {
      await this.renderContentSlide(slide, slideDefinition, theme, resolver, templateContext);
    } else if (slideDefinition.type === "section") {
      await this.renderSectionSlide(slide, slideDefinition, theme, resolver, templateContext);
    } else {
      await this.renderBlankSlide(slide, slideDefinition, theme, resolver, templateContext);
    }

    if (renderContext !== undefined) {
      this.renderHeaderDivider(
        slide,
        theme,
        resolver,
        {
          ...renderContext,
          footerOnDarkBackground
        }
      );
      this.renderFooter(slide, theme, resolver, templateContext, {
        ...renderContext,
        footerOnDarkBackground
      });
    }
  }

  private renderHeaderDivider(
    slide: SlideAdapter,
    theme: ThemeDefinition,
    resolver: StyleResolver,
    renderContext: SlideRenderContext
  ): void {
    if (renderContext.footerOnDarkBackground === true) {
      return;
    }

    const divider = this.resolveHeaderDivider(renderContext, theme);
    if (divider?.enabled !== true) {
      return;
    }

    const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
    const x = divider.x ?? 0.4;
    const y = divider.y ?? 1.18;
    const w = divider.w ?? Math.max(0.1, dimensions.width - x * 2);
    const lineColor = resolver.resolveColor(divider.color ?? "neutral-border", "neutral-border");
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

  private resolveHeaderDivider(
    renderContext: SlideRenderContext,
    theme: ThemeDefinition
  ): NonNullable<PresentationChrome["header"]>["divider"] | NonNullable<NonNullable<ThemeDefinition["chromeDefaults"]>["header"]>["divider"] {
    return renderContext.chrome?.header?.divider ?? theme.chromeDefaults?.header?.divider;
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
    resolver: StyleResolver,
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
      applyBackground(slide, theme, resolver, fallbackBg);
      applyTemplateBackgroundObjects(slide, theme, resolver, templateContext);
    } else if (typeof definition.background === "string") {
      applyBackground(slide, theme, resolver, definition.background === "dark" ? "background-dark" : "background-light");
    } else if (definition.background !== undefined) {
      applyBackground(slide, theme, resolver, definition.background.color);
    } else {
      applyBackground(slide, theme, resolver, defaultBg);
    }

    const titleStyle = resolver.resolveTextStyle("title");
    const subtitleStyle = resolver.resolveTextStyle("heading");

    const titleColor =
      templateContext === undefined
        ? resolver.resolveColor(titleStyle.color, theme.defaults.titleSlide.titleColor)
        : resolver.resolveColor("text-light", "text-light");
    const subtitleColor =
      templateContext === undefined
        ? resolver.resolveColor(subtitleStyle.color, theme.defaults.titleSlide.subtitleColor)
        : resolver.resolveColor("text-light", "text-light");

    slide.addText(definition.content.title, {
      x: 0.7,
      y: 1.6,
      w: 8.6,
      h: 1.2,
      fontFace: titleStyle.fontFace ?? theme.typography.fonts.title,
      fontSize: titleStyle.fontSize ?? theme.typography.sizes.title,
      bold: titleStyle.bold ?? true,
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
        fontFace: subtitleStyle.fontFace ?? theme.typography.fonts.heading,
        fontSize: subtitleStyle.fontSize ?? theme.typography.sizes.subheading,
        color: subtitleColor,
        align: "center"
      });
    }

    if (definition.content.date !== undefined) {
      const captionStyle = resolver.resolveTextStyle("caption");
      slide.addText(definition.content.date, {
        x: 0.7,
        y: 3.8,
        w: 8.6,
        h: 0.3,
        fontFace: captionStyle.fontFace ?? theme.typography.fonts.caption,
        fontSize: captionStyle.fontSize ?? theme.typography.sizes.caption,
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
    resolver: StyleResolver,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    if (templateContext !== undefined) {
      applyTemplateBackground(slide, theme, resolver, templateContext, theme.defaults.contentSlide.background);
    } else {
      applyBackground(slide, theme, resolver, theme.defaults.contentSlide.background);
    }

    const titleStyle = resolver.resolveTextStyle("heading");
    const titlePlaceholder = templateContext?.templatePackage.layout.placeholders.title;
    const titleFrame =
      titlePlaceholder !== undefined
        ? clampBoundsToReference(titlePlaceholder.bounds, theme.defaults.contentSlide.titleFrame)
        : theme.defaults.contentSlide.titleFrame;
    const bodyPlaceholder = templateContext?.templatePackage.layout.placeholders.body;
    const bodyFrame =
      bodyPlaceholder !== undefined
        ? clampBoundsToReference(bodyPlaceholder.bounds, theme.defaults.contentSlide.bodyFrame)
        : theme.defaults.contentSlide.bodyFrame;

    slide.addText(definition.title, {
      x: titleFrame.x,
      y: titleFrame.y,
      w: titleFrame.w,
      h: titleFrame.h,
      fontFace: titlePlaceholder?.style.fontFace ?? titleStyle.fontFace ?? theme.typography.fonts.heading,
      fontSize: titlePlaceholder?.style.fontSizePt ?? titleStyle.fontSize ?? theme.typography.sizes.heading,
      bold: true,
      color: resolver.resolveColor(titlePlaceholder?.style.color ?? titleStyle.color, theme.defaults.contentSlide.titleColor)
    });

    const shouldUnderline = theme.effects?.titleUnderline?.enabled ?? false;
    if (shouldUnderline) {
      const underlineColor = resolver.resolveColor(theme.effects?.titleUnderline?.color ?? "accent", "accent");
      slide.addShape("line", {
        x: titleFrame.x,
        y: titleFrame.y + titleFrame.h + 0.03,
        w: titleFrame.w,
        h: 0,
        line: {
          color: underlineColor,
          width: theme.effects?.titleUnderline?.width ?? 1.2
        }
      });
    }

    const engine = new LayoutEngine(theme);
    const presetEngine = new PresetEngine();
    const presetResult = definition.preset !== undefined ? presetEngine.calculateLayout(definition.content, definition.preset) : undefined;
    const result = presetResult ?? engine.calculateLayout(definition.content, definition.layout ?? "auto");
    let areas = result.areas;

    let presetVisualShapes: CustomShapeElement[] = [];
    if (presetResult !== undefined) {
      presetVisualShapes = [...buildPresetSurfaceShapes(presetResult, resolver), ...presetResult.decorations];
      areas = presetResult.areas.map((area, index) => ({
        element: setElementStyleRef(area.element, presetResult.slotStyleByElementIndex.get(index)),
        bounds: area.bounds
      }));
      areas = areas.map((area) => ({
        element: area.element,
        bounds: remapBounds(area.bounds, presetResult.frame, bodyFrame)
      }));
      presetVisualShapes = presetVisualShapes.map((shape) => remapCustomShape(shape, presetResult.frame, bodyFrame));
    } else {
      areas = remapAreasToPlaceholder(result.areas, bodyFrame);
    }

    const context: ComponentRenderContext = {
      styleResolver: resolver,
      renderElement: async (nestedSlide, nestedElement, bounds, nestedTheme) => {
        await renderContentElement(nestedSlide, nestedElement, bounds, nestedTheme, context);
      }
    };

    for (const decoration of presetVisualShapes) {
      await renderContentElement(slide, decoration, decoration.position, theme, context);
    }

    for (const area of areas) {
      await renderContentElement(slide, area.element, area.bounds, theme, context);
    }
  }

  private async renderSectionSlide(
    slide: SlideAdapter,
    definition: Extract<Slide, { type: "section" }>,
    theme: ThemeDefinition,
    resolver: StyleResolver,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    const fallbackBg = definition.background?.color ?? "primary";
    if (templateContext !== undefined) {
      applyBackground(slide, theme, resolver, fallbackBg);
      applyTemplateBackgroundObjects(slide, theme, resolver, templateContext);
    } else {
      applyBackground(slide, theme, resolver, fallbackBg);
    }

    const titleColor =
      templateContext === undefined
        ? resolver.resolveColor("text-light", "text-light")
        : resolver.resolveColor(theme.defaults.contentSlide.titleColor, "text-dark");
    const subtitleColor =
      templateContext === undefined ? resolver.resolveColor("secondary", "secondary") : resolver.resolveColor("accent", "accent");

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
    resolver: StyleResolver,
    templateContext?: SlideTemplateContext
  ): Promise<void> {
    const bg = definition.background;
    if (typeof bg === "string") {
      applyBackground(slide, theme, resolver, bg === "dark" ? "background-dark" : "background-light");
    } else if (bg !== undefined) {
      applyBackground(slide, theme, resolver, bg.color);
    } else {
      applyBackground(slide, theme, resolver, "background-light");
    }

    if (templateContext !== undefined) {
      applyTemplateBackgroundObjects(slide, theme, resolver, templateContext);
    }

    const context: ComponentRenderContext = {
      styleResolver: resolver,
      renderElement: async (nestedSlide, nestedElement, bounds, nestedTheme) => {
        await renderContentElement(nestedSlide, nestedElement, bounds, nestedTheme, context);
      }
    };

    for (const element of definition.elements) {
      const bounds = resolveElementBounds(element, DEFAULT_BLANK_ELEMENT_BOUNDS);
      await renderContentElement(slide, element, bounds, theme, context);
    }
  }

  private renderFooter(
    slide: SlideAdapter,
    theme: ThemeDefinition,
    resolver: StyleResolver,
    templateContext: SlideTemplateContext | undefined,
    renderContext: SlideRenderContext
  ): void {
    const dslFooter = renderContext.chrome?.footer;
    if (dslFooter !== undefined) {
      this.renderResolvedFooter(slide, theme, resolver, renderContext, dslFooter);
      return;
    }

    const templateFooter = this.resolveTemplateFooter(templateContext);
    if (templateFooter !== undefined) {
      this.renderResolvedFooter(slide, theme, resolver, renderContext, templateFooter);
      return;
    }

    const themeFooter = this.resolveThemeFooter(theme);
    if (themeFooter !== undefined) {
      this.renderResolvedFooter(slide, theme, resolver, renderContext, themeFooter);
      return;
    }
  }

  private resolveTemplateFooter(templateContext: SlideTemplateContext | undefined): FooterChrome | undefined {
    const footer = templateContext?.templatePackage.chrome?.footer;
    if (footer === undefined) {
      return undefined;
    }

    const resolved: FooterChrome = {
      enabled: true
    };
    if (footer.leftText !== undefined) {
      resolved.leftText = footer.leftText;
    }
    if (footer.showSlideNumber !== undefined) {
      resolved.showSlideNumber = footer.showSlideNumber;
    }
    if (footer.color !== undefined) {
      resolved.color = footer.color;
    }
    if (footer.fontFace !== undefined) {
      resolved.fontFace = footer.fontFace;
    }
    if (footer.fontSizePt !== undefined) {
      resolved.fontSize = footer.fontSizePt;
    }
    return resolved;
  }

  private resolveThemeFooter(theme: ThemeDefinition): FooterChrome | undefined {
    const footer = theme.chromeDefaults?.footer;
    if (footer === undefined) {
      return undefined;
    }

    const resolved: FooterChrome = {};
    if (footer.enabled !== undefined) {
      resolved.enabled = footer.enabled;
    }
    if (footer.leftText !== undefined) {
      resolved.leftText = footer.leftText;
    }
    if (footer.showSlideNumber !== undefined) {
      resolved.showSlideNumber = footer.showSlideNumber;
    }
    if (footer.color !== undefined) {
      resolved.color = footer.color;
    }
    if (footer.fontFace !== undefined) {
      resolved.fontFace = footer.fontFace;
    }
    if (footer.fontSize !== undefined) {
      resolved.fontSize = footer.fontSize;
    }
    if (footer.divider !== undefined) {
      const divider: NonNullable<FooterChrome["divider"]> = {};
      if (footer.divider.enabled !== undefined) {
        divider.enabled = footer.divider.enabled;
      }
      if (footer.divider.x !== undefined) {
        divider.x = footer.divider.x;
      }
      if (footer.divider.y !== undefined) {
        divider.y = footer.divider.y;
      }
      if (footer.divider.w !== undefined) {
        divider.w = footer.divider.w;
      }
      if (footer.divider.color !== undefined) {
        divider.color = footer.divider.color;
      }
      if (footer.divider.width !== undefined) {
        divider.width = footer.divider.width;
      }
      resolved.divider = divider;
    }
    return resolved;
  }

  private renderResolvedFooter(
    slide: SlideAdapter,
    theme: ThemeDefinition,
    resolver: StyleResolver,
    renderContext: SlideRenderContext,
    footer: FooterChrome
  ): void {
    if ((footer.enabled ?? true) !== true) {
      return;
    }

    const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
    const defaultColorToken =
      renderContext.footerOnDarkBackground === true ? "text-light" : theme.colors["muted-text"] !== undefined ? "muted-text" : "text-dark";
    const textColor = resolver.resolveColor(footer.color ?? defaultColorToken, defaultColorToken);
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
          color: resolver.resolveColor(divider.color ?? "neutral-border", "neutral-border"),
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

    if ((footer.showSlideNumber ?? true) === true) {
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
