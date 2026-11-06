"""Generate Play listing artwork using Nearry's approved logo masters.

Run with Pillow installed: python3 assets/generate_store.py
Outputs opaque PNGs to dist-store/. Phone screenshots must come from the actual
release app; this script does not invent interface screenshots.
"""
from pathlib import Path
import os
from PIL import Image, ImageDraw, ImageFont
from generate_icons import ROOT, PAPER, INK, symbol, tile, resize, WORD

OUT = ROOT.parent / "dist-store"
OUT.mkdir(exist_ok=True)


def font(size: int, bold: bool = False):
    custom = os.environ.get("NEARRY_STORE_FONT_BOLD" if bold else "NEARRY_STORE_FONT")
    candidates = [custom] if custom else []
    candidates += [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if path and Path(path).exists():
            return ImageFont.truetype(path, size)
    raise RuntimeError("Set NEARRY_STORE_FONT and NEARRY_STORE_FONT_BOLD to installed TrueType fonts")


canvas = Image.new("RGBA", (2048, 1000), PAPER)
draw = ImageDraw.Draw(canvas)

# All important content stays clear of the outer edges, for different Play crops.
mark = symbol(96)
canvas.alpha_composite(mark, (128, 106))
word = resize(WORD, 280)
canvas.alpha_composite(word, (248, 112))
draw.text((128, 330), "Good plans.", font=font(108, True), fill=INK)
draw.text((128, 460), "Closer to you.", font=font(108, True), fill=INK)
draw.text((132, 742), "Find nearby games, meetups and places.", font=font(35), fill="#5D645D")

# A neighbourhood orbit around the existing Around You mark; no fake app UI.
cx, cy = 1600, 490
for radius in (380, 270, 160):
    draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), outline="#E5E5DD", width=3)
draw.ellipse((1370, 138, 1400, 168), fill="#C14D2F")
draw.ellipse((1880, 534, 1904, 558), fill=INK)
draw.ellipse((1360, 748, 1380, 768), fill="#9AA397")
large = symbol(360)
canvas.alpha_composite(large, (1420, 300))

canvas.resize((1024, 500), Image.Resampling.LANCZOS).convert("RGB").save(OUT / "feature-graphic.png", optimize=True)
tile(512).save(OUT / "play-icon.png", optimize=True)
print(f"Generated {OUT / 'feature-graphic.png'} (1024×500) and play-icon.png (512×512)")
