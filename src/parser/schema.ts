import { z } from "zod";
import { MAX_ARRAY_LENGTH, MAX_STRING_LENGTH } from "../constants";
import type { PresentationDSL } from "../types";
import { themeDefinitionSchema } from "../theme/schema";

const boundedString = z.string().min(1).max(MAX_STRING_LENGTH);
const optionalBoundedString = z.string().min(1).max(MAX_STRING_LENGTH).optional();
const elementQASchema = z
  .object({
    exclude: z.boolean().optional()
  })
  .strict();
const presetIdSchema = z.union([z.literal("overview-2x2"), z.literal("compare-3col"), z.literal("kpi-with-callout")]);
const elementPositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive()
  })
  .strict();

const metadataSchema = z
  .object({
    title: boundedString,
    author: optionalBoundedString,
    company: optionalBoundedString,
    date: optionalBoundedString,
    copyright: optionalBoundedString,
    footerText: optionalBoundedString
  })
  .strict();

const dividerChromeSchema = z
  .object({
    enabled: z.boolean().optional(),
    x: z.number().nonnegative().optional(),
    y: z.number().nonnegative().optional(),
    w: z.number().positive().optional(),
    color: optionalBoundedString,
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
    leftText: optionalBoundedString,
    showSlideNumber: z.boolean().optional(),
    color: optionalBoundedString,
    fontFace: optionalBoundedString,
    fontSize: z.number().positive().optional(),
    divider: dividerChromeSchema.optional()
  })
  .strict();

const presentationChromeSchema = z
  .object({
    header: headerChromeSchema.optional(),
    footer: footerChromeSchema.optional()
  })
  .strict();

