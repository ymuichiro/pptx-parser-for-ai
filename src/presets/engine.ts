import { LayoutError } from "../errors";
import type { Bounds, ContentElement, CustomShapeElement, ElementArea, PresetId } from "../types";
import { DEFAULT_PRESET_SLOT, getPresetDefinition, type PresetDefinition, type PresetSlotDefinition } from "./catalog";

export interface PresetSlotSurface {
  slotName: string;
  bounds: Bounds;
  styleRef?: string;
}

export interface PresetLayoutResult {
  frame: Bounds;
  areas: ElementArea[];
  decorations: CustomShapeElement[];
  slotStyleByElementIndex: Map<number, string | undefined>;
  slotSurfaceDefinitions: PresetSlotSurface[];
}

function cloneBounds(bounds: Bounds): Bounds {
  return {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h
  };
}

function stackBounds(bounds: Bounds, count: number, gap: number): Bounds[] {
  if (count <= 1) {
    return [cloneBounds(bounds)];
  }

  const totalGap = Math.max(0, count - 1) * gap;
  const eachHeight = Math.max(0.1, (bounds.h - totalGap) / count);
  return Array.from({ length: count }, (_item, index) => ({
    x: bounds.x,
    y: bounds.y + index * (eachHeight + gap),
    w: bounds.w,
    h: eachHeight
  }));
}

function ensurePresetDefinition(presetId: PresetId): PresetDefinition {
  const definition = getPresetDefinition(presetId);
  if (definition === undefined) {
    throw new LayoutError(`Unsupported preset: ${presetId}`);
  }

  return definition;
}

function slotMapFromDefinition(definition: PresetDefinition): Map<string, PresetSlotDefinition> {
  return new Map(definition.slots.map((slot) => [slot.name, slot]));
}

function calculateFrame(definition: PresetDefinition): Bounds {
  const firstSlot = definition.slots[0];
  if (firstSlot === undefined) {
    throw new LayoutError(`Preset '${definition.id}' does not define slots`);
  }

  let minX = firstSlot.bounds.x;
  let minY = firstSlot.bounds.y;
  let maxX = firstSlot.bounds.x + firstSlot.bounds.w;
  let maxY = firstSlot.bounds.y + firstSlot.bounds.h;

  definition.slots.slice(1).forEach((slot) => {
    minX = Math.min(minX, slot.bounds.x);
    minY = Math.min(minY, slot.bounds.y);
    maxX = Math.max(maxX, slot.bounds.x + slot.bounds.w);
    maxY = Math.max(maxY, slot.bounds.y + slot.bounds.h);
  });

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
}

export class PresetEngine {
  public calculateLayout(elements: ContentElement[], presetId: PresetId): PresetLayoutResult {
    const definition = ensurePresetDefinition(presetId);
    const slots = slotMapFromDefinition(definition);
    const slotAssignments = new Map<string, number[]>();

    elements.forEach((element, index) => {
      const resolvedSlot = element.slot ?? DEFAULT_PRESET_SLOT;
      const assigned = slotAssignments.get(resolvedSlot) ?? [];
      assigned.push(index);
      slotAssignments.set(resolvedSlot, assigned);
    });

    const boundsByIndex = new Map<number, Bounds>();
    const slotStyleByElementIndex = new Map<number, string | undefined>();

    slotAssignments.forEach((indices, slotName) => {
      const slot = slots.get(slotName);
      if (slot === undefined) {
        throw new LayoutError(`Preset '${presetId}' does not define slot '${slotName}'`);
      }

      const gap = slot.stackGap ?? definition.defaults?.gap ?? 0.08;
      const splitBounds = stackBounds(slot.bounds, indices.length, gap);
      indices.forEach((elementIndex, splitIndex) => {
        boundsByIndex.set(elementIndex, splitBounds[splitIndex] ?? cloneBounds(slot.bounds));
        slotStyleByElementIndex.set(elementIndex, slot.styleRef);
      });
    });

    const defaultSlotBounds = slots.get(DEFAULT_PRESET_SLOT)?.bounds;
    if (defaultSlotBounds === undefined) {
      throw new LayoutError(`Preset '${presetId}' must define a '${DEFAULT_PRESET_SLOT}' slot`);
    }

    const areas: ElementArea[] = elements.map((element, index) => ({
      element,
      bounds: boundsByIndex.get(index) ?? cloneBounds(defaultSlotBounds)
    }));

    const slotSurfaceDefinitions: PresetSlotSurface[] = definition.slots
      .filter((slot) => slot.surfaceStyleRef !== undefined)
      .map((slot) => ({
        slotName: slot.name,
        bounds: cloneBounds(slot.bounds),
        ...(slot.surfaceStyleRef !== undefined ? { styleRef: slot.surfaceStyleRef } : {})
      }));

    return {
      frame: calculateFrame(definition),
      areas,
      decorations: (definition.decorations ?? []).map((shape) => ({
        ...shape,
        position: cloneBounds(shape.position)
      })),
      slotStyleByElementIndex,
      slotSurfaceDefinitions
    };
  }
}
