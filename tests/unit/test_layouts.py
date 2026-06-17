from __future__ import annotations

from pptx_yaml_engine.layouts import supported_layouts_response


def test_supported_layouts_response_includes_selection_guidance() -> None:
    response = supported_layouts_response()

    assert "recommendedWorkflow" in response["selectionGuidance"]
    assert "sampleOutline" in response["selectionGuidance"]

    layouts = {layout["name"]: layout for layout in response["layouts"]}
    assert layouts["comparison_2col"]["whenToUse"]
    assert layouts["comparison_2col"]["avoidWhen"]
    assert layouts["three_cards_vertical"]["whenToUse"]


def test_supported_layouts_response_includes_template_authoring_contract() -> None:
    response = supported_layouts_response()
    layouts = {layout["name"]: layout for layout in response["layouts"]}

    agenda_items = next(slot for slot in layouts["agenda"]["slots"] if slot["path"] == "items")
    assert agenda_items["aiNames"] == ["AI_ITEMS", "AI_BODY", "AI_AGENDA_ITEMS"]
    assert "OBJECT" in agenda_items["compatiblePlaceholderTypes"]
    assert agenda_items["capacityGuidance"]

    cards_contract = layouts["three_cards_vertical"]["templateAuthoring"]
    assert cards_contract["semanticLayoutName"] == "three_cards_vertical"
    assert "three_cards_vertical" in cards_contract["powerPointLayoutNames"]
    required_names = {
        name
        for slot in cards_contract["requiredAiPlaceholders"]
        for name in slot["aiNames"]
    }
    assert "AI_CARD1_TITLE" in required_names
    assert "AI_COL1_HEADING" in required_names
