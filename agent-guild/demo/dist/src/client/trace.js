import { TOOL_BY_ID } from '../shared/catalog.js';
import { MP_BUDGET_PER_CASE } from '../shared/stats.js';
import { estimateTokens } from '../shared/build.js';
import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
const toolName = (id) => TOOL_BY_ID[id]?.name ?? id;
// 道具の結果に出る項目名のうち、内部の英語の名前のもの（tools.ts）。参加者には画面の言葉で出す
const KEY_LABELS = {
    result: tl('結果'), results: tl('見つかった記述'), note: tl('メモ'), weakness: tl('弱点'), state: tl('状態'), found: tl('見つかったか'),
    email: tl('メールアドレス'), matches: tl('一致した部分'), error: tl('エラー'), ok: tl('形式は正しいか'), problems: tl('問題点'),
    recentCount: tl('最近の問い合わせ数'), openTickets: tl('未解決の問い合わせ数'),
};
const keyLabel = (k) => KEY_LABELS[k] ?? k;
const plain = (v) => (typeof v === 'boolean' ? (v ? tl('はい') : tl('いいえ')) : String(v));
// 道具の結果（JSON）を読みやすくする。冒険日誌は「1回目: …」の形に。資料の内部の番号（id）は出さない
function pretty(out) {
    const row = (x) => (x && typeof x === 'object' && !Array.isArray(x)
        ? Object.entries(x).filter(([k]) => k !== 'id').map(([k, v]) => (k === tl('回') ? tl(`{0}回目`, v) : plain(v))).join(tl('：'))
        : plain(x));
    const val = (x) => (Array.isArray(x) ? (x.length ? '\n' + x.map((r) => `  ${row(r)}`).join('\n') : tl('（何も書かれていない）')) : x && typeof x === 'object' ? row(x) : plain(x));
    try {
        const v = JSON.parse(out);
        if (Array.isArray(v))
            return v.map(row).join('\n') || tl('（何も書かれていない）');
        if (v && typeof v === 'object')
            return Object.entries(v).map(([k, x]) => `${keyLabel(k)}: ${val(x)}`).join('\n');
        return String(v);
    }
    catch {
        return out.startsWith('{') ? out.replace(/\\n/g, '\n').replace(/\\"/g, '"') : out;
    } // 長い結果は途中で切ってあり JSON として読めないので、改行だけ戻す
}
// 道具に渡したもの（{"query":"…"} など）は、項目名を出さずに中身だけを出す
function inputText(input) {
    try {
        const v = JSON.parse(input);
        if (v && typeof v === 'object' && !Array.isArray(v))
            return Object.values(v).map(plain).join(' / ');
        return plain(v);
    }
    catch {
        return input;
    }
}
function step(s) {
    switch (s.t) {
        case 'heard': return h('li', { class: 'tr tr-heard' }, h('span', { class: 'tr-k' }, tl('聞いた')), h('div', { class: 'tr-body' }, s.text));
        case 'guard': return h('li', { class: 'tr tr-guard' }, h('span', { class: 'tr-k' }, tl('結界')), h('div', { class: 'tr-body' }, tl(`「{0}」を含む声を、耳に届く前に弾いた。冒険者には何も聞こえていない。`, s.word)));
        case 'think': return h('li', { class: 'tr tr-think' }, h('span', { class: 'tr-k' }, tl('考え')), h('div', { class: 'tr-body' }, s.text));
        case 'tool': return h('li', { class: 'tr tr-tool' }, h('span', { class: 'tr-k' }, tl('道具')), h('div', { class: 'tr-body' }, h('b', {}, tl(`{0}を使った`, toolName(s.name))), s.input ? h('span', { class: 'small muted' }, tl(`　{0}`, inputText(s.input))) : null, 
        // 道具の結果は、全文が冒険者の 行動力 に積まれる。重い結果ほど目立たせて、MP 切れの原因がどこかを分かるようにする
        s.tokens && s.tokens >= HEAVY_SHOW ? h('span', { class: `tr-mp small ${s.tokens >= HEAVY_WARN ? 'tr-mp-heavy' : ''}` }, tl('　行動力 −約{0}', s.tokens.toLocaleString())) : null, h('pre', { class: 'tr-out' }, pretty(s.output) + (s.tokens && s.tokens >= HEAVY_WARN ? tl('\n……（この先も長く続く。全文を読んだぶん、冒険者の行動力が減った）') : ''))));
        case 'skill': return h('li', { class: 'tr tr-skill' }, h('span', { class: 'tr-k' }, tl('巻物')), h('div', { class: 'tr-body' }, h('b', {}, tl(`「{0}」を開いた`, s.name)), s.output ? h('pre', { class: 'tr-out' }, s.output + (s.output.length >= 300 ? '…' : '')) : null));
        case 'companion': return h('li', { class: 'tr tr-companion' }, h('span', { class: 'tr-k' }, tl('お供')), h('div', { class: 'tr-body' }, h('div', {}, h('b', {}, tl('お供に頼んだ：')), s.request || tl('（中身なし）')), s.tools?.length ? h('div', { class: 'small muted' }, tl(`お供が使った道具: {0}`, s.tools.map(toolName).join(tl('・'))), s.tokens ? tl('（お供が使った行動力 {0}。冒険者の行動力は減らない）', s.tokens.toLocaleString()) : '') : null, h('div', {}, h('b', {}, tl('お供の答え：')), s.output), 
        // お供の答えは冒険者が読むので、その分は冒険者の行動力から減る（長い答えほど重い）
        s.output ? h('div', { class: `small ${estimateTokens(s.output) >= 300 ? 'tr-mp-heavy' : 'muted'}` }, tl('この答えを冒険者が読んだ分、冒険者の行動力 −約{0}', estimateTokens(s.output).toLocaleString()), estimateTokens(s.output) >= 300 ? tl('（長い答えは冒険者の行動力を圧迫する。答えだけを短く返すよう、お供の心得に書こう）') : null) : null));
        case 'answer': return h('li', { class: `tr tr-answer ${s.ok ? 'tr-ok' : 'tr-ng'}` }, h('span', { class: 'tr-k' }, tl('答え')), h('div', { class: 'tr-body' }, h('b', {}, s.ok ? '○ ' : '× '), s.text));
    }
}
const HEAVY_SHOW = 300; // これより軽い道具の結果には、行動力の減りを出さない（細かい数字で読みにくくしない）
const HEAVY_WARN = 3000; // これより重い結果は強調する（1場面の 行動力 の2割ほど）
export function sceneMp(c) {
    return { used: Math.max(0, c.tokensIn + c.tokensOut - (c.companionTokens ?? 0)), cap: MP_BUDGET_PER_CASE, companion: c.companionTokens, out: c.mpOut };
}
// 行動力（AP）のゲージ: 場面のはじめは満タンで、使った分だけ減っていく（RPG の行動力と同じ向き）。中身はトークンの数
function mpGauge(m) {
    const left = Math.max(0, m.cap - m.used), r = left / m.cap;
    return h('div', { class: `mp-gauge ${m.out ? 'is-out' : r <= 0.3 ? 'is-high' : ''}` }, h('div', { class: 'mp-row small' }, h('b', {}, tl('冒険者の行動力')), h('span', {}, tl('残り {0} / {1}', left.toLocaleString(), m.cap.toLocaleString())), m.out ? h('b', { class: 'mp-out' }, tl('行動力切れ')) : null), h('div', { class: 'mp-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(m.cap), 'aria-valuenow': String(left) }, h('i', { style: `width:${(r * 100).toFixed(1)}%` })), m.companion ? h('div', { class: 'small muted' }, tl('お供が使った行動力 {0}（お供の分は、冒険者の行動力から減らない）', Math.round(m.companion).toLocaleString())) : null);
}
// 1場面ぶんの記録。mp を渡すと、先頭にこの場面の 行動力 のゲージを出す
export function traceView(steps, mp) {
    if (!steps?.length)
        return h('p', { class: 'small muted' }, tl('この場面の記録はありません（記録をとる前の出発です）。'));
    const used = steps.some((s) => s.t === 'tool' || s.t === 'skill' || s.t === 'companion');
    return h('div', { class: 'trace' }, mp ? mpGauge(mp) : null, h('ol', { class: 'trace-list' }, ...steps.map(step)), !used && !steps.some((s) => s.t === 'guard') ? h('p', { class: 'small muted' }, tl('この場面では、道具も巻物も使わずに、心得だけで答えています。')) : null);
}
// どこを読めばよいかの手がかり（記録の読み方）
export function traceGuide() {
    return h('details', { class: 'trace-guide small' }, h('summary', {}, tl('記録の読み方')), h('ul', {}, h('li', {}, h('b', {}, tl('行動力')), tl('：1つの場面で、冒険者が使える行動の量（AP）。道具を使う・読む・考える・答えるたびに減ります。冒険者は考えるたびに、それまでに読んだものをまるごと読み返すので、長い結果を一度読むと、その場面の終わりまで何度も行動力を使います。尽きると、その場面は動けません（行動力切れ）。場面が変わると満タンに戻ります。道具の横の「行動力 −約◯」は、その結果を読むのに使った量です。実務の AI でいう「コンテキストの上限」にあたります。')), h('li', {}, h('b', {}, tl('聞いた')), tl('：冒険者の耳に届いたこと。前に聞いてしまった幻術の声が、まだ混ざっていることもあります。')), h('li', {}, h('b', {}, tl('道具・巻物')), tl('：何を使い、何が分かったか。必要な道具を使っていない、関係のない巻物を開いている、が直しどころです。')), h('li', {}, h('b', {}, tl('お供')), tl('：お供（サブエージェント）に何を頼み、何が返ってきたか。お供に届くのは頼んだ文だけなので、手がかりが足りないと、正しく答えられません。')), h('li', {}, h('b', {}, tl('考え')), tl('：冒険者がそう判断した理由。「書いていない」「持っていない」とあれば、心得・巻物・道具のどれが足りないかが分かります。')), h('li', {}, h('b', {}, tl('答え')), tl('：最後の行動。外していたら、その前の「考え」に原因が書いてあることが多いです。'))));
}
//# sourceMappingURL=trace.js.map