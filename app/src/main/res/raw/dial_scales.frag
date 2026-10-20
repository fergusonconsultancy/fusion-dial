// Rotation dial: silver-grey scale guilloche with a fret chapter ring and blued hands.

void main() {
    float R0 = uR0;
    float s = R0 / 455.0;
    vec2 p = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y);
    float r = length(p);
    float th = atan(p.y, p.x);
    float phi = PI * uLoop;
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;
    vec3 col;

    if (r > R0 * 1.16) {
        gl_FragColor = vec4(mix(1.0, 0.25, uGlow) * backdrop(r, R0, th, phi, vec3(0.55, 0.60, 0.68)) + dither, 1.0);
        return;
    }
    if (r > R0) {
        // bezel: polished chamfer inside, circular brushing outside
        float k = (r - R0) / (0.14 * R0);
        vec3 chamfer = caseSteel(th, phi, 0.30);
        float brushed = 0.34 + 0.26 * pow(abs(cos(th - phi - 0.9)), 3.0) + 0.03 * sin(r / s * 1.9);
        col = mix(chamfer, silver(brushed), smoothstep(0.26, 0.32, k));
        col *= smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.95, 1.12, k));
        col *= mix(1.0, 0.07, uGlow);
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    float sb = 0.6 * pow(abs(cos(th - phi)), 6.0) + 0.4 * pow(abs(cos(th + phi + 0.6)), 24.0);

    // engraved scales, fixed in the metal; only the light moves
    float v0 = log(max(r, 1.0) / R0) * 40.0 / TAU;
    float u0 = 40.0 * th / TAU + 0.6 * v0;
    float V = 2.0 * v0;
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
    float facet = cos(th + atan(du, dv) - TAU * uLoop - 0.5);
    float dome = 0.5 + 0.5 * facet * pow(min(dd, 1.0), 0.8);
    float rim = 1.0 - 0.55 * smoothstep(0.80, 1.0, dd);
    float g = (0.10 + (0.56 + 0.60 * sb) * (0.12 + 0.88 * pow(dome, 1.5))) * rim * (0.32 + 0.68 * shadow);
    float gfade = smoothstep(0.05 * R0, 0.14 * R0, r);
    col = silver(mix(0.22 + 0.4 * sb, g, gfade));

    vec2 uv = p / (EXT * R0) * 0.5 + 0.5;
    vec4 ov = texture2D(uOv, uv);
    col = col * (1.0 - ov.a) + ov.rgb;
    col *= 1.0 - 0.45 * smoothstep(0.955, 1.0, r / R0);

    vec2 sh = vec2(3.0, 5.0) * s;
    if (r < R0 * 0.93) {
        float tl = 0.09 * R0;
        float lh = 0.50 * R0;
        float wh = 0.052 * R0;
        vec3 hs = leaf(p - sh, uHour, lh, wh, tl, s);
        col *= 1.0 - 0.50 * hs.x;
        vec3 hh = leaf(p, uHour, lh, wh, tl, s);
        col = mix(col, blued(hh.z, uHour, phi), hh.x);
        col = mix(col, LUME, hh.y);
        float lm = 0.78 * R0;
        float wm = 0.042 * R0;
        vec3 ms = leaf(p - sh * 1.4, uMin, lm, wm, tl, s);
        col *= 1.0 - 0.50 * ms.x;
        vec3 mm = leaf(p, uMin, lm, wm, tl, s);
        col = mix(col, blued(mm.z, uMin, phi), mm.x);
        col = mix(col, LUME, mm.y);
        // central seconds
        float ln = 0.84 * R0;
        float tn = 0.20 * R0;
        col *= 1.0 - 0.40 * needle(p - sh * 1.8, uSec, ln, tn, s);
        float n = needle(p, uSec, ln, tn, s);
        n = max(n, 1.0 - smoothstep(0.030 * R0 - 1.0, 0.030 * R0 + 1.0, r));
        col = mix(col, blued(1.0, uSec, phi), n);
        col = mix(col, silver(0.85), 1.0 - smoothstep(0.010 * R0 - 1.0, 0.010 * R0 + 1.0, r));
        col = dialLume(col, uv, max(max(hh.x, mm.x), n), max(hh.y, mm.y), GLOW_AQUA);
    } else {
        col = dialLume(col, uv, 0.0, 0.0, GLOW_AQUA);
    }
    gl_FragColor = vec4(col + dither, 1.0);
}
