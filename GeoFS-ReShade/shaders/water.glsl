// GeoFS-ReShade : water.glsl
// Screen-space ocean enhancement.
//
// Water pixels are detected without any engine changes by combining
//   * altitude close to sea level (reconstructed from the depth buffer)
//   * a flat, upward-facing reconstructed normal
//   * a blue / dark colour signature with low local texture variance
//
// The detected surface receives animated wave normals, Fresnel sky reflection
// (using the same scattering model as the sky), a sun glitter path, specular
// highlights, deep water colouring and a distance fade.
//
// Requires common.glsl (prepended by the loader).

// @program water
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform float u_time;
uniform vec2 u_worldOffset;      // camera motion in metres, wrapped at 4096 m
uniform vec2 u_texel;
uniform float u_waterTolerance;  // metres around the ellipsoid treated as sea level
uniform float u_sunReflection;
uniform float u_specular;
uniform vec3 u_deepColor;        // sRGB
uniform float u_deepStrength;
uniform float u_waveStrength;
uniform float u_fadeDistance;    // metres
uniform float u_rayleigh;
uniform float u_mie;
uniform vec4 u_weather;
uniform vec4 u_ssr;              // x enabled, y steps

const float EARTH_R = 6371000.0;

float waveHeight(vec2 xy)
{
    vec2 wind = vec2(0.65, 0.35);
    vec2 p1 = xy / 16.0 + wind * u_time * 0.12;
    vec2 p2 = xy / 32.0 - wind.yx * u_time * 0.05;
    float h = gfsr_fbm2(p1, vec2(256.0), 4) * 0.6;
    h += gfsr_fbm2(p2, vec2(128.0), 3) * 0.4;
    return h;
}

vec3 waveNormal(vec2 xy, float amp)
{
    float e = 0.6;
    float h = waveHeight(xy);
    float hx = waveHeight(xy + vec2(e, 0.0));
    float hy = waveHeight(xy + vec2(0.0, e));
    vec3 n = vec3(-(hx - h) / e * amp, -(hy - h) / e * amp, 1.0);
    return normalize(n);
}

