import { describe, expect, it } from "vitest";
import { DSLParser } from "../../src/parser";

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[randomInt(chars.length)] ?? "a";
  }
  return result;
}

function randomElement(): unknown {
  const roll = randomInt(6);

  if (roll === 0) {
    return { type: "text", content: randomString(12) };
  }

  if (roll === 1) {
    return {
      type: "bullet-list",
      items: [randomString(6), randomString(7)]
    };
  }

  if (roll === 2) {
    return {
      type: "table",
      headers: ["A", "B"],
      rows: [[1, 2], [3, 4]]
    };
  }

  if (roll === 3) {
    return {
      type: "chart",
      chartType: "bar",
      data: {
        labels: ["A", "B"],
        series: [{ name: "s", values: [1, 2] }]
      }
    };
  }

  if (roll === 4) {
    return {
      type: "network-diagram",
      layout: "circular",
      nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      edges: [{ from: "a", to: "b" }]
    };
  }

  return {
    type: "image",
    source: "assets/a.png"
  };
}

function randomDSL(): unknown {
  return {
    version: "1.0",
    theme: "corporate-blue",
    metadata: {
      title: randomString(10)
    },
    slides: [
      {
        type: "content",
        title: randomString(8),
        content: Array.from({ length: randomInt(5) + 1 }).map(() => randomElement())
      }
    ]
  };
}

describe("Fuzz validation", () => {
  it("handles random DSL payloads without crashes", () => {
    const parser = new DSLParser();
    const cases = Number(process.env.FUZZ_CASES ?? "300");

    for (let index = 0; index < cases; index += 1) {
      const input = randomDSL();
      expect(() => parser.validate(input)).not.toThrow();
    }
  });
});
