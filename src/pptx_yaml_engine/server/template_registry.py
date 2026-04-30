"""Server-managed template registry.

Templates are ``.pptx`` or ``.potx`` files placed in the configured ``TEMPLATE_DIR``
directory by the operator.  Each template *must* have a companion
``<stem>.manifest.json`` file; if the manifest is absent or its fingerprint no
longer matches the template bytes the template is skipped at startup (a warning
is logged but the server continues normally).

Typical operator workflow
-------------------------
1. Prepare a template file, e.g. ``corporate.pptx``.
2. Run the operator tools (``inspect_template`` → ``propose_mapping`` →
   ``finalize_manifest``) to generate the manifest JSON.
3. Save the manifest as ``corporate.manifest.json`` next to the template.
4. Restart (or rebuild) the container so the registry picks up the new file.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pptx_yaml_engine.utils.fingerprint import template_fingerprint

logger = logging.getLogger(__name__)

_TEMPLATE_SUFFIXES = {".pptx", ".potx"}


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
    context) to populate the registry.  Failures for individual templates are
    logged at WARNING level and do not abort startup.
    """

    def __init__(self, template_dir: str) -> None:
        self._dir = Path(template_dir)
        self._entries: dict[str, TemplateEntry] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self) -> list[str]:
        """Scan *template_dir* and populate the registry.

        Returns a list of human-readable warning strings for templates that
        were skipped.  An empty list means all templates loaded cleanly.
        """
        warnings: list[str] = []
        self._entries.clear()

        if not self._dir.exists():
            logger.info("Template directory %s does not exist — no templates loaded.", self._dir)
            return warnings

        seen_names: set[str] = set()
        candidates = sorted(p for p in self._dir.iterdir() if p.suffix in _TEMPLATE_SUFFIXES)

        for pptx_path in candidates:
            norm_name = pptx_path.stem.lower()

            if norm_name in seen_names:
                msg = f"Duplicate template name '{norm_name}' (from {pptx_path.name}), skipping."
                logger.warning(msg)
                warnings.append(msg)
                continue

            manifest_path = pptx_path.with_suffix(".manifest.json")
            if not manifest_path.exists():
                msg = (
                    f"No companion manifest for {pptx_path.name} "
                    f"(expected {manifest_path.name}), skipping. "
                    "Generate one with inspect_template → propose_mapping → finalize_manifest."
                )
                logger.warning(msg)
                warnings.append(msg)
                continue

            try:
                template_bytes = pptx_path.read_bytes()
                manifest: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception as exc:
                msg = f"Failed to read {pptx_path.name}: {exc}"
                logger.warning(msg)
                warnings.append(msg)
                continue

            actual_fp = template_fingerprint(template_bytes)
            stored_fp = manifest.get("template_fingerprint", "")
            if stored_fp != actual_fp:
                msg = (
                    f"Fingerprint mismatch for {pptx_path.name} "
                    f"(manifest fingerprint {stored_fp!r} != actual {actual_fp!r}). "
                    "Regenerate the manifest after updating the template file."
                )
                logger.warning(msg)
                warnings.append(msg)
                continue

            supported_layouts = sorted(manifest.get("layouts", {}).keys())
            description = manifest.get("description", norm_name)
            entry = TemplateEntry(
                name=norm_name,
                description=description,
                template_bytes=template_bytes,
                manifest=manifest,
                supported_layouts=supported_layouts,
            )
            self._entries[norm_name] = entry
            seen_names.add(norm_name)
            logger.info("Loaded template '%s' (%d layouts).", norm_name, len(supported_layouts))

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

    def get(self, name: str) -> TemplateEntry | None:
        """Return the entry for *name* (case-insensitive), or ``None``."""
        return self._entries.get(name.lower())

    def __len__(self) -> int:
        return len(self._entries)
