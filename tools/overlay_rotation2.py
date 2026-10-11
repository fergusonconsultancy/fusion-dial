"""Static furniture for four more Rotation dials: single-hand, dual-scale diver, taupe diver, gold chronograph.
Also writes the date-number atlas used by the single-hand dial's date window."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'src', 'main', 'res', 'drawable-nodpi')
W = H = 2048
f32 = np.float32
TAU = 2 * np.pi
CX = CY = W / 2 - 0.5
FONT = os.path.join(HERE, 'Jost.ttf')
y, x = np.mgrid[0:H, 0:W].astype(f32)
dx, dy = x - CX, y - CY
r = np.hypot(dx, dy); th = np.arctan2(dy, dx); ang = (th + np.pi / 2) % TAU
h12, m60 = TAU / 12, TAU / 60
polish = 0.50 + 0.50 * np.abs(np.cos(th - 0.7)) ** 3

def sstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def band(v, lo, hi, aa=1.0):
    return sstep(lo - aa, lo + aa, v) * (1 - sstep(hi - aa, hi + aa, v))
def line(v, half, aa=0.8):
    return 1 - sstep(half - aa, half + aa, np.abs(v))
def font(size, weight):
    f = ImageFont.truetype(FONT, int(size)); f.set_variation_by_axes([weight]); return f
def polar(radius, a, c=(CX, CY)):
    return c[0] + radius * math.sin(a), c[1] - radius * math.cos(a)
def text_mask(items):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for t, px, py, f in items: d.text((px, py), t, font=f, fill=255, anchor='mm')
    return np.asarray(im, f32) / 255
def arc_text(text, radius, centre_deg, size, weight=520, spacing=0.10, inward=False):
    layer = Image.new('L', (W, H), 0); f = font(size, weight)
    adv = [f.getlength(ch) + size * spacing for ch in text]; pos = -sum(adv) / 2
    for ch, a in zip(text, adv):
        mid = pos + a / 2; pos += a
        if ch == ' ': continue
        an = math.radians(centre_deg) + (-mid / radius if inward else mid / radius)
        px, py = polar(radius, an)
        g = Image.new('L', (int(size * 3), int(size * 3)), 0)
        ImageDraw.Draw(g).text((g.width / 2, g.height / 2), ch, font=f, fill=255, anchor='mm')
        g = g.rotate(-math.degrees(an) + (180 if inward else 0), resample=Image.BICUBIC)
        box = (int(round(px - g.width / 2)), int(round(py - g.height / 2)))
        reg = layer.crop((box[0], box[1], box[0] + g.width, box[1] + g.height))
        layer.paste(Image.fromarray(np.maximum(np.asarray(reg), np.asarray(g))), box)
    return np.asarray(layer, f32) / 255
def near(n):
    """Angular distance in pixels to the nearest of n evenly spaced rays, plus that ray's index."""
    st = TAU / n; k = np.round(ang / st); return np.abs(ang - k * st) * r, (k % n).astype(np.int32)
def disc(cx, cy, rad):
    return 1 - sstep(rad - 1, rad + 1, np.hypot(x - cx, y - cy))

class Layer:
    def __init__(self):
        self.ov = np.zeros((H, W, 3), f32); self.oa = np.zeros((H, W), f32)
    def put(self, mask, col):
        m = np.clip(mask, 0, 1); c = np.asarray(col, f32)
        if c.ndim == 1: c = c[None, None, :]
        self.ov = self.ov * (1 - m[..., None]) + c * m[..., None]; self.oa = self.oa + m * (1 - self.oa)
    def save(self, name):
        rgba = np.dstack([np.clip(self.ov, 0, 255), self.oa * 255]).round().astype(np.uint8)
        Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, name), optimize=True); print('wrote', name)

WHITE = (240, 242, 240)
LUME = (236, 233, 208)
STEEL = np.stack([150 + 90 * polish, 156 + 88 * polish, 162 + 86 * polish], -1).astype(f32)

