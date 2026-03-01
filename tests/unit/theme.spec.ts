import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { ThemeLoader } from "../../src/theme/loader";
import { testTheme } from "../helpers/theme";

function flattenErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown; causeError?: unknown };
    return `${error.message} ${flattenErrorMessage(withCause.causeError ?? withCause.cause ?? "")}`;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  return String(error ?? "");
}

describe("ThemeLoader", () => {
  it("loads built-in theme", async () => {
    const loader = new ThemeLoader({
      themeDir: path.resolve(process.cwd(), "themes")
    });

    const theme = await loader.load("corporate-blue");
    expect(theme.name).toBe("Corporate Blue");
    expect(theme.layout.slideSize).toBe("16:9");
  });

  it("loads custom theme file from allowed directory", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-theme-"));
    const customPath = path.join(tempDir, "custom.yaml");
    const customTheme = {
      ...testTheme,
      name: "Custom"
    };
    await fs.writeFile(customPath, yaml.dump(customTheme), "utf-8");

    const loader = new ThemeLoader({
      themeDir: path.resolve(process.cwd(), "themes"),
      allowedRoots: [tempDir, process.cwd()]
    });

    const theme = await loader.load(customPath);
    expect(theme.name).toBe("Custom");
  });

  it("rejects path traversal theme path", async () => {
    const loader = new ThemeLoader({
      themeDir: path.resolve(process.cwd(), "themes"),
      allowedRoots: [path.resolve(process.cwd(), "themes")]
    });

    await expect(loader.load("../outside.yaml")).rejects.toThrowError(/not allowed|outside/i);
  });

  it("rejects theme missing required content frames", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-theme-invalid-"));
    const customPath = path.join(tempDir, "missing-frame.yaml");
    const customTheme = structuredClone(testTheme);
    const contentSlide = customTheme.defaults.contentSlide as Record<string, unknown>;
    delete contentSlide.titleFrame;
    await fs.writeFile(customPath, yaml.dump(customTheme), "utf-8");

    const loader = new ThemeLoader({
      themeDir: path.resolve(process.cwd(), "themes"),
      allowedRoots: [tempDir, process.cwd()]
    });

    try {
      await loader.load(customPath);
      throw new Error("expected theme loading to fail");
    } catch (error) {
      expect(flattenErrorMessage(error)).toMatch(/titleFrame/i);
    }
  });

  it("rejects out-of-range preset rectRadius", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-theme-invalid-radius-"));
    const customPath = path.join(tempDir, "invalid-radius.yaml");
    const customTheme = structuredClone(testTheme);
    const cardStyle = customTheme.components.preset.styles.card;
    if (cardStyle === undefined) {
      throw new Error("expected preset card style");
    }
    cardStyle.rectRadius = 2;
    await fs.writeFile(customPath, yaml.dump(customTheme), "utf-8");

    const loader = new ThemeLoader({
      themeDir: path.resolve(process.cwd(), "themes"),
      allowedRoots: [tempDir, process.cwd()]
    });

    try {
      await loader.load(customPath);
      throw new Error("expected theme loading to fail");
    } catch (error) {
      expect(flattenErrorMessage(error)).toMatch(/rectRadius/i);
    }
  });
});
