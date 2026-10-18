// ブラウザに残す、人ごとの情報（準備の下書き・資料室で開いた資料・注目キャラ）。
// 共用の PC やイベント会場の端末で、前の人の準備が次の人に見えないように、次のように分ける。
//   ログイン中: localStorage に、ユーザーごとのキー（ai-battle:u:<名前>:<項目>）で保存する。
//              ログインしたときは、ほかのユーザーの分と、ユーザーで分けていなかった昔のキーを消す（このブラウザには、最後にログインした人の分だけが残る）
//   ログアウト: このブラウザに残っている人ごとの情報を、ユーザーを問わずすべて消す
//   未ログイン: sessionStorage（このタブを閉じると消える）。ログインしたら消す（準備画面でログインしたときだけ、画面の下書きをその人に引き継ぐ）
//   静的デモ版: アカウントが無いので、localStorage の ai-battle:demo:<項目> に保存する
// 言語・効果音・再生範囲・資料室の2列表示など、だれが使っても同じ「見え方の設定」は、ここでは扱わない（人ごとの情報ではないため）
import { demoMode } from './api.js';
const USER = 'ai-battle:u:';
const ANON = 'ai-battle:anon:';
const DEMO = 'ai-battle:demo:';
// ユーザーで分けていなかった昔のキー（下書き・資料室で開いた資料・自分のキャラの印）。引き継がずに消す
const LEGACY = /^ai-battle:(draft(:[a-z]{2})?|lib-open:[a-z]{2}|mine)$/;
let current = null;
const ls = () => { try {
    return window.localStorage;
}
catch {
    return null;
} };
const ss = () => { try {
    return window.sessionStorage;
}
catch {
    return null;
} };
const keysOf = (s) => {
    if (!s)
        return [];
    try {
        return Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k) => !!k);
    }
    catch {
        return [];
    }
};
const remove = (s, keep) => { for (const k of keysOf(s))
    if (!keep(k)) {
        try {
            s.removeItem(k);
        }
        catch { /* 消せない環境 */ }
    } };
const userPrefix = (name) => `${USER}${encodeURIComponent(name)}:`;
// 保存先（ストレージとキー）。ログイン中はユーザーごと、未ログインはこのタブだけ
function slot(key) {
    if (current)
        return [ls(), userPrefix(current) + key];
    if (demoMode)
        return [ls(), DEMO + key];
    return [ss(), ANON + key];
}
export function userGet(key) {
    const [s, k] = slot(key);
    try {
        return s?.getItem(k) ?? null;
    }
    catch {
        return null;
    }
}
export function userSet(key, value) {
    const [s, k] = slot(key);
    try {
        s?.setItem(k, value);
    }
    catch { /* 保存できない環境 */ }
}
export function userRemove(key) {
    const [s, k] = slot(key);
    try {
        s?.removeItem(k);
    }
    catch { /* 消せない環境 */ }
}
// 未ログインのあいだに、このタブで書いたもの（準備画面でログインしたときの引き継ぎ用）
export function anonGet(key) {
    try {
        return ss()?.getItem(ANON + key) ?? null;
    }
    catch {
        return null;
    }
}
export function clearAnon() { remove(ss(), (k) => !k.startsWith(ANON)); }
// ログイン中のユーザーが分かったとき（起動時・ログインしたとき・画面を開いたとき）に呼ぶ。null は未ログイン
export function setUser(name) {
    current = name;
    // 昔のキーは、だれのものか分からないので、ログインの有無にかかわらず消す
    remove(ls(), (k) => !LEGACY.test(k));
    // ほかのユーザーの分を消す（このブラウザには、ログインしている人の分だけを残す）
    if (name) {
        const mine = userPrefix(name);
        remove(ls(), (k) => !k.startsWith(USER) || k.startsWith(mine));
    }
}
export const currentUser = () => current;
// ログアウトしたとき: 人ごとの情報を、ユーザーを問わずすべて消す
export function signOut() {
    current = null;
    remove(ls(), (k) => !k.startsWith(USER) && !LEGACY.test(k));
    clearAnon();
}
//# sourceMappingURL=userStore.js.map