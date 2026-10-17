// GeoFS-ReShade : terrain.glsl
// Terrain & forest realism pass (runs first, on the raw scene colour).
//
// GeoFS draws the globe unlit: satellite imagery with its capture-time lighting
// baked in, so mountains look flat and forests look painted. This pass works
// purely from the depth buffer and the imagery colour:
//
//   * Terrain normal reconstruction (distance-adaptive stride)
//   * Slope-aware physically based lighting (sun + sky ambient), expressed as a
//     ratio to flat ground so the imagery albedo is preserved
//   * Terrain self-shadowing and contact shadows (screen-space ray march
//     towards the sun; sharp near the occluder, soft with distance)
//   * Elevation / slope / humidity driven materials: grass, dirt, rock, snow,
//     sand micro-detail in world-locked coordinates (no blurry imagery)
//   * Forest canopy: a two-layer 3D crown height field (8 m crowns over a
//     3.2 m understory) with sun-facing crown normals, crown-to-crown cast
//     shadows marched towards the sun, interior occlusion, leaf clumps and
//     back-lit translucency; multi-scale bushy clustering plus the canopy
//     hotspot response at altitude
//   * Wet surfaces: darkened porous ground, puddles, rain ripples and
//     screen-space reflections on wet runways
//
// Requires common.glsl (prepended by the loader).

// @program terrain
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform sampler2D u_acMask;      // aircraft mask (r), see mask.glsl
uniform mat3 u_eyeToEnu;
uniform float u_camHeight;
uniform float u_time;
uniform vec2 u_texel;
uniform vec2 u_worldOffset;      // camera-locked ENU offset, wraps every 4096 m
uniform float u_pixelAngle;      // radians per pixel
uniform float u_aircraftDistance;
uniform float u_aircraftRadius;
uniform vec4 u_terrain;          // x lighting, y micro detail, z materials, w forest
uniform vec4 u_terrain2;         // x snowline (m), y shadow strength, z shadow steps, w wet reflections
uniform vec4 u_moisture;         // x humidity, y wetness, z sea-level temperature (C), w unused
uniform vec4 u_weather;          // x overcast, y storm, z precipitation, w fog

const vec2 WORLD_PERIOD = vec2(4096.0);

// Band-limited world-locked value noise: fades out once a noise cell is
// smaller than ~2 pixels so distant terrain never shimmers.
float detailNoise(vec2 wp, float cell, float footprint)
{
    float fade = 1.0 - smoothstep(cell * 0.35, cell * 1.5, footprint);
    if (fade <= 0.0) {
        return 0.5;
    }
    return mix(0.5, gfsr_noise2(wp / cell, WORLD_PERIOD / cell), fade);
}

// Screen-space shadow ray towards the sun. Returns 1 = lit, 0 = shadowed.
float screenShadow(vec3 pEC, vec3 lEC, float dist, float steps, float jitter)
{
    float maxT = clamp(dist * 0.35, 2.0, 12000.0);
    float occl = 0.0;
    float n = max(steps, 2.0);
    for (int i = 0; i < 32; i++) {
        if (float(i) >= n) {
            break;
        }
        float f = (float(i) + jitter) / n;
        float t = maxT * f * f + dist * 0.002;
        vec3 p = pEC + lEC * t;
        if (p.z > -0.05) {
            break;
        }
        vec3 s = gfsr_projectEC(p);
        if (s.z < 0.0 || s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) {
            break;
        }
        float raw = texture2D(depthTexture, s.xy).r;
        if (gfsr_isSkyDepth(raw)) {
            continue;
        }
        vec3 q = gfsr_eyePosition(depthTexture, s.xy);
        float diff = (-p.z) - (-q.z);
        float bias = -p.z * 0.004 + 0.05;
        float thick = max(t * 0.6, 3.0) + -p.z * 0.02;
        if (diff > bias && diff < thick) {
            // Occluders close to the receiver give hard contact shadows,
            // distant occluders give a soft penumbra.
            float hard = 1.0 - f * 0.6;
            occl = max(occl, hard * smoothstep(bias, bias * 3.0 + 0.2, diff));
        }
    }
    return 1.0 - occl;
}

