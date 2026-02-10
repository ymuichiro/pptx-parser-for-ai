import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { ThemeLoader } from "../../src/theme/loader";

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
    await fs.writeFile(
      customPath,
      [
        "name: Custom",
        "version: \"1.0\"",
        "colors:",
        "  primary: \"111111\"",
        "  secondary: \"EEEEEE\"",
        "  accent: \"FF0000\"",
        "  text-dark: \"111111\"",
        "  text-light: \"FFFFFF\"",
        "  background-light: \"FAFAFA\"",
        "  background-dark: \"111111\"",
        "  success: \"00AA00\"",
        "  warning: \"CC8800\"",
        "  error: \"AA0000\"",
        "typography:",
        "  fonts:",
        "    title: Arial",
        "    heading: Arial",
        "    body: Arial",
        "    caption: Arial",
        "  sizes:",
        "    title: 30",
        "    heading: 20",
        "    subheading: 16",
        "    body: 12",
        "    caption: 10",
        "    statValue: 40",
        "  weights:",
        "    bold: true",
        "    normal: false",
        "layout:",
        "  slideSize: \"16:9\"",
        "  margins:",
        "    default: 0.5",
        "    titleSlide: 0.7",
        "  spacing:",
        "    elementGap: 0.2",
        "    paragraphSpacing: 0.1",
        "  grid:",
        "    columns: 12",
        "    gutter: 0.2",
        "defaults:",
        "  titleSlide:",
        "    background: background-dark",
        "    titleColor: text-light",
        "    subtitleColor: secondary",
        "  contentSlide:",
        "    background: background-light",
        "    titleColor: text-dark",
        "  bulletStyle:",
        "    character: \"•\"",
        "    color: accent",
        "    indent: 0.3",
        "  tableStyle:",
        "    headerBackground: primary",
        "    headerText: text-light",
        "    rowAlternate: background-light",
        "    borderColor: text-dark"
      ].join("\n"),
      "utf-8"
    );

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
});
