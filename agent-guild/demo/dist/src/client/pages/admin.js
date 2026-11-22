// 管理者画面: 管理者パスワードで入る。上に「開催中のようす」の帯、その下を「開催／AI と費用／参加者とデータ／名前とことば」のタブで分ける。
// 開いているタブは URL（#/admin/kaisai など）で覚える。再読み込みしても同じタブを開く。
// 危ない操作（消す・いますぐ開催）は、押すとその場に「消えるもの／残るもの」が開き、「確かめました」にチェックしてから赤いボタンで実行する。
// パスワードと APIキーはサーバーの中だけにあり、この画面には「設定済みかどうか」しか届かない。
import { demoMode, getSeason } from '../api.js';
import { bossProblems } from '../bosshost.js';
import { h, toast } from '../ui.js';
import { localeOf, tl } from '../../shared/i18n.js';
import { NAME_KIND_LABELS, NAME_KINDS } from '../../shared/names.js';
const TABS = ['kaisai', 'ai', 'people', 'names'];
const TAB_LABEL = { kaisai: () => tl('開催'), ai: () => tl('AI と費用'), people: () => tl('参加者とデータ'), names: () => tl('名前とことば') };
const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok)
        throw new Error(j.error ?? tl(`エラー {0}`, r.status));
    return j;
};
const getJson = async (url) => { const r = await fetch(url); if (!r.ok)
    throw new Error(tl(`エラー {0}`, r.status)); return await r.json(); };
