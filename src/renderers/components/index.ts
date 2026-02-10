import type {
  Bounds,
  ContentElement,
  CustomShapeElement,
  ThemeDefinition
} from "../../types";
import type { ComponentRenderContext, SlideAdapter } from "../base-renderer";
import { RenderError } from "../../errors";
import { renderChart } from "./chart";
import { renderFlowchart } from "./flowchart";
import { renderIconGrid } from "./icon-grid";
import { renderImage } from "./image";
import { renderBulletList, renderNumberedList } from "./list";
import { renderNetworkDiagram } from "./network-diagram";
import { renderCustomShape } from "./shape";
import { renderStatCallout } from "./stat-callout";
import { renderTable } from "./table";
import { renderText } from "./text";
import { renderTwoColumn } from "./two-column";

function isCustomShapeElement(element: unknown): element is CustomShapeElement {
  return typeof element === "object" && element !== null && (element as { type?: string }).type === "custom-shape";
}

export async function renderContentElement(
  slide: SlideAdapter,
  element: unknown,
  bounds: Bounds,
  theme: ThemeDefinition,
  context: ComponentRenderContext
): Promise<void> {
  if (isCustomShapeElement(element)) {
    renderCustomShape(slide, element, bounds, theme);
    return;
  }

  if (typeof element !== "object" || element === null || !("type" in element)) {
    throw new RenderError("Unsupported element payload");
  }

  const typedElement = element as ContentElement;

  switch (typedElement.type) {
    case "text":
      renderText(slide, typedElement, bounds, theme);
      return;
    case "bullet-list":
      renderBulletList(slide, typedElement, bounds, theme);
      return;
    case "numbered-list":
      renderNumberedList(slide, typedElement, bounds, theme);
      return;
    case "table":
      renderTable(slide, typedElement, bounds, theme);
      return;
    case "chart":
      renderChart(slide, typedElement, bounds, theme);
      return;
    case "image":
      await renderImage(slide, typedElement, bounds, theme);
      return;
    case "network-diagram":
      renderNetworkDiagram(slide, typedElement, bounds, theme);
      return;
    case "flowchart":
      renderFlowchart(slide, typedElement, bounds, theme);
      return;
    case "stat-callout":
      renderStatCallout(slide, typedElement, bounds, theme);
      return;
    case "icon-grid":
      renderIconGrid(slide, typedElement, bounds, theme);
      return;
    case "two-column":
      await renderTwoColumn(slide, typedElement, bounds, theme, context);
      return;
    default: {
      const exhaustiveCheck: never = typedElement;
      throw new RenderError(`Unsupported content element type: ${(exhaustiveCheck as { type: string }).type}`);
    }
  }
}
