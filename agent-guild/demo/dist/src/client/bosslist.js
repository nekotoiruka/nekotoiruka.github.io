// ボスの攻撃モーションの一覧（運営・開発用）: 7種類のボスの攻撃（ブレス・爪・急降下・尾・大技）を全部並べ、リメイクする攻撃を選ぶ。
// 討伐データは紹介ページと同じ吸血鬼伯爵の見本（window.__LAB_DATA__）を使い、ボスの種類だけを差し替えて描く。
// そのため、背景・ボスの名前・体力ゲージの名前は伯爵のまま（見るのはボスの動きだけ）。
// scripts/build-bosslist.mjs が 1ファイルの HTML にまとめる。画面の作りは必殺技の一覧（ultlist.ts）と同じ。
import { ArenaRenderer } from './arena.js';
import { scriptFor } from './api.js';
import { BOSS_LIST, PAIRS, SPELL_NAME } from './motionlab.js';
const SCENES = ['breath', 'claw', 'dive', 'tail', 'spell'];
const SECONDS_PER_WAVE = 3.4;
const T0 = 0.0, T1 = 0.86;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = window.__LAB_DATA__;
const base = scriptFor(data);
const waveOf = (sc) => base.waves.findIndex((wv) => base.cases[wv.caseIndex]?.scene === sc);
const items = [];
for (const b of BOSS_LIST)
    for (const sc of SCENES) {
        const w = waveOf(sc);
        if (w < 0)
            continue;
        const pr = sc === 'spell' ? null : PAIRS[b.kind]?.[sc];
        items.push({ kind: b.kind, boss: b.name, scene: sc, w, label: pr ? pr[0] : `${SPELL_NAME[b.kind] ?? '大技'}（呪文の場面）`, resp: pr ? `冒険者の対応: ${pr[1]}` : '冒険者は呪文を打ち消す' });
    }
