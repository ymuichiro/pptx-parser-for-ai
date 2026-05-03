#!/usr/bin/env python3
"""
Create templates/default.pptx and templates/default.manifest.json from the
hand-authored source template.

This script intentionally preserves the user's slide master and child-layout
styling as-is. It only performs package-level layout maintenance:

1. Replace the unsupported vertical-text built-ins with custom card layouts.
2. Keep layout typography inheriting from the source template.
3. Regenerate the manifest from the final PPTX bytes.
"""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from pptx_yaml_engine.mapper.service import finalize_manifest, inspect_template, propose_mapping  # noqa: E402, I001

TEMPLATES_DIR = ROOT / "templates"
SOURCE_PPTX = ROOT / "template_sources" / "default.source.pptx"
PPTX_OUT = TEMPLATES_DIR / "default.pptx"
JSON_OUT = TEMPLATES_DIR / "default.manifest.json"

PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"

NS = {"p": PML_NS, "a": A_NS}

SLIDE_WIDTH_EMU = 12192000
SLIDE_HEIGHT_EMU = 6858000


def _q(namespace: str, tag: str) -> str:
    return f"{{{namespace}}}{tag}"


def _layout_xml(name: str, *, title_top: float, title_height: float, cards: list[tuple[float, float, float, float]]) -> etree._Element:
    with ZipFile(SOURCE_PPTX) as zin:
        base_root = etree.fromstring(zin.read("ppt/slideLayouts/slideLayout4.xml"))
        target_root = etree.fromstring(zin.read("ppt/slideLayouts/slideLayout10.xml" if name == "three_cards_horizontal" else "ppt/slideLayouts/slideLayout11.xml"))

    root = deepcopy(base_root)
    root.set("type", "cust")

    c_sld = root.find("p:cSld", NS)
    if c_sld is None:
        raise RuntimeError("slide layout is missing p:cSld")
    c_sld.set("name", name)

    clone_ext = c_sld.find("p:extLst", NS)
    if clone_ext is not None:
        c_sld.remove(clone_ext)
    target_ext = target_root.find("p:cSld/p:extLst", NS)
    if target_ext is not None:
        c_sld.append(deepcopy(target_ext))

    sp_tree = c_sld.find("p:spTree", NS)
    if sp_tree is None:
        raise RuntimeError("slide layout is missing p:spTree")

    title_shape = None
    object_shapes: list[etree._Element] = []
    for sp in sp_tree.findall("p:sp", NS):
        ph = sp.find("p:nvSpPr/p:nvPr/p:ph", NS)
        if ph is None:
            continue
        if ph.get("type") == "title":
            title_shape = sp
        elif ph.get("idx") in {"13", "14"}:
            object_shapes.append(sp)

    if title_shape is None or len(object_shapes) != 2:
        raise RuntimeError("two-content base layout does not have the expected placeholders")

    object_shapes.sort(key=lambda sp: int(sp.find("p:nvSpPr/p:nvPr/p:ph", NS).get("idx", "0")))
    third_shape = deepcopy(object_shapes[-1])

    max_shape_id = max(
        int(c_nv_pr.get("id", "0"))
        for c_nv_pr in sp_tree.xpath(".//p:cNvPr", namespaces=NS)
    )
    third_c_nv_pr = third_shape.find("p:nvSpPr/p:cNvPr", NS)
    if third_c_nv_pr is None:
        raise RuntimeError("cloned placeholder is missing p:cNvPr")
    third_c_nv_pr.set("id", str(max_shape_id + 1))
    third_c_nv_pr.set("name", "コンテンツ プレースホルダー 16")
    third_ph = third_shape.find("p:nvSpPr/p:nvPr/p:ph", NS)
    if third_ph is None:
        raise RuntimeError("cloned placeholder is missing p:ph")
    third_ph.set("idx", "15")
    sp_tree.insert(sp_tree.index(object_shapes[-1]) + 1, third_shape)

    all_object_shapes = object_shapes + [third_shape]

    _set_geometry(title_shape, left=0.019, top=title_top, width=0.962, height=title_height)

    for shape, (left, top, width, height) in zip(all_object_shapes, cards, strict=True):
        _set_geometry(shape, left=left, top=top, width=width, height=height)

    return root


def _set_geometry(shape: etree._Element, *, left: float, top: float, width: float, height: float) -> None:
    xfrm = shape.find("p:spPr/a:xfrm", NS)
    if xfrm is None:
        sp_pr = shape.find("p:spPr", NS)
        if sp_pr is None:
            raise RuntimeError("shape is missing p:spPr")
        xfrm = etree.SubElement(sp_pr, _q(A_NS, "xfrm"))
        etree.SubElement(xfrm, _q(A_NS, "off"))
        etree.SubElement(xfrm, _q(A_NS, "ext"))
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    if off is None or ext is None:
        raise RuntimeError("shape xfrm is incomplete")

    off.set("x", str(int(round(left * SLIDE_WIDTH_EMU))))
    off.set("y", str(int(round(top * SLIDE_HEIGHT_EMU))))
    ext.set("cx", str(int(round(width * SLIDE_WIDTH_EMU))))
    ext.set("cy", str(int(round(height * SLIDE_HEIGHT_EMU))))


def build_template() -> bytes:
    if not SOURCE_PPTX.exists():
        raise FileNotFoundError(f"Missing source template: {SOURCE_PPTX}")

    horizontal_cards = [
        (0.019, 0.163, 0.308, 0.731),
        (0.346, 0.163, 0.308, 0.731),
        (0.673, 0.163, 0.308, 0.731),
    ]
    vertical_cards = [
        (0.019, 0.163, 0.962, 0.214),
        (0.019, 0.421, 0.962, 0.214),
        (0.019, 0.679, 0.962, 0.214),
    ]

    replacement_layouts = {
        "ppt/slideLayouts/slideLayout10.xml": _layout_xml(
            "three_cards_horizontal",
            title_top=0.032,
            title_height=0.094,
            cards=horizontal_cards,
        ),
        "ppt/slideLayouts/slideLayout11.xml": _layout_xml(
            "three_cards_vertical",
            title_top=0.032,
            title_height=0.094,
            cards=vertical_cards,
        ),
    }

    output = BytesIO()
    with ZipFile(SOURCE_PPTX, "r") as zin, ZipFile(output, "w", ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in replacement_layouts:
                xml = etree.tostring(
                    replacement_layouts[item.filename],
                    xml_declaration=True,
                    encoding="UTF-8",
                    standalone="yes",
                )
                zout.writestr(item, xml)
                continue
            zout.writestr(item, zin.read(item.filename))
    return output.getvalue()


def build_manifest(template_bytes: bytes) -> dict:
    inspection = inspect_template(template_bytes)
    proposal = propose_mapping(inspection)
    return finalize_manifest(inspection, proposal)


def main() -> None:
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

    template_bytes = build_template()
    PPTX_OUT.write_bytes(template_bytes)

    manifest = build_manifest(template_bytes)
    JSON_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

    print(f"Saved {PPTX_OUT.relative_to(ROOT)}")
    print(f"Saved {JSON_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
