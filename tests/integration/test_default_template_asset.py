from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pptx import Presentation

from pptx_yaml_engine.layouts import LAYOUT_SPECS
from pptx_yaml_engine.mapper.service import generate_manifest, inspect_template, validate_manifest
from pptx_yaml_engine.output.service import render_pptx
from pptx_yaml_engine.server.template_registry import TemplateRegistry
from tests.conftest import full_deck

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEMPLATE_PATH = ROOT / "templates" / "default.pptx"


def _slide_texts(slide: object) -> list[str]:
    return [
        shape.text.strip()
        for shape in getattr(slide, "shapes", [])
        if hasattr(shape, "text") and shape.text.strip()
    ]


def test_repo_default_template_loads_via_registry() -> None:
    registry = TemplateRegistry(str(ROOT / "templates"))
    warnings = registry.load()

    assert warnings == []
    entry = registry.get_default()
    assert entry is not None
    assert entry.name == "default"
    assert sorted(entry.supported_layouts) == sorted(LAYOUT_SPECS.keys())


def test_repo_default_template_manifest_is_valid() -> None:
    template_bytes = DEFAULT_TEMPLATE_PATH.read_bytes()
    manifest = generate_manifest(template_bytes)
    report = validate_manifest(template_bytes, manifest)

    assert set(manifest["layouts"].keys()) == set(LAYOUT_SPECS.keys())
    assert report["valid"], report["issues"]


def test_repo_default_template_replaces_vertical_text_layouts_with_custom_card_layouts() -> None:
    template_bytes = DEFAULT_TEMPLATE_PATH.read_bytes()
    inspection = inspect_template(template_bytes)
    layout_names = [layout["layout_name"] for layout in inspection["layouts"]]

    assert "Title and Vertical Text" not in layout_names
    assert "Vertical Title and Text" not in layout_names
    assert "three_cards_horizontal" in layout_names
    assert "three_cards_vertical" in layout_names


def test_repo_default_template_renders_full_deck() -> None:
    template_bytes = DEFAULT_TEMPLATE_PATH.read_bytes()
    manifest = generate_manifest(template_bytes)

    output = render_pptx(template_bytes, manifest, full_deck())
    prs = Presentation(BytesIO(output))

    assert len(prs.slides) == len(full_deck()["slides"])
    texts = "\n".join(shape.text for slide in prs.slides for shape in slide.shapes if hasattr(shape, "text"))
    assert "Fixture Deck" not in texts
    assert "Cover" in texts
    assert "Legacy API" in texts


def test_repo_default_template_special_layouts_render_structured_content() -> None:
    template_bytes = DEFAULT_TEMPLATE_PATH.read_bytes()
    manifest = generate_manifest(template_bytes)

    output = render_pptx(template_bytes, manifest, full_deck())
    prs = Presentation(BytesIO(output))

    list_texts = _slide_texts(prs.slides[3])
    list_combined = "\n".join(list_texts)
    assert "A" in list_combined
    assert "B" in list_combined
    assert "1" not in list_texts

    comparison_texts = _slide_texts(prs.slides[5])
    comparison_combined = "\n".join(comparison_texts)
    assert "Old" in comparison_texts
    assert "Before" in comparison_combined
    assert "New" in comparison_texts
    assert "After" in comparison_combined
    assert "Old\nBefore" not in comparison_texts
    assert prs.slides[5].placeholders[1].text.strip() == "Old"
    assert prs.slides[5].placeholders[13].text.strip() == "Before"
    assert prs.slides[5].placeholders[3].text.strip() == "New"
    assert prs.slides[5].placeholders[14].text.strip() == "After"
    assert all(getattr(shape, "is_placeholder", False) for shape in prs.slides[5].shapes)

    cards_v = prs.slides[6]
    cards_v_texts = "\n".join(_slide_texts(cards_v))
    assert "A" in cards_v_texts
    assert "AA" in cards_v_texts
    assert "B" in cards_v_texts
    assert "BB" in cards_v_texts
    assert "C" in cards_v_texts
    assert "CC" in cards_v_texts
    assert cards_v.placeholders[13].text.strip() == "A\nAA"
    assert cards_v.placeholders[14].text.strip() == "B\nBB"
    assert cards_v.placeholders[15].text.strip() == "C\nCC"
    assert all(getattr(shape, "is_placeholder", False) for shape in cards_v.shapes)

    cards_h = prs.slides[7]
    cards_h_texts = "\n".join(_slide_texts(cards_h))
    assert "A" in cards_h_texts
    assert "AA" in cards_h_texts
    assert "B" in cards_h_texts
    assert "BB" in cards_h_texts
    assert "C" in cards_h_texts
    assert "CC" in cards_h_texts
    assert cards_h.placeholders[13].text.strip() == "A\nAA"
    assert cards_h.placeholders[14].text.strip() == "B\nBB"
    assert cards_h.placeholders[15].text.strip() == "C\nCC"
    assert all(getattr(shape, "is_placeholder", False) for shape in cards_h.shapes)

    timeline_texts = _slide_texts(prs.slides[8])
    timeline_combined = "\n".join(timeline_texts)
    assert "Q1" in timeline_combined
    assert "Plan" in timeline_combined
    assert "Start" in timeline_combined
    assert prs.slides[8].placeholders[13].text.strip() == "Q1\nPlan\nStart"
    assert all(getattr(shape, "is_placeholder", False) for shape in prs.slides[8].shapes)

    kpi_texts = _slide_texts(prs.slides[10])
    kpi_combined = "\n".join(kpi_texts)
    assert "42" in kpi_combined
    assert "Customers" in kpi_combined
    assert "42\nCustomers" in kpi_combined

    image_slide = prs.slides[12]
    image_texts = _slide_texts(image_slide)
    assert "Icon" in image_texts
    assert any(shape.placeholder_format.idx == 1 for shape in image_slide.placeholders)

    appendix_texts = _slide_texts(prs.slides[13])
    assert "Appendix" in appendix_texts

    eol_texts = _slide_texts(prs.slides[14])
    eol_combined = "\n".join(eol_texts)
    assert "Legacy API" in eol_combined
    assert "Migrate" in eol_combined
