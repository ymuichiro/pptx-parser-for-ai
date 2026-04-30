from __future__ import annotations

from io import BytesIO
from typing import Any

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.icons.registry import resolve_icon
from pptx_yaml_engine.output.validation import validate_deck as validate_deck
from pptx_yaml_engine.utils.fingerprint import template_fingerprint
from pptx_yaml_engine.utils.pptx import clear_existing_slides, find_layout_by_name
from pptx_yaml_engine.utils.template_bytes import normalize_template_for_python_pptx


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
        _render_slide(slide, slide_spec, manifest["layouts"][slide_spec["layout"]])

    output = BytesIO()
    prs.save(output)
    return output.getvalue()
