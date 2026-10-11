"""Renders the static dial furniture (fret ring, numerals, batons, rings) to a
transparent 2048px texture that the shader lays over the animated dial."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
W = H = 2048
EXT = 1.18                      # texture half-size in units of R0 (must match shader)
R0 = W / 2 / EXT
f32 = np.float32
TAU = 2 * np.pi
CX = CY = W / 2 - 0.5
s = R0 / 455.0
y, x = np.mgrid[0:H, 0:W].astype(f32)
dx, dy = x - CX, y - CY
r = np.hypot(dx, dy); th = np.arctan2(dy, dx); ang = (th + np.pi / 2) % TAU

def sstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def band(v, lo, hi, aa=1.0):
    return sstep(lo - aa, lo + aa, v) * (1 - sstep(hi - aa, hi + aa, v))
ST = [0, .12, .38, .66, .88, 1.0]
SC = np.array([(0, 0, 0), (16, 21, 25), (70, 82, 90), (150, 164, 172), (222, 232, 236), (255, 255, 255)], float)
def silver(v):
    v = np.clip(v, 0, 1); return np.stack([np.interp(v, ST, SC[:, i]) for i in range(3)], -1).astype(f32)

Rg = 0.60 * R0
SCX, SCY, Rs = CX, CY + 0.50 * R0, 0.27 * R0
rs = np.hypot(x - SCX, y - SCY); ths = np.arctan2(y - SCY, x - SCX)
F_IN, F_OUT = R0 + 13 * s, R0 + 53 * s
ov = np.zeros((H, W, 3), f32); oa = np.zeros((H, W), f32)
def put(mask, col):
    global ov, oa
    m = np.clip(mask, 0, 1); c = np.asarray(col, f32)
    if c.ndim == 1: c = c[None, None, :]
    ov = ov * (1 - m[..., None]) + c * m[..., None]; oa = oa + m * (1 - oa)
polish = 0.50 + 0.50 * np.abs(np.cos(th - 0.7)) ** 3
CREAM = (246, 242, 226)
put(band(r, R0 + 3 * s, R0 + 62 * s), (2, 3, 4))
KEY = np.array([[1,1,1,1,1,1,1,0],[1,0,0,0,0,0,1,0],[1,0,1,1,1,0,1,0],[1,0,1,0,0,0,1,0],[1,0,1,1,1,1,1,0],[1,0,0,0,0,0,0,0]], f32)
NF, SS = 48, 4
fret = np.zeros((H, W), f32)
for oy in range(SS):
    for ox in range(SS):
        ddx, ddy = dx + (ox + .5) / SS - .5, dy + (oy + .5) / SS - .5
        rr = np.hypot(ddx, ddy); aa = (np.arctan2(ddy, ddx) + np.pi / 2) % TAU
        b = (rr - (F_IN + 6 * s)) / (F_OUT - F_IN - 12 * s); ok = (b >= 0) & (b < 1)
        row = np.clip(((1 - b) * 6).astype(np.int32), 0, 5)
        cf = aa / TAU * NF; ci = np.floor(cf).astype(np.int32); cu = cf - ci
        cu = np.where(ci % 2 == 1, 1 - cu, cu); col = np.clip((cu * 8).astype(np.int32), 0, 7)
        fret += KEY[row, col] * ok
put(fret / (SS * SS), silver(0.58 + 0.24 * polish))
for rad_, wid in ((F_IN, 1.6), (F_OUT, 1.6), (R0 + 64 * s, 1.2)):
    put(1 - sstep(wid * s - .8, wid * s + .8, np.abs(r - rad_)), silver(0.55 + 0.4 * polish))
put(1 - sstep(3 * s - 1, 3 * s + 1, np.abs(r - R0)), silver(0.45 + 0.55 * polish))
put((1 - sstep(2.5 * s - 1, 2.5 * s + 1, np.abs(r - Rg))) * (rs > Rs), silver(0.40 + 0.6 * polish))
h12 = TAU / 12; k = np.round(ang / h12); arc = np.abs(ang - k * h12) * r
put((1 - sstep(8 * s - 1, 8 * s + 1, arc)) * band(r, 0.705 * R0, 0.905 * R0) * (k % 2 == 1), CREAM)
m60 = TAU / 60; km = np.round(ang / m60); arcm = np.abs(ang - km * m60) * r
put((1 - sstep(1.4 * s - .8, 1.4 * s + .8, arcm)) * band(r, 0.945 * R0, 0.982 * R0) * (rs > Rs + 6 * s) * 0.9, CREAM)
font = ImageFont.truetype(os.path.join(HERE, 'Jost.ttf'), int(0.235 * R0)); font.set_variation_by_axes([560])
num = Image.new('L', (W, H), 0); d = ImageDraw.Draw(num)
for h in (12, 2, 4, 8, 10):
    a = h * h12; d.text((CX + 0.79 * R0 * np.sin(a), CY - 0.79 * R0 * np.cos(a)), str(h), font=font, fill=255, anchor='mm')
put(np.asarray(num, f32) / 255, CREAM)
put(1 - sstep(2.5 * s - 1, 2.5 * s + 1, np.abs(rs - Rs)), silver(0.40 + 0.6 * polish))
sang = (ths + np.pi / 2) % TAU
for div, wd, lo in ((60, 1.0, 0.86), (12, 1.8, 0.78)):
    st = TAU / div; ks = np.round(sang / st); arcs = np.abs(sang - ks * st) * rs
    put((1 - sstep(wd * s - .8, wd * s + .8, arcs)) * band(rs, lo * Rs, 0.93 * Rs) * 0.9, CREAM)
rgba = np.dstack([np.clip(ov, 0, 255), oa * 255]).round().astype(np.uint8)
out = os.path.join(HERE, '..', 'app', 'src', 'main', 'res', 'drawable-nodpi', 'overlay.png')
Image.fromarray(rgba, 'RGBA').save(out, optimize=True)
print('wrote', out)
