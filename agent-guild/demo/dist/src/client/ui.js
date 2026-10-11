import { STAT_LABELS } from '../shared/stats.js';
import { TOOL_BY_ID } from '../shared/catalog.js';
import { BODY_LABELS, CHARM_LABELS, FAMILIAR_LABELS, skillLook } from '../shared/build.js';
import { bust, gearOf, lookOf, portrait } from './hero.js';
import { tl } from '../shared/i18n.js';
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false)
            continue;
        if (k.startsWith('on') && typeof v === 'function')
            el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class')
            el.className = String(v);
        else if (k === 'style' && typeof v === 'object')
            Object.assign(el.style, v);
        else if (k === 'html')
            el.innerHTML = String(v);
        else
            el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false)
            continue;
        el.append(c instanceof Node ? c : String(c));
    }
    return el;
}
export function nodes(...xs) {
    return xs.filter((x) => x !== null && x !== undefined && x !== false);
}
export function svg(tag, attrs = {}, ...children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs))
        el.setAttribute(k, String(v));
    el.append(...children);
    return el;
}
export function radar(stats, size = 140) {
    const keys = Object.keys(STAT_LABELS);
    const c = size / 2, r = size / 2 - 34;
    const pt = (i, v) => {
        const a = -Math.PI / 2 + (i / keys.length) * Math.PI * 2;
        return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
    };
    const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'radar', role: 'img', 'aria-label': tl('ステータス') });
    for (const lv of [0.25, 0.5, 0.75, 1]) {
        root.append(svg('polygon', { points: keys.map((_, i) => pt(i, lv).join(',')).join(' '), class: 'radar-grid' }));
    }
    root.append(svg('polygon', { points: keys.map((k, i) => pt(i, stats[k] / 100).join(',')).join(' '), class: 'radar-area' }));
    keys.forEach((k, i) => {
        const [x, y] = pt(i, 1.28);
        const t = svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'radar-label' });
        t.textContent = `${STAT_LABELS[k].split(' ')[0]} ${stats[k]}`;
        root.append(t);
    });
    return root;
}
const swatch = (c) => h('i', { class: 'swatch', style: { background: c } });
export function loadoutChips(l) {
    return h('div', { class: 'chips' }, h('span', { class: 'chip chip-body' }, BODY_LABELS[l.body]), l.pet ? h('span', { class: 'chip chip-sub', title: tl('お供（見た目だけ）') }, swatch(l.pet.color || '#5ab4ff'), tl(`お供: {0}`, FAMILIAR_LABELS[l.pet.kind])) : null, ...l.skills.map((s, i) => { const k = skillLook(l, i); return h('span', { class: 'chip chip-skill', title: tl(`巻物（スキル・{0}）`, CHARM_LABELS[k.kind]) }, swatch(k.color), tl(`巻物: {0}`, s)); }), ...l.tools.map((t) => h('span', { class: 'chip chip-tool', title: tl('道具（ツール）') }, TOOL_BY_ID[t]?.name ?? t)));
}
export function avatarCanvas(l, scale = 3) {
    // scale 1 は名簿用の小さな胸像
    const c = scale === 1 ? bust(lookOf(l), gearOf(l), 2) : portrait(lookOf(l), gearOf(l), { scale });
    if (scale === 1)
        c.classList.add('bust');
    c.className = 'pixel';
    return c;
}
export function fmtMs(ms) {
    return ms >= 1000 ? tl(`{0}秒`, (ms / 1000).toFixed(1)) : `${ms}ms`;
}
export function toast(msg, kind = 'ok') {
    document.querySelectorAll('.toast').forEach((t) => t.remove()); // 新しいお知らせが出たら、前のものは消す（重なって読めなくなるため）
    const el = h('div', { class: `toast toast-${kind}` }, msg);
    document.body.append(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}
//# sourceMappingURL=ui.js.map