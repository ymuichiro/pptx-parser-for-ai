from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from pptx_yaml_engine.mapper.service import generate_manifest
from pptx_yaml_engine.utils.template_bytes import POTX_MAIN_CONTENT_TYPE, PPTX_MAIN_CONTENT_TYPE

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TEMPLATE_PATH = ROOT / "templates" / "default.pptx"


def make_template_bytes() -> bytes:
    return DEFAULT_TEMPLATE_PATH.read_bytes()


def make_potx_bytes() -> bytes:
    source = BytesIO(make_template_bytes())
    output = BytesIO()
    with ZipFile(source, "r") as zin, ZipFile(output, "w", ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "[Content_Types].xml":
                data = data.replace(PPTX_MAIN_CONTENT_TYPE, POTX_MAIN_CONTENT_TYPE)
            zout.writestr(item, data)
    return output.getvalue()


def full_deck() -> dict[str, Any]:
    icon = {"pack": "heroicons", "name": "cloud-arrow-up", "variant": "outline"}
    return {
        "version": 1,
        "meta": {"title": "Fixture Deck", "language": "en"},
        "slides": [
            {"layout": "cover_title", "title": "Cover", "subtitle": "Subtitle"},
            {"layout": "section_divider", "title": "Section"},
            {"layout": "agenda", "title": "Agenda", "items": ["One", "Two"]},
            {"layout": "list_basic", "title": "List", "items": [{"text": "A", "level": 0}, {"text": "B", "level": 1}]},
            {"layout": "table_basic", "title": "Table", "table": {"headers": ["A", "B"], "rows": [[1, 2]]}},
            {
                "layout": "comparison_2col",
                "title": "Compare",
                "left": {"title": "Old", "description": "Before", "icon": icon},
                "right": {"title": "New", "description": "After", "icon": icon},
            },
            {
                "layout": "three_cards_vertical",
                "title": "Cards V",
                "cards": [
                    {"title": "A", "description": "AA", "icon": icon},
                    {"title": "B", "description": "BB", "icon": icon},
                    {"title": "C", "description": "CC", "icon": icon},
                ],
            },
            {"layout": "closing_end", "title": "Thanks"},
            {"layout": "chart_basic", "title": "Chart", "chart": {"kind": "column", "categories": ["Q1", "Q2"], "series": [{"name": "Sales", "values": [10, 12]}]}},
            {"layout": "image_caption", "title": "Icon", "icon": icon},
            {"layout": "appendix_backup", "title": "Appendix", "items": ["Ref"]},
        ],
    }


@pytest.fixture()
def template_bytes() -> bytes:
    return make_template_bytes()


@pytest.fixture()
def template_manifest(template_bytes: bytes) -> dict[str, Any]:
    return generate_manifest(template_bytes)
