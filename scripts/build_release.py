#!/usr/bin/env python3
"""Build a ready-to-use RANK / MOTION release ZIP."""

from __future__ import annotations

import hashlib
import json
import pathlib
import shutil
import stat
import zipfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PACKAGING = ROOT / "packaging"
OUTPUT = ROOT / "release"


def copy_release_files(target: pathlib.Path, version: str) -> None:
    shutil.copytree(DIST, target)
    shutil.copy2(ROOT / "scripts" / "serve.py", target / "serve.py")
    readme = (PACKAGING / "README.txt").read_text(encoding="utf-8")
    (target / "README.txt").write_text(
        readme.replace("@VERSION@", version),
        encoding="utf-8",
    )
    for name in ("start-macos.command", "start-linux.sh", "start-windows.bat"):
        shutil.copy2(PACKAGING / name, target / name)

    for name in ("serve.py", "start-macos.command", "start-linux.sh"):
        path = target / name
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def add_tree(archive: zipfile.ZipFile, source: pathlib.Path) -> None:
    for path in sorted(source.rglob("*")):
        if path.is_dir():
            continue
        archive.write(path, path.relative_to(OUTPUT))


def main() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    version = package["version"]
    bundle_name = f"rank-motion-studio-v{version}"
    target = OUTPUT / bundle_name
    archive_path = OUTPUT / f"{bundle_name}.zip"
    checksum_path = OUTPUT / f"{bundle_name}.zip.sha256"

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    copy_release_files(target, version)

    with zipfile.ZipFile(
        archive_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        add_tree(archive, target)

    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    checksum_path.write_text(f"{digest}  {archive_path.name}\n", encoding="utf-8")

    print(f"Created {archive_path.relative_to(ROOT)}")
    print(f"Created {checksum_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
