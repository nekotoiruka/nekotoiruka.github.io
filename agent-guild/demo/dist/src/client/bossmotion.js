import { reducedMotion } from './motion.js';
const TAU = Math.PI * 2;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const win = (p, a, b) => clamp01((p - a) / (b - a));
const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const hash = (i, k = 0) => fract(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
const identity = () => ({ move: null, pose: {}, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, face: 1, alpha: 1, tremble: 0, ghosts: [], shadow: 1, fx: null });
export const STYLE = {
    dragon: { mouth: [86, 34], eye: [74, 27], head: [76, 30], body: [46, 54], glow: ['#fff2b0', '#ff6a2a'], smoke: '#9a96a6', puff: 'smoke', flies: true },
    spider: { mouth: [74, 56], eye: [70, 44], head: [68, 46], body: [48, 52], glow: ['#ffffff', '#9ad0ff'], smoke: '#e4e7f0', puff: 'web' },
    goblin: { mouth: [64, 39], eye: [64, 28], head: [62, 30], body: [52, 52], glow: ['#fff2b0', '#feae34'], smoke: '#c8b48a', puff: 'shout' },
    kraken: { mouth: [86, 57], eye: [73, 45], head: [66, 44], body: [56, 42], glow: ['#d8f2ff', '#3fa0e0'], smoke: '#bfe8ff', puff: 'bubble' },
    golem: { mouth: [62, 18], eye: [60, 12], head: [58, 14], body: [44, 46], glow: ['#e0fffa', '#30d0c0'], smoke: '#c8b48a', puff: 'debris' },
    vampire: { mouth: [61, 29], eye: [60, 22], head: [58, 22], body: [48, 46], glow: ['#ffd0e0', '#d02050'], smoke: '#7a3a9a', puff: 'mist', flies: true },
    giant: { mouth: [53, 29], eye: [53, 24], head: [52, 24], body: [48, 44], glow: ['#ffffff', '#9fd8ff'], smoke: '#e6f6ff', puff: 'frost' },
};
/** 場面 → 動き。場面が「その場の出来事」（記憶・仲間の声など）のときは、ボスの攻撃の種類で決める */
export function moveFor(scene, atk) {
    switch (scene) {
        case 'breath': return 'breath';
        case 'claw':
        case 'rush':
        case 'parry': return 'claw';
        case 'tail': return 'tail';
        case 'dive': return 'dive';
        case 'opening': return 'daze';
        case 'fog': return 'ambush';
        case 'spell': return 'cast';
        case 'illusion': return 'sing';
        case 'ougi':
        case 'summon':
        case 'seal':
        case 'awaken': return 'roar';
        case 'chain': return null;
        default:
    }
    switch (atk) {
        case 'claw': return 'claw';
        case 'breath': return 'breath';
        case 'tail': return 'tail';
        case 'meteor': return 'cast'; // 空へ向けて隕石を呼ぶ
        case 'nova': return 'roar';
        default: return null; // treasure
    }
}
// ---------------- 重ね描きの部品 ----------------
function glowAt(ctx, x, y, r, c0, c1, a) {
    if (a <= 0 || r <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c0);
    g.addColorStop(0.45, c1 + 'c0');
    g.addColorStop(1, c1 + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
}
/** ふわっと広がって消える煙の粒（進行度 t だけで決まる） */
function puffs(ctx, x, y, o) {
    if (o.alpha <= 0 || o.n <= 0)
        return;
    ctx.save();
    for (let i = 0; i < o.n; i++) {
        const u = fract(o.t * (o.speed ?? 1) + i / o.n + hash(i, o.seed ?? 0) * 0.3);
        const px = x + o.dx * u + (hash(i, 3 + (o.seed ?? 0)) - 0.5) * (o.spread ?? 6);
        const py = y + o.dy * u + (hash(i, 7 + (o.seed ?? 0)) - 0.5) * (o.spread ?? 6) * 0.6;
        const r = lerp(o.r0, o.r1, u);
        ctx.globalAlpha = Math.min(1, o.alpha) * (1 - u) * (u < 0.1 ? u * 10 : 1);
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(Math.round(px), Math.round(py), Math.max(0.6, r), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}
function dustRing(ctx, x, y, k, size, color = '#c8b48a') {
    if (k <= 0 || k >= 1)
        return;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + k * size, 3 + k * size * 0.28, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU, rr = 6 + k * size * 0.9;
        ctx.globalAlpha = (1 - k) * 0.6;
        const s = 2 + (1 - k) * 3;
        ctx.fillRect(Math.round(x + Math.cos(ang) * rr - s / 2), Math.round(y + Math.sin(ang) * rr * 0.3 - k * 10 - s / 2), Math.round(s), Math.round(s));
    }
    ctx.restore();
}
function sparkle(ctx, x, y, r, color, a) {
    if (a <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - r), Math.round(y), Math.round(r * 2), 1);
    ctx.fillRect(Math.round(x), Math.round(y - r), 1, Math.round(r * 2));
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
    ctx.restore();
}
/** ブレス: 息を吸って胸がふくらむ → 口の奥が光り、煙がもれる → ぐっと溜めて → 吐き出して反動 */
function breath({ kind, p, S }) {
    const m = identity();
    m.move = 'breath';
    const inh = ease(win(p, 0.04, 0.34)), hold = win(p, 0.28, 0.4), wind = win(p, 0.28, 0.4), rel = win(p, 0.38, 0.44), strike = bump(p, 0.38, 0.5);
    const out = 1 - win(p, 0.46, 0.6); // 吐き終わり
    const k = Math.max(inh * 0.75, hold) * (1 - rel) * (p < 0.46 ? 1 : 0); // 溜まり具合
    m.pose = { eye: p > 0.18 && p < 0.56 ? 'angry' : 'open', lean: -3 * Math.max(inh * 0.6, wind) + 4 * strike, mouth: Math.min(2, Math.max(0.55 * inh, wind) * (p < 0.46 ? 1 : out) + strike), wing: 2 * Math.max(inh * 0.5, wind) * (p < 0.46 ? 1 : out) };
    m.sy = 1 + 0.06 * inh * (1 - rel) - 0.03 * strike;
    m.sx = 1 - 0.03 * inh * (1 - rel) + 0.04 * strike;
    m.dx = -2 * inh * (1 - rel) - 4 * bump(p, 0.4, 0.52); // 吐くときの反動
    m.tremble = 0.5 * hold * (1 - rel) * (1 - win(p, 0.42, 0.46));
    const open = p > 0.1 && p < 0.58;
    // 種類ごとの形: 山はいっしょ（口に力が集まって、吐く）で、出てくるもの（光・煙）が違う
    if (kind === 'vampire') {
        m.pose.wing = 2 * Math.max(inh, wind) * (p < 0.46 ? 1 : out);
        m.pose.mouth = Math.min(1, m.pose.mouth ?? 0);
        m.sy = 1 + 0.03 * inh;
        m.sx = 1 + 0.06 * inh * (1 - rel);
    }
    if (kind === 'golem') {
        m.pose.wing = 2 * Math.max(inh, wind) * (p < 0.46 ? 1 : out);
        m.pose.lean = -2 * inh + 3 * strike;
        m.dy = -3 * inh * (1 - rel);
    }
    if (kind === 'kraken') {
        m.pose.wing = 2 * inh * (1 - rel) + 1 * strike;
        m.sy = 1 - 0.04 * inh * (1 - rel) + 0.05 * strike;
    }
    if (kind === 'goblin') {
        m.pose.wing = 2 * Math.max(inh, wind);
        m.pose.mouth = Math.min(2, 0.4 + 1.2 * Math.max(inh, strike));
        m.dy = -2 * bump(p, 0.1, 0.4);
    }
    m.fx = (ctx, layer, at) => {
        if (!open)
            return;
        const mo = at(S.mouth[0], S.mouth[1]);
        if (layer === 'front') {
            const big = 3 + 10 * k + Math.sin(p * 90) * 1.2 * k;
            if (kind === 'golem') {
                const e = at(S.eye[0], S.eye[1]);
                glowAt(ctx, e.x, e.y, 4 + 11 * k, S.glow[0], S.glow[1], 0.9 * k);
            }
            else if (kind === 'goblin') { // 号令: 声の輪が口から広がる
                for (let i = 0; i < 3; i++) {
                    const u = fract(p * 3 + i / 3);
                    ctx.save();
                    ctx.globalAlpha = (1 - u) * 0.8 * Math.min(1, k * 2 + strike);
                    ctx.strokeStyle = '#fff2b0';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(mo.x + 3, mo.y, 4 + u * 20, -0.9, 0.9);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            else if (kind === 'vampire') {
                const e = at(S.eye[0], S.eye[1]);
                glowAt(ctx, e.x, e.y, 3 + 4 * k, S.glow[0], S.glow[1], 0.9 * k);
                glowAt(ctx, mo.x, mo.y, big * 0.7, S.glow[0], S.glow[1], 0.5 * k);
            }
            else
                glowAt(ctx, mo.x, mo.y, big, S.glow[0], S.glow[1], 0.95 * Math.min(1, k * 1.4));
        }
        // 煙・息・泡・かけら
        const t = p;
        const lay = layer === 'front';
        if (kind === 'dragon' && lay)
            puffs(ctx, mo.x - 2, mo.y - 2, { n: 6 + Math.round(8 * k), t: t * 2.4, dx: -8, dy: -30, spread: 6, r0: 2, r1: 7, color: S.smoke, alpha: 0.95 * Math.min(1, k * 2), seed: 1 });
        if (kind === 'giant' && lay)
            puffs(ctx, mo.x, mo.y + 1, { n: 5 + Math.round(5 * k), t: t * 2, dx: 6, dy: 14, spread: 5, r0: 1.5, r1: 6, color: S.smoke, alpha: 0.8 * Math.min(1, k * 2), seed: 2 });
        if (kind === 'spider' && lay) { // 糸のしずく: 牙の先から白い糸がたれる
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 0.8 * Math.min(1, k * 2);
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const u = fract(t * 2 + i / 4);
                ctx.beginPath();
                ctx.moveTo(Math.round(mo.x + i * 2 - 3), Math.round(mo.y));
                ctx.lineTo(Math.round(mo.x + i * 2 - 3 + 1), Math.round(mo.y + 5 + 10 * u));
                ctx.stroke();
            }
            ctx.restore();
        }
        if (kind === 'kraken' && lay)
            puffs(ctx, mo.x, mo.y - 2, { n: 5 + Math.round(5 * k), t: t * 2, dx: 4, dy: -22, spread: 7, r0: 1, r1: 3.2, color: S.smoke, alpha: 0.8 * Math.min(1, k * 2), seed: 3 });
        if (kind === 'golem') {
            const f = at(48, 79);
            puffs(ctx, f.x, f.y, { n: 6 + Math.round(6 * k), t: t * 2.6, dx: 0, dy: -18, spread: 36, r0: 1, r1: 4, color: S.smoke, alpha: 0.6 * Math.min(1, k * 2), seed: 4 }); // 砂ぼこりと小石が浮く
        }
        if (kind === 'vampire') {
            const b = at(48, 70);
            if (!lay)
                puffs(ctx, b.x, b.y, { n: 8, t: t * 1.6, dx: 4, dy: -34, spread: 44, r0: 3, r1: 8, color: S.smoke, alpha: 0.5 * Math.min(1, k * 2.5), seed: 5 });
            if (lay && p > 0.38 && p < 0.58) { // 蝙蝠の群れが飛び出す
                const u = win(p, 0.38, 0.58);
                ctx.save();
                ctx.fillStyle = '#1a0a24';
                for (let i = 0; i < 9; i++) {
                    const bx = lerp(b.x, b.x + 150, u * (0.6 + hash(i) * 0.7)), by = b.y - 28 + (hash(i, 2) - 0.5) * 50 - Math.sin(u * 6 + i) * 4;
                    ctx.globalAlpha = 1 - u * 0.5;
                    const f = Math.sin(p * 80 + i) > 0 ? -2 : 2;
                    ctx.fillRect(Math.round(bx - 3), Math.round(by + f * 0.5), 2, 1);
                    ctx.fillRect(Math.round(bx + 2), Math.round(by + f * 0.5), 2, 1);
                    ctx.fillRect(Math.round(bx - 1), Math.round(by), 3, 2);
                }
                ctx.restore();
            }
        }
        if (kind === 'goblin' && lay) {
            const h = at(60, 6);
            sparkle(ctx, h.x + 6, h.y - 4, 3 + 3 * k, '#fff2b0', k);
            sparkle(ctx, h.x - 10, h.y - 2, 2 + 2 * k, '#feae34', k * 0.8);
        }
        // 吐く瞬間の煙の吹き出し
        if (strike > 0 && lay && kind !== 'golem' && kind !== 'goblin' && kind !== 'vampire')
            puffs(ctx, mo.x + 2, mo.y, { n: 8, t: (p - 0.38) * 5, speed: 1, dx: 26, dy: -4, spread: 8, r0: 2, r1: 7, color: S.smoke, alpha: 0.7 * strike, seed: 6 });
    };
    return m;
}
/** 爪・牙・拳: かがんで構える → 一気に踏みこむ（のびて、残像・土ぼこり） */
function claw({ kind, p, S }) {
    const m = identity();
    m.move = 'claw';
    const wind = ease(win(p, 0.1, 0.36)), strike = bump(p, 0.38, 0.5), ww = win(p, 0.28, 0.4);
    m.pose = { eye: p > 0.1 && p < 0.58 ? 'angry' : 'open', lean: -4 * ww + 12 * strike, wing: 1 };
    m.dx = -6 * ww + 34 * strike;
    m.sy = 1 - 0.07 * wind * (1 - win(p, 0.38, 0.42));
    m.sx = 1 + 0.03 * wind + 0.1 * strike;
    m.rot = -0.04 * wind + 0.07 * strike;
    m.tremble = 0.5 * wind * (1 - win(p, 0.36, 0.4));
    m.ghosts = strike > 0.2 ? [{ dx: -9, alpha: 0.32 * strike }, { dx: -19, alpha: 0.2 * strike }, { dx: -29, alpha: 0.1 * strike }] : [];
    let trail = '#c8b48a';
    if (kind === 'golem') { // 拳の叩きつけ: 腕を高く振りかぶり、真上から叩きつける
        m.pose = { eye: m.pose.eye, lean: -6 * ww + 10 * strike, wing: 1.5 * wind * (1 - win(p, 0.4, 0.46)) };
        m.dy = -7 * wind * (1 - win(p, 0.38, 0.42));
        m.dx = 12 * strike;
        m.ghosts = [];
        m.sy = 1 + 0.03 * wind - 0.08 * strike;
        m.rot = 0;
        m.sx = 1 + 0.04 * strike;
    }
    else if (kind === 'goblin') { // 落とし穴: 跳び上がって、ドスンと踏みつける
        m.pose = { eye: m.pose.eye, lean: -3 * ww + 6 * strike, wing: 2 * wind, mouth: 1 };
        m.dy = -12 * bump(p, 0.24, 0.44);
        m.dx = 6 * strike;
        m.ghosts = [];
        m.sy = 1 - 0.07 * wind * (1 - win(p, 0.26, 0.3)) + 0.08 * bump(p, 0.28, 0.4) - 0.1 * bump(p, 0.42, 0.52);
        m.rot = 0;
    }
    else if (kind === 'giant') { // 氷柱の投げ槍: 大きくのけぞって、振りかぶって投げる
        m.pose = { eye: m.pose.eye, lean: -7 * ww + 8 * strike, wing: 2 * wind * (1 - win(p, 0.4, 0.46)) };
        m.dx = -3 * ww + 8 * strike;
        m.ghosts = [];
        m.rot = -0.06 * wind + 0.08 * strike;
        trail = '#e6f6ff';
    }
    else if (kind === 'kraken') { // 触手の薙ぎ: 触手を高く上げて、横ざまに振り下ろす
        m.pose = { eye: m.pose.eye, lean: 10 * strike, wing: 2 * wind * (1 - win(p, 0.4, 0.46)), mouth: strike };
        m.dx = 6 * strike;
        m.ghosts = [];
        m.sy = 1 - 0.05 * wind + 0.06 * strike;
        m.rot = 0.03 * strike;
        trail = '#bfe8ff';
    }
    else if (kind === 'spider') { // 毒牙: 腹ばいにかまえて、飛びかかって噛みつく
        m.pose = { eye: m.pose.eye, lean: -4 * ww + 12 * strike, wing: 2 * wind, mouth: 2 * strike + 0.5 * wind };
        m.sy = 1 - 0.1 * wind * (1 - win(p, 0.38, 0.42));
        m.dx = -4 * ww + 30 * strike;
        trail = '#9a8aa8';
    }
    else if (kind === 'vampire') { // 伸びる爪: すっと浮いて、滑るように踏みこむ（マントが広がる）
        m.pose = { eye: m.pose.eye, lean: -3 * ww + 10 * strike, wing: 1 + 1.5 * wind - 1 * strike, mouth: strike };
        m.dy = -4 * wind * (1 - win(p, 0.4, 0.5));
        m.sy = 1 + 0.02 * wind;
        trail = '#7a3a9a';
    }
    m.fx = (ctx, layer, at, foot) => {
        const lay = layer === 'front';
        if (!lay && wind > 0.15 && p < 0.4 && kind !== 'vampire') { // 足もとをかいて土ぼこり
            puffs(ctx, foot.x - 10, foot.y - 1, { n: 4, t: p * 3, dx: -10, dy: -8, spread: 8, r0: 1.5, r1: 4, color: trail, alpha: 0.55 * wind, seed: 8 });
        }
        if (!lay && strike > 0.05)
            puffs(ctx, foot.x - 14, foot.y - 1, { n: 7, t: (p - 0.38) * 6, dx: -20, dy: -4, spread: 8, r0: 2, r1: 6, color: trail, alpha: 0.7 * strike, seed: 9 });
        if (lay) {
            const e = at(S.eye[0], S.eye[1]);
            if (kind !== 'golem')
                glowAt(ctx, e.x, e.y, 3 + 3 * wind, '#ffffff', '#ff3040', 0.8 * wind * (1 - win(p, 0.46, 0.56)));
            if (kind === 'spider' && strike > 0.1) {
                const mo = at(S.mouth[0], S.mouth[1]);
                ctx.save();
                ctx.fillStyle = '#7bed9f';
                ctx.globalAlpha = strike;
                for (let i = 0; i < 3; i++)
                    ctx.fillRect(Math.round(mo.x + i * 3 - 2), Math.round(mo.y + 4 + win(p, 0.4, 0.52) * 10 * (1 + i * 0.3)), 2, 3);
                ctx.restore();
            }
        }
        if (kind === 'golem' || kind === 'goblin')
            dustRing(ctx, foot.x + (kind === 'golem' ? 40 : 30), foot.y, win(p, 0.42, 0.58), 36);
        if (kind === 'kraken' && strike > 0.1 && lay)
            puffs(ctx, foot.x + 40, foot.y - 14, { n: 8, t: (p - 0.4) * 5, dx: 14, dy: -22, spread: 22, r0: 1, r1: 3, color: '#d8f2ff', alpha: 0.8 * strike, seed: 10 });
    };
    return m;
}
/** 急降下・踏みつけ・投石・突き上げ: 種類ごとに跳ぶ・舞い上がる・踏み鳴らす */
function dive({ kind, p, S }) {
    const m = identity();
    m.move = 'dive';
    const crouch = ease(win(p, 0.06, 0.2)), land = win(p, 0.44, 0.5), settle = win(p, 0.5, 0.62);
    if (kind === 'giant' || kind === 'golem') { // 踏みつけ・地割れ: 足を高く上げ、跳び上がって、ドスン
        const rise = ease(win(p, 0.06, 0.3)), jump = bump(p, 0.3, 0.44);
        m.pose = { eye: p > 0.1 && p < 0.58 ? 'angry' : 'open', tail: 6 * rise * (1 - win(p, 0.36, 0.42)), lean: -2 * rise + 3 * land * (1 - settle), wing: kind === 'golem' ? 1.5 * rise * (1 - win(p, 0.4, 0.46)) : 0 };
        m.dy = -3 * rise * (1 - win(p, 0.36, 0.42)) - 20 * jump;
        m.sy = 1 - 0.06 * crouch * (1 - win(p, 0.26, 0.3)) + 0.05 * jump - 0.12 * bump(p, 0.42, 0.56);
        m.sx = 1 + 0.07 * bump(p, 0.42, 0.56);
        m.tremble = 0.6 * rise * (1 - win(p, 0.3, 0.34));
        m.shadow = 1 - 0.3 * jump;
        m.fx = (ctx, layer, _at, foot) => {
            if (layer === 'back') {
                dustRing(ctx, foot.x + 8, foot.y, win(p, 0.42, 0.6), 60);
                if (p > 0.42 && p < 0.58)
                    puffs(ctx, foot.x + 8, foot.y - 2, { n: 9, t: (p - 0.42) * 5, dx: 0, dy: -26, spread: 56, r0: 2, r1: 6, color: kind === 'giant' ? '#e6f6ff' : '#c8b48a', alpha: 0.7, seed: 11 });
            }
        };
        return m;
    }
    if (kind === 'goblin') { // 投石: 大きな石を抱えて振りかぶり、投げる（石はそのあと影になって降ってくる）
        const wind = ease(win(p, 0.08, 0.32)), thr = bump(p, 0.34, 0.46);
        m.pose = { eye: 'angry', lean: -5 * wind + 9 * thr, wing: 2 * wind * (1 - win(p, 0.36, 0.44)), mouth: 1 };
        m.sy = 1 - 0.05 * crouch * (1 - win(p, 0.26, 0.3)) + 0.04 * wind;
        m.dx = -3 * wind + 5 * thr;
        m.rot = -0.04 * wind + 0.06 * thr;
        m.tremble = 0.5 * wind * (1 - win(p, 0.34, 0.38));
        m.fx = (ctx, layer, at) => {
            if (layer !== 'front')
                return;
            const h = at(70, 10); // 頭の上に抱えた石
            const up = wind * (1 - win(p, 0.34, 0.4));
            if (up > 0) {
                ctx.save();
                ctx.globalAlpha = Math.min(1, up * 2);
                const r = 3 + 5 * up;
                ctx.fillStyle = '#6a5a4a';
                ctx.beginPath();
                ctx.arc(Math.round(h.x), Math.round(h.y - 6 - 8 * up), r, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#9a8a72';
                ctx.fillRect(Math.round(h.x - r * 0.5), Math.round(h.y - 6 - 8 * up - r * 0.6), 2, 2);
                ctx.restore();
            }
        };
        return m;
    }
    if (kind === 'kraken') { // 突き上げ: 海にもぐって力をためる → 下から一気に突き上げる
        const sink = ease(win(p, 0.06, 0.26)) * (1 - win(p, 0.3, 0.38)), thrust = bump(p, 0.34, 0.5);
        m.pose = { eye: 'angry', squash: 3 * sink, wing: 2 * thrust, lean: 8 * thrust, mouth: thrust };
        m.dy = 8 * sink - 22 * thrust;
        m.sy = 1 - 0.05 * sink + 0.1 * thrust;
        m.sx = 1 + 0.03 * sink - 0.05 * thrust;
        m.shadow = 1 - 0.2 * thrust;
        m.tremble = 0.8 * sink;
        m.fx = (ctx, layer, _a, foot) => {
            if (layer === 'back' && p > 0.06 && p < 0.6)
                puffs(ctx, foot.x + 4, foot.y - 4, { n: 8, t: p * 3, dx: 0, dy: -20, spread: 70, r0: 1, r1: 3, color: '#d8f2ff', alpha: 0.5 * (sink + thrust), seed: 12 });
            if (layer === 'back')
                dustRing(ctx, foot.x + 8, foot.y - 4, win(p, 0.4, 0.58), 64, '#bfe8ff');
        };
        return m;
    }
    // 舞い上がる（竜・伯爵）／糸で登る（蜘蛛）: かがんで跳び、画面の外へ。着地は影が落ちたあと、もとの場所へ
    const up = ease(win(p, 0.18, 0.34)), away = p > 0.32 && p < 0.44;
    const drop = ease(win(p, 0.44, 0.5));
    const height = p < 0.44 ? up : 1 - drop; // 0（地面）〜 1（画面の外）
    m.dy = -190 * height;
    m.pose = { eye: 'angry', wing: kind === 'dragon' || kind === 'vampire' ? 2 * bump(p, 0.14, 0.5) + Math.sin(p * 70) * 1.2 * (up > 0 && drop < 1 ? 1 : 0) : 1.5 * bump(p, 0.1, 0.5), lean: -3 * crouch * (1 - up) + 4 * land * (1 - settle), mouth: kind === 'dragon' ? 1 : 0 };
    m.sy = 1 - 0.14 * crouch * (1 - win(p, 0.16, 0.2)) + 0.12 * up * (1 - win(p, 0.3, 0.34)) - 0.16 * bump(p, 0.47, 0.6);
    m.sx = 1 + 0.09 * crouch * (1 - win(p, 0.16, 0.2)) - 0.06 * up * (1 - win(p, 0.3, 0.34)) + 0.12 * bump(p, 0.47, 0.6);
    m.tremble = 0.5 * crouch * (1 - win(p, 0.16, 0.2));
    m.shadow = Math.max(0.15, 1 - 0.85 * height);
    if (away && p > 0.34 && p < 0.44)
        m.alpha = 1; // 画面の外にいる
    m.fx = (ctx, layer, at, foot) => {
        if (layer === 'back') {
            dustRing(ctx, foot.x + 6, foot.y, win(p, 0.18, 0.34), 40); // 飛び立つとき
            dustRing(ctx, foot.x + 6, foot.y, win(p, 0.46, 0.62), 56); // 着地
            if (kind === 'spider' && height > 0.02) {
                ctx.save();
                ctx.strokeStyle = '#e4e7f0';
                ctx.globalAlpha = 0.9;
                ctx.lineWidth = 1;
                const b = at(48, 30);
                ctx.beginPath();
                ctx.moveTo(Math.round(b.x), -10);
                ctx.lineTo(Math.round(b.x), Math.round(b.y));
                ctx.stroke();
                ctx.restore();
            } // 糸
        }
        if (layer === 'front' && kind === 'vampire' && p > 0.14 && p < 0.56) { // 蝙蝠になって舞い上がる
            const b = at(48, 40);
            ctx.save();
            ctx.fillStyle = '#1a0a24';
            for (let i = 0; i < 10; i++) {
                const u = fract(p * 1.5 + i / 10);
                const bx = b.x + (hash(i) - 0.5) * 70, by = b.y - u * 110 + Math.sin(p * 60 + i) * 3;
                ctx.globalAlpha = (1 - u) * 0.9;
                ctx.fillRect(Math.round(bx - 3), Math.round(by), 2, 1);
                ctx.fillRect(Math.round(bx + 2), Math.round(by), 2, 1);
                ctx.fillRect(Math.round(bx - 1), Math.round(by), 3, 2);
            }
            ctx.restore();
        }
        if (layer === 'front' && kind === 'dragon' && p > 0.18 && p < 0.34) { // 羽ばたきの風
            ctx.save();
            ctx.strokeStyle = '#e8d5a8';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const u = fract(p * 6 + i / 6);
                ctx.globalAlpha = (1 - u) * 0.7;
                const x = foot.x - 30 + i * 12, y = foot.y - 6 - u * 12;
                ctx.beginPath();
                ctx.moveTo(Math.round(x), Math.round(y));
                ctx.lineTo(Math.round(x + 8), Math.round(y));
                ctx.stroke();
            }
            ctx.restore();
        }
    };
    return m;
}
/** 尾・脚・腕・棍棒・突進: 種類ごとに「薙ぎはらう」。竜は背を向けて尾をふる */
function tail({ kind, p, S }) {
    const m = identity();
    m.move = 'tail';
    const wind = ease(win(p, 0.06, 0.34)), sw = bump(p, 0.36, 0.5), ww = win(p, 0.26, 0.38);
    m.pose = { eye: p > 0.08 && p < 0.58 ? 'angry' : 'open' };
    if (kind === 'dragon') { // 振り向いて背を向け、尾を高く持ち上げて、ぶん！と振る → 向きなおる
        const turn = ease(win(p, 0.08, 0.22)) * (1 - ease(win(p, 0.5, 0.62)));
        m.face = Math.cos(Math.PI * turn);
        m.pose = { eye: m.pose.eye, tail: -3 * wind * (1 - win(p, 0.36, 0.4)) + 6 * sw, lean: -2 * wind, wing: 1 };
        m.sy = 1 + 0.03 * bump(p, 0.08, 0.22) - 0.04 * sw;
        m.dy = -2 * bump(p, 0.08, 0.22);
        m.rot = turn > 0.9 ? -0.05 * wind * (1 - win(p, 0.36, 0.4)) + 0.12 * sw : 0;
        m.dx = 8 * sw;
        m.tremble = 0.5 * wind * (1 - win(p, 0.36, 0.4)) * (turn > 0.9 ? 1 : 0);
        m.fx = (ctx, layer, at, foot) => {
            if (layer === 'back') {
                dustRing(ctx, foot.x + 6, foot.y, win(p, 0.4, 0.56), 50);
                if (sw > 0.1)
                    puffs(ctx, foot.x + 30, foot.y - 4, { n: 8, t: (p - 0.38) * 6, dx: 30, dy: -6, spread: 10, r0: 2, r1: 6, color: '#c8b48a', alpha: 0.7 * sw, seed: 13 });
            }
            if (layer === 'front' && turn > 0.9 && wind > 0.2 && p < 0.4) {
                const t = at(8, 44);
                sparkle(ctx, t.x, t.y - 6, 3 + 3 * wind, '#ffffff', 0.6 * wind);
            } // 尾のとげがきらり
        };
    }
    else if (kind === 'giant') { // 棍棒の薙ぎ払い: 大きく振りかぶって、一回転してなぎ払う
        const spin = win(p, 0.3, 0.5);
        m.face = spin > 0 && spin < 1 ? Math.cos(spin * TAU) : 1;
        m.pose = { eye: m.pose.eye, lean: -6 * wind * (1 - win(p, 0.3, 0.34)), wing: 2 * wind * (1 - win(p, 0.3, 0.36)) };
        m.dx = 14 * sw;
        m.sy = 1 - 0.05 * wind * (1 - win(p, 0.3, 0.34));
        m.rot = -0.05 * wind * (1 - win(p, 0.3, 0.34));
        m.tremble = 0.5 * wind * (1 - win(p, 0.3, 0.34));
        m.ghosts = sw > 0.3 ? [{ dx: 8, alpha: 0.25 * sw }, { dx: 16, alpha: 0.15 * sw }] : [];
        m.fx = (ctx, layer, _a, foot) => { if (layer === 'back') {
            dustRing(ctx, foot.x + 8, foot.y, win(p, 0.38, 0.56), 50, '#e6f6ff');
        } };
    }
    else if (kind === 'goblin') { // 突進: 地面をかいて、全軍で駆けぬける（砂ぼこりと残像）
        const dash = win(p, 0.34, 0.44) * (1 - win(p, 0.46, 0.6));
        m.pose = { eye: m.pose.eye, lean: -4 * wind * (1 - win(p, 0.34, 0.38)) + 10 * dash, wing: 1.5 * wind, mouth: 1 };
        m.dx = -6 * wind * (1 - win(p, 0.34, 0.38)) + 64 * dash;
        m.sy = 1 - 0.07 * wind * (1 - win(p, 0.32, 0.36));
        m.sx = 1 + 0.08 * dash;
        m.rot = 0.05 * dash;
        m.tremble = 0.6 * wind * (1 - win(p, 0.32, 0.36));
        m.ghosts = dash > 0.15 ? [{ dx: -10, alpha: 0.3 * dash }, { dx: -22, alpha: 0.2 * dash }, { dx: -34, alpha: 0.1 * dash }] : [];
        m.fx = (ctx, layer, _a, foot) => { if (layer === 'back') {
            if (wind > 0.2 && p < 0.36)
                puffs(ctx, foot.x - 12, foot.y - 1, { n: 5, t: p * 3, dx: -12, dy: -8, spread: 10, r0: 1.5, r1: 4, color: '#c8b48a', alpha: 0.6 * wind, seed: 14 });
            if (dash > 0.05)
                puffs(ctx, foot.x + 20 * dash, foot.y - 1, { n: 9, t: p * 5, dx: -50, dy: -6, spread: 10, r0: 2, r1: 7, color: '#c8b48a', alpha: 0.75 * dash, seed: 15 });
        } };
    }
    else if (kind === 'spider') { // 脚の薙ぎはらい: 前脚を高く掲げ、横ざまに振り抜く
        m.pose = { eye: m.pose.eye, wing: 2 * wind * (1 - win(p, 0.38, 0.46)) + 0, lean: -3 * ww * (1 - win(p, 0.38, 0.4)) + 9 * sw, tail: 2 * sw };
        m.dy = -3 * wind * (1 - win(p, 0.36, 0.4));
        m.dx = 12 * sw;
        m.rot = -0.05 * wind * (1 - win(p, 0.36, 0.4)) + 0.09 * sw;
        m.sx = 1 + 0.08 * sw;
        m.tremble = 0.5 * wind * (1 - win(p, 0.36, 0.4));
        m.ghosts = sw > 0.25 ? [{ dx: -8, alpha: 0.25 * sw }, { dx: -16, alpha: 0.14 * sw }] : [];
        m.fx = (ctx, layer, _a, foot) => { if (layer === 'back')
            dustRing(ctx, foot.x + 8, foot.y, win(p, 0.4, 0.58), 54, '#9a8aa8'); };
    }
    else if (kind === 'kraken') { // 巻き取り: 触手が渦を巻いて、ぐるぐる回しながら引き寄せる
        m.pose = { eye: m.pose.eye, tail: 3 * Math.sin(p * 36) * wind + 3 * sw, wing: 1.5 * wind * (1 - win(p, 0.42, 0.5)), lean: 6 * sw, squash: 1.5 * wind * (1 - win(p, 0.36, 0.4)) };
        m.dx = 3 * Math.sin(p * 30) * wind * (1 - win(p, 0.36, 0.4)) + 8 * sw;
        m.sy = 1 - 0.04 * wind * (1 - win(p, 0.36, 0.4)) + 0.04 * sw;
        m.tremble = 0.5 * wind * (1 - win(p, 0.36, 0.4));
        m.fx = (ctx, layer, _a, foot) => { if (layer === 'back') {
            ctx.save();
            ctx.strokeStyle = '#d8f2ff';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                const u = fract(p * 2.5 + i / 3);
                ctx.globalAlpha = (1 - u) * 0.8 * (wind + sw) * (p < 0.6 ? 1 : 0);
                ctx.beginPath();
                ctx.ellipse(foot.x + 40, foot.y - 4, 12 + u * 56, 3 + u * 12, 0, 0, TAU);
                ctx.stroke();
            }
            ctx.restore();
        } };
    }
    else if (kind === 'golem') { // 腕の薙ぎ払い: 両腕を大きく引いて、どっしり腰を回して払う
        m.pose = { eye: m.pose.eye, lean: -6 * wind * (1 - win(p, 0.34, 0.38)) + 10 * sw, wing: 2 * wind * (1 - win(p, 0.4, 0.46)), tail: 3 * sw };
        m.dx = 14 * sw;
        m.rot = -0.04 * wind * (1 - win(p, 0.34, 0.38)) + 0.07 * sw;
        m.sy = 1 + 0.03 * wind * (1 - win(p, 0.34, 0.38));
        m.tremble = 0.6 * wind * (1 - win(p, 0.34, 0.38));
        m.ghosts = sw > 0.3 ? [{ dx: -8, alpha: 0.2 * sw }] : [];
        m.fx = (ctx, layer, _a, foot) => { if (layer === 'back') {
            dustRing(ctx, foot.x + 10, foot.y, win(p, 0.4, 0.58), 56);
            if (sw > 0.1)
                puffs(ctx, foot.x + 30, foot.y - 2, { n: 8, t: (p - 0.38) * 5, dx: 26, dy: -6, spread: 12, r0: 2, r1: 6, color: '#c8b48a', alpha: 0.7 * sw, seed: 16 });
        } };
    }
    else { // vampire 背後の霧: 霧にほどけて消え、霧の流れの先（背後）で姿をあらわして切りつける
        const fade = win(p, 0.08, 0.24), back = win(p, 0.34, 0.4), strike2 = bump(p, 0.4, 0.5), home = win(p, 0.5, 0.58);
        m.alpha = p < 0.34 ? 1 - fade : p < 0.5 ? back * (1 - win(p, 0.46, 0.5)) : win(p, 0.52, 0.6);
        m.dx = p < 0.34 ? 0 : p < 0.5 ? 120 : 0;
        m.face = p >= 0.34 && p < 0.5 ? -1 : 1; // 背後では、こちらへ向きなおる
        m.pose = { eye: 'angry', wing: 1.5 * fade * (1 - back), lean: 8 * strike2, mouth: strike2 };
        m.sy = 1 - 0.02 * fade;
        m.tremble = 0.5 * fade * (1 - back);
        m.fx = (ctx, layer, _a, foot) => {
            if (layer === 'back' && p > 0.06 && p < 0.62) {
                const dens = Math.max(fade * (1 - back), win(p, 0.46, 0.5) * (1 - home), home * (1 - win(p, 0.58, 0.62)));
                puffs(ctx, foot.x + (p < 0.34 ? 0 : p < 0.5 ? 120 : 0), foot.y - 26, { n: 12, t: p * 3, dx: 0, dy: -16, spread: 46, r0: 3, r1: 9, color: S.smoke, alpha: 0.7 * dens, seed: 17 });
                if (p > 0.2 && p < 0.38)
                    puffs(ctx, foot.x + 20, foot.y - 14, { n: 14, t: (p - 0.2) * 3, dx: 110, dy: 0, spread: 22, r0: 3, r1: 8, color: S.smoke, alpha: 0.55, seed: 18 }); // 霧が背後へ流れる
            }
        };
    }
    return m;
}
/** 隙あり！: ふらつき・目をまわして、口が開きっぱなし（頭のまわりに星） */
function daze({ p, S }) {
    const m = identity();
    m.move = 'daze';
    const k = ease(win(p, 0.04, 0.12)) * (1 - ease(win(p, 0.5, 0.6)));
    m.pose = { eye: k > 0.05 ? 'hurt' : 'open', mouth: k, wing: -1 * k, lean: -2 * k + Math.sin(p * 26) * 1.5 * k };
    m.rot = Math.sin(p * 22) * 0.05 * k;
    m.dx = Math.sin(p * 18) * 3 * k;
    m.sy = 1 - 0.03 * k + Math.sin(p * 44) * 0.01 * k;
    m.tremble = 0;
    m.fx = (ctx, layer, at) => {
        if (layer !== 'front' || k <= 0.05)
            return;
        const h = at(S.head[0], S.head[1] - 14);
        for (let i = 0; i < 3; i++) {
            const a = p * 14 + (i / 3) * TAU;
            sparkle(ctx, h.x + Math.cos(a) * 14, h.y + Math.sin(a) * 4, 2 + (Math.sin(a) > 0 ? 1 : 0), i % 2 ? '#fff2b0' : '#ffe27a', k);
        }
    };
    return m;
}
/** 霧の中: 姿がぼやけて揺れ（赤い目だけが光る）、霧を割って飛び出す */
function ambush({ kind, p, S }) {
    const m = identity();
    m.move = 'ambush';
    const hide = ease(win(p, 0.04, 0.16)) * (1 - ease(win(p, 0.34, 0.4))), lunge = bump(p, 0.38, 0.5);
    m.alpha = 1 - 0.7 * hide;
    m.dx = Math.sin(p * 20) * 8 * hide + 26 * lunge;
    m.dy = Math.sin(p * 13) * 1.5 * hide;
    m.rot = 0.06 * lunge;
    m.pose = { eye: 'angry', lean: -3 * hide + 10 * lunge, wing: 1 * hide, mouth: lunge };
    m.sx = 1 + 0.08 * lunge;
    m.ghosts = lunge > 0.2 ? [{ dx: -10, alpha: 0.25 * lunge }, { dx: -20, alpha: 0.12 * lunge }] : [];
    m.fx = (ctx, layer, at, foot) => {
        if (layer === 'back') {
            puffs(ctx, foot.x + 4, foot.y - 8, { n: 6, t: p * 1.5, dx: 0, dy: -14, spread: 54, r0: 3, r1: 8, color: '#c8d0e0', alpha: 0.4 * hide, seed: 19 });
            return;
        }
        const e = at(S.eye[0], S.eye[1]);
        glowAt(ctx, e.x, e.y, 3 + 3 * (hide + lunge), '#ffffff', kind === 'golem' ? '#30d0c0' : '#ff2030', 0.95 * Math.max(hide, lunge) * (0.7 + 0.3 * Math.sin(p * 60)));
    };
    void kind;
    return m;
}
/** 詠唱・大技の構え（呪い・隕石を呼ぶ）: ふわりと浮き、両腕（翼）を広げて、まわりに力が集まる → 解き放つ */
function cast({ kind, p, S }) {
    const m = identity();
    m.move = 'cast';
    const gather = ease(win(p, 0.04, 0.38)) * (1 - win(p, 0.42, 0.5)), rel = bump(p, 0.4, 0.52);
    m.pose = { eye: 'angry', wing: 2 * gather, lean: -3 * gather + 2 * rel, mouth: 0.5 + 0.5 * Math.sin(p * 40) * gather + rel };
    m.dy = -8 * gather * (kind === 'golem' || kind === 'giant' || kind === 'goblin' ? 0.4 : 1) + Math.sin(p * 18) * 1.2 * gather;
    m.sy = 1 + 0.03 * gather - 0.05 * rel;
    m.sx = 1 - 0.01 * gather + 0.06 * rel;
    m.shadow = 1 - 0.2 * gather;
    m.tremble = 0.4 * gather * (1 - win(p, 0.38, 0.42));
    m.fx = (ctx, layer, at, foot) => {
        const b = at(S.body[0], S.body[1]);
        if (layer === 'back') {
            glowAt(ctx, b.x, b.y, 34 + 10 * gather, '#ffe0ff', S.glow[1], 0.35 * gather + 0.3 * rel);
            return;
        }
        const h = at(S.head[0], S.head[1] - 6);
        for (let i = 0; i < 10; i++) { // 力が体に集まってくる
            const u = fract(p * 2.2 + i / 10), a = hash(i) * TAU, d = 50 * (1 - u);
            ctx.save();
            ctx.globalAlpha = gather * u;
            ctx.fillStyle = i % 2 ? '#ffffff' : S.glow[1];
            ctx.fillRect(Math.round(b.x + Math.cos(a) * d), Math.round(b.y - 4 + Math.sin(a) * d * 0.7), 2, 2);
            ctx.restore();
        }
        if (kind === 'golem') {
            const e = at(S.eye[0], S.eye[1]);
            glowAt(ctx, e.x, e.y, 5 + 8 * gather, S.glow[0], S.glow[1], 0.9 * gather);
        }
        else
            glowAt(ctx, h.x, h.y, 6 + 6 * gather, '#ffffff', S.glow[1], 0.55 * gather);
        void foot;
    };
    return m;
}
/** 大技の気配（咆哮）: 大きくのけぞって吠える → 力を放つ */
function roar({ kind, p, S }) {
    const m = identity();
    m.move = 'roar';
    const k = ease(win(p, 0.05, 0.36)) * (1 - win(p, 0.44, 0.58)), rel = bump(p, 0.38, 0.5);
    m.pose = { eye: 'angry', lean: -5 * k + 4 * rel, mouth: Math.min(2, 2 * k), wing: 2 * k };
    m.sy = 1 + 0.06 * k - 0.05 * rel;
    m.sx = 1 - 0.02 * k + 0.05 * rel;
    m.dy = -2 * k;
    m.tremble = 0.9 * k * (1 - win(p, 0.4, 0.46));
    m.dx = -2 * k;
    m.fx = (ctx, layer, at, foot) => {
        if (layer === 'back') {
            dustRing(ctx, foot.x + 6, foot.y, win(p, 0.4, 0.58), 54);
            return;
        }
        const mo = at(S.mouth[0], S.mouth[1]);
        for (let i = 0; i < 3; i++) {
            const u = fract(p * 2.6 + i / 3);
            ctx.save();
            ctx.globalAlpha = (1 - u) * k * 0.8;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(mo.x + 2, mo.y, 5 + u * 26, -0.8, 0.8);
            ctx.stroke();
            ctx.restore();
        }
        if (kind === 'golem') {
            const e = at(S.eye[0], S.eye[1]);
            glowAt(ctx, e.x, e.y, 5 + 9 * k, S.glow[0], S.glow[1], 0.9 * k);
        }
    };
    return m;
}
/** 幻術の声: 左右にゆらりと揺れながら、口を動かして歌う（声の輪が広がる） */
function sing({ p, S }) {
    const m = identity();
    m.move = 'sing';
    const k = ease(win(p, 0.02, 0.14)) * (1 - ease(win(p, 0.5, 0.62)));
    m.pose = { eye: 'open', mouth: k * (0.7 + 0.5 * Math.sin(p * 46)), wing: 1.2 * k * Math.sin(p * 16), lean: 1 * k * Math.sin(p * 12) };
    m.dx = Math.sin(p * 14) * 3 * k;
    m.rot = Math.sin(p * 14) * 0.035 * k;
    m.dy = Math.sin(p * 20) * 1 * k;
    m.fx = (ctx, layer, at) => {
        if (layer !== 'front' || k <= 0.05)
            return;
        const mo = at(S.mouth[0], S.mouth[1]);
        for (let i = 0; i < 4; i++) {
            const u = fract(p * 3 + i / 4);
            ctx.save();
            ctx.globalAlpha = (1 - u) * k * 0.8;
            ctx.strokeStyle = '#d9a8ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(mo.x + 2, mo.y, 4 + u * 24, -0.9, 0.9);
            ctx.stroke();
            ctx.restore();
        }
    };
    return m;
}
const MOVES = { breath, claw, dive, tail, daze, ambush, cast, roar, sing };
/** その時点のボスの動き。待機（phase が 0 の前後・動きなし）では恒等 */
export function bossMotion(kind, scene, atk, phase) {
    const mv = moveFor(scene, atk);
    if (!mv || phase <= 0 || phase >= 0.66)
        return identity();
    const m = MOVES[mv]({ kind, p: phase, S: STYLE[kind] });
    if (reducedMotion()) {
        m.tremble = 0;
        m.ghosts = [];
    }
    return m;
}
/** 絵の中の位置を、画面の位置にうつす関数（足もと foot = 絵の下の中心。体の動きを含める） */
export function makeAt(foot, m, bw, bh) {
    const c = Math.cos(m.rot), s = Math.sin(m.rot);
    const fx = m.face >= 0 ? 1 : -1, w = Math.max(0.12, Math.abs(m.face)) * m.sx;
    return (ax, ay) => {
        const lx = (ax - bw / 2) * w * fx, ly = (ay - (bh - 2)) * m.sy;
        return { x: foot.x + m.dx + lx * c - ly * s, y: foot.y + 2 + m.dy + lx * s + ly * c };
    };
}
//# sourceMappingURL=bossmotion.js.map