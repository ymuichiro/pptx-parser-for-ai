import type { Bounds, ChartElement, ThemeDefinition } from "../../types";
import type { SlideAdapter } from "../base-renderer";
import { resolveThemeColor } from "../../utils/color";

function buildDataLabelFormatCode(valuePrefix: string, valueSuffix: string): string {
  const escapeLiteral = (value: string): string => value.replace(/"/g, "\"\"");
  const prefix = valuePrefix.trim();
  const suffix = valueSuffix.trim();

  let formatCode = "#,##0";
  if (prefix.length > 0) {
    formatCode = `"${escapeLiteral(prefix)}"${formatCode}`;
  }
  if (suffix.length > 0) {
    formatCode = `${formatCode}"${escapeLiteral(suffix)}"`;
  }
  return formatCode;
}

export function renderChart(slide: SlideAdapter, element: ChartElement, bounds: Bounds, theme: ThemeDefinition): void {
  const chartData = element.data.series.map((series) => ({
    name: series.name,
    labels: element.data.labels,
    values: series.values
  }));
  const chartColors = element.data.series.map((series) => resolveThemeColor(theme, series.color ?? "primary", "primary"));
  const labelColor =
    theme.colors["muted-text"] !== undefined
      ? resolveThemeColor(theme, "muted-text", "text-dark")
      : resolveThemeColor(theme, "text-dark", "text-dark");
  const bodyFontFace = theme.typography.fonts.body;
  const headingFontFace = theme.typography.fonts.heading;
  const valuePrefix = element.options?.valuePrefix ?? "";
  const valueSuffix = element.options?.valueSuffix ?? "";
  const chartType = element.chartType === "bar" ? "bar" : element.chartType;
  const showValues = element.options?.showValues ?? false;
  const chartOptions: Record<string, unknown> = {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    chartColors,
    showLegend: element.options?.showLegend ?? false,
    showValue: showValues
  };

  if (element.chartType === "bar") {
    chartOptions.barDir = "col";
    chartOptions.barGrouping = "clustered";
    chartOptions.barGapWidthPct = 140;
    chartOptions.catAxisLabelPos = "nextTo";
    chartOptions.catAxisLabelRotate = 0;
    chartOptions.catAxisLabelFontFace = bodyFontFace;
    chartOptions.catAxisLabelFontSize = 11;
    chartOptions.catAxisLabelColor = labelColor;
    chartOptions.catAxisMajorTickMark = "none";
    chartOptions.catAxisMinorTickMark = "none";
    chartOptions.catGridLine = { style: "none" };
    chartOptions.valAxisHidden = true;
    chartOptions.valAxisLabelPos = "none";
    chartOptions.valAxisLineShow = false;
    chartOptions.valAxisMajorTickMark = "none";
    chartOptions.valAxisMinorTickMark = "none";
    chartOptions.valGridLine = { style: "none" };
    chartOptions.catAxisHidden = false;
    chartOptions.dataLabelColor = resolveThemeColor(theme, "text-dark", "text-dark");
    chartOptions.dataLabelFontFace = headingFontFace;
    chartOptions.dataLabelFontSize = 11;
    chartOptions.dataLabelFontBold = true;
    chartOptions.dataLabelPosition = "outEnd";
    chartOptions.dataLabelFormatCode = buildDataLabelFormatCode(valuePrefix, valueSuffix);
  }

  slide.addChart(chartType, chartData, chartOptions);

  if (element.title !== undefined) {
    slide.addText(element.title, {
      x: bounds.x,
      y: bounds.y,
      w: bounds.w * 0.8,
      h: 0.3,
      fontFace: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.caption,
      color: resolveThemeColor(theme, "text-dark", "text-dark"),
      align: "left"
    });
  }
}