# ================================================================ single-hand dial (EXT 1.18)
R0 = W / 2 / 1.18; s = R0 / 455.0
L = Layer()
arc, k = near(144)
lo = np.where(k % 12 == 0, 0.840, np.where(k % 6 == 0, 0.875, np.where(k % 3 == 0, 0.905, 0.930)))
wd = np.where(k % 12 == 0, 2.2, np.where(k % 6 == 0, 1.6, np.where(k % 3 == 0, 1.3, 1.0)))
L.put((1 - sstep(wd * s - .8, wd * s + .8, arc)) * sstep(lo * R0 - 1, lo * R0 + 1, r) * (1 - sstep(0.985 * R0 - 1, 0.985 * R0 + 1, r)), WHITE)
fn = font(0.108 * R0, 500)
L.put(text_mask([("%02d" % h if h < 12 else "12", *polar(0.715 * R0, (h % 12) * h12), fn) for h in (12, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11)]), WHITE)
wx, wy = CX, CY + 0.60 * R0
L.put(line(np.hypot(x - wx, y - wy) - 0.068 * R0, 1.4 * s), WHITE)
L.save('overlay_neo.png')

# date numbers 1..31, eight to a row
A = Image.new('L', (1024, 512), 0); d = ImageDraw.Draw(A); fa = font(84, 520)
for i in range(31):
    d.text((i % 8 * 128 + 64, i // 8 * 128 + 64), str(i + 1), font=fa, fill=255, anchor='mm')
Image.merge('RGB', (A, A, A)).save(os.path.join(OUT, 'dates.png'), optimize=True); print('wrote dates.png')

# ================================================================ dual-scale diver (EXT 1.50)
R0 = W / 2 / 1.50; s = R0 / 455.0
L = Layer()
arc, k = near(12)
cardinal = (k % 3 == 0)
L.put(line(r - 0.93 * R0, 1.0 * s), WHITE)
L.put(line(arc, 1.1 * s) * band(r, 0.64 * R0, 0.93 * R0), WHITE)                      # radial lines
for h in range(12):
    a = h * h12
    if h % 3:
        L.put(disc(*polar(0.60 * R0, a), 0.054 * R0), LUME)
L.put(line(arc, 0.026 * R0, 1.0) * band(r, 0.50 * R0, 0.80 * R0) * cardinal, LUME)   # bars at 12, 3, 6, 9
for sx in (-1, 1):
    L.put(disc(CX + sx * 0.115 * R0, CY - 0.775 * R0, 0.040 * R0), LUME)              # the two dots flanking 12
# bezel: hours on the steel ring, minutes on the black ring
INK = (18, 20, 24)
for h in range(1, 12):
    L.put(arc_text(str(h), 1.140 * R0, h * 30, 0.080 * R0, 560), INK)
L.put(disc(*polar(1.140 * R0, 0), 0.016 * R0), INK)
L.put(arc_text("HEURES", 1.135 * R0, 15, 0.034 * R0, 600, 0.22), INK)
for mnt in (10, 20, 30, 40, 50):
    L.put(arc_text(str(mnt), 1.305 * R0, mnt * 6, 0.108 * R0, 560), LUME)
arc5, k5 = near(12)
L.put(line(arc5, 3.0 * s) * band(r, 1.265 * R0, 1.345 * R0) * (k5 % 2 == 1), LUME)
L.put(arc_text("MINUTES", 1.300 * R0, 30, 0.036 * R0, 600, 0.22) * 0.0, LUME)
L.put(disc(*polar(1.305 * R0, 0), 0.046 * R0), STEEL)
L.put(disc(*polar(1.305 * R0, 0), 0.036 * R0), LUME)
L.save('overlay_diver2.png')

# ================================================================ taupe diver (EXT 1.50)
L = Layer()
arc60, k60 = near(60)
L.put(line(arc60, np.where(k60 % 5 == 0, 1.9, 1.1) * s) * band(r, 0.935 * R0, 0.985 * R0), WHITE)
arc, k = near(12)
def applied(mask_outer, mask_inner):
    L.put(mask_outer, STEEL); L.put(mask_inner, WHITE)
for h in range(12):
    if h % 3:
        c = polar(0.745 * R0, h * h12)
        applied(disc(*c, 0.076 * R0), disc(*c, 0.062 * R0))
bar = lambda hw, lo, hi: line(arc, hw, 1.0) * band(r, lo, hi) * (k % 3 == 0) * (k != 0)
applied(bar(0.048 * R0, 0.605 * R0, 0.875 * R0), bar(0.034 * R0, 0.620 * R0, 0.860 * R0))
def tri(base_r, apex_r, hw):
    """Triangle at 12, apex towards the centre."""
    t = (-(dy) - apex_r) / (base_r - apex_r)          # 0 at apex, 1 at base
    return np.clip(np.minimum(np.minimum(t, 1 - t) * (base_r - apex_r), hw * t - np.abs(dx)) / 1.0 + 0.5, 0, 1) * (t > 0)
applied(tri(0.885 * R0, 0.585 * R0, 0.118 * R0), tri(0.868 * R0, 0.625 * R0, 0.092 * R0))
# bezel prints in silver
SIL = (226, 228, 230)
for mnt in (10, 20, 30, 40, 50):
    L.put(arc_text(str(mnt), 1.205 * R0, mnt * 6, 0.122 * R0, 480), SIL)
L.put(line(arc, 3.2 * s) * band(r, 1.135 * R0, 1.275 * R0) * (k % 2 == 1), SIL)
first15 = (k60 >= 1) & (k60 <= 14) & (k60 % 5 != 0)
L.put(line(arc60, 1.7 * s) * band(r, 1.215 * R0, 1.300 * R0) * first15, SIL)
tb = (-(dy) - 1.115 * R0) / (1.295 * R0 - 1.115 * R0)
L.put(np.clip(np.minimum(np.minimum(tb, 1 - tb) * 0.18 * R0, 0.105 * R0 * tb - np.abs(dx)) + 0.5, 0, 1) * (tb > 0), SIL)
L.put(disc(*polar(1.235 * R0, 0), 0.034 * R0), WHITE)
L.save('overlay_diver3.png')

# ================================================================ gold chronograph (EXT 1.18)
R0 = W / 2 / 1.18; s = R0 / 455.0
L = Layer()
GOLD = np.stack([214 + 36 * polish, 170 + 50 * polish, 78 + 60 * polish], -1).astype(f32)
GP = (222, 184, 98)
fn = font(0.066 * R0, 520)
L.put(text_mask([("%02d" % m, *polar(0.915 * R0, m / 60 * TAU), fn) for m in range(0, 60, 5)]), GP)
arc60, k60 = near(60)
SUBS = ((CX - 0.42 * R0, CY, 0.215 * R0), (CX, CY + 0.42 * R0, 0.165 * R0))
clear = np.ones((H, W), f32)
for (sx, sy, sr) in SUBS:
    clear *= sstep(sr + 4 * s, sr + 8 * s, np.hypot(x - sx, y - sy))
L.put(line(r - 0.845 * R0, 0.9 * s), GP)
L.put(line(arc60, np.where(k60 % 5 == 0, 1.6, 0.9) * s) * band(r, np.where(k60 % 5 == 0, 0.775, 0.800) * R0, 0.845 * R0), GP)
arc, k = near(12)
has = (k != 9) & (k != 6)
L.put(line(arc, 0.024 * R0, 1.0) * band(r, 0.555 * R0, 0.755 * R0) * has * (k != 0), GOLD)
L.put(line(arc, 0.010 * R0, 1.0) * band(r, 0.66 * R0, 0.745 * R0) * has * (k != 0), (250, 246, 228))
for sx in (-1, 1):                                                                    # double marker at 12
    m = (np.abs(dx - sx * 0.030 * R0) < 0.020 * R0) & (-dy > 0.555 * R0) & (-dy < 0.755 * R0)
    L.put(m.astype(f32), GOLD)
# minute counter at 9
sx, sy, sr = SUBS[0]
rs = np.hypot(x - sx, y - sy); sang = (np.arctan2(y - sy, x - sx) + np.pi / 2) % TAU
L.put(band(rs, 0.70 * sr, 0.93 * sr) * (sang > np.pi), GOLD)                          # the gold half-arc
L.put(line(rs - sr, 1.0 * s), GP)
st = TAU / 60; ks = np.round(sang / st); arcs = np.abs(sang - ks * st) * rs
L.put(line(arcs, 0.8 * s) * band(rs, 0.86 * sr, 0.97 * sr) * (sang <= np.pi), GP)
ft = font(0.050 * R0, 520)
L.put(text_mask([(t, *polar(0.50 * sr, a, (sx, sy)), ft) for t, a in (("60", 0), ("15", TAU / 4), ("30", TAU / 2), ("45", 3 * TAU / 4))]), GP)
# running seconds at 6
sx, sy, sr = SUBS[1]
rs = np.hypot(x - sx, y - sy); sang = (np.arctan2(y - sy, x - sx) + np.pi / 2) % TAU
L.put(line(rs - sr, 0.9 * s), GP)
st = TAU / 12; ks = np.round(sang / st); arcs = np.abs(sang - ks * st) * rs
L.put(line(arcs, 0.9 * s) * band(rs, 0.84 * sr, 0.97 * sr), GP)
L.save('overlay_chrono.png')
