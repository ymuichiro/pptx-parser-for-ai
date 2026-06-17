from __future__ import annotations

from typing import Any

import pytest

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.layouts import LAYOUT_SPECS
from pptx_yaml_engine.mapper.service import (
    finalize_manifest,
    inspect_template,
    propose_mapping,
    validate_manifest_against_inspection,
)
from tests.conftest import make_potx_bytes


def test_inspect_template_accepts_potx_bytes() -> None:
    inspection = inspect_template(make_potx_bytes())
    assert inspection["layouts"]
    assert inspection["template_fingerprint"].startswith("sha256:")


def _shape(
    name: str,
    *,
    idx: int | None = None,
    placeholder_type: str = "BODY",
    is_placeholder: bool = True,
) -> dict[str, Any]:
    shape: dict[str, Any] = {
        "shape_name": name,
        "is_placeholder": is_placeholder,
        "left": 0,
        "top": 0,
        "width": 0,
        "height": 0,
        "norm_left": 0.0,
        "norm_top": 0.0,
        "norm_width": 0.0,
        "norm_height": 0.0,
        "norm_center_x": 0.0,
        "norm_center_y": 0.0,
    }
    if is_placeholder:
        shape["placeholder_idx"] = 0 if idx is None else idx
        shape["placeholder_type"] = placeholder_type
    return shape


def _layout(layout_name: str, *shapes: dict[str, Any]) -> dict[str, Any]:
    return {
        "layout_name": layout_name,
        "shapes": list(shapes),
    }


def _inspection_with_layouts(*layouts: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "template_fingerprint": "sha256:test",
        "slide_width_emu": 12192000,
        "slide_height_emu": 6858000,
        "layouts": [
            {
                "layout_name": layout["layout_name"],
                "layout_index": index,
                "shapes": layout["shapes"],
                "placeholders": [shape for shape in layout["shapes"] if shape.get("is_placeholder")],
            }
            for index, layout in enumerate(layouts)
        ],
    }


def _issue_codes(issues: list[dict[str, Any]]) -> set[str]:
    return {issue["code"] for issue in issues}


def _binding(
    shape_name: str,
    idx: int,
    *,
    kind: str = "text",
    placeholder_type: str = "BODY",
) -> dict[str, Any]:
    return {
        "kind": kind,
        "placeholder": {
            "idx": idx,
            "type": placeholder_type,
            "shape_name": shape_name,
        },
    }


def _manifest(inspection: dict[str, Any], layouts: dict[str, Any]) -> dict[str, Any]:
    return {
        "manifest_version": 1,
        "template_fingerprint": inspection["template_fingerprint"],
        "layouts": layouts,
    }


def test_propose_mapping_binds_ai_names_and_three_column_aliases() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "three_columns",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_COL1_TITLE", idx=1),
            _shape("AI_COL1_BODY", idx=2),
            _shape("AI_COL2_TITLE", idx=3),
            _shape("AI_COL2_BODY", idx=4),
            _shape("AI_COL3_TITLE", idx=5),
            _shape("AI_COL3_BODY", idx=6),
        )
    )

    proposal = propose_mapping(inspection)
    binding = proposal["layouts"]["three_cards_vertical"]

    assert binding["status"] == "ready"
    assert binding["ppt_layout_name"] == "three_columns"
    assert binding["required_missing"] == []
    assert binding["slots"]["title"]["placeholder"]["shape_name"] == "AI_TITLE"
    assert binding["slots"]["cards[0].title"]["placeholder"]["shape_name"] == "AI_COL1_TITLE"
    assert binding["slots"]["cards[0].description"]["placeholder"]["shape_name"] == "AI_COL1_BODY"
    assert binding["slots"]["cards[2].description"]["placeholder"]["shape_name"] == "AI_COL3_BODY"


def test_propose_mapping_requires_explicit_layout_name_match() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "Title and Content",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_BODY", idx=1),
        )
    )

    proposal = propose_mapping(inspection)
    binding = proposal["layouts"]["agenda"]

    assert binding["ppt_layout_name"] is None
    assert binding["status"] == "override_required"
    assert "PPT_LAYOUT_NOT_FOUND" in _issue_codes(binding["issues"])


