import { reducedMotion } from './motion.js';
import { bossOf, hasBoss } from './bossapi.js';
import { bump, dustRing, ease, fract, glowAt, hash, puffs, TAU, win } from './fxkit.js';
const identity = () => ({ move: null, pose: {}, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, face: 1, alpha: 1, tremble: 0, ghosts: [], shadow: 1, fx: null });
const modOf = (kind) => (hasBoss(kind) ? bossOf(kind).motion : undefined);
/** 場面 → 動き。ボスの種類ごとに、技の意味に合わせる（BossModule の motion.moveFor）。
 *  場面が「その場の出来事」（記憶・仲間の声など）のときは、ボスの攻撃の種類で決める */
export function moveFor(kind, scene, atk) {
    const base = baseMove(scene, atk), f = modOf(kind)?.moveFor;
    return f ? f(scene, atk, base) : base;
}
function baseMove(scene, atk) {
    switch (scene) {
        case 'breath': return 'breath';
        case 'claw': return 'claw';
        case 'parry': return 'claw';
        case 'rush': return 'claw';
        case 'tail': return 'tail';
        case 'dive': return 'dive';
        case 'opening': return 'daze';
        case 'fog': return 'ambush';
        case 'spell':
        case 'ougi':
        case 'summon':
        case 'seal':
        case 'awaken': return 'special';
        case 'illusion': return 'sing';
        case 'chain': return null;
        default:
    }
    switch (atk) {
        case 'claw': return 'claw';
        case 'breath': return 'breath';
        case 'tail': return 'tail';
        case 'meteor': return 'dive'; // そのボスの落とす技（落とす物・踏みつけ・突き上げ）
        case 'nova': return 'special';
        default: return null; // treasure
    }
}
// ---------------- 動き ----------------
/** ブレス: 息を吸って胸がふくらむ → 口の奥が光り、煙がもれる → ぐっと溜めて → 吐き出して反動。
 *  山はどのボスもいっしょ（口に力が集まって、吐く）で、出てくるもの（光・煙）がボスごとに違う */
function breath({ p, S }, o = {}) {
    const m = identity();
    m.move = 'breath';
    const inh = ease(win(p, 0.04, 0.34)), hold = win(p, 0.28, 0.4), wind = win(p, 0.28, 0.4), rel = win(p, 0.38, 0.44), strike = bump(p, 0.38, 0.5);
    const long = !!o.long;
    const out = 1 - (long ? win(p, 0.58, 0.65) : win(p, 0.46, 0.6)); // 吐き終わり
    const k = Math.max(inh * 0.75, hold) * (1 - rel) * (p < 0.46 ? 1 : 0); // 溜まり具合
    m.pose = { eye: p > 0.18 && p < 0.56 ? 'angry' : 'open', lean: -3 * Math.max(inh * 0.6, wind) + 4 * strike, mouth: Math.min(2, Math.max(0.55 * inh, wind) * (p < 0.46 ? 1 : out) + strike), wing: 2 * Math.max(inh * 0.5, wind) * (p < 0.46 ? 1 : out) };
    m.sy = 1 + 0.06 * inh * (1 - rel) - 0.03 * strike;
    m.sx = 1 - 0.03 * inh * (1 - rel) + 0.04 * strike;
    m.dx = -2 * inh * (1 - rel) - 4 * bump(p, 0.4, 0.52); // 吐くときの反動
    m.tremble = 0.5 * hold * (1 - rel) * (1 - win(p, 0.42, 0.46));
    const open = p > 0.1 && p < (long ? 0.65 : 0.58);
    const v = { p, inh, hold, wind, rel, strike, out, k, big: 3 + 10 * k + Math.sin(p * 90) * 1.2 * k };
    o.pose?.(m, v);
    m.fx = (ctx, layer, at) => {
        if (!open)
            return;
        const mo = at(S.mouth[0], S.mouth[1]);
        if (layer === 'front') {
            if (o.glow)
                o.glow(ctx, at, mo, v);
            else
                glowAt(ctx, mo.x, mo.y, v.big, S.glow[0], S.glow[1], 0.95 * Math.min(1, k * 1.4));
        }
        // 煙・息・泡・かけら
        o.extra?.(ctx, layer, at, mo, v);
        // 吐く瞬間の煙の吹き出し
        if (!o.noStrike && strike > 0 && layer === 'front')
            puffs(ctx, mo.x + 2, mo.y, { n: 8, t: (p - 0.38) * 5, speed: 1, dx: 26, dy: -4, spread: 8, r0: 2, r1: 7, color: S.smoke, alpha: 0.7 * strike, seed: 6 });
    };
    return m;
}
/** 爪・牙・拳: かがんで構える → 一気に踏みこむ（のびて、残像・土ぼこり） */
function claw({ p, S }, o = {}) {
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
    const trail = o.trail ?? '#c8b48a';
    const v = { p, wind, strike, ww };
    o.pose?.(m, v);
    m.fx = (ctx, layer, at, foot) => {
        const lay = layer === 'front';
        if (!lay && wind > 0.15 && p < 0.4 && !o.noScrape) { // 足もとをかいて土ぼこり
            puffs(ctx, foot.x - 10, foot.y - 1, { n: 4, t: p * 3, dx: -10, dy: -8, spread: 8, r0: 1.5, r1: 4, color: trail, alpha: 0.55 * wind, seed: 8 });
        }
        if (!lay && strike > 0.05)
            puffs(ctx, foot.x - 14, foot.y - 1, { n: 7, t: (p - 0.38) * 6, dx: -20, dy: -4, spread: 8, r0: 2, r1: 6, color: trail, alpha: 0.7 * strike, seed: 9 });
        if (lay) {
            const e = at(S.eye[0], S.eye[1]);
            if (!o.noEyeGlow)
                glowAt(ctx, e.x, e.y, 3 + 3 * wind, '#ffffff', '#ff3040', 0.8 * wind * (1 - win(p, 0.46, 0.56)));
        }
        o.extra?.(ctx, layer, at, foot, v);
    };
    return m;
}
/** 急降下・踏みつけ・落とす物・突き上げ（土台は、かがんで跳び、画面の外へ。着地は影が落ちたあと、もとの場所へ）。
 *  跳ぶ・舞い上がる・踏み鳴らす のどれにするかは、ボスごと */
