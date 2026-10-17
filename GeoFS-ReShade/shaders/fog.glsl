// GeoFS-ReShade : fog.glsl
// Depth-buffer fog with exponential height falloff.
//
//   fog = 1.0 - exp(-distance * density)
//
// `density` is the height-integrated density along the view ray, so valleys
// fill with haze while mountain tops stay clear. Distant terrain and the
// horizon band of the sky converge to the same colour, hiding terrain pop-in
// and blending mountains into the horizon.
//
// Requires common.glsl (prepended by the loader).

// @program fog
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform float u_fogDensity;   // user density (scaled to 1e-4 per metre)
uniform float u_fogHeight;    // height falloff scale (m)
uniform float u_fogStart;     // distance where fog begins (m)
uniform float u_fogMaxDistance; // distance used for the sky horizon band (m)
uniform vec3 u_fogColor;      // sRGB
uniform float u_fogSkyTint;   // 0 = flat colour, 1 = sun-lit atmospheric tint
uniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog
uniform sampler2D u_mieLut;   // Lorenz-Mie phase table (see common.glsl)
uniform float u_mieStrength;  // droplet optics (fogbow, glory, rainbow) 0..2
uniform vec4 u_skyGlow;       // x light-pollution strength, y night factor, z LED share, w unused

float heightIntegratedDensity(float density, float camAlt, float dz, float H)
{
    // Average of density * exp(-h / H) along a ray from camAlt rising by dz.
    float base = density * exp(-max(camAlt, 0.0) / H);
    float k = dz / H;
    if (abs(k) < 1e-3) {
        return base;
    }
    return base * (1.0 - exp(-k)) / k;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);

    vec3 rd = normalize(u_eyeToEnu * gfsr_viewRayEC(uv));
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float H = max(u_fogHeight, 10.0);
    float density = u_fogDensity * 1.0e-4 * (1.0 + u_weather.w * 8.0 + u_weather.z * 3.0 + u_weather.y * 2.0);

    // Fog colour: user colour, optionally lit by the low sun and darkened at night.
    float day = smoothstep(-0.12, 0.05, sunDir.z);
    vec3 sunT = gfsr_sunTransmittance(max(u_camHeight, 1.0) * 0.001, sunDir.z, 1.0, 1.0, 1.0);
    float nu = dot(rd, sunDir);
    vec3 lit = u_fogColor * (0.55 + 0.6 * sunT) + sunT * pow(max(nu, 0.0), 8.0) * 0.35;
    vec3 fogCol = mix(u_fogColor, lit, u_fogSkyTint);
    fogCol *= mix(0.05, 1.0, day);
    fogCol = mix(fogCol, vec3(gfsr_luma(fogCol)) * vec3(0.85, 0.9, 0.95), u_weather.y * 0.6);

    // Droplet optics from the Lorenz-Mie table, visible with the sun behind:
    //   fog (5 um)   : white fogbow (~140 deg) and coloured glory (180 deg)
    //   rain (0.35mm): primary/secondary rainbow with Alexander's dark band
    float back = 1.0 - smoothstep(-0.25, 0.05, nu);
    float sunVis = day * (1.0 - 0.8 * u_weather.x) * (1.0 - u_weather.y);
    vec3 mieF = gfsr_mieLut(u_mieLut, nu, 1.0, 0.84) * 4.0 * GFSR_PI;
    vec3 fogbow = max(mieF - vec3(gfsr_phaseHG(nu, 0.84) * 4.0 * GFSR_PI), vec3(0.0)) * sunT * 1.6 * back * sunVis;
    vec3 rainbow = gfsr_mieLut(u_mieLut, nu, 3.0, 0.88) * 4.0 * GFSR_PI * sunT * back * sunVis
                 * u_weather.z * u_mieStrength * (1.0 - smoothstep(0.35, 0.75, rd.z));
    fogCol += fogbow * u_mieStrength;

    // City light scattered by haze and moisture: an orange/white dome over
    // towns and a glow in the fog around them.
    vec3 glow = vec3(0.0);
    float glowK = u_skyGlow.x * u_skyGlow.y;
    if (glowK > 0.002) {
        float wetK = 1.0 + u_weather.w * 2.0 + u_weather.z + u_weather.x * 0.8;
        glow = gfsr_screenGlow(colorTexture, depthTexture, uv, vec2(0.12), vec2(0.0, -0.7), u_skyGlow.z)
             * glowK * wetK;
    }

    float dist;
    float dz;
    if (gfsr_isSkyDepth(raw)) {
        // Only a band around the horizon is fogged so it matches distant terrain.
        dist = u_fogMaxDistance;
        dz = rd.z * dist;
        float band = 1.0 - smoothstep(0.0, 0.18, max(rd.z, 0.0));
        float f = 1.0 - exp(-max(dist - u_fogStart, 0.0) * heightIntegratedDensity(density, u_camHeight, dz, H));
        vec3 skyC = mix(src.rgb, fogCol, f * band) + rainbow * 0.6;
        skyC += glow * 0.9 * (1.0 - smoothstep(0.0, 0.35, rd.z));
        gl_FragColor = vec4(skyC, src.a);
        return;
    }

    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    dist = length(pEC);
    vec3 p = u_eyeToEnu * pEC;
    dz = p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);
    float d = max(dist - u_fogStart, 0.0);
    float fog = 1.0 - exp(-d * heightIntegratedDensity(density, u_camHeight, dz, H));
    // Rain veil between the camera and the surface carries the bow too.
    float veil = 1.0 - exp(-dist / 2500.0);
    vec3 outC = mix(src.rgb, fogCol, clamp(fog, 0.0, 1.0)) + rainbow * 0.6 * veil;
    outC += glow * (0.15 + 0.85 * clamp(fog, 0.0, 1.0)) * veil;
    gl_FragColor = vec4(outC, src.a);
}
