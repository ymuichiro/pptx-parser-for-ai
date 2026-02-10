import type { PresentationDSL, QAConfig, QAIssue, QAResult, ThemeDefinition } from "../types";
import { QAError } from "../errors";
import { QAFixer } from "./fixer";
import { QAValidator } from "./validator";

export class QAEngine {
  private readonly validator: QAValidator;
  private readonly fixer: QAFixer;
  public readonly autoFixEnabled: boolean;
  public readonly maxIterations: number;

  public constructor(config?: QAConfig) {
    this.validator = new QAValidator();
    this.fixer = new QAFixer();
    this.autoFixEnabled = config?.autoFix ?? false;
    this.maxIterations = Math.max(1, config?.maxIterations ?? 1);
  }

  public async validate(outputPath: string, dsl: PresentationDSL, theme: ThemeDefinition): Promise<QAResult> {
    return this.validator.validate(outputPath, dsl, theme);
  }

  public fix(dsl: PresentationDSL, issues: QAIssue[]): PresentationDSL {
    try {
      return this.fixer.fix(dsl, issues);
    } catch (error) {
      throw new QAError("Failed to auto-fix issues", error);
    }
  }
}
