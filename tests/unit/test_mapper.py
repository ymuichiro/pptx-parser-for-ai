from __future__ import annotations

from typing import Any

from pptx_yaml_engine.layouts import LAYOUT_SPECS
from pptx_yaml_engine.mapper.service import (
    finalize_manifest,
    inspect_template,
    propose_mapping,
    validate_manifest,
    validate_manifest_against_inspection,
)
from tests.conftest import make_potx_bytes, make_template_bytes


def test_inspect_template_accepts_potx_bytes() -> None:
    inspection = inspect_template(make_potx_bytes())
    assert inspection["layouts"]
    assert inspection["template_fingerprint"].startswith("sha256:")


def test_propose_mapping_standard_template_covers_all_semantics() -> None:
    inspection = inspect_template(make_template_bytes())
    proposal = propose_mapping(inspection)

    assert set(proposal["layouts"].keys()) == set(LAYOUT_SPECS.keys())


def test_finalize_manifest_standard_template_succeeds_without_overrides() -> None:
    template_bytes = make_template_bytes()
    inspection = inspect_template(template_bytes)
    proposal = propose_mapping(inspection)
    manifest = finalize_manifest(inspection, proposal)

    assert set(manifest["layouts"].keys()) == set(LAYOUT_SPECS.keys())
    assert manifest["template_fingerprint"] == inspection["template_fingerprint"]


def test_three_cards_vertical_bindings_follow_top_to_bottom_order() -> None:
    inspection = inspect_template(make_template_bytes())
    manifest = finalize_manifest(inspection, propose_mapping(inspection))

    vertical = manifest["layouts"]["three_cards_vertical"]["slots"]

    assert vertical["cards[0].combined_text"]["placeholder"]["idx"] == 1
    assert vertical["cards[1].combined_text"]["placeholder"]["idx"] == 1
    assert vertical["cards[2].combined_text"]["placeholder"]["idx"] == 2


def test_validate_manifest_reports_unknown_placeholder_idx() -> None:
    template_bytes = make_template_bytes()
    inspection = inspect_template(template_bytes)
    manifest = finalize_manifest(inspection, propose_mapping(inspection))
    manifest["layouts"]["cover_title"]["slots"]["title"]["placeholder"]["idx"] = 999

    report = validate_manifest(template_bytes, manifest)
    assert not report["valid"]
    assert any(issue["code"] == "PLACEHOLDER_IDX_NOT_FOUND" for issue in report["issues"])


def _inspection_with_layout(name: str, placeholders: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "version": 1,
        "template_fingerprint": "sha256:test",
        "slide_width_emu": 12192000,
        "slide_height_emu": 6858000,
        "layouts": [
            {
                "layout_name": name,
                "layout_index": 0,
                "shapes": placeholders,
                "placeholders": placeholders,
            }
        ],
    }


def test_propose_mapping_uses_placeholder_types_not_idx_order_for_title_and_content() -> None:
    inspection = _inspection_with_layout(
        "Title and Content",
        [
            {
                "shape_name": "Content Placeholder 2",
                "is_placeholder": True,
                "placeholder_idx": 4,
                "placeholder_type": "OBJECT",
                "norm_left": 0.2,
                "norm_top": 0.25,
                "norm_width": 0.6,
                "norm_height": 0.5,
                "norm_center_x": 0.5,
                "norm_center_y": 0.5,
            },
            {
                "shape_name": "Title 1",
                "is_placeholder": True,
                "placeholder_idx": 90,
                "placeholder_type": "TITLE",
                "norm_left": 0.1,
                "norm_top": 0.05,
                "norm_width": 0.8,
                "norm_height": 0.1,
                "norm_center_x": 0.5,
                "norm_center_y": 0.1,
            },
        ],
    )

    proposal = propose_mapping(inspection)
    agenda_slots = proposal["layouts"]["agenda"]["slots"]

    assert agenda_slots["title"]["placeholder"]["idx"] == 90
    assert agenda_slots["items"]["placeholder"]["idx"] == 4


