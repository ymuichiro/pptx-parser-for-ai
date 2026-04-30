"""Unit tests for TemplateRegistry."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pptx_yaml_engine.server.template_registry import DEFAULT_TEMPLATE_NAME, TemplateRegistry
from pptx_yaml_engine.utils.fingerprint import template_fingerprint


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_manifest(template_bytes: bytes, *, description: str = "Test template") -> dict[str, Any]:
    """Build a minimal but valid manifest with a correct fingerprint."""
    return {
        "template_fingerprint": template_fingerprint(template_bytes),
        "description": description,
        "layouts": {
            "cover_title": {
                "ppt_layout_name": "Title Slide",
                "slots": {"title": {"idx": 0, "type": "TITLE", "kind": "text"}},
            },
            "list_basic": {
                "ppt_layout_name": "Title and Content",
                "slots": {
                    "title": {"idx": 0, "type": "TITLE", "kind": "text"},
                    "items": {"idx": 1, "type": "BODY", "kind": "text"},
                },
            },
        },
    }


def _write_template(directory: Path, stem: str, template_bytes: bytes, manifest: dict[str, Any] | None = None) -> None:
    (directory / f"{stem}.pptx").write_bytes(template_bytes)
    if manifest is not None:
        (directory / f"{stem}.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


# ---------------------------------------------------------------------------
# Tests: empty / missing directory
# ---------------------------------------------------------------------------


def test_load_missing_directory(tmp_path: Path) -> None:
    registry = TemplateRegistry(str(tmp_path / "nonexistent"))
    warnings = registry.load()
    assert warnings == []
    assert registry.list() == []


def test_load_empty_directory(tmp_path: Path) -> None:
    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()
    assert warnings == []
    assert len(registry) == 0


# ---------------------------------------------------------------------------
# Tests: happy path
# ---------------------------------------------------------------------------


def test_load_single_template(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, "corporate", template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert warnings == []
    assert len(registry) == 1
    entry = registry.get("corporate")
    assert entry is not None
    assert entry.name == "corporate"
    assert entry.description == "Test template"
    assert sorted(entry.supported_layouts) == ["cover_title", "list_basic"]


def test_load_normalises_name_to_lowercase(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, "Corporate", template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    assert registry.get("corporate") is not None
    assert registry.get("Corporate") is not None
    assert registry.get(" Corporate ") is not None


def test_get_default_returns_default_template(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, DEFAULT_TEMPLATE_NAME, template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    entry = registry.get_default()
    assert entry is not None
    assert entry.name == DEFAULT_TEMPLATE_NAME


def test_resolve_blank_or_missing_name_uses_default(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, DEFAULT_TEMPLATE_NAME, template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    assert registry.resolve(None) == registry.get_default()
    assert registry.resolve("") == registry.get_default()
    assert registry.resolve("   ") == registry.get_default()


def test_resolve_explicit_name_prefers_named_template(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, DEFAULT_TEMPLATE_NAME, template_bytes, manifest)
    _write_template(tmp_path, "named", template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    entry = registry.resolve("named")
    assert entry is not None
    assert entry.name == "named"


def test_list_returns_all_templates(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, "alpha", template_bytes, manifest)
    _write_template(tmp_path, "beta", template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    names = {t["name"] for t in registry.list()}
    assert names == {"alpha", "beta"}


def test_get_unknown_returns_none(tmp_path: Path) -> None:
    registry = TemplateRegistry(str(tmp_path))
    registry.load()
    assert registry.get("missing") is None


# ---------------------------------------------------------------------------
# Tests: missing companion manifest
# ---------------------------------------------------------------------------


def test_skip_template_without_manifest(tmp_path: Path, template_bytes: bytes) -> None:
    (tmp_path / "orphan.pptx").write_bytes(template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert len(warnings) == 1
    assert "orphan.pptx" in warnings[0]
    assert len(registry) == 0


# ---------------------------------------------------------------------------
# Tests: stale / mismatched fingerprint
# ---------------------------------------------------------------------------


def test_skip_template_with_stale_manifest(tmp_path: Path, template_bytes: bytes) -> None:
    stale_manifest = _make_manifest(b"different content entirely")
    _write_template(tmp_path, "stale", template_bytes, stale_manifest)

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert len(warnings) == 1
    assert "stale.pptx" in warnings[0]
    assert "Fingerprint mismatch" in warnings[0]
    assert registry.get("stale") is None


# ---------------------------------------------------------------------------
# Tests: duplicate names
# ---------------------------------------------------------------------------


def test_skip_duplicate_normalized_name(tmp_path: Path, template_bytes: bytes) -> None:
    from tests.conftest import make_potx_bytes

    potx_bytes = make_potx_bytes()
    # dup.potx comes before dup.pptx alphabetically, so build the manifest
    # with the potx fingerprint so the first file loads cleanly.
    manifest = _make_manifest(potx_bytes)
    (tmp_path / "dup.potx").write_bytes(potx_bytes)
    (tmp_path / "dup.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "dup.pptx").write_bytes(template_bytes)
    # dup.pptx also resolves to norm_name "dup" → duplicate after dup.potx loads first

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert any("Duplicate" in w for w in warnings)
    assert len(registry) == 1


# ---------------------------------------------------------------------------
# Tests: potx support
# ---------------------------------------------------------------------------


def test_load_potx_file(tmp_path: Path) -> None:
    """Registry accepts .potx files in addition to .pptx."""
    from tests.conftest import make_potx_bytes

    potx_bytes = make_potx_bytes()
    manifest = _make_manifest(potx_bytes)
    stem = "potx_template"
    (tmp_path / f"{stem}.potx").write_bytes(potx_bytes)
    (tmp_path / f"{stem}.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert warnings == []
    assert registry.get(stem) is not None


# ---------------------------------------------------------------------------
# Tests: load idempotency (re-loading clears previous state)
# ---------------------------------------------------------------------------


def test_reload_clears_previous_entries(tmp_path: Path, template_bytes: bytes) -> None:
    manifest = _make_manifest(template_bytes)
    _write_template(tmp_path, "first", template_bytes, manifest)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()
    assert len(registry) == 1

    (tmp_path / "first.pptx").unlink()
    (tmp_path / "first.manifest.json").unlink()
    registry.load()

    assert len(registry) == 0
