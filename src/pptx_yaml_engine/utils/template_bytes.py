from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

POTX_MAIN_CONTENT_TYPE = (
    b"application/vnd.openxmlformats-officedocument.presentationml.template.main+xml"
)
PPTX_MAIN_CONTENT_TYPE = (
    b"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
)


def normalize_template_for_python_pptx(template_bytes: bytes) -> bytes:
    """Return bytes python-pptx can open without changing external fingerprinting."""
    try:
        source = BytesIO(template_bytes)
        output = BytesIO()
        changed = False
        with ZipFile(source, "r") as zin, ZipFile(output, "w", ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "[Content_Types].xml" and POTX_MAIN_CONTENT_TYPE in data:
                    data = data.replace(POTX_MAIN_CONTENT_TYPE, PPTX_MAIN_CONTENT_TYPE)
                    changed = True
                zout.writestr(item, data)
        return output.getvalue() if changed else template_bytes
    except BadZipFile:
        return template_bytes
