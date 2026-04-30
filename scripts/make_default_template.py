#!/usr/bin/env python3
"""
Create templates/default.pptx (navy × white theme) and
templates/default.manifest.json via inspect → propose → finalize pipeline.

Usage:
    python scripts/make_default_template.py
"""

from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.oxml.ns import qn

from pptx_yaml_engine.mapper.service import (
    finalize_manifest,
    inspect_template,
    propose_mapping,
)

# ── constants ──────────────────────────────────────────────────────────────

NAVY      = RGBColor(0x1A, 0x3A, 0x6C)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GRAY = RGBColor(0x33, 0x33, 0x33)

TEMPLATES_DIR = ROOT / "templates"
PPTX_OUT      = TEMPLATES_DIR / "default.pptx"
JSON_OUT      = TEMPLATES_DIR / "default.manifest.json"

# ── visual helpers ─────────────────────────────────────────────────────────


def _solid_fill(fill_obj, rgb: RGBColor) -> None:
    fill_obj.solid()
    fill_obj.fore_color.rgb = rgb


def _hex(rgb: RGBColor) -> str:
    # RGBColor is an int subclass; str() returns the 6-digit uppercase hex.
    return str(rgb)


def _set_defRPr_color(txBody, rgb: RGBColor) -> None:
    """Set default run color in a:lstStyle/a:lvl1pPr/a:defRPr."""
    lstStyle = txBody.find(qn("a:lstStyle"))
    if lstStyle is None:
        lstStyle = etree.SubElement(txBody, qn("a:lstStyle"))
    lvl1 = lstStyle.find(qn("a:lvl1pPr"))
    if lvl1 is None:
        lvl1 = etree.SubElement(lstStyle, qn("a:lvl1pPr"))
    defRPr = lvl1.find(qn("a:defRPr"))
    if defRPr is None:
        defRPr = etree.SubElement(lvl1, qn("a:defRPr"))
    for sf in defRPr.findall(qn("a:solidFill")):
        defRPr.remove(sf)
    solidFill = etree.SubElement(defRPr, qn("a:solidFill"))
    srgbClr = etree.SubElement(solidFill, qn("a:srgbClr"))
    srgbClr.set("val", _hex(rgb))


def _set_ph_color(layout, ph_idx: int, rgb: RGBColor) -> None:
    for ph in layout.placeholders:
        if ph.placeholder_format.idx == ph_idx:
            _set_defRPr_color(ph.text_frame._txBody, rgb)
            break


# ── template construction ──────────────────────────────────────────────────

# Default python-pptx layout indices (verified from prior inspection):
#  0  Title Slide          CENTER_TITLE(0), SUBTITLE(1)
#  1  Title and Content    TITLE(0), OBJECT(1)
#  2  Section Header       TITLE(0), BODY(1)
#  3  Two Content          TITLE(0), OBJECT(1), OBJECT(2)
#  4  Comparison           TITLE(0), BODY(1), OBJECT(2), BODY(3), OBJECT(4)
#  5  Title Only           TITLE(0)
#  6  Blank
#  7  Content with Caption TITLE(0), OBJECT(1), BODY(2)
#  8  Picture with Caption TITLE(0), PICTURE(1), BODY(2)
#  9  Title and Vertical Text TITLE(0), BODY(1)
# 10  Vertical Title and Text TITLE(0), BODY(1)

