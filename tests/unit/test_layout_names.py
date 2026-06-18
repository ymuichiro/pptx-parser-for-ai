from __future__ import annotations

from types import SimpleNamespace

from pptx_yaml_engine.utils.layout_names import (
    canonical_builtin_layout_name,
    layout_names_match,
    normalize_layout_lookup_name,
)
from pptx_yaml_engine.utils.pptx import find_layout_by_name


def test_canonical_builtin_layout_name_maps_japanese_name_to_english_key() -> None:
    assert canonical_builtin_layout_name("タイトルとコンテンツ") == "title_and_content"
    assert canonical_builtin_layout_name("タイトル スライド") == "title_slide"


def test_normalize_layout_lookup_name_preserves_custom_layout_names() -> None:
    assert normalize_layout_lookup_name(" YAML__Custom Layout ") == "custom_layout"


def test_layout_names_match_treats_english_and_japanese_builtin_names_as_equal() -> None:
    assert layout_names_match("Title and Content", "タイトルとコンテンツ")
    assert layout_names_match("Title Slide", "タイトル スライド")


def test_find_layout_by_name_resolves_localized_builtin_name_from_english_lookup() -> None:
    localized_layout = SimpleNamespace(name="タイトルとコンテンツ")
    prs = SimpleNamespace(slide_layouts=[localized_layout])

    assert find_layout_by_name(prs, "Title and Content") is localized_layout
