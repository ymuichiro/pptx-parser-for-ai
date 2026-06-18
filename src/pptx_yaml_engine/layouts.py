from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

SlotKind = Literal["text", "list", "table", "chart", "icon"]


@dataclass(frozen=True, slots=True)
class SlotSpec:
    path: str
    kind: SlotKind
    required: bool = False


@dataclass(frozen=True, slots=True)
class LayoutSpec:
    name: str
    description: str
    required_fields: tuple[str, ...]
    optional_fields: tuple[str, ...]
    slots: tuple[SlotSpec, ...]
    example: dict[str, Any]


def _card_slots(required_icon: bool = False) -> tuple[SlotSpec, ...]:
    slots: list[SlotSpec] = [SlotSpec("title", "text", True), SlotSpec("subtitle", "text")]
    for idx in range(3):
        slots.extend(
            [
                SlotSpec(f"cards[{idx}].icon", "icon", required_icon),
                SlotSpec(f"cards[{idx}].title", "text", True),
                SlotSpec(f"cards[{idx}].description", "text", True),
                SlotSpec(f"cards[{idx}].combined_text", "text"),
            ]
        )
    return tuple(slots)


LAYOUT_SPECS: dict[str, LayoutSpec] = {
    "cover_title": LayoutSpec(
        name="cover_title",
        description="Cover slide with title and subtitle.",
        required_fields=("title", "subtitle"),
        optional_fields=("date", "organization", "author"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text", True),
            SlotSpec("date", "text"),
            SlotSpec("organization", "text"),
            SlotSpec("author", "text"),
        ),
        example={
            "layout": "cover_title",
            "title": "Quarterly Review",
            "subtitle": "FY2026 Q1",
            "organization": "AI Platform",
        },
    ),
    "section_divider": LayoutSpec(
        name="section_divider",
        description="Section divider slide.",
        required_fields=("title",),
        optional_fields=("subtitle", "section_no"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("section_no", "text"),
        ),
        example={"layout": "section_divider", "title": "Market Context", "section_no": "01"},
    ),
    "agenda": LayoutSpec(
        name="agenda",
        description="Agenda slide.",
        required_fields=("title", "items"),
        optional_fields=("subtitle",),
        slots=(SlotSpec("title", "text", True), SlotSpec("subtitle", "text"), SlotSpec("items", "list", True)),
        example={"layout": "agenda", "title": "Agenda", "items": ["Overview", "Plan"]},
    ),
    "list_basic": LayoutSpec(
        name="list_basic",
        description="Bulleted or numbered list slide.",
        required_fields=("title", "items"),
        optional_fields=("subtitle", "list_style"),
        slots=(SlotSpec("title", "text", True), SlotSpec("subtitle", "text"), SlotSpec("items", "list", True)),
        example={"layout": "list_basic", "title": "Priorities", "list_style": "bullet", "items": ["Quality", "Velocity"]},
    ),
    "table_basic": LayoutSpec(
        name="table_basic",
        description="Table slide.",
        required_fields=("title", "table"),
        optional_fields=("subtitle", "caption"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("table", "table", True),
            SlotSpec("caption", "text"),
        ),
        example={"layout": "table_basic", "title": "Plan", "table": {"headers": ["Q", "Revenue"], "rows": [["Q1", 10]]}},
    ),
    "comparison_2col": LayoutSpec(
        name="comparison_2col",
        description="Two-column comparison slide.",
        required_fields=("title", "left", "right"),
        optional_fields=("subtitle",),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("left.icon", "icon"),
            SlotSpec("left.title", "text", True),
            SlotSpec("left.description", "text", True),
            SlotSpec("left.bullets", "list"),
            SlotSpec("right.icon", "icon"),
            SlotSpec("right.title", "text", True),
            SlotSpec("right.description", "text", True),
            SlotSpec("right.bullets", "list"),
        ),
        example={
            "layout": "comparison_2col",
            "title": "Old vs New",
            "left": {"title": "Old", "description": "..."},
            "right": {"title": "New", "description": "..."},
        },
    ),
    "three_cards_vertical": LayoutSpec(
        name="three_cards_vertical",
        description="Three-card slide with three side-by-side columns.",
        required_fields=("title", "cards"),
        optional_fields=("subtitle",),
        slots=_card_slots(),
        example={"layout": "three_cards_vertical", "title": "Pillars", "cards": [{"title": "A", "description": "..."}, {"title": "B", "description": "..."}, {"title": "C", "description": "..."}]},
    ),
    "closing_end": LayoutSpec(
        name="closing_end",
        description="Closing slide.",
        required_fields=("title",),
        optional_fields=("subtitle", "message", "contact", "cta"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("message", "text"),
            SlotSpec("contact", "text"),
            SlotSpec("cta", "text"),
        ),
        example={"layout": "closing_end", "title": "Thank You", "contact": "team@example.com"},
    ),
    "chart_basic": LayoutSpec(
        name="chart_basic",
        description="Basic chart slide.",
        required_fields=("title", "chart"),
        optional_fields=("subtitle", "caption"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("chart", "chart", True),
            SlotSpec("caption", "text"),
        ),
        example={"layout": "chart_basic", "title": "Sales", "chart": {"kind": "column", "categories": ["Q1"], "series": [{"name": "Sales", "values": [10]}]}},
    ),
    "image_caption": LayoutSpec(
        name="image_caption",
        description="Icon-with-caption slide. Arbitrary images are not accepted.",
        required_fields=("title", "icon"),
        optional_fields=("subtitle", "caption", "attribution"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("icon", "icon", True),
            SlotSpec("caption", "text"),
            SlotSpec("attribution", "text"),
        ),
        example={"layout": "image_caption", "title": "Upload", "icon": {"pack": "heroicons", "name": "cloud-arrow-up"}},
    ),
    "appendix_backup": LayoutSpec(
        name="appendix_backup",
        description="Appendix or backup slide.",
        required_fields=("title",),
        optional_fields=("subtitle", "body", "items", "references"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("body", "text"),
            SlotSpec("items", "list"),
            SlotSpec("references", "list"),
        ),
        example={"layout": "appendix_backup", "title": "Appendix", "items": ["Detail"]},
    ),
}


