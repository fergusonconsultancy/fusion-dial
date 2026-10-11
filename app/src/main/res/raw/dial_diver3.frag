// Rotation dial: taupe diver in a silver case, with snowflake hands.

const float EXTD = 1.50;

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

    if (k > 1.43) {
        gl_FragColor = vec4(backdrop(r, R0, th, phi, vec3(0.58, 0.54, 0.48)) + dither, 1.0);
        return;
    }
    vec4 ov = texture2D(uOv, p / (EXTD * R0) * 0.5 + 0.5);
    float sweep = pow(abs(cos(th - phi - 0.9)), 4.0);
    float brush = 0.10 * ring(th + PI, 900.0);

    if (k > 1.0) {
        if (k > 1.345) {
            col = coinEdge(th, phi, 170.0) * (1.0 - smoothstep(1.405, 1.43, k));
        } else if (k > 1.07) {
            // matt taupe insert with a soft radial sheen
            col = vec3(0.400, 0.385, 0.355) * (0.62 + 0.55 * sweep) * (1.0 + brush);
        } else {
            col = silver(0.10 + 0.32 * sweep) * smoothstep(1.0, 1.02, k);
        }
        col *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.010, abs(k - 1.07))) - 0.5 * (1.0 - smoothstep(0.0, 0.010, abs(k - 1.345)));
        col = col * (1.0 - ov.a) + ov.rgb;
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    float sb = 0.6 * pow(abs(cos(th - phi)), 4.0) + 0.4 * pow(abs(cos(th + phi + 0.6)), 10.0);
    col = vec3(0.315, 0.310, 0.275) * (0.60 + 0.50 * sb) * (1.0 + brush * 0.6);
    col = col * (1.0 - ov.a) + ov.rgb;
    col *= 1.0 - 0.6 * smoothstep(0.95, 1.0, k);

    vec2 sh = vec2(3.0, 5.0) * s;
    float tail = 0.12 * R0;
    vec3 white = vec3(240., 242., 240.) / 255.0;
    // snowflake hour hand
    vec2 aq = handAxes(p, uHour);
    float lh = 0.58 * R0;
    float wh = 0.032 * R0;
    col = layHand(col, snowflakeMargin(aq, lh, wh, tail), snowflakeMargin(handAxes(p - sh, uHour), lh, wh, tail),
                  steelHand(aq, uHour, phi), white, 3.6 * s, step(0.22 * lh, aq.x));
    // minute hand
    aq = handAxes(p, uMin);
    float lm = 0.90 * R0;
    float wm = 0.034 * R0;
    col = layHand(col, swordMargin(aq, lm, wm, tail), swordMargin(handAxes(p - sh * 1.4, uMin), lm, wm, tail),
                  steelHand(aq, uMin, phi), white, 3.6 * s, step(0.20 * lm, aq.x) * (1.0 - step(lm - 3.4 * wm, aq.x)));
    // seconds, with its own small snowflake
    aq = handAxes(p, uSec);
    vec2 aqs = handAxes(p - sh * 1.8, uSec);
    float ln = 0.90 * R0;
    float d = 0.050 * R0;
    float m = max(seg(aq, -0.24 * R0, ln, 1.5 * s), (d - (abs(aq.x - 0.60 * ln) + abs(aq.y))) * 0.7071);
    float ms = max(seg(aqs, -0.24 * R0, ln, 1.5 * s), (d - (abs(aqs.x - 0.60 * ln) + abs(aqs.y))) * 0.7071);
    col = layHand(col, m, ms, silver(0.82), white, 3.0 * s, step(0.50 * ln, aq.x) * (1.0 - step(0.70 * ln, aq.x)));
    col = mix(col, silver(0.75), 1.0 - smoothstep(0.036 * R0 - 1.0, 0.036 * R0 + 1.0, r));
    col = mix(col, silver(0.22), 1.0 - smoothstep(0.011 * R0 - 1.0, 0.011 * R0 + 1.0, r));

    gl_FragColor = vec4(col + dither, 1.0);
}
