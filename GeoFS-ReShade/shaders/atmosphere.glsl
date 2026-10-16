// GeoFS-ReShade : atmosphere.glsl
// Physically based sky and aerial perspective.
//
//   * Rayleigh scattering   -> blue sky, deep dark blue at high altitude
//   * Mie scattering        -> bright low-altitude haze and sun halo
//   * Ozone absorption      -> purple upper sky at sunset
//   * Horizon glow          -> warm band along the horizon at low sun
//   * Aerial perspective    -> distant terrain fades into the atmosphere
//   * Weather tint          -> overcast / storm desaturation and darkening
//
// Requires common.glsl (prepended by the loader).

// @program atmosphere
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform float u_skyBlend;
uniform float u_hazeStrength;
uniform float u_rayleigh;
uniform float u_mie;
uniform float u_horizonGlow;
uniform float u_sunsetShift;
uniform float u_steps;
uniform vec4 u_weather; // x overcast, y storm, z precipitation, w fog

vec3 weatherTint(vec3 c, float overcast, float storm)
{
    float l = gfsr_luma(c);
    vec3 grey = vec3(l) * vec3(0.93, 0.96, 1.0);
    vec3 stormGrey = vec3(l) * vec3(0.62, 0.68, 0.74);
    vec3 outc = mix(c, grey, overcast * 0.85);
    return mix(outc, stormGrey, storm * 0.8);
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);

    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    float nu = dot(rd, sunDir);

    float overcast = u_weather.x;
    float storm = u_weather.y;
    float mie = u_mie * (1.0 + overcast * 1.5 + u_weather.w * 3.0);
    float ozone = u_sunsetShift;
    float day = smoothstep(-0.12, 0.03, sunDir.z);
    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, ozone);

    if (gfsr_isSkyDepth(raw)) {
        vec3 L;
        vec3 T;
        gfsr_scatter(camHKm, rd, sunDir, 1.0e9, u_rayleigh, mie, ozone, u_steps, L, T);

        // Horizon glow: warm band hugging the horizon, strongest towards the sun
        // and at low sun elevations (sunset / sunrise).
        float lowSun = 1.0 - smoothstep(0.0, 0.35, abs(sunDir.z));
        float band = exp(-abs(rd.z) * 14.0);
        float towardsSun = 0.35 + 0.65 * pow(max(nu, 0.0), 3.0);
        vec3 glowCol = sunT * vec3(1.0, 0.62, 0.32);
        L += glowCol * band * towardsSun * (0.25 + lowSun) * u_horizonGlow * 0.6 * day;

        // Sun disk with limb darkening, attenuated by the atmosphere.
        float disk = smoothstep(0.99990, 0.99996, nu);
        L += sunT * disk * 60.0 * (1.0 - overcast * 0.9);

        vec3 sky = gfsr_toGamma(1.0 - exp(-L));
        sky = weatherTint(sky, overcast, storm);

        // Keep the native star field / moon when the sun is down.
        float blend = u_skyBlend * day;
        vec3 outc = mix(src.rgb, sky, blend);
        gl_FragColor = vec4(outc, src.a);
        return;
    }

    // Aerial perspective for terrain, aircraft and buildings.
    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    float distKm = length(pEC) * 0.001;
    vec3 L;
    vec3 T;
    gfsr_scatter(camHKm, rd, sunDir, distKm, u_rayleigh, mie, ozone, max(4.0, floor(u_steps * 0.5)), L, T);

    vec3 lin = gfsr_toLinear(src.rgb);
    float k = u_hazeStrength;
    vec3 transm = mix(vec3(1.0), T, k);
    vec3 haze = (1.0 - exp(-L)) * k;
    vec3 outLin = lin * transm + haze;

    // Bright low-altitude haze when the camera itself is in the boundary layer.
    float lowAlt = 1.0 - smoothstep(500.0, 4000.0, u_camHeight);
    float hazeAmt = (1.0 - exp(-distKm * 0.02 * lowAlt * k)) * day;
    vec3 hazeCol = gfsr_toLinear(vec3(0.78, 0.84, 0.92)) * (0.35 + 0.65 * sunT);
    outLin = mix(outLin, hazeCol, hazeAmt * 0.35);

    vec3 outc = gfsr_toGamma(outLin);
    outc = weatherTint(outc, overcast * 0.6, storm * 0.7);
    gl_FragColor = vec4(outc, src.a);
}
