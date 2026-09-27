#!/usr/bin/env python3
"""Builds web-optimized image assets for the colouring-books site.

Reads original artwork from the colouring-books repo (set CQ_ART_REPO to its
path) and writes resized, compressed copies into
dist/client/colouring-books/assets/img/. Re-run after source artwork changes
(e.g. once final print-resolution masters replace these concept-stage files).
"""

import os
import sys
from pathlib import Path
from PIL import Image

if not os.environ.get("CQ_ART_REPO"):
    sys.exit("Set CQ_ART_REPO to the craven-and-quill-colouring-books repo path.")
ART = Path(os.environ["CQ_ART_REPO"]).expanduser().resolve()
SITE = Path(__file__).resolve().parents[2] / "dist" / "client" / "colouring-books"
IMG = SITE / "assets" / "img"
CREAM = (248, 241, 228)

BOOKS = {
    "ghosts": {
        "cover": ART / "three-book-series/final/covers/ghosts-front.png",
        "pages": ART / "three-book-series/final/ghosts/pages",
        "sample_indexes": [3, 8, 14, 20, 27, 34],
    },
    "animals": {
        "cover": ART / "three-book-series/final/covers/animals-front.png",
        "pages": ART / "three-book-series/final/animals/pages",
        "sample_indexes": [2, 9, 15, 21, 28, 36],
    },
    "mandalas": {
        "cover": ART / "three-book-series/final/covers/mandalas-front.png",
        "pages": ART / "three-book-series/final/mandalas/pages",
        "sample_indexes": [1, 5, 12, 19, 25, 33],
    },
}


def save_jpg(im: Image.Image, dest: Path, width: int, quality: int = 84):
    im = im.convert("RGB")
    if im.width > width:
        h = round(im.height * (width / im.width))
        im = im.resize((width, h), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    print(f"  {dest.relative_to(SITE)}  ({im.width}x{im.height}, {dest.stat().st_size // 1024}KB)")


def build_covers():
    print("Covers:")
    for slug, book in BOOKS.items():
        im = Image.open(book["cover"])
        save_jpg(im, IMG / "covers" / f"{slug}-lg.jpg", 1000, 85)
        save_jpg(im, IMG / "covers" / f"{slug}-md.jpg", 640, 85)
        save_jpg(im, IMG / "covers" / f"{slug}-thumb.jpg", 360, 82)


def build_pages():
    print("Interior sample pages:")
    for slug, book in BOOKS.items():
        for idx in book["sample_indexes"]:
            src = book["pages"] / f"{idx:02d}.png"
            im = Image.open(src)
            save_jpg(im, IMG / "pages" / f"{slug}-{idx:02d}-full.jpg", 900, 80)
            save_jpg(im, IMG / "pages" / f"{slug}-{idx:02d}-thumb.jpg", 380, 78)


def build_aplus():
    print("Ghosts A+ extras:")
    src_dir = ART / "output/a-plus/ghosts"
    mapping = {
        "01-header-cover-page-pencil-1940x600.jpg": ("ghosts-banner.jpg", 1600),
        "02-cafe-half-coloured-600x600.jpg": ("ghosts-cafe-preview.jpg", 640),
        "03-bookshop-half-coloured-600x600.jpg": ("ghosts-bookshop-preview.jpg", 640),
        "04-bakery-half-coloured-600x600.jpg": ("ghosts-bakery-preview.jpg", 640),
    }
    for src_name, (dest_name, width) in mapping.items():
        im = Image.open(src_dir / src_name)
        save_jpg(im, IMG / "aplus" / dest_name, width, 82)


def build_logo():
    print("Logo + favicons:")
    src = ART / "brand/craven-and-quill-logo-classic.png"
    logo = Image.open(src)

    # Header wordmark (keep transparency, moderate size for retina display).
    header = logo.copy()
    header.thumbnail((640, 640), Image.LANCZOS)
    dest = IMG / "logo-header.png"
    header.save(dest, "PNG", optimize=True)
    print(f"  {dest.relative_to(SITE)} ({header.width}x{header.height})")

    # Emblem-only crop (quill, book and wreath, no wordmark) for favicons
    # and the mobile-nav mark. Bounds found by inspecting the alpha channel.
    emblem = logo.crop((267, 95, 987, 815))

    fav_dest = IMG / "favicon-emblem.png"
    emblem.save(fav_dest, "PNG", optimize=True)
    print(f"  {fav_dest.relative_to(SITE)} ({emblem.width}x{emblem.height})")

    # Flatten onto cream for apple-touch-icon (iOS ignores transparency).
    square = Image.new("RGB", emblem.size, CREAM)
    square.paste(emblem, mask=emblem.split()[-1])

    sizes = {
        "apple-touch-icon.png": 180,
        "favicon-32.png": 32,
        "favicon-16.png": 16,
    }
    for name, size in sizes.items():
        resized = square.resize((size, size), Image.LANCZOS)
        dest = IMG / name
        resized.save(dest, "PNG")
        print(f"  {dest.relative_to(SITE)} ({size}x{size})")

    # Transparent favicon.ico (multi-size) for browsers that prefer it.
    ico_dest = IMG / "favicon.ico"
    icon_sizes = [(16, 16), (32, 32), (48, 48)]
    emblem.save(ico_dest, format="ICO", sizes=icon_sizes)
    print(f"  {ico_dest.relative_to(SITE)}")

    return emblem, header


def build_og_image(emblem: Image.Image):
    print("Social share image:")
    W, H = 1200, 630
    canvas = Image.new("RGB", (W, H), CREAM)

    mark = emblem.copy()
    mark.thumbnail((220, 220), Image.LANCZOS)
    canvas.paste(mark, (W // 2 - mark.width // 2, 46), mask=mark.split()[-1])

    cover_w = 300
    gap = 28
    total_w = cover_w * 3 + gap * 2
    start_x = (W - total_w) // 2
    y = 300
    for i, slug in enumerate(["ghosts", "animals", "mandalas"]):
        cover = Image.open(BOOKS[slug]["cover"]).convert("RGB")
        cover = cover.resize((cover_w, cover_w), Image.LANCZOS)
        x = start_x + i * (cover_w + gap)
        # Slight alternating vertical offset for a fanned, editorial feel.
        yy = y + (18 if i == 1 else 0)
        bordered = Image.new("RGB", (cover_w + 8, cover_w + 8), (58, 30, 51))
        bordered.paste(cover, (4, 4))
        canvas.paste(bordered, (x - 4, yy - 4))

    dest = IMG / "og-image.jpg"
    canvas.save(dest, "JPEG", quality=88, optimize=True)
    print(f"  {dest.relative_to(SITE)} ({W}x{H})")


if __name__ == "__main__":
    IMG.mkdir(parents=True, exist_ok=True)
    build_covers()
    build_pages()
    build_aplus()
    emblem, header = build_logo()
    build_og_image(emblem)
    print("Done.")
