"""Generate Hello Nearry's warm-white and burnt-orange app assets.

Run before native prebuild or web export:
    python3 -m pip install pillow
    python3 assets/generate_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

PAPER = '#FAF9F5'
ORANGE = '#C14D2F'


def make_icon(size: int, path: Path, transparent: bool = False) -> None:
    # Draw at high resolution so even the small favicon has smooth edges.
    scale = max(size, 1024)
    image = Image.new('RGBA', (scale, scale), (0, 0, 0, 0) if transparent else PAPER)
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = [round(scale * n) for n in (.27, .29, .73, .67)]
    draw.rounded_rectangle((left, top, right, bottom), radius=round(scale * .10), fill=ORANGE)
    draw.rectangle((left, bottom - scale * .10, left + scale * .10, bottom), fill=ORANGE)
    draw.polygon([(left, bottom - scale * .03), (left, bottom + scale * .09), (left + scale * .12, bottom - scale * .03)], fill=ORANGE)
    image.resize((size, size), Image.Resampling.LANCZOS).save(path)


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    for name, size, transparent in [('icon.png', 1024, False), ('adaptive-icon.png', 1024, True), ('splash.png', 1024, False), ('favicon.png', 48, False)]:
        make_icon(size, root / name, transparent)
    print('Hello Nearry app assets generated')