// Canopy height field: tall crowns on an 8 m Worley grid over a 3.2 m
// understory layer (both tile WORLD_PERIOD exactly). Each crown is a
// half-ellipsoid. Returns (height m, dh/dx, dh/dy, crown id of the top layer).
vec4 canopy(vec2 q)
{
    vec4 a = gfsr_worley2(q / 8.0, WORLD_PERIOD / 8.0);
    float ra = 0.40 + 0.28 * a.y;
    float ea = max(1.0 - a.x * a.x / (ra * ra), 0.0);
    float topA = 12.0 + 10.0 * a.y;
    float ha = topA * sqrt(ea);
    vec4 b = gfsr_worley2(q / 3.2, WORLD_PERIOD / 3.2);
    float rb = 0.45 + 0.25 * b.y;
    float eb = max(1.0 - b.x * b.x / (rb * rb), 0.0);
    float topB = 3.0 + 4.0 * b.y;
    float hb = topB * sqrt(eb);
    // dh/dp of T*sqrt(1 - |f-p|^2/r^2), with off = f - p in cell units.
    if (ha >= hb) {
        vec2 g = topA * a.zw / (ra * ra * 8.0 * max(sqrt(ea), 0.12));
        return vec4(ha, g, a.y);
    }
    vec2 g = topB * b.zw / (rb * rb * 3.2 * max(sqrt(eb), 0.12));
    return vec4(hb, g, b.y);
}

// Soft sun shadow cast by neighbouring crowns onto the canopy point at height h0.
float canopyShadow(vec2 q, float h0, vec3 sunDir, float jitter)
{
    float horiz = max(length(sunDir.xy), 1e-3);
    vec2 sd = sunDir.xy / horiz;
    float tanE = max(sunDir.z, 0.02) / horiz;
    float sh = 1.0;
    float s = 1.2 + jitter * 0.8;
    for (int i = 0; i < 4; i++) {
        float hs = canopy(q + sd * s).x;
        float above = hs - (h0 + s * tanE);
        sh = min(sh, clamp(1.0 - above / 1.8, 0.0, 1.0));
        s *= 1.85;
    }
    return sh;
}