function dive({ p }, o = {}) {
    const m = identity();
    m.move = 'dive';
    const crouch = ease(win(p, 0.06, 0.2)), land = win(p, 0.44, 0.5), settle = win(p, 0.5, 0.62);
    const sky = !!o.sky;
    const up = sky ? ease(win(p, 0.12, 0.26)) : ease(win(p, 0.18, 0.34)), away = p > 0.32 && p < 0.44;
    const drop = sky ? ease(win(p, 0.5, 0.56)) : ease(win(p, 0.44, 0.5));
    const height = p < (sky ? 0.5 : 0.44) ? up : 1 - drop; // 0（地面）〜 1（画面の外）
    m.dy = -190 * height;
    m.pose = { eye: 'angry', wing: 1.5 * bump(p, 0.1, 0.5), lean: -3 * crouch * (1 - up) + 4 * land * (1 - settle), mouth: 0 };
    const cr = sky ? ease(win(p, 0.03, 0.1)) * (1 - win(p, 0.1, 0.13)) : crouch * (1 - win(p, 0.16, 0.2)); // 跳ぶ前のかがみ
    const sq = sky ? bump(p, 0.53, 0.66) : bump(p, 0.47, 0.6); // 着地のつぶれ
    m.sy = 1 - 0.14 * cr + 0.12 * up * (1 - win(p, sky ? 0.22 : 0.3, sky ? 0.26 : 0.34)) - 0.16 * sq;
    m.sx = 1 + 0.09 * cr - 0.06 * up * (1 - win(p, sky ? 0.22 : 0.3, sky ? 0.26 : 0.34)) + 0.12 * sq;
    m.tremble = 0.5 * cr;
    m.shadow = Math.max(0.15, 1 - 0.85 * height);
    if (away && p > 0.34 && p < 0.44)
        m.alpha = 1; // 画面の外にいる
    const v = { p, height, up, drop };
    o.pose?.(m, v);
    m.fx = (ctx, layer, at, foot) => {
        if (layer === 'back') {
            dustRing(ctx, foot.x + 6, foot.y, sky ? win(p, 0.12, 0.28) : win(p, 0.18, 0.34), 40); // 飛び立つとき
            dustRing(ctx, foot.x + 6, foot.y, sky ? win(p, 0.54, 0.68) : win(p, 0.46, 0.62), 56); // 着地
        }
        o.extra?.(ctx, layer, at, foot, v);
    };
    return m;
}
/** 尾の場面の土台: 背後の手下を呼ぶ・送りだす身ぶり（背後から来る攻撃の場面。BossModule の backScene）。
 *  手下が背後にあらわれる 0.28 ごろに合図の山、襲いかかる 0.42 ごろは見守る（襲うのは小さな相手で、bosskit.ts の backRaid が描く）。
 *  どう呼ぶか（吠える・合図する など）と、尾の場面をほかの技（薙ぎ払い・霧・突進）にするかは、ボスごと */
