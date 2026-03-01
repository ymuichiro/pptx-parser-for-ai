import { describe, expect, it } from "vitest";
import { ThemeManager } from "../../src/theme";

describe("ThemeManager", () => {
  it("loads theme and resolves color", async () => {
    const manager = new ThemeManager();
    const theme = await manager.loadTheme("corporate-blue");

    const primary = manager.resolveColor(theme, "primary", "primary");
    expect(primary).toBe("1D2A44");
  });
});
