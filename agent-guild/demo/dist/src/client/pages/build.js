import { MOCK_NOTE } from '../account.js';
import { getBuild, getSeason } from '../api.js';
import { COST_RULES } from '../../shared/catalog.js';
import { avatarCanvas, fmtMs, h, loadoutChips, nodes, radar } from '../ui.js';
import { sceneMp, traceGuide, traceView } from '../trace.js';
import { tl } from '../../shared/i18n.js';
import { gmPortrait } from '../guildmaster.js';
const KIND = { normal: tl('通常'), trap: tl('ひっかけ'), bonus: tl('宝箱'), boss: tl('ボス') };
export async function renderBuild(root, id) {
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    await getSeason().catch(() => null); // 課題ごとのコスト上限を読み込む
    let b;
    try {
        b = await getBuild(id);
    }
    catch (e) {
        root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('ビルドが見つかりません')), h('p', {}, e.message)));
        return;
    }
    root.replaceChildren(...nodes(b.season ? h('p', { class: 'notice' }, tl(`過去のシーズン「{0}」の冒険者です（シーズンは終わっているので、準備の中身も公開されています）。`, b.season.label), h('a', { href: `#/arena/past/${b.season.key}/${encodeURIComponent(b.id)}` }, tl('▶ このシーズンの討伐を再生')), tl('　'), h('a', { href: '#/ranking' }, tl('戦果へ'))) : null, h('div', { class: 'build-head' }, avatarCanvas(b.loadout, 5), h('div', {}, h('h2', {}, b.name), h('p', { class: 'muted' }, tl(`{0}　荷物の重さ {1}/{2}`, b.owner, b.loadout.cost, COST_RULES.limit)), b.kodawari ? h('blockquote', { class: 'kodawari' }, b.kodawari) : null, loadoutChips(b.loadout)), b.stats ? radar(b.stats, 200) : null), b.totals ? h('p', { class: 'muted' }, tl(`採点時の消費: 入力 {0} / 出力 {1} トークン（約 \${2}）`, b.totals.tokensIn.toLocaleString(), b.totals.tokensOut.toLocaleString(), b.totals.costUsd.toFixed(3))) : null, b.provider === 'mock' && b.diagnosis ? h('p', { class: 'notice small' }, MOCK_NOTE()) : null, b.diagnosis?.review ? reviewCard(b.diagnosis.review) : null, b.diagnosis ? h('details', { class: 'card diag' }, h('summary', {}, h('b', {}, tl('くわしい診断（場面の種類ごとの正解数）'))), h('p', { class: 'diag-top' }, b.diagnosis.top), h('ul', { class: 'diag-list' }, ...b.diagnosis.items.map((it) => h('li', { class: `diag-${it.level}` }, h('div', { class: 'diag-head' }, h('span', { class: 'diag-label' }, it.label), h('b', { class: 'diag-score' }, `${it.got} / ${it.total}`)), h('div', { class: 'diag-bar' }, h('div', { class: 'diag-fill', style: { width: `${Math.round((it.got / Math.max(1, it.total)) * 100)}%` } })), h('p', { class: 'small' }, it.hint), it.real ? h('p', { class: 'small diag-real' }, h('span', { class: 'chip' }, tl('実務ではこう言う')), ' ', it.real) : null))), h('p', { class: 'small muted diag-glossary' }, tl('ゲームの言葉と実務の言葉: 心得＝システムプロンプト／道具＝ツール／巻物＝スキル／結界＝ガードレール／冒険日誌＝メモリ')), h('p', { class: 'small muted' }, tl('非公開の問題の中身は出しません。種類ごとの正解数と、ビルドに足りないものだけを見せています。')), h('div', { class: 'row-gap' }, h('a', { class: 'btn btn-primary', href: '#/make' }, tl('準備を直して、もう一度出発する')), h('a', { class: 'btn', href: '#/task' }, tl('募集要項を読み直す')))) : null, b.cases ? adventureLog(b.cases) : null, h('h3', {}, tl('準備の全文（YAML）')), b.yaml
        ? h('pre', { class: 'code' }, b.yaml)
        : h('p', { class: 'muted' }, tl('準備の中身は、本人と運営者だけが見られます。'))));
}
// ギルドマスターの講評（総合評価 S〜D と、AIエージェントの仕組みごとの評価）
function reviewCard(r) {
    return h('section', { class: `card review grade-${r.grade}` }, h('div', { class: 'review-head' }, h('div', { class: 'grade-badge' }, h('span', { class: 'grade-letter' }, r.grade), h('span', { class: 'grade-label' }, tl('総合評価'))), h('div', { class: 'review-says' }, h('div', { class: 'small muted' }, tl(`ギルドマスターの講評　戦果 {0}%`, r.accuracy)), h('h3', {}, tl(`称号「{0}」`, r.title)), h('div', { class: 'gm-says gm-says-review' }, h('div', { class: 'gm-face' }, gmPortrait(), h('span', {}, tl('ギルドマスター'))), h('p', { class: 'gm-bubble' }, r.comment)))), h('div', { class: 'review-parts' }, ...r.parts.map((p) => h('div', { class: 'review-part' }, h('div', { class: 'rp-head' }, h('span', { class: `rp-mark m-${p.mark}` }, p.mark), h('b', {}, p.name), h('span', { class: 'ai-term' }, p.ai), p.score ? h('span', { class: 'rp-score small muted', title: p.unit ?? '' }, `${p.score.got} / ${p.score.total}`) : null), 
    // 数が何を数えているか（分母は場面の数。持たせた道具などの数ではない）
    p.score && p.unit ? h('p', { class: 'rp-unit small muted' }, p.unit) : null, p.note ? h('p', { class: 'rp-note small muted' }, p.note) : null, p.good.length ? h('div', { class: 'rp-good' }, h('div', { class: 'rp-k' }, tl('できていたこと')), h('ul', {}, ...p.good.map((x) => h('li', {}, x)))) : null, p.better.length ? h('div', { class: 'rp-better' }, h('div', { class: 'rp-k' }, tl('もっとこうすれば')), h('ul', {}, ...p.better.map((x) => h('li', {}, x)))) : null, h('details', { class: 'rp-lesson' }, h('summary', {}, tl(`{0}って何のため？`, p.ai)), h('p', { class: 'small' }, p.lesson))))), h('div', { class: 'review-next' }, h('b', {}, tl('次の一手: ')), r.next), h('div', { class: 'row-gap' }, h('a', { class: 'btn btn-primary', href: '#/make' }, tl('準備を直して、もう一度出発する')), h('a', { class: 'btn', href: '#/arena/me' }, tl('討伐で活躍を見る'))));
}
// 冒険の記録: 場面ごとに、冒険者が何を聞き・使い・考え・答えたかを開いて読める。最初は外した場面だけを出す
function adventureLog(cases) {
    const ng = cases.filter((c) => c.score < 0.6);
    let onlyNg = ng.length > 0;
    const list = h('div', { class: 'advlog-list' });
    const draw = () => list.replaceChildren(...(onlyNg ? ng : cases).map((c) => h('details', { class: `advlog ${c.score >= 0.6 ? 'is-ok' : 'is-ng'}` }, h('summary', {}, h('span', { class: 'advlog-mark' }, c.score >= 0.6 ? '○' : '×'), h('span', { class: 'advlog-title' }, c.title, h('span', { class: 'small muted' }, tl(`　{0}・{1}`, KIND[c.kind] ?? c.kind, '★'.repeat(c.difficulty)))), h('span', { class: 'advlog-ans small' }, c.mpOut ? tl('行動力切れ') : c.excerpt), h('span', { class: 'advlog-meta small muted' }, tl(`{0}トークン・{1}`, (c.tokensIn + c.tokensOut).toLocaleString(), fmtMs(c.latencyMs)))), traceView(c.trace, sceneMp(c)))));
    const tabs = h('div', { class: 'seg' }, ...[[true, tl(`外した場面だけ（{0}）`, ng.length)], [false, tl(`すべての場面（{0}）`, cases.length)]].map(([v, label]) => {
        const btn = h('button', { class: `btn btn-sm ${onlyNg === v ? 'btn-primary' : ''}` }, String(label));
        btn.onclick = () => { onlyNg = v; tabs.querySelectorAll('button').forEach((x) => x.classList.remove('btn-primary')); btn.classList.add('btn-primary'); draw(); };
        return btn;
    }));
    draw();
    return h('section', { class: 'card advlog-card' }, h('h3', {}, tl('冒険の記録')), h('p', { class: 'small' }, tl('場面ごとに、冒険者が何を聞き、どの道具や巻物を使い、何を考えて、どう動いたかを読めます。外した場面を開いて、「何が足りなかったのか」を探してみましょう。')), h('div', { class: 'row-gap' }, tabs, traceGuide()), list);
}
export { fmtMs };
//# sourceMappingURL=build.js.map