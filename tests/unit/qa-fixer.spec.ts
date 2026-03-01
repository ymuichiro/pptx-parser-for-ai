import { describe, expect, it } from "vitest";
import { QAFixer } from "../../src/qa/fixer";
import type { PresentationDSL } from "../../src/types";

describe("QAFixer", () => {
  it("returns cloned dsl when issues exist", () => {
    const fixer = new QAFixer();
    const dsl: PresentationDSL = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "qa" },
      slides: []
    };

    const fixed = fixer.fix(dsl, [{ code: "X", message: "issue" }]);
    expect(fixed).toEqual(dsl);
    expect(fixed).not.toBe(dsl);
  });

  it("returns same when no issues", () => {
    const fixer = new QAFixer();
    const dsl: PresentationDSL = {
      version: "2.0",
      theme: "corporate-blue",
      metadata: { title: "qa" },
      slides: []
    };

    const fixed = fixer.fix(dsl, []);
    expect(fixed).toBe(dsl);
  });
});
