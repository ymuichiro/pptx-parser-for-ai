import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { ALLOWED_THEME_EXTENSIONS, DEFAULT_THEME_NAME } from "../constants";
import { ThemeError } from "../errors";
import type { ThemeDefinition } from "../types";
import { resolveAndValidatePath } from "../utils/paths";
import { parseThemeDefinition } from "./schema";

export interface ThemeLoaderOptions {
  themeDir?: string;
  allowedRoots?: string[];
}

function isThemePath(themeRef: string): boolean {
  return themeRef.includes("/") || themeRef.includes("\\") || path.extname(themeRef) !== "";
}

function hasAllowedExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return ALLOWED_THEME_EXTENSIONS.has(extension);
}

export class ThemeLoader {
  private readonly themeDir: string;
  private readonly allowedRoots: string[];

  public constructor(options?: ThemeLoaderOptions) {
    this.themeDir = options?.themeDir ?? path.resolve(process.cwd(), "themes");
    this.allowedRoots = options?.allowedRoots ?? [process.cwd(), this.themeDir];
  }

  public async load(themeRef: string | ThemeDefinition): Promise<ThemeDefinition> {
    if (typeof themeRef !== "string") {
      return this.validateTheme(themeRef);
    }

    const normalizedThemeRef = themeRef.trim();
    if (normalizedThemeRef.length === 0) {
      throw new ThemeError("Theme reference must not be empty");
    }

    if (!isThemePath(normalizedThemeRef)) {
      const builtinPath = path.join(this.themeDir, `${normalizedThemeRef}.yaml`);
      return this.loadFromFile(builtinPath);
    }

    return this.loadFromFile(normalizedThemeRef);
  }

  public async loadDefault(): Promise<ThemeDefinition> {
    return this.load(DEFAULT_THEME_NAME);
  }

  private async loadFromFile(filePath: string): Promise<ThemeDefinition> {
    if (!hasAllowedExtension(filePath)) {
      throw new ThemeError(`Unsupported theme extension: ${path.extname(filePath)}`);
    }

    let safePath: string;
    try {
      safePath = await resolveAndValidatePath(filePath, this.allowedRoots);
    } catch (error) {
      throw new ThemeError(`Theme path is not allowed: ${filePath}`, error);
    }

    try {
      const rawTheme = await fs.readFile(safePath, "utf-8");
      const parsed = yaml.load(rawTheme, { schema: yaml.JSON_SCHEMA }) as unknown;
      return this.validateTheme(parsed);
    } catch (error) {
      throw new ThemeError(`Failed to load theme from '${filePath}'`, error);
    }
  }

  private validateTheme(theme: unknown): ThemeDefinition {
    try {
      return parseThemeDefinition(theme);
    } catch (error) {
      throw new ThemeError("Theme validation failed", error);
    }
  }
}
