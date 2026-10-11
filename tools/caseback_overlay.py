"""Engraving masks for the caseback wallpaper, one per colour channel:
R = caseback ring (fixed), G = rotor (turns with the rotor), B = plate (fixed)."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
S = 2048
EXT = 1.34                      # texture half-size in movement radii (must match shader)
RM = S / 2 / EXT
C = S / 2
FONT = os.path.join(HERE, 'Jost.ttf')

def arc_text(layer, text, radius, centre_deg, size, weight=520, spacing=0.14, inward=False):
    """Draw text along a circle. centre_deg is a clock angle (0 = 12 o'clock).
    inward=False: letter tops point away from the centre (reads clockwise).
    inward=True : letter tops point to the centre (reads anticlockwise, for the lower half)."""
    font = ImageFont.truetype(FONT, int(size)); font.set_variation_by_axes([weight])
    adv = [font.getlength(ch) + size * spacing for ch in text]
    total = sum(adv)
    pos = -total / 2
    for ch, a in zip(text, adv):
        mid = pos + a / 2
        pos += a
        if ch == ' ':
            continue
        dang = mid / radius                      # radians along the arc
        ang = math.radians(centre_deg) + (-dang if inward else dang)
        x = C + radius * math.sin(ang); y = C - radius * math.cos(ang)
        g = Image.new('L', (int(size * 3), int(size * 3)), 0)
        ImageDraw.Draw(g).text((g.width / 2, g.height / 2), ch, font=font, fill=255, anchor='mm')
        rot = -math.degrees(ang) + (180 if inward else 0)
        g = g.rotate(rot, resample=Image.BICUBIC)
        box = (int(round(x - g.width / 2)), int(round(y - g.height / 2)))
        region = layer.crop((box[0], box[1], box[0] + g.width, box[1] + g.height))
        layer.paste(Image.fromarray(np.maximum(np.asarray(region), np.asarray(g))), box)

ring = Image.new('L', (S, S), 0)
rr, sz = 1.165 * RM, 0.070 * RM
for txt, deg in (("SAPPHIRE CRYSTAL", 0), ("20 ATM", 60), ("STAINLESS STEEL", 120),
                 ("MADE IN GERMANY", 180), ("AUTOMATIC", 240), ("37 MM", 300)):
    arc_text(ring, txt, rr, deg, sz, inward=(90 < deg < 270))

# rotor drawn pointing down (heavy side at 6 o'clock); text follows its outer rim
rotor = Image.new('L', (S, S), 0)
arc_text(rotor, "BIDIRECTIONAL WINDING  ·  21,600 A/h  ·  43 h", 0.865 * RM, 180, 0.062 * RM, inward=True)

plate = Image.new('L', (S, S), 0)
arc_text(plate, "TWENTY-SEVEN JEWELS", 0.875 * RM, 318, 0.056 * RM)
arc_text(plate, "ADJUSTED IN SIX POSITIONS", 0.875 * RM, 62, 0.056 * RM)

out = os.path.join(HERE, '..', 'app', 'src', 'main', 'res', 'drawable-nodpi', 'caseback_overlay.png')
Image.merge('RGB', (ring, rotor, plate)).save(out, optimize=True)
print('wrote', out)
