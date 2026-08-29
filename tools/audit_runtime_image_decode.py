#!/usr/bin/env python3
"""Decode every runtime image that can enter the final Content Pack."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
EXCLUDED_PREFIX = (ASSETS / "tibia-client" / "organized").resolve()


def runtime_images():
    for path in ASSETS.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        try:
            path.resolve().relative_to(EXCLUDED_PREFIX)
            continue
        except ValueError:
            yield path


def main() -> int:
    counts: Counter[str] = Counter()
    animated: Counter[str] = Counter()
    failures: list[dict[str, str]] = []
    for path in runtime_images():
        relative = path.relative_to(ROOT).as_posix()
        try:
            if path.suffix.lower() == ".svg":
                ET.parse(path)
                counts["SVG"] += 1
                continue
            with Image.open(path) as image:
                detected = str(image.format or "UNKNOWN").upper()
                frames = int(getattr(image, "n_frames", 1) or 1)
                if image.width <= 0 or image.height <= 0:
                    raise ValueError("invalid dimensions")
                image.seek(frames - 1)
                image.convert("RGBA").load()
                counts[detected] += 1
                if frames > 1:
                    animated[detected] += 1
        except Exception as error:  # noqa: BLE001 - audit must report every file
            failures.append({"file": relative, "error": str(error)})
    report = {
        "passed": not failures,
        "decoded": sum(counts.values()),
        "formats": dict(sorted(counts.items())),
        "animated": dict(sorted(animated.items())),
        "failures": failures,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
