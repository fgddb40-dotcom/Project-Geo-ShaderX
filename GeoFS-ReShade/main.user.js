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
        "aero": "// GeoFS-ReShade : aero.glsl\n// Aerodynamic and propulsion effects, rendered in eye space around the user's\n// aircraft (no model edits):\n//   * afterburner plume: raymarched emissive jet with Mach (shock) diamonds,\n//     blackbody temperature gradient, turbulent mixing layer, dynamic glow\n//   * heat distortion: refractive UV shimmer behind every running jet engine\n//   * vapor cone (Prandtl-Glauert condensation) around Mach 0.95..1.05\n//   * high-G wing vapor over the upper wing surface\n//   * world-locked trails (wingtip vortices or contrails) from a CPU history\n//     of positions, rendered analytically as soft tubes\n//\n// All positions arrive from JavaScript already in eye coordinates.\n// Requires common.glsl (prepended by the loader).\n\n// @program aero\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_time;\nuniform float u_camHeight;\nuniform vec2 u_texel;\nuniform vec3 u_acEC;          // aircraft origin (eye space)\nuniform vec3 u_acFwd;         // aircraft nose direction (eye space)\nuniform vec3 u_acRight;       // aircraft right wing direction (eye space)\nuniform vec3 u_acUp;          // aircraft up direction (eye space)\nuniform vec4 u_nozzle0;       // xyz nozzle exit (eye space), w nozzle radius (m)\nuniform vec4 u_nozzle1;\nuniform vec4 u_ab;            // x afterburner 0..1, y throttle 0..1, z flight Mach, w nozzle count\nuniform vec4 u_aero;          // x vapor cone, y wing vapor, z wingspan (m), w heat haze strength\nuniform vec4 u_plume;         // x plume intensity, y plume length scale, z quality (steps), w daylight 0..1\nuniform vec4 u_trailA[16];    // newest first: xyz eye position, w intensity\nuniform vec4 u_trailB[16];\nuniform vec4 u_trailInfo;     // x point count, y base width (m), z opacity, w spread per point\nuniform vec4 u_weather;\nuniform vec4 u_moisture;\n\n// Ray / sphere: returns (tNear, tFar), tFar < 0 when missed.\nvec2 sphereHit(vec3 ro, vec3 rd, vec3 c, float r)\n{\n    vec3 oc = ro - c;\n    float b = dot(oc, rd);\n    float h = b * b - (dot(oc, oc) - r * r);\n    if (h < 0.0) {\n        return vec2(1.0, -1.0);\n    }\n    h = sqrt(h);\n    return vec2(-b - h, -b + h);\n}\n\n// ---------------------------------------------------------------------------\n// Afterburner plume\n// ---------------------------------------------------------------------------\n\n// Returns rgb emission (linear) and a = heat-haze column density.\nvec4 plume(vec3 rd, float tScene, vec4 nozzle, float jitter, float steps)\n{\n    float rn = max(nozzle.w, 0.2);\n    float D = rn * 2.0;\n    float ab = u_ab.x;\n    float dry = smoothstep(0.35, 1.0, u_ab.y);\n    vec3 axis = -u_acFwd;\n    float L = D * mix(3.0, 9.0 + 5.0 * ab, ab) * u_plume.y;\n    float hazeL = L * 1.8 + D * 4.0;\n    vec3 c = nozzle.xyz + axis * hazeL * 0.5;\n    vec2 hit = sphereHit(vec3(0.0), rd, c, hazeL * 0.5 + rn * 3.0);\n    if (hit.y <= 0.0) {\n        return vec4(0.0);\n    }\n    float t0 = max(hit.x, 0.05);\n    float t1 = min(hit.y, tScene);\n    if (t1 <= t0) {\n        return vec4(0.0);\n    }\n\n    float n = steps;\n    float dt = (t1 - t0) / n;\n    vec3 emit = vec3(0.0);\n    float haze = 0.0;\n    float spacing = D * 1.15;\n    for (int i = 0; i < 40; i++) {\n        if (float(i) >= n) {\n            break;\n        }\n        float t = t0 + (float(i) + jitter) * dt;\n        vec3 p = rd * t - nozzle.xyz;\n        float s = dot(p, axis);\n        if (s < -rn * 0.3) {\n            continue;\n        }\n        float r = length(p - axis * s);\n        float sn = s / max(L, 0.1);\n\n        // Jet spreads ~ 6 degrees half-angle past the potential core.\n        float R = rn * (1.0 + 0.11 * s / rn);\n        float flowT = u_time * 55.0;\n        vec3 q = p / D;\n        float turb = gfsr_noise3(q * 1.7 - axis * flowT * 0.35 / D + vec3(0.0, 0.0, u_time), 64.0);\n        float turb2 = gfsr_noise3(q * 4.3 - axis * flowT * 0.8 / D, 64.0);\n        float tn = turb * 0.65 + turb2 * 0.35;\n\n        // Heat haze envelope (present with dry thrust too).\n        float hr = R * (1.6 + s / hazeL * 2.0);\n        float hazeD = exp(-(r * r) / (hr * hr)) * (1.0 - smoothstep(0.0, hazeL, s)) * smoothstep(-rn * 0.3, rn, s);\n        haze += hazeD * (0.5 + tn) * dt / D;\n\n        if (ab > 0.001 && s < L) {\n            float radial = r / R;\n            float core = exp(-radial * radial * 2.4) * exp(-sn * 2.2);\n            // Turbulent mixing layer erodes the outer jet.\n            float mixL = smoothstep(0.35, 1.1, radial + (tn - 0.5) * 0.6 * (0.3 + sn));\n            core *= 1.0 - mixL * 0.85;\n\n            // Shock diamonds: periodic expansion / compression cells near the nozzle.\n            float ph = s / spacing;\n            float cell = pow(0.5 + 0.5 * cos(6.2831853 * ph - 0.6), 7.0);\n            float dia = cell * exp(-ph * 0.42) * exp(-(r * r) / (rn * rn * 0.32)) * step(0.15, ph);\n\n            float kelvin = mix(2300.0, 950.0, smoothstep(0.0, 1.0, sn)) + tn * 180.0;\n            vec3 bb = gfsr_blackbody(kelvin);\n            // Very hot core near the nozzle reads blue-violet against the orange tail.\n            vec3 hot = mix(vec3(0.62, 0.62, 1.0), bb, smoothstep(0.0, 0.35, sn));\n            vec3 diaCol = mix(vec3(0.85, 0.82, 1.0), gfsr_blackbody(3200.0), 0.4);\n            float flicker = 0.85 + 0.3 * turb2;\n            emit += (hot * core * 1.6 + diaCol * dia * 5.0) * flicker * ab * dt / D;\n        }\n    }\n    haze *= max(dry, ab);\n    return vec4(emit * u_plume.x, haze);\n}\n\n// ---------------------------------------------------------------------------\n// Vapor cone and wing vapor (participating media around the airframe)\n// ---------------------------------------------------------------------------\n\nfloat vaporDensity(vec3 p)\n{\n    vec3 q = p - u_acEC;\n    float x = dot(q, u_acFwd);\n    float y = dot(q, u_acRight);\n    float z = dot(q, u_acUp);\n    float span = max(u_aero.z, 6.0);\n    float d = 0.0;\n\n    if (u_aero.x > 0.001) {\n        // Conical shock-induced condensation shell, apex slightly ahead of the wing.\n        float x0 = span * 0.12;\n        float behind = x0 - x;\n        if (behind > 0.0 && behind < span * 0.75) {\n            float rho = length(vec2(y, z * 1.15));\n            float rc = span * 0.08 + behind * 0.95;\n            float thick = span * (0.035 + behind / span * 0.18);\n            float sh = (rho - rc) / thick;\n            float shell = exp(-sh * sh);\n            float front = smoothstep(0.0, span * 0.05, behind);\n            float back = 1.0 - smoothstep(span * 0.25, span * 0.75, behind);\n            float n = gfsr_noise3(vec3(x * 2.5 + u_time * 1.5, y * 2.5, z * 2.5) / span * 6.0, 64.0);\n            d += shell * front * back * smoothstep(0.25, 0.75, n + 0.25) * u_aero.x * 0.9;\n        }\n    }\n\n    if (u_aero.y > 0.001) {\n        // Low-pressure region over the upper wing surface, densest at the root.\n        float halfSpan = span * 0.5;\n        float ay = abs(y);\n        if (ay < halfSpan && z > -span * 0.02 && x < span * 0.12 && x > -span * 0.35) {\n            float spanw = sqrt(max(1.0 - ay / halfSpan, 0.0));\n            float chord = smoothstep(span * 0.12, span * 0.02, x) * (1.0 - smoothstep(-span * 0.15, -span * 0.35, x));\n            float height = exp(-max(z, 0.0) / (span * 0.035));\n            float n = gfsr_noise3(vec3(x * 3.0 + u_time * 6.0, y * 1.5, z * 4.0) / span * 8.0, 64.0);\n            d += spanw * chord * height * smoothstep(0.3, 0.8, n + 0.2) * u_aero.y * 1.4;\n        }\n    }\n    return d;\n}\n\nvec4 vapor(vec3 rd, float tScene, vec3 sunEC, vec3 skyLight, vec3 sunLight, float jitter)\n{\n    if (u_aero.x + u_aero.y < 0.002) {\n        return vec4(0.0);\n    }\n    float span = max(u_aero.z, 6.0);\n    vec2 hit = sphereHit(vec3(0.0), rd, u_acEC - u_acFwd * span * 0.2, span * 0.95);\n    if (hit.y <= 0.0) {\n        return vec4(0.0);\n    }\n    float t0 = max(hit.x, 0.05);\n    float t1 = min(hit.y, tScene);\n    if (t1 <= t0) {\n        return vec4(0.0);\n    }\n    const float N = 20.0;\n    float dt = (t1 - t0) / N;\n    float trans = 1.0;\n    vec3 col = vec3(0.0);\n    float cosT = dot(rd, sunEC);\n    float phase = gfsr_phaseHG(cosT, 0.75) * 0.6 + gfsr_phaseHG(cosT, -0.2) * 0.4;\n    for (int i = 0; i < 20; i++) {\n        float t = t0 + (float(i) + jitter) * dt;\n        float d = vaporDensity(rd * t);\n        if (d > 0.002) {\n            float ext = d * 0.9 / span * 12.0;\n            float a = 1.0 - exp(-ext * dt);\n            vec3 L = skyLight * 0.9 + sunLight * phase * 6.2832;\n            col += trans * a * L;\n            trans *= 1.0 - a;\n            if (trans < 0.02) {\n                break;\n            }\n        }\n    }\n    return vec4(col, 1.0 - trans);\n}\n\n// ---------------------------------------------------------------------------\n// World-locked trails (wingtip vortices / contrails)\n// ---------------------------------------------------------------------------\n\n// Closest approach between the view ray (origin 0, dir rd, t <= tMax) and a segment.\nvec3 raySegment(vec3 rd, float tMax, vec3 a, vec3 b)\n{\n    vec3 ab = b - a;\n    float abL = max(length(ab), 1e-3);\n    vec3 u = ab / abL;\n    float rdu = dot(rd, u);\n    float denom = 1.0 - rdu * rdu;\n    float ra = dot(rd, a);\n    float ua = dot(u, a);\n    float s = denom > 1e-5 ? (ua - rdu * ra) / denom : 0.0;\n    s = clamp(-s, 0.0, abL);\n    vec3 ps = a + u * s;\n    float t = clamp(dot(ps, rd), 0.0, tMax);\n    float dist = length(rd * t - ps);\n    return vec3(dist, s / abL, sqrt(max(denom, 0.0)));\n}\n\nfloat trail(vec3 rd, float tMax, vec4 pts[16])\n{\n    float count = u_trailInfo.x;\n    float acc = 0.0;\n    for (int i = 0; i < 15; i++) {\n        if (float(i + 1) >= count) {\n            break;\n        }\n        vec4 a = pts[i];\n        vec4 b = pts[i + 1];\n        if (a.w <= 0.0 && b.w <= 0.0) {\n            continue;\n        }\n        vec3 r = raySegment(rd, tMax, a.xyz, b.xyz);\n        float fi = float(i) + r.y;\n        float w = u_trailInfo.y * (1.0 + fi * u_trailInfo.w);\n        float inten = mix(a.w, b.w, r.y);\n        float core = exp(-(r.x * r.x) / (w * w));\n        // Path length through a soft tube grows at grazing angles.\n        float path = 1.77 / max(r.z, 0.15);\n        acc += core * path * inten / (1.0 + fi * u_trailInfo.w * 0.5);\n    }\n    return 1.0 - exp(-acc * u_trailInfo.z);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    vec3 rd = gfsr_viewRayEC(uv);\n    float tScene = 1.0e7;\n    if (!gfsr_isSkyDepth(raw)) {\n        tScene = length(gfsr_eyePosition(depthTexture, uv));\n    }\n\n    float jitter = gfsr_ign(gl_FragCoord.xy);\n    vec3 sunEC = normalize(czm_sunDirectionEC);\n    vec3 sunDir = normalize(u_eyeToEnu * sunEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float day = smoothstep(-0.12, 0.05, sunDir.z);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, max(sunDir.z, 0.0), 1.0, 1.0, 1.0);\n    vec3 sunLight = sunT * day * (1.0 - u_weather.x * 0.7) * 0.55;\n    vec3 skyLight = gfsr_skyApprox(vec3(0.0, 0.0, 1.0), sunDir, camHKm, u_weather.x) * 0.9 + vec3(0.004, 0.005, 0.008);\n\n    // Plumes and heat haze.\n    vec3 emit = vec3(0.0);\n    float haze = 0.0;\n    if (u_ab.w > 0.5) {\n        vec4 p0 = plume(rd, tScene, u_nozzle0, jitter, u_plume.z);\n        emit += p0.rgb;\n        haze += p0.a;\n        if (u_ab.w > 1.5) {\n            vec4 p1 = plume(rd, tScene, u_nozzle1, jitter, u_plume.z);\n            emit += p1.rgb;\n            haze += p1.a;\n        }\n    }\n\n    // Heat distortion: refract the background through the hot exhaust.\n    vec2 suv = uv;\n    // Only background seen *through* the exhaust is refracted; the airframe\n    // (anything nearer than the nozzle) is never displaced or sampled.\n    float nozzleDist = length(u_nozzle0.xyz);\n    if (haze > 0.001 && u_aero.w > 0.0 && tScene > nozzleDist + 1.0) {\n        vec2 g = vec2(gfsr_noise3(vec3(uv * 70.0, u_time * 6.0), 64.0),\n                      gfsr_noise3(vec3(uv * 70.0 + 17.0, u_time * 6.0), 64.0)) - 0.5;\n        suv = uv + g * u_texel * 7.0 * u_aero.w * min(haze, 1.0);\n        float rawS = gfsr_rawDepth(depthTexture, suv);\n        if (!gfsr_isSkyDepth(rawS) && length(gfsr_eyePosition(depthTexture, suv)) < nozzleDist + 1.0) {\n            suv = uv;\n        }\n    }\n    vec4 src = texture2D(colorTexture, suv);\n    vec3 col = gfsr_toLinear(src.rgb);\n\n    // Emission: much more visible in low light (eye adaptation), never clipped harshly.\n    float night = 1.0 - day;\n    vec3 glow = emit * mix(0.55, 2.2, night);\n    col += glow;\n\n    // Condensation media.\n    vec4 vap = vapor(rd, tScene, sunEC, skyLight, sunLight, jitter);\n    col = col * (1.0 - vap.a) + vap.rgb;\n\n    if (u_trailInfo.x >= 2.0) {\n        float ta = trail(rd, tScene, u_trailA);\n        float tb = trail(rd, tScene, u_trailB);\n        float a = 1.0 - (1.0 - ta) * (1.0 - tb);\n        float cosT = dot(rd, sunEC);\n        float ph = gfsr_phaseHG(cosT, 0.6) * 0.5 + 0.08;\n        vec3 L = skyLight * 0.95 + sunLight * ph * 6.2832;\n        col = mix(col, L, a);\n    }\n\n    col = col / (1.0 + max(col - 1.0, 0.0) * 0.6);\n    gl_FragColor = vec4(gfsr_toGamma(col), src.a);\n}\n",
        "atmosphere": "// GeoFS-ReShade : atmosphere.glsl\n// Physically based sky replacement and aerial perspective.\n//\n//   Day      : single-scatter Rayleigh + Mie + ozone integral (common.glsl),\n//              realistic luminance (deep zenith blue, pale horizon), sun disk\n//              with limb darkening, atmosphere curvature at altitude.\n//   Twilight : the same integral naturally produces the orange horizon, the\n//              Belt of Venus and the ozone-purple upper sky.\n//   Night    : moonlit Rayleigh sky, airglow, procedural star field fixed in\n//              the ICRF frame (real sidereal / seasonal motion), twinkling and\n//              extinction by airmass, Milky Way band with dust lanes, phased moon.\n//   Ground   : aerial perspective (in-scatter + extinction) driven by the\n//              distance in the depth buffer, humidity and weather.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program atmosphere\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform mat3 u_eyeToIcrf;     // eye space -> inertial (ICRF) frame for the star field\nuniform float u_camHeight;\nuniform float u_skyBlend;\nuniform float u_hazeStrength;\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform float u_horizonGlow;\nuniform float u_sunsetShift;\nuniform float u_steps;\nuniform float u_time;\nuniform float u_pixelAngle;   // radians per pixel (vertical)\nuniform vec4 u_stars;         // x star brightness, y Milky Way, z twinkle, w moon brightness\nuniform vec4 u_moisture;      // x humidity, y surface wetness, z air temperature (C), w unused\nuniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog\n\nconst vec3 GAL_NORTH = vec3(-0.86766, -0.19810, 0.45598);\nconst vec3 GAL_CENTER = vec3(-0.054877, -0.873437, -0.483835);\nconst float MOON_RADIUS = 0.00452;\n\nvec3 weatherTint(vec3 c, float overcast, float storm)\n{\n    float l = gfsr_luma(c);\n    vec3 grey = vec3(l) * vec3(0.94, 0.97, 1.0);\n    vec3 stormGrey = vec3(l) * vec3(0.60, 0.66, 0.72);\n    vec3 outc = mix(c, grey, overcast * 0.85);\n    return mix(outc, stormGrey, storm * 0.8);\n}\n\n// One layer of procedural stars. d = ICRF direction.\nvec3 starLayer(vec3 d, float scale, float prob, float seed, float pixAng, float twinkle)\n{\n    vec3 p = d * scale;\n    vec3 cell = floor(p);\n    float h = gfsr_hash13(cell + seed);\n    if (h > prob) {\n        return vec3(0.0);\n    }\n    vec3 jit = vec3(gfsr_hash13(cell + seed + 3.1), gfsr_hash13(cell + seed + 5.7), gfsr_hash13(cell + seed + 9.3)) * 0.56 + 0.22;\n    vec3 sp = normalize(cell + jit);\n    float a = length(d - sp);\n    float hb = gfsr_hash13(cell + seed + 13.7);\n    // Power-law magnitude distribution: many faint stars, few bright ones.\n    float mag = pow(hb, 9.0) * 6.0 + 0.04 + pow(hb, 2.0) * 0.08;\n    float sigma = pixAng * (0.65 + 0.5 * pow(hb, 6.0));\n    float g = exp(-(a * a) / (sigma * sigma));\n    // Most naked-eye stars are white-yellow; a few red giants and blue giants.\n    float tk = gfsr_hash13(cell + seed + 21.9);\n    float kelvin = tk < 0.15 ? mix(3000.0, 4200.0, tk / 0.15) : (tk > 0.9 ? mix(9000.0, 15000.0, (tk - 0.9) / 0.1) : mix(4800.0, 7500.0, (tk - 0.15) / 0.75));\n    vec3 col = mix(vec3(1.0), gfsr_blackbody(kelvin) / max(gfsr_luma(gfsr_blackbody(kelvin)), 0.05), 0.55);\n    float ph = gfsr_hash13(cell + seed + 31.3) * 6.2831;\n    float tw = 1.0 + twinkle * (0.55 * sin(u_time * (9.0 + h * 40.0) + ph) + 0.35 * sin(u_time * (23.0 + hb * 30.0) + ph * 2.0));\n    return col * g * mag * max(tw, 0.05);\n}\n\nvec3 milkyWay(vec3 d)\n{\n    float b = dot(d, GAL_NORTH);\n    float toCenter = dot(d, GAL_CENTER);\n    float bulge = exp(-pow(acos(clamp(toCenter, -1.0, 1.0)) / 0.55, 2.0));\n    float width = 0.14 + 0.12 * bulge;\n    float band = exp(-(b * b) / (width * width));\n    float mottling = gfsr_fbm3(d * 9.0 + 50.0, 1000.0, 5);\n    float stars = gfsr_fbm3(d * 40.0 + 10.0, 1000.0, 3);\n    float laneX = (b + 0.012) / (0.035 + 0.02 * bulge); float lane = exp(-laneX * laneX) * smoothstep(0.35, 0.75, gfsr_fbm3(d * 14.0, 1000.0, 4));\n    float i = band * (0.35 + 0.65 * bulge) * (0.45 + 0.9 * mottling) * (0.8 + 0.4 * stars) * (1.0 - 0.75 * lane);\n    vec3 col = mix(vec3(0.70, 0.76, 1.0), vec3(1.0, 0.86, 0.70), bulge);\n    return col * i;\n}\n\n// Moon disk with phase shading; dirs in ENU.\nvec3 moonDisk(vec3 rd, vec3 moonDir, vec3 sunDir, out float cover)\n{\n    cover = 0.0;\n    float c = dot(rd, moonDir);\n    float a = sqrt(max(2.0 - 2.0 * c, 0.0));\n    if (c < 0.0 || a > MOON_RADIUS * 1.15) {\n        return vec3(0.0);\n    }\n    vec3 off = (rd - moonDir * c) / MOON_RADIUS;\n    float r2 = dot(off, off);\n    cover = 1.0 - smoothstep(0.92, 1.05, sqrt(r2));\n    vec3 n = normalize(off - moonDir * sqrt(max(1.0 - min(r2, 1.0), 0.0)));\n    float lit = max(dot(n, sunDir), 0.0);\n    vec3 q = off * 4.0 + 7.0;\n    float maria = gfsr_fbm3(q, 1000.0, 4);\n    float albedo = mix(0.55, 1.0, smoothstep(0.35, 0.65, maria));\n    float earthshine = 0.012;\n    return vec3(1.0, 0.97, 0.92) * (lit * albedo + earthshine) * cover;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n\n    vec3 rdEC = gfsr_viewRayEC(uv);\n    vec3 rd = normalize(u_eyeToEnu * rdEC);\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    vec3 moonDir = normalize(u_eyeToEnu * czm_moonDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float nu = dot(rd, sunDir);\n\n    float humidity = u_moisture.x;\n    float overcast = u_weather.x;\n    float storm = u_weather.y;\n    float mie = u_mie * (1.0 + humidity * 1.6 + overcast * 1.2 + u_weather.w * 3.0);\n    float ozone = u_sunsetShift;\n    float day = smoothstep(-0.10, 0.02, sunDir.z);\n    float night = 1.0 - smoothstep(-0.18, -0.04, sunDir.z);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, ozone);\n    // Fraction of the moon disk that is lit (0 new moon .. 1 full moon).\n    float moonPhase = 0.5 * (1.0 - dot(sunDir, moonDir));\n    float moonUp = smoothstep(-0.05, 0.08, moonDir.z);\n    float moonLight = 0.0035 * pow(max(moonPhase, 0.0), 1.5) * moonUp * u_stars.w;\n\n    if (gfsr_isSkyDepth(raw)) {\n        vec3 L;\n        vec3 T;\n        gfsr_scatter(camHKm, rd, sunDir, 1.0e9, u_rayleigh, mie, ozone, u_steps, L, T);\n\n        // Moonlit sky: the same scattering integral, ~1/300 of the sunlit sky\n        // (perceptually scaled for a display without scotopic adaptation).\n        if (moonLight > 0.0 && night > 0.0) {\n            vec3 Lm;\n            vec3 Tm;\n            gfsr_scatter(camHKm, rd, moonDir, 1.0e9, u_rayleigh, mie, ozone, max(4.0, floor(u_steps * 0.5)), Lm, Tm);\n            L += Lm * moonLight * 60.0 * night;\n        }\n\n        // Optional subtle forward-scatter boost along the horizon (physical\n        // multiple scattering the single-scatter integral underestimates).\n        float lowSun = 1.0 - smoothstep(0.0, 0.3, abs(sunDir.z));\n        float band = exp(-abs(rd.z) * 18.0);\n        float towardsSun = 0.3 + 0.7 * pow(max(nu, 0.0), 4.0);\n        L += sunT * vec3(1.0, 0.72, 0.48) * band * towardsSun * lowSun * u_horizonGlow * 0.25 * day;\n\n        // Night sky: airglow, stars and Milky Way, dimmed by extinction and\n        // by the sky background (they disappear in daylight naturally).\n        float above = smoothstep(-0.02, 0.03, rd.z);\n        vec3 d = normalize(u_eyeToIcrf * rdEC);\n        float airmass = 1.0 / max(rd.z + 0.025, 0.025);\n        float twinkle = u_stars.z * clamp(airmass * 0.18, 0.15, 1.0) * (1.0 - smoothstep(10000.0, 30000.0, u_camHeight));\n        float pix = max(u_pixelAngle, 2.0e-4);\n        vec3 stars = starLayer(d, 150.0, 0.045, 0.0, pix, twinkle) + starLayer(d, 330.0, 0.05, 71.0, pix, twinkle) * 0.45;\n        vec3 mw = milkyWay(d) * 0.012 * u_stars.y;\n        vec3 airglow = vec3(0.0016, 0.0022, 0.0030) * (1.0 + 2.0 * exp(-max(rd.z, 0.0) * 8.0));\n        float skyBg = gfsr_luma(1.0 - exp(-L));\n        float visible = (1.0 - smoothstep(0.0, 0.08, skyBg)) * above * (1.0 - overcast * 0.95);\n        L += (stars * 0.25 * u_stars.x + mw) * T * visible + airglow * night * above;\n\n        // Sun disk with limb darkening, attenuated by the atmosphere.\n        float sunCos = 0.999989;\n        float disk = smoothstep(sunCos - 0.000004, sunCos + 0.000003, nu);\n        float limb = sqrt(max(1.0 - (1.0 - nu) / (1.0 - sunCos + 1e-7), 0.0));\n        L += sunT * disk * (0.45 + 0.55 * limb) * 40.0 * (1.0 - overcast * 0.95);\n\n        // Moon (also faintly visible in daylight).\n        float mCover;\n        vec3 moon = moonDisk(rd, moonDir, sunDir, mCover) * u_stars.w;\n        L += moon * T * mix(0.35, 0.9, night) * above;\n\n        vec3 sky = gfsr_toGamma(1.0 - exp(-L));\n        sky = weatherTint(sky, overcast, storm);\n        gl_FragColor = vec4(mix(src.rgb, sky, u_skyBlend), src.a);\n        return;\n    }\n\n    // Aerial perspective for terrain, aircraft and buildings.\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    float distKm = length(pEC) * 0.001;\n    vec3 L;\n    vec3 T;\n    gfsr_scatter(camHKm, rd, sunDir, distKm, u_rayleigh, mie, ozone, max(4.0, floor(u_steps * 0.5)), L, T);\n    if (moonLight > 0.0 && night > 0.0) {\n        vec3 Lm;\n        vec3 Tm;\n        gfsr_scatter(camHKm, rd, moonDir, distKm, u_rayleigh, mie, ozone, 4.0, Lm, Tm);\n        L += Lm * moonLight * 60.0 * night;\n    }\n\n    vec3 lin = gfsr_toLinear(src.rgb);\n    float k = u_hazeStrength;\n    vec3 transm = mix(vec3(1.0), T, k);\n    vec3 haze = (1.0 - exp(-L)) * k;\n    vec3 outLin = lin * transm + haze;\n\n    // Boundary-layer moisture: humid air near the ground scatters white light\n    // (visibility reduction), strongest when the camera itself is low.\n    float lowAlt = 1.0 - smoothstep(800.0, 6000.0, u_camHeight);\n    float moist = 0.008 + 0.05 * humidity * humidity + 0.12 * u_weather.w;\n    float hazeAmt = (1.0 - exp(-distKm * moist * (0.35 + 0.65 * lowAlt) * k));\n    vec3 hazeCol = vec3(0.62, 0.68, 0.76) * (0.25 + 0.75 * sunT) * day + vec3(0.004, 0.005, 0.008) * night;\n    outLin = mix(outLin, hazeCol, hazeAmt * 0.6);\n\n    vec3 outc = gfsr_toGamma(outLin);\n    outc = weatherTint(outc, overcast * 0.6, storm * 0.7);\n    gl_FragColor = vec4(outc, src.a);\n}\n",
        "bloom": "// GeoFS-ReShade : bloom.glsl\n// Cinematic bloom.\n//\n// Pipeline\n//   bloom_bright     (1/2 res)  soft-knee threshold + 4-tap anti-flicker prefilter\n//   bloom_downsample (1/4 res)  13-tap \"call of duty\" downsample\n//   bloom_blur       (1/4 res)  separable 9-tap Gaussian, run H then V, radius scaled\n//   bloom_upsample   (1/2 res)  3x3 tent upsample + bright pass (soft bloom)\n//   bloom_streak     (1/4 res)  anamorphic horizontal streaks (lens effect)\n//   bloom_composite  (full)     additive composite in linear light\n//\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\nuniform vec2 u_srcTexel; // texel size of the texture being sampled by this pass\n\n// @program bloom_bright\nuniform float u_threshold;\nuniform float u_knee;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 o = u_srcTexel * 0.75;\n    vec3 a = gfsr_toLinear(texture2D(colorTexture, uv + vec2(-o.x, -o.y)).rgb);\n    vec3 b = gfsr_toLinear(texture2D(colorTexture, uv + vec2(o.x, -o.y)).rgb);\n    vec3 c = gfsr_toLinear(texture2D(colorTexture, uv + vec2(-o.x, o.y)).rgb);\n    vec3 d = gfsr_toLinear(texture2D(colorTexture, uv + vec2(o.x, o.y)).rgb);\n    // Karis average suppresses single-pixel fireflies.\n    float wa = 1.0 / (1.0 + gfsr_luma(a));\n    float wb = 1.0 / (1.0 + gfsr_luma(b));\n    float wc = 1.0 / (1.0 + gfsr_luma(c));\n    float wd = 1.0 / (1.0 + gfsr_luma(d));\n    vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);\n\n    float threshold = gfsr_toLinear(vec3(u_threshold)).r;\n    float br = max(col.r, max(col.g, col.b));\n    float knee = threshold * u_knee + 1e-4;\n    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);\n    soft = soft * soft / (4.0 * knee);\n    float contrib = max(soft, br - threshold) / max(br, 1e-4);\n    gl_FragColor = vec4(col * contrib, 1.0);\n}\n\n// @program bloom_downsample\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 t = u_srcTexel;\n    vec3 a = texture2D(colorTexture, uv + t * vec2(-2.0, -2.0)).rgb;\n    vec3 b = texture2D(colorTexture, uv + t * vec2(0.0, -2.0)).rgb;\n    vec3 c = texture2D(colorTexture, uv + t * vec2(2.0, -2.0)).rgb;\n    vec3 d = texture2D(colorTexture, uv + t * vec2(-2.0, 0.0)).rgb;\n    vec3 e = texture2D(colorTexture, uv).rgb;\n    vec3 f = texture2D(colorTexture, uv + t * vec2(2.0, 0.0)).rgb;\n    vec3 g = texture2D(colorTexture, uv + t * vec2(-2.0, 2.0)).rgb;\n    vec3 h = texture2D(colorTexture, uv + t * vec2(0.0, 2.0)).rgb;\n    vec3 i = texture2D(colorTexture, uv + t * vec2(2.0, 2.0)).rgb;\n    vec3 j = texture2D(colorTexture, uv + t * vec2(-1.0, -1.0)).rgb;\n    vec3 k = texture2D(colorTexture, uv + t * vec2(1.0, -1.0)).rgb;\n    vec3 l = texture2D(colorTexture, uv + t * vec2(-1.0, 1.0)).rgb;\n    vec3 m = texture2D(colorTexture, uv + t * vec2(1.0, 1.0)).rgb;\n    vec3 outc = e * 0.125;\n    outc += (a + c + g + i) * 0.03125;\n    outc += (b + d + f + h) * 0.0625;\n    outc += (j + k + l + m) * 0.125;\n    gl_FragColor = vec4(outc, 1.0);\n}\n\n// @program bloom_blur\nuniform vec2 u_direction;\nuniform float u_radius;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 stepUv = u_direction * u_srcTexel * u_radius;\n    // 9-tap Gaussian folded into 5 bilinear fetches.\n    vec3 sum = texture2D(colorTexture, uv).rgb * 0.2270270270;\n    sum += texture2D(colorTexture, uv + stepUv * 1.3846153846).rgb * 0.3162162162;\n    sum += texture2D(colorTexture, uv - stepUv * 1.3846153846).rgb * 0.3162162162;\n    sum += texture2D(colorTexture, uv + stepUv * 3.2307692308).rgb * 0.0702702703;\n    sum += texture2D(colorTexture, uv - stepUv * 3.2307692308).rgb * 0.0702702703;\n    gl_FragColor = vec4(sum, 1.0);\n}\n\n// @program bloom_upsample\nuniform sampler2D u_brightTexture;\nuniform float u_radius;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 t = u_srcTexel * u_radius;\n    vec3 s = texture2D(colorTexture, uv).rgb * 4.0;\n    s += texture2D(colorTexture, uv + vec2(-t.x, 0.0)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(t.x, 0.0)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(0.0, -t.y)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(0.0, t.y)).rgb * 2.0;\n    s += texture2D(colorTexture, uv + vec2(-t.x, -t.y)).rgb;\n    s += texture2D(colorTexture, uv + vec2(t.x, -t.y)).rgb;\n    s += texture2D(colorTexture, uv + vec2(-t.x, t.y)).rgb;\n    s += texture2D(colorTexture, uv + vec2(t.x, t.y)).rgb;\n    vec3 wide = s / 16.0;\n    vec3 tight = texture2D(u_brightTexture, uv).rgb;\n    // Normalised so the mip chain conserves energy instead of growing ~1.35x per level.\n    gl_FragColor = vec4((wide + tight * 0.35) / 1.35, 1.0);\n}\n\n// @program bloom_streak\nuniform sampler2D u_source;\nuniform float u_stepScale;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec3 sum = vec3(0.0);\n    float wsum = 0.0;\n    for (int i = -8; i <= 8; i++) {\n        float fi = float(i);\n        float w = exp(-abs(fi) * 0.28);\n        vec2 suv = uv + vec2(fi * u_srcTexel.x * u_stepScale, 0.0);\n        sum += texture2D(u_source, suv).rgb * w;\n        wsum += w;\n    }\n    gl_FragColor = vec4(sum / wsum, 1.0);\n}\n\n// @program bloom_composite\nuniform sampler2D u_bloomTexture;\nuniform sampler2D u_streakTexture;\nuniform vec2 u_bloomDims;\nuniform vec2 u_streakDims;\nuniform float u_intensity;\nuniform float u_streakIntensity;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 lin = gfsr_toLinear(src.rgb);\n    vec3 bloom = gfsr_textureBilinear(u_bloomTexture, uv, u_bloomDims).rgb;\n    vec3 streak = vec3(0.0);\n    if (u_streakIntensity > 0.0) {\n        streak = gfsr_textureBilinear(u_streakTexture, uv, u_streakDims).rgb * vec3(0.55, 0.75, 1.25);\n    }\n    lin += bloom * u_intensity + streak * u_streakIntensity;\n    // Soft shoulder keeps the result inside the 8-bit buffer without hard clipping.\n    vec3 outLin = lin / (1.0 + max(lin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n",
        "clouds": "// GeoFS-ReShade : clouds.glsl\n// Raymarched volumetric clouds (v2).\n//\n//   Density  : Perlin-Worley base shape, 2D weather map (cloud fields),\n//              height profiles (cumulus / stratus / storm with anvil),\n//              Worley erosion (billowy tops, wispy bases), wind shear.\n//   Lighting : Beer-Lambert + Beer-powder, dual-lobe Henyey-Greenstein phase\n//              (forward scattering / silver lining), multiple-scattering\n//              octaves, height-graded sky ambient, ground bounce,\n//              moonlight at night, humidity-softened lighting.\n//   Marching : interleaved-gradient (blue-noise-like) jitter, adaptive steps\n//              with empty-space skipping, short steps inside clouds so the\n//              camera can fly through cloud interiors, detail LOD by distance.\n//   Layers   : volumetric layer + high cirrus sheet, aerial perspective.\n//   Shadows  : sun-projected density darkens terrain (clouds_apply).\n//\n// Text above the first @program marker is shared by every program in this file.\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_time;\nuniform vec2 u_cloudOffset;   // metres, wrapped on the CPU to the noise period\nuniform vec4 u_cloudLayer;    // x base (m), y thickness (m), z coverage 0..1, w density\nuniform vec4 u_cloudParams;   // x type (0 cirrus, 1 cumulus, 2 storm), y metres per noise cell, z brightness, w cirrus layer on/off\nuniform vec4 u_cirrus;        // x altitude (m), y coverage 0..1, z opacity, w unused\nuniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog\nuniform vec4 u_moisture;      // x humidity, y wetness, z air temperature (C), w moon brightness\n\nconst float CLOUD_PERIOD = 64.0;\n\nfloat cloudHeightProfile(float hf, float type, float cov)\n{\n    // Flat condensation base, rounded cauliflower top.\n    float cumulus = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(0.3, 1.0, hf));\n    // Overcast skies flatten into stratiform decks.\n    float strat = smoothstep(0.0, 0.12, hf) * (1.0 - smoothstep(0.55, 1.0, hf));\n    // Cumulonimbus: tall column with an anvil spreading under the tropopause.\n    float stormy = smoothstep(0.0, 0.03, hf) * (1.0 - smoothstep(0.92, 1.0, hf));\n    stormy = max(stormy * 0.85, smoothstep(0.72, 0.85, hf) * (1.0 - smoothstep(0.93, 1.0, hf)));\n    float p = mix(cumulus, strat, smoothstep(0.75, 0.95, cov));\n    return type > 1.5 ? stormy : p;\n}\n\n// Large-scale weather map: clusters clouds into fields with clear gaps.\nfloat weatherMap(vec2 q)\n{\n    return gfsr_fbm2(q * 0.25, vec2(CLOUD_PERIOD * 0.25), 3);\n}\n\n// pos.xy = horizontal ENU metres relative to the camera, pos.z = altitude (m).\n// lod: 0 = full detail (erosion), 1 = base shape only (light rays, shadows).\nfloat cloudDensity(vec3 pos, float lod)\n{\n    float base = u_cloudLayer.x;\n    float thick = max(u_cloudLayer.y, 50.0);\n    float hf = (pos.z - base) / thick;\n    if (hf <= 0.0 || hf >= 1.0) {\n        return 0.0;\n    }\n    float type = u_cloudParams.x;\n    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);\n    float cov = clamp(u_cloudLayer.z + storm * 0.2, 0.0, 1.0);\n\n    vec2 q2 = (pos.xy + u_cloudOffset) / u_cloudParams.y;\n    float wm = weatherMap(q2);\n    float localCov = clamp(cov + (wm - 0.5) * 0.7 * (1.0 - cov * 0.6), 0.0, 1.0);\n    if (localCov < 0.02) {\n        return 0.0;\n    }\n\n    // Wind shear leans the towers downwind with height.\n    vec3 q = vec3(q2 + vec2(0.35, 0.12) * hf, pos.z / u_cloudParams.y + u_time * 0.0012);\n    float perlin = gfsr_fbm3(q, CLOUD_PERIOD, 3);\n    float profile = cloudHeightProfile(hf, type, cov);\n    // Conservative early-out: even a maximal Worley value cannot form cloud here.\n    if (smoothstep(0.25, 0.8, perlin * 0.6 + 0.47) * profile <= 1.0 - localCov) {\n        return 0.0;\n    }\n    float shape;\n    if (lod < 0.5) {\n        // Perlin-Worley: billows grow around Worley cell centres.\n        float w = 1.0 - gfsr_worley3(q * 2.0, CLOUD_PERIOD * 2.0);\n        shape = smoothstep(0.25, 0.8, perlin * 0.6 + w * 0.55 - 0.08);\n    } else {\n        // Same mean as the detailed version so the LOD transition is invisible.\n        shape = smoothstep(0.25, 0.8, perlin * 0.6 + 0.195);\n    }\n\n    float d = gfsr_remap(shape * profile, 1.0 - localCov, 1.0, 0.0, 1.0);\n    if (d <= 0.0) {\n        return 0.0;\n    }\n\n    if (lod < 0.5) {\n        // Erosion: billowy (inverted Worley) at the top, wispy (fbm) at the base.\n        vec3 qd = q * 8.0 + vec3(0.0, 0.0, u_time * 0.008);\n        float billow = 1.0 - gfsr_worley3(qd, CLOUD_PERIOD * 8.0);\n        float wisp = gfsr_fbm3(qd * 2.0, CLOUD_PERIOD * 16.0, 2);\n        float detail = mix(wisp, billow, clamp(hf * 1.6, 0.0, 1.0));\n        float erode = 0.42 * (1.0 - lod) * mix(1.0, 0.6, storm);\n        d = gfsr_remap(d, detail * erode, 1.0, 0.0, 1.0);\n    }\n    return clamp(d, 0.0, 1.0) * u_cloudLayer.w * (1.0 + storm * 0.8);\n}\n\nfloat cirrusDensity(vec2 xy)\n{\n    // Fibrous ice sheet stretched along the wind; integer periods keep the CPU wrap seamless.\n    vec2 q = (xy + u_cloudOffset) / (u_cloudParams.y * vec2(4.0, 1.0));\n    vec2 warp = vec2(gfsr_fbm2(q * 2.0, vec2(32.0, 128.0), 3), gfsr_fbm2(q * 2.0 + 5.0, vec2(32.0, 128.0), 2) * 0.3) * 0.7;\n    float n = gfsr_fbm2(q + warp, vec2(16.0, 64.0), 5);\n    float streak = gfsr_fbm2(vec2(q.x * 0.5, q.y * 6.0) + warp * 2.0, vec2(8.0, 384.0), 3);\n    float cov = clamp(u_cirrus.y, 0.0, 1.0);\n    return smoothstep(1.0 - cov, 1.0 - cov + 0.35, n * 0.75 + streak * 0.25);\n}\n\n// @program clouds_generate\nuniform float u_cloudSteps;\nuniform float u_maxDistance;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    float sceneDist = 1.0e9;\n    if (!gfsr_isSkyDepth(raw)) {\n        sceneDist = length(gfsr_eyePosition(depthTexture, uv));\n    }\n\n    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    vec3 moonDir = normalize(u_eyeToEnu * czm_moonDirectionEC);\n    float camH = u_camHeight;\n    float camHKm = max(camH, 1.0) * 0.001;\n    float type = u_cloudParams.x;\n    float storm = max(u_weather.y, type > 1.5 ? 1.0 : 0.0);\n    float humidity = u_moisture.x;\n\n    float base = u_cloudLayer.x;\n    float thick = max(u_cloudLayer.y, 50.0);\n    float top = base + thick;\n    float midKm = (base + 0.5 * thick) * 0.001;\n\n    // Light source: the sun, or the moon once the sun is well below the horizon.\n    float day = smoothstep(-0.10, 0.03, sunDir.z);\n    float moonPhase = 0.5 * (1.0 - dot(sunDir, moonDir));\n    vec3 lightDir = sunDir.z > -0.08 ? sunDir : moonDir;\n    vec3 sunCol = gfsr_sunTransmittance(midKm, sunDir.z, 1.0, 1.0, 1.0) * 3.0 * day;\n    vec3 moonCol = vec3(0.55, 0.62, 0.75) * 0.05 * pow(max(moonPhase, 0.0), 1.5) * smoothstep(-0.05, 0.1, moonDir.z) * u_moisture.w;\n    vec3 lightCol = sunDir.z > -0.08 ? sunCol : moonCol;\n    float nu = dot(rd, lightDir);\n\n    vec3 ambL;\n    vec3 ambT;\n    gfsr_scatter(midKm, vec3(0.0, 0.0, 1.0), sunDir, 1.0e9, 1.0, 1.0, 1.0, 6.0, ambL, ambT);\n    vec3 ambTop = (1.0 - exp(-ambL)) * 1.5 + vec3(0.004, 0.005, 0.008) + moonCol * 0.6;\n    // Overcast skies still light the cloud with diffuse skylight.\n    ambTop = max(ambTop, vec3(0.30, 0.33, 0.38) * day);\n    float darken = 1.0 - 0.6 * storm - 0.25 * u_weather.x;\n    lightCol *= darken;\n    ambTop *= mix(1.0, 0.5, storm);\n    // Sunlight reflected by the ground onto cloud bases (greenish-brown albedo).\n    vec3 bounce = sunCol * max(sunDir.z, 0.0) * vec3(0.10, 0.11, 0.09) * darken;\n    // Humid air softens lighting: more diffuse, less directional contrast.\n    float soft = 1.0 + humidity * 0.6;\n\n    float maxD = u_maxDistance;\n    float jitter = gfsr_ign(gl_FragCoord.xy);\n\n    // ---------------- Volumetric layer -----------------\n    vec3 volL = vec3(0.0);\n    float volT = 1.0;\n    float volHit = 1.0e9;\n    if (type > 0.5) {\n        vec2 tb = gfsr_shell(camHKm, rd.z, base * 0.001);\n        vec2 tt = gfsr_shell(camHKm, rd.z, top * 0.001);\n        vec2 tg = gfsr_shell(camHKm, rd.z, 0.0);\n        float t0 = -1.0;\n        float t1 = -1.0;\n        bool inside = false;\n        if (camH < base) {\n            if (tb.y > 0.0) {\n                t0 = tb.y;\n                t1 = tt.y;\n            }\n        } else if (camH > top) {\n            if (tt.x > 0.0) {\n                t0 = tt.x;\n                t1 = tb.x > 0.0 ? tb.x : tt.y;\n            }\n        } else {\n            inside = true;\n            t0 = 0.0;\n            t1 = rd.z > 0.0 ? tt.y : (tb.x > 0.0 ? tb.x : tt.y);\n        }\n        if (tg.x > 0.0) {\n            t1 = min(t1, tg.x);\n        }\n        t0 *= 1000.0;\n        t1 = min(t1 * 1000.0, min(sceneDist, maxD));\n        // Grazing rays cross the layer over tens of km; cap the span to keep steps dense.\n        t1 = min(t1, t0 + max(thick * 6.0, 6000.0));\n\n        if (t0 >= 0.0 && t1 > t0) {\n            float stepsF = max(u_cloudSteps, 4.0);\n            float dtBase = (t1 - t0) / stepsF;\n            // Inside a cloud start with short steps so the interior has detail.\n            float dt = inside ? clamp(dtBase * 0.15, 15.0, dtBase) : dtBase;\n            float t = t0 + dt * jitter;\n            float detailDist = maxD * 0.35;\n            float lightStep = thick * 0.06;\n            float msGain = 0.0;\n\n            for (int i = 0; i < 160; i++) {\n                if (t > t1 || volT < 0.01 || float(i) >= stepsF * 1.6) {\n                    break;\n                }\n                vec3 p = rd * t;\n                float alt = gfsr_altAlong(camHKm, rd.z, t * 0.001) * 1000.0;\n                vec3 pos = vec3(p.xy, alt);\n                float lod = smoothstep(detailDist * 0.6, detailDist, t);\n                float d = cloudDensity(pos, lod);\n                if (d > 0.002) {\n                    if (volHit > 1.0e8) {\n                        volHit = t;\n                    }\n                    // Cone-shaped light march towards the light source.\n                    float od = 0.0;\n                    float ls = lightStep;\n                    vec3 lp = pos;\n                    for (int j = 0; j < 5; j++) {\n                        lp += lightDir * ls;\n                        od += cloudDensity(lp, 1.0) * ls;\n                        ls *= 1.8;\n                    }\n                    float lightOD = od * 0.0035 / soft;\n\n                    // Multiple-scattering octaves (Wrenninge): each octave\n                    // attenuates less and scatters more isotropically.\n                    float light = 0.0;\n                    float a = 1.0;\n                    float b = 1.0;\n                    float c = 1.0;\n                    for (int k = 0; k < 4; k++) {\n                        float ph = mix(gfsr_phaseHG(nu, 0.8 * c), gfsr_phaseHG(nu, -0.3 * c), 0.35)\n                                 + 0.15 * gfsr_phaseHG(nu, 0.95 * c);\n                        ph = min(ph * 4.0 * GFSR_PI, 8.0);\n                        light += b * exp(-lightOD * a) * ph;\n                        a *= 0.25;\n                        b *= 0.55;\n                        c *= 0.5;\n                    }\n                    // Beer-powder: in-scattering builds up inside the volume, so\n                    // sun-facing edges of dense cores look darker (\"powder effect\");\n                    // the effect fades when looking towards the sun.\n                    float powder = 1.0 - exp(-od * 0.007 - d * 1.5);\n                    light *= mix(1.0, powder, 0.65 * (1.0 - smoothstep(0.2, 0.9, nu)));\n\n                    float hf = clamp((alt - base) / thick, 0.0, 1.0);\n                    // Ambient: brighter at the top (sky dome), darker at the\n                    // base, plus a little occlusion from the local density.\n                    float ambOcc = mix(0.35, 1.0, pow(hf, 0.6)) * (1.0 - 0.3 * d);\n                    vec3 S = lightCol * light + ambTop * ambOcc * soft * 0.85 + bounce * (1.0 - hf);\n                    S *= u_cloudParams.z;\n\n                    float sigma = 0.0075 * d;\n                    float stepT = exp(-sigma * dt);\n                    volL += volT * (1.0 - stepT) * S;\n                    volT *= stepT;\n                    msGain += d;\n                    if (inside) {\n                        dt = min(dt * 1.04, dtBase);\n                    }\n                    t += dt;\n                } else {\n                    // Empty-space skipping: larger strides through clear air.\n                    t += inside ? dt * 1.5 : dt * 2.0;\n                    if (inside) {\n                        dt = min(dt * 1.1, dtBase);\n                    }\n                }\n            }\n        }\n    }\n\n    // ---------------- Cirrus sheet -----------------\n    vec3 cirL = vec3(0.0);\n    float cirA = 0.0;\n    float cirHit = 1.0e9;\n    if (u_cloudParams.w > 0.5 || type < 0.5) {\n        float hc = u_cirrus.x;\n        vec2 tc = gfsr_shell(camHKm, rd.z, hc * 0.001);\n        float tci = (camH < hc ? tc.y : tc.x) * 1000.0;\n        if (tci > 0.0 && tci < sceneDist && tci < maxD * 3.0) {\n            vec3 p = rd * tci;\n            float d = cirrusDensity(p.xy);\n            float fade = 1.0 - smoothstep(maxD * 1.5, maxD * 3.0, tci);\n            cirA = d * u_cirrus.z * fade * (type < 0.5 ? 1.0 : 0.75);\n            // Ice crystals: strong forward scattering, faint backscatter.\n            float ph = (0.7 * gfsr_phaseHG(nu, 0.75) + 0.3 * gfsr_phaseHG(nu, -0.2)) * 4.0 * GFSR_PI;\n            vec3 cirSun = gfsr_sunTransmittance(hc * 0.001, sunDir.z, 1.0, 1.0, 1.0) * 3.0 * day * darken;\n            vec3 cirLight = sunDir.z > -0.08 ? cirSun : moonCol;\n            cirL = (cirLight * (0.45 + 0.55 * min(ph, 6.0)) + ambTop * 1.1) * u_cloudParams.z;\n            cirHit = tci;\n        }\n    }\n\n    // ---------------- Composite layers -----------------\n    float volA = 1.0 - volT;\n    vec3 volC = volA > 1e-4 ? volL / volA : vec3(0.0);\n    vec3 colL;\n    float alpha;\n    if (cirHit < volHit) {\n        alpha = cirA + (1.0 - cirA) * volA;\n        colL = (cirL * cirA + volC * volA * (1.0 - cirA)) / max(alpha, 1e-4);\n    } else {\n        alpha = volA + (1.0 - volA) * cirA;\n        colL = (volC * volA + cirL * cirA * (1.0 - volA)) / max(alpha, 1e-4);\n    }\n\n    // Aerial perspective between the camera and the cloud.\n    float hitDist = min(volHit, cirHit);\n    if (hitDist < 1.0e8) {\n        vec3 Lap;\n        vec3 Tap;\n        gfsr_scatter(camHKm, rd, sunDir, hitDist * 0.001, 1.0, 1.0 + humidity, 1.0, 4.0, Lap, Tap);\n        colL = colL * Tap + Lap * (1.0 + humidity * 0.5);\n        float far = smoothstep(maxD * 0.4, maxD, hitDist);\n        alpha *= 1.0 - far * step(volHit, cirHit);\n    }\n\n    vec3 display = gfsr_toGamma(1.0 - exp(-colL));\n    gl_FragColor = vec4(display, clamp(alpha, 0.0, 1.0));\n}\n\n// @program clouds_apply\nuniform sampler2D u_cloudTexture;\nuniform vec2 u_cloudDims;    // resolution of the low-res cloud buffer\nuniform float u_shadowStrength;\nuniform float u_shadowsEnabled;\n\nfloat viewDistance(vec2 uv)\n{\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        return 1.0e7;\n    }\n    return max(length(gfsr_eyePosition(depthTexture, uv)), 0.1);\n}\n\n// Depth-aware upsampling of the low-resolution cloud buffer avoids halos\n// around mountains and the aircraft silhouette.\nvec4 upsampleClouds(vec2 uv, float centerDist)\n{\n    vec2 dim = max(u_cloudDims, vec2(1.0));\n    vec2 st = uv * dim - 0.5;\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float logC = log(centerDist);\n    vec4 sum = vec4(0.0);\n    float wsum = 0.0;\n    for (int y = 0; y < 2; y++) {\n        for (int x = 0; x < 2; x++) {\n            vec2 o = vec2(float(x), float(y));\n            vec2 tuv = (i + o + 0.5) / dim;\n            float bw = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);\n            float dw = 1.0 / (0.05 + abs(log(viewDistance(tuv)) - logC));\n            float w = bw * dw + 1e-5;\n            sum += texture2D(u_cloudTexture, tuv) * w;\n            wsum += w;\n        }\n    }\n    return sum / wsum;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    bool sky = gfsr_isSkyDepth(raw);\n    vec3 col = src.rgb;\n\n    float dist = 1.0e7;\n    if (!sky) {\n        vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n        dist = max(length(pEC), 0.1);\n\n        if (u_shadowsEnabled > 0.5 && u_cloudParams.x > 0.5) {\n            vec3 p = u_eyeToEnu * pEC;\n            float alt = u_camHeight + p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);\n            vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n            if (sunDir.z > 0.03 && alt < u_cloudLayer.x + u_cloudLayer.y * 0.5) {\n                // Two samples through the layer give soft, volume-aware shadows.\n                float od = 0.0;\n                for (int k = 0; k < 2; k++) {\n                    float sh = u_cloudLayer.x + u_cloudLayer.y * (0.15 + 0.3 * float(k));\n                    if (alt < sh) {\n                        float tt = (sh - alt) / sunDir.z;\n                        od += cloudDensity(vec3(p.xy + sunDir.xy * tt, sh), 1.0);\n                    }\n                }\n                float sunFade = smoothstep(0.03, 0.2, sunDir.z);\n                float distFade = 1.0 - smoothstep(60000.0, 120000.0, dist);\n                float shade = u_shadowStrength * (1.0 - exp(-od * 2.5)) * sunFade * distFade;\n                col *= 1.0 - shade;\n            }\n        }\n    }\n\n    vec4 cl = upsampleClouds(uv, dist);\n    col = mix(col, cl.rgb, clamp(cl.a, 0.0, 1.0));\n    gl_FragColor = vec4(col, src.a);\n}\n",
        "cockpit": "// GeoFS-ReShade : cockpit.glsl\n// Cockpit-view effects (active only when the camera is inside the aircraft).\n//\n//   rain_glass    : procedural rain on the windscreen / canopy\n//                   * static droplets accumulate with rain intensity and\n//                     merge with each other (metaball field)\n//                   * moving drops streak downwards at low speed and race up\n//                     and outwards across the glass with airflow at speed,\n//                     leaving wet trails\n//                   * lens refraction (inverted, magnified background), rim\n//                     darkening, sky reflection highlights, wet-film blur\n//                   * the cockpit interior is masked out using the depth\n//                     buffer, so drops only sit on the glass\n//\n//   cockpit_light : physically-motivated cockpit lighting\n//                   * directional sun penetration with soft screen-space\n//                     shadows from the canopy frame and panel\n//                   * ambient sky bounce, night flood / instrument lighting,\n//                     night adaptation\n//                   * faint reflections of the instrument panel on the glass\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program rain_glass\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_time;\nuniform float u_aspect;\nuniform vec2 u_texel;\nuniform float u_aircraftRadius;\nuniform vec4 u_rain;      // x rain intensity 0..1, y airspeed (m/s), z glass wetness 0..1, w cockpit view 0..1\nuniform vec4 u_weather;\n\nvec2 hash22(vec2 p)\n{\n    return vec2(gfsr_hash12(p), gfsr_hash12(p + vec2(37.13, 91.71)));\n}\n\nvoid addDrop(vec2 p, vec2 c, vec2 r, float a, inout float F, inout vec2 G)\n{\n    vec2 d = (p - c) / r;\n    float e = a * exp(-dot(d, d) * 3.0);\n    F += e;\n    G += e * -6.0 * d / r;\n}\n\n// Static, accumulating droplets. Coordinates in screen-height units.\nvoid staticLayer(vec2 p, float scale, float density, float t, float seed, inout float F, inout vec2 G)\n{\n    vec2 q = p * scale;\n    vec2 id0 = floor(q);\n    for (int j = -1; j <= 1; j++) {\n        for (int i = -1; i <= 1; i++) {\n            vec2 id = id0 + vec2(float(i), float(j));\n            float h = gfsr_hash12(id + seed);\n            if (h > density) {\n                continue;\n            }\n            vec2 c = id + 0.15 + 0.7 * hash22(id + seed * 1.7);\n            float life = mix(5.0, 14.0, gfsr_hash12(id + seed + 3.1));\n            float ph = fract(t / life + h * 7.0);\n            float a = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.82, 1.0, ph));\n            float rad = mix(0.07, 0.24, pow(gfsr_hash12(id + seed + 5.3), 2.0)) * (0.6 + 0.4 * smoothstep(0.0, 0.5, ph));\n            addDrop(q, c, vec2(rad), a, F, G);\n        }\n    }\n    G *= scale;\n}\n\n// Moving drops in flow coordinates: x across the flow, y along the flow.\n// Returns the wet-trail amount; F/G receive the drop heads.\nfloat movingLayer(vec2 q, float speed, float density, float t, float seed, float stretch, inout float F, inout vec2 G)\n{\n    float wet = 0.0;\n    float colW = 1.0;\n    float cellL = 3.0;\n    float col0 = floor(q.x / colW);\n    for (int k = -1; k <= 1; k++) {\n        float cid = col0 + float(k);\n        float hc = gfsr_hash12(vec2(cid, seed));\n        float v = speed * mix(0.6, 1.4, gfsr_hash12(vec2(cid, seed + 1.3)));\n        float y = q.y - t * v - hc * 50.0;\n        float row = floor(y / cellL);\n        for (int m = -1; m <= 0; m++) {\n            float rid = row + float(m);\n            float h = gfsr_hash12(vec2(cid, rid) + seed);\n            if (h > density) {\n                continue;\n            }\n            float wob = (gfsr_noise2(vec2(rid * 3.1, (q.y - y) * 0.6 + cid), vec2(64.0)) - 0.5) * 0.35;\n            vec2 c = vec2((cid + 0.5 + (hash22(vec2(cid, rid)).x - 0.5) * 0.5 + wob) * colW, (rid + h / max(density, 1e-3)) * cellL);\n            float rad = mix(0.12, 0.26, gfsr_hash12(vec2(rid, cid) + seed + 9.0));\n            vec2 yq = vec2(q.x, y);\n            addDrop(yq, c, vec2(rad, rad * stretch), 1.0, F, G);\n            // Wet trail behind the head (smaller beads + a water film).\n            float dy = c.y - y;\n            if (dy > 0.0 && dy < cellL * 1.4) {\n                float dx = (q.x - c.x) / (rad * 0.45);\n                float fade = 1.0 - dy / (cellL * 1.4);\n                wet = max(wet, exp(-dx * dx) * fade);\n                float bead = step(0.72, gfsr_hash12(vec2(cid, floor(y * 3.0)) + seed));\n                addDrop(yq, vec2(c.x, floor(y * 3.0) / 3.0 + 0.16), vec2(rad * 0.35), bead * fade * 0.9, F, G);\n            }\n        }\n    }\n    return wet;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float rain = u_rain.x * u_rain.w;\n    float wetGlass = u_rain.z * u_rain.w;\n    if (rain + wetGlass < 0.002) {\n        gl_FragColor = src;\n        return;\n    }\n\n    // Only the glass: pixels beyond the cockpit interior.\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    float dist = gfsr_isSkyDepth(raw) ? 1.0e7 : length(gfsr_eyePosition(depthTexture, uv));\n    float r = max(u_aircraftRadius, 2.0);\n    float glass = smoothstep(r * 0.25, r * 0.45, dist);\n    if (glass <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec2 p = vec2((uv.x - 0.5) * u_aspect, uv.y - 0.5);\n    float t = u_time;\n    float spd = u_rain.y;\n    float sf = smoothstep(8.0, 45.0, spd);\n    float density = clamp(rain * 1.1, 0.0, 0.95);\n\n    float F = 0.0;\n    vec2 G = vec2(0.0);\n\n    // Static droplets: blown away at speed, persist on a wet canopy at rest.\n    float stDensity = (density * 0.85 + wetGlass * 0.15) * (1.0 - 0.75 * sf);\n    staticLayer(p, 9.0, stDensity, t, 1.0, F, G);\n    float F2 = 0.0;\n    vec2 G2 = vec2(0.0);\n    staticLayer(p, 21.0, stDensity, t * 1.3, 7.0, F2, G2);\n    F += F2 * 0.8;\n    G += G2 * 0.8;\n\n    float wet = 0.0;\n    // Gravity streaks (slow, vertical).\n    if (sf < 0.99) {\n        float Fg = 0.0;\n        vec2 Gg = vec2(0.0);\n        float wg = movingLayer(vec2(p.x, -p.y) * 7.0, 0.9, density * 0.5, t, 3.0, 1.4, Fg, Gg);\n        Gg = vec2(Gg.x, -Gg.y) * 7.0;\n        F += Fg * (1.0 - sf);\n        G += Gg * (1.0 - sf);\n        wet = max(wet, wg * (1.0 - sf));\n    }\n    // Airflow streaks: radiate from a stagnation point below the view.\n    if (sf > 0.01) {\n        vec2 vp = vec2(0.0, -0.9);\n        vec2 rel = p - vp;\n        float rho = length(rel);\n        float ang = atan(rel.x, rel.y);\n        vec2 q = vec2(ang * 1.2, rho) * 9.0;\n        float Fa = 0.0;\n        vec2 Ga = vec2(0.0);\n        float v = clamp(0.8 + spd * 0.08, 0.8, 9.0);\n        float wa = movingLayer(q, v, density * 0.7, t, 5.0, mix(1.2, 2.6, sf), Fa, Ga);\n        // Chain rule back to screen space (approximate, locally orthonormal basis).\n        vec2 er = rel / max(rho, 1e-3);\n        vec2 ea = vec2(er.y, -er.x);\n        vec2 gs = (ea * Ga.x * 1.2 / max(rho, 0.2) + er * Ga.y) * 9.0;\n        F += Fa * sf;\n        G += gs * sf;\n        wet = max(wet, wa * sf);\n    }\n\n    float drop = smoothstep(0.45, 0.75, F) * glass;\n    vec2 n = -G * 0.012;\n    n = n / (1.0 + length(n) * 3.0);\n\n    // Wet film and trails slightly blur the view; droplets refract (inverted lens).\n    float film = clamp(wet * 0.6 + wetGlass * 0.35 + rain * 0.25, 0.0, 1.0) * glass;\n    vec2 bl = u_texel * (1.5 + 3.0 * film);\n    vec3 bg = src.rgb * 0.4;\n    bg += texture2D(colorTexture, uv + vec2(bl.x, 0.0)).rgb * 0.15;\n    bg += texture2D(colorTexture, uv - vec2(bl.x, 0.0)).rgb * 0.15;\n    bg += texture2D(colorTexture, uv + vec2(0.0, bl.y)).rgb * 0.15;\n    bg += texture2D(colorTexture, uv - vec2(0.0, bl.y)).rgb * 0.15;\n    vec3 base = mix(src.rgb, bg, film);\n\n    vec2 ruv = clamp(uv - n * vec2(1.0 / u_aspect, 1.0) * 0.9, vec2(0.001), vec2(0.999));\n    vec3 refr = texture2D(colorTexture, ruv).rgb;\n\n    // Lighting of the water surface.\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    vec3 sky = gfsr_toGamma(gfsr_skyApprox(vec3(0.0, 0.0, 1.0), sunDir, camHKm, u_weather.x));\n    vec3 N3 = normalize(vec3(n * 3.0, 1.0));\n    float hl = pow(max(dot(N3, normalize(vec3(-0.25, 0.55, 1.0))), 0.0), 60.0);\n    float rim = drop * (1.0 - smoothstep(0.5, 0.95, F));\n\n    vec3 col = mix(base, refr * 0.92 + sky * 0.06, drop);\n    col *= 1.0 - rim * 0.35;\n    col += sky * hl * drop * 0.55;\n    col = mix(col, col * 0.96 + sky * 0.03, film * 0.5);\n\n    gl_FragColor = vec4(clamp(col, 0.0, 1.0), src.a);\n}\n\n// @program cockpit_light\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform vec2 u_texel;\nuniform float u_aircraftRadius;\nuniform vec4 u_cockpit;   // x cockpit view 0..1, y sun/shadow strength, z ambient bounce, w panel reflection\nuniform vec4 u_cockpit2;  // x flood / instrument light, y night adaptation, z shadow steps, w unused\nuniform vec4 u_weather;\n\nfloat cockpitShadow(vec3 pEC, vec3 lEC, float maxT, float steps, float jitter)\n{\n    float occl = 0.0;\n    float n = max(steps, 2.0);\n    for (int i = 0; i < 24; i++) {\n        if (float(i) >= n) {\n            break;\n        }\n        float f = (float(i) + jitter) / n;\n        float t = maxT * f * f + 0.03;\n        vec3 p = pEC + lEC * t;\n        if (p.z > -0.02) {\n            break;\n        }\n        vec3 s = gfsr_projectEC(p);\n        if (s.z < 0.0 || s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {\n            break;\n        }\n        float raw = texture2D(depthTexture, s.xy).r;\n        if (gfsr_isSkyDepth(raw)) {\n            continue;\n        }\n        vec3 q = gfsr_eyePosition(depthTexture, s.xy);\n        float diff = (-p.z) - (-q.z);\n        if (diff > 0.02 && diff < 0.6 + t * 0.4) {\n            occl = max(occl, (1.0 - f * 0.5) * smoothstep(0.02, 0.08, diff));\n        }\n    }\n    return 1.0 - occl;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float cockpitK = u_cockpit.x;\n    if (cockpitK <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    float r = max(u_aircraftRadius, 2.0);\n    vec3 sunEC = normalize(czm_sunDirectionEC);\n    vec3 sunDir = normalize(u_eyeToEnu * sunEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float day = smoothstep(-0.1, 0.06, sunDir.z);\n    float night = 1.0 - day;\n    vec3 col = gfsr_toLinear(src.rgb);\n\n    float dist = gfsr_isSkyDepth(raw) ? 1.0e7 : length(gfsr_eyePosition(depthTexture, uv));\n    float interior = (1.0 - smoothstep(r * 0.3, r * 0.5, dist)) * cockpitK;\n\n    if (interior > 0.001) {\n        vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n        vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel, pEC);\n        if (dot(nEC, -pEC) < 0.0) {\n            nEC = -nEC;\n        }\n        vec3 N = normalize(u_eyeToEnu * nEC);\n        float jitter = gfsr_ign(gl_FragCoord.xy);\n        vec3 sunT = gfsr_sunTransmittance(camHKm, max(sunDir.z, 0.0), 1.0, 1.0, 1.0);\n        float sunE = day * (1.0 - u_weather.x * 0.75);\n        float NdotL = dot(nEC, sunEC);\n        float sh = 1.0;\n        if (NdotL > 0.0 && sunE > 0.01) {\n            sh = cockpitShadow(pEC + nEC * 0.01, sunEC, r * 0.8, u_cockpit2.z, jitter);\n        }\n        float amb = 0.32 + 0.12 * N.z;\n        float lit = amb + sunE * max(NdotL, 0.0) * sh;\n        float ref = amb + sunE * max(NdotL, 0.0);\n        // Re-light relative to the unshadowed engine shading (preserves albedo).\n        float ratio = clamp(lit / max(ref, 0.05), 0.35, 1.3);\n        vec3 lc = col * mix(1.0, ratio, u_cockpit.y * interior);\n        // Sun penetration: warm sunlit patches on the panel.\n        lc += col * sunT * max(NdotL, 0.0) * sh * sunE * 0.25 * u_cockpit.y * interior;\n\n        // Ambient bounce from sky through the canopy (from above) and from the\n        // sunlit panel (warm, from below).\n        vec3 skyL = gfsr_skyApprox(vec3(0.0, 0.0, 1.0), sunDir, camHKm, u_weather.x);\n        float up = N.z * 0.5 + 0.5;\n        vec3 bounce = skyL * up * 0.35 + vec3(0.06, 0.05, 0.04) * sunE * (1.0 - up);\n        lc += col * bounce * u_cockpit.z * interior;\n\n        // Night: dim flood lighting + adaptation so the cockpit stays readable\n        // without looking lit like day.\n        vec3 flood = vec3(1.0, 0.86, 0.68) * 0.035 * u_cockpit2.x;\n        lc += (col * 2.5 + 0.004) * flood * night * interior;\n        lc *= mix(1.0, 1.0 + u_cockpit2.y * 0.6, night * interior);\n        col = mix(col, lc, interior);\n    } else if (u_cockpit.w > 0.0 && dist > r * 0.45) {\n        // Panel reflection on the windscreen: mirror the lower half about a\n        // line just above the glare shield, fade with angle.\n        float refY = 0.92 - uv.y;\n        if (refY > 0.0 && refY < uv.y) {\n            vec2 ruv = vec2(uv.x, refY);\n            float rr = gfsr_rawDepth(depthTexture, ruv);\n            float rd = gfsr_isSkyDepth(rr) ? 1.0e7 : length(gfsr_eyePosition(depthTexture, ruv));\n            if (rd < r * 0.35) {\n                vec3 rc = gfsr_toLinear(texture2D(colorTexture, ruv).rgb) * 0.5;\n                rc += gfsr_toLinear(texture2D(colorTexture, ruv + vec2(u_texel.x * 3.0, 0.0)).rgb) * 0.25;\n                rc += gfsr_toLinear(texture2D(colorTexture, ruv - vec2(u_texel.x * 3.0, 0.0)).rgb) * 0.25;\n                float k = u_cockpit.w * mix(0.035, 0.16, night) * smoothstep(0.45, 0.9, uv.y) * cockpitK;\n                col += rc * k;\n            }\n        }\n    }\n\n    gl_FragColor = vec4(gfsr_toGamma(col), src.a);\n}\n",
        "colorgrade": "// GeoFS-ReShade : colorgrade.glsl\n// LUT-style professional colour grading, applied after tonemapping.\n//\n// Modes (u_mode):\n//   0 Realistic     neutral, gentle filmic contrast\n//   1 MSFS          clean, slightly cool, crisp mid-contrast, rich blues\n//   2 DCS           muted, slightly green/olive military look, lower saturation\n//   3 Cinematic     teal shadows / orange highlights, strong S-curve\n//   4 Photographic  natural, lifted blacks, soft highlight roll-off, warm print\n//\n// Curves: separate shadows / midtones / highlights controls.\n// Colour scheme: warm highlights, cool shadows (split toning).\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program colorgrade\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform float u_mode;\nuniform float u_strength;\nuniform float u_shadows;     // -1..1  lift\nuniform float u_midtones;    // -1..1  gamma\nuniform float u_highlights;  // -1..1  gain\nuniform float u_warmth;      //  0..1  warm highlights\nuniform float u_coolness;    //  0..1  cool shadows\nuniform float u_vibrance;    // -1..1\n\nstruct Grade {\n    vec3 lift;\n    vec3 gammaV;\n    vec3 gain;\n    float sat;\n    float contrast;\n    vec3 shadowTint;\n    vec3 highlightTint;\n    float splitAmount;\n};\n\nGrade gradeForMode(float mode)\n{\n    Grade g;\n    g.lift = vec3(0.0);\n    g.gammaV = vec3(1.0);\n    g.gain = vec3(1.0);\n    g.sat = 1.0;\n    g.contrast = 1.0;\n    g.shadowTint = vec3(0.0, 0.0, 0.0);\n    g.highlightTint = vec3(0.0, 0.0, 0.0);\n    g.splitAmount = 0.0;\n    if (mode < 0.5) {\n        g.lift = vec3(0.004, 0.004, 0.008);\n        g.gammaV = vec3(1.0);\n        g.gain = vec3(1.0);\n        g.sat = 1.04;\n        g.contrast = 1.04;\n        g.shadowTint = vec3(-0.01, 0.0, 0.02);\n        g.highlightTint = vec3(0.02, 0.01, -0.01);\n        g.splitAmount = 0.5;\n    } else if (mode < 1.5) {\n        g.lift = vec3(0.0, 0.004, 0.012);\n        g.gammaV = vec3(1.02, 1.0, 0.97);\n        g.gain = vec3(1.0, 1.01, 1.04);\n        g.sat = 1.12;\n        g.contrast = 1.08;\n        g.shadowTint = vec3(-0.015, 0.0, 0.03);\n        g.highlightTint = vec3(0.025, 0.015, -0.01);\n        g.splitAmount = 0.6;\n    } else if (mode < 2.5) {\n        g.lift = vec3(0.01, 0.012, 0.006);\n        g.gammaV = vec3(1.0, 0.98, 1.04);\n        g.gain = vec3(1.0, 1.01, 0.96);\n        g.sat = 0.86;\n        g.contrast = 1.06;\n        g.shadowTint = vec3(-0.005, 0.01, 0.015);\n        g.highlightTint = vec3(0.02, 0.02, -0.02);\n        g.splitAmount = 0.5;\n    } else if (mode < 3.5) {\n        g.lift = vec3(-0.01, 0.005, 0.02);\n        g.gammaV = vec3(0.98, 1.0, 1.03);\n        g.gain = vec3(1.06, 1.0, 0.92);\n        g.sat = 1.1;\n        g.contrast = 1.18;\n        g.shadowTint = vec3(-0.04, 0.01, 0.05);\n        g.highlightTint = vec3(0.06, 0.02, -0.04);\n        g.splitAmount = 1.0;\n    } else {\n        g.lift = vec3(0.025, 0.022, 0.02);\n        g.gammaV = vec3(0.98, 1.0, 1.02);\n        g.gain = vec3(1.02, 1.0, 0.97);\n        g.sat = 0.95;\n        g.contrast = 0.97;\n        g.shadowTint = vec3(-0.01, 0.0, 0.015);\n        g.highlightTint = vec3(0.03, 0.015, -0.015);\n        g.splitAmount = 0.7;\n    }\n    return g;\n}\n\nvec3 liftGammaGain(vec3 c, vec3 lift, vec3 gammaV, vec3 gain)\n{\n    vec3 x = c * gain + lift * (1.0 - c);\n    return pow(max(x, vec3(0.0)), 1.0 / max(gammaV, vec3(0.05)));\n}\n\nvec3 sCurve(vec3 c, float contrast)\n{\n    // Contrast pivoting around mid grey in perceptual space, smooth at the ends.\n    vec3 x = c - 0.5;\n    vec3 y = x * contrast / (1.0 + abs(x) * (contrast - 1.0) * 2.0);\n    return clamp(y + 0.5, 0.0, 1.0);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 c = clamp(src.rgb, 0.0, 1.0);\n\n    Grade g = gradeForMode(u_mode);\n\n    // Base look.\n    vec3 graded = liftGammaGain(c, g.lift, g.gammaV, g.gain);\n    graded = sCurve(graded, g.contrast);\n\n    // Luminance zone weights.\n    float l = gfsr_luma(graded);\n    float wS = 1.0 - smoothstep(0.0, 0.45, l);\n    float wH = smoothstep(0.55, 1.0, l);\n    float wM = max(1.0 - wS - wH, 0.0);\n\n    // User curves: shadows (lift), midtones (gamma), highlights (gain).\n    graded += wS * u_shadows * 0.18 * (1.0 - graded);\n    graded = mix(graded, pow(max(graded, vec3(0.0)), vec3(exp2(-u_midtones * 0.8))), wM);\n    graded *= 1.0 + wH * u_highlights * 0.25;\n\n    // Split toning: warm highlights, cool shadows.\n    vec3 warm = vec3(0.06, 0.025, -0.045) * u_warmth;\n    vec3 cool = vec3(-0.04, 0.0, 0.06) * u_coolness;\n    graded += (g.highlightTint * g.splitAmount + warm) * wH;\n    graded += (g.shadowTint * g.splitAmount + cool) * wS;\n\n    // Saturation + vibrance (protects already saturated colours).\n    float l2 = gfsr_luma(graded);\n    graded = mix(vec3(l2), graded, g.sat);\n    float mx = max(graded.r, max(graded.g, graded.b));\n    float mn = min(graded.r, min(graded.g, graded.b));\n    float satNow = mx - mn;\n    float vib = 1.0 + u_vibrance * (1.0 - satNow);\n    graded = mix(vec3(gfsr_luma(graded)), graded, vib);\n\n    graded = clamp(graded, 0.0, 1.0);\n    gl_FragColor = vec4(mix(c, graded, u_strength), src.a);\n}\n",
        "common": "// GeoFS-ReShade : common.glsl\n// Shared helper library. The loader prepends this file to every program.\n//\n// Conventions\n//   * Written in the GLSL ES 1.00 post-process dialect of Cesium <= 1.101\n//     (texture2D / gl_FragColor / varying). main.user.js upgrades the syntax\n//     automatically when GeoFS runs a Cesium build >= 1.102 (GLSL ES 3.00).\n//   * ENU = local East-North-Up frame at the camera (z = up).\n//   * Distances are metres unless the identifier ends in Km.\n//   * This file declares no uniforms so it can be shared by every stage.\n\n#define GFSR_PI 3.14159265359\n#define GFSR_R_KM 6371.0\n#define GFSR_ATMO_KM 100.0\n#define GFSR_R_M 6371000.0\n\n// ---------------------------------------------------------------------------\n// Basic colour helpers\n// ---------------------------------------------------------------------------\nfloat gfsr_saturate(float x) { return clamp(x, 0.0, 1.0); }\nvec3 gfsr_saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\nfloat gfsr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }\nvec3 gfsr_toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }\nvec3 gfsr_toGamma(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }\n\n// Manual bilinear fetch for textures produced at a different resolution.\n// Cesium shares and re-samples intermediate textures, so their filtering mode\n// cannot be relied upon; dims is the texture size in pixels.\nvec4 gfsr_textureBilinear(sampler2D tex, vec2 uv, vec2 dims)\n{\n    vec2 d = max(dims, vec2(1.0));\n    vec2 st = uv * d - 0.5;\n    vec2 i = floor(st);\n    vec2 f = st - i;\n    vec2 inv = 1.0 / d;\n    vec4 a = texture2D(tex, (i + vec2(0.5, 0.5)) * inv);\n    vec4 b = texture2D(tex, (i + vec2(1.5, 0.5)) * inv);\n    vec4 c = texture2D(tex, (i + vec2(0.5, 1.5)) * inv);\n    vec4 e = texture2D(tex, (i + vec2(1.5, 1.5)) * inv);\n    return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);\n}\n\n// ---------------------------------------------------------------------------\n// Depth buffer helpers\n// ---------------------------------------------------------------------------\nfloat gfsr_rawDepth(sampler2D depthTex, vec2 uv)\n{\n    return texture2D(depthTex, uv).r;\n}\n\nbool gfsr_isSkyDepth(float raw)\n{\n    return raw >= 0.999999;\n}\n\n// Eye-space position of the surface visible at uv.\n// With a logarithmic depth buffer czm_windowToEyeCoordinates expects the raw\n// log depth; czm_readDepth would linearise it a second time.\nvec3 gfsr_eyePosition(sampler2D depthTex, vec2 uv)\n{\n#ifdef LOG_DEPTH\n    float depth = texture2D(depthTex, uv).r;\n#else\n    float depth = czm_readDepth(depthTex, uv);\n#endif\n    vec4 ec = czm_windowToEyeCoordinates(uv * czm_viewport.zw + czm_viewport.xy, depth);\n    return ec.xyz / ec.w;\n}\n\n// Normalised eye-space view ray through uv (valid for sky pixels too).\nvec3 gfsr_viewRayEC(vec2 uv)\n{\n    vec4 ndc = vec4(uv * 2.0 - 1.0, -1.0, 1.0);\n    vec4 ec = czm_inverseProjection * ndc;\n    return normalize(ec.xyz / ec.w);\n}\n\n// Eye-space normal reconstructed from the depth buffer. Picks the smaller\n// depth step on each axis so silhouettes do not produce smeared normals.\nvec3 gfsr_normalEC(sampler2D depthTex, vec2 uv, vec2 texel, vec3 p)\n{\n    vec3 pr = gfsr_eyePosition(depthTex, uv + vec2(texel.x, 0.0));\n    vec3 pl = gfsr_eyePosition(depthTex, uv - vec2(texel.x, 0.0));\n    vec3 pu = gfsr_eyePosition(depthTex, uv + vec2(0.0, texel.y));\n    vec3 pd = gfsr_eyePosition(depthTex, uv - vec2(0.0, texel.y));\n    vec3 dx = (abs(pr.z - p.z) < abs(p.z - pl.z)) ? (pr - p) : (p - pl);\n    vec3 dy = (abs(pu.z - p.z) < abs(p.z - pd.z)) ? (pu - p) : (p - pd);\n    vec3 n = cross(dx, dy);\n    float len = length(n);\n    return len > 1e-8 ? n / len : vec3(0.0, 0.0, 1.0);\n}\n\n// Screen position of the sun. xy = uv, z = 1 when the sun is in front of the camera.\nvec3 gfsr_sunScreen()\n{\n    vec4 clip = czm_projection * vec4(czm_sunDirectionEC, 0.0);\n    if (clip.w <= 1e-5) {\n        return vec3(-10.0, -10.0, 0.0);\n    }\n    return vec3(clip.xy / clip.w * 0.5 + 0.5, 1.0);\n}\n\n// ---------------------------------------------------------------------------\n// Noise\n// ---------------------------------------------------------------------------\nfloat gfsr_hash12(vec2 p)\n{\n    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n    p3 += dot(p3, p3.yzx + 33.33);\n    return fract((p3.x + p3.y) * p3.z);\n}\n\nfloat gfsr_hash13(vec3 p3)\n{\n    p3 = fract(p3 * 0.1031);\n    p3 += dot(p3, p3.zyx + 31.32);\n    return fract((p3.x + p3.y) * p3.z);\n}\n\n// Interleaved gradient noise, used for dithering and ray jitter.\nfloat gfsr_ign(vec2 fragCoord)\n{\n    return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));\n}\n\n// Tileable value noise. The lattice wraps every `period` cells so world-locked\n// coordinates can be wrapped on the CPU without visible seams.\nfloat gfsr_noise2(vec2 x, vec2 period)\n{\n    vec2 i = floor(x);\n    vec2 f = fract(x);\n    vec2 u = f * f * (3.0 - 2.0 * f);\n    vec2 i0 = mod(i, period);\n    vec2 i1 = mod(i + 1.0, period);\n    float a = gfsr_hash12(i0);\n    float b = gfsr_hash12(vec2(i1.x, i0.y));\n    float c = gfsr_hash12(vec2(i0.x, i1.y));\n    float d = gfsr_hash12(i1);\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n}\n\nfloat gfsr_noise3(vec3 x, float period)\n{\n    vec3 i = floor(x);\n    vec3 f = fract(x);\n    vec3 u = f * f * (3.0 - 2.0 * f);\n    vec3 i0 = mod(i, period);\n    vec3 i1 = mod(i + 1.0, period);\n    float n000 = gfsr_hash13(i0);\n    float n100 = gfsr_hash13(vec3(i1.x, i0.y, i0.z));\n    float n010 = gfsr_hash13(vec3(i0.x, i1.y, i0.z));\n    float n110 = gfsr_hash13(vec3(i1.x, i1.y, i0.z));\n    float n001 = gfsr_hash13(vec3(i0.x, i0.y, i1.z));\n    float n101 = gfsr_hash13(vec3(i1.x, i0.y, i1.z));\n    float n011 = gfsr_hash13(vec3(i0.x, i1.y, i1.z));\n    float n111 = gfsr_hash13(i1);\n    return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),\n               mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);\n}\n\nfloat gfsr_fbm2(vec2 p, vec2 period, int octaves)\n{\n    float sum = 0.0;\n    float amp = 0.5;\n    float norm = 0.0;\n    for (int i = 0; i < 8; i++) {\n        if (i >= octaves) {\n            break;\n        }\n        sum += amp * gfsr_noise2(p, period);\n        norm += amp;\n        p *= 2.0;\n        period *= 2.0;\n        amp *= 0.5;\n    }\n    return sum / max(norm, 1e-5);\n}\n\nfloat gfsr_fbm3(vec3 p, float period, int octaves)\n{\n    float sum = 0.0;\n    float amp = 0.5;\n    float norm = 0.0;\n    for (int i = 0; i < 8; i++) {\n        if (i >= octaves) {\n            break;\n        }\n        sum += amp * gfsr_noise3(p, period);\n        norm += amp;\n        p *= 2.0;\n        period *= 2.0;\n        amp *= 0.5;\n    }\n    return sum / max(norm, 1e-5);\n}\n\n// ---------------------------------------------------------------------------\n// Phase functions\n// ---------------------------------------------------------------------------\nfloat gfsr_phaseRayleigh(float nu)\n{\n    return 3.0 / (16.0 * GFSR_PI) * (1.0 + nu * nu);\n}\n\nfloat gfsr_phaseMie(float nu, float g)\n{\n    float g2 = g * g;\n    float denom = (2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * nu, 1e-4), 1.5);\n    return 3.0 / (8.0 * GFSR_PI) * ((1.0 - g2) * (1.0 + nu * nu)) / denom;\n}\n\nfloat gfsr_phaseHG(float nu, float g)\n{\n    float g2 = g * g;\n    return (1.0 - g2) / (4.0 * GFSR_PI * pow(max(1.0 + g2 - 2.0 * g * nu, 1e-4), 1.5));\n}\n\n// ---------------------------------------------------------------------------\n// Planet / atmosphere geometry (km, numerically stable for float32)\n// ---------------------------------------------------------------------------\n\n// Intersection of a ray starting at altitude camHKm (direction cosine mu with\n// the local up vector) with a spherical shell at altitude shellHKm.\n// Returns (tNear, tFar) in km. Both negative when the shell is missed.\nvec2 gfsr_shell(float camHKm, float mu, float shellHKm)\n{\n    float r = GFSR_R_KM + camHKm;\n    float b = r * mu;\n    float c = (camHKm - shellHKm) * (2.0 * GFSR_R_KM + camHKm + shellHKm);\n    float disc = b * b - c;\n    if (disc < 0.0) {\n        return vec2(-1.0);\n    }\n    float s = sqrt(disc);\n    float q = (b >= 0.0) ? (-b - s) : (-b + s);\n    if (abs(q) < 1e-6) {\n        return vec2(0.0);\n    }\n    float t0 = q;\n    float t1 = c / q;\n    return vec2(min(t0, t1), max(t0, t1));\n}\n\n// Altitude (km) reached after travelling tKm along a ray with zenith cosine mu.\nfloat gfsr_altAlong(float camHKm, float mu, float tKm)\n{\n    float r = GFSR_R_KM + camHKm;\n    return sqrt(max(r * r + 2.0 * r * mu * tKm + tKm * tKm, 0.0)) - GFSR_R_KM;\n}\n\nconst vec3 GFSR_BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);\nconst float GFSR_BETA_M = 3.996e-3;\nconst float GFSR_EXT_M = 4.40e-3;\nconst vec3 GFSR_BETA_O = vec3(0.650e-3, 1.881e-3, 0.085e-3);\nconst float GFSR_HR = 8.0;\nconst float GFSR_HM = 1.2;\n\n// Schueler's Chapman-function approximation: optical depth (in scale heights)\n// of an exponential atmosphere from normalised altitude h towards zenith cos mu.\nfloat gfsr_chapman(float X, float h, float mu)\n{\n    float c = sqrt(X + h);\n    if (mu >= 0.0) {\n        return c / (c * mu + 1.0) * exp(-h);\n    }\n    float x0 = sqrt(max(1.0 - mu * mu, 0.0)) * (X + h);\n    float c0 = sqrt(x0);\n    return 2.0 * c0 * exp(min(X - x0, 60.0)) - c / (1.0 - c * mu) * exp(-h);\n}\n\n// (rayleigh, mie, ozone) optical depth from altitude hKm towards the sun.\nvec3 gfsr_opticalDepthToSun(float hKm, float mu)\n{\n    float h = max(hKm, 0.0);\n    float odR = GFSR_HR * gfsr_chapman(GFSR_R_KM / GFSR_HR, h / GFSR_HR, mu);\n    float odM = GFSR_HM * gfsr_chapman(GFSR_R_KM / GFSR_HM, h / GFSR_HM, mu);\n    return vec3(odR, odM, odR * 1.875);\n}\n\nvec3 gfsr_densities(float hKm)\n{\n    float h = max(hKm, 0.0);\n    return vec3(exp(-h / GFSR_HR), exp(-h / GFSR_HM), max(0.0, 1.0 - abs(h - 25.0) / 15.0));\n}\n\nvec3 gfsr_extinction(vec3 od, float rayleigh, float mie, float ozone)\n{\n    return GFSR_BETA_R * (rayleigh * od.x) + vec3(GFSR_EXT_M * mie * od.y) + GFSR_BETA_O * (ozone * od.z);\n}\n\nvec3 gfsr_sunTransmittance(float hKm, float muS, float rayleigh, float mie, float ozone)\n{\n    return exp(-gfsr_extinction(gfsr_opticalDepthToSun(hKm, muS), rayleigh, mie, ozone));\n}\n\n// Single-scattering integrator (Rayleigh + Mie + ozone absorption).\n// rd and sunDir are ENU unit vectors, tMaxKm limits the ray (use a huge value\n// for sky pixels). Outputs linear in-scattered radiance and view transmittance.\nvoid gfsr_scatter(float camHKm, vec3 rd, vec3 sunDir, float tMaxKm,\n                  float rayleigh, float mie, float ozone, float steps,\n                  out vec3 inscatter, out vec3 transmittance)\n{\n    inscatter = vec3(0.0);\n    transmittance = vec3(1.0);\n\n    float mu = rd.z;\n    vec2 atmo = gfsr_shell(camHKm, mu, GFSR_ATMO_KM);\n    if (atmo.y <= 0.0) {\n        return;\n    }\n    float tStart = max(atmo.x, 0.0);\n    float tEnd = atmo.y;\n    vec2 ground = gfsr_shell(camHKm, mu, 0.0);\n    if (ground.x > 0.0) {\n        tEnd = min(tEnd, ground.x);\n    }\n    tEnd = min(tEnd, tMaxKm);\n    if (tEnd <= tStart) {\n        return;\n    }\n\n    float nu = dot(rd, sunDir);\n    float len = tEnd - tStart;\n    float n = max(steps, 1.0);\n    float r = GFSR_R_KM + camHKm;\n    vec3 odView = vec3(0.0);\n    vec3 sumR = vec3(0.0);\n    vec3 sumM = vec3(0.0);\n    float prevT = 0.0;\n\n    for (int i = 0; i < 24; i++) {\n        if (float(i) >= n) {\n            break;\n        }\n        // Quadratic distribution concentrates samples in the dense lower air.\n        float f1 = (float(i) + 1.0) / n;\n        float tNext = len * f1 * f1;\n        float dt = tNext - prevT;\n        float t = tStart + prevT + 0.5 * dt;\n        prevT = tNext;\n\n        float rS = sqrt(max(r * r + 2.0 * r * mu * t + t * t, 0.0));\n        float hS = rS - GFSR_R_KM;\n        float muS = (r * sunDir.z + t * nu) / max(rS, 1.0);\n\n        vec3 dens = gfsr_densities(hS);\n        odView += dens * dt;\n        vec3 odSun = gfsr_opticalDepthToSun(hS, muS);\n        vec3 att = exp(-gfsr_extinction(odView + odSun, rayleigh, mie, ozone));\n        sumR += dens.x * att * dt;\n        sumM += dens.y * att * dt;\n    }\n\n    const float SUN_INTENSITY = 20.0;\n    inscatter = SUN_INTENSITY * (sumR * GFSR_BETA_R * rayleigh * gfsr_phaseRayleigh(nu)\n                               + sumM * GFSR_BETA_M * mie * gfsr_phaseMie(nu, 0.76));\n    transmittance = exp(-gfsr_extinction(odView, rayleigh, mie, ozone));\n}\n\n// ---------------------------------------------------------------------------\n// Realism helpers (v2): cellular noise, projection, SSR, blackbody, sky approx\n// ---------------------------------------------------------------------------\n\n// Tileable 3D Worley (cellular) noise. Returns distance to the nearest\n// feature point in [0, ~1]; invert it for billowy cloud / canopy shapes.\nfloat gfsr_worley3(vec3 x, float period)\n{\n    vec3 i = floor(x);\n    vec3 f = fract(x);\n    float best = 1.0;\n    for (int z = -1; z <= 1; z++) {\n        for (int y = -1; y <= 1; y++) {\n            for (int xx = -1; xx <= 1; xx++) {\n                vec3 o = vec3(float(xx), float(y), float(z));\n                vec3 cell = mod(i + o, period);\n                vec3 jit = vec3(gfsr_hash13(cell), gfsr_hash13(cell + 17.31), gfsr_hash13(cell + 41.07));\n                vec3 d = o + jit - f;\n                best = min(best, dot(d, d));\n            }\n        }\n    }\n    return sqrt(best);\n}\n\n// Tileable 2D Worley noise. x = distance to nearest point, y = cell id hash,\n// zw = offset from the pixel to that feature point (in cells).\nvec4 gfsr_worley2(vec2 x, vec2 period)\n{\n    vec2 i = floor(x);\n    vec2 f = fract(x);\n    float best = 8.0;\n    float id = 0.0;\n    vec2 off = vec2(0.0);\n    for (int y = -1; y <= 1; y++) {\n        for (int xx = -1; xx <= 1; xx++) {\n            vec2 o = vec2(float(xx), float(y));\n            vec2 cell = mod(i + o, period);\n            vec2 jit = vec2(gfsr_hash12(cell), gfsr_hash12(cell + 23.17)) * 0.8 + 0.1;\n            vec2 d = o + jit - f;\n            float dd = dot(d, d);\n            if (dd < best) {\n                best = dd;\n                id = gfsr_hash12(cell + 7.7);\n                off = d;\n            }\n        }\n    }\n    return vec4(sqrt(best), id, off);\n}\n\nfloat gfsr_remap(float v, float lo, float hi, float nlo, float nhi)\n{\n    return nlo + (v - lo) / max(hi - lo, 1e-5) * (nhi - nlo);\n}\n\n// Eye-space point -> screen uv. z < 0 in the result means behind the camera.\nvec3 gfsr_projectEC(vec3 pEC)\n{\n    vec4 clip = czm_projection * vec4(pEC, 1.0);\n    if (clip.w <= 1e-5) {\n        return vec3(-1.0, -1.0, -1.0);\n    }\n    return vec3(clip.xy / clip.w * 0.5 + 0.5, 1.0);\n}\n\n// Screen-space reflection march (eye space). Returns rgb = reflected colour,\n// a = confidence (0 = miss, fall back to the IBL / analytic environment).\nvec4 gfsr_ssr(sampler2D colorTex, sampler2D depthTex, vec3 pEC, vec3 rEC,\n              float maxDist, float steps, float jitter)\n{\n    float n = max(steps, 4.0);\n    float prevT = 0.0;\n    for (int i = 0; i < 48; i++) {\n        if (float(i) >= n) {\n            break;\n        }\n        float f = (float(i) + jitter) / n;\n        float t = maxDist * f * f + 0.25;\n        vec3 p = pEC + rEC * t;\n        if (p.z > -0.05) {\n            break;\n        }\n        vec3 s = gfsr_projectEC(p);\n        if (s.z < 0.0 || s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {\n            break;\n        }\n        float raw = texture2D(depthTex, s.xy).r;\n        if (!gfsr_isSkyDepth(raw)) {\n            vec3 q = gfsr_eyePosition(depthTex, s.xy);\n            float diff = -p.z - (-q.z);\n            float thick = max(0.6, (t - prevT) * 1.5 + -q.z * 0.01);\n            if (diff > 0.0 && diff < thick) {\n                // Binary refinement between the previous and current sample.\n                float a = prevT;\n                float b = t;\n                vec2 hitUv = s.xy;\n                for (int k = 0; k < 5; k++) {\n                    float m = 0.5 * (a + b);\n                    vec3 pm = pEC + rEC * m;\n                    vec3 sm = gfsr_projectEC(pm);\n                    vec3 qm = gfsr_eyePosition(depthTex, sm.xy);\n                    if (-pm.z > -qm.z) {\n                        b = m;\n                        hitUv = sm.xy;\n                    } else {\n                        a = m;\n                    }\n                }\n                vec2 e = min(hitUv, 1.0 - hitUv);\n                float edge = smoothstep(0.0, 0.08, min(e.x, e.y));\n                float conf = edge * (1.0 - f * f);\n                return vec4(texture2D(colorTex, hitUv).rgb, conf);\n            }\n        }\n        prevT = t;\n    }\n    return vec4(0.0);\n}\n\n// Approximate normalised blackbody colour (linear sRGB) for 1000..12000 K.\nvec3 gfsr_blackbody(float kelvin)\n{\n    float t = clamp(kelvin, 1000.0, 12000.0) / 100.0;\n    float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);\n    float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)\n                        : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);\n    float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));\n    return gfsr_toLinear(vec3(r, g, b));\n}\n\n// Cheap closed-form sky radiance (linear, display-scaled) used where the full\n// single-scatter integral would be too expensive (IBL fallback, wet surfaces).\nvec3 gfsr_skyApprox(vec3 dir, vec3 sunDir, float camHKm, float overcast)\n{\n    float day = smoothstep(-0.12, 0.05, sunDir.z);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, max(sunDir.z, 0.0), 1.0, 1.0, 1.0);\n    float up = max(dir.z, 0.0);\n    float horizon = exp(-up * 6.0);\n    vec3 zenith = vec3(0.10, 0.22, 0.55) * exp(-camHKm * 0.06);\n    vec3 hor = vec3(0.55, 0.65, 0.78);\n    vec3 sky = mix(zenith, hor, horizon) * (0.35 + 0.65 * sunT);\n    float nu = max(dot(dir, sunDir), 0.0);\n    sky += sunT * pow(nu, 12.0) * 0.6;\n    if (dir.z < 0.0) {\n        sky = mix(hor * 0.6, vec3(0.08, 0.085, 0.07), smoothstep(0.0, 0.25, -dir.z)) * (0.3 + 0.7 * sunT);\n    }\n    sky = mix(sky, vec3(gfsr_luma(sky)) * vec3(0.95, 0.97, 1.0), overcast * 0.8);\n    return sky * mix(0.015, 1.0, day);\n}\n\n// Smooth mask (0..1) of pixels belonging to the user's aircraft.\n// acDist = camera -> aircraft origin distance, r = bounding radius.\nfloat gfsr_aircraftMask(float dist, float acDist, float r)\n{\n    if (acDist <= 0.0) {\n        return 0.0;\n    }\n    float cockpit = 1.0 - smoothstep(r * 0.6, r, acDist);\n    float edge = r * 0.15;\n    float inside = smoothstep(acDist - r - edge, acDist - r + edge, dist)\n                 * (1.0 - smoothstep(acDist + r - edge, acDist + r + edge, dist));\n    float cockpitMask = 1.0 - smoothstep(r * 0.9, r * 1.2, dist);\n    return mix(inside, cockpitMask, cockpit);\n}\n",
        "fog": "// GeoFS-ReShade : fog.glsl\n// Depth-buffer fog with exponential height falloff.\n//\n//   fog = 1.0 - exp(-distance * density)\n//\n// `density` is the height-integrated density along the view ray, so valleys\n// fill with haze while mountain tops stay clear. Distant terrain and the\n// horizon band of the sky converge to the same colour, hiding terrain pop-in\n// and blending mountains into the horizon.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program fog\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_fogDensity;   // user density (scaled to 1e-4 per metre)\nuniform float u_fogHeight;    // height falloff scale (m)\nuniform float u_fogStart;     // distance where fog begins (m)\nuniform float u_fogMaxDistance; // distance used for the sky horizon band (m)\nuniform vec3 u_fogColor;      // sRGB\nuniform float u_fogSkyTint;   // 0 = flat colour, 1 = sun-lit atmospheric tint\nuniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog\n\nfloat heightIntegratedDensity(float density, float camAlt, float dz, float H)\n{\n    // Average of density * exp(-h / H) along a ray from camAlt rising by dz.\n    float base = density * exp(-max(camAlt, 0.0) / H);\n    float k = dz / H;\n    if (abs(k) < 1e-3) {\n        return base;\n    }\n    return base * (1.0 - exp(-k)) / k;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n\n    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float H = max(u_fogHeight, 10.0);\n    float density = u_fogDensity * 1.0e-4 * (1.0 + u_weather.w * 8.0 + u_weather.z * 3.0 + u_weather.y * 2.0);\n\n    // Fog colour: user colour, optionally lit by the low sun and darkened at night.\n    float day = smoothstep(-0.12, 0.05, sunDir.z);\n    vec3 sunT = gfsr_sunTransmittance(max(u_camHeight, 1.0) * 0.001, sunDir.z, 1.0, 1.0, 1.0);\n    float nu = dot(rd, sunDir);\n    vec3 lit = u_fogColor * (0.55 + 0.6 * sunT) + sunT * pow(max(nu, 0.0), 8.0) * 0.35;\n    vec3 fogCol = mix(u_fogColor, lit, u_fogSkyTint);\n    fogCol *= mix(0.05, 1.0, day);\n    fogCol = mix(fogCol, vec3(gfsr_luma(fogCol)) * vec3(0.85, 0.9, 0.95), u_weather.y * 0.6);\n\n    float dist;\n    float dz;\n    if (gfsr_isSkyDepth(raw)) {\n        // Only a band around the horizon is fogged so it matches distant terrain.\n        dist = u_fogMaxDistance;\n        dz = rd.z * dist;\n        float band = 1.0 - smoothstep(0.0, 0.18, max(rd.z, 0.0));\n        float f = 1.0 - exp(-max(dist - u_fogStart, 0.0) * heightIntegratedDensity(density, u_camHeight, dz, H));\n        gl_FragColor = vec4(mix(src.rgb, fogCol, f * band), src.a);\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    dist = length(pEC);\n    vec3 p = u_eyeToEnu * pEC;\n    dz = p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);\n    float d = max(dist - u_fogStart, 0.0);\n    float fog = 1.0 - exp(-d * heightIntegratedDensity(density, u_camHeight, dz, H));\n    gl_FragColor = vec4(mix(src.rgb, fogCol, clamp(fog, 0.0, 1.0)), src.a);\n}\n",
        "godrays": "// GeoFS-ReShade : godrays.glsl\n// Screen-space crepuscular rays (sun shafts).\n//\n//   godrays_mask   (1/2 res)  occlusion mask: sky pixels near the sun, dimmed by\n//                             clouds already composited into the frame (cloud interaction)\n//   godrays_blur   (1/2 res)  radial blur towards the sun (Mitchell / GPU Gems 3)\n//   godrays_apply  (full)     atmospheric tinting, additive composite, sun glare\n//\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\nuniform mat3 u_eyeToEnu;\nuniform float u_aspect; // width / height\n\nfloat sunFacing()\n{\n    // 1 when the sun is in front of the camera, fading out towards the edges.\n    vec3 s = gfsr_sunScreen();\n    if (s.z < 0.5) {\n        return 0.0;\n    }\n    vec2 d = max(abs(s.xy - 0.5) - 0.5, 0.0);\n    return 1.0 - smoothstep(0.0, 0.6, length(d));\n}\n\n// @program godrays_mask\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec3 sun = gfsr_sunScreen();\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    vec3 col = texture2D(colorTexture, uv).rgb;\n\n    float sky = gfsr_isSkyDepth(raw) ? 1.0 : 0.0;\n    vec2 d = (uv - sun.xy) * vec2(u_aspect, 1.0);\n    float dist = length(d);\n    float nearSun = exp(-dist * 5.0);\n\n    // Clouds composited earlier are bright on their sunlit side but block the\n    // disk: weighting by a high luma threshold makes them cast shadow shafts.\n    float l = gfsr_luma(col);\n    float bright = smoothstep(0.72, 1.0, l);\n\n    vec3 sunDirEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float day = smoothstep(-0.05, 0.08, sunDirEnu.z);\n    float m = sky * bright * nearSun * day;\n    gl_FragColor = vec4(col * m, m);\n}\n\n// @program godrays_blur\nuniform float u_samples;\nuniform float u_length;\nuniform float u_decay;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec3 sun = gfsr_sunScreen();\n    vec2 delta = (uv - sun.xy) * (u_length / max(u_samples, 1.0));\n    float jitter = gfsr_ign(gl_FragCoord.xy);\n    vec2 cur = uv - delta * jitter;\n    vec4 sum = vec4(0.0);\n    float illum = 1.0;\n    float wsum = 0.0;\n    for (int i = 0; i < 128; i++) {\n        if (float(i) >= u_samples) {\n            break;\n        }\n        vec4 s = texture2D(colorTexture, clamp(cur, 0.0, 1.0));\n        sum += s * illum;\n        wsum += illum;\n        illum *= u_decay;\n        cur -= delta;\n    }\n    gl_FragColor = sum / max(wsum, 1e-4) * 1.25;\n}\n\n// @program godrays_apply\nuniform sampler2D u_raysTexture;\nuniform vec2 u_raysDims;\nuniform float u_strength;\nuniform float u_glare;\nuniform float u_camHeight;\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform vec4 u_weather;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 lin = gfsr_toLinear(src.rgb);\n\n    vec3 sunDirEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    // Atmospheric scattering colours the shafts: white at noon, gold at sunset.\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDirEnu.z, u_rayleigh, u_mie, 0.6);\n    vec3 tint = normalize(sunT + 1e-4) * 1.7320508;\n    float facing = sunFacing();\n    float overcast = u_weather.x;\n    // Broken cloud cover produces the strongest visible shafts; full overcast hides the sun.\n    float cloudBoost = 1.0 + overcast * 1.2 * (1.0 - smoothstep(0.7, 1.0, overcast) * 0.9);\n    float fogBoost = 1.0 + u_weather.w * 1.5;\n\n    vec4 rays = gfsr_textureBilinear(u_raysTexture, uv, u_raysDims);\n    vec3 shafts = gfsr_toLinear(rays.rgb) * tint * u_strength * facing * cloudBoost * fogBoost;\n\n    // Sun glare: wide soft glow around the sun disk, visible when the sun itself is visible.\n    vec3 sun = gfsr_sunScreen();\n    vec2 d = (uv - sun.xy) * vec2(u_aspect, 1.0);\n    float dist = length(d);\n    float vis = gfsr_textureBilinear(u_raysTexture, clamp(sun.xy, 0.0, 1.0), u_raysDims).a;\n    float glare = (exp(-dist * 9.0) * 0.6 + exp(-dist * 2.5) * 0.15) * vis * facing;\n    glare *= u_glare * (1.0 - overcast * 0.8);\n    vec3 glareCol = sunT * glare;\n\n    // Screen-style blend: shafts brighten darker areas without clipping already bright clouds.\n    vec3 add = (shafts * 0.7 + glareCol);\n    lin += add * max(vec3(1.0) - lin * 0.85, vec3(0.0));\n    vec3 outLin = lin / (1.0 + max(lin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n",
        "lens": "// GeoFS-ReShade : lens.glsl\n// Camera lens effects.\n//\n//   lens_flare  sun lens flare: ghosts along the sun-centre axis, halo ring,\n//               starburst; occluded by terrain (depth) and by clouds (frame luma)\n//   lens_final  chromatic aberration + vignette (last stage of the pipeline)\n//\n// Bloom streaks live in bloom.glsl (bloom_streak).\n//\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\n// @program lens_flare\nuniform sampler2D depthTexture;\nuniform mat3 u_eyeToEnu;\nuniform float u_aspect;\nuniform float u_flareIntensity;\nuniform float u_ghosts;\nuniform float u_halo;\nuniform float u_starburst;\nuniform vec4 u_weather;\n\nfloat sunVisibility(vec2 sunUv)\n{\n    float vis = 0.0;\n    for (int y = -2; y <= 2; y++) {\n        for (int x = -2; x <= 2; x++) {\n            vec2 o = vec2(float(x), float(y)) * 0.004 * vec2(1.0 / u_aspect, 1.0);\n            vec2 suv = sunUv + o;\n            if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) {\n                continue;\n            }\n            float raw = gfsr_rawDepth(depthTexture, suv);\n            float sky = gfsr_isSkyDepth(raw) ? 1.0 : 0.0;\n            // Clouds composited into the frame dim the sun region.\n            float l = gfsr_luma(texture2D(colorTexture, suv).rgb);\n            vis += sky * smoothstep(0.6, 0.92, l);\n        }\n    }\n    return vis / 25.0;\n}\n\nfloat ghostDisk(vec2 p, vec2 centre, float radius, float softness)\n{\n    float d = length(p - centre);\n    return 1.0 - smoothstep(radius * (1.0 - softness), radius, d);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 sun = gfsr_sunScreen();\n    vec3 sunEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float day = smoothstep(-0.03, 0.06, sunEnu.z);\n    if (sun.z < 0.5 || day <= 0.0 || u_flareIntensity <= 0.0) {\n        gl_FragColor = src;\n        return;\n    }\n    float onScreen = 1.0 - smoothstep(0.0, 0.25, length(max(abs(sun.xy - 0.5) - 0.5, 0.0)));\n    float vis = sunVisibility(clamp(sun.xy, 0.0, 1.0)) * onScreen * day * (1.0 - u_weather.x * 0.9);\n    if (vis <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec2 asp = vec2(u_aspect, 1.0);\n    vec2 p = (uv - 0.5) * asp;\n    vec2 s = (sun.xy - 0.5) * asp;\n    vec3 flare = vec3(0.0);\n\n    // Ghosts: reflections between lens elements mirrored through the centre.\n    vec3 ghostCol0 = vec3(0.35, 0.55, 1.0);\n    vec3 ghostCol1 = vec3(1.0, 0.65, 0.3);\n    vec3 ghostCol2 = vec3(0.45, 1.0, 0.55);\n    vec3 ghostCol3 = vec3(0.9, 0.4, 1.0);\n    flare += ghostDisk(p, s * -0.35, 0.035, 0.5) * ghostCol0 * 0.35;\n    flare += ghostDisk(p, s * -0.6, 0.075, 0.25) * ghostCol1 * 0.18;\n    flare += ghostDisk(p, s * -1.0, 0.05, 0.6) * ghostCol2 * 0.22;\n    flare += ghostDisk(p, s * 0.45, 0.02, 0.4) * ghostCol3 * 0.3;\n    flare += ghostDisk(p, s * -1.45, 0.12, 0.15) * ghostCol0 * 0.08;\n    flare += ghostDisk(p, s * 0.2, 0.012, 0.5) * ghostCol1 * 0.4;\n    flare *= u_ghosts;\n\n    // Halo: chromatic ring centred on the sun.\n    float dSun = length(p - s);\n    float ringR = 0.32;\n    float ring = exp(-(dSun - ringR) * (dSun - ringR) * 784.0);\n    vec3 dr = vec3(dSun) - vec3(ringR * 1.02, ringR, ringR * 0.98);\n    vec3 haloCol = exp(-dr * dr * 900.0);\n    flare += (haloCol * 0.6 + ring * 0.2) * 0.25 * u_halo;\n\n    // Starburst: angular streaks around the sun from the aperture blades.\n    vec2 ds = p - s;\n    float ang = atan(ds.y, ds.x);\n    float rays = pow(abs(cos(ang * 3.0)), 60.0) + pow(abs(cos(ang * 3.0 + 1.0472)), 60.0) * 0.7;\n    rays += gfsr_noise2(vec2(ang * 12.0, 0.0), vec2(75.0, 1.0)) * 0.35;\n    float burst = rays * exp(-dSun * 7.0) * 0.9 + exp(-dSun * 22.0) * 0.8;\n    flare += vec3(1.0, 0.95, 0.85) * burst * u_starburst;\n\n    vec3 sunTint = mix(vec3(1.0, 0.55, 0.3), vec3(1.0), smoothstep(0.0, 0.35, sunEnu.z));\n    vec3 lin = gfsr_toLinear(src.rgb) + flare * sunTint * vis * u_flareIntensity;\n    lin = lin / (1.0 + max(lin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(lin), src.a);\n}\n\n// @program lens_final\nuniform float u_aspect;\nuniform float u_chromatic;      // 0..1\nuniform float u_vignette;       // 0..1\nuniform float u_vignetteRadius; // 0.3..1.2\nuniform float u_vignetteSoftness;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec2 c = uv - 0.5;\n    float r2 = dot(c * vec2(u_aspect, 1.0), c * vec2(u_aspect, 1.0));\n    vec4 src = texture2D(colorTexture, uv);\n    vec3 col = src.rgb;\n\n    if (u_chromatic > 0.0) {\n        // Radial lateral chromatic aberration, increasing towards the edges.\n        vec2 off = c * r2 * u_chromatic * 0.02;\n        float rr = texture2D(colorTexture, uv - off).r;\n        float bb = texture2D(colorTexture, uv + off).b;\n        float rr2 = texture2D(colorTexture, uv - off * 0.5).r;\n        float bb2 = texture2D(colorTexture, uv + off * 0.5).b;\n        col = vec3((rr + rr2) * 0.5, col.g, (bb + bb2) * 0.5);\n    }\n\n    if (u_vignette > 0.0) {\n        float d = sqrt(r2);\n        float v = 1.0 - smoothstep(u_vignetteRadius - max(u_vignetteSoftness, 0.01), u_vignetteRadius, d);\n        col *= mix(1.0, v, u_vignette);\n    }\n\n    col += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;\n    gl_FragColor = vec4(col, src.a);\n}\n",
        "reflections": "// GeoFS-ReShade : reflections.glsl\n// Approximate image-based reflections on the aircraft, without model edits.\n//\n// Aircraft pixels are isolated using the known camera -> aircraft distance\n// (provided every frame from JavaScript): every surface within the aircraft's\n// bounding radius receives\n//   * Schlick Fresnel (configurable power)\n//   * environment reflection sampled from the analytic sky (Rayleigh + Mie),\n//     with a ground hemisphere below the horizon\n//   * roughness-dependent blur of the environment (multi-tap cone)\n//   * GGX sun specular (metal / wing glints)\n//   * canopy enhancement for dark, low saturation glass-like pixels\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program reflections\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform vec2 u_texel;\nuniform float u_aircraftDistance; // metres, camera -> aircraft origin\nuniform float u_aircraftRadius;   // metres, bounding radius\nuniform float u_strength;\nuniform float u_fresnelPower;\nuniform float u_roughness;\nuniform float u_metallic;\nuniform float u_canopyBoost;\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform vec4 u_weather;\nuniform vec4 u_pbr;               // x SSR on/off, y SSR steps, z light-direction response, w weathering\nuniform vec4 u_moisture;          // x humidity, y wetness, z temperature (C), w unused\n\nvec3 environment(vec3 dir, vec3 sunDir, float camHKm, float mie, float day)\n{\n    vec3 d = dir;\n    float below = 0.0;\n    if (d.z < 0.0) {\n        below = smoothstep(0.0, 0.08, -d.z);\n        d.z = abs(d.z) * 0.25 + 0.01;\n        d = normalize(d);\n    }\n    vec3 L;\n    vec3 T;\n    gfsr_scatter(camHKm, d, sunDir, 1.0e9, u_rayleigh, mie, 0.6, 6.0, L, T);\n    vec3 sky = 1.0 - exp(-L);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);\n    vec3 ground = vec3(0.09, 0.085, 0.07) * (0.2 + 0.8 * max(sunDir.z, 0.0)) * sunT + sky * 0.25;\n    vec3 env = mix(sky, ground, below);\n    return env * mix(0.08, 1.0, day);\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw) || u_aircraftDistance <= 0.0) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    float dist = length(pEC);\n    float r = max(u_aircraftRadius, 1.0);\n    float cockpit = 1.0 - smoothstep(r * 0.6, r, u_aircraftDistance);\n    float nearD = u_aircraftDistance - r;\n    float farD = u_aircraftDistance + r;\n    float edge = r * 0.15;\n    float inside = smoothstep(nearD - edge, nearD + edge, dist) * (1.0 - smoothstep(farD - edge, farD + edge, dist));\n    // Cockpit view: only the visible airframe close to the camera.\n    float cockpitMask = 1.0 - smoothstep(r * 0.9, r * 1.2, dist);\n    float mask = mix(inside, cockpitMask * 0.35, cockpit);\n    if (mask <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel, pEC);\n    vec3 vEC = normalize(-pEC);\n    if (dot(nEC, vEC) < 0.0) {\n        nEC = -nEC;\n    }\n    vec3 N = normalize(u_eyeToEnu * nEC);\n    vec3 V = normalize(u_eyeToEnu * vEC);\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float mie = u_mie * (1.0 + u_weather.x * 1.5);\n    float day = smoothstep(-0.1, 0.05, sunDir.z);\n    float overcast = u_weather.x;\n\n    vec3 base = gfsr_toLinear(src.rgb);\n    float l = gfsr_luma(src.rgb);\n    float mx = max(src.r, max(src.g, src.b));\n    float mn = min(src.r, min(src.g, src.b));\n    float sat = mx - mn;\n\n    // Glass heuristic: dark and desaturated surfaces get a smoother, stronger mirror.\n    float glass = (1.0 - smoothstep(0.08, 0.28, l)) * (1.0 - smoothstep(0.05, 0.2, sat)) * u_canopyBoost;\n    // Weathering: darker, dirtier paint is rougher; a wet skin is much smoother.\n    float grime = (1.0 - smoothstep(0.15, 0.6, l)) * u_pbr.w;\n    float rough = clamp(mix(u_roughness, u_roughness * 0.2, glass) + grime * 0.25, 0.02, 1.0);\n    rough = mix(rough, rough * 0.35, u_moisture.y * (1.0 - glass));\n\n    float NdotV = clamp(dot(N, V), 0.0, 1.0);\n    float F0 = mix(0.04, 0.55, u_metallic);\n    F0 = mix(F0, 0.06, glass);\n    float fresnel = F0 + (1.0 - F0) * pow(max(1.0 - NdotV, 0.0), u_fresnelPower);\n    fresnel *= mix(1.0, 0.45, rough);\n\n    // Roughness blur: average a small cone of reflection directions.\n    vec3 R = reflect(-V, N);\n    vec3 t1 = normalize(abs(R.z) < 0.95 ? cross(R, vec3(0.0, 0.0, 1.0)) : cross(R, vec3(1.0, 0.0, 0.0)));\n    vec3 t2 = cross(R, t1);\n    float cone = rough * rough * 0.9;\n    vec3 env = environment(R, sunDir, camHKm, mie, day) * 2.0;\n    env += environment(normalize(R + t1 * cone), sunDir, camHKm, mie, day);\n    env += environment(normalize(R - t1 * cone), sunDir, camHKm, mie, day);\n    env += environment(normalize(R + t2 * cone), sunDir, camHKm, mie, day);\n    env += environment(normalize(R - t2 * cone), sunDir, camHKm, mie, day);\n    env /= 6.0;\n    env = mix(env, vec3(gfsr_luma(env)), overcast * 0.6);\n\n    // SSR always takes priority over the analytic environment probe.\n    if (u_pbr.x > 0.5 && rough < 0.6) {\n        vec3 rEC = normalize(reflect(-vEC, nEC));\n        float jitter = gfsr_ign(gl_FragCoord.xy);\n        vec4 ssr = gfsr_ssr(colorTexture, depthTexture, pEC + nEC * 0.05, rEC, max(u_aircraftRadius * 6.0, 40.0), u_pbr.y, jitter);\n        float conf = ssr.a * (1.0 - smoothstep(0.2, 0.6, rough));\n        env = mix(env, gfsr_toLinear(ssr.rgb), conf);\n    }\n\n    // GGX sun specular.\n    vec3 H = normalize(V + sunDir);\n    float NdotH = max(dot(N, H), 0.0);\n    float NdotL = max(dot(N, sunDir), 0.0);\n    float a = rough * rough;\n    float a2 = a * a;\n    float dd = NdotH * NdotH * (a2 - 1.0) + 1.0;\n    float D = a2 / (3.14159265 * dd * dd + 1e-6);\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);\n    vec3 spec = sunT * D * fresnel * NdotL * 0.25 * day * (1.0 - overcast * 0.85);\n\n    // Metals tint the reflection with the base colour.\n    vec3 reflTint = mix(vec3(1.0), base / max(gfsr_luma(base), 0.05), u_metallic * 0.5 * (1.0 - glass));\n    vec3 refl = env * reflTint;\n    float k = u_strength * mask;\n\n    // Directional response: the stock shading is almost flat, so re-shape it\n    // towards Lambert relative to a flat-lit reference (keeps average exposure).\n    float wrapL = clamp((dot(N, sunDir) + 0.25) / 1.25, 0.0, 1.0);\n    float relight = mix(0.62, 1.22, wrapL) * mix(1.0, 0.92, overcast);\n    base *= mix(1.0, mix(1.0, relight, day), u_pbr.z * mask * (1.0 - glass * 0.7));\n\n    vec3 outLin = mix(base, refl, clamp(fresnel * k, 0.0, 1.0));\n    outLin += spec * k * (1.0 + glass);\n    outLin = outLin / (1.0 + max(outLin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n",
        "ssao": "// GeoFS-ReShade : ssao.glsl\n// Screen Space Ambient Occlusion.\n//\n//   Inputs : depth buffer + normals reconstructed from depth\n//   Output : terrain crevice darkening, aircraft self-shadowing and cockpit\n//            ambient shading\n//\n// The sampling radius grows with distance so that the same effect works for\n// the cockpit (centimetres), the airframe (metres) and terrain (hundreds of m).\n//\n// Pipeline: ssao_generate (half res) -> ssao_blur (H) -> ssao_blur (V) -> ssao_apply\n// Requires common.glsl (prepended by the loader).\n\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\nuniform vec2 u_texel; // full-resolution texel size\n\n// @program ssao_generate\nuniform float u_radius;\nuniform float u_bias;\nuniform float u_strength;\nuniform float u_samples;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        gl_FragColor = vec4(1.0);\n        return;\n    }\n\n    vec3 p = gfsr_eyePosition(depthTexture, uv);\n    float dist = length(p);\n    vec3 n = gfsr_normalEC(depthTexture, uv, u_texel, p);\n\n    float radius = u_radius * clamp(dist / 50.0, 0.15, 200.0);\n    float projScale = czm_projection[1][1] * 0.5 / max(-p.z, 0.05);\n    float screenR = clamp(radius * projScale, 2.0 * u_texel.y, 0.15);\n\n    float n_s = max(u_samples, 1.0);\n    float angle0 = gfsr_ign(gl_FragCoord.xy) * 6.2831853;\n    float xScale = u_texel.x / u_texel.y; // converts uv-y radius into uv-x\n    float occlusion = 0.0;\n\n    for (int i = 0; i < 32; i++) {\n        if (float(i) >= n_s) {\n            break;\n        }\n        // Golden-angle spiral, radius grows with sqrt(i) for even coverage.\n        float fi = (float(i) + 0.5) / n_s;\n        float ang = angle0 + float(i) * 2.39996323;\n        vec2 dir = vec2(cos(ang) * xScale, sin(ang));\n        vec2 suv = uv + dir * screenR * sqrt(fi);\n        if (suv.x <= 0.0 || suv.y <= 0.0 || suv.x >= 1.0 || suv.y >= 1.0) {\n            continue;\n        }\n        if (gfsr_isSkyDepth(gfsr_rawDepth(depthTexture, suv))) {\n            continue;\n        }\n        vec3 q = gfsr_eyePosition(depthTexture, suv);\n        vec3 v = q - p;\n        float vl = length(v);\n        float ndv = dot(n, v) / max(vl, 1e-4);\n        float range = 1.0 - smoothstep(radius * 0.75, radius * 2.0, vl);\n        occlusion += max(ndv - u_bias, 0.0) * range;\n    }\n\n    occlusion = occlusion / n_s;\n    float distFade = 1.0 - smoothstep(30000.0, 80000.0, dist);\n    float ao = 1.0 - clamp(occlusion * u_strength * 1.6, 0.0, 1.0) * distFade;\n    gl_FragColor = vec4(ao, ao, ao, 1.0);\n}\n\n// @program ssao_blur\nuniform vec2 u_direction; // (1,0) or (0,1)\nuniform vec2 u_sourceTexel; // texel size of the half-resolution AO buffer\n\nfloat linearDistance(vec2 uv)\n{\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        return 1.0e7;\n    }\n    return length(gfsr_eyePosition(depthTexture, uv));\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float centerD = linearDistance(uv);\n    float logC = log(max(centerD, 0.01));\n    float sum = 0.0;\n    float wsum = 0.0;\n    for (int i = -4; i <= 4; i++) {\n        float fi = float(i);\n        vec2 suv = uv + u_direction * u_sourceTexel * fi * 1.5;\n        float g = exp(-fi * fi / 8.0);\n        float d = linearDistance(suv);\n        float w = g / (0.02 + abs(log(max(d, 0.01)) - logC) * 8.0);\n        sum += texture2D(colorTexture, suv).r * w;\n        wsum += w;\n    }\n    float ao = sum / max(wsum, 1e-5);\n    gl_FragColor = vec4(ao, ao, ao, 1.0);\n}\n\n// @program ssao_apply\nuniform sampler2D u_aoTexture;\nuniform vec2 u_aoDims;\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float ao = gfsr_textureBilinear(u_aoTexture, uv, u_aoDims).r;\n    // Occlusion mostly affects ambient light: keep highlights partially lit.\n    float l = gfsr_luma(src.rgb);\n    float applied = mix(ao, 1.0, smoothstep(0.75, 1.0, l) * 0.5);\n    gl_FragColor = vec4(src.rgb * applied, src.a);\n}\n",
        "terrain": "// GeoFS-ReShade : terrain.glsl\n// Terrain & forest realism pass (runs first, on the raw scene colour).\n//\n// GeoFS draws the globe unlit: satellite imagery with its capture-time lighting\n// baked in, so mountains look flat and forests look painted. This pass works\n// purely from the depth buffer and the imagery colour:\n//\n//   * Terrain normal reconstruction (distance-adaptive stride)\n//   * Slope-aware physically based lighting (sun + sky ambient), expressed as a\n//     ratio to flat ground so the imagery albedo is preserved\n//   * Terrain self-shadowing and contact shadows (screen-space ray march\n//     towards the sun; sharp near the occluder, soft with distance)\n//   * Elevation / slope / humidity driven materials: grass, dirt, rock, snow,\n//     sand micro-detail in world-locked coordinates (no blurry imagery)\n//   * Forest canopy: per-tree crowns (Worley cells) with varied size and\n//     colour, sun-shaded domes, shadowed gaps, LOD to a volumetric canopy\n//     response (darker shadow side + opposition hotspot) at altitude\n//   * Wet surfaces: darkened porous ground, puddles, rain ripples and\n//     screen-space reflections on wet runways\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program terrain\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_time;\nuniform vec2 u_texel;\nuniform vec2 u_worldOffset;      // camera-locked ENU offset, wraps every 4096 m\nuniform float u_pixelAngle;      // radians per pixel\nuniform float u_aircraftDistance;\nuniform float u_aircraftRadius;\nuniform vec4 u_terrain;          // x lighting, y micro detail, z materials, w forest\nuniform vec4 u_terrain2;         // x snowline (m), y shadow strength, z shadow steps, w wet reflections\nuniform vec4 u_moisture;         // x humidity, y wetness, z sea-level temperature (C), w unused\nuniform vec4 u_weather;          // x overcast, y storm, z precipitation, w fog\n\nconst vec2 WORLD_PERIOD = vec2(4096.0);\n\n// Band-limited world-locked value noise: fades out once a noise cell is\n// smaller than ~2 pixels so distant terrain never shimmers.\nfloat detailNoise(vec2 wp, float cell, float footprint)\n{\n    float fade = 1.0 - smoothstep(cell * 0.35, cell * 1.5, footprint);\n    if (fade <= 0.0) {\n        return 0.5;\n    }\n    return mix(0.5, gfsr_noise2(wp / cell, WORLD_PERIOD / cell), fade);\n}\n\n// Screen-space shadow ray towards the sun. Returns 1 = lit, 0 = shadowed.\nfloat screenShadow(vec3 pEC, vec3 lEC, float dist, float steps, float jitter)\n{\n    float maxT = clamp(dist * 0.35, 2.0, 12000.0);\n    float occl = 0.0;\n    float n = max(steps, 2.0);\n    for (int i = 0; i < 32; i++) {\n        if (float(i) >= n) {\n            break;\n        }\n        float f = (float(i) + jitter) / n;\n        float t = maxT * f * f + dist * 0.002;\n        vec3 p = pEC + lEC * t;\n        if (p.z > -0.05) {\n            break;\n        }\n        vec3 s = gfsr_projectEC(p);\n        if (s.z < 0.0 || s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {\n            break;\n        }\n        float raw = texture2D(depthTexture, s.xy).r;\n        if (gfsr_isSkyDepth(raw)) {\n            continue;\n        }\n        vec3 q = gfsr_eyePosition(depthTexture, s.xy);\n        float diff = (-p.z) - (-q.z);\n        float bias = -p.z * 0.004 + 0.05;\n        float thick = max(t * 0.6, 3.0) + -p.z * 0.02;\n        if (diff > bias && diff < thick) {\n            // Occluders close to the receiver give hard contact shadows,\n            // distant occluders give a soft penumbra.\n            float hard = 1.0 - f * 0.6;\n            occl = max(occl, hard * smoothstep(bias, bias * 3.0 + 0.2, diff));\n        }\n    }\n    return 1.0 - occl;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    float dist = length(pEC);\n    float acMask = gfsr_aircraftMask(dist, u_aircraftDistance, max(u_aircraftRadius, 1.0));\n    if (acMask > 0.5) {\n        gl_FragColor = src;\n        return;\n    }\n\n    // Distance-adaptive normal reconstruction: wider stride far away hides\n    // depth quantisation, single-texel stride near the camera keeps detail.\n    float stride = clamp(dist / 3000.0, 1.0, 3.0);\n    vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel * stride, pEC);\n    vec3 vEC = normalize(-pEC);\n    if (dot(nEC, vEC) < 0.0) {\n        nEC = -nEC;\n    }\n    vec3 N = normalize(u_eyeToEnu * nEC);\n    vec3 V = normalize(u_eyeToEnu * vEC);\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    vec3 p = u_eyeToEnu * pEC;\n    float alt = u_camHeight + p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);\n    vec2 wp = mod(p.xy + u_worldOffset, WORLD_PERIOD);\n    float footprint = dist * max(u_pixelAngle, 1e-5) / max(dot(N, V), 0.25);\n    float jitter = gfsr_ign(gl_FragCoord.xy);\n\n    vec3 col = gfsr_toLinear(src.rgb);\n    float l = gfsr_luma(src.rgb);\n    float mx = max(src.r, max(src.g, src.b));\n    float mn = min(src.r, min(src.g, src.b));\n    float sat = (mx - mn) / max(mx, 1e-3);\n    float slope = 1.0 - clamp(N.z, 0.0, 1.0);\n    float day = smoothstep(-0.05, 0.08, sunDir.z);\n    float overcast = clamp(u_weather.x + u_weather.y * 0.5, 0.0, 1.0);\n    float humidity = u_moisture.x;\n    float wet = u_moisture.y;\n    float dFade = 1.0 - smoothstep(60000.0, 160000.0, dist);\n\n    // ---------------- Material classification -----------------\n    float veg = smoothstep(0.0, 0.06, src.g - max(src.r, src.b * 0.95)) * smoothstep(0.05, 0.18, sat);\n    float forest = veg * (1.0 - smoothstep(0.14, 0.26, l));\n    float grass = veg * (1.0 - forest);\n    float snowPix = smoothstep(0.62, 0.8, l) * (1.0 - smoothstep(0.08, 0.2, sat));\n    float sand = smoothstep(0.02, 0.08, src.r - src.b) * smoothstep(0.04, 0.0, abs(src.r - src.g) - 0.06)\n               * smoothstep(0.38, 0.55, l) * (1.0 - veg) * (1.0 - snowPix);\n    float paved = (1.0 - smoothstep(0.06, 0.14, sat)) * smoothstep(0.12, 0.25, l) * (1.0 - smoothstep(0.6, 0.75, l));\n    float rock = smoothstep(0.42, 0.7, slope);\n    float dirt = clamp(1.0 - veg - snowPix - sand - paved, 0.0, 1.0);\n\n    // ---------------- Micro detail (world-locked) -----------------\n    float k = u_terrain.y * dFade;\n    if (k > 0.0) {\n        float n1 = detailNoise(wp, 1.5, footprint);\n        float n2 = detailNoise(wp, 6.0, footprint);\n        float n3 = detailNoise(wp, 23.0, footprint);\n        float n4 = detailNoise(wp, 90.0, footprint);\n        float grassD = (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.18 + (n3 - 0.5) * 0.14 + (n4 - 0.5) * 0.12;\n        float dirtD = (n1 - 0.5) * 0.25 + (n2 - 0.5) * 0.2 + (n4 - 0.5) * 0.1;\n        // Rock strata: noise stretched along the contour (perpendicular to the slope).\n        vec2 contour = normalize(vec2(-N.y, N.x) + 1e-4);\n        vec2 rq = vec2(dot(wp, contour), alt * 3.0);\n        float strata = detailNoise(rq * vec2(0.25, 1.0), 4.0, footprint);\n        float rockD = (strata - 0.5) * 0.45 + (n2 - 0.5) * 0.25;\n        float snowD = (n2 - 0.5) * 0.05 + (n3 - 0.5) * 0.05;\n        float sandD = (detailNoise(wp * vec2(1.0, 4.0), 2.0, footprint) - 0.5) * 0.1 + (n3 - 0.5) * 0.08;\n        float pavedD = (n1 - 0.5) * 0.06 + (n3 - 0.5) * 0.05;\n        float d = grassD * grass + dirtD * dirt + rockD * rock + snowD * snowPix + sandD * sand + pavedD * paved;\n        col *= 1.0 + d * k;\n        // Subtle hue variation within grass fields (dry / lush patches).\n        col = mix(col, col * vec3(1.06, 1.02, 0.86), grass * (n4 - 0.35) * 0.5 * k);\n    }\n\n    // ---------------- Slope / altitude materials -----------------\n    float m = u_terrain.z * dFade;\n    if (m > 0.0) {\n        // Steep slopes: satellite imagery smears on cliffs; replace with rock\n        // tinted by the local colour.\n        float lum = gfsr_luma(col);\n        vec3 rockCol = mix(vec3(lum) * vec3(1.04, 1.0, 0.94), col, 0.35) * (0.8 + 0.4 * detailNoise(wp, 9.0, footprint));\n        col = mix(col, rockCol, rock * m * (1.0 - snowPix));\n        // Snow above the (temperature-adjusted) snowline on gentle slopes.\n        float snowline = u_terrain2.x + (u_moisture.z - 15.0) * 120.0;\n        float edgeNoise = (detailNoise(wp, 40.0, footprint) - 0.5) * 500.0;\n        float snow = smoothstep(snowline - 150.0, snowline + 250.0, alt + edgeNoise) * smoothstep(0.55, 0.8, N.z);\n        col = mix(col, vec3(0.80, 0.83, 0.88) * (0.92 + 0.16 * detailNoise(wp, 3.0, footprint)), snow * m * (1.0 - paved));\n        // Dry sand near sea level, slightly brighter and warmer.\n        float beach = sand * (1.0 - smoothstep(5.0, 60.0, alt)) * (1.0 - humidity * 0.5);\n        col = mix(col, col * vec3(1.08, 1.04, 0.95), beach * m);\n    }\n\n    // ---------------- Forest canopy -----------------\n    float fk = u_terrain.w * forest * dFade;\n    if (fk > 0.0) {\n        float crownVis = 1.0 - smoothstep(1.8, 7.0, footprint);\n        if (crownVis > 0.0) {\n            vec4 w = gfsr_worley2(wp / 7.0, WORLD_PERIOD / 7.0);\n            float size = 0.45 + 0.25 * w.y;\n            float dome = 1.0 - smoothstep(size * 0.6, size, w.x);\n            vec3 cn = normalize(vec3(-w.zw / max(size, 0.2) * 1.4, max(dome, 0.15)));\n            float crownLight = 0.55 + 0.75 * max(dot(cn, sunDir), 0.0) * day;\n            // Gaps between crowns are in the canopy's own shadow.\n            float gap = smoothstep(size * 0.7, size * 1.1, w.x);\n            float sideShadow = smoothstep(0.0, 0.6, dot(normalize(w.zw + 1e-4), sunDir.xy)) * gap;\n            float tree = mix(crownLight, 0.35, max(gap * 0.7, sideShadow * 0.5));\n            vec3 tint = mix(vec3(0.92, 1.0, 0.85), vec3(1.08, 1.02, 0.9), w.y);\n            vec3 crowned = col * tree * tint * (0.85 + 0.3 * gfsr_hash12(floor(wp / 7.0)));\n            col = mix(col, crowned, fk * crownVis);\n        }\n        // Volumetric canopy response at distance: rough surface darkens the\n        // side away from the sun; looking down-sun shows the bright hotspot.\n        float hot = exp(-max(1.0 - dot(V, sunDir), 0.0) * 40.0);\n        float rough = mix(0.82, 1.0, clamp(dot(N, sunDir) * 1.5 + 0.3, 0.0, 1.0));\n        float cluster = 0.88 + 0.24 * detailNoise(wp, 60.0, footprint * 0.2);\n        col *= mix(1.0, rough * cluster * (1.0 + hot * 0.35), fk * (1.0 - smoothstep(0.0, 4.0, footprint) * 0.2));\n    }\n\n    // ---------------- Lighting -----------------\n    float lk = u_terrain.x * day;\n    float shadow = 1.0;\n    if (u_terrain2.y > 0.0 && sunDir.z > -0.02 && dist < 60000.0) {\n        vec3 lEC = normalize(czm_sunDirectionEC);\n        shadow = mix(1.0, screenShadow(pEC, lEC, dist, u_terrain2.z, jitter), u_terrain2.y * (1.0 - overcast * 0.85));\n        shadow = mix(shadow, 1.0, smoothstep(30000.0, 60000.0, dist));\n    }\n    if (lk > 0.0) {\n        float sunE = (1.0 - overcast * 0.8) * smoothstep(-0.02, 0.15, sunDir.z) + 0.05;\n        float amb = 0.38 + overcast * 0.5 + humidity * 0.1;\n        float ndl = max(dot(N, sunDir), 0.0);\n        float lit = amb * (0.55 + 0.45 * N.z) + sunE * ndl * shadow;\n        float flatLit = amb + sunE * max(sunDir.z, 0.0);\n        float ratio = clamp(lit / max(flatLit, 0.05), 0.2, 2.2);\n        col *= mix(1.0, ratio, lk * dFade);\n    } else if (shadow < 1.0) {\n        col *= mix(1.0, shadow * 0.6 + 0.4, u_terrain.x);\n    }\n\n    // ---------------- Wet surfaces -----------------\n    if (wet > 0.01) {\n        float porous = clamp(grass + dirt + sand + forest * 0.6, 0.0, 1.0);\n        col *= mix(1.0, 0.62, wet * porous);\n        col *= mix(1.0, 0.85, wet * paved);\n        float flatness = smoothstep(0.96, 0.995, N.z);\n        float puddleN = detailNoise(wp, 5.0, footprint * 0.5) * 0.6 + detailNoise(wp, 17.0, footprint * 0.5) * 0.4;\n        float puddle = smoothstep(0.62 - wet * 0.18, 0.7 - wet * 0.18, puddleN) * flatness * wet * (paved * 0.8 + dirt * 0.5 + grass * 0.25);\n        float sheen = wet * paved * flatness * 0.6;\n        float reflAmt = max(puddle, sheen) * u_terrain2.w * (1.0 - smoothstep(4000.0, 12000.0, dist));\n        if (reflAmt > 0.01) {\n            vec3 Nw = vec3(0.0, 0.0, 1.0);\n            // Raindrop ripples in puddles.\n            if (u_weather.z > 0.01) {\n                vec4 rc = gfsr_worley2(wp / 0.8, WORLD_PERIOD / 0.8);\n                float phase = fract(u_time * 0.9 + rc.y);\n                float ring = sin((rc.x - phase * 0.6) * 40.0) * exp(-abs(rc.x - phase * 0.6) * 12.0) * (1.0 - phase);\n                Nw = normalize(vec3(normalize(rc.zw + 1e-4) * ring * 0.15 * u_weather.z, 1.0));\n            }\n            vec3 R = reflect(-V, Nw);\n            float NdotV = clamp(dot(Nw, V), 0.0, 1.0);\n            float F = 0.02 + 0.98 * pow(max(1.0 - NdotV, 0.0), 5.0);\n            vec3 env = gfsr_skyApprox(R, sunDir, max(u_camHeight, 1.0) * 0.001, overcast);\n            // eyeToEnu is orthonormal, so v * M applies its inverse (ENU -> eye).\n            vec4 ssr = gfsr_ssr(colorTexture, depthTexture, pEC, normalize(R * u_eyeToEnu), min(dist * 1.5, 3000.0), 16.0, jitter);\n            vec3 refl = mix(env, gfsr_toLinear(ssr.rgb), ssr.a);\n            col = mix(col, refl, clamp(F * reflAmt * 1.4, 0.0, 1.0));\n        }\n    }\n\n    col = mix(col, gfsr_toLinear(src.rgb), acMask);\n    gl_FragColor = vec4(gfsr_toGamma(col), src.a);\n}\n",
        "tonemap": "// GeoFS-ReShade : tonemap.glsl\n// Photographic HDR pipeline.\n//\n// GeoFS hands post-processing an 8-bit display-referred image, so this stage\n//   1. linearises it and gently re-expands highlights (inverse Reinhard on\n//      luminance, capped so it never produces \"HDR look\" halos),\n//   2. applies eye adaptation: a log-average scene luminance measured by the\n//      tiny `luminance` pass drives a partial auto-exposure towards middle grey,\n//   3. maps through the ACES filmic curve, followed by a film response curve\n//      (soft toe + shoulder, like negative film scanned for print),\n//   4. applies scotopic (Purkinje) vision at night: rod-dominated vision is\n//      desaturated and shifted slightly towards blue,\n//   5. applies gamma, contrast and saturation, then dithers to avoid banding.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program luminance\n// Runs at 1/16 resolution. Each output texel stores the log-luminance average\n// of a 4x4 grid over its footprint in the full-resolution image.\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform vec2 u_texel;      // full resolution texel size\nuniform vec2 u_outTexel;   // texel size of this pass\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    float sumLog = 0.0;\n    for (int y = 0; y < 4; y++) {\n        for (int x = 0; x < 4; x++) {\n            vec2 o = (vec2(float(x), float(y)) - 1.5) * 0.25 * u_outTexel;\n            vec3 c = gfsr_toLinear(texture2D(colorTexture, uv + o).rgb);\n            float lm = gfsr_luma(c);\n            // NaN/Inf guard: a single bad pixel must never poison adaptation.\n            lm = (lm == lm && lm < 1e4) ? lm : 0.18;\n            sumLog += log(max(lm, 1e-4));\n        }\n    }\n    // Store log-luminance remapped to 0..1 over [-9.2, 0.0] (= 1e-4 .. 1).\n    float avg = sumLog / 16.0;\n    gl_FragColor = vec4(clamp(avg / 9.2 + 1.0, 0.0, 1.0), 0.0, 0.0, 1.0);\n}\n\n// @program tonemap\nuniform sampler2D colorTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform sampler2D u_lumTexture;\nuniform float u_exposure;\nuniform float u_gamma;\nuniform float u_contrast;\nuniform float u_saturation;\nuniform vec4 u_adapt;   // x adaptation strength 0..1, y min EV, z max EV, w night factor 0..1\nuniform vec4 u_film;    // x toe, y shoulder, z Purkinje strength, w highlight expansion\n\nvec3 ACESFilm(vec3 x)\n{\n    float a = 2.51;\n    float b = 0.03;\n    float c = 2.43;\n    float d = 0.59;\n    float e = 0.14;\n\n    return clamp(\n        (x * (a * x + b))\n        / (x * (c * x + d) + e),\n        0.0,\n        1.0\n    );\n}\n\n// Film response: lifts the toe slightly (no crushed blacks) and rolls the\n// shoulder off softly so skies and clouds keep their gradation.\nvec3 filmCurve(vec3 x, float toe, float shoulder)\n{\n    vec3 t = x + toe * 0.04 * (1.0 - x) * (1.0 - smoothstep(0.0, 0.25, x));\n    vec3 s = 1.0 - (1.0 - t) * (1.0 - t);\n    return mix(t, mix(t, s, 0.5 * smoothstep(0.55, 1.0, t)), shoulder);\n}\n\nfloat sceneLogLum()\n{\n    float s = 0.0;\n    for (int y = 0; y < 4; y++) {\n        for (int x = 0; x < 4; x++) {\n            // Centre-weighted metering: the frame centre counts double.\n            vec2 p = (vec2(float(x), float(y)) + 0.5) / 4.0;\n            vec2 q = mix(vec2(0.5), p, 0.85);\n            s += texture2D(u_lumTexture, q).r;\n            s += texture2D(u_lumTexture, mix(vec2(0.5), p, 0.4)).r;\n        }\n    }\n    return (s / 32.0 - 1.0) * 9.2;\n}\n\nvoid main()\n{\n    vec4 src = texture2D(colorTexture, v_textureCoordinates);\n    vec3 lin = gfsr_toLinear(src.rgb);\n\n    float l = gfsr_luma(lin);\n    float k = 0.8 * u_film.w;\n    float expanded = l / max(1.0 - k * l, 0.25);\n    lin *= expanded / max(l, 1e-5);\n\n    // Eye adaptation towards 18 % grey, clamped to an EV range and partial so\n    // bright skies stay bright and night stays dark.\n    float logAvg = sceneLogLum();\n    float target = log(0.18) - logAvg;\n    float ev = clamp(target / log(2.0), u_adapt.y, u_adapt.z);\n    float adaptExp = exp2(ev * u_adapt.x);\n\n    vec3 hdr = lin * u_exposure * adaptExp;\n\n    // Scotopic vision: below ~0.03 cd/m2 equivalent, colour fades towards a\n    // slightly blue-shifted luminance (Purkinje shift).\n    float hl = gfsr_luma(hdr);\n    float scot = u_film.z * u_adapt.w * (1.0 - smoothstep(0.004, 0.06, hl));\n    vec3 rod = vec3(hl) * vec3(0.82, 0.92, 1.12);\n    hdr = mix(hdr, rod, scot);\n\n    vec3 mapped = ACESFilm(hdr);\n    mapped = filmCurve(mapped, u_film.x, u_film.y);\n    vec3 c = pow(mapped, vec3(1.0 / max(u_gamma, 0.1)));\n\n    c = (c - 0.5) * u_contrast + 0.5;\n    float lum = gfsr_luma(c);\n    c = mix(vec3(lum), c, u_saturation);\n\n    c += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;\n    gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);\n}\n",
        "water": "// GeoFS-ReShade : water.glsl\n// Screen-space ocean enhancement.\n//\n// Water pixels are detected without any engine changes by combining\n//   * altitude close to sea level (reconstructed from the depth buffer)\n//   * a flat, upward-facing reconstructed normal\n//   * a blue / dark colour signature with low local texture variance\n//\n// The detected surface receives animated wave normals, Fresnel sky reflection\n// (using the same scattering model as the sky), a sun glitter path, specular\n// highlights, deep water colouring and a distance fade.\n//\n// Requires common.glsl (prepended by the loader).\n\n// @program water\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\nvarying vec2 v_textureCoordinates;\n\nuniform mat3 u_eyeToEnu;\nuniform float u_camHeight;\nuniform float u_time;\nuniform vec2 u_worldOffset;      // camera motion in metres, wrapped at 4096 m\nuniform vec2 u_texel;\nuniform float u_waterTolerance;  // metres around the ellipsoid treated as sea level\nuniform float u_sunReflection;\nuniform float u_specular;\nuniform vec3 u_deepColor;        // sRGB\nuniform float u_deepStrength;\nuniform float u_waveStrength;\nuniform float u_fadeDistance;    // metres\nuniform float u_rayleigh;\nuniform float u_mie;\nuniform vec4 u_weather;\nuniform vec4 u_ssr;              // x enabled, y steps\n\nconst float EARTH_R = 6371000.0;\n\nfloat waveHeight(vec2 xy)\n{\n    vec2 wind = vec2(0.65, 0.35);\n    vec2 p1 = xy / 16.0 + wind * u_time * 0.12;\n    vec2 p2 = xy / 32.0 - wind.yx * u_time * 0.05;\n    float h = gfsr_fbm2(p1, vec2(256.0), 4) * 0.6;\n    h += gfsr_fbm2(p2, vec2(128.0), 3) * 0.4;\n    return h;\n}\n\nvec3 waveNormal(vec2 xy, float amp)\n{\n    float e = 0.6;\n    float h = waveHeight(xy);\n    float hx = waveHeight(xy + vec2(e, 0.0));\n    float hy = waveHeight(xy + vec2(0.0, e));\n    vec3 n = vec3(-(hx - h) / e * amp, -(hy - h) / e * amp, 1.0);\n    return normalize(n);\n}\n\nfloat colourVariance(vec2 uv, vec3 centre)\n{\n    vec3 a = texture2D(colorTexture, uv + vec2(u_texel.x * 2.0, 0.0)).rgb;\n    vec3 b = texture2D(colorTexture, uv - vec2(u_texel.x * 2.0, 0.0)).rgb;\n    vec3 c = texture2D(colorTexture, uv + vec2(0.0, u_texel.y * 2.0)).rgb;\n    vec3 d = texture2D(colorTexture, uv - vec2(0.0, u_texel.y * 2.0)).rgb;\n    vec3 m = (a + b + c + d + centre) * 0.2;\n    vec3 v = (a - m) * (a - m) + (b - m) * (b - m) + (c - m) * (c - m) + (d - m) * (d - m) + (centre - m) * (centre - m);\n    return dot(v, vec3(0.333)) * 0.2;\n}\n\nvoid main()\n{\n    vec2 uv = v_textureCoordinates;\n    vec4 src = texture2D(colorTexture, uv);\n    float raw = gfsr_rawDepth(depthTexture, uv);\n    if (gfsr_isSkyDepth(raw)) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 pEC = gfsr_eyePosition(depthTexture, uv);\n    vec3 pEnu = u_eyeToEnu * pEC;\n    float dist = length(pEC);\n    float horiz2 = dot(pEnu.xy, pEnu.xy);\n    float alt = u_camHeight + pEnu.z + horiz2 / (2.0 * EARTH_R);\n\n    float altMask = 1.0 - smoothstep(u_waterTolerance * 0.6, u_waterTolerance, abs(alt));\n    if (altMask <= 0.0) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 nEnu = normalize(u_eyeToEnu * gfsr_normalEC(depthTexture, uv, u_texel, pEC));\n    // Depth precision degrades with distance; trust the normal less far away.\n    float flatTrust = 1.0 - smoothstep(3000.0, 25000.0, dist);\n    float flatMask = mix(1.0, smoothstep(0.93, 0.985, nEnu.z), flatTrust);\n\n    vec3 c = src.rgb;\n    float blueish = smoothstep(-0.02, 0.06, c.b - c.r) * smoothstep(-0.08, 0.02, c.b - c.g + 0.04);\n    float darkish = 1.0 - smoothstep(0.18, 0.4, gfsr_luma(c));\n    float colourMask = max(blueish, darkish * 0.8);\n    float smoothMask = 1.0 - smoothstep(0.0008, 0.004, colourVariance(uv, c));\n\n    float mask = altMask * flatMask * colourMask * mix(1.0, smoothMask, 0.7);\n    if (mask <= 0.001) {\n        gl_FragColor = src;\n        return;\n    }\n\n    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);\n    vec3 viewDir = normalize(pEnu);\n    vec3 V = -viewDir;\n    float day = smoothstep(-0.1, 0.05, sunDir.z);\n    float fade = 1.0 - smoothstep(u_fadeDistance * 0.25, u_fadeDistance, dist);\n\n    // Wave normals in world space (camera-anchored xy + wrapped camera motion).\n    vec2 wxy = pEnu.xy + u_worldOffset;\n    float storm = u_weather.y;\n    float amp = u_waveStrength * (0.35 + storm * 0.65) * (0.25 + 0.75 * fade);\n    vec3 N = normalize(mix(vec3(0.0, 0.0, 1.0), waveNormal(wxy, amp), fade * 0.85 + 0.15));\n\n    float NdotV = max(dot(N, V), 0.0);\n    float fresnel = 0.02 + 0.98 * pow(max(1.0 - NdotV, 0.0), 5.0);\n\n    // Sky reflection.\n    vec3 R = reflect(viewDir, N);\n    R.z = max(R.z, 0.015);\n    R = normalize(R);\n    float camHKm = max(u_camHeight, 1.0) * 0.001;\n    float mie = u_mie * (1.0 + u_weather.x * 1.5);\n    vec3 skyL;\n    vec3 skyT;\n    gfsr_scatter(camHKm, R, sunDir, 1.0e9, u_rayleigh, mie, 0.6, 8.0, skyL, skyT);\n    vec3 skyRefl = 1.0 - exp(-skyL);\n    float overcast = u_weather.x;\n    skyRefl = mix(skyRefl, vec3(gfsr_luma(skyRefl)) * vec3(0.9, 0.95, 1.0), overcast * 0.8);\n    skyRefl *= mix(0.15, 1.0, day);\n\n    // SSR (clouds, terrain, ships, aircraft) always overrides the analytic sky.\n    if (u_ssr.x > 0.5 && dist < 8000.0) {\n        vec3 rEC = normalize(reflect(normalize(pEC), normalize(mix(vec3(0.0, 0.0, 1.0), N, 0.35) * u_eyeToEnu)));\n        vec4 ssr = gfsr_ssr(colorTexture, depthTexture, pEC, rEC, min(dist * 2.0, 6000.0), u_ssr.y, gfsr_ign(gl_FragCoord.xy));\n        skyRefl = mix(skyRefl, gfsr_toLinear(ssr.rgb), ssr.a * (1.0 - smoothstep(3000.0, 8000.0, dist)));\n    }\n\n    // Deep water colouring.\n    vec3 base = gfsr_toLinear(c);\n    vec3 deep = gfsr_toLinear(u_deepColor) * (0.25 + 0.75 * day);\n    float deepAmt = u_deepStrength * (0.55 + 0.45 * NdotV);\n    vec3 water = mix(base, deep, deepAmt);\n    water = mix(water, skyRefl, fresnel);\n\n    // Sun specular highlight + glitter path.\n    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);\n    vec3 H = normalize(V + sunDir);\n    float NdotH = max(dot(N, H), 0.0);\n    float spec = pow(NdotH, 900.0) * 18.0 + pow(NdotH, 120.0) * 1.2;\n    float glitter = pow(max(dot(R, sunDir), 0.0), 350.0) * 6.0;\n    vec3 sunLight = sunT * (spec * u_specular + glitter * u_sunReflection) * day * (1.0 - overcast * 0.85);\n    water += sunLight * (0.3 + 0.7 * fresnel + 0.5);\n\n    // Distance fade: far water returns to the engine colour + aerial perspective.\n    vec3 outLin = mix(base, water, mask * mix(0.4, 1.0, fade));\n    outLin = outLin / (1.0 + max(outLin - 1.0, 0.0));\n    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);\n}\n"
    };
    // <<<GFSR:END shaders>>>

    // <<<GFSR:BUILD presets>>>
    NS.presets = {
        "high": {
            "name": "HIGH",
            "description": "High: every realism system enabled with balanced sample counts. Target 60 FPS on dedicated GPUs.",
            "settings": {
                "hdrEnabled": true,
                "atmosphereEnabled": true,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "gradeEnabled": true,
                "waterEnabled": true,
                "aeroEnabled": true,
                "rainGlassEnabled": true,
                "lensFlareEnabled": false,
                "streaksEnabled": false,
                "chromaticEnabled": false,
                "vignetteEnabled": false,
                "gradeMode": "realistic",
                "bloomIntensity": 0.15,
                "bloomThreshold": 0.86,
                "bloomEnabled": true,
                "atmosphereSteps": 12,
                "cloudSteps": 48,
                "cloudResolution": "0.5",
                "cloudDistance": 80000,
                "cirrusEnabled": true,
                "cloudShadows": true,
                "godraysEnabled": true,
                "godraysSamples": 32,
                "ssaoEnabled": true,
                "ssaoSamples": 12,
                "reflectionsEnabled": true,
                "ssrEnabled": true,
                "ssrSteps": 20,
                "waterSSR": true,
                "terrainEnabled": true,
                "terrainShadowSteps": 12,
                "cockpitLightEnabled": true,
                "cockpitShadowSteps": 12,
                "plumeQuality": 24,
                "shadowQuality": "2048",
                "bloomRadius": 1
            }
        },
        "low": {
            "name": "LOW",
            "description": "Low: physically based sky, fog, light clouds and rain on glass. For integrated GPUs (target 60 FPS).",
            "settings": {
                "hdrEnabled": true,
                "atmosphereEnabled": true,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "gradeEnabled": true,
                "waterEnabled": true,
                "aeroEnabled": true,
                "rainGlassEnabled": true,
                "lensFlareEnabled": false,
                "streaksEnabled": false,
                "chromaticEnabled": false,
                "vignetteEnabled": false,
                "gradeMode": "realistic",
                "bloomIntensity": 0.15,
                "bloomThreshold": 0.86,
                "bloomEnabled": false,
                "atmosphereSteps": 6,
                "cloudSteps": 20,
                "cloudResolution": "0.33",
                "cloudDistance": 50000,
                "cirrusEnabled": false,
                "cloudShadows": false,
                "godraysEnabled": false,
                "godraysSamples": 24,
                "ssaoEnabled": false,
                "ssaoSamples": 8,
                "reflectionsEnabled": false,
                "ssrEnabled": false,
                "ssrSteps": 12,
                "waterSSR": false,
                "terrainEnabled": false,
                "terrainShadowSteps": 4,
                "cockpitLightEnabled": false,
                "cockpitShadowSteps": 6,
                "plumeQuality": 12,
                "shadowQuality": "1024",
                "bloomRadius": 1
            }
        },
        "medium": {
            "name": "MEDIUM",
            "description": "Medium: adds terrain/forest shading, bloom, cockpit lighting and water reflections. Mid-range GPUs.",
            "settings": {
                "hdrEnabled": true,
                "atmosphereEnabled": true,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "gradeEnabled": true,
                "waterEnabled": true,
                "aeroEnabled": true,
                "rainGlassEnabled": true,
                "lensFlareEnabled": false,
                "streaksEnabled": false,
                "chromaticEnabled": false,
                "vignetteEnabled": false,
                "gradeMode": "realistic",
                "bloomIntensity": 0.15,
                "bloomThreshold": 0.86,
                "bloomEnabled": true,
                "atmosphereSteps": 8,
                "cloudSteps": 32,
                "cloudResolution": "0.33",
                "cloudDistance": 60000,
                "cirrusEnabled": true,
                "cloudShadows": true,
                "godraysEnabled": false,
                "godraysSamples": 32,
                "ssaoEnabled": false,
                "ssaoSamples": 8,
                "reflectionsEnabled": true,
                "ssrEnabled": false,
                "ssrSteps": 16,
                "waterSSR": true,
                "terrainEnabled": true,
                "terrainShadowSteps": 6,
                "cockpitLightEnabled": true,
                "cockpitShadowSteps": 8,
                "plumeQuality": 16,
                "shadowQuality": "1024",
                "bloomRadius": 1
            }
        },
        "ultra": {
            "name": "ULTRA",
            "description": "Ultra: maximum sample counts, long cloud draw distance and 4K shadow maps. Target 40 FPS on high-end GPUs.",
            "settings": {
                "hdrEnabled": true,
                "atmosphereEnabled": true,
                "fogEnabled": true,
                "cloudsEnabled": true,
                "gradeEnabled": true,
                "waterEnabled": true,
                "aeroEnabled": true,
                "rainGlassEnabled": true,
                "lensFlareEnabled": false,
                "streaksEnabled": false,
                "chromaticEnabled": false,
                "vignetteEnabled": false,
                "gradeMode": "realistic",
                "bloomIntensity": 0.15,
                "bloomThreshold": 0.86,
                "bloomEnabled": true,
                "atmosphereSteps": 16,
                "cloudSteps": 80,
                "cloudResolution": "0.5",
                "cloudDistance": 150000,
                "cirrusEnabled": true,
                "cloudShadows": true,
                "godraysEnabled": true,
                "godraysSamples": 64,
                "ssaoEnabled": true,
                "ssaoSamples": 16,
                "reflectionsEnabled": true,
                "ssrEnabled": true,
                "ssrSteps": 32,
                "waterSSR": true,
                "terrainEnabled": true,
                "terrainShadowSteps": 20,
                "cockpitLightEnabled": true,
                "cockpitShadowSteps": 16,
                "plumeQuality": 32,
                "shadowQuality": "4096",
                "bloomRadius": 1.1
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

        const STORAGE_KEY = 'gfsr.settings.v2';
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
                    { key: 'modelLighting', type: 'checkbox', label: 'Aircraft image-based lighting (IBL)', default: true },
                    { key: 'engineTuning', type: 'checkbox', label: 'Engine tuning (soft shadow maps, FXAA)', default: true },
                    { key: 'shadowQuality', type: 'select', label: 'Shadow map resolution', default: '2048', options: [
                        ['1024', '1024'], ['2048', '2048'], ['4096', '4096']
                    ] }
                ]
            },
            {
                id: 'hdr', title: 'HDR & Tonemapping', controls: [
                    { key: 'hdrEnabled', type: 'checkbox', label: 'HDR pipeline (ACES Filmic)', default: true, structural: true },
                    { key: 'exposure', type: 'range', label: 'HDR Exposure', default: 1.1, min: 0.2, max: 3.0, step: 0.01 },
                    { key: 'gamma', type: 'range', label: 'Gamma', default: 1.0, min: 0.6, max: 1.6, step: 0.01 },
                    { key: 'contrast', type: 'range', label: 'Contrast', default: 1.0, min: 0.5, max: 1.6, step: 0.01 },
                    { key: 'saturation', type: 'range', label: 'Saturation', default: 0.96, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'eyeAdaptation', type: 'range', label: 'Eye adaptation', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'adaptMinEV', type: 'range', label: 'Adaptation min (EV)', default: -1.0, min: -4.0, max: 0.0, step: 0.1 },
                    { key: 'adaptMaxEV', type: 'range', label: 'Adaptation max (EV)', default: 1.5, min: 0.0, max: 4.0, step: 0.1 },
                    { key: 'filmToe', type: 'range', label: 'Film toe', default: 0.5, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'filmShoulder', type: 'range', label: 'Film shoulder', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'highlightExpansion', type: 'range', label: 'Highlight recovery', default: 0.55, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'purkinje', type: 'range', label: 'Night vision (Purkinje shift)', default: 0.6, min: 0.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'bloom', title: 'Bloom', controls: [
                    { key: 'bloomEnabled', type: 'checkbox', label: 'Bloom', default: true, structural: true },
                    { key: 'bloomIntensity', type: 'range', label: 'Bloom Intensity', default: 0.15, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'bloomRadius', type: 'range', label: 'Bloom Radius', default: 1.0, min: 0.25, max: 4.0, step: 0.05 },
                    { key: 'bloomThreshold', type: 'range', label: 'Bloom Threshold', default: 0.86, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'bloomSoftKnee', type: 'range', label: 'Soft bloom (knee)', default: 0.5, min: 0.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'atmosphere', title: 'Atmospheric Scattering', controls: [
                    { key: 'atmosphereEnabled', type: 'checkbox', label: 'Atmospheric scattering', default: true, structural: true },
                    { key: 'skyBlend', type: 'range', label: 'Sky replacement', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'hazeStrength', type: 'range', label: 'Aerial perspective', default: 0.85, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'rayleigh', type: 'range', label: 'Rayleigh scattering', default: 1.0, min: 0.2, max: 3.0, step: 0.01 },
                    { key: 'mie', type: 'range', label: 'Mie scattering', default: 1.0, min: 0.1, max: 4.0, step: 0.01 },
                    { key: 'horizonGlow', type: 'range', label: 'Horizon glow', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'sunsetShift', type: 'range', label: 'Sunset colour shift', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'atmosphereSteps', type: 'range', label: 'Scattering samples', default: 12, min: 4, max: 24, step: 1 },
                    { key: 'starBrightness', type: 'range', label: 'Stars', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'milkyWay', type: 'range', label: 'Milky Way', default: 0.7, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'twinkle', type: 'range', label: 'Star twinkle', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'moonBrightness', type: 'range', label: 'Moonlight', default: 1.0, min: 0.0, max: 3.0, step: 0.01 }
                ]
            },
            {
                id: 'terrain', title: 'Terrain & Forests', controls: [
                    { key: 'terrainEnabled', type: 'checkbox', label: 'Terrain & forest overhaul', default: true, structural: true },
                    { key: 'terrainLighting', type: 'range', label: 'Slope lighting / self-shadowing', default: 0.75, min: 0.0, max: 1.5, step: 0.01 },
                    { key: 'terrainDetail', type: 'range', label: 'Micro detail', default: 0.6, min: 0.0, max: 1.5, step: 0.01 },
                    { key: 'terrainMaterials', type: 'range', label: 'Material blending (rock/snow/sand)', default: 0.6, min: 0.0, max: 1.5, step: 0.01 },
                    { key: 'forestDetail', type: 'range', label: 'Forest canopy volume', default: 0.8, min: 0.0, max: 1.5, step: 0.01 },
                    { key: 'snowline', type: 'range', label: 'Snowline at 15 °C (m)', default: 3000, min: 500, max: 6000, step: 50 },
                    { key: 'terrainShadows', type: 'range', label: 'Contact shadows', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'terrainShadowSteps', type: 'range', label: 'Shadow samples', default: 12, min: 4, max: 32, step: 1 },
                    { key: 'wetReflections', type: 'range', label: 'Wet surfaces & puddles', default: 0.8, min: 0.0, max: 1.5, step: 0.01 }
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
                    { key: 'manualFog', type: 'range', label: 'Fog (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'humidityAuto', type: 'checkbox', label: 'Estimate humidity from weather', default: true },
                    { key: 'humidity', type: 'range', label: 'Humidity (manual)', default: 0.5, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'airTemperature', type: 'range', label: 'Sea-level temperature (°C, manual)', default: 15, min: -30, max: 45, step: 1 },
                    { key: 'surfaceWetness', type: 'range', label: 'Extra surface wetness', default: 0.0, min: 0.0, max: 1.0, step: 0.01 }
                ]
            },
            {
                id: 'godrays', title: 'God Rays', controls: [
                    { key: 'godraysEnabled', type: 'checkbox', label: 'God rays', default: true, structural: true },
                    { key: 'godraysStrength', type: 'range', label: 'Strength', default: 0.35, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'godraysSamples', type: 'range', label: 'Samples', default: 48, min: 8, max: 128, step: 1 },
                    { key: 'godraysLength', type: 'range', label: 'Length', default: 0.85, min: 0.1, max: 1.0, step: 0.01 },
                    { key: 'godraysDecay', type: 'range', label: 'Decay', default: 0.965, min: 0.9, max: 0.995, step: 0.001 },
                    { key: 'sunGlare', type: 'range', label: 'Sun glare', default: 0.35, min: 0.0, max: 2.0, step: 0.01 }
                ]
            },
            {
                id: 'grade', title: 'Color Grading', controls: [
                    { key: 'gradeEnabled', type: 'checkbox', label: 'Color grading', default: true, structural: true },
                    { key: 'gradeMode', type: 'select', label: 'Look', default: 'realistic', options: [
                        ['realistic', 'Realistic'], ['msfs', 'MSFS'], ['dcs', 'DCS'], ['cinematic', 'Cinematic'], ['photographic', 'Photographic']
                    ] },
                    { key: 'gradeStrength', type: 'range', label: 'Strength', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'gradeShadows', type: 'range', label: 'Shadows', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                    { key: 'gradeMidtones', type: 'range', label: 'Midtones', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                    { key: 'gradeHighlights', type: 'range', label: 'Highlights', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                    { key: 'gradeWarmth', type: 'range', label: 'Warm highlights', default: 0.08, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'gradeCoolness', type: 'range', label: 'Cool shadows', default: 0.1, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'gradeVibrance', type: 'range', label: 'Vibrance', default: 0.0, min: -1.0, max: 1.0, step: 0.01 }
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
                    { key: 'reflectionStrength', type: 'range', label: 'Environment reflection', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'fresnelPower', type: 'range', label: 'Fresnel power', default: 5.0, min: 1.0, max: 8.0, step: 0.1 },
                    { key: 'roughness', type: 'range', label: 'Roughness', default: 0.35, min: 0.02, max: 1.0, step: 0.01 },
                    { key: 'metallic', type: 'range', label: 'Metal surfaces', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'canopyBoost', type: 'range', label: 'Canopy reflections', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'aircraftRadius', type: 'range', label: 'Aircraft size (m)', default: 22, min: 4, max: 90, step: 1 },
                    { key: 'ssrEnabled', type: 'checkbox', label: 'Screen-space reflections (SSR)', default: true },
                    { key: 'ssrSteps', type: 'range', label: 'SSR samples', default: 24, min: 8, max: 48, step: 1 },
                    { key: 'pbrResponse', type: 'range', label: 'PBR light-direction response', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'weathering', type: 'range', label: 'Weathered surfaces', default: 0.4, min: 0.0, max: 1.0, step: 0.01 }
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
                    { key: 'waterTolerance', type: 'range', label: 'Sea level tolerance (m)', default: 60, min: 5, max: 200, step: 1 },
                    { key: 'waterSSR', type: 'checkbox', label: 'Water screen-space reflections', default: true }
                ]
            },
            {
                id: 'aero', title: 'Afterburner & Condensation', controls: [
                    { key: 'aeroEnabled', type: 'checkbox', label: 'Exhaust & condensation effects', default: true, structural: true },
                    { key: 'afterburnerIntensity', type: 'range', label: 'Afterburner glow', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'plumeLength', type: 'range', label: 'Plume length', default: 1.0, min: 0.3, max: 2.5, step: 0.01 },
                    { key: 'plumeQuality', type: 'range', label: 'Plume samples', default: 24, min: 8, max: 40, step: 1 },
                    { key: 'nozzleRadius', type: 'range', label: 'Nozzle radius (m)', default: 0.5, min: 0.2, max: 1.5, step: 0.01 },
                    { key: 'heatHaze', type: 'range', label: 'Heat distortion', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    { key: 'vaporCone', type: 'range', label: 'Vapor cones (transonic)', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'wingVapor', type: 'range', label: 'High-G wing vapor', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'trailsEnabled', type: 'checkbox', label: 'Wingtip vortices & contrails', default: true },
                    { key: 'trailOpacity', type: 'range', label: 'Trail opacity', default: 0.7, min: 0.0, max: 2.0, step: 0.01 }
                ]
            },
            {
                id: 'cockpit', title: 'Cockpit & Rain', controls: [
                    { key: 'rainGlassEnabled', type: 'checkbox', label: 'Rain on canopy / windscreen', default: true, structural: true },
                    { key: 'rainGlassIntensity', type: 'range', label: 'Droplet amount', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'cockpitLightEnabled', type: 'checkbox', label: 'Cockpit lighting', default: true, structural: true },
                    { key: 'cockpitSun', type: 'range', label: 'Sun penetration & soft shadows', default: 0.8, min: 0.0, max: 1.5, step: 0.01 },
                    { key: 'cockpitBounce', type: 'range', label: 'Ambient bounce', default: 0.6, min: 0.0, max: 1.5, step: 0.01 },
                    { key: 'cockpitShadowSteps', type: 'range', label: 'Cockpit shadow samples', default: 12, min: 4, max: 24, step: 1 },
                    { key: 'floodLight', type: 'range', label: 'Night flood / instrument light', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'nightAdaptation', type: 'range', label: 'Night adaptation', default: 0.5, min: 0.0, max: 1.0, step: 0.01 },
                    { key: 'panelReflection', type: 'range', label: 'Panel reflections on glass', default: 0.6, min: 0.0, max: 2.0, step: 0.01 }
                ]
            },
            {
                id: 'night', title: 'Night Lighting', controls: [
                    { key: 'nightLightsEnabled', type: 'checkbox', label: 'City lights (NASA Black Marble)', default: true },
                    { key: 'cityLights', type: 'range', label: 'City light intensity', default: 1.0, min: 0.0, max: 2.0, step: 0.01 }
                ]
            },
            {
                id: 'lens', title: 'Lens Effects', controls: [
                    { key: 'lensFlareEnabled', type: 'checkbox', label: 'Lens flare', default: false, structural: true },
                    { key: 'flareIntensity', type: 'range', label: 'Flare intensity', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'flareGhosts', type: 'range', label: 'Ghosts', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'flareHalo', type: 'range', label: 'Halo', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'flareStarburst', type: 'range', label: 'Starburst', default: 0.7, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'streaksEnabled', type: 'checkbox', label: 'Bloom streaks', default: false, structural: true },
                    { key: 'streakIntensity', type: 'range', label: 'Streak intensity', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'chromaticEnabled', type: 'checkbox', label: 'Chromatic aberration', default: false, structural: true },
                    { key: 'chromatic', type: 'range', label: 'Aberration amount', default: 0.15, min: 0.0, max: 2.0, step: 0.01 },
                    { key: 'vignetteEnabled', type: 'checkbox', label: 'Vignette', default: false, structural: true },
                    { key: 'vignette', type: 'range', label: 'Vignette amount', default: 0.15, min: 0.0, max: 1.0, step: 0.01 },
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
    const TRAIL_POINTS = 16;            // must match u_trailA/u_trailB in aero.glsl
    const LUMINANCE_SCALE = 0.0625;     // eye-adaptation metering buffer
    const BLACK_MARBLE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';

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

        // Realism overhaul state.
        this.eyeToIcrf = new Cesium.Matrix3();
        this.pixelAngle = 0.001;
        this.sunEnu = new Cesium.Cartesian3(0, 0, 1);
        this.night = 0;
        this.moisture = new Cesium.Cartesian4(0.5, 0, 15, 1);   // humidity, wetness, temperature C, moon
        this.groundWetness = 0;
        this.glassWetness = 0;
        this.cockpitView = 0;
        this.airspeed = 0;
        this.ac = {
            valid: false,
            ec: new Cesium.Cartesian3(),
            fwd: new Cesium.Cartesian3(0, 0, -1),
            right: new Cesium.Cartesian3(1, 0, 0),
            up: new Cesium.Cartesian3(0, 1, 0),
            nozzle0: new Cesium.Cartesian4(),
            nozzle1: new Cesium.Cartesian4(),
            ab: new Cesium.Cartesian4(),
            aero: new Cesium.Cartesian4(0, 0, 10, 0),
            abLevel: 0,
            vaporCone: 0,
            wingVapor: 0
        };
        this.trailA = [];
        this.trailB = [];
        for (let i = 0; i < TRAIL_POINTS; i++) {
            this.trailA.push(new Cesium.Cartesian4());
            this.trailB.push(new Cesium.Cartesian4());
        }
        this.trailInfo = new Cesium.Cartesian4();

        this._icrf = new Cesium.Matrix3();
        this._sunInertial = new Cesium.Cartesian3();
        this._sunFixed = new Cesium.Cartesian3();
        this._acEnu = new Cesium.Matrix4();
        this._tmp = new Cesium.Cartesian3();
        this._tmp2 = new Cesium.Cartesian3();
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

        aircraftInstance: function () {
            return safe(function () { return window.geofs.aircraft.instance; }, null);
        },

        values: function () {
            return safe(function () { return window.geofs.animation.values; }, null) || {};
        },

        // GeoFS has no humidity value; estimate relative humidity from clouds, rain and fog.
        humidity: function (wx) {
            if (!wx) {
                return null;
            }
            return clamp(0.35 + wx.cover * 0.5 + wx.precip * 0.4 + wx.fog * 0.6, 0, 1);
        },

        temperatureSL: function () {
            const d = GeoFSBridge.weatherDefinition();
            const t = d ? Number(d.airTemperatureSL) : NaN;
            return isFinite(t) ? t : null;
        },

        temperatureAtAltitude: function () {
            const t = safe(function () { return Number(window.weather.atmosphere.airTempAtAltitude); }, NaN);
            return isFinite(t) ? t : null;
        },

        contrailAltitude: function () {
            const a = safe(function () { return Number(window.weather.contrailAltitude); }, NaN);
            return isFinite(a) && a > 0 ? a : 8000;
        },

        // [right, forward, up] unit vectors in local ENU at the aircraft.
        aircraftFrame: function (inst) {
            const f = safe(function () { return inst.object3d.getWorldFrame(); }, null);
            if (f && f[0] && f[1] && f[2] && isFinite(f[1][0])) {
                return f;
            }
            const htr = inst && inst.htr;
            if (!htr) {
                return null;
            }
            const h = htr[0] * Math.PI / 180;
            const p = htr[1] * Math.PI / 180;
            const r = htr[2] * Math.PI / 180;
            const fwd = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
            const r0 = [Math.cos(h), -Math.sin(h), 0];
            const u0 = [
                r0[1] * fwd[2] - r0[2] * fwd[1],
                r0[2] * fwd[0] - r0[0] * fwd[2],
                r0[0] * fwd[1] - r0[1] * fwd[0]
            ];
            const cr = Math.cos(r);
            const sr = Math.sin(r);
            const right = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
            const up = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];
            return [right, fwd, up];
        },

        // Engines with their ENU offsets (metres from the aircraft origin).
        engines: function (inst) {
            const list = safe(function () { return inst.engines; }, null);
            if (!list || !list.length) {
                return [];
            }
            const out = [];
            for (let i = 0; i < list.length; i++) {
                const en = list[i];
                const pts = en && en.points;
                const anchor = pts && ((pts.contrailAnchor && pts.contrailAnchor.worldPosition) ||
                    (pts.forceSourcePoint && pts.forceSourcePoint.worldPosition));
                if (anchor && isFinite(anchor[0])) {
                    out.push({
                        pos: anchor,
                        anchored: !!(pts.contrailAnchor && pts.contrailAnchor.worldPosition),
                        afterburner: Number(en.afterBurnerThrust) > 0,
                        jet: Number(en.afterBurnerThrust) > 0 || !!en.contrail || !!(pts.contrailAnchor)
                    });
                }
            }
            return out;
        },

        // Approximate wingspan from the outermost airfoil force points.
        wingspan: function (inst, rightEnu) {
            const foils = safe(function () { return inst.airfoils; }, null);
            if (!foils || !foils.length || !rightEnu) {
                return 0;
            }
            let m = 0;
            for (let i = 0; i < foils.length; i++) {
                const p = safe(function () { return foils[i].points.forceSourcePoint.worldPosition; }, null);
                if (p && isFinite(p[0])) {
                    m = Math.max(m, Math.abs(p[0] * rightEnu[0] + p[1] * rightEnu[1] + p[2] * rightEnu[2]));
                }
            }
            return m * 2.6;
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

    // Image-based lighting for glTF models (aircraft, scenery objects).
    // Projects a physically-plausible sky + ground radiance model onto 9 L2
    // spherical-harmonic coefficients (irradiance / pi) and feeds them to
    // Cesium's PBR shader. The IBL frame is pinned to local East/North/Up so
    // the sky stays "up" when the aircraft banks.
    const SkyIBL = {
        coeffs: null,
        key: '',

        // Linear radiance arriving from ENU direction (dx, dy, dz).
        radiance: function (dx, dy, dz, sun, ov, storm, day, out) {
            const sunCos = Math.max(dx * sun.x + dy * sun.y + dz * sun.z, 0);
            const sunHigh = clamp(sun.z / 0.5, 0, 1);
            const low = (1 - clamp(sun.z / 0.35, 0, 1)) * day;
            const sunR = 1.0;
            const sunG = 0.78 + 0.2 * sunHigh;
            const sunB = 0.55 + 0.4 * sunHigh;
            const skyScale = day * (0.35 + 0.65 * clamp(sun.z / 0.5, 0, 1));
            let r;
            let g;
            let b;
            if (dz >= 0) {
                const t = Math.pow(1 - dz, 3);
                r = (0.10 + (0.42 - 0.10) * t) * skyScale;
                g = (0.19 + (0.50 - 0.19) * t) * skyScale;
                b = (0.42 + (0.62 - 0.42) * t) * skyScale;
                const warm = low * t * sunCos * sunCos * 0.8;
                r += 0.35 * warm;
                g += 0.18 * warm;
                b += 0.06 * warm;
                const circ = 0.5 * Math.pow(sunCos, 8) * day;
                r += sunR * circ;
                g += sunG * circ;
                b += sunB * circ;
                const o = day * (0.4 + 0.6 * dz) * (1 - 0.65 * storm);
                r = r + (0.38 * o - r) * ov;
                g = g + (0.40 * o - g) * ov;
                b = b + (0.43 * o - b) * ov;
            } else {
                // Ground bounce: albedo * (direct sun + sky irradiance).
                const direct = Math.max(sun.z, 0) * (1 - 0.75 * ov) * 1.6;
                const skyIrr = 0.3 * skyScale;
                const h = clamp(1 + dz * 4, 0, 1);  // horizon blends into the sky colour
                r = 0.16 * (direct * sunR + skyIrr) * (1 - h * 0.4) + h * 0.2 * skyScale;
                g = 0.17 * (direct * sunG + skyIrr) * (1 - h * 0.4) + h * 0.23 * skyScale;
                b = 0.13 * (direct * sunB + skyIrr) * (1 - h * 0.4) + h * 0.28 * skyScale;
            }
            // Moonlight and airglow so night ambient never drops to pure black.
            const n = (1 - day) * (dz >= 0 ? 1 : 0.3);
            out[0] = r + 0.004 * n;
            out[1] = g + 0.005 * n;
            out[2] = b + 0.008 * n;
            return out;
        },

        // Returns true when the coefficients changed.
        update: function (Cesium, sun, ov, storm, night) {
            const day = 1 - night;
            const key = [Math.round(sun.x * 40), Math.round(sun.y * 40), Math.round(sun.z * 60),
                Math.round(ov * 20), Math.round(storm * 20), Math.round(night * 20)].join(',');
            if (!SkyIBL.coeffs) {
                SkyIBL.coeffs = [];
                for (let i = 0; i < 9; i++) {
                    SkyIBL.coeffs.push(new Cesium.Cartesian3());
                }
            } else if (key === SkyIBL.key) {
                return false;
            }
            SkyIBL.key = key;
            const acc = new Float64Array(27);
            const L = [0, 0, 0];
            const NT = 24;
            const NP = 48;
            for (let i = 0; i < NT; i++) {
                const theta = (i + 0.5) * Math.PI / NT;
                const st = Math.sin(theta);
                const dw = st * (Math.PI / NT) * (2 * Math.PI / NP);
                for (let j = 0; j < NP; j++) {
                    const phi = (j + 0.5) * 2 * Math.PI / NP;
                    const e = st * Math.cos(phi);
                    const nn = st * Math.sin(phi);
                    const u = Math.cos(theta);
                    SkyIBL.radiance(e, nn, u, sun, ov, storm, day, L);
                    // Cesium's cube frame: x = -East, y = Up, z = -North.
                    const x = -e;
                    const y = u;
                    const z = -nn;
                    const basis = [1, y, z, x, y * x, y * z, 3 * z * z - 1, z * x, x * x - y * y];
                    for (let k = 0; k < 9; k++) {
                        const w = basis[k] * dw;
                        acc[k * 3] += L[0] * w;
                        acc[k * 3 + 1] += L[1] * w;
                        acc[k * 3 + 2] += L[2] * w;
                    }
                }
            }
            // K_lm^2 * (A_l / pi): Cesium's basis omits the normalisation constants.
            const f = [
                0.0795775,
                0.238732 * 2 / 3, 0.238732 * 2 / 3, 0.238732 * 2 / 3,
                1.193662 / 4, 1.193662 / 4, 0.0994718 / 4, 1.193662 / 4, 0.298416 / 4
            ];
            for (let k = 0; k < 9; k++) {
                const c = SkyIBL.coeffs[k];
                c.x = acc[k * 3] * f[k];
                c.y = acc[k * 3 + 1] * f[k];
                c.z = acc[k * 3 + 2] * f[k];
            }
            return true;
        }
    };

    const ModelLighting = {
        saved: new WeakMap(),
        touched: [],
        _m: null,
        _p: null,

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

        // sky: { sun: Cartesian3 (ENU), overcast, storm, night } or null to keep stock IBL.
        apply: function (Cesium, scene, enabled, sky) {
            if (!enabled) {
                ModelLighting.restore(Cesium);
                return;
            }
            const changed = sky ? SkyIBL.update(Cesium, sky.sun, sky.overcast, sky.storm, sky.night) : false;
            if (!ModelLighting._m) {
                ModelLighting._m = new Cesium.Matrix4();
                ModelLighting._p = new Cesium.Cartesian3();
            }
            ModelLighting.forEachModel(Cesium, scene.primitives, function (model) {
                let orig = ModelLighting.saved.get(model);
                const ibl = model.imageBasedLighting;
                const target = ibl || model;
                if (!orig) {
                    orig = {
                        target: target,
                        factor: target.imageBasedLightingFactor ? Cesium.Cartesian2.clone(target.imageBasedLightingFactor) : undefined,
                        luminance: target.luminanceAtZenith,
                        sh: target.sphericalHarmonicCoefficients,
                        reference: model.referenceMatrix,
                        usesSky: false
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
                }
                if (!sky || !SkyIBL.coeffs || orig.sh !== undefined) {
                    return;
                }
                safe(function () {
                    // Pin the IBL frame to East/North/Up at the model.
                    const t = Cesium.Matrix4.getTranslation(model.modelMatrix, ModelLighting._p);
                    if (Cesium.Cartesian3.magnitude(t) > 1.0e5) {
                        Cesium.Transforms.eastNorthUpToFixedFrame(t, Cesium.Ellipsoid.WGS84, ModelLighting._m);
                        model.referenceMatrix = Cesium.Matrix4.clone(ModelLighting._m, model.referenceMatrix);
                    }
                    if (!orig.usesSky || changed) {
                        target.sphericalHarmonicCoefficients = SkyIBL.coeffs;
                        orig.usesSky = true;
                    }
                });
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
                    if (orig.usesSky) {
                        orig.target.sphericalHarmonicCoefficients = orig.sh;
                        model.referenceMatrix = orig.reference;
                    }
                });
                ModelLighting.saved.delete(model);
            });
            ModelLighting.touched.length = 0;
        }
    };

    // Native Cesium engine settings: soft (PCF) shadow filtering, shadow map
    // resolution, shadow darkness that matches skylight fill, FXAA.
    // GeoFS resets some of these on view changes, so apply() re-asserts them.
    const EngineTuning = {
        scene: null,
        saved: null,

        apply: function (scene, enabled, size) {
            if (!enabled || !scene) {
                EngineTuning.restore();
                return;
            }
            const sm = scene.shadowMap;
            const fxaa = safe(function () { return scene.postProcessStages.fxaa; }, null);
            if (EngineTuning.scene !== scene) {
                EngineTuning.restore();
                EngineTuning.scene = scene;
                EngineTuning.saved = {
                    soft: sm ? sm.softShadows : undefined,
                    size: sm ? sm.size : undefined,
                    darkness: sm ? sm.darkness : undefined,
                    fxaa: fxaa ? fxaa.enabled : undefined
                };
            }
            safe(function () {
                if (sm) {
                    if (!sm.softShadows) {
                        sm.softShadows = true;
                    }
                    const want = parseInt(size, 10) || 2048;
                    if (sm.size !== want) {
                        sm.size = want;
                    }
                    // Sunlit/shadowed contrast of real daylight (skylight fills ~30 %).
                    if (Math.abs(sm.darkness - 0.32) > 1e-3) {
                        sm.darkness = 0.32;
                    }
                }
                if (fxaa && !fxaa.enabled) {
                    fxaa.enabled = true;
                }
            });
        },

        restore: function () {
            const scene = EngineTuning.scene;
            const o = EngineTuning.saved;
            if (scene && o) {
                safe(function () {
                    const sm = scene.shadowMap;
                    if (sm) {
                        if (o.soft !== undefined) {
                            sm.softShadows = o.soft;
                        }
                        if (o.size !== undefined) {
                            sm.size = o.size;
                        }
                        if (o.darkness !== undefined) {
                            sm.darkness = o.darkness;
                        }
                    }
                    if (o.fxaa !== undefined && scene.postProcessStages.fxaa) {
                        scene.postProcessStages.fxaa.enabled = o.fxaa;
                    }
                });
            }
            EngineTuning.scene = null;
            EngineTuning.saved = null;
        }
    };

    // Night city lights: NASA VIIRS Black Marble imagery blended over the
    // globe as the sun sets. GeoFS re-applies its own imagery colour
    // modifiers to every layer, so the layer's look is re-asserted each call.
    const NightLights = {
        layer: null,
        layers: null,
        failed: false,

        apply: function (Cesium, viewer, enabled, night, strength) {
            const want = enabled && !NightLights.failed && night * strength > 0.01;
            if (!want) {
                if (NightLights.layer) {
                    NightLights.layer.show = false;
                }
                if (!enabled) {
                    NightLights.restore();
                }
                return;
            }
            const layers = viewer && viewer.imageryLayers;
            if (!layers) {
                return;
            }
            if (!NightLights.layer || NightLights.layers !== layers || (NightLights.layer.isDestroyed && NightLights.layer.isDestroyed())) {
                NightLights.restore();
                try {
                    const provider = new Cesium.UrlTemplateImageryProvider({
                        url: BLACK_MARBLE_URL,
                        maximumLevel: 8,
                        credit: 'NASA Earth Observatory / VIIRS Black Marble'
                    });
                    if (provider.errorEvent) {
                        let errors = 0;
                        provider.errorEvent.addEventListener(function (err) {
                            errors++;
                            if (errors > 40) {
                                NightLights.failed = true;
                                if (err) {
                                    err.retry = false;
                                }
                            }
                        });
                    }
                    NightLights.layer = layers.addImageryProvider(provider);
                    NightLights.layers = layers;
                } catch (err) {
                    warn('night lights unavailable', err);
                    NightLights.failed = true;
                    return;
                }
            }
            const l = NightLights.layer;
            const k = clamp(night * strength, 0, 2);
            l.show = true;
            l.alpha = clamp(0.25 + 0.6 * night, 0, 0.92) * clamp(k, 0, 1);
            l.brightness = 0.9 + 0.9 * clamp(k, 0, 2);
            l.contrast = 1.35;
            l.gamma = 1.25;
            l.saturation = 0.85;
            l.hue = 0;
        },

        restore: function () {
            const l = NightLights.layer;
            const layers = NightLights.layers;
            if (l && layers) {
                safe(function () {
                    if (layers.contains(l)) {
                        layers.remove(l, true);
                    }
                });
            }
            NightLights.layer = null;
            NightLights.layers = null;
        }
    };

    // Records wingtip-vortex / contrail points in world space and converts
    // them to eye space every frame for the analytic trail renderer.
    function TrailRecorder(Cesium) {
        this.C = Cesium;
        this.a = [];
        this.b = [];
        this.mode = '';
        this.timer = 0;
    }

    TrailRecorder.prototype.reset = function () {
        this.a.length = 0;
        this.b.length = 0;
        this.timer = 0;
    };

    // Adds a point pair when due. pa/pb are world Cartesian3 (pb may be null).
    TrailRecorder.prototype.record = function (mode, dt, pa, pb, intensity, interval) {
        if (mode !== this.mode) {
            this.reset();
            this.mode = mode;
        }
        this.interval = interval;
        this.timer -= dt;
        const C = this.C;
        const lifetime = interval * TRAIL_POINTS;
        const age = function (list) {
            for (let i = 0; i < list.length; i++) {
                list[i].age += dt;
            }
            while (list.length && list[list.length - 1].age > lifetime) {
                list.pop();
            }
        };
        age(this.a);
        age(this.b);
        if (this.timer <= 0 && intensity > 0.01 && pa) {
            this.timer = interval;
            this.a.unshift({ p: C.Cartesian3.clone(pa), age: 0, k: intensity });
            if (pb) {
                this.b.unshift({ p: C.Cartesian3.clone(pb), age: 0, k: intensity });
            }
            if (this.a.length > TRAIL_POINTS - 1) {
                this.a.length = TRAIL_POINTS - 1;
            }
            if (this.b.length > TRAIL_POINTS - 1) {
                this.b.length = TRAIL_POINTS - 1;
            }
        }
        return lifetime;
    };

    // Writes eye-space points into Cartesian4 arrays; slot 0 is the live source.
    TrailRecorder.prototype.toEye = function (view, headA, headB, headK, lifetime, outA, outB) {
        const C = this.C;
        const fill = function (list, head, out) {
            let n = 0;
            if (head && list.length) {
                C.Matrix4.multiplyByPoint(view, head, out[0]);
                out[0].w = headK;
                n = 1;
            }
            for (let i = 0; i < list.length && n < TRAIL_POINTS; i++, n++) {
                const e = list[i];
                const o = out[n];
                C.Matrix4.multiplyByPoint(view, e.p, o);
                o.w = e.k * clamp(1 - e.age / lifetime, 0, 1);
            }
            for (let i = n; i < TRAIL_POINTS; i++) {
                out[i].w = 0;
            }
            return n;
        };
        const na = fill(this.a, headA, outA);
        const nb = fill(this.b, headB, outB);
        return Math.max(na, nb);
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
            o.detailSteps = true;
        }
        if (this.level >= 2) {
            o.bloomEnabled = true;
            o.cloudsEnabled = true;
            o.terrainEnabled = true;
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
        this.trails = new TrailRecorder(Cesium);
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
        if (o.detailSteps) {
            e.terrainShadowSteps = Math.min(e.terrainShadowSteps, 6);
            e.ssrSteps = Math.min(e.ssrSteps, 12);
            e.plumeQuality = Math.min(e.plumeQuality, 12);
            e.cockpitShadowSteps = Math.min(e.cockpitShadowSteps, 6);
        }
        if (o.terrainEnabled) {
            e.terrainEnabled = false;
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
            e.lensFlareEnabled, e.hdrEnabled, e.gradeEnabled, e.chromaticEnabled, e.vignetteEnabled,
            e.terrainEnabled, e.aeroEnabled, e.rainGlassEnabled, e.cockpitLightEnabled
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
            mie: function () { return eff().mie; },
            moisture: function () { return F.moisture; },
            pixelAngle: function () { return F.pixelAngle; },
            aircraftDistance: function () { return F.aircraftDistance; },
            aircraftRadius: function () { return eff().aircraftRadius; }
        };

        const list = [];

        // 0. Terrain & forest relighting (runs first so later passes see the lit ground)
        if (e.terrainEnabled) {
            const terrain = new C.Cartesian4();
            const terrain2 = new C.Cartesian4();
            list.push(stage('terrain', 'terrain', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_time: U.time,
                u_texel: U.texel,
                u_worldOffset: function () { return F.worldOffset; },
                u_pixelAngle: U.pixelAngle,
                u_aircraftDistance: U.aircraftDistance,
                u_aircraftRadius: U.aircraftRadius,
                u_terrain: function () {
                    const s = eff();
                    terrain.x = s.terrainLighting;
                    terrain.y = s.terrainDetail;
                    terrain.z = s.terrainMaterials;
                    terrain.w = s.forestDetail;
                    return terrain;
                },
                u_terrain2: function () {
                    const s = eff();
                    terrain2.x = s.snowline;
                    terrain2.y = s.terrainShadows;
                    terrain2.z = s.terrainShadowSteps;
                    terrain2.w = s.wetReflections;
                    return terrain2;
                },
                u_moisture: U.moisture,
                u_weather: U.weather
            }));
        }

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
            const waterSsr = new C.Cartesian4();
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
                u_weather: U.weather,
                u_ssr: function () {
                    const s = eff();
                    waterSsr.x = s.waterSSR ? 1 : 0;
                    waterSsr.y = s.ssrSteps;
                    return waterSsr;
                }
            }));
        }

        // 3. Aircraft reflections
        if (e.reflectionsEnabled) {
            const pbr = new C.Cartesian4();
            list.push(stage('reflections', 'reflections', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_texel: U.texel,
                u_aircraftDistance: U.aircraftDistance,
                u_aircraftRadius: U.aircraftRadius,
                u_strength: function () { return eff().reflectionStrength; },
                u_fresnelPower: function () { return eff().fresnelPower; },
                u_roughness: function () { return eff().roughness; },
                u_metallic: function () { return eff().metallic; },
                u_canopyBoost: function () { return eff().canopyBoost; },
                u_rayleigh: U.rayleigh,
                u_mie: U.mie,
                u_weather: U.weather,
                u_pbr: function () {
                    const s = eff();
                    pbr.x = s.ssrEnabled ? 1 : 0;
                    pbr.y = s.ssrSteps;
                    pbr.z = s.pbrResponse;
                    pbr.w = s.weathering;
                    return pbr;
                },
                u_moisture: U.moisture
            }));
        }

        // 4. Atmospheric scattering, sky, stars and moon
        if (e.atmosphereEnabled) {
            const stars = new C.Cartesian4();
            list.push(stage('atmosphere', 'atmosphere', {
                u_eyeToEnu: U.eyeToEnu,
                u_eyeToIcrf: function () { return F.eyeToIcrf; },
                u_camHeight: U.camHeight,
                u_skyBlend: function () { return eff().skyBlend; },
                u_hazeStrength: function () { return eff().hazeStrength; },
                u_rayleigh: U.rayleigh,
                u_mie: U.mie,
                u_horizonGlow: function () { return eff().horizonGlow; },
                u_sunsetShift: function () { return eff().sunsetShift; },
                u_steps: function () { return eff().atmosphereSteps; },
                u_time: U.time,
                u_pixelAngle: U.pixelAngle,
                u_stars: function () {
                    const s = eff();
                    stars.x = s.starBrightness;
                    stars.y = s.milkyWay;
                    stars.z = s.twinkle;
                    stars.w = s.moonBrightness;
                    return stars;
                },
                u_moisture: U.moisture,
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
                u_weather: U.weather,
                u_moisture: U.moisture
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

        // 6b. Afterburner plume, heat haze, vapor cone, wing vapor, trails
        if (e.aeroEnabled) {
            const plume = new C.Cartesian4();
            const aero = new C.Cartesian4();
            list.push(stage('aero', 'aero', {
                u_eyeToEnu: U.eyeToEnu,
                u_time: U.time,
                u_camHeight: U.camHeight,
                u_texel: U.texel,
                u_acEC: function () { return F.ac.ec; },
                u_acFwd: function () { return F.ac.fwd; },
                u_acRight: function () { return F.ac.right; },
                u_acUp: function () { return F.ac.up; },
                u_nozzle0: function () { return F.ac.nozzle0; },
                u_nozzle1: function () { return F.ac.nozzle1; },
                u_ab: function () { return F.ac.ab; },
                u_aero: function () {
                    const s = eff();
                    aero.x = F.ac.vaporCone * s.vaporCone;
                    aero.y = F.ac.wingVapor * s.wingVapor;
                    aero.z = F.ac.aero.z;
                    aero.w = s.heatHaze;
                    return aero;
                },
                u_plume: function () {
                    const s = eff();
                    plume.x = s.afterburnerIntensity;
                    plume.y = s.plumeLength;
                    plume.z = s.plumeQuality;
                    plume.w = 1 - F.night;
                    return plume;
                },
                u_trailA: function () { return F.trailA; },
                u_trailB: function () { return F.trailB; },
                u_trailInfo: function () { return F.trailInfo; },
                u_weather: U.weather,
                u_moisture: U.moisture
            }));
        }

        // 6c. Rain on the canopy (cockpit view)
        if (e.rainGlassEnabled) {
            const rain = new C.Cartesian4();
            list.push(stage('rain_glass', 'rain_glass', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_time: U.time,
                u_aspect: U.aspect,
                u_texel: U.texel,
                u_aircraftRadius: U.aircraftRadius,
                u_rain: function () {
                    rain.x = clamp(F.weather.z * eff().rainGlassIntensity, 0, 2);
                    rain.y = F.airspeed;
                    rain.z = F.glassWetness;
                    rain.w = F.cockpitView;
                    return rain;
                },
                u_weather: U.weather
            }));
        }

        // 6d. Cockpit lighting (sun penetration, bounce, instrument flood, night adaptation)
        if (e.cockpitLightEnabled) {
            const ck = new C.Cartesian4();
            const ck2 = new C.Cartesian4();
            list.push(stage('cockpit_light', 'cockpit_light', {
                u_eyeToEnu: U.eyeToEnu,
                u_camHeight: U.camHeight,
                u_texel: U.texel,
                u_aircraftRadius: U.aircraftRadius,
                u_cockpit: function () {
                    const s = eff();
                    ck.x = F.cockpitView;
                    ck.y = s.cockpitSun;
                    ck.z = s.cockpitBounce;
                    ck.w = s.panelReflection;
                    return ck;
                },
                u_cockpit2: function () {
                    const s = eff();
                    ck2.x = s.floodLight * F.night;
                    ck2.y = s.nightAdaptation * F.night;
                    ck2.z = s.cockpitShadowSteps;
                    ck2.w = 0;
                    return ck2;
                },
                u_weather: U.weather
            }));
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

        // 10. HDR: eye adaptation metering + ACES filmic tonemapping with film response
        if (e.hdrEnabled) {
            const adapt = new C.Cartesian4();
            const film = new C.Cartesian4();
            const lum = stage('luminance', 'luminance', {
                u_texel: U.texel,
                u_outTexel: function () { return F.texelFor(LUMINANCE_SCALE); }
            }, { scale: LUMINANCE_SCALE, linear: true });
            const tone = stage('tonemap', 'tonemap', {
                u_lumTexture: name('luminance'),
                u_exposure: function () { return eff().exposure; },
                u_gamma: function () { return eff().gamma; },
                u_contrast: function () { return eff().contrast; },
                u_saturation: function () { return eff().saturation; },
                u_adapt: function () {
                    const s = eff();
                    adapt.x = s.eyeAdaptation;
                    adapt.y = s.adaptMinEV;
                    adapt.z = s.adaptMaxEV;
                    adapt.w = F.night;
                    return adapt;
                },
                u_film: function () {
                    const s = eff();
                    film.x = s.filmToe;
                    film.y = s.filmShoulder;
                    film.z = s.purkinje;
                    film.w = s.highlightExpansion;
                    return film;
                }
            });
            list.push(composite('hdr', [lum, tone], false));
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

        this.updateRealism(dt, wx, lla);
    };

    // Sun/star frames, moisture, cockpit state, aircraft aerodynamics and trails.
    Plugin.prototype.updateRealism = function (dt, wx, lla) {
        const C = this.Cesium;
        const F = this.frame;
        const scene = this.scene;
        const camera = scene.camera;
        const s = this.eff;
        const vals = GeoFSBridge.values();

        // Pixel footprint for sub-pixel stars and terrain detail LOD.
        const fovy = safe(function () { return camera.frustum.fovy; }, 0.8) || 0.8;
        F.pixelAngle = fovy / Math.max(F.height, 1);

        // Inertial frame (stars) and CPU sun direction (night factor, IBL).
        const time = safe(function () { return this.viewer.clock.currentTime; }.bind(this), null) ||
            safe(function () { return scene.frameState.time; }, null);
        if (time) {
            let icrf = safe(function () { return C.Transforms.computeIcrfToFixedMatrix(time, F._icrf); }, undefined);
            if (!icrf) {
                icrf = C.Transforms.computeTemeToPseudoFixedMatrix(time, F._icrf);
            }
            const fixedToIcrf = C.Matrix3.transpose(icrf, F._enu3);
            C.Matrix3.multiply(fixedToIcrf, F._view3, F.eyeToIcrf);
            C.Matrix4.getMatrix3(F._enu, F._enu3);
            const sunI = safe(function () {
                return C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time, F._sunInertial);
            }, null);
            if (sunI) {
                C.Matrix3.multiplyByVector(icrf, sunI, F._sunFixed);
                C.Cartesian3.normalize(F._sunFixed, F._sunFixed);
                C.Matrix3.getColumn(F._enu3, 0, F._col);
                F.sunEnu.x = C.Cartesian3.dot(F._sunFixed, F._col);
                C.Matrix3.getColumn(F._enu3, 1, F._col);
                F.sunEnu.y = C.Cartesian3.dot(F._sunFixed, F._col);
                C.Matrix3.getColumn(F._enu3, 2, F._col);
                F.sunEnu.z = C.Cartesian3.dot(F._sunFixed, F._col);
            }
        }
        const sz = F.sunEnu.z;
        F.night = clamp((0.05 - sz) / 0.17, 0, 1);
        F.night = F.night * F.night * (3 - 2 * F.night);

        // Moisture: humidity, accumulated surface wetness, temperature, moon brightness.
        let humidity = s.humidity;
        if (s.humidityAuto) {
            const auto = GeoFSBridge.humidity(wx);
            if (auto !== null) {
                humidity = auto;
            } else {
                humidity = clamp(0.35 + F.weather.x * 0.45 + F.weather.z * 0.4 + F.weather.w * 0.6, 0, 1);
            }
        }
        const precip = F.weather.z;
        F.groundWetness = clamp(F.groundWetness + precip * dt / 45 - (1 - precip) * dt / 900, 0, 1);
        const tempSL = (wx && GeoFSBridge.temperatureSL() !== null) ? GeoFSBridge.temperatureSL() : s.airTemperature;
        F.moisture.x = humidity;
        F.moisture.y = Math.max(s.surfaceWetness, F.groundWetness);
        F.moisture.z = tempSL;
        F.moisture.w = s.moonBrightness;

        // Cockpit view and canopy wetness.
        const inCockpit = GeoFSBridge.cameraMode() === 'cockpit' ? 1 : 0;
        F.cockpitView += (inCockpit - F.cockpitView) * clamp(dt * 6, 0, 1);
        if (inCockpit && F.cockpitView > 0.99) {
            F.cockpitView = 1;
        }
        const speed = Number(vals.airspeedms);
        F.airspeed = isFinite(speed) ? Math.max(speed, 0) : 0;
        F.glassWetness = clamp(F.glassWetness + precip * dt / 12 -
            (1 - precip) * dt * (1 + F.airspeed / 40) / 120, 0, 1);

        if (s.aeroEnabled) {
            this.updateAero(dt, lla, vals, humidity);
        }
    };

    Plugin.prototype.updateAero = function (dt, lla, vals, humidity) {
        const C = this.Cesium;
        const F = this.frame;
        const s = this.eff;
        const A = F.ac;
        const view = this.scene.camera.viewMatrix;
        const inst = GeoFSBridge.aircraftInstance();
        const frame = inst && lla ? GeoFSBridge.aircraftFrame(inst) : null;
        A.valid = !!frame;
        if (!frame) {
            A.ab.x = 0;
            A.ab.w = 0;
            A.vaporCone = 0;
            A.wingVapor = 0;
            F.trailInfo.x = 0;
            this.trails.reset();
            return;
        }

        // Aircraft frame: local ENU vectors -> ECEF -> eye space.
        C.Transforms.eastNorthUpToFixedFrame(F._acPos, C.Ellipsoid.WGS84, F._acEnu);
        const enuToEye = function (v, out) {
            C.Cartesian3.fromElements(v[0], v[1], v[2], F._tmp);
            C.Matrix4.multiplyByPointAsVector(F._acEnu, F._tmp, F._tmp);
            C.Matrix4.multiplyByPointAsVector(view, F._tmp, out);
            return C.Cartesian3.normalize(out, out);
        };
        const enuPointWorld = function (v, out) {
            C.Cartesian3.fromElements(v[0], v[1], v[2], F._tmp);
            return C.Matrix4.multiplyByPoint(F._acEnu, F._tmp, out);
        };
        enuToEye(frame[0], A.right);
        enuToEye(frame[1], A.fwd);
        enuToEye(frame[2], A.up);
        C.Matrix4.multiplyByPoint(view, F._acPos, A.ec);

        const span = GeoFSBridge.wingspan(inst, frame[0]);
        A.aero.z = span > 4 ? clamp(span, 6, 80) : 10;

        // Afterburner nozzles (engines that have reheat).
        const engines = GeoFSBridge.engines(inst);
        const throttle = clamp(Number(vals.throttle !== undefined ? vals.throttle :
            safe(function () { return window.controls.throttle; }, 0)) || 0, 0, 1);
        const mach = Math.max(Number(vals.mach) || 0, 0);
        const r = s.nozzleRadius;
        const fwdEnu = frame[1];
        const nozzles = [A.nozzle0, A.nozzle1];
        let n = 0;
        let hasAB = false;
        for (let i = 0; i < engines.length && n < 2; i++) {
            const en = engines[i];
            if (!en.afterburner) {
                continue;
            }
            hasAB = true;
            const p = en.pos.slice ? en.pos.slice(0, 3) : [en.pos[0], en.pos[1], en.pos[2]];
            if (!en.anchored) {
                // Force points often sit near the CG; push the exit aft to the tail.
                const along = p[0] * fwdEnu[0] + p[1] * fwdEnu[1] + p[2] * fwdEnu[2];
                const target = Math.min(along, -s.aircraftRadius * 0.4);
                p[0] += fwdEnu[0] * (target - along);
                p[1] += fwdEnu[1] * (target - along);
                p[2] += fwdEnu[2] * (target - along);
            }
            enuPointWorld(p, F._tmp2);
            C.Matrix4.multiplyByPoint(view, F._tmp2, F._tmp);
            nozzles[n].x = F._tmp.x;
            nozzles[n].y = F._tmp.y;
            nozzles[n].z = F._tmp.z;
            nozzles[n].w = r;
            n++;
        }
        const abTarget = hasAB ? clamp((throttle - 0.9) / 0.08, 0, 1) : 0;
        A.abLevel += (abTarget - A.abLevel) * clamp(dt * (abTarget > A.abLevel ? 4 : 2.5), 0, 1);
        A.ab.x = A.abLevel;
        A.ab.y = hasAB ? throttle : 0;
        A.ab.z = mach;
        A.ab.w = n;

        // Aerodynamic condensation: needs humid air; appears and fades smoothly.
        const wet = clamp((humidity - 0.3) / 0.6, 0, 1);
        const g = Number(vals.loadFactor) || 1;
        const aoa = Math.abs(Number(vals.aoa) || 0);
        const coneT = wet * Math.exp(-Math.pow((mach - 0.99) / 0.06, 2));
        const liftT = Math.max(clamp((g - 3) / 4, 0, 1), clamp((aoa - 10) / 8, 0, 1) * clamp((F.airspeed - 50) / 60, 0, 1));
        const wingT = Math.pow(wet, 0.7) * liftT;
        A.vaporCone += (coneT - A.vaporCone) * clamp(dt * 3, 0, 1);
        A.wingVapor += (wingT - A.wingVapor) * clamp(dt * (wingT > A.wingVapor ? 5 : 2), 0, 1);

        // Trails: contrails above the contrail level, wingtip vortices under high lift.
        if (!s.trailsEnabled) {
            F.trailInfo.x = 0;
            this.trails.reset();
            return;
        }
        const alt = lla[2];
        const tempAlt = GeoFSBridge.temperatureAtAltitude();
        const contrailOk = alt > GeoFSBridge.contrailAltitude() || (tempAlt !== null && tempAlt < -40);
        const jets = engines.filter(function (en) { return en.jet; });
        let mode = '';
        let pa = null;
        let pb = null;
        let k = 0;
        let interval = 0.12;
        if (contrailOk && jets.length && throttle > 0.15) {
            mode = 'contrail';
            interval = 0.5;
            k = clamp((throttle - 0.15) / 0.4, 0, 1) * (0.55 + 0.45 * humidity);
            const left = jets.reduce(function (a, b) {
                const da = a.pos[0] * frame[0][0] + a.pos[1] * frame[0][1] + a.pos[2] * frame[0][2];
                const db = b.pos[0] * frame[0][0] + b.pos[1] * frame[0][1] + b.pos[2] * frame[0][2];
                return db < da ? b : a;
            });
            const right = jets.reduce(function (a, b) {
                const da = a.pos[0] * frame[0][0] + a.pos[1] * frame[0][1] + a.pos[2] * frame[0][2];
                const db = b.pos[0] * frame[0][0] + b.pos[1] * frame[0][1] + b.pos[2] * frame[0][2];
                return db > da ? b : a;
            });
            pa = enuPointWorld(left.pos, new C.Cartesian3());
            pb = right !== left ? enuPointWorld(right.pos, new C.Cartesian3()) : null;
            F.trailInfo.y = 1.5;
            F.trailInfo.w = 0.35;
        } else if (A.wingVapor > 0.02 || wingT > 0.02) {
            mode = 'vortex';
            interval = 0.1;
            k = Math.max(A.wingVapor, wingT);
            const half = A.aero.z * 0.5;
            const tip = function (side) {
                return [frame[0][0] * side * half - fwdEnu[0] * 1.5,
                    frame[0][1] * side * half - fwdEnu[1] * 1.5,
                    frame[0][2] * side * half - fwdEnu[2] * 1.5];
            };
            pa = enuPointWorld(tip(-1), new C.Cartesian3());
            pb = enuPointWorld(tip(1), new C.Cartesian3());
            F.trailInfo.y = 0.35;
            F.trailInfo.w = 0.12;
        }
        if (!mode && !this.trails.a.length) {
            F.trailInfo.x = 0;
            return;
        }
        const lifetime = this.trails.record(mode || this.trails.mode, dt, pa, pb, k, mode ? interval : (this.trails.interval || interval));
        const count = this.trails.toEye(view, pa, pb, k, lifetime, F.trailA, F.trailB);
        F.trailInfo.x = count;
        F.trailInfo.z = s.trailOpacity;
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
            const msg = ['Performance: all effects active',
                'Low FPS: SSAO, god rays, cloud, shadow, SSR and plume quality reduced',
                'Critical FPS: bloom, volumetric clouds and terrain relighting disabled'][this.perf.level];
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
        const F = this.frame;
        ModelLighting.apply(this.Cesium, this.scene, active && e.modelLighting, {
            sun: F.sunEnu,
            overcast: F.weather.x,
            storm: F.weather.y,
            night: F.night
        });
        EngineTuning.apply(this.scene, active && e.engineTuning, e.shadowQuality);
        NightLights.apply(this.Cesium, this.viewer, active && e.nightLightsEnabled, F.night, e.cityLights);
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
        EngineTuning.restore();
        NightLights.restore();
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
