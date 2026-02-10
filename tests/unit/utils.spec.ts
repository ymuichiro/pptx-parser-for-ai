import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeHexColor, resolveThemeColor } from "../../src/utils/color";
import { enforceStructuralLimits } from "../../src/utils/deep-limit";
import { areaOverlaps, clampBounds, isInsideBounds } from "../../src/utils/geometry";
import { ensureOutputDir, resolveAndValidatePath } from "../../src/utils/paths";
import { testTheme } from "../helpers/theme";

describe("utils", () => {
  it("normalizes and resolves colors", () => {
    expect(normalizeHexColor("#ff00aa")).toBe("FF00AA");
    expect(resolveThemeColor(testTheme, "primary", "primary")).toBe("1E2761");
    expect(resolveThemeColor(testTheme, undefined, "primary")).toBe("1E2761");
    expect(() => normalizeHexColor("not-a-color")).toThrowError(/Invalid color/);
  });

  it("enforces structural limits", () => {
    const violations = enforceStructuralLimits({ value: "x".repeat(10_001) });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("checks geometry helpers", () => {
    expect(areaOverlaps({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.5, y: 0.5, w: 1, h: 1 })).toBe(true);
    expect(isInsideBounds({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, { x: 0, y: 0, w: 1, h: 1 })).toBe(true);

    const clamped = clampBounds({ x: -1, y: -1, w: 3, h: 3 }, { x: 0, y: 0, w: 1, h: 1 });
    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
    expect(clamped.w).toBeLessThanOrEqual(1);
    expect(clamped.h).toBeLessThanOrEqual(1);
  });

  it("resolves safe paths and creates output directory", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-paths-"));
    const nestedPath = path.join(tempDir, "nested", "file.txt");

    await ensureOutputDir(nestedPath);
    await fs.writeFile(nestedPath, "ok", "utf-8");

    const safePath = await resolveAndValidatePath(nestedPath, [tempDir]);
    expect(safePath.endsWith("file.txt")).toBe(true);

    await expect(resolveAndValidatePath(path.join(tempDir, "..", "escape.txt"), [tempDir])).rejects.toThrow();
  });
});
