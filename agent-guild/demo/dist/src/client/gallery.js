// 演出ギャラリー（運営・開発用）: 大技の演出を「場面 × 武器」で選んで再生し、連携詠唱（7人で成功・あなたが最後の節）も見る。
// scripts/build-gallery.mjs が 1ファイルの HTML にまとめる。討伐データは window.__DEMO__（紹介ページと同じ吸血鬼伯爵の見本）。
import { ArenaRenderer, CHAIN_TEMPOS } from './arena.js';
import { getDemoBattle, scriptFor } from './api.js';
import { ULT_SCENES, ultName } from './scenes.js';
import { setSfx } from './sfx.js';
import { WEAPON_KINDS, WEAPON_LABELS } from '../shared/catalog.js';
import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
const SCENE_JA = { ougi: tl('奥義（跳躍）'), rush: tl('乱舞'), summon: tl('召喚'), parry: tl('返し技'), seal: tl('封印'), awaken: tl('覚醒') };
const SECONDS_PER_WAVE = 3.4;
async function main() {
    const root = document.getElementById('app');
    const data = await getDemoBattle();
    const first = scriptFor(data, 'royale');
    const best = first.standings.slice().sort((a, b) => a.rank - b.rank)[0].f;
    const bestId = first.fighters[best].id;
    const full = scriptFor(data, 'royale', undefined, [bestId]);
    // ---- 大技: 場面 × 武器 ----
    const ultW = full.waves.findIndex((wv) => !wv.sudden && ['ougi', 'rush', 'summon'].includes(full.cases[wv.caseIndex]?.scene ?? ''));
    const canvas = h('canvas', { class: 'arena-canvas pixel' });
    const r = new ArenaRenderer(canvas, full);
    r.muted = true;
    r.mine = new Set([best]);
    const baseWeapon = new Map();
    let scene = 'ougi', weapon = 'sword', t = 0.2, playing = true, auto = false;
    const title = h('h2', { class: 'g-title' });
    const sub = h('p', { class: 'small muted' });
    const sceneRow = h('div', { class: 'g-row' });
    const weaponRow = h('div', { class: 'g-row' });
    const sync = () => {
        title.textContent = tl(`{0}：「{1}」`, SCENE_JA[scene] ?? scene, ultName(scene, weapon));
        sub.textContent = tl(`武器: {0}`, WEAPON_LABELS[weapon]);
        for (const b of sceneRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === scene);
        for (const b of weaponRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === weapon);
    };
    const restart = () => { t = 0.2; r.frame = 0; sync(); };
    for (const s of ULT_SCENES)
        sceneRow.append(h('button', { class: 'btn g-chip', 'data-k': s, onclick: () => { scene = s; restart(); } }, SCENE_JA[s] ?? s));
    for (const k of WEAPON_KINDS)
        weaponRow.append(h('button', { class: 'btn g-chip', 'data-k': k, onclick: () => { weapon = k; restart(); } }, WEAPON_LABELS[k]));
    const playBtn = h('button', { class: 'btn', onclick: () => { playing = !playing; playBtn.textContent = playing ? tl('一時停止') : tl('再生'); } }, tl('一時停止'));
    const autoBtn = h('button', { class: 'btn', onclick: () => { auto = !auto; autoBtn.textContent = auto ? tl('順番に見る：オン') : tl('順番に見る：オフ'); } }, tl('順番に見る：オフ'));
    const soundBtn = h('button', { class: 'btn', onclick: () => { r.muted = !r.muted; setSfx(!r.muted); soundBtn.textContent = r.muted ? tl('音：なし') : tl('音：あり'); } }, tl('音：なし'));
    const next = () => {
        const wi = WEAPON_KINDS.indexOf(weapon);
        if (wi < WEAPON_KINDS.length - 1)
            weapon = WEAPON_KINDS[wi + 1];
        else {
            weapon = WEAPON_KINDS[0];
            const si = ULT_SCENES.indexOf(scene);
            scene = ULT_SCENES[(si + 1) % ULT_SCENES.length];
        }
        restart();
    };
    // 主役の武器と場面を差し替えて描く（開発用ページと同じやり方）
    r.sceneOf = () => scene;
    const draw = () => {
        const f = r.ultOf(ultW)?.f ?? best;
        if (!baseWeapon.has(f))
            baseWeapon.set(f, r.looks[f].weapon);
        r.looks[f].weapon = weapon;
        r.draw(ultW + t);
    };
    // ---- 連携詠唱: 討伐隊の全員が大呪を知っている見本。あなたが最後の第7節（成功）／あなたが第7節で詰まる（失敗） ----
    const chainW0 = full.waves.findIndex((wv) => !wv.sudden && full.cases[wv.caseIndex]?.scene === 'chain');
    const makeChain = (fail) => {
        if (chainW0 < 0)
            return null;
        const cc = full.cases[full.waves[chainW0].caseIndex];
        const len = cc.chant?.length ?? 7;
        const party = data.entrants.map((e) => {
            const me = e.id === bestId;
            const ok = !(fail && me);
            return { ...e, result: { ...e.result, cases: e.result.cases.map((c) => (c.caseId === cc.id ? { ...c, score: ok ? 1 : 0, runs: c.runs.map(() => (ok ? 1 : 0)), mpOut: false, chainUpto: ok ? len : len - 1 } : c)) } };
        });
        const sc = scriptFor({ ...data, entrants: party }, 'royale', undefined, [bestId]);
        if (!sc)
            return null;
        const w = sc.waves.findIndex((wv) => !wv.sudden && sc.cases[wv.caseIndex]?.scene === 'chain');
        const cv = h('canvas', { class: 'arena-canvas pixel' });
        const cr = new ArenaRenderer(cv, sc);
        cr.muted = true;
        cr.mine = new Set([sc.fighters.findIndex((f) => f.id === bestId)]);
        return { r: cr, w, t: 0, box: h('div', { class: 'canvas-wrap' }, cv) };
    };
    const chains = [makeChain(false), makeChain(true)].filter((x) => !!x && x.w >= 0);
    // 連携詠唱のテンポ（節の詠唱・叫び・タメ・着弾・そのあとの余韻）を選んで見比べる
    let tempo = 'calm';
    const tempoRow = h('div', { class: 'g-row' });
    const syncTempo = () => {
        for (const c of chains)
            c.r.chainTempo = tempo;
        for (const b of tempoRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === tempo);
    };
    for (const k of Object.keys(CHAIN_TEMPOS))
        tempoRow.append(h('button', { class: 'btn g-chip', 'data-k': k, onclick: () => { tempo = k; for (const c of chains) {
                c.t = 0;
                c.r.frame = 0;
            } syncTempo(); } }, CHAIN_TEMPOS[k].label));
    syncTempo();
    let last = performance.now();
    const loop = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (playing) {
            t += (dt / SECONDS_PER_WAVE) * r.slowFactor(ultW + t);
            if (t >= 0.98) {
                if (auto)
                    next();
                else {
                    t = 0.2;
                    r.frame = 0;
                }
            }
            r.frame++;
        }
        draw();
        for (const c of chains) {
            c.t += (dt / SECONDS_PER_WAVE) * c.r.slowFactor(c.w + c.t);
            if (c.t >= 0.99) {
                c.t = 0;
                c.r.frame = 0;
            }
            c.r.frame++;
            c.r.draw(c.w + c.t);
        }
        requestAnimationFrame(loop);
    };
    root.replaceChildren(h('div', { class: 'gallery' }, h('h1', {}, tl('演出ギャラリー')), h('p', { class: 'small muted' }, tl(`見本の討伐（{0}）の上で、主役の場面と武器を差し替えて再生しています。`, data.task.title)), h('section', { class: 'card' }, title, sub, h('div', { class: 'canvas-wrap' }, canvas), h('div', { class: 'g-row' }, playBtn, autoBtn, soundBtn), h('h3', {}, tl('場面')), sceneRow, h('h3', {}, tl('武器')), weaponRow), h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '連携詠唱のテンポ'), h('p', { class: 'small muted' }, '節の詠唱・大魔法の名の叫び・光の柱までのタメ・着弾とそのあとを、どのくらいゆっくり見せるか。下の2つに同時に効きます。'), tempoRow), ...(chains[0] ? [h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '連携詠唱（成功・あなたが最後の第7節）'), chains[0].box)] : []), ...(chains[1] ? [h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '連携詠唱（失敗・あなたが第7節で詰まる）'), chains[1].box)] : [])));
    sync();
    requestAnimationFrame(loop);
}
main().catch((e) => { document.getElementById('app').textContent = tl(`読み込みに失敗しました: {0}`, e.message); });
//# sourceMappingURL=gallery.js.map