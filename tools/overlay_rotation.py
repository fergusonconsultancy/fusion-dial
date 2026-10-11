"""Static furniture for the Rotation dials (numerals, tracks, markers), one texture per dial."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
W = H = 2048
EXT = 1.18
R0 = W / 2 / EXT
f32 = np.float32
TAU = 2 * np.pi
CX = CY = W / 2 - 0.5
s = R0 / 455.0
FONT = os.path.join(HERE, 'Jost.ttf')
y, x = np.mgrid[0:H, 0:W].astype(f32)
dx, dy = x - CX, y - CY
r = np.hypot(dx, dy); th = np.arctan2(dy, dx); ang = (th + np.pi / 2) % TAU
h12, m60 = TAU / 12, TAU / 60

def sstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def band(v, lo, hi, aa=1.0):
    return sstep(lo - aa, lo + aa, v) * (1 - sstep(hi - aa, hi + aa, v))
ST = [0, .12, .38, .66, .88, 1.0]
SC = np.array([(0, 0, 0), (16, 21, 25), (70, 82, 90), (150, 164, 172), (222, 232, 236), (255, 255, 255)], float)
def silver(v):
    v = np.clip(v, 0, 1); return np.stack([np.interp(v, ST, SC[:, i]) for i in range(3)], -1).astype(f32)

class Layer:
    def __init__(self):
        self.ov = np.zeros((H, W, 3), f32); self.oa = np.zeros((H, W), f32)
    def put(self, mask, col):
        m = np.clip(mask, 0, 1); c = np.asarray(col, f32)
        if c.ndim == 1: c = c[None, None, :]
        self.ov = self.ov * (1 - m[..., None]) + c * m[..., None]; self.oa = self.oa + m * (1 - self.oa)
    def save(self, name):
        rgba = np.dstack([np.clip(self.ov, 0, 255), self.oa * 255]).round().astype(np.uint8)
        out = os.path.join(HERE, '..', 'app', 'src', 'main', 'res', 'drawable-nodpi', name)
        Image.fromarray(rgba, 'RGBA').save(out, optimize=True); print('wrote', name)

def font(size, weight):
    f = ImageFont.truetype(FONT, int(size)); f.set_variation_by_axes([weight]); return f
def text_mask(items):
    """items: (text, x, y, font). Upright text centred on each point."""
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for t, px, py, f in items: d.text((px, py), t, font=f, fill=255, anchor='mm')
    return np.asarray(im, f32) / 255
def polar(radius, a, c=(CX, CY)):
    return c[0] + radius * math.sin(a), c[1] - radius * math.cos(a)
def arc_text(text, radius, centre_deg, size, weight=520, spacing=0.14, inward=False):
    layer = Image.new('L', (W, H), 0)
    f = font(size, weight)
    adv = [f.getlength(ch) + size * spacing for ch in text]
    pos = -sum(adv) / 2
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

CREAM = (244, 243, 232)
polish = 0.50 + 0.50 * np.abs(np.cos(th - 0.7)) ** 3

# ------------------------------------------------------------------ petrol sports dial
L = Layer()
SCX, SCY, Rs = CX, CY + 0.47 * R0, 0.245 * R0
rs = np.hypot(x - SCX, y - SCY); ths = np.arctan2(y - SCY, x - SCX); sang = (ths + np.pi / 2) % TAU
outside_sub = (rs > Rs + 5 * s)
# minute track: fine ticks, heavier every five, tiny numerals
km = np.round(ang / m60); arcm = np.abs(ang - km * m60) * r
five = (km % 5 == 0)
L.put((1 - sstep(1.2 * s - .8, 1.2 * s + .8, arcm)) * band(r, 0.955 * R0, 0.985 * R0) * (~five) * 0.85, CREAM)
fs = font(0.050 * R0, 520)
L.put(text_mask([("%02d" % (m if m else 60), *polar(0.925 * R0, m / 60 * TAU), fs) for m in range(0, 60, 5)]) * 0.92, CREAM)
# hour furniture: numerals at 12, 2, 4, 8, 10 and batons at the odd hours
k = np.round(ang / h12); arc = np.abs(ang - k * h12) * r
L.put((1 - sstep(7.5 * s - 1, 7.5 * s + 1, arc)) * band(r, 0.60 * R0, 0.80 * R0) * (k % 2 == 1) * outside_sub, CREAM)
fn = font(0.215 * R0, 540)
L.put(text_mask([(str(h), *polar(0.70 * R0, h * h12), fn) for h in (12, 2, 4, 8, 10)]), CREAM)
# small seconds: bevel, ticks, 20 / 40 / 60
L.put(1 - sstep(2.0 * s - 1, 2.0 * s + 1, np.abs(rs - Rs)), silver(0.30 + 0.5 * polish) * np.array([0.55, 0.95, 0.90], f32))
for div, wd, lo in ((60, 0.9, 0.86), (12, 1.6, 0.80)):
    st = TAU / div; ks = np.round(sang / st); arcs = np.abs(sang - ks * st) * rs
    L.put((1 - sstep(wd * s - .8, wd * s + .8, arcs)) * band(rs, lo * Rs, 0.94 * Rs) * 0.9, CREAM)
ft = font(0.043 * R0, 520)
L.put(text_mask([(t, *polar(0.60 * Rs, a, (SCX, SCY)), ft) for t, a in (("60", 0), ("20", TAU / 3), ("40", 2 * TAU / 3))]) * 0.92, CREAM)
L.put(arc_text("MADE IN GERMANY", 0.985 * R0 - 0.002 * R0, 180, 0.022 * R0, inward=True) * 0.0, CREAM)
L.save('overlay_petrol.png')

# ------------------------------------------------------------------ scale-guilloche dial
L = Layer()
F_IN, F_OUT = 0.815 * R0, 0.935 * R0
L.put(band(r, F_IN - 6 * s, 1.0 * R0 + 2), (3, 4, 6))                         # black chapter ring
KEY = np.array([[1,1,1,1,1,1,1,0],[1,0,0,0,0,0,1,0],[1,0,1,1,1,0,1,0],[1,0,1,0,0,0,1,0],[1,0,1,1,1,1,1,0],[1,0,0,0,0,0,0,0]], f32)
NF, SS = 48, 4
fret = np.zeros((H, W), f32)
for oy in range(SS):
    for ox in range(SS):
        ddx, ddy = dx + (ox + .5) / SS - .5, dy + (oy + .5) / SS - .5
        rr = np.hypot(ddx, ddy); aa = (np.arctan2(ddy, ddx) + np.pi / 2) % TAU
        b = (rr - (F_IN + 7 * s)) / (F_OUT - F_IN - 14 * s); ok = (b >= 0) & (b < 1)
        row = np.clip(((1 - b) * 6).astype(np.int32), 0, 5)
        cf = aa / TAU * NF; ci = np.floor(cf).astype(np.int32); cu = cf - ci
        cu = np.where(ci % 2 == 1, 1 - cu, cu); col = np.clip((cu * 8).astype(np.int32), 0, 7)
        fret += KEY[row, col] * ok
k = np.round(ang / h12); arc = np.abs(ang - k * h12) * r
gap = sstep(11 * s, 15 * s, arc)                                               # frets stop short of each marker
L.put(fret / (SS * SS) * gap, (236, 240, 242))
for rad_, wid in ((F_IN, 1.5), (F_OUT, 1.5)):
    L.put((1 - sstep(wid * s - .8, wid * s + .8, np.abs(r - rad_))) * gap, (236, 240, 242))
L.put((1 - sstep(1.6 * s - .8, 1.6 * s + .8, arc)) * band(r, 0.955 * R0, 0.99 * R0), (236, 240, 242))   # outer hour ticks
# applied hour markers: long, dark-polished, with a bright facet
mk = (1 - sstep(6.5 * s - 1, 6.5 * s + 1, arc)) * band(r, 0.67 * R0, 0.945 * R0)
side = np.sign(np.sin(ang - k * h12) + 1e-9)
facet = np.where(side > 0, 0.20, 0.62) + 0.25 * polish
L.put(mk, silver(facet) * np.array([0.80, 0.88, 1.0], f32))
L.save('overlay_scales.png')
