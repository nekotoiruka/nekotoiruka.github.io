// 被弾モーション見本帳（運営・開発用）: 外した冒険者がボスの攻撃を受けるときの動きの候補を並べて、見比べて選ぶ。
// scripts/build-hurtlab.mjs が 1ファイルの HTML にまとめる。絵は見本帳（motionlab.ts）の「被弾」の型をそのまま使う。
import { CATEGORIES, CH, CW, H, W, BOSS_LIST, PAIRS, STAND, crowdSlots, protoPattern, render, renderCrowd, setBossKind, setReduced } from './motionlab.js';
import { MOTION_PICKS } from './motionpicks.js';
import { HURT_BY_BOSS } from './hurtmoves.js';
import { NO_GEAR } from './arena-common.js';
import { BODY_TYPES } from '../shared/build.js';
import { WEAPON_KINDS, WEAPON_LABELS } from '../shared/catalog.js';
import { reducedMotion } from './motion.js';
const HURT = CATEGORIES.find((c) => c.id === 'hurt').patterns;
// どの場面に合いそうか（見比べるときの目安。本番の割り当ては、選んでもらってから決める）
const FITS = {
    'hurt-now': 'いまの全場面',
    'hurt-daze': 'すべての被弾の土台（爪・尾など）',
    'hurt-fly': '「吹き飛ばされた！」・ボスの大技（召喚など）',
    'hurt-crush': '岩・踏みつけ・落下（石の巨人）',
    'hurt-scorch': '炎・雷（竜）',
    'hurt-curse': '呪い・霧（吸血鬼伯爵）',
    'hurt-web': '糸・網（大蜘蛛）',
    'hurt-arrow': '矢・投げ槍（ゴブリンの群れ）',
    'hurt-ink': '墨・水（クラーケン）',
    'hurt-ice': '氷・冷気（氷の巨人）',
    'hurt-soul-ghost': 'ボスの大技を浴びたとき（第一候補）',
    'hurt-soul-mouth': 'ボスの大技を浴びたとき（おばけと交互）',
};
// ボス・場面を切り替えると、12人の画面の被弾の型は本番の割り当て（hurtmoves.ts）に変わる
const syncHurt = () => { st.crowd = HURT_BY_BOSS[st.boss][st.scene]; crowdSel.value = st.crowd; };
// いま本番で使っている成功の動き（見本帳で武器ごとに選ばれた型）と、使っている武器の数
const SUCCESS = ['guard', 'evade', 'jump'].flatMap((cat) => {
    const c = CATEGORIES.find((x) => x.id === cat);
    const count = new Map();
    for (const ids of Object.values(MOTION_PICKS[cat] ?? {}))
        for (const id of ids)
            count.set(id, (count.get(id) ?? 0) + 1);
    return c.patterns.filter((p) => count.has(p.id)).map((p) => ({ p, group: c.name, n: count.get(p.id) }));
});
const SCENES = ['claw', 'tail', 'breath', 'dive'];
const BODY_JA = { knight: '騎士', mage: '魔法使い', rogue: '盗賊', robot: 'ロボ', cat: 'ねこ', ninja: '忍者', priest: '僧侶', pirate: '海賊', samurai: '侍', chef: '料理人', astro: '宇宙飛行士', bunny: 'うさぎ', bear: 'くま', frog: 'かえる', witch: '魔女', ghostie: 'おばけ' };
const PALS = ['#4a78d8', '#d84a6a', '#4ab06a', '#c89a3a', '#8a5ad8', '#3aa8b8'];
const HAIRS = ['#f2c14e', '#5a3a2a', '#e8e8f0', '#d8603a', '#2a2a3a', '#ff9ac0'];
const MARKS = ['◎', '○', '×'];
const KEY = 'hurtlab-marks-v2';
const st = { body: 'knight', weapon: 'sword', boss: 'vampire', speed: 1, paused: false, t: 0, crowd: 'hurt-daze', scene: 'claw', real: false, all: false, marks: {} };
try {
    st.marks = JSON.parse(localStorage.getItem(KEY) ?? '{}');
}
catch { /* 保存できない環境でも動く */ }
const saveMarks = () => { try {
    localStorage.setItem(KEY, JSON.stringify(st.marks));
}
catch { /* 同上 */ } };
setReduced(reducedMotion());
const look = () => ({ look: { body: st.body, palette: '#4a78d8', hair: '#f2c14e', weapon: st.weapon }, gear: NO_GEAR });
function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, v);
    for (const k of kids)
        e.append(k);
    return e;
}
function select(label, opts, names, val, on) {
    const s = el('select');
    for (const o of opts)
        s.append(new Option(names(o), o));
    s.value = val;
    s.onchange = () => on(s.value);
    return el('label', { class: 'ctl' }, el('span', {}, label), s);
}
const app = document.getElementById('app');
app.append(el('header', {}, el('h1', {}, '被弾モーション見本帳'), el('p', { class: 'lead' }, '外した冒険者が、ボスの攻撃を受けるときの動きの候補です（作り直し版）。成功の動きとかぶらないように、移動ではなく「赤く光る・尻もち・目を回す・体の見た目が変わる」で見せています。どれも 2 秒で1回、0.8 秒のところで当たります。下に、いま本番で使っている成功の動きも並べてあります。')));
// 操作の列
const timeIn = el('input', { type: 'range', min: '0', max: '1', step: '0.005', value: '0' });
const pauseBtn = el('button', { class: 'btn' }, '一時停止');
timeIn.oninput = () => { st.t = Number(timeIn.value) * 2; if (!st.paused)
    togglePause(); };
