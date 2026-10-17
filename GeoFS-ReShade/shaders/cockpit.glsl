// GeoFS-ReShade : cockpit.glsl
// Cockpit-view effects (active only when the camera is inside the aircraft).
//
//   rain_glass    : procedural rain on the windscreen / canopy
//                   * static droplets accumulate with rain intensity and
//                     merge with each other (metaball field)
//                   * moving drops streak downwards at low speed and race up
//                     and outwards across the glass with airflow at speed,
//                     leaving wet trails
//                   * lens refraction (inverted, magnified background), rim
//                     darkening, sky reflection highlights, wet-film blur
//                   * the cockpit interior is masked out using the depth
//                     buffer, so drops only sit on the glass
//
//   cockpit_light : physically-motivated cockpit lighting
//                   * directional sun penetration with soft screen-space
//                     shadows from the canopy frame and panel
//                   * ambient sky bounce, night flood / instrument lighting,
//                     night adaptation
//                   * faint reflections of the instrument panel on the glass
//
// Requires common.glsl (prepended by the loader).

// @program rain_glass
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform float u_time;
uniform float u_aspect;
uniform vec2 u_texel;
uniform float u_aircraftRadius;
uniform vec4 u_rain;      // x rain intensity 0..1, y airspeed (m/s), z glass wetness 0..1, w cockpit view 0..1
uniform vec4 u_weather;

vec2 hash22(vec2 p)
{
    return vec2(gfsr_hash12(p), gfsr_hash12(p + vec2(37.13, 91.71)));
}

void addDrop(vec2 p, vec2 c, vec2 r, float a, inout float F, inout vec2 G)
{
    vec2 d = (p - c) / r;
    float e = a * exp(-dot(d, d) * 3.0);
    F += e;
    G += e * -6.0 * d / r;
}

// Static, accumulating droplets. Coordinates in screen-height units.
void staticLayer(vec2 p, float scale, float density, float t, float seed, inout float F, inout vec2 G)
{
    vec2 q = p * scale;
    vec2 id0 = floor(q);
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 id = id0 + vec2(float(i), float(j));
            float h = gfsr_hash12(id + seed);
            if (h > density) {
                continue;
            }
            vec2 c = id + 0.15 + 0.7 * hash22(id + seed * 1.7);
            float life = mix(5.0, 14.0, gfsr_hash12(id + seed + 3.1));
            float ph = fract(t / life + h * 7.0);
            float a = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.82, 1.0, ph));
            float rad = mix(0.07, 0.24, pow(gfsr_hash12(id + seed + 5.3), 2.0)) * (0.6 + 0.4 * smoothstep(0.0, 0.5, ph));
            addDrop(q, c, vec2(rad), a, F, G);
        }
    }
    G *= scale;
}

