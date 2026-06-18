from __future__ import annotations

import io
import re
from collections.abc import Iterable
from contextlib import closing
from importlib.resources import files
from typing import Any, cast
from zipfile import ZipFile

from PIL import Image, ImageDraw

from pptx_yaml_engine.errors import DomainError

COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
DEFAULT_COLOR = "#111827"
DEFAULT_VARIANT = "outline"
MAX_ICON_PX = 512


def _svg(label: str, paths: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
        f'stroke-linejoin="round"><title>{label}</title>{paths}</svg>'
    )


COMMON_SVGS: dict[str, str] = {
    "archive-box": _svg("archive-box", '<path d="M4 7h16"/><path d="M5 7l1 13h12l1-13"/><path d="M3 3h18v4H3z"/><path d="M9 11h6"/>'),
    "calendar": _svg("calendar", '<path d="M7 3v4"/><path d="M17 3v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/>'),
    "chart-bar": _svg("chart-bar", '<path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/>'),
    "check-circle": _svg("check-circle", '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>'),
    "cloud-arrow-up": _svg("cloud-arrow-up", '<path d="M12 13V5"/><path d="M8.5 8.5L12 5l3.5 3.5"/><path d="M7 18a5 5 0 0 1 .8-9.9A6 6 0 0 1 19 10.5a4 4 0 0 1-1 7.5H7z"/>'),
    "cog-6-tooth": _svg("cog-6-tooth", '<circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.9 4.9l2.1 2.1"/><path d="M17 17l2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.9 19.1L7 17"/><path d="M17 7l2.1-2.1"/>'),
    "document-text": _svg("document-text", '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6"/><path d="M9 16h6"/>'),
    "exclamation-triangle": _svg("exclamation-triangle", '<path d="M12 3l10 18H2z"/><path d="M12 9v5"/><path d="M12 18h.01"/>'),
    "inbox-arrow-down": _svg("inbox-arrow-down", '<path d="M12 3v9"/><path d="M8 8l4 4 4-4"/><path d="M4 14l2-8h12l2 8v5H4z"/><path d="M4 14h5l1.5 2h3L15 14h5"/>'),
    "paper-airplane": _svg("paper-airplane", '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'),
    "photo": _svg("photo", '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="M21 16l-5-5-4 4-2-2-5 5"/>'),
    "presentation-chart-line": _svg("presentation-chart-line", '<path d="M3 4h18"/><path d="M5 4v12h14V4"/><path d="M8 20l4-4 4 4"/><path d="M8 13l3-3 2 2 3-5"/>'),
    "sparkles": _svg("sparkles", '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
    "table-cells": _svg("table-cells", '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18"/><path d="M9 5v14"/><path d="M15 5v14"/>'),
    "wrench-screwdriver": _svg("wrench-screwdriver", '<path d="M14 6l4-4 4 4-4 4z"/><path d="M4 20l8-8"/><path d="M2 13a5 5 0 0 0 7-7L6 9 4 7l3-3a5 5 0 0 0-5 9z"/>'),
}

LUCIDE_ALIASES: dict[str, str] = {
    "archive": "archive-box",
    "calendar": "calendar",
    "chart-bar": "chart-bar",
    "check-circle": "check-circle",
    "cloud-upload": "cloud-arrow-up",
    "cog": "cog-6-tooth",
    "file-text": "document-text",
    "image": "photo",
    "inbox": "inbox-arrow-down",
    "send": "paper-airplane",
    "sparkles": "sparkles",
    "table": "table-cells",
    "triangle-alert": "exclamation-triangle",
    "wrench": "wrench-screwdriver",
}

SUPPORTED_PACKS = ("heroicons", "lucide")
SUPPORTED_VARIANTS: dict[str, tuple[str, ...]] = {
    "heroicons": ("outline", "solid", "mini", "micro"),
    "lucide": ("outline",),
}


def _names_for_pack(pack: str) -> Iterable[str]:
    if pack == "heroicons":
        names = _zip_icon_names("heroicons", "heroicons.zip", "outline/")
        return names or COMMON_SVGS.keys()
    if pack == "lucide":
        names = _zip_icon_names("lucide", "lucide.zip", "")
        return names or LUCIDE_ALIASES.keys()
    return ()


def _zip_icon_names(package: str, zip_file_name: str, prefix: str) -> list[str]:
    try:
        zip_data = (files(package) / zip_file_name).open("rb")
        with closing(zip_data), ZipFile(zip_data, "r") as zip_file:
            names = []
            for entry in zip_file.namelist():
                if not entry.endswith(".svg") or not entry.startswith(prefix):
                    continue
                name = entry[len(prefix) : -4]
                if "/" not in name:
                    names.append(name)
            return sorted(names)
    except Exception:
        return []


def list_icons(pack: str | None = None, variant: str | None = None, query: str | None = None) -> dict[str, Any]:
    packs = [pack] if pack else list(SUPPORTED_PACKS)
    result: dict[str, list[str]] = {}
    needle = query.lower() if query else None

    for pack_name in packs:
        if pack_name not in SUPPORTED_PACKS:
            raise DomainError("ICON_PACK_UNSUPPORTED", f"icon pack '{pack_name}' is not supported", {"pack": pack_name})
        if variant is not None and variant not in SUPPORTED_VARIANTS[pack_name]:
            raise DomainError("ICON_VARIANT_INVALID", f"variant '{variant}' is not valid for pack '{pack_name}'", {"pack": pack_name, "variant": variant})
        names = sorted(_names_for_pack(pack_name))
        if needle:
            names = [name for name in names if needle in name]
        result[pack_name] = names

    return {"packs": result, "defaultPack": "heroicons", "defaultVariant": DEFAULT_VARIANT}


def _normalize_icon_ref(icon_ref: dict[str, Any]) -> tuple[str, str, str, str, str | None, float]:
    if not isinstance(icon_ref, dict):
        raise DomainError("ICON_REF_INVALID", "icon must be an object", {"received": type(icon_ref).__name__})
    pack = icon_ref.get("pack")
    name = icon_ref.get("name")
    if not isinstance(pack, str) or not pack:
        raise DomainError("ICON_REF_INVALID", "icon.pack is required", {"field": "pack"})
    if not isinstance(name, str) or not name:
        raise DomainError("ICON_REF_INVALID", "icon.name is required", {"field": "name"})
    if pack not in SUPPORTED_PACKS:
        raise DomainError("ICON_PACK_UNSUPPORTED", f"icon pack '{pack}' is not supported", {"pack": pack})
    variant = icon_ref.get("variant") or DEFAULT_VARIANT
    if not isinstance(variant, str) or variant not in SUPPORTED_VARIANTS[pack]:
        raise DomainError("ICON_VARIANT_INVALID", f"variant '{variant}' is not valid for pack '{pack}'", {"pack": pack, "variant": variant})
    color = icon_ref.get("color") or DEFAULT_COLOR
    if not isinstance(color, str) or not COLOR_RE.match(color):
        raise DomainError("ICON_COLOR_INVALID", "icon.color must be #RRGGBB", {"color": color})
    background = icon_ref.get("background_color")
    if background is not None and (not isinstance(background, str) or not COLOR_RE.match(background)):
        raise DomainError("ICON_COLOR_INVALID", "icon.background_color must be #RRGGBB", {"background_color": background})
    padding = icon_ref.get("padding_ratio", 0.12)
    if not isinstance(padding, int | float) or padding < 0 or padding > 0.45:
        raise DomainError("ICON_REF_INVALID", "icon.padding_ratio must be between 0 and 0.45", {"padding_ratio": padding})
    return pack, name, variant, color, background, float(padding)


def _svg_for_icon(pack: str, name: str, color: str) -> str:
    if pack == "heroicons":
        return _heroicon_svg(name, color)
    if pack == "lucide":
        return _lucide_svg(name, color)
    source_name = LUCIDE_ALIASES.get(name, name) if pack == "lucide" else name
    svg = COMMON_SVGS.get(source_name)
    if svg is None:
        raise DomainError("ICON_NAME_NOT_FOUND", f"icon '{name}' not found in pack '{pack}'", {"pack": pack, "name": name})
    return svg.replace("currentColor", color)


def _with_xmlns(svg: str) -> str:
    if "xmlns=" in svg:
        return svg
    return svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)


