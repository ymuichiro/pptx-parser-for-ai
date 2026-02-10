import type { ThemeDefinition } from "../types";
import { resolveThemeColor } from "../utils/color";

export class ThemeApplier {
  public resolveColor(theme: ThemeDefinition, tokenOrColor: string, fallbackToken: string): string {
    return resolveThemeColor(theme, tokenOrColor, fallbackToken);
  }
}
