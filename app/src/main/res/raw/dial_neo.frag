// Rotation dial: black single-hand dial. One hand shows the hours and, by the fine scale, the minutes.

void main() {
    float R0 = uR0;
    float s = R0 / 455.0;
    vec2 p = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y);
    float r = length(p);
    float th = atan(p.y, p.x);
    float phi = PI * uLoop;
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;
    vec3 col;

    if (r > R0 * 1.075) {
        gl_FragColor = vec4(backdrop(r, R0, th, phi, vec3(0.50, 0.52, 0.56)) + dither, 1.0);
        return;
    }
    if (r > R0) {
        float k = (r - R0) / (0.06 * R0);                       // slim polished bezel
        col = caseSteel(th, phi, 0.20 + 0.25 * sin(k * PI));
        col *= smoothstep(0.0, 0.10, k) * (1.0 - smoothstep(0.90, 1.22, k));
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    // glossy black, with a faint reflection drifting across it
    float sheen = pow(abs(cos(th - phi)), 8.0) * smoothstep(0.15, 0.95, r / R0);
    col = vec3(0.012, 0.013, 0.016) + vec3(0.045, 0.050, 0.060) * sheen;

    vec2 uv = p / (EXT * R0) * 0.5 + 0.5;
    vec4 ov = texture2D(uOv, uv);
    col = col * (1.0 - ov.a) + ov.rgb;

    // date window at 6
    vec2 w = p - vec2(0.0, 0.60 * R0);
    float wr = 0.068 * R0;
    if (length(w) < wr) {
        float idx = clamp(uDate, 1.0, 31.0) - 1.0;
        vec2 cell = vec2(mod(idx, 8.0), floor(idx / 8.0));
        vec2 auv = (cell + 0.5 + w / (wr * 1.9)) / vec2(8.0, 4.0);
        col = mix(col, vec3(0.94, 0.95, 0.94), texture2D(uAux, auv).r * (1.0 - smoothstep(wr * 0.80, wr * 0.92, length(w))));
    }
    col *= 1.0 - 0.5 * smoothstep(0.965, 1.0, r / R0);

    // the single hand
    vec2 sh = vec2(3.0, 5.0) * s;
    float len = 0.905 * R0;
    float wd = 0.027 * R0;
    float tail = 0.21 * R0;
    vec2 aq = handAxes(p, uHour);
    float m = pointerMargin(aq, len, wd, tail);
    float ms = pointerMargin(handAxes(p - sh * 1.3, uHour), len, wd, tail);
    vec3 white = vec3(0.95, 0.955, 0.95) * (0.93 + 0.07 * (aq.y < 0.0 ? 1.0 : -1.0) * cos(uHour - 0.6));
    col = layHand(col, m, ms, white, white, 0.0, 0.0);
    float hub = 1.0 - smoothstep(0.050 * R0 - 1.0, 0.050 * R0 + 1.0, r);
    col = mix(col, vec3(0.95) * (0.90 + 0.10 * cos(th - 0.7)), hub);

    gl_FragColor = vec4(col + dither, 1.0);
}
