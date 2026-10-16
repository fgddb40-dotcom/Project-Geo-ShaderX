// GeoFS-ReShade : tonemap.glsl
// HDR rendering pipeline.
//
// GeoFS hands post-processing an 8-bit display-referred image, so this stage
//   1. linearises it,
//   2. re-expands highlights (inverse Reinhard on luminance) to recover HDR headroom,
//   3. applies HDR exposure,
//   4. maps back with the ACES filmic curve,
//   5. applies gamma, contrast and saturation, then dithers to avoid banding.
//
// Requires common.glsl (prepended by the loader).

// @program tonemap
uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;

uniform float u_exposure;
uniform float u_gamma;
uniform float u_contrast;
uniform float u_saturation;

vec3 ACESFilm(vec3 x)
{
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;

    return clamp(
        (x * (a * x + b))
        / (x * (c * x + d) + e),
        0.0,
        1.0
    );
}

void main()
{
    vec4 src = texture2D(colorTexture, v_textureCoordinates);
    vec3 lin = gfsr_toLinear(src.rgb);

    float l = gfsr_luma(lin);
    float expanded = l / max(1.0 - 0.8 * l, 0.2);
    lin *= expanded / max(l, 1e-5);

    vec3 mapped = ACESFilm(lin * u_exposure);
    vec3 c = pow(mapped, vec3(1.0 / max(u_gamma, 0.1)));

    c = (c - 0.5) * u_contrast + 0.5;
    float lum = gfsr_luma(c);
    c = mix(vec3(lum), c, u_saturation);

    c += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}
