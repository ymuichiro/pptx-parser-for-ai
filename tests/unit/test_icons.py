from __future__ import annotations

import pytest

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.icons.registry import list_icons, resolve_icon


def test_lists_builtin_icons() -> None:
    result = list_icons(pack="heroicons", query="cloud")
    assert "cloud-arrow-up" in result["packs"]["heroicons"]


def test_resolves_icon_to_png_bytes() -> None:
    data = resolve_icon({"pack": "heroicons", "name": "cloud-arrow-up"}, target_px=64)
    assert data.startswith(b"\x89PNG")


def test_invalid_icon_name_errors() -> None:
    with pytest.raises(DomainError) as exc:
        resolve_icon({"pack": "heroicons", "name": "missing-icon"}, target_px=64)
    assert exc.value.code == "ICON_NAME_NOT_FOUND"
