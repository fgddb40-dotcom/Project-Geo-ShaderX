// GeoFS-ReShade : common.glsl
// Shared helper library. The loader prepends this file to every program.
//
// Conventions
//   * Written in the GLSL ES 1.00 post-process dialect of Cesium <= 1.101
//     (texture2D / gl_FragColor / varying). main.user.js upgrades the syntax
//     automatically when GeoFS runs a Cesium build >= 1.102 (GLSL ES 3.00).
//   * ENU = local East-North-Up frame at the camera (z = up).
//   * Distances are metres unless the identifier ends in Km.
//   * This file declares no uniforms so it can be shared by every stage.

#define GFSR_PI 3.14159265359
#define GFSR_R_KM 6371.0
#define GFSR_ATMO_KM 100.0
#define GFSR_R_M 6371000.0

// ---------------------------------------------------------------------------
// Basic colour helpers
// ---------------------------------------------------------------------------
float gfsr_saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 gfsr_saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
float gfsr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 gfsr_toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 gfsr_toGamma(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }

// Manual bilinear fetch for textures produced at a different resolution.
// Cesium shares and re-samples intermediate textures, so their filtering mode
// cannot be relied upon; dims is the texture size in pixels.
vec4 gfsr_textureBilinear(sampler2D tex, vec2 uv, vec2 dims)
{
    vec2 d = max(dims, vec2(1.0));
    vec2 st = uv * d - 0.5;
    vec2 i = floor(st);
    vec2 f = st - i;
    vec2 inv = 1.0 / d;
    vec4 a = texture2D(tex, (i + vec2(0.5, 0.5)) * inv);
    vec4 b = texture2D(tex, (i + vec2(1.5, 0.5)) * inv);
    vec4 c = texture2D(tex, (i + vec2(0.5, 1.5)) * inv);
    vec4 e = texture2D(tex, (i + vec2(1.5, 1.5)) * inv);
    return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
}

// ---------------------------------------------------------------------------
// Depth buffer helpers
// ---------------------------------------------------------------------------
float gfsr_rawDepth(sampler2D depthTex, vec2 uv)
{
    return texture2D(depthTex, uv).r;
}

bool gfsr_isSkyDepth(float raw)
{
    return raw >= 0.999999;
}

// Eye-space position of the surface visible at uv.
// With a logarithmic depth buffer czm_windowToEyeCoordinates expects the raw
// log depth; czm_readDepth would linearise it a second time.
vec3 gfsr_eyePosition(sampler2D depthTex, vec2 uv)
{
#ifdef LOG_DEPTH
    float depth = texture2D(depthTex, uv).r;
#else
    float depth = czm_readDepth(depthTex, uv);
#endif
    vec4 ec = czm_windowToEyeCoordinates(uv * czm_viewport.zw + czm_viewport.xy, depth);
    return ec.xyz / ec.w;
}

// Normalised eye-space view ray through uv (valid for sky pixels too).
vec3 gfsr_viewRayEC(vec2 uv)
{
    vec4 ndc = vec4(uv * 2.0 - 1.0, -1.0, 1.0);
    vec4 ec = czm_inverseProjection * ndc;
    return normalize(ec.xyz / ec.w);
}

// Eye-space normal reconstructed from the depth buffer. Picks the smaller
// depth step on each axis so silhouettes do not produce smeared normals.
vec3 gfsr_normalEC(sampler2D depthTex, vec2 uv, vec2 texel, vec3 p)
{
    vec3 pr = gfsr_eyePosition(depthTex, uv + vec2(texel.x, 0.0));
    vec3 pl = gfsr_eyePosition(depthTex, uv - vec2(texel.x, 0.0));
    vec3 pu = gfsr_eyePosition(depthTex, uv + vec2(0.0, texel.y));
    vec3 pd = gfsr_eyePosition(depthTex, uv - vec2(0.0, texel.y));
    vec3 dx = (abs(pr.z - p.z) < abs(p.z - pl.z)) ? (pr - p) : (p - pl);
    vec3 dy = (abs(pu.z - p.z) < abs(p.z - pd.z)) ? (pu - p) : (p - pd);
    vec3 n = cross(dx, dy);
    float len = length(n);
    return len > 1e-8 ? n / len : vec3(0.0, 0.0, 1.0);
}

