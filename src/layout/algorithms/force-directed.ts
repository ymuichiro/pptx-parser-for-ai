import type { Bounds, NetworkEdge, NetworkNode } from "../../types";
import { clampBounds } from "../../utils/geometry";
import type { NodePosition } from "./hierarchical";

export interface ForceDirectedOptions {
  maxIterations?: number;
  seed?: number;
}

function createRandom(seedInput: number): () => number {
  let seed = seedInput % 2147483647;
  if (seed <= 0) {
    seed += 2147483646;
  }

  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export class ForceDirectedLayout {
  private readonly nodeWidth: number;
  private readonly nodeHeight: number;
  private readonly maxIterations: number;
  private readonly seed: number;

  public constructor(nodeWidth: number, nodeHeight: number, options?: ForceDirectedOptions) {
    this.nodeWidth = nodeWidth;
    this.nodeHeight = nodeHeight;
    this.maxIterations = options?.maxIterations ?? 100;
    this.seed = options?.seed ?? 42;
  }

  public calculate(nodes: NetworkNode[], edges: NetworkEdge[], bounds: Bounds): Map<string, NodePosition> {
    const rand = createRandom(this.seed);
    const positions = new Map<string, NodePosition>();

    nodes.forEach((node) => {
      positions.set(node.id, {
        x: bounds.x + rand() * Math.max(0.1, bounds.w - this.nodeWidth),
        y: bounds.y + rand() * Math.max(0.1, bounds.h - this.nodeHeight)
      });
    });

    const k = Math.sqrt((bounds.w * bounds.h) / Math.max(1, nodes.length));

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      const displacements = new Map<string, { dx: number; dy: number }>();
      nodes.forEach((node) => displacements.set(node.id, { dx: 0, dy: 0 }));

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const nodeA = nodes[i];
          const nodeB = nodes[j];
          if (nodeA === undefined || nodeB === undefined) {
            continue;
          }

          const posA = positions.get(nodeA.id);
          const posB = positions.get(nodeB.id);
          if (posA === undefined || posB === undefined) {
            continue;
          }

          let dx = posA.x - posB.x;
          let dy = posA.y - posB.y;
          const distance = Math.max(0.01, Math.hypot(dx, dy));
          const force = (k * k) / distance;

          dx = (dx / distance) * force;
          dy = (dy / distance) * force;

          const dispA = displacements.get(nodeA.id);
          const dispB = displacements.get(nodeB.id);
          if (dispA !== undefined && dispB !== undefined) {
            dispA.dx += dx;
            dispA.dy += dy;
            dispB.dx -= dx;
            dispB.dy -= dy;
          }
        }
      }

      edges.forEach((edge) => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (fromPos === undefined || toPos === undefined) {
          return;
        }

        let dx = fromPos.x - toPos.x;
        let dy = fromPos.y - toPos.y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const force = (distance * distance) / k;

        dx = (dx / distance) * force;
        dy = (dy / distance) * force;

        const fromDisp = displacements.get(edge.from);
        const toDisp = displacements.get(edge.to);
        if (fromDisp !== undefined && toDisp !== undefined) {
          fromDisp.dx -= dx;
          fromDisp.dy -= dy;
          toDisp.dx += dx;
          toDisp.dy += dy;
        }
      });

      const cooling = 1 - iteration / this.maxIterations;
      nodes.forEach((node) => {
        const pos = positions.get(node.id);
        const displacement = displacements.get(node.id);
        if (pos === undefined || displacement === undefined) {
          return;
        }

        const nextBounds = clampBounds(
          {
            x: pos.x + displacement.dx * 0.01 * cooling,
            y: pos.y + displacement.dy * 0.01 * cooling,
            w: this.nodeWidth,
            h: this.nodeHeight
          },
          bounds
        );

        positions.set(node.id, {
          x: nextBounds.x,
          y: nextBounds.y
        });
      });
    }

    return positions;
  }
}
