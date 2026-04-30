from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class DomainError(Exception):
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        Exception.__init__(self, self.message)

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "details": self.details}


def error_dict(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "details": details or {}}
