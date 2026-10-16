// GeoFS-ReShade : clouds.glsl
// Fake volumetric clouds: fbm()/noise() density field + raymarch approximation.
//
//   Layers   : volumetric layer (cumulus or storm) + high cirrus sheet
//   Lighting : Beer-Lambert + multi-scattering octaves, dual Henyey-Greenstein
//              phase (silver lining), sky ambient, sun colour from atmosphere
//   Shadows  : sun-projected density lookup darkens terrain (clouds_apply)
//
// Text above the first @program marker is shared by every program in this file.
// Requires common.glsl (prepended by the loader).

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform float u_time;
uniform vec2 u_cloudOffset;   // metres, wrapped on the CPU to the noise period
uniform vec4 u_cloudLayer;    // x base (m), y thickness (m), z coverage 0..1, w density
uniform vec4 u_cloudParams;   // x type (0 cirrus, 1 cumulus, 2 storm), y metres per noise cell, z brightness, w cirrus layer on/off
uniform vec4 u_cirrus;        // x altitude (m), y coverage 0..1, z opacity, w unused
uniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog

const float CLOUD_PERIOD = 64.0;

float cloudHeightProfile(float hf, float type)
{
    float cumulus = smoothstep(0.0, 0.12, hf) * (1.0 - smoothstep(0.45, 1.0, hf));
    float stormy = smoothstep(0.0, 0.05, hf) * (1.0 - smoothstep(0.82, 1.0, hf));
    return type < 1.5 ? cumulus : stormy;
}

// pos.xy = horizontal ENU metres relative to the camera, pos.z = altitude (m).
float cloudDensity(vec3 pos, float detailed)
{
    float base = u_cloudLayer.x;
    float thick = max(u_cloudLayer.y, 50.0);
    float hf = (pos.z - base) / thick;
    if (hf <= 0.0 || hf >= 1.0) {
        return 0.0;
    }
    float type = u_cloudParams.x;
    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);
    float cov = clamp(u_cloudLayer.z + storm * 0.25, 0.0, 1.0);

    vec3 q = vec3(pos.xy + u_cloudOffset, pos.z) / u_cloudParams.y;
    q.z += u_time * 0.0015;
    float shapeN = smoothstep(0.25, 0.85, gfsr_fbm3(q, CLOUD_PERIOD, 4));
    float d = shapeN * cloudHeightProfile(hf, type);
    d = (d - (1.0 - cov)) / max(cov, 0.05);
    if (d <= 0.0) {
        return 0.0;
    }
    if (detailed > 0.5) {
        float detail = gfsr_fbm3(q * 6.0 + vec3(0.0, 0.0, u_time * 0.01), CLOUD_PERIOD * 6.0, 2);
        d -= detail * 0.4 * (1.0 - clamp(d, 0.0, 1.0));
    }
    return clamp(d, 0.0, 1.0) * u_cloudLayer.w * (1.0 + storm * 0.6);
}

float cirrusDensity(vec2 xy)
{
    // Stretched along the east axis; periods stay integer so the CPU wrap is seamless.
    vec2 q = (xy + u_cloudOffset) / (u_cloudParams.y * vec2(4.0, 1.0));
    vec2 warp = vec2(gfsr_fbm2(q * 2.0, vec2(32.0, 128.0), 2), 0.0) * 0.6;
    float n = gfsr_fbm2(q + warp, vec2(16.0, 64.0), 5);
    float cov = clamp(u_cirrus.y, 0.0, 1.0);
    return smoothstep(1.0 - cov, 1.0 - cov + 0.35, n);
}

// @program clouds_generate
uniform float u_cloudSteps;
uniform float u_maxDistance;

