import { z } from "zod";
import { MAX_ARRAY_LENGTH, MAX_STRING_LENGTH } from "../constants";
import type { PresentationDSL } from "../types";
import { themeDefinitionSchema } from "../theme/schema";

const boundedString = z.string().min(1).max(MAX_STRING_LENGTH);
const optionalBoundedString = z.string().min(1).max(MAX_STRING_LENGTH).optional();

const metadataSchema = z
  .object({
    title: boundedString,
    author: optionalBoundedString,
    company: optionalBoundedString,
    date: optionalBoundedString
  })
  .strict();

const textElementSchema = z
  .object({
    type: z.literal("text"),
    content: boundedString,
    style: z.union([z.literal("title"), z.literal("heading"), z.literal("body"), z.literal("caption")]).optional(),
    align: z.union([z.literal("left"), z.literal("center"), z.literal("right")]).optional()
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
    style: z.union([z.literal("default"), z.literal("pros"), z.literal("cons"), z.literal("checkmark")]).optional(),
    items: z.array(z.union([boundedString, bulletItemSchema])).max(MAX_ARRAY_LENGTH)
  })
  .strict();

const numberedListElementSchema = z
  .object({
    type: z.literal("numbered-list"),
    items: z.array(boundedString).max(MAX_ARRAY_LENGTH)
  })
  .strict();

const statCalloutElementSchema = z
  .object({
    type: z.literal("stat-callout"),
    value: boundedString,
    label: boundedString,
    trend: optionalBoundedString,
    color: optionalBoundedString
  })
  .strict();

const imageElementSchema = z
  .object({
    type: z.literal("image"),
    source: boundedString,
    caption: optionalBoundedString,
    sizing: z.union([z.literal("contain"), z.literal("cover"), z.literal("crop")]).optional(),
    position: z.union([z.literal("center"), z.literal("left"), z.literal("right")]).optional()
  })
  .strict();

const tableElementSchema = z
  .object({
    type: z.literal("table"),
    style: z.union([z.literal("default"), z.literal("striped"), z.literal("bordered"), z.literal("minimal")]).optional(),
    headers: z.array(boundedString).min(1).max(MAX_ARRAY_LENGTH),
    rows: z.array(z.array(z.union([boundedString, z.number()])).max(MAX_ARRAY_LENGTH)).max(MAX_ARRAY_LENGTH),
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
      .optional()
  })
  .strict();

const chartElementSchema = z
  .object({
    type: z.literal("chart"),
    chartType: z.union([
      z.literal("bar"),
      z.literal("line"),
      z.literal("pie"),
      z.literal("doughnut"),
      z.literal("scatter")
    ]),
    title: optionalBoundedString,
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
        showLegend: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

const networkDiagramElementSchema = z
  .object({
    type: z.literal("network-diagram"),
    layout: z.union([z.literal("hierarchical"), z.literal("force-directed"), z.literal("circular")]),
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
      .max(MAX_ARRAY_LENGTH)
  })
  .strict();

const flowchartElementSchema = z
  .object({
    type: z.literal("flowchart"),
    direction: z.union([z.literal("horizontal"), z.literal("vertical")]),
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
      .max(MAX_ARRAY_LENGTH)
  })
  .strict();

const iconGridElementSchema = z
  .object({
    type: z.literal("icon-grid"),
    columns: z.number().int().positive().max(12),
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
      .max(MAX_ARRAY_LENGTH)
  })
  .strict();

let contentElementSchema: z.ZodTypeAny;

const twoColumnElementSchema: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      type: z.literal("two-column"),
      left: z.array(contentElementSchema).max(MAX_ARRAY_LENGTH),
      right: z.array(contentElementSchema).max(MAX_ARRAY_LENGTH),
      ratio: z.union([z.literal("1:1"), z.literal("2:1"), z.literal("1:2")]).optional()
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
    shape: z.union([z.literal("rectangle"), z.literal("circle"), z.literal("triangle"), z.literal("arrow")]),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        w: z.number().positive(),
        h: z.number().positive()
      })
      .strict(),
    fill: optionalBoundedString,
    border: z
      .object({
        color: boundedString,
        width: z.number().positive()
      })
      .strict()
      .optional()
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
    version: z.string().min(1).max(10),
    theme: z.union([boundedString, themeDefinitionSchema]),
    metadata: metadataSchema,
    slides: z.array(slideSchema).min(1).max(MAX_ARRAY_LENGTH)
  })
  .strict();

export function parsePresentationDSL(input: unknown): PresentationDSL {
  return presentationDSLSchema.parse(input) as PresentationDSL;
}
