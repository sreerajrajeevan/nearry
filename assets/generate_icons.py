"""Generate Nearry placeholder icons (black bg, red dot-matrix N).

Run in CI before `expo prebuild` so the repo stays binary-free:
    pip install pillow && python3 assets/generate_icons.py
"""
from PIL import Image, ImageDraw
import os

BG, FG = (0, 0, 0), (215, 25, 32)
GLYPH = ["X.....X", "XX....X", "X.X...X", "X..X..X", "X...X.X", "X....XX", "X.....X"]

def make_icon(size: int, path: str) -> None:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = max(1, size // 16)
    ox = (size - 7 * s) // 2
    oy = (size - 7 * s) // 2 - s
    for r, row in enumerate(GLYPH):
        for c, ch in enumerate(row):
            if ch == "X":
                d.rectangle([ox + c*s, oy + r*s, ox + (c+1)*s - 2, oy + (r+1)*s - 2], fill=FG)
    d.ellipse([ox + 7*s + s//2, oy + 6*s, ox + 8*s + s//2, oy + 7*s], fill=FG)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    img.save(path)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    make_icon(1024, os.path.join(here, "icon.png"))
    make_icon(1024, os.path.join(here, "adaptive-icon.png"))
    make_icon(1024, os.path.join(here, "splash.png"))
    make_icon(48, os.path.join(here, "favicon.png"))
    print("icons generated")
