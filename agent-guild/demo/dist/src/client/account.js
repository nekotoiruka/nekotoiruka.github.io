// ログイン／登録とエントリーの共通部品（ホームと「つくる」画面で使う）
import { demoMode, enterSeason, login, logout } from './api.js';
import { h, toast } from './ui.js';
import { tl } from '../shared/i18n.js';
const addAdminLink = (me) => {
    if (me.admin && !document.querySelector('nav a[href="#/admin"]'))
        document.querySelector('nav')?.append(h('a', { href: '#/admin' }, tl('運営')));
};
// 名前と合言葉だけのログイン／登録フォーム。社内SSOのときは案内だけ出す
export function loginForm(season, onDone) {
    if (season.authMode === 'header')
        return h('p', { class: 'notice' }, tl('シングルサインオン（SSO）でログインしてから、もう一度開いてください。'));
    const nameIn = h('input', { placeholder: tl('表示名（みんなに分かる名前）'), maxlength: 20, 'aria-label': tl('表示名'), autocomplete: 'username' });
    const passIn = h('input', { type: 'password', placeholder: tl('合言葉（4文字以上・次回も同じもの）'), 'aria-label': tl('合言葉'), autocomplete: 'current-password' });
    return h('div', {}, h('p', { class: 'small muted' }, tl('初めての人は、表示名と合言葉を決めると登録されます（メールアドレスは不要）。')), h('form', { class: 'login', onsubmit: async (e) => {
            e.preventDefault();
            try {
                const me = (await login(nameIn.value.trim(), passIn.value)).user;
                addAdminLink(me);
                onDone(me);
            }
            catch (err) {
                toast(err.message, 'err');
            }
        } }, nameIn, passIn, h('button', { class: 'btn', type: 'submit' }, tl('ログイン / 登録'))));
}
export function seasonRules(season) {
    const R = season.costRules;
    return [
        tl(`荷物の重さは {0} まで。何を持たせて何を置いていくかを選びます。`, R.limit),
        tl(`送り出しは1日 {0} 回まで。試走（例の場面だけで試す）は1日 {1} 回まで、送り出しの回数は使いません。`, season.limits.submissionsPerDay, season.limits.trialsPerDay ?? 3),
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
    return h('div', { class: 'account-bar' }, h('span', {}, tl(`{0} さん`, me.name)), h('span', { class: 'muted small' }, me.entered ? tl(`送り出しあと {0} 回・試走あと {1} 回`, me.remainingToday, me.trialsLeft) : tl('まだエントリーしていません')), !demoMode && season.authMode === 'passcode' ? h('button', { class: 'btn btn-small', onclick: async () => { await logout(); onChange(); } }, tl('ログアウト')) : null);
}
//# sourceMappingURL=account.js.map