void main()
{
    vec2 uv = v_textureCoordinates;
    float raw = gfsr_rawDepth(depthTexture, uv);
    float sceneDist = 1.0e9;
    if (!gfsr_isSkyDepth(raw)) {
        sceneDist = length(gfsr_eyePosition(depthTexture, uv));
    }

    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float camH = u_camHeight;
    float camHKm = max(camH, 1.0) * 0.001;
    float nu = dot(rd, sunDir);
    float type = u_cloudParams.x;
    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);

    float base = u_cloudLayer.x;
    float thick = max(u_cloudLayer.y, 50.0);
    float top = base + thick;
    float midKm = (base + 0.5 * thick) * 0.001;

    // Lighting environment from the atmosphere model.
    float day = smoothstep(-0.10, 0.05, sunDir.z);
    vec3 sunCol = gfsr_sunTransmittance(midKm, sunDir.z, 1.0, 1.0, 1.0) * 3.2 * day;
    vec3 ambL;
    vec3 ambT;
    gfsr_scatter(midKm, vec3(0.0, 0.0, 1.0), sunDir, 1.0e9, 1.0, 1.0, 1.0, 6.0, ambL, ambT);
    vec3 ambient = (1.0 - exp(-ambL)) * 1.4 + vec3(0.010, 0.012, 0.018);
    // Overcast skies still light cloud bases with diffuse skylight.
    ambient = max(ambient, vec3(0.30, 0.33, 0.38) * day);
    float darken = 1.0 - 0.55 * storm - 0.25 * u_weather.x;
    sunCol *= darken;
    ambient *= mix(1.0, 0.55, storm);
    // Sunlight bounced off the ground onto cloud bases.
    vec3 bounce = sunCol * max(sunDir.z, 0.0) * 0.12;

    float maxD = u_maxDistance;
    float jitter = gfsr_ign(gl_FragCoord.xy);

    // ---------------- Volumetric layer -----------------
    vec3 volL = vec3(0.0);
    float volT = 1.0;
    float volHit = 1.0e9;
    if (type > 0.5) {
        vec2 tb = gfsr_shell(camHKm, rd.z, base * 0.001);
        vec2 tt = gfsr_shell(camHKm, rd.z, top * 0.001);
        vec2 tg = gfsr_shell(camHKm, rd.z, 0.0);
        float t0 = -1.0;
        float t1 = -1.0;
        if (camH < base) {
            if (tb.y > 0.0) {
                t0 = tb.y;
                t1 = tt.y;
            }
        } else if (camH > top) {
            if (tt.x > 0.0) {
                t0 = tt.x;
                t1 = tb.x > 0.0 ? tb.x : tt.y;
            }
        } else {
            t0 = 0.0;
            t1 = rd.z > 0.0 ? tt.y : (tb.x > 0.0 ? tb.x : tt.y);
        }
        if (tg.x > 0.0) {
            t1 = min(t1, tg.x);
        }
        t0 *= 1000.0;
        t1 = min(t1 * 1000.0, min(sceneDist, maxD));
        // Grazing rays cross the layer over tens of km; cap the span to keep steps dense.
        t1 = min(t1, t0 + max(thick * 6.0, 6000.0));

        if (t0 >= 0.0 && t1 > t0) {
            float stepsF = max(u_cloudSteps, 4.0);
            float dt = (t1 - t0) / stepsF;
            float t = t0 + dt * jitter;
            float lightStep = thick * 0.12;

            for (int i = 0; i < 128; i++) {
                if (float(i) >= stepsF || volT < 0.02) {
                    break;
                }
                vec3 p = rd * t;
                float alt = gfsr_altAlong(camHKm, rd.z, t * 0.001) * 1000.0;
                vec3 pos = vec3(p.xy, alt);
                float d = cloudDensity(pos, 1.0);
                if (d > 0.002) {
                    if (volHit > 1.0e8) {
                        volHit = t;
                    }
                    // Light march towards the sun.
                    float od = 0.0;
                    float ls = lightStep;
                    vec3 lp = pos;
                    for (int j = 0; j < 4; j++) {
                        lp += sunDir * ls;
                        od += cloudDensity(lp, 0.0) * ls;
                        ls *= 1.7;
                    }
                    float lightOD = od * 0.003;

                    // Multi-scattering octaves (Wrenninge) -> soft bright interiors
                    // and strong forward-scattered silver lining near the sun.
                    float light = 0.0;
                    float a = 1.0;
                    float b = 1.0;
                    float c = 1.0;
                    for (int k = 0; k < 3; k++) {
                        float ph = mix(gfsr_phaseHG(nu, 0.6 * c), gfsr_phaseHG(nu, -0.25 * c), 0.4) * 4.0 * GFSR_PI;
                        ph = min(ph, 5.0);
                        light += b * exp(-lightOD * a) * ph;
                        a *= 0.3;
                        b *= 0.6;
                        c *= 0.5;
                    }
                    // Powder term darkens the sun-facing edges of thick cores.
                    float powder = 1.0 - exp(-d * dt * 0.016);
                    light *= mix(1.0, powder * 2.0, 0.35 * (1.0 - smoothstep(0.6, 1.0, nu)));

                    float hf = clamp((alt - base) / thick, 0.0, 1.0);
                    vec3 S = sunCol * light + ambient * mix(0.6, 1.0, hf) + bounce * (1.0 - hf);
                    S *= u_cloudParams.z;

                    float sigma = 0.008 * d;
                    float stepT = exp(-sigma * dt);
                    volL += volT * (1.0 - stepT) * S;
                    volT *= stepT;
                }
                t += dt;
            }
        }
    }

    // ---------------- Cirrus sheet -----------------
    vec3 cirL = vec3(0.0);
    float cirA = 0.0;
    float cirHit = 1.0e9;
    if (u_cloudParams.w > 0.5 || type < 0.5) {
        float hc = u_cirrus.x;
        vec2 tc = gfsr_shell(camHKm, rd.z, hc * 0.001);
        float tci = (camH < hc ? tc.y : tc.x) * 1000.0;
        if (tci > 0.0 && tci < sceneDist && tci < maxD * 3.0) {
            vec3 p = rd * tci;
            float d = cirrusDensity(p.xy);
            float fade = 1.0 - smoothstep(maxD * 1.5, maxD * 3.0, tci);
            cirA = d * u_cirrus.z * fade * (type < 0.5 ? 1.0 : 0.75);
            float ph = gfsr_phaseHG(nu, 0.6) * 4.0 * GFSR_PI;
            vec3 cirSun = gfsr_sunTransmittance(hc * 0.001, sunDir.z, 1.0, 1.0, 1.0) * 3.2 * day * darken;
            cirL = (cirSun * (0.55 + 0.45 * ph) + ambient * 1.2) * u_cloudParams.z;
            cirHit = tci;
        }
    }

    // ---------------- Composite layers -----------------
    float volA = 1.0 - volT;
    vec3 volC = volA > 1e-4 ? volL / volA : vec3(0.0);
    vec3 colL;
    float alpha;
    if (cirHit < volHit) {
        alpha = cirA + (1.0 - cirA) * volA;
        colL = (cirL * cirA + volC * volA * (1.0 - cirA)) / max(alpha, 1e-4);
    } else {
        alpha = volA + (1.0 - volA) * cirA;
        colL = (volC * volA + cirL * cirA * (1.0 - volA)) / max(alpha, 1e-4);
    }

    // Distance fade into the horizon haze.
    float hitDist = min(volHit, cirHit);
    float haze = 1.0 - exp(-hitDist / (maxD * 0.45));
    vec3 hazeCol = ambient * 1.3 + sunCol * 0.08;
    colL = mix(colL, hazeCol, haze * 0.75);
    alpha *= 1.0 - smoothstep(maxD * 0.4, maxD, volHit) * step(volHit, cirHit);

    vec3 display = gfsr_toGamma(1.0 - exp(-colL));
    gl_FragColor = vec4(display, clamp(alpha, 0.0, 1.0));
}

