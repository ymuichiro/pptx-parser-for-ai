#!/usr/bin/env python3
"""
Create templates/default.pptx and templates/default.manifest.json from the
hand-authored source template.

This script preserves the user's slide master and child-layout styling and
patches layout geometry/placeholders so the runtime can stay template-driven:

1. Replace unsupported vertical-text built-ins with custom three-card layouts.
2. Add template-side icon placeholders for comparison/card layouts.
3. Add dedicated template layouts for timeline, KPI, and appendix rendering.
4. Regenerate the manifest from the final PPTX bytes.
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

# Enterprise design palette
NAVY = "1C3557"
BLUE = "2E6DA4"
CARD_BG = "E8F2FB"
ACCENT = "E8763A"
DIVIDER = "BFD4EF"
GRAY_LT = "F2F4F7"
WHITE = "FFFFFF"

LAYOUT_FILES = {
    "title_slide": "ppt/slideLayouts/slideLayout1.xml",
    "title_and_content": "ppt/slideLayouts/slideLayout2.xml",
    "section_header": "ppt/slideLayouts/slideLayout3.xml",
    "two_content": "ppt/slideLayouts/slideLayout4.xml",
    "comparison": "ppt/slideLayouts/slideLayout5.xml",
    "content_with_caption": "ppt/slideLayouts/slideLayout8.xml",
    "picture_with_caption": "ppt/slideLayouts/slideLayout9.xml",
    "three_cards_vertical": "ppt/slideLayouts/slideLayout11.xml",
}


def _q(namespace: str, tag: str) -> str:
    return f"{{{namespace}}}{tag}"


def _load_layouts() -> dict[str, etree._Element]:
    with ZipFile(SOURCE_PPTX) as zin:
        return {
            key: etree.fromstring(zin.read(path))
            for key, path in LAYOUT_FILES.items()
        }


def _sp_tree(root: etree._Element) -> etree._Element:
    sp_tree = root.find("p:cSld/p:spTree", NS)
    if sp_tree is None:
        raise RuntimeError("slide layout is missing p:spTree")
    return sp_tree


def _c_sld(root: etree._Element) -> etree._Element:
    c_sld = root.find("p:cSld", NS)
    if c_sld is None:
        raise RuntimeError("slide layout is missing p:cSld")
    return c_sld


def _placeholder(shape: etree._Element) -> etree._Element | None:
    return shape.find("p:nvSpPr/p:nvPr/p:ph", NS)


def _shape_id(shape: etree._Element) -> int:
    c_nv_pr = shape.find("p:nvSpPr/p:cNvPr", NS)
    if c_nv_pr is None:
        raise RuntimeError("shape is missing p:cNvPr")
    return int(c_nv_pr.get("id", "0"))


def _set_shape_identity(
    shape: etree._Element,
    *,
    shape_id: int,
    name: str,
    placeholder_type: str | None = None,
    placeholder_idx: int | None = None,
) -> None:
    c_nv_pr = shape.find("p:nvSpPr/p:cNvPr", NS)
    if c_nv_pr is None:
        raise RuntimeError("shape is missing p:cNvPr")
    c_nv_pr.set("id", str(shape_id))
    c_nv_pr.set("name", name)

    ph = _placeholder(shape)
    if ph is None:
        raise RuntimeError("shape is missing p:ph")
    if placeholder_type is not None:
        ph.set("type", placeholder_type)
    if placeholder_idx is None:
        ph.attrib.pop("idx", None)
    else:
        ph.set("idx", str(placeholder_idx))


def _max_shape_id(root: etree._Element) -> int:
    return max(
        int(c_nv_pr.get("id", "0"))
        for c_nv_pr in _sp_tree(root).xpath(".//p:cNvPr", namespaces=NS)
    )


def _find_placeholder_by_idx(root: etree._Element, idx: int) -> etree._Element:
    for shape in _sp_tree(root).findall("p:sp", NS):
        ph = _placeholder(shape)
        if ph is not None and ph.get("idx") == str(idx):
            return shape
    raise RuntimeError(f"placeholder idx {idx} not found")


def _find_placeholder_by_type(root: etree._Element, placeholder_type: str) -> etree._Element:
    for shape in _sp_tree(root).findall("p:sp", NS):
        ph = _placeholder(shape)
        if ph is not None and ph.get("type") == placeholder_type:
            return shape
    raise RuntimeError(f"placeholder type {placeholder_type} not found")


def _ex(frac: float) -> int:
    return int(round(frac * SLIDE_WIDTH_EMU))


def _ey(frac: float) -> int:
    return int(round(frac * SLIDE_HEIGHT_EMU))


def _deco_shape(
    shape_id: int,
    name: str,
    l: float,
    t: float,
    w: float,
    h: float,
    *,
    fill_hex: str,
    prst: str = "rect",
    round_adj: int | None = None,
    border_hex: str | None = None,
    border_pt: float = 0.75,
) -> etree._Element:
    """Build a non-placeholder decorative shape element."""
    P, A = PML_NS, A_NS

    sp = etree.Element(_q(P, "sp"))

    nvSpPr = etree.SubElement(sp, _q(P, "nvSpPr"))
    cNvPr = etree.SubElement(nvSpPr, _q(P, "cNvPr"))
    cNvPr.set("id", str(shape_id))
    cNvPr.set("name", name)
    cNvSpPr = etree.SubElement(nvSpPr, _q(P, "cNvSpPr"))
    spLocks = etree.SubElement(cNvSpPr, _q(A, "spLocks"))
    spLocks.set("noGrp", "1")
    etree.SubElement(nvSpPr, _q(P, "nvPr"))

    spPr = etree.SubElement(sp, _q(P, "spPr"))
    xfrm = etree.SubElement(spPr, _q(A, "xfrm"))
    off = etree.SubElement(xfrm, _q(A, "off"))
    off.set("x", str(_ex(l)))
    off.set("y", str(_ey(t)))
    ext = etree.SubElement(xfrm, _q(A, "ext"))
    ext.set("cx", str(_ex(w)))
    ext.set("cy", str(_ey(h)))

    prstGeom = etree.SubElement(spPr, _q(A, "prstGeom"))
    prstGeom.set("prst", prst)
    avLst = etree.SubElement(prstGeom, _q(A, "avLst"))
    if round_adj is not None:
        gd = etree.SubElement(avLst, _q(A, "gd"))
        gd.set("name", "adj")
        gd.set("fmla", f"val {round_adj}")

    solidFill = etree.SubElement(spPr, _q(A, "solidFill"))
    srgbClr = etree.SubElement(solidFill, _q(A, "srgbClr"))
    srgbClr.set("val", fill_hex)

    ln = etree.SubElement(spPr, _q(A, "ln"))
    if border_hex is not None:
        ln.set("w", str(int(round(border_pt * 12700))))
        bFill = etree.SubElement(ln, _q(A, "solidFill"))
        bClr = etree.SubElement(bFill, _q(A, "srgbClr"))
        bClr.set("val", border_hex)
    else:
        etree.SubElement(ln, _q(A, "noFill"))

    txBody = etree.SubElement(sp, _q(P, "txBody"))
    etree.SubElement(txBody, _q(A, "bodyPr"))
    etree.SubElement(txBody, _q(A, "lstStyle"))
    etree.SubElement(txBody, _q(A, "p"))

    return sp


def _insert_decos(root: etree._Element, *decos: etree._Element) -> None:
    """Insert decorative shapes before the first placeholder in spTree."""
    sp_tree = _sp_tree(root)
    insert_idx: int | None = None
    for i, child in enumerate(sp_tree):
        if child.tag == _q(PML_NS, "sp"):
            ph = child.find("p:nvSpPr/p:nvPr/p:ph", NS)
            if ph is not None:
                insert_idx = i
                break
    if insert_idx is not None:
        for deco in reversed(decos):
            sp_tree.insert(insert_idx, deco)
    else:
        for deco in decos:
            sp_tree.append(deco)


def _set_ph_lst_style(
    shape: etree._Element,
    levels: dict[int, dict],
) -> None:
    """Set lstStyle on a placeholder txBody for default text formatting per level."""
    A = A_NS
    tx_body = shape.find("p:txBody", NS)
    if tx_body is None:
        raise RuntimeError("placeholder has no txBody")

    lst_style = tx_body.find("a:lstStyle", NS)
    if lst_style is None:
        lst_style = etree.SubElement(tx_body, _q(A, "lstStyle"))
    else:
        for child in list(lst_style):
            lst_style.remove(child)

    level_tags = ["lvl1pPr", "lvl2pPr", "lvl3pPr", "lvl4pPr", "lvl5pPr"]
    for level_num in sorted(levels.keys()):
        info = levels[level_num]
        lvl = etree.SubElement(lst_style, _q(A, level_tags[level_num]))
        defRPr = etree.SubElement(lvl, _q(A, "defRPr"))
        if "sz" in info:
            defRPr.set("sz", str(info["sz"]))
        if info.get("bold"):
            defRPr.set("b", "1")
        if "color" in info:
            sf = etree.SubElement(defRPr, _q(A, "solidFill"))
            clr = etree.SubElement(sf, _q(A, "srgbClr"))
            clr.set("val", info["color"])


def _copy_layout(base_root: etree._Element, target_root: etree._Element, *, name: str) -> etree._Element:
    root = deepcopy(base_root)
    root.set("type", "cust")
    c_sld = _c_sld(root)
    c_sld.set("name", name)
    clone_ext = c_sld.find("p:extLst", NS)
    if clone_ext is not None:
        c_sld.remove(clone_ext)
    target_ext = target_root.find("p:cSld/p:extLst", NS)
    if target_ext is not None:
        c_sld.append(deepcopy(target_ext))
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


def _append_shape(root: etree._Element, shape: etree._Element) -> None:
    _sp_tree(root).append(shape)


def _clone_placeholder(
    root: etree._Element,
    source_shape: etree._Element,
    *,
    name: str,
    placeholder_type: str,
    placeholder_idx: int,
    left: float,
    top: float,
    width: float,
    height: float,
) -> etree._Element:
    clone = deepcopy(source_shape)
    _set_shape_identity(
        clone,
        shape_id=_max_shape_id(root) + 1,
        name=name,
        placeholder_type=placeholder_type,
        placeholder_idx=placeholder_idx,
    )
    _set_geometry(clone, left=left, top=top, width=width, height=height)
    _append_shape(root, clone)
    return clone


def _title_slide_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    """Enterprise title slide: navy top bar, accent separator, navy footer."""
    root = _copy_layout(layouts["title_slide"], layouts["title_slide"], name="Title Slide")
    _insert_decos(
        root,
        _deco_shape(200, "deco_top_bar", 0.0, 0.0, 1.0, 0.275, fill_hex=NAVY),
        _deco_shape(201, "deco_accent_line", 0.0, 0.267, 1.0, 0.016, fill_hex=ACCENT),
        _deco_shape(202, "deco_footer_bar", 0.0, 0.870, 1.0, 0.130, fill_hex=NAVY),
    )
    # Subtitle and title are in white area (y=0.346+) — no text-color override needed.
    return root


def _section_header_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    """Enterprise section header: full navy background with white text."""
    root = _copy_layout(layouts["section_header"], layouts["section_header"], name="Section Header")
    _insert_decos(
        root,
        _deco_shape(200, "deco_bg", 0.0, 0.0, 1.0, 1.0, fill_hex=NAVY),
        _deco_shape(201, "deco_accent_bar", 0.041, 0.780, 0.200, 0.010, fill_hex=ACCENT),
    )
    # Title (y=0.206) and body (y=0.340) are both on navy — override text to white.
    title_shape = _find_placeholder_by_type(root, "title")
    _set_ph_lst_style(title_shape, {0: {"sz": 3600, "bold": True, "color": WHITE}})
    for shape in _sp_tree(root).findall("p:sp", NS):
        ph = _placeholder(shape)
        if ph is not None and ph.get("type") == "body":
            _set_ph_lst_style(shape, {0: {"sz": 2000, "color": CARD_BG}})
    return root


def _comparison_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    root = _copy_layout(layouts["comparison"], layouts["comparison"], name="comparison_2col")
    left_title = _find_placeholder_by_idx(root, 1)
    right_title = _find_placeholder_by_idx(root, 3)
    left_description = _find_placeholder_by_idx(root, 13)
    right_description = _find_placeholder_by_idx(root, 14)

    _set_shape_identity(left_title, shape_id=_shape_id(left_title), name="slot__left_title", placeholder_idx=1)
    _set_shape_identity(right_title, shape_id=_shape_id(right_title), name="slot__right_title", placeholder_idx=3)
    _set_shape_identity(
        left_description,
        shape_id=_shape_id(left_description),
        name="slot__left_description",
        placeholder_idx=13,
    )
    _set_shape_identity(
        right_description,
        shape_id=_shape_id(right_description),
        name="slot__right_description",
        placeholder_idx=14,
    )

    _set_geometry(left_title, left=0.038, top=0.165, width=0.385, height=0.065)
    _set_geometry(right_title, left=0.527, top=0.165, width=0.385, height=0.065)
    _set_geometry(left_description, left=0.038, top=0.245, width=0.440, height=0.640)
    _set_geometry(right_description, left=0.527, top=0.245, width=0.440, height=0.640)

    picture_shape = _find_placeholder_by_type(layouts["picture_with_caption"], "pic")
    _clone_placeholder(
        root,
        picture_shape,
        name="slot__left_icon",
        placeholder_type="pic",
        placeholder_idx=15,
        left=0.425,
        top=0.158,
        width=0.050,
        height=0.080,
    )
    _clone_placeholder(
        root,
        picture_shape,
        name="slot__right_icon",
        placeholder_type="pic",
        placeholder_idx=16,
        left=0.918,
        top=0.158,
        width=0.050,
        height=0.080,
    )

    # Enterprise decoratives: two column panels with NAVY top accent + center divider
    _insert_decos(
        root,
        _deco_shape(200, "deco_left_panel", 0.022, 0.125, 0.464, 0.768, fill_hex=CARD_BG),
        _deco_shape(201, "deco_right_panel", 0.514, 0.125, 0.464, 0.768, fill_hex=CARD_BG),
        _deco_shape(202, "deco_left_accent", 0.022, 0.125, 0.464, 0.016, fill_hex=NAVY),
        _deco_shape(203, "deco_right_accent", 0.514, 0.125, 0.464, 0.016, fill_hex=NAVY),
        _deco_shape(204, "deco_divider", 0.490, 0.125, 0.020, 0.768, fill_hex=DIVIDER),
    )
    return root


def _three_cards_layout_xml(
    layouts: dict[str, etree._Element],
    *,
    name: str,
    card_boxes: list[tuple[float, float, float, float]],
    icon_boxes: list[tuple[float, float, float, float]],
    decoratives: list[etree._Element] | None = None,
) -> etree._Element:
    root = _copy_layout(layouts["two_content"], layouts[name], name=name)
    title_shape = _find_placeholder_by_type(root, "title")
    _set_geometry(title_shape, left=0.019, top=0.032, width=0.962, height=0.094)

    first = _find_placeholder_by_idx(root, 13)
    second = _find_placeholder_by_idx(root, 14)
    third = deepcopy(second)
    _set_shape_identity(
        third,
        shape_id=_max_shape_id(root) + 1,
        name="slot__card_3_combined_text",
        placeholder_type="obj",
        placeholder_idx=15,
    )
    _append_shape(root, third)

    content_shapes = [first, second, third]
    picture_shape = _find_placeholder_by_type(layouts["picture_with_caption"], "pic")

    for index, (content_shape, card_box, icon_box) in enumerate(
        zip(content_shapes, card_boxes, icon_boxes, strict=True),
        start=1,
    ):
        _set_shape_identity(
            content_shape,
            shape_id=_shape_id(content_shape),
            name=f"slot__card_{index}_combined_text",
            placeholder_type="obj",
            placeholder_idx=12 + index,
        )
        _set_geometry(
            content_shape,
            left=card_box[0],
            top=card_box[1],
            width=card_box[2],
            height=card_box[3],
        )
        _clone_placeholder(
            root,
            picture_shape,
            name=f"slot__card_{index}_icon",
            placeholder_type="pic",
            placeholder_idx=15 + index,
            left=icon_box[0],
            top=icon_box[1],
            width=icon_box[2],
            height=icon_box[3],
        )
    if decoratives:
        _insert_decos(root, *decoratives)
    return root


def _appendix_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    root = _copy_layout(layouts["two_content"], layouts["content_with_caption"], name="appendix_backup")
    left = _find_placeholder_by_idx(root, 13)
    right = _find_placeholder_by_idx(root, 14)
    _set_shape_identity(left, shape_id=_shape_id(left), name="slot__body", placeholder_type="obj", placeholder_idx=13)
    _set_shape_identity(
        right,
        shape_id=_shape_id(right),
        name="slot__references",
        placeholder_type="obj",
        placeholder_idx=14,
    )
    _set_geometry(left, left=0.035, top=0.205, width=0.430, height=0.625)
    _set_geometry(right, left=0.515, top=0.205, width=0.450, height=0.625)

    # Enterprise decoratives: top accent bar + column divider
    _insert_decos(
        root,
        _deco_shape(200, "deco_top_accent", 0.028, 0.185, 0.944, 0.008, fill_hex=NAVY),
        _deco_shape(201, "deco_col_divider", 0.486, 0.195, 0.014, 0.635, fill_hex=DIVIDER),
    )
    return root


def build_template() -> bytes:
    if not SOURCE_PPTX.exists():
        raise FileNotFoundError(f"Missing source template: {SOURCE_PPTX}")

    layouts = _load_layouts()

    # three_cards_vertical: 3 rows, each strip has a CARD_BG background + NAVY left accent bar
    v_strip_h = 0.224
    v_strip_starts = [0.148, 0.400, 0.652]
    v_icon_w, v_icon_h = 0.065, 0.110
    v_content_left = 0.125
    v_decos: list[etree._Element] = []
    for ri, ys in enumerate(v_strip_starts):
        dbase = 200 + ri * 2
        v_decos += [
            _deco_shape(dbase, f"deco_v_strip{ri+1}_bg", 0.020, ys, 0.960, v_strip_h, fill_hex=CARD_BG),
            _deco_shape(dbase + 1, f"deco_v_strip{ri+1}_bar", 0.020, ys, 0.010, v_strip_h, fill_hex=NAVY),
        ]

    replacement_layouts = {
        LAYOUT_FILES["title_slide"]: _title_slide_layout_xml(layouts),
        LAYOUT_FILES["section_header"]: _section_header_layout_xml(layouts),
        LAYOUT_FILES["comparison"]: _comparison_layout_xml(layouts),
        LAYOUT_FILES["content_with_caption"]: _appendix_layout_xml(layouts),
        LAYOUT_FILES["three_cards_vertical"]: _three_cards_layout_xml(
            layouts,
            name="three_cards_vertical",
            card_boxes=[
                (v_content_left, v_strip_starts[0] + 0.032, 0.845, v_strip_h - 0.064),
                (v_content_left, v_strip_starts[1] + 0.032, 0.845, v_strip_h - 0.064),
                (v_content_left, v_strip_starts[2] + 0.032, 0.845, v_strip_h - 0.064),
            ],
            icon_boxes=[
                (0.037, v_strip_starts[0] + (v_strip_h - v_icon_h) / 2, v_icon_w, v_icon_h),
                (0.037, v_strip_starts[1] + (v_strip_h - v_icon_h) / 2, v_icon_w, v_icon_h),
                (0.037, v_strip_starts[2] + (v_strip_h - v_icon_h) / 2, v_icon_w, v_icon_h),
            ],
            decoratives=v_decos,
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
