from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import yaml  # type: ignore[import-untyped]

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.mapper.service import validate_manifest
from pptx_yaml_engine.output.service import render_pptx


def _read_bytes(path: Path, *, code: str, label: str) -> bytes:
    try:
        return path.read_bytes()
    except OSError as exc:
        raise DomainError(code, f"Unable to read {label}", {"path": str(path)}) from exc


def _read_text(path: Path, *, code: str, label: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise DomainError(code, f"Unable to read {label}", {"path": str(path)}) from exc


def load_manifest_json(manifest_path: Path) -> dict[str, Any]:
    raw = _read_text(manifest_path, code="MANIFEST_READ_FAILED", label="manifest file")
    try:
        manifest = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise DomainError(
            "MANIFEST_JSON_INVALID",
            "Manifest JSON is invalid",
            {"path": str(manifest_path), "line": exc.lineno, "column": exc.colno},
        ) from exc
    if not isinstance(manifest, dict):
        raise DomainError(
            "MANIFEST_JSON_INVALID",
            "Manifest JSON must decode to an object",
            {"path": str(manifest_path), "received": type(manifest).__name__},
        )
    return cast(dict[str, Any], manifest)


def load_deck_yaml(deck_path: Path) -> dict[str, Any]:
    raw = _read_text(deck_path, code="DECK_READ_FAILED", label="deck YAML file")
    try:
        deck = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        details: dict[str, Any] = {"path": str(deck_path)}
        if mark is not None:
            details["line"] = int(mark.line) + 1
            details["column"] = int(mark.column) + 1
        raise DomainError("DECK_YAML_INVALID", "Deck YAML is invalid", details) from exc
    if not isinstance(deck, dict):
        raise DomainError(
            "DECK_SCHEMA_INVALID",
            "Deck YAML must decode to an object",
            {"path": str(deck_path), "received": type(deck).__name__},
        )
    return cast(dict[str, Any], deck)


def render_pptx_from_assets(template_path: Path, manifest_path: Path, deck_path: Path) -> bytes:
    template_bytes = _read_bytes(template_path, code="TEMPLATE_READ_FAILED", label="template file")
    manifest = load_manifest_json(manifest_path)
    manifest_report = validate_manifest(template_bytes, manifest)
    if not manifest_report["valid"]:
        raise DomainError(
            "MANIFEST_VALIDATION_FAILED",
            "Manifest does not match template",
            {"issues": manifest_report["issues"], "template_path": str(template_path), "manifest_path": str(manifest_path)},
        )
    deck = load_deck_yaml(deck_path)
    return render_pptx(template_bytes, manifest, deck)


def write_output_pptx(output_path: Path, pptx_bytes: bytes) -> None:
    if output_path.exists() and output_path.is_dir():
        raise DomainError("OUTPUT_PATH_INVALID", "Output path points to a directory", {"path": str(output_path)})
    if not output_path.parent.exists():
        raise DomainError(
            "OUTPUT_PATH_INVALID",
            "Output directory does not exist",
            {"path": str(output_path.parent)},
        )
    try:
        output_path.write_bytes(pptx_bytes)
    except OSError as exc:
        raise DomainError("OUTPUT_WRITE_FAILED", "Unable to write output PPTX", {"path": str(output_path)}) from exc


def generate_pptx_from_paths(template_path: Path, manifest_path: Path, deck_path: Path, output_path: Path) -> Path:
    pptx_bytes = render_pptx_from_assets(template_path, manifest_path, deck_path)
    write_output_pptx(output_path, pptx_bytes)
    return output_path
