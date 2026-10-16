#!/usr/bin/env node
// GeoFS-ReShade : build.js
// Inlines shaders/*.glsl, presets/*.json and ui/*.js into the BUILD regions of
// main.user.js so the Tampermonkey script is a single self-contained file
// (Tampermonkey with @grant none cannot fetch local files).
//
// Usage:  node build.js          rebuild main.user.js in place
//         node build.js --check  exit 1 if main.user.js is out of date

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MAIN = path.join(ROOT, 'main.user.js');
const INDENT = '    ';

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

function listFiles(dir, ext) {
    return fs.readdirSync(path.join(ROOT, dir))
        .filter(function (f) { return f.endsWith(ext); })
        .sort();
}

function indent(text, lead) {
    return text.split('\n').map(function (line) {
        return line.length ? lead + line : line;
    }).join('\n');
}

function shadersRegion() {
    const sources = {};
    listFiles('shaders', '.glsl').forEach(function (file) {
        sources[path.basename(file, '.glsl')] = read(path.join('shaders', file));
    });
    if (!sources.common) {
        throw new Error('shaders/common.glsl is required');
    }
    const body = Object.keys(sources).map(function (key) {
        return INDENT + JSON.stringify(key) + ': ' + JSON.stringify(sources[key]);
    }).join(',\n');
    return 'NS.shaderSources = {\n' + body + '\n};';
}

function presetsRegion() {
    const presets = {};
    listFiles('presets', '.json').forEach(function (file) {
        const name = path.basename(file, '.json');
        presets[name] = JSON.parse(read(path.join('presets', file)));
    });
    return 'NS.presets = ' + JSON.stringify(presets, null, 4) + ';';
}

function moduleRegion(rel) {
    return read(rel).trim();
}

function replaceRegion(text, name, content) {
    const start = '// <<<GFSR:BUILD ' + name + '>>>';
    const end = '// <<<GFSR:END ' + name + '>>>';
    const i = text.indexOf(start);
    const j = text.indexOf(end);
    if (i === -1 || j === -1 || j < i) {
        throw new Error('Build region "' + name + '" not found in main.user.js');
    }
    const lineStart = text.lastIndexOf('\n', i) + 1;
    const lead = text.slice(lineStart, i);
    return text.slice(0, i + start.length) + '\n' +
        indent(content, lead) + '\n' +
        lead + text.slice(j);
}

function build() {
    let text = read('main.user.js');
    text = replaceRegion(text, 'shaders', shadersRegion());
    text = replaceRegion(text, 'presets', presetsRegion());
    text = replaceRegion(text, 'settings', moduleRegion('ui/settings.js'));
    text = replaceRegion(text, 'menu', moduleRegion('ui/menu.js'));
    return text;
}

const output = build();
if (process.argv.indexOf('--check') !== -1) {
    const current = read('main.user.js');
    if (current !== output) {
        console.error('main.user.js is out of date: run `node build.js`');
        process.exit(1);
    }
    console.log('main.user.js is up to date');
} else {
    fs.writeFileSync(MAIN, output);
    console.log('main.user.js rebuilt (' + output.length + ' bytes)');
}
