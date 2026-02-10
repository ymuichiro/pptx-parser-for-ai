export type ErrorPhase =
  | "parse"
  | "validate"
  | "normalize"
  | "theme"
  | "template-import"
  | "layout"
  | "render"
  | "io"
  | "qa";

export class PPTXLibraryError extends Error {
  public readonly code: string;
  public readonly phase: ErrorPhase;
  public readonly causeError?: unknown;

  public constructor(code: string, phase: ErrorPhase, message: string, causeError?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.phase = phase;
    this.causeError = causeError;
  }
}

export class ParseError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("PARSE_ERROR", "parse", message, causeError);
  }
}

export class ValidationError extends PPTXLibraryError {
  public readonly details: string[];

  public constructor(details: string[], causeError?: unknown) {
    super("VALIDATION_ERROR", "validate", details.join("; "), causeError);
    this.details = details;
  }
}

export class ThemeError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("THEME_ERROR", "theme", message, causeError);
  }
}

export class LayoutError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("LAYOUT_ERROR", "layout", message, causeError);
  }
}

export class RenderError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("RENDER_ERROR", "render", message, causeError);
  }
}

export class IOError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("IO_ERROR", "io", message, causeError);
  }
}

export class QAError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("QA_ERROR", "qa", message, causeError);
  }
}

export class TemplateImportError extends PPTXLibraryError {
  public constructor(message: string, causeError?: unknown) {
    super("TEMPLATE_IMPORT_ERROR", "template-import", message, causeError);
  }
}