def _heroicon_svg(name: str, color: str, variant: str = DEFAULT_VARIANT) -> str:
    try:
        import heroicons

        attrs: dict[str, object] = {"fill": "none", "stroke": color}
        if variant in {"solid", "mini", "micro"}:
            attrs = {"fill": color, "stroke": "none"}
        return _with_xmlns(heroicons._render_icon(variant, name, None, attrs))  # type: ignore[attr-defined,no-any-return]
    except Exception:
        svg = COMMON_SVGS.get(name)
        if svg is None:
            raise DomainError(
                "ICON_NAME_NOT_FOUND",
                f"icon '{name}' not found in pack 'heroicons'",
                {"pack": "heroicons", "name": name},
            ) from None
        return svg.replace("currentColor", color)


def _lucide_svg(name: str, color: str) -> str:
    try:
        import lucide

        return _with_xmlns(
            lucide._render_icon(name, None, color=color, stroke=color)  # type: ignore[attr-defined,no-any-return]
        )
    except Exception:
        source_name = LUCIDE_ALIASES.get(name, name)
        svg = COMMON_SVGS.get(source_name)
        if svg is None:
            raise DomainError(
                "ICON_NAME_NOT_FOUND",
                f"icon '{name}' not found in pack 'lucide'",
                {"pack": "lucide", "name": name},
            ) from None
        return svg.replace("currentColor", color)


