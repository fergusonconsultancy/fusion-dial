precision highp float;

uniform vec2 uRes;       // surface size in pixels
uniform vec2 uCenter;    // movement centre, pixels, y measured from the top
uniform float uR0;       // movement radius in pixels
uniform float uBal;      // balance wheel angle, radians
uniform float uRotor;    // rotor heavy-side direction, radians clockwise from 12
uniform float uWind;     // winding wheel angle, radians
uniform float uLight;    // light direction, radians
uniform sampler2D uOv;   // engraving masks: r = case ring, g = rotor, b = plate

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float EXT = 1.34;  // texture half-size in movement radii (matches tools/caseback_overlay.py)

float AA;                // one pixel, in movement radii

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float fill(float d) { return 1.0 - smoothstep(-AA, AA, d); }        // 1 inside a signed distance
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// rhodium-plated metal, brightness in, colour out
vec3 rhodium(float v) {
    v = clamp(v, 0.0, 1.0);
    vec3 c = mix(vec3(0.045, 0.048, 0.055), vec3(0.46, 0.47, 0.49), smoothstep(0.0, 0.5, v));
    return mix(c, vec3(0.97, 0.975, 0.985), smoothstep(0.5, 1.0, v));
}
vec3 steel(float v) {
    v = clamp(v, 0.0, 1.0);
    vec3 c = mix(vec3(0.03, 0.032, 0.036), vec3(0.36, 0.37, 0.39), smoothstep(0.0, 0.55, v));
    return mix(c, vec3(0.90, 0.91, 0.93), smoothstep(0.55, 1.0, v));
}
vec3 brass(float v) {
    v = clamp(v, 0.0, 1.0);
    vec3 c = mix(vec3(0.10, 0.07, 0.02), vec3(0.72, 0.56, 0.26), smoothstep(0.0, 0.55, v));
    return mix(c, vec3(1.0, 0.93, 0.70), smoothstep(0.55, 1.0, v));
}
const vec3 GOLD = vec3(0.86, 0.68, 0.30);

// Glashutte ribbing: broad parallel stripes, each catching the light differently
float ribbing(vec2 q, float ang, float w, vec2 L) {
    vec2 d = vec2(cos(ang), sin(ang));
    float x = dot(q, d) / w;
    float f = fract(x);
    float y = dot(q, vec2(-d.y, d.x));
    float across = dot(L, d);
    float v = 0.50 + 0.19 * across * (f - 0.5) * 2.0;
    v += 0.10 * dot(q, L);                                           // broad sheen over the whole plate
    v += 0.030 * sin((y + 0.5 * w * sin(f * PI)) * 520.0);           // the cutter's fine arcs
    v *= 1.0 - 0.22 * (smoothstep(0.93, 1.0, f) + (1.0 - smoothstep(0.0, 0.05, f)));
    return v;
}

// perlage: overlapping circular graining
float perlage(vec2 q, float cell, vec2 L) {
    float best = 0.3;
    float bd = 9.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = floor(q / cell) + vec2(float(i), float(j));
            vec2 c = (g + 0.5 + vec2(mod(g.y, 2.0) * 0.5, 0.0)) * cell;
            vec2 e = q - c;
            float d = length(e) / (cell * 0.78);
            if (d < 1.0 && g.y * 7.0 + g.x < bd) {                   // lower rows overlap higher ones
                bd = g.y * 7.0 + g.x;
                float a = atan(e.y, e.x);
                best = 0.30 + 0.26 * abs(cos(a - atan(L.y, L.x))) * (0.4 + 0.6 * d) - 0.10 * smoothstep(0.85, 1.0, d);
            }
        }
    }
    return best;
}

// blued screw with a slot; returns coverage, writes colour
float screw(vec2 q, vec2 c, float r, float slotAng, vec2 L, out vec3 col) {
    vec2 e = q - c;
    float d = length(e);
    float m = fill(d - r);
    float g = 0.5 + 0.5 * dot(normalize(e + 1e-5), L);
    vec3 blue = mix(vec3(0.03, 0.07, 0.30), vec3(0.20, 0.36, 0.86), g * (0.35 + 0.65 * d / r));
    blue += 0.25 * pow(max(0.0, 1.0 - length(e - L * r * 0.35) / (r * 0.5)), 2.0);
    vec2 s = rot(e, -slotAng);
    float slot = (1.0 - smoothstep(r * 0.13 - AA, r * 0.13 + AA, abs(s.y)));
    col = mix(blue, vec3(0.01, 0.015, 0.05), slot * 0.85);
    return m;
}