// @program clouds_apply
uniform sampler2D u_cloudTexture;
uniform vec2 u_cloudDims;    // resolution of the low-res cloud buffer
uniform float u_shadowStrength;
uniform float u_shadowsEnabled;

float viewDistance(vec2 uv)
{
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw)) {
        return 1.0e7;
    }
    return max(length(gfsr_eyePosition(depthTexture, uv)), 0.1);
}

// Depth-aware upsampling of the low-resolution cloud buffer avoids halos
// around mountains and the aircraft silhouette.
vec4 upsampleClouds(vec2 uv, float centerDist)
{
    vec2 dim = max(u_cloudDims, vec2(1.0));
    vec2 st = uv * dim - 0.5;
    vec2 i = floor(st);
    vec2 f = fract(st);
    float logC = log(centerDist);
    vec4 sum = vec4(0.0);
    float wsum = 0.0;
    for (int y = 0; y < 2; y++) {
        for (int x = 0; x < 2; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 tuv = (i + o + 0.5) / dim;
            float bw = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);
            float dw = 1.0 / (0.05 + abs(log(viewDistance(tuv)) - logC));
            float w = bw * dw + 1e-5;
            sum += texture2D(u_cloudTexture, tuv) * w;
            wsum += w;
        }
    }
    return sum / wsum;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);
    bool sky = gfsr_isSkyDepth(raw);
    vec3 col = src.rgb;

    float dist = 1.0e7;
    if (!sky) {
        vec3 pEC = gfsr_eyePosition(depthTexture, uv);
        dist = max(length(pEC), 0.1);

        if (u_shadowsEnabled > 0.5 && u_cloudParams.x > 0.5) {
            vec3 p = u_eyeToEnu * pEC;
            float alt = u_camHeight + p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);
            vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
            float shadowAlt = u_cloudLayer.x + 0.35 * u_cloudLayer.y;
            if (sunDir.z > 0.03 && alt < shadowAlt) {
                float tt = (shadowAlt - alt) / sunDir.z;
                vec3 sp = vec3(p.xy + sunDir.xy * tt, shadowAlt);
                float d = cloudDensity(sp, 0.0);
                float sunFade = smoothstep(0.03, 0.2, sunDir.z);
                float distFade = 1.0 - smoothstep(60000.0, 120000.0, dist);
                float shade = u_shadowStrength * smoothstep(0.0, 0.35, d) * sunFade * distFade;
                col *= 1.0 - shade;
            }
        }
    }

    vec4 cl = upsampleClouds(uv, dist);
    col = mix(col, cl.rgb, clamp(cl.a, 0.0, 1.0));
    gl_FragColor = vec4(col, src.a);
}
