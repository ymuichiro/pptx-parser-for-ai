import { SLIDE_DIMENSIONS } from "../constants";
import { LayoutError } from "../errors";
import type { Bounds, ContentElement, ElementArea, LayoutResult, LayoutType, ThemeDefinition } from "../types";
import { clampBounds } from "../utils/geometry";
import { LayoutConstraints } from "./constraints";

interface ColumnBounds extends Bounds {}

export class LayoutEngine {
  private readonly constraints: LayoutConstraints;
  private readonly slideWidth: number;
  private readonly slideHeight: number;

  public constructor(theme: ThemeDefinition) {
    this.constraints = new LayoutConstraints(theme);
    const dimensions = SLIDE_DIMENSIONS[theme.layout.slideSize];
    this.slideWidth = dimensions.width;
    this.slideHeight = dimensions.height;
  }

  public calculateLayout(elements: ContentElement[], layoutType: LayoutType = "auto"): LayoutResult {
    if (elements.length === 0) {
      return { areas: [] };
    }

    switch (layoutType) {
      case "auto":
        return this.autoLayout(elements);
      case "single-column":
        return this.singleColumnLayout(elements);
      case "two-column":
        return this.twoColumnLayout(elements);
      case "three-column":
        return this.threeColumnLayout(elements);
      default:
        throw new LayoutError(`Unsupported layout type: ${layoutType}`);
    }
  }

  public getSlideBounds(): Bounds {
    return {
      x: 0,
      y: 0,
      w: this.slideWidth,
      h: this.slideHeight
    };
  }

  private autoLayout(elements: ContentElement[]): LayoutResult {
    const hasVisual = elements.some((element) =>
      ["image", "network-diagram", "flowchart", "chart", "icon-grid"].includes(element.type)
    );

    const hasText = elements.some((element) => ["text", "bullet-list", "numbered-list"].includes(element.type));
    const allStat = elements.every((element) => element.type === "stat-callout");

    if (allStat) {
      return this.threeColumnLayout(elements);
    }

    if (hasVisual && hasText) {
      return this.twoColumnLayout(elements);
    }

    return this.singleColumnLayout(elements);
  }

  private singleColumnLayout(elements: ContentElement[]): LayoutResult {
    const margin = this.constraints.minMargin;
    const gap = this.constraints.elementGap;
    const contentArea: Bounds = {
      x: margin,
      y: 1.0,
      w: this.slideWidth - margin * 2,
      h: this.slideHeight - 1.0 - margin
    };

    const elementHeight = (contentArea.h - gap * Math.max(0, elements.length - 1)) / elements.length;
    const areas = elements.map((element, index) => {
      const bounds = clampBounds(
        {
          x: contentArea.x,
          y: contentArea.y + index * (elementHeight + gap),
          w: contentArea.w,
          h: elementHeight
        },
        contentArea
      );

      return { element, bounds };
    });

    return { areas };
  }

  private twoColumnLayout(elements: ContentElement[]): LayoutResult {
    const margin = this.constraints.minMargin;
    const gap = this.constraints.elementGap;
    const contentY = 1.0;
    const contentH = this.slideHeight - contentY - margin;
    const columnW = (this.slideWidth - margin * 2 - gap) / 2;

    const leftColumn: ColumnBounds = {
      x: margin,
      y: contentY,
      w: columnW,
      h: contentH
    };
    const rightColumn: ColumnBounds = {
      x: margin + columnW + gap,
      y: contentY,
      w: columnW,
      h: contentH
    };

    const distribution = this.distributeElements(elements);
    const leftAreas = this.arrangeColumn(distribution.left, leftColumn);
    const rightAreas = this.arrangeColumn(distribution.right, rightColumn);

    return {
      areas: [...leftAreas, ...rightAreas]
    };
  }

  private threeColumnLayout(elements: ContentElement[]): LayoutResult {
    const margin = this.constraints.minMargin;
    const gap = this.constraints.elementGap;
    const contentY = 1.0;
    const contentH = this.slideHeight - contentY - margin;
    const columnW = (this.slideWidth - margin * 2 - gap * 2) / 3;

    const columns: ColumnBounds[] = [
      { x: margin, y: contentY, w: columnW, h: contentH },
      { x: margin + columnW + gap, y: contentY, w: columnW, h: contentH },
      { x: margin + (columnW + gap) * 2, y: contentY, w: columnW, h: contentH }
    ];

    const grouped: ContentElement[][] = [[], [], []];
    elements.forEach((element, index) => {
      grouped[index % 3]?.push(element);
    });

    const areas: ElementArea[] = [];
    columns.forEach((column, index) => {
      const group = grouped[index] ?? [];
      areas.push(...this.arrangeColumn(group, column));
    });

    return { areas };
  }

  private arrangeColumn(elements: ContentElement[], columnBounds: ColumnBounds): ElementArea[] {
    if (elements.length === 0) {
      return [];
    }

    const gap = this.constraints.elementGap;
    const totalHeight = columnBounds.h - gap * Math.max(0, elements.length - 1);
    const itemHeight = totalHeight / elements.length;

    return elements.map((element, index) => ({
      element,
      bounds: clampBounds(
        {
          x: columnBounds.x,
          y: columnBounds.y + index * (itemHeight + gap),
          w: columnBounds.w,
          h: itemHeight
        },
        columnBounds
      )
    }));
  }

  private distributeElements(elements: ContentElement[]): { left: ContentElement[]; right: ContentElement[] } {
    const left: ContentElement[] = [];
    const right: ContentElement[] = [];

    for (const element of elements) {
      if (["image", "network-diagram", "flowchart", "chart", "icon-grid"].includes(element.type)) {
        right.push(element);
      } else {
        left.push(element);
      }
    }

    if (left.length === 0 || right.length === 0) {
      const half = Math.ceil(elements.length / 2);
      return {
        left: elements.slice(0, half),
        right: elements.slice(half)
      };
    }

    return { left, right };
  }
}
