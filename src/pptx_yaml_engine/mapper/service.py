from __future__ import annotations

from collections import defaultdict
from io import BytesIO
from typing import Any, cast

from pptx import Presentation

from pptx_yaml_engine.errors import DomainError, error_dict
from pptx_yaml_engine.layouts import LAYOUT_ALIASES, LAYOUT_SPECS, SlotSpec, get_slot_spec
from pptx_yaml_engine.utils.fingerprint import template_fingerprint
from pptx_yaml_engine.utils.layout_names import (
    canonical_builtin_layout_name,
    layout_names_match,
    normalize_layout_lookup_name,
)
from pptx_yaml_engine.utils.pptx import placeholder_type_name
from pptx_yaml_engine.utils.template_bytes import normalize_template_for_python_pptx


def inspect_template(template_bytes: bytes) -> dict[str, Any]:
    try:
        prs = Presentation(BytesIO(normalize_template_for_python_pptx(template_bytes)))
    except Exception as exc:
        raise DomainError("TEMPLATE_OPEN_FAILED", "Unable to open template as a PowerPoint file") from exc

    if len(prs.slide_layouts) == 0:
        raise DomainError("NO_LAYOUTS_FOUND", "Template has no slide layouts")

    slide_width = int(cast(Any, prs.slide_width))
    slide_height = int(cast(Any, prs.slide_height))
    layouts: list[dict[str, Any]] = []

    for layout_index, layout in enumerate(prs.slide_layouts):
        shapes: list[dict[str, Any]] = []
        for shape in layout.shapes:
            left = int(getattr(shape, "left", 0) or 0)
            top = int(getattr(shape, "top", 0) or 0)
            width = int(getattr(shape, "width", 0) or 0)
            height = int(getattr(shape, "height", 0) or 0)
            shape_info: dict[str, Any] = {
                "shape_name": getattr(shape, "name", ""),
                "is_placeholder": bool(getattr(shape, "is_placeholder", False)),
                "left": left,
                "top": top,
                "width": width,
                "height": height,
                "norm_left": left / slide_width if slide_width else 0,
                "norm_top": top / slide_height if slide_height else 0,
                "norm_width": width / slide_width if slide_width else 0,
                "norm_height": height / slide_height if slide_height else 0,
                "norm_center_x": (left + width / 2) / slide_width if slide_width else 0,
                "norm_center_y": (top + height / 2) / slide_height if slide_height else 0,
            }
            if shape_info["is_placeholder"]:
                placeholder_format = shape.placeholder_format
                shape_info.update(
                    {
                        "placeholder_idx": int(placeholder_format.idx),
                        "placeholder_type": placeholder_type_name(placeholder_format.type),
                    }
                )
            shapes.append(shape_info)

        layouts.append(
            {
                "layout_name": layout.name,
                "builtin_layout_name": canonical_builtin_layout_name(layout.name),
                "layout_index": layout_index,
                "shapes": shapes,
                "placeholders": [shape for shape in shapes if shape["is_placeholder"]],
            }
        )

    return {
        "version": 1,
        "template_fingerprint": template_fingerprint(template_bytes),
        "slide_width_emu": slide_width,
        "slide_height_emu": slide_height,
        "layouts": layouts,
    }


def _norm(value: str) -> str:
    return (
        value.lower()
        .replace("yaml__", "")
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
    )


def _slot_from_shape_name(name: str) -> str | None:
    lowered = _norm(name)
    for prefix in ("slot__", "slot_", "placeholder__", "placeholder_"):
        if lowered.startswith(prefix):
            lowered = lowered[len(prefix) :]
            break
    else:
        return None

    direct = {
        "section_no": "section_no",
        "product_name": "product_name",
        "end_of_sale": "end_of_sale",
        "end_of_support": "end_of_support",
        "list_style": "list_style",
        "supporting_points": "supporting_points",
    }
    if lowered in direct:
        return direct[lowered]

    lowered = lowered.replace("card_1_", "cards[0].")
    lowered = lowered.replace("card_2_", "cards[1].")
    lowered = lowered.replace("card_3_", "cards[2].")
    lowered = lowered.replace("event_1_", "events[0].")
    lowered = lowered.replace("event_2_", "events[1].")
    lowered = lowered.replace("event_3_", "events[2].")
    lowered = lowered.replace("event_4_", "events[3].")
    lowered = lowered.replace("event_5_", "events[4].")
    lowered = lowered.replace("event_6_", "events[5].")
    lowered = lowered.replace("event_7_", "events[6].")
    lowered = lowered.replace("event_8_", "events[7].")
    lowered = lowered.replace("left_", "left.")
    lowered = lowered.replace("right_", "right.")
    lowered = lowered.replace("metric_", "metric.")
    return lowered


