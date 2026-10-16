// GeoFS-ReShade : colorgrade.glsl
// LUT-style professional colour grading, applied after tonemapping.
//
// Modes (u_mode):
//   0 Realistic     neutral, gentle filmic contrast
//   1 MSFS          clean, slightly cool, crisp mid-contrast, rich blues
//   2 DCS           muted, slightly green/olive military look, lower saturation
//   3 Cinematic     teal shadows / orange highlights, strong S-curve
//   4 Photographic  natural, lifted blacks, soft highlight roll-off, warm print
//
// Curves: separate shadows / midtones / highlights controls.
// Colour scheme: warm highlights, cool shadows (split toning).
//
// Requires common.glsl (prepended by the loader).

// @program colorgrade
uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;

uniform float u_mode;
uniform float u_strength;
uniform float u_shadows;     // -1..1  lift
uniform float u_midtones;    // -1..1  gamma
uniform float u_highlights;  // -1..1  gain
uniform float u_warmth;      //  0..1  warm highlights
uniform float u_coolness;    //  0..1  cool shadows
uniform float u_vibrance;    // -1..1

struct Grade {
    vec3 lift;
    vec3 gammaV;
    vec3 gain;
    float sat;
    float contrast;
    vec3 shadowTint;
    vec3 highlightTint;
    float splitAmount;
};

Grade gradeForMode(float mode)
{
    Grade g;
    g.lift = vec3(0.0);
    g.gammaV = vec3(1.0);
    g.gain = vec3(1.0);
    g.sat = 1.0;
    g.contrast = 1.0;
    g.shadowTint = vec3(0.0, 0.0, 0.0);
    g.highlightTint = vec3(0.0, 0.0, 0.0);
    g.splitAmount = 0.0;
    if (mode < 0.5) {
        g.lift = vec3(0.004, 0.004, 0.008);
        g.gammaV = vec3(1.0);
        g.gain = vec3(1.0);
        g.sat = 1.04;
        g.contrast = 1.04;
        g.shadowTint = vec3(-0.01, 0.0, 0.02);
        g.highlightTint = vec3(0.02, 0.01, -0.01);
        g.splitAmount = 0.5;
    } else if (mode < 1.5) {
        g.lift = vec3(0.0, 0.004, 0.012);
        g.gammaV = vec3(1.02, 1.0, 0.97);
        g.gain = vec3(1.0, 1.01, 1.04);
        g.sat = 1.12;
        g.contrast = 1.08;
        g.shadowTint = vec3(-0.015, 0.0, 0.03);
        g.highlightTint = vec3(0.025, 0.015, -0.01);
        g.splitAmount = 0.6;
    } else if (mode < 2.5) {
        g.lift = vec3(0.01, 0.012, 0.006);
        g.gammaV = vec3(1.0, 0.98, 1.04);
        g.gain = vec3(1.0, 1.01, 0.96);
        g.sat = 0.86;
        g.contrast = 1.06;
        g.shadowTint = vec3(-0.005, 0.01, 0.015);
        g.highlightTint = vec3(0.02, 0.02, -0.02);
        g.splitAmount = 0.5;
    } else if (mode < 3.5) {
        g.lift = vec3(-0.01, 0.005, 0.02);
        g.gammaV = vec3(0.98, 1.0, 1.03);
        g.gain = vec3(1.06, 1.0, 0.92);
        g.sat = 1.1;
        g.contrast = 1.18;
        g.shadowTint = vec3(-0.04, 0.01, 0.05);
        g.highlightTint = vec3(0.06, 0.02, -0.04);
        g.splitAmount = 1.0;
    } else {
        g.lift = vec3(0.025, 0.022, 0.02);
        g.gammaV = vec3(0.98, 1.0, 1.02);
        g.gain = vec3(1.02, 1.0, 0.97);
        g.sat = 0.95;
        g.contrast = 0.97;
        g.shadowTint = vec3(-0.01, 0.0, 0.015);
        g.highlightTint = vec3(0.03, 0.015, -0.015);
        g.splitAmount = 0.7;
    }
    return g;
}

vec3 liftGammaGain(vec3 c, vec3 lift, vec3 gammaV, vec3 gain)
{
    vec3 x = c * gain + lift * (1.0 - c);
    return pow(max(x, vec3(0.0)), 1.0 / max(gammaV, vec3(0.05)));
}

vec3 sCurve(vec3 c, float contrast)
{
    // Contrast pivoting around mid grey in perceptual space, smooth at the ends.
    vec3 x = c - 0.5;
    vec3 y = x * contrast / (1.0 + abs(x) * (contrast - 1.0) * 2.0);
    return clamp(y + 0.5, 0.0, 1.0);
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    vec3 c = clamp(src.rgb, 0.0, 1.0);

    Grade g = gradeForMode(u_mode);

    // Base look.
    vec3 graded = liftGammaGain(c, g.lift, g.gammaV, g.gain);
    graded = sCurve(graded, g.contrast);

    // Luminance zone weights.
    float l = gfsr_luma(graded);
    float wS = 1.0 - smoothstep(0.0, 0.45, l);
    float wH = smoothstep(0.55, 1.0, l);
    float wM = max(1.0 - wS - wH, 0.0);

    // User curves: shadows (lift), midtones (gamma), highlights (gain).
    graded += wS * u_shadows * 0.18 * (1.0 - graded);
    graded = mix(graded, pow(max(graded, vec3(0.0)), vec3(exp2(-u_midtones * 0.8))), wM);
    graded *= 1.0 + wH * u_highlights * 0.25;

    // Split toning: warm highlights, cool shadows.
    vec3 warm = vec3(0.06, 0.025, -0.045) * u_warmth;
    vec3 cool = vec3(-0.04, 0.0, 0.06) * u_coolness;
    graded += (g.highlightTint * g.splitAmount + warm) * wH;
    graded += (g.shadowTint * g.splitAmount + cool) * wS;

    // Saturation + vibrance (protects already saturated colours).
    float l2 = gfsr_luma(graded);
    graded = mix(vec3(l2), graded, g.sat);
    float mx = max(graded.r, max(graded.g, graded.b));
    float mn = min(graded.r, min(graded.g, graded.b));
    float satNow = mx - mn;
    float vib = 1.0 + u_vibrance * (1.0 - satNow);
    graded = mix(vec3(gfsr_luma(graded)), graded, vib);

    graded = clamp(graded, 0.0, 1.0);
    gl_FragColor = vec4(mix(c, graded, u_strength), src.a);
}
