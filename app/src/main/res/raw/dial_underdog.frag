// Rotation dial: fully lumed off-white field dial with black printing, sword hands and two dial screws.
// In the dark the whole dial glows and the printing stays black.

float screwHead(vec2 q, float rad, float slot, out vec3 c, float phi) {
    float d = length(q);
    float g = 0.5 + 0.5 * dot(normalize(q + 1e-4), vec2(cos(-0.9 + phi), sin(-0.9 + phi)));
    c = silver(0.30 + 0.55 * g * (1.0 - 0.5 * d / rad));
    vec2 sq = vec2(cos(slot) * q.x + sin(slot) * q.y, -sin(slot) * q.x + cos(slot) * q.y);
    c = mix(c, vec3(0.05), (1.0 - smoothstep(0.13 * rad - 0.8, 0.13 * rad + 0.8, abs(sq.y))) * step(d, rad * 0.86));
    return 1.0 - smoothstep(rad - 1.0, rad + 1.0, d);
}

void main() {
    float R0 = uR0;
    float s = R0 / 455.0;
    vec2 p = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y);
    float r = length(p);
    float k = r / R0;
    float th = atan(p.y, p.x);
    float phi = PI * uLoop;
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;
    vec3 col;

    if (k > 1.11) {
        gl_FragColor = vec4(backdrop(r, R0, th, phi, vec3(0.40, 0.75, 0.80)) * (1.0 - 0.6 * uGlow) + dither, 1.0);
        return;
    }
    if (k > 1.0) {
        // domed polished case edge
        float e = (k - 1.0) / 0.10;
        col = caseSteel(th, phi, 0.22 + 0.30 * sin(e * PI));
        col *= smoothstep(0.0, 0.08, e) * (1.0 - smoothstep(0.88, 1.10, e));
        col *= mix(1.0, 0.06, uGlow);
        col += uGlow * GLOW_AQUA * 0.10 * (1.0 - smoothstep(0.0, 0.35, e));      // dial light catching the rehaut
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    // the dial: lume paint itself, matt off-white by day
    float sheen = pow(abs(cos(th - phi)), 6.0) * smoothstep(0.1, 0.95, k);
    vec3 paint = vec3(0.900, 0.895, 0.870) * (0.94 + 0.06 * sheen);
    col = paint;
    vec4 ov = texture2D(uOv, p / (EXT * R0) * 0.5 + 0.5);
    col = col * (1.0 - ov.a) + ov.rgb;
    float printed = ov.a;
    col *= 1.0 - 0.35 * smoothstep(0.96, 1.0, k);

    // two dial screws
    vec3 sc;
    float sm = screwHead(p - vec2(-0.40, 0.065) * R0, 0.036 * R0, 0.7, sc, phi);
    col = mix(col, sc, sm);
    float sm2 = screwHead(p - vec2(0.37, -0.03) * R0, 0.036 * R0, 2.2, sc, phi);
    col = mix(col, sc, sm2);
    float covered = max(printed, max(sm, sm2));

    // hands: black sword frames filled with lume
    vec2 sh = vec2(3.0, 5.0) * s;
    float tail = 0.06 * R0;
    vec3 black = vec3(0.035, 0.037, 0.040);
    float inset = 4.0 * s;
    vec2 aq = handAxes(p, uHour);
    float lh = 0.55 * R0;
    float w = 0.040 * R0;
    float mH = swordMargin(aq, lh, w, tail);
    float gH = step(0.20 * lh, aq.x);
    col = layHand(col, mH, swordMargin(handAxes(p - sh, uHour), lh, w, tail), black, paint, inset, gH);
    aq = handAxes(p, uMin);
    float lm = 0.88 * R0;
    float mM = swordMargin(aq, lm, w * 0.86, tail);
    float gM = step(0.15 * lm, aq.x);
    col = layHand(col, mM, swordMargin(handAxes(p - sh * 1.4, uMin), lm, w * 0.86, tail), black, paint, inset, gM);
    // seconds: thin black needle with a framed lume pip near the tip
    aq = handAxes(p, uSec);
    float ln = 0.93 * R0;
    float mS = max(seg(aq, -0.20 * R0, ln, 1.4 * s), seg(aq, 0.80 * ln, 0.93 * ln, 0.017 * R0));
    float mSs = max(seg(handAxes(p - sh * 1.8, uSec), -0.20 * R0, ln, 1.4 * s), seg(handAxes(p - sh * 1.8, uSec), 0.80 * ln, 0.93 * ln, 0.017 * R0));
    float gS = step(0.80 * ln, aq.x);
    col = layHand(col, mS, mSs, black, paint, 3.0 * s, gS);
    float hub = 1.0 - smoothstep(0.040 * R0 - 1.0, 0.040 * R0 + 1.0, r);
    col = mix(col, black + 0.05 * pow(abs(cos(th - 0.7 - phi)), 2.0), hub);
    covered = max(covered, max(max(aaStep(mH), aaStep(mM)), max(aaStep(mS), hub)));

    // in the dark: everything unprinted glows, plus the lume inside each hand
    float handLume = max(max(aaStep(mH - inset) * gH, aaStep(mM - inset) * gM), aaStep(mS - 3.0 * s) * gS);
    float field = 1.0 - smoothstep(0.985, 1.0, k);
    float lume = max(field * (1.0 - covered), handLume);
    col = lumeGlow(col, lume * (0.86 + 0.14 * smoothstep(1.0, 0.2, k)), 0.0, GLOW_AQUA);

    gl_FragColor = vec4(col + dither, 1.0);
}
