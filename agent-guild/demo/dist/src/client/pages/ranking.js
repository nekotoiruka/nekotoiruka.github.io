import { TOOL_BY_ID } from '../../shared/catalog.js';
import { demoMode, getBattle, getMe, getPastSeasons, mySubmissions, scriptFor } from '../api.js';
import { avatarCanvas, fmtMs, h, nodes } from '../ui.js';
import { localeOf, tl } from '../../shared/i18n.js';
import { SWAY_NOTE } from '../account.js';
import { gmSays } from '../guildmaster.js';
export async function renderRanking(root) {
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const script = scriptFor(await getBattle());
    if (!script) {
        root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('ランキングはまだありません'))), await pastSeasonsSection());
        return;
    }
    const me = await getMe().catch(() => null);
    const rows = script.standings.map((st) => {
        const fi = script.fighters[st.f];
        return h('tr', { class: me && fi.owner === me.name ? 'mine-row' : '' }, h('td', { class: 'rank' }, st.rank <= 3 ? ['🥇', '🥈', '🥉'][st.rank - 1] : st.rank), h('td', { class: 'who' }, avatarCanvas(fi.loadout, 1), h('a', { href: `#/build/${encodeURIComponent(fi.id)}` }, fi.name), h('span', { class: 'muted small' }, fi.owner)), h('td', { class: 'num' }, h('b', {}, `${st.accuracy}%`)), h('td', { class: 'num' }, st.avgTokens.toLocaleString()), h('td', { class: 'num' }, fmtMs(st.avgLatencyMs)), h('td', { class: 'num' }, st.damageDealt), h('td', { class: 'num' }, st.mvp), h('td', { class: 'num' }, fi.loadout.cost));
    });
    const best = (key, low = false) => {
        const xs = script.standings.slice().sort((a, b) => (low ? a[key] - b[key] : b[key] - a[key]));
        return script.fighters[xs[0].f].name;
    };
    // 役に立たない道具は、賞にはしない（要らない道具を持たせること自体が、AIエージェントとしては不正解なので）。
    // その代わり、自分の冒険者が戦場で振り回していたら、ギルドマスターがひとこと（どの道具かは言わない）
    const swung = (f) => script.waves.some((wv) => wv.events.some((e) => e.type === 'strike' && e.f === f && e.used.tools.some((t) => TOOL_BY_ID[t]?.decoy)));
    const mine = script.standings.find((st) => me && script.fighters[st.f].owner === me.name);
    const history = me && !demoMode ? (await mySubmissions().catch(() => ({ items: [] }))).items.filter((x) => x.status === 'done').reverse() : [];
    root.replaceChildren(...nodes(h('h2', {}, tl('戦果')), 
    // 戦果は、ギルドマスターが伝える
    gmSays(h('p', {}, tl('{0}討伐から、みな戻ってきたぞ。今回の戦果1位は「{1}」だ。', script.boss.name, script.fighters[script.standings[0].f].name)), mine ? h('p', {}, tl('お主の「{0}」は、{1}人中{2}位（戦果 {3}%）。', script.fighters[mine.f].name, script.fighters.length, mine.rank, mine.accuracy)) : null, mine && swung(mine.f) ? h('p', {}, tl('それにしても、お主の冒険者は、戦場で妙な物を振り回しておったな。何も起きなんだが……まあ、度胸だけは認めてやろう。')) : null, h('p', {}, mine
        ? h('a', { href: `#/build/${encodeURIComponent(script.fighters[mine.f].id)}` }, tl('わしの講評は、ここに書いておいた。次の手を考える手がかりにするのだぞ。'))
        : tl('冒険者の名前を押せば、わしの講評が読める。'))), h('p', { class: 'muted small' }, tl(`順位は「戦果（ボスの仕掛けに正しく動けた割合）」で決まり、同じなら燃費（使った行動力が少ない）→ 速さの順です。各参加者の最新の送り出しで決まります。`)), history.length ? h('section', { class: 'history' }, h('h3', {}, tl('あなたの提出の推移')), h('p', { class: 'small muted sway-note' }, SWAY_NOTE()), h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, ...[tl('提出日時'), tl('キャラ'), tl('正答率'), '', tl('コスト'), tl('採点費用')].map((x) => h('th', {}, x)))), h('tbody', {}, ...history.map((x, i) => h('tr', {}, h('td', { class: 'small' }, new Date(x.createdAt).toLocaleString(localeOf())), h('td', {}, h('a', { href: `#/build/${x.id}` }, x.name), i === history.length - 1 ? h('span', { class: 'chip' }, tl('最新')) : null), h('td', { class: 'num' }, x.accuracy !== undefined ? `${x.accuracy}%` : '-'), h('td', {}, h('span', { class: 'history-bar', style: { width: `${Math.round((x.accuracy ?? 0) * 1.2)}px` } })), h('td', { class: 'num' }, x.buildCost), h('td', { class: 'num' }, x.costUsd !== undefined ? `$${x.costUsd.toFixed(3)}` : '-'))))))) : null, h('div', { class: 'awards' }, award(tl('アタッカー賞'), best('damageDealt')), award(tl('MVP王'), best('mvp')), award(tl('精度賞'), best('accuracy')), award(tl('省エネ賞'), best('avgTokens', true)), award(tl('最速賞'), best('avgLatencyMs', true))), h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...[tl('順位'), tl('冒険者'), tl('戦果'), tl('燃費（使った行動力の平均）'), tl('速さ（平均）'), tl('与ダメ'), 'MVP', tl('コスト')].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows))), await pastSeasonsSection()));
}
// 過去のシーズンの戦果: シーズンを選んで、そのときの順位表を見る（シーズンを切り替えたときに残した記録）
const PAST_ROWS = 20;
const medal = (rank) => (rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : String(rank));
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(localeOf()) : '');
export async function pastSeasonsSection() {
    const items = await getPastSeasons().catch(() => []);
    const sec = h('section', { class: 'past-seasons', id: 'past-seasons' }, h('h2', {}, tl('過去のシーズン')));
    if (!items.length) {
        sec.append(h('p', { class: 'muted' }, demoMode ? tl('過去のシーズンの戦果はまだありません（デモ版には記録がありません）。') : tl('過去のシーズンの戦果はまだありません。シーズンが切り替わると、ここで前のシーズンの順位表を見られます。')));
        return sec;
    }
    const body = h('div', { class: 'past-body' });
    const sel = h('select', { 'aria-label': tl('見るシーズン'), class: 'past-select' }, ...items.map((it, i) => h('option', { value: String(i) }, tl(`{0}「{1}」 {2}〜{3}`, it.label, it.boss || it.title, fmtDay(it.startedAt), fmtDay(it.endedAt)))));
    const show = () => body.replaceChildren(pastSeasonView(items[Number(sel.value)]));
    sel.onchange = show;
    sec.append(h('p', { class: 'muted small' }, tl('終わったシーズンの順位表です（シーズンを切り替えたときの記録）。シーズンが終わっているので、冒険者の名前から準備の中身も見られます。')), h('label', { class: 'past-pick' }, h('span', { class: 'small muted' }, tl('シーズン')), sel), body);
    show();
    return sec;
}
function pastSeasonView(it) {
    let all = it.standings.length <= PAST_ROWS;
    const tbody = h('tbody');
    const more = h('button', { class: 'btn btn-small' });
    const draw = () => {
        tbody.replaceChildren(...(all ? it.standings : it.standings.slice(0, PAST_ROWS)).map((x) => h('tr', {}, h('td', { class: 'rank' }, medal(x.rank)), h('td', { class: 'who' }, avatarCanvas(x.loadout, 1), h('a', { href: `#/build/${encodeURIComponent(x.id)}` }, x.name)), h('td', { class: 'small muted' }, x.owner), h('td', { class: 'num' }, h('b', {}, `${x.accuracy}%`)), h('td', { class: 'num' }, x.avgTokens.toLocaleString()), h('td', { class: 'num' }, fmtMs(x.avgLatencyMs)), h('td', { class: 'num' }, x.cost), h('td', {}, it.replay ? h('a', { class: 'small', href: `#/arena/past/${it.key}/${encodeURIComponent(x.id)}`, title: tl(`{0} を中心に討伐を再生`, x.name) }, tl('▶ 再生')) : null))));
        more.hidden = it.standings.length <= PAST_ROWS;
        more.textContent = all ? tl(`上位{0}人だけにする`, PAST_ROWS) : tl(`全{0}人を表示`, it.standings.length);
    };
    more.onclick = () => { all = !all; draw(); };
    draw();
    return h('div', { class: 'card past-card' }, h('div', { class: 'past-head' }, h('div', {}, h('h3', {}, tl(`{0}「{1}」`, it.label, it.title)), h('p', { class: 'small muted' }, tl(`ボス: {0}　期間: {1}〜{2}　参加: {3}人`, it.boss || '—', fmtDay(it.startedAt), fmtDay(it.endedAt), it.participants))), it.replay ? h('a', { class: 'btn', href: `#/arena/past/${it.key}` }, tl('▶ このシーズンの討伐を再生')) : null), it.standings.length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, ...[tl('順位'), tl('冒険者'), tl('育て役'), tl('戦果'), tl('燃費（使った行動力の平均）'), tl('速さ（平均）'), tl('コスト'), ''].map((t) => h('th', {}, t)))), tbody))
        : h('p', { class: 'muted' }, tl('参加者はいませんでした。')), more);
}
function award(title, name) {
    return h('div', { class: 'award' }, h('div', { class: 'award-title' }, title), h('div', { class: 'award-name' }, name));
}
//# sourceMappingURL=ranking.js.map