def build_template() -> bytes:
    prs = Presentation()
    prs.slide_width  = 12192000   # 16:9 widescreen
    prs.slide_height = 6858000

    # Slide master: white background
    _solid_fill(prs.slide_master.background.fill, WHITE)

    layouts = prs.slide_layouts

    # ── Layout 0: Title Slide  (cover_title, closing_end) ──
    lay0 = layouts[0]
    _solid_fill(lay0.background.fill, NAVY)
    _set_ph_color(lay0, 0, WHITE)   # CENTER_TITLE
    _set_ph_color(lay0, 1, WHITE)   # SUBTITLE

    # ── Layout 1: Title and Content  (most content semantics) ──
    lay1 = layouts[1]
    _solid_fill(lay1.background.fill, WHITE)
    _set_ph_color(lay1, 0, NAVY)        # title
    _set_ph_color(lay1, 1, DARK_GRAY)   # content body

    # ── Layout 2: Section Header  (section_divider) ──
    lay2 = layouts[2]
    _solid_fill(lay2.background.fill, NAVY)
    _set_ph_color(lay2, 0, WHITE)   # TITLE
    _set_ph_color(lay2, 1, WHITE)   # BODY

    # ── Layout 3: Two Content  (three_cards_*) ──
    lay3 = layouts[3]
    _solid_fill(lay3.background.fill, WHITE)
    _set_ph_color(lay3, 0, NAVY)
    _set_ph_color(lay3, 1, DARK_GRAY)
    _set_ph_color(lay3, 2, DARK_GRAY)

    # ── Layout 4: Comparison  (comparison_2col) ──
    lay4 = layouts[4]
    _solid_fill(lay4.background.fill, WHITE)
    _set_ph_color(lay4, 0, NAVY)
    for idx in (1, 2, 3, 4):
        _set_ph_color(lay4, idx, DARK_GRAY)

    # ── Layout 8: Picture with Caption  (image_caption) ──
    lay8 = layouts[8]
    _solid_fill(lay8.background.fill, WHITE)
    _set_ph_color(lay8, 0, NAVY)
    _set_ph_color(lay8, 2, DARK_GRAY)   # BODY caption

    buf = BytesIO()
    prs.save(buf)
    return buf.getvalue()


# ── manifest overrides ─────────────────────────────────────────────────────
#
# _assign_common() always tries to bind a "subtitle" slot to the first
# non-title placeholder.  For layouts without an explicit SUBTITLE-type
# placeholder (Title and Content, Two Content, Comparison, Picture with
# Caption) this consumes the content placeholder.  The overrides below
# force the correct ppt_layout_name and content slot → idx bindings.

