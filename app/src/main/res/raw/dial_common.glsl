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
