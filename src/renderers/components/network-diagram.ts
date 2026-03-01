import type { Bounds, NetworkDiagramElement, ThemeDefinition } from "../../types";
import { ForceDirectedLayout } from "../../layout/algorithms/force-directed";
import { HierarchicalLayout } from "../../layout/algorithms/hierarchical";
import type { NodePosition } from "../../layout/algorithms/hierarchical";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

const NODE_WIDTH = 1.3;
const NODE_HEIGHT = 0.7;

function circularLayout(element: NetworkDiagramElement, bounds: Bounds): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const centerX = bounds.x + bounds.w / 2;
  const centerY = bounds.y + bounds.h / 2;
  const radius = Math.max(0.2, Math.min(bounds.w, bounds.h) / 2 - NODE_WIDTH);
  const count = element.nodes.length;

  element.nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius - NODE_WIDTH / 2,
      y: centerY + Math.sin(angle) * radius - NODE_HEIGHT / 2
    });
  });

  return positions;
}

export function renderNetworkDiagram(
  slide: SlideAdapter,
  element: NetworkDiagramElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const style = resolver.resolveNetworkStyle(element.styleRef ?? "default");
  let positions: Map<string, NodePosition>;

  if (element.layout === "hierarchical") {
    positions = new HierarchicalLayout(NODE_WIDTH, NODE_HEIGHT).calculate(element.nodes, element.edges, bounds);
  } else if (element.layout === "force-directed") {
    positions = new ForceDirectedLayout(NODE_WIDTH, NODE_HEIGHT, {
      maxIterations: 60,
      seed: 42
    }).calculate(element.nodes, element.edges, bounds);
  } else {
    positions = circularLayout(element, bounds);
  }

  element.edges.forEach((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (from === undefined || to === undefined) {
      return;
    }

    const fromCenterX = from.x + NODE_WIDTH / 2;
    const fromCenterY = from.y + NODE_HEIGHT / 2;
    const toCenterX = to.x + NODE_WIDTH / 2;
    const toCenterY = to.y + NODE_HEIGHT / 2;

    slide.addShape("line", {
      x: fromCenterX,
      y: fromCenterY,
      w: toCenterX - fromCenterX,
      h: toCenterY - fromCenterY,
      line: {
        color: resolver.resolveColor(style.edgeColor, "text-dark"),
        width: 1,
        dashType: edge.style === "dashed" ? "dash" : "solid"
      }
    });

    if (edge.label !== undefined) {
      slide.addText(edge.label, {
        x: (fromCenterX + toCenterX) / 2 - 0.4,
        y: (fromCenterY + toCenterY) / 2 - 0.1,
        w: 0.8,
        h: 0.2,
        fontSize: 8,
        color: resolver.resolveColor(style.labelColor, "text-dark"),
        align: "center"
      });
    }
  });

  element.nodes.forEach((node) => {
    const position = positions.get(node.id);
    if (position === undefined) {
      return;
    }

    slide.addShape("roundRect", {
      x: position.x,
      y: position.y,
      w: NODE_WIDTH,
      h: NODE_HEIGHT,
      fill: {
        color: resolver.resolveColor(node.color ?? style.nodeFillColor, "primary")
      },
      line: {
        color: resolver.resolveColor(style.nodeBorderColor, "neutral-border"),
        width: 1
      }
    });

    slide.addText(node.label, {
      x: position.x,
      y: position.y,
      w: NODE_WIDTH,
      h: NODE_HEIGHT,
      fontFace: theme.typography.fonts.caption,
      fontSize: 9,
      bold: true,
      color: resolver.resolveColor(style.nodeTextColor, "text-light"),
      align: "center",
      valign: "mid"
    });
  });
}
