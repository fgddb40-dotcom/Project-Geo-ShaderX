// GeoFS-ReShade : clouds.glsl
// Raymarched volumetric clouds (v2).
//
//   Density  : Perlin-Worley base shape, 2D weather map (cloud fields),
//              height profiles (cumulus / stratus / storm with anvil),
//              Worley erosion (billowy tops, wispy bases), wind shear.
//   Lighting : Beer-Lambert + Beer-powder, dual-lobe Henyey-Greenstein phase
//              (forward scattering / silver lining), multiple-scattering
//              octaves, height-graded sky ambient, ground bounce,
//              moonlight at night, humidity-softened lighting.
//   Marching : interleaved-gradient (blue-noise-like) jitter, adaptive steps
//              with empty-space skipping, short steps inside clouds so the
//              camera can fly through cloud interiors, detail LOD by distance.
//   Layers   : volumetric layer + high cirrus sheet, aerial perspective.
//   Shadows  : sun-projected density darkens terrain (clouds_apply).
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
uniform vec4 u_moisture;      // x humidity, y wetness, z air temperature (C), w moon brightness

const float CLOUD_PERIOD = 64.0;

float cloudHeightProfile(float hf, float type, float cov)
{
    // Flat condensation base, rounded cauliflower top.
    float cumulus = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(0.3, 1.0, hf));
    // Overcast skies flatten into stratiform decks.
    float strat = smoothstep(0.0, 0.12, hf) * (1.0 - smoothstep(0.55, 1.0, hf));
    // Cumulonimbus: tall column with an anvil spreading under the tropopause.
    float stormy = smoothstep(0.0, 0.03, hf) * (1.0 - smoothstep(0.92, 1.0, hf));
    stormy = max(stormy * 0.85, smoothstep(0.72, 0.85, hf) * (1.0 - smoothstep(0.93, 1.0, hf)));
    float p = mix(cumulus, strat, smoothstep(0.75, 0.95, cov));
    return type > 1.5 ? stormy : p;
}

// Large-scale weather map: clusters clouds into fields with clear gaps.
float weatherMap(vec2 q)
{
    return gfsr_fbm2(q * 0.25, vec2(CLOUD_PERIOD * 0.25), 3);
}

// pos.xy = horizontal ENU metres relative to the camera, pos.z = altitude (m).
// lod: 0 = full detail (erosion), 1 = base shape only (light rays, shadows).
float cloudDensity(vec3 pos, float lod)
{
    float base = u_cloudLayer.x;
    float thick = max(u_cloudLayer.y, 50.0);
    float hf = (pos.z - base) / thick;
    if (hf <= 0.0 || hf >= 1.0) {
        return 0.0;
    }
    float type = u_cloudParams.x;
    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);
    float cov = clamp(u_cloudLayer.z + storm * 0.2, 0.0, 1.0);

    vec2 q2 = (pos.xy + u_cloudOffset) / u_cloudParams.y;
    float wm = weatherMap(q2);
    float localCov = clamp(cov + (wm - 0.5) * 0.7 * (1.0 - cov * 0.6), 0.0, 1.0);
    if (localCov < 0.02) {
        return 0.0;
    }

    // Wind shear leans the towers downwind with height.
    vec3 q = vec3(q2 + vec2(0.35, 0.12) * hf, pos.z / u_cloudParams.y + u_time * 0.0012);
    float perlin = gfsr_fbm3(q, CLOUD_PERIOD, 3);
    float profile = cloudHeightProfile(hf, type, cov);
    // Conservative early-out: even a maximal Worley value cannot form cloud here.
    if (smoothstep(0.25, 0.8, perlin * 0.6 + 0.47) * profile <= 1.0 - localCov) {
        return 0.0;
    }
    float shape;
    if (lod < 0.5) {
        // Perlin-Worley: billows grow around Worley cell centres.
        float w = 1.0 - gfsr_worley3(q * 2.0, CLOUD_PERIOD * 2.0);
        shape = smoothstep(0.25, 0.8, perlin * 0.6 + w * 0.55 - 0.08);
    } else {
        // Same mean as the detailed version so the LOD transition is invisible.
        shape = smoothstep(0.25, 0.8, perlin * 0.6 + 0.195);
    }

    float d = gfsr_remap(shape * profile, 1.0 - localCov, 1.0, 0.0, 1.0);
    if (d <= 0.0) {
        return 0.0;
    }

    if (lod < 0.5) {
        // Erosion: billowy (inverted Worley) at the top, wispy (fbm) at the base.
        vec3 qd = q * 8.0 + vec3(0.0, 0.0, u_time * 0.008);
        float billow = 1.0 - gfsr_worley3(qd, CLOUD_PERIOD * 8.0);
        float wisp = gfsr_fbm3(qd * 2.0, CLOUD_PERIOD * 16.0, 2);
        float detail = mix(wisp, billow, clamp(hf * 1.6, 0.0, 1.0));
        float erode = 0.42 * (1.0 - lod) * mix(1.0, 0.6, storm);
        d = gfsr_remap(d, detail * erode, 1.0, 0.0, 1.0);
    }
    return clamp(d, 0.0, 1.0) * u_cloudLayer.w * (1.0 + storm * 0.8);
}

