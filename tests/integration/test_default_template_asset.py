from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pptx import Presentation

from pptx_yaml_engine.layouts import LAYOUT_SPECS
from pptx_yaml_engine.mapper.service import generate_manifest, validate_manifest
from pptx_yaml_engine.output.service import render_pptx
from pptx_yaml_engine.server.template_registry import TemplateRegistry
from tests.conftest import full_deck

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEMPLATE_PATH = ROOT / "templates" / "default.pptx"


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
