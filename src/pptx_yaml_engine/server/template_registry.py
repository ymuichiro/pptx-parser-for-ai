"""Server-managed template registry.

Templates are ``.pptx`` or ``.potx`` files placed in the configured
``TEMPLATE_DIR`` directory by the operator. At startup, the server inspects
each template, generates a strict manifest in memory from PowerPoint layout
names plus authoritative ``AI_*`` placeholder names, validates it, and reuses
that generated mapping for all later render requests.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.layouts import LAYOUT_SPECS
from pptx_yaml_engine.mapper.service import generate_manifest
from pptx_yaml_engine.utils.fingerprint import template_fingerprint

logger = logging.getLogger(__name__)

_TEMPLATE_SUFFIXES = {".pptx", ".potx"}
DEFAULT_TEMPLATE_NAME = "default"


@dataclass(frozen=True, slots=True)
class TemplateEntry:
    """A successfully loaded, fingerprint-validated template."""

    name: str
    description: str
    template_bytes: bytes
    manifest: dict[str, Any]
    supported_layouts: list[str] = field(default_factory=list)


class TemplateRegistry:
    """In-memory registry of operator-provided templates.

    Call :meth:`load` once during application startup (inside the lifespan
    context) to populate the registry. Invalid templates raise immediately so
    startup can fail fast instead of silently skipping bad files.
    """

    def __init__(self, template_dir: str) -> None:
        self._dir = Path(template_dir)
        self._entries: dict[str, TemplateEntry] = {}

    @staticmethod
    def normalize_name(name: str | None) -> str | None:
        """Normalize a caller-supplied template name.

        ``None``, empty strings, and whitespace-only strings normalize to
        ``None`` so callers can distinguish "no explicit template requested"
        from an actual template lookup key.
        """
        if name is None:
            return None
        normalized = name.strip().lower()
        return normalized or None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def _build_entry(self, template_path: Path) -> TemplateEntry:
        template_bytes = template_path.read_bytes()
        manifest = generate_manifest(template_bytes)
        supported_layouts = sorted(manifest.get("layouts", {}).keys())
        expected_layouts = sorted(LAYOUT_SPECS.keys())
        if supported_layouts != expected_layouts:
            raise DomainError(
                "TEMPLATE_LAYOUT_CONTRACT_MISMATCH",
                f"Template '{template_path.name}' does not satisfy the required semantic layout contract.",
                {
                    "template": template_path.name,
                    "expected": expected_layouts,
                    "actual": supported_layouts,
                },
            )
        return TemplateEntry(
            name=self.normalize_name(template_path.stem) or template_path.stem.lower(),
            description=self.normalize_name(template_path.stem) or template_path.stem.lower(),
            template_bytes=template_bytes,
            manifest=manifest,
            supported_layouts=supported_layouts,
        )

    def load(self) -> list[str]:
        """Scan *template_dir* and populate the registry.

        Returns an empty list when loading succeeds. Invalid templates raise
        immediately so application startup can fail fast.
        """
        warnings: list[str] = []
        self._entries.clear()

        if not self._dir.exists():
            logger.info("Template directory %s does not exist — no templates loaded.", self._dir)
            return warnings

        seen_names: set[str] = set()
        candidates = sorted(p for p in self._dir.iterdir() if p.suffix in _TEMPLATE_SUFFIXES)

        for pptx_path in candidates:
            norm_name = self.normalize_name(pptx_path.stem)
            assert norm_name is not None  # stems from filenames are never blank

            if norm_name in seen_names:
                raise DomainError(
                    "DUPLICATE_TEMPLATE_NAME",
                    f"Duplicate template name '{norm_name}' detected during startup.",
                    {"template": pptx_path.name, "normalized": norm_name},
                )

            try:
                entry = self._build_entry(pptx_path)
            except DomainError as exc:
                raise DomainError(
                    "TEMPLATE_REGISTRY_LOAD_FAILED",
                    f"Failed to load template '{pptx_path.name}' during startup.",
                    {"template": pptx_path.name, "cause": exc.to_dict()},
                ) from exc
            except Exception as exc:
                raise DomainError(
                    "TEMPLATE_REGISTRY_LOAD_FAILED",
                    f"Failed to load template '{pptx_path.name}' during startup.",
                    {"template": pptx_path.name, "cause": str(exc)},
                ) from exc

            actual_fp = template_fingerprint(entry.template_bytes)
            if entry.manifest.get("template_fingerprint") != actual_fp:
                raise DomainError(
                    "TEMPLATE_FINGERPRINT_MISMATCH",
                    f"Generated manifest fingerprint does not match template '{pptx_path.name}'.",
                    {
                        "template": pptx_path.name,
                        "expected": entry.manifest.get("template_fingerprint"),
                        "actual": actual_fp,
                    },
                )

            self._entries[norm_name] = entry
            seen_names.add(norm_name)
            logger.info("Loaded template '%s' (%d layouts).", norm_name, len(entry.supported_layouts))

        return warnings

    def list(self) -> list[dict[str, Any]]:
        """Return summary info for all loaded templates."""
        return [
            {
                "name": entry.name,
                "description": entry.description,
                "supported_layouts": entry.supported_layouts,
            }
            for entry in self._entries.values()
        ]

    def get(self, name: str | None) -> TemplateEntry | None:
        """Return the entry for *name* (case-insensitive), or ``None``."""
        normalized = self.normalize_name(name)
        if normalized is None:
            return None
        return self._entries.get(normalized)

    def get_default(self) -> TemplateEntry | None:
        """Return the configured default template entry, if present."""
        return self._entries.get(DEFAULT_TEMPLATE_NAME)

    def resolve(self, name: str | None) -> TemplateEntry | None:
        """Resolve a template name, falling back to ``default`` when omitted."""
        normalized = self.normalize_name(name)
        if normalized is None:
            return self.get_default()
        return self._entries.get(normalized)

    def __len__(self) -> int:
        return len(self._entries)
