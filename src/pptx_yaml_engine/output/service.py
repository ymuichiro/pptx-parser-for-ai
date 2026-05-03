from __future__ import annotations

from collections.abc import Callable
from io import BytesIO
from typing import Any

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.icons.registry import resolve_icon
from pptx_yaml_engine.output.validation import validate_deck as validate_deck
from pptx_yaml_engine.utils.fingerprint import template_fingerprint
from pptx_yaml_engine.utils.pptx import clear_existing_slides, find_layout_by_name
from pptx_yaml_engine.utils.template_bytes import normalize_template_for_python_pptx


def _rgb(red: int, green: int, blue: int) -> RGBColor:
    return RGBColor(red, green, blue)  # type: ignore[no-untyped-call]


WHITE = _rgb(0xFF, 0xFF, 0xFF)
INK = _rgb(0x11, 0x11, 0x11)
BODY = _rgb(0x43, 0x43, 0x43)
MUTED = _rgb(0x72, 0x72, 0x72)
LINE = _rgb(0xDE, 0xE1, 0xE6)
SURFACE = _rgb(0xF8, 0xF9, 0xFB)
SHADOW_1 = _rgb(0xF2, 0xF4, 0xF7)
SHADOW_2 = _rgb(0xF8, 0xFA, 0xFC)
ACCENT = _rgb(0x1F, 0x29, 0x37)
SUBTLE_ACCENT = _rgb(0xE8, 0xEB, 0xF0)


