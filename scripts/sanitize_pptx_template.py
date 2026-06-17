#!/usr/bin/env python3
"""Sanitize a PowerPoint template before registering it as a server template."""

from __future__ import annotations

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from xml.etree import ElementTree as ET
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

import msoffcrypto

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from pptx_yaml_engine.mapper.service import generate_manifest, validate_manifest  # noqa: E402

CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

SENSITIVE_TERMS = (
    "SB",
    "SoftBank",
    "softbank",
    "ソフトバンク",
    "向山",
    "裕一朗",
    "法人事業統括",
)

REMOVED_PARTS = {
    "docProps/thumbnail.jpeg",
    "docProps/custom.xml",
}

REJECTED_PART_PREFIXES = (
    "customXml/",
    "ppt/comments",
    "ppt/commentAuthors",
    "ppt/people",
    "ppt/notesSlides/",
    "ppt/notesMasters/",
    "ppt/vbaProject.bin",
    "ppt/embeddings/",
    "ppt/printerSettings/",
)


def _core_properties_xml() -> bytes:
    return (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        b'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        b'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        b'xmlns:dcterms="http://purl.org/dc/terms/" '
        b'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        b'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        b"<dc:title/>"
        b"<dc:subject/>"
        b"<dc:creator/>"
        b"<cp:keywords/>"
        b"<dc:description/>"
        b"<cp:lastModifiedBy/>"
        b"<cp:revision>1</cp:revision>"
        b"<cp:category/>"
        b"</cp:coreProperties>"
    )


def _app_properties_xml() -> bytes:
    return (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        b'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        b'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        b"<TotalTime>0</TotalTime>"
        b"<Words>0</Words>"
        b"<Application/>"
        b"<PresentationFormat/>"
        b"<Paragraphs>0</Paragraphs>"
        b"<Slides>0</Slides>"
        b"<Notes>0</Notes>"
        b"<HiddenSlides>0</HiddenSlides>"
        b"<MMClips>0</MMClips>"
        b"<ScaleCrop>false</ScaleCrop>"
        b"<Manager/>"
        b"<Company/>"
        b"<LinksUpToDate>false</LinksUpToDate>"
        b"<SharedDoc>false</SharedDoc>"
        b"<HyperlinkBase/>"
        b"<HyperlinksChanged>false</HyperlinksChanged>"
        b"<AppVersion/>"
        b"</Properties>"
    )


def _is_removed_relationship(target: str, rel_type: str) -> bool:
    normalized_target = target.lstrip("/")
    return (
        normalized_target in REMOVED_PARTS
        or rel_type.endswith("/metadata/thumbnail")
        or rel_type.endswith("/custom-properties")
    )


def _sanitize_package_relationships(data: bytes) -> bytes:
    ET.register_namespace("", REL_NS)
    root = ET.fromstring(data)
    for rel in list(root):
        target = rel.attrib.get("Target", "")
        rel_type = rel.attrib.get("Type", "")
        if _is_removed_relationship(target, rel_type):
            root.remove(rel)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _sanitize_content_types(data: bytes) -> bytes:
    ET.register_namespace("", CONTENT_TYPES_NS)
    root = ET.fromstring(data)
    removed_part_names = {f"/{part}" for part in REMOVED_PARTS}
    for child in list(root):
        part_name = child.attrib.get("PartName")
        if part_name in removed_part_names:
            root.remove(child)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _decrypt_office_package(path: Path, password: str | None) -> bytes:
    if password is None:
        raise SystemExit(
            f"{path} is not a readable OOXML zip. If it is encrypted, rerun with --password to decrypt it before sanitizing."
        )

    decrypted = BytesIO()
    try:
        with path.open("rb") as source:
            office_file = msoffcrypto.OfficeFile(source)
            if not office_file.is_encrypted():
                raise SystemExit(f"{path} is not a readable OOXML zip and does not appear to be encrypted.")
            office_file.load_key(password=password)
            office_file.decrypt(decrypted)
    except SystemExit:
        raise
    except Exception as exc:
        raise SystemExit(f"Failed to decrypt {path}. Check the password and Office encryption format.") from exc
    return decrypted.getvalue()


def _read_template_bytes(path: Path, password: str | None) -> tuple[bytes, bool]:
    raw = path.read_bytes()
    try:
        with ZipFile(BytesIO(raw)) as archive:
            names = set(archive.namelist())
    except BadZipFile:
        return _decrypt_office_package(path, password), True

    if {"EncryptionInfo", "EncryptedPackage"} & names:
        if password is None:
            raise SystemExit(f"{path} appears to be encrypted. Rerun with --password to decrypt it before sanitizing.")
        return _decrypt_office_package(path, password), True
    return raw, False