LAYOUT_ALIASES: dict[str, tuple[str, ...]] = {
    "cover_title": ("cover", "title_slide", "cover_title", "yaml__cover_title"),
    "section_divider": ("section", "section_header", "section_divider", "yaml__section_divider"),
    "agenda": ("agenda", "toc", "table_of_contents", "yaml__agenda"),
    "list_basic": ("list", "list_basic", "bullets", "yaml__list_basic"),
    "table_basic": ("table", "table_basic", "yaml__table_basic"),
    "comparison_2col": ("comparison", "2col_compare", "comparison_2col", "yaml__comparison_2col"),
    "three_cards_vertical": (
        "3col_vertical",
        "3col",
        "3col_cards_vertical",
        "three_column",
        "three_columns",
        "three_cards",
        "three_cards_vertical",
        "yaml__three_cards_vertical",
    ),
    "closing_end": ("closing", "end", "thank_you", "closing_end", "yaml__closing_end"),
    "chart_basic": ("chart", "chart_basic", "yaml__chart_basic"),
    "image_caption": ("image_caption", "picture_caption", "picture_with_caption", "icon_caption", "yaml__image_caption"),
    "appendix_backup": ("appendix", "backup", "appendix_backup", "yaml__appendix_backup"),
}


def _default_ai_placeholder_name(path: str) -> str:
    tokens: list[str] = []
    for part in path.split("."):
        if "[" in part and part.endswith("]"):
            name, index_raw = part[:-1].split("[", 1)
            if name:
                tokens.append(name.upper())
            tokens.append(str(int(index_raw) + 1))
            continue
        tokens.append(part.upper())
    return "AI_" + "_".join(tokens)


def _card_aliases(index: int, field: str, *extra: str) -> tuple[str, ...]:
    number = index + 1
    return (
        f"AI_CARD{number}_{field}",
        f"AI_COL{number}_{field}",
        f"AI_COLUMN{number}_{field}",
        *extra,
    )


