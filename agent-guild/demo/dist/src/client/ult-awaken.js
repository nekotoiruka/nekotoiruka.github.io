import { Rng } from '../shared/rng.js';
import { drawHero } from './hero.js';
import { ULT_T, R, TAU, bolt, bump, clamp01, dim, dustCloud, ease, flash, glowArc, glowDisc, glowLine, groundRings, heroSilhouette, impactBurst, lerp, petals, rocks, slashArc, slashLine, sparkBurst, speedLines, starSpark, win } from './ultkit.js';
const T = ULT_T.awaken;
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const NO_GEAR = { back: [], fams: [], charms: [] };
const MAGIC = new Set(['wand', 'book', 'fan', 'guitar']);
const at = (home, q, extra = {}) => ({ ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra });
const endOf = (body) => ({ x: body.x - 62, y: body.y + 18 }); // 駆け抜けた先
const tgOf = (body) => ({ x: body.x + 2, y: body.y + 2 });
// 主役の姿に色を重ねる（いまの動きと同じ形で）。rise は足元から何割まで染めるか（1 で全身）。
// outline を渡すと、色ではなく1ドットの縁取りだけを描く（キャラの後ろに描いて、姿を隠さずにまとう光にする）
function onHero(a, hero, look, pose, col, alpha, o = {}) {
    if (!look || !pose || alpha <= 0 || pose.alpha <= 0)
        return;
    const { ctx } = a, x = hero.x + pose.ox, fy = hero.y + 1 + pose.oy;
    const draw = (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame + hero.f * 7, flip: pose.flip, action: pose.action, t: pose.t, rot: pose.rot, ring: false });
    ctx.save();
    if (o.rise !== undefined) {
        const top = Math.round(fy - 30 * o.rise);
        ctx.beginPath();
        ctx.rect(x - 40, top, 80, fy - top + 4);
        ctx.clip();
    }
    if (o.outline)
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
            heroSilhouette(ctx, draw, x + ox, fy + oy, 1, col, alpha * pose.alpha, 0);
    else
        heroSilhouette(ctx, draw, x, fy, 1, col, alpha * pose.alpha, 0);
    ctx.restore();
}
// 構え → 力の解放（宙に浮いて震える）→ 溜め（腰を落とす）。共通
function powerUp(p, frame, w) {
    if (p < T.ready - 0.02 || p >= T.home)
        return null;
    if (p < T.flare) {
        const k = win(p, T.ready - 0.02, T.flare);
        return { ...base, ox: Math.sin(frame * 1.9) * 0.9 * k, oy: 3 * ease(k), action: 'guard', t: k };
    }
    if (p < T.hold) {
        const k = win(p, T.flare, T.hold);
        return { ...base, ox: Math.sin(frame * 2.3) * 0.6, oy: -7 * ease(Math.min(1, k * 3)) + Math.sin(frame / 4), action: 'cast', t: 0.5 + 0.5 * Math.sin(frame / 3) };
    }
    if (p < T.blink) {
        const k = win(p, T.hold, T.blink);
        return { ...base, oy: 4 * ease(k), ox: -3 * ease(k), action: MAGIC.has(w) ? 'cast' : 'guard', t: 1 };
    }
    return null;
}
// 駆け抜ける（姿は消えて、残像だけが一直線に）→ 背を向けた残心 → 戻る
function dashThrough(p, home, body, frame, w) {
    const pu = powerUp(p, frame, w);
    if (pu || p < T.blink)
        return pu;
    const end = endOf(body);
    if (p < T.land) {
        const k = win(p, T.blink, T.land), q = (u) => ({ x: lerp(home.x, end.x, u), y: lerp(home.y, end.y, u) });
        return { ...base, alpha: 0, ghosts: Array.from({ length: 12 }, (_, j) => { const g = q(Math.max(0, k - j * 0.07)); return { x: g.x - home.x, y: g.y - home.y, a: 0.5 - j * 0.035, act: 'dash' }; }) };
    }
    if (p < T.hit + 0.05)
        return at(home, end, { action: 'attack', t: 0.9, flip: false });
    const k = win(p, T.hit + 0.05, T.home);
    return at(home, { x: lerp(end.x, home.x, ease(k)), y: lerp(end.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: true });
}
function awakenCam(p, home, body) {
    const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.08, T.home));
    if (g <= 0)
        return null;
    if (p < T.blink)
        return [g, 1.7 + 0.2 * win(p, T.flare, T.hold), home.x - 4, home.y - 26];
    if (p < T.hit)
        return [g, 1.1, body.x + 24, body.y - 14];
    return [g, 1.4, body.x - 6, body.y - 14];
}
// 「覚醒！」の文字
// 光る目（顔の位置）
function eyes(ctx, hero, col, k, frame) {
    if (k <= 0)
        return;
    const x = hero.x - 3, y = hero.y - 17;
    glowDisc(ctx, x, y, 7, col, k * (0.7 + 0.3 * Math.sin(frame / 2)), 1);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = col;
    ctx.fillRect(R(x - 2), R(y), 2, 1);
    ctx.fillRect(R(x + 1), R(y), 2, 1);
    ctx.restore();
    // 目から流れる光の尾
    glowLine(ctx, x + 2, y, x + 12, y - 2, 1, col, k * 0.6);
}
// 駆け抜けた一直線の光の筋（共通）
function streak(a, hero, cols, wMax = 5) {
    const { ctx, phase: p } = a;
    const end = endOf(a.body), bk = win(p, T.blink, T.land);
    if (bk <= 0 || p >= T.hit + 0.04)
        return;
    const hx = hero.x, hy = hero.y;
    const x1 = lerp(hx, end.x, ease(bk)), y1 = lerp(hy, end.y, ease(bk)) - 14, al = 1 - win(p, T.land, T.hit);
    glowLine(ctx, hx, hy - 14, x1, y1, wMax * (1 - bk * 0.6), cols[0], al);
    for (let i = 0; i < 5; i++)
        glowLine(ctx, hx, hy - 14 + (i - 2) * 6, lerp(hx, x1, 0.9), lerp(hy - 14, y1, 0.9) + (i - 2) * 6, 0.8, cols[1], al * 0.5);
}
// =====================================================================
// 闇の覚醒（dark）
// =====================================================================
const DK = ['#a55bd8', '#e2c2ff'];
const dark = {
    pose: (p, home, _f, body, frame, w) => dashThrough(p, home, body, frame, w),
    cam: (p, home, _f, body) => awakenCam(p, home, body),
    beats: () => [{ t: T.flare, stop: 0, shake: 3, sfx: 'awakenFlare' }, { t: T.flare + 0.02, stop: 0, shake: 1, sfx: 'rumble' }, { t: T.blink, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.hit, stop: 0.008, shake: 8, sfx: 'impactBlade' }, { t: T.hit + 0.02, stop: 0.001, shake: 3, sfx: 'slash' }, { t: T.hit + 0.06, stop: 0, shake: 2, sfx: 'rumble' }],
    back(a, hero, w) {
        const p = a.phase, fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        glowDisc(a.ctx, hero.x, hero.y - 14, 30 * fk, '#5a2a8a', fk * 0.6, 0.2);
        void w;
    },
    top(a, hero, w, look) {
        const { ctx, phase: p } = a;
        // 世界が闇に沈む
        dim(a, 0.7 * win(p, T.ready, T.flare) * (1 - win(p, T.hit + 0.04, T.hit + 0.14)), '#05000a');
        // 体が足元から少しずつ闇に染まる（染まった所は黒紫、境目に紫の光の縁）。全身が染まると、赤い目がひらく
        const pose = dashThrough(p, { x: hero.x, y: hero.y }, a.body, a.frame, w);
        const rise = ease(win(p, T.ready - 0.01, T.hold - 0.02)), keep = 1 - win(p, T.hit + 0.05, T.hit + 0.12);
        if (rise > 0 && keep > 0 && p < T.blink) {
            onHero(a, hero, look, pose, DK[0], keep, { rise, outline: true }); // 染まった所は、紫の縁取りで形が見えるように
            onHero(a, hero, look, pose, '#1a0a26', 0.92 * keep, { rise });
            if (rise < 1) { // 染まっていく境目（紫に光る1ドットの帯）
                const fy = hero.y + 1 + (pose?.oy ?? 0), y = Math.round(fy - 30 * rise);
                ctx.save();
                ctx.beginPath();
                ctx.rect(hero.x - 40, y - 1, 80, 2);
                ctx.clip();
                onHero(a, hero, look, pose, DK[0], 1);
                ctx.restore();
                sparkBurst(ctx, hero.x + (pose?.ox ?? 0), y, (p * 30) % 1, `${a.seed}:dkedge${Math.floor(p * 30)}`, [DK[0], DK[1], '#14081e'], 8, 14, -20, 1);
            }
        }
        if (p >= T.hit && keep > 0) {
            onHero(a, hero, look, pose, DK[0], keep, { outline: true });
            onHero(a, hero, look, pose, '#1a0a26', 0.92 * keep);
        } // 駆け抜けたあとの残心も、闇をまとったまま
        // 紫黒の炎（体から立ちのぼる。染まった高さまで）
        const fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        if (fk > 0) {
            const rng = new Rng(`${a.seed}:darkflame`);
            ctx.save();
            for (let i = 0; i < 40; i++) {
                const t = (p * 7 + rng.next()) % 1, x = hero.x + rng.range(-12, 12) * (1 - t * 0.5) + Math.sin(t * 8 + i) * 3, y = hero.y - t * 60 * Math.max(0.3, rise);
                ctx.globalAlpha = fk * (1 - t);
                ctx.fillStyle = i % 3 === 0 ? '#14081e' : i % 3 === 1 ? DK[0] : '#5a2a8a';
                ctx.fillRect(R(x), R(y), 2, i % 2 ? 3 : 2);
            }
            ctx.restore();
            for (let i = 0; i < 3; i++) {
                const t = (p * 9 + i / 3) % 1;
                glowArc(ctx, hero.x, hero.y, 6 + t * 48, 2 + t * 14, 0, TAU, 2 * (1 - t) + 0.5, i % 2 ? DK[0] : '#5a2a8a', fk * (1 - t));
            }
        }
        eyes(ctx, { ...hero, x: hero.x + (pose?.ox ?? 0), y: hero.y + (pose?.oy ?? 0) }, '#ff3b3b', win(p, T.hold - 0.02, T.hold) * (1 - win(p, T.blink, T.blink + 0.01)), a.frame);
        streak(a, hero, ['#5a2a8a', DK[1]], 7);
        // 闇の一閃: ボスに斜めの黒い裂け目が残り、遅れて紫の光が噴き出す
        const hk = win(p, T.hit, T.hit + 0.16), tg = tgOf(a.body);
        if (hk > 0 && hk < 1) {
            const L = 90;
            slashLine(ctx, tg.x + L, tg.y - L * 0.5, tg.x - L, tg.y + L * 0.5, 22 * (1 - hk) + 3, ['#5a2a8a', DK[1]], 1 - hk);
            slashLine(ctx, tg.x + L, tg.y - L * 0.5 + 2, tg.x - L, tg.y + L * 0.5 + 2, 6 * (1 - hk) + 1, ['#05000a', '#14081e'], (1 - hk) * 0.9);
            sparkBurst(ctx, tg.x, tg.y, hk, `${a.seed}:darkburst`, [DK[0], DK[1], '#14081e', '#ffffff'], 46, 110, -20, 3);
        }
        impactBurst(a, tg.x, tg.y, hk, DK[0], DK[1], 1.2);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), DK[1], 0.6);
    },
};
// =====================================================================
// 光輪と翼（halo）
// =====================================================================
const HALO_COL = { guitar: ['#ff9ce6', '#ffffff'], blaster: ['#9dffb0', '#ffffff'], umbrella: ['#bfe8ff', '#ffffff'] };
const haloCol = (w) => HALO_COL[w] ?? ['#fff6c8', '#ffffff'];
const BEAM0 = T.blink, BEAM1 = T.hit + 0.06; // 光線を撃っているあいだ
// 跳ぶ高さ: 溜めで屈み → 高く跳んで、宙で撃つ（反動でわずかに浮く）→ 撃ち終わると落ちて着地
const JUMP = 30;
function haloLift(p) {
    if (p < T.hold || p >= BEAM1 + 0.04)
        return 0;
    if (p < BEAM0)
        return JUMP * (1 - (1 - win(p, T.hold + 0.012, BEAM0)) ** 2); // 跳び上がる（だんだんゆっくり）
    if (p < BEAM1)
        return JUMP + 3 * win(p, BEAM0, BEAM1); // 撃つ反動で、わずかに浮く
    return (JUMP + 3) * (1 - win(p, BEAM1, BEAM1 + 0.04) ** 2); // 落ちる
}
const halo = {
    pose(p, _home, _f, _b, frame, w) {
        if (p < T.ready - 0.02 || p >= T.home)
            return null;
        if (p < T.hold)
            return powerUp(p, frame, w);
        if (p < T.hold + 0.012) {
            const k = win(p, T.hold, T.hold + 0.012);
            return { ...base, oy: 4 * ease(k), action: 'guard', t: 1 };
        } // 屈んで、跳ぶ溜め
        const lift = haloLift(p);
        if (p < BEAM0)
            return { ...base, oy: -lift, action: 'dash', t: 0.5 };
        if (p < BEAM1)
            return { ...base, oy: -lift, ox: 2 + Math.sin(frame * 1.7) * 0.6, action: 'cast', t: 0.9 }; // 宙で、両手から撃つ（反動で震える）
        if (p < BEAM1 + 0.04)
            return { ...base, oy: -lift, action: 'dash', t: 0.5 };
        const k = win(p, BEAM1 + 0.04, BEAM1 + 0.07);
        return { ...base, oy: 3 * Math.sin(k * Math.PI), action: k < 1 ? 'guard' : 'idle', t: 1 }; // 着地して、膝を曲げる
    },
    cam(p, home, _f, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.08, T.home));
        if (g <= 0)
            return null;
        if (p < T.blink)
            return [g, 1.7 + 0.2 * win(p, T.flare, T.hold), home.x - 4, home.y - 34];
        return [g, 1.05, (home.x + body.x) / 2, body.y - 20]; // 撃つ人とボスの両方が入る広さ
    },
    beats: () => [{ t: T.flare, stop: 0, shake: 2, sfx: 'awakenFlare' }, { t: T.flare + 0.03, stop: 0, shake: 0, sfx: 'chant' }, { t: T.hold, stop: 0, shake: 1, sfx: 'whoosh' }, { t: BEAM0, stop: 0, shake: 3, sfx: 'charge' }, { t: T.land, stop: 0, shake: 4, sfx: 'thunder' }, { t: T.hit, stop: 0.008, shake: 8, sfx: 'impactMagic' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = haloCol(w), lift = haloLift(p), hy = hero.y - lift;
        // 頭上の光輪
        const hk = ease(win(p, T.flare, T.flare + 0.03)) * (1 - win(p, BEAM1, BEAM1 + 0.08));
        if (hk > 0) {
            glowArc(ctx, hero.x - 1, hy - 30 + Math.sin(a.frame / 6), 9 * hk, 3 * hk, 0, TAU, 2, cols[0], hk);
            starSpark(ctx, hero.x - 1 + Math.cos(a.frame / 8) * 9, hy - 30, 3, hk, '#ffffff');
        }
        // 天から降る光と、舞う羽根
        const sk = bump(p, T.ready, T.hold + 0.02);
        if (sk > 0)
            glowLine(ctx, hero.x, -40, hero.x, hy - 24, 10 * sk, cols[0], sk * 0.4); // 頭の上まで（体には重ねない）
        // 跳んだときの砂ぼこりと、着地の砂ぼこり
        dustCloud(a, hero.x, hero.y + 2, win(p, T.hold + 0.012, T.hold + 0.06), 'halojump', 0.8);
        dustCloud(a, hero.x, hero.y + 2, win(p, BEAM1 + 0.04, BEAM1 + 0.1), 'haloland', 0.8);
        // 両手から極太の光線
        const bk = win(p, BEAM0, T.land), bf = 1 - win(p, T.hit + 0.02, BEAM1);
        const hand = { x: hero.x - 10, y: hy - 14 }, tg = tgOf(a.body);
        if (p > BEAM0 - 0.02 && p < BEAM0)
            glowDisc(ctx, hand.x, hand.y, 8 + 14 * win(p, BEAM0 - 0.02, BEAM0), cols[0], 1, 1); // 溜め
        if (bk > 0 && bf > 0) {
            const reach = ease(bk), end = { x: lerp(hand.x, tg.x - 30, reach), y: lerp(hand.y, tg.y, reach) }, wv = (5 + 9 * win(p, T.land, T.hit)) * bf * (1 + 0.1 * Math.sin(a.frame * 1.3));
            glowLine(ctx, hand.x, hand.y, end.x, end.y, wv, w === 'guitar' || w === 'blaster' ? cols[0] : '#ffd166', bf);
            glowLine(ctx, hand.x, hand.y, end.x, end.y, wv * 0.35, '#ffffff', bf);
            for (let i = 0; i < 2; i++) {
                const t = ((a.frame * 0.12 + i / 2) % 1) * reach;
                glowArc(ctx, lerp(hand.x, end.x, t), lerp(hand.y, end.y, t), 4, wv * 0.8, 0, TAU, 1.2, cols[1], bf * 0.8);
            } // 光線を流れる輪
            starSpark(ctx, hand.x, hand.y, 12 + wv * 0.4, bf, '#ffffff');
        }
        const ik = win(p, T.hit, T.hit + 0.16);
        if (ik > 0 && ik < 1) {
            petals(ctx, tg.x, tg.y, 200 * ik + 40, 120, ik * 2, `${a.seed}:haloburst`, ['#ffffff', cols[0], '#f0f0ff'], 1 - ik, 30, 0.5);
            groundRings(ctx, tg.x, a.foot.y + 4, ik, cols[0], 150);
        }
        impactBurst(a, tg.x, tg.y, ik, cols[0], cols[1], 1.25);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
        flash(a, bump(p, T.flare - 0.004, T.flare + 0.02), '#ffffff', 0.4);
    },
};
// =====================================================================
// 大きな影（giant）
// =====================================================================
const GI = ['#2a103e', '#a55bd8'];
const GS = 2.4; // 影の大きさ
const giantPos = (hero) => ({ x: Math.min(hero.x + 4, 300), y: hero.y + 4 });
const SWING0 = T.blink, SWING1 = T.land + 0.01; // 影が腕をふるう
const giant = {
    pose(p, _home, _f, _b, frame, w) {
        if (p < T.ready - 0.02 || p >= T.home)
            return null;
        if (p < T.hold)
            return powerUp(p, frame, w);
        if (p < T.hit + 0.06)
            return { ...base, oy: -2, action: p < SWING0 ? 'cast' : 'attack', t: p < SWING0 ? 0.5 : win(p, SWING0, SWING1) }; // 影といっしょに腕をふるう
        return { ...base, action: 'idle' };
    },
    cam(p, home, _f, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.08, T.home));
        if (g <= 0)
            return null;
        if (p < T.hold)
            return [g, 1.6, home.x - 4, home.y - 30];
        return [g, 1.0, (home.x + body.x) / 2 + 6, body.y - 26]; // 影とボスの両方
    },
    beats: () => [{ t: T.flare, stop: 0, shake: 3, sfx: 'awakenFlare' }, { t: T.flare + 0.04, stop: 0, shake: 2, sfx: 'rumble' }, { t: SWING0, stop: 0, shake: 1, sfx: 'whoosh' }, { t: T.hit, stop: 0.008, shake: 10, sfx: 'impactHeavy' }, { t: T.hit + 0.04, stop: 0, shake: 4, sfx: 'rumble' }],
    back(a, hero, _w, look) {
        const { ctx, phase: p } = a;
        const gp = giantPos(hero), rise = ease(win(p, T.flare, T.hold)), out = 1 - win(p, T.hit + 0.06, T.hit + 0.16);
        if (rise <= 0 || out <= 0 || !look)
            return;
        const act = p < SWING0 ? 'cast' : 'attack', t = p < SWING0 ? 0.5 : ease(win(p, SWING0, SWING1));
        heroSilhouette(ctx, (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame, flip: true, action: act, t, ring: false }), gp.x, gp.y + (1 - rise) * 40, GS, '#14081e', 0.88 * rise * out, 0.6);
        // 影の赤い目
        const ex = gp.x - 4 * GS, ey = gp.y - 17 * GS + (1 - rise) * 40;
        ctx.save();
        ctx.globalAlpha = rise * out;
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(R(ex - 4), R(ey), 3, 2);
        ctx.fillRect(R(ex + 2), R(ey), 3, 2);
        ctx.restore();
        glowDisc(ctx, ex, ey, 10, '#ff3b3b', rise * out * 0.6, 0.6);
    },
    top(a, hero) {
        const { ctx, phase: p } = a;
        const gp = giantPos(hero), tg = tgOf(a.body);
        // 足元から湧く黒い靄
        const mk = bump(p, T.ready, T.hit + 0.06);
        if (mk > 0)
            sparkBurst(ctx, gp.x, gp.y - 4, (p * 20) % 1, `${a.seed}:gimist${Math.floor(p * 20)}`, ['#14081e', GI[0], GI[1]], 18, 50, -60, 3);
        // 影の一撃: 巨大な影の腕が、弧を描いてボスへ（影の三日月が飛ぶ）
        const sk = win(p, SWING0, SWING1), sf = 1 - win(p, T.hit, T.hit + 0.08);
        // ボスは左にいるので、右上 → 頭上 → 左下へ振り下ろす（反時計まわり）
        const A0 = -(Math.PI - 2.0), A1 = -(Math.PI + 1.0);
        if (sk > 0 && sf > 0)
            slashArc(ctx, gp.x - 6, gp.y - 50, 74, A0, lerp(A0, A1, ease(sk)), 30, ['#5a2a8a', GI[1]], sf);
        const fk = win(p, SWING1 - 0.01, T.hit);
        if (fk > 0 && fk < 1) {
            const x = lerp(gp.x - 60, tg.x + 20, ease(fk));
            glowArc(ctx, x, tg.y - 4, 26, 76, Math.PI * 0.6, Math.PI * 1.4, 12, '#5a2a8a', 1);
            glowArc(ctx, x + 8, tg.y - 4, 20, 60, Math.PI * 0.6, Math.PI * 1.4, 3, GI[1], 0.9);
        }
        const hk = win(p, T.hit, T.hit + 0.16);
        if (hk > 0 && hk < 1) {
            sparkBurst(ctx, tg.x, tg.y, hk, `${a.seed}:giburst`, ['#14081e', GI[1], '#ffffff', '#5a2a8a'], 50, 120, 30, 3);
            groundRings(ctx, tg.x, a.foot.y + 4, hk, GI[1], 170);
        }
        rocks(a, tg.x, a.foot.y, hk, 'girock', 34, 140);
        dustCloud(a, tg.x, a.foot.y + 4, hk, 'gidust', 2);
        impactBurst(a, tg.x, tg.y, hk, GI[1], '#e2c2ff', 1.2);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#e2c2ff', 0.6);
    },
};
// =====================================================================
// 炎のオーラ（flame）
// =====================================================================
const FL = ['#ff7a3a', '#ffd166', '#c8301a'];
const flame = {
    pose: (p, home, _f, body, frame, w) => dashThrough(p, home, body, frame, w),
    cam: (p, home, _f, body) => awakenCam(p, home, body),
    beats: (w) => [{ t: T.flare, stop: 0, shake: 3, sfx: 'awakenFlare' }, { t: T.flare + 0.02, stop: 0, shake: 1, sfx: 'boom' }, { t: T.blink, stop: 0, shake: 1, sfx: 'dive' }, { t: T.hit, stop: 0.008, shake: w === 'hammer' ? 10 : 8, sfx: w === 'dagger' ? 'impactBlade' : 'impactHeavy' }, { t: T.hit + 0.03, stop: 0, shake: 3, sfx: 'boom' }],
    top(a, hero) {
        const { ctx, phase: p } = a;
        // 炎が立ちのぼる（ドット絵の炎の舌）
        const fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        if (fk > 0) {
            const rng = new Rng(`${a.seed}:flame`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 50; i++) {
                const t = (p * 8 + rng.next()) % 1, x = hero.x + rng.range(-14, 14) * (1 - t * 0.6) + Math.sin(t * 9 + i) * 2, y = hero.y - 2 - t * 64;
                ctx.globalAlpha = fk * (1 - t);
                ctx.fillStyle = t < 0.3 ? '#ffffff' : t < 0.55 ? FL[1] : t < 0.8 ? FL[0] : FL[2];
                ctx.fillRect(R(x), R(y), 2, 3);
            }
            ctx.restore();
            glowDisc(ctx, hero.x, hero.y - 16, 34 * fk, FL[0], fk * 0.6, 0.4);
            for (let i = 0; i < 3; i++) {
                const t = (p * 9 + i / 3) % 1;
                glowArc(ctx, hero.x, hero.y, 6 + t * 48, 2 + t * 14, 0, TAU, 2 * (1 - t) + 0.5, i % 2 ? FL[1] : FL[0], fk * (1 - t));
            }
        }
        eyes(ctx, hero, '#ffe27a', win(p, T.flare, T.flare + 0.01) * (1 - win(p, T.blink, T.blink + 0.01)), a.frame);
        // 突進: 炎の帯と火の粉
        streak(a, hero, [FL[0], FL[1]], 9);
        const bk = win(p, T.blink, T.land);
        if (bk > 0 && bk < 1) {
            const end = endOf(a.body), x = lerp(hero.x, end.x, ease(bk)), y = lerp(hero.y, end.y, ease(bk)) - 14;
            sparkBurst(ctx, x, y, (p * 40) % 1, `${a.seed}:flember${Math.floor(p * 40)}`, [FL[0], FL[1], '#ffffff'], 14, 30, -20);
            glowDisc(ctx, x, y, 22, FL[0], 1, 1);
        }
        // 斬って、火柱
        const hk = win(p, T.hit, T.hit + 0.16), tg = tgOf(a.body);
        if (hk > 0 && hk < 1) {
            slashLine(ctx, tg.x + 80, tg.y - 30, tg.x - 80, tg.y + 20, 18 * (1 - hk) + 2, [FL[0], FL[1]], 1 - hk);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const rng = new Rng(`${a.seed}:flpillar`);
            for (let i = 0; i < 7; i++) {
                const x = tg.x - 36 + i * 12 + rng.range(-3, 3), h = rng.range(60, 140) * Math.sin(Math.PI * Math.min(1, hk * 1.4));
                ctx.globalAlpha = 1 - hk;
                ctx.fillStyle = FL[2];
                ctx.fillRect(R(x - 5), R(a.foot.y - h), 10, R(h));
                ctx.fillStyle = FL[0];
                ctx.fillRect(R(x - 3), R(a.foot.y - h), 6, R(h));
                ctx.fillStyle = FL[1];
                ctx.fillRect(R(x - 1), R(a.foot.y - h * 0.9), 2, R(h * 0.9));
            }
            ctx.restore();
            sparkBurst(ctx, tg.x, tg.y, hk, `${a.seed}:flburst`, [FL[0], FL[1], '#ffffff'], 40, 110, 80);
        }
        impactBurst(a, tg.x, tg.y, hk, FL[0], FL[1], 1.2);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#fff0c0', 0.75);
    },
};
// =====================================================================
// 金色の覚醒（gold）
// =====================================================================
const GOLD_COL = { fan: ['#ffd166', '#e3ffc8'] };
const goldCol = (w) => GOLD_COL[w] ?? ['#ffd166', '#fff6c8'];
const gold = {
    pose: (p, home, _f, body, frame, w) => dashThrough(p, home, body, frame, w),
    cam: (p, home, _f, body) => awakenCam(p, home, body),
    beats: () => [{ t: T.flare, stop: 0.004, shake: 3, sfx: 'awakenFlare' }, { t: T.blink, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.hit, stop: 0.01, shake: 9, sfx: 'impactBlade' }, { t: T.hit + 0.03, stop: 0, shake: 2, sfx: 'shatter' }],
    back(a, hero, w, look) {
        const { ctx, phase: p } = a;
        const cols = goldCol(w), rk = win(p, T.flare - 0.01, T.flare + 0.03) * (1 - win(p, T.blink, T.blink + 0.02));
        if (rk <= 0)
            return;
        const pose = dashThrough(p, { x: hero.x, y: hero.y }, a.body, a.frame, w), cx = hero.x + (pose?.ox ?? 0), cy = hero.y - 14 + (pose?.oy ?? 0);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
            const an = (i / 12) * TAU + a.frame / 40, L = (44 + (i % 3) * 16) * ease(rk), r0 = 12;
            ctx.globalAlpha = rk * (i % 2 ? 0.2 : 0.35);
            ctx.fillStyle = cols[0];
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0);
            ctx.lineTo(cx + Math.cos(an - 0.04) * L, cy + Math.sin(an - 0.04) * L);
            ctx.lineTo(cx + Math.cos(an + 0.04) * L, cy + Math.sin(an + 0.04) * L);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        onHero(a, hero, look, pose, cols[0], rk * (0.75 + 0.25 * Math.sin(a.frame / 3)), { outline: true }); // 体の縁が金色に光る
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = goldCol(w);
        // 金の粒が体のまわりから立ちのぼる（姿の前を横切らないよう、小さな粒だけ）
        const rk = win(p, T.flare - 0.01, T.flare + 0.03) * (1 - win(p, T.blink, T.blink + 0.02));
        if (rk > 0) {
            const rng = new Rng(`${a.seed}:goldmote`);
            ctx.save();
            for (let i = 0; i < 16; i++) {
                const t = (p * 6 + rng.next()) % 1, side = i % 2 ? 1 : -1;
                ctx.globalAlpha = rk * (1 - t);
                ctx.fillStyle = i % 3 ? cols[0] : '#ffffff';
                ctx.fillRect(R(hero.x + side * rng.range(9, 16)), R(hero.y - 4 - t * 40), 1, 2);
            }
            ctx.restore();
        }
        // 光をまとって一閃（まっすぐの金の線）
        streak(a, hero, cols, 8);
        const hk = win(p, T.hit, T.hit + 0.16), tg = tgOf(a.body);
        if (hk > 0 && hk < 1) {
            const y = tg.y - 4;
            glowLine(ctx, tg.x - 140, y, tg.x + 140, y, 20 * (1 - hk) + 2, cols[0], 1 - hk);
            glowLine(ctx, tg.x - 140, y, tg.x + 140, y, 5 * (1 - hk) + 1, '#ffffff', 1 - hk);
            sparkBurst(ctx, tg.x, y, hk, `${a.seed}:goldburst`, [cols[0], cols[1], '#ffffff'], 44, 120, 20);
            if (w === 'fan')
                petals(ctx, tg.x, y, 220, 100, hk * 2, `${a.seed}:goldleaf`, ['#3aa860', '#9be7b0', '#ffd166'], 1 - hk, 26, 0.6);
        }
        impactBurst(a, tg.x, tg.y, hk, cols[0], cols[1], 1.2);
        flash(a, bump(p, T.flare - 0.004, T.flare + 0.02), '#fff6c8', 0.18);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#fff6c8', 0.5); // 当たる瞬間の閃光も、まぶしすぎないように
    },
};
// =====================================================================
// 雷をまとう（thunder）
// =====================================================================
const TH = ['#ffe27a', '#7fe0ff'];
// ジグザグの瞬間移動: 主役 → 3つの点 → ボスの向こう
const zig = (home, body) => [home, { x: body.x + 70, y: body.y - 20 }, { x: body.x + 30, y: body.y + 30 }, { x: body.x + 10, y: body.y - 40 }, endOf(body)];
const ZIG = (i) => T.blink + (i / 4) * (T.land - T.blink);
const thunder = {
    pose(p, home, _f, body, frame, w) {
        const pu = powerUp(p, frame, w);
        if (pu || p < T.blink)
            return pu;
        const pts = zig(home, body), end = endOf(body);
        if (p < T.land) {
            const i = Math.min(3, Math.floor((p - T.blink) / ((T.land - T.blink) / 4)));
            return at(home, pts[i + 1], { action: 'attack', t: 0.8, flip: pts[i + 1].x < pts[i].x, alpha: 0.9 });
        } // 点から点へ、一瞬で
        if (p < T.hit + 0.05)
            return at(home, end, { action: 'cast', t: 0.9, flip: false });
        if (p >= T.home)
            return null;
        const k = win(p, T.hit + 0.05, T.home);
        return at(home, { x: lerp(end.x, home.x, ease(k)), y: lerp(end.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: true });
    },
    cam: (p, home, _f, body) => awakenCam(p, home, body),
    beats: () => [{ t: T.flare, stop: 0, shake: 3, sfx: 'thunder' }, { t: T.flare + 0.04, stop: 0, shake: 1, sfx: 'awakenFlare' }, ...[0, 1, 2, 3].map((i) => ({ t: ZIG(i) + 0.002, stop: 0.002, shake: 2, sfx: (i % 2 ? 'thunder' : 'slash') })), { t: T.hit, stop: 0.008, shake: 8, sfx: 'impactMagic' }, { t: T.hit + 0.02, stop: 0, shake: 3, sfx: 'thunder' }],
    back(a, hero, w, look) {
        const p = a.phase, fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        if (fk <= 0)
            return;
        const pose = powerUp(p, a.frame, w);
        glowDisc(a.ctx, hero.x, hero.y - 14, 26 * fk, TH[0], fk * 0.35, 0.2);
        onHero(a, hero, look, pose, a.frame % 4 < 2 ? TH[1] : '#ffffff', fk * (a.frame % 6 < 4 ? 1 : 0.4), { outline: true });
    },
    top(a, hero) {
        const { ctx, phase: p } = a;
        // 雷をまとう: 体の外側で小さな稲妻がはじけ続ける（体の上には重ねない）
        const fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        if (fk > 0) {
            for (let i = 0; i < 5; i++) {
                const an = (a.frame * 0.9 + i * 1.3) % TAU, r0 = 14, r1 = 24 + (i % 2) * 8;
                bolt(ctx, hero.x + Math.cos(an) * r0, hero.y - 14 + Math.sin(an) * r0 * 1.3, hero.x + Math.cos(an) * r1, hero.y - 14 + Math.sin(an) * r1 * 1.3, `${a.seed}:thaura${i}${a.frame % 6}`, 1, i % 2 ? TH[0] : TH[1], fk, 4, 0);
            }
            if (p > T.flare && p < T.flare + 0.03)
                bolt(ctx, hero.x + 4, -40, hero.x, hero.y - 24, `${a.seed}:thstrike${Math.floor(a.frame / 2)}`, 3, TH[0], bump(p, T.flare, T.flare + 0.03), 12, 2); // 天から落ちる雷を、頭の上で受ける
        }
        eyes(ctx, hero, '#7fe0ff', win(p, T.flare, T.flare + 0.01) * (1 - win(p, T.blink, T.blink + 0.01)), a.frame);
        // ジグザグの雷の道と、通り過ぎざまの斬撃
        const pts = zig({ x: hero.x, y: hero.y }, a.body);
        for (let i = 0; i < 4; i++) {
            const t0 = ZIG(i), k = win(p, t0, t0 + 0.004), fade = 1 - win(p, T.hit, T.hit + 0.06);
            if (k <= 0 || fade <= 0)
                continue;
            const A = { x: pts[i].x, y: pts[i].y - 14 }, B = { x: pts[i + 1].x, y: pts[i + 1].y - 14 };
            bolt(ctx, A.x, A.y, lerp(A.x, B.x, k), lerp(A.y, B.y, k), `${a.seed}:zig${i}${Math.floor(a.frame / 2)}`, p < t0 + 0.02 ? 4 : 1.5, i % 2 ? TH[1] : TH[0], fade, 8, 1);
            if (p < t0 + 0.03)
                starSpark(ctx, B.x, B.y, 12 * (1 - win(p, t0, t0 + 0.03)), 1, '#ffffff');
        }
        const hk = win(p, T.hit, T.hit + 0.16), tg = tgOf(a.body);
        if (hk > 0 && hk < 1) {
            for (let i = 0; i < 4; i++)
                bolt(ctx, tg.x + (i - 1.5) * 18, -40, tg.x + (i - 1.5) * 8, tg.y + 20, `${a.seed}:thhit${i}${Math.floor(a.frame / 2)}`, 3 * (1 - hk) + 1, i % 2 ? TH[1] : TH[0], 1 - hk, 10, 2);
            for (const dir of [-1, 1])
                bolt(ctx, tg.x, a.foot.y + 2, tg.x + dir * 120 * ease(Math.min(1, hk * 2)), a.foot.y + 2, `${a.seed}:thrun${dir}${Math.floor(a.frame / 2)}`, 2, TH[0], 1 - hk, 5, 1);
            sparkBurst(ctx, tg.x, tg.y, hk, `${a.seed}:thburst`, [TH[0], TH[1], '#ffffff'], 40, 110, 20);
        }
        impactBurst(a, tg.x, tg.y, hk, TH[0], TH[1], 1.2);
        flash(a, bump(p, T.flare - 0.004, T.flare + 0.02), '#ffffff', 0.25);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.85);
    },
};
export const AWAKEN_MOVES = { dark, halo, giant, flame, gold, thunder };
void clamp01;
void speedLines;
void rocks;
//# sourceMappingURL=ult-awaken.js.map