function tail({ p }, o = {}) {
    const m = identity();
    m.move = 'tail';
    const wind = ease(win(p, 0.06, 0.24)), cue = bump(p, 0.2, 0.36), back = 1 - ease(win(p, 0.46, 0.6));
    const up = wind * (1 - win(p, 0.24, 0.3)) * back; // 振りかぶり・身を起こす
    m.pose = { eye: p > 0.08 && p < 0.56 ? 'angry' : 'open' };
    const v = { p, wind, cue, back, up };
    o.pose?.(m, v);
    m.fx = (ctx, layer, at, foot) => { o.extra?.(ctx, layer, at, foot, v); };
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
    // よろめきの星は、場面の演出（scenes.ts の openingFx）が描く
    void S;
    return m;
}
/** 霧の中: 姿がぼやけて揺れ（赤い目だけが光る）、霧を割って飛び出す */
function ambush({ p, S }) {
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
        glowAt(ctx, e.x, e.y, 3 + 3 * (hide + lunge), '#ffffff', S.eyeGlow, 0.95 * Math.max(hide, lunge) * (0.7 + 0.3 * Math.sin(p * 60)));
    };
    return m;
}
/** 詠唱・大技の構え（呪い・隕石を呼ぶ）: ふわりと浮き、両腕（翼）を広げて、まわりに力が集まる → 解き放つ */
function cast({ p, S }, o = {}) {
    const m = identity();
    m.move = 'cast';
    const gather = ease(win(p, 0.04, 0.38)) * (1 - win(p, 0.42, 0.5)), rel = bump(p, 0.4, 0.52);
    m.pose = { eye: 'angry', wing: 2 * gather, lean: -3 * gather + 2 * rel, mouth: 0.5 + 0.5 * Math.sin(p * 40) * gather + rel };
    // 浮くのは、飛べるボス（style.flies）だけ
    m.dy = S.flies ? -8 * gather + Math.sin(p * 18) * 1.2 * gather : 0;
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
        if (o.glow)
            o.glow(ctx, at, gather);
        else
            glowAt(ctx, h.x, h.y, 6 + 6 * gather, '#ffffff', S.glow[1], 0.55 * gather);
        void foot;
    };
    return m;
}
/** 呪い・大技・号令・隕石を呼ぶ構え: ボスの種類ごとに、技の意味に合わせて動く（BossModule の motion.moves.special）。
 *  土台は、力をためて震えるだけ（ボスごとの動きを書かないボスのため） */
function special({ p, scene }) {
    const m = identity();
    m.move = 'special';
    const k = ease(win(p, 0.05, 0.36)) * (1 - win(p, 0.44, 0.58));
    m.tremble = 0.5 * k * (1 - win(p, 0.38, 0.42));
    m.pose = { eye: 'angry' };
    void scene;
    return m;
}
/** 大技の気配（咆哮）: 大きくのけぞって吠える → 力を放つ */
function roar({ p, S }, o = {}) {
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
        o.extra?.(ctx, at, k);
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
            ctx.strokeStyle = S.voice;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(mo.x + 2, mo.y, 4 + u * 24, -0.9, 0.9);
            ctx.stroke();
            ctx.restore();
        }
    };
    return m;
}
const MOVES = { breath, claw, dive, tail, daze, ambush, cast, roar, sing, special };
/** その時点のボスの動き。待機（phase が 0 の前後・動きなし）では恒等 */
/** reach: ボスの足もとから、討伐隊の背後（いちばん右の冒険者の少し先）までの距離。ボスごとの動き（motion）が、背後まで届く演出に使う */
export function bossMotion(kind, scene, atk, phase, opts = {}) {
    const mv = moveFor(kind, scene, atk);
    if (!mv || phase <= 0 || phase >= 0.66)
        return identity();
    const q = { kind, p: phase, S: bossOf(kind).style, scene, reach: opts.reach ?? 120, blank: identity };
    const build = MOVES[mv];
    const base = (o) => build(q, o);
    const own = modOf(kind)?.moves?.[mv];
    const m = own ? own(q, base) : base();
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