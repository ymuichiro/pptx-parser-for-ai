import { describe, expect, it } from "vitest";
import { ForceDirectedLayout, HierarchicalLayout } from "../../src/layout";
import type { Bounds, NetworkEdge, NetworkNode } from "../../src/types";

const nodes: NetworkNode[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" }
];

const edges: NetworkEdge[] = [
  { from: "a", to: "b" },
  { from: "b", to: "c" }
];

const bounds: Bounds = {
  x: 0,
  y: 0,
  w: 6,
  h: 3
};

describe("layout algorithms", () => {
  it("hierarchical layout returns one position per node", () => {
    const layout = new HierarchicalLayout(1, 0.6);
    const positions = layout.calculate(nodes, edges, bounds);

    expect(positions.size).toBe(nodes.length);
    for (const node of nodes) {
      const position = positions.get(node.id);
      expect(position).toBeDefined();
      expect((position?.x ?? -1) >= bounds.x).toBe(true);
      expect((position?.y ?? -1) >= bounds.y).toBe(true);
    }
  });

  it("force-directed layout is deterministic with fixed seed", () => {
    const layoutA = new ForceDirectedLayout(1, 0.6, {
      maxIterations: 20,
      seed: 99
    });
    const layoutB = new ForceDirectedLayout(1, 0.6, {
      maxIterations: 20,
      seed: 99
    });

    const positionsA = layoutA.calculate(nodes, edges, bounds);
    const positionsB = layoutB.calculate(nodes, edges, bounds);

    expect(positionsA).toEqual(positionsB);
  });

  it("handles graphs without roots in hierarchical layout", () => {
    const layout = new HierarchicalLayout(1, 0.6);
    const cyclicEdges: NetworkEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "a" }
    ];

    const positions = layout.calculate(nodes.slice(0, 2), cyclicEdges, bounds);
    expect(positions.size).toBe(2);
    expect(positions.get("a")).toBeDefined();
    expect(positions.get("b")).toBeDefined();
  });

  it("ignores unknown edge references in force-directed layout", () => {
    const layout = new ForceDirectedLayout(1, 0.6);
    const noisyEdges: NetworkEdge[] = [...edges, { from: "x", to: "y" }];
    const positions = layout.calculate(nodes, noisyEdges, bounds);

    expect(positions.size).toBe(3);
    expect(positions.get("a")).toBeDefined();
  });
});
