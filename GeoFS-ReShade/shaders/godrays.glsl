// GeoFS-ReShade : godrays.glsl
// Screen-space crepuscular rays (sun shafts).
//
//   godrays_mask   (1/2 res)  occlusion mask: sky pixels near the sun, dimmed by
//                             clouds already composited into the frame (cloud interaction)
//   godrays_blur   (1/2 res)  radial blur towards the sun (Mitchell / GPU Gems 3)
//   godrays_apply  (full)     atmospheric tinting, additive composite, sun glare
//
// Requires common.glsl (prepended by the loader).

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;
uniform mat3 u_eyeToEnu;
uniform float u_aspect; // width / height

float sunFacing()
{
    // 1 when the sun is in front of the camera, fading out towards the edges.
    vec3 s = gfsr_sunScreen();
    if (s.z < 0.5) {
        return 0.0;
    }
    vec2 d = max(abs(s.xy - 0.5) - 0.5, 0.0);
    return 1.0 - smoothstep(0.0, 0.6, length(d));
}

// @program godrays_mask
void main()
{
    vec2 uv = v_textureCoordinates;
    vec3 sun = gfsr_sunScreen();
    float raw = gfsr_rawDepth(depthTexture, uv);
    vec3 col = texture2D(colorTexture, uv).rgb;

    float sky = gfsr_isSkyDepth(raw) ? 1.0 : 0.0;
    vec2 d = (uv - sun.xy) * vec2(u_aspect, 1.0);
    float dist = length(d);
    float nearSun = exp(-dist * 5.0);

    // Clouds composited earlier are bright on their sunlit side but block the
    // disk: weighting by a high luma threshold makes them cast shadow shafts.
    float l = gfsr_luma(col);
    float bright = smoothstep(0.72, 1.0, l);

    vec3 sunDirEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float day = smoothstep(-0.05, 0.08, sunDirEnu.z);
    float m = sky * bright * nearSun * day;
    gl_FragColor = vec4(col * m, m);
}

// @program godrays_blur
uniform float u_samples;
uniform float u_length;
uniform float u_decay;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec3 sun = gfsr_sunScreen();
    vec2 delta = (uv - sun.xy) * (u_length / max(u_samples, 1.0));
    float jitter = gfsr_ign(gl_FragCoord.xy);
    vec2 cur = uv - delta * jitter;
    vec4 sum = vec4(0.0);
    float illum = 1.0;
    float wsum = 0.0;
    for (int i = 0; i < 128; i++) {
        if (float(i) >= u_samples) {
            break;
        }
        vec4 s = texture2D(colorTexture, clamp(cur, 0.0, 1.0));
        sum += s * illum;
        wsum += illum;
        illum *= u_decay;
        cur -= delta;
    }
    gl_FragColor = sum / max(wsum, 1e-4) * 1.25;
}

// @program godrays_apply
uniform sampler2D u_raysTexture;
uniform vec2 u_raysDims;
uniform float u_strength;
uniform float u_glare;
uniform float u_camHeight;
uniform float u_rayleigh;
uniform float u_mie;
uniform vec4 u_weather;

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    vec3 lin = gfsr_toLinear(src.rgb);

    vec3 sunDirEnu = normalize(u_eyeToEnu * czm_sunDirectionEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    // Atmospheric scattering colours the shafts: white at noon, gold at sunset.
    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDirEnu.z, u_rayleigh, u_mie, 0.6);
    vec3 tint = normalize(sunT + 1e-4) * 1.7320508;
    float facing = sunFacing();
    float overcast = u_weather.x;
    // Broken cloud cover produces the strongest visible shafts; full overcast hides the sun.
    float cloudBoost = 1.0 + overcast * 1.2 * (1.0 - smoothstep(0.7, 1.0, overcast) * 0.9);
    float fogBoost = 1.0 + u_weather.w * 1.5;

    vec4 rays = gfsr_textureBilinear(u_raysTexture, uv, u_raysDims);
    vec3 shafts = gfsr_toLinear(rays.rgb) * tint * u_strength * facing * cloudBoost * fogBoost;

    // Sun glare: wide soft glow around the sun disk, visible when the sun itself is visible.
    vec3 sun = gfsr_sunScreen();
    vec2 d = (uv - sun.xy) * vec2(u_aspect, 1.0);
    float dist = length(d);
    float vis = gfsr_textureBilinear(u_raysTexture, clamp(sun.xy, 0.0, 1.0), u_raysDims).a;
    float glare = (exp(-dist * 9.0) * 0.6 + exp(-dist * 2.5) * 0.15) * vis * facing;
    glare *= u_glare * (1.0 - overcast * 0.8);
    vec3 glareCol = sunT * glare;

    // Screen-style blend: shafts brighten darker areas without clipping already bright clouds.
    vec3 add = (shafts * 0.7 + glareCol);
    lin += add * max(vec3(1.0) - lin * 0.85, vec3(0.0));
    vec3 outLin = lin / (1.0 + max(lin - 1.0, 0.0));
    gl_FragColor = vec4(gfsr_toGamma(outLin), src.a);
}
