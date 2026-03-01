import type { Bounds, ChartElement, ThemeDefinition } from "../../types";
import { StyleResolver } from "../../theme/style-resolver";
import type { SlideAdapter } from "../base-renderer";

function buildDataLabelFormatCode(valuePrefix: string, valueSuffix: string): string {
  const escapeLiteral = (value: string): string => value.replace(/"/g, '""');
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

export function renderChart(
  slide: SlideAdapter,
  element: ChartElement,
  bounds: Bounds,
  theme: ThemeDefinition,
  resolver: StyleResolver = new StyleResolver(theme)
): void {
  const style = resolver.resolveChartStyle(element.styleRef ?? "default");
  const chartData = element.data.series.map((series, index) => ({
    name: series.name,
    labels: element.data.labels,
    values: series.values,
    color: series.color ?? style.seriesPalette?.[index]
  }));
  const chartColors = chartData.map((series, index) =>
    resolver.resolveColor((series.color as string | undefined) ?? style.seriesPalette?.[index] ?? "primary", "primary")
  );
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
    chartOptions.barGapWidthPct = 120;
    chartOptions.catAxisLabelPos = "nextTo";
    chartOptions.catAxisLabelRotate = 0;
    chartOptions.catAxisLabelFontFace = theme.typography.fonts.body;
    chartOptions.catAxisLabelFontSize = style.labelFontSize ?? 11;
    chartOptions.catAxisLabelColor = resolver.resolveColor(style.axisLabelColor, "text-dark");
    chartOptions.catAxisMajorTickMark = "none";
    chartOptions.catAxisMinorTickMark = "none";
    chartOptions.catGridLine = { color: resolver.resolveColor(style.gridColor, "neutral-border") };
    chartOptions.valAxisHidden = true;
    chartOptions.valAxisLabelPos = "none";
    chartOptions.valAxisLineShow = false;
    chartOptions.valAxisMajorTickMark = "none";
    chartOptions.valAxisMinorTickMark = "none";
    chartOptions.valGridLine = { style: "none" };
    chartOptions.catAxisHidden = false;
    chartOptions.dataLabelColor = resolver.resolveColor(style.dataLabelColor, "text-dark");
    chartOptions.dataLabelFontFace = theme.typography.fonts.heading;
    chartOptions.dataLabelFontSize = style.dataLabelFontSize ?? 11;
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
      color: resolver.resolveColor(style.titleColor, "text-dark"),
      align: "left"
    });
  }
}
