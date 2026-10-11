import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
export function competeCards(t) {
    if (!t.compete?.length)
        return null;
    return h('div', { class: 'compete' }, ...t.compete.map((c) => h('div', { class: 'compete-card' }, h('div', { class: 'compete-head' }, h('b', {}, c.name), c.stat ? h('span', { class: 'compete-stat' }, c.stat) : null), h('p', { class: 'small' }, c.body))));
}
export function compositionBars(t) {
    const c = t.composition;
    if (!c?.items.length)
        return null;
    const max = t.caseCount || Math.max(...c.items.map((x) => x.count));
    return h('div', { class: 'composition' }, ...c.items.map((x) => h('div', { class: 'comp-row' }, h('span', { class: 'comp-label' }, x.label), h('span', { class: 'comp-bar' }, h('span', { class: 'comp-fill', style: { width: `${Math.round((x.count / max) * 100)}%` } })), h('b', { class: 'comp-n' }, tl(`{0}問`, x.count)))), c.note ? h('p', { class: 'small muted' }, tl(`{0}（全{1}問）`, c.note, t.caseCount)) : null);
}
//# sourceMappingURL=compete.js.map