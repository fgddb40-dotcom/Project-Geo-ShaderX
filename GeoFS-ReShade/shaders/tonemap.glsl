// GeoFS-ReShade : tonemap.glsl
// Photographic HDR pipeline.
//
// GeoFS hands post-processing an 8-bit display-referred image, so this stage
//   1. linearises it and gently re-expands highlights (inverse Reinhard on
//      luminance, capped so it never produces "HDR look" halos),
//   2. applies eye adaptation: a log-average scene luminance measured by the
//      tiny `luminance` pass drives a partial auto-exposure towards middle grey,
//   3. maps through the ACES filmic curve, followed by a film response curve
//      (soft toe + shoulder, like negative film scanned for print),
//   4. applies scotopic (Purkinje) vision at night: rod-dominated vision is
//      desaturated and shifted slightly towards blue,
//   5. applies gamma, contrast and saturation, then dithers to avoid banding.
//
// Requires common.glsl (prepended by the loader).

// @program luminance
// Runs at 1/16 resolution. Each output texel stores the log-luminance average
// of a 4x4 grid over its footprint in the full-resolution image.
uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;

uniform vec2 u_texel;      // full resolution texel size
uniform vec2 u_outTexel;   // texel size of this pass

void main()
{
    vec2 uv = v_textureCoordinates;
    float sumLog = 0.0;
    for (int y = 0; y < 4; y++) {
        for (int x = 0; x < 4; x++) {
            vec2 o = (vec2(float(x), float(y)) - 1.5) * 0.25 * u_outTexel;
            vec3 c = gfsr_toLinear(texture2D(colorTexture, uv + o).rgb);
            float lm = gfsr_luma(c);
            // NaN/Inf guard: a single bad pixel must never poison adaptation.
            lm = (lm == lm && lm < 1e4) ? lm : 0.18;
            sumLog += log(max(lm, 1e-4));
        }
    }
    // Store log-luminance remapped to 0..1 over [-9.2, 0.0] (= 1e-4 .. 1).
    float avg = sumLog / 16.0;
    gl_FragColor = vec4(clamp(avg / 9.2 + 1.0, 0.0, 1.0), 0.0, 0.0, 1.0);
}

// @program tonemap
uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;

uniform sampler2D u_lumTexture;
uniform float u_exposure;
uniform float u_gamma;
uniform float u_contrast;
uniform float u_saturation;
uniform vec4 u_adapt;   // x adaptation strength 0..1, y min EV, z max EV, w night factor 0..1
uniform vec4 u_film;    // x toe, y shoulder, z Purkinje strength, w highlight expansion

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

// Film response: lifts the toe slightly (no crushed blacks) and rolls the
// shoulder off softly so skies and clouds keep their gradation.
vec3 filmCurve(vec3 x, float toe, float shoulder)
{
    vec3 t = x + toe * 0.04 * (1.0 - x) * (1.0 - smoothstep(0.0, 0.25, x));
    vec3 s = 1.0 - (1.0 - t) * (1.0 - t);
    return mix(t, mix(t, s, 0.5 * smoothstep(0.55, 1.0, t)), shoulder);
}

float sceneLogLum()
{
    float s = 0.0;
    for (int y = 0; y < 4; y++) {
        for (int x = 0; x < 4; x++) {
            // Centre-weighted metering: the frame centre counts double.
            vec2 p = (vec2(float(x), float(y)) + 0.5) / 4.0;
            vec2 q = mix(vec2(0.5), p, 0.85);
            s += texture2D(u_lumTexture, q).r;
            s += texture2D(u_lumTexture, mix(vec2(0.5), p, 0.4)).r;
        }
    }
    return (s / 32.0 - 1.0) * 9.2;
}

void main()
{
    vec4 src = texture2D(colorTexture, v_textureCoordinates);
    vec3 lin = gfsr_toLinear(src.rgb);

    float l = gfsr_luma(lin);
    float k = 0.8 * u_film.w;
    float expanded = l / max(1.0 - k * l, 0.25);
    lin *= expanded / max(l, 1e-5);

    // Eye adaptation towards 18 % grey, clamped to an EV range and partial so
    // bright skies stay bright and night stays dark.
    float logAvg = sceneLogLum();
    float target = log(0.18) - logAvg;
    float ev = clamp(target / log(2.0), u_adapt.y, u_adapt.z);
    float adaptExp = exp2(ev * u_adapt.x);

    vec3 hdr = lin * u_exposure * adaptExp;

    // Scotopic vision: below ~0.03 cd/m2 equivalent, colour fades towards a
    // slightly blue-shifted luminance (Purkinje shift).
    float hl = gfsr_luma(hdr);
    float scot = u_film.z * u_adapt.w * (1.0 - smoothstep(0.004, 0.06, hl));
    vec3 rod = vec3(hl) * vec3(0.82, 0.92, 1.12);
    hdr = mix(hdr, rod, scot);

    vec3 mapped = ACESFilm(hdr);
    mapped = filmCurve(mapped, u_film.x, u_film.y);
    vec3 c = pow(mapped, vec3(1.0 / max(u_gamma, 0.1)));

    c = (c - 0.5) * u_contrast + 0.5;
    float lum = gfsr_luma(c);
    c = mix(vec3(lum), c, u_saturation);

    c += (gfsr_ign(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}
