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
    "three_cards_horizontal": LayoutSpec(
        name="three_cards_horizontal",
        description="Three-card horizontal slide.",
        required_fields=("title", "cards"),
        optional_fields=("subtitle",),
        slots=_card_slots(),
        example={"layout": "three_cards_horizontal", "title": "Pillars", "cards": [{"title": "A", "description": "..."}, {"title": "B", "description": "..."}, {"title": "C", "description": "..."}]},
    ),
    "timeline": LayoutSpec(
        name="timeline",
        description="Timeline slide.",
        required_fields=("title", "events"),
        optional_fields=("subtitle",),
        slots=tuple(
            [SlotSpec("title", "text", True), SlotSpec("subtitle", "text")]
            + [
                slot
                for idx in range(8)
                for slot in (
                    SlotSpec(f"events[{idx}].icon", "icon"),
                    SlotSpec(f"events[{idx}].label", "text"),
                    SlotSpec(f"events[{idx}].title", "text"),
                    SlotSpec(f"events[{idx}].description", "text"),
                    SlotSpec(f"events[{idx}].combined_text", "text"),
                )
            ]
        ),
        example={"layout": "timeline", "title": "Roadmap", "events": [{"label": "Q1", "title": "Plan", "description": "..."}]},
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
    "kpi_big_number": LayoutSpec(
        name="kpi_big_number",
        description="KPI big number slide.",
        required_fields=("title", "metric"),
        optional_fields=("subtitle", "supporting_points"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("metric.value", "text", True),
            SlotSpec("metric.label", "text"),
            SlotSpec("metric.unit", "text"),
            SlotSpec("metric.delta", "text"),
            SlotSpec("supporting_points", "list"),
        ),
        example={"layout": "kpi_big_number", "title": "Growth", "metric": {"value": "42", "label": "Customers"}},
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
    "eol_notice": LayoutSpec(
        name="eol_notice",
        description="End-of-life notice slide.",
        required_fields=("title", "product_name"),
        optional_fields=("subtitle", "end_of_sale", "end_of_support", "replacement", "actions"),
        slots=(
            SlotSpec("title", "text", True),
            SlotSpec("subtitle", "text"),
            SlotSpec("product_name", "text", True),
            SlotSpec("end_of_sale", "text"),
            SlotSpec("end_of_support", "text"),
            SlotSpec("replacement", "text"),
            SlotSpec("actions", "list"),
        ),
        example={"layout": "eol_notice", "title": "EOL Notice", "product_name": "Legacy API"},
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
    "three_cards_horizontal": ("3col_horizontal", "3col_cards_horizontal", "three_cards_horizontal", "two_content", "yaml__three_cards_horizontal"),
    "timeline": ("timeline", "roadmap", "title_and_content", "yaml__timeline"),
    "closing_end": ("closing", "end", "thank_you", "closing_end", "title_slide", "yaml__closing_end"),
    "kpi_big_number": ("kpi", "big_number", "kpi_big_number", "title_and_content", "yaml__kpi_big_number"),
    "chart_basic": ("chart", "chart_basic", "title_and_content", "yaml__chart_basic"),
    "image_caption": ("image_caption", "picture_caption", "picture_with_caption", "icon_caption", "yaml__image_caption"),
    "appendix_backup": ("appendix", "backup", "appendix_backup", "title_and_content", "yaml__appendix_backup"),
    "eol_notice": ("eol", "end_of_life", "eol_notice", "title_and_content", "yaml__eol_notice"),
}


def supported_layouts_response() -> dict[str, Any]:
    return {
        "layouts": [
            {
                "name": spec.name,
                "description": spec.description,
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
