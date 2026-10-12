// 紹介ページだけを 1ファイルの HTML で見せるときの入口（scripts/build-lp.mjs が使う）。
// 討伐データは window.__DEMO__ で、「遊んでみる」の行き先は window.__LP__.playUrl、静的デモの場所は window.__LP__.demoUrl で受け取る。
import { renderAbout } from './pages/about.js';
import { BRAND } from './brand.js';
import { h } from './ui.js';
import { LANGS, getLang, setBrowserLang, tl } from '../shared/i18n.js';
document.title = BRAND.name;
document.querySelector('meta[name=description]')?.setAttribute('content', BRAND.description);
const root = document.getElementById('app');
// 言語の切り替え（右上）。選ぶと、その言語で読み込み直す。URL の ?lang=ja などでも指定できる
document.body.prepend(h('div', { class: 'lp-langbar' }, h('select', { class: 'lang-sw', 'aria-label': tl('言語'), onchange: (e) => setBrowserLang(e.target.value) }, ...LANGS.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.native)))));
renderAbout(root, { playUrl: window.__LP__?.playUrl ?? '', demoUrl: window.__LP__?.demoUrl || undefined }).catch((e) => {
    root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('読み込みに失敗しました')), h('p', {}, e.message)));
});
//# sourceMappingURL=lp.js.map