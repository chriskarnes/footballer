"""Generate the Forge app icons.

The mark is drawn as vector polygons rather than set in a typeface, so the output does
not depend on which fonts happen to be installed. It is the same italic F used in
components/Brand.tsx: gold on ink, leaning right.

  icon-192 / icon-512      rounded square, for Android + the manifest
  icon-maskable-512        full bleed with a 20% safe margin, so Android's mask
                           (circle, squircle, teardrop) never clips the mark
  apple-touch-icon         180px, full bleed square - iOS applies its own rounding,
                           and pre-rounding it leaves visible dark corners
"""
import math
from PIL import Image, ImageDraw

INK = (10, 7, 8, 255)
GOLD = (254, 221, 57, 255)
SLANT = math.tan(math.radians(12))   # italic lean

# The F, upright, in a 100x100 box: stem, top arm, middle arm.
BARS = [
    (40, 29, 9.5, 43),    # stem
    (40, 29, 27, 9.5),    # top arm
    (40, 45.5, 21, 9),    # middle arm
]


def skew(x, y, cy=50.0):
    """Lean the top of the glyph to the right about the vertical centre."""
    return (x - (y - cy) * SLANT, y)


def glyph():
    """The three bars, skewed, as polygons in the 100x100 box."""
    out = []
    for bx, by, bw, bh in BARS:
        corners = [(bx, by), (bx + bw, by), (bx + bw, by + bh), (bx, by + bh)]
        out.append([skew(cx, cy) for cx, cy in corners])
    return out


# Skewing moves the glyph off centre, so measure the real bounds and correct for it
# rather than eyeballing an offset.
_pts = [p for poly in glyph() for p in poly]
_x0, _x1 = min(p[0] for p in _pts), max(p[0] for p in _pts)
_y0, _y1 = min(p[1] for p in _pts), max(p[1] for p in _pts)
CENTRE_DX, CENTRE_DY = 50 - (_x0 + _x1) / 2, 50 - (_y0 + _y1) / 2


def draw_mark(img, scale, ox=0.0, oy=0.0):
    d = ImageDraw.Draw(img)
    for poly in glyph():
        d.polygon(
            [(((px + CENTRE_DX) * scale) + ox, ((py + CENTRE_DY) * scale) + oy)
             for px, py in poly],
            fill=GOLD,
        )


def rounded(size, radius_ratio=0.225, inset=0.0):
    """Rounded-square icon. `inset` shrinks the mark for maskable safe areas."""
    ss = 4                                   # supersample, then downscale to antialias
    big = size * ss
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=INK
    )
    span = big * (1 - inset * 2)
    draw_mark(img, span / 100.0, ox=big * inset, oy=big * inset)
    return img.resize((size, size), Image.LANCZOS)


def square(size, inset=0.0):
    ss = 4
    big = size * ss
    img = Image.new('RGBA', (big, big), INK)
    span = big * (1 - inset * 2)
    draw_mark(img, span / 100.0, ox=big * inset, oy=big * inset)
    return img.resize((size, size), Image.LANCZOS)


out = 'public'
rounded(512).save(f'{out}/icon-512.png')
rounded(192).save(f'{out}/icon-192.png')
rounded(512).save(f'{out}/icon.png')                    # kept: SETUP.md references this name
square(512, inset=0.14).save(f'{out}/icon-maskable-512.png')
square(180).convert('RGB').save(f'{out}/apple-touch-icon.png')
rounded(32).save(f'{out}/favicon.png')
rounded(32).save(f'{out}/favicon.ico', sizes=[(32, 32), (16, 16)])
print('icons written')