const textElementSchema = z
  .object({
    type: z.literal("text"),
    content: boundedString,
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    style: z.union([z.literal("title"), z.literal("heading"), z.literal("body"), z.literal("caption")]).optional(),
    align: z.union([z.literal("left"), z.literal("center"), z.literal("right")]).optional(),
    position: elementPositionSchema.optional(),
    color: optionalBoundedString,
    fontFace: optionalBoundedString,
    fontSize: z.number().positive().optional(),
    bold: z.boolean().optional(),
    valign: z.union([z.literal("top"), z.literal("mid"), z.literal("bottom")]).optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const bulletItemSchema = z
  .object({
    text: boundedString,
    subItems: z.array(boundedString).max(MAX_ARRAY_LENGTH).optional()
  })
  .strict();

const bulletListElementSchema = z
  .object({
    type: z.literal("bullet-list"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    style: z.union([z.literal("default"), z.literal("pros"), z.literal("cons"), z.literal("checkmark")]).optional(),
    items: z.array(z.union([boundedString, bulletItemSchema])).max(MAX_ARRAY_LENGTH),
    position: elementPositionSchema.optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const numberedListElementSchema = z
  .object({
    type: z.literal("numbered-list"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    items: z.array(boundedString).max(MAX_ARRAY_LENGTH),
    position: elementPositionSchema.optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const statCalloutElementSchema = z
  .object({
    type: z.literal("stat-callout"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    value: boundedString,
    label: boundedString,
    trend: optionalBoundedString,
    color: optionalBoundedString,
    position: elementPositionSchema.optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const imageElementSchema = z
  .object({
    type: z.literal("image"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    source: boundedString,
    caption: optionalBoundedString,
    sizing: z.union([z.literal("contain"), z.literal("cover"), z.literal("crop")]).optional(),
    position: z.union([z.literal("center"), z.literal("left"), z.literal("right")]).optional(),
    bounds: elementPositionSchema.optional(),
    frame: z
      .object({
        borderColor: optionalBoundedString,
        borderWidth: z.number().nonnegative().optional(),
        shadow: z.boolean().optional()
      })
      .strict()
      .optional(),
    captionStyleRef: optionalBoundedString,
    qa: elementQASchema.optional()
  })
  .strict();

const tableElementSchema = z
  .object({
    type: z.literal("table"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    style: z.union([z.literal("default"), z.literal("striped"), z.literal("bordered"), z.literal("minimal")]).optional(),
    headers: z.array(boundedString).min(1).max(MAX_ARRAY_LENGTH),
    rows: z.array(z.array(z.union([boundedString, z.number()])).max(MAX_ARRAY_LENGTH)).max(MAX_ARRAY_LENGTH),
    position: elementPositionSchema.optional(),
    highlight: z
      .array(
        z
          .object({
            column: z.number().int().nonnegative(),
            condition: z.union([z.literal("positive"), z.literal("negative"), z.literal("threshold")]),
            color: boundedString
          })
          .strict()
      )
      .max(MAX_ARRAY_LENGTH)
      .optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const chartElementSchema = z
  .object({
    type: z.literal("chart"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    chartType: z.union([
      z.literal("bar"),
      z.literal("line"),
      z.literal("pie"),
      z.literal("doughnut"),
      z.literal("scatter")
    ]),
    title: optionalBoundedString,
    position: elementPositionSchema.optional(),
    data: z
      .object({
        labels: z.array(boundedString).min(1).max(MAX_ARRAY_LENGTH),
        series: z
          .array(
            z
              .object({
                name: boundedString,
                values: z.array(z.number()).min(1).max(MAX_ARRAY_LENGTH),
                color: optionalBoundedString
              })
              .strict()
          )
          .min(1)
          .max(MAX_ARRAY_LENGTH)
      })
      .strict(),
    options: z
      .object({
        showValues: z.boolean().optional(),
        showLegend: z.boolean().optional(),
        valuePrefix: optionalBoundedString,
        valueSuffix: optionalBoundedString
      })
      .strict()
      .optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const networkDiagramElementSchema = z
  .object({
    type: z.literal("network-diagram"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    layout: z.union([z.literal("hierarchical"), z.literal("force-directed"), z.literal("circular")]),
    position: elementPositionSchema.optional(),
    nodes: z
      .array(
        z
          .object({
            id: boundedString,
            label: boundedString,
            icon: optionalBoundedString,
            color: optionalBoundedString
          })
          .strict()
      )
      .min(1)
      .max(MAX_ARRAY_LENGTH),
    edges: z
      .array(
        z
          .object({
            from: boundedString,
            to: boundedString,
            label: optionalBoundedString,
            style: z.union([z.literal("solid"), z.literal("dashed")]).optional()
          })
          .strict()
      )
      .max(MAX_ARRAY_LENGTH),
    qa: elementQASchema.optional()
  })
  .strict();

const flowchartElementSchema = z
  .object({
    type: z.literal("flowchart"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    direction: z.union([z.literal("horizontal"), z.literal("vertical")]),
    position: elementPositionSchema.optional(),
    steps: z
      .array(
        z
          .object({
            id: boundedString,
            label: boundedString,
            shape: z.union([z.literal("rounded"), z.literal("rectangle"), z.literal("diamond")]).optional()
          })
          .strict()
      )
      .min(1)
      .max(MAX_ARRAY_LENGTH),
    flows: z
      .array(
        z
          .object({
            from: boundedString,
            to: boundedString,
            label: optionalBoundedString
          })
          .strict()
      )
      .max(MAX_ARRAY_LENGTH),
    qa: elementQASchema.optional()
  })
  .strict();

const iconGridElementSchema = z
  .object({
    type: z.literal("icon-grid"),
    slot: optionalBoundedString,
    styleRef: optionalBoundedString,
    columns: z.number().int().positive().max(12),
    position: elementPositionSchema.optional(),
    items: z
      .array(
        z
          .object({
            icon: boundedString,
            title: boundedString,
            description: optionalBoundedString
          })
          .strict()
      )
      .min(1)
      .max(MAX_ARRAY_LENGTH),
    qa: elementQASchema.optional()
  })
  .strict();

let contentElementSchema: z.ZodTypeAny;

const twoColumnElementSchema: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      type: z.literal("two-column"),
      slot: optionalBoundedString,
      styleRef: optionalBoundedString,
      left: z.array(contentElementSchema).max(MAX_ARRAY_LENGTH),
      right: z.array(contentElementSchema).max(MAX_ARRAY_LENGTH),
      ratio: z.union([z.literal("1:1"), z.literal("2:1"), z.literal("1:2")]).optional(),
      position: elementPositionSchema.optional(),
      qa: elementQASchema.optional()
    })
    .strict()
);

contentElementSchema = z.lazy(() =>
  z.union([
    textElementSchema,
    bulletListElementSchema,
    numberedListElementSchema,
    statCalloutElementSchema,
    imageElementSchema,
    tableElementSchema,
    chartElementSchema,
    networkDiagramElementSchema,
    flowchartElementSchema,
    iconGridElementSchema,
    twoColumnElementSchema
  ])
);

const customShapeElementSchema = z
  .object({
    type: z.literal("custom-shape"),
    shape: z.union([z.literal("rectangle"), z.literal("circle"), z.literal("triangle"), z.literal("arrow"), z.literal("rounded-rectangle")]),
    position: elementPositionSchema,
    fill: optionalBoundedString,
    border: z
      .object({
        color: boundedString,
        width: z.number().positive()
      })
      .strict()
      .optional(),
    qa: elementQASchema.optional()
  })
  .strict();

const titleSlideSchema = z
  .object({
    type: z.literal("title"),
    background: z
      .union([
        z.literal("dark"),
        z.literal("light"),
        z
          .object({
            color: boundedString,
            opacity: z.number().min(0).max(1).optional()
          })
          .strict()
      ])
      .optional(),
    content: z
      .object({
        title: boundedString,
        subtitle: optionalBoundedString,
        date: optionalBoundedString,
        logo: z.boolean().optional()
      })
      .strict()
  })
  .strict();

const contentSlideSchema = z
  .object({
    type: z.literal("content"),
    layout: z.union([z.literal("auto"), z.literal("single-column"), z.literal("two-column"), z.literal("three-column")]).optional(),
    preset: presetIdSchema.optional(),
    title: boundedString,
    content: z.array(contentElementSchema).max(MAX_ARRAY_LENGTH)
  })
  .strict();

const sectionSlideSchema = z
  .object({
    type: z.literal("section"),
    title: boundedString,
    subtitle: optionalBoundedString,
    background: z
      .object({
        color: boundedString,
        opacity: z.number().min(0).max(1).optional()
      })
      .strict()
      .optional()
  })
  .strict();

const blankSlideSchema = z
  .object({
    type: z.literal("blank"),
    background: z
      .union([
        z.literal("dark"),
        z.literal("light"),
        z
          .object({
            color: boundedString,
            opacity: z.number().min(0).max(1).optional()
          })
          .strict()
      ])
      .optional(),
    elements: z.array(z.union([contentElementSchema, customShapeElementSchema])).max(MAX_ARRAY_LENGTH)
  })
  .strict();

const slideSchema = z.discriminatedUnion("type", [titleSlideSchema, contentSlideSchema, sectionSlideSchema, blankSlideSchema]);

export const presentationDSLSchema = z
  .object({
    version: z.literal("2.0"),
    theme: z.union([boundedString, themeDefinitionSchema]),
    metadata: metadataSchema,
    chrome: presentationChromeSchema.optional(),
    slides: z.array(slideSchema).min(1).max(MAX_ARRAY_LENGTH)
  })
  .strict();

export function parsePresentationDSL(input: unknown): PresentationDSL {
  return presentationDSLSchema.parse(input) as PresentationDSL;
}
