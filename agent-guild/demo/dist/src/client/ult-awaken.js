import { tl } from '../shared/i18n.js';
import { Rng } from '../shared/rng.js';
import { drawHero } from './hero.js';
import { ULT_T, R, TAU, bolt, bump, clamp01, dim, dustCloud, ease, flash, glowArc, glowDisc, glowLine, groundRings, heroSilhouette, impactBurst, lerp, petals, rocks, slashArc, slashLine, sparkBurst, speedLines, starSpark, text, win, } from './ultkit.js';
const T = ULT_T.awaken;
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const NO_GEAR = { back: [], fams: [], charms: [] };
const MAGIC = new Set(['wand', 'book', 'fan', 'guitar']);
const at = (home, q, extra = {}) => ({ ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra });
const endOf = (body) => ({ x: body.x - 62, y: body.y + 18 }); // 駆け抜けた先
const tgOf = (body) => ({ x: body.x + 2, y: body.y + 2 });
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
const awakenText = (a, hero, col = '#ffffff', outline = '#3a0a3a') => text(a.ctx, tl('覚醒！'), hero.x + 6, hero.y - 66, R(11 + 4 * bump(a.phase, T.flare, T.flare + 0.03)), col, win(a.phase, T.flare, T.flare + 0.01) * (1 - win(a.phase, T.hold, T.blink)), outline);
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
    top(a, hero) {
        const { ctx, phase: p } = a;
        // 世界が闇に沈む
        dim(a, 0.78 * win(p, T.ready, T.flare) * (1 - win(p, T.hit + 0.04, T.hit + 0.14)), '#05000a');
        // 紫黒の炎（ゆらめく舌）
        const fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        if (fk > 0) {
            const rng = new Rng(`${a.seed}:darkflame`);
            ctx.save();
            for (let i = 0; i < 40; i++) {
                const t = (p * 7 + rng.next()) % 1, x = hero.x + rng.range(-12, 12) * (1 - t * 0.5) + Math.sin(t * 8 + i) * 3, y = hero.y - t * 60;
                ctx.globalAlpha = fk * (1 - t);
                ctx.fillStyle = i % 3 === 0 ? '#14081e' : i % 3 === 1 ? DK[0] : '#5a2a8a';
                ctx.fillRect(R(x), R(y), 2, i % 2 ? 3 : 2);
            }
            ctx.restore();
            glowDisc(ctx, hero.x, hero.y - 14, 30 * fk, '#5a2a8a', fk * 0.6, 0.2);
            for (let i = 0; i < 3; i++) {
                const t = (p * 9 + i / 3) % 1;
                glowArc(ctx, hero.x, hero.y, 6 + t * 48, 2 + t * 14, 0, TAU, 2 * (1 - t) + 0.5, i % 2 ? DK[0] : '#5a2a8a', fk * (1 - t));
            }
        }
        eyes(ctx, hero, '#ff3b3b', win(p, T.flare, T.flare + 0.01) * (1 - win(p, T.blink, T.blink + 0.01)), a.frame);
        awakenText(a, hero, '#ff9ab0', '#14081e');
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
const halo = {
    pose(p, _home, _f, _b, frame, w) {
        if (p < T.ready - 0.02 || p >= T.home)
            return null;
        if (p < T.hold)
            return powerUp(p, frame, w);
        if (p < BEAM1) {
            const lift = ease(win(p, T.hold, T.blink));
            return { ...base, oy: -14 * lift + Math.sin(frame / 5) * 1.2, ox: (p > BEAM0 ? 2 + Math.sin(frame * 1.7) * 0.6 : 0), action: 'cast', t: p > BEAM0 ? 0.9 : 0.5 };
        } // 宙に浮いて、両手から撃つ（反動で震える）
        const k = win(p, BEAM1, T.home);
        return { ...base, oy: -14 * (1 - ease(k)), action: 'idle', t: 0 };
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
    back(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = haloCol(w), k = ease(win(p, T.flare, T.hold)) * (1 - win(p, BEAM1, BEAM1 + 0.08));
        if (k <= 0)
            return;
        const lift = 14 * ease(win(p, T.hold, T.blink)) * (1 - win(p, BEAM1, T.home));
        const cx = hero.x + 2, cy = hero.y - 20 - lift, flap = Math.sin(a.frame / 6) * 0.08;
        for (const side of [-1, 1])
            for (let i = 0; i < 7; i++) { // 羽根を一枚ずつ扇形に
                const an = -Math.PI / 2 + side * (0.35 + i * 0.2 + flap) * k, len = (34 - i * 3) * k;
                const x1 = cx + Math.cos(an) * len * 0.9 + side * 4, y1 = cy + Math.sin(an) * len * 0.6 + i * 3;
                ctx.save();
                ctx.globalAlpha = k;
                ctx.strokeStyle = '#b08a10';
                ctx.lineWidth = 4 - i * 0.3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx + side * 3, cy + 2);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                ctx.restore(); // 羽根の縁
                glowLine(ctx, cx + side * 3, cy + 2, x1, y1, 2.4 - i * 0.2, i % 2 ? cols[0] : cols[1], k);
                ctx.save();
                ctx.globalAlpha = k;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(x1) - 1, R(y1) - 1, 2, 2);
                ctx.restore();
            }
        glowDisc(ctx, cx, cy, 20 * k, cols[0], k * 0.35, 0.3);
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = haloCol(w), lift = 14 * ease(win(p, T.hold, T.blink)) * (1 - win(p, BEAM1, T.home)), hy = hero.y - lift;
        // 頭上の光輪
        const hk = ease(win(p, T.flare, T.flare + 0.03)) * (1 - win(p, BEAM1, BEAM1 + 0.08));
        if (hk > 0) {
            glowArc(ctx, hero.x - 1, hy - 30 + Math.sin(a.frame / 6), 9 * hk, 3 * hk, 0, TAU, 2, cols[0], hk);
            starSpark(ctx, hero.x - 1 + Math.cos(a.frame / 8) * 9, hy - 30, 3, hk, '#ffffff');
        }
        // 天から降る光と、舞う羽根
        const sk = bump(p, T.ready, T.hold + 0.02);
        if (sk > 0) {
            glowLine(ctx, hero.x, -40, hero.x, hy, 18 * sk, cols[0], sk * 0.5);
            petals(ctx, hero.x, hy - 30, 90, 90, p * 2, `${a.seed}:halofeather`, ['#ffffff', cols[0], '#f0f0ff'], sk, 14, 1);
        }
        awakenText(a, hero, '#fff6c8', '#3a2a00');
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
        awakenText(a, hero, '#e2c2ff', '#14081e');
        // 影の一撃: 巨大な影の腕が、弧を描いてボスへ（影の三日月が飛ぶ）
        const sk = win(p, SWING0, SWING1), sf = 1 - win(p, T.hit, T.hit + 0.08);
        if (sk > 0 && sf > 0)
            slashArc(ctx, gp.x - 6, gp.y - 50, 74, -2.0, lerp(-2.0, 1.0, ease(sk)), 30, ['#5a2a8a', GI[1]], sf);
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
        awakenText(a, hero, '#ffe27a', '#3a1a00');
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
const CUT0 = T.flare + 0.012, CUT1 = T.hold - 0.006; // カットイン
const gold = {
    pose: (p, home, _f, body, frame, w) => dashThrough(p, home, body, frame, w),
    cam: (p, home, _f, body) => awakenCam(p, home, body),
    beats: () => [{ t: T.flare, stop: 0.004, shake: 3, sfx: 'awakenFlare' }, { t: CUT0, stop: 0, shake: 0, sfx: 'shatter' }, { t: T.blink, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.hit, stop: 0.01, shake: 9, sfx: 'impactBlade' }, { t: T.hit + 0.03, stop: 0, shake: 2, sfx: 'shatter' }],
    top(a, hero, w, look) {
        const { ctx, phase: p } = a;
        const cols = goldCol(w);
        // 金色の光が放射状にあふれる
        const rk = win(p, T.flare - 0.01, T.flare + 0.03) * (1 - win(p, T.blink, T.blink + 0.02));
        if (rk > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 16; i++) {
                const an = (i / 16) * TAU + a.frame / 40, L = (80 + (i % 3) * 30) * ease(rk);
                ctx.globalAlpha = rk * (i % 2 ? 0.35 : 0.6);
                ctx.fillStyle = cols[0];
                ctx.beginPath();
                ctx.moveTo(hero.x, hero.y - 16);
                ctx.lineTo(hero.x + Math.cos(an - 0.06) * L, hero.y - 16 + Math.sin(an - 0.06) * L);
                ctx.lineTo(hero.x + Math.cos(an + 0.06) * L, hero.y - 16 + Math.sin(an + 0.06) * L);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            glowDisc(ctx, hero.x, hero.y - 16, 40 * rk, cols[0], rk, 1);
        }
        // カットイン: 画面を横切る帯に、主役の顔（大きく）と金の光の線
        const ck = win(p, CUT0, CUT0 + 0.01) * (1 - win(p, CUT1, CUT1 + 0.01));
        if (ck > 0) {
            const cy = hero.y - 40, bh = 40 * ease(ck), slide = (1 - ease(win(p, CUT0, CUT0 + 0.012))) * 200;
            ctx.save();
            ctx.globalAlpha = 0.92 * ck;
            ctx.fillStyle = '#1a1205';
            ctx.fillRect(-a.W, cy - bh / 2, a.W * 3, bh);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 8; i++) {
                const y = cy - bh / 2 + ((i * 7 + a.frame * 3) % bh);
                ctx.globalAlpha = ck * 0.5;
                ctx.fillStyle = cols[0];
                ctx.fillRect(-a.W, R(y), a.W * 3, 1);
            } // 流れる光
            ctx.restore();
            if (look) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-a.W, cy - bh / 2, a.W * 3, bh);
                ctx.clip();
                ctx.translate(hero.x - 60 + slide, cy + 52);
                ctx.scale(3, 3);
                ctx.imageSmoothingEnabled = false;
                ctx.globalAlpha = ck;
                drawHero(ctx, look, NO_GEAR, 0, 0, { frame: a.frame, flip: true, action: 'guard', t: 1, ring: false });
                ctx.restore();
            }
            glowLine(ctx, -a.W, cy - bh / 2, a.W * 2, cy - bh / 2, 1.5, cols[0], ck);
            glowLine(ctx, -a.W, cy + bh / 2, a.W * 2, cy + bh / 2, 1.5, cols[0], ck);
        }
        awakenText(a, hero, '#ffe27a', '#3a2a00');
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
        flash(a, bump(p, T.flare - 0.004, T.flare + 0.02), '#fff6c8', 0.55);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.85);
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
    top(a, hero) {
        const { ctx, phase: p } = a;
        // 雷をまとう: 体のまわりで小さな稲妻がはじけ続ける
        const fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
        if (fk > 0) {
            for (let i = 0; i < 5; i++) {
                const an = (a.frame * 0.9 + i * 1.3) % TAU, r0 = 8, r1 = 20 + (i % 2) * 8;
                bolt(ctx, hero.x + Math.cos(an) * r0, hero.y - 14 + Math.sin(an) * r0, hero.x + Math.cos(an) * r1, hero.y - 14 + Math.sin(an) * r1, `${a.seed}:thaura${i}${a.frame % 6}`, 1.2, i % 2 ? TH[0] : TH[1], fk, 5, 0);
            }
            glowDisc(ctx, hero.x, hero.y - 14, 30 * fk, TH[0], fk * 0.5, 0.5);
            if (p > T.flare && p < T.flare + 0.03)
                bolt(ctx, hero.x + 4, -40, hero.x, hero.y - 20, `${a.seed}:thstrike${Math.floor(a.frame / 2)}`, 4, TH[0], bump(p, T.flare, T.flare + 0.03), 12, 2); // 天から落ちる雷を受ける
        }
        eyes(ctx, hero, '#7fe0ff', win(p, T.flare, T.flare + 0.01) * (1 - win(p, T.blink, T.blink + 0.01)), a.frame);
        awakenText(a, hero, '#ffe27a', '#1a1a3a');
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
        flash(a, bump(p, T.flare - 0.004, T.flare + 0.02), '#ffffff', 0.4);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.85);
    },
};
export const AWAKEN_MOVES = { dark, halo, giant, flame, gold, thunder };
void clamp01;
void speedLines;
void rocks;
//# sourceMappingURL=ult-awaken.js.map