from __future__ import annotations

from typing import Any

from pptx_yaml_engine.errors import DomainError, error_dict
from pptx_yaml_engine.icons.registry import resolve_icon
from pptx_yaml_engine.layouts import LAYOUT_SPECS

ROOT_KEYS = {"version", "meta", "slides"}


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _check_unknown_keys(value: dict[str, Any], allowed: set[str], path: str, issues: list[dict[str, Any]]) -> None:
    for key in sorted(set(value) - allowed):
        issues.append(error_dict("DECK_SCHEMA_INVALID", f"Unknown field '{key}'", {"path": f"{path}.{key}", "allowed": sorted(allowed)}))


def _check_title(slide: dict[str, Any], issues: list[dict[str, Any]], index: int) -> None:
    if not _is_non_empty_string(slide.get("title")):
        issues.append(error_dict("REQUIRED_SLOT_MISSING", "Slide title is required", {"slide_index": index, "slot": "title"}))


def _check_items(value: Any, path: str, issues: list[dict[str, Any]]) -> None:
    if not isinstance(value, list) or not value:
        issues.append(error_dict("DECK_SCHEMA_INVALID", f"{path} must be a non-empty array", {"path": path}))
        return
    for idx, item in enumerate(value):
        if isinstance(item, str):
            if not item:
                issues.append(error_dict("DECK_SCHEMA_INVALID", "List item cannot be empty", {"path": f"{path}[{idx}]"}))
        elif isinstance(item, dict):
            _check_unknown_keys(item, {"text", "level"}, f"{path}[{idx}]", issues)
            if not _is_non_empty_string(item.get("text")):
                issues.append(error_dict("DECK_SCHEMA_INVALID", "List item.text is required", {"path": f"{path}[{idx}].text"}))
        else:
            issues.append(error_dict("DECK_SCHEMA_INVALID", "List item must be string or object", {"path": f"{path}[{idx}]"}))


def _check_icon(value: Any, path: str, issues: list[dict[str, Any]]) -> None:
    try:
        resolve_icon(value, target_px=32)
    except DomainError as exc:
        issue = exc.to_dict()
        issue["details"] = {**issue["details"], "path": path}
        issues.append(issue)


def _check_table(value: Any, path: str, issues: list[dict[str, Any]]) -> None:
    if not isinstance(value, dict):
        issues.append(error_dict("DECK_SCHEMA_INVALID", "table must be an object", {"path": path}))
        return
    _check_unknown_keys(value, {"headers", "rows"}, path, issues)
    headers = value.get("headers")
    rows = value.get("rows")
    if not isinstance(headers, list) or not headers:
        issues.append(error_dict("DECK_SCHEMA_INVALID", "table.headers must be a non-empty array", {"path": f"{path}.headers"}))
        return
    if not isinstance(rows, list):
        issues.append(error_dict("DECK_SCHEMA_INVALID", "table.rows must be an array", {"path": f"{path}.rows"}))
        return
    width = len(headers)
    for row_idx, row in enumerate(rows):
        if not isinstance(row, list) or len(row) != width:
            issues.append(error_dict("TABLE_DIMENSION_INVALID", "Each table row must match header length", {"path": f"{path}.rows[{row_idx}]", "expected": width}))


def _check_chart(value: Any, path: str, issues: list[dict[str, Any]]) -> None:
    if not isinstance(value, dict):
        issues.append(error_dict("DECK_SCHEMA_INVALID", "chart must be an object", {"path": path}))
        return
    _check_unknown_keys(value, {"kind", "categories", "series"}, path, issues)
    if value.get("kind") not in {"bar", "column", "line", "pie"}:
        issues.append(error_dict("CHART_DATA_INVALID", "chart.kind must be bar, column, line, or pie", {"path": f"{path}.kind"}))
    categories = value.get("categories")
    series = value.get("series")
    if not isinstance(categories, list) or not categories:
        issues.append(error_dict("CHART_DATA_INVALID", "chart.categories must be a non-empty array", {"path": f"{path}.categories"}))
        return
    if not isinstance(series, list) or not series:
        issues.append(error_dict("CHART_DATA_INVALID", "chart.series must be a non-empty array", {"path": f"{path}.series"}))
        return
    for series_idx, item in enumerate(series):
        if not isinstance(item, dict) or not _is_non_empty_string(item.get("name")) or not isinstance(item.get("values"), list):
            issues.append(error_dict("CHART_DATA_INVALID", "chart.series item requires name and values", {"path": f"{path}.series[{series_idx}]"}))
            continue
        if len(item["values"]) != len(categories):
            issues.append(error_dict("CHART_DATA_INVALID", "chart series values must match category length", {"path": f"{path}.series[{series_idx}].values"}))


def _check_cards(slide: dict[str, Any], issues: list[dict[str, Any]], index: int) -> None:
    cards = slide.get("cards")
    if not isinstance(cards, list) or len(cards) != 3:
        issues.append(error_dict("DECK_SCHEMA_INVALID", "cards must contain exactly 3 items", {"slide_index": index, "path": "cards"}))
        return
    for card_idx, card in enumerate(cards):
        if not isinstance(card, dict):
            issues.append(error_dict("DECK_SCHEMA_INVALID", "card must be an object", {"slide_index": index, "path": f"cards[{card_idx}]"}))
            continue
        _check_unknown_keys(card, {"title", "description", "icon"}, f"slides[{index}].cards[{card_idx}]", issues)
        for field in ("title", "description"):
            if not _is_non_empty_string(card.get(field)):
                issues.append(error_dict("REQUIRED_SLOT_MISSING", f"card.{field} is required", {"slide_index": index, "slot": f"cards[{card_idx}].{field}"}))
        if "icon" in card:
            _check_icon(card["icon"], f"slides[{index}].cards[{card_idx}].icon", issues)


