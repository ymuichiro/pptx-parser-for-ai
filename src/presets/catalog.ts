import type { Bounds, ContentElement, CustomShapeElement, PresetId } from "../types";

export const DEFAULT_PRESET_SLOT = "default";

export interface PresetSlotDefinition {
  name: string;
  bounds: Bounds;
  allowedElementTypes?: ContentElement["type"][];
}

export interface PresetDefinition {
  id: PresetId;
  slots: PresetSlotDefinition[];
  decorations?: CustomShapeElement[];
  defaults?: {
    gap?: number;
  };
}

const overview2x2Slots: PresetSlotDefinition[] = [
  {
    name: "card1",
    bounds: { x: 0.8, y: 1.0, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"]
  },
  {
    name: "card2",
    bounds: { x: 5.12, y: 1.0, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"]
  },
  {
    name: "card3",
    bounds: { x: 0.8, y: 3.12, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"]
  },
  {
    name: "card4",
    bounds: { x: 5.12, y: 3.12, w: 4.08, h: 1.88 },
    allowedElementTypes: ["stat-callout", "text", "bullet-list", "numbered-list", "icon-grid"]
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.8, y: 1.0, w: 8.4, h: 4.0 }
  }
];

const compare3colSlots: PresetSlotDefinition[] = [
  {
    name: "left",
    bounds: { x: 0.8, y: 1.0, w: 2.67, h: 3.1 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout"]
  },
  {
    name: "center",
    bounds: { x: 3.67, y: 1.0, w: 2.67, h: 3.1 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout"]
  },
  {
    name: "right",
    bounds: { x: 6.53, y: 1.0, w: 2.67, h: 3.1 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list", "image", "table", "stat-callout"]
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.8, y: 4.25, w: 8.4, h: 0.75 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list"]
  }
];

const kpiWithCalloutSlots: PresetSlotDefinition[] = [
  {
    name: "kpi",
    bounds: { x: 0.8, y: 1.0, w: 5.2, h: 2.4 },
    allowedElementTypes: ["chart", "stat-callout", "table", "text"]
  },
  {
    name: "narrative",
    bounds: { x: 0.8, y: 3.55, w: 5.2, h: 1.45 },
    allowedElementTypes: ["text", "bullet-list", "numbered-list"]
  },
  {
    name: "callout",
    bounds: { x: 6.2, y: 1.0, w: 3.0, h: 1.9 },
    allowedElementTypes: ["stat-callout", "text", "icon-grid"]
  },
  {
    name: "trend",
    bounds: { x: 6.2, y: 3.05, w: 3.0, h: 1.95 },
    allowedElementTypes: ["chart", "stat-callout", "text", "image"]
  },
  {
    name: DEFAULT_PRESET_SLOT,
    bounds: { x: 0.8, y: 1.0, w: 8.4, h: 4.0 }
  }
];

const presetDefinitions: Record<PresetId, PresetDefinition> = {
  "overview-2x2": {
    id: "overview-2x2",
    slots: overview2x2Slots,
    decorations: [
      {
        type: "custom-shape",
        shape: "rounded-rectangle",
        position: { x: 0.76, y: 0.96, w: 4.16, h: 1.96 },
        fill: "background-light",
        border: {
          color: "DEE2E6",
          width: 0.8
        }
      },
      {
        type: "custom-shape",
        shape: "rounded-rectangle",
        position: { x: 5.08, y: 0.96, w: 4.16, h: 1.96 },
        fill: "background-light",
        border: {
          color: "DEE2E6",
          width: 0.8
        }
      },
      {
        type: "custom-shape",
        shape: "rounded-rectangle",
        position: { x: 0.76, y: 3.08, w: 4.16, h: 1.96 },
        fill: "background-light",
        border: {
          color: "DEE2E6",
          width: 0.8
        }
      },
      {
        type: "custom-shape",
        shape: "rounded-rectangle",
        position: { x: 5.08, y: 3.08, w: 4.16, h: 1.96 },
        fill: "background-light",
        border: {
          color: "DEE2E6",
          width: 0.8
        }
      }
    ],
    defaults: {
      gap: 0.08
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
        fill: "DEE2E6"
      },
      {
        type: "custom-shape",
        shape: "rectangle",
        position: { x: 6.43, y: 1.0, w: 0.03, h: 3.1 },
        fill: "DEE2E6"
      }
    ],
    defaults: {
      gap: 0.08
    }
  },
  "kpi-with-callout": {
    id: "kpi-with-callout",
    slots: kpiWithCalloutSlots,
    decorations: [
      {
        type: "custom-shape",
        shape: "rounded-rectangle",
        position: { x: 6.12, y: 0.92, w: 3.16, h: 4.16 },
        fill: "F8F9FA",
        border: {
          color: "DEE2E6",
          width: 0.8
        }
      }
    ],
    defaults: {
      gap: 0.08
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