def test_finalize_manifest_fails_when_required_ai_placeholder_is_missing() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
        )
    )
    proposal = propose_mapping(inspection)
    complete_proposal_layouts = {}
    for semantic, spec in LAYOUT_SPECS.items():
        complete_proposal_layouts[semantic] = {
            "ppt_layout_name": f"{semantic}-layout",
            "match_confidence": 1.0,
            "layout_match": {"strategy": "semantic_name"},
            "slots": {
                slot.path: _binding(f"AI_FAKE_{semantic.upper()}_{index}", index, kind=slot.kind)
                for index, slot in enumerate(spec.slots)
                if slot.required
            },
            "required_missing": [],
            "issues": [],
            "warnings": [],
            "status": "ready",
        }
    complete_proposal_layouts["agenda"] = proposal["layouts"]["agenda"]

    with pytest.raises(DomainError) as exc_info:
        finalize_manifest(
            inspection,
            {
                "version": 1,
                "template_fingerprint": inspection["template_fingerprint"],
                "layouts": complete_proposal_layouts,
            },
        )

    assert exc_info.value.code == "AI_PLACEHOLDER_MISSING"
    assert exc_info.value.details["layout"] == "agenda"
    assert exc_info.value.details["ppt_layout_name"] == "agenda"
    assert exc_info.value.details["missing"] == ["items"]
    assert exc_info.value.details["missing_placeholders"] == [
        {
            "slot": "items",
            "kind": "list",
            "expected_ai_names": ["AI_ITEMS", "AI_BODY", "AI_AGENDA_ITEMS"],
            "compatible_placeholder_types": ["TITLE", "CENTER_TITLE", "SUBTITLE", "BODY", "OBJECT"],
        }
    ]


def test_propose_mapping_reports_duplicate_ai_placeholder_name() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
            _shape("AI_ITEMS", idx=2),
        )
    )

    proposal = propose_mapping(inspection)
    binding = proposal["layouts"]["agenda"]

    assert binding["status"] == "override_required"
    assert binding["required_missing"] == ["items"]
    assert "AI_PLACEHOLDER_DUPLICATED" in _issue_codes(binding["issues"])


def test_propose_mapping_reports_non_placeholder_ai_target() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", is_placeholder=False),
        )
    )

    proposal = propose_mapping(inspection)
    binding = proposal["layouts"]["agenda"]

    assert binding["status"] == "override_required"
    assert binding["required_missing"] == ["items"]
    assert "AI_TARGET_NOT_PLACEHOLDER" in _issue_codes(binding["issues"])


def test_propose_mapping_does_not_bind_legacy_non_ai_shape_names() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("slot__title", idx=0, placeholder_type="TITLE"),
            _shape("slot__items", idx=1),
        )
    )

    proposal = propose_mapping(inspection)
    binding = proposal["layouts"]["agenda"]

    assert binding["status"] == "override_required"
    assert binding["slots"] == {}
    assert binding["required_missing"] == ["title", "items"]
    assert _issue_codes(binding["issues"]) == {"AI_PLACEHOLDER_MISSING"}


def test_validate_manifest_reports_ai_placeholder_idx_mismatch() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
        )
    )
    manifest = _manifest(
        inspection,
        {
            "agenda": {
                "ppt_layout_name": "agenda",
                "match_confidence": 1.0,
                "layout_match": {"strategy": "semantic_name"},
                "slots": {
                    "title": _binding("AI_TITLE", 0, placeholder_type="TITLE"),
                    "items": _binding("AI_ITEMS", 99, kind="list"),
                },
            }
        },
    )

    report = validate_manifest_against_inspection(inspection, manifest)

    assert not report["valid"]
    assert "AI_PLACEHOLDER_IDX_MISMATCH" in _issue_codes(report["issues"])


