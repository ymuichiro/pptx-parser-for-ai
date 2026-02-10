import type { ThemeDefinition } from "../types";
import { ThemeApplier } from "./applier";
import { ThemeLoader, type ThemeLoaderOptions } from "./loader";

export class ThemeManager {
  private readonly loader: ThemeLoader;
  private readonly applier: ThemeApplier;

  public constructor(options?: ThemeLoaderOptions) {
    this.loader = new ThemeLoader(options);
    this.applier = new ThemeApplier();
  }

  public async loadTheme(themeRef: string | ThemeDefinition): Promise<ThemeDefinition> {
    return this.loader.load(themeRef);
  }

  public resolveColor(theme: ThemeDefinition, tokenOrColor: string, fallbackToken: string): string {
    return this.applier.resolveColor(theme, tokenOrColor, fallbackToken);
  }
}

export type { ThemeLoaderOptions };
