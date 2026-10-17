// GeoFS-ReShade : reflections.glsl
// Approximate image-based reflections on the aircraft, without model edits.
//
// Aircraft pixels are isolated using the known camera -> aircraft distance
// (provided every frame from JavaScript): every surface within the aircraft's
// bounding radius receives
//   * Schlick Fresnel (configurable power)
//   * environment reflection sampled from the analytic sky (Rayleigh + Mie),
//     with a ground hemisphere below the horizon
//   * roughness-dependent blur of the environment (multi-tap cone)
//   * GGX sun specular (metal / wing glints)
//   * canopy enhancement for dark, low saturation glass-like pixels
//
// Requires common.glsl (prepended by the loader).

// @program reflections
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform vec2 u_texel;
uniform float u_aircraftDistance; // metres, camera -> aircraft origin
uniform float u_aircraftRadius;   // metres, bounding radius
uniform float u_strength;
uniform float u_fresnelPower;
uniform float u_roughness;
uniform float u_metallic;
uniform float u_canopyBoost;
uniform float u_rayleigh;
uniform float u_mie;
uniform vec4 u_weather;
uniform vec4 u_pbr;               // x SSR on/off, y SSR steps, z light-direction response, w weathering
uniform vec4 u_moisture;          // x humidity, y wetness, z temperature (C), w unused

