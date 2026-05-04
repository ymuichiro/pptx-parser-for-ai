from __future__ import annotations

from pptx_yaml_engine.layouts import supported_layouts_response


def test_supported_layouts_response_includes_selection_guidance() -> None:
    response = supported_layouts_response()

    assert "recommendedWorkflow" in response["selectionGuidance"]
    assert "sampleOutline" in response["selectionGuidance"]

    layouts = {layout["name"]: layout for layout in response["layouts"]}
    assert layouts["comparison_2col"]["whenToUse"]
    assert layouts["comparison_2col"]["avoidWhen"]
    assert layouts["three_cards_horizontal"]["whenToUse"]
