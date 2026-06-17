#!/usr/bin/env python3
"""
Create templates/default.pptx and templates/default.manifest.json from the
hand-authored source template.

The generated default template is the production reference asset for strict
semantic layout discovery. Each supported semantic layout gets its own
PowerPoint layout name, and every bindable placeholder uses an authoritative
`AI_*` Selection Pane name sourced from `slot_ai_placeholder_names(...)`.
"""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from pptx_yaml_engine.layouts import slot_ai_placeholder_names  # noqa: E402, I001
from pptx_yaml_engine.mapper.service import generate_manifest, validate_manifest  # noqa: E402

TEMPLATES_DIR = ROOT / "templates"
SOURCE_PPTX = ROOT / "template_sources" / "default.source.pptx"
PPTX_OUT = TEMPLATES_DIR / "default.pptx"
JSON_OUT = TEMPLATES_DIR / "default.manifest.json"

PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"

NS = {"p": PML_NS, "a": A_NS}

SLIDE_WIDTH_EMU = 12192000
SLIDE_HEIGHT_EMU = 6858000

# Monochrome premium design palette
BLACK = "191919"
CHARCOAL = "242424"
SOFT_GRAY = "F4F4F2"
CARD_BG = "F7F7F5"
LINE_GRAY = "D9D9D6"
MUTED_TEXT = "666666"
NAVY = CHARCOAL
BLUE = CHARCOAL
ACCENT = BLACK
DIVIDER = LINE_GRAY
GRAY_LT = SOFT_GRAY
WHITE = "FFFFFF"

LAYOUT_FILES = {
    "title_slide": "ppt/slideLayouts/slideLayout1.xml",
    "title_and_vertical_text": "ppt/slideLayouts/slideLayout10.xml",
    "three_cards_vertical": "ppt/slideLayouts/slideLayout11.xml",
    "title_and_content": "ppt/slideLayouts/slideLayout2.xml",
    "section_header": "ppt/slideLayouts/slideLayout3.xml",
    "two_content": "ppt/slideLayouts/slideLayout4.xml",
    "comparison": "ppt/slideLayouts/slideLayout5.xml",
    "title_only": "ppt/slideLayouts/slideLayout6.xml",
    "blank": "ppt/slideLayouts/slideLayout7.xml",
    "content_with_caption": "ppt/slideLayouts/slideLayout8.xml",
    "picture_with_caption": "ppt/slideLayouts/slideLayout9.xml",
}

STANDARD_TITLE_BOX = (0.055, 0.052, 0.880, 0.090)
VISUAL_SQUARE_RATIO = SLIDE_HEIGHT_EMU / SLIDE_WIDTH_EMU


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


def _sanitize_master_shape_names(root: etree._Element) -> etree._Element:
    for index, c_nv_pr in enumerate(root.xpath(".//p:cNvPr[@name]", namespaces=NS), start=1):
        name = c_nv_pr.get("name", "")
        if name.startswith("Text Placeholder"):
            shape_id = c_nv_pr.get("id") or str(index)
            c_nv_pr.set("name", f"AI_MASTER_PLACEHOLDER_{shape_id}")
    return root


def _slot_name(layout: str, path: str) -> str:
    return slot_ai_placeholder_names(layout, path)[0]


def _bind_slot(
    shape: etree._Element,
    *,
    semantic: str,
    slot_path: str,
    placeholder_type: str | None = None,
    placeholder_idx: int | None = None,
) -> etree._Element:
    ph = _placeholder(shape)
    if ph is None:
        raise RuntimeError("shape is missing p:ph")
    current_idx = ph.get("idx")
    _set_shape_identity(
        shape,
        shape_id=_shape_id(shape),
        name=_slot_name(semantic, slot_path),
        placeholder_type=placeholder_type or ph.get("type"),
        placeholder_idx=placeholder_idx if placeholder_idx is not None else (int(current_idx) if current_idx is not None else None),
    )
    return shape


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


def _find_title_placeholder(root: etree._Element) -> etree._Element:
    try:
        return _find_placeholder_by_idx(root, 0)
    except RuntimeError:
        for placeholder_type in ("title", "ctrTitle"):
            try:
                return _find_placeholder_by_type(root, placeholder_type)
            except RuntimeError:
                continue
    raise RuntimeError("title placeholder not found")


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


def _set_box(shape: etree._Element, box: tuple[float, float, float, float]) -> None:
    _set_geometry(shape, left=box[0], top=box[1], width=box[2], height=box[3])