LAYOUT_SLOT_NAME_ALIASES: dict[str, dict[str, tuple[str, ...]]] = {
    "agenda": {
        "items": ("AI_BODY", "AI_AGENDA_ITEMS"),
    },
    "list_basic": {
        "items": ("AI_BODY", "AI_LIST_ITEMS"),
    },
    "comparison_2col": {
        "left.icon": ("AI_COL1_ICON", "AI_COLUMN1_ICON"),
        "left.title": ("AI_COL1_TITLE", "AI_COLUMN1_TITLE", "AI_COL1_HEADING", "AI_COLUMN1_HEADING"),
        "left.description": ("AI_LEFT_BODY", "AI_COL1_DESCRIPTION", "AI_COLUMN1_DESCRIPTION", "AI_COL1_BODY", "AI_COLUMN1_BODY"),
        "left.bullets": ("AI_LEFT_ITEMS", "AI_COL1_ITEMS", "AI_COLUMN1_ITEMS"),
        "right.icon": ("AI_COL2_ICON", "AI_COLUMN2_ICON"),
        "right.title": ("AI_COL2_TITLE", "AI_COLUMN2_TITLE", "AI_COL2_HEADING", "AI_COLUMN2_HEADING"),
        "right.description": ("AI_RIGHT_BODY", "AI_COL2_DESCRIPTION", "AI_COLUMN2_DESCRIPTION", "AI_COL2_BODY", "AI_COLUMN2_BODY"),
        "right.bullets": ("AI_RIGHT_ITEMS", "AI_COL2_ITEMS", "AI_COLUMN2_ITEMS"),
    },
    "three_cards_vertical": {
        "cards[0].icon": _card_aliases(0, "ICON"),
        "cards[0].title": _card_aliases(0, "TITLE", "AI_CARD1_HEADING", "AI_COL1_HEADING", "AI_COLUMN1_HEADING"),
        "cards[0].description": _card_aliases(0, "DESCRIPTION", "AI_CARD1_BODY", "AI_COL1_BODY", "AI_COLUMN1_BODY"),
        "cards[0].combined_text": _card_aliases(0, "COMBINED_TEXT", "AI_CARD1_TEXT", "AI_COL1_TEXT", "AI_COLUMN1_TEXT"),
        "cards[1].icon": _card_aliases(1, "ICON"),
        "cards[1].title": _card_aliases(1, "TITLE", "AI_CARD2_HEADING", "AI_COL2_HEADING", "AI_COLUMN2_HEADING"),
        "cards[1].description": _card_aliases(1, "DESCRIPTION", "AI_CARD2_BODY", "AI_COL2_BODY", "AI_COLUMN2_BODY"),
        "cards[1].combined_text": _card_aliases(1, "COMBINED_TEXT", "AI_CARD2_TEXT", "AI_COL2_TEXT", "AI_COLUMN2_TEXT"),
        "cards[2].icon": _card_aliases(2, "ICON"),
        "cards[2].title": _card_aliases(2, "TITLE", "AI_CARD3_HEADING", "AI_COL3_HEADING", "AI_COLUMN3_HEADING"),
        "cards[2].description": _card_aliases(2, "DESCRIPTION", "AI_CARD3_BODY", "AI_COL3_BODY", "AI_COLUMN3_BODY"),
        "cards[2].combined_text": _card_aliases(2, "COMBINED_TEXT", "AI_CARD3_TEXT", "AI_COL3_TEXT", "AI_COLUMN3_TEXT"),
    },
    "appendix_backup": {
        "body": ("AI_APPENDIX_BODY",),
    },
}


def slot_ai_placeholder_names(layout: str, path: str) -> tuple[str, ...]:
    names = (_default_ai_placeholder_name(path), *LAYOUT_SLOT_NAME_ALIASES.get(layout, {}).get(path, ()))
    unique_names: list[str] = []
    seen: set[str] = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        unique_names.append(name)
    return tuple(unique_names)


