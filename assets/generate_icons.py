"""Build launcher, native splash and favicon assets from approved Around You masters.

The committed assets/brand SVGs are the editable artwork. PNG masters are exact
exports for React Native and this dependency-light Pillow build (no SVG renderer
needed in CI). Re-export both PNGs whenever their SVGs change.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
# Amber theme. Splash matches the in-app header logo on the app background;
# the launcher icon uses the dark tab-bar colour with an amber pin.
PAPER = '#F8FAFC'
INK = '#111827'
POINT = '#F59E0B'
ICON_BG = '#030712'
ICON_PIN = '#FBBF24'
ICON_POINT = '#FFFFFF'


def ink_mask(name: str, color: str = INK) -> Image.Image:
    # Keep the approved geometry and tint its alpha mask to match React.
    source = Image.open(ROOT / 'brand' / name).convert('RGBA')
    tinted = Image.new('RGBA', source.size, color)
    tinted.putalpha(source.getchannel('A'))
    return tinted


PIN = ink_mask('pin.png')
ICON_PIN_MASK = ink_mask('pin.png', ICON_PIN)
MONO_PIN = ink_mask('pin.png', '#000000')
WORD = ink_mask('wordmark.png')


def resize(image: Image.Image, width: int) -> Image.Image:
    return image.resize((width, round(width * image.height / image.width)), Image.Resampling.LANCZOS)


def symbol(size: int, pin: Image.Image = PIN, point: str = POINT) -> Image.Image:
    canvas = resize(pin, size)
    draw = ImageDraw.Draw(canvas)
    # Matches BrandMark: the point is part of the identity, separate from the pin.
    x, y, r = (size * n / 256 for n in (216, 114, 18))
    draw.ellipse((round(x-r), round(y-r), round(x+r), round(y+r)), fill=point)
    return canvas


def tile(size: int, transparent: bool = False, mono: bool = False) -> Image.Image:
    # Square source without baked-in rounded corners; each launcher supplies its mask.
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0) if transparent else ICON_BG)
    pin, point = (MONO_PIN, '#000000') if mono else (ICON_PIN_MASK, ICON_POINT)
    mark = symbol(512 if transparent else 676, pin, point)
    canvas.alpha_composite(mark, ((1024-mark.width)//2, (1024-mark.height)//2-16))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def notification_icon(size: int = 96) -> Image.Image:
    # Android status-bar icon: white pin and point on transparent. Android tints it;
    # the app sets amber as the accent colour.
    white = ink_mask('pin.png', '#FFFFFF')
    mark = symbol(round(size * 0.86), white, '#FFFFFF')
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((size-mark.width)//2, (size-mark.height)//2))
    return canvas


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
    notification_icon().save(ROOT/'notification-icon.png')
    print('Nearry launcher, splash and favicon assets generated')