def test_validate_manifest_fails_when_required_slot_is_missing_from_manifest() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
        )
    )
    manifest = _manifest(
        inspection,
        {
            "agenda": {
                "ppt_layout_name": "agenda",
                "match_confidence": 1.0,
                "layout_match": {"strategy": "semantic_name"},
                "slots": {
                    "title": _binding("AI_TITLE", 0, placeholder_type="TITLE"),
                },
            }
        },
    )

    report = validate_manifest_against_inspection(inspection, manifest)

    assert not report["valid"]
    assert "AI_PLACEHOLDER_MISSING" in _issue_codes(report["issues"])
    assert any(issue["details"].get("missing") == ["items"] for issue in report["issues"])


def test_validate_manifest_fails_when_manifest_omits_semantic_layouts() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
        )
    )
    manifest = _manifest(
        inspection,
        {
            "agenda": {
                "ppt_layout_name": "agenda",
                "match_confidence": 1.0,
                "layout_match": {"strategy": "semantic_name"},
                "slots": {
                    "title": _binding("AI_TITLE", 0, placeholder_type="TITLE"),
                    "items": _binding("AI_ITEMS", 1, kind="list"),
                },
            }
        },
    )

    report = validate_manifest_against_inspection(inspection, manifest)

    assert not report["valid"]
    assert "TEMPLATE_LAYOUT_CONTRACT_MISMATCH" in _issue_codes(report["issues"])
    mismatch_issue = next(
        issue for issue in report["issues"] if issue["code"] == "TEMPLATE_LAYOUT_CONTRACT_MISMATCH"
    )
    assert mismatch_issue["details"]["expected"] == sorted(LAYOUT_SPECS)
    assert mismatch_issue["details"]["actual"] == ["agenda"]
    assert set(mismatch_issue["details"]["missing"]) == set(LAYOUT_SPECS) - {"agenda"}


def test_validate_manifest_fails_on_duplicate_ai_name_not_selected_by_manifest() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
            _shape("AI_SUBTITLE", idx=2),
            _shape("AI_SUBTITLE", idx=3),
        )
    )
    manifest = _manifest(
        inspection,
        {
            "agenda": {
                "ppt_layout_name": "agenda",
                "match_confidence": 1.0,
                "layout_match": {"strategy": "semantic_name"},
                "slots": {
                    "title": _binding("AI_TITLE", 0, placeholder_type="TITLE"),
                    "items": _binding("AI_ITEMS", 1, kind="list"),
                },
            }
        },
    )

    report = validate_manifest_against_inspection(inspection, manifest)

    assert not report["valid"]
    assert "AI_PLACEHOLDER_DUPLICATED" in _issue_codes(report["issues"])
    assert any(issue["details"].get("shape_name") == "AI_SUBTITLE" for issue in report["issues"])


def test_validate_manifest_fails_on_unknown_ai_typo_on_selected_layout() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
            _shape("AI_ITMES", idx=2),
        )
    )
    manifest = _manifest(
        inspection,
        {
            "agenda": {
                "ppt_layout_name": "agenda",
                "match_confidence": 1.0,
                "layout_match": {"strategy": "semantic_name"},
                "slots": {
                    "title": _binding("AI_TITLE", 0, placeholder_type="TITLE"),
                    "items": _binding("AI_ITEMS", 1, kind="list"),
                },
            }
        },
    )

    report = validate_manifest_against_inspection(inspection, manifest)

    assert not report["valid"]
    assert "AI_PLACEHOLDER_UNKNOWN" in _issue_codes(report["issues"])
    assert any(issue["details"].get("shape_name") == "AI_ITMES" for issue in report["issues"])


def test_finalize_manifest_fails_when_proposal_is_missing_semantic_layout() -> None:
    inspection = _inspection_with_layouts(
        _layout(
            "agenda",
            _shape("AI_TITLE", idx=0, placeholder_type="TITLE"),
            _shape("AI_ITEMS", idx=1),
        )
    )
    proposal = propose_mapping(inspection)
    partial_proposal = {
        "version": proposal["version"],
        "template_fingerprint": proposal["template_fingerprint"],
        "layouts": {"agenda": proposal["layouts"]["agenda"]},
    }

    with pytest.raises(DomainError) as exc_info:
        finalize_manifest(inspection, partial_proposal)

    assert exc_info.value.code == "TEMPLATE_LAYOUT_CONTRACT_MISMATCH"
    assert "cover_title" in exc_info.value.details["missing"]
