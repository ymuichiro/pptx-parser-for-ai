import type { ThemeDefinition } from "../types";

const HEX_PATTERN = /^[0-9A-Fa-f]{6}$/;

export function normalizeHexColor(rawColor: string): string {
  const normalized = rawColor.replace(/^#/, "").trim();
  if (!HEX_PATTERN.test(normalized)) {
    throw new Error(`Invalid color value: ${rawColor}`);
  }

  return normalized.toUpperCase();
}

export function resolveThemeColor(theme: ThemeDefinition, colorRef: string | undefined, fallback: string): string {
  if (colorRef === undefined) {
    return normalizeHexColor(theme.colors[fallback] ?? fallback);
  }

  const mapped = theme.colors[colorRef] ?? colorRef;
  return normalizeHexColor(mapped);
}
