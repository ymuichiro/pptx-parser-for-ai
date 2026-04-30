from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from pptx_yaml_engine.errors import DomainError

PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@dataclass(slots=True)
class Artifact:
    artifact_id: str
    token: str
    file_name: str
    file_path: Path
    expires_at: float
    mime_type: str = PPTX_MIME_TYPE

    @property
    def size(self) -> int:
        return self.file_path.stat().st_size


class ArtifactStore:
    def __init__(self, root_dir: str, ttl_seconds: int, max_output_bytes: int) -> None:
        self.root_dir = Path(root_dir)
        self.ttl_seconds = ttl_seconds
        self.max_output_bytes = max_output_bytes
        self.entries: dict[str, Artifact] = {}

    def init(self) -> None:
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def stop(self) -> None:
        for token in list(self.entries):
            self.delete(token)

    def publish(self, data: bytes, file_name: str, base_url: str) -> dict[str, object]:
        if len(data) > self.max_output_bytes:
            raise DomainError(
                "OUTPUT_TOO_LARGE",
                "Generated PPTX exceeds size limit",
                {"size": len(data), "max": self.max_output_bytes},
            )
        self.cleanup_expired()
        artifact_id = str(uuid.uuid4())
        token = str(uuid.uuid4())
        safe_file_name = _sanitize_file_name(file_name)
        path = self.root_dir / f"{artifact_id}.pptx"
        path.write_bytes(data)
        artifact = Artifact(
            artifact_id=artifact_id,
            token=token,
            file_name=safe_file_name,
            file_path=path,
            expires_at=time.time() + self.ttl_seconds,
        )
        self.entries[token] = artifact
        return {
            "artifactId": artifact.artifact_id,
            "downloadUrl": f"{base_url.rstrip('/')}/artifacts/{token}",
            "expiresAt": _iso8601(artifact.expires_at),
            "fileName": artifact.file_name,
            "size": artifact.size,
        }

    def read(self, token: str) -> Artifact | None:
        artifact = self.entries.get(token)
        if artifact is None:
            return None
        if artifact.expires_at <= time.time():
            self.delete(token)
            return None
        if not artifact.file_path.exists():
            self.entries.pop(token, None)
            return None
        return artifact

    def delete(self, token: str) -> None:
        artifact = self.entries.pop(token, None)
        if artifact is not None:
            artifact.file_path.unlink(missing_ok=True)

    def cleanup_expired(self) -> None:
        now = time.time()
        for token, artifact in list(self.entries.items()):
            if artifact.expires_at <= now:
                self.delete(token)


def _sanitize_file_name(file_name: str | None) -> str:
    raw = file_name or "presentation.pptx"
    base = os.path.basename(raw).replace("\x00", "")
    if base.lower().endswith(".pptx"):
        base = base[:-5]
    safe = "".join(char if char.isalnum() or char in "._-" else "-" for char in base).strip("._-")
    return f"{safe or 'presentation'}.pptx"


def _iso8601(epoch_seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch_seconds))
