"""Printing for the fully lumed white field dial: numerals, railroad track, small text.
Everything printed here stays dark when the dial glows."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'src', 'main', 'res', 'drawable-nodpi')
W = H = 2048
EXT = 1.18
R0 = W / 2 / EXT
s = R0 / 455.0
f32 = np.float32
TAU = 2 * np.pi
CX = CY = W / 2 - 0.5
y, x = np.mgrid[0:H, 0:W].astype(f32)
dx, dy = x - CX, y - CY
r = np.hypot(dx, dy); ang = (np.arctan2(dy, dx) + np.pi / 2) % TAU

def sstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def band(v, lo, hi, aa=1.0):
    return sstep(lo - aa, lo + aa, v) * (1 - sstep(hi - aa, hi + aa, v))
def line(v, half, aa=0.8):
    return 1 - sstep(half - aa, half + aa, np.abs(v))
def polar(radius, a):
    return CX + radius * math.sin(a), CY - radius * math.cos(a)
def font(name, size):
    return ImageFont.truetype(os.path.join(HERE, name), int(size))

INK = np.zeros((H, W), f32)
def ink(m):
    global INK
    INK = np.maximum(INK, np.clip(m, 0, 1))

# railroad track: two rails, a crossbar every minute, solid blocks every five
R_IN, R_OUT = 0.885 * R0, 0.965 * R0
ink(line(r - R_IN, 1.1 * s)); ink(line(r - R_OUT, 1.1 * s))
st = TAU / 60; k = np.round(ang / st); arc = np.abs(ang - k * st) * r
ink(line(arc, 1.0 * s) * band(r, R_IN, R_OUT))
ink(line(arc, 4.2 * s, 1.0) * band(r, R_IN, R_OUT) * (k % 5 == 0))

# numerals 1 to 12
im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
fn = font('Inter-SemiBold.otf', 0.185 * R0)
for h in range(1, 13):
    d.text(polar(0.715 * R0, h * TAU / 12), str(h), font=fn, fill=255, anchor='mm')
# the generic small print (no maker's name)
fb = font('Inter-SemiBold.otf', 0.060 * R0); fr = font('Jost.ttf', 0.050 * R0)
d.text((CX, CY + 0.31 * R0), "Mechanical", font=fb, fill=255, anchor='mm')
d.text((CX, CY + 0.385 * R0), "Hand-Winding", font=fr, fill=230, anchor='mm')
ink(np.asarray(im, f32) / 255)

fs = ImageFont.truetype(os.path.join(HERE, 'Jost.ttf'), int(0.034 * R0))
def arc_text(text, radius, centre_deg):
    layer = Image.new('L', (W, H), 0)
    adv = [fs.getlength(c) + 0.034 * R0 * 0.08 for c in text]; pos = -sum(adv) / 2
    for c, a in zip(text, adv):
        mid = pos + a / 2; pos += a
        if c == ' ': continue
        an = math.radians(centre_deg) - mid / radius
        g = Image.new('L', (int(0.12 * R0),) * 2, 0)
        ImageDraw.Draw(g).text((g.width / 2, g.height / 2), c, font=fs, fill=255, anchor='mm')
        g = g.rotate(-math.degrees(an) + 180, resample=Image.BICUBIC)
        px, py = polar(radius, an)
        box = (int(round(px - g.width / 2)), int(round(py - g.height / 2)))
        reg = layer.crop((box[0], box[1], box[0] + g.width, box[1] + g.height))
        layer.paste(Image.fromarray(np.maximum(np.asarray(reg), np.asarray(g))), box)
    return np.asarray(layer, f32) / 255
ink(arc_text("Assembled in", 0.835 * R0, 203))
ink(arc_text("Great Britain", 0.835 * R0, 157))

rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., :3] = 34
rgba[..., 3] = (INK * 255).round().astype(np.uint8)
# straight alpha: Android and the preview premultiply on upload
Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'overlay_underdog.png'), optimize=True)
print('wrote overlay_underdog.png')
