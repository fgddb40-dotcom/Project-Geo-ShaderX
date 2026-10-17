# GeoFS Ultra Graphics (GeoFS-ReShade)

A Tampermonkey userscript that overhauls [GeoFS](https://www.geo-fs.com/)
rendering with physically based post-processing on top of CesiumJS
`PostProcessStage`s. The priorities, in order, are physical realism,
atmospheric realism, scale, smoothness and immersion. Saturation, bloom and
"cinematic" filters come last.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and paste the contents of `main.user.js`. The file is
   self-contained: shaders, UI and presets are embedded in it.
3. Open GeoFS. The script waits for `window.geofs` and `window.Cesium`, then
   attaches to `geofs.api.viewer.scene`.

Press **SHIFT + G** to open the settings panel. Settings are saved in
`localStorage` under `gfsr.settings.v2`.

## Rendering pipeline

The passes run in this order:

| Pass | What it does | Source |
| --- | --- | --- |
| Terrain | Normal reconstruction from depth; slope-, altitude- and humidity-driven grass, dirt, rock, snow and sand tinting; forest canopy relief and depth; terrain AO; screen-space contact shadows; wet ground and puddles | `shaders/terrain.glsl` |
| SSAO | Hemisphere AO from depth and reconstructed normals | `shaders/ssao.glsl` |
| Water | Sky, cloud and sun reflections, SSR, specular glint, deep-water colour, distance fade | `shaders/water.glsl` |
| Reflections / PBR | Fresnel, roughness, SSR over an analytic sky environment, metal, paint and canopy response; wetness | `shaders/reflections.glsl` |
| Atmosphere and sky | Rayleigh and Mie single scattering with ozone; aerial perspective and extinction; altitude-dependent sky with a dark zenith at high altitude; planet curvature; twinkling, extinguished stars with colour variation; Milky Way; moonlight | `shaders/atmosphere.glsl` |
| Depth fog | Height fog and moisture-driven mist; `1 - exp(-distance * density)` | `shaders/fog.glsl` |
| Volumetric clouds | Ray-marched FBM and Worley density with erosion; cirrus, cumulus and storm layers; Beer–powder lighting, dual-lobe HG forward scattering, multiple-scattering approximation, silver lining, cloud shadows; blue-noise jitter; adaptive steps and empty-space skipping | `shaders/clouds.glsl` |
| Aero | Afterburner plume (temperature gradient, shock diamonds, turbulence, heat haze), vapor cone, high-G and AoA wing vapor, world-locked wingtip vortices and contrails | `shaders/aero.glsl` |
| Cockpit rain | Droplets that accumulate, streak with airspeed, refract and reflect | `shaders/cockpit.glsl` (`rain_glass`) |
| Cockpit light | Sun penetration, bounce light, soft shadows, instrument glow and night adaptation | `shaders/cockpit.glsl` (`cockpit_light`) |
| God rays | Screen-space radial light shafts occluded by clouds | `shaders/godrays.glsl` |
| Bloom | Minimal, physically motivated glare (bright pass, down/up-sample blur) | `shaders/bloom.glsl` |
| Eye adaptation and tonemap | Log-average metering at 1/16 resolution; ACES filmic curve with a film toe and shoulder | `shaders/tonemap.glsl` |
| Colour grading | Neutral "Realistic" by default; MSFS, DCS, Cinematic and Photographic looks are optional | `shaders/colorgrade.glsl` |
| Lens | Flare, chromatic aberration and vignette (all subtle or off by default) | `shaders/lens.glsl` |

`shaders/common.glsl` holds the shared helpers: depth reconstruction, noise
(value, FBM, Worley, interleaved gradient), the atmosphere model, phase functions
and black-body colour. Shaders are written in GLSL ES 1.00. Cesium 1.102+
converts them to GLSL ES 3.00; the pipeline is tested on Cesium 1.96 and 1.125.

### Native engine integration (outside the post-process chain)

- **Image-based lighting**: the sky model is projected into 9 spherical-harmonic
  coefficients and applied to glTF models (the aircraft and cockpit), so ambient
  light follows the sky and time of day.
- **Shadows**: Cesium soft shadow maps (PCF) at a resolution set by
  `shadowQuality`, plus FXAA.
- **Night lighting**: a NASA Black Marble (VIIRS) city-lights layer is faded in
  after dusk. City glow then scatters through the atmosphere and fog passes.
- **Moisture**: humidity is derived from GeoFS weather (cloud cover,
  precipitation and fog). It drives haze, cloud softness, wet-surface
  reflections and condensation. Ground and glass wetness build up in rain and
  dry out afterwards.
- **Condensation inputs**: Mach, load factor, AoA, airspeed, throttle and
  afterburner state come from `geofs.animation.values` and the aircraft
  instance. Contrail altitude and temperature come from GeoFS `weather`.

## Presets and performance

`presets/low|medium|high|ultra.json` hold the quality presets. Targets are
60 FPS on High and 40 FPS on Ultra. With auto performance enabled (thresholds
are adjustable in the menu):

- **FPS < 40**: SSAO and god rays are disabled, cloud quality is reduced, and
  terrain shadow, SSR, plume and cockpit-shadow steps are lowered.
- **FPS < 25**: bloom, volumetric clouds and the terrain pass are disabled.

The current FPS is shown in the menu.

## Limitations (honest notes)

A userscript can only post-process Cesium's frame and adjust public engine
settings. The following parts of the brief are approximated, not implemented
literally:

- **No temporal reprojection, checkerboard rendering or cloud caching across
  frames.** Cesium allocates and recycles post-process textures itself, so
  stages cannot keep history buffers. Noise is hidden with blue-noise
  (interleaved gradient) jitter, adaptive step counts and empty-space skipping
  instead.
- **Shadows** are Cesium's PCF soft shadows. PCSS, alpha-tested tree shadows
  and true volumetric cloud shadow maps are not available. Contact shadows and
  cloud shadows are screen-space approximations.
- **Forests and terrain materials** are reconstructed from depth and colour.
  No new tree geometry or terrain textures are streamed.
- **Aircraft PBR** cannot read GeoFS material data or add normal maps. It uses
  SH image-based lighting on the models plus a screen-space PBR, Fresnel and SSR
  pass.
- **Night roads, taxiways, approach lights and PAPIs** are not drawn as
  separate light objects. City and road glow come from the Black Marble layer,
  which needs network access to NASA GIBS; GeoFS's own airport lights are
  kept.
- **Rain on surfaces and glass** is screen-space and does not simulate fluid.

## Notes

- Depth-based effects need globe depth in the post-process depth texture. The
  script sets `scene.globe.depthTestAgainstTerrain = true` while effects are
  active and restores it afterwards. The same applies to every engine setting
  it changes (shadows, FXAA, model lighting, imagery layer).
- Weather sync reads GeoFS weather when available; otherwise the manual
  weather sliders are used.
- If a shader fails to compile, the script removes its stages, restores the
  engine state and reports the error in the menu. "Rebuild effects" retries.

## Development

The files in `shaders/`, `ui/` and `presets/` are the sources. After editing
them, regenerate the embedded copies inside `main.user.js`:

```sh
node build.js          # rewrite the BUILD regions in main.user.js
node build.js --check  # verify main.user.js is up to date
```
