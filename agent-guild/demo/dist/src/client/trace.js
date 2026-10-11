import { TOOL_BY_ID } from '../shared/catalog.js';
import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
const toolName = (id) => TOOL_BY_ID[id]?.name ?? id;
// 道具の結果（JSON）を読みやすくする。冒険日誌は「1回目: …」の形に
function pretty(out) {
    const row = (x) => (x && typeof x === 'object' && !Array.isArray(x)
        ? Object.entries(x).map(([k, v]) => (k === tl('回') ? tl(`{0}回目`, v) : String(v))).join(tl('：'))
        : String(x));
    const val = (x) => (Array.isArray(x) ? (x.length ? '\n' + x.map((r) => `  ${row(r)}`).join('\n') : tl('（何も書かれていない）')) : x && typeof x === 'object' ? JSON.stringify(x) : String(x));
    try {
        const v = JSON.parse(out);
        if (Array.isArray(v))
            return v.map(row).join('\n') || tl('（何も書かれていない）');
        if (v && typeof v === 'object')
            return Object.entries(v).map(([k, x]) => `${k}: ${val(x)}`).join('\n');
        return String(v);
    }
    catch {
        return out;
    }
}
function step(s) {
    switch (s.t) {
        case 'heard': return h('li', { class: 'tr tr-heard' }, h('span', { class: 'tr-k' }, tl('聞いた')), h('div', { class: 'tr-body' }, s.text));
        case 'guard': return h('li', { class: 'tr tr-guard' }, h('span', { class: 'tr-k' }, tl('結界')), h('div', { class: 'tr-body' }, tl(`「{0}」を含む声を、耳に届く前に弾いた。冒険者には何も聞こえていない。`, s.word)));
        case 'think': return h('li', { class: 'tr tr-think' }, h('span', { class: 'tr-k' }, tl('考え')), h('div', { class: 'tr-body' }, s.text));
        case 'tool': return h('li', { class: 'tr tr-tool' }, h('span', { class: 'tr-k' }, tl('道具')), h('div', { class: 'tr-body' }, h('b', {}, tl(`{0}を使った`, toolName(s.name))), s.input ? h('span', { class: 'small muted' }, tl(`　{0}`, s.input)) : null, h('pre', { class: 'tr-out' }, pretty(s.output))));
        case 'skill': return h('li', { class: 'tr tr-skill' }, h('span', { class: 'tr-k' }, tl('巻物')), h('div', { class: 'tr-body' }, h('b', {}, tl(`「{0}」を開いた`, s.name)), s.output ? h('pre', { class: 'tr-out' }, s.output + (s.output.length >= 300 ? '…' : '')) : null));
        case 'answer': return h('li', { class: `tr tr-answer ${s.ok ? 'tr-ok' : 'tr-ng'}` }, h('span', { class: 'tr-k' }, tl('答え')), h('div', { class: 'tr-body' }, h('b', {}, s.ok ? '○ ' : '× '), s.text));
    }
}
// 1場面ぶんの記録
export function traceView(steps) {
    if (!steps?.length)
        return h('p', { class: 'small muted' }, tl('この場面の記録はありません（記録をとる前の送り出しです）。'));
    const used = steps.some((s) => s.t === 'tool' || s.t === 'skill');
    return h('div', { class: 'trace' }, h('ol', { class: 'trace-list' }, ...steps.map(step)), !used && !steps.some((s) => s.t === 'guard') ? h('p', { class: 'small muted' }, tl('この場面では、道具も巻物も使わずに、心得だけで答えています。')) : null);
}
// どこを読めばよいかの手がかり（記録の読み方）
export function traceGuide() {
    return h('details', { class: 'trace-guide small' }, h('summary', {}, tl('記録の読み方')), h('ul', {}, h('li', {}, h('b', {}, tl('聞いた')), tl('：冒険者の耳に届いたこと。前に聞いてしまった幻術の声が、まだ混ざっていることもあります。')), h('li', {}, h('b', {}, tl('道具・巻物')), tl('：何を使い、何が分かったか。必要な道具を使っていない、関係のない巻物を開いている、が直しどころです。')), h('li', {}, h('b', {}, tl('考え')), tl('：冒険者がそう判断した理由。「書いていない」「持っていない」とあれば、心得・巻物・道具のどれが足りないかが分かります。')), h('li', {}, h('b', {}, tl('答え')), tl('：最後の行動。外していたら、その前の「考え」に原因が書いてあることが多いです。'))));
}
//# sourceMappingURL=trace.js.map