// Screen position of the sun. xy = uv, z = 1 when the sun is in front of the camera.
vec3 gfsr_sunScreen()
{
    vec4 clip = czm_projection * vec4(czm_sunDirectionEC, 0.0);
    if (clip.w <= 1e-5) {
        return vec3(-10.0, -10.0, 0.0);
    }
    return vec3(clip.xy / clip.w * 0.5 + 0.5, 1.0);
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------
float gfsr_hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float gfsr_hash13(vec3 p3)
{
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

// Interleaved gradient noise, used for dithering and ray jitter.
float gfsr_ign(vec2 fragCoord)
{
    return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
}

// Tileable value noise. The lattice wraps every `period` cells so world-locked
// coordinates can be wrapped on the CPU without visible seams.
float gfsr_noise2(vec2 x, vec2 period)
{
    vec2 i = floor(x);
    vec2 f = fract(x);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 i0 = mod(i, period);
    vec2 i1 = mod(i + 1.0, period);
    float a = gfsr_hash12(i0);
    float b = gfsr_hash12(vec2(i1.x, i0.y));
    float c = gfsr_hash12(vec2(i0.x, i1.y));
    float d = gfsr_hash12(i1);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float gfsr_noise3(vec3 x, float period)
{
    vec3 i = floor(x);
    vec3 f = fract(x);
    vec3 u = f * f * (3.0 - 2.0 * f);
    vec3 i0 = mod(i, period);
    vec3 i1 = mod(i + 1.0, period);
    float n000 = gfsr_hash13(i0);
    float n100 = gfsr_hash13(vec3(i1.x, i0.y, i0.z));
    float n010 = gfsr_hash13(vec3(i0.x, i1.y, i0.z));
    float n110 = gfsr_hash13(vec3(i1.x, i1.y, i0.z));
    float n001 = gfsr_hash13(vec3(i0.x, i0.y, i1.z));
    float n101 = gfsr_hash13(vec3(i1.x, i0.y, i1.z));
    float n011 = gfsr_hash13(vec3(i0.x, i1.y, i1.z));
    float n111 = gfsr_hash13(i1);
    return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
               mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

float gfsr_fbm2(vec2 p, vec2 period, int octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) {
            break;
        }
        sum += amp * gfsr_noise2(p, period);
        norm += amp;
        p *= 2.0;
        period *= 2.0;
        amp *= 0.5;
    }
    return sum / max(norm, 1e-5);
}

float gfsr_fbm3(vec3 p, float period, int octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) {
            break;
        }
        sum += amp * gfsr_noise3(p, period);
        norm += amp;
        p *= 2.0;
        period *= 2.0;
        amp *= 0.5;
    }
    return sum / max(norm, 1e-5);
}

// ---------------------------------------------------------------------------
// Phase functions
// ---------------------------------------------------------------------------
float gfsr_phaseRayleigh(float nu)
{
    return 3.0 / (16.0 * GFSR_PI) * (1.0 + nu * nu);
}

float gfsr_phaseMie(float nu, float g)
{
    float g2 = g * g;
    float denom = (2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * nu, 1e-4), 1.5);
    return 3.0 / (8.0 * GFSR_PI) * ((1.0 - g2) * (1.0 + nu * nu)) / denom;
}

float gfsr_phaseHG(float nu, float g)
{
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * GFSR_PI * pow(max(1.0 + g2 - 2.0 * g * nu, 1e-4), 1.5));
}

// ---------------------------------------------------------------------------
// Planet / atmosphere geometry (km, numerically stable for float32)
// ---------------------------------------------------------------------------

// Intersection of a ray starting at altitude camHKm (direction cosine mu with
// the local up vector) with a spherical shell at altitude shellHKm.
// Returns (tNear, tFar) in km. Both negative when the shell is missed.
vec2 gfsr_shell(float camHKm, float mu, float shellHKm)
{
    float r = GFSR_R_KM + camHKm;
    float b = r * mu;
    float c = (camHKm - shellHKm) * (2.0 * GFSR_R_KM + camHKm + shellHKm);
    float disc = b * b - c;
    if (disc < 0.0) {
        return vec2(-1.0);
    }
    float s = sqrt(disc);
    float q = (b >= 0.0) ? (-b - s) : (-b + s);
    if (abs(q) < 1e-6) {
        return vec2(0.0);
    }
    float t0 = q;
    float t1 = c / q;
    return vec2(min(t0, t1), max(t0, t1));
}

