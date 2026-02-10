import type { Bounds, NetworkEdge, NetworkNode } from "../../types";

export interface NodePosition {
  x: number;
  y: number;
}

export class HierarchicalLayout {
  private readonly nodeWidth: number;
  private readonly nodeHeight: number;

  public constructor(nodeWidth: number, nodeHeight: number) {
    this.nodeWidth = nodeWidth;
    this.nodeHeight = nodeHeight;
  }

  public calculate(nodes: NetworkNode[], edges: NetworkEdge[], bounds: Bounds): Map<string, NodePosition> {
    const incomingCounts = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    nodes.forEach((node) => {
      incomingCounts.set(node.id, 0);
      adjacency.set(node.id, []);
    });

    edges.forEach((edge) => {
      adjacency.get(edge.from)?.push(edge.to);
      incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
    });

    const roots = nodes.filter((node) => (incomingCounts.get(node.id) ?? 0) === 0).map((node) => node.id);
    const queue: string[] = roots.length > 0 ? [...roots] : [nodes[0]?.id ?? ""];
    const levels = new Map<string, number>();

    queue.forEach((nodeId) => levels.set(nodeId, 0));

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        continue;
      }

      const currentLevel = levels.get(current) ?? 0;
      const targets = adjacency.get(current) ?? [];
      for (const target of targets) {
        if (!levels.has(target)) {
          levels.set(target, currentLevel + 1);
          queue.push(target);
        }
      }
    }

    nodes.forEach((node) => {
      if (!levels.has(node.id)) {
        levels.set(node.id, 0);
      }
    });

    const grouped = new Map<number, NetworkNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.id) ?? 0;
      const existing = grouped.get(level) ?? [];
      existing.push(node);
      grouped.set(level, existing);
    }

    const maxLevel = Math.max(...grouped.keys());
    const positions = new Map<string, NodePosition>();
    const usableHeight = Math.max(bounds.h - this.nodeHeight, this.nodeHeight);
    const levelGap = maxLevel === 0 ? 0 : usableHeight / maxLevel;

    for (const [level, levelNodes] of grouped.entries()) {
      const usableWidth = Math.max(bounds.w - this.nodeWidth, this.nodeWidth);
      const step = levelNodes.length <= 1 ? 0 : usableWidth / (levelNodes.length - 1);

      levelNodes.forEach((node, index) => {
        positions.set(node.id, {
          x: bounds.x + (levelNodes.length <= 1 ? usableWidth / 2 : step * index),
          y: bounds.y + level * levelGap
        });
      });
    }

    return positions;
  }
}