def test_propose_mapping_three_cards_vertical_uses_top_to_bottom_geometry_with_irregular_idx_values() -> None:
    inspection = _inspection_with_layout(
        "Two Content",
        [
            {
                "shape_name": "Right Content",
                "is_placeholder": True,
                "placeholder_idx": 99,
                "placeholder_type": "OBJECT",
                "norm_left": 0.55,
                "norm_top": 0.3,
                "norm_width": 0.3,
                "norm_height": 0.4,
                "norm_center_x": 0.75,
                "norm_center_y": 0.5,
            },
            {
                "shape_name": "Title 1",
                "is_placeholder": True,
                "placeholder_idx": 80,
                "placeholder_type": "TITLE",
                "norm_left": 0.1,
                "norm_top": 0.05,
                "norm_width": 0.8,
                "norm_height": 0.1,
                "norm_center_x": 0.5,
                "norm_center_y": 0.1,
            },
            {
                "shape_name": "Left Content",
                "is_placeholder": True,
                "placeholder_idx": 7,
                "placeholder_type": "OBJECT",
                "norm_left": 0.1,
                "norm_top": 0.3,
                "norm_width": 0.3,
                "norm_height": 0.4,
                "norm_center_x": 0.25,
                "norm_center_y": 0.5,
            },
        ],
    )

    proposal = propose_mapping(inspection)
    vertical = proposal["layouts"]["three_cards_vertical"]["slots"]

    assert vertical["cards[0].combined_text"]["placeholder"]["idx"] == 7
    assert vertical["cards[1].combined_text"]["placeholder"]["idx"] == 7
    assert vertical["cards[2].combined_text"]["placeholder"]["idx"] == 99


def test_propose_mapping_normalizes_japanese_builtin_layout_name_to_title_and_content() -> None:
    inspection = _inspection_with_layout(
        "タイトルとコンテンツ",
        [
            {
                "shape_name": "Content Placeholder 2",
                "is_placeholder": True,
                "placeholder_idx": 4,
                "placeholder_type": "OBJECT",
                "norm_left": 0.2,
                "norm_top": 0.25,
                "norm_width": 0.6,
                "norm_height": 0.5,
                "norm_center_x": 0.5,
                "norm_center_y": 0.5,
            },
            {
                "shape_name": "Title 1",
                "is_placeholder": True,
                "placeholder_idx": 90,
                "placeholder_type": "TITLE",
                "norm_left": 0.1,
                "norm_top": 0.05,
                "norm_width": 0.8,
                "norm_height": 0.1,
                "norm_center_x": 0.5,
                "norm_center_y": 0.1,
            },
        ],
    )

    proposal = propose_mapping(inspection)

    assert proposal["layouts"]["agenda"]["ppt_layout_name"] == "タイトルとコンテンツ"
    assert proposal["layouts"]["list_basic"]["ppt_layout_name"] == "タイトルとコンテンツ"


def test_validate_manifest_accepts_english_builtin_layout_name_for_localized_inspection() -> None:
    inspection = _inspection_with_layout(
        "タイトル スライド",
        [
            {
                "shape_name": "Title 1",
                "is_placeholder": True,
                "placeholder_idx": 0,
                "placeholder_type": "TITLE",
                "norm_left": 0.1,
                "norm_top": 0.05,
                "norm_width": 0.8,
                "norm_height": 0.1,
                "norm_center_x": 0.5,
                "norm_center_y": 0.1,
            },
            {
                "shape_name": "Subtitle 2",
                "is_placeholder": True,
                "placeholder_idx": 1,
                "placeholder_type": "SUBTITLE",
                "norm_left": 0.2,
                "norm_top": 0.25,
                "norm_width": 0.6,
                "norm_height": 0.15,
                "norm_center_x": 0.5,
                "norm_center_y": 0.325,
            },
        ],
    )
    manifest = {
        "manifest_version": 1,
        "template_fingerprint": "sha256:test",
        "layouts": {
            "cover_title": {
                "ppt_layout_name": "Title Slide",
                "match_confidence": 0.98,
                "layout_match": {"strategy": "explicit_name"},
                "slots": {
                    "title": {"kind": "text", "placeholder": {"idx": 0, "type": "TITLE", "shape_name": "Title 1"}},
                    "subtitle": {"kind": "text", "placeholder": {"idx": 1, "type": "SUBTITLE", "shape_name": "Subtitle 2"}},
                },
            }
        },
    }

    report = validate_manifest_against_inspection(inspection, manifest)

    assert report["valid"], report["issues"]