LAYOUT_SELECTION_GUIDANCE: dict[str, dict[str, str]] = {
    "cover_title": {
        "whenToUse": "Use once for the opening slide with the deck topic and framing subtitle.",
        "avoidWhen": "Do not reuse for normal content pages.",
    },
    "section_divider": {
        "whenToUse": "Use only to separate major sections or topic shifts.",
        "avoidWhen": "Do not alternate section_divider and list_basic repeatedly; usually 0-2 divider slides are enough.",
    },
    "agenda": {
        "whenToUse": "Use near the front when the deck has several sections or a clear narrative arc.",
        "avoidWhen": "Do not use for detailed content; keep it to the high-level flow.",
    },
    "list_basic": {
        "whenToUse": "Use when bullets are genuinely the clearest representation and ordering matters.",
        "avoidWhen": "Avoid long runs of list_basic slides when comparison, cards, chart, or table would communicate better.",
    },
    "table_basic": {
        "whenToUse": "Use for compact factual matrices such as plans, ownership, pricing, or feature grids.",
        "avoidWhen": "Avoid when the takeaway is a single trend or contrast; use chart_basic or comparison_2col instead.",
    },
    "comparison_2col": {
        "whenToUse": "Use for before/after, old/new, vendor A vs vendor B, or two strategic viewpoints.",
        "avoidWhen": "Avoid when there are more than two parallel items or when the slide is just a plain bullet list.",
    },
    "three_cards_vertical": {
        "whenToUse": "Use for three parallel pillars, offerings, or recommendations that benefit from side-by-side comparison.",
        "avoidWhen": "Avoid when the narrative is chronological or when each item needs a long description better suited to stacked rows.",
    },
    "closing_end": {
        "whenToUse": "Use once at the end for summary, next step, or thank-you framing.",
        "avoidWhen": "Do not place it mid-deck.",
    },
    "chart_basic": {
        "whenToUse": "Use for trends, distributions, or category comparisons where the chart itself is the evidence.",
        "avoidWhen": "Avoid when exact prose explanation matters more than the visual pattern.",
    },
    "image_caption": {
        "whenToUse": "Use for a single icon-led concept, architecture component, or spotlighted capability.",
        "avoidWhen": "Avoid when the slide needs multiple peer items; use cards instead.",
    },
    "appendix_backup": {
        "whenToUse": "Use for backup details, references, assumptions, or optional supporting notes.",
        "avoidWhen": "Avoid in the main story unless the material is clearly supplemental.",
    },
}


SLOT_CAPACITY_GUIDANCE: dict[SlotKind, str] = {
    "text": "Aim for 1-2 short lines. Long prose should be split into another slide or list slot.",
    "list": "Aim for 3-6 bullets. Keep each bullet concise enough to fit the authored placeholder.",
    "table": "Aim for 3-5 columns and 3-6 body rows. Larger tables need a custom template with a larger table placeholder.",
    "chart": "Aim for 1 chart with up to 6 categories and 1-3 series for readable enterprise slides.",
    "icon": "Use a picture placeholder sized as a visual square. Deck values must be built-in icon refs, not arbitrary images.",
}

SLOT_KIND_PLACEHOLDER_TYPES: dict[SlotKind, tuple[str, ...]] = {
    "text": ("TITLE", "CENTER_TITLE", "SUBTITLE", "BODY", "OBJECT"),
    "list": ("TITLE", "CENTER_TITLE", "SUBTITLE", "BODY", "OBJECT"),
    "table": ("TABLE",),
    "chart": ("CHART",),
    "icon": ("PICTURE",),
}


def _layout_authoring_contract(spec: LayoutSpec) -> dict[str, Any]:
    layout_names = list(dict.fromkeys((spec.name, *LAYOUT_ALIASES.get(spec.name, ()))))
    return {
        "semanticLayoutName": spec.name,
        "powerPointLayoutNames": layout_names,
        "requiredAiPlaceholders": [
            {
                "slot": slot.path,
                "kind": slot.kind,
                "aiNames": list(slot_ai_placeholder_names(spec.name, slot.path)),
                "compatiblePlaceholderTypes": list(SLOT_KIND_PLACEHOLDER_TYPES[slot.kind]),
                "capacityGuidance": SLOT_CAPACITY_GUIDANCE[slot.kind],
            }
            for slot in spec.slots
            if slot.required
        ],
        "optionalAiPlaceholders": [
            {
                "slot": slot.path,
                "kind": slot.kind,
                "aiNames": list(slot_ai_placeholder_names(spec.name, slot.path)),
                "compatiblePlaceholderTypes": list(SLOT_KIND_PLACEHOLDER_TYPES[slot.kind]),
                "capacityGuidance": SLOT_CAPACITY_GUIDANCE[slot.kind],
            }
            for slot in spec.slots
            if not slot.required
        ],
    }


