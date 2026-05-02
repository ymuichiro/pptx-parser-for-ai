from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from pptx_yaml_engine.utils.layout_names import layout_names_match


def placeholder_type_name(value: Any) -> str:
    name = getattr(value, "name", None)
    if isinstance(name, str):
        return name
    raw = str(value)
    if " " in raw:
        raw = raw.split(" ", 1)[0]
    return raw.upper()


def iter_layout_placeholders(layout: Any) -> Iterable[Any]:
    for shape in layout.shapes:
        if getattr(shape, "is_placeholder", False):
            yield shape


def find_layout_by_name(prs: Any, name: str) -> Any:
    matches = [layout for layout in prs.slide_layouts if layout.name == name]
    if len(matches) == 1:
        return matches[0]
    if not matches:
        matches = [layout for layout in prs.slide_layouts if layout_names_match(str(layout.name), name)]
        if len(matches) == 1:
            return matches[0]
        if not matches:
            return None
    return matches


def clear_existing_slides(prs: Any) -> None:
    slide_id_list = prs.slides._sldIdLst  # noqa: SLF001
    for slide_id in list(slide_id_list):
        rel_id = slide_id.rId
        prs.part.drop_rel(rel_id)
        slide_id_list.remove(slide_id)
