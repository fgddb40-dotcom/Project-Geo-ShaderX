// GeoFS-ReShade : atmosphere.glsl
// Physically based sky replacement and aerial perspective.
//
//   Day      : single-scatter Rayleigh + Mie + ozone integral (common.glsl),
//              realistic luminance (deep zenith blue, pale horizon), sun disk
//              with limb darkening, atmosphere curvature at altitude.
//   Twilight : the same integral naturally produces the orange horizon, the
//              Belt of Venus and the ozone-purple upper sky.
//   Night    : moonlit Rayleigh sky, airglow, procedural star field fixed in
//              the ICRF frame (real sidereal / seasonal motion), twinkling and
//              extinction by airmass, Milky Way band with dust lanes, phased moon.
//   Ground   : aerial perspective (in-scatter + extinction) driven by the
//              distance in the depth buffer, humidity and weather.
//
// Requires common.glsl (prepended by the loader).

// @program atmosphere
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform mat3 u_eyeToEnu;
uniform mat3 u_eyeToIcrf;     // eye space -> inertial (ICRF) frame for the star field
uniform float u_camHeight;
uniform float u_skyBlend;
uniform float u_hazeStrength;
uniform float u_rayleigh;
uniform float u_mie;
uniform float u_horizonGlow;
uniform float u_sunsetShift;
uniform float u_steps;
uniform float u_time;
uniform float u_pixelAngle;   // radians per pixel (vertical)
uniform vec4 u_stars;         // x star brightness, y Milky Way, z twinkle, w moon brightness
uniform vec4 u_moisture;      // x humidity, y surface wetness, z air temperature (C), w unused
uniform vec4 u_weather;       // x overcast, y storm, z precipitation, w fog

const vec3 GAL_NORTH = vec3(-0.86766, -0.19810, 0.45598);
const vec3 GAL_CENTER = vec3(-0.054877, -0.873437, -0.483835);
const float MOON_RADIUS = 0.00452;

vec3 weatherTint(vec3 c, float overcast, float storm)
{
    float l = gfsr_luma(c);
    vec3 grey = vec3(l) * vec3(0.94, 0.97, 1.0);
    vec3 stormGrey = vec3(l) * vec3(0.60, 0.66, 0.72);
    vec3 outc = mix(c, grey, overcast * 0.85);
    return mix(outc, stormGrey, storm * 0.8);
}

// One layer of procedural stars. d = ICRF direction.
vec3 starLayer(vec3 d, float scale, float prob, float seed, float pixAng, float twinkle)
{
    vec3 p = d * scale;
    vec3 cell = floor(p);
    float h = gfsr_hash13(cell + seed);
    if (h > prob) {
        return vec3(0.0);
    }
    vec3 jit = vec3(gfsr_hash13(cell + seed + 3.1), gfsr_hash13(cell + seed + 5.7), gfsr_hash13(cell + seed + 9.3)) * 0.56 + 0.22;
    vec3 sp = normalize(cell + jit);
    float a = length(d - sp);
    float hb = gfsr_hash13(cell + seed + 13.7);
    // Power-law magnitude distribution: many faint stars, few bright ones.
    float mag = pow(hb, 9.0) * 6.0 + 0.04 + pow(hb, 2.0) * 0.08;
    float sigma = pixAng * (0.65 + 0.5 * pow(hb, 6.0));
    float g = exp(-(a * a) / (sigma * sigma));
    // Most naked-eye stars are white-yellow; a few red giants and blue giants.
    float tk = gfsr_hash13(cell + seed + 21.9);
    float kelvin = tk < 0.15 ? mix(3000.0, 4200.0, tk / 0.15) : (tk > 0.9 ? mix(9000.0, 15000.0, (tk - 0.9) / 0.1) : mix(4800.0, 7500.0, (tk - 0.15) / 0.75));
    vec3 col = mix(vec3(1.0), gfsr_blackbody(kelvin) / max(gfsr_luma(gfsr_blackbody(kelvin)), 0.05), 0.55);
    float ph = gfsr_hash13(cell + seed + 31.3) * 6.2831;
    float tw = 1.0 + twinkle * (0.55 * sin(u_time * (9.0 + h * 40.0) + ph) + 0.35 * sin(u_time * (23.0 + hb * 30.0) + ph * 2.0));
    return col * g * mag * max(tw, 0.05);
}

