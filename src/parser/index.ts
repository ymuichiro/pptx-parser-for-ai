import * as fs from "node:fs/promises";
import * as yaml from "js-yaml";
import type { PresentationDSL } from "../types";
import { ParseError, ValidationError } from "../errors";
import { DSLNormalizer } from "./normalizer";
import { DSLValidator, type DSLValidatorOptions, type ValidationResult } from "./validator";

export class DSLParser {
  private readonly validator: DSLValidator;
  private readonly normalizer: DSLNormalizer;

  public constructor(options?: DSLValidatorOptions) {
    this.validator = new DSLValidator(options);
    this.normalizer = new DSLNormalizer();
  }

  public async parseFile(filePath: string): Promise<PresentationDSL> {
    const content = await fs.readFile(filePath, "utf-8");
    return this.parse(content);
  }

  public parse(yamlString: string): PresentationDSL {
    try {
      const data = yaml.load(yamlString, { schema: yaml.JSON_SCHEMA }) as unknown;
      const result = this.validate(data);
      if (!result.isValid) {
        throw new ValidationError(result.errors);
      }
      return data as PresentationDSL;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ParseError(`Failed to parse DSL: ${(error as Error).message}`, error);
    }
  }

  public validate(dsl: unknown): ValidationResult {
    return this.validator.validate(dsl);
  }

  public normalize(dsl: PresentationDSL): PresentationDSL {
    return this.normalizer.normalize(dsl);
  }
}
