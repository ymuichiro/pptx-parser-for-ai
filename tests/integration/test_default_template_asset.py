from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

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
    assert "1" in list_texts
    assert "A" in list_texts
    assert "B" in list_texts

    comparison_texts = _slide_texts(prs.slides[5])
    assert "Old" in comparison_texts
    assert "Before" in comparison_texts
    assert "New" in comparison_texts
    assert "After" in comparison_texts
    assert "Old\nBefore" not in comparison_texts

    timeline_texts = _slide_texts(prs.slides[8])
    assert "Q1" in timeline_texts
    assert "Plan" in timeline_texts
    assert "Start" in timeline_texts
    assert any(shape.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE for shape in prs.slides[8].shapes)

    kpi_texts = _slide_texts(prs.slides[10])
    assert "42" in kpi_texts
    assert "Customers" in kpi_texts
    assert "42\nCustomers" not in kpi_texts

    image_slide = prs.slides[12]
    image_texts = _slide_texts(image_slide)
    assert "Icon" in image_texts
    assert any(shape.shape_type == MSO_SHAPE_TYPE.PICTURE for shape in image_slide.shapes)

    appendix_texts = _slide_texts(prs.slides[13])
    assert "Appendix" in appendix_texts

    eol_texts = _slide_texts(prs.slides[14])
    assert "Product" in eol_texts
    assert "Legacy API" in eol_texts
