"""Unit tests for TemplateRegistry."""

from __future__ import annotations

from pathlib import Path

import pytest

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.layouts import LAYOUT_SPECS
from pptx_yaml_engine.server.template_registry import DEFAULT_TEMPLATE_NAME, TemplateRegistry
from pptx_yaml_engine.utils.fingerprint import template_fingerprint
import pptx_yaml_engine.server.template_registry as template_registry_module


def _write_template(directory: Path, stem: str, template_bytes: bytes, suffix: str = ".pptx") -> None:
    (directory / f"{stem}{suffix}").write_bytes(template_bytes)


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


def test_load_single_template(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, "corporate", template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert warnings == []
    assert len(registry) == 1
    entry = registry.get("corporate")
    assert entry is not None
    assert entry.name == "corporate"
    assert entry.description == "corporate"
    assert sorted(entry.supported_layouts) == sorted(LAYOUT_SPECS.keys())


def test_load_normalises_name_to_lowercase(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, "Corporate", template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    assert registry.get("corporate") is not None
    assert registry.get("Corporate") is not None
    assert registry.get(" Corporate ") is not None


def test_get_default_returns_default_template(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, DEFAULT_TEMPLATE_NAME, template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    entry = registry.get_default()
    assert entry is not None
    assert entry.name == DEFAULT_TEMPLATE_NAME


def test_resolve_blank_or_missing_name_uses_default(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, DEFAULT_TEMPLATE_NAME, template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    assert registry.resolve(None) == registry.get_default()
    assert registry.resolve("") == registry.get_default()
    assert registry.resolve("   ") == registry.get_default()


def test_resolve_explicit_name_prefers_named_template(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, DEFAULT_TEMPLATE_NAME, template_bytes)
    _write_template(tmp_path, "named", template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    entry = registry.resolve("named")
    assert entry is not None
    assert entry.name == "named"


def test_list_returns_all_templates(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, "alpha", template_bytes)
    _write_template(tmp_path, "beta", template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()

    names = {t["name"] for t in registry.list()}
    assert names == {"alpha", "beta"}


def test_get_unknown_returns_none(tmp_path: Path) -> None:
    registry = TemplateRegistry(str(tmp_path))
    registry.load()
    assert registry.get("missing") is None


def test_load_potx_file(tmp_path: Path) -> None:
    from tests.conftest import make_potx_bytes

    potx_bytes = make_potx_bytes()
    stem = "potx_template"
    _write_template(tmp_path, stem, potx_bytes, suffix=".potx")

    registry = TemplateRegistry(str(tmp_path))
    warnings = registry.load()

    assert warnings == []
    assert registry.get(stem) is not None


def test_load_raises_for_invalid_template_file(tmp_path: Path) -> None:
    (tmp_path / "broken.pptx").write_bytes(b"not-a-powerpoint")
    registry = TemplateRegistry(str(tmp_path))

    with pytest.raises(DomainError) as exc:
        registry.load()

    assert exc.value.code == "TEMPLATE_REGISTRY_LOAD_FAILED"


def test_load_raises_for_duplicate_normalized_name(tmp_path: Path, template_bytes: bytes) -> None:
    from tests.conftest import make_potx_bytes

    potx_bytes = make_potx_bytes()
    _write_template(tmp_path, "dup", potx_bytes, suffix=".potx")
    _write_template(tmp_path, "dup", template_bytes, suffix=".pptx")

    registry = TemplateRegistry(str(tmp_path))

    with pytest.raises(DomainError) as exc:
        registry.load()

    assert exc.value.code == "DUPLICATE_TEMPLATE_NAME"


def test_load_raises_for_template_layout_contract_mismatch(
    tmp_path: Path, template_bytes: bytes, monkeypatch: pytest.MonkeyPatch
) -> None:
    _write_template(tmp_path, "contract_mismatch", template_bytes)

    def fake_generate_manifest(template_bytes: bytes) -> dict[str, object]:
        return {
            "manifest_version": 1,
            "template_fingerprint": template_fingerprint(template_bytes),
            "layouts": {
                "cover_title": {
                    "ppt_layout_name": "Title Slide",
                    "match_confidence": 0.98,
                    "layout_match": {"strategy": "explicit_name"},
                    "slots": {},
                }
            },
        }

    monkeypatch.setattr(template_registry_module, "generate_manifest", fake_generate_manifest)

    registry = TemplateRegistry(str(tmp_path))
    with pytest.raises(DomainError) as exc:
        registry.load()

    assert exc.value.code == "TEMPLATE_REGISTRY_LOAD_FAILED"
    assert exc.value.details["cause"]["code"] == "TEMPLATE_LAYOUT_CONTRACT_MISMATCH"


def test_load_raises_when_mapping_generation_fails(
    tmp_path: Path, template_bytes: bytes, monkeypatch: pytest.MonkeyPatch
) -> None:
    _write_template(tmp_path, "mapping_failure", template_bytes)

    def fake_generate_manifest(_template_bytes: bytes) -> dict[str, object]:
        raise DomainError(
            "REQUIRED_SLOT_MISSING",
            "Required slots are unresolved for layout 'agenda'",
            {"layout": "agenda", "missing": ["items"]},
        )

    monkeypatch.setattr(template_registry_module, "generate_manifest", fake_generate_manifest)

    registry = TemplateRegistry(str(tmp_path))
    with pytest.raises(DomainError) as exc:
        registry.load()

    assert exc.value.code == "TEMPLATE_REGISTRY_LOAD_FAILED"
    assert exc.value.details["cause"]["code"] == "REQUIRED_SLOT_MISSING"


def test_reload_clears_previous_entries(tmp_path: Path, template_bytes: bytes) -> None:
    _write_template(tmp_path, "first", template_bytes)

    registry = TemplateRegistry(str(tmp_path))
    registry.load()
    assert len(registry) == 1

    (tmp_path / "first.pptx").unlink()
    registry.load()

    assert len(registry) == 0
