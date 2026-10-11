// Rotation dial: black diver with a dual-scale bezel (hours on steel, minutes on black) and a broad-arrow hand.

const float EXTD = 1.50;
const vec3 ECRU = vec3(236., 233., 208.) / 255.0;

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

    if (k > 1.47) {
        gl_FragColor = vec4(backdrop(r, R0, th, phi, vec3(0.50, 0.54, 0.60)) + dither, 1.0);
        return;
    }
    vec4 ov = texture2D(uOv, p / (EXTD * R0) * 0.5 + 0.5);
    float sweep = pow(abs(cos(th - phi - 0.9)), 6.0);

    if (k > 1.0) {
        if (k > 1.405) {
            col = coinEdge(th, phi, 150.0) * (1.0 - smoothstep(1.445, 1.47, k));
        } else if (k > 1.215) {
            // glossy black minutes ring
            col = vec3(0.016, 0.018, 0.022) + vec3(0.16, 0.18, 0.21) * sweep * (0.4 + 0.6 * sin((k - 1.215) / 0.19 * PI));
        } else if (k > 1.065) {
            // brushed steel hours ring
            col = silver(0.36 + 0.34 * pow(abs(cos(th - phi - 0.9)), 3.0) + 0.03 * sin(r / s * 2.1));
        } else {
            // crystal edge and rehaut
            col = silver(0.10 + 0.30 * sweep) * smoothstep(1.0, 1.02, k);
        }
        col *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.012, abs(k - 1.215))) - 0.5 * (1.0 - smoothstep(0.0, 0.010, abs(k - 1.065)));
        col = col * (1.0 - ov.a) + ov.rgb;
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    float sheen = pow(abs(cos(th - phi)), 8.0) * smoothstep(0.1, 0.95, k);
    col = vec3(0.012, 0.013, 0.016) + vec3(0.040, 0.045, 0.055) * sheen;
    col = col * (1.0 - ov.a) + ov.rgb;
    col *= 1.0 - 0.6 * smoothstep(0.95, 1.0, k);

    vec2 sh = vec2(3.0, 5.0) * s;
    float tail = 0.11 * R0;
    // broad-arrow hour hand
    vec2 aq = handAxes(p, uHour);
    float lh = 0.56 * R0;
    float wh = 0.030 * R0;
    col = layHand(col, arrowMargin(aq, lh, wh, tail), arrowMargin(handAxes(p - sh, uHour), lh, wh, tail),
                  steelHand(aq, uHour, phi), ECRU, 3.4 * s, step(0.50 * lh, aq.x));
    // minute hand
    aq = handAxes(p, uMin);
    float lm = 0.90 * R0;
    float wm = 0.030 * R0;
    col = layHand(col, swordMargin(aq, lm, wm, tail), swordMargin(handAxes(p - sh * 1.4, uMin), lm, wm, tail),
                  steelHand(aq, uMin, phi), ECRU, 3.4 * s, step(0.20 * lm, aq.x) * (1.0 - step(lm - 3.4 * wm, aq.x)));
    // seconds
    float ln = 0.90 * R0;
    float tn = 0.22 * R0;
    col *= 1.0 - 0.40 * needle(p - sh * 1.8, uSec, ln, tn, s);
    float n = needle(p, uSec, ln, tn, s);
    n = max(n, 1.0 - smoothstep(0.034 * R0 - 1.0, 0.034 * R0 + 1.0, r));
    col = mix(col, silver(0.80), n);
    col = mix(col, silver(0.25), 1.0 - smoothstep(0.010 * R0 - 1.0, 0.010 * R0 + 1.0, r));

    gl_FragColor = vec4(col + dither, 1.0);
}
