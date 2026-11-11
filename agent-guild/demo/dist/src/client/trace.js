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
        case 'companion': return h('li', { class: 'tr tr-companion' }, h('span', { class: 'tr-k' }, tl('お供')), h('div', { class: 'tr-body' }, h('div', {}, h('b', {}, tl('お供に頼んだ：')), s.request || tl('（中身なし）')), s.skills?.length ? h('div', { class: 'small muted' }, tl('お供が開いた巻物: {0}', s.skills.map((n) => tl('「{0}」', n)).join(tl('・')))) : null, s.tools?.length ? h('div', { class: 'small muted' }, tl(`お供が使った道具: {0}`, s.tools.map(toolName).join(tl('・'))), s.tokens ? tl('（お供が使った行動力 {0}。冒険者の行動力は減らない）', s.tokens.toLocaleString()) : '') : null, h('div', {}, h('b', {}, tl('お供の答え：')), s.output), 
        // お供の答えは冒険者が読むので、その分は冒険者の行動力から減る（長い答えほど重い）
        s.output ? h('div', { class: `small ${estimateTokens(s.output) >= 300 ? 'tr-mp-heavy' : 'muted'}` }, tl('この答えを冒険者が読んだ分、冒険者の行動力 −約{0}', estimateTokens(s.output).toLocaleString()), estimateTokens(s.output) >= 300 ? tl('（長い答えほど、読んだ冒険者の行動力を使います）') : null) : null));
        case 'answer': return h('li', { class: `tr tr-answer ${s.ok ? 'tr-ok' : 'tr-ng'}` }, h('span', { class: 'tr-k' }, tl('答え')), h('div', { class: 'tr-body' }, h('b', {}, s.ok ? '○ ' : '× '), s.text));
    }
}
const HEAVY_SHOW = 300; // これより軽い道具の結果には、行動力の減りを出さない（細かい数字で読みにくくしない）
const HEAVY_WARN = 3000; // これより重い結果は強調する（1場面の 行動力 の2割ほど）
// 2026-11-07 から、行動力は1回の呼び出しに入る量（ap。同じものを何度も数えない）。ap のない古い記録は、もとの合計で出す
export function sceneMp(c) {
    return { used: Math.max(0, c.ap ?? c.tokensIn + c.tokensOut - (c.companionTokens ?? 0)), cap: MP_BUDGET_PER_CASE, companion: c.companionTokens, out: c.mpOut,
        ...(c.apParts ? { parts: c.apParts } : {}), ...(c.companionApParts ? { companionParts: c.companionApParts } : {}), ...(c.companionAp !== undefined ? { companionAp: c.companionAp } : {}) };
}
// 行動力の内訳: 1回の呼び出しに何が積み重なっていたかを、色の帯で見せる（数字は出さない。上限の線を引き、超えたら赤くする）。
// 心得を削れば書物を読む余地が生まれるが、そのぶん他の場面で外れる。どこを軽くするかは育て役が自分で決める
const AP_PARTS = [
    ['main', tl('心得')], ['tools', tl('道具の一覧')], ['scene', tl('場面')], ['scrolls', tl('巻物の中身')],
    ['results', tl('道具の結果')], ['companion', tl('お供の答え')], ['think', tl('考えと答え')],
];
const COMP_PARTS = [
    ['main', tl('お供の心得')], ['tools', tl('道具の一覧')], ['request', tl('頼んだこと')], ['scrolls', tl('巻物の中身')], ['results', tl('道具の結果')], ['answer', tl('答え')],
];
// style は文字列ではなくオブジェクトで渡す（CSP で、文字列の style 属性は効かない）
function apStack(title, parts, keys, cap, out) {
    const total = keys.reduce((a, [k]) => a + (parts[k] ?? 0), 0);
    const scale = Math.max(cap, total) || 1;
    const shown = keys.filter(([k]) => (parts[k] ?? 0) > 0);
    return h('div', { class: `ap-stack ${out ? 'is-out' : total > cap ? 'is-heavy' : ''}` }, h('div', { class: 'small' }, h('b', {}, title), out ? h('b', { class: 'mp-out' }, ' ' + tl('上限を超えた')) : total > cap ? h('b', { class: 'mp-heavy' }, ' ' + tl('目安を超えた')) : null), h('div', { class: 'ap-stack-bar', role: 'img', 'aria-label': shown.map(([, l]) => l).join(' / ') }, ...shown.map(([k, l]) => h('i', { class: `ap-${k}`, title: l, style: { width: `${(((parts[k] ?? 0) / scale) * 100).toFixed(1)}%` } })), h('b', { class: 'ap-cap', title: tl('行動力の目安'), style: { left: `${((cap / scale) * 100).toFixed(1)}%` } })), h('ul', { class: 'ap-legend small muted' }, ...shown.map(([k, l]) => h('li', {}, h('i', { class: `ap-${k}` }), l))));
}
function apBreakdown(m) {
    if (!m.parts && !m.companionParts)
        return null;
    return h('details', { class: 'ap-breakdown' }, h('summary', { class: 'small' }, tl('行動力の内訳を見る（いちばん重かったときに、何で埋まっていたか。目安）')), m.parts ? apStack(tl('冒険者'), m.parts, AP_PARTS, m.cap, m.out) : null, m.companionParts ? apStack(tl('お供'), m.companionParts, COMP_PARTS, m.cap, false) : null, h('p', { class: 'small muted' }, tl('帯の縦線は、行動力の目安です。超えても動けますが、読んだものはそのあと考えるたびに読み直すので、燃費がかさみ、時間もかかります。')));
}
// 行動力（AP）のゲージ: この場面で冒険者が使った量（頭に載せた量）。中身はトークンの数。
// 2026-11-10（issue #83）から行動力切れはなく、目安の線を超えると「重い」と出すだけ（古い記録の行動力切れは、そのまま出す）
function mpGauge(m) {
    const r = Math.min(1, m.used / m.cap), heavy = m.used > m.cap;
    return h('div', { class: `mp-gauge ${m.out ? 'is-out' : heavy ? 'is-high' : ''}` }, h('div', { class: 'mp-row small' }, h('b', {}, tl('冒険者の行動力')), h('span', {}, tl('使った量 {0}（目安 {1}）', m.used.toLocaleString(), m.cap.toLocaleString())), m.out ? h('b', { class: 'mp-out' }, tl('行動力切れ')) : heavy ? h('b', { class: 'mp-heavy', title: tl('目安を超えた。燃費がかさみ、時間もかかる') }, tl('重い')) : null), h('div', { class: 'mp-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(m.cap), 'aria-valuenow': String(Math.min(m.used, m.cap)) }, h('i', { style: { width: `${(r * 100).toFixed(1)}%` } })), m.companion ? h('div', { class: 'small muted' }, tl('お供が使った行動力 {0}（お供の分は、冒険者の行動力から減らない）', Math.round(m.companion).toLocaleString())) : null, apBreakdown(m));
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
    return h('details', { class: 'trace-guide small' }, h('summary', {}, tl('記録の読み方')), h('ul', {}, h('li', {}, h('b', {}, tl('行動力')), tl('：1つの場面で、冒険者が使った行動の量（AP）。場面のはじめから、心得と持ち物をもとに考える分を使い、道具を使う・巻物を開く・読む・考える・答えるたびに増えます。目安を超えても動けますが、読んだものはそのあと考えるたびに読み直すので、燃費（旅の体力）がかさみ、時間もかかります。場面が変わると元に戻ります。道具の横の「行動力 −約◯」は、その結果を読むのに使った量です。実務の AI でいう「コンテキスト（文脈の量）」にあたります。')), h('li', {}, h('b', {}, tl('途方に暮れた')), tl('：1つの場面で行動できる回数には限りがあります。道具を使い続けて答えを出さないと、その場面は動けなくなります。実務の AI でいう「ループ回数の上限」にあたります。')), h('li', {}, h('b', {}, tl('聞いた')), tl('：冒険者の耳に届いたこと。前に聞いてしまった幻術の声が、まだ混ざっていることもあります。')), h('li', {}, h('b', {}, tl('道具・巻物')), tl('：何を使い、何が分かったか。必要な道具を使っていない、関係のない巻物を開いている、が直しどころです。')), h('li', {}, h('b', {}, tl('お供')), tl('：お供（サブエージェント）に何を頼み、何が返ってきたか。お供に届くのは頼んだ文だけなので、手がかりが足りないと、正しく答えられません。')), h('li', {}, h('b', {}, tl('考え')), tl('：冒険者がそう判断した理由。「書いていない」「持っていない」とあれば、心得・巻物・道具のどれが足りないかが分かります。')), h('li', {}, h('b', {}, tl('答え')), tl('：最後の行動。外していたら、その前の「考え」に原因が書いてあることが多いです。'))));
}
//# sourceMappingURL=trace.js.map