def _get_path(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.replace("]", "").split("."):
        if "[" in part:
            name, index_raw = part.split("[", 1)
            current = current.get(name) if isinstance(current, dict) else None
            if not isinstance(current, list):
                return None
            index = int(index_raw)
            if index >= len(current):
                return None
            current = current[index]
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _set_text(placeholder: Any, value: Any, *, append: bool = False) -> None:
    if value is None:
        return
    if isinstance(value, list):
        text = "\n".join(_list_item_text(item) for item in value)
    elif isinstance(value, dict):
        text = "\n".join(str(item) for item in value.values() if item is not None)
    else:
        text = str(value)
    if not text:
        return
    if not hasattr(placeholder, "text_frame"):
        return
    frame = placeholder.text_frame
    if not append:
        frame.clear()
        frame.paragraphs[0].text = text
        return
    if frame.text:
        paragraph = frame.add_paragraph()
        paragraph.text = text
    else:
        frame.clear()
        frame.paragraphs[0].text = text


def _list_item_text(item: Any) -> str:
    if isinstance(item, dict):
        text = str(item.get("text", ""))
        level = int(item.get("level", 0) or 0)
        return f"{'  ' * max(0, level)}{text}"
    return str(item)


def _write_list(placeholder: Any, items: list[Any], *, append: bool = False) -> None:
    if not hasattr(placeholder, "text_frame"):
        return
    frame = placeholder.text_frame
    if not append:
        frame.clear()
    for index, item in enumerate(items):
        paragraph = frame.paragraphs[0] if index == 0 and not frame.text else frame.add_paragraph()
        paragraph.text = _list_item_text(item)
        if isinstance(item, dict):
            paragraph.level = int(item.get("level", 0) or 0)


def _write_icon(slide: Any, placeholder: Any, icon_ref: dict[str, Any]) -> None:
    target_px = min(512, max(64, int(max(int(placeholder.width), int(placeholder.height)) / 9525)))
    icon_bytes = resolve_icon(icon_ref, target_px=target_px)
    stream = BytesIO(icon_bytes)
    if hasattr(placeholder, "insert_picture"):
        placeholder.insert_picture(stream)
        return
    slide.shapes.add_picture(stream, placeholder.left, placeholder.top, width=placeholder.width, height=placeholder.height)


def _write_table(slide: Any, placeholder: Any, table_spec: dict[str, Any]) -> None:
    headers = [str(value) for value in table_spec["headers"]]
    rows = [[str(value) for value in row] for row in table_spec.get("rows", [])]
    row_count = len(rows) + 1
    col_count = len(headers)
    if hasattr(placeholder, "insert_table"):
        frame = placeholder.insert_table(row_count, col_count)
    else:
        frame = slide.shapes.add_table(row_count, col_count, placeholder.left, placeholder.top, placeholder.width, placeholder.height)
    table = frame.table
    for col_idx, header in enumerate(headers):
        table.cell(0, col_idx).text = header
    for row_idx, row in enumerate(rows, start=1):
        for col_idx, value in enumerate(row):
            table.cell(row_idx, col_idx).text = value


def _chart_type(kind: str) -> Any:
    return {
        "bar": XL_CHART_TYPE.BAR_CLUSTERED,
        "column": XL_CHART_TYPE.COLUMN_CLUSTERED,
        "line": XL_CHART_TYPE.LINE,
        "pie": XL_CHART_TYPE.PIE,
    }[kind]


def _write_chart(slide: Any, placeholder: Any, chart_spec: dict[str, Any]) -> None:
    chart_data = CategoryChartData()  # type: ignore[no-untyped-call]
    chart_data.categories = [str(value) for value in chart_spec["categories"]]
    for series in chart_spec["series"]:
        chart_data.add_series(str(series["name"]), tuple(series["values"]))  # type: ignore[no-untyped-call]
    chart_type = _chart_type(chart_spec["kind"])
    if hasattr(placeholder, "insert_chart"):
        placeholder.insert_chart(chart_type, chart_data)
    else:
        slide.shapes.add_chart(chart_type, placeholder.left, placeholder.top, placeholder.width, placeholder.height, chart_data)


def _slot_value(slide_spec: dict[str, Any], path: str) -> Any:
    if path.endswith(".combined_text"):
        base = path.rsplit(".", 1)[0]
        title = _get_path(slide_spec, f"{base}.title")
        description = _get_path(slide_spec, f"{base}.description")
        values = [value for value in (title, description) if value is not None]
        return "\n".join(str(value) for value in values)
    return _get_path(slide_spec, path)


def _placeholder(slide: Any, idx: int, *, layout: str, slot: str) -> Any:
    try:
        return slide.placeholders[idx]
    except KeyError as exc:
        raise DomainError(
            "PLACEHOLDER_IDX_NOT_FOUND",
            "Placeholder idx not found on generated slide",
            {"layout": layout, "slot": slot, "idx": idx},
        ) from exc


def _render_slide(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    seen_idx: set[int] = set()
    for slot_path, slot_binding in binding.get("slots", {}).items():
        value = _slot_value(slide_spec, slot_path)
        if value is None:
            continue
        placeholder_info = slot_binding.get("placeholder", {})
        idx = int(placeholder_info["idx"])
        placeholder = _placeholder(slide, idx, layout=slide_spec["layout"], slot=slot_path)
        kind = slot_binding.get("kind", "text")
        append = idx in seen_idx
        seen_idx.add(idx)
        if kind == "list":
            _write_list(placeholder, value if isinstance(value, list) else [value], append=append)
        elif kind == "table":
            _write_table(slide, placeholder, value)
        elif kind == "chart":
            _write_chart(slide, placeholder, value)
        elif kind == "icon":
            _write_icon(slide, placeholder, value)
        else:
            _set_text(placeholder, value, append=append)


def _solid_fill(fill_obj: Any, rgb: RGBColor) -> None:
    fill_obj.solid()
    fill_obj.fore_color.rgb = rgb


def _hide_line(shape: Any) -> None:
    shape.line.fill.background()


def _set_rounding(shape: Any, radius: float = 0.08) -> None:
    adjustments = getattr(shape, "adjustments", None)
    if adjustments is not None and len(adjustments) > 0:
        adjustments[0] = radius


def _add_shape(
    slide: Any,
    shape_type: MSO_AUTO_SHAPE_TYPE,
    *,
    left: float,
    top: float,
    width: float,
    height: float,
    fill_rgb: RGBColor,
    line_rgb: RGBColor | None = None,
    rounded_radius: float | None = None,
) -> Any:
    shape = slide.shapes.add_shape(
        shape_type,
        Inches(left),
        Inches(top),
        Inches(width),
        Inches(height),
    )
    _solid_fill(shape.fill, fill_rgb)
    if line_rgb is None:
        _hide_line(shape)
    else:
        shape.line.color.rgb = line_rgb
        shape.line.width = Pt(1)
    if rounded_radius is not None:
        _set_rounding(shape, rounded_radius)
    return shape


def _add_rule(
    slide: Any,
    *,
    left: float,
    top: float,
    width: float,
    height: float = 0.02,
    fill_rgb: RGBColor = LINE,
) -> Any:
    return _add_shape(
        slide,
        MSO_AUTO_SHAPE_TYPE.RECTANGLE,
        left=left,
        top=top,
        width=width,
        height=height,
        fill_rgb=fill_rgb,
    )


def _set_run_style(run: Any, *, font_size: int, color: RGBColor, bold: bool = False) -> None:
    font = run.font
    font.size = Pt(font_size)
    font.color.rgb = color
    font.bold = bold


def _add_textbox(
    slide: Any,
    *,
    left: float,
    top: float,
    width: float,
    height: float,
    text: str | None = None,
    font_size: int = 16,
    color: RGBColor = BODY,
    bold: bool = False,
    align: PP_ALIGN = PP_ALIGN.LEFT,
    vertical_anchor: MSO_ANCHOR = MSO_ANCHOR.TOP,
    margins: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0),
) -> Any:
    shape = slide.shapes.add_textbox(
        Inches(left),
        Inches(top),
        Inches(width),
        Inches(height),
    )
    shape.fill.background()
    shape.line.fill.background()
    frame = shape.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.vertical_anchor = vertical_anchor
    frame.margin_left = Inches(margins[0])
    frame.margin_top = Inches(margins[1])
    frame.margin_right = Inches(margins[2])
    frame.margin_bottom = Inches(margins[3])
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    paragraph.space_after = Pt(0)
    paragraph.space_before = Pt(0)
    if text:
        run = paragraph.add_run()
        run.text = text
        _set_run_style(run, font_size=font_size, color=color, bold=bold)
    return shape


def _add_paragraph(
    text_frame: Any,
    text: str,
    *,
    font_size: int,
    color: RGBColor,
    bold: bool = False,
    level: int = 0,
    align: PP_ALIGN = PP_ALIGN.LEFT,
) -> None:
    paragraph = text_frame.paragraphs[0] if not text_frame.text else text_frame.add_paragraph()
    paragraph.text = ""
    paragraph.level = level
    paragraph.alignment = align
    paragraph.space_after = Pt(0)
    paragraph.space_before = Pt(0)
    run = paragraph.add_run()
    run.text = text
    _set_run_style(run, font_size=font_size, color=color, bold=bold)


def _add_list_box(
    slide: Any,
    *,
    left: float,
    top: float,
    width: float,
    height: float,
    items: list[str],
    font_size: int = 13,
    color: RGBColor = BODY,
    bullet: str = "•",
) -> Any:
    shape = _add_textbox(slide, left=left, top=top, width=width, height=height)
    frame = shape.text_frame
    for item in items:
        _add_paragraph(frame, f"{bullet} {item}", font_size=font_size, color=color)
    return shape


def _add_icon_picture(slide: Any, *, icon_ref: dict[str, Any], left: float, top: float, size: float) -> None:
    icon_bytes = resolve_icon(icon_ref, target_px=384)
    slide.shapes.add_picture(BytesIO(icon_bytes), Inches(left), Inches(top), width=Inches(size), height=Inches(size))


def _clear_bound_slot(slide: Any, binding: dict[str, Any], *, slot: str) -> None:
    slot_binding = binding.get("slots", {}).get(slot)
    if slot_binding is None:
        return
    placeholder_info = slot_binding.get("placeholder", {})
    placeholder = _placeholder(slide, int(placeholder_info["idx"]), layout="custom", slot=slot)
    if hasattr(placeholder, "text_frame"):
        placeholder.text_frame.clear()


def _render_bound_text_slot(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any], slot: str) -> None:
    slot_binding = binding.get("slots", {}).get(slot)
    if slot_binding is None:
        return
    value = _slot_value(slide_spec, slot)
    if value is None:
        return
    placeholder_info = slot_binding.get("placeholder", {})
    placeholder = _placeholder(slide, int(placeholder_info["idx"]), layout=slide_spec["layout"], slot=slot)
    _set_text(placeholder, value)


