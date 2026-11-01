"""Render assets/icon-180.png from the geometry of icon.svg.

The plugin catalog wants a raster card icon; drawing it here keeps the PNG and
the SVG from drifting apart. Needs Pillow only (`pip install pillow`).

    python dev/make-icon.py
"""
import os

from PIL import Image, ImageDraw

# SVG viewBox is 64x64. Render at SS times the target size, then downscale so
# the rounded corners and the thin strokes come out smooth.
TARGET = 180
SS = 4
UNIT = TARGET * SS / 64.0

BG = (27, 36, 48, 255)          # #1b2430
BG_STROKE = (60, 75, 94, 255)   # #3c4b5e
RAIL = (36, 50, 68, 255)        # #243244
ACCENT = (79, 209, 197, 255)    # #4fd1c5
BAR_STRONG = (230, 237, 246, 255)  # #e6edf6
BAR_MID = (159, 176, 196, 255)  # #9fb0c4
BAR_WEAK = (92, 108, 129, 255)  # #5c6c81
RAIL_BAR = (125, 142, 163, 255)  # #7d8ea3
RAIL_BAR_WEAK = (84, 99, 122, 255)  # #54637a

size = TARGET * SS
canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)


def box(x, y, w, h):
    """SVG rect (x, y, width, height) to Pillow corners."""
    return [x * UNIT, y * UNIT, (x + w) * UNIT, (y + h) * UNIT]


def point(x, y):
    return (x * UNIT, y * UNIT)


# Frame
draw.rounded_rectangle(box(3, 7, 58, 50), radius=12 * UNIT, fill=BG,
                       outline=BG_STROKE, width=max(1, round(2 * UNIT)))
# Left rail
draw.rounded_rectangle(box(11, 15, 15, 34), radius=5 * UNIT, fill=RAIL)
draw.ellipse(box(18.5 - 2.4, 23 - 2.4, 4.8, 4.8), fill=ACCENT)
draw.rounded_rectangle(box(14, 29, 9, 2.6), radius=1.3 * UNIT, fill=RAIL_BAR)
draw.rounded_rectangle(box(14, 35, 9, 2.6), radius=1.3 * UNIT, fill=RAIL_BAR)
draw.rounded_rectangle(box(14, 41, 6, 2.6), radius=1.3 * UNIT, fill=RAIL_BAR_WEAK)
# Right column: three model rows, strongest first
draw.rounded_rectangle(box(31, 17, 22, 4), radius=2 * UNIT, fill=BAR_STRONG)
draw.rounded_rectangle(box(31, 26, 22, 4), radius=2 * UNIT, fill=BAR_MID)
draw.rounded_rectangle(box(31, 35, 16, 4), radius=2 * UNIT, fill=BAR_WEAK)
# Check mark (the switch) and the collapse chevron
draw.line([point(31, 45.5), point(34.4, 48.9), point(41, 42.3)], fill=ACCENT,
          width=max(1, round(2.6 * UNIT)), joint="curve")
draw.line([point(52, 43.5), point(55, 46.5), point(52, 49.5)], fill=RAIL_BAR,
          width=max(1, round(2 * UNIT)), joint="curve")

icon = canvas.resize((TARGET, TARGET), Image.LANCZOS)
out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "icon-180.png")
icon.save(out_path, "PNG", optimize=True)
print("wrote", out_path, icon.size, os.path.getsize(out_path), "bytes")