function togglePause() { st.paused = !st.paused; pauseBtn.textContent = st.paused ? '再生' : '一時停止'; }
pauseBtn.onclick = togglePause;
const speedRow = el('div', { class: 'seg' });
for (const sp of [1, 0.5, 0.25]) {
    const b = el('button', { class: sp === 1 ? 'on' : '' }, sp === 1 ? 'ふつう' : sp === 0.5 ? '1/2' : '1/4');
    b.onclick = () => { st.speed = sp; speedRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    speedRow.append(b);
}
app.append(el('section', { class: 'bar' }, select('冒険者', BODY_TYPES, (v) => BODY_JA[v] ?? v, st.body, (v) => { st.body = v; }), select('武器', WEAPON_KINDS, (v) => WEAPON_LABELS[v] ?? v, st.weapon, (v) => { st.weapon = v; }), select('うしろのボス', BOSS_LIST.map((b) => b.kind), (v) => BOSS_LIST.find((b) => b.kind === v).name, st.boss, (v) => { st.boss = v; syncHurt(); paintScenes(); }), el('div', { class: 'ctl' }, el('span', {}, '速さ'), speedRow), el('div', { class: 'ctl grow' }, el('span', {}, '時刻'), el('div', { class: 'row' }, pauseBtn, timeIn))));
// 候補のカード
app.append(el('h2', { class: 'sec' }, '被弾の案'));
const grid = el('section', { class: 'grid' });
const cards = [];
for (const p of HURT) {
    const cv = el('canvas', { width: String(W), height: String(H) });
    const markRow = el('div', { class: 'seg marks' });
    const paint = () => markRow.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === st.marks[p.id]));
    for (const m of MARKS) {
        const b = el('button', { 'aria-label': `${p.name}に${m}` }, m);
        b.onclick = () => { st.marks[p.id] = st.marks[p.id] === m ? '' : m; saveMarks(); paint(); };
        markRow.append(b);
    }
    paint();
    const crowdBtn = el('button', { class: 'link' }, '12人で見る ↓');
    crowdBtn.onclick = () => { st.crowd = p.id; crowdSel.value = p.id; document.getElementById('crowd').scrollIntoView({ behavior: 'smooth' }); };
    grid.append(el('article', { class: 'card' + (p.id === 'hurt-now' ? ' ref' : '') }, cv, el('div', { class: 'body' }, el('h2', {}, p.name), el('p', { class: 'fit' }, FITS[p.id] ?? ''), el('p', { class: 'note' }, p.note), el('div', { class: 'row between' }, p.id === 'hurt-now' ? el('span', { class: 'fit' }, '比べる用') : markRow, crowdBtn))));
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    cards.push({ p, c });
}
app.append(grid);
// いま本番で使っている成功の動き（比べる用）
app.append(el('h2', { class: 'sec' }, 'いま使っている成功の動き'), el('p', { class: 'lead' }, '正しく動けた人の動きです（見本帳で武器ごとに選ばれ、本番で使われている型）。被弾の案が、これと見まちがえないかを比べてください。'));
const sgrid = el('section', { class: 'grid small' });
for (const { p, group, n } of SUCCESS) {
    const cv = el('canvas', { width: String(W), height: String(H) });
    sgrid.append(el('article', { class: 'card ok' }, cv, el('div', { class: 'body' }, el('h3', {}, p.name), el('p', { class: 'fit' }, `${group}・${n}種の武器で使用`))));
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    cards.push({ p, c });
}
app.append(sgrid);
// 12人の並びで見る（重なり・はみ出しの確認用）
const crowdCv = el('canvas', { width: String(CW), height: String(CH) });
const crowdSel = el('select');
for (const p of HURT)
    crowdSel.append(new Option(p.name, p.id));
