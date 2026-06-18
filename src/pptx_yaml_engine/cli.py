from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from pptx_yaml_engine.errors import DomainError
from pptx_yaml_engine.generation.service import generate_pptx_from_paths


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate a PowerPoint from template, manifest, and deck YAML.")
    parser.add_argument("--template", required=True, help="Path to the source .pptx or .potx template.")
    parser.add_argument("--manifest", required=True, help="Path to the finalized manifest JSON produced by the mapper.")
    parser.add_argument("--deck", required=True, help="Path to the deck YAML file.")
    parser.add_argument("--output", required=True, help="Path where the generated .pptx will be written.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        output_path = generate_pptx_from_paths(
            template_path=Path(args.template),
            manifest_path=Path(args.manifest),
            deck_path=Path(args.deck),
            output_path=Path(args.output),
        )
    except DomainError as exc:
        print(json.dumps(exc.to_dict(), ensure_ascii=False), file=sys.stderr)
        return 1

    print(json.dumps({"success": True, "output": str(output_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
