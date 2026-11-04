// 大魔法のダメージ見本帳（運営・開発用）: 討伐の最後、連携詠唱の大魔法のダメージが入るタイミングを、本物の討伐画面で見比べて選ぶ。
// 数字の出方は決まり（ほかのダメージと同じ出方・会心の色）。光の柱が落ちてから、数字・体力の減り・ボスが崩れるまでの遅れだけを切り替える。
// scripts/build-chainlab.mjs が 1ファイルの HTML にまとめる。討伐データは window.__CHAIN_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
// 画面は1枚だけ（討伐画面を何枚も同時に描くと重いため）。
import { ArenaRenderer } from './arena.js';
import { WAVE_SECONDS, chainTiming } from './arena-common.js';
import { scriptFor } from './api.js';
// 候補（光の柱が落ちてからの遅れ。進行度）
// 着弾の前後は大きくスローになるので、候補は本番の速さの秒数で決める（進行度は、あとで secAfter から逆算する）
const DELAYS = [
    { sec: 0, name: 'すぐ（前の版）', d: 0 },
    { sec: 0.8, name: '約0.8秒あと', d: 0 },
    { sec: 1.0, name: '約1秒あと（本番）', d: 0 },
    { sec: 1.2, name: '約1.2秒あと', d: 0 },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = window.__CHAIN_DATA__;
const first = scriptFor(data); // 見本の討伐データは必ず読める（ページに埋めこんである）
const L = first.waves.length - 1;
const ch0 = first.waves[L].events.find((e) => e.type === 'chain');
const me = ch0?.ok[0] ?? 0; // 「あなた」= 大呪を正しく唱えた人（大魔法が決まる見え方）
const script = scriptFor(data, [first.fighters[me].id]);
function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, v);
    for (const k of kids)
        e.append(k);
    return e;
}
const app = document.getElementById('app');
const cv = el('canvas', { width: '768', height: '432', id: 'arena' });
const r = new ArenaRenderer(cv, script);
r.muted = true;
r.mine = new Set([me]);
const impact = r.chainOf(L)?.view.impact ?? 0.7;
const dmg = script.waves[L].events.find((e) => e.type === 'chain');
// 本番の速さ（スロー演出を入れた実際の秒数）。光の柱が落ちてから d だけ進むのに何秒かかるか
const secAfter = (d) => { let sec = 0; const n = 200; for (let i = 0; i < n; i++) {
    const ph = impact + (d * (i + 0.5)) / n;
    sec += ((d / n) * WAVE_SECONDS) / r.slowFactor(L + ph);
} return sec; };
// 秒数 → 進行度（二分探索）
for (const x of DELAYS) {
    let lo = 0, hi = 0.2;
    for (let k = 0; k < 30; k++) {
        const m = (lo + hi) / 2;
        if (secAfter(m) < x.sec)
            lo = m;
        else
            hi = m;
    }
    x.d = x.sec ? (lo + hi) / 2 : 0;
}
const st = { i: 2, t: 0, paused: false, speed: 1 };
window.delays = DELAYS;
const P0 = () => impact - 0.06, P1 = () => impact + DELAYS[st.i].d + 0.3;
app.append(el('header', {}, el('h1', {}, '大魔法のダメージ見本帳'), el('p', { class: 'lead' }, `討伐の最後、大魔法（この見本では ${Math.round(dmg?.dmg ?? 0).toLocaleString()} ダメージ）の数字を出すタイミングの候補です。数字は、ほかのダメージと同じ所（ボスの右上あたり）に同じ出方で、会心の色・2倍の大きさ。光の柱が落ちてから、数字・体力の減り・ボスが崩れはじめるのを、そろって少し遅らせます。「討伐成功！」の帯は、数字のあとに出ます。本番と同じ速さ（スロー演出つき）で、くり返し再生しています。`)));
const pick = el('div', { class: 'seg wrap-seg' });
const label = el('p', { class: 'fit', id: 'label' });
const paintPick = () => {
    pick.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === st.i));
    const d = DELAYS[st.i].d;
    label.textContent = d === 0 ? '光の柱が落ちた瞬間に出る' : `光の柱が落ちてから ${secAfter(d).toFixed(2)}秒あと（本番の速さ）`;
};
DELAYS.forEach((x, i) => { const b = el('button', {}, x.name); b.onclick = () => { st.i = i; st.t = 0; chainTiming.delay = x.d; paintPick(); }; pick.append(b); });
chainTiming.delay = DELAYS[st.i].d;
paintPick();
const time = el('input', { type: 'range', min: '0', max: '1', step: '0.002', value: '0', id: 'time' });
const pause = el('button', { class: 'btn', id: 'pause' }, '一時停止');
time.oninput = () => { st.t = Number(time.value); if (!st.paused)
    toggle(); };
function toggle() { st.paused = !st.paused; pause.textContent = st.paused ? '再生' : '一時停止'; }
pause.onclick = toggle;
const speed = el('div', { class: 'seg' });
for (const sp of [1, 0.5, 0.25]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : sp === 0.5 ? '1/2' : '1/4');
    b.onclick = () => { st.speed = sp; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speed.append(b);
}
app.append(el('section', { class: 'card wide stage' }, el('div', { class: 'body' }, el('h2', {}, 'タイミング'), pick, label), cv), el('section', { class: 'bar' }, el('div', { class: 'ctl' }, el('span', {}, '速さ'), speed), el('div', { class: 'ctl grow' }, el('span', {}, '時刻'), el('div', { class: 'row' }, pause, time))), el('p', { class: 'lead' }, 'いちばんしっくりくるものを、チャットで教えてください（例:「光の柱が細くなりはじめ」）。'));
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const p0 = P0(), p1 = P1();
    if (!st.paused) {
        const ph0 = p0 + (p1 - p0) * st.t;
        st.t += ((dt / WAVE_SECONDS) * st.speed * r.slowFactor(L + ph0)) / (p1 - p0);
        if (st.t >= 1)
            st.t = 0;
        time.value = String(st.t);
    }
    r.frame = Math.round(st.t * 270);
    r.draw(L + p0 + (p1 - p0) * st.t);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.ready = true;
//# sourceMappingURL=chainlab.js.map