def _visual_square_width(height: float) -> float:
    return height * VISUAL_SQUARE_RATIO


def _ex(frac: float) -> int:
    return int(round(frac * SLIDE_WIDTH_EMU))


def _ey(frac: float) -> int:
    return int(round(frac * SLIDE_HEIGHT_EMU))


def _deco_shape(
    shape_id: int,
    name: str,
    left: float,
    top: float,
    width: float,
    height: float,
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
    off.set("x", str(_ex(left)))
    off.set("y", str(_ey(top)))
    ext = etree.SubElement(xfrm, _q(A, "ext"))
    ext.set("cx", str(_ex(width)))
    ext.set("cy", str(_ey(height)))

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


def _content_decos(shape_id: int, panel_box: tuple[float, float, float, float]) -> list[etree._Element]:
    left, top, width, height = panel_box
    return [
        _deco_shape(
            shape_id,
            "deco_content_panel",
            max(0.018, left - 0.012),
            max(0.175, top - 0.018),
            min(0.964, width + 0.024),
            min(0.720, height + 0.036),
            fill_hex=CARD_BG,
            prst="roundRect",
            round_adj=4500,
        ),
    ]


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
        if "algn" in info:
            lvl.set("algn", str(info["algn"]))
        if "color" in info:
            sf = etree.SubElement(defRPr, _q(A, "solidFill"))
            clr = etree.SubElement(sf, _q(A, "srgbClr"))
            clr.set("val", info["color"])
    for paragraph in tx_body.findall("a:p", NS):
        p_pr = paragraph.find("a:pPr", NS)
        if p_pr is None:
            p_pr = etree.Element(_q(A, "pPr"))
            paragraph.insert(0, p_pr)
        for level_num in sorted(levels.keys()):
            info = levels[level_num]
            if "algn" in info:
                p_pr.set("algn", str(info["algn"]))
                break


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


def _clone_slot(
    root: etree._Element,
    source_shape: etree._Element,
    *,
    semantic: str,
    slot_path: str,
    placeholder_type: str,
    placeholder_idx: int,
    box: tuple[float, float, float, float],
) -> etree._Element:
    return _clone_placeholder(
        root,
        source_shape,
        name=_slot_name(semantic, slot_path),
        placeholder_type=placeholder_type,
        placeholder_idx=placeholder_idx,
        left=box[0],
        top=box[1],
        width=box[2],
        height=box[3],
    )


def _cover_title_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    """Premium monochrome title slide built from content regions only."""
    semantic = "cover_title"
    root = _copy_layout(layouts["title_slide"], layouts["title_slide"], name=semantic)
    _insert_decos(
        root,
        _deco_shape(204, "deco_footer_line", 0.060, 0.865, 0.865, 0.004, fill_hex=LINE_GRAY),
    )
    title = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    subtitle = _bind_slot(_find_placeholder_by_idx(root, 1), semantic=semantic, slot_path="subtitle")
    _set_box(title, (0.060, 0.310, 0.575, 0.205))
    _set_box(subtitle, (0.060, 0.545, 0.545, 0.090))
    date = _clone_slot(root, subtitle, semantic=semantic, slot_path="date", placeholder_type="body", placeholder_idx=13, box=(0.060, 0.705, 0.190, 0.045))
    organization = _clone_slot(root, subtitle, semantic=semantic, slot_path="organization", placeholder_type="body", placeholder_idx=14, box=(0.060, 0.785, 0.330, 0.042))
    author = _clone_slot(root, subtitle, semantic=semantic, slot_path="author", placeholder_type="body", placeholder_idx=15, box=(0.640, 0.785, 0.285, 0.042))
    _set_ph_lst_style(title, {0: {"sz": 5000, "bold": True, "color": BLACK}})
    _set_ph_lst_style(subtitle, {0: {"sz": 2300, "color": CHARCOAL}})
    _set_ph_lst_style(date, {0: {"sz": 1300, "color": MUTED_TEXT}})
    _set_ph_lst_style(organization, {0: {"sz": 1450, "color": MUTED_TEXT}})
    _set_ph_lst_style(author, {0: {"sz": 1450, "color": MUTED_TEXT}})
    return root


def _section_divider_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    """Whitespace-led section divider with oversized numbering."""
    semantic = "section_divider"
    root = _copy_layout(layouts["section_header"], layouts["section_header"], name=semantic)
    _insert_decos(
        root,
        _deco_shape(203, "deco_footer_line", 0.060, 0.865, 0.865, 0.004, fill_hex=LINE_GRAY),
    )
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    subtitle_shape = _bind_slot(_find_placeholder_by_idx(root, 1), semantic=semantic, slot_path="subtitle")
    section_no_shape = _clone_slot(root, subtitle_shape, semantic=semantic, slot_path="section_no", placeholder_type="body", placeholder_idx=13, box=(0.055, 0.145, 0.265, 0.190))
    _set_box(title_shape, (0.060, 0.445, 0.565, 0.125))
    _set_box(subtitle_shape, (0.060, 0.595, 0.540, 0.080))
    _set_ph_lst_style(title_shape, {0: {"sz": 4300, "bold": True, "color": BLACK}})
    _set_ph_lst_style(subtitle_shape, {0: {"sz": 1800, "color": MUTED_TEXT}})
    _set_ph_lst_style(section_no_shape, {0: {"sz": 8600, "bold": True, "color": BLACK}})
    return root


def _single_content_layout_xml(
    layouts: dict[str, etree._Element],
    *,
    semantic: str,
    target_key: str,
    main_slot: str,
    main_placeholder_type: str,
    main_box: tuple[float, float, float, float],
    subtitle_box: tuple[float, float, float, float] | None = None,
    caption_box: tuple[float, float, float, float] | None = None,
) -> etree._Element:
    root = _copy_layout(layouts["title_and_content"], layouts[target_key], name=semantic)
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    _set_box(title_shape, STANDARD_TITLE_BOX)
    _set_ph_lst_style(title_shape, {0: {"sz": 3200, "bold": True, "color": BLACK}})
    content_shape = _find_placeholder_by_idx(root, 13)
    if subtitle_box is not None:
        subtitle_shape = _clone_slot(root, content_shape, semantic=semantic, slot_path="subtitle", placeholder_type="body", placeholder_idx=14, box=subtitle_box)
        _set_ph_lst_style(subtitle_shape, {0: {"sz": 1450, "color": MUTED_TEXT}})
    if caption_box is not None:
        caption_shape = _clone_slot(root, content_shape, semantic=semantic, slot_path="caption", placeholder_type="body", placeholder_idx=15, box=caption_box)
        _set_ph_lst_style(caption_shape, {0: {"sz": 1250, "color": MUTED_TEXT}})
    _bind_slot(
        content_shape,
        semantic=semantic,
        slot_path=main_slot,
        placeholder_type=main_placeholder_type,
        placeholder_idx=13,
    )
    _set_box(content_shape, main_box)
    _insert_decos(root, *_content_decos(200, main_box))
    return root


def _comparison_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    semantic = "comparison_2col"
    root = _copy_layout(layouts["comparison"], layouts["comparison"], name=semantic)
    badge_h = 0.078
    badge_w = _visual_square_width(badge_h)
    icon_h = 0.036
    icon_w = _visual_square_width(icon_h)
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    _set_box(title_shape, STANDARD_TITLE_BOX)
    subtitle_shape = _clone_slot(root, _find_placeholder_by_idx(root, 13), semantic=semantic, slot_path="subtitle", placeholder_type="body", placeholder_idx=19, box=(0.055, 0.152, 0.880, 0.050))
    _set_ph_lst_style(title_shape, {0: {"sz": 3200, "bold": True, "color": BLACK}})
    _set_ph_lst_style(subtitle_shape, {0: {"sz": 1400, "color": MUTED_TEXT}})
    left_title = _find_placeholder_by_idx(root, 1)
    right_title = _find_placeholder_by_idx(root, 3)
    left_description = _find_placeholder_by_idx(root, 13)
    right_description = _find_placeholder_by_idx(root, 14)

    _bind_slot(left_title, semantic=semantic, slot_path="left.title", placeholder_idx=1)
    _bind_slot(right_title, semantic=semantic, slot_path="right.title", placeholder_idx=3)
    _bind_slot(left_description, semantic=semantic, slot_path="left.description", placeholder_idx=13)
    _bind_slot(right_description, semantic=semantic, slot_path="right.description", placeholder_idx=14)

    _set_box(left_title, (0.120, 0.252, 0.300, 0.055))
    _set_box(right_title, (0.630, 0.252, 0.300, 0.055))
    _set_box(left_description, (0.055, 0.330, 0.390, 0.130))
    _set_box(right_description, (0.565, 0.330, 0.390, 0.130))
    left_bullets = _clone_slot(root, left_description, semantic=semantic, slot_path="left.bullets", placeholder_type="obj", placeholder_idx=17, box=(0.055, 0.485, 0.390, 0.285))
    right_bullets = _clone_slot(root, right_description, semantic=semantic, slot_path="right.bullets", placeholder_type="obj", placeholder_idx=18, box=(0.565, 0.485, 0.390, 0.285))
    _set_ph_lst_style(left_title, {0: {"sz": 1550, "bold": True, "color": BLACK}})
    _set_ph_lst_style(right_title, {0: {"sz": 1550, "bold": True, "color": BLACK}})
    _set_ph_lst_style(left_description, {0: {"sz": 1350, "color": MUTED_TEXT}})
    _set_ph_lst_style(right_description, {0: {"sz": 1350, "color": MUTED_TEXT}})
    _set_ph_lst_style(left_bullets, {0: {"sz": 1250, "color": MUTED_TEXT}})
    _set_ph_lst_style(right_bullets, {0: {"sz": 1250, "color": MUTED_TEXT}})

    picture_shape = _find_placeholder_by_type(layouts["picture_with_caption"], "pic")
    _clone_placeholder(
        root,
        picture_shape,
        name=_slot_name(semantic, "left.icon"),
        placeholder_type="pic",
        placeholder_idx=15,
        left=0.068 + (badge_w - icon_w) / 2,
        top=0.235 + (badge_h - icon_h) / 2,
        width=icon_w,
        height=icon_h,
    )
    _clone_placeholder(
        root,
        picture_shape,
        name=_slot_name(semantic, "right.icon"),
        placeholder_type="pic",
        placeholder_idx=16,
        left=0.578 + (badge_w - icon_w) / 2,
        top=0.235 + (badge_h - icon_h) / 2,
        width=icon_w,
        height=icon_h,
    )

    _insert_decos(
        root,
        _deco_shape(202, "deco_left_panel", 0.022, 0.205, 0.464, 0.655, fill_hex=CARD_BG, prst="roundRect", round_adj=4500),
        _deco_shape(203, "deco_right_panel", 0.514, 0.205, 0.464, 0.655, fill_hex=CARD_BG, prst="roundRect", round_adj=4500),
        _deco_shape(205, "deco_left_badge", 0.068, 0.235, badge_w, badge_h, fill_hex=BLACK, prst="ellipse"),
        _deco_shape(206, "deco_right_badge", 0.578, 0.235, badge_w, badge_h, fill_hex=BLACK, prst="ellipse"),
        _deco_shape(207, "deco_divider", 0.498, 0.225, 0.002, 0.605, fill_hex=LINE_GRAY),
    )
    return root


def _three_cards_layout_xml(
    layouts: dict[str, etree._Element],
    *,
    card_boxes: list[tuple[float, float, float, float]],
    title_boxes: list[tuple[float, float, float, float]],
    icon_boxes: list[tuple[float, float, float, float]],
    decoratives: list[etree._Element] | None = None,
) -> etree._Element:
    semantic = "three_cards_vertical"
    root = _copy_layout(layouts["two_content"], layouts["three_cards_vertical"], name=semantic)
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    _set_box(title_shape, STANDARD_TITLE_BOX)
    _set_ph_lst_style(title_shape, {0: {"sz": 3200, "bold": True, "color": BLACK}})

    first = _find_placeholder_by_idx(root, 13)
    second = _find_placeholder_by_idx(root, 14)
    third = deepcopy(second)
    _set_shape_identity(third, shape_id=_max_shape_id(root) + 1, name="card_3_description_source", placeholder_type="obj", placeholder_idx=15)
    _append_shape(root, third)

    subtitle_shape = _clone_slot(root, first, semantic=semantic, slot_path="subtitle", placeholder_type="body", placeholder_idx=19, box=(0.055, 0.152, 0.880, 0.050))
    _set_ph_lst_style(subtitle_shape, {0: {"sz": 1400, "color": MUTED_TEXT}})
    content_shapes = [first, second, third]
    picture_shape = _find_placeholder_by_type(layouts["picture_with_caption"], "pic")

    for index, (content_shape, title_box, card_box, icon_box) in enumerate(
        zip(content_shapes, title_boxes, card_boxes, icon_boxes, strict=True),
        start=1,
    ):
        slot_index = index - 1
        _bind_slot(
            content_shape,
            semantic=semantic,
            slot_path=f"cards[{slot_index}].description",
            placeholder_type="obj",
            placeholder_idx=12 + index,
        )
        _set_box(content_shape, card_box)
        _set_ph_lst_style(content_shape, {0: {"sz": 1350, "color": MUTED_TEXT}})
        title_slot = _clone_slot(
            root,
            content_shape,
            semantic=semantic,
            slot_path=f"cards[{slot_index}].title",
            placeholder_type="body",
            placeholder_idx=19 + index,
            box=title_box,
        )
        _set_ph_lst_style(title_slot, {0: {"sz": 1650, "bold": True, "color": BLACK, "algn": "ctr"}})
        _clone_placeholder(
            root,
            picture_shape,
            name=_slot_name(semantic, f"cards[{slot_index}].icon"),
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
    semantic = "appendix_backup"
    root = _copy_layout(layouts["two_content"], layouts["content_with_caption"], name=semantic)
    left = _find_placeholder_by_idx(root, 13)
    right = _find_placeholder_by_idx(root, 14)
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    _set_box(title_shape, STANDARD_TITLE_BOX)
    subtitle_shape = _clone_slot(root, left, semantic=semantic, slot_path="subtitle", placeholder_type="body", placeholder_idx=15, box=(0.055, 0.152, 0.880, 0.050))
    _set_ph_lst_style(title_shape, {0: {"sz": 3200, "bold": True, "color": BLACK}})
    _set_ph_lst_style(subtitle_shape, {0: {"sz": 1400, "color": MUTED_TEXT}})
    _bind_slot(left, semantic=semantic, slot_path="body", placeholder_type="obj", placeholder_idx=13)
    _bind_slot(right, semantic=semantic, slot_path="references", placeholder_type="obj", placeholder_idx=14)
    _clone_slot(root, left, semantic=semantic, slot_path="items", placeholder_type="obj", placeholder_idx=16, box=(0.035, 0.565, 0.430, 0.260))
    _set_box(left, (0.035, 0.225, 0.430, 0.300))
    _set_box(right, (0.515, 0.225, 0.450, 0.600))
    _set_ph_lst_style(left, {0: {"sz": 1250, "color": CHARCOAL}})
    _set_ph_lst_style(right, {0: {"sz": 1250, "color": CHARCOAL}})

    _insert_decos(
        root,
        _deco_shape(202, "deco_body_panel", 0.022, 0.205, 0.455, 0.650, fill_hex=CARD_BG, prst="roundRect", round_adj=4500),
        _deco_shape(203, "deco_refs_panel", 0.500, 0.205, 0.478, 0.650, fill_hex=CARD_BG, prst="roundRect", round_adj=4500),
        _deco_shape(205, "deco_col_divider", 0.488, 0.245, 0.002, 0.560, fill_hex=LINE_GRAY),
    )
    return root


def _image_caption_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    semantic = "image_caption"
    root = _copy_layout(layouts["picture_with_caption"], layouts["picture_with_caption"], name=semantic)
    icon_h = 0.220
    icon_w = _visual_square_width(icon_h)
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    picture_shape = _bind_slot(_find_placeholder_by_idx(root, 1), semantic=semantic, slot_path="icon", placeholder_type="pic", placeholder_idx=1)
    caption_shape = _bind_slot(_find_placeholder_by_idx(root, 2), semantic=semantic, slot_path="caption", placeholder_type="body", placeholder_idx=2)
    subtitle_shape = _clone_slot(root, caption_shape, semantic=semantic, slot_path="subtitle", placeholder_type="body", placeholder_idx=13, box=(0.055, 0.152, 0.880, 0.050))
    attribution_shape = _clone_slot(root, caption_shape, semantic=semantic, slot_path="attribution", placeholder_type="body", placeholder_idx=14, box=(0.455, 0.690, 0.450, 0.055))
    _set_box(title_shape, STANDARD_TITLE_BOX)
    _set_box(picture_shape, (0.055 + (0.360 - icon_w) / 2, 0.370, icon_w, icon_h))
    _set_box(caption_shape, (0.455, 0.315, 0.450, 0.305))
    _set_ph_lst_style(title_shape, {0: {"sz": 3200, "bold": True, "color": BLACK}})
    _set_ph_lst_style(caption_shape, {0: {"sz": 1250, "color": CHARCOAL}})
    _set_ph_lst_style(subtitle_shape, {0: {"sz": 1400, "color": MUTED_TEXT}})
    _set_ph_lst_style(attribution_shape, {0: {"sz": 1150, "color": MUTED_TEXT}})
    _insert_decos(
        root,
        _deco_shape(202, "deco_media_panel", 0.055, 0.245, 0.360, 0.470, fill_hex=CARD_BG, prst="roundRect", round_adj=4500),
        _deco_shape(203, "deco_caption_panel", 0.435, 0.245, 0.490, 0.470, fill_hex=WHITE, prst="roundRect", round_adj=4500),
    )
    return root


def _closing_end_layout_xml(layouts: dict[str, etree._Element]) -> etree._Element:
    semantic = "closing_end"
    root = _copy_layout(layouts["title_slide"], layouts["title_and_vertical_text"], name=semantic)
    _insert_decos(
        root,
        _deco_shape(204, "deco_footer_line", 0.060, 0.865, 0.865, 0.004, fill_hex=LINE_GRAY),
    )
    title_shape = _bind_slot(_find_title_placeholder(root), semantic=semantic, slot_path="title")
    subtitle_shape = _bind_slot(_find_placeholder_by_idx(root, 1), semantic=semantic, slot_path="subtitle")
    message_shape = _clone_slot(root, subtitle_shape, semantic=semantic, slot_path="message", placeholder_type="body", placeholder_idx=13, box=(0.060, 0.555, 0.520, 0.120))
    contact_shape = _clone_slot(root, subtitle_shape, semantic=semantic, slot_path="contact", placeholder_type="body", placeholder_idx=14, box=(0.060, 0.805, 0.340, 0.045))
    cta_shape = _clone_slot(root, subtitle_shape, semantic=semantic, slot_path="cta", placeholder_type="body", placeholder_idx=15, box=(0.060, 0.715, 0.520, 0.045))
    _set_box(title_shape, (0.060, 0.265, 0.520, 0.120))
    _set_box(subtitle_shape, (0.060, 0.415, 0.500, 0.070))
    _set_ph_lst_style(title_shape, {0: {"sz": 4600, "bold": True, "color": BLACK}})
    _set_ph_lst_style(subtitle_shape, {0: {"sz": 1900, "color": CHARCOAL}})
    _set_ph_lst_style(message_shape, {0: {"sz": 2000, "color": CHARCOAL}})
    _set_ph_lst_style(contact_shape, {0: {"sz": 1400, "color": MUTED_TEXT}})
    _set_ph_lst_style(cta_shape, {0: {"sz": 1400, "bold": True, "color": BLACK}})
    return root


def _title_and_content_layout_xml(
    layouts: dict[str, etree._Element],
    *,
    target_key: str,
    semantic: str,
    main_slot: str,
    placeholder_type: str,
    main_box: tuple[float, float, float, float],
    subtitle_box: tuple[float, float, float, float] | None = None,
    caption_box: tuple[float, float, float, float] | None = None,
) -> etree._Element:
    return _single_content_layout_xml(
        layouts,
        semantic=semantic,
        target_key=target_key,
        main_slot=main_slot,
        main_placeholder_type=placeholder_type,
        main_box=main_box,
        subtitle_box=subtitle_box,
        caption_box=caption_box,
    )


def build_template() -> bytes:
    if not SOURCE_PPTX.exists():
        raise FileNotFoundError(f"Missing source template: {SOURCE_PPTX}")

    layouts = _load_layouts()

    # three_cards_vertical: pale cards with black circular icon badges.
    h_card_w = 0.285
    h_card_starts = [0.030, 0.358, 0.685]
    h_icon_h = 0.046
    h_icon_w = _visual_square_width(h_icon_h)
    h_badge_h = 0.098
    h_badge_w = _visual_square_width(h_badge_h)
    h_card_top = 0.245
    h_card_h = 0.565
    h_badge_top = 0.300
    h_title_top = 0.458
    h_desc_top = 0.548
    h_decos: list[etree._Element] = []
    for ci, xs in enumerate(h_card_starts):
        dbase = 200 + ci * 2
        h_decos += [
            _deco_shape(dbase, f"deco_h_card{ci+1}_bg", xs, h_card_top, h_card_w, h_card_h, fill_hex=CARD_BG, prst="roundRect", round_adj=4500),
            _deco_shape(dbase + 1, f"deco_h_card{ci+1}_badge", xs + (h_card_w - h_badge_w) / 2, h_badge_top, h_badge_w, h_badge_h, fill_hex=BLACK, prst="ellipse"),
        ]
    replacement_layouts = {
        LAYOUT_FILES["title_slide"]: _cover_title_layout_xml(layouts),
        LAYOUT_FILES["title_and_content"]: _title_and_content_layout_xml(
            layouts,
            target_key="title_and_content",
            semantic="agenda",
            main_slot="items",
            placeholder_type="obj",
            main_box=(0.035, 0.225, 0.930, 0.600),
            subtitle_box=(0.055, 0.152, 0.880, 0.055),
        ),
        LAYOUT_FILES["section_header"]: _section_divider_layout_xml(layouts),
        LAYOUT_FILES["two_content"]: _title_and_content_layout_xml(
            layouts,
            target_key="two_content",
            semantic="list_basic",
            main_slot="items",
            placeholder_type="obj",
            main_box=(0.035, 0.225, 0.930, 0.600),
            subtitle_box=(0.055, 0.152, 0.880, 0.055),
        ),
        LAYOUT_FILES["comparison"]: _comparison_layout_xml(layouts),
        LAYOUT_FILES["title_only"]: _title_and_content_layout_xml(
            layouts,
            target_key="title_only",
            semantic="table_basic",
            main_slot="table",
            placeholder_type="tbl",
            main_box=(0.035, 0.225, 0.930, 0.500),
            subtitle_box=(0.055, 0.152, 0.880, 0.055),
            caption_box=(0.035, 0.780, 0.930, 0.055),
        ),
        LAYOUT_FILES["blank"]: _title_and_content_layout_xml(
            layouts,
            target_key="blank",
            semantic="chart_basic",
            main_slot="chart",
            placeholder_type="chart",
            main_box=(0.035, 0.225, 0.930, 0.500),
            subtitle_box=(0.055, 0.152, 0.880, 0.055),
            caption_box=(0.035, 0.780, 0.930, 0.055),
        ),
        LAYOUT_FILES["content_with_caption"]: _appendix_layout_xml(layouts),
        LAYOUT_FILES["picture_with_caption"]: _image_caption_layout_xml(layouts),
        LAYOUT_FILES["title_and_vertical_text"]: _closing_end_layout_xml(layouts),
        LAYOUT_FILES["three_cards_vertical"]: _three_cards_layout_xml(
            layouts,
            card_boxes=[
                (h_card_starts[0] + 0.027, h_desc_top, h_card_w - 0.054, 0.205),
                (h_card_starts[1] + 0.027, h_desc_top, h_card_w - 0.054, 0.205),
                (h_card_starts[2] + 0.027, h_desc_top, h_card_w - 0.054, 0.205),
            ],
            title_boxes=[
                (h_card_starts[0] + 0.027, h_title_top, h_card_w - 0.054, 0.065),
                (h_card_starts[1] + 0.027, h_title_top, h_card_w - 0.054, 0.065),
                (h_card_starts[2] + 0.027, h_title_top, h_card_w - 0.054, 0.065),
            ],
            icon_boxes=[
                (h_card_starts[0] + (h_card_w - h_icon_w) / 2, h_badge_top + (h_badge_h - h_icon_h) / 2, h_icon_w, h_icon_h),
                (h_card_starts[1] + (h_card_w - h_icon_w) / 2, h_badge_top + (h_badge_h - h_icon_h) / 2, h_icon_w, h_icon_h),
                (h_card_starts[2] + (h_card_w - h_icon_w) / 2, h_badge_top + (h_badge_h - h_icon_h) / 2, h_icon_w, h_icon_h),
            ],
            decoratives=h_decos,
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
            if item.filename.startswith("ppt/slideMasters/") and item.filename.endswith(".xml"):
                xml = etree.tostring(
                    _sanitize_master_shape_names(etree.fromstring(zin.read(item.filename))),
                    xml_declaration=True,
                    encoding="UTF-8",
                    standalone="yes",
                )
                zout.writestr(item, xml)
                continue
            zout.writestr(item, zin.read(item.filename))
    return output.getvalue()


def build_manifest(template_bytes: bytes) -> dict[str, Any]:
    manifest = generate_manifest(template_bytes)
    report = validate_manifest(template_bytes, manifest)
    if not report["valid"]:
        raise RuntimeError(f"Generated manifest is invalid: {report['issues']}")
    return manifest


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
