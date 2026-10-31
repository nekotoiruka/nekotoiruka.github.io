// 管理者画面: 管理者パスワードで入る。AIの提供元（Claude / Azure OpenAI / モック）・モデル・料金・予算を設定し、今月の利用料を見る。
// パスワードと APIキーはサーバーの中だけにあり、この画面には「設定済みかどうか」しか届かない。
import { demoMode } from '../api.js';
import { h, toast } from '../ui.js';
import { localeOf, tl } from '../../shared/i18n.js';
const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok)
        throw new Error(j.error ?? tl(`エラー {0}`, r.status));
    return j;
};
export async function renderAdmin(root) {
    if (demoMode) {
        root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('管理者画面')), h('p', {}, tl('デモ版にはありません。'))));
        return;
    }
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const r = await fetch('api/admin/settings');
    if (r.status === 403) {
        root.replaceChildren(loginView(() => renderAdmin(root)));
        return;
    }
    const s = (await r.json());
    const u = (await (await fetch('api/admin/usage')).json());
    const seasons = await (await fetch('api/admin/seasons')).json();
    const people = await (await fetch('api/admin/participants')).json();
    root.replaceChildren(dashboard(u), seasonsCard(seasons, () => renderAdmin(root)), dataCard(people, () => renderAdmin(root)), settingsForm(s, () => renderAdmin(root)), h('p', {}, h('button', { class: 'btn btn-small', onclick: async () => { await post('api/admin/logout', {}); renderAdmin(root); } }, tl('管理者画面からログアウト'))));
}
function loginView(done) {
    const pw = h('input', { type: 'password', placeholder: tl('管理者パスワード'), 'aria-label': tl('管理者パスワード'), autocomplete: 'current-password' });
    return h('section', { class: 'card admin-login' }, h('h2', {}, tl('管理者画面')), h('p', { class: 'small muted' }, tl('サーバーの .env に設定した ADMIN_PASSWORD で入ります。パスワードはサーバーの中だけで照合され、画面やブラウザには保存されません（ログインは12時間有効）。')), h('form', { onsubmit: async (e) => {
            e.preventDefault();
            try {
                await post('api/admin/login', { password: pw.value });
                pw.value = '';
                done();
            }
            catch (err) {
                toast(err.message, 'err');
            }
        } }, pw, h('button', { class: 'btn', type: 'submit' }, tl('入る'))));
}
function dashboard(u) {
    const pct = Math.min(100, (u.spentUsd / Math.max(0.0001, u.budgetUsd)) * 100);
    const yen = (usd) => tl(`約{0}円`, Math.max(0, Math.round(usd * 150)).toLocaleString());
    return h('section', {}, h('h2', {}, tl('管理者画面')), h('p', { class: 'muted' }, tl(`{0}　いまの採点: {1}（{2}）`, u.month, u.provider, u.model)), h('h3', {}, tl('今月の AI 利用料')), h('div', { class: 'meter' }, h('div', { class: 'meter-fill' + (pct >= 100 ? ' over' : ''), style: { width: `${pct}%` } }), h('div', { class: 'meter-text' }, tl(`\${0} / \${1}（{2}）`, u.spentUsd.toFixed(2), u.budgetUsd, yen(u.spentUsd)))), h('div', { class: 'awards' }, h('div', { class: 'award' }, h('div', { class: 'award-title' }, tl('参加者')), h('div', { class: 'award-name' }, u.participants)), h('div', { class: 'award' }, h('div', { class: 'award-title' }, tl('出発（累計）')), h('div', { class: 'award-name' }, u.submissions)), h('div', { class: 'award' }, h('div', { class: 'award-title' }, tl('採点待ち')), h('div', { class: 'award-name' }, u.queued)), h('div', { class: 'award' }, h('div', { class: 'award-title' }, tl('1回あたりの実費')), h('div', { class: 'award-name' }, u.submissions ? `$${(u.spentUsd / u.submissions).toFixed(3)}` : '-'))));
}
function settingsForm(s, reload) {
    const inp = (value, attrs = {}) => h('input', { value: String(value), ...attrs });
    const row = (label, el, note = '') => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), el, note ? h('span', { class: 'field-note' }, note) : null);
    const radios = ['anthropic', 'azure', 'mock'].map((p) => {
        const r = h('input', { type: 'radio', name: 'provider', value: p, checked: s.provider === p });
        r.onchange = () => sync();
        return { p, r, el: h('label', { class: 'chk' }, r, { anthropic: tl('Claude（Anthropic）'), azure: tl('Azure OpenAI（AOAI）'), mock: tl('モック（費用なし・点数は目安）') }[p]) };
    });
    const aModel = inp(s.anthropic.model, { list: 'claude-models' });
    const aKey = inp('', { type: 'password', placeholder: s.anthropic.apiKeySet ? tl('設定済み（変えるときだけ入力。消すときは -）') : tl('未設定'), autocomplete: 'off' });
    const zEnd = inp(s.azure.endpoint, { placeholder: tl('https://<リソース名>.openai.azure.com') });
    const zDep = inp(s.azure.deployment, { placeholder: tl('デプロイ名（例: gpt-4.1-mini）'), list: 'azure-models' });
    const zVer = inp(s.azure.apiVersion, { placeholder: tl('2024-10-21 または v1') });
    const zKey = inp('', { type: 'password', placeholder: s.azure.apiKeySet ? tl('設定済み（変えるときだけ入力。消すときは -）') : tl('未設定'), autocomplete: 'off' });
    const pIn = inp(s.pricing.inputPerMTok, { type: 'number', step: '0.01', min: 0 });
    const pOut = inp(s.pricing.outputPerMTok, { type: 'number', step: '0.01', min: 0 });
    const pCr = inp(s.pricing.cacheReadPerMTok, { type: 'number', step: '0.01', min: 0 });
    const pCw = inp(s.pricing.cacheWritePerMTok, { type: 'number', step: '0.01', min: 0 });
    const budget = inp(s.monthlyBudgetUsd, { type: 'number', step: '1', min: 0 });
    const runs = inp(s.runsPerCase, { type: 'number', min: 1, max: 5 });
    const trap = inp(s.trapRuns, { type: 'number', min: 1, max: 5 });
    const cr = inp(s.coachReviewsPerDay ?? 3, { type: 'number', min: 0, max: 20 });
    const estEl = h('p', { class: 'notice small' });
    const aBox = h('div', { class: 'sub-card' }, h('h4', {}, tl('Claude（Anthropic）')), row(tl('モデル'), aModel, tl('例: claude-haiku-5-5（安くて速い）')), row(tl('APIキー'), aKey));
    const zBox = h('div', { class: 'sub-card' }, h('h4', {}, tl('Azure OpenAI（AOAI）')), row(tl('エンドポイント'), zEnd), row(tl('デプロイ名'), zDep, tl('Azure ポータルで作ったデプロイの名前。関数呼び出し（ツール）に対応したモデルを選んでください')), row(tl('API バージョン'), zVer, tl('例: 2024-10-21。新しい v1 API を使うときは v1')), row(tl('APIキー'), zKey));
    const est = () => {
        // 実測（Claude Haiku 4.5）: 送り出し1回で入力 約10万〜20万トークン・出力 約5千〜1万トークン（31問・道具と巻物をよく使う構成ほど多い）
        const run = (inT, outT) => (inT * Number(pIn.value) + outT * Number(pOut.value)) / 1e6;
        const lo = run(40_000, 3_000), hi = run(200_000, 11_000);
        const yen = (u) => Math.max(1, Math.round(u * 150));
        estEl.textContent = tl(`この料金での1キャラあたりの目安: 出発1回 約{0}〜{1}円（\${2}〜\${3}）。ひっかけを複数回動かす設定にすると、その分増えます。`, yen(lo), yen(hi), lo.toFixed(3), hi.toFixed(3));
    };
    const sync = () => {
        const p = radios.find((x) => x.r.checked)?.p ?? 'mock';
        aBox.hidden = p !== 'anthropic';
        zBox.hidden = p !== 'azure';
        est();
    };
    [pIn, pOut].forEach((x) => { x.oninput = est; });
    const save = h('button', { class: 'btn btn-primary' }, tl('保存して切り替える'));
    save.onclick = async () => {
        save.disabled = true;
        try {
            await post('api/admin/settings', {
                provider: radios.find((x) => x.r.checked)?.p,
                anthropic: { model: aModel.value, apiKey: aKey.value },
                azure: { endpoint: zEnd.value, deployment: zDep.value, apiVersion: zVer.value, apiKey: zKey.value },
                pricing: { inputPerMTok: pIn.value, outputPerMTok: pOut.value, cacheReadPerMTok: pCr.value, cacheWritePerMTok: pCw.value },
                monthlyBudgetUsd: budget.value, runsPerCase: runs.value, trapRuns: trap.value, coachReviewsPerDay: cr.value,
            });
            toast(tl('保存しました。次の採点から使われます'));
            reload();
        }
        catch (e) {
            toast(e.message, 'err');
            save.disabled = false;
        }
    };
    const testOut = h('div', { class: 'small' });
    const test = h('button', { class: 'btn' }, tl('つながるか確かめる（例の場面を1問・数円）'));
    test.onclick = async () => {
        test.disabled = true;
        testOut.textContent = tl('確認中…');
        try {
            const j = await post('api/admin/test', {});
            testOut.textContent = j.ok ? tl(`OK: {0}（{1}）が答えました「{2}」（{3}トークン・{4}秒）`, j.provider, j.model, j.text, j.tokens, (j.ms / 1000).toFixed(1)) : tl(`失敗: {0}`, j.error);
        }
        catch (e) {
            testOut.textContent = tl(`失敗: {0}`, e.message);
        }
        test.disabled = false;
    };
    const card = h('section', { class: 'card admin-settings' }, h('h3', {}, tl('採点に使う AI')), s.problems.length ? h('p', { class: 'errors' }, tl(`いまは設定が足りないため、モックで動いています: {0}`, s.problems.join(' / '))) : null, h('p', { class: 'small muted' }, tl(`いま動いている採点: {0}`, s.active)), h('div', { class: 'row-gap' }, ...radios.map((x) => x.el)), aBox, zBox, h('datalist', { id: 'claude-models' }, ...['claude-haiku-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-opus-5-5'].map((m) => h('option', { value: m }))), h('datalist', { id: 'azure-models' }, ...['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'gpt-5-mini'].map((m) => h('option', { value: m }))), h('h4', {}, tl('料金（USD / 100万トークン）')), h('p', { class: 'small muted' }, tl('利用料の計算と予算の上限に使います。選んだモデルの最新の料金表に合わせてください。')), h('div', { class: 'grid2' }, row(tl('入力'), pIn), row(tl('出力'), pOut), row(tl('キャッシュ読み込み'), pCr), row(tl('キャッシュ書き込み'), pCw)), estEl, h('h4', {}, tl('予算と採点の回数')), h('div', { class: 'grid2' }, row(tl('月の予算（USD）'), budget, tl('超えると出発と採点を止めます')), row(tl('1問を動かす回数'), runs, tl('ふつうは1')), row(tl('ひっかけを動かす回数'), trap, tl('安定性を見るとき2〜3')), row(tl('先輩の詳しいアドバイス（1人1日）'), cr, tl('AI が準備を読んで、場面ごとの備えを伝えます。1回 約1〜3円。0 で止めます（モックのときは使えません）'))), h('div', { class: 'row-gap' }, save, test), testOut);
    sync();
    return card;
}
// シーズン（ボスと課題）の管理: 開催中のボスを切り替える。前のシーズンの順位は記録に残る
function seasonsCard(si, reload) {
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString(localeOf()) : '—');
    const cur = si.current;
    const rows = si.available.map((t) => {
        const isCur = t.id === cur.taskId;
        const label = h('input', { value: isCur ? cur.label : t.season, 'aria-label': tl('シーズン名'), maxlength: 30 });
        const end = h('input', { type: 'datetime-local', 'aria-label': tl('終了日時'), value: isCur && cur.end ? cur.end.slice(0, 16) : '' });
        const go = h('button', { class: isCur ? 'btn btn-small' : 'btn btn-small btn-primary' }, isCur ? tl('名前・終了日時を更新') : tl('このボスで開催する'));
        go.onclick = async () => {
            if (!isCur && !confirm2(go, tl(`「{0}」を開催します。いまのシーズンは終わり、順位は記録に残ります。`, t.title)))
                return;
            go.disabled = true;
            try {
                await post('api/admin/seasons/activate', { taskId: t.id, label: label.value, end: end.value ? new Date(end.value).toISOString() : '' });
                toast(isCur ? tl('更新しました') : tl(`「{0}」を開催しました`, t.title));
                reload();
            }
            catch (e) {
                toast(e.message, 'err');
                go.disabled = false;
            }
        };
        return h('tr', { class: isCur ? 'mine-row' : '' }, h('td', {}, h('b', {}, t.title), isCur ? h('span', { class: 'chip' }, tl('開催中')) : null, h('div', { class: 'small muted' }, t.boss)), h('td', { class: 'small' }, tl(`場面 {0}・資料 {1}`, t.cases, t.references)), h('td', { class: 'num' }, t.submissions), h('td', {}, label), h('td', {}, end), h('td', {}, go));
    });
    return h('section', { class: 'card admin-settings' }, h('h3', {}, tl('シーズン（ボスと課題）')), h('p', {}, h('b', {}, tl(`開催中: {0}「{1}」`, cur.label, cur.title)), h('span', { class: 'small muted' }, tl(`　{0}・{1}〜{2}`, cur.boss, fmt(cur.startedAt), cur.end ? fmt(cur.end) : tl('（終了日時なし）')))), h('p', { class: 'small muted' }, tl('ボスを切り替えると、討伐と戦果は新しいシーズンのものになります。前のシーズンの出発と順位はそのまま残り、戦果のページの「過去のシーズン」に出ます。課題（場面・資料室・道具）は tasks/ フォルダの中身から作られます。新しいボスを足すときは、tasks/ に課題を置いてください。')), h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, ...[tl('ボスと課題'), tl('中身'), tl('出発'), tl('シーズン名'), tl('終了日時（任意）'), ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...rows))), si.history.length ? h('h4', {}, tl('過去のシーズン')) : null, ...si.history.map((hh) => h('div', { class: 'sub-card' }, h('b', {}, tl(`{0}「{1}」`, hh.label, hh.title)), h('span', { class: 'small muted' }, tl(`　{0}〜{1}・参加 {2}人`, fmt(hh.startedAt), fmt(hh.endedAt), hh.participants ?? hh.top.length)), hh.top.length ? h('ol', { class: 'small' }, ...hh.top.map((x) => h('li', {}, tl(`{0}（{1}）戦果 {2}%`, x.name, x.owner, x.accuracy)))) : h('p', { class: 'small muted' }, tl('参加者なし')))));
}
function dataCard(p, reload) {
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString(localeOf()) : '—');
    const act = (btn, msg, body) => async () => {
        if (!confirm2(btn, msg, tl('もう一度押すと消す')))
            return;
        btn.disabled = true;
        try {
            const r = await post('api/admin/data', body);
            toast(tl('消しました（出発 {0} 件）。消す前の中身は、サーバーの backups フォルダに {1} として残しました。', r.removed, r.backup));
            reload();
        }
        catch (e) {
            toast(e.message, 'err');
            btn.disabled = false;
        }
    };
    const rows = p.users.map((x) => {
        const del = h('button', { class: 'btn btn-small btn-danger' }, tl('消す'));
        del.onclick = act(del, tl('「{0}」の登録と出発をすべて消します。', x.name), { action: 'remove-user', name: x.name });
        return h('tr', {}, h('td', {}, h('b', {}, x.name), x.team ? h('div', { class: 'small muted' }, x.team) : null), h('td', {}, x.entered ? tl('エントリー済み') : tl('未エントリー')), h('td', { class: 'num' }, x.submissions), h('td', { class: 'num' }, x.accuracy === null ? '—' : `${x.accuracy}%`), h('td', { class: 'small' }, fmt(x.lastAt)), h('td', {}, del));
    });
    const clearBtn = h('button', { class: 'btn btn-small btn-danger' }, tl('全員の出発を消す（登録は残す）'));
    clearBtn.onclick = act(clearBtn, tl('全員の出発と採点結果を消します。登録とエントリーは残ります。'), { action: 'clear-submissions' });
    const resetBtn = h('button', { class: 'btn btn-small btn-danger' }, tl('すべて消して、はじめからにする'));
    resetBtn.onclick = act(resetBtn, tl('登録・エントリー・出発をすべて消します（今月の利用料の記録と、シーズンの記録は残ります）。'), { action: 'reset-all' });
    return h('section', { class: 'card admin-settings' }, h('h3', {}, tl('参加者とデータ')), h('p', { class: 'small muted' }, tl('消す前の中身は、サーバーの DATA_DIR/backups/ に自動で残ります。元に戻すときは、そのファイルを DATA_DIR/db.json にコピーして、サーバーを起動し直してください。')), p.users.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, ...[tl('参加者'), tl('エントリー'), tl('出発'), tl('最新の戦果'), tl('最後の出発'), ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...rows))) : h('p', { class: 'small muted' }, tl('まだ参加者はいません。')), p.samples ? h('p', { class: 'small muted' }, tl('見本の参加者の出発: {0} 件（「全員の出発を消す」で消えます）', p.samples)) : null, h('div', { class: 'row-gap' }, clearBtn, resetBtn, h('a', { class: 'btn btn-small', href: 'api/admin/backup', download: '' }, tl('いまのデータを保存（ダウンロード）'))), h('p', { class: 'small muted' }, tl('ダウンロードしたファイルには、全員の心得・持ち物と、合言葉の照合用の値が入っています。ほかの人に渡さないでください。')));
}
// ブラウザのダイアログを使わず、2回押しで確定する
function confirm2(btn, msg, again = tl('もう一度押すと開催')) {
    if (btn.dataset.armed)
        return true;
    btn.dataset.armed = '1';
    const prev = btn.textContent;
    btn.textContent = again;
    toast(msg);
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = prev; }, 4000);
    return false;
}
//# sourceMappingURL=admin.js.map