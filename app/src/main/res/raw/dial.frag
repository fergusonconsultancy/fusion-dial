precision highp float;

uniform vec2 uRes;       // surface size in pixels
uniform vec2 uCenter;    // dial centre, pixels, y measured from the top
uniform float uR0;       // dial radius in pixels
uniform float uLoop;     // 0..1 animation phase (10 s loop)
uniform float uHour;     // hand angles, radians clockwise from 12
uniform float uMin;
uniform float uSec;
uniform sampler2D uOv;   // static furniture: fret ring, numerals, batons

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float EXT = 1.18;  // overlay half-size in units of R0 (matches tools/overlay.py)

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// periodic 1D value noise around the dial, for the brushed sunburst streaks
float ring(float a, float n) {
    float f = a / TAU * n;
    float i = floor(f);
    float t = f - i;
    return mix(hash1(mod(i, n) + n), hash1(mod(i + 1.0, n) + n), t) - 0.5;
}

vec3 ramp(float v, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5) {
    v = clamp(v, 0.0, 1.0);
    vec3 c = mix(vec3(0.0), c1, clamp(v / 0.12, 0.0, 1.0));
    c = mix(c, c2, clamp((v - 0.12) / 0.26, 0.0, 1.0));
    c = mix(c, c3, clamp((v - 0.38) / 0.28, 0.0, 1.0));
    c = mix(c, c4, clamp((v - 0.66) / 0.22, 0.0, 1.0));
    c = mix(c, c5, clamp((v - 0.88) / 0.12, 0.0, 1.0));
    return c / 255.0;
}
vec3 petrol(float v) { return ramp(v, vec3(3., 22., 28.), vec3(8., 66., 78.), vec3(30., 134., 146.), vec3(140., 214., 216.), vec3(228., 250., 248.)); }
vec3 silver(float v) { return ramp(v, vec3(16., 21., 25.), vec3(70., 82., 90.), vec3(150., 164., 172.), vec3(222., 232., 236.), vec3(255.)); }
vec3 seagreen(float v) { return ramp(v, vec3(3., 26., 22.), vec3(10., 80., 64.), vec3(52., 150., 120.), vec3(160., 222., 196.), vec3(232., 250., 240.)); }

// Leaf-shaped hand. Returns x = coverage, y = lume coverage, z = which bevel (-1 or 1).
vec3 leaf(vec2 p, float ang, float len, float wmax, float tail, float s) {
    vec2 d = vec2(sin(ang), -cos(ang));
    float a = dot(p, d);
    float q = dot(p, vec2(-d.y, d.x));
    float xx = clamp(a / len, 0.0, 1.0);
    float h = wmax * sin(PI * pow(xx, 0.72));
    h = max(h, 2.6 * s * (1.0 - smoothstep(0.0, 0.25, xx)));
    float ends = smoothstep(-tail - 1.0, -tail + 1.0, a) * (1.0 - smoothstep(len - 1.0, len + 1.0, a));
    float m = (1.0 - smoothstep(h - 0.8, h + 0.8, abs(q))) * ends;
    float hl = h * 0.52 - 1.2 * s;
    float lume = (1.0 - smoothstep(hl - 0.8, hl + 0.8, abs(q))) * smoothstep(0.20, 0.24, xx) * (1.0 - smoothstep(0.80, 0.86, xx));
    return vec3(m, lume * m, q < 0.0 ? -1.0 : 1.0);
}

// Needle for the small seconds.
float needle(vec2 p, float ang, float len, float tail, float s) {
    vec2 d = vec2(sin(ang), -cos(ang));
    float a = dot(p, d);
    float q = abs(dot(p, vec2(-d.y, d.x)));
    float h = mix(2.4, 0.9, clamp(a / len, 0.0, 1.0)) * s;
    h = a < 0.0 ? mix(2.4, 4.2, clamp(-a / tail, 0.0, 1.0)) * s : h;
    return (1.0 - smoothstep(h - 0.8, h + 0.8, q)) * smoothstep(-tail - 1.0, -tail + 1.0, a) * (1.0 - smoothstep(len - 1.0, len + 1.0, a));
}

vec3 blued(float bevel, float ang, float phi) {
    float g = 0.5 + 0.5 * bevel * cos(ang - 2.0 * phi - 0.6);
    return mix(vec3(10., 26., 96.), vec3(70., 112., 232.), g) / 255.0;
}