// Altitude (km) reached after travelling tKm along a ray with zenith cosine mu.
float gfsr_altAlong(float camHKm, float mu, float tKm)
{
    float r = GFSR_R_KM + camHKm;
    return sqrt(max(r * r + 2.0 * r * mu * tKm + tKm * tKm, 0.0)) - GFSR_R_KM;
}

const vec3 GFSR_BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float GFSR_BETA_M = 3.996e-3;
const float GFSR_EXT_M = 4.40e-3;
const vec3 GFSR_BETA_O = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const float GFSR_HR = 8.0;
const float GFSR_HM = 1.2;

// Schueler's Chapman-function approximation: optical depth (in scale heights)
// of an exponential atmosphere from normalised altitude h towards zenith cos mu.
float gfsr_chapman(float X, float h, float mu)
{
    float c = sqrt(X + h);
    if (mu >= 0.0) {
        return c / (c * mu + 1.0) * exp(-h);
    }
    float x0 = sqrt(max(1.0 - mu * mu, 0.0)) * (X + h);
    float c0 = sqrt(x0);
    return 2.0 * c0 * exp(min(X - x0, 60.0)) - c / (1.0 - c * mu) * exp(-h);
}

// (rayleigh, mie, ozone) optical depth from altitude hKm towards the sun.
vec3 gfsr_opticalDepthToSun(float hKm, float mu)
{
    float h = max(hKm, 0.0);
    float odR = GFSR_HR * gfsr_chapman(GFSR_R_KM / GFSR_HR, h / GFSR_HR, mu);
    float odM = GFSR_HM * gfsr_chapman(GFSR_R_KM / GFSR_HM, h / GFSR_HM, mu);
    return vec3(odR, odM, odR * 1.875);
}

vec3 gfsr_densities(float hKm)
{
    float h = max(hKm, 0.0);
    return vec3(exp(-h / GFSR_HR), exp(-h / GFSR_HM), max(0.0, 1.0 - abs(h - 25.0) / 15.0));
}

vec3 gfsr_extinction(vec3 od, float rayleigh, float mie, float ozone)
{
    return GFSR_BETA_R * (rayleigh * od.x) + vec3(GFSR_EXT_M * mie * od.y) + GFSR_BETA_O * (ozone * od.z);
}

vec3 gfsr_sunTransmittance(float hKm, float muS, float rayleigh, float mie, float ozone)
{
    return exp(-gfsr_extinction(gfsr_opticalDepthToSun(hKm, muS), rayleigh, mie, ozone));
}