def _shape_kind(shape: dict[str, Any], slot_spec: SlotSpec | None = None) -> str:
    if slot_spec is not None:
        return slot_spec.kind
    ph_type = str(shape.get("placeholder_type", "")).upper()
    if "PICTURE" in ph_type:
        return "icon"
    if "TABLE" in ph_type:
        return "table"
    if "CHART" in ph_type:
        return "chart"
    return "text"


def _placeholder_binding(shape: dict[str, Any], *, kind: str) -> dict[str, Any]:
    return {
        "kind": kind,
        "placeholder": {
            "idx": shape["placeholder_idx"],
            "type": shape.get("placeholder_type", "UNKNOWN"),
            "shape_name": shape.get("shape_name", ""),
        },
    }


def _score_layout(layout: dict[str, Any], semantic: str, aliases: tuple[str, ...]) -> tuple[float, str]:
    layout_name = normalize_layout_lookup_name(str(layout["layout_name"]))
    semantic_norm = normalize_layout_lookup_name(semantic)
    alias_norms = {normalize_layout_lookup_name(alias) for alias in aliases}
    placeholders = layout.get("placeholders", [])
    shape_names = " ".join(_norm(str(shape.get("shape_name", ""))) for shape in placeholders)
    types = [str(shape.get("placeholder_type", "")).upper() for shape in placeholders]
    type_counts = {kind: sum(1 for value in types if kind in value) for kind in ("TITLE", "SUBTITLE", "BODY", "OBJECT", "PICTURE", "TABLE", "CHART")}

    if layout_name == semantic_norm:
        return 0.99, "semantic_name"
    if layout_name in alias_norms or any(alias in layout_name for alias in alias_norms):
        return 0.98, "explicit_name"
    if semantic.replace("_", "") in shape_names.replace("_", ""):
        return 0.86, "shape_name_hint"
    if semantic in {"cover_title", "section_divider"} and type_counts["TITLE"] >= 1:
        return 0.72, "placeholder_geometry"
    if semantic in {"agenda", "list_basic", "appendix_backup"} and type_counts["TITLE"] >= 1 and (type_counts["BODY"] + type_counts["OBJECT"]) >= 1:
        return 0.74, "placeholder_geometry"
    if semantic == "comparison_2col" and type_counts["TITLE"] >= 1 and len(placeholders) >= 3:
        return 0.78, "placeholder_geometry"
    if semantic.startswith("three_cards") and type_counts["TITLE"] >= 1 and len(placeholders) >= 4:
        return 0.76, "placeholder_geometry"
    if semantic in {"table_basic", "chart_basic", "image_caption"} and type_counts["TITLE"] >= 1:
        return 0.70, "placeholder_geometry"
    return 0.0, "not_matched"


def _top_title(placeholders: list[dict[str, Any]]) -> dict[str, Any] | None:
    title_shapes = [shape for shape in placeholders if "TITLE" in str(shape.get("placeholder_type", "")).upper()]
    if title_shapes:
        return sorted(title_shapes, key=lambda item: (item["norm_top"], item["norm_left"]))[0]
    if placeholders:
        return sorted(placeholders, key=lambda item: (item["norm_top"], item["norm_left"]))[0]
    return None


def _subtitle(
    placeholders: list[dict[str, Any]], title_idx: int | None, *, allow_fallback: bool = False
) -> dict[str, Any] | None:
    subtitle_shapes = [shape for shape in placeholders if "SUBTITLE" in str(shape.get("placeholder_type", "")).upper()]
    if subtitle_shapes:
        return sorted(subtitle_shapes, key=lambda item: (item["norm_top"], item["norm_left"]))[0]
    if not allow_fallback:
        return None
    candidates = [shape for shape in placeholders if shape.get("placeholder_idx") != title_idx]
    if candidates:
        return sorted(candidates, key=lambda item: (item["norm_top"], item["norm_left"]))[0]
    return None


def _content_shapes(placeholders: list[dict[str, Any]], excluded: set[int]) -> list[dict[str, Any]]:
    return [
        shape
        for shape in placeholders
        if shape.get("placeholder_idx") not in excluded
        and "DATE" not in str(shape.get("placeholder_type", "")).upper()
        and "FOOTER" not in str(shape.get("placeholder_type", "")).upper()
        and "SLIDE_NUMBER" not in str(shape.get("placeholder_type", "")).upper()
    ]


