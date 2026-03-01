import type { Bounds, ContentElement, ThemeDefinition, TwoColumnElement } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { ComponentRenderContext, SlideAdapter } from "../base-renderer";

function ratioToNumbers(ratio: TwoColumnElement["ratio"]): [number, number] {
  if (ratio === "2:1") {
    return [2, 1];
  }
  if (ratio === "1:2") {
    return [1, 2];
  }
  return [1, 1];
}

async function renderColumn(
  slide: SlideAdapter,
  elements: ContentElement[],
  bounds: Bounds,
  theme: ThemeDefinition,
  context: ComponentRenderContext
): Promise<void> {
  if (elements.length === 0) {
    return;
  }

  const gap = theme.layout.spacing.elementGap;
  const itemHeight = (bounds.h - gap * Math.max(0, elements.length - 1)) / elements.length;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element === undefined) {
      continue;
    }

    await context.renderElement(
      slide,
      element,
      {
        x: bounds.x,
        y: bounds.y + index * (itemHeight + gap),
        w: bounds.w,
        h: itemHeight
      },
      theme
    );
  }
}

function drawColumnSurface(
  slide: SlideAdapter,
  resolver: StyleResolver,
  bounds: Bounds,
  fillToken: string | undefined,
  borderToken: string | undefined
): void {
  if (fillToken === undefined && borderToken === undefined) {
    return;
  }

  slide.addShape("roundRect", {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fill: {
      color: resolver.resolveColor(fillToken ?? "surface", "surface"),
      transparency: 0
    },
    line:
      borderToken !== undefined
        ? {
            color: resolver.resolveColor(borderToken, "neutral-border"),
            width: 0.8
          }
        : {
            color: resolver.resolveColor(fillToken ?? "surface", "surface"),
            width: 0
          }
  });
}

export async function renderTwoColumn(
  slide: SlideAdapter,
  element: TwoColumnElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  context: ComponentRenderContext,
  resolver: StyleResolver = new StyleResolver(theme)
): Promise<void> {
  const style = resolver.resolveTwoColumnStyle(element.styleRef ?? "default");
  const [leftRatio, rightRatio] = ratioToNumbers(element.ratio);
  const total = leftRatio + rightRatio;
  const gap = style.gap;
  const leftWidth = (bounds.w - gap) * (leftRatio / total);
  const rightWidth = bounds.w - gap - leftWidth;

  const leftBounds: Bounds = {
    x: bounds.x,
    y: bounds.y,
    w: leftWidth,
    h: bounds.h
  };
  const rightBounds: Bounds = {
    x: bounds.x + leftWidth + gap,
    y: bounds.y,
    w: rightWidth,
    h: bounds.h
  };

  drawColumnSurface(slide, resolver, leftBounds, style.columnFillColor, style.columnBorderColor);
  drawColumnSurface(slide, resolver, rightBounds, style.columnFillColor, style.columnBorderColor);

  await renderColumn(slide, element.left, leftBounds, theme, context);
  await renderColumn(slide, element.right, rightBounds, theme, context);
}