const keyOf = (it) => `${it.kind}-${it.scene}`;
function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, v);
    for (const k of kids)
        if (k !== null)
            e.append(k);
    return e;
}
// ボスの種類ごとに1枚ずつ描く板（ボスの絵は作るときに決まるため）。見せる画面へは写して出す
const boards = new Map();
const boardOf = (kind) => {
    let r = boards.get(kind);
    if (!r) {
        const s = scriptFor(data);
        s.theme = { ...(s.theme ?? {}), kind };
        r = new ArenaRenderer(document.createElement('canvas'), s);
        r.muted = true;
        r.mine = new Set();
        r.camOverride = { mode: 'wide' };
        boards.set(kind, r);
    }
    return r;
};
// ---- 選んだもの（このブラウザにだけ残す） ----
const STORE = 'bosslist-picks-v1', SEEN = 'bosslist-seen-v1';
let picks = {};
let seen = new Set();
try {
    picks = JSON.parse(localStorage.getItem(STORE) ?? '{}');
    seen = new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]'));
}
catch {
    picks = {};
}
const save = () => { try {
    localStorage.setItem(STORE, JSON.stringify(picks));
    localStorage.setItem(SEEN, JSON.stringify([...seen]));
}
catch { /* 残せなくても使える */ } };
// ---- 画面 ----
const app = document.getElementById('app');
app.append(el('header', {}, el('h1', {}, 'ボスの攻撃モーションの一覧'), el('p', { class: 'lead' }, `7種類のボスの攻撃を、ボスごとに全部（${items.length}種類）並べました。1枚ごとに「予兆・溜め・攻撃・余韻」の4コマを並べ、押すと本番の速さで再生します（広い画面では右側、スマホでは重ねた窓）。見本の討伐は吸血鬼伯爵のものなので、背景・ボスの名前・ほかの演出は伯爵のままです。見るのはボスの動きだけにしてください。リメイクしたい攻撃は「リメイクする」を押し、気になるところをひとことで書いてください。いちばん下に、選んだ攻撃の一覧がまとまります。`)));
const cv = el('canvas', { width: '768', height: '432' });
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;
const title = el('h2', {});
const sub = el('p', { class: 'fit' });
const pause = el('button', { class: 'btn' }, '一時停止');
const prev = el('button', { class: 'btn' }, '← 前');
const next = el('button', { class: 'btn' }, '次 →');
const speed = el('div', { class: 'seg' });
const st = { i: 0, t: T0, paused: false, speed: 1 };
for (const sp of [1, 0.5, 0.25]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : sp === 0.5 ? '1/2' : '1/4');
    b.onclick = () => { st.speed = sp; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speed.append(b);
}
pause.onclick = () => { st.paused = !st.paused; pause.textContent = st.paused ? '再生' : '一時停止'; };
const shut = el('button', { class: 'btn side-close' }, '閉じる');
const side = el('aside', { class: 'side' }, el('section', { class: 'card stage' }, el('div', { class: 'body' }, title, sub, el('div', { class: 'row' }, prev, pause, next, speed)), cv, shut));
const list = el('div', { class: 'list' });
const progress = el('p', { class: 'progress' });
const unseenOnly = el('label', { class: 'fit' }, el('input', { type: 'checkbox' }), ' まだ見ていない攻撃だけ並べる');
const resetSeen = el('button', { class: 'btn' }, '「見た」を全部外す');
app.append(el('div', { class: 'toolbar' }, progress, unseenOnly, resetSeen), el('div', { class: 'layout' }, list, side));
const narrow = () => matchMedia('(max-width: 900px)').matches;
const openSide = () => { if (narrow()) {
    side.classList.add('open');
    document.body.classList.add('side-open');
} };
const closeSide = () => { side.classList.remove('open'); document.body.classList.remove('side-open'); };
shut.onclick = closeSide;
side.addEventListener('click', (e) => { if (e.target === side)
    closeSide(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape')
    closeSide(); });
const cards = [];
const play = (i, quiet = false) => {
    st.i = (i + items.length) % items.length;
    const it = items[st.i];
    st.t = T0;
    boardOf(it.kind).frame = 0;
    title.textContent = `${it.boss}：${it.label}`;
    sub.textContent = it.resp;
    cards.forEach((c, k) => c.classList.toggle('now', k === st.i));
    if (quiet)
        return;
    seen.add(keyOf(it));
    save();
    paintSeen();
    if (!narrow())
        cards[st.i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
prev.onclick = () => play(st.i - 1);
next.onclick = () => play(st.i + 1);
const summary = el('textarea', { rows: '8', readonly: '', 'aria-label': '選んだ攻撃の一覧' });
const count = el('span', { class: 'fit' });
const paintSummary = () => {
    const lines = items.filter((it) => picks[keyOf(it)]?.on).map((it) => `- ${it.boss}「${it.label}」${picks[keyOf(it)]?.note ? `: ${picks[keyOf(it)].note}` : ''}`);
    count.textContent = `${lines.length}種類を選んでいます`;
    summary.value = lines.length ? `リメイクするボスの攻撃:\n${lines.join('\n')}` : '（まだ選んでいません）';
};
function paintSeen() {
    const only = unseenOnly.querySelector('input').checked;
    items.forEach((it, k) => { const c = cards[k]; if (!c)
        return; const v = seen.has(keyOf(it)); c.classList.toggle('seen', v); c.hidden = only && v && k !== st.i; });
    list.querySelectorAll('section[data-boss]').forEach((sec) => { sec.hidden = ![...sec.querySelectorAll('article')].some((a) => !a.hidden); });
    progress.textContent = `見た ${items.filter((it) => seen.has(keyOf(it))).length} / ${items.length} ・ リメイクする ${items.filter((it) => picks[keyOf(it)]?.on).length}`;
}
const thumbs = [];
let grid = null, cur = '';
items.forEach((it, i) => {
    if (cur !== it.kind) {
        cur = it.kind;
        grid = el('div', { class: 'grid' });
        list.append(el('section', { 'data-boss': it.kind }, el('h2', { class: 'sec' }, it.boss), grid));
    }
    const k = keyOf(it);
    const c = el('canvas', { width: '768', height: '432', role: 'img', 'aria-label': `${it.boss}「${it.label}」の4コマ` });
    thumbs.push({ c, it });
    const on = el('button', { class: 'btn mark' }, 'リメイクする');
    const note = el('input', { type: 'text', placeholder: 'ひとこと（例: 予兆が分かりにくい・攻撃が軽い）', value: picks[k]?.note ?? '' });
    const card = el('article', { class: 'card pick', tabindex: '0' }, c, el('div', { class: 'body' }, el('div', { class: 'row between' }, el('h3', {}, it.label), el('span', { class: 'tag seen-tag' }, '見た')), el('p', { class: 'fit' }, it.resp), on, note));
    const paint = () => { const p = picks[k]; on.classList.toggle('on', !!p?.on); on.textContent = p?.on ? '✓ リメイクする' : 'リメイクする'; card.classList.toggle('picked', !!p?.on); };
    on.onclick = (e) => { e.stopPropagation(); picks[k] = { on: !picks[k]?.on, note: note.value }; save(); paint(); paintSummary(); paintSeen(); };
    note.onclick = (e) => e.stopPropagation();
    note.oninput = () => { picks[k] = { on: picks[k]?.on ?? true, note: note.value }; save(); paint(); paintSummary(); paintSeen(); };
    card.onclick = () => { play(i); openSide(); };
    card.onkeydown = (e) => { if (e.key === 'Enter')
        card.click(); };
    cards.push(card);
    grid.append(card);
    paint();
});
const copy = el('button', { class: 'btn primary' }, '一覧をコピー');
copy.onclick = async () => { try {
    await navigator.clipboard.writeText(summary.value);
    copy.textContent = 'コピーしました';
}
catch {
    summary.select();
    copy.textContent = '選んだので、手でコピーしてください';
} setTimeout(() => { copy.textContent = '一覧をコピー'; }, 1800); };
list.append(el('section', { class: 'card wide' }, el('div', { class: 'body' }, el('h2', {}, '選んだ攻撃'), count, summary, el('div', { class: 'row' }, copy), el('p', { class: 'lead' }, 'この一覧をチャットに貼ってください。選んだ内容は、このブラウザにだけ残ります。'))));
unseenOnly.querySelector('input').addEventListener('change', paintSeen);
resetSeen.onclick = () => { seen.clear(); save(); paintSeen(); };
paintSummary();
paintSeen();
// ---- 4コマ（予兆・溜め・攻撃・余韻）を少しずつ描いて写しとる ----
let q = 0;
const thumbStep = () => {
    const end = performance.now() + 14;
    while (q < thumbs.length && performance.now() < end) {
        const { c, it } = thumbs[q++];
        const r = boardOf(it.kind), keep = r.frame;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        [0.14, 0.3, 0.42, 0.62].forEach((ph, j) => { r.frame = 0; r.draw(it.w + ph); ctx.drawImage(r.canvas, (j % 2) * 384, Math.floor(j / 2) * 216, 384, 216); });
        ctx.fillStyle = '#F4F1E8';
        ctx.fillRect(383, 0, 2, 432);
        ctx.fillRect(0, 215, 768, 2);
        r.frame = keep;
    }
    if (q < thumbs.length)
        setTimeout(thumbStep, 0);
};
// ---- 再生 ----
let last = performance.now();
function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const it = items[st.i], r = boardOf(it.kind);
    if (!st.paused) {
        st.t += ((dt / SECONDS_PER_WAVE) * st.speed) * r.slowFactor(it.w + st.t);
        if (st.t >= T1) {
            st.t = T0;
            r.frame = 0;
        }
        r.frame++;
    }
    r.draw(it.w + st.t);
    cx.drawImage(r.canvas, 0, 0, cv.width, cv.height);
    requestAnimationFrame(loop);
}
play(0, true);
setTimeout(thumbStep, 50);
requestAnimationFrame(loop);
window.ready = () => q >= thumbs.length;
// 確かめ用（自動の画面写し）: ボスと場面と時刻を決めて、止めて1コマ描く
window.still = (kind, scene, ph) => {
    const i = items.findIndex((it) => it.kind === kind && it.scene === scene);
    if (i < 0)
        return;
    play(i, true);
    st.paused = true;
    st.t = ph;
    boardOf(items[i].kind).frame = 0;
};
//# sourceMappingURL=bosslist.js.map