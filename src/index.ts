import * as fs from "node:fs/promises";
import * as path from "node:path";
import PptxGenJS from "pptxgenjs";
import { DEFAULT_THEME_NAME } from "./constants";
import { IOError, ValidationError } from "./errors";
import { LayoutEngine } from "./layout";
import { DSLParser } from "./parser";
import { QAEngine } from "./qa";
import { SlideRenderer } from "./renderers";
import type { PresentationAdapter } from "./renderers";
import { ThemeManager } from "./theme";
import { ensureOutputDir } from "./utils/paths";
import type {
  PresentationDSL,
  QAConfig,
  QAResult,
  ThemeDefinition
} from "./types";

export interface RendererOptions {
  enableQA?: boolean;
  qaConfig?: QAConfig;
  allowRemoteImages?: boolean;
  themeDir?: string;
}

export interface GenerationMetadata {
  slideCount: number;
  generatedAt: Date;
}

export interface GenerationResult {
  success: boolean;
  outputPath: string;
  qaResult?: QAResult;
  metadata: GenerationMetadata;
}

function resolveLayoutName(theme: ThemeDefinition): { layoutName: string } {
  if (theme.layout.slideSize === "16:9") {
    return { layoutName: "LAYOUT_16x9" };
  }

  if (theme.layout.slideSize === "4:3") {
    return { layoutName: "LAYOUT_4x3" };
  }

  return { layoutName: "LAYOUT_16x10" };
}

export class PPTXRenderer {
  private readonly themeManager: ThemeManager;
  private readonly parser: DSLParser;
  private readonly renderer: SlideRenderer;
  private readonly qa?: QAEngine;

  public constructor(options?: RendererOptions) {
    this.themeManager = new ThemeManager(options?.themeDir !== undefined ? { themeDir: options.themeDir } : undefined);
    this.parser = new DSLParser({
      allowRemoteImages: options?.allowRemoteImages ?? false
    });
    this.renderer = new SlideRenderer();

    if (options?.enableQA) {
      this.qa = new QAEngine(options.qaConfig);
    }
  }

  public async generateFromFile(dslPath: string, outputPath: string): Promise<GenerationResult> {
    const dsl = await this.parser.parseFile(dslPath);
    return this.generate(dsl, outputPath);
  }

  public async generate(dsl: PresentationDSL, outputPath: string): Promise<GenerationResult> {
    return this.generateInternal(dsl, outputPath, 0);
  }

  private async generateInternal(dsl: PresentationDSL, outputPath: string, iteration: number): Promise<GenerationResult> {
    const validationResult = this.parser.validate(dsl);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }

    const normalized = this.parser.normalize(dsl);
    const theme = await this.themeManager.loadTheme(normalized.theme ?? DEFAULT_THEME_NAME);

    const presentation = new PptxGenJS();
    this.setupPresentation(presentation, normalized, theme);

    await this.renderer.renderSlides(presentation as unknown as PresentationAdapter, normalized, theme);

    await ensureOutputDir(outputPath);
    await this.writeAtomic(presentation, outputPath);

    let qaResult: QAResult | undefined;

    if (this.qa !== undefined) {
      qaResult = await this.qa.validate(outputPath, normalized, theme);

      if (
        qaResult.hasIssues &&
        this.qa.autoFixEnabled &&
        iteration + 1 < this.qa.maxIterations
      ) {
        const fixedDSL = this.qa.fix(normalized, qaResult.issues);
        return this.generateInternal(fixedDSL, outputPath, iteration + 1);
      }
    }

    const response: GenerationResult = {
      success: true,
      outputPath,
      metadata: {
        slideCount: normalized.slides.length,
        generatedAt: new Date()
      }
    };

    if (qaResult !== undefined) {
      response.qaResult = qaResult;
    }

    return response;
  }

  private setupPresentation(presentation: PptxGenJS, dsl: PresentationDSL, theme: ThemeDefinition): void {
    const layout = resolveLayoutName(theme);

    presentation.layout = layout.layoutName;

    presentation.author = dsl.metadata.author ?? "";
    presentation.company = dsl.metadata.company ?? "";
    presentation.subject = dsl.metadata.title;
    presentation.title = dsl.metadata.title;

    // 参照用途: レイアウト計算の決定性を維持。
    const _layoutEngine = new LayoutEngine(theme);
    void _layoutEngine;
  }

  private async writeAtomic(presentation: PptxGenJS, outputPath: string): Promise<void> {
    const extension = path.extname(outputPath);
    const base = outputPath.slice(0, Math.max(0, outputPath.length - extension.length));
    const tempPath = `${base}.${Date.now()}.${process.pid}.tmp${extension || ".pptx"}`;

    try {
      await presentation.writeFile({ fileName: tempPath });
      await fs.rename(tempPath, outputPath);
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      throw new IOError(`Failed to write presentation: ${outputPath}`, error);
    }
  }
}

export * from "./errors";
export * from "./layout";
export * from "./parser";
export * from "./qa";
export * from "./renderers";
export * from "./theme";
export * from "./types";
