// GeoFS-ReShade : bloom.glsl
// Cinematic bloom.
//
// Pipeline
//   bloom_bright     (1/2 res)  soft-knee threshold + 4-tap anti-flicker prefilter
//   bloom_downsample (1/4 res)  13-tap "call of duty" downsample
//   bloom_blur       (1/4 res)  separable 9-tap Gaussian, run H then V, radius scaled
//   bloom_upsample   (1/2 res)  3x3 tent upsample + bright pass (soft bloom)
//   bloom_streak     (1/4 res)  anamorphic horizontal streaks (lens effect)
//   bloom_composite  (full)     additive composite in linear light
//
// Requires common.glsl (prepended by the loader).

uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;
uniform vec2 u_srcTexel; // texel size of the texture being sampled by this pass

// @program bloom_bright
uniform float u_threshold;
uniform float u_knee;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec2 o = u_srcTexel * 0.75;
    vec3 a = gfsr_toLinear(texture2D(colorTexture, uv + vec2(-o.x, -o.y)).rgb);
    vec3 b = gfsr_toLinear(texture2D(colorTexture, uv + vec2(o.x, -o.y)).rgb);
    vec3 c = gfsr_toLinear(texture2D(colorTexture, uv + vec2(-o.x, o.y)).rgb);
    vec3 d = gfsr_toLinear(texture2D(colorTexture, uv + vec2(o.x, o.y)).rgb);
    // Karis average suppresses single-pixel fireflies.
    float wa = 1.0 / (1.0 + gfsr_luma(a));
    float wb = 1.0 / (1.0 + gfsr_luma(b));
    float wc = 1.0 / (1.0 + gfsr_luma(c));
    float wd = 1.0 / (1.0 + gfsr_luma(d));
    vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);

    float threshold = gfsr_toLinear(vec3(u_threshold)).r;
    float br = max(col.r, max(col.g, col.b));
    float knee = threshold * u_knee + 1e-4;
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    float contrib = max(soft, br - threshold) / max(br, 1e-4);
    gl_FragColor = vec4(col * contrib, 1.0);
}

// @program bloom_downsample
void main()
{
    vec2 uv = v_textureCoordinates;
    vec2 t = u_srcTexel;
    vec3 a = texture2D(colorTexture, uv + t * vec2(-2.0, -2.0)).rgb;
    vec3 b = texture2D(colorTexture, uv + t * vec2(0.0, -2.0)).rgb;
    vec3 c = texture2D(colorTexture, uv + t * vec2(2.0, -2.0)).rgb;
    vec3 d = texture2D(colorTexture, uv + t * vec2(-2.0, 0.0)).rgb;
    vec3 e = texture2D(colorTexture, uv).rgb;
    vec3 f = texture2D(colorTexture, uv + t * vec2(2.0, 0.0)).rgb;
    vec3 g = texture2D(colorTexture, uv + t * vec2(-2.0, 2.0)).rgb;
    vec3 h = texture2D(colorTexture, uv + t * vec2(0.0, 2.0)).rgb;
    vec3 i = texture2D(colorTexture, uv + t * vec2(2.0, 2.0)).rgb;
    vec3 j = texture2D(colorTexture, uv + t * vec2(-1.0, -1.0)).rgb;
    vec3 k = texture2D(colorTexture, uv + t * vec2(1.0, -1.0)).rgb;
    vec3 l = texture2D(colorTexture, uv + t * vec2(-1.0, 1.0)).rgb;
    vec3 m = texture2D(colorTexture, uv + t * vec2(1.0, 1.0)).rgb;
    vec3 outc = e * 0.125;
    outc += (a + c + g + i) * 0.03125;
    outc += (b + d + f + h) * 0.0625;
    outc += (j + k + l + m) * 0.125;
    gl_FragColor = vec4(outc, 1.0);
}

// @program bloom_blur
uniform vec2 u_direction;
uniform float u_radius;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec2 stepUv = u_direction * u_srcTexel * u_radius;
    // 9-tap Gaussian folded into 5 bilinear fetches.
    vec3 sum = texture2D(colorTexture, uv).rgb * 0.2270270270;
    sum += texture2D(colorTexture, uv + stepUv * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(colorTexture, uv - stepUv * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(colorTexture, uv + stepUv * 3.2307692308).rgb * 0.0702702703;
    sum += texture2D(colorTexture, uv - stepUv * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
}

// @program bloom_upsample
uniform sampler2D u_brightTexture;
uniform float u_radius;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec2 t = u_srcTexel * u_radius;
    vec3 s = texture2D(colorTexture, uv).rgb * 4.0;
    s += texture2D(colorTexture, uv + vec2(-t.x, 0.0)).rgb * 2.0;
    s += texture2D(colorTexture, uv + vec2(t.x, 0.0)).rgb * 2.0;
    s += texture2D(colorTexture, uv + vec2(0.0, -t.y)).rgb * 2.0;
    s += texture2D(colorTexture, uv + vec2(0.0, t.y)).rgb * 2.0;
    s += texture2D(colorTexture, uv + vec2(-t.x, -t.y)).rgb;
    s += texture2D(colorTexture, uv + vec2(t.x, -t.y)).rgb;
    s += texture2D(colorTexture, uv + vec2(-t.x, t.y)).rgb;
    s += texture2D(colorTexture, uv + vec2(t.x, t.y)).rgb;
    vec3 wide = s / 16.0;
    vec3 tight = texture2D(u_brightTexture, uv).rgb;
    // Normalised so the mip chain conserves energy instead of growing ~1.35x per level.
    gl_FragColor = vec4((wide + tight * 0.35) / 1.35, 1.0);
}

// @program bloom_streak
uniform sampler2D u_source;
uniform float u_stepScale;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    for (int i = -8; i <= 8; i++) {
        float fi = float(i);
        float w = exp(-abs(fi) * 0.28);
        vec2 suv = uv + vec2(fi * u_srcTexel.x * u_stepScale, 0.0);
        sum += texture2D(u_source, suv).rgb * w;
        wsum += w;
    }
    gl_FragColor = vec4(sum / wsum, 1.0);
}

// @program bloom_composite
uniform sampler2D u_bloomTexture;
uniform sampler2D u_streakTexture;
uniform vec2 u_bloomDims;
uniform vec2 u_streakDims;
uniform float u_intensity;
uniform float u_streakIntensity;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    vec3 lin = gfsr_toLinear(src.rgb);
    vec3 bloom = gfsr_textureBilinear(u_bloomTexture, uv, u_bloomDims).rgb;
    vec3 streak = vec3(0.0);
    if (u_streakIntensity > 0.0) {
        streak = gfsr_textureBilinear(u_streakTexture, uv, u_streakDims).rgb * vec3(0.55, 0.75, 1.25);
    }
    lin += bloom * u_intensity + streak * u_streakIntensity;
    // Soft shoulder keeps the result inside the 8-bit buffer without hard clipping.
    vec3 outLin = lin / (1.0 + max(lin - 1.0, 0.0));
    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);
}
