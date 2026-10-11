import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
export const briefingOf = (season) => season.task.briefing ?? null;
// 戦場で起きること（場面・竜の様子・頼れる冒険者なら）
export function sceneTable(b, compact = false) {
    if (compact) {
        return h('ul', { class: 'scene-list' }, ...b.scenes.map((s) => h('li', { class: `scene-item sc-${s.scene}` }, h('b', {}, s.name), h('span', { class: 'scene-ex' }, s.example), h('span', { class: 'scene-ideal' }, `→ ${s.ideal}`), s.note ? h('span', { class: 'scene-note' }, tl(`（{0}）`, s.note)) : null)));
    }
    return h('div', { class: 'table-wrap' }, h('table', { class: 'table scene-table' }, h('thead', {}, h('tr', {}, h('th', {}, tl('場面')), h('th', {}, tl('竜の様子（例）')), h('th', {}, tl('頼れる冒険者なら')))), h('tbody', {}, ...b.scenes.map((s) => h('tr', { class: `sc-${s.scene}` }, h('td', {}, h('b', {}, s.name)), h('td', {}, s.example), h('td', {}, s.ideal, s.note ? h('div', { class: 'small muted' }, s.note) : null))))));
}
// 準備する4つ（心得・道具・巻物・結界）
export function prepareCards(b) {
    const icon = { prompt: '📜', tools: '🧰', skills: '📚', guardrail: '🛡' };
    return h('div', { class: 'prepare-grid' }, ...b.prepare.map((p) => h('div', { class: `prepare-card pc-${p.key}` }, h('div', { class: 'prepare-icon' }, icon[p.key] ?? '◆'), h('div', {}, h('b', {}, p.name), h('span', { class: 'prepare-ai' }, p.ai)), h('p', { class: 'small' }, p.body))));
}
// 道具の一覧（何ができるようになるか）
export function toolTable(b, catalog) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, h('th', {}, tl('道具')), h('th', {}, tl('何ができるようになるか')), h('th', {}, tl('重さ')))), h('tbody', {}, ...catalog.map((t) => h('tr', {}, h('td', {}, h('b', {}, t.name)), h('td', {}, b.toolNotes[t.id] ?? t.description), h('td', { class: 'num' }, t.cost))))));
}
// 巻物の一覧（スキル名・発動条件・発動内容）
export function scrollTable(b, scrolls, cost) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, h('th', {}, tl('スキル名')), h('th', {}, tl('発動条件')), h('th', {}, tl('発動内容')), h('th', {}, tl('重さ')))), h('tbody', {}, ...scrolls.map((s) => h('tr', {}, h('td', {}, h('b', {}, s.name)), h('td', {}, b.scrollNotes[s.id]?.when ?? ''), h('td', {}, b.scrollNotes[s.id]?.what ?? ''), h('td', { class: 'num' }, cost))))));
}
// 資料室（全文は折りたたみ）
// 資料室: 棚ごとに並べ、言葉で絞り込めるようにする
const SHELVES = [tl('ギルドの指示'), tl('魔物図鑑'), tl('記録・手記'), tl('薬・道具'), tl('遠征の手引き'), tl('言い伝え・うわさ'), tl('ギルドの規則・研修')];
export function library(b, refs, open = false) {
    const items = refs.map((r) => ({ r, el: h('details', { class: 'lib-item', ...(open ? { open: true } : {}) }, h('summary', {}, h('b', {}, r.title), h('span', { class: 'small muted' }, tl(`　{0}`, b.library.notes[r.title] ?? ''))), h('pre', { class: 'code small ref-body' }, r.body)) }));
    const names = [...SHELVES, ...new Set(refs.map((r) => r.shelf ?? tl('その他')).filter((s) => !SHELVES.includes(s)))];
    const groups = names.map((name) => {
        const mine = items.filter((x) => (x.r.shelf ?? tl('その他')) === name);
        const count = h('span', { class: 'lib-count' }, `${mine.length}`);
        const sec = h('section', { class: 'lib-shelf' }, h('h4', {}, name, count), ...mine.map((x) => x.el));
        return { sec, mine, count };
    }).filter((g) => g.mine.length);
    const hit = h('span', { class: 'small muted' });
    const q = h('input', { type: 'search', class: 'lib-search', placeholder: tl('資料を言葉で探す（例: 毒、声、霧）'), 'aria-label': tl('資料を探す') });
    q.addEventListener('input', () => {
        const w = q.value.trim();
        let n = 0;
        for (const g of groups) {
            let k = 0;
            for (const x of g.mine) {
                const ok = !w || x.r.title.includes(w) || x.r.body.includes(w);
                x.el.hidden = !ok;
                if (ok)
                    k++;
                if (w && ok && x.r.body.includes(w))
                    x.el.open = true;
            }
            g.sec.hidden = k === 0;
            g.count.textContent = w ? `${k}/${g.mine.length}` : `${g.mine.length}`;
            n += k;
        }
        hit.textContent = w ? tl(`{0}件見つかりました`, n) : '';
    });
    return h('div', { class: 'library' }, h('p', {}, b.library.intro), h('div', { class: 'lib-tools' }, q, hit), h('p', { class: 'small muted' }, tl(`資料は全部で{0}本。`, refs.length), b.library.outro), ...groups.map((g) => g.sec));
}
//# sourceMappingURL=briefing.js.map