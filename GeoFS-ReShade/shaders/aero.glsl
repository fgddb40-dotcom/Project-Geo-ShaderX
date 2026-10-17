// GeoFS-ReShade : aero.glsl
// Aerodynamic and propulsion effects, rendered in eye space around the user's
// aircraft (no model edits):
//   * afterburner plume: raymarched emissive jet with Mach (shock) diamonds,
//     blackbody temperature gradient, turbulent mixing layer, dynamic glow
//   * heat distortion: refractive UV shimmer behind every running jet engine
//   * vapor cone (Prandtl-Glauert condensation) around Mach 0.95..1.05
//   * high-G wing vapor over the upper wing surface
//   * world-locked trails (wingtip vortices or contrails) from a CPU history
//     of positions, rendered analytically as soft tubes
//
// All positions arrive from JavaScript already in eye coordinates.
// Requires common.glsl (prepended by the loader).

// @program aero
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_time;
uniform float u_camHeight;
uniform vec2 u_texel;
uniform vec3 u_acEC;          // aircraft origin (eye space)
uniform vec3 u_acFwd;         // aircraft nose direction (eye space)
uniform vec3 u_acRight;       // aircraft right wing direction (eye space)
uniform vec3 u_acUp;          // aircraft up direction (eye space)
uniform vec4 u_nozzle0;       // xyz nozzle exit (eye space), w nozzle radius (m)
uniform vec4 u_nozzle1;
uniform vec4 u_ab;            // x afterburner 0..1, y throttle 0..1, z flight Mach, w nozzle count
uniform vec4 u_aero;          // x vapor cone, y wing vapor, z wingspan (m), w heat haze strength
uniform vec4 u_plume;         // x plume intensity, y plume length scale, z quality (steps), w daylight 0..1
uniform vec4 u_trailA[16];    // newest first: xyz eye position, w intensity
uniform vec4 u_trailB[16];
uniform vec4 u_trailInfo;     // x point count, y base width (m), z opacity, w spread per point
uniform vec4 u_weather;
uniform vec4 u_moisture;
uniform sampler2D u_mieLut;   // Lorenz-Mie phase table (see common.glsl)

