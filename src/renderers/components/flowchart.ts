import type { Bounds, FlowchartElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

function shapeForStep(shape: FlowchartElement["steps"][number]["shape"]): string {
  switch (shape) {
    case "rounded":
      return "roundRect";
    case "diamond":
      return "diamond";
    default:
      return "rect";
  }
}

export function renderFlowchart(
  slide: SlideAdapter,
  element: FlowchartElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const style = resolver.resolveFlowchartStyle(element.styleRef ?? "default");
  const stepCount = Math.max(1, element.steps.length);
  const horizontal = element.direction === "horizontal";
  const stepW = horizontal ? bounds.w / stepCount - 0.1 : bounds.w * 0.8;
  const stepH = horizontal ? bounds.h * 0.7 : bounds.h / stepCount - 0.1;
  const stepPositions = new Map<string, { x: number; y: number }>();

  element.steps.forEach((step, index) => {
    const x = horizontal ? bounds.x + index * (stepW + 0.1) : bounds.x + bounds.w * 0.1;
    const y = horizontal ? bounds.y + bounds.h * 0.15 : bounds.y + index * (stepH + 0.1);
    stepPositions.set(step.id, { x, y });

    slide.addShape(shapeForStep(step.shape), {
      x,
      y,
      w: stepW,
      h: stepH,
      fill: { color: resolver.resolveColor(style.stepFillColor, "surface") },
      line: { color: resolver.resolveColor(style.stepBorderColor, "neutral-border"), width: 1 }
    });

    slide.addText(step.label, {
      x,
      y,
      w: stepW,
      h: stepH,
      fontFace: theme.typography.fonts.body,
      fontSize: theme.typography.sizes.caption,
      color: resolver.resolveColor(style.stepTextColor, "text-dark"),
      align: "center",
      valign: "mid"
    });
  });

  element.flows.forEach((flow) => {
    const from = stepPositions.get(flow.from);
    const to = stepPositions.get(flow.to);
    if (from === undefined || to === undefined) {
      return;
    }

    const fromX = from.x + stepW / 2;
    const fromY = from.y + stepH / 2;
    const toX = to.x + stepW / 2;
    const toY = to.y + stepH / 2;

    slide.addShape("line", {
      x: fromX,
      y: fromY,
      w: toX - fromX,
      h: toY - fromY,
      line: {
        color: resolver.resolveColor(style.edgeColor, "text-dark"),
        width: 1
      }
    });

    if (flow.label !== undefined) {
      slide.addText(flow.label, {
        x: (fromX + toX) / 2 - 0.35,
        y: (fromY + toY) / 2 - 0.1,
        w: 0.7,
        h: 0.2,
        fontSize: 8,
        color: resolver.resolveColor(style.labelColor, "text-dark"),
        align: "center"
      });
    }
  });
}