def _check_comparison(slide: dict[str, Any], issues: list[dict[str, Any]], index: int) -> None:
    for side in ("left", "right"):
        value = slide.get(side)
        if not isinstance(value, dict):
            issues.append(error_dict("REQUIRED_SLOT_MISSING", f"{side} object is required", {"slide_index": index, "slot": side}))
            continue
        _check_unknown_keys(value, {"title", "description", "bullets", "icon"}, f"slides[{index}].{side}", issues)
        for field in ("title", "description"):
            if not _is_non_empty_string(value.get(field)):
                issues.append(error_dict("REQUIRED_SLOT_MISSING", f"{side}.{field} is required", {"slide_index": index, "slot": f"{side}.{field}"}))
        if "bullets" in value:
            _check_items(value["bullets"], f"slides[{index}].{side}.bullets", issues)
        if "icon" in value:
            _check_icon(value["icon"], f"slides[{index}].{side}.icon", issues)


def _check_slide(slide: Any, index: int, manifest: dict[str, Any] | None, issues: list[dict[str, Any]]) -> None:
    if not isinstance(slide, dict):
        issues.append(error_dict("DECK_SCHEMA_INVALID", "slide must be an object", {"slide_index": index}))
        return
    if "type" in slide:
        issues.append(error_dict("DECK_SCHEMA_INVALID", "Use 'layout'; 'type' is not accepted", {"slide_index": index, "path": "type"}))
    layout = slide.get("layout")
    if layout not in LAYOUT_SPECS:
        issues.append(error_dict("SEMANTIC_LAYOUT_NOT_FOUND", "Unknown slide layout", {"slide_index": index, "layout": layout}))
        return
    if manifest is not None and layout not in manifest.get("layouts", {}):
        issues.append(error_dict("SEMANTIC_LAYOUT_NOT_FOUND", "Layout is not present in manifest", {"slide_index": index, "layout": layout}))

    common = {"layout", "id", "title", "subtitle"}
    allowed_by_layout = {
        "cover_title": common | {"date", "organization", "author"},
        "section_divider": common | {"section_no"},
        "agenda": common | {"items"},
        "list_basic": common | {"items", "list_style"},
        "table_basic": common | {"table", "caption"},
        "comparison_2col": common | {"left", "right"},
        "three_cards_vertical": common | {"cards"},
        "closing_end": common | {"message", "contact", "cta"},
        "chart_basic": common | {"chart", "caption"},
        "image_caption": common | {"icon", "caption", "attribution"},
        "appendix_backup": common | {"body", "items", "references"},
    }
    _check_unknown_keys(slide, allowed_by_layout[layout], f"slides[{index}]", issues)
    _check_title(slide, issues, index)

    if layout == "cover_title" and not _is_non_empty_string(slide.get("subtitle")):
        issues.append(error_dict("REQUIRED_SLOT_MISSING", "subtitle is required", {"slide_index": index, "slot": "subtitle"}))
    elif layout in {"agenda", "list_basic"}:
        _check_items(slide.get("items"), f"slides[{index}].items", issues)
    elif layout == "table_basic":
        _check_table(slide.get("table"), f"slides[{index}].table", issues)
    elif layout == "chart_basic":
        _check_chart(slide.get("chart"), f"slides[{index}].chart", issues)
    elif layout == "comparison_2col":
        _check_comparison(slide, issues, index)
    elif layout in {"three_cards_vertical"}:
        _check_cards(slide, issues, index)
    elif layout == "image_caption":
        if "icon" not in slide:
            issues.append(error_dict("REQUIRED_SLOT_MISSING", "icon is required", {"slide_index": index, "slot": "icon"}))
        else:
            _check_icon(slide["icon"], f"slides[{index}].icon", issues)
    elif layout == "appendix_backup":
        for field in ("items", "references"):
            if field in slide:
                _check_items(slide[field], f"slides[{index}].{field}", issues)


def validate_deck(deck: dict[str, Any], manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    if not isinstance(deck, dict):
        raise DomainError("DECK_SCHEMA_INVALID", "deck must be an object")
    _check_unknown_keys(deck, ROOT_KEYS, "deck", issues)
    if deck.get("version") != 1:
        issues.append(error_dict("DECK_SCHEMA_INVALID", "version must be 1", {"path": "version"}))
    if "meta" in deck and not isinstance(deck["meta"], dict):
        issues.append(error_dict("DECK_SCHEMA_INVALID", "meta must be an object", {"path": "meta"}))
    slides = deck.get("slides")
    if not isinstance(slides, list) or not slides:
        issues.append(error_dict("DECK_SCHEMA_INVALID", "slides must be a non-empty array", {"path": "slides"}))
    else:
        for index, slide in enumerate(slides):
            _check_slide(slide, index, manifest, issues)
    return {"valid": not issues, "issues": issues}
