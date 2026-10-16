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

    float dist;
    float dz;
    if (gfsr_isSkyDepth(raw)) {
        // Only a band around the horizon is fogged so it matches distant terrain.
        dist = u_fogMaxDistance;
        dz = rd.z * dist;
        float band = 1.0 - smoothstep(0.0, 0.18, max(rd.z, 0.0));
        float f = 1.0 - exp(-max(dist - u_fogStart, 0.0) * heightIntegratedDensity(density, u_camHeight, dz, H));
        gl_FragColor = vec4(mix(src.rgb, fogCol, f * band), src.a);
        return;
    }

    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    dist = length(pEC);
    vec3 p = u_eyeToEnu * pEC;
    dz = p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);
    float d = max(dist - u_fogStart, 0.0);
    float fog = 1.0 - exp(-d * heightIntegratedDensity(density, u_camHeight, dz, H));
    gl_FragColor = vec4(mix(src.rgb, fogCol, clamp(fog, 0.0, 1.0)), src.a);
}
