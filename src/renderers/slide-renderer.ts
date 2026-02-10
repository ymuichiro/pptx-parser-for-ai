import type { ContentSlide, PresentationDSL, Slide, ThemeDefinition, TitleSlide } from "../types";
import { LayoutEngine } from "../layout";
import type { ComponentRenderContext, SlideAdapter } from "./base-renderer";
import { renderContentElement } from "./components";
import { resolveThemeColor } from "../utils/color";
import { SLIDE_DIMENSIONS } from "../constants";

export interface PresentationAdapter {
  addSlide(): SlideAdapter;
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

export class SlideRenderer {
  public async renderSlides(pres: PresentationAdapter, dsl: PresentationDSL, theme: ThemeDefinition): Promise<void> {
    for (const slide of dsl.slides) {
      await this.renderSlide(pres, slide, theme);
    }
  }

  public async renderSlide(pres: PresentationAdapter, slideDefinition: Slide, theme: ThemeDefinition): Promise<void> {
    const slide = pres.addSlide();

    if (slideDefinition.type === "title") {
      await this.renderTitleSlide(slide, slideDefinition, theme);
      return;
    }

    if (slideDefinition.type === "content") {
      await this.renderContentSlide(slide, slideDefinition, theme);
      return;
    }

    if (slideDefinition.type === "section") {
      await this.renderSectionSlide(slide, slideDefinition, theme);
      return;
    }

    await this.renderBlankSlide(slide, slideDefinition, theme);
  }

  private async renderTitleSlide(slide: SlideAdapter, definition: TitleSlide, theme: ThemeDefinition): Promise<void> {
    const defaultBg = theme.defaults.titleSlide.background;
    if (typeof definition.background === "string") {
      applyBackground(slide, theme, definition.background === "dark" ? "background-dark" : "background-light");
    } else if (definition.background !== undefined) {
      applyBackground(slide, theme, definition.background.color);
    } else {
      applyBackground(slide, theme, defaultBg);
    }

    slide.addText(definition.content.title, {
      x: 0.7,
      y: 1.6,
      w: 8.6,
      h: 1.2,
      fontFace: theme.typography.fonts.title,
      fontSize: theme.typography.sizes.title,
      bold: true,
      color: resolveThemeColor(theme, theme.defaults.titleSlide.titleColor, "text-light"),
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
        color: resolveThemeColor(theme, theme.defaults.titleSlide.subtitleColor, "secondary"),
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
        color: resolveThemeColor(theme, theme.defaults.titleSlide.subtitleColor, "secondary"),
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

  private async renderContentSlide(slide: SlideAdapter, definition: ContentSlide, theme: ThemeDefinition): Promise<void> {
    applyBackground(slide, theme, theme.defaults.contentSlide.background);

    slide.addText(definition.title, {
      x: 0.5,
      y: 0.2,
      w: 9,
      h: 0.5,
      fontFace: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.heading,
      bold: true,
      color: resolveThemeColor(theme, theme.defaults.contentSlide.titleColor, "text-dark")
    });

    const engine = new LayoutEngine(theme);
    const result = engine.calculateLayout(definition.content, definition.layout ?? "auto");

    const context: ComponentRenderContext = {
      renderElement: async (nestedSlide, nestedElement, bounds, nestedTheme) => {
        await renderContentElement(nestedSlide, nestedElement, bounds, nestedTheme, context);
      }
    };

    for (const area of result.areas) {
      await renderContentElement(slide, area.element, area.bounds, theme, context);
    }
  }

  private async renderSectionSlide(
    slide: SlideAdapter,
    definition: Extract<Slide, { type: "section" }>,
    theme: ThemeDefinition
  ): Promise<void> {
    applyBackground(slide, theme, definition.background?.color ?? "primary");

    slide.addText(definition.title, {
      x: 1,
      y: 2,
      w: 8,
      h: 1,
      fontFace: theme.typography.fonts.title,
      fontSize: theme.typography.sizes.title,
      bold: true,
      align: "center",
      color: resolveThemeColor(theme, "text-light", "text-light")
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
        color: resolveThemeColor(theme, "secondary", "secondary")
      });
    }
  }

  private async renderBlankSlide(
    slide: SlideAdapter,
    definition: Extract<Slide, { type: "blank" }>,
    theme: ThemeDefinition
  ): Promise<void> {
    const bg = definition.background;
    if (typeof bg === "string") {
      applyBackground(slide, theme, bg === "dark" ? "background-dark" : "background-light");
    } else if (bg !== undefined) {
      applyBackground(slide, theme, bg.color);
    } else {
      applyBackground(slide, theme, "background-light");
    }

    const context: ComponentRenderContext = {
      renderElement: async (nestedSlide, nestedElement, bounds, nestedTheme) => {
        await renderContentElement(nestedSlide, nestedElement, bounds, nestedTheme, context);
      }
    };

    for (const element of definition.elements) {
      const bounds =
        element.type === "custom-shape"
          ? element.position
          : {
              x: 0.8,
              y: 0.8,
              w: 8.4,
              h: 4.0
            };
      await renderContentElement(slide, element, bounds, theme, context);
    }
  }
}
