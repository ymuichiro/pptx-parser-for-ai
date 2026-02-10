import type { Bounds, ContentElement, ThemeDefinition, TwoColumnElement } from "../../types";
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

  const gap = 0.15;
  const itemHeight = (bounds.h - gap * Math.max(0, elements.length - 1)) / elements.length;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element === undefined) {
      continue;
    }

    await context.renderElement(slide, element, {
      x: bounds.x,
      y: bounds.y + index * (itemHeight + gap),
      w: bounds.w,
      h: itemHeight
    }, theme);
  }
}

export async function renderTwoColumn(
  slide: SlideAdapter,
  element: TwoColumnElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  context: ComponentRenderContext
): Promise<void> {
  const [leftRatio, rightRatio] = ratioToNumbers(element.ratio);
  const total = leftRatio + rightRatio;
  const gap = 0.2;
  const leftWidth = (bounds.w - gap) * (leftRatio / total);
  const rightWidth = bounds.w - gap - leftWidth;

  await renderColumn(
    slide,
    element.left,
    {
      x: bounds.x,
      y: bounds.y,
      w: leftWidth,
      h: bounds.h
    },
    theme,
    context
  );

  await renderColumn(
    slide,
    element.right,
    {
      x: bounds.x + leftWidth + gap,
      y: bounds.y,
      w: rightWidth,
      h: bounds.h
    },
    theme,
    context
  );
}
