import type {
  ChartComponentStyle,
  FlowchartComponentStyle,
  IconGridComponentStyle,
  ImageComponentStyle,
  ListComponentStyle,
  NamedComponentStyles,
  NetworkComponentStyle,
  PresetSurfaceComponentStyle,
  StatCalloutComponentStyle,
  TableComponentStyle,
  TextComponentStyle,
  ThemeDefinition,
  TwoColumnComponentStyle
} from "../types";
import { normalizeHexColor } from "../utils/color";

type ComponentKey = keyof ThemeDefinition["components"];

type ComponentStyleFor<K extends ComponentKey> = ThemeDefinition["components"][K] extends NamedComponentStyles<infer S>
  ? S
  : never;

const HEX_PATTERN = /^[0-9A-Fa-f]{6}$/;

function firstValue<T>(items: Record<string, T>): T | undefined {
  const key = Object.keys(items)[0];
  if (key === undefined) {
    return undefined;
  }

  return items[key];
}

export class StyleResolver {
  private readonly missingThemeTokens = new Set<string>();
  private readonly missingStyleRefs = new Set<string>();

  public constructor(private readonly theme: ThemeDefinition) {}

  public resolveColor(colorRef: string | undefined, fallbackToken: string): string {
    if (colorRef !== undefined) {
      const themeValue = this.theme.colors[colorRef];
      if (themeValue !== undefined) {
        return normalizeHexColor(themeValue);
      }

      const literal = colorRef.replace(/^#/, "");
      if (HEX_PATTERN.test(literal)) {
        return normalizeHexColor(literal);
      }

      this.missingThemeTokens.add(colorRef);
    }

    const fallback = this.theme.colors[fallbackToken];
    if (fallback !== undefined) {
      return normalizeHexColor(fallback);
    }

    this.missingThemeTokens.add(fallbackToken);
    return "000000";
  }

  public resolveNamedStyle<K extends ComponentKey>(component: K, requestedRef?: string): ComponentStyleFor<K> {
    const container = this.theme.components[component] as NamedComponentStyles<ComponentStyleFor<K>>;
    const requested = requestedRef ?? container.defaultStyleRef;
    const byRequested = container.styles[requested];
    if (byRequested !== undefined) {
      return byRequested;
    }

    if (requestedRef !== undefined) {
      this.missingStyleRefs.add(`${String(component)}:${requestedRef}`);
    }

    const byDefault = container.styles[container.defaultStyleRef];
    if (byDefault !== undefined) {
      return byDefault;
    }

    const fallback = firstValue(container.styles);
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`No styles defined for component '${String(component)}'`);
  }

  public resolveTextStyle(styleRef?: string): TextComponentStyle {
    return this.resolveNamedStyle("text", styleRef);
  }

  public resolveListStyle(styleRef?: string): ListComponentStyle {
    return this.resolveNamedStyle("list", styleRef);
  }

  public resolveTableStyle(styleRef?: string): TableComponentStyle {
    return this.resolveNamedStyle("table", styleRef);
  }

  public resolveChartStyle(styleRef?: string): ChartComponentStyle {
    return this.resolveNamedStyle("chart", styleRef);
  }

  public resolveImageStyle(styleRef?: string): ImageComponentStyle {
    return this.resolveNamedStyle("image", styleRef);
  }

  public resolveStatCalloutStyle(styleRef?: string): StatCalloutComponentStyle {
    return this.resolveNamedStyle("statCallout", styleRef);
  }

  public resolveIconGridStyle(styleRef?: string): IconGridComponentStyle {
    return this.resolveNamedStyle("iconGrid", styleRef);
  }

  public resolveFlowchartStyle(styleRef?: string): FlowchartComponentStyle {
    return this.resolveNamedStyle("flowchart", styleRef);
  }

  public resolveNetworkStyle(styleRef?: string): NetworkComponentStyle {
    return this.resolveNamedStyle("network", styleRef);
  }

  public resolveTwoColumnStyle(styleRef?: string): TwoColumnComponentStyle {
    return this.resolveNamedStyle("twoColumn", styleRef);
  }

  public resolvePresetSurfaceStyle(styleRef?: string): PresetSurfaceComponentStyle {
    return this.resolveNamedStyle("preset", styleRef);
  }

  public getMissingThemeTokens(): string[] {
    return [...this.missingThemeTokens];
  }

  public getMissingStyleRefs(): string[] {
    return [...this.missingStyleRefs];
  }
}
