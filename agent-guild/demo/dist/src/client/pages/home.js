// ホーム: 参加中の人にはダッシュボード、まだの人とデモ版には紹介ページ（about.ts）と同じ中身
import { accountBar } from '../account.js';
import { briefingOf } from '../briefing.js';
import { demoMode, getBattle, getMe, getSeason, mySubmissions, scriptFor } from '../api.js';
import { myHero } from '../myhero.js';
import { renderAbout } from './about.js';
import { h, nodes } from '../ui.js';
import { localeOf, tl } from '../../shared/i18n.js';
function daysLeft(end) {
    if (!end)
        return null;
    const d = Math.ceil((Date.parse(end) - Date.now()) / 864e5);
    return Number.isFinite(d) ? Math.max(0, d) : null;
}
const stat = (label, value, note = '') => h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, String(value)), note ? h('div', { class: 'stat-note small muted' }, note) : null);
// --- 参加中の人のダッシュボード ---
async function dashboard(season, me, rerender) {
    const data = await getBattle().catch(() => null);
    const script = data ? scriptFor(data) : null;
    const myFighter = script ? script.fighters.findIndex((f) => f.owner === me.name) : -1;
    const standing = script && myFighter >= 0 ? script.standings.find((s) => s.f === myFighter) : undefined;
    const subs = (await mySubmissions().catch(() => ({ items: [] }))).items;
    const last = subs[0];
    const left = daysLeft(season.seasonEnd);
    const busy = subs.some((s) => s.status === 'queued' || s.status === 'grading');
    if (busy)
        setTimeout(() => { if (document.querySelector('.dash'))
            rerender(); }, 3000);
    const next = !subs.length
        ? { text: tl('まずは募集要項を読んで、冒険者の準備をしましょう。出発の前に、先輩冒険者に準備を見てもらえます。'), go: '#/make', label: tl('準備をはじめる') }
        : busy ? { text: tl('冒険者が戦っています（採点中）。終わると討伐に登場します。'), go: '#/arena', label: tl('討伐を見る') }
            : { text: tl('ギルドマスターの講評と冒険の記録で、どこで迷ったかを見て、準備を直しましょう。出発の前に、先輩冒険者にも会えます。'), go: '#/make', label: tl('準備を直す') };
    return [
        h('div', { class: 'dash' }, accountBar(season, me, rerender), h('p', { class: 'eyebrow' }, tl(`{0}　討伐依頼`, season.task.season)), h('h2', {}, briefingOf(season)?.headline ?? season.task.title), h('div', { class: 'stat-row' }, stat(tl('戦果の順位'), standing ? tl(`{0}位`, standing.rank) : '—', standing ? tl(`全{0}人中・戦果 {1}%`, script.fighters.length, standing.accuracy) : tl('出発するとつきます')), stat(tl('今日の出発'), tl(`残り{0}回`, me.remainingToday), tl(`1日{0}回まで`, season.limits.submissionsPerDay)), stat(tl('シーズン'), left === null ? tl('開催中') : left === 0 ? tl('最終日') : tl(`あと{0}日`, left), season.seasonEnd ? tl(`〜{0}`, new Date(season.seasonEnd).toLocaleDateString(localeOf())) : '')), h('section', { class: 'card next-card' }, h('p', {}, next.text), h('div', { class: 'row-gap' }, h('a', { class: 'btn btn-primary', href: next.go }, next.label), last?.status === 'done' ? h('a', { class: 'btn', href: `#/build/${last.id}` }, tl('ギルドマスターの講評')) : null, h('a', { class: 'btn', href: '#/task' }, tl('募集要項')), h('a', { class: 'btn', href: '#/ranking' }, tl('戦果')))), last ? h('p', { class: 'small muted' }, tl(`直近の出発: {0}（{1}）`, last.name, last.status === 'done' ? tl(`戦果 {0}%`, last.accuracy) : last.status === 'error' ? tl(`エラー: {0}`, last.error ?? '') : tl('採点中'))) : null, last?.status === 'done' && last.newCases ? h('p', { class: 'small warn-note' }, tl('この出発のあとで、シーズンの場面が{0}つ増えました。増えた場面は0点として数えています（もう一度出発すると、増えた場面も採点されます）。', last.newCases)) : null, h('h3', {}, tl('あなたの冒険者')), h('div', { class: 'my-hero-row' }, myHero(myFighter >= 0 ? script.fighters[myFighter].loadout : null, myFighter >= 0 ? script.fighters[myFighter].name : me.name, standing ? tl('{0}位・戦果 {1}%', standing.rank, standing.accuracy) : ''), myFighter >= 0 ? h('div', { class: 'my-hero-go' }, h('p', { class: 'small muted' }, tl('ほかの冒険者と一緒にボスに挑む様子は、討伐の画面で見られます。')), h('a', { class: 'btn btn-primary', href: '#/arena' }, tl('討伐を見る'))) : null)),
    ];
}
export async function renderHome(root) {
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const season = await getSeason();
    let me = await getMe().catch(() => null);
    const redo = () => { renderHome(root); };
    // デモ版のホームは、紹介ページと同じ中身（いちばん伝わる見せ方なので、ホームでも同じものを見せる）。
    // 準備はさわれるが送り出しはできないので、ボタンは「準備してみる（デモ）」、上に断り書きの帯を出す
    if (demoMode) {
        await renderAbout(root, {
            playUrl: '#/make', playLabel: tl('準備してみる（デモ）'),
            banner: h('p', { class: 'demo-band' }, h('b', {}, tl('デモ版')), tl('討伐の再生・準備の画面・図鑑をさわれます。冒険への出発と採点はできません。')),
        });
        return;
    }
    if (me && me.entered) {
        root.replaceChildren(...nodes(...(await dashboard(season, me, redo))));
        return;
    }
    // まだ参加していない人にも、紹介ページと同じ中身を見せる。参加（登録）は募集要項のページから
    await renderAbout(root, { playUrl: '#/task', playLabel: tl('募集要項を見る') });
}
//# sourceMappingURL=home.js.map