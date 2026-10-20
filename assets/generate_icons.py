"""Build launcher, native splash and favicon assets from approved Around You masters.

The committed assets/brand SVGs are the editable artwork. PNG masters are exact
exports for React Native and this dependency-light Pillow build (no SVG renderer
needed in CI). Re-export both PNGs whenever their SVGs change.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAPER = '#FAF9F5'
INK = '#252A26'
ORANGE = '#C14D2F'
PIN = Image.open(ROOT / 'brand/pin.png').convert('RGBA')
WORD = Image.open(ROOT / 'brand/wordmark.png').convert('RGBA')


def resize(image: Image.Image, width: int) -> Image.Image:
    return image.resize((width, round(width * image.height / image.width)), Image.Resampling.LANCZOS)


def symbol(size: int, mono: bool = False) -> Image.Image:
    canvas = resize(PIN, size)
    draw = ImageDraw.Draw(canvas)
    # Matches BrandMark: the point is part of the identity, separate from the pin.
    x, y, r = (size * n / 256 for n in (216, 114, 18))
    draw.ellipse((round(x-r), round(y-r), round(x+r), round(y+r)), fill=INK if mono else ORANGE)
    return canvas


def tile(size: int, transparent: bool = False, mono: bool = False) -> Image.Image:
    # Square source without baked-in rounded corners; each launcher supplies its mask.
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0) if transparent else PAPER)
    mark = symbol(512 if transparent else 676, mono)
    canvas.alpha_composite(mark, ((1024-mark.width)//2, (1024-mark.height)//2-16))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def splash(mark_only: bool = False) -> Image.Image:
    # Same 200-point composition as StartupSplash: 112 mark, 16 gap, 164 wordmark.
    canvas = Image.new('RGBA', (1024, 1024))
    mark = symbol(round(112/200*1024))
    word = resize(WORD, round(164/200*1024))
    gap = round(16/200*1024)
    top = (1024-mark.height-gap-word.height)//2
    canvas.alpha_composite(mark, ((1024-mark.width)//2, top))
    if not mark_only:
        canvas.alpha_composite(word, ((1024-word.width)//2, top+mark.height+gap))
    return canvas


if __name__ == '__main__':
    tile(1024).save(ROOT/'icon.png')
    tile(1024, True).save(ROOT/'adaptive-icon.png')
    tile(1024, True, True).save(ROOT/'adaptive-monochrome.png')
    splash().save(ROOT/'splash.png')
    # Android 12 masks its native splash icon. Keep the wordmark for the React reveal.
    splash(True).save(ROOT/'splash-android.png')
    # A background tile keeps the icon visible on light and dark browser chrome.
    tile(48).save(ROOT/'favicon.png')
    print('Around You launcher, splash and favicon assets generated')
