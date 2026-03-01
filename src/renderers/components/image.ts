import * as path from "node:path";
import { imageSize } from "image-size";
import type { Bounds, ImageElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { RenderError } from "../../errors";

type ImageAnchor = NonNullable<ImageElement["position"]>;

interface ImageDimensions {
  width: number;
  height: number;
}

function hasTraversal(value: string): boolean {
  return path.posix.normalize(value.replace(/\\/g, "/")).split("/").includes("..");
}

function parseDataImageSource(source: string): Buffer | undefined {
  const separatorIndex = source.indexOf(",");
  if (separatorIndex < 0) {
    return undefined;
  }

  const metadata = source.slice(0, separatorIndex);
  const data = source.slice(separatorIndex + 1);
  if (/;base64$/i.test(metadata)) {
    return Buffer.from(data, "base64");
  }

  try {
    return Buffer.from(decodeURIComponent(data), "utf8");
  } catch {
    return undefined;
  }
}

function resolveImageDimensions(source: string): ImageDimensions | undefined {
  try {
    const result = /^data:image\//i.test(source)
      ? imageSize(parseDataImageSource(source) ?? Buffer.alloc(0))
      : imageSize(source);
    if (result.width === undefined || result.height === undefined || result.width <= 0 || result.height <= 0) {
      return undefined;
    }

    return {
      width: result.width,
      height: result.height
    };
  } catch {
    return undefined;
  }
}

function resolveHorizontalAnchorOffset(totalWidth: number, contentWidth: number, anchor: ImageAnchor): number {
  if (anchor === "left") {
    return 0;
  }
  if (anchor === "right") {
    return Math.max(0, totalWidth - contentWidth);
  }
  return Math.max(0, (totalWidth - contentWidth) / 2);
}

function resolveContainBounds(bounds: Bounds, dimensions: ImageDimensions, anchor: ImageAnchor): Bounds {
  const scale = Math.min(bounds.w / dimensions.width, bounds.h / dimensions.height);
  const w = dimensions.width * scale;
  const h = dimensions.height * scale;

  return {
    x: bounds.x + resolveHorizontalAnchorOffset(bounds.w, w, anchor),
    y: bounds.y + (bounds.h - h) / 2,
    w,
    h
  };
}

function resolveCoverSizing(bounds: Bounds, dimensions: ImageDimensions, anchor: ImageAnchor): Record<string, unknown> {
  const imageRatio = dimensions.width / dimensions.height;
  const boundsRatio = bounds.w / bounds.h;

  if (imageRatio > boundsRatio) {
    const cropWidth = dimensions.height * boundsRatio;
    return {
      type: "crop",
      x: resolveHorizontalAnchorOffset(dimensions.width, cropWidth, anchor),
      y: 0,
      w: cropWidth,
      h: dimensions.height
    };
  }

  const cropHeight = dimensions.width / boundsRatio;
  return {
    type: "crop",
    x: 0,
    y: (dimensions.height - cropHeight) / 2,
    w: dimensions.width,
    h: cropHeight
  };
}

function resolveImageLayout(bounds: Bounds, element: ImageElement): Record<string, unknown> {
  const sizing = element.sizing ?? "contain";
  const anchor = element.position ?? "center";
  const dimensions = resolveImageDimensions(element.source);
  const baseLayout: Record<string, unknown> = {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h
  };

  if (dimensions === undefined) {
    if (sizing === "contain") {
      return {
        ...baseLayout,
        sizing: {
          type: "contain",
          w: bounds.w,
          h: bounds.h
        }
      };
    }

    return {
      ...baseLayout,
      sizing: {
        type: sizing,
        w: bounds.w,
        h: bounds.h
      }
    };
  }

  if (sizing === "contain") {
    const containBounds = resolveContainBounds(bounds, dimensions, anchor);
    return {
      ...baseLayout,
      x: containBounds.x,
      y: containBounds.y,
      w: containBounds.w,
      h: containBounds.h
    };
  }

  return {
    ...baseLayout,
    sizing: resolveCoverSizing(bounds, dimensions, anchor)
  };
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

  const effectiveBounds = element.bounds ?? bounds;
  const imageOptions = resolveImageLayout(effectiveBounds, element);

  if (/^data:image\//.test(element.source)) {
    imageOptions.data = element.source;
  } else {
    imageOptions.path = element.source;
  }

  slide.addImage(imageOptions);

  if (element.caption !== undefined) {
    slide.addText(element.caption, {
      x: effectiveBounds.x,
      y: effectiveBounds.y + effectiveBounds.h - 0.2,
      w: effectiveBounds.w,
      h: 0.2,
      fontFace: theme.typography.fonts.caption,
      fontSize: theme.typography.sizes.caption,
      color: theme.colors["text-dark"],
      align: "center"
    });
  }
}
