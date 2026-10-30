"""Regenerates every REGA24 logo derivative from the owner-supplied master (resize only).

The master (docs/brand/rega24-official-logo-master.png) is never edited: no recolour, crop,
retouch or background removal. Square and wide formats keep the full frame and fill the
remaining space with the master's own outermost pixels (softened), so no new colour is added.

    python3 scripts/generate-rega24-logo-assets.py
"""

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "docs/brand/rega24-official-logo-master.png"
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"
RESAMPLE = Image.Resampling.LANCZOS


def extend(img: Image.Image, width: int, height: int) -> Image.Image:
    """Centres img on a width x height canvas, filling the margins with img's own edge pixels.

    The edge columns are blurred along their length first, so light streaks at the frame edge
    become a smooth tone instead of being stretched into stripes. The master's pixels stay intact.
    """
    w, h = img.size
    soft = ImageFilter.GaussianBlur(max(2, h // 10))
    edge_l, edge_r = (img.crop((x, 0, x + 1, h)).resize((8, h)).filter(soft).crop((4, 0, 5, h)) for x in (0, w - 1))
    left, top = (width - w) // 2, (height - h) // 2
    out = Image.new("RGB", (width, height))
    out.paste(img, (left, top))
    if left:
        out.paste(edge_l.resize((left, h)), (0, top))
    if width - left - w:
        out.paste(edge_r.resize((width - left - w, h)), (left + w, top))
    if top:
        out.paste(out.crop((0, top, width, top + 1)).resize((width, top)), (0, 0))
    if height - top - h:
        out.paste(out.crop((0, top + h - 1, width, top + h)).resize((width, height - top - h)), (0, top + h))
    return out


def fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Resizes the whole frame (no crop) to fit max_w x max_h."""
    w, h = img.size
    scale = min(max_w / w, max_h / h)
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), RESAMPLE)


def square(img: Image.Image, size: int, content: float = 1.0) -> Image.Image:
    inner = round(size * content)
    return extend(fit(img, inner, inner), size, size)


def main() -> None:
    master = Image.open(MASTER).convert("RGB")
    # Badge (LogoMark srcset and offline page) and the 512 PNG for the manifest and JSON-LD logo.
    for size in (64, 96, 192, 384):
        square(master, size).save(BRAND / f"rega24-badge-{size}.webp", "WEBP", quality=86, method=6)
    square(master, 512).save(BRAND / "rega24-badge-512.png", "PNG", optimize=True)
    # Favicon (16/32/48), apple-touch-icon, PWA icons (any + maskable: full frame inside the 80% safe zone).
    square(master, 48).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    square(master, 180).save(PUBLIC / "apple-icon.png", "PNG", optimize=True)
    square(master, 192).save(PUBLIC / "icon.png", "PNG", optimize=True)
    for size in (192, 512):
        square(master, size, 0.8).save(BRAND / f"rega24-maskable-{size}.png", "PNG", optimize=True)
    # Share image: the full frame at 1200x630, no overlay text.
    extend(fit(master, 1200, 630), 1200, 630).save(PUBLIC / "opengraph-image.png", "PNG", optimize=True)


if __name__ == "__main__":
    main()
