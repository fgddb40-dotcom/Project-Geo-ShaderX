// GeoFS-ReShade : ui/menu.js
// In-game settings panel. Toggle with SHIFT + G.
//
// Builds checkboxes, sliders, dropdowns and colour pickers from the schema in
// ui/settings.js, shows live FPS + performance state and persists every change.
//
// Exposes window.GeoFSReShade.Menu.

(function (root) {
    'use strict';

    const NS = root.GeoFSReShade = root.GeoFSReShade || {};
    const doc = root.document;

    const CSS = [
        '#gfsr-panel{position:fixed;top:60px;right:20px;width:340px;max-height:calc(100vh - 90px);display:none;flex-direction:column;',
        'background:rgba(14,18,26,0.94);color:#e6ebf2;font:12px/1.35 "Segoe UI",Roboto,Arial,sans-serif;border:1px solid rgba(120,160,220,0.35);',
        'border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,0.55);z-index:2147483000;user-select:none;backdrop-filter:blur(6px);}',
        '#gfsr-panel.gfsr-open{display:flex;}',
        '#gfsr-panel *{box-sizing:border-box;}',
        '#gfsr-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;border-bottom:1px solid rgba(120,160,220,0.2);',
        'background:linear-gradient(90deg,rgba(40,80,140,0.45),rgba(20,30,50,0.2));border-radius:10px 10px 0 0;}',
        '#gfsr-title{flex:1;font-weight:600;font-size:13px;letter-spacing:0.3px;}',
        '#gfsr-fps{font-family:Consolas,monospace;font-size:12px;padding:2px 7px;border-radius:4px;background:#1d3b24;color:#8ff0a4;}',
        '#gfsr-fps.gfsr-warn{background:#47391a;color:#ffd479;}',
        '#gfsr-fps.gfsr-bad{background:#4a1d1d;color:#ff8c8c;}',
        '#gfsr-close{cursor:pointer;border:none;background:transparent;color:#b9c6d8;font-size:16px;line-height:1;padding:0 2px;}',
        '#gfsr-status{padding:6px 12px;font-size:11px;color:#9fb1c9;border-bottom:1px solid rgba(120,160,220,0.12);min-height:24px;}',
        '#gfsr-status.gfsr-error{color:#ff9a9a;}',
        '#gfsr-body{overflow-y:auto;padding:4px 0 8px 0;}',
        '#gfsr-body::-webkit-scrollbar{width:8px;}#gfsr-body::-webkit-scrollbar-thumb{background:rgba(140,170,220,0.35);border-radius:4px;}',
        '.gfsr-group{border-bottom:1px solid rgba(120,160,220,0.1);}',
        '.gfsr-ghead{display:flex;align-items:center;padding:7px 12px;cursor:pointer;font-weight:600;color:#cfe0ff;}',
        '.gfsr-ghead:hover{background:rgba(80,120,190,0.12);}',
        '.gfsr-arrow{width:14px;display:inline-block;transition:transform .15s;}',
        '.gfsr-group.gfsr-collapsed .gfsr-arrow{transform:rotate(-90deg);}',
        '.gfsr-group.gfsr-collapsed .gfsr-gbody{display:none;}',
        '.gfsr-gtitle{flex:1;}',
        '.gfsr-reset{border:1px solid rgba(140,170,220,0.3);background:transparent;color:#9fb1c9;border-radius:4px;font-size:10px;padding:1px 6px;cursor:pointer;}',
        '.gfsr-reset:hover{color:#fff;border-color:#8fb4ff;}',
        '.gfsr-gbody{padding:2px 12px 8px 26px;}',
        '.gfsr-row{display:flex;align-items:center;gap:8px;margin:5px 0;}',
        '.gfsr-row label{flex:1;color:#d3dbe6;}',
        '.gfsr-row input[type=range]{flex:1.2;accent-color:#5c9cff;height:4px;}',
        '.gfsr-row .gfsr-val{width:52px;text-align:right;font-family:Consolas,monospace;color:#9fc3ff;}',
        '.gfsr-row select{flex:1.2;background:#1b2433;color:#e6ebf2;border:1px solid rgba(140,170,220,0.3);border-radius:4px;padding:2px 4px;}',
        '.gfsr-row input[type=checkbox]{accent-color:#5c9cff;width:15px;height:15px;}',
        '.gfsr-row input[type=color]{width:44px;height:20px;border:none;background:transparent;padding:0;}',
        '.gfsr-row.gfsr-disabled{opacity:0.45;}',
        '#gfsr-foot{display:flex;gap:8px;padding:8px 12px;border-top:1px solid rgba(120,160,220,0.2);}',
        '#gfsr-foot button{flex:1;border:1px solid rgba(140,170,220,0.35);background:rgba(40,70,120,0.35);color:#e6ebf2;border-radius:5px;padding:5px;cursor:pointer;}',
        '#gfsr-foot button:hover{background:rgba(70,110,180,0.5);}',
        '#gfsr-hint{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(14,18,26,0.9);color:#cfe0ff;',
        'font:12px "Segoe UI",Roboto,Arial,sans-serif;padding:7px 14px;border-radius:6px;z-index:2147483000;pointer-events:none;',
        'transition:opacity .6s;opacity:0;}'
    ].join('');

    const COLLAPSE_KEY = 'gfsr.menu.collapsed.v1';
    const POS_KEY = 'gfsr.menu.position.v1';

    function el(tag, attrs, children) {
        const e = doc.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === 'className') {
                    e.className = attrs[k];
                } else if (k === 'text') {
                    e.textContent = attrs[k];
                } else {
                    e.setAttribute(k, attrs[k]);
                }
            });
        }
        (children || []).forEach(function (c) {
            if (c) {
                e.appendChild(c);
            }
        });
        return e;
    }

    function readJSON(key, fallback) {
        try {
            const raw = root.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            root.localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            /* storage full or blocked: the menu still works for this session */
        }
    }

    function formatValue(c, v) {
        if (c.step >= 1) {
            return String(Math.round(v));
        }
        const decimals = c.step >= 0.1 ? 1 : (c.step >= 0.01 ? 2 : 3);
        return Number(v).toFixed(decimals);
    }

    const Menu = {
        panel: null,
        inputs: {},
        rows: {},
        settings: null,
        open: false,
        overrides: {},

        init: function (settings, callbacks) {
            if (Menu.panel) {
                return Menu;
            }
            Menu.settings = settings;
            Menu.callbacks = callbacks || {};

            const style = el('style', { id: 'gfsr-style' });
            style.textContent = CSS;
            doc.head.appendChild(style);

            Menu.build();
            Menu.bindKeys();
            settings.onChange(function (changed) {
                Menu.refresh(changed);
            });
            Menu.hint('GeoFS Ultra Graphics loaded \u2014 press SHIFT + G for settings');
            return Menu;
        },

        build: function () {
            const s = Menu.settings;
            const collapsed = readJSON(COLLAPSE_KEY, { weather: true, water: true, reflections: true, lens: true, ssao: true });

            Menu.fpsBadge = el('span', { id: 'gfsr-fps', text: '-- FPS' });
            const closeBtn = el('button', { id: 'gfsr-close', title: 'Close (SHIFT + G)', text: '\u2715' });
            closeBtn.addEventListener('click', function () { Menu.toggle(false); });
            const head = el('div', { id: 'gfsr-head' }, [
                el('span', { id: 'gfsr-title', text: 'GeoFS Ultra Graphics' }),
                Menu.fpsBadge,
                closeBtn
            ]);
            Menu.statusLine = el('div', { id: 'gfsr-status', text: 'Initialising\u2026' });

            const body = el('div', { id: 'gfsr-body' });
            s.SCHEMA.forEach(function (group) {
                const resetBtn = el('button', { className: 'gfsr-reset', title: 'Reset this section', text: 'reset' });
                const ghead = el('div', { className: 'gfsr-ghead' }, [
                    el('span', { className: 'gfsr-arrow', text: '\u25BE' }),
                    el('span', { className: 'gfsr-gtitle', text: group.title }),
                    resetBtn
                ]);
                const gbody = el('div', { className: 'gfsr-gbody' });
                const gEl = el('div', { className: 'gfsr-group' + (collapsed[group.id] ? ' gfsr-collapsed' : '') }, [ghead, gbody]);
                ghead.addEventListener('click', function (ev) {
                    if (ev.target === resetBtn) {
                        return;
                    }
                    gEl.classList.toggle('gfsr-collapsed');
                    collapsed[group.id] = gEl.classList.contains('gfsr-collapsed');
                    writeJSON(COLLAPSE_KEY, collapsed);
                });
                resetBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    s.resetGroup(group.id);
                });
                group.controls.forEach(function (c) {
                    gbody.appendChild(Menu.buildControl(c));
                });
                body.appendChild(gEl);
            });

            const resetAll = el('button', { text: 'Reset all' });
            resetAll.addEventListener('click', function () { s.resetAll(); });
            const reload = el('button', { text: 'Rebuild effects' });
            reload.addEventListener('click', function () {
                if (Menu.callbacks.rebuild) {
                    Menu.callbacks.rebuild();
                }
            });
            const foot = el('div', { id: 'gfsr-foot' }, [resetAll, reload]);

            Menu.panel = el('div', { id: 'gfsr-panel' }, [head, Menu.statusLine, body, foot]);
            Menu.hintEl = el('div', { id: 'gfsr-hint' });
            doc.body.appendChild(Menu.panel);
            doc.body.appendChild(Menu.hintEl);

            Menu.isolateInput(Menu.panel);
            Menu.makeDraggable(head);
            const pos = readJSON(POS_KEY, null);
            if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                Menu.placeAt(pos.left, pos.top);
            }
            Menu.refresh(Object.keys(s.CONTROLS));
        },

        buildControl: function (c) {
            const s = Menu.settings;
            const id = 'gfsr-c-' + c.key;
            const label = el('label', { for: id, text: c.label });
            let input;
            let valueEl = null;

            if (c.type === 'checkbox') {
                input = el('input', { type: 'checkbox', id: id });
                input.addEventListener('change', function () { s.set(c.key, input.checked); });
            } else if (c.type === 'range') {
                input = el('input', { type: 'range', id: id, min: c.min, max: c.max, step: c.step });
                valueEl = el('span', { className: 'gfsr-val' });
                input.addEventListener('input', function () {
                    valueEl.textContent = formatValue(c, Number(input.value));
                    s.set(c.key, Number(input.value));
                });
                input.addEventListener('dblclick', function () { s.set(c.key, c.default); });
                input.title = 'Double-click to reset';
            } else if (c.type === 'select') {
                input = el('select', { id: id });
                c.options.forEach(function (o) {
                    input.appendChild(el('option', { value: o[0], text: o[1] }));
                });
                input.addEventListener('change', function () { s.set(c.key, input.value); });
            } else {
                input = el('input', { type: 'color', id: id });
                input.addEventListener('input', function () { s.set(c.key, input.value); });
            }

            const row = el('div', { className: 'gfsr-row' }, c.type === 'checkbox' ? [input, label] : [label, input, valueEl]);
            Menu.inputs[c.key] = { input: input, valueEl: valueEl, control: c };
            Menu.rows[c.key] = row;
            return row;
        },

        // Keep GeoFS keyboard controls from reacting while the user edits values.
        isolateInput: function (node) {
            ['keydown', 'keyup', 'keypress'].forEach(function (type) {
                node.addEventListener(type, function (ev) {
                    const isToggle = type === 'keydown' && ev.shiftKey && (ev.code === 'KeyG' || ev.key === 'G' || ev.key === 'g');
                    if (!isToggle) {
                        ev.stopPropagation();
                    }
                });
            });
            ['mousedown', 'wheel', 'pointerdown', 'contextmenu'].forEach(function (type) {
                node.addEventListener(type, function (ev) { ev.stopPropagation(); }, { passive: true });
            });
        },

        bindKeys: function () {
            root.addEventListener('keydown', function (ev) {
                if (!ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) {
                    return;
                }
                if (ev.code !== 'KeyG' && ev.key !== 'G' && ev.key !== 'g') {
                    return;
                }
                const t = ev.target;
                const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
                const editing = (tag === 'input' && t.type !== 'range' && t.type !== 'checkbox' && t.type !== 'color') ||
                    tag === 'textarea' || (t && t.isContentEditable);
                if (editing && !(Menu.panel && Menu.panel.contains(t))) {
                    return;
                }
                ev.preventDefault();
                ev.stopImmediatePropagation();
                Menu.toggle();
            }, true);
        },

        toggle: function (force) {
            Menu.open = typeof force === 'boolean' ? force : !Menu.open;
            Menu.panel.classList.toggle('gfsr-open', Menu.open);
            if (Menu.open) {
                Menu.refresh(Object.keys(Menu.settings.CONTROLS));
                Menu.keepOnScreen();
            }
        },

        placeAt: function (left, top) {
            Menu.panel.style.left = left + 'px';
            Menu.panel.style.top = top + 'px';
            Menu.panel.style.right = 'auto';
        },

        keepOnScreen: function () {
            const r = Menu.panel.getBoundingClientRect();
            if (r.width === 0) {
                return;
            }
            const maxL = root.innerWidth - Math.min(r.width, 120);
            const maxT = root.innerHeight - 40;
            if (r.left < 0 || r.top < 0 || r.left > maxL || r.top > maxT) {
                Menu.placeAt(Math.max(0, Math.min(r.left, maxL)), Math.max(0, Math.min(r.top, maxT)));
            }
        },

        makeDraggable: function (handle) {
            let dragging = false;
            let ox = 0;
            let oy = 0;
            handle.addEventListener('mousedown', function (ev) {
                if (ev.button !== 0 || ev.target.id === 'gfsr-close') {
                    return;
                }
                const r = Menu.panel.getBoundingClientRect();
                dragging = true;
                ox = ev.clientX - r.left;
                oy = ev.clientY - r.top;
                ev.preventDefault();
            });
            root.addEventListener('mousemove', function (ev) {
                if (!dragging) {
                    return;
                }
                const left = Math.max(0, Math.min(root.innerWidth - 60, ev.clientX - ox));
                const top = Math.max(0, Math.min(root.innerHeight - 30, ev.clientY - oy));
                Menu.placeAt(left, top);
            });
            root.addEventListener('mouseup', function () {
                if (!dragging) {
                    return;
                }
                dragging = false;
                const r = Menu.panel.getBoundingClientRect();
                writeJSON(POS_KEY, { left: Math.round(r.left), top: Math.round(r.top) });
            });
        },

        refresh: function (keys) {
            const s = Menu.settings;
            (keys || []).forEach(function (key) {
                const entry = Menu.inputs[key];
                if (!entry) {
                    return;
                }
                const v = s.get(key);
                const c = entry.control;
                if (c.type === 'checkbox') {
                    entry.input.checked = !!v;
                } else if (c.type === 'range') {
                    if (doc.activeElement !== entry.input) {
                        entry.input.value = v;
                    }
                    entry.valueEl.textContent = formatValue(c, v);
                } else {
                    entry.input.value = v;
                }
            });
            Menu.applyOverrides(Menu.overrides);
        },

        // Greys out controls of effects that the performance system disabled.
        applyOverrides: function (overrides) {
            Menu.overrides = overrides || {};
            Object.keys(Menu.rows).forEach(function (key) {
                Menu.rows[key].classList.toggle('gfsr-disabled', !!Menu.overrides[key]);
                Menu.rows[key].title = Menu.overrides[key] ? 'Temporarily disabled by the performance system' : '';
            });
        },

        setFps: function (fps, level) {
            if (!Menu.fpsBadge) {
                return;
            }
            Menu.fpsBadge.textContent = (isFinite(fps) ? fps.toFixed(0) : '--') + ' FPS';
            Menu.fpsBadge.classList.toggle('gfsr-warn', level === 1);
            Menu.fpsBadge.classList.toggle('gfsr-bad', level >= 2);
        },

        setStatus: function (text, isError) {
            if (!Menu.statusLine) {
                return;
            }
            Menu.statusLine.textContent = text;
            Menu.statusLine.classList.toggle('gfsr-error', !!isError);
        },

        hint: function (text) {
            if (!Menu.hintEl) {
                return;
            }
            Menu.hintEl.textContent = text;
            Menu.hintEl.style.opacity = '1';
            clearTimeout(Menu.hintTimer);
            Menu.hintTimer = setTimeout(function () {
                Menu.hintEl.style.opacity = '0';
            }, 4500);
        }
    };

    NS.Menu = Menu;
})(typeof window !== 'undefined' ? window : this);
