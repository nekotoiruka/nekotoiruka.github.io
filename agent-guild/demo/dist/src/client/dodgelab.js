// 回避モーションの見本帳（運営・開発用）: 紹介ページ「見切りと反撃」の窓で見せる身のこなしの型を選ぶ。
// 候補は見本の討伐から、型ごとに1つずつ（dodgepicks.ts の dodgeCands）。紹介ページと同じ区間・カメラ（1人に寄る）・速さで再生する。
// scripts/build-dodgelab.mjs が 1ファイルの HTML にまとめる。討伐データは window.__LAB_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
import { ArenaRenderer } from './arena.js';
import { scriptFor } from './api.js';
import { DODGE_PICKS, dodgeCands, dodgeOrder } from './dodgepicks.js';
import { WEAPON_LABELS } from '../shared/catalog.js';
const SCENE_JA = { breath: 'ブレス', claw: '爪・突進', dive: '急降下', tail: '尾' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = window.__LAB_DATA__;
const first = scriptFor(data);
const script = scriptFor(data, [first.fighters[0].id]);
const cands = dodgeCands(script);
const auto = dodgeOrder(cands, DODGE_PICKS);
function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, v);
    for (const k of kids)
        if (k !== null)
            e.append(k);
    return e;
}
const cv = el('canvas', { width: '768', height: '432' });
const r = new ArenaRenderer(cv, script);
r.muted = true;
r.mine = new Set();
const aim = (c) => { r.camOverride = { mode: 'follow', f: c.f }; r.solo = c.f; };
const STORE = 'dodgelab-v1';
let order = [];
try {
    order = JSON.parse(localStorage.getItem(STORE) ?? 'null') ?? auto.map((c) => c.pattern);
}
catch {
    order = auto.map((c) => c.pattern);
}
const save = () => { try {
    localStorage.setItem(STORE, JSON.stringify(order));
}
catch { /* 残せなくても使える */ } };
const app = document.getElementById('app');
app.append(el('header', {}, el('h1', {}, '回避モーションの見本帳'), el('p', { class: 'lead' }, `紹介ページ「見切りと反撃」の窓で見せる身のこなしを選びます。見本の討伐の中から、型ごとに1つずつ（${cands.length}種類）並べました。紹介ページと同じく、1人に寄って、予兆の終わりから反撃に移る直前までを再生します（反撃は隣の「武器ごとの技」の窓で見せるため）。見せたい型を押して選ぶと、選んだ順に番号がつき、その順でつないで流します。いまは、ちがう型・ちがう武器が並ぶように自動で選んだ${auto.length}つに番号がついています。`)));
// ---- 大きな画面: 選んだ順につないで流す（1枚を押したら、その1枚だけをくり返す） ----
const title = el('h2', {});
const sub = el('p', { class: 'fit' });
const mode = el('div', { class: 'seg' });
const pause = el('button', { class: 'btn' }, '一時停止');
const speed = el('div', { class: 'seg' });
const st = { list: [], i: 0, t: 0, paused: false, speed: 1, one: null };
for (const sp of [1, 0.5]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : '1/2');
    b.onclick = () => { st.speed = sp; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speed.append(b);
}
pause.onclick = () => { st.paused = !st.paused; pause.textContent = st.paused ? '再生' : '一時停止'; };
const reelBtn = el('button', { class: 'on' }, '選んだ順につなぐ');
const enter = (k) => {
    st.i = k;
    const c = st.list[k];
    if (!c)
        return;
    aim(c);
    st.t = c.w + c.from;
    r.frame = 0;
    title.textContent = st.one ? `1つだけ: ${c.name}` : `つないで再生（${k + 1} / ${st.list.length}）: ${c.name}`;
    sub.textContent = `${SCENE_JA[c.scene] ?? c.scene}「${script.cases[script.waves[c.w].caseIndex]?.title ?? ''}」 ／ ${WEAPON_LABELS[c.weapon]}（型: ${c.pattern}）`;
};
const playReel = () => { st.one = null; st.list = order.map((id) => cands.find((c) => c.pattern === id)).filter((c) => !!c); reelBtn.classList.add('on'); enter(0); if (!st.list.length) {
    title.textContent = 'まだ選んでいません';
    sub.textContent = '';
} };
const playOne = (c) => { st.one = c; st.list = [c]; reelBtn.classList.remove('on'); enter(0); };
reelBtn.onclick = playReel;
mode.append(reelBtn);
app.append(el('section', { class: 'card wide stage player' }, el('div', { class: 'body' }, title, sub, el('div', { class: 'row' }, mode, pause, speed)), cv));
// ---- 候補のカード ----
const summary = el('textarea', { rows: '4', readonly: '', 'aria-label': '選んだ型' });
const cards = [];
const paint = () => {
    for (const x of cards) {
        const k = order.indexOf(x.c.pattern);
        x.num.textContent = k >= 0 ? String(k + 1) : '';
        x.el.classList.toggle('picked', k >= 0);
    }
    summary.value = `見切りの窓で見せる型（この順）: ${order.length ? order.join(', ') : '（なし）'}\n${order.map((id, k) => { const c = cands.find((x) => x.pattern === id); return c ? `${k + 1}. ${c.name}（${SCENE_JA[c.scene]}・${WEAPON_LABELS[c.weapon]}）` : ''; }).join('\n')}`;
};
const grid = el('div', { class: 'grid' });
for (const c of cands) {
    const cvs = el('canvas', { width: '768', height: '432', role: 'img', 'aria-label': `${c.name}の4コマ` });
    const num = el('span', { class: 'num' });
    const toggle = el('button', { class: 'btn mark' }, '選ぶ ／ 外す');
    toggle.onclick = (e) => { e.stopPropagation(); const k = order.indexOf(c.pattern); if (k >= 0)
        order.splice(k, 1);
    else
        order.push(c.pattern); save(); paint(); if (!st.one)
        playReel(); };
    const card = el('article', { class: 'card pick', tabindex: '0' }, el('div', { class: 'thumb' }, cvs, num), el('div', { class: 'body' }, el('h3', {}, c.name), el('p', { class: 'fit' }, `${SCENE_JA[c.scene]} ／ ${WEAPON_LABELS[c.weapon]}`), toggle));
    card.onclick = () => { playOne(c); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    card.onkeydown = (e) => { if (e.key === 'Enter')
        card.click(); };
    cards.push({ el: card, c, num, cvs });
    grid.append(card);
}
const copy = el('button', { class: 'btn primary' }, '選んだ型をコピー');
copy.onclick = async () => { try {
    await navigator.clipboard.writeText(summary.value);
    copy.textContent = 'コピーしました';
}
catch {
    summary.select();
    copy.textContent = '選んだので、手でコピーしてください';
} setTimeout(() => { copy.textContent = '選んだ型をコピー'; }, 1800); };
const reset = el('button', { class: 'btn' }, '自動の選び方に戻す');
reset.onclick = () => { order = auto.map((c) => c.pattern); save(); paint(); playReel(); };
const none = el('button', { class: 'btn' }, '全部外す');
none.onclick = () => { order = []; save(); paint(); playReel(); };
app.append(el('h2', { class: 'sec' }, `候補（${cands.length}種類）`), grid, el('section', { class: 'card wide' }, el('div', { class: 'body' }, el('h2', {}, '選んだ型'), summary, el('div', { class: 'row' }, copy, reset, none), el('p', { class: 'lead' }, 'この内容をチャットに貼ってください。紹介ページの窓は、この順でつないで流すようにします（6つ前後がおすすめ。多いと1周が長くなります）。'))));
paint();
// ---- 4コマ（かわす前・かわす瞬間・かわし終わり・反撃の直前） ----
let q = 0;
const thumbStep = () => {
    const c = cards[q++];
    const keep = { cam: r.camOverride, solo: r.solo, frame: r.frame };
    aim(c.c);
    const ctx = c.cvs.getContext('2d');
    const ts = [0, 1, 2, 3].map((j) => c.c.from + ((c.c.to - c.c.from) * (j + 0.5)) / 4);
    ts.forEach((ph, j) => { r.frame = 0; r.draw(c.c.w + ph); /* frame 0 = カメラを寄せきる */ /* frame 0 = カメラを寄せきる */ ctx.drawImage(cv, (j % 2) * 384, Math.floor(j / 2) * 216, 384, 216); });
    ctx.fillStyle = '#F4F1E8';
    ctx.fillRect(383, 0, 2, 432);
    ctx.fillRect(0, 215, 768, 2);
    r.camOverride = keep.cam;
    r.solo = keep.solo;
    r.frame = keep.frame;
    if (q < cards.length)
        setTimeout(thumbStep, 0);
};
// ---- 再生（紹介ページと同じ: 秒あたりの場面の長さ 3.4秒、かわす瞬間だけ少しゆっくり） ----
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const c = st.list[st.i];
    if (c && !st.paused) {
        const ph = st.t - c.w;
        const k = ph >= c.slow[0] && ph < c.slow[1] ? c.slow[2] : 1;
        st.t += ((dt * k * st.speed) / 3.4) * r.slowFactor(st.t);
        if (st.t >= c.w + c.to)
            enter((st.i + 1) % st.list.length);
        r.frame++;
    }
    if (c)
        r.draw(st.t);
    requestAnimationFrame(frame);
}
playReel();
setTimeout(thumbStep, 50);
requestAnimationFrame(frame);
window.ready = () => q >= cards.length;
window.cands = cands.map((c) => ({ id: c.pattern, w: c.w, from: c.from, to: c.to }));
//# sourceMappingURL=dodgelab.js.map