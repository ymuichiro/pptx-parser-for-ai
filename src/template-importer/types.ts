import * as path from "node:path";
import { z } from "zod";
import { MAX_ARRAY_LENGTH, MAX_STRING_LENGTH } from "../constants";
import type { Bounds } from "../types";

export interface ImportedTemplatePlaceholder {
  bounds: Bounds;
  style: {
    fontFace: string;
    fontSizePt?: number;
    color?: string;
  };
}

export interface ImportedTemplateObjectBase {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImportedTemplateShapeObject extends ImportedTemplateObjectBase {
  type: "shape";
  shape: string;
  fill?: string;
  lineColor?: string;
  text?: string;
}

export interface ImportedTemplateImageObject extends ImportedTemplateObjectBase {
  type: "image";
  source: string;
}

export type ImportedTemplateObject = ImportedTemplateShapeObject | ImportedTemplateImageObject;

export interface ImportedTemplatePackage {
  template: {
    id: string;
    source: {
      file: string;
      sha256: string;
      importedAt: string;
    };
  };
  theme: {
    palette: Record<string, string>;
    fonts: {
      title: string;
      heading: string;
      body: string;
      caption: string;
    };
    slideSize: "16:9" | "16:10" | "4:3";
  };
  layout: {
    kind: "title-body";
    placeholders: {
      title: ImportedTemplatePlaceholder;
      body: ImportedTemplatePlaceholder;
    };
  };
  background: {
    mode: "editable";
    color?: string;
    image?: string;
    objects: ImportedTemplateObject[];
  };
  manifest: {
    warnings: string[];
    unsupported: string[];
  };
}

export interface TemplateImportOptions {
  templateId?: string;
}

const boundedString = z.string().min(1).max(MAX_STRING_LENGTH);

const assetPathSchema = z
  .string()
  .min(1)
  .max(MAX_STRING_LENGTH)
  .refine((value) => {
    const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
    if (normalized.startsWith("/")) {
      return false;
    }

    if (normalized.split("/").includes("..")) {
      return false;
    }

    return normalized.startsWith("assets/");
  }, "Asset path must be a relative path under assets/ without traversal");

const colorRefSchema = z.string().min(1).max(MAX_STRING_LENGTH);

const boundsSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().positive().finite(),
    h: z.number().positive().finite()
  })
  .strict();

const placeholderSchema = z
  .object({
    bounds: boundsSchema,
    style: z
      .object({
        fontFace: boundedString,
        fontSizePt: z.number().positive().finite().optional(),
        color: colorRefSchema.optional()
      })
      .strict()
  })
  .strict();

const shapeObjectSchema = z
  .object({
    type: z.literal("shape"),
    shape: boundedString,
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().positive().finite(),
    h: z.number().positive().finite(),
    fill: colorRefSchema.optional(),
    lineColor: colorRefSchema.optional(),
    text: boundedString.optional()
  })
  .strict();

const imageObjectSchema = z
  .object({
    type: z.literal("image"),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().positive().finite(),
    h: z.number().positive().finite(),
    source: assetPathSchema
  })
  .strict();

const importedTemplatePackageSchema = z
  .object({
    template: z
      .object({
        id: boundedString,
        source: z
          .object({
            file: boundedString,
            sha256: z.string().regex(/^[0-9a-f]{64}$/, "sha256 must be 64-char lowercase hex"),
            importedAt: z.string().datetime({ offset: true })
          })
          .strict()
      })
      .strict(),
    theme: z
      .object({
        palette: z.record(boundedString, z.string().regex(/^[0-9A-Fa-f]{6}$/, "Color must be 6-char hex")),
        fonts: z
          .object({
            title: boundedString,
            heading: boundedString,
            body: boundedString,
            caption: boundedString
          })
          .strict(),
        slideSize: z.union([z.literal("16:9"), z.literal("16:10"), z.literal("4:3")])
      })
      .strict(),
    layout: z
      .object({
        kind: z.literal("title-body"),
        placeholders: z
          .object({
            title: placeholderSchema,
            body: placeholderSchema
          })
          .strict()
      })
      .strict(),
    background: z
      .object({
        mode: z.literal("editable"),
        color: colorRefSchema.optional(),
        image: assetPathSchema.optional(),
        objects: z.array(z.union([shapeObjectSchema, imageObjectSchema])).max(MAX_ARRAY_LENGTH)
      })
      .strict(),
    manifest: z
      .object({
        warnings: z.array(z.string().max(MAX_STRING_LENGTH)).max(MAX_ARRAY_LENGTH),
        unsupported: z.array(z.string().max(MAX_STRING_LENGTH)).max(MAX_ARRAY_LENGTH)
      })
      .strict()
  })
  .strict();

export function parseImportedTemplatePackage(input: unknown): ImportedTemplatePackage {
  return importedTemplatePackageSchema.parse(input) as ImportedTemplatePackage;
}
