from __future__ import annotations

import unicodedata

MICROSOFT_BUILTIN_LAYOUT_ALIASES: dict[str, tuple[str, ...]] = {
    "title_slide": (
        "Title Slide",
        "タイトル スライド",
    ),
    "title_and_content": (
        "Title and Content",
        "タイトルとコンテンツ",
    ),
    "section_header": (
        "Section Header",
        "セクション ヘッダー",
    ),
    "two_content": (
        "Two Content",
        "2 つのコンテンツ",
        "2つのコンテンツ",
    ),
    "comparison": (
        "Comparison",
        "比較",
    ),
    "title_only": (
        "Title Only",
        "タイトルのみ",
    ),
    "blank": (
        "Blank",
        "白紙",
    ),
    "content_with_caption": (
        "Content with Caption",
        "説明付きのコンテンツ",
    ),
    "picture_with_caption": (
        "Picture with Caption",
        "説明付きの図",
    ),
}


def _layout_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    normalized = normalized.replace("&", "and").replace("yaml__", "")
    for token in (" ", "\u3000", "_", "-", "/", "\\", ".", ",", ":", ";", "(", ")", "（", "）", "[", "]", "{", "}", "・"):
        normalized = normalized.replace(token, "")
    return normalized


_BUILTIN_LAYOUT_LOOKUP = {
    _layout_key(alias): canonical
    for canonical, aliases in MICROSOFT_BUILTIN_LAYOUT_ALIASES.items()
    for alias in (canonical, *aliases)
}


def canonical_builtin_layout_name(value: str) -> str | None:
    if not value:
        return None
    return _BUILTIN_LAYOUT_LOOKUP.get(_layout_key(value))


def normalize_layout_lookup_name(value: str) -> str:
    builtin = canonical_builtin_layout_name(value)
    if builtin is not None:
        return builtin

    normalized = unicodedata.normalize("NFKC", value or "").casefold().replace("yaml__", "")
    for token in (" ", "\u3000", "-", "/", "\\"):
        normalized = normalized.replace(token, "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def layout_names_match(left: str, right: str) -> bool:
    return normalize_layout_lookup_name(left) == normalize_layout_lookup_name(right)