// Ray / sphere: returns (tNear, tFar), tFar < 0 when missed.
vec2 sphereHit(vec3 ro, vec3 rd, vec3 c, float r)
{
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float h = b * b - (dot(oc, oc) - r * r);
    if (h < 0.0) {
        return vec2(1.0, -1.0);
    }
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

// ---------------------------------------------------------------------------
// Afterburner plume
// ---------------------------------------------------------------------------

// Returns rgb emission (linear) and a = heat-haze column density.
vec4 plume(vec3 rd, float tScene, vec4 nozzle, float jitter, float steps)
{
    float rn = max(nozzle.w, 0.2);
    float D = rn * 2.0;
    float ab = u_ab.x;
    float dry = smoothstep(0.35, 1.0, u_ab.y);
    vec3 axis = -u_acFwd;
    float L = D * mix(3.0, 9.0 + 5.0 * ab, ab) * u_plume.y;
    float hazeL = L * 1.8 + D * 4.0;
    vec3 c = nozzle.xyz + axis * hazeL * 0.5;
    vec2 hit = sphereHit(vec3(0.0), rd, c, hazeL * 0.5 + rn * 3.0);
    if (hit.y <= 0.0) {
        return vec4(0.0);
    }
    float t0 = max(hit.x, 0.05);
    float t1 = min(hit.y, tScene);
    if (t1 <= t0) {
        return vec4(0.0);
    }

    float n = steps;
    float dt = (t1 - t0) / n;
    vec3 emit = vec3(0.0);
    float haze = 0.0;
    float spacing = D * 1.15;
    for (int i = 0; i < 40; i++) {
        if (float(i) >= n) {
            break;
        }
        float t = t0 + (float(i) + jitter) * dt;
        vec3 p = rd * t - nozzle.xyz;
        float s = dot(p, axis);
        if (s < -rn * 0.3) {
            continue;
        }
        float r = length(p - axis * s);
        float sn = s / max(L, 0.1);

        // Jet spreads ~ 6 degrees half-angle past the potential core.
        float R = rn * (1.0 + 0.11 * s / rn);
        float flowT = u_time * 55.0;
        vec3 q = p / D;
        float turb = gfsr_noise3(q * 1.7 - axis * flowT * 0.35 / D + vec3(0.0, 0.0, u_time), 64.0);
        float turb2 = gfsr_noise3(q * 4.3 - axis * flowT * 0.8 / D, 64.0);
        float tn = turb * 0.65 + turb2 * 0.35;

        // Heat haze envelope (present with dry thrust too).
        float hr = R * (1.6 + s / hazeL * 2.0);
        float hazeD = exp(-(r * r) / (hr * hr)) * (1.0 - smoothstep(0.0, hazeL, s)) * smoothstep(-rn * 0.3, rn, s);
        haze += hazeD * (0.5 + tn) * dt / D;

        if (ab > 0.001 && s < L) {
            float radial = r / R;
            float core = exp(-radial * radial * 2.4) * exp(-sn * 2.2);
            // Turbulent mixing layer erodes the outer jet.
            float mixL = smoothstep(0.35, 1.1, radial + (tn - 0.5) * 0.6 * (0.3 + sn));
            core *= 1.0 - mixL * 0.85;

            // Shock diamonds: periodic expansion / compression cells near the nozzle.
            float ph = s / spacing;
            float cell = pow(0.5 + 0.5 * cos(6.2831853 * ph - 0.6), 7.0);
            float dia = cell * exp(-ph * 0.42) * exp(-(r * r) / (rn * rn * 0.32)) * step(0.15, ph);

            float kelvin = mix(2300.0, 950.0, smoothstep(0.0, 1.0, sn)) + tn * 180.0;
            vec3 bb = gfsr_blackbody(kelvin);
            // Very hot core near the nozzle reads blue-violet against the orange tail.
            vec3 hot = mix(vec3(0.62, 0.62, 1.0), bb, smoothstep(0.0, 0.35, sn));
            vec3 diaCol = mix(vec3(0.85, 0.82, 1.0), gfsr_blackbody(3200.0), 0.4);
            float flicker = 0.85 + 0.3 * turb2;
            emit += (hot * core * 1.6 + diaCol * dia * 5.0) * flicker * ab * dt / D;
        }
    }
    haze *= max(dry, ab);
    return vec4(emit * u_plume.x, haze);
}

// ---------------------------------------------------------------------------
// Vapor cone and wing vapor (participating media around the airframe)
// ---------------------------------------------------------------------------

float vaporDensity(vec3 p)
{
    vec3 q = p - u_acEC;
    float x = dot(q, u_acFwd);
    float y = dot(q, u_acRight);
    float z = dot(q, u_acUp);
    float span = max(u_aero.z, 6.0);
    float d = 0.0;

    if (u_aero.x > 0.001) {
        // Conical shock-induced condensation shell, apex slightly ahead of the wing.
        float x0 = span * 0.12;
        float behind = x0 - x;
        if (behind > 0.0 && behind < span * 0.75) {
            float rho = length(vec2(y, z * 1.15));
            float rc = span * 0.08 + behind * 0.95;
            float thick = span * (0.035 + behind / span * 0.18);
            float sh = (rho - rc) / thick;
            float shell = exp(-sh * sh);
            float front = smoothstep(0.0, span * 0.05, behind);
            float back = 1.0 - smoothstep(span * 0.25, span * 0.75, behind);
            float n = gfsr_noise3(vec3(x * 2.5 + u_time * 1.5, y * 2.5, z * 2.5) / span * 6.0, 64.0);
            d += shell * front * back * smoothstep(0.25, 0.75, n + 0.25) * u_aero.x * 0.9;
        }
    }

    if (u_aero.y > 0.001) {
        // Low-pressure region over the upper wing surface, densest at the root.
        float halfSpan = span * 0.5;
        float ay = abs(y);
        if (ay < halfSpan && z > -span * 0.02 && x < span * 0.12 && x > -span * 0.35) {
            float spanw = sqrt(max(1.0 - ay / halfSpan, 0.0));
            float chord = smoothstep(span * 0.12, span * 0.02, x) * (1.0 - smoothstep(-span * 0.15, -span * 0.35, x));
            float height = exp(-max(z, 0.0) / (span * 0.035));
            float n = gfsr_noise3(vec3(x * 3.0 + u_time * 6.0, y * 1.5, z * 4.0) / span * 8.0, 64.0);
            d += spanw * chord * height * smoothstep(0.3, 0.8, n + 0.2) * u_aero.y * 1.4;
        }
    }
    return d;
}

vec4 vapor(vec3 rd, float tScene, vec3 sunEC, vec3 skyLight, vec3 sunLight, float jitter)
{
    if (u_aero.x + u_aero.y < 0.002) {
        return vec4(0.0);
    }
    float span = max(u_aero.z, 6.0);
    vec2 hit = sphereHit(vec3(0.0), rd, u_acEC - u_acFwd * span * 0.2, span * 0.95);
    if (hit.y <= 0.0) {
        return vec4(0.0);
    }
    float t0 = max(hit.x, 0.05);
    float t1 = min(hit.y, tScene);
    if (t1 <= t0) {
        return vec4(0.0);
    }
    const float N = 20.0;
    float dt = (t1 - t0) / N;
    float trans = 1.0;
    vec3 col = vec3(0.0);
    float cosT = dot(rd, sunEC);
    // Micron-sized condensation droplets: Lorenz-Mie phase gives the faint
    // iridescent fringes seen on real vapour cones.
    vec3 phase = mix(vec3(gfsr_phaseHG(cosT, 0.75) * 0.6 + gfsr_phaseHG(cosT, -0.2) * 0.4),
                     min(gfsr_mieLut(u_mieLut, cosT, 0.0, 0.80), vec3(4.0)), 0.65);
    for (int i = 0; i < 20; i++) {
        float t = t0 + (float(i) + jitter) * dt;
        float d = vaporDensity(rd * t);
        if (d > 0.002) {
            float ext = d * 0.9 / span * 12.0;
            float a = 1.0 - exp(-ext * dt);
            vec3 L = skyLight * 0.9 + sunLight * phase * 6.2832;
            col += trans * a * L;
            trans *= 1.0 - a;
            if (trans < 0.02) {
                break;
            }
        }
    }
    return vec4(col, 1.0 - trans);
}

// ---------------------------------------------------------------------------
// World-locked trails (wingtip vortices / contrails)
// ---------------------------------------------------------------------------

// Closest approach between the view ray (origin 0, dir rd, t <= tMax) and a segment.
vec3 raySegment(vec3 rd, float tMax, vec3 a, vec3 b)
{
    vec3 ab = b - a;
    float abL = max(length(ab), 1e-3);
    vec3 u = ab / abL;
    float rdu = dot(rd, u);
    float denom = 1.0 - rdu * rdu;
    float ra = dot(rd, a);
    float ua = dot(u, a);
    float s = denom > 1e-5 ? (ua - rdu * ra) / denom : 0.0;
    s = clamp(-s, 0.0, abL);
    vec3 ps = a + u * s;
    float t = clamp(dot(ps, rd), 0.0, tMax);
    float dist = length(rd * t - ps);
    return vec3(dist, s / abL, sqrt(max(denom, 0.0)));
}

float trail(vec3 rd, float tMax, vec4 pts[16])
{
    float count = u_trailInfo.x;
    float acc = 0.0;
    for (int i = 0; i < 15; i++) {
        if (float(i + 1) >= count) {
            break;
        }
        vec4 a = pts[i];
        vec4 b = pts[i + 1];
        if (a.w <= 0.0 && b.w <= 0.0) {
            continue;
        }
        vec3 r = raySegment(rd, tMax, a.xyz, b.xyz);
        float fi = float(i) + r.y;
        float w = u_trailInfo.y * (1.0 + fi * u_trailInfo.w);
        float inten = mix(a.w, b.w, r.y);
        float core = exp(-(r.x * r.x) / (w * w));
        // Path length through a soft tube grows at grazing angles.
        float path = 1.77 / max(r.z, 0.15);
        acc += core * path * inten / (1.0 + fi * u_trailInfo.w * 0.5);
    }
    return 1.0 - exp(-acc * u_trailInfo.z);
}

void main()
{
    vec2 uv = v_textureCoordinates;
    float raw = gfsr_rawDepth(depthTexture, uv);
    vec3 rd = gfsr_viewRayEC(uv);
    float tScene = 1.0e7;
    if (!gfsr_isSkyDepth(raw)) {
        tScene = length(gfsr_eyePosition(depthTexture, uv));
    }

    float jitter = gfsr_ign(gl_FragCoord.xy);
    vec3 sunEC = normalize(czm_sunDirectionEC);
    vec3 sunDir = normalize(u_eyeToEnu * sunEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    float day = smoothstep(-0.12, 0.05, sunDir.z);
    vec3 sunT = gfsr_sunTransmittance(camHKm, max(sunDir.z, 0.0), 1.0, 1.0, 1.0);
    vec3 sunLight = sunT * day * (1.0 - u_weather.x * 0.7) * 0.55;
    vec3 skyLight = gfsr_skyApprox(vec3(0.0, 0.0, 1.0), sunDir, camHKm, u_weather.x) * 0.9 + vec3(0.004, 0.005, 0.008);

    // Plumes and heat haze.
    vec3 emit = vec3(0.0);
    float haze = 0.0;
    if (u_ab.w > 0.5) {
        vec4 p0 = plume(rd, tScene, u_nozzle0, jitter, u_plume.z);
        emit += p0.rgb;
        haze += p0.a;
        if (u_ab.w > 1.5) {
            vec4 p1 = plume(rd, tScene, u_nozzle1, jitter, u_plume.z);
            emit += p1.rgb;
            haze += p1.a;
        }
    }

    // Heat distortion: refract the background through the hot exhaust.
    vec2 suv = uv;
    // Only background seen *through* the exhaust is refracted; the airframe
    // (anything nearer than the nozzle) is never displaced or sampled.
    float nozzleDist = length(u_nozzle0.xyz);
    if (haze > 0.001 && u_aero.w > 0.0 && tScene > nozzleDist + 1.0) {
        vec2 g = vec2(gfsr_noise3(vec3(uv * 70.0, u_time * 6.0), 64.0),
                      gfsr_noise3(vec3(uv * 70.0 + 17.0, u_time * 6.0), 64.0)) - 0.5;
        suv = uv + g * u_texel * 7.0 * u_aero.w * min(haze, 1.0);
        float rawS = gfsr_rawDepth(depthTexture, suv);
        if (!gfsr_isSkyDepth(rawS) && length(gfsr_eyePosition(depthTexture, suv)) < nozzleDist + 1.0) {
            suv = uv;
        }
    }
    vec4 src = texture2D(colorTexture, suv);
    vec3 col = gfsr_toLinear(src.rgb);

    // Emission: much more visible in low light (eye adaptation), never clipped harshly.
    float night = 1.0 - day;
    vec3 glow = emit * mix(0.55, 2.2, night);
    col += glow;

    // Condensation media.
    vec4 vap = vapor(rd, tScene, sunEC, skyLight, sunLight, jitter);
    col = col * (1.0 - vap.a) + vap.rgb;

    if (u_trailInfo.x >= 2.0) {
        float ta = trail(rd, tScene, u_trailA);
        float tb = trail(rd, tScene, u_trailB);
        float a = 1.0 - (1.0 - ta) * (1.0 - tb);
        float cosT = dot(rd, sunEC);
        float ph = gfsr_phaseHG(cosT, 0.6) * 0.5 + 0.08;
        vec3 L = skyLight * 0.95 + sunLight * ph * 6.2832;
        col = mix(col, L, a);
    }

    col = col / (1.0 + max(col - 1.0, 0.0) * 0.6);
    gl_FragColor = vec4(gfsr_toGamma(col), src.a);
}
