import type { Bounds, ChartElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

export function renderChart(slide: SlideAdapter, element: ChartElement, bounds: Bounds, theme: ThemeDefinition): void {
  // `pptxgenjs` の chart API 依存を最小化するため、ここでは決定的な簡易バー描画を行う。
  const baseY = bounds.y + bounds.h * 0.85;
  const maxValue = Math.max(...element.data.series.flatMap((series) => series.values), 1);
  const barCount = element.data.labels.length;
  const barWidth = Math.max(0.1, bounds.w / (barCount * Math.max(1, element.data.series.length) + barCount + 1));

  if (element.title !== undefined) {
    slide.addText(element.title, {
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: 0.3,
      fontFace: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.caption,
      color: resolveThemeColor(theme, "text-dark", "text-dark"),
      align: "left"
    });
  }

  element.data.labels.forEach((label, labelIndex) => {
    const xLabel = bounds.x + barWidth + labelIndex * barWidth * (element.data.series.length + 1);

    element.data.series.forEach((series, seriesIndex) => {
      const value = series.values[labelIndex] ?? 0;
      const normalizedHeight = (value / maxValue) * bounds.h * 0.6;
      const x = xLabel + seriesIndex * barWidth;
      const y = baseY - normalizedHeight;

      slide.addShape("rect", {
        x,
        y,
        w: barWidth * 0.8,
        h: Math.max(0.05, normalizedHeight),
        fill: {
          color: resolveThemeColor(theme, series.color ?? "primary", "primary")
        },
        line: {
          color: resolveThemeColor(theme, "text-dark", "text-dark"),
          width: 0
        }
      });

      if (element.options?.showValues ?? false) {
        slide.addText(String(value), {
          x,
          y: Math.max(bounds.y, y - 0.2),
          w: barWidth,
          h: 0.2,
          fontSize: 8,
          color: resolveThemeColor(theme, "text-dark", "text-dark"),
          align: "center"
        });
      }
    });

    slide.addText(label, {
      x: xLabel,
      y: baseY + 0.05,
      w: barWidth * Math.max(1, element.data.series.length),
      h: 0.2,
      fontSize: 8,
      color: resolveThemeColor(theme, "text-dark", "text-dark"),
      align: "center"
    });
  });
}