float colourVariance(vec2 uv, vec3 centre)
{
    vec3 a = texture2D(colorTexture, uv + vec2(u_texel.x * 2.0, 0.0)).rgb;
    vec3 b = texture2D(colorTexture, uv - vec2(u_texel.x * 2.0, 0.0)).rgb;
    vec3 c = texture2D(colorTexture, uv + vec2(0.0, u_texel.y * 2.0)).rgb;
    vec3 d = texture2D(colorTexture, uv - vec2(0.0, u_texel.y * 2.0)).rgb;
    vec3 m = (a + b + c + d + centre) * 0.2;
    vec3 v = (a - m) * (a - m) + (b - m) * (b - m) + (c - m) * (c - m) + (d - m) * (d - m) + (centre - m) * (centre - m);
    return dot(v, vec3(0.333)) * 0.2;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw)) {
        gl_FragColor = src;
        return;
    }

    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    vec3 pEnu = u_eyeToEnu * pEC;
    float dist = length(pEC);
    float horiz2 = dot(pEnu.xy, pEnu.xy);
    float alt = u_camHeight + pEnu.z + horiz2 / (2.0 * EARTH_R);

    float altMask = 1.0 - smoothstep(u_waterTolerance * 0.6, u_waterTolerance, abs(alt));
    if (altMask <= 0.0) {
        gl_FragColor = src;
        return;
    }

    vec3 nEnu = normalize(u_eyeToEnu * gfsr_normalEC(depthTexture, uv, u_texel, pEC));
    // Depth precision degrades with distance; trust the normal less far away.
    float flatTrust = 1.0 - smoothstep(3000.0, 25000.0, dist);
    float flatMask = mix(1.0, smoothstep(0.93, 0.985, nEnu.z), flatTrust);

    vec3 c = src.rgb;
    float blueish = smoothstep(-0.02, 0.06, c.b - c.r) * smoothstep(-0.08, 0.02, c.b - c.g + 0.04);
    float darkish = 1.0 - smoothstep(0.18, 0.4, gfsr_luma(c));
    float colourMask = max(blueish, darkish * 0.8);
    float smoothMask = 1.0 - smoothstep(0.0008, 0.004, colourVariance(uv, c));

    float mask = altMask * flatMask * colourMask * mix(1.0, smoothMask, 0.7);
    if (mask <= 0.001) {
        gl_FragColor = src;
        return;
    }

    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    vec3 viewDir = normalize(pEnu);
    vec3 V = -viewDir;
    float day = smoothstep(-0.1, 0.05, sunDir.z);
    float fade = 1.0 - smoothstep(u_fadeDistance * 0.25, u_fadeDistance, dist);

    // Wave normals in world space (camera-anchored xy + wrapped camera motion).
    vec2 wxy = pEnu.xy + u_worldOffset;
    float storm = u_weather.y;
    float amp = u_waveStrength * (0.35 + storm * 0.65) * (0.25 + 0.75 * fade);
    vec3 N = normalize(mix(vec3(0.0, 0.0, 1.0), waveNormal(wxy, amp), fade * 0.85 + 0.15));

    float NdotV = max(dot(N, V), 0.0);
    float fresnel = 0.02 + 0.98 * pow(max(1.0 - NdotV, 0.0), 5.0);

    // Sky reflection.
    vec3 R = reflect(viewDir, N);
    R.z = max(R.z, 0.015);
    R = normalize(R);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    float mie = u_mie * (1.0 + u_weather.x * 1.5);
    vec3 skyL;
    vec3 skyT;
    gfsr_scatter(camHKm, R, sunDir, 1.0e9, u_rayleigh, mie, 0.6, 8.0, skyL, skyT);
    vec3 skyRefl = 1.0 - exp(-skyL);
    float overcast = u_weather.x;
    skyRefl = mix(skyRefl, vec3(gfsr_luma(skyRefl)) * vec3(0.9, 0.95, 1.0), overcast * 0.8);
    skyRefl *= mix(0.15, 1.0, day);

    // SSR (clouds, terrain, ships, aircraft) always overrides the analytic sky.
    if (u_ssr.x > 0.5 && dist < 8000.0) {
        vec3 rEC = normalize(reflect(normalize(pEC), normalize(mix(vec3(0.0, 0.0, 1.0), N, 0.35) * u_eyeToEnu)));
        vec4 ssr = gfsr_ssr(colorTexture, depthTexture, pEC, rEC, min(dist * 2.0, 6000.0), u_ssr.y, gfsr_ign(gl_FragCoord.xy));
        skyRefl = mix(skyRefl, gfsr_toLinear(ssr.rgb), ssr.a * (1.0 - smoothstep(3000.0, 8000.0, dist)));
    }

    // Deep water colouring.
    vec3 base = gfsr_toLinear(c);
    vec3 deep = gfsr_toLinear(u_deepColor) * (0.25 + 0.75 * day);
    float deepAmt = u_deepStrength * (0.55 + 0.45 * NdotV);
    vec3 water = mix(base, deep, deepAmt);
    water = mix(water, skyRefl, fresnel);

    // Sun specular highlight + glitter path.
    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, 0.6);
    vec3 H = normalize(V + sunDir);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, 900.0) * 18.0 + pow(NdotH, 120.0) * 1.2;
    float glitter = pow(max(dot(R, sunDir), 0.0), 350.0) * 6.0;
    vec3 sunLight = sunT * (spec * u_specular + glitter * u_sunReflection) * day * (1.0 - overcast * 0.85);
    water += sunLight * (0.3 + 0.7 * fresnel + 0.5);

    // Distance fade: far water returns to the engine colour + aerial perspective.
    vec3 outLin = mix(base, water, mask * mix(0.4, 1.0, fade));
    outLin = outLin / (1.0 + max(outLin - 1.0, 0.0));
    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);
}