// Moving drops in flow coordinates: x across the flow, y along the flow.
// Returns the wet-trail amount; F/G receive the drop heads.
float movingLayer(vec2 q, float speed, float density, float t, float seed, float stretch, inout float F, inout vec2 G)
{
    float wet = 0.0;
    float colW = 1.0;
    float cellL = 3.0;
    float col0 = floor(q.x / colW);
    for (int k = -1; k <= 1; k++) {
        float cid = col0 + float(k);
        float hc = gfsr_hash12(vec2(cid, seed));
        float v = speed * mix(0.6, 1.4, gfsr_hash12(vec2(cid, seed + 1.3)));
        float y = q.y - t * v - hc * 50.0;
        float row = floor(y / cellL);
        for (int m = -1; m <= 0; m++) {
            float rid = row + float(m);
            float h = gfsr_hash12(vec2(cid, rid) + seed);
            if (h > density) {
                continue;
            }
            float wob = (gfsr_noise2(vec2(rid * 3.1, (q.y - y) * 0.6 + cid), vec2(64.0)) - 0.5) * 0.35;
            vec2 c = vec2((cid + 0.5 + (hash22(vec2(cid, rid)).x - 0.5) * 0.5 + wob) * colW, (rid + h / max(density, 1e-3)) * cellL);
            float rad = mix(0.12, 0.26, gfsr_hash12(vec2(rid, cid) + seed + 9.0));
            vec2 yq = vec2(q.x, y);
            addDrop(yq, c, vec2(rad, rad * stretch), 1.0, F, G);
            // Wet trail behind the head (smaller beads + a water film).
            float dy = c.y - y;
            if (dy > 0.0 && dy < cellL * 1.4) {
                float dx = (q.x - c.x) / (rad * 0.45);
                float fade = 1.0 - dy / (cellL * 1.4);
                wet = max(wet, exp(-dx * dx) * fade);
                float bead = step(0.72, gfsr_hash12(vec2(cid, floor(y * 3.0)) + seed));
                addDrop(yq, vec2(c.x, floor(y * 3.0) / 3.0 + 0.16), vec2(rad * 0.35), bead * fade * 0.9, F, G);
            }
        }
    }
    return wet;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float rain = u_rain.x * u_rain.w;
    float wetGlass = u_rain.z * u_rain.w;
    if (rain + wetGlass < 0.002) {
        gl_FragColor = src;
        return;
    }

    // Only the glass: pixels beyond the cockpit interior.
    float raw = gfsr_rawDepth(depthTexture, uv);
    float dist = gfsr_isSkyDepth(raw) ? 1.0e7 : length(gfsr_eyePosition(depthTexture, uv));
    float r = max(u_aircraftRadius, 2.0);
    float glass = smoothstep(r * 0.25, r * 0.45, dist);
    if (glass <= 0.001) {
        gl_FragColor = src;
        return;
    }

    vec2 p = vec2((uv.x - 0.5) * u_aspect, uv.y - 0.5);
    float t = u_time;
    float spd = u_rain.y;
    float sf = smoothstep(8.0, 45.0, spd);
    float density = clamp(rain * 1.1, 0.0, 0.95);

    float F = 0.0;
    vec2 G = vec2(0.0);

    // Static droplets: blown away at speed, persist on a wet canopy at rest.
    float stDensity = (density * 0.85 + wetGlass * 0.15) * (1.0 - 0.75 * sf);
    staticLayer(p, 9.0, stDensity, t, 1.0, F, G);
    float F2 = 0.0;
    vec2 G2 = vec2(0.0);
    staticLayer(p, 21.0, stDensity, t * 1.3, 7.0, F2, G2);
    F += F2 * 0.8;
    G += G2 * 0.8;

    float wet = 0.0;
    // Gravity streaks (slow, vertical).
    if (sf < 0.99) {
        float Fg = 0.0;
        vec2 Gg = vec2(0.0);
        float wg = movingLayer(vec2(p.x, -p.y) * 7.0, 0.9, density * 0.5, t, 3.0, 1.4, Fg, Gg);
        Gg = vec2(Gg.x, -Gg.y) * 7.0;
        F += Fg * (1.0 - sf);
        G += Gg * (1.0 - sf);
        wet = max(wet, wg * (1.0 - sf));
    }
    // Airflow streaks: radiate from a stagnation point below the view.
    if (sf > 0.01) {
        vec2 vp = vec2(0.0, -0.9);
        vec2 rel = p - vp;
        float rho = length(rel);
        float ang = atan(rel.x, rel.y);
        vec2 q = vec2(ang * 1.2, rho) * 9.0;
        float Fa = 0.0;
        vec2 Ga = vec2(0.0);
        float v = clamp(0.8 + spd * 0.08, 0.8, 9.0);
        float wa = movingLayer(q, v, density * 0.7, t, 5.0, mix(1.2, 2.6, sf), Fa, Ga);
        // Chain rule back to screen space (approximate, locally orthonormal basis).
        vec2 er = rel / max(rho, 1e-3);
        vec2 ea = vec2(er.y, -er.x);
        vec2 gs = (ea * Ga.x * 1.2 / max(rho, 0.2) + er * Ga.y) * 9.0;
        F += Fa * sf;
        G += gs * sf;
        wet = max(wet, wa * sf);
    }

    float drop = smoothstep(0.45, 0.75, F) * glass;
    vec2 n = -G * 0.012;
    n = n / (1.0 + length(n) * 3.0);

    // Wet film and trails slightly blur the view; droplets refract (inverted lens).
    float film = clamp(wet * 0.6 + wetGlass * 0.35 + rain * 0.25, 0.0, 1.0) * glass;
    vec2 bl = u_texel * (1.5 + 3.0 * film);
    vec3 bg = src.rgb * 0.4;
    bg += texture2D(colorTexture, uv + vec2(bl.x, 0.0)).rgb * 0.15;
    bg += texture2D(colorTexture, uv - vec2(bl.x, 0.0)).rgb * 0.15;
    bg += texture2D(colorTexture, uv + vec2(0.0, bl.y)).rgb * 0.15;
    bg += texture2D(colorTexture, uv - vec2(0.0, bl.y)).rgb * 0.15;
    vec3 base = mix(src.rgb, bg, film);

    vec2 ruv = clamp(uv - n * vec2(1.0 / u_aspect, 1.0) * 0.9, vec2(0.001), vec2(0.999));
    vec3 refr = texture2D(colorTexture, ruv).rgb;

    // Lighting of the water surface.
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    vec3 sky = gfsr_toGamma(gfsr_skyApprox(vec3(0.0, 0.0, 1.0), sunDir, camHKm, u_weather.x));
    vec3 N3 = normalize(vec3(n * 3.0, 1.0));
    float hl = pow(max(dot(N3, normalize(vec3(-0.25, 0.55, 1.0))), 0.0), 60.0);
    float rim = drop * (1.0 - smoothstep(0.5, 0.95, F));

    vec3 col = mix(base, refr * 0.92 + sky * 0.06, drop);
    col *= 1.0 - rim * 0.35;
    col += sky * hl * drop * 0.55;
    col = mix(col, col * 0.96 + sky * 0.03, film * 0.5);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), src.a);
}

