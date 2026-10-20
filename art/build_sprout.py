#!/usr/bin/env python3
"""Generate Sprout the pixel robot as SVG.

Pixel art is just a grid of little squares. We describe each part as cells on a grid
(one cell = CELL units), then emit an <rect> per cell. Keeping the parts in named <g>
groups (matching the classes the stage animates) means Sprout can still bob, swing and
glow. Tweak the maps below and re-run:  python3 art/build_sprout.py
"""
from pathlib import Path

CELL = 6  # each pixel is 6x6 SVG units; viewBox is 120x140 to match the stage template

# palette ----------------------------------------------------------------
METAL = "#8b938c"       # weathered robot body
METAL_HI = "#b9c0b4"    # top-left highlight
METAL_LO = "#5e665f"    # bottom-right shade
PANEL = "#3c4a40"       # dark face panel
MOSS = ["#6cbf79", "#4f9a5f", "#9adb84"]  # three greens, scattered
CAP = "#d8574a"         # mushroom cap red
CAP_HI = "#e87c63"
SPOT = "#f3e9d2"        # cream spots
STEM = "#e8dcc0"        # mushroom stem
AMBER = "#ffd36b"       # little amber mushroom + eye glow
EYE = "#ffd98a"
EYE_HI = "#fff4cf"


def rects(cells, color):
    out = []
    for (c, r) in cells:
        out.append(f'<rect x="{c*CELL}" y="{r*CELL}" width="{CELL}" height="{CELL}" fill="{color}"/>')
    return "".join(out)


def box(c0, r0, c1, r1):
    return [(c, r) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)]


def shaded(c0, r0, c1, r1):
    """A metal rectangle with a lighter top/left edge and darker bottom/right edge."""
    base, hi, lo = [], [], []
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            if c == c1 or r == r1:
                lo.append((c, r))
            elif c == c0 or r == r0:
                hi.append((c, r))
            else:
                base.append((c, r))
    return rects(base, METAL) + rects(hi, METAL_HI) + rects(lo, METAL_LO)


def mushroom(col, row, cap_color=CAP):
    """A little 3-wide mushroom whose stem sits at (col,row) and (col,row-1), cap above."""
    stem = rects([(col, row), (col, row - 1)], STEM)
    cap = rects(box(col - 1, row - 2, col + 1, row - 2), cap_color)
    cap += rects([(col, row - 3)], cap_color)              # a bump on top
    cap += rects([(col - 1, row - 2), (col + 1, row - 3)], CAP_HI if cap_color == CAP else AMBER)
    spots = rects([(col, row - 2)], SPOT)                  # one cream spot
    return stem + cap + spots


# ---- the body: head box on a torso box -------------------------------------------------
head = shaded(6, 6, 13, 11)
torso = shaded(5, 12, 14, 18)
# bolts / rivets on the torso, for texture
rivets = rects([(6, 13), (13, 13), (6, 17), (13, 17)], METAL_LO)
# a dark face panel inset in the head
panel = rects(box(7, 8, 12, 10), PANEL)

# ---- moss creeping over the top edges and shoulders ------------------------------------
moss_cells = [(6, 5), (8, 5), (9, 5), (11, 5), (13, 5),   # along the head's top
              (7, 6), (12, 6),
              (5, 12), (14, 12), (5, 13), (14, 14),        # shoulders and sides
              (6, 18), (9, 18), (12, 18)]                  # a little along the bottom
moss = "".join(rects([cell], MOSS[i % 3]) for i, cell in enumerate(moss_cells))

# ---- mushrooms sprouting from Sprout ---------------------------------------------------
shrooms = (
    mushroom(7, 5)                 # one growing out of the head-top left
    + mushroom(12, 16, AMBER)      # a small amber one on the torso
)

# ---- the antenna + crowning mushroom (this group sways in idle) ------------------------
antenna_stalk = rects([(9, 3), (9, 4), (9, 5)], METAL) + rects([(10, 3), (10, 4), (10, 5)], METAL_LO)
crown = mushroom(9, 2)  # a mushroom where a robot's light would be
sprout_top = antenna_stalk + crown

# ---- arms (each swings about its shoulder) ---------------------------------------------
arm_l = shaded(2, 12, 3, 17) + rects([(2, 17), (3, 17)], METAL_LO)
arm_l += rects([(2, 11)], MOSS[0])  # a fleck of moss on the shoulder
arm_r = shaded(16, 12, 17, 17) + rects([(16, 17), (17, 17)], METAL_LO)
arm_r += rects([(17, 11)], MOSS[1])

# ---- feet -------------------------------------------------------------------------------
feet = shaded(6, 19, 8, 21) + shaded(11, 19, 13, 21)

# ---- eyes (amber, glowing) + mouth -----------------------------------------------------
eyes = rects([(7, 9), (11, 9)], EYE) + rects([(8, 9), (12, 9)], EYE_HI)
# mouth as a <path> so the stage's "happy" morph still works
mouth = '<path class="s-mouth" d="M48 66 Q60 72 72 66" fill="none" stroke="#1f2a22" stroke-width="2.5" stroke-linecap="round"/>'


def svg(standalone):
    aura = '<circle class="s-aura" cx="60" cy="54" r="54" fill="#ffe6a3" opacity="0"/>'
    body = (
        f'<g class="s-sprout">{sprout_top}</g>'
        f'<g class="s-arm s-arm-l">{arm_l}</g>'
        f'<g class="s-arm s-arm-r">{arm_r}</g>'
        f'<g class="s-feet">{feet}</g>'
        f'<g class="s-body">{head}{torso}{panel}{rivets}{moss}{shrooms}</g>'
        f'<g class="s-eyes">{eyes}</g>'
        f'{mouth}'
    )
    attrs = 'viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"'
    note = ("\n  <!-- Generated by art/build_sprout.py. Pixel art = a grid of <rect>s. "
            "Edit the maps in that script and re-run, rather than hand-editing here. -->\n  "
            if standalone else "")
    cls = 'id="sprout"' if standalone else 'class="sprout"'
    label = ' role="img" aria-label="Sprout, a mossy mushroom robot"' if standalone else ""
    return f'<svg {cls} {attrs}{label}>{note}{aura}{body}</svg>\n'


OUT = Path(__file__).resolve().parent.parent / "media"
(OUT / "sprout.svg").write_text(svg(standalone=True))
(Path(__file__).resolve().parent / "sprout.inline.svg").write_text(svg(standalone=False))

# the tiny gutter icon: just the crowning mushroom on a metal nub, at 16x16
gutter = (
    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'
    '<rect x="5" y="9" width="6" height="5" fill="#8b938c"/>'
    '<rect x="5" y="13" width="6" height="1" fill="#5e665f"/>'
    '<rect x="6" y="10" width="1" height="1" fill="#ffd36b"/><rect x="9" y="10" width="1" height="1" fill="#ffd36b"/>'
    '<rect x="4" y="5" width="8" height="3" fill="#d8574a"/><rect x="7" y="3" width="2" height="2" fill="#d8574a"/>'
    '<rect x="7" y="6" width="2" height="1" fill="#f3e9d2"/>'
    '</svg>\n'
)
(OUT / "sprout-gutter.svg").write_text(gutter)
print("wrote media/sprout.svg, media/sprout-gutter.svg, art/sprout.inline.svg")
