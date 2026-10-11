precision highp float;

// Shared by every Rotation dial. Each dial file adds its own main().
uniform vec2 uRes;       // surface size in pixels
uniform vec2 uCenter;    // dial centre, pixels, y measured from the top
uniform float uR0;       // dial radius in pixels
uniform float uLoop;     // 0..1 animation phase (10 s loop)
uniform float uHour;     // hand angles, radians clockwise from 12
uniform float uMin;
uniform float uSec;
uniform sampler2D uOv;   // this dial's static furniture

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float EXT = 1.18;  // overlay half-size in units of R0 (matches tools/overlay_rotation.py)

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// periodic 1D value noise around the dial, for brushed sunburst streaks
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
vec3 silver(float v) { return ramp(v, vec3(16., 21., 25.), vec3(70., 82., 90.), vec3(150., 164., 172.), vec3(222., 232., 236.), vec3(255.)); }

// polished case steel with two travelling highlights
vec3 caseSteel(float th, float phi, float base) {
    float v = base + 0.55 * pow(abs(cos(th - phi - 0.9)), 6.0) + 0.25 * pow(abs(cos(th + phi * 0.5 + 0.4)), 14.0);
    return silver(v);
}

// Leaf-shaped hand. x = coverage, y = lume coverage, z = which bevel (-1 or 1).
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

// Straight baton hand with a pointed tip. x = coverage, y = lume coverage, z = bevel side.
vec3 baton(vec2 p, float ang, float len, float w, float tail, float s) {
    vec2 d = vec2(sin(ang), -cos(ang));
    float a = dot(p, d);
    float q = dot(p, vec2(-d.y, d.x));
    float h = w * (1.0 - smoothstep(len - 2.2 * w, len, a) * 0.85);
    float ends = smoothstep(-tail - 1.0, -tail + 1.0, a) * (1.0 - smoothstep(len - 1.0, len + 1.0, a));
    float m = (1.0 - smoothstep(h - 0.8, h + 0.8, abs(q))) * ends;
    float hl = h - 3.2 * s;
    float lume = (1.0 - smoothstep(hl - 0.8, hl + 0.8, abs(q))) * smoothstep(0.22 * len, 0.25 * len, a) * (1.0 - smoothstep(len - 3.2 * w, len - 2.6 * w, a));
    return vec3(m, lume * m, q < 0.0 ? -1.0 : 1.0);
}

// Thin seconds needle with a counterweight.
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
vec3 polished(float bevel, float ang, float phi) {
    float g = 0.5 + 0.5 * bevel * cos(ang - 2.0 * phi - 0.6);
    return silver(0.42 + 0.50 * g);
}

const vec3 LUME = vec3(244., 243., 232.) / 255.0;

// Everything outside the case: a faint glow in the dial's colour, fading to black.
vec3 backdrop(float r, float R0, float th, float phi, vec3 tint) {
    float vig = 1.0 / (1.0 + pow(r / (2.1 * R0), 4.0));
    float sb = pow(abs(cos(th + phi - 0.9)), 10.0);
    return tint * (0.03 + 0.16 * sb) * vig;
}

// ---------------------------------------------------------------------------
// Extra parts for the later dials.
uniform float uDate;      // day of the month, 1..31
uniform sampler2D uAux;   // date-number atlas, eight numbers to a row

float aaStep(float m) { return smoothstep(-0.8, 0.8, m); }

// A point in a hand's own frame: x runs along the hand, y across it.
vec2 handAxes(vec2 p, float ang) {
    vec2 d = vec2(sin(ang), -cos(ang));
    return vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
}
// "Margin" functions: how many pixels a point sits inside a shape (negative = outside).
// Shrinking a shape for its lume is then just subtracting from the margin.
float seg(vec2 aq, float a0, float a1, float h) { return min(h - abs(aq.y), min(aq.x - a0, a1 - aq.x)); }
float swordMargin(vec2 aq, float len, float w, float tail) {
    float h = w * (1.0 - 0.85 * smoothstep(len - 3.0 * w, len, aq.x));
    return seg(aq, -tail, len, h);
}
float snowflakeMargin(vec2 aq, float len, float w, float tail) {
    float m = seg(aq, -tail, 0.70 * len, w);
    float d = 0.215 * len;
    m = max(m, (d - (abs(aq.x - 0.74 * len) + abs(aq.y))) * 0.7071);
    return max(m, seg(aq, 0.74 * len, len, w * 0.8));
}
float arrowMargin(vec2 aq, float len, float w, float tail) {
    float m = seg(aq, -tail, 0.56 * len, w);
    float a0 = 0.48 * len;
    float hw = 0.215 * len * (1.0 - (aq.x - a0) / (len - a0));
    return max(m, min(hw - abs(aq.y), aq.x - a0) * 0.85);
}
float pointerMargin(vec2 aq, float len, float w, float tail) {
    float h = aq.x > 0.0 ? mix(w, w * 0.16, clamp(aq.x / len, 0.0, 1.0)) : w * 1.12;
    return seg(aq, -tail, len, h);
}

// Lays one hand over the picture: shadow, metal body, then lume set in by lumeInset pixels.
vec3 layHand(vec3 col, float m, float mShadow, vec3 metal, vec3 lume, float lumeInset, float lumeGate) {
    col *= 1.0 - 0.50 * aaStep(mShadow);
    col = mix(col, metal, aaStep(m));
    return mix(col, lume, aaStep(m - lumeInset) * lumeGate);
}
vec3 steelHand(vec2 aq, float ang, float phi) { return polished(aq.y < 0.0 ? -1.0 : 1.0, ang, phi); }

vec3 gold(float v) { return ramp(v, vec3(40., 26., 6.), vec3(128., 92., 30.), vec3(206., 162., 72.), vec3(246., 214., 130.), vec3(255., 244., 206.)); }
vec3 goldHand(vec2 aq, float ang, float phi) {
    float g = 0.5 + 0.5 * (aq.y < 0.0 ? -1.0 : 1.0) * cos(ang - 2.0 * phi - 0.6);
    return gold(0.42 + 0.48 * g);
}

// Knurled grip ring round a rotating bezel.
vec3 coinEdge(float th, float phi, float teeth) {
    float t = 0.5 + 0.5 * cos(th * teeth);
    return silver(0.20 + 0.55 * t * (0.35 + 0.65 * pow(abs(cos(th - phi - 0.9)), 2.0)));
}