def _generic_icon_box(size: int, padding_ratio: float) -> tuple[float, float, float, float]:
    pad = int(size * padding_ratio)
    return (float(pad), float(pad), float(size - pad), float(size - pad))


def _draw_generic_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    draw.rounded_rectangle((left, top, right, bottom), radius=max(4, int((right - left) * 0.16)), outline=color, width=stroke)
    draw.line(
        (
            left + (right - left) * 0.18,
            top + (bottom - top) * 0.62,
            left + (right - left) * 0.43,
            top + (bottom - top) * 0.78,
            left + (right - left) * 0.78,
            top + (bottom - top) * 0.28,
        ),
        fill=color,
        width=stroke,
    )


def _draw_chart_bar_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    baseline = bottom - (bottom - top) * 0.1
    draw.line((left, baseline, right, baseline), fill=color, width=stroke)
    widths = (0.16, 0.16, 0.16)
    heights = (0.34, 0.58, 0.82)
    gap = (right - left) * 0.12
    cursor = left + (right - left) * 0.08
    for width_ratio, height_ratio in zip(widths, heights, strict=False):
        bar_width = (right - left) * width_ratio
        bar_top = top + (bottom - top) * (1 - height_ratio)
        draw.rectangle((cursor, bar_top, cursor + bar_width, baseline), outline=color, width=stroke)
        cursor += bar_width + gap


def _draw_sparkles_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    cx = left + (right - left) * 0.42
    cy = top + (bottom - top) * 0.42
    size = (right - left) * 0.24
    draw.line((cx, cy - size, cx, cy + size), fill=color, width=stroke)
    draw.line((cx - size, cy, cx + size, cy), fill=color, width=stroke)
    draw.line((cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7), fill=color, width=stroke)
    draw.line((cx - size * 0.7, cy + size * 0.7, cx + size * 0.7, cy - size * 0.7), fill=color, width=stroke)
    sx = left + (right - left) * 0.74
    sy = top + (bottom - top) * 0.72
    small = size * 0.45
    draw.line((sx, sy - small, sx, sy + small), fill=color, width=max(1, stroke - 1))
    draw.line((sx - small, sy, sx + small, sy), fill=color, width=max(1, stroke - 1))


def _draw_cloud_arrow_up_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    cloud_top = top + height * 0.34
    cloud_bottom = top + height * 0.74
    draw.arc((left + width * 0.06, cloud_top + height * 0.12, left + width * 0.42, cloud_bottom), start=160, end=350, fill=color, width=stroke)
    draw.arc((left + width * 0.26, cloud_top - height * 0.04, left + width * 0.66, cloud_bottom), start=180, end=360, fill=color, width=stroke)
    draw.arc((left + width * 0.5, cloud_top + height * 0.08, right - width * 0.02, cloud_bottom), start=190, end=20, fill=color, width=stroke)
    draw.line((left + width * 0.16, cloud_bottom * 0.99, right - width * 0.12, cloud_bottom * 0.99), fill=color, width=stroke)
    center_x = left + width * 0.5
    arrow_top = top + height * 0.12
    arrow_bottom = top + height * 0.56
    draw.line((center_x, arrow_bottom, center_x, arrow_top + height * 0.08), fill=color, width=stroke)
    draw.line((center_x, arrow_top + height * 0.08, center_x - width * 0.12, arrow_top + height * 0.22), fill=color, width=stroke)
    draw.line((center_x, arrow_top + height * 0.08, center_x + width * 0.12, arrow_top + height * 0.22), fill=color, width=stroke)


