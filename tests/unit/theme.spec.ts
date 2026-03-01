import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { ThemeLoader } from "../../src/theme/loader";
import { testTheme } from "../helpers/theme";

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
});
