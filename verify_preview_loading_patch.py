#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "PATCH_MANIFEST_preview_loading_repair.json"


def fail(message: str) -> None:
    print(f"[NG] {message}")
    raise SystemExit(1)


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        fail(f"ファイルがありません: {rel}")
    return path.read_text(encoding="utf-8")


def main() -> int:
    if not MANIFEST.is_file():
        fail("パッチマニフェストがありません。ZIP内のファイルを同じ階層へ展開してください。")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    for entry in manifest["files"]:
        path = ROOT / entry["path"]
        if not path.is_file():
            fail(f"修正ファイルがありません: {entry['path']}")
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != entry["target_sha256"]:
            fail(f"ファイルの版が一致しません: {entry['path']}")
        print(f"[OK] SHA-256 {entry['path']}")

    for entry in manifest["protected_unchanged_files"]:
        path = ROOT / entry["path"]
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
            fail(f"今回の修正対象ではないファイルが変更されています: {entry['path']}")
        print(f"[OK] 保護ファイル未変更 {entry['path']}")

    game = read("src/core/Game.js")
    main_js = read("src/main.js")
    preloader = read("src/utils/GamePreloader.js")
    editor_js = read("editor/editor.js")
    editor_html = read("editor/index.html")
    editor_css = read("editor/editor.css")

    checks = [
        ("GamePreloader import", 'import { GamePreloader } from "../utils/GamePreloader.js";' in game),
        ("GamePreloader instance", "new GamePreloader(this.manifestLoader, this.scenarioLoader)" in game),
        ("preload awaited before title", "await this.gamePreloader.preload({" in game and game.index("await this.gamePreloader.preload({") < game.index('this.dom.titleScreen.hidden = false;')),
        ("editor preview hides loading", "this.dom.loadingScreen.hidden = true;" in game and "this.initializeEditorPreview();" in game),
        ("preloader file present", "async preload(" in preloader),
        ("startup class released after initialize", "classList.remove(\"startup-loading\")" in main_js),
        ("preview wrapper class", 'class="preview-mode-tabs preview-mode-actions"' in editor_html),
        ("page mode button", 'id="preview-page-mode"' in editor_html),
        ("full play button", 'id="preview-play-mode"' in editor_html),
        ("scenario test button", 'id="scenario-test-button"' in editor_html),
        ("preview button events retained", all(f'\"{button}\"' in editor_js for button in ['preview-page-mode', 'preview-play-mode', 'scenario-test-button'])),
        ("preview tab flex style", ".preview-mode-tabs { display: flex" in editor_css),
        ("preview SVG style", ".preview-mode-button svg { display: block" in editor_css),
    ]
    for label, passed in checks:
        if not passed:
            fail(label)
        print(f"[OK] {label}")

    print("\n修正パッチのファイル版と必須機能は一致しています。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
