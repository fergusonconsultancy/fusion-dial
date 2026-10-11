// Rotation dial: petrol sunburst sports dial with a small seconds at 6.

vec3 petrol(float v) { return ramp(v, vec3(2., 20., 27.), vec3(5., 60., 76.), vec3(16., 122., 140.), vec3(120., 208., 214.), vec3(226., 250., 248.)); }
vec3 subgreen(float v) { return ramp(v, vec3(2., 24., 24.), vec3(6., 70., 66.), vec3(36., 140., 124.), vec3(150., 220., 200.), vec3(230., 250., 242.)); }

void main() {
    float R0 = uR0;
    float s = R0 / 455.0;
    vec2 p = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y);
    float r = length(p);
    float th = atan(p.y, p.x);
    float phi = PI * uLoop;
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;
    vec3 col;

    if (r > R0 * 1.15) {
        gl_FragColor = vec4(backdrop(r, R0, th, phi, vec3(0.10, 0.55, 0.62)) + dither, 1.0);
        return;
    }
    if (r > R0) {
        // round polished bezel
        float k = (r - R0) / (0.13 * R0);
        col = caseSteel(th, phi, 0.16 + 0.30 * sin(k * PI));
        col *= smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.94, 1.12, k));
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    float sb = 0.6 * pow(abs(cos(th - phi)), 6.0) + 0.4 * pow(abs(cos(th + phi + 0.6)), 24.0);
    vec2 sc = vec2(0.0, 0.47 * R0);
    float Rs = 0.245 * R0;
    vec2 ps = p - sc;
    float rs = length(ps);

    if (rs < Rs) {
        float ths = atan(ps.y, ps.x);
        float g = cos(TAU * rs / (6.0 * s));
        float sbs = pow(abs(cos(ths - phi - 0.3)), 4.0);
        col = subgreen(0.17 + 0.50 * sbs * (0.74 + 0.26 * g) + 0.03 * g);
    } else {
        float brush = 0.12 * ring(th + PI, 1400.0) + 0.10 * ring(th + PI, 300.0);
        col = petrol((0.24 + 0.58 * sb) * (1.0 + brush * 2.0));
        col *= 1.0 - 0.35 * smoothstep(0.93, 1.0, r / R0);            // shadow under the bezel
    }

    vec2 uv = p / (EXT * R0) * 0.5 + 0.5;
    vec4 ov = texture2D(uOv, uv);
    col = col * (1.0 - ov.a) + ov.rgb;

    vec2 sh = vec2(3.0, 5.0) * s;
    if (rs < Rs * 1.05) {
        float ln = 0.80 * Rs;
        float tl = 0.22 * Rs;
        col *= 1.0 - 0.40 * needle(ps - sh * 0.6, uSec, ln, tl, s);
        float n = needle(ps, uSec, ln, tl, s);
        n = max(n, 1.0 - smoothstep(0.085 * Rs - 1.0, 0.085 * Rs + 1.0, rs));
        col = mix(col, polished(1.0, uSec, phi), n);
    }
    if (r < R0 * 0.95) {
        float tl = 0.10 * R0;
        float lh = 0.50 * R0;
        float lm = 0.80 * R0;
        float w = 0.030 * R0;
        vec3 hs = baton(p - sh, uHour, lh, w, tl, s);
        col *= 1.0 - 0.50 * hs.x;
        vec3 hh = baton(p, uHour, lh, w, tl, s);
        col = mix(col, polished(hh.z, uHour, phi), hh.x);
        col = mix(col, LUME, hh.y);
        vec3 ms = baton(p - sh * 1.4, uMin, lm, w * 0.86, tl, s);
        col *= 1.0 - 0.50 * ms.x;
        vec3 mm = baton(p, uMin, lm, w * 0.86, tl, s);
        col = mix(col, polished(mm.z, uMin, phi), mm.x);
        col = mix(col, LUME, mm.y);
        float cap = 1.0 - smoothstep(0.042 * R0 - 1.0, 0.042 * R0 + 1.0, r);
        col = mix(col, silver(0.40 + 0.60 * pow(abs(cos(th - 0.7 - phi)), 2.0)), cap);
        col = mix(col, silver(0.18), 1.0 - smoothstep(0.012 * R0 - 1.0, 0.012 * R0 + 1.0, r));
    }
    gl_FragColor = vec4(col + dither, 1.0);
}