float cirrusDensity(vec2 xy)
{
    // Fibrous ice sheet stretched along the wind; integer periods keep the CPU wrap seamless.
    vec2 q = (xy + u_cloudOffset) / (u_cloudParams.y * vec2(4.0, 1.0));
    vec2 warp = vec2(gfsr_fbm2(q * 2.0, vec2(32.0, 128.0), 3), gfsr_fbm2(q * 2.0 + 5.0, vec2(32.0, 128.0), 2) * 0.3) * 0.7;
    float n = gfsr_fbm2(q + warp, vec2(16.0, 64.0), 5);
    float streak = gfsr_fbm2(vec2(q.x * 0.5, q.y * 6.0) + warp * 2.0, vec2(8.0, 384.0), 3);
    float cov = clamp(u_cirrus.y, 0.0, 1.0);
    return smoothstep(1.0 - cov, 1.0 - cov + 0.35, n * 0.75 + streak * 0.25);
}

// @program clouds_generate
uniform float u_cloudSteps;
uniform float u_maxDistance;
uniform sampler2D u_mieLut;
uniform vec4 u_cloudLod;      // x camera angular speed LOD 0..1 (1 = fast pan)

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
    vec3 moonDir = normalize(u_eyeToEnu * czm_moonDirectionEC);
    float camH = u_camHeight;
    float camHKm = max(camH, 1.0) * 0.001;
    float type = u_cloudParams.x;
    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);
    float humidity = u_moisture.x;

    float base = u_cloudLayer.x;
    float thick = max(u_cloudLayer.y, 50.0);
    float top = base + thick;
    float midKm = (base + 0.5 * thick) * 0.001;

    // Light source: the sun, or the moon once the sun is well below the horizon.
    float day = smoothstep(-0.10, 0.03, sunDir.z);
    float moonPhase = 0.5 * (1.0 - dot(sunDir, moonDir));
    vec3 lightDir = sunDir.z > -0.08 ? sunDir : moonDir;
    vec3 sunCol = gfsr_sunTransmittance(midKm, sunDir.z, 1.0, 1.0, 1.0) * 3.0 * day;
    vec3 moonCol = vec3(0.55, 0.62, 0.75) * 0.05 * pow(max(moonPhase, 0.0), 1.5) * smoothstep(-0.05, 0.1, moonDir.z) * u_moisture.w;
    vec3 lightCol = sunDir.z > -0.08 ? sunCol : moonCol;
    float nu = dot(rd, lightDir);

    vec3 ambL;
    vec3 ambT;
    gfsr_scatter(midKm, vec3(0.0, 0.0, 1.0), sunDir, 1.0e9, 1.0, 1.0, 1.0, 6.0, ambL, ambT);
    vec3 ambTop = (1.0 - exp(-ambL)) * 1.5 + vec3(0.004, 0.005, 0.008) + moonCol * 0.6;
    // Overcast skies still light the cloud with diffuse skylight.
    ambTop = max(ambTop, vec3(0.30, 0.33, 0.38) * day);
    float darken = 1.0 - 0.6 * storm - 0.25 * u_weather.x;
    lightCol *= darken;
    ambTop *= mix(1.0, 0.5, storm);
    // Sunlight reflected by the ground onto cloud bases (greenish-brown albedo).
    vec3 bounce = sunCol * max(sunDir.z, 0.0) * vec3(0.10, 0.11, 0.09) * darken;
    // Humid air softens lighting: more diffuse, less directional contrast.
    float soft = 1.0 + humidity * 0.6;

    // Lorenz-Mie single scattering of cloud droplets (glory, cloudbow, corona).
    vec3 phMie = min(gfsr_mieLut(u_mieLut, nu, 2.0, 0.86) * 4.0 * GFSR_PI, vec3(8.0));

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
        bool inside = false;
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
            inside = true;
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
            // LOD: far layers (seen from high altitude) and fast camera pans
            // (where motion hides detail) get fewer view and light steps.
            float farLod = smoothstep(15000.0, 60000.0, t0);
            float lodK = max(farLod, u_cloudLod.x);
            float stepsF = max(u_cloudSteps, 4.0);
            stepsF = max(stepsF * (1.0 - 0.45 * farLod) * (1.0 - 0.4 * u_cloudLod.x), min(stepsF, 6.0));
            float lightN = lodK > 0.5 ? 3.0 : 5.0;
            float lightGrow = lodK > 0.5 ? 4.0 : 1.8;
            float dtBase = (t1 - t0) / stepsF;
            // Inside a cloud start with short steps so the interior has detail.
            float dt = inside ? clamp(dtBase * 0.15, 15.0, dtBase) : dtBase;
            float t = t0 + dt * jitter;
            float detailDist = maxD * 0.35;
            float lightStep = thick * 0.06;
            float msGain = 0.0;

            for (int i = 0; i < 160; i++) {
                if (t > t1 || volT < 0.01 || float(i) >= stepsF * 1.6) {
                    break;
                }
                vec3 p = rd * t;
                float alt = gfsr_altAlong(camHKm, rd.z, t * 0.001) * 1000.0;
                vec3 pos = vec3(p.xy, alt);
                float lod = smoothstep(detailDist * 0.6, detailDist, t);
                float d = cloudDensity(pos, lod);
                if (d > 0.002) {
                    if (volHit > 1.0e8) {
                        volHit = t;
                    }
                    // Cone-shaped light march towards the light source.
                    float od = 0.0;
                    float ls = lightStep;
                    vec3 lp = pos;
                    for (int j = 0; j < 5; j++) {
                        if (float(j) >= lightN) {
                            break;
                        }
                        lp += lightDir * ls;
                        od += cloudDensity(lp, 1.0) * ls;
                        ls *= lightGrow;
                    }
                    float lightOD = od * 0.0035 / soft;

                    // Multiple-scattering octaves (Wrenninge): each octave
                    // attenuates less and scatters more isotropically.
                    vec3 light = vec3(0.0);
                    float a = 1.0;
                    float b = 1.0;
                    float c = 1.0;
                    for (int k = 0; k < 4; k++) {
                        float ph = mix(gfsr_phaseHG(nu, 0.8 * c), gfsr_phaseHG(nu, -0.3 * c), 0.35)
                                 + 0.15 * gfsr_phaseHG(nu, 0.95 * c);
                        ph = min(ph * 4.0 * GFSR_PI, 8.0);
                        // First octave = single scattering: exact droplet optics.
                        vec3 phv = k == 0 ? mix(vec3(ph), phMie, 0.7) : vec3(ph);
                        light += b * exp(-lightOD * a) * phv;
                        a *= 0.25;
                        b *= 0.55;
                        c *= 0.5;
                    }
                    // Beer-powder: in-scattering builds up inside the volume, so
                    // sun-facing edges of dense cores look darker ("powder effect");
                    // the effect fades when looking towards the sun.
                    float powder = 1.0 - exp(-od * 0.007 - d * 1.5);
                    light *= mix(1.0, powder, 0.65 * (1.0 - smoothstep(0.2, 0.9, nu)));

                    float hf = clamp((alt - base) / thick, 0.0, 1.0);
                    // Ambient: brighter at the top (sky dome), darker at the
                    // base, plus a little occlusion from the local density.
                    float ambOcc = mix(0.35, 1.0, pow(hf, 0.6)) * (1.0 - 0.3 * d);
                    vec3 S = lightCol * light + ambTop * ambOcc * soft * 0.85 + bounce * (1.0 - hf);
                    S *= u_cloudParams.z;

                    float sigma = 0.0075 * d;
                    float stepT = exp(-sigma * dt);
                    volL += volT * (1.0 - stepT) * S;
                    volT *= stepT;
                    msGain += d;
                    if (inside) {
                        dt = min(dt * 1.04, dtBase);
                    }
                    t += dt;
                } else {
                    // Empty-space skipping: larger strides through clear air.
                    t += inside ? dt * 1.5 : dt * 2.0;
                    if (inside) {
                        dt = min(dt * 1.1, dtBase);
                    }
                }
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
            // Ice crystals: strong forward scattering, faint backscatter.
            float ph = (0.7 * gfsr_phaseHG(nu, 0.75) + 0.3 * gfsr_phaseHG(nu, -0.2)) * 4.0 * GFSR_PI;
            // 22-degree halo from hexagonal ice prisms: minimum-deviation ring,
            // red on the inside edge, a dark gap inside and a fading outer skirt.
            float th = acos(clamp(nu, -1.0, 1.0));
            vec3 thMin = vec3(0.3770, 0.3840, 0.3915);
            vec3 dth = vec3(th) - thMin;
            vec3 ring = exp(-dth * dth / 0.00012) + 0.45 * step(0.0, dth) * exp(-max(dth, 0.0) / 0.05);
            float gap = 1.0 - 0.35 * (1.0 - smoothstep(0.30, 0.37, th));
            vec3 phv = (vec3(min(ph, 6.0)) + ring * 1.6 * smoothstep(0.15, 0.5, d)) * gap;
            vec3 cirSun = gfsr_sunTransmittance(hc * 0.001, sunDir.z, 1.0, 1.0, 1.0) * 3.0 * day * darken;
            vec3 cirLight = sunDir.z > -0.08 ? cirSun : moonCol;
            cirL = (cirLight * (0.45 + 0.55 * phv) + ambTop * 1.1) * u_cloudParams.z;
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

    // Aerial perspective between the camera and the cloud.
    float hitDist = min(volHit, cirHit);
    if (hitDist < 1.0e8) {
        vec3 Lap;
        vec3 Tap;
        gfsr_scatter(camHKm, rd, sunDir, hitDist * 0.001, 1.0, 1.0 + humidity, 1.0, 4.0, Lap, Tap);
        colL = colL * Tap + Lap * (1.0 + humidity * 0.5);
        float far = smoothstep(maxD * 0.25, maxD * 0.85, hitDist);
        far = far * far * (3.0 - 2.0 * far);
        alpha *= 1.0 - far * step(volHit, cirHit);
    }

    vec3 display = gfsr_toGamma(1.0 - exp(-colL));
    gl_FragColor = vec4(display, clamp(alpha, 0.0, 1.0));
}

