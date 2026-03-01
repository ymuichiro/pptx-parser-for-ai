import type { Bounds, ContentElement, CustomShapeElement, PresetId } from "../types";

export const DEFAULT_PRESET_SLOT = "default";

export interface PresetSlotDefinition {
  name: string;
  bounds: Bounds;
  allowedElementTypes?: ContentElement["type"][];
  styleRef?: string;
  surfaceStyleRef?: string;
  stackGap?: number;
}

export interface PresetDefinition {
  id: PresetId;
  slots: PresetSlotDefinition[];
  decorations?: CustomShapeElement[];
  defaults?: {
    gap?: number;
    titleUnderline?: boolean;
  };
}

const overview2x2Slots: PresetSlotDefinition[] = [
  {
    name: "card1",
    bounds: { x: 0.8, y: 1.0, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: "card2",
    bounds: { x: 5.12, y: 1.0, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: "card3",
    bounds: { x: 0.8, y: 3.12, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: "card4",
    bounds: { x: 5.12, y: 3.12, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.8, y: 1.0, w: 8.4, h: 4.0 },
    styleRef: "summary"
  }
];

const compare3colSlots: PresetSlotDefinition[] = [
  {
    name: "left",
    bounds: { x: 0.8, y: 1.0, w: 2.67, h: 3.1 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout", "chart"],
    styleRef: "column",
    surfaceStyleRef: "column"
  },
  {
    name: "center",
    bounds: { x: 3.67, y: 1.0, w: 2.67, h: 3.1 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout", "chart"],
    styleRef: "column",
    surfaceStyleRef: "column"
  },
  {
    name: "right",
    bounds: { x: 6.53, y: 1.0, w: 2.67, h: 3.1 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout", "chart"],
    styleRef: "column",
    surfaceStyleRef: "column"
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.8, y: 4.25, w: 8.4, h: 0.75 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list"],
    styleRef: "summary",
    surfaceStyleRef: "summary-strip"
  }
];

const kpiWithCalloutSlots: PresetSlotDefinition[] = [
  {
    name: "kpi",
    bounds: { x: 0.8, y: 1.0, w: 5.2, h: 2.4 },
    allowedElementTypes: ["chart", "stat-callout", "table", "text"],
    styleRef: "kpi",
    surfaceStyleRef: "card"
  },
  {
    name: "narrative",
    bounds: { x: 0.8, y: 3.55, w: 5.2, h: 1.45 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list"],
    styleRef: "summary",
    surfaceStyleRef: "summary-strip"
  },
  {
    name: "callout",
    bounds: { x: 6.2, y: 1.0, w: 3.0, h: 1.9 },
    allowedElementTypes: ["stat-callout", "text", "icon-grid"],
    styleRef: "highlight",
    surfaceStyleRef: "callout-panel"
  },
  {
    name: "trend",
    bounds: { x: 6.2, y: 3.05, w: 3.0, h: 1.95 },
    allowedElementTypes: ["chart", "stat-callout", "text", "image"],
    styleRef: "highlight",
    surfaceStyleRef: "callout-panel"
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.8, y: 1.0, w: 8.4, h: 4.0 },
    styleRef: "summary"
  }
];

const presetDefinitions: Record<PresetId, PresetDefinition> = {
  "overview-2x2": {
    id: "overview-2x2",
    slots: overview2x2Slots,
    decorations: [
      {
        type: "custom-shape",
        shape: "rectangle",
        position: { x: 0.8, y: 0.92, w: 8.4, h: 0.04 },
        fill: "neutral-border",
        qa: { exclude: true }
      }
    ],
    defaults: {
      gap: 0.08,
      titleUnderline: true
    }
  },
  "compare-3col": {
    id: "compare-3col",
    slots: compare3colSlots,
    decorations: [
      {
        type: "custom-shape",
        shape: "rectangle",
        position: { x: 3.56, y: 1.0, w: 0.03, h: 3.1 },
        fill: "neutral-border",
        qa: { exclude: true }
      },
      {
        type: "custom-shape",
        shape: "rectangle",
        position: { x: 6.43, y: 1.0, w: 0.03, h: 3.1 },
        fill: "neutral-border",
        qa: { exclude: true }
      }
    ],
    defaults: {
      gap: 0.08,
      titleUnderline: true
    }
  },
  "kpi-with-callout": {
    id: "kpi-with-callout",
    slots: kpiWithCalloutSlots,
    decorations: [
      {
        type: "custom-shape",
        shape: "rectangle",
        position: { x: 6.16, y: 0.92, w: 0.04, h: 4.08 },
        fill: "neutral-border",
        qa: { exclude: true }
      }
    ],
    defaults: {
      gap: 0.08,
      titleUnderline: true
    }
  }
};

export function getPresetDefinition(presetId: PresetId): PresetDefinition | undefined {
  return presetDefinitions[presetId];
}

export function isPresetId(value: string): value is PresetId {
  return value in presetDefinitions;
}

export function listPresetIds(): PresetId[] {
  return Object.keys(presetDefinitions) as PresetId[];
}