vec3 environment(vec3 dir, vec3 sunDir, float camHKm, float mie, float day)
{
    vec3 d = dir;
    float below = 0.0;
    if (d.z < 0.0) {
        below = smoothstep(0.0, 0.08, -d.z);
        d.z = abs(d.z) * 0.25 + 0.01;
        d = normalize(d);
    }
    vec3 L;
    vec3 T;
    gfsr_scatter(camHKm, d, sunDir, 1.0e9, u_rayleigh, mie, 0.6, 6.0, L, T);
    vec3 sky = 1.0 - exp(-L);
    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);
    vec3 ground = vec3(0.09, 0.085, 0.07) * (0.2 + 0.8 * max(sunDir.z, 0.0)) * sunT + sky * 0.25;
    vec3 env = mix(sky, ground, below);
    return env * mix(0.08, 1.0, day);
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw) || u_aircraftDistance <= 0.0) {
        gl_FragColor = src;
        return;
    }

    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    float dist = length(pEC);
    float r = max(u_aircraftRadius, 1.0);
    float cockpit = 1.0 - smoothstep(r * 0.6, r, u_aircraftDistance);
    float nearD = u_aircraftDistance - r;
    float farD = u_aircraftDistance + r;
    float edge = r * 0.15;
    float inside = smoothstep(nearD - edge, nearD + edge, dist) * (1.0 - smoothstep(farD - edge, farD + edge, dist));
    // Cockpit view: only the visible airframe close to the camera.
    float cockpitMask = 1.0 - smoothstep(r * 0.9, r * 1.2, dist);
    float mask = mix(inside, cockpitMask * 0.35, cockpit);
    if (mask <= 0.001) {
        gl_FragColor = src;
        return;
    }

    vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel, pEC);
    vec3 vEC = normalize(-pEC);
    if (dot(nEC, vEC) < 0.0) {
        nEC = -nEC;
    }
    vec3 N = normalize(u_eyeToEnu * nEC);
    vec3 V = normalize(u_eyeToEnu * vEC);
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    float mie = u_mie * (1.0 + u_weather.x * 1.5);
    float day = smoothstep(-0.1, 0.05, sunDir.z);
    float overcast = u_weather.x;

    vec3 base = gfsr_toLinear(src.rgb);
    float l = gfsr_luma(src.rgb);
    float mx = max(src.r, max(src.g, src.b));
    float mn = min(src.r, min(src.g, src.b));
    float sat = mx - mn;

    // Glass heuristic: dark and desaturated surfaces get a smoother, stronger mirror.
    float glass = (1.0 - smoothstep(0.08, 0.28, l)) * (1.0 - smoothstep(0.05, 0.2, sat)) * u_canopyBoost;
    // Weathering: darker, dirtier paint is rougher; a wet skin is much smoother.
    float grime = (1.0 - smoothstep(0.15, 0.6, l)) * u_pbr.w;
    float rough = clamp(mix(u_roughness, u_roughness * 0.2, glass) + grime * 0.25, 0.02, 1.0);
    rough = mix(rough, rough * 0.35, u_moisture.y * (1.0 - glass));

    float NdotV = clamp(dot(N, V), 0.0, 1.0);
    float F0 = mix(0.04, 0.55, u_metallic);
    F0 = mix(F0, 0.06, glass);
    float fresnel = F0 + (1.0 - F0) * pow(max(1.0 - NdotV, 0.0), u_fresnelPower);
    fresnel *= mix(1.0, 0.45, rough);

    // Roughness blur: average a small cone of reflection directions.
    vec3 R = reflect(-V, N);
    vec3 t1 = normalize(abs(R.z) < 0.95 ? cross(R, vec3(0.0, 0.0, 1.0)) : cross(R, vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(R, t1);
    float cone = rough * rough * 0.9;
    vec3 env = environment(R, sunDir, camHKm, mie, day) * 2.0;
    env += environment(normalize(R + t1 * cone), sunDir, camHKm, mie, day);
    env += environment(normalize(R - t1 * cone), sunDir, camHKm, mie, day);
    env += environment(normalize(R + t2 * cone), sunDir, camHKm, mie, day);
    env += environment(normalize(R - t2 * cone), sunDir, camHKm, mie, day);
    env /= 6.0;
    env = mix(env, vec3(gfsr_luma(env)), overcast * 0.6);

    // SSR always takes priority over the analytic environment probe.
    if (u_pbr.x > 0.5 && rough < 0.6) {
        vec3 rEC = normalize(reflect(-vEC, nEC));
        float jitter = gfsr_ign(gl_FragCoord.xy);
        vec4 ssr = gfsr_ssr(colorTexture, depthTexture, pEC + nEC * 0.05, rEC, max(u_aircraftRadius * 6.0, 40.0), u_pbr.y, jitter);
        float conf = ssr.a * (1.0 - smoothstep(0.2, 0.6, rough));
        env = mix(env, gfsr_toLinear(ssr.rgb), conf);
    }

    // GGX sun specular.
    vec3 H = normalize(V + sunDir);
    float NdotH = max(dot(N, H), 0.0);
    float NdotL = max(dot(N, sunDir), 0.0);
    float a = rough * rough;
    float a2 = a * a;
    float dd = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float D = a2 / (3.14159265 * dd * dd + 1e-6);
    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);
    vec3 spec = sunT * D * fresnel * NdotL * 0.25 * day * (1.0 - overcast * 0.85);

    // Metals tint the reflection with the base colour.
    vec3 reflTint = mix(vec3(1.0), base / max(gfsr_luma(base), 0.05), u_metallic * 0.5 * (1.0 - glass));
    vec3 refl = env * reflTint;
    float k = u_strength * mask;

    // Directional response: the stock shading is almost flat, so re-shape it
    // towards Lambert relative to a flat-lit reference (keeps average exposure).
    float wrapL = clamp((dot(N, sunDir) + 0.25) / 1.25, 0.0, 1.0);
    float relight = mix(0.62, 1.22, wrapL) * mix(1.0, 0.92, overcast);
    base *= mix(1.0, mix(1.0, relight, day), u_pbr.z * mask * (1.0 - glass * 0.7));

    vec3 outLin = mix(base, refl, clamp(fresnel * k, 0.0, 1.0));
    outLin += spec * k * (1.0 + glass);
    outLin = outLin / (1.0 + max(outLin - 1.0, 0.0));
    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);
}