crowdSel.value = st.crowd;
crowdSel.onchange = () => { st.crowd = crowdSel.value; };
const sceneRow = el('div', { class: 'seg' });
function paintScenes() {
    sceneRow.replaceChildren(...SCENES.map((sc) => {
        const b = el('button', { class: sc === st.scene ? 'on' : '' }, PAIRS[st.boss][sc][0]);
        b.onclick = () => { st.scene = sc; syncHurt(); paintScenes(); };
        return b;
    }));
}
paintScenes();
const realRow = el('div', { class: 'seg' });
for (const real of [false, true]) {
    const b = el('button', { class: real ? '' : 'on' }, real ? '本番の大きさ' : '大きく');
    b.onclick = () => { st.real = real; crowdCv.classList.toggle('real', real); realRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    realRow.append(b);
}
const allRow = el('div', { class: 'seg' });
for (const all of [false, true]) {
    const b = el('button', { class: all ? '' : 'on' }, all ? '全員' : '4人');
    b.onclick = () => { st.all = all; allRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    allRow.append(b);
}
app.append(el('section', { class: 'card wide', id: 'crowd' }, el('div', { class: 'body' }, el('h2', {}, '12人の並びで見る'), el('p', { class: 'note' }, '外した人は選んだ被弾の型で、ほかの人はそのボスの攻撃に対する本番の成功の動き（武器ごとの型）で動きます。成功した人に囲まれても、被弾した人がひと目で分かるかを見てください。足元の金の輪が「あなた」（外した側）です。ボスやボスの攻撃を切り替えると、被弾の型は本番の割り当てに変わります。'), el('div', { class: 'row wrap' }, el('label', { class: 'ctl' }, el('span', {}, '被弾の型'), crowdSel), el('div', { class: 'ctl' }, el('span', {}, 'ボスの攻撃（成功した人の動きが変わる）'), sceneRow), el('div', { class: 'ctl' }, el('span', {}, '外した人'), allRow), el('div', { class: 'ctl' }, el('span', {}, '表示'), realRow))), crowdCv));
const crowdCtx = crowdCv.getContext('2d');
crowdCtx.imageSmoothingEnabled = false;
const crowdWrap = crowdCv;
void crowdWrap;
const crowdLooks = Array.from({ length: 12 }, (_, i) => ({ look: { body: BODY_TYPES[(i * 5 + 3) % BODY_TYPES.length], palette: PALS[i % PALS.length], hair: HAIRS[(i * 2) % HAIRS.length], weapon: WEAPON_KINDS[(i * 7) % WEAPON_KINDS.length] }, gear: NO_GEAR }));
// 選んだ結果をコピー
const out = el('textarea', { readonly: '', rows: '5' });
const copyBtn = el('button', { class: 'btn primary' }, '選んだ結果をコピー');
const summary = () => HURT.filter((p) => p.id !== 'hurt-now').map((p) => `${st.marks[p.id] || '－'} ${p.name}（${p.id}）`).join('\n');
copyBtn.onclick = async () => {
    out.value = summary();
    try {
        await navigator.clipboard.writeText(out.value);
        copyBtn.textContent = 'コピーしました';
        setTimeout(() => (copyBtn.textContent = '選んだ結果をコピー'), 1500);
    }
    catch {
        out.select();
    }
};
app.append(el('section', { class: 'card wide' }, el('div', { class: 'body' }, el('h2', {}, '選んだ結果'), el('p', { class: 'note' }, '◎・○ を付けたら、ここでコピーしてチャットに貼ってください。「この場面にはこれ」などの一言も添えてもらえると、本番の割り当てに使います。'), el('div', { class: 'row' }, copyBtn), out)));
const HIT4 = new Set([1, 5, 6, 10]); // 4人だけ外したとき: あなた（5）と、前・同じ段・後ろの列の人
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!st.paused) {
        st.t = (st.t + dt * st.speed) % 2;
        timeIn.value = String(st.t / 2);
    }
    setBossKind(st.boss);
    const L = look();
    for (const { p, c } of cards)
        render(c, p, st.t, L);
    const pat = HURT.find((p) => p.id === st.crowd) ?? HURT[0];
    const resp = PAIRS[st.boss][st.scene][2];
    const okPat = (lk, i) => protoPattern(resp, lk.look.weapon, i) ?? (resp === 'crawl' ? CATEGORIES.find((c) => c.id === 'evade').patterns.find((x) => x.id === 'evade-duck') : resp === 'barrier' ? CATEGORIES.find((c) => c.id === 'guard').patterns.find((x) => x.id === 'guard-hex') : STAND);
    const members = crowdSlots().map((slot, i) => { const lk = i === 5 ? L : crowdLooks[i]; return { look: lk, pattern: st.all || HIT4.has(i) ? pat : okPat(lk, i), mine: i === 5, slot, delay: ((i * 7) % 5) * 0.006 }; });
    renderCrowd(crowdCtx, members, st.t, false, false);
    // あなたの目印（金の輪）
    const me = members[5].slot;
    crowdCtx.setTransform(1, 0, 0, 1, 0, 0);
    crowdCtx.strokeStyle = '#F2C14E';
    crowdCtx.lineWidth = 1;
    crowdCtx.beginPath();
    crowdCtx.ellipse(me.x + 0.5, me.y + 1.5, 9, 3, 0, 0, Math.PI * 2);
    crowdCtx.stroke();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.ready = true;
//# sourceMappingURL=hurtlab.js.map