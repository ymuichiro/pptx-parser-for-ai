export const MAX_STRING_LENGTH = 10_000;
export const MAX_ARRAY_LENGTH = 10_000;
export const MAX_NESTING_DEPTH = 20;
export const DEFAULT_DSL_VERSION = "2.0";
export const DEFAULT_THEME_NAME = "corporate-blue";

export const SLIDE_DIMENSIONS = {
  "16:9": { width: 10, height: 5.625 },
  "16:10": { width: 10, height: 6.25 },
  "4:3": { width: 10, height: 7.5 }
} as const;

export const ALLOWED_THEME_EXTENSIONS = new Set([".yaml", ".yml"]);