def _render_title_and_subtitle(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_bound_text_slot(slide, slide_spec, binding, "title")
    _render_bound_text_slot(slide, slide_spec, binding, "subtitle")


def _split_display_text(text: str) -> tuple[str, str]:
    value = text.strip()
    for separator in ("\n", "：", ": ", " - ", " — "):
        if separator in value:
            head, tail = value.split(separator, 1)
            if head.strip() and tail.strip():
                return head.strip(), tail.strip()
    return value, ""


def _list_strings(items: list[Any]) -> list[str]:
    return [_list_item_text(item).strip() for item in items if _list_item_text(item).strip()]


def _add_card_surface(slide: Any, *, left: float, top: float, width: float, height: float) -> None:
    _add_shape(
        slide,
        MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
        left=left + 0.05,
        top=top + 0.08,
        width=width,
        height=height,
        fill_rgb=SHADOW_2,
        rounded_radius=0.06,
    )
    _add_shape(
        slide,
        MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
        left=left + 0.02,
        top=top + 0.04,
        width=width,
        height=height,
        fill_rgb=SHADOW_1,
        rounded_radius=0.06,
    )
    _add_shape(
        slide,
        MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
        left=left,
        top=top,
        width=width,
        height=height,
        fill_rgb=WHITE,
        rounded_radius=0.06,
    )


def _render_list_basic_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    _clear_bound_slot(slide, binding, slot="items")
    items = slide_spec.get("items", [])
    if not isinstance(items, list) or not items:
        return
    top = 2.02
    available_height = 4.95
    row_gap = 0.1
    row_height = min(1.2, (available_height - row_gap * (len(items) - 1)) / len(items))
    for index, item in enumerate(items[:5]):
        text = _list_item_text(item).strip()
        if not text:
            continue
        level = int(item.get("level", 0)) if isinstance(item, dict) else 0
        title, detail = _split_display_text(text)
        y = top + index * (row_height + row_gap)
        badge_left = 0.72 + 0.26 * max(level, 0)
        _add_shape(
            slide,
            MSO_AUTO_SHAPE_TYPE.OVAL,
            left=badge_left,
            top=y + 0.08,
            width=0.46,
            height=0.46,
            fill_rgb=SURFACE,
            line_rgb=SUBTLE_ACCENT,
        )
        _add_textbox(
            slide,
            left=badge_left,
            top=y + 0.1,
            width=0.46,
            height=0.36,
            text=f"{index + 1}",
            font_size=12,
            color=ACCENT,
            bold=True,
            align=PP_ALIGN.CENTER,
            vertical_anchor=MSO_ANCHOR.MIDDLE,
        )
        content_left = badge_left + 0.7
        _add_textbox(
            slide,
            left=content_left,
            top=y,
            width=10.8 - content_left,
            height=0.38,
            text=title,
            font_size=18 if level == 0 else 15,
            color=INK,
            bold=True,
        )
        if detail:
            _add_textbox(
                slide,
                left=content_left,
                top=y + 0.42,
                width=10.8 - content_left,
                height=max(0.4, row_height - 0.42),
                text=detail,
                font_size=12,
                color=MUTED,
            )
        if index < len(items) - 1:
            _add_rule(slide, left=content_left, top=y + row_height + 0.02, width=11.55 - content_left)


def _render_comparison_2col_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    for slot in ("left.title", "left.description", "left.bullets", "left.icon", "right.title", "right.description", "right.bullets", "right.icon"):
        _clear_bound_slot(slide, binding, slot=slot)

    cards = [
        (slide_spec.get("left", {}), 0.76, 2.22, 5.48, 4.45),
        (slide_spec.get("right", {}), 7.08, 2.22, 5.48, 4.45),
    ]
    _add_textbox(
        slide,
        left=6.34,
        top=4.1,
        width=0.42,
        height=0.4,
        text=">",
        font_size=26,
        color=MUTED,
        bold=True,
        align=PP_ALIGN.CENTER,
        vertical_anchor=MSO_ANCHOR.MIDDLE,
    )
    for spec, left, top, width, height in cards:
        _add_card_surface(slide, left=left, top=top, width=width, height=height)
        title = str(spec.get("title", "")).strip()
        description = str(spec.get("description", "")).strip()
        bullets = _list_strings(spec.get("bullets", [])) if isinstance(spec, dict) and isinstance(spec.get("bullets"), list) else []
        icon_ref = spec.get("icon") if isinstance(spec, dict) and isinstance(spec.get("icon"), dict) else None
        header_left = left + 0.44
        header_top = top + 0.4
        if icon_ref is not None:
            _add_shape(
                slide,
                MSO_AUTO_SHAPE_TYPE.OVAL,
                left=left + width - 0.98,
                top=top + 0.32,
                width=0.5,
                height=0.5,
                fill_rgb=SURFACE,
                line_rgb=SUBTLE_ACCENT,
            )
            _add_icon_picture(slide, icon_ref=icon_ref, left=left + width - 0.87, top=top + 0.43, size=0.28)
        _add_textbox(
            slide,
            left=header_left,
            top=header_top,
            width=width - 0.88,
            height=0.45,
            text=title,
            font_size=21,
            color=INK,
            bold=True,
        )
        _add_textbox(
            slide,
            left=header_left,
            top=top + 1.05,
            width=width - 0.88,
            height=1.55 if bullets else 2.25,
            text=description,
            font_size=13,
            color=BODY,
        )
        if bullets:
            _add_rule(slide, left=header_left, top=top + 2.85, width=width - 0.88)
            _add_list_box(
                slide,
                left=header_left,
                top=top + 3.05,
                width=width - 0.88,
                height=height - 3.28,
                items=bullets[:4],
                font_size=12,
                color=MUTED,
            )


def _render_three_cards_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    for idx in range(3):
        for suffix in ("combined_text", "title", "description", "icon"):
            _clear_bound_slot(slide, binding, slot=f"cards[{idx}].{suffix}")
    cards = slide_spec.get("cards", [])
    if not isinstance(cards, list):
        return
    lefts = (0.62, 4.79, 8.96)
    top = 2.22
    width = 3.78
    height = 4.2
    centered = slide_spec["layout"] == "three_cards_vertical"
    for index, card in enumerate(cards[:3]):
        if not isinstance(card, dict):
            continue
        left = lefts[index]
        _add_card_surface(slide, left=left, top=top, width=width, height=height)
        title = str(card.get("title", "")).strip()
        description = str(card.get("description", "")).strip()
        icon_ref = card.get("icon") if isinstance(card.get("icon"), dict) else None
        header_align = PP_ALIGN.CENTER if centered else PP_ALIGN.LEFT
        header_left = left + 0.34
        header_width = width - 0.68
        if icon_ref is not None:
            icon_size = 0.52
            icon_left = left + (width - icon_size) / 2 if centered else left + 0.34
            _add_shape(
                slide,
                MSO_AUTO_SHAPE_TYPE.OVAL,
                left=icon_left - 0.06,
                top=top + 0.34,
                width=0.64,
                height=0.64,
                fill_rgb=SURFACE,
                line_rgb=SUBTLE_ACCENT,
            )
            _add_icon_picture(slide, icon_ref=icon_ref, left=icon_left + 0.08, top=top + 0.48, size=icon_size - 0.24)
        _add_textbox(
            slide,
            left=header_left,
            top=top + (1.0 if icon_ref is not None else 0.56),
            width=header_width,
            height=0.54,
            text=title,
            font_size=18,
            color=INK,
            bold=True,
            align=header_align,
        )
        _add_textbox(
            slide,
            left=header_left,
            top=top + (1.56 if icon_ref is not None else 1.1),
            width=header_width,
            height=1.8,
            text=description,
            font_size=12,
            color=BODY,
            align=header_align,
        )


def _render_timeline_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    for idx in range(8):
        for suffix in ("combined_text", "label", "title", "description", "icon"):
            _clear_bound_slot(slide, binding, slot=f"events[{idx}].{suffix}")
    events = slide_spec.get("events", [])
    if not isinstance(events, list) or not events:
        return
    line_left = 2.35
    start_top = 2.0
    step = min(1.18, 4.85 / max(len(events), 1))
    line_height = max(0.0, step * (len(events) - 1))
    if len(events) > 1:
        _add_shape(
            slide,
            MSO_AUTO_SHAPE_TYPE.RECTANGLE,
            left=line_left,
            top=start_top + 0.2,
            width=0.03,
            height=line_height,
            fill_rgb=SUBTLE_ACCENT,
        )
    for index, event in enumerate(events[:8]):
        if not isinstance(event, dict):
            continue
        y = start_top + index * step
        _add_shape(
            slide,
            MSO_AUTO_SHAPE_TYPE.OVAL,
            left=line_left - 0.11,
            top=y + 0.1,
            width=0.25,
            height=0.25,
            fill_rgb=ACCENT,
        )
        label = str(event.get("label", "")).strip()
        title = str(event.get("title", "")).strip()
        description = str(event.get("description", "")).strip()
        if label:
            _add_textbox(
                slide,
                left=0.7,
                top=y - 0.02,
                width=1.35,
                height=0.35,
                text=label,
                font_size=12,
                color=MUTED,
                bold=True,
                align=PP_ALIGN.RIGHT,
            )
        icon_ref = event.get("icon") if isinstance(event.get("icon"), dict) else None
        content_left = 2.78
        if icon_ref is not None:
            _add_shape(
                slide,
                MSO_AUTO_SHAPE_TYPE.OVAL,
                left=content_left,
                top=y - 0.05,
                width=0.42,
                height=0.42,
                fill_rgb=SURFACE,
                line_rgb=SUBTLE_ACCENT,
            )
            _add_icon_picture(slide, icon_ref=icon_ref, left=content_left + 0.1, top=y + 0.05, size=0.18)
            content_left += 0.56
        if title:
            _add_textbox(
                slide,
                left=content_left,
                top=y - 0.04,
                width=3.0,
                height=0.35,
                text=title,
                font_size=17,
                color=INK,
                bold=True,
            )
        if description:
            _add_textbox(
                slide,
                left=content_left,
                top=y + 0.32,
                width=8.8 - content_left,
                height=max(0.38, step - 0.28),
                text=description,
                font_size=12,
                color=BODY,
            )


def _render_kpi_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    for slot in ("metric.value", "metric.label", "metric.unit", "metric.delta", "supporting_points"):
        _clear_bound_slot(slide, binding, slot=slot)
    metric = slide_spec.get("metric", {})
    if not isinstance(metric, dict):
        return
    value = str(metric.get("value", "")).strip()
    unit = str(metric.get("unit", "")).strip()
    label = str(metric.get("label", "")).strip()
    delta = str(metric.get("delta", "")).strip()
    if delta:
        _add_shape(
            slide,
            MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
            left=10.5,
            top=1.76,
            width=1.75,
            height=0.42,
            fill_rgb=SURFACE,
            line_rgb=SUBTLE_ACCENT,
            rounded_radius=0.12,
        )
        _add_textbox(
            slide,
            left=10.58,
            top=1.82,
            width=1.58,
            height=0.26,
            text=delta,
            font_size=11,
            color=ACCENT,
            bold=True,
            align=PP_ALIGN.CENTER,
            vertical_anchor=MSO_ANCHOR.MIDDLE,
        )
    if value:
        metric_box = _add_textbox(
            slide,
            left=0.85,
            top=2.2,
            width=11.2,
            height=1.7,
            text=value,
            font_size=86,
            color=INK,
            bold=True,
            align=PP_ALIGN.CENTER,
            vertical_anchor=MSO_ANCHOR.MIDDLE,
        )
        if unit:
            frame = metric_box.text_frame
            paragraph = frame.paragraphs[0]
            run = paragraph.add_run()
            run.text = unit
            _set_run_style(run, font_size=30, color=INK, bold=True)
    if label:
        _add_textbox(
            slide,
            left=1.1,
            top=3.7,
            width=10.7,
            height=0.45,
            text=label,
            font_size=18,
            color=MUTED,
            bold=True,
            align=PP_ALIGN.CENTER,
        )
    points = _list_strings(slide_spec.get("supporting_points", [])) if isinstance(slide_spec.get("supporting_points"), list) else []
    if points:
        count = min(len(points), 3)
        col_width = 3.68
        lefts = [0.92 + index * 3.95 for index in range(count)]
        for index, point in enumerate(points[:count]):
            if index:
                _add_rule(slide, left=lefts[index] - 0.13, top=5.13, width=0.02, height=1.15)
            _add_textbox(
                slide,
                left=lefts[index],
                top=4.9,
                width=col_width,
                height=1.35,
                text=point,
                font_size=13,
                color=BODY,
                align=PP_ALIGN.CENTER,
                vertical_anchor=MSO_ANCHOR.MIDDLE,
            )


def _render_image_caption_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    for slot in ("icon", "caption", "attribution"):
        _clear_bound_slot(slide, binding, slot=slot)
    icon_ref = slide_spec.get("icon")
    if not isinstance(icon_ref, dict):
        return
    panel_left = 0.78
    panel_top = 2.2
    panel_width = 6.25
    panel_height = 4.55
    _add_card_surface(slide, left=panel_left, top=panel_top, width=panel_width, height=panel_height)
    _add_icon_picture(slide, icon_ref=icon_ref, left=2.84, top=3.42, size=1.62)
    caption = str(slide_spec.get("caption", "")).strip()
    attribution = str(slide_spec.get("attribution", "")).strip()
    _add_card_surface(slide, left=7.52, top=2.32, width=4.18, height=3.38)
    if caption:
        _add_textbox(
            slide,
            left=7.9,
            top=2.65,
            width=3.8,
            height=1.8,
            text=caption,
            font_size=15,
            color=BODY,
        )
    if attribution:
        _add_textbox(
            slide,
            left=7.9,
            top=4.98,
            width=3.8,
            height=0.42,
            text=attribution,
            font_size=11,
            color=MUTED,
        )


def _render_appendix_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _clear_bound_slot(slide, binding, slot="title")
    _clear_bound_slot(slide, binding, slot="subtitle")
    _clear_bound_slot(slide, binding, slot="body")
    _clear_bound_slot(slide, binding, slot="items")
    _clear_bound_slot(slide, binding, slot="references")
    _add_textbox(
        slide,
        left=0.72,
        top=0.72,
        width=2.2,
        height=0.3,
        text="Appendix",
        font_size=12,
        color=MUTED,
        bold=True,
    )
    _add_textbox(
        slide,
        left=0.72,
        top=1.05,
        width=8.2,
        height=0.72,
        text=str(slide_spec.get("title", "")).strip(),
        font_size=32,
        color=INK,
        bold=True,
    )
    _add_rule(slide, left=0.72, top=1.92, width=11.6)
    body = str(slide_spec.get("body", "")).strip()
    if body:
        _add_textbox(
            slide,
            left=0.72,
            top=2.18,
            width=5.2,
            height=0.9,
            text=body,
            font_size=13,
            color=BODY,
        )
    items = _list_strings(slide_spec.get("items", [])) if isinstance(slide_spec.get("items"), list) else []
    refs = _list_strings(slide_spec.get("references", [])) if isinstance(slide_spec.get("references"), list) else []
    if items:
        _add_textbox(slide, left=0.72, top=3.2, width=2.0, height=0.3, text="Backup points", font_size=12, color=MUTED, bold=True)
        for index, item in enumerate(items[:4]):
            y = 3.58 + index * 0.72
            _add_textbox(
                slide,
                left=0.72,
                top=y,
                width=0.42,
                height=0.3,
                text=f"{index + 1:02d}",
                font_size=11,
                color=MUTED,
                bold=True,
            )
            _add_textbox(
                slide,
                left=1.22,
                top=y - 0.02,
                width=4.95,
                height=0.45,
                text=item,
                font_size=14,
                color=INK,
            )
            _add_rule(slide, left=1.22, top=y + 0.42, width=4.65)
    if refs:
        _add_textbox(slide, left=6.7, top=3.2, width=2.0, height=0.3, text="References", font_size=12, color=MUTED, bold=True)
        _add_list_box(
            slide,
            left=6.7,
            top=3.58,
            width=5.0,
            height=2.35,
            items=refs[:6],
            font_size=12,
            color=BODY,
        )


def _render_eol_notice_custom(slide: Any, slide_spec: dict[str, Any], binding: dict[str, Any]) -> None:
    _render_title_and_subtitle(slide, slide_spec, binding)
    for slot in ("product_name", "end_of_sale", "end_of_support", "replacement", "actions"):
        _clear_bound_slot(slide, binding, slot=slot)
    _add_card_surface(slide, left=0.82, top=2.02, width=11.55, height=4.95)
    _add_textbox(slide, left=1.16, top=2.34, width=1.3, height=0.25, text="Product", font_size=11, color=MUTED, bold=True)
    _add_textbox(
        slide,
        left=1.16,
        top=2.62,
        width=5.6,
        height=0.5,
        text=str(slide_spec.get("product_name", "")).strip(),
        font_size=24,
        color=INK,
        bold=True,
    )
    rows = [
        ("End of sale", str(slide_spec.get("end_of_sale", "")).strip()),
        ("End of support", str(slide_spec.get("end_of_support", "")).strip()),
        ("Replacement", str(slide_spec.get("replacement", "")).strip()),
    ]
    row_top = 3.45
    for index, (label, value) in enumerate(rows):
        if not value:
            continue
        y = row_top + index * 0.76
        _add_rule(slide, left=1.16, top=y - 0.12, width=10.85)
        _add_textbox(slide, left=1.16, top=y, width=2.1, height=0.28, text=label, font_size=11, color=MUTED, bold=True)
        _add_textbox(slide, left=3.15, top=y - 0.03, width=6.1, height=0.34, text=value, font_size=14, color=INK)
    actions = _list_strings(slide_spec.get("actions", [])) if isinstance(slide_spec.get("actions"), list) else []
    if actions:
        _add_shape(
            slide,
            MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
            left=8.92,
            top=3.15,
            width=2.65,
            height=2.35,
            fill_rgb=SURFACE,
            line_rgb=SUBTLE_ACCENT,
            rounded_radius=0.08,
        )
        _add_textbox(slide, left=9.15, top=3.37, width=2.2, height=0.24, text="Actions", font_size=11, color=MUTED, bold=True)
        _add_list_box(slide, left=9.15, top=3.68, width=2.15, height=1.55, items=actions[:4], font_size=11, color=BODY)


SPECIAL_LAYOUT_RENDERERS: dict[str, Callable[[Any, dict[str, Any], dict[str, Any]], None]] = {
    "appendix_backup": _render_appendix_custom,
    "comparison_2col": _render_comparison_2col_custom,
    "eol_notice": _render_eol_notice_custom,
    "image_caption": _render_image_caption_custom,
    "kpi_big_number": _render_kpi_custom,
    "list_basic": _render_list_basic_custom,
    "three_cards_horizontal": _render_three_cards_custom,
    "three_cards_vertical": _render_three_cards_custom,
    "timeline": _render_timeline_custom,
}


def render_pptx(template_bytes: bytes, manifest: dict[str, Any], deck: dict[str, Any]) -> bytes:
    if manifest.get("template_fingerprint") != template_fingerprint(template_bytes):
        raise DomainError(
            "TEMPLATE_FINGERPRINT_MISMATCH",
            "Manifest fingerprint does not match template",
            {"expected": manifest.get("template_fingerprint"), "actual": template_fingerprint(template_bytes)},
        )
    validation = validate_deck(deck, manifest)
    if not validation["valid"]:
        raise DomainError("DECK_SCHEMA_INVALID", "Deck validation failed", {"issues": validation["issues"]})

    try:
        prs = Presentation(BytesIO(normalize_template_for_python_pptx(template_bytes)))
    except Exception as exc:
        raise DomainError("TEMPLATE_OPEN_FAILED", "Unable to open template as a PowerPoint file") from exc

    clear_existing_slides(prs)
    for slide_spec in deck["slides"]:
        layout_name = manifest["layouts"][slide_spec["layout"]]["ppt_layout_name"]
        layout = find_layout_by_name(prs, layout_name)
        if layout is None:
            raise DomainError("PPT_LAYOUT_NOT_FOUND", "PowerPoint layout not found", {"layout": slide_spec["layout"], "ppt_layout_name": layout_name})
        if isinstance(layout, list):
            raise DomainError("DUPLICATE_LAYOUT_NAME", "PowerPoint layout name is duplicated", {"ppt_layout_name": layout_name})
        slide = prs.slides.add_slide(layout)
        binding = manifest["layouts"][slide_spec["layout"]]
        custom_renderer = SPECIAL_LAYOUT_RENDERERS.get(slide_spec["layout"])
        if custom_renderer is not None:
            custom_renderer(slide, slide_spec, binding)
        else:
            _render_slide(slide, slide_spec, binding)

    output = BytesIO()
    prs.save(output)
    return output.getvalue()
