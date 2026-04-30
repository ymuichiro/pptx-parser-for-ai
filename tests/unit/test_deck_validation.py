from __future__ import annotations

from typing import Any

from pptx_yaml_engine.output.validation import validate_deck


def test_rejects_type_alias(template_manifest: dict[str, Any]) -> None:
    result = validate_deck(
        {"version": 1, "slides": [{"type": "cover_title", "title": "Bad", "subtitle": "No"}]},
        template_manifest,
    )
    assert not result["valid"]
    assert any(issue["code"] == "DECK_SCHEMA_INVALID" for issue in result["issues"])


def test_rejects_arbitrary_image_path(template_manifest: dict[str, Any]) -> None:
    result = validate_deck(
        {
            "version": 1,
            "slides": [{"layout": "image_caption", "title": "Image", "image": "./local.png"}],
        },
        template_manifest,
    )
    assert not result["valid"]
    assert any(issue["details"].get("path") == "slides[0].image" for issue in result["issues"])


def test_validates_cards_count(template_manifest: dict[str, Any]) -> None:
    result = validate_deck(
        {"version": 1, "slides": [{"layout": "three_cards_vertical", "title": "Cards", "cards": []}]},
        template_manifest,
    )
    assert not result["valid"]
    assert any("cards" in issue["details"].get("path", "") for issue in result["issues"])
