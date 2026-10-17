// GeoFS-ReShade : mask.glsl
// Per-pixel mask of the user's aircraft (r channel, 0..1).
//
// When the GeoFS aircraft models are found, the stage's `selected` list is set
// to them and Cesium compiles this shader with CZM_SELECTED_FEATURE: the mask
// is then exact, from the pick-id buffer (paint, canopy and cockpit interior
// only, never the runway below the wheels). Otherwise it falls back to the
// depth shell around the aircraft's bounding sphere.
//
// czm_selected() loops over every pick id of the aircraft, so it is only
// evaluated for pixels inside that depth shell.
//
// Requires common.glsl (prepended by the loader).

// @program aircraft_mask
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;

uniform float u_aircraftDistance;
uniform float u_aircraftRadius;
uniform float u_useSelection;

void main()
{
    vec2 uv = v_textureCoordinates;
    float m = 0.0;
    float raw = gfsr_rawDepth(depthTexture, uv);
    if (!gfsr_isSkyDepth(raw) && u_aircraftDistance > 0.0) {
        float dist = length(gfsr_eyePosition(depthTexture, uv));
        float r = max(u_aircraftRadius, 1.0);
        m = gfsr_aircraftMask(dist, u_aircraftDistance, r);
#ifdef CZM_SELECTED_FEATURE
        if (u_useSelection > 0.5) {
            m = 0.0;
            if (dist < u_aircraftDistance + r * 1.6 && czm_selected()) {
                m = 1.0;
            }
        }
#endif
    }
    gl_FragColor = vec4(m, m, m, 1.0);
}