void main()
{
    vec2 uv = v_textureCoordinates;
    vec4 src = texture2D(colorTexture, uv);
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (gfsr_isSkyDepth(raw)) {
        gl_FragColor = src;
        return;
    }

    vec3 pEC = gfsr_eyePosition(depthTexture, uv);
    float dist = length(pEC);
    float acMask = texture2D(u_acMask, uv).r;
    if (acMask > 0.5) {
        gl_FragColor = src;
        return;
    }

    // Distance-adaptive normal reconstruction: wider stride far away hides
    // depth quantisation, single-texel stride near the camera keeps detail.
    float stride = clamp(dist / 3000.0, 1.0, 3.0);
    vec3 nEC = gfsr_normalEC(depthTexture, uv, u_texel * stride, pEC);
    vec3 vEC = normalize(-pEC);
    if (dot(nEC, vEC) < 0.0) {
        nEC = -nEC;
    }
    vec3 N = normalize(u_eyeToEnu * nEC);
    vec3 V = normalize(u_eyeToEnu * vEC);
    vec3 sunDir = normalize(u_eyeToEnu * czm_sunDirectionEC);
    vec3 p = u_eyeToEnu * pEC;
    float alt = u_camHeight + p.z + dot(p.xy, p.xy) / (2.0 * GFSR_R_M);
    vec2 wp = mod(p.xy + u_worldOffset, WORLD_PERIOD);
    float footprint = dist * max(u_pixelAngle, 1e-5) / max(dot(N, V), 0.25);
    float jitter = gfsr_ign(gl_FragCoord.xy);

    vec3 col = gfsr_toLinear(src.rgb);
    float l = gfsr_luma(src.rgb);
    float mx = max(src.r, max(src.g, src.b));
    float mn = min(src.r, min(src.g, src.b));
    float sat = (mx - mn) / max(mx, 1e-3);
    float slope = 1.0 - clamp(N.z, 0.0, 1.0);
    float day = smoothstep(-0.05, 0.08, sunDir.z);
    float overcast = clamp(u_weather.x + u_weather.y * 0.5, 0.0, 1.0);
    float humidity = u_moisture.x;
    float wet = u_moisture.y;
    float dFade = 1.0 - smoothstep(60000.0, 160000.0, dist);

    // ---------------- Material classification -----------------
    float veg = smoothstep(0.0, 0.06, src.g - max(src.r, src.b * 0.95)) * smoothstep(0.05, 0.18, sat);
    float forest = veg * (1.0 - smoothstep(0.14, 0.26, l));
    float grass = veg * (1.0 - forest);
    float snowPix = smoothstep(0.62, 0.8, l) * (1.0 - smoothstep(0.08, 0.2, sat));
    float sand = smoothstep(0.02, 0.08, src.r - src.b) * smoothstep(0.04, 0.0, abs(src.r - src.g) - 0.06)
               * smoothstep(0.38, 0.55, l) * (1.0 - veg) * (1.0 - snowPix);
    float paved = (1.0 - smoothstep(0.06, 0.14, sat)) * smoothstep(0.12, 0.25, l) * (1.0 - smoothstep(0.6, 0.75, l));
    float rock = smoothstep(0.42, 0.7, slope);
    float dirt = clamp(1.0 - veg - snowPix - sand - paved, 0.0, 1.0);

    // ---------------- Micro detail (world-locked) -----------------
    float k = u_terrain.y * dFade;
    if (k > 0.0) {
        float n1 = detailNoise(wp, 1.5, footprint);
        float n2 = detailNoise(wp, 6.0, footprint);
        float n3 = detailNoise(wp, 23.0, footprint);
        float n4 = detailNoise(wp, 90.0, footprint);
        float grassD = (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.18 + (n3 - 0.5) * 0.14 + (n4 - 0.5) * 0.12;
        float dirtD = (n1 - 0.5) * 0.25 + (n2 - 0.5) * 0.2 + (n4 - 0.5) * 0.1;
        // Rock strata: noise stretched along the contour (perpendicular to the slope).
        vec2 contour = normalize(vec2(-N.y, N.x) + 1e-4);
        vec2 rq = vec2(dot(wp, contour), alt * 3.0);
        float strata = detailNoise(rq * vec2(0.25, 1.0), 4.0, footprint);
        float rockD = (strata - 0.5) * 0.45 + (n2 - 0.5) * 0.25;
        float snowD = (n2 - 0.5) * 0.05 + (n3 - 0.5) * 0.05;
        float sandD = (detailNoise(wp * vec2(1.0, 4.0), 2.0, footprint) - 0.5) * 0.1 + (n3 - 0.5) * 0.08;
        float pavedD = (n1 - 0.5) * 0.06 + (n3 - 0.5) * 0.05;
        float d = grassD * grass + dirtD * dirt + rockD * rock + snowD * snowPix + sandD * sand + pavedD * paved;
        col *= 1.0 + d * k;
        // Subtle hue variation within grass fields (dry / lush patches).
        col = mix(col, col * vec3(1.06, 1.02, 0.86), grass * (n4 - 0.35) * 0.5 * k);
    }

    // ---------------- Slope / altitude materials -----------------
    float m = u_terrain.z * dFade;
    if (m > 0.0) {
        // Steep slopes: satellite imagery smears on cliffs; replace with rock
        // tinted by the local colour.
        float lum = gfsr_luma(col);
        vec3 rockCol = mix(vec3(lum) * vec3(1.04, 1.0, 0.94), col, 0.35) * (0.8 + 0.4 * detailNoise(wp, 9.0, footprint));
        col = mix(col, rockCol, rock * m * (1.0 - snowPix));
        // Snow above the (temperature-adjusted) snowline on gentle slopes.
        float snowline = u_terrain2.x + (u_moisture.z - 15.0) * 120.0;
        float edgeNoise = (detailNoise(wp, 40.0, footprint) - 0.5) * 500.0;
        float snow = smoothstep(snowline - 150.0, snowline + 250.0, alt + edgeNoise) * smoothstep(0.55, 0.8, N.z);
        col = mix(col, vec3(0.80, 0.83, 0.88) * (0.92 + 0.16 * detailNoise(wp, 3.0, footprint)), snow * m * (1.0 - paved));
        // Dry sand near sea level, slightly brighter and warmer.
        float beach = sand * (1.0 - smoothstep(5.0, 60.0, alt)) * (1.0 - humidity * 0.5);
        col = mix(col, col * vec3(1.08, 1.04, 0.95), beach * m);
    }

    // ---------------- Forest canopy -----------------
    // Near: a 3D canopy height field (two crown layers) lit with sun-facing
    // crown normals, crown-to-crown cast shadows marched towards the sun,
    // interior occlusion, leaf-clump texture and back-lit translucency.
    // Far: multi-scale bushy clustering band-limited to the pixel footprint.
    float fk = u_terrain.w * forest * dFade;
    if (fk > 0.0) {
        float crownVis = 1.0 - smoothstep(2.0, 8.0, footprint);
        float sunE = (1.0 - overcast * 0.8) * smoothstep(-0.02, 0.15, sunDir.z) + 0.04;
        float amb = 0.38 + overcast * 0.5 + humidity * 0.1;
        float flatLit = amb + sunE * max(sunDir.z, 0.0);
        if (crownVis > 0.0) {
            vec4 cz = canopy(wp);
            vec3 cn = normalize(vec3(-cz.yz, 1.0));
            float sh = 1.0;
            if (sunDir.z > 0.0 && day > 0.0) {
                sh = canopyShadow(wp, cz.x, sunDir, jitter);
            }
            // Gaps and low understory sit deep inside the canopy.
            float ao = mix(0.35, 1.0, smoothstep(0.0, 14.0, cz.x));
            // Leaf clumps: two band-limited octaves, stronger contrast in sunlight.
            float clump = detailNoise(wp + cz.w * 37.0, 0.9, footprint) * 0.6 + detailNoise(wp, 2.3, footprint) * 0.4;
            float lit = amb * (0.55 + 0.45 * cn.z) * ao + sunE * max(dot(cn, sunDir), 0.0) * sh * (0.7 + 0.6 * clump);
            float tree = clamp(lit / max(flatLit, 0.05), 0.15, 2.0);
            // Species / health variation: conifer blue-green to broadleaf yellow-green.
            vec3 tint = mix(vec3(0.82, 0.97, 0.93), vec3(1.10, 1.06, 0.80), cz.w) * (0.86 + 0.28 * gfsr_hash12(floor(wp / 8.0)));
            vec3 crowned = col * tree * tint;
            // Translucent leaves glow at crown edges when looking towards the sun.
            float back = pow(clamp(-dot(V, sunDir), 0.0, 1.0), 3.0);
            float thin = 1.0 - smoothstep(0.0, 10.0, cz.x);
            crowned += col * vec3(0.55, 0.95, 0.25) * back * (0.35 + 0.65 * thin) * sh * day * (1.0 - overcast) * 0.9;
            col = mix(col, crowned, fk * crownVis);
        }
        // Mid / far: bushy multi-scale clusters keep the canopy volumetric from
        // altitude; rough surfaces darken the side away from the sun and
        // looking down-sun reveals the shadow-hiding hotspot.
        float hot = exp(-max(1.0 - dot(V, sunDir), 0.0) * 40.0);
        float rough = mix(0.80, 1.0, clamp(dot(N, sunDir) * 1.5 + 0.3, 0.0, 1.0));
        float c1 = detailNoise(wp, 22.0, footprint);
        float c2 = detailNoise(wp, 70.0, footprint);
        float c3 = detailNoise(wp, 230.0, footprint);
        float cluster = (0.80 + 0.40 * c1) * (0.88 + 0.24 * c2) * (0.92 + 0.16 * c3);
        float farK = fk * (1.0 - crownVis * 0.7);
        col *= mix(1.0, rough * cluster * (1.0 + hot * 0.35), farK);
    }

    // ---------------- Lighting -----------------
    float lk = u_terrain.x * day;
    float shadow = 1.0;
    if (u_terrain2.y > 0.0 && sunDir.z > -0.02 && dist < 60000.0) {
        vec3 lEC = normalize(czm_sunDirectionEC);
        shadow = mix(1.0, screenShadow(pEC, lEC, dist, u_terrain2.z, jitter), u_terrain2.y * (1.0 - overcast * 0.85));
        shadow = mix(shadow, 1.0, smoothstep(30000.0, 60000.0, dist));
    }
    if (lk > 0.0) {
        float sunE = (1.0 - overcast * 0.8) * smoothstep(-0.02, 0.15, sunDir.z) + 0.05;
        float amb = 0.38 + overcast * 0.5 + humidity * 0.1;
        float ndl = max(dot(N, sunDir), 0.0);
        float lit = amb * (0.55 + 0.45 * N.z) + sunE * ndl * shadow;
        float flatLit = amb + sunE * max(sunDir.z, 0.0);
        float ratio = clamp(lit / max(flatLit, 0.05), 0.2, 2.2);
        col *= mix(1.0, ratio, lk * dFade);
    } else if (shadow < 1.0) {
        col *= mix(1.0, shadow * 0.6 + 0.4, u_terrain.x);
    }

    // ---------------- Wet surfaces -----------------
    if (wet > 0.01) {
        float porous = clamp(grass + dirt + sand + forest * 0.6, 0.0, 1.0);
        col *= mix(1.0, 0.62, wet * porous);
        col *= mix(1.0, 0.85, wet * paved);
        float flatness = smoothstep(0.96, 0.995, N.z);
        float puddleN = detailNoise(wp, 5.0, footprint * 0.5) * 0.6 + detailNoise(wp, 17.0, footprint * 0.5) * 0.4;
        float puddle = smoothstep(0.62 - wet * 0.18, 0.7 - wet * 0.18, puddleN) * flatness * wet * (paved * 0.8 + dirt * 0.5 + grass * 0.25);
        float sheen = wet * paved * flatness * 0.6;
        float reflAmt = max(puddle, sheen) * u_terrain2.w * (1.0 - smoothstep(4000.0, 12000.0, dist));
        if (reflAmt > 0.01) {
            vec3 Nw = vec3(0.0, 0.0, 1.0);
            // Raindrop ripples in puddles.
            if (u_weather.z > 0.01) {
                vec4 rc = gfsr_worley2(wp / 0.8, WORLD_PERIOD / 0.8);
                float phase = fract(u_time * 0.9 + rc.y);
                float ring = sin((rc.x - phase * 0.6) * 40.0) * exp(-abs(rc.x - phase * 0.6) * 12.0) * (1.0 - phase);
                Nw = normalize(vec3(normalize(rc.zw + 1e-4) * ring * 0.15 * u_weather.z, 1.0));
            }
            vec3 R = reflect(-V, Nw);
            float NdotV = clamp(dot(Nw, V), 0.0, 1.0);
            float F = 0.02 + 0.98 * pow(max(1.0 - NdotV, 0.0), 5.0);
            vec3 env = gfsr_skyApprox(R, sunDir, max(u_camHeight, 1.0) * 0.001, overcast);
            // eyeToEnu is orthonormal, so v * M applies its inverse (ENU -> eye).
            vec4 ssr = gfsr_ssr(colorTexture, depthTexture, pEC, normalize(R * u_eyeToEnu), min(dist * 1.5, 3000.0), 16.0, jitter);
            vec3 refl = mix(env, gfsr_toLinear(ssr.rgb), ssr.a);
            col = mix(col, refl, clamp(F * reflAmt * 1.4, 0.0, 1.0));
        }
    }

    col = mix(col, gfsr_toLinear(src.rgb), acMask);
    gl_FragColor = vec4(gfsr_toGamma(col), src.a);
}
