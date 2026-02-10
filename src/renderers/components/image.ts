import * as path from "node:path";
import type { Bounds, ImageElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { RenderError } from "../../errors";

function hasTraversal(value: string): boolean {
  return path.posix.normalize(value.replace(/\\/g, "/")).split("/").includes("..");
}

export async function renderImage(
  slide: SlideAdapter,
  element: ImageElement,
  bounds: Bounds,
  theme: ThemeDefinition
): Promise<void> {
  if (/^https?:\/\//i.test(element.source)) {
    throw new RenderError("Remote image URL rendering is disabled by default");
  }

  if (!/^data:image\//.test(element.source) && hasTraversal(element.source)) {
    throw new RenderError("Image source contains path traversal segments");
  }

  const imageOptions: Record<string, unknown> = {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h
  };

  if (/^data:image\//.test(element.source)) {
    imageOptions.data = element.source;
  } else {
    imageOptions.path = element.source;
  }

  slide.addImage(imageOptions);

  if (element.caption !== undefined) {
    slide.addText(element.caption, {
      x: bounds.x,
      y: bounds.y + bounds.h - 0.2,
      w: bounds.w,
      h: 0.2,
      fontFace: theme.typography.fonts.caption,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors["text-dark"],
      align: "center"
    });
  }
}