// 日時は、このブラウザのタイムゾーンで入力・表示する。サーバーには、タイムゾーンつきの ISO 形式で送る
const fmt = (iso) => (iso ? new Date(iso).toLocaleString(localeOf(), { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtLong = (iso) => (iso ? new Date(iso).toLocaleString(localeOf(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const localInput = (iso) => { if (!iso)
    return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const toIso = (v) => (v ? new Date(v).toISOString() : '');
const yen = (usd) => tl(`約{0}円`, Math.max(0, Math.round(usd * 150)).toLocaleString());
const field = (label, el, note = '') => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), el, note ? h('span', { class: 'field-note' }, note) : null);
const card = (title, ...body) => h('section', { class: 'card admin-settings' }, typeof title === 'string' ? h('h3', {}, title) : title, ...body);
const leftText = (ms) => {
    const m = Math.max(0, Math.floor(ms / 6e4));
    if (m >= 24 * 60)
        return tl('{0}日 {1}時間', Math.floor(m / 1440), Math.floor((m % 1440) / 60));
    if (m >= 60)
        return tl('{0}時間 {1}分', Math.floor(m / 60), m % 60);
    return tl('{0}分', m);
};
export function setAdminNav(on) {
    const a = document.querySelector('nav a[href="#/admin"]');
    if (on && !a)
        document.querySelector('nav')?.append(h('a', { href: '#/admin', class: location.hash.startsWith('#/admin') ? 'on' : '' }, tl('運営')));
    if (!on)
        a?.remove();
}
export async function renderAdmin(root, tabArg) {
    if (demoMode) {
        root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, tl('管理者画面')), h('p', {}, tl('デモ版にはありません。'))));
        return;
    }
    const first = !root.querySelector('.admin');
    if (first)
        root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const r = await fetch('api/admin/settings');
    if (r.status === 403) {
        root.replaceChildren(loginView(() => { setAdminNav(true); renderAdmin(root, tabArg); }));
        return;
    }
    const s = (await r.json());
    const [u, seasons, people, nm] = await Promise.all([getJson('api/admin/usage'), getJson('api/admin/seasons'), getJson('api/admin/participants'), getJson('api/admin/names')]);
    const tab = TABS.includes(tabArg ?? '') ? tabArg : 'kaisai';
    // 操作のあとは、同じタブ・同じ位置で読み込み直す
    const reload = () => { const y = scrollY; const cur = /^#\/admin\/(\w+)/.exec(location.hash)?.[1]; renderAdmin(root, cur).then(() => scrollTo(0, y)); };
    root.replaceChildren(adminPage({ s, u, seasons, people, nm }, tab, reload));
}
function adminPage(d, tab, reload) {
    const waiting = d.nm.items.filter((x) => x.status === 'review').length + d.nm.live.length;
    const names = waiting + d.nm.reports.length;
    const panel = h('div', { class: 'tab-panel', role: 'tabpanel', id: 'admin-panel' });
    const buttons = TABS.map((k) => h('button', { class: 'tab', role: 'tab', id: `admin-tab-${k}`, 'aria-controls': 'admin-panel', 'data-tab': k, onclick: () => show(k) }, TAB_LABEL[k](), k === 'names' && names ? h('span', { class: 'count', 'aria-label': tl('（{0}）', names) }, names) : null));
    const show = (k) => {
        openOp?.close();
        buttons.forEach((b) => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
        panel.setAttribute('aria-labelledby', `admin-tab-${k}`);
        panel.replaceChildren(...({ kaisai: kaisaiTab, ai: aiTab, people: peopleTab, names: namesTab }[k])(d, reload));
        if (location.hash !== `#/admin/${k}`)
            history.replaceState(null, '', `#/admin/${k}`);
    };
    const tabs = h('div', { class: 'tabs admin-tabs', role: 'tablist', 'aria-label': tl('管理者画面') }, ...buttons);
    // 矢印キーでタブを移る
    tabs.addEventListener('keydown', (e) => {
        const i = buttons.indexOf(document.activeElement);
        if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key))
            return;
        const n = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
        n.focus();
        show(n.dataset.tab);
    });
    const logout = h('button', { class: 'btn btn-small', onclick: async () => { await post('api/admin/logout', {}); setAdminNav(false); location.hash = '#/admin'; } }, tl('ログアウト'));
    const page = h('div', { class: 'admin' }, h('div', { class: 'head-row' }, h('h2', {}, tl('管理者画面')), logout), bossWarn(), band(d, waiting, () => { show('names'); tabs.scrollIntoView({ block: 'start' }); }), tabs, panel);
    show(tab);
    return page;
}
// 本物の参加者の出発の数（見本の参加者の出発は数えない）。u.submissions は見本も含めた、いまある出発の全部
const realSubmissions = (d) => Math.max(0, d.u.submissions - d.people.samples);
// ===== ボスの演出を読めなかったときの警告（シーズンのパックの fx/。#118） =====
function bossWarn() {
    const box = h('div', { class: 'notice warn', role: 'alert', hidden: true });
    const fill = () => {
        if (!bossProblems.length)
            return;
        box.replaceChildren(h('b', {}, tl('このシーズンのボスの演出を読みこめませんでした。仮の影で表示しています（シーズンパックの fx/ と、SEASON_FX の設定を確かめてください）')), ...bossProblems.map((p) => h('div', { class: 'small muted' }, `${p.kind}: ${p.reason}`)));
        box.hidden = false;
    };
    getSeason().then(fill, fill); // 開催中のシーズンのボスを読んでみる（読めなければ bossProblems に入る）
    return box;
}
// ===== 上の帯: 開催中のようす =====
function band(d, waiting, goNames) {
    const { u, seasons: si, people } = d;
    const cur = si.current, next = si.scheduled[0];
    const now = Date.now();
    const over = !!cur.end && Date.parse(cur.end) <= now;
    const entrants = people.users.filter((x) => x.entered).length;
    const departed = people.users.filter((x) => (x.seasonSubmissions ?? 0) > 0).length; // 今のシーズンで出発させた人
    const real = realSubmissions(d);
    const pct = Math.min(100, (u.spentUsd / Math.max(0.0001, u.budgetUsd)) * 100);
    const stat = (k, v, s, cls = '') => h('div', { class: 'stat' }, h('span', { class: 'stat-k' }, k), h('span', { class: `stat-v ${cls}` }, v), h('span', { class: 'stat-s' }, s));
    return h('section', { class: 'card admin-settings band', 'aria-label': tl('開催中のようす') }, h('div', { class: 'band-head' }, h('span', { class: over ? 'chip chip-gap' : 'chip chip-live' }, over ? tl('受付終了') : tl('開催中')), h('b', { class: 'band-season' }, tl(`{0}「{1}」`, cur.label, cur.title)), h('span', { class: 'small muted' }, cur.boss)), h('div', { class: 'band-stats' }, cur.end ? stat(tl('締切まで'), over ? tl('受付終了') : leftText(Date.parse(cur.end) - now), fmt(cur.end), 'info') : stat(tl('締切まで'), '—', tl('（終了日時なし）')), stat(tl('エントリーした人'), tl('{0}人', entrants), tl('登録した人 {0}人', people.users.length)), stat(tl('出発させた人'), tl('{0}人', departed), tl('今のシーズンで1回でも出発させた人')), stat(tl('出発'), tl('{0}回', real), tl('採点待ち {0}', u.queued)), h('div', { class: 'stat stat-wide' }, h('span', { class: 'stat-k' }, tl('今月の AI 利用料（予算 ${0}）', u.budgetUsd)), h('div', { class: 'meter' }, h('div', { class: 'meter-fill' + (pct >= 100 ? ' over' : ''), style: { width: `${pct}%` } }), h('div', { class: 'meter-text' }, tl(`\${0} / \${1}（{2}）`, u.spentUsd.toFixed(2), u.budgetUsd, yen(u.spentUsd)))), h('span', { class: 'stat-s' }, tl('1回あたり {0}・採点: {1}（{2}）', real ? `$${(u.spentUsd / real).toFixed(3)}` : '—', u.provider, u.model)))), h('div', { class: 'band-foot' }, next ? h('span', {}, h('span', { class: 'chip chip-plan' }, tl('予約')), ' ', tl('次は {0} から {1}', fmt(next.start), next.label)) : h('span', {}, tl('予約はありません')), cur.end && next && Date.parse(cur.end) < Date.parse(next.start) ? h('span', {}, tl('受付終了: {0} 〜 {1}', fmt(cur.end), fmt(next.start))) : null, waiting ? h('a', { href: '#/admin/names', onclick: (e) => { e.preventDefault(); goNames(); } }, tl('確認待ちの言葉 {0} 件', waiting)) : null));
}
let openOp = null;
// place: 確かめの欄を画面に入れて、入れた要素（閉じるときに外すもの）を返す
function dangerButton(label, op, place, small = false) {
    const btn = h('button', { class: `btn btn-danger${small ? ' btn-small' : ''}`, 'aria-expanded': 'false' }, label);
    btn.onclick = () => {
        if (openOp?.btn === btn) {
            openOp.close();
            return;
        }
        openOp?.close();
        const o = op();
        let wrap;
        const close = () => { wrap.remove(); btn.setAttribute('aria-expanded', 'false'); if (openOp?.btn === btn)
            openOp = null; };
        const box = confirmBox(o, close, () => btn.focus());
        wrap = place(box);
        btn.setAttribute('aria-expanded', 'true');
        openOp = { btn, close };
        box.querySelector('input[type=checkbox], .btn-danger-go')?.focus();
    };
    return btn;
}
function confirmBox(o, close, back) {
    const go = h('button', { class: 'btn btn-danger-go', disabled: !!o.gone }, o.go);
    const ack = o.gone ? h('input', { type: 'checkbox' }) : null;
    if (ack)
        ack.onchange = () => { go.disabled = !ack.checked; };
    go.onclick = async () => {
        go.disabled = true;
        try {
            await o.run();
            close();
        }
        catch (e) {
            toast(e.message, 'err');
            go.disabled = !!ack && !ack.checked;
        }
    };
    const list = (cls, title, xs) => h('div', { class: cls }, h('b', {}, title), h('ul', {}, ...xs.map((x) => h('li', {}, x))));
    const box = h('div', { class: 'danger-confirm', role: 'group', 'aria-label': o.q }, h('b', { class: 'confirm-q' }, o.q), o.gone ? h('div', { class: 'gone-keep' }, list('gone', tl('消えるもの'), o.gone), list('keep', tl('残るもの'), o.keep ?? [])) : null, o.note ? h('p', { class: 'small muted' }, o.note) : null, ack ? h('label', { class: 'chk' }, ack, tl('消えるものを確かめました')) : null, h('div', { class: 'row-gap' }, go, h('button', { class: 'btn', onclick: () => { close(); back(); } }, tl('やめる'))));
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') {
        close();
        back();
    } });
    return box;
}
// ===== 開催タブ: いまのシーズン・予約（タイムライン）・過去のシーズン =====
function kaisaiTab(d, reload) {
    const si = d.seasons, cur = si.current;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // いまのシーズン: 名前と終了日時を変える
    const label = h('input', { value: cur.label, maxlength: 30 });
    const end = h('input', { type: 'datetime-local', value: localInput(cur.end) });
    const upd = h('button', { class: 'btn btn-primary' }, tl('名前・終了日時を更新'));
    upd.onclick = async () => {
        upd.disabled = true;
        try {
            await post('api/admin/seasons/activate', { taskId: cur.taskId, label: label.value, end: toIso(end.value) });
            toast(tl('更新しました'));
            reload();
        }
        catch (e) {
            toast(e.message, 'err');
            upd.disabled = false;
        }
    };
    // ボスを替えて、いますぐ開催する（ふだんは予約を使う）
    const nTask = h('select', {}, ...si.available.map((t) => h('option', { value: t.id }, tl(`{0}「{1}」`, t.season, t.title))));
    const nLabel = h('input', { placeholder: tl('空なら課題のシーズン名'), maxlength: 30 });
    const nEnd = h('input', { type: 'datetime-local' });
    const nowSlot = h('div', { class: 'confirm-slot' });
    const titleOf = () => si.available.find((t) => t.id === nTask.value)?.title ?? nTask.value;
    const activateNow = async () => {
        await post('api/admin/seasons/activate', { taskId: nTask.value, label: nLabel.value, end: toIso(nEnd.value) });
        toast(tl(`「{0}」を開催しました`, titleOf()));
        reload();
    };
    // 同じボスで、シーズン名も同じ（空）なら、サーバーは新しいシーズンにせず、終了日時だけを変える。止めずに、そのことを確かめてから続ける
    const nowBtn = dangerButton(tl('いますぐ開催する'), () => nTask.value === cur.taskId && (!nLabel.value.trim() || nLabel.value.trim() === cur.label) ? {
        q: tl('いまと同じボスで、シーズン名も同じなので、新しいシーズンにはならず、終了日時が変わるだけです。続けますか？'),
        go: tl('続ける'),
        run: async () => { await post('api/admin/seasons/activate', { taskId: nTask.value, label: nLabel.value, end: toIso(nEnd.value) }); toast(tl('更新しました')); reload(); },
    } : {
        q: tl('いまのシーズンを終えて、「{0}」をすぐ開催しますか？', titleOf()),
        gone: [cur.end ? tl('{0}（締切 {1}）は、いま終わる', cur.label, fmt(cur.end)) : tl('{0}は、いま終わる', cur.label)],
        keep: [tl('{0}の出発と順位（記録に残る）', cur.label), tl('予約したシーズン')],
        go: tl('いますぐ開催する'),
        run: activateNow,
    }, (box) => { nowSlot.replaceChildren(box); return box; });
    // 開いたあとで選び直したら、確かめを閉じる（中身が古くならないように）
    for (const el of [nTask, nLabel, nEnd])
        for (const ev of ['input', 'change'])
            el.addEventListener(ev, () => { if (openOp?.btn === nowBtn)
                openOp.close(); });
    const now = h('details', { class: 'fold' }, h('summary', {}, tl('ボスを替えて、いますぐ開催する')), h('p', { class: 'small muted' }, tl('いまのシーズンはここで終わり、順位は記録に残ります。ふつうは「シーズンの予約」を使ってください。')), h('div', { class: 'grid2' }, field(tl('ボスと課題'), nTask), field(tl('シーズン名'), nLabel), field(tl('終了日時（任意）'), nEnd)), h('div', { class: 'row-gap' }, nowBtn), nowSlot, h('p', { class: 'small muted' }, tl('ボスを切り替えると、討伐と戦果は新しいシーズンのものになります。前のシーズンの出発と順位はそのまま残り、戦果のページの「過去のシーズン」に出ます。課題（場面・資料室・道具）は tasks/ フォルダの中身から作られます。新しいボスを足すときは、tasks/ に課題を置いてください。')));
    const over = !!cur.end && Date.parse(cur.end) <= Date.now();
    const seasonCard = card(tl('いまのシーズン'), h('p', {}, h('span', { class: over ? 'chip chip-gap' : 'chip chip-live' }, over ? tl('受付終了') : tl('開催中')), ' ', tl(`{0}「{1}」`, cur.label, cur.title), h('span', { class: 'small muted' }, tl('　{0}・{1}〜', cur.boss, fmt(cur.startedAt)))), h('div', { class: 'grid2' }, field(tl('シーズン名'), label), field(tl('終了日時（任意）'), end)), h('div', { class: 'row-gap' }, upd), now);
    // 予約
    const rows = si.scheduled.flatMap((x) => {
        const tr = h('tr', {}, h('td', {}, fmt(x.start)), h('td', {}, x.end ? tl('〜 {0}', fmt(x.end)) : tl('（次の予約まで）')), h('td', {}, tl(`{0}「{1}」`, x.label, x.title), h('div', { class: 'small muted' }, x.boss)));
        const cancel = dangerButton(tl('取り消す'), () => ({
            q: tl('「{0}」の予約を取り消しますか？', x.label), go: tl('予約を取り消す'),
            run: async () => { await post('api/admin/seasons/unschedule', { start: x.start }); toast(tl('予約を取り消しました')); reload(); },
        }), (box) => { const r = h('tr', { class: 'confirm-row' }, h('td', { colspan: 4 }, box)); tr.after(r); return r; }, true);
        tr.append(h('td', { class: 'act' }, cancel));
        return [tr];
    });
    const pTask = h('select', {}, ...si.available.map((t) => h('option', { value: t.id }, tl(`{0}「{1}」`, t.season, t.title))));
    const pLabel = h('input', { placeholder: tl('空なら課題のシーズン名'), maxlength: 30 });
    const pStart = h('input', { type: 'datetime-local' });
    const pEnd = h('input', { type: 'datetime-local' });
    const plan = h('button', { class: 'btn btn-primary' }, tl('予約する'));
    plan.onclick = async () => {
        if (!pStart.value) {
            toast(tl('開始日時を入れてください'), 'err');
            return;
        }
        plan.disabled = true;
        try {
            await post('api/admin/seasons/schedule', { taskId: pTask.value, label: pLabel.value, start: toIso(pStart.value), end: toIso(pEnd.value) });
            toast(tl('予約しました'));
            reload();
        }
        catch (e) {
            toast(e.message, 'err');
            plan.disabled = false;
        }
    };
    const planCard = card(tl('シーズンの予約'), timeline(si), rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table stack sched-table' }, h('thead', {}, h('tr', {}, ...[tl('開始日時'), tl('終了日時'), tl('シーズン'), ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...rows))) : h('p', { class: 'small muted' }, tl('予約はありません')), h('h4', {}, tl('新しく予約する')), h('div', { class: 'grid2' }, field(tl('ボスと課題'), pTask), field(tl('シーズン名'), pLabel), field(tl('開始日時'), pStart), field(tl('終了日時（任意）'), pEnd)), h('div', { class: 'row-gap' }, plan, h('span', { class: 'small muted' }, tl('日時は、このブラウザのタイムゾーン（{0}）で入力・表示します。', tz))), h('details', { class: 'fold' }, h('summary', { class: 'small' }, tl('予約のきまり')), h('p', { class: 'small muted' }, tl('開始日時になると、サーバーがそのボスで開催します（サーバーが止まっていたときは、次に起動したときに開催し、記録は予約の日時で残ります）。終了日時を過ぎてから次のシーズンが始まるまでは「受付終了」になり、出発はできません。参加者のホームには、次のシーズンの開始日時だけを出します（ボスは始まるまで伏せます）。'))));
    const out = [h('div', { class: 'cols' }, h('div', {}, seasonCard), h('div', {}, planCard))];
    if (si.history.length)
        out.push(card(tl('過去のシーズン'), ...si.history.map((hh) => h('details', { class: 'fold' }, h('summary', {}, tl(`{0}「{1}」`, hh.label, hh.title), h('span', { class: 'small muted' }, tl(`　{0}〜{1}・参加 {2}人`, fmtLong(hh.startedAt), fmtLong(hh.endedAt), hh.participants ?? hh.top.length))), hh.top.length ? h('ol', { class: 'small' }, ...hh.top.map((x) => h('li', {}, tl(`{0}（{1}）戦果 {2}`, x.name, x.owner, x.score ?? x.accuracy)))) : h('p', { class: 'small muted' }, tl('参加者なし'))))));
    return out;
}
// シーズンの流れ: 過去・開催中・受付終了（出発できない期間）・予約を、1本の帯で見せる
function timeline(si) {
    const cur = si.current, now = Date.now();
    const t = (iso) => (iso ? Date.parse(iso) : NaN);
    const segs = [];
    const past = si.history.slice(0, 2);
    for (const hh of past)
        if (hh.endedAt)
            segs.push({ cls: 'tl-past', a: t(hh.startedAt), b: t(hh.endedAt), text: hh.label });
    const curEnd = t(cur.end);
    const plan = si.scheduled;
    // 開催中の帯は、終了日時（なければ次の予約・なければ今から2週間）まで
    const curTo = !Number.isNaN(curEnd) ? curEnd : plan[0] ? t(plan[0].start) : Math.max(now, t(cur.startedAt)) + 14 * 864e5;
    segs.push({ cls: 'tl-now', a: t(cur.startedAt), b: curTo, text: tl('{0}（開催中）', cur.label) });
    let prevEnd = curEnd;
    plan.forEach((x, i) => {
        const a = t(x.start);
        if (!Number.isNaN(prevEnd) && prevEnd < a)
            segs.push({ cls: 'tl-gap', a: prevEnd, b: a, text: tl('受付終了') });
        const b = !Number.isNaN(t(x.end)) ? t(x.end) : plan[i + 1] ? t(plan[i + 1].start) : a + 14 * 864e5;
        segs.push({ cls: 'tl-plan', a, b, text: tl('{0}（予約）', x.label) });
        prevEnd = t(x.end);
    });
    // 終了日時を過ぎて、次の予約がないとき（いまが受付終了）
    if (!plan.length && !Number.isNaN(curEnd) && curEnd < now)
        segs.push({ cls: 'tl-gap', a: curEnd, b: now + 3 * 864e5, text: tl('受付終了') });
    const lo0 = Math.min(now, ...segs.map((s) => s.a)), hi0 = Math.max(now, ...segs.map((s) => s.b));
    const pad = (hi0 - lo0) * 0.02 || 864e5;
    const lo = lo0 - pad, hi = hi0 + pad;
    const x = (v) => ((v - lo) / (hi - lo)) * 100;
    const day = (v) => new Date(v).toLocaleDateString(localeOf(), { month: 'numeric', day: 'numeric' });
    return h('div', { class: 'tl', role: 'img', 'aria-label': segs.map((s) => `${s.text}: ${day(s.a)}〜${day(s.b)}`).join(' / ') }, h('div', { class: 'tl-bar' }, ...segs.map((s) => h('div', { class: `tl-seg ${s.cls}`, style: { left: `${x(s.a)}%`, width: `${Math.max(0.5, x(s.b) - x(s.a))}%` }, title: `${s.text}（${fmt(new Date(s.a).toISOString())} 〜 ${fmt(new Date(s.b).toISOString())}）` }, s.text)), h('div', { class: 'tl-today', style: { left: `${x(now)}%` }, 'data-label': tl('いま') })), h('div', { class: 'tl-scale' }, ...[0, 1, 2, 3].map((i) => h('span', {}, day(lo + ((hi - lo) * i) / 3)))), h('div', { class: 'tl-legend' }, h('span', {}, h('i', { class: 'tl-now' }), tl('開催中')), h('span', {}, h('i', { class: 'tl-gap' }), tl('受付終了（出発できない）')), h('span', {}, h('i', { class: 'tl-plan' }), tl('予約'))));
}
// ===== AI と費用タブ: 今月の利用料と予算・採点に使う AI =====
function aiTab(d, reload) {
    const { s, u } = d;
    const real = realSubmissions(d);
    const inp = (value, attrs = {}) => h('input', { value: String(value), ...attrs });
    const P = [
        ['anthropic', tl('Claude（Anthropic）'), tl('Claude の API キーで採点する')],
        ['azure', tl('Azure OpenAI（AOAI）'), tl('社内の Azure を使うとき')],
        ['mock', tl('モック'), tl('費用なし・点数は目安')],
    ];
    const radios = P.map(([p, name, sub]) => {
        const r = h('input', { type: 'radio', name: 'provider', value: p, checked: s.provider === p, class: 'sr-only' });
        r.onchange = () => sync();
        return { p, r, el: h('label', { class: 'choice' }, r, h('b', {}, name), h('span', {}, sub)) };
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
    const aBox = h('div', { class: 'grid2' }, field(tl('モデル'), aModel, tl('例: claude-haiku-5-5（安くて速い）')), field(tl('APIキー'), aKey));
    const zBox = h('div', { class: 'grid2' }, field(tl('エンドポイント'), zEnd), field(tl('デプロイ名'), zDep, tl('Azure ポータルで作ったデプロイの名前。関数呼び出し（ツール）に対応したモデルを選んでください')), field(tl('API バージョン'), zVer, tl('例: 2024-10-21。新しい v1 API を使うときは v1')), field(tl('APIキー'), zKey));
    const est = () => {
        // 実測（Claude Haiku 4.5）: 送り出し1回で入力 約10万〜20万トークン・出力 約5千〜1万トークン（31問・道具と巻物をよく使う構成ほど多い）
        const run = (inT, outT) => (inT * Number(pIn.value) + outT * Number(pOut.value)) / 1e6;
        const lo = run(40_000, 3_000), hi = run(200_000, 11_000);
        const y = (v) => Math.max(1, Math.round(v * 150));
        estEl.textContent = tl(`この料金での1キャラあたりの目安: 出発1回 約{0}〜{1}円（\${2}〜\${3}）。ひっかけを複数回動かす設定にすると、その分増えます。`, y(lo), y(hi), lo.toFixed(3), hi.toFixed(3));
    };
    const sync = () => {
        const p = radios.find((x) => x.r.checked)?.p ?? 'mock';
        radios.forEach((x) => x.el.classList.toggle('on', x.p === p));
        aBox.hidden = p !== 'anthropic';
        zBox.hidden = p !== 'azure';
        est();
    };
    [pIn, pOut].forEach((x) => { x.oninput = est; });
    // 予算と AI の設定は、まとめて1つの設定として保存する（どちらの保存ボタンでも、両方の欄の値を送る）
    const saveWith = (btn) => async () => {
        btn.disabled = true;
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
            btn.disabled = false;
        }
    };
    const save = h('button', { class: 'btn btn-primary' }, tl('保存して切り替える'));
    save.onclick = saveWith(save);
    const saveBudget = h('button', { class: 'btn btn-small' }, tl('予算を保存'));
    saveBudget.onclick = saveWith(saveBudget);
    const testOut = h('div', { class: 'small', 'aria-live': 'polite' });
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
    const pct = Math.min(100, (u.spentUsd / Math.max(0.0001, u.budgetUsd)) * 100);
    const cost = card(tl('今月の利用料と予算'), h('div', { class: 'meter meter-big' }, h('div', { class: 'meter-fill' + (pct >= 100 ? ' over' : ''), style: { width: `${pct}%` } }), h('div', { class: 'meter-text' }, tl(`{0}　\${1} / \${2}（{3}）`, u.month, u.spentUsd.toFixed(2), u.budgetUsd, yen(u.spentUsd)))), h('div', { class: 'grid2' }, h('div', {}, field(tl('月の予算（USD）'), budget, tl('超えると出発と採点を止めます')), saveBudget), h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('1回あたりの実費')), h('span', { class: 'big-num' }, real ? tl('\${0}（{1}）', (u.spentUsd / real).toFixed(3), yen(u.spentUsd / real)) : '—'), h('span', { class: 'field-note' }, tl('出発 {0}回の平均', real)))));
    const ai = card(tl('採点に使う AI'), s.problems.length ? h('p', { class: 'notice warn small' }, tl(`いまは設定が足りないため、モックで動いています: {0}`, s.problems.join(' / '))) : null, h('p', { class: 'small muted' }, tl(`いま動いている採点: {0}`, s.active)), h('div', { class: 'choices', role: 'radiogroup', 'aria-label': tl('採点に使う AI') }, ...radios.map((x) => x.el)), aBox, zBox, h('datalist', { id: 'claude-models' }, ...['claude-haiku-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-opus-5-5'].map((m) => h('option', { value: m }))), h('datalist', { id: 'azure-models' }, ...['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'gpt-5-mini'].map((m) => h('option', { value: m }))), h('div', { class: 'row-gap' }, test), testOut, h('details', { class: 'fold' }, h('summary', {}, tl('料金（USD / 100万トークン）')), h('p', { class: 'small muted' }, tl('利用料の計算と予算の上限に使います。選んだモデルの最新の料金表に合わせてください。')), h('div', { class: 'grid4' }, field(tl('入力'), pIn), field(tl('出力'), pOut), field(tl('キャッシュ読み込み'), pCr), field(tl('キャッシュ書き込み'), pCw)), estEl), h('details', { class: 'fold' }, h('summary', {}, tl('採点の回数と、先輩のアドバイス')), h('div', { class: 'grid2' }, field(tl('1問を動かす回数'), runs, tl('ふつうは1')), field(tl('ひっかけを動かす回数'), trap, tl('安定性を見るとき2〜3')), field(tl('先輩の詳しいアドバイス（1人1日）'), cr, tl('AI が準備を読んで、場面ごとの備えを伝えます。1回 約1〜3円。0 で止めます（モックのときは使えません）')))), h('div', { class: 'row-gap' }, save));
    sync();
    return [h('div', { class: 'cols' }, h('div', {}, cost), h('div', {}, ai))];
}
// ===== 参加者とデータタブ: 参加者の一覧と、危ない操作（赤い枠） =====
function peopleTab(d, reload) {
    const p = d.people, u = d.u;
    const real = realSubmissions(d);
    // 全員の出発を消すと、見本の参加者の出発も消える（消える件数は u.submissions）
    const goneSubs = [tl('全員の出発と採点結果（{0} 件）', real), ...(p.samples ? [tl('見本の参加者の出発（{0} 件）', p.samples)] : [])];
    const fmtAt = (iso) => (iso ? fmtLong(iso) : '—');
    const entrants = p.users.filter((x) => x.entered).length;
    const departed = p.users.filter((x) => x.submissions > 0).length;
    const data = (body) => async () => {
        const r = await post('api/admin/data', body);
        toast(tl('消しました（出発 {0} 件）。消す前の中身は、サーバーの backups フォルダに {1} として残しました。', r.removed, r.backup));
        reload();
    };
    const backupNote = tl('消す前の中身は、サーバーの DATA_DIR/backups/ に自動で残ります。');
    const rows = p.users.map((x) => {
        const sum = x.entered ? tl('出発 {0}・戦果 {1}・{2}', x.submissions, x.accuracy === null ? '—' : x.accuracy, fmtAt(x.lastAt)) : tl('未エントリー');
        const tr = h('tr', {}, h('td', {}, h('b', { class: 'name-text' }, x.name), x.team ? h('div', { class: 'small muted' }, x.team) : null, h('div', { class: 'small muted sp-only' }, sum)), h('td', { class: 'pc-only' }, x.entered ? tl('エントリー済み') : h('span', { class: 'muted' }, tl('未エントリー'))), h('td', { class: 'num pc-only' }, x.submissions), h('td', { class: 'num pc-only' }, x.accuracy === null ? '—' : `${x.accuracy}`), h('td', { class: 'small pc-only' }, fmtAt(x.lastAt)));
        const del = dangerButton(tl('消す'), () => ({
            q: tl('「{0}」を消しますか？', x.name),
            gone: [tl('「{0}」の登録・エントリー・出発（{1} 件）', x.name, x.submissions)],
            keep: [tl('ほかの人のデータ'), tl('今月の利用料の記録')],
            note: backupNote, go: tl('「{0}」を消す', x.name), run: data({ action: 'remove-user', name: x.name }),
        }), (box) => { const r = h('tr', { class: 'confirm-row' }, h('td', { colspan: 6 }, box)); tr.after(r); return r; }, true);
        tr.append(h('td', { class: 'act' }, del));
        return tr;
    });
    const people = card(h('div', { class: 'head-row' }, h('h3', {}, tl('登録した人（{0}人）', p.users.length)), h('a', { class: 'btn btn-small', href: 'api/admin/backup', download: '' }, tl('いまのデータを保存（ダウンロード）'))), p.users.length ? h('p', { class: 'small muted' }, tl('エントリーした人 {0}人・出発させた人 {1}人', entrants, departed)) : null, p.users.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table stack people-table' }, h('thead', {}, h('tr', {}, ...[tl('参加者'), tl('エントリー'), tl('出発'), tl('最新の戦果'), tl('最後の出発'), ''].map((x, i) => h('th', { class: i === 2 || i === 3 ? 'num' : '' }, x)))), h('tbody', {}, ...rows))) : h('p', { class: 'small muted' }, tl('まだ参加者はいません。')), p.samples ? h('p', { class: 'small muted' }, tl('見本の参加者の出発: {0} 件（「全員の出発を消す」で消えます）', p.samples)) : null, h('p', { class: 'small muted' }, tl('ダウンロードしたファイルには、全員の心得・持ち物と、合言葉の照合用の値が入っています。ほかの人に渡さないでください。')));
    const dangerRow = (title, desc, op) => {
        const slot = h('div', { class: 'confirm-slot' });
        const row = h('div', { class: 'danger-row' }, h('div', {}, h('b', {}, title), h('p', { class: 'small muted' }, desc)), dangerButton(title, op, (box) => { slot.replaceChildren(box); return box; }), slot);
        return row;
    };
    const zone = h('section', { class: 'card admin-settings danger-zone' }, h('h3', {}, tl('危ない操作')), h('p', { class: 'small muted' }, backupNote), h('details', { class: 'fold' }, h('summary', { class: 'small' }, tl('元に戻すには')), h('p', { class: 'small muted' }, tl('そのファイルを DATA_DIR/db.json にコピーして、サーバーを起動し直してください。'))), dangerRow(tl('全員の出発を消す（登録は残す）'), tl('練習のあと、本番の前に。登録とエントリーは残ります。'), () => ({
        q: tl('全員の出発 {0} 件を消しますか？', u.submissions),
        gone: [...goneSubs, tl('いまのシーズンの順位')],
        keep: [tl('登録とエントリー（{0}人）', entrants), tl('今月の利用料の記録'), tl('シーズンの記録')],
        note: backupNote, go: tl('出発 {0} 件を消す', u.submissions), run: data({ action: 'clear-submissions' }),
    })), dangerRow(tl('すべて消して、はじめからにする'), tl('別の大会に使い回すときに。'), () => ({
        q: tl('すべて消して、はじめからにしますか？'),
        gone: [tl('登録とエントリー（{0}人）', p.users.length), ...goneSubs],
        keep: [tl('今月の利用料の記録'), tl('シーズンの記録'), tl('AI と名前のチェックの設定')],
        note: backupNote, go: tl('{0}人と出発 {1} 件を消す', p.users.length, u.submissions), run: data({ action: 'reset-all' }),
    })));
    return [people, zone];
}
// ===== 名前とことばタブ: 確認待ち・通報・判定の記録と、調べ方の設定 =====
function namesTab(d, reload) {
    const nm = d.nm, c = nm.settings;
    const MODES = [
        ['off', tl('調べない'), tl('見えない文字だけは止める')],
        ['basic', tl('決まりだけ'), tl('文字の種類・禁止語・予約語')],
        ['ai', tl('決まり＋AI の判定'), tl('おすすめ')],
        ['approval', tl('承認制'), tl('新しい言葉は、運営が承認するまで伏せる')],
    ];
    const modeR = MODES.map(([m, name, sub]) => {
        const r = h('input', { type: 'radio', name: 'name-mode', value: m, checked: c.mode === m, class: 'sr-only' });
        const el = h('label', { class: 'choice' + (c.mode === m ? ' on' : '') }, r, h('b', {}, name), h('span', {}, sub));
        r.onchange = () => modeR.forEach((x) => x.el.classList.toggle('on', x.r.checked));
        return { m, r, el };
    });
    const ng = h('select', {}, h('option', { value: 'reject', selected: c.ngAction === 'reject' }, tl('出発を止めて、直してもらう')), h('option', { value: 'hold', selected: c.ngAction === 'hold' }, tl('出発は受け付けて、ほかの人には伏せる')));
    const area = (xs, rows = 4) => { const t = h('textarea', { rows, spellcheck: 'false' }); t.value = xs.join('\n'); return t; };
    const blocked = area(c.blocked), reserved = area(c.reserved), allowed = area(c.allowed, 3);
    const rep = h('input', { type: 'checkbox', checked: c.reports });
    const holdAt = h('input', { type: 'number', min: 1, max: 50, value: String(c.reportHoldAt) });
    const save = h('button', { class: 'btn btn-primary' }, tl('保存する'));
    const send = async (body, done) => {
        save.disabled = true;
        try {
            await post('api/admin/names/settings', body);
            toast(done);
            reload();
        }
        catch (e) {
            save.disabled = false;
            throw e;
        }
    };
    save.onclick = () => send({ mode: modeR.find((x) => x.r.checked)?.m, ngAction: ng.value, blocked: blocked.value, reserved: reserved.value, allowed: allowed.value, reports: rep.checked, reportHoldAt: holdAt.value }, tl('保存しました。いま討伐に出ている言葉にも、すぐに効きます'))
        .catch((e) => toast(e.message, 'err'));
    const resetSlot = h('div', { class: 'confirm-slot' });
    const resetLists = dangerButton(tl('言葉の一覧を、はじめのものに戻す'), () => ({
        q: tl('禁止語・予約語・許可語を、はじめの一覧に戻しますか？'), go: tl('はじめの一覧に戻す'),
        run: () => send({ reset: true }, tl('はじめの一覧に戻しました')),
    }), (box) => { resetSlot.replaceChildren(box); return box; }, true);
    // ためしに調べる
    const tText = h('input', { placeholder: tl('調べたい言葉'), 'aria-label': tl('調べたい言葉'), maxlength: 150 });
    const tKind = h('select', { 'aria-label': tl('種類') }, ...NAME_KINDS.map((k) => h('option', { value: k, selected: k === 'hero' }, NAME_KIND_LABELS[k])));
    const tOut = h('div', { class: 'small', 'aria-live': 'polite' });
    const tryIt = (ai) => async () => {
        tOut.textContent = tl('確認中…');
        try {
            const j = await post('api/admin/names/test', { text: tText.value, kind: tKind.value, ai });
            const parts = [j.rule ? tl('決まり: {0}', j.rule) : tl('決まり: 問題なし')];
            if (ai)
                parts.push(!j.aiAvailable ? tl('AI: いまは使えません') : j.ai ? tl('AI: {0}{1}', VERDICT[j.ai.verdict], j.ai.reason ? `（${j.ai.reason}）` : '') : tl('AI: 答えを読めませんでした'));
            tOut.textContent = parts.join(' / ');
        }
        catch (e) {
            tOut.textContent = tl(`失敗: {0}`, e.message);
        }
    };
    // 決める
    const decide = (kind, text, action) => async () => {
        try {
            await post('api/admin/names/decide', { kind, text, action });
            reload();
        }
        catch (e) {
            toast(e.message, 'err');
        }
    };
    const btns = (kind, text, status, by) => h('div', { class: 'row-gap act-btns' }, status !== 'ok' || by !== 'admin' ? h('button', { class: 'btn btn-small btn-primary', onclick: decide(kind, text, 'ok') }, tl('見せる')) : null, status !== 'ng' || by !== 'admin' ? h('button', { class: 'btn btn-small btn-danger', onclick: decide(kind, text, 'ng') }, tl('伏せる')) : null, by ? h('button', { class: 'btn btn-small', onclick: decide(kind, text, 'reset') }, tl('判定をやり直す')) : null);
    const why = (x) => [BY[x.by] ?? x.by, x.reason].filter(Boolean).join(tl('・'));
    const table = (head, rows) => h('div', { class: 'table-wrap' }, h('table', { class: 'table stack names-table' }, h('thead', {}, h('tr', {}, ...head.map((x) => h('th', {}, x)))), h('tbody', {}, ...rows)));
    const cell = (kind, text) => h('td', {}, h('div', { class: 'small muted' }, NAME_KIND_LABELS[kind]), h('b', { class: 'name-text' }, text));
    const waiting = nm.items.filter((x) => x.status === 'review');
    const waitRows = [
        ...waiting.map((x) => h('tr', {}, cell(x.kind, x.text), h('td', { class: 'small' }, why(x)), h('td', { class: 'small' }, x.owners.join(', ')), h('td', { class: 'act' }, btns(x.kind, x.text, x.status, x.by)))),
        ...nm.live.map((x) => h('tr', {}, cell(x.kind, x.text), h('td', { class: 'small' }, x.why === 'rule' ? tl('決まりで伏せている（{0}）', x.rule ?? '') : tl('まだ確認していない')), h('td', { class: 'small' }, x.owners.join(', ')), h('td', { class: 'act' }, btns(x.kind, x.text)))),
    ];
    const repRows = nm.reports.map((r) => {
        const okAll = h('button', { class: 'btn btn-small' }, tl('問題なし（通報を消す）'));
        okAll.onclick = async () => { try {
            await post('api/admin/names/dismiss', { id: r.id });
            reload();
        }
        catch (e) {
            toast(e.message, 'err');
        } };
        // 言葉ごとに決める（チーム名はほかの人も使っているので、伏せるとそのチームの全員に効く）
        const parts = [['player', r.owner], ['hero', r.name], ['team', r.team], ['motto', r.kodawari]].filter(([k, t]) => t.trim() && (k !== 'player' || nm.withPlayer));
        return h('tr', {}, h('td', {}, ...parts.map(([k, t]) => h('div', { class: 'row-between rep-part' }, h('span', {}, h('span', { class: 'small muted' }, NAME_KIND_LABELS[k], ' '), h('b', { class: 'name-text' }, t)), btns(k, t.trim())))), h('td', { class: 'num' }, tl('{0}人', r.count)), h('td', { class: 'small' }, fmtLong(r.at)), h('td', { class: 'act' }, okAll));
    });
    const decided = nm.items.filter((x) => x.status !== 'review');
    const queue = card(tl('確認待ちの言葉（{0}）', waitRows.length), waitRows.length ? table([tl('言葉'), tl('理由'), tl('使った人'), ''], waitRows) : h('p', { class: 'small muted' }, tl('確認待ちの言葉はありません。')), nm.reports.length ? h('h4', {}, tl('通報（{0}）', nm.reports.length)) : null, nm.reports.length ? h('p', { class: 'small muted' }, tl('チーム名を伏せると、そのチームの全員に効きます。')) : null, nm.reports.length ? table([tl('冒険者'), tl('人数'), tl('最後の通報'), ''], repRows) : null, decided.length ? h('details', { class: 'fold' }, h('summary', {}, tl('判定の記録（{0}）', decided.length)), table([tl('言葉'), tl('判定'), tl('理由'), tl('使った人'), ''], decided.map((x) => h('tr', {}, cell(x.kind, x.text), h('td', {}, h('span', { class: `chip name-${x.status}` }, STATUS[x.status])), h('td', { class: 'small' }, why(x)), h('td', { class: 'small' }, x.owners.join(', ')), h('td', { class: 'act' }, btns(x.kind, x.text, x.status, x.by)))))) : null);
    const how = card(tl('名前とことばの調べ方'), h('p', { class: 'small muted' }, tl('ほかの人の画面に出る言葉（表示名・冒険者の名前・チーム名・こだわり）を調べます。伏せた言葉は、本人にはそのまま見え、ほかの人には「名もなき冒険者」などで出ます。')), !nm.withPlayer ? h('p', { class: 'small muted' }, tl('SSO でログインしているので、表示名は調べません。')) : null, h('div', { class: 'choices', role: 'radiogroup', 'aria-label': tl('名前とことばの調べ方') }, ...modeR.map((x) => x.el)), (c.mode === 'ai' || c.mode === 'approval') && !nm.aiAvailable ? h('p', { class: 'notice small' }, tl('いまは AI に聞けないため（模擬採点か、予算に達した）、決まりだけで調べています。')) : null, h('div', { class: 'grid2' }, field(tl('AI が「出せない」と判定したとき'), ng, tl('AI が迷ったときは、出発は受け付けて、運営が確認するまで伏せます')), h('div', {}, h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('通報')), h('label', { class: 'chk' }, rep, tl('通報ボタンを出す（最後の手段。ふだんはオフ）'))), field(tl('伏せる人数'), holdAt, tl('この人数から通報されたら、運営が見るまで伏せます')))), h('details', { class: 'fold' }, h('summary', {}, tl('言葉の一覧（禁止語 {0}・予約語 {1}・許可語 {2}）', c.blocked.length, c.reserved.length, c.allowed.length)), h('div', { class: 'grid2' }, field(tl('禁止語'), blocked, tl('1行に1つ。英字の言葉は単語の中から、ほかの文字は記号や空白を飛ばして探します。「=」で始めると、言葉全体が同じときだけ当たります')), field(tl('予約語（名前にだけ効く）'), reserved, tl('運営・公式を名乗れないようにする言葉。英字の言葉は単語の頭から探します')), field(tl('許可語'), allowed, tl('禁止語・予約語に誤って当たる言葉（例: Scunthorpe）。名前全体を書くと、その名前は通ります'))), h('div', { class: 'row-gap' }, resetLists), resetSlot), h('div', { class: 'row-gap save-row' }, save), h('h4', {}, tl('ためしに調べる')), h('div', { class: 'row-gap try-row' }, tText, tKind, h('button', { class: 'btn btn-small', onclick: tryIt(false) }, tl('決まりで調べる')), h('button', { class: 'btn btn-small', onclick: tryIt(true) }, tl('AI にも聞く（1回 0.1円ほど）'))), tOut);
    return [queue, how];
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
const VERDICT = { get ok() { return tl('問題なし'); }, get ng() { return tl('出せない'); }, get review() { return tl('迷う'); } };
const STATUS = { get ok() { return tl('見せる'); }, get ng() { return tl('伏せる'); }, get review() { return tl('確認待ち'); } };
const BY = { get ai() { return 'AI'; }, get admin() { return tl('運営'); }, get error() { return tl('AI に聞けなかった'); }, get report() { return tl('通報'); }, get approval() { return tl('承認制'); } };
//# sourceMappingURL=admin.js.map