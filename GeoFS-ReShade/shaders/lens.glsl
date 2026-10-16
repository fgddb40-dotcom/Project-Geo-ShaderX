// GeoFS-ReShade : lens.glsl
// Camera lens effects.
//
//   lens_flare  sun lens flare: ghosts along the sun-centre axis, halo ring,
//               starburst; occluded by terrain (depth) and by clouds (frame luma)
//   lens_final  chromatic aberration + vignette (last stage of the pipeline)
//
// Bloom streaks live in bloom.glsl (bloom_streak).
//
// Requires common.glsl (prepended by the loader).

uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;

// @program lens_flare
uniform sampler2D depthTexture;
uniform mat3 u_eyeToEnu;
uniform float u_aspect;
uniform float u_flareIntensity;
uniform float u_ghosts;
uniform float u_halo;
uniform float u_starburst;
uniform vec4 u_weather;

float sunVisibility(vec2 sunUv)
{
    float vis = 0.0;
    for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
            vec2 o = vec2(float(x), float(y)) * 0.004 * vec2(1.0 / u_aspect, 1.0);
            vec2 suv = sunUv + o;
            if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) {
                continue;
            }
            float raw = gfsr_rawDepth(depthTexture, suv);
            float sky = gfsr_isSkyDepth(raw) ? 1.0 : 0.0;
            // Clouds composited into the frame dim the sun region.
            float l = gfsr_luma(texture2D(colorTexture, suv).rgb);
            vis += sky * smoothstep(0.6, 0.92, l);
        }
    }
    return vis / 25.0;
}

float ghostDisk(vec2 p, vec2 centre, float radius, float softness)
{
    float d = length(p - centre);
    return 1.0 - smoothstep(radius * (1.0 - softness), radius, d);
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    vec3 sun = gfsr_sunScreen();
    vec3 sunEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float day = smoothstep(-0.03, 0.06, sunEnu.z);
    if (sun.z < 0.5 || day <= 0.0 || u_flareIntensity <= 0.0) {
        gl_FragColor = src;
        return;
    }
    float onScreen = 1.0 - smoothstep(0.0, 0.25, length(max(abs(sun.xy - 0.5) - 0.5, 0.0)));
    float vis = sunVisibility(clamp(sun.xy, 0.0, 1.0)) * onScreen * day * (1.0 - u_weather.x * 0.9);
    if (vis <= 0.001) {
        gl_FragColor = src;
        return;
    }

    vec2 asp = vec2(u_aspect, 1.0);
    vec2 p = (uv - 0.5) * asp;
    vec2 s = (sun.xy - 0.5) * asp;
    vec3 flare = vec3(0.0);

    // Ghosts: reflections between lens elements mirrored through the centre.
    vec3 ghostCol0 = vec3(0.35, 0.55, 1.0);
    vec3 ghostCol1 = vec3(1.0, 0.65, 0.3);
    vec3 ghostCol2 = vec3(0.45, 1.0, 0.55);
    vec3 ghostCol3 = vec3(0.9, 0.4, 1.0);
    flare += ghostDisk(p, s * -0.35, 0.035, 0.5) * ghostCol0 * 0.35;
    flare += ghostDisk(p, s * -0.6, 0.075, 0.25) * ghostCol1 * 0.18;
    flare += ghostDisk(p, s * -1.0, 0.05, 0.6) * ghostCol2 * 0.22;
    flare += ghostDisk(p, s * 0.45, 0.02, 0.4) * ghostCol3 * 0.3;
    flare += ghostDisk(p, s * -1.45, 0.12, 0.15) * ghostCol0 * 0.08;
    flare += ghostDisk(p, s * 0.2, 0.012, 0.5) * ghostCol1 * 0.4;
    flare *= u_ghosts;

    // Halo: chromatic ring centred on the sun.
    float dSun = length(p - s);
    float ringR = 0.32;
    float ring = exp(-pow((dSun - ringR) * 28.0, 2.0));
    vec3 haloCol = vec3(
        exp(-pow((dSun - ringR * 1.02) * 30.0, 2.0)),
        exp(-pow((dSun - ringR) * 30.0, 2.0)),
        exp(-pow((dSun - ringR * 0.98) * 30.0, 2.0))
    );
    flare += (haloCol * 0.6 + ring * 0.2) * 0.25 * u_halo;

    // Starburst: angular streaks around the sun from the aperture blades.
    vec2 ds = p - s;
    float ang = atan(ds.y, ds.x);
    float rays = pow(abs(cos(ang * 3.0)), 60.0) + pow(abs(cos(ang * 3.0 + 1.0472)), 60.0) * 0.7;
    rays += gfsr_noise2(vec2(ang * 12.0, 0.0), vec2(75.0, 1.0)) * 0.35;
    float burst = rays * exp(-dSun * 7.0) * 0.9 + exp(-dSun * 22.0) * 0.8;
    flare += vec3(1.0, 0.95, 0.85) * burst * u_starburst;

    vec3 sunTint = mix(vec3(1.0, 0.55, 0.3), vec3(1.0), smoothstep(0.0, 0.35, sunEnu.z));
    vec3 lin = gfsr_toLinear(src.rgb) + flare * sunTint * vis * u_flareIntensity;
    lin = lin / (1.0 + max(lin - 1.0, 0.0));
    gl_FragColor = vec4(gfsr_toGamma(lin), src.a);
}

// @program lens_final
uniform float u_aspect;
uniform float u_chromatic;      // 0..1
uniform float u_vignette;       // 0..1
uniform float u_vignetteRadius; // 0.3..1.2
uniform float u_vignetteSoftness;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec2 c = uv - 0.5;
    float r2 = dot(c * vec2(u_aspect, 1.0), c * vec2(u_aspect, 1.0));
    vec4 src = texture2D(colorTexture, uv);
    vec3 col = src.rgb;

    if (u_chromatic > 0.0) {
        // Radial lateral chromatic aberration, increasing towards the edges.
        vec2 off = c * r2 * u_chromatic * 0.02;
        float rr = texture2D(colorTexture, uv - off).r;
        float bb = texture2D(colorTexture, uv + off).b;
        float rr2 = texture2D(colorTexture, uv - off * 0.5).r;
        float bb2 = texture2D(colorTexture, uv + off * 0.5).b;
        col = vec3((rr + rr2) * 0.5, col.g, (bb + bb2) * 0.5);
    }

    if (u_vignette > 0.0) {
        float d = sqrt(r2);
        float v = 1.0 - smoothstep(u_vignetteRadius - max(u_vignetteSoftness, 0.01), u_vignetteRadius, d);
        col *= mix(1.0, v, u_vignette);
    }

    col += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, src.a);
}
