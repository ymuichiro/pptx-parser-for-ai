import type { ThemeDefinition } from "../types";

export class LayoutConstraints {
  public readonly minMargin: number;
  public readonly elementGap: number;
  public readonly paragraphSpacing: number;

  public constructor(theme: ThemeDefinition) {
    this.minMargin = theme.layout.margins.default;
    this.elementGap = theme.layout.spacing.elementGap;
    this.paragraphSpacing = theme.layout.spacing.paragraphSpacing;
  }
}