def _assign_common(semantic: str, slots: dict[str, Any], placeholders: list[dict[str, Any]]) -> set[int]:
    used: set[int] = set()
    title = _top_title(placeholders)
    if title is not None:
        slots["title"] = _placeholder_binding(title, kind="text")
        used.add(int(title["placeholder_idx"]))
    subtitle = _subtitle(
        placeholders,
        next(iter(used), None),
        allow_fallback=semantic in {"section_divider"},
    )
    if subtitle is not None and subtitle.get("placeholder_idx") not in used:
        slots["subtitle"] = _placeholder_binding(subtitle, kind="text")
        used.add(int(subtitle["placeholder_idx"]))
    return used


def _bind_named_slots(layout_name: str, placeholders: list[dict[str, Any]]) -> dict[str, Any]:
    slots: dict[str, Any] = {}
    for shape in placeholders:
        slot_path = _slot_from_shape_name(str(shape.get("shape_name", "")))
        if slot_path is None:
            continue
        slot_spec = get_slot_spec(layout_name, slot_path)
        if slot_spec is None:
            continue
        slots[slot_path] = _placeholder_binding(shape, kind=slot_spec.kind)
    return slots


def _bind_generic(semantic: str, placeholders: list[dict[str, Any]]) -> dict[str, Any]:
    slots = _bind_named_slots(semantic, placeholders)
    used = {int(binding["placeholder"]["idx"]) for binding in slots.values()}
    used.update(_assign_common(semantic, slots, placeholders))
    content = _content_shapes(placeholders, used)
    textish = [shape for shape in content if _shape_kind(shape) == "text"]
    iconish = [shape for shape in content if _shape_kind(shape) == "icon"]
    tableish = [shape for shape in content if _shape_kind(shape) == "table"]
    chartish = [shape for shape in content if _shape_kind(shape) == "chart"]

    def bind_first(path: str, shapes: list[dict[str, Any]], kind: str) -> None:
        if path not in slots and shapes:
            slots[path] = _placeholder_binding(shapes.pop(0), kind=kind)

    def bind_same(path: str, shape: dict[str, Any] | None, kind: str) -> None:
        if path not in slots and shape is not None:
            slots[path] = _placeholder_binding(shape, kind=kind)

    def bind_from_existing(path: str, existing_path: str, *, kind: str | None = None) -> None:
        existing = slots.get(existing_path)
        if path in slots or existing is None:
            return
        slots[path] = {
            "kind": kind or existing["kind"],
            "placeholder": dict(existing["placeholder"]),
        }

    primary_text = textish[0] if textish else (content[0] if content else None)
    secondary_text = textish[1] if len(textish) > 1 else None
    primary_visual = content[0] if content else None

    if semantic in {"agenda", "list_basic"}:
        bind_same("items", primary_text, "list")
    elif semantic == "table_basic":
        bind_same("table", tableish[0] if tableish else (textish[0] if textish else primary_visual), "table")
        bind_same("caption", secondary_text, "text")
    elif semantic == "chart_basic":
        bind_same("chart", chartish[0] if chartish else (textish[0] if textish else primary_visual), "chart")
        bind_same("caption", secondary_text, "text")
    elif semantic == "image_caption":
        bind_same("icon", iconish[0] if iconish else (textish[0] if textish else primary_visual), "icon")
        bind_same("caption", primary_text, "text")
        bind_same("attribution", secondary_text, "text")
    elif semantic == "comparison_2col":
        grouped = sorted(content, key=lambda item: item["norm_center_x"])
        left = sorted(grouped[: max(1, len(grouped) // 2)], key=lambda item: item["norm_center_y"])
        right = sorted(grouped[max(1, len(grouped) // 2) :], key=lambda item: item["norm_center_y"])
        for side, shapes in (("left", left), ("right", right)):
            icons = [shape for shape in shapes if _shape_kind(shape) == "icon"]
            texts = [shape for shape in shapes if _shape_kind(shape) != "icon"]
            bind_first(f"{side}.icon", icons, "icon")
            bind_first(f"{side}.title", texts, "text")
            bind_first(f"{side}.description", texts, "text")
            bind_first(f"{side}.bullets", texts, "list")
    elif semantic.startswith("three_cards"):
        grouped = sorted(content, key=lambda item: item["norm_center_x"])
        if len(grouped) >= 3:
            chunk = max(1, (len(grouped) + 2) // 3)
            groups = [grouped[index * chunk : (index + 1) * chunk] for index in range(3)]
            for index, shapes in enumerate(groups):
                ordered = sorted(shapes, key=lambda item: item["norm_center_y"])
                icons = [shape for shape in ordered if _shape_kind(shape) == "icon"]
                texts = [shape for shape in ordered if _shape_kind(shape) != "icon"]
                bind_first(f"cards[{index}].icon", icons, "icon")
                if len(texts) >= 2:
                    bind_first(f"cards[{index}].title", texts, "text")
                    bind_first(f"cards[{index}].description", texts, "text")
                elif texts:
                    bind_first(f"cards[{index}].combined_text", texts, "text")
        elif len(grouped) == 2:
            left_shape, right_shape = grouped
            mapping = (
                [(0, left_shape), (1, left_shape), (2, right_shape)]
                if semantic == "three_cards_vertical"
                else [(0, left_shape), (1, right_shape), (2, right_shape)]
            )
            for index, shape in mapping:
                bind_same(f"cards[{index}].combined_text", shape, "text")
        elif len(grouped) == 1:
            for index in range(3):
                bind_same(f"cards[{index}].combined_text", grouped[0], "text")
    elif semantic == "appendix_backup":
        bind_same("body", primary_text, "text")
        bind_from_existing("items", "body", kind="list")
        bind_same("references", secondary_text or primary_text, "list")
    elif semantic in {"cover_title", "section_divider", "closing_end"}:
        for path in ("date", "organization", "author", "section_no", "message", "contact", "cta"):
            bind_same(path, primary_text, "text")

    return slots


def generate_manifest(
    template_bytes: bytes,
    ruleset: dict[str, Any] | None = None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    inspection = inspect_template(template_bytes)
    proposal = propose_mapping(inspection, ruleset)
    return finalize_manifest(inspection, proposal, overrides)


def _required_missing(semantic: str, slots: dict[str, Any]) -> list[str]:
    spec = LAYOUT_SPECS[semantic]
    missing: list[str] = []
    for slot in spec.slots:
        if not slot.required:
            continue
        if slot.path in slots:
            continue
        if slot.path.endswith(".title") or slot.path.endswith(".description"):
            combined = slot.path.rsplit(".", 1)[0] + ".combined_text"
            if combined in slots:
                continue
        missing.append(slot.path)
    return missing


def propose_mapping(
    inspection: dict[str, Any], ruleset: dict[str, Any] | None = None
) -> dict[str, Any]:
    aliases = {key: tuple(value) for key, value in LAYOUT_ALIASES.items()}
    if ruleset and isinstance(ruleset.get("aliases"), dict):
        for key, values in ruleset["aliases"].items():
            if key in aliases and isinstance(values, list):
                aliases[key] = tuple([*aliases[key], *[str(value) for value in values]])

    layouts = inspection.get("layouts", [])
    proposal_layouts: dict[str, Any] = {}

    for semantic in LAYOUT_SPECS:
        scored = [
            (*_score_layout(layout, semantic, aliases[semantic]), layout)
            for layout in layouts
        ]
        scored.sort(key=lambda item: item[0], reverse=True)
        score, strategy, best_layout = scored[0] if scored else (0.0, "not_matched", None)
        if best_layout is None or score == 0:
            continue
        placeholders = list(best_layout.get("placeholders", []))
        slots = _bind_generic(semantic, placeholders)
        missing = _required_missing(semantic, slots)
        confidence = max(0.0, min(0.99, score - len(missing) * 0.08))
        proposal_layouts[semantic] = {
            "ppt_layout_name": best_layout["layout_name"],
            "match_confidence": round(confidence, 4),
            "layout_match": {"strategy": strategy},
            "slots": slots,
            "required_missing": missing,
            "warnings": [
                f"Required slot '{slot}' is unresolved" for slot in missing
            ],
            "status": "override_required" if confidence < 0.75 or missing else "ready",
        }

    return {
        "version": 1,
        "template_fingerprint": inspection.get("template_fingerprint"),
        "layouts": proposal_layouts,
    }


def _merge_override(layout_binding: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = {
        **layout_binding,
        "layout_match": dict(layout_binding.get("layout_match", {})),
        "slots": {key: dict(value) for key, value in layout_binding.get("slots", {}).items()},
    }
    if "ppt_layout_name" in override:
        merged["ppt_layout_name"] = override["ppt_layout_name"]
        merged["layout_match"] = {"strategy": "override"}
    for slot_path, slot_override in override.get("slots", {}).items():
        if not isinstance(slot_override, dict):
            continue
        existing = merged["slots"].get(slot_path, {"kind": "text", "placeholder": {}})
        placeholder = dict(existing.get("placeholder", {}))
        if "idx" in slot_override:
            placeholder["idx"] = slot_override["idx"]
        if "type" in slot_override:
            placeholder["type"] = slot_override["type"]
        if "shape_name" in slot_override:
            placeholder["shape_name"] = slot_override["shape_name"]
        merged["slots"][slot_path] = {
            "kind": slot_override.get("kind", existing.get("kind", "text")),
            "placeholder": placeholder,
        }
    return merged


def finalize_manifest(
    inspection: dict[str, Any], proposal: dict[str, Any], overrides: dict[str, Any] | None = None
) -> dict[str, Any]:
    layout_overrides = (overrides or {}).get("layouts", {}) if isinstance(overrides, dict) else {}
    manifest_layouts: dict[str, Any] = {}

    for semantic, binding in proposal.get("layouts", {}).items():
        if semantic not in LAYOUT_SPECS:
            continue
        merged = _merge_override(binding, layout_overrides.get(semantic, {}))
        missing = _required_missing(semantic, merged.get("slots", {}))
        if missing:
            raise DomainError(
                "REQUIRED_SLOT_MISSING",
                f"Required slots are unresolved for layout '{semantic}'",
                {"layout": semantic, "missing": missing},
            )
        manifest_layouts[semantic] = {
            "ppt_layout_name": merged["ppt_layout_name"],
            "match_confidence": merged.get("match_confidence", 0),
            "layout_match": merged.get("layout_match", {}),
            "slots": merged.get("slots", {}),
        }

    manifest = {
        "manifest_version": 1,
        "template_fingerprint": inspection.get("template_fingerprint"),
        "layouts": manifest_layouts,
    }
    report = validate_manifest_against_inspection(inspection, manifest)
    if not report["valid"]:
        raise DomainError("MANIFEST_VALIDATION_FAILED", "Manifest does not match template inspection", {"issues": report["issues"]})
    return manifest


def validate_manifest_against_inspection(inspection: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    for semantic, binding in manifest.get("layouts", {}).items():
        exact_matches = [layout for layout in inspection.get("layouts", []) if layout.get("layout_name") == binding.get("ppt_layout_name")]
        if exact_matches:
            matches = exact_matches
        else:
            matches = [
                layout
                for layout in inspection.get("layouts", [])
                if layout_names_match(str(layout.get("layout_name", "")), str(binding.get("ppt_layout_name", "")))
            ]
        if not matches:
            issues.append(error_dict("PPT_LAYOUT_NOT_FOUND", "PowerPoint layout not found", {"layout": semantic, "ppt_layout_name": binding.get("ppt_layout_name")}))
            continue
        if len(matches) > 1:
            issues.append(
                error_dict(
                    "DUPLICATE_LAYOUT_NAME",
                    "PowerPoint layout name is duplicated",
                    {"layout": semantic, "ppt_layout_name": binding.get("ppt_layout_name")},
                )
            )
            continue
        layout = matches[0]
        idx_to_type = {
            placeholder["placeholder_idx"]: placeholder.get("placeholder_type")
            for placeholder in layout.get("placeholders", [])
        }
        for slot_path, slot in binding.get("slots", {}).items():
            idx = slot.get("placeholder", {}).get("idx")
            if idx not in idx_to_type:
                issues.append(error_dict("PLACEHOLDER_IDX_NOT_FOUND", "Placeholder idx not found", {"layout": semantic, "slot": slot_path, "idx": idx}))
    return {"valid": not issues, "issues": issues}


def validate_manifest(template_bytes: bytes, manifest: dict[str, Any]) -> dict[str, Any]:
    inspection = inspect_template(template_bytes)
    issues: list[dict[str, Any]] = []
    if manifest.get("template_fingerprint") != inspection.get("template_fingerprint"):
        issues.append(
            error_dict(
                "TEMPLATE_FINGERPRINT_MISMATCH",
                "Manifest fingerprint does not match template",
                {
                    "expected": manifest.get("template_fingerprint"),
                    "actual": inspection.get("template_fingerprint"),
                },
            )
        )
    issues.extend(validate_manifest_against_inspection(inspection, manifest)["issues"])
    return {"valid": not issues, "issues": issues}


def layout_placeholder_counts(inspection: dict[str, Any]) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}
    for layout in inspection.get("layouts", []):
        type_counts: defaultdict[str, int] = defaultdict(int)
        for placeholder in layout.get("placeholders", []):
            type_counts[str(placeholder.get("placeholder_type", "UNKNOWN"))] += 1
        counts[layout["layout_name"]] = dict(type_counts)
    return counts
