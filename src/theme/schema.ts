import { z } from "zod";
import { MAX_STRING_LENGTH } from "../constants";
import type { ThemeDefinition } from "../types";

const colorValueSchema = z
  .string()
  .max(MAX_STRING_LENGTH)
  .regex(/^[0-9A-Fa-f]{6}$/, "Color must be 6-char hex without #");

const tokenSchema = z.string().min(1).max(MAX_STRING_LENGTH);

const semanticColorKeys = [
  "primary",
  "secondary",
  "accent",
  "text-dark",
  "text-light",
  "muted-text",
  "background-light",
  "background-dark",
  "neutral-border",
  "surface",
  "surface-muted",
  "surface-strong",
  "success",
  "warning",
  "error"
] as const;

const textStyleSchema = z
  .object({
    fontFace: tokenSchema.optional(),
    fontSize: z.number().positive().optional(),
    color: tokenSchema,
    bold: z.boolean().optional(),
    align: z.union([z.literal("left"), z.literal("center"), z.literal("right")]).optional(),
    valign: z.union([z.literal("top"), z.literal("mid"), z.literal("bottom")]).optional(),
    lineSpacingMultiple: z.number().positive().optional(),
    paragraphSpacing: z.number().nonnegative().optional()
  })
  .strict();

const listStyleSchema = z
  .object({
    fontFace: tokenSchema.optional(),
    fontSize: z.number().positive().optional(),
    color: tokenSchema,
    bulletCharacter: tokenSchema,
    bulletColor: tokenSchema,
    indent: z.number().nonnegative(),
    lineSpacingMultiple: z.number().positive().optional(),
    paragraphSpacing: z.number().nonnegative().optional()
  })
  .strict();

const tableStyleSchema = z
  .object({
    headerBackground: tokenSchema,
    headerText: tokenSchema,
    rowAlternate: tokenSchema,
    borderColor: tokenSchema,
    textColor: tokenSchema.optional(),
    fontFace: tokenSchema.optional(),
    fontSize: z.number().positive().optional()
  })
  .strict();

const chartStyleSchema = z
  .object({
    seriesPalette: z.array(tokenSchema).min(1).optional(),
    axisLabelColor: tokenSchema,
    gridColor: tokenSchema,
    dataLabelColor: tokenSchema,
    titleColor: tokenSchema,
    legendColor: tokenSchema,
    labelFontSize: z.number().positive().optional(),
    dataLabelFontSize: z.number().positive().optional()
  })
  .strict();

const imageStyleSchema = z
  .object({
    frameFillColor: tokenSchema.optional(),
    borderColor: tokenSchema.optional(),
    borderWidth: z.number().nonnegative().optional(),
    captionColor: tokenSchema,
    captionFontFace: tokenSchema.optional(),
    captionFontSize: z.number().positive().optional(),
    shadow: z.boolean().optional()
  })
  .strict();

const statCalloutStyleSchema = z
  .object({
    fillColor: tokenSchema,
    borderColor: tokenSchema,
    valueColor: tokenSchema,
    labelColor: tokenSchema,
    trendColor: tokenSchema.optional(),
    accentLineColor: tokenSchema.optional(),
    shadow: z.boolean().optional()
  })
  .strict();

const iconGridStyleSchema = z
  .object({
    cardFillColor: tokenSchema,
    cardBorderColor: tokenSchema,
    titleColor: tokenSchema,
    descriptionColor: tokenSchema
  })
  .strict();

const flowchartStyleSchema = z
  .object({
    stepFillColor: tokenSchema,
    stepBorderColor: tokenSchema,
    stepTextColor: tokenSchema,
    edgeColor: tokenSchema,
    labelColor: tokenSchema
  })
  .strict();

const networkStyleSchema = z
  .object({
    nodeFillColor: tokenSchema,
    nodeBorderColor: tokenSchema,
    nodeTextColor: tokenSchema,
    edgeColor: tokenSchema,
    labelColor: tokenSchema
  })
  .strict();

const twoColumnStyleSchema = z
  .object({
    gap: z.number().nonnegative(),
    columnFillColor: tokenSchema.optional(),
    columnBorderColor: tokenSchema.optional()
  })
  .strict();

const presetStyleSchema = z
  .object({
    shape: z.union([z.literal("rectangle"), z.literal("rounded-rectangle")]).optional(),
    fillColor: tokenSchema,
    borderColor: tokenSchema.optional(),
    borderWidth: z.number().nonnegative().optional(),
    rectRadius: z.number().min(0).max(1).optional()
  })
  .strict();

const frameSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive()
  })
  .strict();

const dividerChromeSchema = z
  .object({
    enabled: z.boolean().optional(),
    x: z.number().nonnegative().optional(),
    y: z.number().nonnegative().optional(),
    w: z.number().positive().optional(),
    color: tokenSchema.optional(),
    width: z.number().positive().optional()
  })
  .strict();

const headerChromeSchema = z
  .object({
    divider: dividerChromeSchema.optional()
  })
  .strict();

const footerChromeSchema = z
  .object({
    enabled: z.boolean().optional(),
    leftText: tokenSchema.optional(),
    showSlideNumber: z.boolean().optional(),
    color: tokenSchema.optional(),
    fontFace: tokenSchema.optional(),
    fontSize: z.number().positive().optional(),
    divider: dividerChromeSchema.optional()
  })
  .strict();

function namedStylesSchema<T extends z.ZodTypeAny>(styleSchema: T): z.ZodObject<{
  defaultStyleRef: z.ZodString;
  styles: z.ZodRecord<z.ZodString, T>;
}> {
  return z
    .object({
      defaultStyleRef: tokenSchema,
      styles: z.record(tokenSchema, styleSchema)
    })
    .strict();
}

export const themeDefinitionSchema = z
  .object({
    name: z.string().min(1).max(MAX_STRING_LENGTH),
    version: z.literal("2.0"),
    colors: z
      .record(tokenSchema, colorValueSchema)
      .superRefine((colors, context) => {
        for (const key of semanticColorKeys) {
          if (colors[key] === undefined) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Missing required semantic color token: ${key}`
            });
          }
        }
      }),
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
            titleColor: tokenSchema,
            titleFrame: frameSchema,
            bodyFrame: frameSchema
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
    components: z
      .object({
        text: namedStylesSchema(textStyleSchema),
        list: namedStylesSchema(listStyleSchema),
        table: namedStylesSchema(tableStyleSchema),
        chart: namedStylesSchema(chartStyleSchema),
        image: namedStylesSchema(imageStyleSchema),
        statCallout: namedStylesSchema(statCalloutStyleSchema),
        iconGrid: namedStylesSchema(iconGridStyleSchema),
        flowchart: namedStylesSchema(flowchartStyleSchema),
        network: namedStylesSchema(networkStyleSchema),
        twoColumn: namedStylesSchema(twoColumnStyleSchema),
        preset: namedStylesSchema(presetStyleSchema)
      })
      .strict(),
    chromeDefaults: z
      .object({
        header: headerChromeSchema.optional(),
        footer: footerChromeSchema.optional()
      })
      .strict()
      .optional(),
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
            enabled: z.boolean(),
            color: tokenSchema.optional(),
            width: z.number().positive().optional()
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
