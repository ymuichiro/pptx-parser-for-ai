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
  };
}

const CONTENT_BODY_FRAME: Bounds = { x: 0.4, y: 1.24, w: 9.2, h: 4.0 };
const PRESET_STACK_GAP = 0.12;

const overview2x2Slots: PresetSlotDefinition[] = [
  {
    name: "card1",
    bounds: { x: 0.4, y: 1.24, w: 4.48, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: "card2",
    bounds: { x: 5.12, y: 1.24, w: 4.48, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: "card3",
    bounds: { x: 0.4, y: 3.36, w: 4.48, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: "card4",
    bounds: { x: 5.12, y: 3.36, w: 4.48, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"],
    styleRef: "card",
    surfaceStyleRef: "card"
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: CONTENT_BODY_FRAME,
    styleRef: "summary"
  }
];

const compare3colSlots: PresetSlotDefinition[] = [
  {
    name: "left",
    bounds: { x: 0.4, y: 1.24, w: 2.93, h: 2.88 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout", "chart"],
    styleRef: "column",
    surfaceStyleRef: "column"
  },
  {
    name: "center",
    bounds: { x: 3.53, y: 1.24, w: 2.93, h: 2.88 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout", "chart"],
    styleRef: "column",
    surfaceStyleRef: "column"
  },
  {
    name: "right",
    bounds: { x: 6.67, y: 1.24, w: 2.93, h: 2.88 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout", "chart"],
    styleRef: "column",
    surfaceStyleRef: "column"
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.4, y: 4.36, w: 9.2, h: 0.88 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list"],
    styleRef: "summary",
    surfaceStyleRef: "summary-strip"
  }
];

const kpiWithCalloutSlots: PresetSlotDefinition[] = [
  {
    name: "kpi",
    bounds: { x: 0.4, y: 1.24, w: 5.8, h: 2.4 },
    allowedElementTypes: ["chart", "stat-callout", "table", "text"],
    styleRef: "kpi",
    surfaceStyleRef: "card"
  },
  {
    name: "narrative",
    bounds: { x: 0.4, y: 3.88, w: 5.8, h: 1.36 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list"],
    styleRef: "summary",
    surfaceStyleRef: "summary-strip"
  },
  {
    name: "callout",
    bounds: { x: 6.44, y: 1.24, w: 3.16, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "icon-grid"],
    styleRef: "highlight",
    surfaceStyleRef: "callout-panel"
  },
  {
    name: "trend",
    bounds: { x: 6.44, y: 3.36, w: 3.16, h: 1.88 },
    allowedElementTypes: ["chart", "stat-callout", "text", "image"],
    styleRef: "highlight",
    surfaceStyleRef: "callout-panel"
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: CONTENT_BODY_FRAME,
    styleRef: "summary"
  }
];

const presetDefinitions: Record<PresetId, PresetDefinition> = {
  "overview-2x2": {
    id: "overview-2x2",
    slots: overview2x2Slots,
    defaults: {
      gap: PRESET_STACK_GAP
    }
  },
  "compare-3col": {
    id: "compare-3col",
    slots: compare3colSlots,
    defaults: {
      gap: PRESET_STACK_GAP
    }
  },
  "kpi-with-callout": {
    id: "kpi-with-callout",
    slots: kpiWithCalloutSlots,
    defaults: {
      gap: PRESET_STACK_GAP
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
