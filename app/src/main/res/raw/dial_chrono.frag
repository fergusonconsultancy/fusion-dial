// Rotation dial: gold cushion-cased chronograph with a black dial.
// As on the watch, the centre seconds and the minute counter belong to the stopwatch,
// so they rest at zero. The running seconds are in the subdial at 6.

float cushion(vec2 q, vec2 half_, float n) {   // 1.0 on the outline, smaller inside
    return pow(pow(abs(q.x) / half_.x, n) + pow(abs(q.y) / half_.y, n), 1.0 / n);
}
float capsule(vec2 q, vec2 a, vec2 b, float rad) {
    vec2 pa = q - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - rad;
}

void main() {
    float R0 = uR0;
    float s = R0 / 455.0;
    vec2 p = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y);
    vec2 q = p / R0;
    float r = length(p);
    float k = r / R0;
    float th = atan(p.y, p.x);
    float phi = PI * uLoop;
    float aa = 1.6 / R0;
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;
    vec3 col = backdrop(r, R0, th, phi, vec3(0.62, 0.48, 0.20));

    float kCase = cushion(q, vec2(1.38, 1.34), 4.6);
    float kGlass = cushion(q, vec2(1.17, 1.13), 4.2);
    float sweep = pow(abs(cos(th - phi - 0.9)), 4.0);

    // crown and pushers on the right-hand side
    float dCrown = capsule(q, vec2(1.36, 0.0), vec2(1.50, 0.0), 0.085);
    float dPush = min(capsule(q, vec2(1.30, -0.52), vec2(1.47, -0.60), 0.060), capsule(q, vec2(1.30, 0.52), vec2(1.47, 0.60), 0.060));
    float side = 1.0 - smoothstep(-aa, aa, min(dCrown, dPush));
    col = mix(col, gold(0.34 + 0.40 * (0.5 - 0.5 * sin(q.y * 9.0)) + 0.2 * sweep), side);

    if (kCase < 1.0 + aa) {
        // brushed top of the case, polished lip round the crystal
        float brushed = 0.44 + 0.22 * sweep + 0.035 * sin(p.y / s * 1.7) + 0.05 * (0.5 - q.y * 0.4);
        vec3 cc = gold(brushed);
        float lip = 1.0 - smoothstep(1.0, 1.075, kGlass);
        cc = mix(cc, gold(0.30 + 0.65 * pow(abs(cos(th - phi * 1.0 + 0.6)), 3.0)), lip);
        cc *= 1.0 - 0.55 * smoothstep(0.985, 1.0, kCase);
        col = mix(col, cc, 1.0 - smoothstep(1.0 - aa, 1.0 + aa, kCase));
    }
    if (kGlass < 1.0) {
        // under the crystal: black, then the round dial
        vec3 d = vec3(0.010, 0.011, 0.014) + vec3(0.03, 0.05, 0.10) * pow(abs(cos(th - phi)), 8.0) * smoothstep(0.2, 1.1, k);
        vec4 ov = texture2D(uOv, p / (EXT * R0) * 0.5 + 0.5);
        d = d * (1.0 - ov.a) + ov.rgb;
        d *= 1.0 - 0.75 * smoothstep(0.94, 1.0, kGlass);

        vec2 sh = vec2(3.0, 5.0) * s;
        // minute counter at 9, resting at 60
        vec2 c9 = p - vec2(-0.42 * R0, 0.0);
        float n = needle(c9, 0.0, 0.17 * R0, 0.03 * R0, s);
        n = max(n, 1.0 - smoothstep(0.020 * R0 - 1.0, 0.020 * R0 + 1.0, length(c9)));
        d = mix(d, gold(0.72), n);
        // running seconds at 6
        vec2 c6 = p - vec2(0.0, 0.42 * R0);
        d *= 1.0 - 0.40 * needle(c6 - sh * 0.6, uSec, 0.135 * R0, 0.03 * R0, s);
        n = needle(c6, uSec, 0.135 * R0, 0.03 * R0, s);
        n = max(n, 1.0 - smoothstep(0.018 * R0 - 1.0, 0.018 * R0 + 1.0, length(c6)));
        d = mix(d, gold(0.78), n);

        float tail = 0.10 * R0;
        vec3 lume = vec3(250., 246., 228.) / 255.0;
        vec2 aq = handAxes(p, uHour);
        float lh = 0.50 * R0;
        float w = 0.026 * R0;
        d = layHand(d, swordMargin(aq, lh, w, tail), swordMargin(handAxes(p - sh, uHour), lh, w, tail),
                    goldHand(aq, uHour, phi), lume, 3.4 * s, step(0.45 * lh, aq.x) * (1.0 - step(lh - 3.2 * w, aq.x)));
        aq = handAxes(p, uMin);
        float lm = 0.80 * R0;
        d = layHand(d, swordMargin(aq, lm, w * 0.9, tail), swordMargin(handAxes(p - sh * 1.4, uMin), lm, w * 0.9, tail),
                    goldHand(aq, uMin, phi), lume, 3.2 * s, step(0.55 * lm, aq.x) * (1.0 - step(lm - 3.2 * w, aq.x)));
        // stopwatch seconds, resting at 12
        d *= 1.0 - 0.40 * needle(p - sh * 1.8, 0.0, 0.84 * R0, 0.20 * R0, s);
        n = needle(p, 0.0, 0.84 * R0, 0.20 * R0, s);
        n = max(n, 1.0 - smoothstep(0.032 * R0 - 1.0, 0.032 * R0 + 1.0, r));
        d = mix(d, gold(0.80), n);
        d = mix(d, gold(0.25), 1.0 - smoothstep(0.010 * R0 - 1.0, 0.010 * R0 + 1.0, r));

        col = mix(col, d, 1.0 - smoothstep(1.0 - aa * 1.2, 1.0, kGlass));
    }
    gl_FragColor = vec4(col + dither, 1.0);
}
