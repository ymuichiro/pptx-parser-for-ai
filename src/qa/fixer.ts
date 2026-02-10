import type { PresentationDSL, QAIssue } from "../types";

export class QAFixer {
  public fix(dsl: PresentationDSL, issues: QAIssue[]): PresentationDSL {
    if (issues.length === 0) {
      return dsl;
    }

    if (typeof structuredClone === "function") {
      return structuredClone(dsl);
    }

    return JSON.parse(JSON.stringify(dsl)) as PresentationDSL;
  }
}