void main() {
    float R0 = uR0;
    float s = R0 / 455.0;
    vec2 p = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y);
    float r = length(p);
    float th = atan(p.y, p.x);
    float t = uLoop;
    float phi = PI * t;
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;

    float sb2 = pow(abs(cos(th + phi - 0.9)), 10.0);
    vec3 col;

    if (r > R0 * EXT) {
        // outside the watch: faint petrol glow fading to black
        float vig = 1.0 / (1.0 + pow(r / (2.1 * R0), 4.0));
        col = petrol((0.045 + 0.20 * sb2) * vig);
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    float sb = 0.6 * pow(abs(cos(th - phi)), 6.0) + 0.4 * pow(abs(cos(th + phi + 0.6)), 24.0);
    float Rg = 0.60 * R0;
    vec2 sc = vec2(0.0, 0.50 * R0);
    float Rs = 0.27 * R0;
    vec2 ps = p - sc;
    float rs = length(ps);

    if (rs < Rs) {
        // small seconds: concentric azurage
        float ths = atan(ps.y, ps.x);
        float g = cos(TAU * rs / (7.0 * s));
        float sbs = pow(abs(cos(ths - phi - 0.3)), 4.0);
        col = seagreen(0.16 + 0.55 * sbs * (0.72 + 0.28 * g) + 0.03 * g);
    } else if (r < Rg) {
        // spiral scale guilloche, flowing outward two rows per loop
        float v0 = log(max(r, 1.0) / R0) * 36.0 / TAU;
        float u0 = 36.0 * th / TAU + 0.6 * v0;
        float V = 2.0 * (v0 - t);
        float m = floor(V);
        float par = mod(m, 2.0);
        float ua = u0 - 0.5 * par;
        float dua = ua - floor(ua + 0.5);
        float dva = (V - m) * 0.5;
        float da = length(vec2(dua, dva));
        float ub = u0 - 0.5 * (1.0 - par);
        float dub = ub - floor(ub + 0.5);
        float dvb = (V - m - 1.0) * 0.5;
        float db = length(vec2(dub, dvb));
        bool ina = da < 0.5;
        float du = ina ? dua : dub;
        float dv = ina ? dva : dvb;
        float dd = clamp((ina ? da : db) * 2.0, 0.0, 1.3);
        float shadow = ina ? 1.0 : smoothstep(0.0, 0.16, da - 0.5);
        float facet = cos(th + atan(du, dv) - TAU * t - 0.5);
        float dome = 0.5 + 0.5 * facet * pow(min(dd, 1.0), 0.8);
        float rim = 1.0 - 0.55 * smoothstep(0.80, 1.0, dd);
        float g = (0.08 + (0.50 + 0.62 * sb) * (0.10 + 0.90 * pow(dome, 1.6))) * rim * (0.30 + 0.70 * shadow);
        float gfade = smoothstep(0.07 * R0, 0.17 * R0, r);
        col = silver(mix(0.18 + 0.4 * sb, g, gfade));
    } else if (r < R0) {
        // petrol sunburst
        float brush = 0.12 * ring(th + PI, 1400.0) + 0.10 * ring(th + PI, 300.0);
        col = petrol((0.23 + 0.60 * sb) * (1.0 + brush * 2.2));
    } else {
        float vig = 1.0 / (1.0 + pow(r / (2.1 * R0), 4.0));
        col = petrol((0.045 + 0.20 * sb2) * vig);
    }

    // static furniture (premultiplied alpha)
    vec2 uv = p / (EXT * R0) * 0.5 + 0.5;
    vec4 ov = texture2D(uOv, uv);
    col = col * (1.0 - ov.a) + ov.rgb;

    // ---- hands
    vec2 sh = vec2(3.0, 5.0) * s;                   // shadow offset
    // small seconds
    if (rs < Rs * 1.05) {
        float ln = 0.76 * Rs;
        float tl = 0.24 * Rs;
        float shd = needle(ps - sh * 0.6, uSec, ln, tl, s);
        col *= 1.0 - 0.45 * shd;
        float n = needle(ps, uSec, ln, tl, s);
        n = max(n, 1.0 - smoothstep(0.11 * Rs - 1.0, 0.11 * Rs + 1.0, rs));
        col = mix(col, blued(1.0, uSec, phi), n);
        float pin = 1.0 - smoothstep(0.04 * Rs - 1.0, 0.04 * Rs + 1.0, rs);
        col = mix(col, vec3(0.88, 0.91, 0.93), pin);
    }
    if (r < R0 * 0.92) {
        vec3 cream = vec3(246., 242., 226.) / 255.0;
        // hour
        float lh = 0.50 * R0;
        float wh = 0.050 * R0;
        float tl = 0.09 * R0;
        vec3 hs = leaf(p - sh, uHour, lh, wh, tl, s);
        col *= 1.0 - 0.50 * hs.x;
        vec3 hh = leaf(p, uHour, lh, wh, tl, s);
        col = mix(col, blued(hh.z, uHour, phi), hh.x);
        col = mix(col, cream, hh.y);
        // minute
        float lm = 0.86 * R0;
        float wm = 0.040 * R0;
        vec3 ms = leaf(p - sh * 1.4, uMin, lm, wm, tl, s);
        col *= 1.0 - 0.50 * ms.x;
        vec3 mm = leaf(p, uMin, lm, wm, tl, s);
        col = mix(col, blued(mm.z, uMin, phi), mm.x);
        col = mix(col, cream, mm.y);
        // centre cap
        float cap = 1.0 - smoothstep(0.050 * R0 - 1.0, 0.050 * R0 + 1.0, r);
        float cs = pow(abs(cos(th - 0.7 - phi)), 2.0);
        col = mix(col, silver(0.35 + 0.65 * cs), cap);
        float dot_ = 1.0 - smoothstep(0.017 * R0 - 1.0, 0.017 * R0 + 1.0, r);
        col = mix(col, vec3(22., 48., 150.) / 255.0, dot_);
    }

    gl_FragColor = vec4(col + dither, 1.0);
}
