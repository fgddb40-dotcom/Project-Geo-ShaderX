// GeoFS-ReShade : ssao.glsl
// Screen Space Ambient Occlusion.
//
//   Inputs : depth buffer + normals reconstructed from depth
//   Output : terrain crevice darkening, aircraft self-shadowing and cockpit
//            ambient shading
//
// The sampling radius grows with distance so that the same effect works for
// the cockpit (centimetres), the airframe (metres) and terrain (hundreds of m).
//
// Pipeline: ssao_generate (half res) -> ssao_blur (H) -> ssao_blur (V) -> ssao_apply
// Requires common.glsl (prepended by the loader).

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;
uniform vec2 u_texel; // full-resolution texel size

// @program ssao_generate
uniform float u_radius;
uniform float u_bias;
uniform float u_strength;
uniform float u_samples;

void main()
{
    vec2 uv = v_textureCoordinates;
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw)) {
        gl_FragColor = vec4(1.0);
        return;
    }

    vec3 p = gfsr_eyePosition(depthTexture, uv);
    float dist = length(p);
    vec3 n = gfsr_normalEC(depthTexture, uv, u_texel, p);

    float radius = u_radius * clamp(dist / 50.0, 0.15, 200.0);
    float projScale = czm_projection[1][1] * 0.5 / max(-p.z, 0.05);
    float screenR = clamp(radius * projScale, 2.0 * u_texel.y, 0.15);

    float n_s = max(u_samples, 1.0);
    float angle0 = gfsr_ign(gl_FragCoord.xy) * 6.2831853;
    float xScale = u_texel.x / u_texel.y; // converts uv-y radius into uv-x
    float occlusion = 0.0;

    for (int i = 0; i < 32; i++) {
        if (float(i) >= n_s) {
            break;
        }
        // Golden-angle spiral, radius grows with sqrt(i) for even coverage.
        float fi = (float(i) + 0.5) / n_s;
        float ang = angle0 + float(i) * 2.39996323;
        vec2 dir = vec2(cos(ang) * xScale, sin(ang));
        vec2 suv = uv + dir * screenR * sqrt(fi);
        if (suv.x <= 0.0 || suv.y <= 0.0 || suv.x >= 1.0 || suv.y >= 1.0) {
            continue;
        }
        if (gfsr_isSkyDepth(gfsr_rawDepth(depthTexture, suv))) {
            continue;
        }
        vec3 q = gfsr_eyePosition(depthTexture, suv);
        vec3 v = q - p;
        float vl = length(v);
        float ndv = dot(n, v) / max(vl, 1e-4);
        float range = 1.0 - smoothstep(radius * 0.75, radius * 2.0, vl);
        occlusion += max(ndv - u_bias, 0.0) * range;
    }

    occlusion = occlusion / n_s;
    float distFade = 1.0 - smoothstep(30000.0, 80000.0, dist);
    float ao = 1.0 - clamp(occlusion * u_strength * 1.6, 0.0, 1.0) * distFade;
    gl_FragColor = vec4(ao, ao, ao, 1.0);
}

// @program ssao_blur
uniform vec2 u_direction; // (1,0) or (0,1)
uniform vec2 u_sourceTexel; // texel size of the half-resolution AO buffer

float linearDistance(vec2 uv)
{
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw)) {
        return 1.0e7;
    }
    return length(gfsr_eyePosition(depthTexture, uv));
}

void main()
{
    vec2 uv = v_textureCoordinates;
    float centerD = linearDistance(uv);
    float logC = log(max(centerD, 0.01));
    float sum = 0.0;
    float wsum = 0.0;
    for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        vec2 suv = uv + u_direction * u_sourceTexel * fi * 1.5;
        float g = exp(-fi * fi / 8.0);
        float d = linearDistance(suv);
        float w = g / (0.02 + abs(log(max(d, 0.01)) - logC) * 8.0);
        sum += texture2D(colorTexture, suv).r * w;
        wsum += w;
    }
    float ao = sum / max(wsum, 1e-5);
    gl_FragColor = vec4(ao, ao, ao, 1.0);
}

// @program ssao_apply
uniform sampler2D u_aoTexture;
uniform vec2 u_aoDims;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float ao = gfsr_textureBilinear(u_aoTexture, uv, u_aoDims).r;
    // Occlusion mostly affects ambient light: keep highlights partially lit.
    float l = gfsr_luma(src.rgb);
    float applied = mix(ao, 1.0, smoothstep(0.75, 1.0, l) * 0.5);
    gl_FragColor = vec4(src.rgb * applied, src.a);
}