def _assert_no_unsupported_parts(package_bytes: bytes) -> None:
    try:
        with ZipFile(BytesIO(package_bytes)) as archive:
            names = set(archive.namelist())
    except BadZipFile as exc:
        raise SystemExit("Decrypted package is not a readable OOXML zip.") from exc

    rejected = sorted(name for name in names for prefix in REJECTED_PART_PREFIXES if name.startswith(prefix))
    if rejected:
        raise SystemExit(
            "Template contains hidden/comment/macro/embedded parts that must be removed manually first: "
            + ", ".join(rejected[:20])
        )


def _sanitize_pptx_bytes(path: Path, password: str | None) -> tuple[bytes, bool]:
    package_bytes, decrypted = _read_template_bytes(path, password)
    _assert_no_unsupported_parts(package_bytes)
    output = BytesIO()
    with ZipFile(BytesIO(package_bytes)) as source, ZipFile(output, "w", ZIP_DEFLATED) as target:
        for item in source.infolist():
            name = item.filename
            if name in REMOVED_PARTS:
                continue
            data = source.read(name)
            if name == "docProps/core.xml":
                data = _core_properties_xml()
            elif name == "docProps/app.xml":
                data = _app_properties_xml()
            elif name == "_rels/.rels":
                data = _sanitize_package_relationships(data)
            elif name == "[Content_Types].xml":
                data = _sanitize_content_types(data)
            target.writestr(item, data)
    return output.getvalue(), decrypted


def _scan_sensitive_terms(package_bytes: bytes, terms: tuple[str, ...]) -> list[dict[str, str]]:
    hits: list[dict[str, str]] = []
    with ZipFile(BytesIO(package_bytes)) as archive:
        for name in archive.namelist():
            data = archive.read(name)
            for term in terms:
                if term.encode("utf-8") in data:
                    hits.append({"part": name, "term": term, "encoding": "utf-8"})
                if term.encode("utf-16le") in data:
                    hits.append({"part": name, "term": term, "encoding": "utf-16le"})
    return hits


def _write_atomic(path: Path, data: bytes) -> None:
    with NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def _validate_template(package_bytes: bytes) -> dict[str, object]:
    manifest = generate_manifest(package_bytes)
    report = validate_manifest(package_bytes, manifest)
    if not report["valid"]:
        raise SystemExit(f"Sanitized template does not satisfy the AI_* contract: {report['issues']}")
    return manifest


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove identifying metadata from a PPTX/POTX template in-place.")
    parser.add_argument("pptx", type=Path, help="Path to the .pptx or .potx template to sanitize in-place")
    parser.add_argument(
        "--password",
        help="Password for an encrypted Office package. If provided, the template is decrypted before sanitizing.",
    )
    parser.add_argument(
        "--sensitive-term",
        action="append",
        default=[],
        help="Additional term that must not remain in the sanitized package. May be repeated.",
    )
    parser.add_argument(
        "--no-manifest",
        action="store_true",
        help="Do not refresh a sibling <stem>.manifest.json file even if it exists.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    path = args.pptx.expanduser().resolve()
    if path.suffix.lower() not in {".pptx", ".potx"}:
        raise SystemExit("Template path must end with .pptx or .potx")
    if not path.exists():
        raise SystemExit(f"Template not found: {path}")

    sanitized, decrypted = _sanitize_pptx_bytes(path, args.password)
    terms = tuple(dict.fromkeys((*SENSITIVE_TERMS, *args.sensitive_term)))
    hits = _scan_sensitive_terms(sanitized, terms)
    if hits:
        raise SystemExit("Sensitive terms remain after sanitization: " + json.dumps(hits, ensure_ascii=False))

    manifest = _validate_template(sanitized)
    _write_atomic(path, sanitized)

    manifest_path = path.with_suffix(".manifest.json")
    wrote_manifest = False
    if manifest_path.exists() and not args.no_manifest:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        wrote_manifest = True

    print(
        json.dumps(
            {
                "sanitized": str(path),
                "decrypted": decrypted,
                "manifest_updated": wrote_manifest,
                "layouts": sorted(manifest["layouts"].keys()),
                "removed_parts": sorted(REMOVED_PARTS),
                "sensitive_terms_checked": list(terms),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
