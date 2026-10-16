# GeoFS Ultra Graphics (GeoFS-ReShade)

A Tampermonkey userscript that adds a ReShade-style post-processing pipeline to
[GeoFS](https://www.geo-fs.com/) using CesiumJS `PostProcessStage`s.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and paste the contents of `main.user.js` (it is fully
   self-contained: shaders, UI and presets are embedded).
3. Open GeoFS. The script waits for `window.geofs` and `window.Cesium`, then
   attaches to `geofs.api.viewer.scene`.

Press **SHIFT + G** to open the settings panel. Settings are saved in
`localStorage` (`gfsr.settings.v1`).

## Effects

| Pass | Source |
| --- | --- |
| Atmospheric scattering (Rayleigh / Mie, horizon glow, sunset shift) | `shaders/atmosphere.glsl` |
| Volumetric clouds (cirrus / cumulus / storm, silver lining, shadows) | `shaders/clouds.glsl` |
| Water (sun glint, specular, deep colour, distance fade) | `shaders/water.glsl` |
| Aircraft reflections (Fresnel, environment, roughness) | `shaders/reflections.glsl` |
| SSAO (depth + reconstructed normals) | `shaders/ssao.glsl` |
| Depth fog (`1 - exp(-distance * density)`, height falloff) | `shaders/fog.glsl` |
| God rays and sun glare | `shaders/godrays.glsl` |
| Bloom (bright pass, downsample, Gaussian blur, upsample, composite) + streaks | `shaders/bloom.glsl` |
| HDR exposure + ACES filmic tonemapping | `shaders/tonemap.glsl` |
| Colour grading (Realistic, MSFS, DCS, Cinematic, Photographic) | `shaders/colorgrade.glsl` |
| Lens flare, chromatic aberration, vignette | `shaders/lens.glsl` |

`shaders/common.glsl` holds shared helpers (depth reconstruction, noise,
colour-space conversion). Shaders are written in GLSL ES 1.00; Cesium 1.102+
converts them to GLSL ES 3.00 automatically.

## Presets and performance

`presets/low|medium|high|ultra.json` hold the quality presets. With auto
performance enabled (thresholds adjustable in the menu):

- FPS < 40: SSAO and god rays are disabled and cloud quality is reduced.
- FPS < 25: bloom and volumetric clouds are also disabled.

The current FPS is shown in the menu.

## Notes

- Depth-based effects need globe depth in the post-process depth texture, so the
  script sets `scene.globe.depthTestAgainstTerrain = true` while effects are
  active and restores the original value when effects are disabled.
- Weather sync reads GeoFS weather (cloud cover, precipitation, visibility) when
  available. Manual weather sliders are used otherwise.
- If a shader fails to compile, the script removes its stages and reports the
  error in the menu; "Rebuild effects" retries.

## Development

The files in `shaders/`, `ui/` and `presets/` are the sources. After editing
them, regenerate the embedded copies inside `main.user.js`:

```sh
node build.js          # rewrite the BUILD regions in main.user.js
node build.js --check  # verify main.user.js is up to date
```
