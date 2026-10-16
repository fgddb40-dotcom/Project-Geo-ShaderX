// GeoFS-ReShade : ui/settings.js
// Settings schema, defaults, persistence (localStorage) and preset handling.
//
// Exposes window.GeoFSReShade.Settings. Presets are read from
// window.GeoFSReShade.presets (inlined from presets/*.json by build.js).

(function (root) {
    'use strict';

    const NS = root.GeoFSReShade = root.GeoFSReShade || {};

    const STORAGE_KEY = 'gfsr.settings.v1';
    const PRESET_ORDER = ['low', 'medium', 'high', 'ultra'];

    // Control types: checkbox, range, select, color.
    // structural: true -> changing the value rebuilds the post-process pipeline.
    const SCHEMA = [
        {
            id: 'general', title: 'General', controls: [
                { key: 'enabled', type: 'checkbox', label: 'Enable GeoFS Ultra Graphics', default: true, structural: true },
                { key: 'preset', type: 'select', label: 'Quality preset', default: 'high', options: [
                    ['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['ultra', 'ULTRA'], ['custom', 'Custom']
                ] },
                { key: 'autoPerf', type: 'checkbox', label: 'Auto-disable effects on low FPS', default: true },
                { key: 'fpsLow', type: 'range', label: 'Low FPS threshold', default: 40, min: 15, max: 60, step: 1 },
                { key: 'fpsCritical', type: 'range', label: 'Critical FPS threshold', default: 25, min: 10, max: 45, step: 1 },
                { key: 'hideNativeClouds', type: 'checkbox', label: 'Replace GeoFS native cloud/fog pass', default: true },
                { key: 'modelLighting', type: 'checkbox', label: 'Boost aircraft environment lighting', default: true }
            ]
        },
        {
            id: 'hdr', title: 'HDR & Tonemapping', controls: [
                { key: 'hdrEnabled', type: 'checkbox', label: 'HDR pipeline (ACES Filmic)', default: true, structural: true },
                { key: 'exposure', type: 'range', label: 'HDR Exposure', default: 1.0, min: 0.2, max: 3.0, step: 0.01 },
                { key: 'gamma', type: 'range', label: 'Gamma', default: 1.0, min: 0.6, max: 1.6, step: 0.01 },
                { key: 'contrast', type: 'range', label: 'Contrast', default: 1.05, min: 0.5, max: 1.6, step: 0.01 },
                { key: 'saturation', type: 'range', label: 'Saturation', default: 1.08, min: 0.0, max: 2.0, step: 0.01 }
            ]
        },
        {
            id: 'bloom', title: 'Bloom', controls: [
                { key: 'bloomEnabled', type: 'checkbox', label: 'Bloom', default: true, structural: true },
                { key: 'bloomIntensity', type: 'range', label: 'Bloom Intensity', default: 0.55, min: 0.0, max: 3.0, step: 0.01 },
                { key: 'bloomRadius', type: 'range', label: 'Bloom Radius', default: 1.2, min: 0.25, max: 4.0, step: 0.05 },
                { key: 'bloomThreshold', type: 'range', label: 'Bloom Threshold', default: 0.72, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'bloomSoftKnee', type: 'range', label: 'Soft bloom (knee)', default: 0.5, min: 0.0, max: 1.0, step: 0.01 }
            ]
        },
        {
            id: 'atmosphere', title: 'Atmospheric Scattering', controls: [
                { key: 'atmosphereEnabled', type: 'checkbox', label: 'Atmospheric scattering', default: true, structural: true },
                { key: 'skyBlend', type: 'range', label: 'Sky replacement', default: 0.85, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'hazeStrength', type: 'range', label: 'Aerial haze', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'rayleigh', type: 'range', label: 'Rayleigh scattering', default: 1.0, min: 0.2, max: 3.0, step: 0.01 },
                { key: 'mie', type: 'range', label: 'Mie scattering', default: 1.0, min: 0.1, max: 4.0, step: 0.01 },
                { key: 'horizonGlow', type: 'range', label: 'Horizon glow', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'sunsetShift', type: 'range', label: 'Sunset colour shift', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'atmosphereSteps', type: 'range', label: 'Scattering samples', default: 12, min: 4, max: 24, step: 1 }
            ]
        },
        {
            id: 'fog', title: 'Depth Fog', controls: [
                { key: 'fogEnabled', type: 'checkbox', label: 'Depth fog', default: true, structural: true },
                { key: 'fogDensity', type: 'range', label: 'Density', default: 0.6, min: 0.0, max: 10.0, step: 0.05 },
                { key: 'fogHeight', type: 'range', label: 'Height (m)', default: 1500, min: 100, max: 8000, step: 50 },
                { key: 'fogStart', type: 'range', label: 'Distance (start, m)', default: 3000, min: 0, max: 30000, step: 100 },
                { key: 'fogMaxDistance', type: 'range', label: 'Horizon distance (m)', default: 120000, min: 10000, max: 400000, step: 1000 },
                { key: 'fogColor', type: 'color', label: 'Color', default: '#c3d0df' },
                { key: 'fogSkyTint', type: 'range', label: 'Sun-lit tint', default: 0.7, min: 0.0, max: 1.0, step: 0.01 }
            ]
        },
        {
            id: 'clouds', title: 'Volumetric Clouds', controls: [
                { key: 'cloudsEnabled', type: 'checkbox', label: 'Volumetric clouds', default: true, structural: true },
                { key: 'cloudType', type: 'select', label: 'Cloud type', default: 'cumulus', options: [
                    ['cirrus', 'Cirrus'], ['cumulus', 'Cumulus'], ['storm', 'Storm']
                ] },
                { key: 'cloudCoverage', type: 'range', label: 'Coverage', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'cloudDensity', type: 'range', label: 'Cloud Density', default: 1.0, min: 0.1, max: 3.0, step: 0.01 },
                { key: 'cloudHeight', type: 'range', label: 'Cloud Height (base, m)', default: 1800, min: 200, max: 8000, step: 50 },
                { key: 'cloudThickness', type: 'range', label: 'Thickness (m)', default: 1600, min: 200, max: 8000, step: 50 },
                { key: 'cloudBrightness', type: 'range', label: 'Brightness', default: 1.0, min: 0.3, max: 2.0, step: 0.01 },
                { key: 'cloudScale', type: 'range', label: 'Cloud size (m)', default: 2500, min: 500, max: 8000, step: 50 },
                { key: 'cirrusEnabled', type: 'checkbox', label: 'High cirrus layer', default: true },
                { key: 'cirrusAltitude', type: 'range', label: 'Cirrus altitude (m)', default: 9000, min: 5000, max: 13000, step: 100 },
                { key: 'cirrusCoverage', type: 'range', label: 'Cirrus coverage', default: 0.4, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'cirrusOpacity', type: 'range', label: 'Cirrus opacity', default: 0.55, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'cloudShadows', type: 'checkbox', label: 'Cloud shadows', default: true },
                { key: 'cloudShadowStrength', type: 'range', label: 'Shadow strength', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'cloudSteps', type: 'range', label: 'Cloud Quality (ray steps)', default: 48, min: 8, max: 128, step: 1 },
                { key: 'cloudResolution', type: 'select', label: 'Cloud resolution', default: '0.5', structural: true, options: [
                    ['0.25', '25 %'], ['0.33', '33 %'], ['0.5', '50 %'], ['0.75', '75 %'], ['1', '100 %']
                ] },
                { key: 'cloudDistance', type: 'range', label: 'Draw distance (m)', default: 80000, min: 10000, max: 200000, step: 1000 },
                { key: 'windDrift', type: 'range', label: 'Wind drift', default: 1.0, min: 0.0, max: 5.0, step: 0.05 }
            ]
        },
        {
            id: 'weather', title: 'Dynamic Weather', controls: [
                { key: 'weatherEnabled', type: 'checkbox', label: 'Dynamic weather effects', default: true },
                { key: 'syncWeather', type: 'checkbox', label: 'Sync with GeoFS weather', default: true },
                { key: 'weatherIntensity', type: 'range', label: 'Effect intensity', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'manualOvercast', type: 'range', label: 'Overcast (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'manualStorm', type: 'range', label: 'Storm (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'manualPrecip', type: 'range', label: 'Precipitation (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'manualFog', type: 'range', label: 'Fog (manual)', default: 0.0, min: 0.0, max: 1.0, step: 0.01 }
            ]
        },
        {
            id: 'godrays', title: 'God Rays', controls: [
                { key: 'godraysEnabled', type: 'checkbox', label: 'God rays', default: true, structural: true },
                { key: 'godraysStrength', type: 'range', label: 'Strength', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'godraysSamples', type: 'range', label: 'Samples', default: 48, min: 8, max: 128, step: 1 },
                { key: 'godraysLength', type: 'range', label: 'Length', default: 0.85, min: 0.1, max: 1.0, step: 0.01 },
                { key: 'godraysDecay', type: 'range', label: 'Decay', default: 0.965, min: 0.9, max: 0.995, step: 0.001 },
                { key: 'sunGlare', type: 'range', label: 'Sun glare', default: 0.6, min: 0.0, max: 2.0, step: 0.01 }
            ]
        },
        {
            id: 'grade', title: 'Color Grading', controls: [
                { key: 'gradeEnabled', type: 'checkbox', label: 'Color grading', default: true, structural: true },
                { key: 'gradeMode', type: 'select', label: 'Look', default: 'msfs', options: [
                    ['realistic', 'Realistic'], ['msfs', 'MSFS'], ['dcs', 'DCS'], ['cinematic', 'Cinematic'], ['photographic', 'Photographic']
                ] },
                { key: 'gradeStrength', type: 'range', label: 'Strength', default: 0.8, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'gradeShadows', type: 'range', label: 'Shadows', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                { key: 'gradeMidtones', type: 'range', label: 'Midtones', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                { key: 'gradeHighlights', type: 'range', label: 'Highlights', default: 0.0, min: -1.0, max: 1.0, step: 0.01 },
                { key: 'gradeWarmth', type: 'range', label: 'Warm highlights', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'gradeCoolness', type: 'range', label: 'Cool shadows', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'gradeVibrance', type: 'range', label: 'Vibrance', default: 0.15, min: -1.0, max: 1.0, step: 0.01 }
            ]
        },
        {
            id: 'ssao', title: 'Ambient Occlusion (SSAO)', controls: [
                { key: 'ssaoEnabled', type: 'checkbox', label: 'SSAO', default: true, structural: true },
                { key: 'ssaoRadius', type: 'range', label: 'Radius', default: 1.5, min: 0.2, max: 10.0, step: 0.1 },
                { key: 'ssaoBias', type: 'range', label: 'Bias', default: 0.08, min: 0.0, max: 0.5, step: 0.01 },
                { key: 'ssaoStrength', type: 'range', label: 'Strength', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                { key: 'ssaoSamples', type: 'range', label: 'Samples', default: 16, min: 4, max: 32, step: 1 }
            ]
        },
        {
            id: 'reflections', title: 'Aircraft Reflections', controls: [
                { key: 'reflectionsEnabled', type: 'checkbox', label: 'Aircraft reflections', default: true, structural: true },
                { key: 'reflectionStrength', type: 'range', label: 'Environment reflection', default: 0.7, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'fresnelPower', type: 'range', label: 'Fresnel power', default: 5.0, min: 1.0, max: 8.0, step: 0.1 },
                { key: 'roughness', type: 'range', label: 'Roughness', default: 0.35, min: 0.02, max: 1.0, step: 0.01 },
                { key: 'metallic', type: 'range', label: 'Metal surfaces', default: 0.6, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'canopyBoost', type: 'range', label: 'Canopy reflections', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'aircraftRadius', type: 'range', label: 'Aircraft size (m)', default: 22, min: 4, max: 90, step: 1 }
            ]
        },
        {
            id: 'water', title: 'Water', controls: [
                { key: 'waterEnabled', type: 'checkbox', label: 'Water improvements', default: true, structural: true },
                { key: 'waterSunReflection', type: 'range', label: 'Sun reflections', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                { key: 'waterSpecular', type: 'range', label: 'Specular highlights', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                { key: 'waterDeepColor', type: 'color', label: 'Deep water color', default: '#0a3550' },
                { key: 'waterDeepStrength', type: 'range', label: 'Deep water coloring', default: 0.45, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'waterWaves', type: 'range', label: 'Wave strength', default: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                { key: 'waterFade', type: 'range', label: 'Distance fade (m)', default: 15000, min: 1000, max: 60000, step: 500 },
                { key: 'waterTolerance', type: 'range', label: 'Sea level tolerance (m)', default: 60, min: 5, max: 200, step: 1 }
            ]
        },
        {
            id: 'lens', title: 'Lens Effects', controls: [
                { key: 'lensFlareEnabled', type: 'checkbox', label: 'Lens flare', default: true, structural: true },
                { key: 'flareIntensity', type: 'range', label: 'Flare intensity', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'flareGhosts', type: 'range', label: 'Ghosts', default: 1.0, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'flareHalo', type: 'range', label: 'Halo', default: 0.6, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'flareStarburst', type: 'range', label: 'Starburst', default: 0.7, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'streaksEnabled', type: 'checkbox', label: 'Bloom streaks', default: true, structural: true },
                { key: 'streakIntensity', type: 'range', label: 'Streak intensity', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'chromaticEnabled', type: 'checkbox', label: 'Chromatic aberration', default: true, structural: true },
                { key: 'chromatic', type: 'range', label: 'Aberration amount', default: 0.3, min: 0.0, max: 2.0, step: 0.01 },
                { key: 'vignetteEnabled', type: 'checkbox', label: 'Vignette', default: true, structural: true },
                { key: 'vignette', type: 'range', label: 'Vignette amount', default: 0.35, min: 0.0, max: 1.0, step: 0.01 },
                { key: 'vignetteRadius', type: 'range', label: 'Vignette radius', default: 0.95, min: 0.3, max: 1.4, step: 0.01 },
                { key: 'vignetteSoftness', type: 'range', label: 'Vignette softness', default: 0.6, min: 0.05, max: 1.2, step: 0.01 }
            ]
        }
    ];

    const CONTROLS = {};
    const DEFAULTS = {};
    SCHEMA.forEach(function (group) {
        group.controls.forEach(function (c) {
            CONTROLS[c.key] = c;
            DEFAULTS[c.key] = c.default;
        });
    });

    // Keys that a preset never touches (user preferences rather than quality).
    const NON_PRESET_KEYS = ['enabled', 'preset', 'autoPerf', 'fpsLow', 'fpsCritical'];

    function storageGet() {
        try {
            const raw = root.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function storageSet(obj) {
        try {
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            return true;
        } catch (e) {
            return false;
        }
    }

    function sanitize(key, value) {
        const c = CONTROLS[key];
        if (!c) {
            return undefined;
        }
        switch (c.type) {
            case 'checkbox':
                return !!value;
            case 'range': {
                let v = Number(value);
                if (!isFinite(v)) {
                    v = c.default;
                }
                return Math.min(c.max, Math.max(c.min, v));
            }
            case 'select': {
                const s = String(value);
                return c.options.some(function (o) { return o[0] === s; }) ? s : c.default;
            }
            case 'color':
                return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value).toLowerCase() : c.default;
            default:
                return value;
        }
    }

    const listeners = [];
    let values = Object.assign({}, DEFAULTS);

    function emit(changedKeys) {
        const structural = changedKeys.some(function (k) { return CONTROLS[k] && CONTROLS[k].structural; });
        listeners.forEach(function (fn) {
            try {
                fn(changedKeys, structural, values);
            } catch (e) {
                console.error('[GeoFS-ReShade] settings listener failed', e);
            }
        });
    }

    function presetData(name) {
        const presets = NS.presets || {};
        return presets[name] || null;
    }

    function applyPresetValues(name) {
        const data = presetData(name);
        if (!data || !data.settings) {
            return [];
        }
        const changed = [];
        Object.keys(data.settings).forEach(function (key) {
            if (NON_PRESET_KEYS.indexOf(key) !== -1) {
                return;
            }
            const v = sanitize(key, data.settings[key]);
            if (v !== undefined && values[key] !== v) {
                values[key] = v;
                changed.push(key);
            }
        });
        return changed;
    }

    const Settings = {
        STORAGE_KEY: STORAGE_KEY,
        SCHEMA: SCHEMA,
        CONTROLS: CONTROLS,
        DEFAULTS: DEFAULTS,
        PRESET_ORDER: PRESET_ORDER,

        load: function () {
            values = Object.assign({}, DEFAULTS);
            const stored = storageGet();
            if (stored && typeof stored === 'object') {
                Object.keys(stored).forEach(function (key) {
                    const v = sanitize(key, stored[key]);
                    if (v !== undefined) {
                        values[key] = v;
                    }
                });
            } else {
                applyPresetValues(values.preset);
            }
            return values;
        },

        save: function () {
            return storageSet(values);
        },

        get: function (key) {
            return values[key];
        },

        all: function () {
            return values;
        },

        // Sets a single value. Any non-preset change switches the preset to "custom".
        set: function (key, value) {
            if (key === 'preset') {
                return Settings.applyPreset(value);
            }
            const v = sanitize(key, value);
            if (v === undefined || values[key] === v) {
                return false;
            }
            values[key] = v;
            const changed = [key];
            if (NON_PRESET_KEYS.indexOf(key) === -1 && values.preset !== 'custom') {
                values.preset = 'custom';
                changed.push('preset');
            }
            Settings.save();
            emit(changed);
            return true;
        },

        applyPreset: function (name) {
            const v = sanitize('preset', name);
            values.preset = v;
            const changed = ['preset'].concat(applyPresetValues(v));
            Settings.save();
            emit(changed);
            return true;
        },

        resetGroup: function (groupId) {
            const group = SCHEMA.filter(function (g) { return g.id === groupId; })[0];
            if (!group) {
                return;
            }
            const changed = [];
            group.controls.forEach(function (c) {
                if (values[c.key] !== c.default) {
                    values[c.key] = c.default;
                    changed.push(c.key);
                }
            });
            if (changed.length && groupId !== 'general' && values.preset !== 'custom') {
                values.preset = 'custom';
                changed.push('preset');
            }
            Settings.save();
            emit(changed);
        },

        resetAll: function () {
            values = Object.assign({}, DEFAULTS);
            applyPresetValues(values.preset);
            Settings.save();
            emit(Object.keys(CONTROLS));
        },

        onChange: function (fn) {
            listeners.push(fn);
            return function () {
                const i = listeners.indexOf(fn);
                if (i !== -1) {
                    listeners.splice(i, 1);
                }
            };
        }
    };

    NS.Settings = Settings;
})(typeof window !== 'undefined' ? window : this);
