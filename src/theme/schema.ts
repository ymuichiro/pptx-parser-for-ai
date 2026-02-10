import { z } from "zod";
import { MAX_STRING_LENGTH } from "../constants";
import type { ThemeDefinition } from "../types";

const colorValueSchema = z
  .string()
  .max(MAX_STRING_LENGTH)
  .regex(/^[0-9A-Fa-f]{6}$/, "Color must be 6-char hex without #");

const tokenSchema = z.string().min(1).max(MAX_STRING_LENGTH);

export const themeDefinitionSchema = z
  .object({
    name: z.string().min(1).max(MAX_STRING_LENGTH),
    version: z.string().min(1).max(20),
    colors: z.record(tokenSchema, colorValueSchema),
    typography: z
      .object({
        fonts: z
          .object({
            title: tokenSchema,
            heading: tokenSchema,
            body: tokenSchema,
            caption: tokenSchema
          })
          .strict(),
        sizes: z
          .object({
            title: z.number().positive(),
            heading: z.number().positive(),
            subheading: z.number().positive(),
            body: z.number().positive(),
            caption: z.number().positive(),
            statValue: z.number().positive()
          })
          .strict(),
        weights: z
          .object({
            bold: z.boolean(),
            normal: z.boolean()
          })
          .strict()
      })
      .strict(),
    layout: z
      .object({
        slideSize: z.union([z.literal("16:9"), z.literal("16:10"), z.literal("4:3")]),
        margins: z
          .object({
            default: z.number().nonnegative(),
            titleSlide: z.number().nonnegative()
          })
          .strict(),
        spacing: z
          .object({
            elementGap: z.number().nonnegative(),
            paragraphSpacing: z.number().nonnegative()
          })
          .strict(),
        grid: z
          .object({
            columns: z.number().int().positive(),
            gutter: z.number().nonnegative()
          })
          .strict()
      })
      .strict(),
    logo: z
      .object({
        source: tokenSchema,
        position: z.union([
          z.literal("top-left"),
          z.literal("top-right"),
          z.literal("bottom-left"),
          z.literal("bottom-right")
        ]),
        size: z.tuple([z.number().positive(), z.number().positive()]),
        margin: z.number().nonnegative()
      })
      .strict()
      .optional(),
    defaults: z
      .object({
        titleSlide: z
          .object({
            background: tokenSchema,
            titleColor: tokenSchema,
            subtitleColor: tokenSchema
          })
          .strict(),
        contentSlide: z
          .object({
            background: tokenSchema,
            titleColor: tokenSchema
          })
          .strict(),
        bulletStyle: z
          .object({
            character: tokenSchema,
            color: tokenSchema,
            indent: z.number().nonnegative()
          })
          .strict(),
        tableStyle: z
          .object({
            headerBackground: tokenSchema,
            headerText: tokenSchema,
            rowAlternate: tokenSchema,
            borderColor: tokenSchema
          })
          .strict()
      })
      .strict(),
    effects: z
      .object({
        cardShadow: z
          .object({
            type: z.literal("outer"),
            blur: z.number().nonnegative(),
            offset: z.number(),
            color: colorValueSchema,
            opacity: z.number().min(0).max(1)
          })
          .strict()
          .optional(),
        titleUnderline: z
          .object({
            enabled: z.boolean()
          })
          .strict()
          .optional()
      })
      .strict()
      .optional()
  })
  .strict();

export function parseThemeDefinition(input: unknown): ThemeDefinition {
  return themeDefinitionSchema.parse(input) as ThemeDefinition;
}
