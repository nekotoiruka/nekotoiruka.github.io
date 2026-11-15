// 回避モーションの見本帳（運営・開発用）: 紹介ページ「見切り」の窓で見せる身のこなしを選ぶ。
// 立ち位置を1つに決め（後列の下から2番目）、その冒険者の武器を差し替えて、ボスの攻撃（基本の4場面）× 武器 × 型を全部並べる。
// 1人に寄って、どの型も同じ秒数（山場の 0.14 前から 0.08 後まで、山場のまわりだけ 0.6 倍）で流す。
// scripts/build-dodgelab.mjs が 1ファイルの HTML にまとめる。討伐データは window.__LAB_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
import { ArenaRenderer } from './arena.js';
import { scriptFor } from './api.js';
import { applyLook, fixedFighter, weaponCands, windowAt } from './dodgepicks.js';
import { WEAPON_KINDS, WEAPON_LABELS } from '../shared/catalog.js';
const SCENE_JA = { breath: 'ブレス', claw: '爪・突進', dive: '急降下', tail: '尾' };
const BASE = ['breath', 'claw', 'dive', 'tail'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = window.__LAB_DATA__;
const script = scriptFor(data);
const F = fixedFighter(script);
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
const baseWeapon = r.looks[F].weapon;
const cands = weaponCands(script, WEAPON_KINDS);
const isCommon = (c) => c.key.endsWith(':common');
const aim = (c) => { applyLook(r, F, c.w, c.look, baseWeapon); r.camOverride = { mode: 'follow', f: F }; r.solo = F; };
const windowOf = (c) => { aim(c); return windowAt(r, c.w, F); };
const STORE = 'dodgelab-weapons-v1';
let order = [];
try {
    order = JSON.parse(localStorage.getItem(STORE) ?? '[]');
}
catch {
    order = [];
}
order = order.filter((k) => cands.some((c) => c.key === k));
const save = () => { try {
    localStorage.setItem(STORE, JSON.stringify(order));
}
catch { /* 残せなくても使える */ } };
const app = document.getElementById('app');
app.append(el('header', {}, el('h1', {}, '回避モーションの見本帳（武器ごと）'), el('p', { class: 'lead' }, `立ち位置を後列の下から2番目に決めて、ボスの攻撃（${BASE.map((s) => SCENE_JA[s]).join('・')}）ごとに、武器を全部（${WEAPON_KINDS.length}種類）持ちかえて、その武器の回避の型を全部並べました（${cands.length}通り）。1人に寄って、どの型も同じ秒数で流します。カードを押すと右の画面（スマホでは重ねた窓）で1つだけくり返し、「選ぶ ／ 外す」で選んだ順に番号がつき、その順につないで流します。`)));
const title = el('h2', {});
const sub = el('p', { class: 'fit' });
const pause = el('button', { class: 'btn' }, '一時停止');
const speed = el('div', { class: 'seg' });
const reelBtn = el('button', { class: 'btn' }, '選んだ順につなぐ');
const st = { list: [], i: 0, t: 0, paused: false, speed: 1, one: false, win: { from: 0, to: 0, slow: [0, 0, 1] } };
for (const sp of [1, 0.5]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : '1/2');
    b.onclick = () => { st.speed = sp; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speed.append(b);
}
pause.onclick = () => { st.paused = !st.paused; pause.textContent = st.paused ? '再生' : '一時停止'; };
const enter = (k) => {
    st.i = k;
    const c = st.list[k];
    if (!c) {
        title.textContent = 'まだ選んでいません';
        sub.textContent = '';
        return;
    }
    st.win = windowOf(c);
    st.t = c.w + st.win.from;
    r.frame = 0;
    title.textContent = `${st.one ? '1つだけ' : `つないで再生（${k + 1} / ${st.list.length}）`}: ${c.name}`;
    sub.textContent = `${SCENE_JA[c.scene]}「${c.title}」 ／ ${!isCommon(c) ? WEAPON_LABELS[c.weapon] : '武器によらない'}`;
};
const playReel = () => { st.one = false; st.list = order.map((k) => cands.find((c) => c.key === k)).filter((c) => !!c); enter(0); };
const playOne = (c) => { st.one = true; st.list = [c]; enter(0); };
reelBtn.onclick = playReel;
const shut = el('button', { class: 'btn side-close' }, '閉じる');
const side = el('aside', { class: 'side' }, el('section', { class: 'card stage' }, el('div', { class: 'body' }, title, sub, el('div', { class: 'row' }, reelBtn, pause, speed)), cv, shut));
const list = el('div', { class: 'list' });
app.append(el('div', { class: 'layout' }, list, side));
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
// ---- 候補のカード（攻撃ごとに分ける） ----
const summary = el('textarea', { rows: '6', readonly: '', 'aria-label': '選んだ型' });
const cards = [];
const paint = () => {
    for (const x of cards) {
        const k = order.indexOf(x.c.key);
        x.num.textContent = k >= 0 ? String(k + 1) : '';
        x.el.classList.toggle('picked', k >= 0);
    }
    summary.value = `見切りの窓で見せる型（この順。立ち位置は後列の下から2番目）:\n${order.map((key, k) => { const c = cands.find((x) => x.key === key); return c ? `${k + 1}. ${SCENE_JA[c.scene]} ／ ${!isCommon(c) ? WEAPON_LABELS[c.weapon] : '武器によらない'} ／ ${c.name}（${key}）` : ''; }).join('\n') || '（まだ選んでいません）'}`;
};
for (const sc of BASE) {
    const mine = cands.filter((c) => c.scene === sc);
    if (!mine.length)
        continue;
    const grid = el('div', { class: 'grid' });
    list.append(el('h2', { class: 'sec' }, `${SCENE_JA[sc]}「${mine[0].title}」（${mine.length}通り）`), grid);
    for (const c of mine) {
        const cvs = el('canvas', { width: '768', height: '432', role: 'img', 'aria-label': `${c.name}の4コマ` });
        const num = el('span', { class: 'num' });
        const toggle = el('button', { class: 'btn mark' }, '選ぶ ／ 外す');
        toggle.onclick = (e) => { e.stopPropagation(); const k = order.indexOf(c.key); if (k >= 0)
            order.splice(k, 1);
        else
            order.push(c.key); save(); paint(); if (!st.one)
            playReel(); };
        const card = el('article', { class: 'card pick', tabindex: '0' }, el('div', { class: 'thumb' }, cvs, num), el('div', { class: 'body' }, el('h3', {}, !isCommon(c) ? `${WEAPON_LABELS[c.weapon]}：${c.name}` : c.name), toggle));
        card.onclick = () => { playOne(c); openSide(); };
        card.onkeydown = (e) => { if (e.key === 'Enter')
            card.click(); };
        cards.push({ el: card, c, num, cvs });
        grid.append(card);
    }
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
const none = el('button', { class: 'btn' }, '全部外す');
none.onclick = () => { order = []; save(); paint(); playReel(); };
list.append(el('section', { class: 'card wide' }, el('div', { class: 'body' }, el('h2', {}, '選んだ型'), summary, el('div', { class: 'row' }, copy, none), el('p', { class: 'lead' }, 'この内容をチャットに貼ってください。紹介ページの窓は、この順でつないで流すようにします（6つ前後がおすすめ）。'))));
paint();
// ---- 4コマ（同じ区間を4つに分けて写す） ----
let q = 0;
const thumbStep = () => {
    const end = performance.now() + 14;
    while (q < cards.length && performance.now() < end) {
        const x = cards[q++];
        const wn = windowOf(x.c);
        const ctx = x.cvs.getContext('2d');
        [0, 1, 2, 3].forEach((j) => { const ph = wn.from + ((wn.to - wn.from) * (j + 0.5)) / 4; r.frame = 0; r.draw(x.c.w + ph); ctx.drawImage(cv, (j % 2) * 384, Math.floor(j / 2) * 216, 384, 216); });
        ctx.fillStyle = '#F4F1E8';
        ctx.fillRect(383, 0, 2, 432);
        ctx.fillRect(0, 215, 768, 2);
    }
    if (q < cards.length)
        setTimeout(thumbStep, 0);
    else {
        const c = st.list[st.i];
        if (c) {
            aim(c);
            r.frame = 0;
        }
    } // 写し終えたら、再生中の型に戻す
};
// ---- 再生（どの型も同じ秒数: 討伐画面の減速は使わない） ----
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const c = st.list[st.i];
    if (c && q >= cards.length) {
        if (!st.paused) {
            const ph = st.t - c.w, [s0, s1, k] = st.win.slow;
            st.t += (dt * (ph >= s0 && ph < s1 ? k : 1) * st.speed) / 3.4;
            if (st.t >= c.w + st.win.to)
                enter((st.i + 1) % st.list.length);
            r.frame++;
        }
        r.draw(st.t);
    }
    requestAnimationFrame(frame);
}
playReel();
setTimeout(thumbStep, 50);
requestAnimationFrame(frame);
window.ready = () => q >= cards.length;
window.cands = cands.map((c) => c.key);
// 確かめ用: 型を1つ、場面の進み具合 ph で描いた絵（PNG の data URL）
window.drawAt = (key, ph) => {
    const c = cands.find((x) => x.key === key);
    aim(c);
    r.frame = 0;
    r.draw(c.w + ph);
    const out = cv.toDataURL();
    const cur = st.list[st.i];
    if (cur)
        aim(cur);
    return out;
};
window.planOf = (key) => { const c = cands.find((x) => x.key === key); aim(c); return r.dodgePlanOf(c.w, F); };
//# sourceMappingURL=dodgelab.js.map