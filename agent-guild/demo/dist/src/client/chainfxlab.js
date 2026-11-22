// 連携魔法の演出の見本帳（運営・開発用）: 連携詠唱で全節がそろったときの大魔法を、案ごとに本物の討伐画面で見比べて選ぶ。
// 案の中身は chainfx.ts。討伐の流れ（唱え終える → 着弾 → ダメージ）の時刻は、どの案も同じ。
// scripts/build-chainfxlab.mjs が 1ファイルの HTML にまとめる。討伐データは window.__LAB_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
// 描くのは1枚だけ（4コマの見比べは、その1枚で描いた絵を写しとる）。
import { ArenaRenderer } from './arena.js';
import { WAVE_SECONDS } from './arena-common.js';
import { scriptFor } from './api.js';
import { CHAIN_FX_LIST, chainFx } from './chainfx.js';
import { setSfx } from './sfx.js';
chainFx.boss = false; // この見本帳は案を見比べるので、ボスの大魔法（BossModule の chainFinale）は使わない
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = window.__LAB_DATA__;
const first = scriptFor(data);
const L = first.waves.length - 1;
const ch0 = first.waves[L].events.find((e) => e.type === 'chain');
const me = ch0?.ok[0] ?? 0; // 「あなた」= 大呪を正しく唱えた人（大魔法が決まる見え方）
const script = scriptFor(data, [first.fighters[me].id]);
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
r.mine = new Set([me]);
const view = r.chainOf(L)?.view;
const doneT = view?.doneT ?? 0.6, impact = view?.impact ?? 0.7;
// 見せる区間: 最後の節を唱え終える少し前から、着弾の余韻まで
const P0 = doneT - 0.05, P1 = Math.min(0.995, impact + 0.3);
const STORE = 'chainfxlab-v1';
let saved = {};
try {
    saved = JSON.parse(localStorage.getItem(STORE) ?? '{}');
}
catch {
    saved = {};
}
const save = () => { try {
    localStorage.setItem(STORE, JSON.stringify(saved));
}
catch { /* 残せなくても使える */ } };
saved.notes ??= {};
const app = document.getElementById('app');
app.append(el('header', {}, el('h1', {}, '連携魔法の演出の見本帳'), el('p', { class: 'lead' }, '討伐の最後、連携詠唱が全節そろったときの大魔法の演出の案です。唱え終えてから着弾、ボスが崩れはじめるまでを、本番と同じ速さ（スロー演出つき）でくり返し再生します。空の魔法陣・唱える人の光の糸・ダメージの数字・効果音は、どの案も同じです。下の4コマ（唱え終え・溜め・着弾・余韻）でも見比べられます。')));
const title = el('h2', {});
const note = el('p', { class: 'fit' });
const pause = el('button', { class: 'btn' }, '一時停止');
const sound = el('button', { class: 'btn' }, '音：なし');
const pick = el('div', { class: 'seg wrap-seg' });
const speed = el('div', { class: 'seg' });
const st = { t: 0, paused: false, speed: 1 };
for (const sp of [1, 0.5, 0.25]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : sp === 0.5 ? '1/2' : '1/4');
    b.onclick = () => { st.speed = sp; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speed.append(b);
}
pause.onclick = () => { st.paused = !st.paused; pause.textContent = st.paused ? '再生' : '一時停止'; };
sound.onclick = () => { r.muted = !r.muted; setSfx(!r.muted); sound.textContent = r.muted ? '音：なし' : '音：あり'; };
const cards = [];
const show = (id) => {
    chainFx.style = id;
    st.t = 0;
    r.frame = 0;
    const x = CHAIN_FX_LIST.find((v) => v.id === id);
    title.textContent = x.name;
    note.textContent = x.note;
    pick.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    cards.forEach((c) => c.classList.toggle('now', c.dataset.id === id));
};
for (const x of CHAIN_FX_LIST) {
    const b = el('button', { 'data-id': x.id }, x.name);
    b.onclick = () => show(x.id);
    pick.append(b);
}
app.append(el('section', { class: 'card wide stage player' }, el('div', { class: 'body' }, pick, title, note, el('div', { class: 'row' }, pause, speed, sound)), cv));
// ---- 案ごとのカード（4コマ・これにする・ひとこと） ----
const summary = el('textarea', { rows: '5', readonly: '', 'aria-label': '選んだ案' });
const paintSummary = () => {
    const x = CHAIN_FX_LIST.find((v) => v.id === saved.pick);
    const notes = CHAIN_FX_LIST.filter((v) => saved.notes?.[v.id]).map((v) => `- ${v.name}: ${saved.notes[v.id]}`);
    summary.value = `連携魔法の演出: ${x ? x.name : '（まだ選んでいません）'}${notes.length ? `\n${notes.join('\n')}` : ''}`;
    cards.forEach((c) => c.classList.toggle('picked', c.dataset.id === saved.pick));
    cards.forEach((c) => { const b = c.querySelector('.mark'); b.classList.toggle('on', c.dataset.id === saved.pick); b.textContent = c.dataset.id === saved.pick ? '✓ これにする' : 'これにする'; });
};
const grid = el('div', { class: 'grid' });
const thumbs = [];
for (const x of CHAIN_FX_LIST) {
    const c = el('canvas', { width: '768', height: '432', role: 'img', 'aria-label': `${x.name}の4コマ` });
    thumbs.push({ c, id: x.id });
    const mark = el('button', { class: 'btn mark' }, 'これにする');
    mark.onclick = (e) => { e.stopPropagation(); saved.pick = x.id; save(); paintSummary(); };
    const memo = el('input', { type: 'text', placeholder: 'ひとこと（例: 剣がもっと大きいほうがいい）', value: saved.notes[x.id] ?? '' });
    memo.onclick = (e) => e.stopPropagation();
    memo.oninput = () => { saved.notes[x.id] = memo.value; save(); paintSummary(); };
    const card = el('article', { class: 'card pick', tabindex: '0', 'data-id': x.id }, c, el('div', { class: 'body' }, el('h3', {}, x.name), el('p', { class: 'note' }, x.note), mark, memo));
    card.onclick = () => { show(x.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    card.onkeydown = (e) => { if (e.key === 'Enter')
        card.click(); };
    cards.push(card);
    grid.append(card);
}
const copy = el('button', { class: 'btn primary' }, '選んだ案をコピー');
copy.onclick = async () => { try {
    await navigator.clipboard.writeText(summary.value);
    copy.textContent = 'コピーしました';
}
catch {
    summary.select();
    copy.textContent = '選んだので、手でコピーしてください';
} setTimeout(() => { copy.textContent = '選んだ案をコピー'; }, 1800); };
app.append(el('h2', { class: 'sec' }, '案の一覧'), grid, el('section', { class: 'card wide' }, el('div', { class: 'body' }, el('h2', {}, '選んだ案'), summary, el('div', { class: 'row' }, copy), el('p', { class: 'lead' }, 'いちばんしっくりくる案を「これにする」で選び、チャットに貼ってください。案どうしを混ぜたい（例: B の集まり方で、最後は E のように爆ぜる）ときも、ひとことに書いてください。'))));
paintSummary();
// ---- 4コマ（少しずつ描いて写しとる） ----
const frames = [doneT + 0.005, impact - 0.01, impact + 0.012, impact + 0.07];
let q = 0;
const thumbStep = () => {
    const keep = { style: chainFx.style, frame: r.frame };
    const { c, id } = thumbs[q++];
    chainFx.style = id;
    const ctx = c.getContext('2d');
    frames.forEach((ph, j) => { r.frame = Math.round((ph - P0) * 270); r.draw(L + ph); ctx.drawImage(cv, (j % 2) * 384, Math.floor(j / 2) * 216, 384, 216); });
    ctx.fillStyle = '#F4F1E8';
    ctx.fillRect(383, 0, 2, 432);
    ctx.fillRect(0, 215, 768, 2);
    chainFx.style = keep.style;
    r.frame = keep.frame;
    if (q < thumbs.length)
        setTimeout(thumbStep, 0);
};
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!st.paused) {
        const ph = P0 + (P1 - P0) * st.t;
        st.t += ((dt / WAVE_SECONDS) * st.speed * r.slowFactor(L + ph)) / (P1 - P0);
        if (st.t >= 1) {
            st.t = 0;
            r.frame = 0;
        }
        r.frame++;
    }
    r.draw(L + P0 + (P1 - P0) * st.t);
    requestAnimationFrame(frame);
}
show(saved.pick ?? 'pillar');
setTimeout(thumbStep, 50);
requestAnimationFrame(frame);
window.ready = () => q >= thumbs.length;
// 確かめ用（自動の画面写し）: 案と時刻を決めて1コマ描く
window.still = (id, ph) => { st.paused = true; chainFx.style = id; st.t = (ph - P0) / (P1 - P0); r.frame = Math.round((ph - P0) * 270); };
window.times = { doneT, impact };
//# sourceMappingURL=chainfxlab.js.map