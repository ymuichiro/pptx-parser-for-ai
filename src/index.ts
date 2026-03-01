import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";
import PptxGenJS from "pptxgenjs";
import { DEFAULT_THEME_NAME } from "./constants";
import { IOError, ParseError, ValidationError } from "./errors";
import { LayoutEngine } from "./layout";
import { DSLParser } from "./parser";
import { QAEngine } from "./qa";
import { SlideRenderer } from "./renderers";
import type { PresentationAdapter } from "./renderers";
import type { ImportedTemplatePackage } from "./template-importer/types";
import { parseImportedTemplatePackage } from "./template-importer/types";
import { ThemeManager } from "./theme";
import { ensureOutputDir } from "./utils/paths";
import { applyKeynoteChartCompatibilityFix } from "./utils/chart-compat";
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
  templatePackage?: ImportedTemplatePackage;
  templatePackagePath?: string;
  templateAssetBaseDir?: string;
  disableChartCompatibilityPatch?: boolean;
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

interface ResolvedTemplateRenderContext {
  templatePackage: ImportedTemplatePackage;
  assetBaseDir: string;
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
  private readonly templatePackage: ImportedTemplatePackage | undefined;
  private readonly templatePackagePath: string | undefined;
  private readonly templateAssetBaseDir: string | undefined;
  private readonly disableChartCompatibilityPatch: boolean;
  private cachedTemplateContext?: ResolvedTemplateRenderContext;

  public constructor(options?: RendererOptions) {
    if (options?.templatePackage !== undefined && options.templatePackagePath !== undefined) {
      throw new ValidationError(["RendererOptions.templatePackage and templatePackagePath cannot be used together"]);
    }

    this.themeManager = new ThemeManager(options?.themeDir !== undefined ? { themeDir: options.themeDir } : undefined);
    this.parser = new DSLParser({
      allowRemoteImages: options?.allowRemoteImages ?? false
    });
    this.renderer = new SlideRenderer();
    this.templatePackage = undefined;
    this.templatePackagePath = options?.templatePackagePath;
    this.templateAssetBaseDir = options?.templateAssetBaseDir;
    this.disableChartCompatibilityPatch = options?.disableChartCompatibilityPatch ?? false;

    if (options?.templatePackage !== undefined) {
      try {
        this.templatePackage = parseImportedTemplatePackage(options.templatePackage);
      } catch (error) {
        throw new ValidationError(["RendererOptions.templatePackage is invalid"], error);
      }
    }

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
    const baseTheme = await this.themeManager.loadTheme(normalized.theme ?? DEFAULT_THEME_NAME);
    const templateContext = await this.resolveTemplateContext();
    const theme = this.mergeThemeWithTemplate(baseTheme, templateContext?.templatePackage);

    const presentation = new PptxGenJS();
    this.setupPresentation(presentation, normalized, theme);

    await this.renderer.renderSlides(
      presentation as unknown as PresentationAdapter,
      normalized,
      theme,
      templateContext
    );

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

  private mergeThemeWithTemplate(theme: ThemeDefinition, templatePackage: ImportedTemplatePackage | undefined): ThemeDefinition {
    if (templatePackage === undefined) {
      return theme;
    }

    return {
      ...theme,
      colors: {
        ...theme.colors,
        ...templatePackage.theme.palette
      },
      typography: {
        ...theme.typography,
        fonts: {
          ...theme.typography.fonts,
          ...templatePackage.theme.fonts
        }
      },
      layout: {
        ...theme.layout,
        slideSize: templatePackage.theme.slideSize
      }
    };
  }

  private async resolveTemplateContext(): Promise<ResolvedTemplateRenderContext | undefined> {
    if (this.templatePackage !== undefined) {
      return {
        templatePackage: this.templatePackage,
        assetBaseDir: path.resolve(this.templateAssetBaseDir ?? process.cwd())
      };
    }

    if (this.templatePackagePath === undefined) {
      return undefined;
    }

    if (this.cachedTemplateContext !== undefined) {
      return this.cachedTemplateContext;
    }

    const safePath = path.resolve(this.templatePackagePath);

    let rawYaml: string;
    try {
      rawYaml = await fs.readFile(safePath, "utf-8");
    } catch (error) {
      throw new IOError(`Failed to read template package: ${safePath}`, error);
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(rawYaml, { schema: yaml.JSON_SCHEMA }) as unknown;
    } catch (error) {
      throw new ParseError(`Failed to parse template package YAML: ${safePath}`, error);
    }

    let templatePackage: ImportedTemplatePackage;
    try {
      templatePackage = parseImportedTemplatePackage(parsed);
    } catch (error) {
      throw new ValidationError([`Template package validation failed: ${safePath}`], error);
    }

    this.cachedTemplateContext = {
      templatePackage,
      assetBaseDir: path.dirname(safePath)
    };

    return this.cachedTemplateContext;
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
      if (!this.disableChartCompatibilityPatch) {
        await applyKeynoteChartCompatibilityFix(tempPath);
      }
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
export * from "./presets";
export * from "./qa";
export * from "./renderers";
export * from "./template-importer";
export * from "./theme";
export * from "./types";
