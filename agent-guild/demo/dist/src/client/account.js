// ログイン／登録とエントリーの共通部品（ホームと「つくる」画面で使う）
import { demoMode, enterSeason, login, logout } from './api.js';
import { h, toast } from './ui.js';
import { tl } from '../shared/i18n.js';
import { setUser, signOut } from './userStore.js';
const addAdminLink = (me) => {
    if (me.admin && !document.querySelector('nav a[href="#/admin"]'))
        document.querySelector('nav')?.append(h('a', { href: '#/admin' }, tl('運営')));
};
// 名前と合言葉だけのログイン／登録フォーム。社内SSOのときは案内だけ出す
export function loginForm(season, onDone) {
    if (season.authMode === 'header')
        return h('p', { class: 'notice' }, tl('シングルサインオン（SSO）でログインしてから、もう一度開いてください。'));
    const nameIn = h('input', { placeholder: tl('表示名（みんなに分かる名前）'), maxlength: 20, 'aria-label': tl('表示名'), autocomplete: 'username' });
    // 登録とログインが同じフォームなので、合言葉の欄は current-password のまま（次回も同じ合言葉を使うので、パスワード管理に保存できるようにしておく）。
    // パスワード管理の拡張機能の吹き出しが欄にかぶさったときは、Esc で欄から抜ければ（欄の外に出ると）閉じられるようにする
    const passIn = h('input', { type: 'password', placeholder: tl('合言葉（4文字以上・次回も同じもの）'), 'aria-label': tl('合言葉'), autocomplete: 'current-password' });
    for (const el of [nameIn, passIn])
        el.addEventListener('keydown', (e) => { if (e.key === 'Escape')
            el.blur(); });
    return h('div', {}, h('p', { class: 'small muted' }, tl('初めての人は、表示名と合言葉を決めると登録されます（メールアドレスは不要）。')), h('form', { class: 'login', onsubmit: async (e) => {
            e.preventDefault();
            try {
                const me = (await login(nameIn.value.trim(), passIn.value)).user;
                setUser(me.name); // ほかの人の下書きなどは、このブラウザから消える
                addAdminLink(me);
                onDone(me);
            }
            catch (err) {
                toast(err.message, 'err');
            }
        } }, nameIn, passIn, h('button', { class: 'btn', type: 'submit' }, tl('ログイン / 登録'))));
}
// 戦果の揺れの説明（送り出しの確認と戦果の画面で同じ文言）
// 模擬採点（モック）の断り書き。本物の AI は動かさず、準備の中身を言葉の一致で見て点を近似しているだけなので、
// 心得の書き方の良し悪しは、本物の AI とは違う結果になることがある
export const MOCK_NOTE = () => tl('いまは「模擬採点」で動いています。本物の AI は動かさず、準備の中身を言葉の一致で見て、点を近似しているだけです。結界・冒険日誌・行動力の上限のような仕掛けは本物と同じに決まりますが、心得や巻物の書き方による点の差は、本物の AI とは違うことがあります。戦果と講評は、練習用の目安として見てください。');
export const SWAY_NOTE = () => tl('AI の判断は毎回少し揺れるので、同じ準備でも、出発するたびに戦果が少し変わることがあります。順位は最新の出発で決まります。');
export function seasonRules(season) {
    const R = season.costRules;
    return [
        tl(`荷物の重さは {0} まで。何を持たせて何を置いていくかを選びます。`, R.limit),
        tl(`冒険に出発できるのは1日 {0} 回まで。出発の前に、先輩冒険者に準備を見てもらえます（何回でも・回数は減りません）。`, season.limits.submissionsPerDay),
        tl('戦場で起きることは非公開です。採点は正しい行動との機械的な照合だけで行い、AI は採点に使いません。'),
        tl('ほかの人の心得と持ち物は、シーズンが終わっても公開されません。'),
    ];
}
// シーズンへのエントリー（ルール確認 → ボタン1つ）
export function entryCard(season, me, onDone) {
    const btn = h('button', { class: 'btn btn-primary' }, tl(`{0}の討伐隊にエントリーする`, season.task.season));
    btn.onclick = async () => {
        btn.disabled = true;
        try {
            onDone((await enterSeason(me.team ?? '')).user);
            toast(tl('エントリーしました。さっそく冒険者の準備をしましょう'));
        }
        catch (e) {
            toast(e.message, 'err');
            btn.disabled = false;
        }
    };
    return h('section', { class: 'card entry-card' }, h('h3', {}, tl(`{0}「{1}」`, season.task.season, season.task.briefing?.headline ?? season.task.title)), h('ul', { class: 'rule-list' }, ...seasonRules(season).map((t) => h('li', {}, t))), btn);
}
export function accountBar(season, me, onChange) {
    return h('div', { class: 'account-bar' }, h('span', {}, tl(`{0} さん`, me.name)), h('span', { class: 'muted small' }, me.entered ? tl(`今日の残り: 出発 {0} 回`, me.remainingToday) : tl('まだエントリーしていません')), !demoMode && season.authMode === 'passcode' ? h('button', { class: 'btn btn-small', onclick: async () => { await logout(); signOut(); onChange(); } }, tl('ログアウト')) : null);
}
//# sourceMappingURL=account.js.map