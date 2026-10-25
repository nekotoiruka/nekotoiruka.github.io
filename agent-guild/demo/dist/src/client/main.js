// エントリポイント: ハッシュルーティング
import { demoMode, detectMode, getMe, mySubmissions } from './api.js';
import { renderAdmin } from './pages/admin.js';
import { renderArena } from './pages/arena.js';
import { renderBuild } from './pages/build.js';
import { renderHome } from './pages/home.js';
import { pastSeasonsSection, renderRanking } from './pages/ranking.js';
import { renderSubmit } from './pages/submit.js';
import { renderTask } from './pages/task.js';
import { h } from './ui.js';
import { setUser } from './userStore.js';
import { BRAND } from './brand.js';
import { LANGS, getLang, setBrowserLang, tl } from '../shared/i18n.js';
// サービス名は brand.ts の1か所で決める
document.title = BRAND.name;
document.querySelectorAll('.logo-name').forEach((x) => { x.textContent = BRAND.name; });
document.querySelectorAll('.logo-tag').forEach((x) => { x.textContent = BRAND.tagline; });
document.querySelector('meta[name="description"]')?.setAttribute('content', BRAND.description);
document.querySelector('.demo-flag').textContent = tl('デモ版');
// ナビの文言（HTML は日本語の下地。ここで言語に合わせて差し替える）
const NAV_LABELS = { '#/': tl('ホーム'), '#/task': tl('募集要項'), '#/make': tl('準備'), '#/arena': tl('討伐'), '#/ranking': tl('戦果') };
document.querySelectorAll('nav a').forEach((a) => { const l = NAV_LABELS[a.getAttribute('href') ?? '']; if (l)
    a.textContent = l; });
// 言語の切り替え。言語ごとに別のシーズン（出題・ランキング）なので、選ぶと読み込み直す
const sw = h('select', { class: 'lang-sw', 'aria-label': tl('言語'), onchange: (e) => setBrowserLang(e.target.value) }, ...LANGS.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.native)));
document.querySelector('.topbar').append(sw);
const routes = [
    [/^#?\/?$/, (r) => renderHome(r)],
    [/^#\/about$/, async () => { location.replace('#/'); }], // 以前の告知リンク用: ホームへ
    // 過去のシーズンの討伐の再生（id があれば、その冒険者を中心に見る）
    [/^#\/arena\/past\/(\d+)(?:\/(.+))?$/, (r, key, id) => renderArena(r, id ? 'me' : undefined, { season: key, focus: id ? decodeURIComponent(id) : undefined })],
    [/^#\/arena(?:\/(me|finals|all))?$/, (r, v) => renderArena(r, v)],
    [/^#\/(?:make|submit)$/, (r) => renderSubmit(r)],
    [/^#\/ranking$/, (r) => renderRanking(r)],
    [/^#\/task$/, (r) => renderTask(r)],
    [/^#\/build\/(.+)$/, (r, id) => renderBuild(r, decodeURIComponent(id))],
    [/^#\/admin$/, (r) => renderAdmin(r)],
];
let lastHash = location.hash || '#/';
async function route() {
    const root = document.getElementById('app');
    // 送り出した冒険者が戦っている間は、画面を移らない
    if (document.body.dataset.locked) {
        if (location.hash !== lastHash)
            history.replaceState(null, '', lastHash);
        return;
    }
    const hash = location.hash || '#/';
    // 討伐と戦果は、まだ送り出していない人にも見せる（2026-10-25）。ほかの人の名前や討伐を見て「自分も参加しよう」と思ってもらうため。
    // 答えの言葉は字幕・名簿に出さない（かわし方の動きは見えてもよい）。以前は送り出して戦いが終わるまで閉じていた
    if (WATCH_GATE && /^#\/(arena|ranking)/.test(hash) && !/^#\/arena\/past\//.test(hash) && !(await canWatch())) {
        lastHash = hash;
        setNav(hash);
        root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('まだ見られません')), h('p', {}, tl('討伐と戦果は、あなたの冒険者を送り出して、戦いが終わってから見られます（ネタバレ防止のためでもあります）。')), h('a', { class: 'btn btn-primary', href: '#/make' }, tl('冒険者の準備へ'))));
        if (hash.startsWith('#/ranking'))
            root.append(await pastSeasonsSection().catch(() => h('span')));
        return;
    }
    lastHash = hash;
    setNav(hash);
    for (const [re, fn] of routes) {
        const m = re.exec(hash);
        if (m) {
            try {
                await fn(root, ...m.slice(1));
            }
            catch (e) {
                root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('読み込みに失敗しました')), h('p', {}, e.message)));
            }
            return;
        }
    }
    location.hash = '#/';
}
function setNav(hash) {
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#/' ? /^#?\/?$/.test(hash) : hash.startsWith(a.getAttribute('href'))));
}
const WATCH_GATE = false; // true にすると、送り出して戦いが終わるまで討伐と戦果を閉じる（以前の決まり）
// 自分の送り出しで、戦いが終わったものがあるか（デモ版はいつでも見られる）
async function canWatch() {
    if (demoMode)
        return true;
    const me = await getMe().catch(() => null);
    if (!me) {
        lockNav(true);
        return false;
    }
    const { items } = await mySubmissions().catch(() => ({ items: [] }));
    const ok = items.some((x) => x.status === 'done');
    lockNav(!ok);
    return ok;
}
function lockNav(locked) {
    document.querySelectorAll('nav a[href="#/arena"], nav a[href="#/ranking"]').forEach((a) => {
        a.classList.toggle('locked', locked);
        a.title = locked ? tl('冒険者を送り出すと見られます') : '';
    });
}
await detectMode();
// ログイン中のユーザーを先に確かめる（人ごとの下書きなどを、その人の分だけ読むため。ほかの人の分と昔のキーは、ここで消える）
if (!demoMode)
    setUser((await getMe().catch(() => null))?.name ?? null);
else
    setUser(null);
if (!demoMode && WATCH_GATE)
    canWatch();
if (demoMode)
    document.body.classList.add('demo');
else
    getMe().then((me) => {
        if (me?.admin)
            document.querySelector('nav').append(h('a', { href: '#/admin' }, tl('運営')));
    }).catch(() => undefined);
// 上部に固定する部品の高さを CSS に伝える（スマホではヘッダーが折り返して高くなるため）
const topbar = document.querySelector('.topbar');
const syncHeights = () => {
    const root = document.documentElement.style;
    if (topbar)
        root.setProperty('--topbar-h', `${topbar.offsetHeight}px`);
    const dock = document.querySelector('.dock-bar');
    if (dock)
        root.setProperty('--dock-h', `${dock.offsetHeight + 10}px`);
};
new ResizeObserver(syncHeights).observe(document.body);
window.addEventListener('resize', syncHeights);
window.addEventListener('hashchange', route);
route();
//# sourceMappingURL=main.js.map