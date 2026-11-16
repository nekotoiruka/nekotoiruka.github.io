// 必殺技の一覧（運営・開発用）: 6つの場面（奥義・乱舞・召喚・返し技・封印・覚醒）の型を全部並べ、リメイクする技を選ぶ。
// 型は武器ごとに選んだ案（motionpicks.ts）で、同じ型を使う武器はまとめて1枚にする。
// 1枚ごとに、見どころの4コマ（名乗り・溜め・当たる瞬間・余韻）を並べ、押すと上の大きな画面で本物の速さで再生する。
// scripts/build-ultlist.mjs が 1ファイルの HTML にまとめる。討伐データは window.__LAB_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
// 討伐画面を何枚も同時に描くと重いので、描くのは1枚だけ（4コマは、その1枚で描いた絵を写しとる）。
import { ArenaRenderer } from './arena.js';
import { scriptFor } from './api.js';
import { ULT_SCENES, ultHitT, ultName, ultNameT } from './scenes.js';
import { MOTION_PICKS } from './motionpicks.js';
import { MOVE_LABEL, ultMoveDef } from './ultmoves.js';
import { WEAPON_LABELS } from '../shared/catalog.js';
import { setSfx } from './sfx.js';
const SCENE_JA = { ougi: '奥義（跳躍）', rush: '乱舞', summon: '召喚', parry: '返し技', seal: '封印', awaken: '覚醒' };
const SECONDS_PER_WAVE = 3.4;
const T0 = 0.2, T1 = 0.98;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = window.__LAB_DATA__;
const first = scriptFor(data);
const best = first.standings.slice().sort((a, b) => a.rank - b.rank)[0].f;
const script = scriptFor(data, [first.fighters[best].id]);
const ultW = script.waves.findIndex((wv) => ULT_SCENES.includes(script.cases[wv.caseIndex]?.scene ?? ''));
const moves = [];
for (const scene of ULT_SCENES) {
    const by = new Map();
    for (const [w, ids] of Object.entries(MOTION_PICKS[scene] ?? {})) {
        const id = (ids[0] ?? '').replace(`${scene}-`, '');
        if (!by.has(id))
            by.set(id, []);
        by.get(id).push(w);
    }
    for (const [id, weapons] of by)
        moves.push({ scene, id, label: MOVE_LABEL[id] ?? id, weapons, legacy: !ultMoveDef(scene, weapons[0]) });
}
const keyOf = (m) => `${m.scene}-${m.id}`;
function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, v);
    for (const k of kids)
        if (k !== null)
            e.append(k);
    return e;
}
// ---- 描く1枚（場面と主役の武器を差し替えて描く。ギャラリーと同じやり方） ----
const cv = el('canvas', { width: '768', height: '432' });
const r = new ArenaRenderer(cv, script);
r.muted = true;
r.mine = new Set([best]);
let scene = 'ougi', weapon = 'sword';
r.sceneOf = () => scene;
const hero = () => r.ultOf(ultW)?.f ?? best;
const setMove = (s, w) => {
    scene = s;
    weapon = w;
    // 場面ごとに当たる時刻が変わるので、場面に合わせた並べ替え・効果音・止めの覚えを捨てる
    r.retimed.clear();
    r.cueCache.clear();
    r.stopCache.clear();
    r.planCache.clear();
    r.looks[hero()].weapon = weapon;
};
const drawAt = (t, frame) => { r.looks[hero()].weapon = weapon; r.frame = frame; r.draw(ultW + t); };
// ---- 選んだ技（このブラウザにだけ残す）。書き出すときに --key を渡すと、キーに接尾辞がつく（前の版の一覧と混ざらない） ----
// 保存のキー: 直した版などは「ultlist-after-picks-v1」のように、版の名前を間に入れる（前の版と混ざらないように。公開済みの直した版もこの形）
const KEY_PART = window.__LAB_KEY__ ? `${window.__LAB_KEY__}-` : '';
const STORE = `ultlist-${KEY_PART}picks-v1`;
let picks = {};
try {
    picks = JSON.parse(localStorage.getItem(STORE) ?? '{}');
}
catch {
    picks = {};
}
const save = () => { try {
    localStorage.setItem(STORE, JSON.stringify(picks));
}
catch { /* 残せなくても使える */ } };
const SEEN = `ultlist-${KEY_PART}seen-v1`;
let seen = new Set();
try {
    seen = new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]'));
}
catch {
    seen = new Set();
}
const saveSeen = () => { try {
    localStorage.setItem(SEEN, JSON.stringify([...seen]));
}
catch { /* 残せなくても使える */ } };
// ---- 画面 ----
const app = document.getElementById('app');
app.append(el('header', {}, el('h1', {}, '必殺技の一覧'), el('p', { class: 'lead' }, `必殺技の型を、6つの場面ごとに全部（${moves.length}種類）並べました。同じ型を使う武器は1枚にまとめています。1枚ごとに「名乗り・溜め・当たる瞬間・余韻」の4コマを並べ、押すと本番の速さで再生します（広い画面では右側、スマホでは重ねた窓）。再生した技には「見た」がつきます。リメイクしたい技は「リメイクする」を押し、気になるところをひとことで書いてください。いちばん下に、選んだ技の一覧がまとまります。`)));
const title = el('h2', {});
const sub = el('p', { class: 'fit' });
const pause = el('button', { class: 'btn' }, '一時停止');
const sound = el('button', { class: 'btn' }, '音：なし');
const prev = el('button', { class: 'btn' }, '← 前の技');
const next = el('button', { class: 'btn' }, '次の技 →');
const speed = el('div', { class: 'seg' });
const st = { i: 0, t: T0, paused: false, speed: 1 };
for (const sp of [1, 0.5, 0.25]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : sp === 0.5 ? '1/2' : '1/4');
    b.onclick = () => { st.speed = sp; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speed.append(b);
}
pause.onclick = () => { st.paused = !st.paused; pause.textContent = st.paused ? '再生' : '一時停止'; };
sound.onclick = () => { r.muted = !r.muted; setSfx(!r.muted); sound.textContent = r.muted ? '音：なし' : '音：あり'; };
// 広い画面: 左に一覧、右に再生（スクロールしても右に残る）。スマホ: 押したら重ねた窓で再生し、閉じたら同じ場所に戻る
const shut = el('button', { class: 'btn side-close' }, '閉じる');
const side = el('aside', { class: 'side' }, el('section', { class: 'card stage' }, el('div', { class: 'body' }, title, sub, el('div', { class: 'row' }, prev, pause, next, speed, sound)), cv, shut));
const list = el('div', { class: 'list' });
const progress = el('p', { class: 'progress' });
const unseenOnly = el('label', { class: 'fit' }, el('input', { type: 'checkbox' }), ' まだ見ていない技だけ並べる');
app.append(el('div', { class: 'toolbar' }, progress, unseenOnly), el('div', { class: 'layout' }, list, side));
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
const weaponBtns = [];
const play = (i, w, quiet = false) => {
    st.i = (i + moves.length) % moves.length;
    const m = moves[st.i];
    setMove(m.scene, w ?? m.weapons[0]);
    st.t = T0;
    r.frame = 0;
    title.textContent = `${SCENE_JA[m.scene]}：${m.label}`;
    sub.textContent = `武器: ${WEAPON_LABELS[weapon]}（技の名前: 「${ultName(m.scene, weapon)}」）${m.legacy ? ' ／ 以前の演出のまま（型の作りこみ前）' : ''}`;
    cards.forEach((c, k) => c.classList.toggle('now', k === st.i));
    if (quiet)
        return;
    seen.add(keyOf(m));
    saveSeen();
    paintSeen();
    if (!narrow())
        cards[st.i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // 前・次で動かしたときも、いまの1枚が一覧で見えるように
    weaponBtns.forEach((bs, k) => bs.forEach((b) => b.classList.toggle('on', k === st.i && b.dataset.w === weapon)));
};
prev.onclick = () => play(st.i - 1);
next.onclick = () => play(st.i + 1);
// ---- 1枚ごとのカード ----
const summary = el('textarea', { rows: '8', readonly: '', 'aria-label': '選んだ技の一覧' });
const count = el('span', { class: 'fit' });
const paintSummary = () => {
    const lines = moves.filter((m) => picks[keyOf(m)]?.on).map((m) => `- ${SCENE_JA[m.scene]}「${m.label}」（${m.weapons.map((w) => WEAPON_LABELS[w]).join('・')}）${picks[keyOf(m)]?.note ? `: ${picks[keyOf(m)].note}` : ''}`);
    count.textContent = `${lines.length}種類を選んでいます`;
    if (typeof paintSeen === 'function' && cards.length === moves.length)
        paintSeen();
    summary.value = lines.length ? `リメイクする必殺技:\n${lines.join('\n')}` : '（まだ選んでいません）';
};
const thumbs = [];
let sec = null, grid = null;
moves.forEach((m, i) => {
    if (!sec || sec.dataset.scene !== m.scene) {
        grid = el('div', { class: 'grid' });
        sec = el('section', { 'data-scene': m.scene }, el('h2', { class: 'sec' }, `${SCENE_JA[m.scene]}（${moves.filter((x) => x.scene === m.scene).length}種類）`), grid);
        list.append(sec);
    }
    const k = keyOf(m);
    const c = el('canvas', { width: '768', height: '432', role: 'img', 'aria-label': `${m.label}の4コマ` });
    thumbs.push({ c, m });
    const on = el('button', { class: 'btn mark' }, 'リメイクする');
    const note = el('input', { type: 'text', placeholder: 'ひとこと（例: 溜めが地味・当たりが軽い）', value: picks[k]?.note ?? '' });
    const paint = () => { const p = picks[k]; on.classList.toggle('on', !!p?.on); on.textContent = p?.on ? '✓ リメイクする' : 'リメイクする'; card.classList.toggle('picked', !!p?.on); };
    on.onclick = (e) => { e.stopPropagation(); picks[k] = { on: !picks[k]?.on, note: note.value }; save(); paint(); paintSummary(); };
    note.onclick = (e) => e.stopPropagation();
    note.oninput = () => { picks[k] = { on: picks[k]?.on ?? true, note: note.value }; save(); paint(); paintSummary(); };
    const ws = m.weapons.map((w) => { const b = el('button', { class: 'chip', 'data-w': w }, WEAPON_LABELS[w]); b.onclick = (e) => { e.stopPropagation(); play(i, w); openSide(); }; return b; });
    weaponBtns.push(ws);
    const card = el('article', { class: 'card pick', tabindex: '0' }, c, el('div', { class: 'body' }, el('div', { class: 'row between' }, el('h3', {}, m.label), el('span', { class: 'row chips' }, m.legacy ? el('span', { class: 'tag' }, '以前の演出') : null, el('span', { class: 'tag seen-tag' }, '見た'))), el('div', { class: 'row chips' }, ...ws), on, note));
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
const clear = el('button', { class: 'btn' }, '選んだのを全部外す');
clear.onclick = () => { picks = {}; save(); location.reload(); };
list.append(el('section', { class: 'card wide' }, el('div', { class: 'body' }, el('h2', {}, '選んだ技'), count, summary, el('div', { class: 'row' }, copy, clear), el('p', { class: 'lead' }, 'この一覧をチャットに貼ってください。選んだ内容は、このブラウザにだけ残ります。'))));
paintSummary();
// 見た・選んだの数と、まだ見ていない技だけ並べる
function paintSeen() {
    const only = unseenOnly.querySelector('input').checked;
    moves.forEach((m, k) => { const c = cards[k]; if (!c)
        return; const v = seen.has(keyOf(m)); c.classList.toggle('seen', v); c.hidden = only && v && k !== st.i; });
    list.querySelectorAll('section[data-scene]').forEach((sec) => { sec.hidden = ![...sec.querySelectorAll('article')].some((a) => !a.hidden); });
    progress.textContent = `見た ${moves.filter((m) => seen.has(keyOf(m))).length} / ${moves.length} ・ リメイクする ${moves.filter((m) => picks[keyOf(m)]?.on).length}`;
}
unseenOnly.querySelector('input').addEventListener('change', paintSeen);
const resetSeen = el('button', { class: 'btn' }, '「見た」を全部外す');
resetSeen.onclick = () => { seen.clear(); saveSeen(); paintSeen(); };
unseenOnly.after(resetSeen);
paintSeen();
// ---- 4コマを、少しずつ描いて写しとる（いちどに描くと、開いた直後に固まるため） ----
const frameTimes = (s) => { const n = ultNameT(s), hit = ultHitT(s); return [n + 0.03, (n + hit) / 2, hit + 0.004, hit + 0.07]; };
let q = 0;
const thumbStep = () => {
    const end = performance.now() + 12;
    const keep = { scene, weapon, frame: r.frame };
    while (q < thumbs.length && performance.now() < end) {
        const { c, m } = thumbs[q++];
        setMove(m.scene, m.weapons[0]);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        frameTimes(m.scene).forEach((t, j) => {
            drawAt(t, Math.round((t - T0) * 60 * SECONDS_PER_WAVE));
            ctx.drawImage(cv, (j % 2) * 384, Math.floor(j / 2) * 216, 384, 216);
        });
        ctx.fillStyle = '#F4F1E8';
        ctx.fillRect(383, 0, 2, 432);
        ctx.fillRect(0, 215, 768, 2);
    }
    setMove(keep.scene, keep.weapon);
    r.frame = keep.frame;
    if (q < thumbs.length)
        setTimeout(thumbStep, 0);
};
// ---- 大きな画面の再生 ----
let last = performance.now();
function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!st.paused) {
        st.t += ((dt / SECONDS_PER_WAVE) * st.speed) * r.slowFactor(ultW + st.t);
        if (st.t >= T1) {
            st.t = T0;
            r.frame = 0;
        }
        r.frame++;
    }
    drawAt(st.t, r.frame);
    requestAnimationFrame(loop);
}
play(0, undefined, true);
setTimeout(thumbStep, 50);
requestAnimationFrame(loop);
window.ready = () => q >= thumbs.length;
// 確かめ用（自動の画面写し）: 場面・型・武器・時刻を決めて、止めて1コマ描く（武器を省くと、その型の最初の武器）
window.still = (s, id, w, ph) => {
    const i = moves.findIndex((m) => m.scene === s && m.id === id);
    if (i < 0)
        return;
    play(i, w ?? moves[i].weapons[0], true);
    st.paused = true;
    st.t = ph;
    r.frame = Math.round((ph - T0) * 60 * SECONDS_PER_WAVE);
};
//# sourceMappingURL=ultlist.js.map