// Single-scattering integrator (Rayleigh + Mie + ozone absorption).
// rd and sunDir are ENU unit vectors, tMaxKm limits the ray (use a huge value
// for sky pixels). Outputs linear in-scattered radiance and view transmittance.
void gfsr_scatter(float camHKm, vec3 rd, vec3 sunDir, float tMaxKm,
                  float rayleigh, float mie, float ozone, float steps,
                  out vec3 inscatter, out vec3 transmittance)
{
    inscatter = vec3(0.0);
    transmittance = vec3(1.0);

    float mu = rd.z;
    vec2 atmo = gfsr_shell(camHKm, mu, GFSR_ATMO_KM);
    if (atmo.y <= 0.0) {
        return;
    }
    float tStart = max(atmo.x, 0.0);
    float tEnd = atmo.y;
    vec2 ground = gfsr_shell(camHKm, mu, 0.0);
    if (ground.x > 0.0) {
        tEnd = min(tEnd, ground.x);
    }
    tEnd = min(tEnd, tMaxKm);
    if (tEnd <= tStart) {
        return;
    }

    float nu = dot(rd, sunDir);
    float len = tEnd - tStart;
    float n = max(steps, 1.0);
    float r = GFSR_R_KM + camHKm;
    vec3 odView = vec3(0.0);
    vec3 sumR = vec3(0.0);
    vec3 sumM = vec3(0.0);
    float prevT = 0.0;

    for (int i = 0; i < 24; i++) {
        if (float(i) >= n) {
            break;
        }
        // Quadratic distribution concentrates samples in the dense lower air.
        float f1 = (float(i) + 1.0) / n;
        float tNext = len * f1 * f1;
        float dt = tNext - prevT;
        float t = tStart + prevT + 0.5 * dt;
        prevT = tNext;

        float rS = sqrt(max(r * r + 2.0 * r * mu * t + t * t, 0.0));
        float hS = rS - GFSR_R_KM;
        float muS = (r * sunDir.z + t * nu) / max(rS, 1.0);

        vec3 dens = gfsr_densities(hS);
        odView += dens * dt;
        vec3 odSun = gfsr_opticalDepthToSun(hS, muS);
        vec3 att = exp(-gfsr_extinction(odView + odSun, rayleigh, mie, ozone));
        sumR += dens.x * att * dt;
        sumM += dens.y * att * dt;
    }

    const float SUN_INTENSITY = 20.0;
    inscatter = SUN_INTENSITY * (sumR * GFSR_BETA_R * rayleigh * gfsr_phaseRayleigh(nu)
                               + sumM * GFSR_BETA_M * mie * gfsr_phaseMie(nu, 0.76));
    transmittance = exp(-gfsr_extinction(odView, rayleigh, mie, ozone));
}

// ---------------------------------------------------------------------------
// Realism helpers (v2): cellular noise, projection, SSR, blackbody, sky approx
// ---------------------------------------------------------------------------

// Tileable 3D Worley (cellular) noise. Returns distance to the nearest
// feature point in [0, ~1]; invert it for billowy cloud / canopy shapes.
float gfsr_worley3(vec3 x, float period)
{
    vec3 i = floor(x);
    vec3 f = fract(x);
    float best = 1.0;
    for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
            for (int xx = -1; xx <= 1; xx++) {
                vec3 o = vec3(float(xx), float(y), float(z));
                vec3 cell = mod(i + o, period);
                vec3 jit = vec3(gfsr_hash13(cell), gfsr_hash13(cell + 17.31), gfsr_hash13(cell + 41.07));
                vec3 d = o + jit - f;
                best = min(best, dot(d, d));
            }
        }
    }
    return sqrt(best);
}

// Tileable 2D Worley noise. x = distance to nearest point, y = cell id hash,
// zw = offset from the pixel to that feature point (in cells).
vec4 gfsr_worley2(vec2 x, vec2 period)
{
    vec2 i = floor(x);
    vec2 f = fract(x);
    float best = 8.0;
    float id = 0.0;
    vec2 off = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
        for (int xx = -1; xx <= 1; xx++) {
            vec2 o = vec2(float(xx), float(y));
            vec2 cell = mod(i + o, period);
            vec2 jit = vec2(gfsr_hash12(cell), gfsr_hash12(cell + 23.17)) * 0.8 + 0.1;
            vec2 d = o + jit - f;
            float dd = dot(d, d);
            if (dd < best) {
                best = dd;
                id = gfsr_hash12(cell + 7.7);
                off = d;
            }
        }
    }
    return vec4(sqrt(best), id, off);
}

float gfsr_remap(float v, float lo, float hi, float nlo, float nhi)
{
    return nlo + (v - lo) / max(hi - lo, 1e-5) * (nhi - nlo);
}

// Eye-space point -> screen uv. z < 0 in the result means behind the camera.
vec3 gfsr_projectEC(vec3 pEC)
{
    vec4 clip = czm_projection * vec4(pEC, 1.0);
    if (clip.w <= 1e-5) {
        return vec3(-1.0, -1.0, -1.0);
    }
    return vec3(clip.xy / clip.w * 0.5 + 0.5, 1.0);
}