def _draw_beaker_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    neck_left = left + width * 0.38
    neck_right = left + width * 0.62
    shoulder_left = left + width * 0.2
    shoulder_right = left + width * 0.8
    neck_bottom = top + height * 0.38
    lip_y = top + height * 0.1
    body_bottom = bottom - height * 0.06
    draw.line((neck_left, lip_y, neck_right, lip_y), fill=color, width=stroke)
    draw.line((neck_left, lip_y, neck_left, neck_bottom), fill=color, width=stroke)
    draw.line((neck_right, lip_y, neck_right, neck_bottom), fill=color, width=stroke)
    points = [
        (neck_left, neck_bottom),
        (shoulder_left, body_bottom),
        (shoulder_right, body_bottom),
        (neck_right, neck_bottom),
    ]
    draw.line([*points, points[0]], fill=color, width=stroke)
    draw.arc((shoulder_left, body_bottom - height * 0.16, shoulder_right, body_bottom + height * 0.08), start=0, end=180, fill=color, width=stroke)
    liquid_y = top + height * 0.68
    draw.line((left + width * 0.28, liquid_y, right - width * 0.28, liquid_y), fill=color, width=max(1, stroke - 1))
    draw.ellipse((left + width * 0.4, top + height * 0.46, left + width * 0.47, top + height * 0.53), outline=color, width=max(1, stroke - 1))
    draw.ellipse((left + width * 0.56, top + height * 0.57, left + width * 0.65, top + height * 0.66), outline=color, width=max(1, stroke - 1))


def _draw_shield_check_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    points = [
        (left + width * 0.5, top + height * 0.08),
        (right - width * 0.14, top + height * 0.22),
        (right - width * 0.22, top + height * 0.68),
        (left + width * 0.5, bottom - height * 0.08),
        (left + width * 0.22, top + height * 0.68),
        (left + width * 0.14, top + height * 0.22),
    ]
    draw.line([*points, points[0]], fill=color, width=stroke)
    draw.line(
        (
            left + width * 0.34,
            top + height * 0.52,
            left + width * 0.46,
            top + height * 0.64,
            left + width * 0.68,
            top + height * 0.38,
        ),
        fill=color,
        width=stroke,
    )


def _draw_clipboard_document_check_fallback(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    *,
    color: str,
    stroke: int,
) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    draw.rounded_rectangle((left + width * 0.18, top + height * 0.18, right - width * 0.18, bottom - height * 0.06), radius=max(3, int(width * 0.07)), outline=color, width=stroke)
    draw.rounded_rectangle((left + width * 0.34, top + height * 0.06, right - width * 0.34, top + height * 0.24), radius=max(2, int(width * 0.04)), outline=color, width=stroke)
    draw.line((left + width * 0.36, top + height * 0.42, right - width * 0.34, top + height * 0.42), fill=color, width=max(1, stroke - 1))
    draw.line((left + width * 0.36, top + height * 0.56, right - width * 0.38, top + height * 0.56), fill=color, width=max(1, stroke - 1))
    draw.line(
        (
            left + width * 0.36,
            top + height * 0.72,
            left + width * 0.45,
            top + height * 0.81,
            right - width * 0.32,
            top + height * 0.62,
        ),
        fill=color,
        width=stroke,
    )


def _draw_command_line_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    draw.rounded_rectangle((left + width * 0.04, top + height * 0.16, right - width * 0.04, bottom - height * 0.16), radius=max(4, int(width * 0.08)), outline=color, width=stroke)
    draw.line((left + width * 0.04, top + height * 0.32, right - width * 0.04, top + height * 0.32), fill=color, width=stroke)
    prompt_x = left + width * 0.22
    prompt_y = top + height * 0.58
    draw.line(
        (
            prompt_x,
            prompt_y - height * 0.12,
            prompt_x + width * 0.14,
            prompt_y,
            prompt_x,
            prompt_y + height * 0.12,
        ),
        fill=color,
        width=stroke,
    )
    draw.line((left + width * 0.5, top + height * 0.68, right - width * 0.22, top + height * 0.68), fill=color, width=stroke)


