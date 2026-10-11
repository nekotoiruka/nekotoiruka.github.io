// 多言語対応。ソースの文言は日本語で、日本語そのものを辞書のキーにする（tl('日本語') → 各言語の訳）。
// 辞書に無い文言は日本語のまま出る。差し込みは {0} {1}…（tl('あと{0}日', 3)）。
// ブラウザは起動時に言語を決めて辞書を1つだけ読み込み、サーバーは要求ごとの言語を setLangProvider で渡す。
export const LANGS = [
    { code: 'ja', native: '日本語', locale: 'ja-JP', dir: 'ltr' },
    { code: 'en', native: 'English', locale: 'en-US', dir: 'ltr' },
    { code: 'zh', native: '简体中文', locale: 'zh-CN', dir: 'ltr' },
    { code: 'es', native: 'Español', locale: 'es-ES', dir: 'ltr' },
    { code: 'pt', native: 'Português (Brasil)', locale: 'pt-BR', dir: 'ltr' },
    { code: 'fr', native: 'Français', locale: 'fr-FR', dir: 'ltr' },
    { code: 'de', native: 'Deutsch', locale: 'de-DE', dir: 'ltr' },
    { code: 'ko', native: '한국어', locale: 'ko-KR', dir: 'ltr' },
    { code: 'hi', native: 'हिन्दी', locale: 'hi-IN', dir: 'ltr' },
    { code: 'ar', native: 'العربية', locale: 'ar-EG', dir: 'rtl' },
];
export const DEFAULT_LANG = 'ja';
export const LANG_CODES = LANGS.map((l) => l.code);
export const isLang = (x) => typeof x === 'string' && LANG_CODES.includes(x);
export const langInfo = (l) => LANGS.find((x) => x.code === l);
// ブラウザの言語設定（ja-JP, zh-Hans-CN, pt-PT …）から、対応している言語を1つ選ぶ
export function matchLang(tag) {
    const p = String(tag ?? '').toLowerCase().split(/[-_]/)[0];
    return isLang(p) ? p : null;
}
// Accept-Language ヘッダー（"fr-CA,fr;q=0.9,en;q=0.8"）から選ぶ
export function fromAcceptLanguage(h) {
    for (const part of String(h ?? '').split(',')) {
        const l = matchLang(part.split(';')[0].trim());
        if (l)
            return l;
    }
    return null;
}
const dicts = {};
let current = DEFAULT_LANG;
let provider = null;
export async function loadLang(l) {
    if (l === 'ja' || dicts[l])
        return;
    // 1ファイルに書き出したデモ: 辞書はページに埋めこんである
    const inline = globalThis.__DICTS__?.[l];
    if (inline) {
        dicts[l] = inline;
        return;
    }
    // 1ファイルにまとめるとき（bun build）に辞書を巻きこまないよう、読みこむ先は実行時に組み立てる
    const spec = new URL(`./locales/${l}.js`, import.meta.url).href;
    dicts[l] = (await import(spec)).default;
}
export async function loadAllLangs() { await Promise.all(LANG_CODES.map(loadLang)); }
export const setLangProvider = (p) => { provider = p; };
export const getLang = () => (provider ? provider() : current);
export const isRtl = (l = getLang()) => langInfo(l).dir === 'rtl';
export const localeOf = (l = getLang()) => langInfo(l).locale;
const fill = (s, args) => (args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[+i] !== undefined && args[+i] !== null ? String(args[+i]) : m)) : s);
export function tl(ja, ...args) {
    const l = getLang();
    const s = l === 'ja' ? ja : dicts[l]?.[ja] ?? ja;
    return fill(s, args);
}
// 指定した言語で訳す（サーバーが、要求とは別の言語で書くとき用）
export function tIn(l, ja, ...args) {
    return fill(l === 'ja' ? ja : dicts[l]?.[ja] ?? ja, args);
}
// モジュールの先頭で作る定数（ラベルの表など）を、読むたびにその時点の言語で作る。
// サーバーは要求ごとに言語が変わるので、tl() を含む定数はこれで包む。作った結果は言語ごとに1回だけ作って使い回す。
export function perLang(make) {
    const cache = new Map();
    const cur = () => { const l = getLang(); let v = cache.get(l); if (!v) {
        v = make();
        cache.set(l, v);
    } return v; };
    const target = (Array.isArray(make()) ? [] : {});
    return new Proxy(target, {
        get: (_o, k) => { const c = cur(); const v = Reflect.get(c, k); return typeof v === 'function' ? v.bind(c) : v; },
        has: (_o, k) => Reflect.has(cur(), k),
        ownKeys: () => (Array.isArray(target) ? [...Reflect.ownKeys(cur())] : Reflect.ownKeys(cur())),
        getOwnPropertyDescriptor: (o, k) => {
            const d = Reflect.getOwnPropertyDescriptor(cur(), k);
            if (!d)
                return undefined;
            return Array.isArray(o) && k === 'length' ? { ...d, value: cur().length } : { ...d, configurable: true };
        },
    });
}
// 画面とキャンバスの文字に使うフォント（ドット風の DotGothic16 は日本語と英数字だけなので、ほかの文字は言語ごとの書体で補う）
const FALLBACK_FONT = {
    ja: '"Hiragino Kaku Gothic ProN", "Noto Sans JP"', en: '', zh: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei"', es: '', pt: '', fr: '', de: '',
    ko: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic"', hi: '"Noto Sans Devanagari", "Mangal"', ar: '"Noto Sans Arabic", "Tahoma"',
};
export const fontStack = (l = getLang()) => ['"DotGothic16"', FALLBACK_FONT[l], 'system-ui', 'sans-serif'].filter(Boolean).join(', ');
export let PIXEL_FONT = fontStack('ja'); // ブラウザでは、言語が決まったあと下で入れ直す
const GOOGLE_FONT = { zh: 'Noto+Sans+SC', ko: 'Noto+Sans+KR', hi: 'Noto+Sans+Devanagari', ar: 'Noto+Sans+Arabic' };
// --- ブラウザの起動時の言語決定（?lang=xx → 保存した選択 → ブラウザの設定 → 英語）---
const KEY = 'ag.lang';
export function chooseBrowserLang() {
    // 1ファイルに書き出したページ（紹介ページ・演出ギャラリー・デモ）は、言語を固定して埋めこむ（辞書を別ファイルから読めないため）
    const fixed = globalThis.__LANG__;
    if (isLang(fixed))
        return fixed;
    try {
        const q = new URLSearchParams(location.search).get('lang');
        if (isLang(q)) {
            localStorage.setItem(KEY, q);
            return q;
        }
    }
    catch { /* 保存できなくても動く */ }
    try {
        const s = localStorage.getItem(KEY);
        if (isLang(s))
            return s;
    }
    catch { /* 保存できなくても動く */ }
    // 保存できない場所（Claude の Artifact の中など）では、窓の名前に覚えておく（再読みこみしても残る）
    try {
        const m = /(?:^|;)ag\.lang=(\w+)/.exec(window.name);
        if (m && isLang(m[1]))
            return m[1];
    }
    catch { /* なくても動く */ }
    for (const tag of navigator.languages ?? [navigator.language]) {
        const l = matchLang(tag);
        if (l)
            return l;
    }
    return 'en';
}
export function setBrowserLang(l) {
    try {
        localStorage.setItem(KEY, l);
    }
    catch { /* 保存できなくても動く */ }
    try {
        window.name = `${window.name.replace(/(?:^|;)ag\.lang=\w+/, '')};ag.lang=${l}`;
    }
    catch { /* なくても動く */ }
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    // URL が # より後ろしか変わらないときは、href を入れ直しても再読みこみされない（画面が切り替わらない）ので、明示的に読みこみ直す
    if (u.toString().split('#')[0] === location.href.split('#')[0])
        location.reload();
    else
        location.href = u.toString();
}
if (typeof document !== 'undefined') {
    current = chooseBrowserLang();
    await loadLang(current);
    document.documentElement.lang = langInfo(current).locale;
    document.documentElement.dir = langInfo(current).dir;
    PIXEL_FONT = fontStack(current);
    document.documentElement.style.setProperty('--font', PIXEL_FONT);
    if (GOOGLE_FONT[current])
        document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${GOOGLE_FONT[current]}&display=swap` }));
    // サーバーの API には、いつも画面と同じ言語（＝その言語のシーズン）を伝える
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (/^(\.\/|\/)?api\//.test(u))
            init = { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), 'x-lang': current } };
        return nativeFetch(input, init);
    };
}
//# sourceMappingURL=i18n.js.map