OVERRIDES: dict = {
    "layouts": {
        # ── "Title Slide" based (SUBTITLE idx=1, so _assign_common is fine) ──

        # closing_end: matched via ruleset alias; append optional fields to idx=1
        "closing_end": {
            "slots": {
                "message": {"idx": 1, "kind": "text"},
                "contact": {"idx": 1, "kind": "text"},
                "cta":     {"idx": 1, "kind": "text"},
            },
        },

        # ── "Title and Content" based (OBJECT idx=1 wrongly consumed as subtitle) ──

        # agenda / list_basic: force layout name + bind items to idx=1
        "agenda": {
            "ppt_layout_name": "Title and Content",
            "slots": {"items": {"idx": 1, "kind": "list"}},
        },
        "list_basic": {
            "ppt_layout_name": "Title and Content",
            "slots": {"items": {"idx": 1, "kind": "list"}},
        },
        # table_basic
        "table_basic": {
            "ppt_layout_name": "Title and Content",
            "slots": {"table": {"idx": 1, "kind": "table"}},
        },
        # chart_basic
        "chart_basic": {
            "ppt_layout_name": "Title and Content",
            "slots": {"chart": {"idx": 1, "kind": "chart"}},
        },
        # kpi_big_number: all metric fields appended to idx=1
        "kpi_big_number": {
            "ppt_layout_name": "Title and Content",
            "slots": {
                "metric.value":      {"idx": 1, "kind": "text"},
                "metric.label":      {"idx": 1, "kind": "text"},
                "metric.unit":       {"idx": 1, "kind": "text"},
                "metric.delta":      {"idx": 1, "kind": "text"},
                "supporting_points": {"idx": 1, "kind": "list"},
            },
        },
        # timeline: all events appended to idx=1
        "timeline": {
            "ppt_layout_name": "Title and Content",
            "slots": {
                **{f"events[{i}].combined_text": {"idx": 1, "kind": "text"} for i in range(8)}
            },
        },
        # appendix_backup: all content slots mapped to idx=1
        "appendix_backup": {
            "ppt_layout_name": "Title and Content",
            "slots": {
                "body":       {"idx": 1, "kind": "text"},
                "items":      {"idx": 1, "kind": "list"},
                "references": {"idx": 1, "kind": "list"},
            },
        },
        # eol_notice: all detail fields mapped to idx=1
        "eol_notice": {
            "ppt_layout_name": "Title and Content",
            "slots": {
                "product_name":   {"idx": 1, "kind": "text"},
                "end_of_sale":    {"idx": 1, "kind": "text"},
                "end_of_support": {"idx": 1, "kind": "text"},
                "replacement":    {"idx": 1, "kind": "text"},
                "actions":        {"idx": 1, "kind": "list"},
            },
        },

        # ── "Comparison" based (BODY idx=1 consumed as subtitle, so re-map) ──
        # comparison_2col: "Comparison" auto-selected (0.98), fix broken left.* binding
        "comparison_2col": {
            "slots": {
                "left.title":       {"idx": 1, "kind": "text"},
                "left.description": {"idx": 2, "kind": "text"},
                "right.title":      {"idx": 3, "kind": "text"},
                "right.description": {"idx": 4, "kind": "text"},
            },
        },

        # ── "Two Content" based ──
        # three_cards_vertical: 2 cards in left column, 1 in right
        "three_cards_vertical": {
            "ppt_layout_name": "Two Content",
            "slots": {
                "title":                  {"idx": 0, "kind": "text"},
                "cards[0].combined_text": {"idx": 1, "kind": "text"},
                "cards[1].combined_text": {"idx": 1, "kind": "text"},
                "cards[2].combined_text": {"idx": 2, "kind": "text"},
            },
        },
        # three_cards_horizontal: 1 card in left, 2 in right
        "three_cards_horizontal": {
            "ppt_layout_name": "Two Content",
            "slots": {
                "title":                  {"idx": 0, "kind": "text"},
                "cards[0].combined_text": {"idx": 1, "kind": "text"},
                "cards[1].combined_text": {"idx": 2, "kind": "text"},
                "cards[2].combined_text": {"idx": 2, "kind": "text"},
            },
        },

        # ── "Picture with Caption" based ──
        # image_caption: icon → PICTURE(idx=1), caption → BODY(idx=2)
        "image_caption": {
            "ppt_layout_name": "Picture with Caption",
            "slots": {
                "title":   {"idx": 0, "kind": "text"},
                "icon":    {"idx": 1, "kind": "icon"},
                "caption": {"idx": 2, "kind": "text"},
            },
        },
    }
}


# ── manifest generation ────────────────────────────────────────────────────


def build_manifest(template_bytes: bytes) -> dict:
    inspection = inspect_template(template_bytes)

    print(f"  Inspected {len(inspection['layouts'])} layouts:")
    for lay in inspection["layouts"]:
        idxs = [str(p["placeholder_idx"]) for p in lay["placeholders"]]
        print(f"    [{lay['layout_index']}] {lay['layout_name']!r}  idx={idxs}")

    # "closing_end" aliases don't match any default layout name, so we add
    # "title_slide" as a custom alias so it scores 0.98 against "Title Slide".
    ruleset = {"aliases": {"closing_end": ["title_slide"]}}

    proposal = propose_mapping(inspection, ruleset)

    print(f"\n  Proposal covers {len(proposal['layouts'])} / 15 semantics:")
    for sem, binding in sorted(proposal["layouts"].items()):
        slots_list = list(binding.get("slots", {}).keys())
        print(
            f"    {sem:<28} → {binding['ppt_layout_name']!r:<24}"
            f" ({binding['match_confidence']:.2f})  slots={slots_list}"
        )

    manifest = finalize_manifest(inspection, proposal, OVERRIDES)
    print(f"\n  Manifest finalised: {len(manifest['layouts'])} layouts.")
    return manifest


# ── main ───────────────────────────────────────────────────────────────────


def main() -> None:
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

    print("Building template…")
    template_bytes = build_template()
    PPTX_OUT.write_bytes(template_bytes)
    print(f"  Saved {PPTX_OUT.name}  ({len(template_bytes):,} bytes)\n")

    print("Building manifest…")
    manifest = build_manifest(template_bytes)
    JSON_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"  Saved {JSON_OUT.name}\n")

    print("Done ✓")


if __name__ == "__main__":
    main()