// @program cockpit_light
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform vec2 u_texel;
uniform float u_aircraftRadius;
uniform vec4 u_cockpit;   // x cockpit view 0..1, y sun/shadow strength, z ambient bounce, w panel reflection
uniform vec4 u_cockpit2;  // x flood / instrument light, y night adaptation, z shadow steps, w unused
uniform vec4 u_weather;

float cockpitShadow(vec3 pEC, vec3 lEC, float maxT, float steps, float jitter)
{
    float occl = 0.0;
    float n = max(steps, 2.0);
    for (int i = 0; i < 24; i++) {
        if (float(i) >= n) {
            break;
        }
        float f = (float(i) + jitter) / n;
        float t = maxT * f * f + 0.03;
        vec3 p = pEC + lEC * t;
        if (p.z > -0.02) {
            break;
        }
        vec3 s = gfsr_projectEC(p);
        if (s.z < 0.0 || s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {
            break;
        }
        float raw = texture2D(depthTexture, s.xy).r;
        if (gfsr_isSkyDepth(raw)) {
            continue;
        }
        vec3 q = gfsr_eyePosition(depthTexture, s.xy);
        float diff = (-p.z) - (-q.z);
        if (diff > 0.02 && diff < 0.6 + t * 0.4) {
            occl = max(occl, (1.0 - f * 0.5) * smoothstep(0.02, 0.08, diff));
        }
    }
    return 1.0 - occl;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float cockpitK = u_cockpit.x;
    if (cockpitK <= 0.001) {
        gl_FragColor = src;
        return;
    }
    float raw = gfsr_rawDepth(depthTexture, uv);
    float r = max(u_aircraftRadius, 2.0);
    vec3 sunEC = normalize(czm_sunDirectionEC);
    vec3 sunDir = normalize(u_eyeToEnu * sunEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    float day = smoothstep(-0.1, 0.06, sunDir.z);
    float night = 1.0 - day;
    vec3 col = gfsr_toLinear(src.rgb);

    float dist = gfsr_isSkyDepth(raw) ? 1.0e7 : length(gfsr_eyePosition(depthTexture, uv));
    float interior = (1.0 - smoothstep(r * 0.3, r * 0.5, dist)) * cockpitK;

    if (interior > 0.001) {
        vec3 pEC = gfsr_eyePosition(depthTexture, uv);
        vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel, pEC);
        if (dot(nEC, -pEC) < 0.0) {
            nEC = -nEC;
        }
        vec3 N = normalize(u_eyeToEnu * nEC);
        float jitter = gfsr_ign(gl_FragCoord.xy);
        vec3 sunT = gfsr_sunTransmittance(camHKm, max(sunDir.z, 0.0), 1.0, 1.0, 1.0);
        float sunE = day * (1.0 - u_weather.x * 0.75);
        float NdotL = dot(nEC, sunEC);
        float sh = 1.0;
        if (NdotL > 0.0 && sunE > 0.01) {
            sh = cockpitShadow(pEC + nEC * 0.01, sunEC, r * 0.8, u_cockpit2.z, jitter);
        }
        float amb = 0.32 + 0.12 * N.z;
        float lit = amb + sunE * max(NdotL, 0.0) * sh;
        float ref = amb + sunE * max(NdotL, 0.0);
        // Re-light relative to the unshadowed engine shading (preserves albedo).
        float ratio = clamp(lit / max(ref, 0.05), 0.35, 1.3);
        vec3 lc = col * mix(1.0, ratio, u_cockpit.y * interior);
        // Sun penetration: warm sunlit patches on the panel.
        lc += col * sunT * max(NdotL, 0.0) * sh * sunE * 0.25 * u_cockpit.y * interior;

        // Ambient bounce from sky through the canopy (from above) and from the
        // sunlit panel (warm, from below).
        vec3 skyL = gfsr_skyApprox(vec3(0.0, 0.0, 1.0), sunDir, camHKm, u_weather.x);
        float up = N.z * 0.5 + 0.5;
        vec3 bounce = skyL * up * 0.35 + vec3(0.06, 0.05, 0.04) * sunE * (1.0 - up);
        lc += col * bounce * u_cockpit.z * interior;

        // Night: dim flood lighting + adaptation so the cockpit stays readable
        // without looking lit like day.
        vec3 flood = vec3(1.0, 0.86, 0.68) * 0.035 * u_cockpit2.x;
        lc += (col * 2.5 + 0.004) * flood * night * interior;
        lc *= mix(1.0, 1.0 + u_cockpit2.y * 0.6, night * interior);
        col = mix(col, lc, interior);
    } else if (u_cockpit.w > 0.0 && dist > r * 0.45) {
        // Panel reflection on the windscreen: mirror the lower half about a
        // line just above the glare shield, fade with angle.
        float refY = 0.92 - uv.y;
        if (refY > 0.0 && refY < uv.y) {
            vec2 ruv = vec2(uv.x, refY);
            float rr = gfsr_rawDepth(depthTexture, ruv);
            float rd = gfsr_isSkyDepth(rr) ? 1.0e7 : length(gfsr_eyePosition(depthTexture, ruv));
            if (rd < r * 0.35) {
                vec3 rc = gfsr_toLinear(texture2D(colorTexture, ruv).rgb) * 0.5;
                rc += gfsr_toLinear(texture2D(colorTexture, ruv + vec2(u_texel.x * 3.0, 0.0)).rgb) * 0.25;
                rc += gfsr_toLinear(texture2D(colorTexture, ruv - vec2(u_texel.x * 3.0, 0.0)).rgb) * 0.25;
                float k = u_cockpit.w * mix(0.035, 0.16, night) * smoothstep(0.45, 0.9, uv.y) * cockpitK;
                col += rc * k;
            }
        }
    }

    gl_FragColor = vec4(gfsr_toGamma(col), src.a);
}
