#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict

SAFE_CHARS_RE = re.compile(r"[^-_.() a-zA-Z0-9]")

def sanitize_title(title: str) -> str:
    # collapse whitespace, remove unsafe chars, trim
    t = " ".join(title.split())
    t = SAFE_CHARS_RE.sub("_", t).strip(" ._-")
    # Windows reserved names guard
    if t.upper() in {"CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
                     "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"}:
        t = f"_{t}_"
    return t or "untitled"

def short_hash(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:8]

def guess_ext_from_url(url: str) -> str:
    path = urllib.parse.urlparse(url).path.lower()
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if path.endswith(ext):
            return ext
    return ""  # will fill from Content-Type later

def ext_from_content_type(ct: str) -> str:
    if not ct:
        return ""
    ct = ct.lower().split(";")[0].strip()
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    return mapping.get(ct, "")

def head_content_type(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.headers.get("Content-Type", "")
    except Exception:
        return ""

def ensure_ext(url: str, existing_ext: str) -> str:
    if existing_ext:
        return existing_ext
    ct = head_content_type(url)
    return ext_from_content_type(ct) or ".jpg"  # default fallback

def load_manifest(path: Path) -> Dict[str, str]:
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_manifest(path: Path, data: Dict[str, str]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)

def download(url: str, dest: Path, retries: int = 3, delay: float = 1.0) -> None:
    # Simple retry loop with a user-agent and streaming download
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r, dest.open("wb") as out:
                # stream in chunks
                while True:
                    chunk = r.read(1024 * 64)
                    if not chunk:
                        break
                    out.write(chunk)
            return
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if dest.exists():
                try: dest.unlink()
                except Exception: pass
            if attempt >= retries:
                raise
            time.sleep(delay)

def main():
    ap = argparse.ArgumentParser(description="Download AniList cover images from CSV.")
    ap.add_argument("--csv", required=True, help="Path to CSV exported from your browser script")
    ap.add_argument("--out", default="covers", help="Output folder for images")
    ap.add_argument("--manifest", default=None, help="Path to manifest JSON (default: <out>/download_manifest.json)")
    ap.add_argument("--force", action="store_true", help="Redownload even if manifest says it's done")
    ap.add_argument("--sleep", type=float, default=0.2, help="Delay between downloads (seconds)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Always store manifest in same directory as the script unless overridden
    script_dir = Path(__file__).parent
    manifest_path = Path(args.manifest) if args.manifest else script_dir / "download_manifest.json"

    manifest = load_manifest(manifest_path)  # url -> filename


    # Load CSV rows
    rows = []
    with open(args.csv, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        # expected fields: title, image, anilist_url
        for i, row in enumerate(reader, start=1):
            title = (row.get("title") or "").strip()
            image = (row.get("image") or "").strip()
            if not title or not image:
                print(f"[skip #{i}] Missing title/image")
                continue
            rows.append((title, image))

    total = len(rows)
    done = 0
    skipped = 0
    errors = 0

    for idx, (title, image_url) in enumerate(rows, start=1):
        base_name = sanitize_title(title)
        ext = ensure_ext(image_url, guess_ext_from_url(image_url))

        # If the same title appears for different URLs, add short hash suffix
        suffix = ""
        if any(fn.startswith(base_name) for fn in manifest.values()):
            previous_files = [u for u, fn in manifest.items() if fn.startswith(base_name)]
            if previous_files and image_url not in previous_files:
                suffix = f"-{short_hash(image_url)}"

        file_name = f"{base_name}{suffix}{ext}"
        dest = out_dir / file_name

        # Skip if already recorded AND file exists (safe to re-run)
        if not args.force and image_url in manifest and Path(out_dir / manifest[image_url]).exists():
            print(f"[skip {idx}/{total}] Already downloaded: {title}")
            skipped += 1
            continue

        try:
            print(f"[get  {idx}/{total}] {title}")
            download(image_url, dest)
            manifest[image_url] = file_name
            save_manifest(manifest_path, manifest)
            done += 1
            time.sleep(args.sleep)
        except Exception as e:
            errors += 1
            print(f"[ERR  {idx}/{total}] {title} -> {e}", file=sys.stderr)

    print(f"\nCompleted. Downloaded: {done}, Skipped: {skipped}, Errors: {errors}")
    print(f"Images in: {out_dir.resolve()}")
    print(f"Manifest:  {manifest_path.resolve()}")

if __name__ == "__main__":
    main()
