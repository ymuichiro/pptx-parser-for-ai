from __future__ import annotations

from io import BytesIO
from typing import Any

from pptx import Presentation

from pptx_yaml_engine.mapper.service import inspect_template, validate_manifest
from pptx_yaml_engine.output.service import render_pptx
from tests.conftest import full_deck, make_potx_bytes


def test_inspect_finalize_render_all_layouts(template_bytes: bytes, template_manifest: dict[str, Any]) -> None:
    inspection = inspect_template(template_bytes)
    assert inspection["template_fingerprint"] == template_manifest["template_fingerprint"]
    manifest_report = validate_manifest(template_bytes, template_manifest)
    assert manifest_report["valid"], manifest_report["issues"]

    output = render_pptx(template_bytes, template_manifest, full_deck())
    prs = Presentation(BytesIO(output))
    assert len(prs.slides) == 15
    texts = "\n".join(shape.text for slide in prs.slides for shape in slide.shapes if hasattr(shape, "text"))
    assert "Cover" in texts
    assert "Legacy API" in texts


def test_potx_template_bytes_are_accepted() -> None:
    inspection = inspect_template(make_potx_bytes())
    assert inspection["layouts"]