// ruby in a polished setting
float jewel(vec2 q, vec2 c, float r, vec2 L, out vec3 col) {
    vec2 e = q - c;
    float d = length(e);
    float m = fill(d - r * 1.45);
    float g = 0.5 + 0.5 * dot(normalize(e + 1e-5), L);
    vec3 setting = rhodium(0.35 + 0.6 * g);
    vec3 ruby = mix(vec3(0.30, 0.0, 0.05), vec3(0.95, 0.10, 0.22), 0.25 + 0.75 * (1.0 - d / r));
    ruby += 0.55 * pow(max(0.0, 1.0 - length(e + L * r * 0.35) / (r * 0.45)), 2.0);
    col = mix(setting, ruby, fill(d - r));
    col = mix(col, vec3(0.06, 0.0, 0.01), fill(d - r * 0.22));       // the pivot hole
    return m;
}

// toothed wheel with a sunburst polish
float wheel(vec2 q, vec2 c, float r, float teeth, float ang, vec2 L, out vec3 col) {
    vec2 e = rot(q - c, -ang);
    float d = length(e);
    float a = atan(e.y, e.x);
    float tooth = smoothstep(-0.3, 0.3, cos(a * teeth));
    float rr = r * (0.955 + 0.045 * tooth);
    float m = fill(d - rr);
    float la = atan(L.y, L.x) - ang;
    float v = 0.34 + 0.50 * pow(abs(cos(a - la)), 3.0) + 0.05 * sin(a * 240.0);
    v *= 1.0 - 0.35 * smoothstep(r * 0.86, r * 0.90, d) * (1.0 - smoothstep(r * 0.90, r * 0.93, d));
    col = rhodium(v);
    return m;
}

