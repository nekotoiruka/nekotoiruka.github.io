// ホーム（参加中の人のダッシュボード）と紹介ページ（初めての人・告知用）
import { accountBar } from '../account.js';
import { briefingOf } from '../briefing.js';
import { BRAND } from '../brand.js';
import { demoMode, getBattle, getMe, getSeason, mySubmissions, scriptFor } from '../api.js';
import { miniBattle } from '../minibattle.js';
import { h, nodes } from '../ui.js';
import { localeOf, tl } from '../../shared/i18n.js';
function daysLeft(end) {
    if (!end)
        return null;
    const d = Math.ceil((Date.parse(end) - Date.now()) / 864e5);
    return Number.isFinite(d) ? Math.max(0, d) : null;
}
const stat = (label, value, note = '') => h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, String(value)), note ? h('div', { class: 'stat-note small muted' }, note) : null);
// --- 紹介（ランディング）。「どんなゲームか」「参加すると何がいいか」を楽しく伝える。
//     細かいルールは募集要項に任せる。採点のしくみなどの裏側の話はしない ---
async function landing(season, cta) {
    const mini = await miniBattle();
    const steps = [
        ['🧙', tl('育てる'), tl('冒険者に、日本語で心得を教えて、道具や巻物を持たせます。かばんの大きさには限りがあるので、何を持たせるかが腕の見せどころ。')],
        ['⚔', tl('送り出す'), tl('ボタンひとつで出発。冒険者は本物のAIなので、戦場ではあなたの手を離れて、自分で考えて動きます。')],
        ['🏆', tl('見届ける'), tl('みんなの冒険者がそろって、ボスとの決戦。順位を競い、ギルドマスターの講評をヒントに鍛え直して、また挑みます。')],
    ];
    const perks = [
        ['🎮', tl('遊んでいるうちに、AIの使い方がうまくなる'), tl('うまく動かないのは、AIのせいか、教え方のせいか。冒険者を鍛えているうちに、AIへの頼み方が自然と身につきます。')],
        ['⌨', tl('プログラミングはいりません'), tl('画面で選んで、日本語で書くだけ。最初の冒険者なら10分ほどで送り出せます。')],
        ['👥', tl('みんなと腕を競える'), tl('ランキングと称号で、ほかの育て役と勝負。')],
        ['🐉', tl('シーズンごとに、新しいボス'), tl('竜、大蜘蛛、ゴブリンの大群、海の魔物……。ボスが変われば、役に立つ知識も道具もがらりと変わります。')],
    ];
    const terms = [
        [tl('心得'), tl('システムプロンプト'), tl('AIへの指示書')],
        [tl('道具'), tl('ツール'), tl('AIが外の情報を取りに行く手段')],
        [tl('冒険日誌'), tl('メモリ'), tl('前のことを思い出すための記録')],
        [tl('巻物'), tl('スキル'), tl('必要なときだけ開く知識の本')],
        [tl('結界'), tl('ガードレール'), tl('あやしい指示を、AIに届く前に止めるしくみ')],
    ];
    return [
        h('section', { class: 'hero' }, h('div', { class: 'hero-text' }, h('p', { class: 'eyebrow' }, tl(`冒険者募集中！　{0} 開催中`, season.task.season)), h('h1', {}, BRAND.name), h('p', { class: 'hero-tag' }, BRAND.tagline), h('p', { class: 'lead' }, tl('あなたが言葉で育てたAIが、自分で考えてボスに挑む。みんなの冒険者が集まって、シーズンごとに強大なボスを討伐するゲームです。')), cta), h('div', { class: 'hero-art' }, mini)),
        h('section', { class: 'about-block' }, h('h2', {}, tl('どんなゲーム？')), h('div', { class: 'pitch' }, ...steps.map(([icon, title, body], k) => h('div', { class: 'pitch-card' }, h('div', { class: 'pitch-icon' }, icon), h('h3', {}, `${k + 1}. ${title}`), h('p', {}, body))))),
        h('section', { class: 'about-block' }, h('h2', {}, tl('参加すると、いいこと')), h('ul', { class: 'perk-list' }, ...perks.map(([icon, title, body]) => h('li', {}, h('span', { class: 'perk-icon' }, icon), h('div', {}, h('b', {}, title), h('p', { class: 'small' }, body)))))),
        h('section', { class: 'about-block' }, h('h2', {}, tl('遊びながら覚える、AIエージェントのしくみ')), h('p', {}, tl('冒険者に持たせるものは、どれも本物のAIエージェントのしくみです。')), h('ul', { class: 'learn-list' }, ...terms.map(([n, ai, d]) => h('li', {}, h('b', {}, n), h('span', { class: 'ai-term' }, ai), h('span', {}, d)))), h('p', { class: 'small muted' }, tl('むずかしい言葉は覚えなくて大丈夫。遊んでいるうちに、気づけば使いこなしています。'))),
        h('section', { class: 'about-block' }, h('h2', {}, tl('よくある質問')), h('dl', { class: 'faq' }, h('dt', {}, tl('AIやプログラミングの知識は要りますか？')), h('dd', {}, tl('要りません。むしろ、AIをあまり使ったことがない人にこそ遊んでほしいゲームです。')), h('dt', {}, tl('どのくらい時間がかかりますか？')), h('dd', {}, tl('最初の冒険者は10分ほどで送り出せます。あとは、すきま時間に鍛え直して、何度でも挑戦できます。')), h('dt', {}, tl('ほかの人の育て方は見られますか？')), h('dd', {}, tl('見られるのは、見た目と順位だけです。育て方（心得や持ち物）は、シーズンが終わっても公開しません。')))),
    ].filter(Boolean);
}
// --- 参加中の人のダッシュボード ---
async function dashboard(season, me, rerender) {
    const data = await getBattle().catch(() => null);
    const script = data ? scriptFor(data) : null;
    const myFighter = script ? script.fighters.findIndex((f) => f.owner === me.name) : -1;
    const standing = script && myFighter >= 0 ? script.standings.find((s) => s.f === myFighter) : undefined;
    const subs = (await mySubmissions().catch(() => ({ items: [] }))).items;
    const last = subs[0];
    const left = daysLeft(season.seasonEnd);
    const mini = await miniBattle();
    const busy = subs.some((s) => s.status === 'queued' || s.status === 'grading');
    if (busy)
        setTimeout(() => { if (document.querySelector('.dash'))
            rerender(); }, 3000);
    const next = !subs.length
        ? { text: tl('まずは募集要項を読んで、冒険者の準備をしましょう。試走で確かめてから送り出せます。'), go: '#/make', label: tl('準備をはじめる') }
        : busy ? { text: tl('冒険者が戦っています（採点中）。終わると討伐に登場します。'), go: '#/arena', label: tl('討伐を見る') }
            : { text: tl('診断を見て準備を直し、もう一度送り出してみましょう。試走しても送り出しの回数は減りません（試走は1日{0}回まで）。', season.limits.trialsPerDay ?? 3), go: '#/make', label: tl('準備を直す') };
    return [
        h('div', { class: 'dash' }, accountBar(season, me, rerender), h('p', { class: 'eyebrow' }, tl(`{0}　討伐依頼`, season.task.season)), h('h2', {}, briefingOf(season)?.headline ?? season.task.title), h('div', { class: 'stat-row' }, stat(tl('戦果の順位'), standing ? tl(`{0}位`, standing.rank) : '—', standing ? tl(`全{0}人中・戦果 {1}%`, script.fighters.length, standing.accuracy) : tl('送り出すとつきます')), stat(tl('今日の送り出し'), tl(`残り{0}回`, me.remainingToday), tl(`1日{0}回まで`, season.limits.submissionsPerDay)), stat(tl('今日の試走'), tl(`残り{0}回`, me.trialsLeft), tl('1日{0}回まで・送り出しの回数は使いません', season.limits.trialsPerDay ?? 3)), stat(tl('シーズン'), left === null ? tl('開催中') : left === 0 ? tl('最終日') : tl(`あと{0}日`, left), season.seasonEnd ? tl(`〜{0}`, new Date(season.seasonEnd).toLocaleDateString(localeOf())) : '')), h('section', { class: 'card next-card' }, h('p', {}, next.text), h('div', { class: 'row-gap' }, h('a', { class: 'btn btn-primary', href: next.go }, next.label), last?.status === 'done' ? h('a', { class: 'btn', href: `#/build/${last.id}` }, tl('ギルドマスターの講評')) : null, h('a', { class: 'btn', href: '#/task' }, tl('募集要項')), h('a', { class: 'btn', href: '#/ranking' }, tl('戦果')))), last ? h('p', { class: 'small muted' }, tl(`直近の送り出し: {0}（{1}）`, last.name, last.status === 'done' ? tl(`戦果 {0}%`, last.accuracy) : last.status === 'error' ? tl(`エラー: {0}`, last.error ?? '') : tl('採点中'))) : null, h('h3', {}, tl('いまの討伐')), mini, h('p', {}, h('a', { href: '#/arena' }, tl('大きな画面で見る →')))),
    ];
}
export async function renderHome(root) {
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const season = await getSeason();
    let me = await getMe().catch(() => null);
    const redo = () => { renderHome(root); };
    if (demoMode) {
        const cta = h('div', { class: 'row-gap' }, h('a', { class: 'btn btn-primary', href: '#/task' }, tl('募集要項を見る')), h('a', { class: 'btn', href: '#/arena' }, tl('討伐の様子を見る')));
        root.replaceChildren(...nodes(...(await landing(season, cta)), h('p', { class: 'notice' }, tl('これは静的デモ版です。準備と討伐の再生は試せますが、送り出し（提出）はできません。'))));
        return;
    }
    if (me && me.entered) {
        root.replaceChildren(...nodes(...(await dashboard(season, me, redo))));
        return;
    }
    const cta = h('div', { class: 'row-gap' }, h('a', { class: 'btn btn-primary', href: '#/task' }, tl('募集要項を見る')), me ? null : h('span', { class: 'small muted' }, tl('参加（登録）は募集要項のページから')));
    root.replaceChildren(...nodes(...(await landing(season, cta))));
}
//# sourceMappingURL=home.js.map