def _draw_calendar_days_fallback(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], *, color: str, stroke: int) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    draw.rounded_rectangle((left + width * 0.08, top + height * 0.16, right - width * 0.08, bottom - height * 0.08), radius=max(4, int(width * 0.08)), outline=color, width=stroke)
    draw.line((left + width * 0.08, top + height * 0.34, right - width * 0.08, top + height * 0.34), fill=color, width=stroke)
    draw.line((left + width * 0.28, top + height * 0.08, left + width * 0.28, top + height * 0.24), fill=color, width=stroke)
    draw.line((right - width * 0.28, top + height * 0.08, right - width * 0.28, top + height * 0.24), fill=color, width=stroke)
    dot = max(2, int(width * 0.035))
    for row_y in (0.5, 0.66, 0.82):
        for col_x in (0.28, 0.5, 0.72):
            cx = left + width * col_x
            cy = top + height * row_y
            draw.ellipse((cx - dot, cy - dot, cx + dot, cy + dot), fill=color)


def _draw_presentation_chart_line_fallback(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    *,
    color: str,
    stroke: int,
) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    screen_top = top + height * 0.16
    screen_bottom = top + height * 0.66
    draw.line((left + width * 0.1, screen_top, right - width * 0.1, screen_top), fill=color, width=stroke)
    draw.rectangle((left + width * 0.16, screen_top, right - width * 0.16, screen_bottom), outline=color, width=stroke)
    draw.line(
        (
            left + width * 0.28,
            screen_bottom - height * 0.12,
            left + width * 0.42,
            screen_bottom - height * 0.26,
            left + width * 0.56,
            screen_bottom - height * 0.18,
            right - width * 0.28,
            screen_top + height * 0.16,
        ),
        fill=color,
        width=stroke,
    )
    stand_x = left + width * 0.5
    draw.line((stand_x, screen_bottom, stand_x, bottom - height * 0.12), fill=color, width=stroke)
    draw.line((stand_x, bottom - height * 0.12, left + width * 0.34, bottom - height * 0.02), fill=color, width=stroke)
    draw.line((stand_x, bottom - height * 0.12, right - width * 0.34, bottom - height * 0.02), fill=color, width=stroke)


FALLBACK_DRAWERS = {
    "beaker": _draw_beaker_fallback,
    "calendar-days": _draw_calendar_days_fallback,
    "chart-bar": _draw_chart_bar_fallback,
    "clipboard-document-check": _draw_clipboard_document_check_fallback,
    "cloud-arrow-up": _draw_cloud_arrow_up_fallback,
    "command-line": _draw_command_line_fallback,
    "presentation-chart-line": _draw_presentation_chart_line_fallback,
    "shield-check": _draw_shield_check_fallback,
    "sparkles": _draw_sparkles_fallback,
}


def _fallback_png(name: str, size: int, color: str, background: str | None, padding_ratio: float) -> bytes:
    image = Image.new("RGBA", (size, size), background or (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    stroke = max(2, size // 18)
    drawer = FALLBACK_DRAWERS.get(name, _draw_generic_fallback)
    drawer(draw, _generic_icon_box(size, padding_ratio), color=color, stroke=stroke)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def resolve_icon(icon_ref: dict[str, Any], target_px: int = MAX_ICON_PX) -> bytes:
    pack, name, variant, color, background, padding = _normalize_icon_ref(icon_ref)
    size = max(16, min(MAX_ICON_PX, int(target_px)))
    svg = _heroicon_svg(name, color, variant) if pack == "heroicons" else _svg_for_icon(pack, name, color)
    try:
        import cairosvg

        return cast(
            bytes,
            cairosvg.svg2png(
                bytestring=svg.encode("utf-8"),
                output_width=size,
                output_height=size,
            ),
        )
    except Exception:
        fallback_name = name if pack == "heroicons" else LUCIDE_ALIASES.get(name, name)
        return _fallback_png(fallback_name, size, color, background, padding)