// Screen-space reflection march (eye space). Returns rgb = reflected colour,
// a = confidence (0 = miss, fall back to the IBL / analytic environment).
vec4 gfsr_ssr(sampler2D colorTex, sampler2D depthTex, vec3 pEC, vec3 rEC,
              float maxDist, float steps, float jitter)
{
    float n = max(steps, 4.0);
    float prevT = 0.0;
    for (int i = 0; i < 48; i++) {
        if (float(i) >= n) {
            break;
        }
        float f = (float(i) + jitter) / n;
        float t = maxDist * f * f + 0.25;
        vec3 p = pEC + rEC * t;
        if (p.z > -0.05) {
            break;
        }
        vec3 s = gfsr_projectEC(p);
        if (s.z < 0.0 || s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {
            break;
        }
        float raw = texture2D(depthTex, s.xy).r;
        if (!gfsr_isSkyDepth(raw)) {
            vec3 q = gfsr_eyePosition(depthTex, s.xy);
            float diff = -p.z - (-q.z);
            float thick = max(0.6, (t - prevT) * 1.5 + -q.z * 0.01);
            if (diff > 0.0 && diff < thick) {
                // Binary refinement between the previous and current sample.
                float a = prevT;
                float b = t;
                vec2 hitUv = s.xy;
                for (int k = 0; k < 5; k++) {
                    float m = 0.5 * (a + b);
                    vec3 pm = pEC + rEC * m;
                    vec3 sm = gfsr_projectEC(pm);
                    vec3 qm = gfsr_eyePosition(depthTex, sm.xy);
                    if (-pm.z > -qm.z) {
                        b = m;
                        hitUv = sm.xy;
                    } else {
                        a = m;
                    }
                }
                vec2 e = min(hitUv, 1.0 - hitUv);
                float edge = smoothstep(0.0, 0.08, min(e.x, e.y));
                float conf = edge * (1.0 - f * f);
                return vec4(texture2D(colorTex, hitUv).rgb, conf);
            }
        }
        prevT = t;
    }
    return vec4(0.0);
}

// Approximate normalised blackbody colour (linear sRGB) for 1000..12000 K.
vec3 gfsr_blackbody(float kelvin)
{
    float t = clamp(kelvin, 1000.0, 12000.0) / 100.0;
    float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
                        : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
    return gfsr_toLinear(vec3(r, g, b));
}

// Cheap closed-form sky radiance (linear, display-scaled) used where the full
// single-scatter integral would be too expensive (IBL fallback, wet surfaces).
vec3 gfsr_skyApprox(vec3 dir, vec3 sunDir, float camHKm, float overcast)
{
    float day = smoothstep(-0.12, 0.05, sunDir.z);
    vec3 sunT = gfsr_sunTransmittance(camHKm, max(sunDir.z, 0.0), 1.0, 1.0, 1.0);
    float up = max(dir.z, 0.0);
    float horizon = exp(-up * 6.0);
    vec3 zenith = vec3(0.10, 0.22, 0.55) * exp(-camHKm * 0.06);
    vec3 hor = vec3(0.55, 0.65, 0.78);
    vec3 sky = mix(zenith, hor, horizon) * (0.35 + 0.65 * sunT);
    float nu = max(dot(dir, sunDir), 0.0);
    sky += sunT * pow(nu, 12.0) * 0.6;
    if (dir.z < 0.0) {
        sky = mix(hor * 0.6, vec3(0.08, 0.085, 0.07), smoothstep(0.0, 0.25, -dir.z)) * (0.3 + 0.7 * sunT);
    }
    sky = mix(sky, vec3(gfsr_luma(sky)) * vec3(0.95, 0.97, 1.0), overcast * 0.8);
    return sky * mix(0.015, 1.0, day);
}

// Smooth mask (0..1) of pixels belonging to the user's aircraft.
// acDist = camera -> aircraft origin distance, r = bounding radius.
float gfsr_aircraftMask(float dist, float acDist, float r)
{
    if (acDist <= 0.0) {
        return 0.0;
    }
    float cockpit = 1.0 - smoothstep(r * 0.6, r, acDist);
    float edge = r * 0.15;
    float inside = smoothstep(acDist - r - edge, acDist - r + edge, dist)
                 * (1.0 - smoothstep(acDist + r - edge, acDist + r + edge, dist));
    float cockpitMask = 1.0 - smoothstep(r * 0.9, r * 1.2, dist);
    return mix(inside, cockpitMask, cockpit);
}
