// ==UserScript==
// @name         GeoFS Ultra Graphics
// @namespace    GeoFS
// @version      1.0
// @description  Next-generation graphics overhaul for GeoFS
// @author       GeoFS-ReShade
// @match        https://www.geo-fs.com/*
// @match        https://geo-fs.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * GeoFS-ReShade / GeoFS Ultra Graphics
 *
 * Injects a cinematic post-processing pipeline into the CesiumJS viewer used by
 * GeoFS: ACES HDR tonemapping, bloom, atmospheric scattering, depth fog,
 * volumetric clouds, god rays, SSAO, aircraft reflections, water, lens effects,
 * colour grading, dynamic weather and an automatic performance system.
 *
 * The shaders (shaders/*.glsl), presets (presets/*.json) and UI modules
 * (ui/*.js) are inlined into the marked BUILD regions below by build.js so the
 * userscript is a single self-contained file. Edit the source files and run
 * `node build.js` to regenerate those regions.
 *
 * SHIFT + G opens the settings panel.
 */

(function () {
    'use strict';

    const NS = window.GeoFSReShade = window.GeoFSReShade || {};
    if (NS.started) {
        return;
    }
    NS.started = true;
    NS.version = '1.0';

    const TAG = '[GeoFS-ReShade]';
    const log = function () { console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
    const warn = function () { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); };

    // <<<GFSR:BUILD shaders>>>
    NS.shaderSources = {
        "atmosphere": "// GeoFS-ReShade : atmosphere.glsl\n// Physically based sky and aerial perspective.\n//\n//   * Rayleigh scattering   -> blue sky, deep dark blue at high altitude\n//   * Mie scattering        -> bright low-altitude haze and sun halo\n//   * Ozone absorption      -> purple upper sky at sunset\n//   * Horizon glow          -> warm band along the horizon at low sun\n//   * Aerial perspective    -> distant terrain fades into the atmosphere\n//   * Weather tint          -> overcast / storm desaturation and darkening\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program atmosphere\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_skyBlend;\nuniform float u_hazeStrength;\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform float u_horizonGlow;\nuniform float u_sunsetShift;\nuniform float u_steps;\nuniform vec4 u_weather; // x overcast, y storm, z precipitation, w fog\n\nvec3 weatherTint(vec3 c, float overcast, float storm)\n{\n    float l = gfsr_luma(c);\n    vec3 grey = vec3(l) * vec3(0.93, 0.96, 1.0);\n    vec3 stormGrey = vec3(l) * vec3(0.62, 0.68, 0.74);\n    vec3 outc = mix(c, grey, overcast * 0.85);\n    return mix(outc, stormGrey, storm * 0.8);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n\n    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float nu = dot(rd, sunDir);\n\n    float overcast = u_weather.x;\n    float storm = u_weather.y;\n    float mie = u_mie * (1.0 + overcast * 1.5 + u_weather.w * 3.0);\n    float ozone = u_sunsetShift;\n    float day = smoothstep(-0.12, 0.03, sunDir.z);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, ozone);\n\n    if (gfsr_isSkyDepth(raw)) {\n        vec3 L;\n        vec3 T;\n        gfsr_scatter(camHKm, rd, sunDir, 1.0e9, u_rayleigh, mie, ozone, u_steps, L, T);\n\n        // Horizon glow: warm band hugging the horizon, strongest towards the sun\n        // and at low sun elevations (sunset / sunrise).\n        float lowSun = 1.0 - smoothstep(0.0, 0.35, abs(sunDir.z));\n        float band = exp(-abs(rd.z) * 14.0);\n        float towardsSun = 0.35 + 0.65 * pow(max(nu, 0.0), 3.0);\n        vec3 glowCol = sunT * vec3(1.0, 0.62, 0.32);\n        L += glowCol * band * towardsSun * (0.25 + lowSun) * u_horizonGlow * 0.6 * day;\n\n        // Sun disk with limb darkening, attenuated by the atmosphere.\n        float disk = smoothstep(0.99990, 0.99996, nu);\n        L += sunT * disk * 60.0 * (1.0 - overcast * 0.9);\n\n        vec3 sky = gfsr_toGamma(1.0 - exp(-L));\n        sky = weatherTint(sky, overcast, storm);\n\n        // Keep the native star field / moon when the sun is down.\n        float blend = u_skyBlend * day;\n        vec3 outc = mix(src.rgb, sky, blend);\n        gl_FragColor = vec4(outc, src.a);\n        return;\n    }\n\n    // Aerial perspective for terrain, aircraft and buildings.\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    float distKm = length(pEC) * 0.001;\n    vec3 L;\n    vec3 T;\n    gfsr_scatter(camHKm, rd, sunDir, distKm, u_rayleigh, mie, ozone, max(4.0, floor(u_steps * 0.5)), L, T);\n\n    vec3 lin = gfsr_toLinear(src.rgb);\n    float k = u_hazeStrength;\n    vec3 transm = mix(vec3(1.0), T, k);\n    vec3 haze = (1.0 - exp(-L)) * k;\n    vec3 outLin = lin * transm + haze;\n\n    // Bright low-altitude haze when the camera itself is in the boundary layer.\n    float lowAlt = 1.0 - smoothstep(500.0, 4000.0, u_camHeight);\n    float hazeAmt = (1.0 - exp(-distKm * 0.02 * lowAlt * k)) * day;\n    vec3 hazeCol = gfsr_toLinear(vec3(0.78, 0.84, 0.92)) * (0.35 + 0.65 * sunT);\n    outLin = mix(outLin, hazeCol, hazeAmt * 0.35);\n\n    vec3 outc = gfsr_toGamma(outLin);\n    outc = weatherTint(outc, overcast * 0.6, storm * 0.7);\n    gl_FragColor = vec4(outc, src.a);\n}\n",
        "bloom": "// GeoFS-ReShade : bloom.glsl\n// Cinematic bloom.\n//\n// Pipeline\n//   bloom_bright     (1/2 res)  soft-knee threshold + 4-tap anti-flicker prefilter\n//   bloom_downsample (1/4 res)  13-tap \"call of duty\" downsample\n//   bloom_blur       (1/4 res)  separable 9-tap Gaussian, run H then V, radius scaled\n//   bloom_upsample   (1/2 res)  3x3 tent upsample + bright pass (soft bloom)\n//   bloom_streak     (1/4 res)  anamorphic horizontal streaks (lens effect)\n//   bloom_composite  (full)     additive composite in linear light\n//\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\nuniform vec2 u_srcTexel; // texel size of the texture being sampled by this pass\n\n// @program bloom_bright\nuniform float u_threshold;\nuniform float u_knee;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 o = u_srcTexel * 0.75;\n    vec3 a = gfsr_toLinear(texture2D(colorTexture, uv + vec2(-o.x, -o.y)).rgb);\n    vec3 b = gfsr_toLinear(texture2D(colorTexture, uv + vec2(o.x, -o.y)).rgb);\n    vec3 c = gfsr_toLinear(texture2D(colorTexture, uv + vec2(-o.x, o.y)).rgb);\n    vec3 d = gfsr_toLinear(texture2D(colorTexture, uv + vec2(o.x, o.y)).rgb);\n    // Karis average suppresses single-pixel fireflies.\n    float wa = 1.0 / (1.0 + gfsr_luma(a));\n    float wb = 1.0 / (1.0 + gfsr_luma(b));\n    float wc = 1.0 / (1.0 + gfsr_luma(c));\n    float wd = 1.0 / (1.0 + gfsr_luma(d));\n    vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);\n\n    float threshold = gfsr_toLinear(vec3(u_threshold)).r;\n    float br = max(col.r, max(col.g, col.b));\n    float knee = threshold * u_knee + 1e-4;\n    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);\n    soft = soft * soft / (4.0 * knee);\n    float contrib = max(soft, br - threshold) / max(br, 1e-4);\n    gl_FragColor = vec4(col * contrib, 1.0);\n}\n\n// @program bloom_downsample\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 t = u_srcTexel;\n    vec3 a = texture2D(colorTexture, uv + t * vec2(-2.0, -2.0)).rgb;\n    vec3 b = texture2D(colorTexture, uv + t * vec2(0.0, -2.0)).rgb;\n    vec3 c = texture2D(colorTexture, uv + t * vec2(2.0, -2.0)).rgb;\n    vec3 d = texture2D(colorTexture, uv + t * vec2(-2.0, 0.0)).rgb;\n    vec3 e = texture2D(colorTexture, uv).rgb;\n    vec3 f = texture2D(colorTexture, uv + t * vec2(2.0, 0.0)).rgb;\n    vec3 g = texture2D(colorTexture, uv + t * vec2(-2.0, 2.0)).rgb;\n    vec3 h = texture2D(colorTexture, uv + t * vec2(0.0, 2.0)).rgb;\n    vec3 i = texture2D(colorTexture, uv + t * vec2(2.0, 2.0)).rgb;\n    vec3 j = texture2D(colorTexture, uv + t * vec2(-1.0, -1.0)).rgb;\n    vec3 k = texture2D(colorTexture, uv + t * vec2(1.0, -1.0)).rgb;\n    vec3 l = texture2D(colorTexture, uv + t * vec2(-1.0, 1.0)).rgb;\n    vec3 m = texture2D(colorTexture, uv + t * vec2(1.0, 1.0)).rgb;\n    vec3 outc = e * 0.125;\n    outc += (a + c + g + i) * 0.03125;\n    outc += (b + d + f + h) * 0.0625;\n    outc += (j + k + l + m) * 0.125;\n    gl_FragColor = vec4(outc, 1.0);\n}\n\n// @program bloom_blur\nuniform vec2 u_direction;\nuniform float u_radius;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 stepUv = u_direction * u_srcTexel * u_radius;\n    // 9-tap Gaussian folded into 5 bilinear fetches.\n    vec3 sum = texture2D(colorTexture, uv).rgb * 0.2270270270;\n    sum += texture2D(colorTexture, uv + stepUv * 1.3846153846).rgb * 0.3162162162;\n    sum += texture2D(colorTexture, uv - stepUv * 1.3846153846).rgb * 0.3162162162;\n    sum += texture2D(colorTexture, uv + stepUv * 3.2307692308).rgb * 0.0702702703;\n    sum += texture2D(colorTexture, uv - stepUv * 3.2307692308).rgb * 0.0702702703;\n    gl_FragColor = vec4(sum, 1.0);\n}\n\n// @program bloom_upsample\nuniform sampler2D u_brightTexture;\nuniform float u_radius;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 t = u_srcTexel * u_radius;\n    vec3 s = texture2D(colorTexture, uv).rgb * 4.0;\n    s += texture2D(colorTexture, uv + vec2(-t.x, 0.0)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(t.x, 0.0)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(0.0, -t.y)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(0.0, t.y)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(-t.x, -t.y)).rgb;\n    s += texture2D(colorTexture, uv + vec2(t.x, -t.y)).rgb;\n    s += texture2D(colorTexture, uv + vec2(-t.x, t.y)).rgb;\n    s += texture2D(colorTexture, uv + vec2(t.x, t.y)).rgb;\n    vec3 wide = s / 16.0;\n    vec3 tight = texture2D(u_brightTexture, uv).rgb;\n    // Normalised so the mip chain conserves energy instead of growing ~1.35x per level.\n    gl_FragColor = vec4((wide + tight * 0.35) / 1.35, 1.0);\n}\n\n// @program bloom_streak\nuniform sampler2D u_source;\nuniform float u_stepScale;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec3 sum = vec3(0.0);\n    float wsum = 0.0;\n    for (int i = -8; i <= 8; i++) {\n        float fi = float(i);\n        float w = exp(-abs(fi) * 0.28);\n        vec2 suv = uv + vec2(fi * u_srcTexel.x * u_stepScale, 0.0);\n        sum += texture2D(u_source, suv).rgb * w;\n        wsum += w;\n    }\n    gl_FragColor = vec4(sum / wsum, 1.0);\n}\n\n// @program bloom_composite\nuniform sampler2D u_bloomTexture;\nuniform sampler2D u_streakTexture;\nuniform vec2 u_bloomDims;\nuniform vec2 u_streakDims;\nuniform float u_intensity;\nuniform float u_streakIntensity;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 lin = gfsr_toLinear(src.rgb);\n    vec3 bloom = gfsr_textureBilinear(u_bloomTexture, uv, u_bloomDims).rgb;\n    vec3 streak = vec3(0.0);\n    if (u_streakIntensity > 0.0) {\n        streak = gfsr_textureBilinear(u_streakTexture, uv, u_streakDims).rgb * vec3(0.55, 0.75, 1.25);\n    }\n    lin += bloom * u_intensity + streak * u_streakIntensity;\n    // Soft shoulder keeps the result inside the 8-bit buffer without hard clipping.\n    vec3 outLin = lin / (1.0 + max(lin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n",
        "clouds": "// GeoFS-ReShade : clouds.glsl\n// Fake volumetric clouds: fbm()/noise() density field + raymarch approximation.\n//\n//   Layers   : volumetric layer (cumulus or storm) + high cirrus sheet\n//   Lighting : Beer-Lambert + multi-scattering octaves, dual Henyey-Greenstein\n//              phase (silver lining), sky ambient, sun colour from atmosphere\n//   Shadows  : sun-projected density lookup darkens terrain (clouds_apply)\n//\n// Text above the first @program marker is shared by every program in this file.\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_time;\nuniform vec2 u_cloudOffset;   // metres, wrapped on the CPU to the noise period\nuniform vec4 u_cloudLayer;    // x base (m), y thickness (m), z coverage 0..1, w density\nuniform vec4 u_cloudParams;   // x type (0 cirrus, 1 cumulus, 2 storm), y metres per noise cell, z brightness, w cirrus layer on/off\nuniform vec4 u_cirrus;        // x altitude (m), y coverage 0..1, z opacity, w unused\nuniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog\n\nconst float CLOUD_PERIOD = 64.0;\n\nfloat cloudHeightProfile(float hf, float type)\n{\n    float cumulus = smoothstep(0.0, 0.12, hf) * (1.0 - smoothstep(0.45, 1.0, hf));\n    float stormy = smoothstep(0.0, 0.05, hf) * (1.0 - smoothstep(0.82, 1.0, hf));\n    return type < 1.5 ? cumulus : stormy;\n}\n\n// pos.xy = horizontal ENU metres relative to the camera, pos.z = altitude (m).\nfloat cloudDensity(vec3 pos, float detailed)\n{\n    float base = u_cloudLayer.x;\n    float thick = max(u_cloudLayer.y, 50.0);\n    float hf = (pos.z - base) / thick;\n    if (hf <= 0.0 || hf >= 1.0) {\n        return 0.0;\n    }\n    float type = u_cloudParams.x;\n    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);\n    float cov = clamp(u_cloudLayer.z + storm * 0.25, 0.0, 1.0);\n\n    vec3 q = vec3(pos.xy + u_cloudOffset, pos.z) / u_cloudParams.y;\n    q.z += u_time * 0.0015;\n    float shapeN = smoothstep(0.25, 0.85, gfsr_fbm3(q, CLOUD_PERIOD, 4));\n    float d = shapeN * cloudHeightProfile(hf, type);\n    d = (d - (1.0 - cov)) / max(cov, 0.05);\n    if (d <= 0.0) {\n        return 0.0;\n    }\n    if (detailed > 0.5) {\n        float detail = gfsr_fbm3(q * 6.0 + vec3(0.0, 0.0, u_time * 0.01), CLOUD_PERIOD * 6.0, 2);\n        d -= detail * 0.4 * (1.0 - clamp(d, 0.0, 1.0));\n    }\n    return clamp(d, 0.0, 1.0) * u_cloudLayer.w * (1.0 + storm * 0.6);\n}\n\nfloat cirrusDensity(vec2 xy)\n{\n    // Stretched along the east axis; periods stay integer so the CPU wrap is seamless.\n    vec2 q = (xy + u_cloudOffset) / (u_cloudParams.y * vec2(4.0, 1.0));\n    vec2 warp = vec2(gfsr_fbm2(q * 2.0, vec2(32.0, 128.0), 2), 0.0) * 0.6;\n    float n = gfsr_fbm2(q + warp, vec2(16.0, 64.0), 5);\n    float cov = clamp(u_cirrus.y, 0.0, 1.0);\n    return smoothstep(1.0 - cov, 1.0 - cov + 0.35, n);\n}\n\n// @program clouds_generate\nuniform float u_cloudSteps;\nuniform float u_maxDistance;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    float sceneDist = 1.0e9;\n    if (!gfsr_isSkyDepth(raw)) {\n        sceneDist = length(gfsr_eyePosition(depthTexture, uv));\n    }\n\n    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camH = u_camHeight;\n    float camHKm = max(camH, 1.0) * 0.001;\n    float nu = dot(rd, sunDir);\n    float type = u_cloudParams.x;\n    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);\n\n    float base = u_cloudLayer.x;\n    float thick = max(u_cloudLayer.y, 50.0);\n    float top = base + thick;\n    float midKm = (base + 0.5 * thick) * 0.001;\n\n    // Lighting environment from the atmosphere model.\n    float day = smoothstep(-0.10, 0.05, sunDir.z);\n    vec3 sunCol = gfsr_sunTransmittance(midKm, sunDir.z, 1.0, 1.0, 1.0) * 3.2 * day;\n    vec3 ambL;\n    vec3 ambT;\n    gfsr_scatter(midKm, vec3(0.0, 0.0, 1.0), sunDir, 1.0e9, 1.0, 1.0, 1.0, 6.0, ambL, ambT);\n    vec3 ambient = (1.0 - exp(-ambL)) * 1.4 + vec3(0.010, 0.012, 0.018);\n    // Overcast skies still light cloud bases with diffuse skylight.\n    ambient = max(ambient, vec3(0.30, 0.33, 0.38) * day);\n    float darken = 1.0 - 0.55 * storm - 0.25 * u_weather.x;\n    sunCol *= darken;\n    ambient *= mix(1.0, 0.55, storm);\n    // Sunlight bounced off the ground onto cloud bases.\n    vec3 bounce = sunCol * max(sunDir.z, 0.0) * 0.12;\n\n    float maxD = u_maxDistance;\n    float jitter = gfsr_ign(gl_FragCoord.xy);\n\n    // ---------------- Volumetric layer -----------------\n    vec3 volL = vec3(0.0);\n    float volT = 1.0;\n    float volHit = 1.0e9;\n    if (type > 0.5) {\n        vec2 tb = gfsr_shell(camHKm, rd.z, base * 0.001);\n        vec2 tt = gfsr_shell(camHKm, rd.z, top * 0.001);\n        vec2 tg = gfsr_shell(camHKm, rd.z, 0.0);\n        float t0 = -1.0;\n        float t1 = -1.0;\n        if (camH < base) {\n            if (tb.y > 0.0) {\n                t0 = tb.y;\n                t1 = tt.y;\n            }\n        } else if (camH > top) {\n            if (tt.x > 0.0) {\n                t0 = tt.x;\n                t1 = tb.x > 0.0 ? tb.x : tt.y;\n            }\n        } else {\n            t0 = 0.0;\n            t1 = rd.z > 0.0 ? tt.y : (tb.x > 0.0 ? tb.x : tt.y);\n        }\n        if (tg.x > 0.0) {\n            t1 = min(t1, tg.x);\n        }\n        t0 *= 1000.0;\n        t1 = min(t1 * 1000.0, min(sceneDist, maxD));\n        // Grazing rays cross the layer over tens of km; cap the span to keep steps dense.\n        t1 = min(t1, t0 + max(thick * 6.0, 6000.0));\n\n        if (t0 >= 0.0 && t1 > t0) {\n            float stepsF = max(u_cloudSteps, 4.0);\n            float dt = (t1 - t0) / stepsF;\n            float t = t0 + dt * jitter;\n            float lightStep = thick * 0.12;\n\n            for (int i = 0; i < 128; i++) {\n                if (float(i) >= stepsF || volT < 0.02) {\n                    break;\n                }\n                vec3 p = rd * t;\n                float alt = gfsr_altAlong(camHKm, rd.z, t * 0.001) * 1000.0;\n                vec3 pos = vec3(p.xy, alt);\n                float d = cloudDensity(pos, 1.0);\n                if (d > 0.002) {\n                    if (volHit > 1.0e8) {\n                        volHit = t;\n                    }\n                    // Light march towards the sun.\n                    float od = 0.0;\n                    float ls = lightStep;\n                    vec3 lp = pos;\n                    for (int j = 0; j < 4; j++) {\n                        lp += sunDir * ls;\n                        od += cloudDensity(lp, 0.0) * ls;\n                        ls *= 1.7;\n                    }\n                    float lightOD = od * 0.003;\n\n                    // Multi-scattering octaves (Wrenninge) -> soft bright interiors\n                    // and strong forward-scattered silver lining near the sun.\n                    float light = 0.0;\n                    float a = 1.0;\n                    float b = 1.0;\n                    float c = 1.0;\n                    for (int k = 0; k < 3; k++) {\n                        float ph = mix(gfsr_phaseHG(nu, 0.6 * c), gfsr_phaseHG(nu, -0.25 * c), 0.4) * 4.0 * GFSR_PI;\n                        ph = min(ph, 5.0);\n                        light += b * exp(-lightOD * a) * ph;\n                        a *= 0.3;\n                        b *= 0.6;\n                        c *= 0.5;\n                    }\n                    // Powder term darkens the sun-facing edges of thick cores.\n                    float powder = 1.0 - exp(-d * dt * 0.016);\n                    light *= mix(1.0, powder * 2.0, 0.35 * (1.0 - smoothstep(0.6, 1.0, nu)));\n\n                    float hf = clamp((alt - base) / thick, 0.0, 1.0);\n                    vec3 S = sunCol * light + ambient * mix(0.6, 1.0, hf) + bounce * (1.0 - hf);\n                    S *= u_cloudParams.z;\n\n                    float sigma = 0.008 * d;\n                    float stepT = exp(-sigma * dt);\n                    volL += volT * (1.0 - stepT) * S;\n                    volT *= stepT;\n                }\n                t += dt;\n            }\n        }\n    }\n\n    // ---------------- Cirrus sheet -----------------\n    vec3 cirL = vec3(0.0);\n    float cirA = 0.0;\n    float cirHit = 1.0e9;\n    if (u_cloudParams.w > 0.5 || type < 0.5) {\n        float hc = u_cirrus.x;\n        vec2 tc = gfsr_shell(camHKm, rd.z, hc * 0.001);\n        float tci = (camH < hc ? tc.y : tc.x) * 1000.0;\n        if (tci > 0.0 && tci < sceneDist && tci < maxD * 3.0) {\n            vec3 p = rd * tci;\n            float d = cirrusDensity(p.xy);\n            float fade = 1.0 - smoothstep(maxD * 1.5, maxD * 3.0, tci);\n            cirA = d * u_cirrus.z * fade * (type < 0.5 ? 1.0 : 0.75);\n            float ph = gfsr_phaseHG(nu, 0.6) * 4.0 * GFSR_PI;\n            vec3 cirSun = gfsr_sunTransmittance(hc * 0.001, sunDir.z, 1.0, 1.0, 1.0) * 3.2 * day * darken;\n            cirL = (cirSun * (0.55 + 0.45 * ph) + ambient * 1.2) * u_cloudParams.z;\n            cirHit = tci;\n        }\n    }\n\n    // ---------------- Composite layers -----------------\n    float volA = 1.0 - volT;\n    vec3 volC = volA > 1e-4 ? volL / volA : vec3(0.0);\n    vec3 colL;\n    float alpha;\n    if (cirHit < volHit) {\n        alpha = cirA + (1.0 - cirA) * volA;\n        colL = (cirL * cirA + volC * volA * (1.0 - cirA)) / max(alpha, 1e-4);\n    } else {\n        alpha = volA + (1.0 - volA) * cirA;\n        colL = (volC * volA + cirL * cirA * (1.0 - volA)) / max(alpha, 1e-4);\n    }\n\n    // Distance fade into the horizon haze.\n    float hitDist = min(volHit, cirHit);\n    float haze = 1.0 - exp(-hitDist / (maxD * 0.45));\n    vec3 hazeCol = ambient * 1.3 + sunCol * 0.08;\n    colL = mix(colL, hazeCol, haze * 0.75);\n    alpha *= 1.0 - smoothstep(maxD * 0.4, maxD, volHit) * step(volHit, cirHit);\n\n    vec3 display = gfsr_toGamma(1.0 - exp(-colL));\n    gl_FragColor = vec4(display, clamp(alpha, 0.0, 1.0));\n}\n\n// @program clouds_apply\nuniform sampler2D u_cloudTexture;\nuniform vec2 u_cloudDims;    // resolution of the low-res cloud buffer\nuniform float u_shadowStrength;\nuniform float u_shadowsEnabled;\n\nfloat viewDistance(vec2 uv)\n{\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        return 1.0e7;\n    }\n    return max(length(gfsr_eyePosition(depthTexture, uv)), 0.1);\n}\n\n// Depth-aware upsampling of the low-resolution cloud buffer avoids halos\n// around mountains and the aircraft silhouette.\nvec4 upsampleClouds(vec2 uv, float centerDist)\n{\n    vec2 dim = max(u_cloudDims, vec2(1.0));\n    vec2 st = uv * dim - 0.5;\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float logC = log(centerDist);\n    vec4 sum = vec4(0.0);\n    float wsum = 0.0;\n    for (int y = 0; y < 2; y++) {\n        for (int x = 0; x < 2; x++) {\n            vec2 o = vec2(float(x), float(y));\n            vec2 tuv = (i + o + 0.5) / dim;\n            float bw = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);\n            float dw = 1.0 / (0.05 + abs(log(viewDistance(tuv)) - logC));\n            float w = bw * dw + 1e-5;\n            sum += texture2D(u_cloudTexture, tuv) * w;\n            wsum += w;\n        }\n    }\n    return sum / wsum;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    bool sky = gfsr_isSkyDepth(raw);\n    vec3 col = src.rgb;\n\n    float dist = 1.0e7;\n    if (!sky) {\n        vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n        dist = max(length(pEC), 0.1);\n\n        if (u_shadowsEnabled > 0.5 && u_cloudParams.x > 0.5) {\n            vec3 p = u_eyeToEnu * pEC;\n            float alt = u_camHeight + p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);\n            vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n            float shadowAlt = u_cloudLayer.x + 0.35 * u_cloudLayer.y;\n            if (sunDir.z > 0.03 && alt < shadowAlt) {\n                float tt = (shadowAlt - alt) / sunDir.z;\n                vec3 sp = vec3(p.xy + sunDir.xy * tt, shadowAlt);\n                float d = cloudDensity(sp, 0.0);\n                float sunFade = smoothstep(0.03, 0.2, sunDir.z);\n                float distFade = 1.0 - smoothstep(60000.0, 120000.0, dist);\n                float shade = u_shadowStrength * smoothstep(0.0, 0.35, d) * sunFade * distFade;\n                col *= 1.0 - shade;\n            }\n        }\n    }\n\n    vec4 cl = upsampleClouds(uv, dist);\n    col = mix(col, cl.rgb, clamp(cl.a, 0.0, 1.0));\n    gl_FragColor = vec4(col, src.a);\n}\n",
        "colorgrade": "// GeoFS-ReShade : colorgrade.glsl\n// LUT-style professional colour grading, applied after tonemapping.\n//\n// Modes (u_mode):\n//   0 Realistic     neutral, gentle filmic contrast\n//   1 MSFS          clean, slightly cool, crisp mid-contrast, rich blues\n//   2 DCS           muted, slightly green/olive military look, lower saturation\n//   3 Cinematic     teal shadows / orange highlights, strong S-curve\n//   4 Photographic  natural, lifted blacks, soft highlight roll-off, warm print\n//\n// Curves: separate shadows / midtones / highlights controls.\n// Colour scheme: warm highlights, cool shadows (split toning).\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program colorgrade\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform float u_mode;\nuniform float u_strength;\nuniform float u_shadows;     // -1..1  lift\nuniform float u_midtones;    // -1..1  gamma\nuniform float u_highlights;  // -1..1  gain\nuniform float u_warmth;      //  0..1  warm highlights\nuniform float u_coolness;    //  0..1  cool shadows\nuniform float u_vibrance;    // -1..1\n\nstruct Grade {\n    vec3 lift;\n    vec3 gammaV;\n    vec3 gain;\n    float sat;\n    float contrast;\n    vec3 shadowTint;\n    vec3 highlightTint;\n    float splitAmount;\n};\n\nGrade gradeForMode(float mode)\n{\n    Grade g;\n    g.lift = vec3(0.0);\n    g.gammaV = vec3(1.0);\n    g.gain = vec3(1.0);\n    g.sat = 1.0;\n    g.contrast = 1.0;\n    g.shadowTint = vec3(0.0, 0.0, 0.0);\n    g.highlightTint = vec3(0.0, 0.0, 0.0);\n    g.splitAmount = 0.0;\n    if (mode < 0.5) {\n        g.lift = vec3(0.004, 0.004, 0.008);\n        g.gammaV = vec3(1.0);\n        g.gain = vec3(1.0);\n        g.sat = 1.04;\n        g.contrast = 1.04;\n        g.shadowTint = vec3(-0.01, 0.0, 0.02);\n        g.highlightTint = vec3(0.02, 0.01, -0.01);\n        g.splitAmount = 0.5;\n    } else if (mode < 1.5) {\n        g.lift = vec3(0.0, 0.004, 0.012);\n        g.gammaV = vec3(1.02, 1.0, 0.97);\n        g.gain = vec3(1.0, 1.01, 1.04);\n        g.sat = 1.12;\n        g.contrast = 1.08;\n        g.shadowTint = vec3(-0.015, 0.0, 0.03);\n        g.highlightTint = vec3(0.025, 0.015, -0.01);\n        g.splitAmount = 0.6;\n    } else if (mode < 2.5) {\n        g.lift = vec3(0.01, 0.012, 0.006);\n        g.gammaV = vec3(1.0, 0.98, 1.04);\n        g.gain = vec3(1.0, 1.01, 0.96);\n        g.sat = 0.86;\n        g.contrast = 1.06;\n        g.shadowTint = vec3(-0.005, 0.01, 0.015);\n        g.highlightTint = vec3(0.02, 0.02, -0.02);\n        g.splitAmount = 0.5;\n    } else if (mode < 3.5) {\n        g.lift = vec3(-0.01, 0.005, 0.02);\n        g.gammaV = vec3(0.98, 1.0, 1.03);\n        g.gain = vec3(1.06, 1.0, 0.92);\n        g.sat = 1.1;\n        g.contrast = 1.18;\n        g.shadowTint = vec3(-0.04, 0.01, 0.05);\n        g.highlightTint = vec3(0.06, 0.02, -0.04);\n        g.splitAmount = 1.0;\n    } else {\n        g.lift = vec3(0.025, 0.022, 0.02);\n        g.gammaV = vec3(0.98, 1.0, 1.02);\n        g.gain = vec3(1.02, 1.0, 0.97);\n        g.sat = 0.95;\n        g.contrast = 0.97;\n        g.shadowTint = vec3(-0.01, 0.0, 0.015);\n        g.highlightTint = vec3(0.03, 0.015, -0.015);\n        g.splitAmount = 0.7;\n    }\n    return g;\n}\n\nvec3 liftGammaGain(vec3 c, vec3 lift, vec3 gammaV, vec3 gain)\n{\n    vec3 x = c * gain + lift * (1.0 - c);\n    return pow(max(x, vec3(0.0)), 1.0 / max(gammaV, vec3(0.05)));\n}\n\nvec3 sCurve(vec3 c, float contrast)\n{\n    // Contrast pivoting around mid grey in perceptual space, smooth at the ends.\n    vec3 x = c - 0.5;\n    vec3 y = x * contrast / (1.0 + abs(x) * (contrast - 1.0) * 2.0);\n    return clamp(y + 0.5, 0.0, 1.0);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 c = clamp(src.rgb, 0.0, 1.0);\n\n    Grade g = gradeForMode(u_mode);\n\n    // Base look.\n    vec3 graded = liftGammaGain(c, g.lift, g.gammaV, g.gain);\n    graded = sCurve(graded, g.contrast);\n\n    // Luminance zone weights.\n    float l = gfsr_luma(graded);\n    float wS = 1.0 - smoothstep(0.0, 0.45, l);\n    float wH = smoothstep(0.55, 1.0, l);\n    float wM = max(1.0 - wS - wH, 0.0);\n\n    // User curves: shadows (lift), midtones (gamma), highlights (gain).\n    graded += wS * u_shadows * 0.18 * (1.0 - graded);\n    graded = mix(graded, pow(max(graded, vec3(0.0)), vec3(exp2(-u_midtones * 0.8))), wM);\n    graded *= 1.0 + wH * u_highlights * 0.25;\n\n    // Split toning: warm highlights, cool shadows.\n    vec3 warm = vec3(0.06, 0.025, -0.045) * u_warmth;\n    vec3 cool = vec3(-0.04, 0.0, 0.06) * u_coolness;\n    graded += (g.highlightTint * g.splitAmount + warm) * wH;\n    graded += (g.shadowTint * g.splitAmount + cool) * wS;\n\n    // Saturation + vibrance (protects already saturated colours).\n    float l2 = gfsr_luma(graded);\n    graded = mix(vec3(l2), graded, g.sat);\n    float mx = max(graded.r, max(graded.g, graded.b));\n    float mn = min(graded.r, min(graded.g, graded.b));\n    float satNow = mx - mn;\n    float vib = 1.0 + u_vibrance * (1.0 - satNow);\n    graded = mix(vec3(gfsr_luma(graded)), graded, vib);\n\n    graded = clamp(graded, 0.0, 1.0);\n    gl_FragColor = vec4(mix(c, graded, u_strength), src.a);\n}\n",
        "common": "// GeoFS-ReShade : common.glsl\n// Shared helper library. The loader prepends this file to every program.\n//\n// Conventions\n//   * Written in the GLSL ES 1.00 post-process dialect of Cesium <= 1.101\n//     (texture2D / gl_FragColor / varying). main.user.js upgrades the syntax\n//     automatically when GeoFS runs a Cesium build >= 1.102 (GLSL ES 3.00).\n//   * ENU = local East-North-Up frame at the camera (z = up).\n//   * Distances are metres unless the identifier ends in Km.\n//   * This file declares no uniforms so it can be shared by every stage.\n\n#define GFSR_PI 3.14159265359\n#define GFSR_R_KM 6371.0\n#define GFSR_ATMO_KM 100.0\n#define GFSR_R_M 6371000.0\n\n// ---------------------------------------------------------------------------\n// Basic colour helpers\n// ---------------------------------------------------------------------------\nfloat gfsr_saturate(float x) { return clamp(x, 0.0, 1.0); }\nvec3 gfsr_saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\nfloat gfsr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }\nvec3 gfsr_toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }\nvec3 gfsr_toGamma(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }\n\n// Manual bilinear fetch for textures produced at a different resolution.\n// Cesium shares and re-samples intermediate textures, so their filtering mode\n// cannot be relied upon; dims is the texture size in pixels.\nvec4 gfsr_textureBilinear(sampler2D tex, vec2 uv, vec2 dims)\n{\n    vec2 d = max(dims, vec2(1.0));\n    vec2 st = uv * d - 0.5;\n    vec2 i = floor(st);\n    vec2 f = st - i;\n    vec2 inv = 1.0 / d;\n    vec4 a = texture2D(tex, (i + vec2(0.5, 0.5)) * inv);\n    vec4 b = texture2D(tex, (i + vec2(1.5, 0.5)) * inv);\n    vec4 c = texture2D(tex, (i + vec2(0.5, 1.5)) * inv);\n    vec4 e = texture2D(tex, (i + vec2(1.5, 1.5)) * inv);\n    return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);\n}\n\n// ---------------------------------------------------------------------------\n// Depth buffer helpers\n// ---------------------------------------------------------------------------\nfloat gfsr_rawDepth(sampler2D depthTex, vec2 uv)\n{\n    return texture2D(depthTex, uv).r;\n}\n\nbool gfsr_isSkyDepth(float raw)\n{\n    return raw >= 0.999999;\n}\n\n// Eye-space position of the surface visible at uv.\n// With a logarithmic depth buffer czm_windowToEyeCoordinates expects the raw\n// log depth; czm_readDepth would linearise it a second time.\nvec3 gfsr_eyePosition(sampler2D depthTex, vec2 uv)\n{\n#ifdef LOG_DEPTH\n    float depth = texture2D(depthTex, uv).r;\n#else\n    float depth = czm_readDepth(depthTex, uv);\n#endif\n    vec4 ec = czm_windowToEyeCoordinates(uv * czm_viewport.zw + czm_viewport.xy, depth);\n    return ec.xyz / ec.w;\n}\n\n// Normalised eye-space view ray through uv (valid for sky pixels too).\nvec3 gfsr_viewRayEC(vec2 uv)\n{\n    vec4 ndc = vec4(uv * 2.0 - 1.0, -1.0, 1.0);\n    vec4 ec = czm_inverseProjection * ndc;\n    return normalize(ec.xyz / ec.w);\n}\n\n// Eye-space normal reconstructed from the depth buffer. Picks the smaller\n// depth step on each axis so silhouettes do not produce smeared normals.\nvec3 gfsr_normalEC(sampler2D depthTex, vec2 uv, vec2 texel, vec3 p)\n{\n    vec3 pr = gfsr_eyePosition(depthTex, uv + vec2(texel.x, 0.0));\n    vec3 pl = gfsr_eyePosition(depthTex, uv - vec2(texel.x, 0.0));\n    vec3 pu = gfsr_eyePosition(depthTex, uv + vec2(0.0, texel.y));\n    vec3 pd = gfsr_eyePosition(depthTex, uv - vec2(0.0, texel.y));\n    vec3 dx = (abs(pr.z - p.z) < abs(p.z - pl.z)) ? (pr - p) : (p - pl);\n    vec3 dy = (abs(pu.z - p.z) < abs(p.z - pd.z)) ? (pu - p) : (p - pd);\n    vec3 n = cross(dx, dy);\n    float len = length(n);\n    return len > 1e-8 ? n / len : vec3(0.0, 0.0, 1.0);\n}\n\n// Screen position of the sun. xy = uv, z = 1 when the sun is in front of the camera.\nvec3 gfsr_sunScreen()\n{\n    vec4 clip = czm_projection * vec4(czm_sunDirectionEC, 0.0);\n    if (clip.w <= 1e-5) {\n        return vec3(-10.0, -10.0, 0.0);\n    }\n    return vec3(clip.xy / clip.w * 0.5 + 0.5, 1.0);\n}\n\n// ---------------------------------------------------------------------------\n// Noise\n// ---------------------------------------------------------------------------\nfloat gfsr_hash12(vec2 p)\n{\n    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n    p3 += dot(p3, p3.yzx + 33.33);\n    return fract((p3.x + p3.y) * p3.z);\n}\n\nfloat gfsr_hash13(vec3 p3)\n{\n    p3 = fract(p3 * 0.1031);\n    p3 += dot(p3, p3.zyx + 31.32);\n    return fract((p3.x + p3.y) * p3.z);\n}\n\n// Interleaved gradient noise, used for dithering and ray jitter.\nfloat gfsr_ign(vec2 fragCoord)\n{\n    return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));\n}\n\n// Tileable value noise. The lattice wraps every `period` cells so world-locked\n// coordinates can be wrapped on the CPU without visible seams.\nfloat gfsr_noise2(vec2 x, vec2 period)\n{\n    vec2 i = floor(x);\n    vec2 f = fract(x);\n    vec2 u = f * f * (3.0 - 2.0 * f);\n    vec2 i0 = mod(i, period);\n    vec2 i1 = mod(i + 1.0, period);\n    float a = gfsr_hash12(i0);\n    float b = gfsr_hash12(vec2(i1.x, i0.y));\n    float c = gfsr_hash12(vec2(i0.x, i1.y));\n    float d = gfsr_hash12(i1);\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n}\n\nfloat gfsr_noise3(vec3 x, float period)\n{\n    vec3 i = floor(x);\n    vec3 f = fract(x);\n    vec3 u = f * f * (3.0 - 2.0 * f);\n    vec3 i0 = mod(i, period);\n    vec3 i1 = mod(i + 1.0, period);\n    float n000 = gfsr_hash13(i0);\n    float n100 = gfsr_hash13(vec3(i1.x, i0.y, i0.z));\n    float n010 = gfsr_hash13(vec3(i0.x, i1.y, i0.z));\n    float n110 = gfsr_hash13(vec3(i1.x, i1.y, i0.z));\n    float n001 = gfsr_hash13(vec3(i0.x, i0.y, i1.z));\n    float n101 = gfsr_hash13(vec3(i1.x, i0.y, i1.z));\n    float n011 = gfsr_hash13(vec3(i0.x, i1.y, i1.z));\n    float n111 = gfsr_hash13(i1);\n    return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),\n               mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);\n}\n\nfloat gfsr_fbm2(vec2 p, vec2 period, int octaves)\n{\n    float sum = 0.0;\n    float amp = 0.5;\n    float norm = 0.0;\n    for (int i = 0; i < 8; i++) {\n        if (i >= octaves) {\n            break;\n        }\n        sum += amp * gfsr_noise2(p, period);\n        norm += amp;\n        p *= 2.0;\n        period *= 2.0;\n        amp *= 0.5;\n    }\n    return sum / max(norm, 1e-5);\n}\n\nfloat gfsr_fbm3(vec3 p, float period, int octaves)\n{\n    float sum = 0.0;\n    float amp = 0.5;\n    float norm = 0.0;\n    for (int i = 0; i < 8; i++) {\n        if (i >= octaves) {\n            break;\n        }\n        sum += amp * gfsr_noise3(p, period);\n        norm += amp;\n        p *= 2.0;\n        period *= 2.0;\n        amp *= 0.5;\n    }\n    return sum / max(norm, 1e-5);\n}\n\n// ---------------------------------------------------------------------------\n// Phase functions\n// ---------------------------------------------------------------------------\nfloat gfsr_phaseRayleigh(float nu)\n{\n    return 3.0 / (16.0 * GFSR_PI) * (1.0 + nu * nu);\n}\n\nfloat gfsr_phaseMie(float nu, float g)\n{\n    float g2 = g * g;\n    float denom = (2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * nu, 1e-4), 1.5);\n    return 3.0 / (8.0 * GFSR_PI) * ((1.0 - g2) * (1.0 + nu * nu)) / denom;\n}\n\nfloat gfsr_phaseHG(float nu, float g)\n{\n    float g2 = g * g;\n    return (1.0 - g2) / (4.0 * GFSR_PI * pow(max(1.0 + g2 - 2.0 * g * nu, 1e-4), 1.5));\n}\n\n// ---------------------------------------------------------------------------\n// Planet / atmosphere geometry (km, numerically stable for float32)\n// ---------------------------------------------------------------------------\n\n// Intersection of a ray starting at altitude camHKm (direction cosine mu with\n// the local up vector) with a spherical shell at altitude shellHKm.\n// Returns (tNear, tFar) in km. Both negative when the shell is missed.\nvec2 gfsr_shell(float camHKm, float mu, float shellHKm)\n{\n    float r = GFSR_R_KM + camHKm;\n    float b = r * mu;\n    float c = (camHKm - shellHKm) * (2.0 * GFSR_R_KM + camHKm + shellHKm);\n    float disc = b * b - c;\n    if (disc < 0.0) {\n        return vec2(-1.0);\n    }\n    float s = sqrt(disc);\n    float q = (b >= 0.0) ? (-b - s) : (-b + s);\n    if (abs(q) < 1e-6) {\n        return vec2(0.0);\n    }\n    float t0 = q;\n    float t1 = c / q;\n    return vec2(min(t0, t1), max(t0, t1));\n}\n\n// Altitude (km) reached after travelling tKm along a ray with zenith cosine mu.\nfloat gfsr_altAlong(float camHKm, float mu, float tKm)\n{\n    float r = GFSR_R_KM + camHKm;\n    return sqrt(max(r * r + 2.0 * r * mu * tKm + tKm * tKm, 0.0)) - GFSR_R_KM;\n}\n\nconst vec3 GFSR_BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);\nconst float GFSR_BETA_M = 3.996e-3;\nconst float GFSR_EXT_M = 4.40e-3;\nconst vec3 GFSR_BETA_O = vec3(0.650e-3, 1.881e-3, 0.085e-3);\nconst float GFSR_HR = 8.0;\nconst float GFSR_HM = 1.2;\n\n// Schueler's Chapman-function approximation: optical depth (in scale heights)\n// of an exponential atmosphere from normalised altitude h towards zenith cos mu.\nfloat gfsr_chapman(float X, float h, float mu)\n{\n    float c = sqrt(X + h);\n    if (mu >= 0.0) {\n        return c / (c * mu + 1.0) * exp(-h);\n    }\n    float x0 = sqrt(max(1.0 - mu * mu, 0.0)) * (X + h);\n    float c0 = sqrt(x0);\n    return 2.0 * c0 * exp(min(X - x0, 60.0)) - c / (1.0 - c * mu) * exp(-h);\n}\n\n// (rayleigh, mie, ozone) optical depth from altitude hKm towards the sun.\nvec3 gfsr_opticalDepthToSun(float hKm, float mu)\n{\n    float h = max(hKm, 0.0);\n    float odR = GFSR_HR * gfsr_chapman(GFSR_R_KM / GFSR_HR, h / GFSR_HR, mu);\n    float odM = GFSR_HM * gfsr_chapman(GFSR_R_KM / GFSR_HM, h / GFSR_HM, mu);\n    return vec3(odR, odM, odR * 1.875);\n}\n\nvec3 gfsr_densities(float hKm)\n{\n    float h = max(hKm, 0.0);\n    return vec3(exp(-h / GFSR_HR), exp(-h / GFSR_HM), max(0.0, 1.0 - abs(h - 25.0) / 15.0));\n}\n\nvec3 gfsr_extinction(vec3 od, float rayleigh, float mie, float ozone)\n{\n    return GFSR_BETA_R * (rayleigh * od.x) + vec3(GFSR_EXT_M * mie * od.y) + GFSR_BETA_O * (ozone * od.z);\n}\n\nvec3 gfsr_sunTransmittance(float hKm, float muS, float rayleigh, float mie, float ozone)\n{\n    return exp(-gfsr_extinction(gfsr_opticalDepthToSun(hKm, muS), rayleigh, mie, ozone));\n}\n\n// Single-scattering integrator (Rayleigh + Mie + ozone absorption).\n// rd and sunDir are ENU unit vectors, tMaxKm limits the ray (use a huge value\n// for sky pixels). Outputs linear in-scattered radiance and view transmittance.\nvoid gfsr_scatter(float camHKm, vec3 rd, vec3 sunDir, float tMaxKm,\n                  float rayleigh, float mie, float ozone, float steps,\n                  out vec3 inscatter, out vec3 transmittance)\n{\n    inscatter = vec3(0.0);\n    transmittance = vec3(1.0);\n\n    float mu = rd.z;\n    vec2 atmo = gfsr_shell(camHKm, mu, GFSR_ATMO_KM);\n    if (atmo.y <= 0.0) {\n        return;\n    }\n    float tStart = max(atmo.x, 0.0);\n    float tEnd = atmo.y;\n    vec2 ground = gfsr_shell(camHKm, mu, 0.0);\n    if (ground.x > 0.0) {\n        tEnd = min(tEnd, ground.x);\n    }\n    tEnd = min(tEnd, tMaxKm);\n    if (tEnd <= tStart) {\n        return;\n    }\n\n    float nu = dot(rd, sunDir);\n    float len = tEnd - tStart;\n    float n = max(steps, 1.0);\n    float r = GFSR_R_KM + camHKm;\n    vec3 odView = vec3(0.0);\n    vec3 sumR = vec3(0.0);\n    vec3 sumM = vec3(0.0);\n    float prevT = 0.0;\n\n    for (int i = 0; i < 24; i++) {\n        if (float(i) >= n) {\n            break;\n        }\n        // Quadratic distribution concentrates samples in the dense lower air.\n        float f1 = (float(i) + 1.0) / n;\n        float tNext = len * f1 * f1;\n        float dt = tNext - prevT;\n        float t = tStart + prevT + 0.5 * dt;\n        prevT = tNext;\n\n        float rS = sqrt(max(r * r + 2.0 * r * mu * t + t * t, 0.0));\n        float hS = rS - GFSR_R_KM;\n        float muS = (r * sunDir.z + t * nu) / max(rS, 1.0);\n\n        vec3 dens = gfsr_densities(hS);\n        odView += dens * dt;\n        vec3 odSun = gfsr_opticalDepthToSun(hS, muS);\n        vec3 att = exp(-gfsr_extinction(odView + odSun, rayleigh, mie, ozone));\n        sumR += dens.x * att * dt;\n        sumM += dens.y * att * dt;\n    }\n\n    const float SUN_INTENSITY = 20.0;\n    inscatter = SUN_INTENSITY * (sumR * GFSR_BETA_R * rayleigh * gfsr_phaseRayleigh(nu)\n                               + sumM * GFSR_BETA_M * mie * gfsr_phaseMie(nu, 0.76));\n    transmittance = exp(-gfsr_extinction(odView, rayleigh, mie, ozone));\n}\n",
        "fog": "// GeoFS-ReShade : fog.glsl\n// Depth-buffer fog with exponential height falloff.\n//\n//   fog = 1.0 - exp(-distance * density)\n//\n// `density` is the height-integrated density along the view ray, so valleys\n// fill with haze while mountain tops stay clear. Distant terrain and the\n// horizon band of the sky converge to the same colour, hiding terrain pop-in\n// and blending mountains into the horizon.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program fog\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_fogDensity;   // user density (scaled to 1e-4 per metre)\nuniform float u_fogHeight;    // height falloff scale (m)\nuniform float u_fogStart;     // distance where fog begins (m)\nuniform float u_fogMaxDistance; // distance used for the sky horizon band (m)\nuniform vec3 u_fogColor;      // sRGB\nuniform float u_fogSkyTint;   // 0 = flat colour, 1 = sun-lit atmospheric tint\nuniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog\n\nfloat heightIntegratedDensity(float density, float camAlt, float dz, float H)\n{\n    // Average of density * exp(-h / H) along a ray from camAlt rising by dz.\n    float base = density * exp(-max(camAlt, 0.0) / H);\n    float k = dz / H;\n    if (abs(k) < 1e-3) {\n        return base;\n    }\n    return base * (1.0 - exp(-k)) / k;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n\n    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float H = max(u_fogHeight, 10.0);\n    float density = u_fogDensity * 1.0e-4 * (1.0 + u_weather.w * 8.0 + u_weather.z * 3.0 + u_weather.y * 2.0);\n\n    // Fog colour: user colour, optionally lit by the low sun and darkened at night.\n    float day = smoothstep(-0.12, 0.05, sunDir.z);\n    vec3 sunT = gfsr_sunTransmittance(max(u_camHeight, 1.0) * 0.001, sunDir.z, 1.0, 1.0, 1.0);\n    float nu = dot(rd, sunDir);\n    vec3 lit = u_fogColor * (0.55 + 0.6 * sunT) + sunT * pow(max(nu, 0.0), 8.0) * 0.35;\n    vec3 fogCol = mix(u_fogColor, lit, u_fogSkyTint);\n    fogCol *= mix(0.05, 1.0, day);\n    fogCol = mix(fogCol, vec3(gfsr_luma(fogCol)) * vec3(0.85, 0.9, 0.95), u_weather.y * 0.6);\n\n    float dist;\n    float dz;\n    if (gfsr_isSkyDepth(raw)) {\n        // Only a band around the horizon is fogged so it matches distant terrain.\n        dist = u_fogMaxDistance;\n        dz = rd.z * dist;\n        float band = 1.0 - smoothstep(0.0, 0.18, max(rd.z, 0.0));\n        float f = 1.0 - exp(-max(dist - u_fogStart, 0.0) * heightIntegratedDensity(density, u_camHeight, dz, H));\n        gl_FragColor = vec4(mix(src.rgb, fogCol, f * band), src.a);\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    dist = length(pEC);\n    vec3 p = u_eyeToEnu * pEC;\n    dz = p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);\n    float d = max(dist - u_fogStart, 0.0);\n    float fog = 1.0 - exp(-d * heightIntegratedDensity(density, u_camHeight, dz, H));\n    gl_FragColor = vec4(mix(src.rgb, fogCol, clamp(fog, 0.0, 1.0)), src.a);\n}\n",
        "godrays": "// GeoFS-ReShade : godrays.glsl\n// Screen-space crepuscular rays (sun shafts).\n//\n//   godrays_mask   (1/2 res)  occlusion mask: sky pixels near the sun, dimmed by\n//                             clouds already composited into the frame (cloud interaction)\n//   godrays_blur   (1/2 res)  radial blur towards the sun (Mitchell / GPU Gems 3)\n//   godrays_apply  (full)     atmospheric tinting, additive composite, sun glare\n//\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\nuniform mat3 u_eyeToEnu;\nuniform float u_aspect; // width / height\n\nfloat sunFacing()\n{\n    // 1 when the sun is in front of the camera, fading out towards the edges.\n    vec3 s = gfsr_sunScreen();\n    if (s.z < 0.5) {\n        return 0.0;\n    }\n    vec2 d = max(abs(s.xy - 0.5) - 0.5, 0.0);\n    return 1.0 - smoothstep(0.0, 0.6, length(d));\n}\n\n// @program godrays_mask\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec3 sun = gfsr_sunScreen();\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    vec3 col = texture2D(colorTexture, uv).rgb;\n\n    float sky = gfsr_isSkyDepth(raw) ? 1.0 : 0.0;\n    vec2 d = (uv - sun.xy) * vec2(u_aspect, 1.0);\n    float dist = length(d);\n    float nearSun = exp(-dist * 5.0);\n\n    // Clouds composited earlier are bright on their sunlit side but block the\n    // disk: weighting by a high luma threshold makes them cast shadow shafts.\n    float l = gfsr_luma(col);\n    float bright = smoothstep(0.72, 1.0, l);\n\n    vec3 sunDirEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float day = smoothstep(-0.05, 0.08, sunDirEnu.z);\n    float m = sky * bright * nearSun * day;\n    gl_FragColor = vec4(col * m, m);\n}\n\n// @program godrays_blur\nuniform float u_samples;\nuniform float u_length;\nuniform float u_decay;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec3 sun = gfsr_sunScreen();\n    vec2 delta = (uv - sun.xy) * (u_length / max(u_samples, 1.0));\n    float jitter = gfsr_ign(gl_FragCoord.xy);\n    vec2 cur = uv - delta * jitter;\n    vec4 sum = vec4(0.0);\n    float illum = 1.0;\n    float wsum = 0.0;\n    for (int i = 0; i < 128; i++) {\n        if (float(i) >= u_samples) {\n            break;\n        }\n        vec4 s = texture2D(colorTexture, clamp(cur, 0.0, 1.0));\n        sum += s * illum;\n        wsum += illum;\n        illum *= u_decay;\n        cur -= delta;\n    }\n    gl_FragColor = sum / max(wsum, 1e-4) * 1.25;\n}\n\n// @program godrays_apply\nuniform sampler2D u_raysTexture;\nuniform vec2 u_raysDims;\nuniform float u_strength;\nuniform float u_glare;\nuniform float u_camHeight;\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform vec4 u_weather;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 lin = gfsr_toLinear(src.rgb);\n\n    vec3 sunDirEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    // Atmospheric scattering colours the shafts: white at noon, gold at sunset.\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDirEnu.z, u_rayleigh, u_mie, 0.6);\n    vec3 tint = normalize(sunT + 1e-4) * 1.7320508;\n    float facing = sunFacing();\n    float overcast = u_weather.x;\n    // Broken cloud cover produces the strongest visible shafts; full overcast hides the sun.\n    float cloudBoost = 1.0 + overcast * 1.2 * (1.0 - smoothstep(0.7, 1.0, overcast) * 0.9);\n    float fogBoost = 1.0 + u_weather.w * 1.5;\n\n    vec4 rays = gfsr_textureBilinear(u_raysTexture, uv, u_raysDims);\n    vec3 shafts = gfsr_toLinear(rays.rgb) * tint * u_strength * facing * cloudBoost * fogBoost;\n\n    // Sun glare: wide soft glow around the sun disk, visible when the sun itself is visible.\n    vec3 sun = gfsr_sunScreen();\n    vec2 d = (uv - sun.xy) * vec2(u_aspect, 1.0);\n    float dist = length(d);\n    float vis = gfsr_textureBilinear(u_raysTexture, clamp(sun.xy, 0.0, 1.0), u_raysDims).a;\n    float glare = (exp(-dist * 9.0) * 0.6 + exp(-dist * 2.5) * 0.15) * vis * facing;\n    glare *= u_glare * (1.0 - overcast * 0.8);\n    vec3 glareCol = sunT * glare;\n\n    // Screen-style blend: shafts brighten darker areas without clipping already bright clouds.\n    vec3 add = (shafts * 0.7 + glareCol);\n    lin += add * max(vec3(1.0) - lin * 0.85, vec3(0.0));\n    vec3 outLin = lin / (1.0 + max(lin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n",
        "lens": "// GeoFS-ReShade : lens.glsl\n// Camera lens effects.\n//\n//   lens_flare  sun lens flare: ghosts along the sun-centre axis, halo ring,\n//               starburst; occluded by terrain (depth) and by clouds (frame luma)\n//   lens_final  chromatic aberration + vignette (last stage of the pipeline)\n//\n// Bloom streaks live in bloom.glsl (bloom_streak).\n//\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\n// @program lens_flare\nuniform sampler2D depthTexture;\nuniform mat3 u_eyeToEnu;\nuniform float u_aspect;\nuniform float u_flareIntensity;\nuniform float u_ghosts;\nuniform float u_halo;\nuniform float u_starburst;\nuniform vec4 u_weather;\n\nfloat sunVisibility(vec2 sunUv)\n{\n    float vis = 0.0;\n    for (int y = -2; y <= 2; y++) {\n        for (int x = -2; x <= 2; x++) {\n            vec2 o = vec2(float(x), float(y)) * 0.004 * vec2(1.0 / u_aspect, 1.0);\n            vec2 suv = sunUv + o;\n            if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) {\n                continue;\n            }\n            float raw = gfsr_rawDepth(depthTexture, suv);\n            float sky = gfsr_isSkyDepth(raw) ? 1.0 : 0.0;\n            // Clouds composited into the frame dim the sun region.\n            float l = gfsr_luma(texture2D(colorTexture, suv).rgb);\n            vis += sky * smoothstep(0.6, 0.92, l);\n        }\n    }\n    return vis / 25.0;\n}\n\nfloat ghostDisk(vec2 p, vec2 centre, float radius, float softness)\n{\n    float d = length(p - centre);\n    return 1.0 - smoothstep(radius * (1.0 - softness), radius, d);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 sun = gfsr_sunScreen();\n    vec3 sunEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float day = smoothstep(-0.03, 0.06, sunEnu.z);\n    if (sun.z < 0.5 || day <= 0.0 || u_flareIntensity <= 0.0) {\n        gl_FragColor = src;\n        return;\n    }\n    float onScreen = 1.0 - smoothstep(0.0, 0.25, length(max(abs(sun.xy - 0.5) - 0.5, 0.0)));\n    float vis = sunVisibility(clamp(sun.xy, 0.0, 1.0)) * onScreen * day * (1.0 - u_weather.x * 0.9);\n    if (vis <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec2 asp = vec2(u_aspect, 1.0);\n    vec2 p = (uv - 0.5) * asp;\n    vec2 s = (sun.xy - 0.5) * asp;\n    vec3 flare = vec3(0.0);\n\n    // Ghosts: reflections between lens elements mirrored through the centre.\n    vec3 ghostCol0 = vec3(0.35, 0.55, 1.0);\n    vec3 ghostCol1 = vec3(1.0, 0.65, 0.3);\n    vec3 ghostCol2 = vec3(0.45, 1.0, 0.55);\n    vec3 ghostCol3 = vec3(0.9, 0.4, 1.0);\n    flare += ghostDisk(p, s * -0.35, 0.035, 0.5) * ghostCol0 * 0.35;\n    flare += ghostDisk(p, s * -0.6, 0.075, 0.25) * ghostCol1 * 0.18;\n    flare += ghostDisk(p, s * -1.0, 0.05, 0.6) * ghostCol2 * 0.22;\n    flare += ghostDisk(p, s * 0.45, 0.02, 0.4) * ghostCol3 * 0.3;\n    flare += ghostDisk(p, s * -1.45, 0.12, 0.15) * ghostCol0 * 0.08;\n    flare += ghostDisk(p, s * 0.2, 0.012, 0.5) * ghostCol1 * 0.4;\n    flare *= u_ghosts;\n\n    // Halo: chromatic ring centred on the sun.\n    float dSun = length(p - s);\n    float ringR = 0.32;\n    float ring = exp(-pow((dSun - ringR) * 28.0, 2.0));\n    vec3 haloCol = vec3(\n        exp(-pow((dSun - ringR * 1.02) * 30.0, 2.0)),\n        exp(-pow((dSun - ringR) * 30.0, 2.0)),\n        exp(-pow((dSun - ringR * 0.98) * 30.0, 2.0))\n    );\n    flare += (haloCol * 0.6 + ring * 0.2) * 0.25 * u_halo;\n\n    // Starburst: angular streaks around the sun from the aperture blades.\n    vec2 ds = p - s;\n    float ang = atan(ds.y, ds.x);\n    float rays = pow(abs(cos(ang * 3.0)), 60.0) + pow(abs(cos(ang * 3.0 + 1.0472)), 60.0) * 0.7;\n    rays += gfsr_noise2(vec2(ang * 12.0, 0.0), vec2(75.0, 1.0)) * 0.35;\n    float burst = rays * exp(-dSun * 7.0) * 0.9 + exp(-dSun * 22.0) * 0.8;\n    flare += vec3(1.0, 0.95, 0.85) * burst * u_starburst;\n\n    vec3 sunTint = mix(vec3(1.0, 0.55, 0.3), vec3(1.0), smoothstep(0.0, 0.35, sunEnu.z));\n    vec3 lin = gfsr_toLinear(src.rgb) + flare * sunTint * vis * u_flareIntensity;\n    lin = lin / (1.0 + max(lin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(lin), src.a);\n}\n\n// @program lens_final\nuniform float u_aspect;\nuniform float u_chromatic;      // 0..1\nuniform float u_vignette;       // 0..1\nuniform float u_vignetteRadius; // 0.3..1.2\nuniform float u_vignetteSoftness;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 c = uv - 0.5;\n    float r2 = dot(c * vec2(u_aspect, 1.0), c * vec2(u_aspect, 1.0));\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 col = src.rgb;\n\n    if (u_chromatic > 0.0) {\n        // Radial lateral chromatic aberration, increasing towards the edges.\n        vec2 off = c * r2 * u_chromatic * 0.02;\n        float rr = texture2D(colorTexture, uv - off).r;\n        float bb = texture2D(colorTexture, uv + off).b;\n        float rr2 = texture2D(colorTexture, uv - off * 0.5).r;\n        float bb2 = texture2D(colorTexture, uv + off * 0.5).b;\n        col = vec3((rr + rr2) * 0.5, col.g, (bb + bb2) * 0.5);\n    }\n\n    if (u_vignette > 0.0) {\n        float d = sqrt(r2);\n        float v = 1.0 - smoothstep(u_vignetteRadius - max(u_vignetteSoftness, 0.01), u_vignetteRadius, d);\n        col *= mix(1.0, v, u_vignette);\n    }\n\n    col += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;\n    gl_FragColor = vec4(col, src.a);\n}\n",
        "reflections": "// GeoFS-ReShade : reflections.glsl\n// Approximate image-based reflections on the aircraft, without model edits.\n//\n// Aircraft pixels are isolated using the known camera -> aircraft distance\n// (provided every frame from JavaScript): every surface within the aircraft's\n// bounding radius receives\n//   * Schlick Fresnel (configurable power)\n//   * environment reflection sampled from the analytic sky (Rayleigh + Mie),\n//     with a ground hemisphere below the horizon\n//   * roughness-dependent blur of the environment (multi-tap cone)\n//   * GGX sun specular (metal / wing glints)\n//   * canopy enhancement for dark, low saturation glass-like pixels\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program reflections\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform vec2 u_texel;\nuniform float u_aircraftDistance; // metres, camera -> aircraft origin\nuniform float u_aircraftRadius;   // metres, bounding radius\nuniform float u_strength;\nuniform float u_fresnelPower;\nuniform float u_roughness;\nuniform float u_metallic;\nuniform float u_canopyBoost;\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform vec4 u_weather;\n\nvec3 environment(vec3 dir, vec3 sunDir, float camHKm, float mie, float day)\n{\n    vec3 d = dir;\n    float below = 0.0;\n    if (d.z < 0.0) {\n        below = smoothstep(0.0, 0.08, -d.z);\n        d.z = abs(d.z) * 0.25 + 0.01;\n        d = normalize(d);\n    }\n    vec3 L;\n    vec3 T;\n    gfsr_scatter(camHKm, d, sunDir, 1.0e9, u_rayleigh, mie, 0.6, 6.0, L, T);\n    vec3 sky = 1.0 - exp(-L);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);\n    vec3 ground = vec3(0.09, 0.085, 0.07) * (0.2 + 0.8 * max(sunDir.z, 0.0)) * sunT + sky * 0.25;\n    vec3 env = mix(sky, ground, below);\n    return env * mix(0.08, 1.0, day);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw) || u_aircraftDistance <= 0.0) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    float dist = length(pEC);\n    float r = max(u_aircraftRadius, 1.0);\n    float cockpit = 1.0 - smoothstep(r * 0.6, r, u_aircraftDistance);\n    float nearD = u_aircraftDistance - r;\n    float farD = u_aircraftDistance + r;\n    float edge = r * 0.15;\n    float inside = smoothstep(nearD - edge, nearD + edge, dist) * (1.0 - smoothstep(farD - edge, farD + edge, dist));\n    // Cockpit view: only the visible airframe close to the camera.\n    float cockpitMask = 1.0 - smoothstep(r * 0.9, r * 1.2, dist);\n    float mask = mix(inside, cockpitMask * 0.35, cockpit);\n    if (mask <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel, pEC);\n    vec3 vEC = normalize(-pEC);\n    if (dot(nEC, vEC) < 0.0) {\n        nEC = -nEC;\n    }\n    vec3 N = normalize(u_eyeToEnu * nEC);\n    vec3 V = normalize(u_eyeToEnu * vEC);\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float mie = u_mie * (1.0 + u_weather.x * 1.5);\n    float day = smoothstep(-0.1, 0.05, sunDir.z);\n    float overcast = u_weather.x;\n\n    vec3 base = gfsr_toLinear(src.rgb);\n    float l = gfsr_luma(src.rgb);\n    float mx = max(src.r, max(src.g, src.b));\n    float mn = min(src.r, min(src.g, src.b));\n    float sat = mx - mn;\n\n    // Glass heuristic: dark and desaturated surfaces get a smoother, stronger mirror.\n    float glass = (1.0 - smoothstep(0.08, 0.28, l)) * (1.0 - smoothstep(0.05, 0.2, sat)) * u_canopyBoost;\n    float rough = clamp(mix(u_roughness, u_roughness * 0.2, glass), 0.02, 1.0);\n\n    float NdotV = clamp(dot(N, V), 0.0, 1.0);\n    float F0 = mix(0.04, 0.55, u_metallic);\n    F0 = mix(F0, 0.06, glass);\n    float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, u_fresnelPower);\n    fresnel *= mix(1.0, 0.45, rough);\n\n    // Roughness blur: average a small cone of reflection directions.\n    vec3 R = reflect(-V, N);\n    vec3 t1 = normalize(abs(R.z) < 0.95 ? cross(R, vec3(0.0, 0.0, 1.0)) : cross(R, vec3(1.0, 0.0, 0.0)));\n    vec3 t2 = cross(R, t1);\n    float cone = rough * rough * 0.9;\n    vec3 env = environment(R, sunDir, camHKm, mie, day) * 2.0;\n    env += environment(normalize(R + t1 * cone), sunDir, camHKm, mie, day);\n    env += environment(normalize(R - t1 * cone), sunDir, camHKm, mie, day);\n    env += environment(normalize(R + t2 * cone), sunDir, camHKm, mie, day);\n    env += environment(normalize(R - t2 * cone), sunDir, camHKm, mie, day);\n    env /= 6.0;\n    env = mix(env, vec3(gfsr_luma(env)), overcast * 0.6);\n\n    // GGX sun specular.\n    vec3 H = normalize(V + sunDir);\n    float NdotH = max(dot(N, H), 0.0);\n    float NdotL = max(dot(N, sunDir), 0.0);\n    float a = rough * rough;\n    float a2 = a * a;\n    float dd = NdotH * NdotH * (a2 - 1.0) + 1.0;\n    float D = a2 / (3.14159265 * dd * dd + 1e-6);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);\n    vec3 spec = sunT * D * fresnel * NdotL * 0.25 * day * (1.0 - overcast * 0.85);\n\n    // Metals tint the reflection with the base colour.\n    vec3 reflTint = mix(vec3(1.0), base / max(gfsr_luma(base), 0.05), u_metallic * 0.5 * (1.0 - glass));\n    vec3 refl = env * reflTint;\n    float k = u_strength * mask;\n    vec3 outLin = mix(base, refl, clamp(fresnel * k, 0.0, 1.0));\n    outLin += spec * k * (1.0 + glass);\n    outLin = outLin / (1.0 + max(outLin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n",
        "ssao": "// GeoFS-ReShade : ssao.glsl\n// Screen Space Ambient Occlusion.\n//\n//   Inputs : depth buffer + normals reconstructed from depth\n//   Output : terrain crevice darkening, aircraft self-shadowing and cockpit\n//            ambient shading\n//\n// The sampling radius grows with distance so that the same effect works for\n// the cockpit (centimetres), the airframe (metres) and terrain (hundreds of m).\n//\n// Pipeline: ssao_generate (half res) -> ssao_blur (H) -> ssao_blur (V) -> ssao_apply\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\nuniform vec2 u_texel; // full-resolution texel size\n\n// @program ssao_generate\nuniform float u_radius;\nuniform float u_bias;\nuniform float u_strength;\nuniform float u_samples;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        gl_FragColor = vec4(1.0);\n        return;\n    }\n\n    vec3 p = gfsr_eyePosition(depthTexture, uv);\n    float dist = length(p);\n    vec3 n = gfsr_normalEC(depthTexture, uv, u_texel, p);\n\n    float radius = u_radius * clamp(dist / 50.0, 0.15, 200.0);\n    float projScale = czm_projection[1][1] * 0.5 / max(-p.z, 0.05);\n    float screenR = clamp(radius * projScale, 2.0 * u_texel.y, 0.15);\n\n    float n_s = max(u_samples, 1.0);\n    float angle0 = gfsr_ign(gl_FragCoord.xy) * 6.2831853;\n    float xScale = u_texel.x / u_texel.y; // converts uv-y radius into uv-x\n    float occlusion = 0.0;\n\n    for (int i = 0; i < 32; i++) {\n        if (float(i) >= n_s) {\n            break;\n        }\n        // Golden-angle spiral, radius grows with sqrt(i) for even coverage.\n        float fi = (float(i) + 0.5) / n_s;\n        float ang = angle0 + float(i) * 2.39996323;\n        vec2 dir = vec2(cos(ang) * xScale, sin(ang));\n        vec2 suv = uv + dir * screenR * sqrt(fi);\n        if (suv.x <= 0.0 || suv.y <= 0.0 || suv.x >= 1.0 || suv.y >= 1.0) {\n            continue;\n        }\n        if (gfsr_isSkyDepth(gfsr_rawDepth(depthTexture, suv))) {\n            continue;\n        }\n        vec3 q = gfsr_eyePosition(depthTexture, suv);\n        vec3 v = q - p;\n        float vl = length(v);\n        float ndv = dot(n, v) / max(vl, 1e-4);\n        float range = 1.0 - smoothstep(radius * 0.75, radius * 2.0, vl);\n        occlusion += max(ndv - u_bias, 0.0) * range;\n    }\n\n    occlusion = occlusion / n_s;\n    float distFade = 1.0 - smoothstep(30000.0, 80000.0, dist);\n    float ao = 1.0 - clamp(occlusion * u_strength * 1.6, 0.0, 1.0) * distFade;\n    gl_FragColor = vec4(ao, ao, ao, 1.0);\n}\n\n// @program ssao_blur\nuniform vec2 u_direction; // (1,0) or (0,1)\nuniform vec2 u_sourceTexel; // texel size of the half-resolution AO buffer\n\nfloat linearDistance(vec2 uv)\n{\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        return 1.0e7;\n    }\n    return length(gfsr_eyePosition(depthTexture, uv));\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float centerD = linearDistance(uv);\n    float logC = log(max(centerD, 0.01));\n    float sum = 0.0;\n    float wsum = 0.0;\n    for (int i = -4; i <= 4; i++) {\n        float fi = float(i);\n        vec2 suv = uv + u_direction * u_sourceTexel * fi * 1.5;\n        float g = exp(-fi * fi / 8.0);\n        float d = linearDistance(suv);\n        float w = g / (0.02 + abs(log(max(d, 0.01)) - logC) * 8.0);\n        sum += texture2D(colorTexture, suv).r * w;\n        wsum += w;\n    }\n    float ao = sum / max(wsum, 1e-5);\n    gl_FragColor = vec4(ao, ao, ao, 1.0);\n}\n\n// @program ssao_apply\nuniform sampler2D u_aoTexture;\nuniform vec2 u_aoDims;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float ao = gfsr_textureBilinear(u_aoTexture, uv, u_aoDims).r;\n    // Occlusion mostly affects ambient light: keep highlights partially lit.\n    float l = gfsr_luma(src.rgb);\n    float applied = mix(ao, 1.0, smoothstep(0.75, 1.0, l) * 0.5);\n    gl_FragColor = vec4(src.rgb * applied, src.a);\n}\n",
        "tonemap": "// GeoFS-ReShade : tonemap.glsl\n// HDR rendering pipeline.\n//\n// GeoFS hands post-processing an 8-bit display-referred image, so this stage\n//   1. linearises it,\n//   2. re-expands highlights (inverse Reinhard on luminance) to recover HDR headroom,\n//   3. applies HDR exposure,\n//   4. maps back with the ACES filmic curve,\n//   5. applies gamma, contrast and saturation, then dithers to avoid banding.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program tonemap\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform float u_exposure;\nuniform float u_gamma;\nuniform float u_contrast;\nuniform float u_saturation;\n\nvec3 ACESFilm(vec3 x)\n{\n    float a = 2.51;\n    float b = 0.03;\n    float c = 2.43;\n    float d = 0.59;\n    float e = 0.14;\n\n    return clamp(\n        (x * (a * x + b))\n        / (x * (c * x + d) + e),\n        0.0,\n        1.0\n    );\n}\n\nvoid main()\n{\n    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n    vec3 lin = gfsr_toLinear(src.rgb);\n\n    float l = gfsr_luma(lin);\n    float expanded = l / max(1.0 - 0.8 * l, 0.2);\n    lin *= expanded / max(l, 1e-5);\n\n    vec3 mapped = ACESFilm(lin * u_exposure);\n    vec3 c = pow(mapped, vec3(1.0 / max(u_gamma, 0.1)));\n\n    c = (c - 0.5) * u_contrast + 0.5;\n    float lum = gfsr_luma(c);\n    c = mix(vec3(lum), c, u_saturation);\n\n    c += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;\n    gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);\n}\n",
        "water": "// GeoFS-ReShade : water.glsl\n// Screen-space ocean enhancement.\n//\n// Water pixels are detected without any engine changes by combining\n//   * altitude close to sea level (reconstructed from the depth buffer)\n//   * a flat, upward-facing reconstructed normal\n//   * a blue / dark colour signature with low local texture variance\n//\n// The detected surface receives animated wave normals, Fresnel sky reflection\n// (using the same scattering model as the sky), a sun glitter path, specular\n// highlights, deep water colouring and a distance fade.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program water\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_time;\nuniform vec2 u_worldOffset;      // camera motion in metres, wrapped at 4096 m\nuniform vec2 u_texel;\nuniform float u_waterTolerance;  // metres around the ellipsoid treated as sea level\nuniform float u_sunReflection;\nuniform float u_specular;\nuniform vec3 u_deepColor;        // sRGB\nuniform float u_deepStrength;\nuniform float u_waveStrength;\nuniform float u_fadeDistance;    // metres\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform vec4 u_weather;\n\nconst float EARTH_R = 6371000.0;\n\nfloat waveHeight(vec2 xy)\n{\n    vec2 wind = vec2(0.65, 0.35);\n    vec2 p1 = xy / 16.0 + wind * u_time * 0.12;\n    vec2 p2 = xy / 32.0 - wind.yx * u_time * 0.05;\n    float h = gfsr_fbm2(p1, vec2(256.0), 4) * 0.6;\n    h += gfsr_fbm2(p2, vec2(128.0), 3) * 0.4;\n    return h;\n}\n\nvec3 waveNormal(vec2 xy, float amp)\n{\n    float e = 0.6;\n    float h = waveHeight(xy);\n    float hx = waveHeight(xy + vec2(e, 0.0));\n    float hy = waveHeight(xy + vec2(0.0, e));\n    vec3 n = vec3(-(hx - h) / e * amp, -(hy - h) / e * amp, 1.0);\n    return normalize(n);\n}\n\nfloat colourVariance(vec2 uv, vec3 centre)\n{\n    vec3 a = texture2D(colorTexture, uv + vec2(u_texel.x * 2.0, 0.0)).rgb;\n    vec3 b = texture2D(colorTexture, uv - vec2(u_texel.x * 2.0, 0.0)).rgb;\n    vec3 c = texture2D(colorTexture, uv + vec2(0.0, u_texel.y * 2.0)).rgb;\n    vec3 d = texture2D(colorTexture, uv - vec2(0.0, u_texel.y * 2.0)).rgb;\n    vec3 m = (a + b + c + d + centre) * 0.2;\n    vec3 v = (a - m) * (a - m) + (b - m) * (b - m) + (c - m) * (c - m) + (d - m) * (d - m) + (centre - m) * (centre - m);\n    return dot(v, vec3(0.333)) * 0.2;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    vec3 pEnu = u_eyeToEnu * pEC;\n    float dist = length(pEC);\n    float horiz2 = dot(pEnu.xy, pEnu.xy);\n    float alt = u_camHeight + pEnu.z + horiz2 / (2.0 * EARTH_R);\n\n    float altMask = 1.0 - smoothstep(u_waterTolerance * 0.6, u_waterTolerance, abs(alt));\n    if (altMask <= 0.0) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 nEnu = normalize(u_eyeToEnu * gfsr_normalEC(depthTexture, uv, u_texel, pEC));\n    // Depth precision degrades with distance; trust the normal less far away.\n    float flatTrust = 1.0 - smoothstep(3000.0, 25000.0, dist);\n    float flatMask = mix(1.0, smoothstep(0.93, 0.985, nEnu.z), flatTrust);\n\n    vec3 c = src.rgb;\n    float blueish = smoothstep(-0.02, 0.06, c.b - c.r) * smoothstep(-0.08, 0.02, c.b - c.g + 0.04);\n    float darkish = 1.0 - smoothstep(0.18, 0.4, gfsr_luma(c));\n    float colourMask = max(blueish, darkish * 0.8);\n    float smoothMask = 1.0 - smoothstep(0.0008, 0.004, colourVariance(uv, c));\n\n    float mask = altMask * flatMask * colourMask * mix(1.0, smoothMask, 0.7);\n    if (mask <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    vec3 viewDir = normalize(pEnu);\n    vec3 V = -viewDir;\n    float day = smoothstep(-0.1, 0.05, sunDir.z);\n    float fade = 1.0 - smoothstep(u_fadeDistance * 0.25, u_fadeDistance, dist);\n\n    // Wave normals in world space (camera-anchored xy + wrapped camera motion).\n    vec2 wxy = pEnu.xy + u_worldOffset;\n    float storm = u_weather.y;\n    float amp = u_waveStrength * (0.35 + storm * 0.65) * (0.25 + 0.75 * fade);\n    vec3 N = normalize(mix(vec3(0.0, 0.0, 1.0), waveNormal(wxy, amp), fade * 0.85 + 0.15));\n\n    float NdotV = max(dot(N, V), 0.0);\n    float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);\n\n    // Sky reflection.\n    vec3 R = reflect(viewDir, N);\n    R.z = max(R.z, 0.015);\n    R = normalize(R);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float mie = u_mie * (1.0 + u_weather.x * 1.5);\n    vec3 skyL;\n    vec3 skyT;\n    gfsr_scatter(camHKm, R, sunDir, 1.0e9, u_rayleigh, mie, 0.6, 8.0, skyL, skyT);\n    vec3 skyRefl = 1.0 - exp(-skyL);\n    float overcast = u_weather.x;\n    skyRefl = mix(skyRefl, vec3(gfsr_luma(skyRefl)) * vec3(0.9, 0.95, 1.0), overcast * 0.8);\n    skyRefl *= mix(0.15, 1.0, day);\n\n    // Deep water colouring.\n    vec3 base = gfsr_toLinear(c);\n    vec3 deep = gfsr_toLinear(u_deepColor) * (0.25 + 0.75 * day);\n    float deepAmt = u_deepStrength * (0.55 + 0.45 * NdotV);\n    vec3 water = mix(base, deep, deepAmt);\n    water = mix(water, skyRefl, fresnel);\n\n    // Sun specular highlight + glitter path.\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);\n    vec3 H = normalize(V + sunDir);\n    float NdotH = max(dot(N, H), 0.0);\n    float spec = pow(NdotH, 900.0) * 18.0 + pow(NdotH, 120.0) * 1.2;\n    float glitter = pow(max(dot(R, sunDir), 0.0), 350.0) * 6.0;\n    vec3 sunLight = sunT * (spec * u_specular + glitter * u_sunReflection) * day * (1.0 - overcast * 0.85);\n    water += sunLight * (0.3 + 0.7 * fresnel + 0.5);\n\n    // Distance fade: far water returns to the engine colour + aerial perspective.\n    vec3 outLin = mix(base, water, mask * mix(0.4, 1.0, fade));\n    outLin = outLin / (1.0 + max(outLin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n"
    };
    // <<<GFSR:END shaders>>>

    // <<<GFSR:BUILD presets>>>
    NS.presets = {
        "high": {
            "name": "HIGH",
            "description": "High: every effect enabled with moderate sample counts. Recommended for dedicated GPUs.",
            "settings": {
                "hdrEnabled": true,
                "bloomEnabled": true,
                "atmosphereEnabled": true,
                "atmosphereSteps": 12,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "cloudSteps": 48,
                "cloudResolution": "0.5",
                "cloudDistance": 80000,
                "cirrusEnabled": true,
                "cloudShadows": true,
                "godraysEnabled": true,
                "godraysSamples": 48,
                "gradeEnabled": true,
                "ssaoEnabled": true,
                "ssaoSamples": 12,
                "reflectionsEnabled": true,
                "waterEnabled": true,
                "lensFlareEnabled": true,
                "streaksEnabled": true,
                "chromaticEnabled": true,
                "vignetteEnabled": true,
                "bloomRadius": 1.2
            }
        },
        "low": {
            "name": "LOW",
            "description": "Lightweight: tonemapping, color grading, fog and a cheap sky. Best for integrated GPUs.",
            "settings": {
                "hdrEnabled": true,
                "bloomEnabled": false,
                "atmosphereEnabled": true,
                "atmosphereSteps": 6,
                "fogEnabled": true,
                "cloudsEnabled": false,
                "cloudSteps": 16,
                "cloudResolution": "0.25",
                "cloudDistance": 40000,
                "cirrusEnabled": false,
                "cloudShadows": false,
                "godraysEnabled": false,
                "godraysSamples": 16,
                "gradeEnabled": true,
                "ssaoEnabled": false,
                "ssaoSamples": 6,
                "reflectionsEnabled": false,
                "waterEnabled": false,
                "lensFlareEnabled": false,
                "streaksEnabled": false,
                "chromaticEnabled": false,
                "vignetteEnabled": true,
                "bloomRadius": 1
            }
        },
        "medium": {
            "name": "MEDIUM",
            "description": "Balanced: adds bloom, volumetric clouds at low resolution, water and lens flare.",
            "settings": {
                "hdrEnabled": true,
                "bloomEnabled": true,
                "atmosphereEnabled": true,
                "atmosphereSteps": 10,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "cloudSteps": 28,
                "cloudResolution": "0.33",
                "cloudDistance": 60000,
                "cirrusEnabled": true,
                "cloudShadows": true,
                "godraysEnabled": false,
                "godraysSamples": 32,
                "gradeEnabled": true,
                "ssaoEnabled": false,
                "ssaoSamples": 8,
                "reflectionsEnabled": true,
                "waterEnabled": true,
                "lensFlareEnabled": true,
                "streaksEnabled": false,
                "chromaticEnabled": false,
                "vignetteEnabled": true,
                "bloomRadius": 1.1
            }
        },
        "ultra": {
            "name": "ULTRA",
            "description": "Ultra: maximum sample counts, full-detail clouds and long draw distance. High-end GPUs only.",
            "settings": {
                "hdrEnabled": true,
                "bloomEnabled": true,
                "atmosphereEnabled": true,
                "atmosphereSteps": 20,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "cloudSteps": 96,
                "cloudResolution": "0.75",
                "cloudDistance": 140000,
                "cirrusEnabled": true,
                "cloudShadows": true,
                "godraysEnabled": true,
                "godraysSamples": 96,
                "gradeEnabled": true,
                "ssaoEnabled": true,
                "ssaoSamples": 24,
                "reflectionsEnabled": true,
                "waterEnabled": true,
                "lensFlareEnabled": true,
                "streaksEnabled": true,
                "chromaticEnabled": true,
                "vignetteEnabled": true,
                "bloomRadius": 1.4
            }
        }
    };
    // <<<GFSR:END presets>>>

    // <<<GFSR:BUILD settings>>>
    // GeoFS-ReShade : ui/settings.js
    // Settings schema, defaults, persistence (localStorage) and preset handling.
    //
    // Exposes window.GeoFSReShade.Settings. Presets are read from
    // window.GeoFSReShade.presets (inlined from presets/*.json by build.js).

    (function (root) {
        'use strict';

        const NS = root.GeoFSReShade = root.GeoFSReShade || {};

        const STORAGE_KEY = 'gfsr.settings.v1';
        const PRESET_ORDER = ['low', 'medium', 'high', 'ultra'];

        // Control types: checkbox, range, select, color.
        // structural: true -> changing the value rebuilds the post-process pipeline.
        const SCHEMA = [
            {
                id: 'general', title: 'General', controls: [
                    { key: 'enabled', type: 'checkbox', label: 'Enable GeoFS Ultra Graphics', default: true, structural: true },
                    { key: 'preset', type: 'select', label: 'Quality preset', default: 'high', options: [
                        ['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['ultra', 'ULTRA'], ['custom', 'Custom']
                    ] },
                    { key: 'autoPerf', type: 'checkbox', label: 'Auto-disable effects on low FPS', default: true },
                    { key: 'fpsLow', type: 'range', label: 'Low FPS threshold', default: 40, min: 15, max: 60, step: 1 },
                    { key: 'fpsCritical', type: 'range', label: 'Critical FPS threshold', default: 25, min: 10, max: 45, step: 1 },
                    { key: 'hideNativeClouds', type: 'checkbox', label: 'Replace GeoFS native cloud/fog pass', default: true },
                    { key: 'modelLighting', type: 'checkbox', label: 'Boost aircraft environment lighting', default: true }
                ]
            },
            {
                id: 'hdr', title: 'HDR & Tonemapping', controls: [
                    { key: 'hdrEnabled', type: 'checkbox', label: 'HDR pipeline (ACES Filmic)', default: true, structural: true },
                    { key: 'exposure', type: 'range', label: 'HDR Exposure', default: 1.0, min: 0.2, max: 3.0, step: 0.01 },
                    { key: 'gamma', type: 'range', label: 'Gamma', default: 1.0, min: 0.6, max: 1.6, step: 0.01 },
                    { key: 'contrast', type: 'range', label: 'Contrast', default: 1.05, min: 0.5, max: 1.6, step: 0.01 },
                    { key: 'saturation', type: 'range', label: 'Saturation', default: 1.08, min: 0.0, max: 2.0, step: 0.01 }
                ]
            },
            {
                id: 'bloom', title: 'Bloom', controls: [
                    { key: 'bloomEnabled', type: 'checkbox', label: 'Bloom', default: true, structural: true },
                    { key: 'bloomIntensity', type: 'range', label: 'Bloom Intensity', default: 0.55, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'bloomRadius', type: 'range', label: 'Bloom Radius', default: 1.2, min: 0.25, max: 4.0, step: 0.05 },
                    { key: 'bloomThreshold', type: 'range', label: 'Bloom Threshold', default: 0.72, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'bloomSoftKnee', type: 'range', label: 'Soft bloom (knee)', default: 0.5, min: 0.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'atmosphere', title: 'Atmospheric Scattering', controls: [
                    { key: 'atmosphereEnabled', type: 'checkbox', label: 'Atmospheric scattering', default: true, structural: true },
                    { key: 'skyBlend', type: 'range', label: 'Sky replacement', default: 0.85, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'hazeStrength', type: 'range', label: 'Aerial haze', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'rayleigh', type: 'range', label: 'Rayleigh scattering', default: 1.0, min: 0.2, max: 3.0, step: 0.01 },
                    { key: 'mie', type: 'range', label: 'Mie scattering', default: 1.0, min: 0.1, max: 4.0, step: 0.01 },
                    { key: 'horizonGlow', type: 'range', label: 'Horizon glow', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'sunsetShift', type: 'range', label: 'Sunset colour shift', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'atmosphereSteps', type: 'range', label: 'Scattering samples', default: 12, min: 4, max: 24, step: 1 }
                ]
            },
            {
                id: 'fog', title: 'Depth Fog', controls: [
                    { key: 'fogEnabled', type: 'checkbox', label: 'Depth fog', default: true, structural: true },
                    { key: 'fogDensity', type: 'range', label: 'Density', default: 0.6, min: 0.0, max: 10.0, step: 0.05 },
                    { key: 'fogHeight', type: 'range', label: 'Height (m)', default: 1500, min: 100, max: 8000, step: 50 },
                    { key: 'fogStart', type: 'range', label: 'Distance (start, m)', default: 3000, min: 0, max: 30000, step: 100 },
                    { key: 'fogMaxDistance', type: 'range', label: 'Horizon distance (m)', default: 120000, min: 10000, max: 400000, step: 1000 },
                    { key: 'fogColor', type: 'color', label: 'Color', default: '#c3d0df' },
                    { key: 'fogSkyTint', type: 'range', label: 'Sun-lit tint', default: 0.7, min: 0.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'clouds', title: 'Volumetric Clouds', controls: [
                    { key: 'cloudsEnabled', type: 'checkbox', label: 'Volumetric clouds', default: true, structural: true },
                    { key: 'cloudType', type: 'select', label: 'Cloud type', default: 'cumulus', options: [
                        ['cirrus', 'Cirrus'], ['cumulus', 'Cumulus'], ['storm', 'Storm']
                    ] },
                    { key: 'cloudCoverage', type: 'range', label: 'Coverage', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'cloudDensity', type: 'range', label: 'Cloud Density', default: 1.0, min: 0.1, max: 3.0, step: 0.01 },
                    { key: 'cloudHeight', type: 'range', label: 'Cloud Height (base, m)', default: 1800, min: 200, max: 8000, step: 50 },
                    { key: 'cloudThickness', type: 'range', label: 'Thickness (m)', default: 1600, min: 200, max: 8000, step: 50 },
                    { key: 'cloudBrightness', type: 'range', label: 'Brightness', default: 1.0, min: 0.3, max: 2.0, step: 0.01 },
                    { key: 'cloudScale', type: 'range', label: 'Cloud size (m)', default: 2500, min: 500, max: 8000, step: 50 },
                    { key: 'cirrusEnabled', type: 'checkbox', label: 'High cirrus layer', default: true },
                    { key: 'cirrusAltitude', type: 'range', label: 'Cirrus altitude (m)', default: 9000, min: 5000, max: 13000, step: 100 },
                    { key: 'cirrusCoverage', type: 'range', label: 'Cirrus coverage', default: 0.4, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'cirrusOpacity', type: 'range', label: 'Cirrus opacity', default: 0.55, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'cloudShadows', type: 'checkbox', label: 'Cloud shadows', default: true },
                    { key: 'cloudShadowStrength', type: 'range', label: 'Shadow strength', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'cloudSteps', type: 'range', label: 'Cloud Quality (ray steps)', default: 48, min: 8, max: 128, step: 1 },
                    { key: 'cloudResolution', type: 'select', label: 'Cloud resolution', default: '0.5', structural: true, options: [
                        ['0.25', '25 %'], ['0.33', '33 %'], ['0.5', '50 %'], ['0.75', '75 %'], ['1', '100 %']
                    ] },
                    { key: 'cloudDistance', type: 'range', label: 'Draw distance (m)', default: 80000, min: 10000, max: 200000, step: 1000 },
                    { key: 'windDrift', type: 'range', label: 'Wind drift', default: 1.0, min: 0.0, max: 5.0, step: 0.05 }
                ]
            },
            {
                id: 'weather', title: 'Dynamic Weather', controls: [
                    { key: 'weatherEnabled', type: 'checkbox', label: 'Dynamic weather effects', default: true },
                    { key: 'syncWeather', type: 'checkbox', label: 'Sync with GeoFS weather', default: true },
                    { key: 'weatherIntensity', type: 'range', label: 'Effect intensity', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'manualOvercast', type: 'range', label: 'Overcast (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'manualStorm', type: 'range', label: 'Storm (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'manualPrecip', type: 'range', label: 'Precipitation (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'manualFog', type: 'range', label: 'Fog (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'godrays', title: 'God Rays', controls: [
                    { key: 'godraysEnabled', type: 'checkbox', label: 'God rays', default: true, structural: true },
                    { key: 'godraysStrength', type: 'range', label: 'Strength', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'godraysSamples', type: 'range', label: 'Samples', default: 48, min: 8, max: 128, step: 1 },
                    { key: 'godraysLength', type: 'range', label: 'Length', default: 0.85, min: 0.1, max: 1.0, step: 0.01 },
                    { key: 'godraysDecay', type: 'range', label: 'Decay', default: 0.965, min: 0.9, max: 0.995, step: 0.001 },
                    { key: 'sunGlare', type: 'range', label: 'Sun glare', default: 0.6, min: 0.0, max: 2.0, step: 0.01 }
                ]
            },
            {
                id: 'grade', title: 'Color Grading', controls: [
                    { key: 'gradeEnabled', type: 'checkbox', label: 'Color grading', default: true, structural: true },
                    { key: 'gradeMode', type: 'select', label: 'Look', default: 'msfs', options: [
                        ['realistic', 'Realistic'], ['msfs', 'MSFS'], ['dcs', 'DCS'], ['cinematic', 'Cinematic'], ['photographic', 'Photographic']
                    ] },
                    { key: 'gradeStrength', type: 'range', label: 'Strength', default: 0.8, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'gradeShadows', type: 'range', label: 'Shadows', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                    { key: 'gradeMidtones', type: 'range', label: 'Midtones', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                    { key: 'gradeHighlights', type: 'range', label: 'Highlights', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                    { key: 'gradeWarmth', type: 'range', label: 'Warm highlights', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'gradeCoolness', type: 'range', label: 'Cool shadows', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'gradeVibrance', type: 'range', label: 'Vibrance', default: 0.15, min: -1.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'ssao', title: 'Ambient Occlusion (SSAO)', controls: [
                    { key: 'ssaoEnabled', type: 'checkbox', label: 'SSAO', default: true, structural: true },
                    { key: 'ssaoRadius', type: 'range', label: 'Radius', default: 1.5, min: 0.2, max: 10.0, step: 0.1 },
                    { key: 'ssaoBias', type: 'range', label: 'Bias', default: 0.08, min: 0.0, max: 0.5, step: 0.01 },
                    { key: 'ssaoStrength', type: 'range', label: 'Strength', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'ssaoSamples', type: 'range', label: 'Samples', default: 16, min: 4, max: 32, step: 1 }
                ]
            },
            {
                id: 'reflections', title: 'Aircraft Reflections', controls: [
                    { key: 'reflectionsEnabled', type: 'checkbox', label: 'Aircraft reflections', default: true, structural: true },
                    { key: 'reflectionStrength', type: 'range', label: 'Environment reflection', default: 0.7, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'fresnelPower', type: 'range', label: 'Fresnel power', default: 5.0, min: 1.0, max: 8.0, step: 0.1 },
                    { key: 'roughness', type: 'range', label: 'Roughness', default: 0.35, min: 0.02, max: 1.0, step: 0.01 },
                    { key: 'metallic', type: 'range', label: 'Metal surfaces', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'canopyBoost', type: 'range', label: 'Canopy reflections', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'aircraftRadius', type: 'range', label: 'Aircraft size (m)', default: 22, min: 4, max: 90, step: 1 }
                ]
            },
            {
                id: 'water', title: 'Water', controls: [
                    { key: 'waterEnabled', type: 'checkbox', label: 'Water improvements', default: true, structural: true },
                    { key: 'waterSunReflection', type: 'range', label: 'Sun reflections', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'waterSpecular', type: 'range', label: 'Specular highlights', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'waterDeepColor', type: 'color', label: 'Deep water color', default: '#0a3550' },
                    { key: 'waterDeepStrength', type: 'range', label: 'Deep water coloring', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'waterWaves', type: 'range', label: 'Wave strength', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'waterFade', type: 'range', label: 'Distance fade (m)', default: 15000, min: 1000, max: 60000, step: 500 },
                    { key: 'waterTolerance', type: 'range', label: 'Sea level tolerance (m)', default: 60, min: 5, max: 200, step: 1 }
                ]
            },
            {
                id: 'lens', title: 'Lens Effects', controls: [
                    { key: 'lensFlareEnabled', type: 'checkbox', label: 'Lens flare', default: true, structural: true },
                    { key: 'flareIntensity', type: 'range', label: 'Flare intensity', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'flareGhosts', type: 'range', label: 'Ghosts', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'flareHalo', type: 'range', label: 'Halo', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'flareStarburst', type: 'range', label: 'Starburst', default: 0.7, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'streaksEnabled', type: 'checkbox', label: 'Bloom streaks', default: true, structural: true },
                    { key: 'streakIntensity', type: 'range', label: 'Streak intensity', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'chromaticEnabled', type: 'checkbox', label: 'Chromatic aberration', default: true, structural: true },
                    { key: 'chromatic', type: 'range', label: 'Aberration amount', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'vignetteEnabled', type: 'checkbox', label: 'Vignette', default: true, structural: true },
                    { key: 'vignette', type: 'range', label: 'Vignette amount', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'vignetteRadius', type: 'range', label: 'Vignette radius', default: 0.95, min: 0.3, max: 1.4, step: 0.01 },
                    { key: 'vignetteSoftness', type: 'range', label: 'Vignette softness', default: 0.6, min: 0.05, max: 1.2, step: 0.01 }
                ]
            }
        ];

        const CONTROLS = {};
        const DEFAULTS = {};
        SCHEMA.forEach(function (group) {
            group.controls.forEach(function (c) {
                CONTROLS[c.key] = c;
                DEFAULTS[c.key] = c.default;
            });
        });

        // Keys that a preset never touches (user preferences rather than quality).
        const NON_PRESET_KEYS = ['enabled', 'preset', 'autoPerf', 'fpsLow', 'fpsCritical'];

        function storageGet() {
            try {
                const raw = root.localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        }

        function storageSet(obj) {
            try {
                root.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                return true;
            } catch (e) {
                return false;
            }
        }

        function sanitize(key, value) {
            const c = CONTROLS[key];
            if (!c) {
                return undefined;
            }
            switch (c.type) {
                case 'checkbox':
                    return !!value;
                case 'range': {
                    let v = Number(value);
                    if (!isFinite(v)) {
                        v = c.default;
                    }
                    return Math.min(c.max, Math.max(c.min, v));
                }
                case 'select': {
                    const s = String(value);
                    return c.options.some(function (o) { return o[0] === s; }) ? s : c.default;
                }
                case 'color':
                    return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value).toLowerCase() : c.default;
                default:
                    return value;
            }
        }

        const listeners = [];
        let values = Object.assign({}, DEFAULTS);

        function emit(changedKeys) {
            const structural = changedKeys.some(function (k) { return CONTROLS[k] && CONTROLS[k].structural; });
            listeners.forEach(function (fn) {
                try {
                    fn(changedKeys, structural, values);
                } catch (e) {
                    console.error('[GeoFS-ReShade] settings listener failed', e);
                }
            });
        }

        function presetData(name) {
            const presets = NS.presets || {};
            return presets[name] || null;
        }

        function applyPresetValues(name) {
            const data = presetData(name);
            if (!data || !data.settings) {
                return [];
            }
            const changed = [];
            Object.keys(data.settings).forEach(function (key) {
                if (NON_PRESET_KEYS.indexOf(key) !== -1) {
                    return;
                }
                const v = sanitize(key, data.settings[key]);
                if (v !== undefined && values[key] !== v) {
                    values[key] = v;
                    changed.push(key);
                }
            });
            return changed;
        }

        const Settings = {
            STORAGE_KEY: STORAGE_KEY,
            SCHEMA: SCHEMA,
            CONTROLS: CONTROLS,
            DEFAULTS: DEFAULTS,
            PRESET_ORDER: PRESET_ORDER,

            load: function () {
                values = Object.assign({}, DEFAULTS);
                const stored = storageGet();
                if (stored && typeof stored === 'object') {
                    Object.keys(stored).forEach(function (key) {
                        const v = sanitize(key, stored[key]);
                        if (v !== undefined) {
                            values[key] = v;
                        }
                    });
                } else {
                    applyPresetValues(values.preset);
                }
                return values;
            },

            save: function () {
                return storageSet(values);
            },

            get: function (key) {
                return values[key];
            },

            all: function () {
                return values;
            },

            // Sets a single value. Any non-preset change switches the preset to "custom".
            set: function (key, value) {
                if (key === 'preset') {
                    return Settings.applyPreset(value);
                }
                const v = sanitize(key, value);
                if (v === undefined || values[key] === v) {
                    return false;
                }
                values[key] = v;
                const changed = [key];
                if (NON_PRESET_KEYS.indexOf(key) === -1 && values.preset !== 'custom') {
                    values.preset = 'custom';
                    changed.push('preset');
                }
                Settings.save();
                emit(changed);
                return true;
            },

            applyPreset: function (name) {
                const v = sanitize('preset', name);
                values.preset = v;
                const changed = ['preset'].concat(applyPresetValues(v));
                Settings.save();
                emit(changed);
                return true;
            },

            resetGroup: function (groupId) {
                const group = SCHEMA.filter(function (g) { return g.id === groupId; })[0];
                if (!group) {
                    return;
                }
                const changed = [];
                group.controls.forEach(function (c) {
                    if (values[c.key] !== c.default) {
                        values[c.key] = c.default;
                        changed.push(c.key);
                    }
                });
                if (changed.length && groupId !== 'general' && values.preset !== 'custom') {
                    values.preset = 'custom';
                    changed.push('preset');
                }
                Settings.save();
                emit(changed);
            },

            resetAll: function () {
                values = Object.assign({}, DEFAULTS);
                applyPresetValues(values.preset);
                Settings.save();
                emit(Object.keys(CONTROLS));
            },

            onChange: function (fn) {
                listeners.push(fn);
                return function () {
                    const i = listeners.indexOf(fn);
                    if (i !== -1) {
                        listeners.splice(i, 1);
                    }
                };
            }
        };

        NS.Settings = Settings;
    })(typeof window !== 'undefined' ? window : this);
    // <<<GFSR:END settings>>>

    // <<<GFSR:BUILD menu>>>
    // GeoFS-ReShade : ui/menu.js
    // In-game settings panel. Toggle with SHIFT + G.
    //
    // Builds checkboxes, sliders, dropdowns and colour pickers from the schema in
    // ui/settings.js, shows live FPS + performance state and persists every change.
    //
    // Exposes window.GeoFSReShade.Menu.

    (function (root) {
        'use strict';

        const NS = root.GeoFSReShade = root.GeoFSReShade || {};
        const doc = root.document;

        const CSS = [
            '#gfsr-panel{position:fixed;top:60px;right:20px;width:340px;max-height:calc(100vh - 90px);display:none;flex-direction:column;',
            'background:rgba(14,18,26,0.94);color:#e6ebf2;font:12px/1.35 "Segoe UI",Roboto,Arial,sans-serif;border:1px solid rgba(120,160,220,0.35);',
            'border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,0.55);z-index:2147483000;user-select:none;backdrop-filter:blur(6px);}',
            '#gfsr-panel.gfsr-open{display:flex;}',
            '#gfsr-panel *{box-sizing:border-box;}',
            '#gfsr-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;border-bottom:1px solid rgba(120,160,220,0.2);',
            'background:linear-gradient(90deg,rgba(40,80,140,0.45),rgba(20,30,50,0.2));border-radius:10px 10px 0 0;}',
            '#gfsr-title{flex:1;font-weight:600;font-size:13px;letter-spacing:0.3px;}',
            '#gfsr-fps{font-family:Consolas,monospace;font-size:12px;padding:2px 7px;border-radius:4px;background:#1d3b24;color:#8ff0a4;}',
            '#gfsr-fps.gfsr-warn{background:#47391a;color:#ffd479;}',
            '#gfsr-fps.gfsr-bad{background:#4a1d1d;color:#ff8c8c;}',
            '#gfsr-close{cursor:pointer;border:none;background:transparent;color:#b9c6d8;font-size:16px;line-height:1;padding:0 2px;}',
            '#gfsr-status{padding:6px 12px;font-size:11px;color:#9fb1c9;border-bottom:1px solid rgba(120,160,220,0.12);min-height:24px;}',
            '#gfsr-status.gfsr-error{color:#ff9a9a;}',
            '#gfsr-body{overflow-y:auto;padding:4px 0 8px 0;}',
            '#gfsr-body::-webkit-scrollbar{width:8px;}#gfsr-body::-webkit-scrollbar-thumb{background:rgba(140,170,220,0.35);border-radius:4px;}',
            '.gfsr-group{border-bottom:1px solid rgba(120,160,220,0.1);}',
            '.gfsr-ghead{display:flex;align-items:center;padding:7px 12px;cursor:pointer;font-weight:600;color:#cfe0ff;}',
            '.gfsr-ghead:hover{background:rgba(80,120,190,0.12);}',
            '.gfsr-arrow{width:14px;display:inline-block;transition:transform .15s;}',
            '.gfsr-group.gfsr-collapsed .gfsr-arrow{transform:rotate(-90deg);}',
            '.gfsr-group.gfsr-collapsed .gfsr-gbody{display:none;}',
            '.gfsr-gtitle{flex:1;}',
            '.gfsr-reset{border:1px solid rgba(140,170,220,0.3);background:transparent;color:#9fb1c9;border-radius:4px;font-size:10px;padding:1px 6px;cursor:pointer;}',
            '.gfsr-reset:hover{color:#fff;border-color:#8fb4ff;}',
            '.gfsr-gbody{padding:2px 12px 8px 26px;}',
            '.gfsr-row{display:flex;align-items:center;gap:8px;margin:5px 0;}',
            '.gfsr-row label{flex:1;color:#d3dbe6;}',
            '.gfsr-row input[type=range]{flex:1.2;accent-color:#5c9cff;height:4px;}',
            '.gfsr-row .gfsr-val{width:52px;text-align:right;font-family:Consolas,monospace;color:#9fc3ff;}',
            '.gfsr-row select{flex:1.2;background:#1b2433;color:#e6ebf2;border:1px solid rgba(140,170,220,0.3);border-radius:4px;padding:2px 4px;}',
            '.gfsr-row input[type=checkbox]{accent-color:#5c9cff;width:15px;height:15px;}',
            '.gfsr-row input[type=color]{width:44px;height:20px;border:none;background:transparent;padding:0;}',
            '.gfsr-row.gfsr-disabled{opacity:0.45;}',
            '#gfsr-foot{display:flex;gap:8px;padding:8px 12px;border-top:1px solid rgba(120,160,220,0.2);}',
            '#gfsr-foot button{flex:1;border:1px solid rgba(140,170,220,0.35);background:rgba(40,70,120,0.35);color:#e6ebf2;border-radius:5px;padding:5px;cursor:pointer;}',
            '#gfsr-foot button:hover{background:rgba(70,110,180,0.5);}',
            '#gfsr-hint{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(14,18,26,0.9);color:#cfe0ff;',
            'font:12px "Segoe UI",Roboto,Arial,sans-serif;padding:7px 14px;border-radius:6px;z-index:2147483000;pointer-events:none;',
            'transition:opacity .6s;opacity:0;}'
        ].join('');

        const COLLAPSE_KEY = 'gfsr.menu.collapsed.v1';
        const POS_KEY = 'gfsr.menu.position.v1';

        function el(tag, attrs, children) {
            const e = doc.createElement(tag);
            if (attrs) {
                Object.keys(attrs).forEach(function (k) {
                    if (k === 'className') {
                        e.className = attrs[k];
                    } else if (k === 'text') {
                        e.textContent = attrs[k];
                    } else {
                        e.setAttribute(k, attrs[k]);
                    }
                });
            }
            (children || []).forEach(function (c) {
                if (c) {
                    e.appendChild(c);
                }
            });
            return e;
        }

        function readJSON(key, fallback) {
            try {
                const raw = root.localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (e) {
                return fallback;
            }
        }

        function writeJSON(key, value) {
            try {
                root.localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                /* storage full or blocked: the menu still works for this session */
            }
        }

        function formatValue(c, v) {
            if (c.step >= 1) {
                return String(Math.round(v));
            }
            const decimals = c.step >= 0.1 ? 1 : (c.step >= 0.01 ? 2 : 3);
            return Number(v).toFixed(decimals);
        }

        const Menu = {
            panel: null,
            inputs: {},
            rows: {},
            settings: null,
            open: false,
            overrides: {},

            init: function (settings, callbacks) {
                if (Menu.panel) {
                    return Menu;
                }
                Menu.settings = settings;
                Menu.callbacks = callbacks || {};

                const style = el('style', { id: 'gfsr-style' });
                style.textContent = CSS;
                doc.head.appendChild(style);

                Menu.build();
                Menu.bindKeys();
                settings.onChange(function (changed) {
                    Menu.refresh(changed);
                });
                Menu.hint('GeoFS Ultra Graphics loaded \u2014 press SHIFT + G for settings');
                return Menu;
            },

            build: function () {
                const s = Menu.settings;
                const collapsed = readJSON(COLLAPSE_KEY, { weather: true, water: true, reflections: true, lens: true, ssao: true });

                Menu.fpsBadge = el('span', { id: 'gfsr-fps', text: '-- FPS' });
                const closeBtn = el('button', { id: 'gfsr-close', title: 'Close (SHIFT + G)', text: '\u2715' });
                closeBtn.addEventListener('click', function () { Menu.toggle(false); });
                const head = el('div', { id: 'gfsr-head' }, [
                    el('span', { id: 'gfsr-title', text: 'GeoFS Ultra Graphics' }),
                    Menu.fpsBadge,
                    closeBtn
                ]);
                Menu.statusLine = el('div', { id: 'gfsr-status', text: 'Initialising\u2026' });

                const body = el('div', { id: 'gfsr-body' });
                s.SCHEMA.forEach(function (group) {
                    const resetBtn = el('button', { className: 'gfsr-reset', title: 'Reset this section', text: 'reset' });
                    const ghead = el('div', { className: 'gfsr-ghead' }, [
                        el('span', { className: 'gfsr-arrow', text: '\u25BE' }),
                        el('span', { className: 'gfsr-gtitle', text: group.title }),
                        resetBtn
                    ]);
                    const gbody = el('div', { className: 'gfsr-gbody' });
                    const gEl = el('div', { className: 'gfsr-group' + (collapsed[group.id] ? ' gfsr-collapsed' : '') }, [ghead, gbody]);
                    ghead.addEventListener('click', function (ev) {
                        if (ev.target === resetBtn) {
                            return;
                        }
                        gEl.classList.toggle('gfsr-collapsed');
                        collapsed[group.id] = gEl.classList.contains('gfsr-collapsed');
                        writeJSON(COLLAPSE_KEY, collapsed);
                    });
                    resetBtn.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        s.resetGroup(group.id);
                    });
                    group.controls.forEach(function (c) {
                        gbody.appendChild(Menu.buildControl(c));
                    });
                    body.appendChild(gEl);
                });

                const resetAll = el('button', { text: 'Reset all' });
                resetAll.addEventListener('click', function () { s.resetAll(); });
                const reload = el('button', { text: 'Rebuild effects' });
                reload.addEventListener('click', function () {
                    if (Menu.callbacks.rebuild) {
                        Menu.callbacks.rebuild();
                    }
                });
                const foot = el('div', { id: 'gfsr-foot' }, [resetAll, reload]);

                Menu.panel = el('div', { id: 'gfsr-panel' }, [head, Menu.statusLine, body, foot]);
                Menu.hintEl = el('div', { id: 'gfsr-hint' });
                doc.body.appendChild(Menu.panel);
                doc.body.appendChild(Menu.hintEl);

                Menu.isolateInput(Menu.panel);
                Menu.makeDraggable(head);
                const pos = readJSON(POS_KEY, null);
                if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                    Menu.placeAt(pos.left, pos.top);
                }
                Menu.refresh(Object.keys(s.CONTROLS));
            },

            buildControl: function (c) {
                const s = Menu.settings;
                const id = 'gfsr-c-' + c.key;
                const label = el('label', { for: id, text: c.label });
                let input;
                let valueEl = null;

                if (c.type === 'checkbox') {
                    input = el('input', { type: 'checkbox', id: id });
                    input.addEventListener('change', function () { s.set(c.key, input.checked); });
                } else if (c.type === 'range') {
                    input = el('input', { type: 'range', id: id, min: c.min, max: c.max, step: c.step });
                    valueEl = el('span', { className: 'gfsr-val' });
                    input.addEventListener('input', function () {
                        valueEl.textContent = formatValue(c, Number(input.value));
                        s.set(c.key, Number(input.value));
                    });
                    input.addEventListener('dblclick', function () { s.set(c.key, c.default); });
                    input.title = 'Double-click to reset';
                } else if (c.type === 'select') {
                    input = el('select', { id: id });
                    c.options.forEach(function (o) {
                        input.appendChild(el('option', { value: o[0], text: o[1] }));
                    });
                    input.addEventListener('change', function () { s.set(c.key, input.value); });
                } else {
                    input = el('input', { type: 'color', id: id });
                    input.addEventListener('input', function () { s.set(c.key, input.value); });
                }

                const row = el('div', { className: 'gfsr-row' }, c.type === 'checkbox' ? [input, label] : [label, input, valueEl]);
                Menu.inputs[c.key] = { input: input, valueEl: valueEl, control: c };
                Menu.rows[c.key] = row;
                return row;
            },

            // Keep GeoFS keyboard controls from reacting while the user edits values.
            isolateInput: function (node) {
                ['keydown', 'keyup', 'keypress'].forEach(function (type) {
                    node.addEventListener(type, function (ev) {
                        const isToggle = type === 'keydown' && ev.shiftKey && (ev.code === 'KeyG' || ev.key === 'G' || ev.key === 'g');
                        if (!isToggle) {
                            ev.stopPropagation();
                        }
                    });
                });
                ['mousedown', 'wheel', 'pointerdown', 'contextmenu'].forEach(function (type) {
                    node.addEventListener(type, function (ev) { ev.stopPropagation(); }, { passive: true });
                });
            },

            bindKeys: function () {
                root.addEventListener('keydown', function (ev) {
                    if (!ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) {
                        return;
                    }
                    if (ev.code !== 'KeyG' && ev.key !== 'G' && ev.key !== 'g') {
                        return;
                    }
                    const t = ev.target;
                    const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
                    const editing = (tag === 'input' && t.type !== 'range' && t.type !== 'checkbox' && t.type !== 'color') ||
                        tag === 'textarea' || (t && t.isContentEditable);
                    if (editing && !(Menu.panel && Menu.panel.contains(t))) {
                        return;
                    }
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                    Menu.toggle();
                }, true);
            },

            toggle: function (force) {
                Menu.open = typeof force === 'boolean' ? force : !Menu.open;
                Menu.panel.classList.toggle('gfsr-open', Menu.open);
                if (Menu.open) {
                    Menu.refresh(Object.keys(Menu.settings.CONTROLS));
                    Menu.keepOnScreen();
                }
            },

            placeAt: function (left, top) {
                Menu.panel.style.left = left + 'px';
                Menu.panel.style.top = top + 'px';
                Menu.panel.style.right = 'auto';
            },

            keepOnScreen: function () {
                const r = Menu.panel.getBoundingClientRect();
                if (r.width === 0) {
                    return;
                }
                const maxL = root.innerWidth - Math.min(r.width, 120);
                const maxT = root.innerHeight - 40;
                if (r.left < 0 || r.top < 0 || r.left > maxL || r.top > maxT) {
                    Menu.placeAt(Math.max(0, Math.min(r.left, maxL)), Math.max(0, Math.min(r.top, maxT)));
                }
            },

            makeDraggable: function (handle) {
                let dragging = false;
                let ox = 0;
                let oy = 0;
                handle.addEventListener('mousedown', function (ev) {
                    if (ev.button !== 0 || ev.target.id === 'gfsr-close') {
                        return;
                    }
                    const r = Menu.panel.getBoundingClientRect();
                    dragging = true;
                    ox = ev.clientX - r.left;
                    oy = ev.clientY - r.top;
                    ev.preventDefault();
                });
                root.addEventListener('mousemove', function (ev) {
                    if (!dragging) {
                        return;
                    }
                    const left = Math.max(0, Math.min(root.innerWidth - 60, ev.clientX - ox));
                    const top = Math.max(0, Math.min(root.innerHeight - 30, ev.clientY - oy));
                    Menu.placeAt(left, top);
                });
                root.addEventListener('mouseup', function () {
                    if (!dragging) {
                        return;
                    }
                    dragging = false;
                    const r = Menu.panel.getBoundingClientRect();
                    writeJSON(POS_KEY, { left: Math.round(r.left), top: Math.round(r.top) });
                });
            },

            refresh: function (keys) {
                const s = Menu.settings;
                (keys || []).forEach(function (key) {
                    const entry = Menu.inputs[key];
                    if (!entry) {
                        return;
                    }
                    const v = s.get(key);
                    const c = entry.control;
                    if (c.type === 'checkbox') {
                        entry.input.checked = !!v;
                    } else if (c.type === 'range') {
                        if (doc.activeElement !== entry.input) {
                            entry.input.value = v;
                        }
                        entry.valueEl.textContent = formatValue(c, v);
                    } else {
                        entry.input.value = v;
                    }
                });
                Menu.applyOverrides(Menu.overrides);
            },

            // Greys out controls of effects that the performance system disabled.
            applyOverrides: function (overrides) {
                Menu.overrides = overrides || {};
                Object.keys(Menu.rows).forEach(function (key) {
                    Menu.rows[key].classList.toggle('gfsr-disabled', !!Menu.overrides[key]);
                    Menu.rows[key].title = Menu.overrides[key] ? 'Temporarily disabled by the performance system' : '';
                });
            },

            setFps: function (fps, level) {
                if (!Menu.fpsBadge) {
                    return;
                }
                Menu.fpsBadge.textContent = (isFinite(fps) ? fps.toFixed(0) : '--') + ' FPS';
                Menu.fpsBadge.classList.toggle('gfsr-warn', level === 1);
                Menu.fpsBadge.classList.toggle('gfsr-bad', level >= 2);
            },

            setStatus: function (text, isError) {
                if (!Menu.statusLine) {
                    return;
                }
                Menu.statusLine.textContent = text;
                Menu.statusLine.classList.toggle('gfsr-error', !!isError);
            },

            hint: function (text) {
                if (!Menu.hintEl) {
                    return;
                }
                Menu.hintEl.textContent = text;
                Menu.hintEl.style.opacity = '1';
                clearTimeout(Menu.hintTimer);
                Menu.hintTimer = setTimeout(function () {
                    Menu.hintEl.style.opacity = '0';
                }, 4500);
            }
        };

        NS.Menu = Menu;
    })(typeof window !== 'undefined' ? window : this);
    // <<<GFSR:END menu>>>

    // =====================================================================
    // Constants
    // =====================================================================

    const GRADE_MODES = { realistic: 0, msfs: 1, dcs: 2, cinematic: 3, photographic: 4 };
    const CLOUD_TYPES = { cirrus: 0, cumulus: 1, storm: 2 };
    const CLOUD_PERIOD_CELLS = 64;      // must match CLOUD_PERIOD in clouds.glsl
    const WATER_WRAP_METRES = 4096;     // 256 cells * 16 m (water.glsl)
    const TELEPORT_METRES = 20000;
    const PERF_WINDOW_MS = 3000;
    const PERF_COOLDOWN_MS = 4000;
    const PERF_RECOVER_MARGIN = 8;

    // =====================================================================
    // Shader library: parses "// @program" sections and adapts the GLSL
    // dialect to the running Cesium version.
    // =====================================================================

    function parseVersion(v) {
        const m = String(v || '').match(/^(\d+)\.(\d+)/);
        return m ? { major: Number(m[1]), minor: Number(m[2]) } : { major: 1, minor: 0 };
    }

    function usesModernGLSL(Cesium) {
        const v = parseVersion(Cesium.VERSION);
        return v.major > 1 || (v.major === 1 && v.minor >= 102);
    }

    function ShaderLibrary(sources, modern) {
        this.modern = modern;
        this.common = sources.common || '';
        this.programs = {};
        const self = this;
        Object.keys(sources).forEach(function (file) {
            if (file === 'common') {
                return;
            }
            const text = sources[file];
            const re = /^[ \t]*\/\/[ \t]*@program[ \t]+([A-Za-z0-9_]+)[ \t]*$/mg;
            const marks = [];
            let m;
            while ((m = re.exec(text)) !== null) {
                marks.push({ name: m[1], start: m.index, bodyStart: re.lastIndex });
            }
            if (!marks.length) {
                return;
            }
            const prelude = text.slice(0, marks[0].start);
            marks.forEach(function (mark, i) {
                const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
                self.programs[mark.name] = prelude + '\n' + text.slice(mark.bodyStart, end);
            });
        });
    }

    ShaderLibrary.prototype.get = function (name) {
        const body = this.programs[name];
        if (!body) {
            throw new Error('Unknown shader program: ' + name);
        }
        let src = this.common + '\n' + body;
        if (this.modern) {
            src = src
                .replace(/\bvarying\s+vec2\s+v_textureCoordinates\s*;/g, 'in vec2 v_textureCoordinates;')
                .replace(/\btexture2D\s*\(/g, 'texture(')
                .replace(/\bgl_FragColor\b/g, 'out_FragColor');
        }
        return src;
    };

    // =====================================================================
    // Helpers
    // =====================================================================

    function clamp(x, a, b) {
        return Math.min(b, Math.max(a, x));
    }

    function hexToColor(Cesium, hex, out) {
        const n = parseInt(String(hex).slice(1), 16);
        out.x = ((n >> 16) & 255) / 255;
        out.y = ((n >> 8) & 255) / 255;
        out.z = (n & 255) / 255;
        return out;
    }

    function wrap(v, period) {
        return ((v % period) + period) % period;
    }

    function safe(fn, fallback) {
        try {
            return fn();
        } catch (e) {
            return fallback;
        }
    }

    // =====================================================================
    // Frame state shared by all uniforms (updated in scene.preRender)
    // =====================================================================

    function FrameState(Cesium) {
        this.eyeToEnu = new Cesium.Matrix3();
        this.camHeight = 1000;
        this.time = 0;
        this.cloudOffset = new Cesium.Cartesian2();
        this.worldOffset = new Cesium.Cartesian2();
        this.weather = new Cesium.Cartesian4();
        this.texel = new Cesium.Cartesian2(1 / 1920, 1 / 1080);
        this.width = 1920;
        this.height = 1080;
        this.aspect = 16 / 9;
        this.aircraftDistance = -1;
        this.cloudBase = 1800;
        this.cloudThickness = 1600;
        this.cloudCoverage = 0.45;
        this.cloudType = 1;
        this.fogColor = new Cesium.Cartesian3(0.76, 0.82, 0.87);
        this.deepColor = new Cesium.Cartesian3(0.04, 0.2, 0.31);
        this.dims = {};
        this.texels = {};

        this._prevPos = undefined;
        this._prevTime = undefined;
        this._camOffset = new Cesium.Cartesian2();
        this._waterOffset = new Cesium.Cartesian2();
        this._enu = new Cesium.Matrix4();
        this._enu3 = new Cesium.Matrix3();
        this._view3 = new Cesium.Matrix3();
        this._delta = new Cesium.Cartesian3();
        this._col = new Cesium.Cartesian3();
        this._acPos = new Cesium.Cartesian3();
    }

    // Size of a Cesium post-process target created with the given textureScale.
    FrameState.prototype.dimsFor = function (scale) {
        const key = String(scale);
        let d = this.dims[key];
        if (!d) {
            d = this.dims[key] = new window.Cesium.Cartesian2();
        }
        d.x = Math.max(1, Math.ceil(this.width * scale));
        d.y = Math.max(1, Math.ceil(this.height * scale));
        return d;
    };

    FrameState.prototype.texelFor = function (scale) {
        const key = String(scale);
        let t = this.texels[key];
        if (!t) {
            t = this.texels[key] = new window.Cesium.Cartesian2();
        }
        const d = this.dimsFor(scale);
        t.x = 1 / d.x;
        t.y = 1 / d.y;
        return t;
    };

    // =====================================================================
    // GeoFS integration: weather, aircraft, native effects, model lighting
    // =====================================================================

    const GeoFSBridge = {
        weatherDefinition: function () {
            const w = window.weather || (window.geofs && window.geofs.weather);
            return w && w.definition ? w.definition : null;
        },

        // Returns { overcast, storm, precip, fog, base, top, cover, windDir, windSpeed, thunder }.
        readWeather: function () {
            const d = GeoFSBridge.weatherDefinition();
            if (!d) {
                return null;
            }
            const num = function (v, f) {
                const n = Number(v);
                return isFinite(n) ? n : f;
            };
            const cover = clamp(num(d.cloudCover, 0) / 100, 0, 1);
            const precip = clamp(num(d.precipitationAmount, 0) / 100, 0, 1);
            const thunder = !!d.thunderstorm;
            const visibility = num(d.visibility, 0);
            let fog = clamp(num(d.fogDensity, 0) / 100, 0, 1);
            if (visibility > 0 && visibility < 10000) {
                fog = Math.max(fog, clamp(1 - visibility / 10000, 0, 1));
            }
            return {
                cover: cover,
                overcast: clamp((cover - 0.35) / 0.65, 0, 1),
                storm: thunder ? 1 : clamp(precip * cover * 1.2, 0, 1),
                precip: precip,
                fog: fog,
                base: num(d.cloudBase, 0),
                top: num(d.cloudTop, 0),
                windDir: num(d.windDirection, 0),
                windSpeed: num(d.windSpeedMS, num(d.windSpeed, 0)),
                thunder: thunder
            };
        },

        aircraftLLA: function () {
            const inst = safe(function () { return window.geofs.aircraft.instance; }, null);
            const lla = inst && inst.llaLocation;
            if (lla && isFinite(lla[0]) && isFinite(lla[1]) && isFinite(lla[2])) {
                return lla;
            }
            return null;
        },

        cameraMode: function () {
            return safe(function () { return window.geofs.camera.currentModeName; }, '');
        },

        nativeStages: function () {
            const a = safe(function () { return window.geofs.fx.atmosphere.postProcessingStages; }, null);
            if (!a) {
                return [];
            }
            return Array.isArray(a) ? a : [a];
        }
    };

    // Temporarily disables GeoFS' own cloud/fog post-process pass while ours runs.
    const NativeOverride = {
        saved: new WeakMap(),
        active: [],

        apply: function (wantHidden) {
            const stages = GeoFSBridge.nativeStages();
            if (wantHidden) {
                stages.forEach(function (s) {
                    if (!s || typeof s.enabled === 'undefined') {
                        return;
                    }
                    if (!NativeOverride.saved.has(s)) {
                        NativeOverride.saved.set(s, s.enabled);
                        NativeOverride.active.push(s);
                    }
                    if (s.enabled) {
                        s.enabled = false;
                    }
                });
            } else {
                NativeOverride.restore();
            }
        },

        restore: function () {
            NativeOverride.active.forEach(function (s) {
                if (NativeOverride.saved.has(s)) {
                    safe(function () {
                        if (!s.isDestroyed || !s.isDestroyed()) {
                            s.enabled = NativeOverride.saved.get(s);
                        }
                    });
                    NativeOverride.saved.delete(s);
                }
            });
            NativeOverride.active.length = 0;
        }
    };

    // Cesium only keeps globe depth in the post-process depth texture when
    // depthTestAgainstTerrain is on; otherwise fog, SSAO, clouds and water read
    // the far depth plane and reconstruct distances that are far too large.
    const DepthOverride = {
        globe: null,
        original: null,

        apply: function (scene, want) {
            const globe = scene && scene.globe;
            if (!want || !globe) {
                DepthOverride.restore();
                return;
            }
            if (DepthOverride.globe !== globe) {
                DepthOverride.restore();
                DepthOverride.globe = globe;
                DepthOverride.original = !!globe.depthTestAgainstTerrain;
            }
            if (!globe.depthTestAgainstTerrain) {
                globe.depthTestAgainstTerrain = true;
            }
        },

        restore: function () {
            const globe = DepthOverride.globe;
            if (globe) {
                const original = DepthOverride.original;
                safe(function () {
                    if (!globe.isDestroyed || !globe.isDestroyed()) {
                        globe.depthTestAgainstTerrain = original;
                    }
                });
            }
            DepthOverride.globe = null;
            DepthOverride.original = null;
        }
    };

    // Brightens image based lighting on glTF models (aircraft) so the in-engine
    // PBR shading agrees with the post-process reflections.
    const ModelLighting = {
        saved: new WeakMap(),
        touched: [],

        forEachModel: function (Cesium, collection, fn, depth) {
            if (!collection || depth > 4) {
                return;
            }
            const n = typeof collection.length === 'number' ? collection.length : 0;
            for (let i = 0; i < n; i++) {
                const p = safe(function () { return collection.get(i); }, null);
                if (!p) {
                    continue;
                }
                if ((Cesium.Model && p instanceof Cesium.Model) || (p.gltf !== undefined && p.imageBasedLighting !== undefined)) {
                    fn(p);
                } else if (typeof p.get === 'function' && typeof p.length === 'number') {
                    ModelLighting.forEachModel(Cesium, p, fn, depth + 1);
                }
            }
        },

        apply: function (Cesium, scene, enabled) {
            if (!enabled) {
                ModelLighting.restore(Cesium);
                return;
            }
            ModelLighting.forEachModel(Cesium, scene.primitives, function (model) {
                if (ModelLighting.saved.has(model)) {
                    return;
                }
                const ibl = model.imageBasedLighting;
                const target = ibl || model;
                const orig = {
                    target: target,
                    factor: target.imageBasedLightingFactor ? Cesium.Cartesian2.clone(target.imageBasedLightingFactor) : undefined,
                    luminance: target.luminanceAtZenith
                };
                safe(function () {
                    if (orig.factor) {
                        target.imageBasedLightingFactor = new Cesium.Cartesian2(1.0, 1.0);
                    }
                    if (typeof orig.luminance === 'number') {
                        target.luminanceAtZenith = Math.max(orig.luminance, 0.55);
                    }
                });
                ModelLighting.saved.set(model, orig);
                ModelLighting.touched.push(model);
            }, 0);
        },

        restore: function (Cesium) {
            ModelLighting.touched.forEach(function (model) {
                const orig = ModelLighting.saved.get(model);
                if (!orig) {
                    return;
                }
                safe(function () {
                    if (model.isDestroyed && model.isDestroyed()) {
                        return;
                    }
                    if (orig.factor) {
                        orig.target.imageBasedLightingFactor = Cesium.Cartesian2.clone(orig.factor);
                    }
                    if (typeof orig.luminance === 'number') {
                        orig.target.luminanceAtZenith = orig.luminance;
                    }
                });
                ModelLighting.saved.delete(model);
            });
            ModelLighting.touched.length = 0;
        }
    };

    // =====================================================================
    // Performance monitor (auto-disable)
    // =====================================================================

    function PerfMonitor() {
        this.samples = [];
        this.last = 0;
        this.fps = NaN;
        this.level = 0;
        this.lastChange = 0;
    }

    PerfMonitor.prototype.tick = function (now, onDemand) {
        if (this.last) {
            const dt = now - this.last;
            // In request-render mode, gaps over half a second mean the scene was idle.
            if (dt > 0 && dt < (onDemand ? 500 : 5000)) {
                this.samples.push({ t: now, dt: dt });
            }
        }
        this.last = now;
        while (this.samples.length && now - this.samples[0].t > PERF_WINDOW_MS) {
            this.samples.shift();
        }
    };

    PerfMonitor.prototype.compute = function () {
        if (this.samples.length < 4) {
            return this.fps;
        }
        let sum = 0;
        for (let i = 0; i < this.samples.length; i++) {
            sum += this.samples[i].dt;
        }
        this.fps = 1000 / (sum / this.samples.length);
        return this.fps;
    };

    // Returns true when the level changed.
    PerfMonitor.prototype.evaluate = function (now, s) {
        const fps = this.compute();
        if (!s.autoPerf) {
            const changed = this.level !== 0;
            this.level = 0;
            return changed;
        }
        if (!isFinite(fps) || now - this.lastChange < PERF_COOLDOWN_MS) {
            return false;
        }
        const low = s.fpsLow;
        const critical = Math.min(s.fpsCritical, low - 1);
        let target = this.level;
        if (fps < critical) {
            target = 2;
        } else if (fps < low) {
            target = Math.max(this.level, 1);
            if (this.level === 2 && fps > critical + PERF_RECOVER_MARGIN) {
                target = 1;
            }
        } else if (fps > low + PERF_RECOVER_MARGIN) {
            target = Math.max(0, this.level - 1);
        }
        if (target !== this.level) {
            this.level = target;
            this.lastChange = now;
            this.samples.length = 0;
            return true;
        }
        return false;
    };

    // Applies the active performance overrides to a copy of the settings.
    PerfMonitor.prototype.overrides = function () {
        const o = {};
        if (this.level >= 1) {
            o.ssaoEnabled = true;
            o.godraysEnabled = true;
            o.cloudSteps = true;
        }
        if (this.level >= 2) {
            o.bloomEnabled = true;
            o.cloudsEnabled = true;
        }
        return o;
    };

    // =====================================================================
    // Pipeline
    // =====================================================================

    function Plugin(Cesium, viewer) {
        this.Cesium = Cesium;
        this.viewer = viewer;
        this.scene = viewer.scene;
        this.settings = NS.Settings;
        this.menu = NS.Menu;
        this.lib = new ShaderLibrary(NS.shaderSources, usesModernGLSL(Cesium));
        this.frame = new FrameState(Cesium);
        this.perf = new PerfMonitor();
        this.eff = {};
        this.master = null;
        this.signature = '';
        this.gen = 0;
        this.failed = false;
        this.lastError = '';
        this.stageCount = 0;
    }

    Plugin.prototype.start = function () {
        const self = this;
        const scene = this.scene;

        this.settings.load();
        this.computeEffective();
        this.menu.init(this.settings, {
            rebuild: function () {
                self.failed = false;
                self.rebuild(true);
            }
        });

        this.settings.onChange(function (changed, structural) {
            self.computeEffective();
            if (structural || changed.indexOf('cloudResolution') !== -1) {
                self.rebuild(false);
            }
            self.applyIntegrations();
            self.requestRender();
        });

        scene.preRender.addEventListener(function () {
            self.updateFrame();
        });
        scene.postRender.addEventListener(function () {
            self.perf.tick(performance.now(), !!scene.requestRenderMode);
        });
        scene.renderError.addEventListener(function (sc, error) {
            self.onRenderError(error);
        });

        this.rebuild(true);
        this.applyIntegrations();

        this.maintenanceTimer = setInterval(function () {
            self.maintain();
        }, 1000);

        log('initialised (Cesium ' + this.Cesium.VERSION + ', ' + (this.lib.modern ? 'GLSL 300' : 'GLSL 100') + ')');
    };

    Plugin.prototype.requestRender = function () {
        safe(function () { this.scene.requestRender(); }.bind(this));
    };

    Plugin.prototype.computeEffective = function () {
        const s = this.settings.all();
        const e = Object.assign({}, s);
        const o = this.perf.overrides();
        if (o.ssaoEnabled) {
            e.ssaoEnabled = false;
        }
        if (o.godraysEnabled) {
            e.godraysEnabled = false;
        }
        if (o.cloudSteps) {
            e.cloudSteps = Math.min(e.cloudSteps, 16);
            e.cloudShadows = false;
        }
        if (o.bloomEnabled) {
            e.bloomEnabled = false;
            e.streaksEnabled = false;
        }
        if (o.cloudsEnabled) {
            e.cloudsEnabled = false;
        }
        this.eff = e;
        this.overrides = o;
        this.menu.applyOverrides(o);
    };

    Plugin.prototype.structureSignature = function () {
        const e = this.eff;
        if (!e.enabled || this.failed) {
            return 'off';
        }
        return [
            e.ssaoEnabled, e.waterEnabled, e.reflectionsEnabled, e.atmosphereEnabled, e.fogEnabled,
            e.cloudsEnabled, e.cloudResolution, e.godraysEnabled, e.bloomEnabled, e.streaksEnabled,
            e.lensFlareEnabled, e.hdrEnabled, e.gradeEnabled, e.chromaticEnabled, e.vignetteEnabled
        ].join('|');
    };

    Plugin.prototype.teardown = function () {
        if (this.master) {
            const collection = this.scene.postProcessStages;
            const master = this.master;
            this.master = null;
            safe(function () {
                if (collection.contains(master)) {
                    collection.remove(master);
                } else if (!master.isDestroyed()) {
                    master.destroy();
                }
            });
        }
        this.signature = 'off';
        this.stageCount = 0;
    };

    Plugin.prototype.rebuild = function (force) {
        const sig = this.structureSignature();
        if (!force && sig === this.signature && (sig === 'off' || this.master)) {
            return;
        }
        this.teardown();
        this.signature = sig;
        if (sig === 'off') {
            this.updateStatus();
            this.requestRender();
            return;
        }
        try {
            const stages = this.createStages();
            if (!stages.length) {
                this.updateStatus();
                return;
            }
            this.gen++;
            this.master = new this.Cesium.PostProcessStageComposite({
                name: 'gfsr' + this.gen + '_master',
                stages: stages,
                inputPreviousStageTexture: true
            });
            this.scene.postProcessStages.add(this.master);
            this.updateStatus();
        } catch (err) {
            this.onRenderError(err);
        }
        this.requestRender();
    };

    Plugin.prototype.createStages = function () {
        const C = this.Cesium;
        const self = this;
        const lib = this.lib;
        const F = this.frame;
        const gen = this.gen + 1;
        const e = this.eff;
        let count = 0;
        const eff = function () { return self.eff; };

        const name = function (id) { return 'gfsr' + gen + '_' + id; };
        const stage = function (id, program, uniforms, opts) {
            opts = opts || {};
            count++;
            return new C.PostProcessStage({
                name: name(id),
                fragmentShader: lib.get(program),
                uniforms: uniforms || {},
                textureScale: opts.scale || 1.0,
                sampleMode: opts.linear ? C.PostProcessStageSampleMode.LINEAR : C.PostProcessStageSampleMode.NEAREST
            });
        };
        const composite = function (id, stages, chain) {
            return new C.PostProcessStageComposite({
                name: name(id),
                stages: stages,
                inputPreviousStageTexture: chain
            });
        };

        // Shared uniform getters.
        const U = {
            eyeToEnu: function () { return F.eyeToEnu; },
            camHeight: function () { return F.camHeight; },
            time: function () { return F.time; },
            weather: function () { return F.weather; },
            texel: function () { return F.texelFor(1); },
            aspect: function () { return F.aspect; },
            rayleigh: function () { return eff().rayleigh; },
            mie: function () { return eff().mie; }
        };

        const list = [];

        // 1. SSAO
        if (e.ssaoEnabled) {
            const genAo = stage('ssao_gen', 'ssao_generate', {
                u_texel: U.texel,
                u_radius: function () { return eff().ssaoRadius; },
                u_bias: function () { return eff().ssaoBias; },
                u_strength: function () { return eff().ssaoStrength; },
                u_samples: function () { return eff().ssaoSamples; }
            }, { scale: 0.5 });
            const blurH = stage('ssao_blurH', 'ssao_blur', {
                u_texel: U.texel,
                u_direction: new C.Cartesian2(1, 0),
                u_sourceTexel: function () { return F.texelFor(0.5); }
            }, { scale: 0.5 });
            const blurV = stage('ssao_blurV', 'ssao_blur', {
                u_texel: U.texel,
                u_direction: new C.Cartesian2(0, 1),
                u_sourceTexel: function () { return F.texelFor(0.5); }
            }, { scale: 0.5 });
            const apply = stage('ssao_apply', 'ssao_apply', {
                u_texel: U.texel,
                u_aoTexture: name('ssao_blurV'),
                u_aoDims: function () { return F.dimsFor(0.5); }
            });
            list.push(composite('ssao', [composite('ssao_chain', [genAo, blurH, blurV], true), apply], false));
        }

        // 2. Water
        if (e.waterEnabled) {
            list.push(stage('water', 'water', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_time: U.time,
                u_worldOffset: function () { return F.worldOffset; },
                u_texel: U.texel,
                u_waterTolerance: function () { return eff().waterTolerance; },
                u_sunReflection: function () { return eff().waterSunReflection; },
                u_specular: function () { return eff().waterSpecular; },
                u_deepColor: function () { return F.deepColor; },
                u_deepStrength: function () { return eff().waterDeepStrength; },
                u_waveStrength: function () { return eff().waterWaves; },
                u_fadeDistance: function () { return eff().waterFade; },
                u_rayleigh: U.rayleigh,
                u_mie: U.mie,
                u_weather: U.weather
            }));
        }

        // 3. Aircraft reflections
        if (e.reflectionsEnabled) {
            list.push(stage('reflections', 'reflections', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_texel: U.texel,
                u_aircraftDistance: function () { return F.aircraftDistance; },
                u_aircraftRadius: function () { return eff().aircraftRadius; },
                u_strength: function () { return eff().reflectionStrength; },
                u_fresnelPower: function () { return eff().fresnelPower; },
                u_roughness: function () { return eff().roughness; },
                u_metallic: function () { return eff().metallic; },
                u_canopyBoost: function () { return eff().canopyBoost; },
                u_rayleigh: U.rayleigh,
                u_mie: U.mie,
                u_weather: U.weather
            }));
        }

        // 4. Atmospheric scattering
        if (e.atmosphereEnabled) {
            list.push(stage('atmosphere', 'atmosphere', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_skyBlend: function () { return eff().skyBlend; },
                u_hazeStrength: function () { return eff().hazeStrength; },
                u_rayleigh: U.rayleigh,
                u_mie: U.mie,
                u_horizonGlow: function () { return eff().horizonGlow; },
                u_sunsetShift: function () { return eff().sunsetShift; },
                u_steps: function () { return eff().atmosphereSteps; },
                u_weather: U.weather
            }));
        }

        // 5. Depth fog
        if (e.fogEnabled) {
            list.push(stage('fog', 'fog', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_fogDensity: function () { return eff().fogDensity; },
                u_fogHeight: function () { return eff().fogHeight; },
                u_fogStart: function () { return eff().fogStart; },
                u_fogMaxDistance: function () { return eff().fogMaxDistance; },
                u_fogColor: function () { return F.fogColor; },
                u_fogSkyTint: function () { return eff().fogSkyTint; },
                u_weather: U.weather
            }));
        }

        // 6. Volumetric clouds
        if (e.cloudsEnabled) {
            const scale = clamp(parseFloat(e.cloudResolution) || 0.5, 0.25, 1);
            const cloudLayer = new C.Cartesian4();
            const cloudParams = new C.Cartesian4();
            const cirrus = new C.Cartesian4();
            const shared = {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_time: U.time,
                u_cloudOffset: function () { return F.cloudOffset; },
                u_cloudLayer: function () {
                    const s = eff();
                    cloudLayer.x = F.cloudBase;
                    cloudLayer.y = F.cloudThickness;
                    cloudLayer.z = F.cloudCoverage;
                    cloudLayer.w = s.cloudDensity;
                    return cloudLayer;
                },
                u_cloudParams: function () {
                    const s = eff();
                    cloudParams.x = F.cloudType;
                    cloudParams.y = s.cloudScale;
                    cloudParams.z = s.cloudBrightness;
                    cloudParams.w = (s.cirrusEnabled || F.cloudType === 0) ? 1 : 0;
                    return cloudParams;
                },
                u_cirrus: function () {
                    const s = eff();
                    cirrus.x = Math.max(s.cirrusAltitude, F.cloudBase + F.cloudThickness + 500);
                    cirrus.y = F.cloudType === 0 ? Math.max(s.cirrusCoverage, F.cloudCoverage) : s.cirrusCoverage;
                    cirrus.z = s.cirrusOpacity;
                    cirrus.w = 0;
                    return cirrus;
                },
                u_weather: U.weather
            };
            const genClouds = stage('clouds_gen', 'clouds_generate', Object.assign({}, shared, {
                u_cloudSteps: function () { return eff().cloudSteps; },
                u_maxDistance: function () { return eff().cloudDistance; }
            }), { scale: scale });
            const applyClouds = stage('clouds_apply', 'clouds_apply', Object.assign({}, shared, {
                u_cloudTexture: name('clouds_gen'),
                u_cloudDims: function () { return F.dimsFor(scale); },
                u_shadowStrength: function () { return eff().cloudShadowStrength; },
                u_shadowsEnabled: function () { return eff().cloudShadows ? 1 : 0; }
            }));
            list.push(composite('clouds', [genClouds, applyClouds], false));
        }

        // 7. God rays
        if (e.godraysEnabled) {
            const mask = stage('godrays_mask', 'godrays_mask', {
                u_eyeToEnu: U.eyeToEnu,
                u_aspect: U.aspect
            }, { scale: 0.5, linear: true });
            const blur = stage('godrays_blur', 'godrays_blur', {
                u_eyeToEnu: U.eyeToEnu,
                u_aspect: U.aspect,
                u_samples: function () { return eff().godraysSamples; },
                u_length: function () { return eff().godraysLength; },
                u_decay: function () { return eff().godraysDecay; }
            }, { scale: 0.5, linear: true });
            const apply = stage('godrays_apply', 'godrays_apply', {
                u_eyeToEnu: U.eyeToEnu,
                u_aspect: U.aspect,
                u_raysTexture: name('godrays_blur'),
                u_raysDims: function () { return F.dimsFor(0.5); },
                u_strength: function () { return eff().godraysStrength; },
                u_glare: function () { return eff().sunGlare; },
                u_camHeight: U.camHeight,
                u_rayleigh: U.rayleigh,
                u_mie: U.mie,
                u_weather: U.weather
            });
            list.push(composite('godrays', [composite('godrays_chain', [mask, blur], true), apply], false));
        }

        // 8. Bloom (+ anamorphic streaks)
        if (e.bloomEnabled) {
            const radius = function () { return eff().bloomRadius; };
            const bright = stage('bloom_bright', 'bloom_bright', {
                u_srcTexel: function () { return F.texelFor(1); },
                u_threshold: function () { return eff().bloomThreshold; },
                u_knee: function () { return eff().bloomSoftKnee; }
            }, { scale: 0.5, linear: true });
            const down = stage('bloom_down', 'bloom_downsample', {
                u_srcTexel: function () { return F.texelFor(0.5); }
            }, { scale: 0.25, linear: true });
            const blurH = stage('bloom_blurH', 'bloom_blur', {
                u_srcTexel: function () { return F.texelFor(0.25); },
                u_direction: new C.Cartesian2(1, 0),
                u_radius: radius
            }, { scale: 0.25, linear: true });
            const blurV = stage('bloom_blurV', 'bloom_blur', {
                u_srcTexel: function () { return F.texelFor(0.25); },
                u_direction: new C.Cartesian2(0, 1),
                u_radius: radius
            }, { scale: 0.25, linear: true });
            const up = stage('bloom_up', 'bloom_upsample', {
                u_srcTexel: function () { return F.texelFor(0.25); },
                u_brightTexture: name('bloom_bright'),
                u_radius: radius
            }, { scale: 0.5, linear: true });
            const children = [composite('bloom_chain', [bright, down, blurH, blurV, up], true)];
            let streakName = name('bloom_up');
            let streakScale = 0.5;
            if (e.streaksEnabled) {
                const s1 = stage('bloom_streak1', 'bloom_streak', {
                    u_srcTexel: function () { return F.texelFor(0.25); },
                    u_source: name('bloom_down'),
                    u_stepScale: 1.5
                }, { scale: 0.25 });
                const s2 = stage('bloom_streak2', 'bloom_streak', {
                    u_srcTexel: function () { return F.texelFor(0.25); },
                    u_source: name('bloom_streak1'),
                    u_stepScale: 4.5
                }, { scale: 0.25 });
                children.push(composite('bloom_streaks', [s1, s2], true));
                streakName = name('bloom_streak2');
                streakScale = 0.25;
            }
            const streaksOn = !!e.streaksEnabled;
            children.push(stage('bloom_composite', 'bloom_composite', {
                u_srcTexel: function () { return F.texelFor(1); },
                u_bloomTexture: name('bloom_up'),
                u_streakTexture: streakName,
                u_bloomDims: function () { return F.dimsFor(0.5); },
                u_streakDims: function () { return F.dimsFor(streakScale); },
                u_intensity: function () { return eff().bloomIntensity; },
                u_streakIntensity: function () { return streaksOn && eff().streaksEnabled ? eff().streakIntensity : 0; }
            }));
            list.push(composite('bloom', children, false));
        }

        // 9. Lens flare
        if (e.lensFlareEnabled) {
            list.push(stage('lens_flare', 'lens_flare', {
                u_eyeToEnu: U.eyeToEnu,
                u_aspect: U.aspect,
                u_flareIntensity: function () { return eff().flareIntensity; },
                u_ghosts: function () { return eff().flareGhosts; },
                u_halo: function () { return eff().flareHalo; },
                u_starburst: function () { return eff().flareStarburst; },
                u_weather: U.weather
            }));
        }

        // 10. HDR tonemapping (ACES Filmic)
        if (e.hdrEnabled) {
            list.push(stage('tonemap', 'tonemap', {
                u_exposure: function () { return eff().exposure; },
                u_gamma: function () { return eff().gamma; },
                u_contrast: function () { return eff().contrast; },
                u_saturation: function () { return eff().saturation; }
            }));
        }

        // 11. Colour grading
        if (e.gradeEnabled) {
            list.push(stage('colorgrade', 'colorgrade', {
                u_mode: function () { return GRADE_MODES[eff().gradeMode] || 0; },
                u_strength: function () { return eff().gradeStrength; },
                u_shadows: function () { return eff().gradeShadows; },
                u_midtones: function () { return eff().gradeMidtones; },
                u_highlights: function () { return eff().gradeHighlights; },
                u_warmth: function () { return eff().gradeWarmth; },
                u_coolness: function () { return eff().gradeCoolness; },
                u_vibrance: function () { return eff().gradeVibrance; }
            }));
        }

        // 12. Chromatic aberration + vignette
        if (e.chromaticEnabled || e.vignetteEnabled) {
            list.push(stage('lens_final', 'lens_final', {
                u_aspect: U.aspect,
                u_chromatic: function () { return eff().chromaticEnabled ? eff().chromatic : 0; },
                u_vignette: function () { return eff().vignetteEnabled ? eff().vignette : 0; },
                u_vignetteRadius: function () { return eff().vignetteRadius; },
                u_vignetteSoftness: function () { return eff().vignetteSoftness; }
            }));
        }

        this.stageCount = count;
        return list;
    };

    // =====================================================================
    // Per-frame data
    // =====================================================================

    Plugin.prototype.updateFrame = function () {
        const C = this.Cesium;
        const F = this.frame;
        const scene = this.scene;
        const camera = scene.camera;
        const s = this.eff;
        if (!this.master) {
            return;
        }

        const now = performance.now();
        const dt = F._prevTime === undefined ? 0 : clamp((now - F._prevTime) / 1000, 0, 0.25);
        F._prevTime = now;
        F.time = (F.time + dt) % 3600;

        const w = scene.drawingBufferWidth || (scene.canvas && scene.canvas.width) || 1920;
        const h = scene.drawingBufferHeight || (scene.canvas && scene.canvas.height) || 1080;
        F.width = w;
        F.height = h;
        F.aspect = w / Math.max(h, 1);
        F.texel.x = 1 / w;
        F.texel.y = 1 / h;

        // Camera basis: eye space -> local East/North/Up.
        const pos = camera.positionWC;
        C.Transforms.eastNorthUpToFixedFrame(pos, scene.globe ? scene.globe.ellipsoid : C.Ellipsoid.WGS84, F._enu);
        C.Matrix4.getMatrix3(F._enu, F._enu3);
        C.Matrix4.getMatrix3(camera.inverseViewMatrix, F._view3);
        C.Matrix3.transpose(F._enu3, F._enu3);
        C.Matrix3.multiply(F._enu3, F._view3, F.eyeToEnu);
        C.Matrix4.getMatrix3(F._enu, F._enu3);

        const carto = camera.positionCartographic;
        F.camHeight = carto ? carto.height : 1000;

        // Camera motion in local metres (keeps clouds and waves world-locked).
        if (F._prevPos) {
            C.Cartesian3.subtract(pos, F._prevPos, F._delta);
            const dist = C.Cartesian3.magnitude(F._delta);
            if (dist < TELEPORT_METRES) {
                C.Matrix3.getColumn(F._enu3, 0, F._col);
                const de = C.Cartesian3.dot(F._delta, F._col);
                C.Matrix3.getColumn(F._enu3, 1, F._col);
                const dn = C.Cartesian3.dot(F._delta, F._col);
                F._camOffset.x += de;
                F._camOffset.y += dn;
                F._waterOffset.x = wrap(F._waterOffset.x + de, WATER_WRAP_METRES);
                F._waterOffset.y = wrap(F._waterOffset.y + dn, WATER_WRAP_METRES);
            }
        } else {
            F._prevPos = new C.Cartesian3();
        }
        C.Cartesian3.clone(pos, F._prevPos);

        // Weather.
        const wx = s.weatherEnabled && s.syncWeather ? GeoFSBridge.readWeather() : null;
        const k = s.weatherEnabled ? s.weatherIntensity : 0;
        if (wx) {
            F.weather.x = clamp(wx.overcast * k, 0, 1);
            F.weather.y = clamp(wx.storm * k, 0, 1);
            F.weather.z = clamp(wx.precip * k, 0, 1);
            F.weather.w = clamp(wx.fog * k, 0, 1);
        } else {
            F.weather.x = clamp(s.manualOvercast * k, 0, 1);
            F.weather.y = clamp(s.manualStorm * k, 0, 1);
            F.weather.z = clamp(s.manualPrecip * k, 0, 1);
            F.weather.w = clamp(s.manualFog * k, 0, 1);
        }

        // Cloud layer, synchronised with GeoFS weather when available.
        let type = CLOUD_TYPES[s.cloudType];
        type = type === undefined ? 1 : type;
        let base = s.cloudHeight;
        let thickness = s.cloudThickness;
        let coverage = s.cloudCoverage;
        if (wx) {
            if (wx.base > 0 && wx.top > wx.base + 100) {
                base = wx.base;
                thickness = wx.top - wx.base;
            }
            coverage = Math.max(coverage, wx.cover);
            if (wx.thunder) {
                type = 2;
            }
        }
        F.cloudBase = base;
        F.cloudThickness = thickness;
        F.cloudCoverage = clamp(coverage, 0, 1);
        F.cloudType = type;

        // Wind drift: the noise field moves downwind.
        let windE = 0;
        let windN = 0;
        if (wx && wx.windSpeed > 0) {
            const dir = wx.windDir * Math.PI / 180;
            windE = -Math.sin(dir) * wx.windSpeed;
            windN = -Math.cos(dir) * wx.windSpeed;
        } else {
            windE = 4;
            windN = 2;
        }
        F._camOffset.x -= windE * dt * s.windDrift;
        F._camOffset.y -= windN * dt * s.windDrift;
        const cloudWrap = CLOUD_PERIOD_CELLS * s.cloudScale;
        F._camOffset.x = wrap(F._camOffset.x, cloudWrap);
        F._camOffset.y = wrap(F._camOffset.y, cloudWrap);
        F.cloudOffset.x = F._camOffset.x;
        F.cloudOffset.y = F._camOffset.y;
        F.worldOffset.x = wrap(F._waterOffset.x, WATER_WRAP_METRES);
        F.worldOffset.y = wrap(F._waterOffset.y, WATER_WRAP_METRES);

        // Aircraft distance for the reflection mask.
        const lla = GeoFSBridge.aircraftLLA();
        if (lla) {
            C.Cartesian3.fromDegrees(lla[1], lla[0], lla[2], undefined, F._acPos);
            F.aircraftDistance = C.Cartesian3.distance(pos, F._acPos);
            if (GeoFSBridge.cameraMode() === 'cockpit') {
                F.aircraftDistance = Math.min(F.aircraftDistance, 1);
            }
        } else {
            F.aircraftDistance = -1;
        }

        hexToColor(C, s.fogColor, F.fogColor);
        hexToColor(C, s.waterDeepColor, F.deepColor);
    };

    // =====================================================================
    // Maintenance (1 Hz): performance, ordering, integrations, UI
    // =====================================================================

    Plugin.prototype.maintain = function () {
        const now = performance.now();
        if (this.perf.evaluate(now, this.settings.all())) {
            this.computeEffective();
            this.rebuild(false);
            this.applyIntegrations();
            const msg = ['Performance: all effects active', 'Low FPS: SSAO, god rays and cloud quality reduced',
                'Critical FPS: bloom and volumetric clouds disabled'][this.perf.level];
            this.menu.hint(msg);
        }

        // Keep our composite last so it runs after GeoFS' own stages.
        if (this.master) {
            const c = this.scene.postProcessStages;
            if (c.length && c.get(c.length - 1) !== this.master) {
                this.rebuild(true);
            }
        }

        this.applyIntegrations();
        this.menu.setFps(this.perf.fps, this.perf.level);
        this.updateStatus();
    };

    Plugin.prototype.applyIntegrations = function () {
        const e = this.eff;
        const active = !!this.master && e.enabled && !this.failed;
        DepthOverride.apply(this.scene, active);
        NativeOverride.apply(active && e.hideNativeClouds && (e.cloudsEnabled || e.fogEnabled));
        ModelLighting.apply(this.Cesium, this.scene, active && e.modelLighting && e.reflectionsEnabled);
    };

    Plugin.prototype.updateStatus = function () {
        if (this.failed) {
            this.menu.setStatus('Effects disabled after a render error: ' + this.lastError + ' \u2014 press "Rebuild effects" to retry.', true);
            return;
        }
        if (!this.eff.enabled) {
            this.menu.setStatus('Effects disabled.');
            return;
        }
        const levelText = ['', ' \u2022 auto-perf: reduced', ' \u2022 auto-perf: minimal'][this.perf.level];
        const preset = String(this.eff.preset || 'custom').toUpperCase();
        this.menu.setStatus('Preset ' + preset + ' \u2022 ' + this.stageCount + ' passes \u2022 Cesium ' + this.Cesium.VERSION + levelText);
    };

    Plugin.prototype.onRenderError = function (error) {
        if (!this.master && !(error && /gfsr/.test(String(error && (error.message || error))))) {
            return;
        }
        const msg = String((error && (error.message || error)) || 'unknown error').split('\n')[0].slice(0, 160);
        console.error(TAG, 'render error, disabling effects', error);
        this.failed = true;
        this.lastError = msg;
        this.teardown();
        DepthOverride.restore();
        NativeOverride.restore();
        ModelLighting.restore(this.Cesium);
        const viewer = this.viewer;
        setTimeout(function () {
            safe(function () { viewer.useDefaultRenderLoop = true; });
            safe(function () { viewer.scene.requestRender(); });
        }, 0);
        this.updateStatus();
        this.menu.hint('GeoFS Ultra Graphics: render error \u2014 effects disabled (see SHIFT + G)');
    };

    // =====================================================================
    // Bootstrap: wait for GeoFS and Cesium
    // =====================================================================

    function viewerReady() {
        const geofs = window.geofs;
        const Cesium = window.Cesium;
        if (!geofs || !Cesium || !geofs.api || !geofs.api.viewer) {
            return null;
        }
        const viewer = geofs.api.viewer;
        const scene = viewer.scene;
        if (!scene || !scene.postProcessStages || !scene.camera || !Cesium.PostProcessStage) {
            return null;
        }
        return { Cesium: Cesium, viewer: viewer };
    }

    function waitForGeoFS(callback) {
        const started = Date.now();
        let warned = false;
        const timer = setInterval(function () {
            const ready = viewerReady();
            if (ready) {
                clearInterval(timer);
                callback(ready.Cesium, ready.viewer);
                return;
            }
            if (!warned && Date.now() - started > 120000) {
                warned = true;
                warn('still waiting for window.geofs and window.Cesium\u2026');
            }
        }, 500);
    }

    waitForGeoFS(function (Cesium, viewer) {
        try {
            // Required by the spec: all rendering modifications go through these.
            const geofsViewer = window.geofs.api.viewer;
            const scene = geofsViewer.scene;
            if (scene !== viewer.scene) {
                warn('unexpected viewer instance');
            }
            const plugin = new Plugin(Cesium, geofsViewer);
            NS.plugin = plugin;
            plugin.start();
        } catch (err) {
            console.error(TAG, 'failed to start', err);
        }
    });
})();
