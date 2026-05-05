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
        description="Three-card vertical slide.",
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
    "agenda": ("agenda", "toc", "table_of_contents", "title_and_content", "yaml__agenda"),
    "list_basic": ("list", "list_basic", "bullets", "title_and_content", "yaml__list_basic"),
    "table_basic": ("table", "table_basic", "title_and_content", "yaml__table_basic"),
    "comparison_2col": ("comparison", "2col_compare", "comparison_2col", "yaml__comparison_2col"),
    "three_cards_vertical": ("3col_vertical", "3col_cards_vertical", "three_cards_vertical", "two_content", "yaml__three_cards_vertical"),
    "closing_end": ("closing", "end", "thank_you", "closing_end", "title_slide", "yaml__closing_end"),
    "chart_basic": ("chart", "chart_basic", "title_and_content", "yaml__chart_basic"),
    "image_caption": ("image_caption", "picture_caption", "picture_with_caption", "icon_caption", "yaml__image_caption"),
    "appendix_backup": ("appendix", "backup", "appendix_backup", "title_and_content", "yaml__appendix_backup"),
}


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
        "whenToUse": "Use for three stacked pillars, phases, or recommendations with slightly longer descriptions.",
        "avoidWhen": "Avoid when you have only one or two items, or when chronology is more important than grouping.",
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


def supported_layouts_response() -> dict[str, Any]:
    return {
        "selectionGuidance": {
            "recommendedWorkflow": [
                "Call list_templates() and list_supported_layouts() before writing the deck.",
                "Start with a short outline, then choose the richest fitting layout for each slide instead of defaulting to bullets.",
                "Diversify the middle of the deck with comparison_2col, three_cards_vertical, chart_basic, or table_basic when they fit.",
                "Use section_divider only for major transitions and avoid long consecutive runs of list_basic slides.",
            ],
            "compositionHeuristics": [
                "Use agenda once near the front for decks with several sections.",
                "Use comparison_2col for two viewpoints or before/after framing.",
                "Use three_cards_vertical for three stacked recommendations or phases.",
                "Use chart_basic for evidence driven by numeric trends.",
            ],
            "sampleOutline": [
                {"position": 1, "layout": "cover_title", "reason": "Open with the topic and framing subtitle."},
                {"position": 2, "layout": "agenda", "reason": "Set the structure if the deck has multiple sections."},
                {"position": 3, "layout": "comparison_2col", "reason": "Frame two perspectives or a before/after contrast."},
                {"position": 4, "layout": "three_cards_vertical", "reason": "Show three pillars, phases, or recommendations."},
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
                    {"path": slot.path, "kind": slot.kind, "required": slot.required}
                    for slot in spec.slots
                ],
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