void main() {
    float R = uR0;
    AA = 1.0 / R;
    vec2 q = vec2(gl_FragCoord.x - uCenter.x, (uRes.y - gl_FragCoord.y) - uCenter.y) / R;
    float r = length(q);
    float th = atan(q.y, q.x);
    vec2 L = vec2(cos(uLight), sin(uLight));
    float dither = (hash2(gl_FragCoord.xy) - 0.5) * 1.4 / 255.0;
    vec3 col;

    // ---------- outside the watch
    if (r > 1.32) {
        float glow = 0.05 / (1.0 + pow((r - 1.3) * 1.6, 2.0)) * (0.6 + 0.4 * dot(normalize(q), L));
        gl_FragColor = vec4(vec3(0.55, 0.62, 0.70) * glow + dither, 1.0);
        return;
    }

    vec2 uv = q / EXT * 0.5 + 0.5;
    vec3 ov = texture2D(uOv, uv).rgb;

    // ---------- steel caseback ring
    if (r > 1.0) {
        float sweep = pow(abs(cos(th - uLight)), 3.0);
        float v = 0.30 + 0.42 * sweep + 0.035 * sin(r * 900.0) + 0.02 * sin(r * 2300.0 + th * 3.0);
        col = steel(v);
        // polished bevels inside and out
        float inner = 1.0 - smoothstep(1.0, 1.035, r);
        float outer = smoothstep(1.275, 1.30, r);
        col = mix(col, steel(0.25 + 0.75 * pow(abs(cos(th - uLight + 0.5)), 2.0)), inner);
        col = mix(col, steel(0.15 + 0.80 * pow(abs(cos(th - uLight - 0.4)), 2.0)), outer);
        col = mix(col, vec3(0.02, 0.022, 0.026), ov.r * 0.88);       // engraving
        // six case screws
        for (int i = 0; i < 6; i++) {
            float a = (float(i) * 60.0 + 30.0) * PI / 180.0;
            vec2 c = 1.165 * vec2(sin(a), -cos(a));
            vec2 e = q - c;
            float d = length(e);
            float g = 0.5 + 0.5 * dot(normalize(e + 1e-5), L);
            vec3 sc = steel(0.35 + 0.55 * g);
            vec2 s = rot(e, -(a * 1.7 + 0.4));
            sc = mix(sc, vec3(0.02), 1.0 - smoothstep(0.008 - AA, 0.008 + AA, abs(s.y)));
            col = mix(col, vec3(0.03), fill(d - 0.050));              // countersink
            col = mix(col, sc, fill(d - 0.042));
        }
        col *= 1.0 - smoothstep(1.30, 1.32, r);
        gl_FragColor = vec4(col + dither, 1.0);
        return;
    }

    // ---------- movement
    vec2 bc = vec2(-0.40, 0.42);                    // balance centre
    vec2 bdir = normalize(bc);                      // from centre out through the balance
    vec2 bperp = vec2(-bdir.y, bdir.x);
    vec2 w1 = vec2(0.40, -0.30);                    // ratchet wheel
    vec2 w2 = vec2(0.615, 0.07);                     // its small neighbour

    float dRecess = sdCapsule(q, bc, bc + bdir * 1.2, 0.365);
    float dW1 = length(q - w1) - 0.275;
    float dW2 = length(q - w2) - 0.150;
    float dOpen = min(dRecess, min(dW1, dW2));      // < 0 where the plate is cut away
    float plate = 1.0 - fill(dOpen);

    // floor of the movement: perlage, shadowed near the plate edge
    float floorV = perlage(q, 0.085, L) * (0.50 + 0.50 * smoothstep(0.0, 0.09, -dOpen));
    col = rhodium(floorV);

    // --- winding wheels in their openings
    vec3 wc;
    float wm = wheel(q, w2, 0.128, 30.0, -uWind * 2.0 + 0.1, L, wc);
    col = mix(col, wc, wm);
    wm = wheel(q, w1, 0.250, 60.0, uWind, L, wc);
    col = mix(col, wc, wm);
    vec3 sc;
    float sm = screw(q, w1, 0.060, uWind + 0.6, L, sc);
    col = mix(col, rhodium(0.75), fill(length(q - w1) - 0.085));
    col = mix(col, sc, sm);
    sm = screw(q, w2, 0.036, -uWind * 2.0, L, sc);
    col = mix(col, sc, sm);

    // --- balance wheel and hairspring
    vec2 e = q - bc;
    float be = length(e);
    if (be < 0.32) {
        vec2 el = rot(e, -uBal);
        float ea = atan(el.y, el.x);
        // blued hairspring, breathing with the swing
        float pitch = 0.0165 * (1.0 + 0.10 * sin(uBal * 0.5));
        float turn = (be - 0.035) / pitch - ea / TAU;
        float coil = abs(fract(turn) - 0.5) * pitch;
        float spring = (1.0 - smoothstep(0.0028, 0.0028 + AA * 1.5, 0.5 * pitch - coil))
                     * step(0.035, be) * (1.0 - step(0.155, be));
        col = mix(col, vec3(0.10, 0.20, 0.72) + 0.25 * (0.5 + 0.5 * dot(normalize(e), L)), spring);
        // rim
        float g = 0.5 + 0.5 * dot(normalize(e), L);
        float rim = fill(abs(be - 0.262) - 0.026);
        col = mix(col, brass(0.30 + 0.60 * pow(g, 1.5) + 0.04 * sin(ea * 90.0)), rim);
        // two spokes
        float spoke = (1.0 - smoothstep(0.017 - AA, 0.017 + AA, abs(el.y))) * (1.0 - step(0.262, be)) * step(0.03, be);
        col = mix(col, brass(0.42 + 0.40 * g), spoke * (1.0 - spring * 0.0));
        // collet
        col = mix(col, brass(0.55 + 0.35 * g), fill(be - 0.040));
    }

    // --- three-quarter plate
    float rib = ribbing(q, 0.62, 0.118, L);
    vec3 pc = rhodium(rib);
    float edge = smoothstep(0.022, 0.0, dOpen) * step(0.0, dOpen);    // polished bevel round each opening
    pc = mix(pc, rhodium(0.55 + 0.45 * abs(dot(normalize(q - bc), L))), edge * 0.85);
    pc = mix(pc, GOLD * (0.75 + 0.35 * rib), ov.b);                   // gilt engraving
    col = mix(col, pc, plate);

    // --- balance bridge, screwed down on both sides
    vec2 ba = bc + bperp * 0.50, bb = bc - bperp * 0.50;
    float dBr = min(sdCapsule(q, ba, bb, 0.050), min(length(q - ba) - 0.082, min(length(q - bb) - 0.082, length(q - bc) - 0.072)));
    float brShadow = fill(sdCapsule(q - vec2(0.012, 0.018), ba, bb, 0.055));
    col *= 1.0 - 0.45 * brShadow * (1.0 - fill(dBr));
    vec3 brc = rhodium(ribbing(q, 0.62 + 1.2, 0.07, L) + 0.06);
    brc = mix(brc, rhodium(0.95), smoothstep(-0.014, 0.0, dBr) * 0.8);
    col = mix(col, brc, fill(dBr));
    vec3 jc;
    float jm = jewel(q, bc, 0.030, L, jc);
    col = mix(col, brass(0.75), fill(length(q - bc) - 0.052));        // shock setting
    col = mix(col, jc, jm);
    sm = screw(q, ba, 0.046, 0.5, L, sc);  col = mix(col, sc, sm);
    sm = screw(q, bb, 0.046, 2.1, L, sc);  col = mix(col, sc, sm);

    // --- jewels and screws set in the plate
    jm = jewel(q, vec2(0.10, 0.52), 0.036, L, jc);    col = mix(col, jc, jm * plate);
    jm = jewel(q, vec2(0.40, 0.30), 0.030, L, jc);    col = mix(col, jc, jm * plate);
    jm = jewel(q, vec2(-0.12, -0.50), 0.034, L, jc);  col = mix(col, jc, jm * plate);
    jm = jewel(q, vec2(-0.47, -0.22), 0.028, L, jc);  col = mix(col, jc, jm * plate);
    sm = screw(q, vec2(0.64, 0.42), 0.052, 0.9, L, sc);    col = mix(col, sc, sm);
    sm = screw(q, vec2(-0.30, -0.66), 0.052, 2.4, L, sc);  col = mix(col, sc, sm);
    sm = screw(q, vec2(0.14, 0.74), 0.052, 1.6, L, sc);    col = mix(col, sc, sm);
    sm = screw(q, vec2(-0.74, -0.14), 0.052, 0.2, L, sc);  col = mix(col, sc, sm);

    // --- winding rotor (drawn in its own frame, heavy side pointing down)
    vec2 ql = rot(q, PI - uRotor);
    vec2 qs = rot(q - vec2(0.016, 0.024), PI - uRotor);              // for its shadow
    float rotorM = 0.0;
    float shadowM = 0.0;
    float winEdge = 0.0;
    for (int k = 0; k < 2; k++) {
        vec2 p = k == 0 ? qs : ql;
        float pr = length(p);
        float pa = atan(p.x, p.y);                                    // 0 along the heavy-side centreline
        float half_ = smoothstep(-0.03 - AA, -0.03 + AA, p.y);
        float body = half_ * fill(pr - 0.975);
        // two skeleton windows in the web
        float win = fill(abs(pr - 0.49) - 0.165) * fill(abs(abs(pa) - 0.78) - 0.50);
        float winOut = fill(abs(pr - 0.49) - 0.183) * fill(abs(abs(pa) - 0.78) - 0.535);
        body *= 1.0 - win;
        body = max(body, fill(pr - 0.185));                           // hub
        if (k == 0) shadowM = body; else { rotorM = body; winEdge = winOut - win; }
    }
    col *= 1.0 - 0.62 * shadowM * (1.0 - rotorM);

    float lr = length(ql);
    float la = atan(ql.x, ql.y);
    vec2 Ll = rot(L, PI - uRotor);                                    // light in the rotor's frame
    vec3 rc;
    if (lr > 0.745) {
        // heavy outer mass: circular brushing
        float v = 0.40 + 0.40 * pow(abs(cos(atan(ql.y, ql.x) - atan(Ll.y, Ll.x))), 2.0) + 0.04 * sin(lr * 800.0);
        rc = rhodium(v);
        rc = mix(rc, GOLD * (0.80 + 0.40 * v), texture2D(uOv, ql / EXT * 0.5 + 0.5).g);
        rc = mix(rc, rhodium(0.98), smoothstep(0.955, 0.975, lr) * 0.7);
        rc = mix(rc, rhodium(0.20), (1.0 - smoothstep(0.745, 0.760, lr)) * 0.8);   // step down to the web
    } else {
        rc = rhodium(ribbing(ql, 1.5708, 0.085, Ll) + 0.10) * vec3(1.0, 0.985, 0.955);
    }
    // bright bevel along the straight edge and round the windows
    float straight = (1.0 - smoothstep(0.0, 0.022, abs(ql.y + 0.03) - 0.0)) * step(0.185, lr);
    rc = mix(rc, rhodium(0.55 + 0.45 * abs(Ll.y)), straight * 0.8);
    rc = mix(rc, rhodium(0.60 + 0.40 * abs(Ll.x)), clamp(winEdge, 0.0, 1.0) * 0.9);
    // hub: polished, three blued screws, a jewel bearing
    if (lr < 0.185) {
        float g = 0.5 + 0.5 * dot(normalize(ql + 1e-5), Ll);
        rc = rhodium(0.42 + 0.50 * pow(abs(cos(atan(ql.y, ql.x) * 1.0 - atan(Ll.y, Ll.x))), 2.0));
        rc = mix(rc, rhodium(0.95), smoothstep(0.165, 0.185, lr) * 0.7);
        for (int i = 0; i < 3; i++) {
            float a = float(i) * TAU / 3.0 + 0.5;
            sm = screw(ql, 0.118 * vec2(cos(a), sin(a)), 0.030, a * 2.0, Ll, sc);
            rc = mix(rc, sc, sm);
        }
        jm = jewel(ql, vec2(0.0), 0.034, Ll, jc);
        rc = mix(rc, jc, jm);
    }
    col = mix(col, rc, rotorM);

    // ---------- sapphire crystal: a soft moving reflection and a dark seat at the rim
    float glare = exp(-pow(dot(q, L) * 1.1 - 0.35, 2.0) * 9.0) * exp(-pow(dot(q, vec2(-L.y, L.x)), 2.0) * 1.2);
    col += vec3(0.75, 0.85, 1.0) * glare * 0.07;
    col *= 1.0 - 0.75 * smoothstep(0.965, 1.0, r);

    gl_FragColor = vec4(col + dither, 1.0);
}