vec3 milkyWay(vec3 d)
{
    float b = dot(d, GAL_NORTH);
    float toCenter = dot(d, GAL_CENTER);
    float bulge = exp(-pow(acos(clamp(toCenter, -1.0, 1.0)) / 0.55, 2.0));
    float width = 0.14 + 0.12 * bulge;
    float band = exp(-(b * b) / (width * width));
    float mottling = gfsr_fbm3(d * 9.0 + 50.0, 1000.0, 5);
    float stars = gfsr_fbm3(d * 40.0 + 10.0, 1000.0, 3);
    float laneX = (b + 0.012) / (0.035 + 0.02 * bulge); float lane = exp(-laneX * laneX) * smoothstep(0.35, 0.75, gfsr_fbm3(d * 14.0, 1000.0, 4));
    float i = band * (0.35 + 0.65 * bulge) * (0.45 + 0.9 * mottling) * (0.8 + 0.4 * stars) * (1.0 - 0.75 * lane);
    vec3 col = mix(vec3(0.70, 0.76, 1.0), vec3(1.0, 0.86, 0.70), bulge);
    return col * i;
}

// Moon disk with phase shading; dirs in ENU.
vec3 moonDisk(vec3 rd, vec3 moonDir, vec3 sunDir, out float cover)
{
    cover = 0.0;
    float c = dot(rd, moonDir);
    float a = sqrt(max(2.0 - 2.0 * c, 0.0));
    if (c < 0.0 || a > MOON_RADIUS * 1.15) {
        return vec3(0.0);
    }
    vec3 off = (rd - moonDir * c) / MOON_RADIUS;
    float r2 = dot(off, off);
    cover = 1.0 - smoothstep(0.92, 1.05, sqrt(r2));
    vec3 n = normalize(off - moonDir * sqrt(max(1.0 - min(r2, 1.0), 0.0)));
    float lit = max(dot(n, sunDir), 0.0);
    vec3 q = off * 4.0 + 7.0;
    float maria = gfsr_fbm3(q, 1000.0, 4);
    float albedo = mix(0.55, 1.0, smoothstep(0.35, 0.65, maria));
    float earthshine = 0.012;
    return vec3(1.0, 0.97, 0.92) * (lit * albedo + earthshine) * cover;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);

    vec3 rdEC = gfsr_viewRayEC(uv);
    vec3 rd = normalize(u_eyeToEnu * rdEC);
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    vec3 moonDir = normalize(u_eyeToEnu * czm_moonDirectionEC);
    float camHKm = max(u_camHeight, 1.0) * 0.001;
    float nu = dot(rd, sunDir);

    float humidity = u_moisture.x;
    float overcast = u_weather.x;
    float storm = u_weather.y;
    float mie = u_mie * (1.0 + humidity * 1.6 + overcast * 1.2 + u_weather.w * 3.0);
    float ozone = u_sunsetShift;
    float day = smoothstep(-0.10, 0.02, sunDir.z);
    float night = 1.0 - smoothstep(-0.18, -0.04, sunDir.z);
    vec3 sunT = gfsr_sunTransmittance(camHKm, sunDir.z, u_rayleigh, mie, ozone);
    // Fraction of the moon disk that is lit (0 new moon .. 1 full moon).
    float moonPhase = 0.5 * (1.0 - dot(sunDir, moonDir));
    float moonUp = smoothstep(-0.05, 0.08, moonDir.z);
    float moonLight = 0.0035 * pow(max(moonPhase, 0.0), 1.5) * moonUp * u_stars.w;

    if (gfsr_isSkyDepth(raw)) {
        vec3 L;
        vec3 T;
        gfsr_scatter(camHKm, rd, sunDir, 1.0e9, u_rayleigh, mie, ozone, u_steps, L, T);

        // Moonlit sky: the same scattering integral, ~1/300 of the sunlit sky
        // (perceptually scaled for a display without scotopic adaptation).
        if (moonLight > 0.0 && night > 0.0) {
            vec3 Lm;
            vec3 Tm;
            gfsr_scatter(camHKm, rd, moonDir, 1.0e9, u_rayleigh, mie, ozone, max(4.0, floor(u_steps * 0.5)), Lm, Tm);
            L += Lm * moonLight * 60.0 * night;
        }

        // Optional subtle forward-scatter boost along the horizon (physical
        // multiple scattering the single-scatter integral underestimates).
        float lowSun = 1.0 - smoothstep(0.0, 0.3, abs(sunDir.z));
        float band = exp(-abs(rd.z) * 18.0);
        float towardsSun = 0.3 + 0.7 * pow(max(nu, 0.0), 4.0);
        L += sunT * vec3(1.0, 0.72, 0.48) * band * towardsSun * lowSun * u_horizonGlow * 0.25 * day;

        // Night sky: airglow, stars and Milky Way, dimmed by extinction and
        // by the sky background (they disappear in daylight naturally).
        float above = smoothstep(-0.02, 0.03, rd.z);
        vec3 d = normalize(u_eyeToIcrf * rdEC);
        float airmass = 1.0 / max(rd.z + 0.025, 0.025);
        float twinkle = u_stars.z * clamp(airmass * 0.18, 0.15, 1.0) * (1.0 - smoothstep(10000.0, 30000.0, u_camHeight));
        float pix = max(u_pixelAngle, 2.0e-4);
        vec3 stars = starLayer(d, 150.0, 0.045, 0.0, pix, twinkle) + starLayer(d, 330.0, 0.05, 71.0, pix, twinkle) * 0.45;
        vec3 mw = milkyWay(d) * 0.012 * u_stars.y;
        vec3 airglow = vec3(0.0016, 0.0022, 0.0030) * (1.0 + 2.0 * exp(-max(rd.z, 0.0) * 8.0));
        float skyBg = gfsr_luma(1.0 - exp(-L));
        float visible = (1.0 - smoothstep(0.0, 0.08, skyBg)) * above * (1.0 - overcast * 0.95);
        L += (stars * 0.25 * u_stars.x + mw) * T * visible + airglow * night * above;

        // Sun disk with limb darkening, attenuated by the atmosphere.
        float sunCos = 0.999989;
        float disk = smoothstep(sunCos - 0.000004, sunCos + 0.000003, nu);
        float limb = sqrt(max(1.0 - (1.0 - nu) / (1.0 - sunCos + 1e-7), 0.0));
        L += sunT * disk * (0.45 + 0.55 * limb) * 40.0 * (1.0 - overcast * 0.95);

        // Moon (also faintly visible in daylight).
        float mCover;
        vec3 moon = moonDisk(rd, moonDir, sunDir, mCover) * u_stars.w;
        L += moon * T * mix(0.35, 0.9, night) * above;

        vec3 sky = gfsr_toGamma(1.0 - exp(-L));
        sky = weatherTint(sky, overcast, storm);
        gl_FragColor = vec4(mix(src.rgb, sky, u_skyBlend), src.a);
        return;
    }

    // Aerial perspective for terrain, aircraft and buildings.
    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    float distKm = length(pEC) * 0.001;
    vec3 L;
    vec3 T;
    gfsr_scatter(camHKm, rd, sunDir, distKm, u_rayleigh, mie, ozone, max(4.0, floor(u_steps * 0.5)), L, T);
    if (moonLight > 0.0 && night > 0.0) {
        vec3 Lm;
        vec3 Tm;
        gfsr_scatter(camHKm, rd, moonDir, distKm, u_rayleigh, mie, ozone, 4.0, Lm, Tm);
        L += Lm * moonLight * 60.0 * night;
    }

    vec3 lin = gfsr_toLinear(src.rgb);
    float k = u_hazeStrength;
    vec3 transm = mix(vec3(1.0), T, k);
    vec3 haze = (1.0 - exp(-L)) * k;
    vec3 outLin = lin * transm + haze;

    // Boundary-layer moisture: humid air near the ground scatters white light
    // (visibility reduction), strongest when the camera itself is low.
    float lowAlt = 1.0 - smoothstep(800.0, 6000.0, u_camHeight);
    float moist = 0.008 + 0.05 * humidity * humidity + 0.12 * u_weather.w;
    float hazeAmt = (1.0 - exp(-distKm * moist * (0.35 + 0.65 * lowAlt) * k));
    vec3 hazeCol = vec3(0.62, 0.68, 0.76) * (0.25 + 0.75 * sunT) * day + vec3(0.004, 0.005, 0.008) * night;
    outLin = mix(outLin, hazeCol, hazeAmt * 0.6);

    vec3 outc = gfsr_toGamma(outLin);
    outc = weatherTint(outc, overcast * 0.6, storm * 0.7);
    gl_FragColor = vec4(outc, src.a);
}