def template_authoring_contract_response() -> dict[str, Any]:
    return {
        "contractVersion": 1,
        "rules": [
            "Create one PowerPoint slide layout per supported semantic layout.",
            "Name each PowerPoint slide layout with the semantic layout key or a documented alias.",
            "Rename each bindable placeholder in PowerPoint's Selection Pane to one of the listed AI_* names.",
            "Use PowerPoint placeholders only; AI_* names on ordinary shapes are invalid.",
            "Do not rely on geometry, placeholder type, slot__*, or placeholder__* fallback mapping.",
        ],
        "slotKindCapacityGuidance": dict(SLOT_CAPACITY_GUIDANCE),
        "slotKindCompatiblePlaceholderTypes": {
            kind: list(types)
            for kind, types in SLOT_KIND_PLACEHOLDER_TYPES.items()
        },
        "layouts": [_layout_authoring_contract(spec) for spec in LAYOUT_SPECS.values()],
    }


def supported_layouts_response() -> dict[str, Any]:
    return {
        "selectionGuidance": {
            "recommendedWorkflow": [
                "Call list_templates() and list_supported_layouts() before writing the deck.",
                "Write the full deck JSON before calling render_presentation(): use an object with version=1 and a slides array; do not send a partial probe call.",
                "Call render_presentation() once per finalized deck; if it returns success=true and a download_url, use that output instead of re-rendering the same deck.",
                "Start with a short outline, then choose the richest fitting layout for each slide instead of defaulting to bullets.",
                "Diversify the middle of the deck with comparison_2col, three_cards_vertical, chart_basic, or table_basic when they fit.",
                "Use section_divider only for major transitions and avoid long consecutive runs of list_basic slides.",
            ],
            "compositionHeuristics": [
                "Use agenda once near the front for decks with several sections.",
                "Use comparison_2col for two viewpoints or before/after framing.",
                "Use three_cards_vertical for three side-by-side pillars or options.",
                "Use chart_basic for evidence driven by numeric trends.",
            ],
            "sampleOutline": [
                {"position": 1, "layout": "cover_title", "reason": "Open with the topic and framing subtitle."},
                {"position": 2, "layout": "agenda", "reason": "Set the structure if the deck has multiple sections."},
                {"position": 3, "layout": "comparison_2col", "reason": "Frame two perspectives or a before/after contrast."},
                {"position": 4, "layout": "three_cards_vertical", "reason": "Show three parallel pillars, options, or recommendations."},
                {"position": 5, "layout": "list_basic", "reason": "Reserve bullets for takeaways or action items."},
                {"position": 6, "layout": "closing_end", "reason": "End with summary or next step."},
            ],
        },
        "layouts": [
            {
                "name": spec.name,
                "description": spec.description,
                "whenToUse": LAYOUT_SELECTION_GUIDANCE[spec.name]["whenToUse"],
                "avoidWhen": LAYOUT_SELECTION_GUIDANCE[spec.name]["avoidWhen"],
                "requiredFields": list(spec.required_fields),
                "optionalFields": list(spec.optional_fields),
                "slots": [
                    {
                        "path": slot.path,
                        "kind": slot.kind,
                        "required": slot.required,
                        "aiNames": list(slot_ai_placeholder_names(spec.name, slot.path)),
                        "compatiblePlaceholderTypes": list(SLOT_KIND_PLACEHOLDER_TYPES[slot.kind]),
                        "capacityGuidance": SLOT_CAPACITY_GUIDANCE[slot.kind],
                    }
                    for slot in spec.slots
                ],
                "templateAuthoring": _layout_authoring_contract(spec),
                "example": spec.example,
            }
            for spec in LAYOUT_SPECS.values()
        ]
    }


def get_slot_spec(layout: str, path: str) -> SlotSpec | None:
    spec = LAYOUT_SPECS.get(layout)
    if spec is None:
        return None
    return next((slot for slot in spec.slots if slot.path == path), None)