// @program clouds_apply
uniform sampler2D u_cloudTexture;
uniform vec2 u_cloudDims;    // resolution of the low-res cloud buffer
uniform float u_shadowStrength;
uniform float u_shadowsEnabled;
uniform vec4 u_skyGlow;      // x light-pollution strength, y night factor, z LED share, w unused

float viewDistance(vec2 uv)
{
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw)) {
        return 1.0e7;
    }
    return max(length(gfsr_eyePosition(depthTexture, uv)), 0.1);
}

// Depth-aware Gaussian upsampling of the low-resolution cloud buffer: a 3x3
// low-res footprint (sigma ~0.9 texel) integrates the per-pixel ray-start
// jitter into smooth gradients (no dither pattern), while the depth weight
// avoids halos around mountains and the aircraft silhouette.
vec4 upsampleClouds(vec2 uv, float centerDist)
{
    vec2 dim = max(u_cloudDims, vec2(1.0));
    vec2 st = uv * dim - 0.5;
    vec2 i = floor(st + 0.5);
    vec2 f = st - i;
    float logC = log(centerDist);
    vec4 sum = vec4(0.0);
    float wsum = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 tuv = (i + o + 0.5) / dim;
            vec2 dd = o - f;
            float gw = exp(-dot(dd, dd) * 0.62);
            float dw = 1.0 / (0.05 + abs(log(viewDistance(tuv)) - logC));
            float w = gw * dw + 1e-6;
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
            if (sunDir.z > 0.03 && alt < u_cloudLayer.x + u_cloudLayer.y * 0.5) {
                // Two samples through the layer give soft, volume-aware shadows.
                float od = 0.0;
                for (int k = 0; k < 2; k++) {
                    float sh = u_cloudLayer.x + u_cloudLayer.y * (0.15 + 0.3 * float(k));
                    if (alt < sh) {
                        float tt = (sh - alt) / sunDir.z;
                        od += cloudDensity(vec3(p.xy + sunDir.xy * tt, sh), 1.0);
                    }
                }
                float sunFade = smoothstep(0.03, 0.2, sunDir.z);
                float distFade = 1.0 - smoothstep(60000.0, 120000.0, dist);
                float shade = u_shadowStrength * (1.0 - exp(-od * 2.5)) * sunFade * distFade;
                col *= 1.0 - shade;
            }
        }
    }

    vec4 cl = upsampleClouds(uv, dist);
    // City light reflected by cloud bases when flying beneath them at night.
    float glowK = u_skyGlow.x * u_skyGlow.y * (1.0 - smoothstep(0.0, u_cloudLayer.y + 200.0, u_camHeight - u_cloudLayer.x));
    if (glowK > 0.002 && cl.a > 0.01) {
        vec3 under = gfsr_screenGlow(colorTexture, depthTexture, uv, vec2(0.22), vec2(0.0, -1.0), u_skyGlow.z);
        cl.rgb += under * glowK * 1.4 * (0.5 + 0.5 * u_cloudLayer.w);
    }
    col = mix(col, cl.rgb, clamp(cl.a, 0.0, 1.0));
    gl_FragColor = vec4(col, src.a);
}
