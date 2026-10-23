import { tl } from '../shared/i18n.js';
import { Rng } from '../shared/rng.js';
import { drawHero } from './hero.js';
import { ULT_T, R, TAU, bolt, bump, clamp01, crescent, dim, ease, flash, glowArc, glowDisc, glowLine, groundRings, heroSilhouette, impactBurst, lerp, petals, slashLine, sparkBurst, speedLines, starSpark, text, win, } from './ultkit.js';
const T = ULT_T.parry;
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const NO_GEAR = { back: [], fams: [], charms: [] };
const MAGIC = new Set(['wand', 'book', 'fan', 'guitar']);
const at = (home, q, extra = {}) => ({ ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra });
function trail(home, q, k, n, step, a0) {
    return Array.from({ length: n }, (_, j) => { const g = q(Math.max(0, k - (j + 1) * step)); return { x: g.x - home.x, y: g.y - home.y, a: a0 / (j + 1) }; });
}
const front = (body) => ({ x: body.x + 64, y: body.y + 16 }); // 受ける立ち位置
const contact = (body) => { const f = front(body); return { x: f.x - 16, y: f.y - 20 }; }; // 受け止める一点
const source = (body) => ({ x: body.x + 28, y: body.y - 4 }); // ボスの大技が出る所
const target = (body) => ({ x: body.x + 2, y: body.y + 2 });
const ARRIVE0 = 0.37; // ボスの大技が飛びはじめる
// 構え → 正面へ踏みこむ（共通）。null なら場面の外
function approach(p, home, body) {
    const fr = front(body);
    if (p < T.ready - 0.02 || p >= T.home)
        return null;
    if (p < T.step) {
        const k = win(p, T.ready - 0.02, T.step);
        return { ...base, oy: 2.5 * ease(k), ox: 2 * ease(k), action: 'guard', t: k };
    }
    const k = win(p, T.step, T.guard), q = (u) => ({ x: lerp(home.x, fr.x, ease(u)), y: lerp(home.y, fr.y, ease(u)) });
    return at(home, q(k), { action: 'dash', ghosts: trail(home, q, k, 4, 0.14, 0.4) });
}
function goHome(p, home, from) {
    const k = win(p, T.hit + 0.06, T.home);
    return at(home, { x: lerp(from.x, home.x, ease(k)), y: lerp(from.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: false });
}
function cam(p, home, body, close = 1.8) {
    const fr = front(body);
    const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.04, T.home));
    if (g <= 0)
        return null;
    if (p < T.step)
        return [g, 1.6, home.x - 4, home.y - 22];
    if (p < T.clash - 0.02)
        return [g, 1.3, (fr.x + body.x) / 2 + 8, body.y - 18];
    if (p < T.strike)
        return [g, close, fr.x - 14, fr.y - 26]; // 受け止めた一点に寄る
    return [g, 1.35, (fr.x + body.x) / 2, body.y - 16];
}
// 構えのときに集まる風
function readyFx(a, hero) {
    const { ctx, phase: p } = a;
    const rk0 = win(p, T.ready - 0.02, T.step);
    if (rk0 <= 0 || p >= T.guard)
        return;
    ctx.save();
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const t = (rk0 * 3 + i / 5) % 1;
        ctx.globalAlpha = (1 - t) * rk0 * 0.7;
        ctx.beginPath();
        ctx.arc(hero.x, hero.y - 12, 24 * (1 - t) + 4, i, i + 1.2);
        ctx.stroke();
    }
    ctx.restore();
}
// 受けた瞬間の「見切り！」と、時間の止まる暗転・ひび（共通。暗転の強さを選べる）
function clashFx(a, cp, label, darkMax = 0.5) {
    const { ctx, phase: p } = a;
    const ck = win(p, T.clash, T.clash + 0.02);
    if (ck <= 0 || p >= T.freeze + 0.02)
        return;
    const fz = ck * (1 - win(p, T.strike - 0.015, T.strike));
    if (fz > 0) {
        dim(a, fz * darkMax, '#080812');
        const rng = new Rng(`${a.seed}:parrycrack`);
        for (let i = 0; i < 14; i++) {
            const an = rng.range(0, TAU), len = rng.range(40, 140) * ease(ck);
            glowLine(ctx, cp.x, cp.y, cp.x + Math.cos(an) * len, cp.y + Math.sin(an) * len * 0.8, 0.9, '#ffffff', fz * 0.7);
        }
        starSpark(ctx, cp.x, cp.y, 14 + 40 * ease(ck), fz, '#ffffff');
        text(ctx, label, cp.x - 6, cp.y - 38, R(12 + 5 * (1 - ck)), '#ffe9a0', fz, '#3a1a00');
    }
}
// ボスの赤い玉（大技）
function redOrb(ctx, x, y, r, frame, al = 1) {
    glowDisc(ctx, x, y, r * 2.4, '#ff3b3b', 0.8 * al, 0.6);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.fillStyle = '#ff4a5a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd0d0';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a0a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r + 1 + Math.sin(frame / 2), 0, TAU);
    ctx.stroke();
    ctx.restore();
}
// 味方の色の玉（返った玉）
function allyOrb(ctx, x, y, r, cols, frame) {
    glowDisc(ctx, x, y, r * 2.6, cols[0], 0.9, 0.8);
    ctx.save();
    ctx.fillStyle = cols[0];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
    starSpark(ctx, x, y, r * 1.6 + Math.sin(frame / 2) * 2, 1, cols[1]);
}
const incoming = (p, body) => { const u = ease(win(p, ARRIVE0, T.clash)), s = source(body), cp = contact(body); return { x: lerp(s.x, cp.x, u), y: lerp(s.y, cp.y, u) - Math.sin(u * Math.PI) * 10 }; };
// =====================================================================
// 打ち返し（return）
// =====================================================================
const RET_COL = { pan: ['#ffb04a', '#fff0b0'], spear: ['#7fe0ff', '#e8fff0'], hammer: ['#ffe27a', '#ffffff'] };
const retCol = (w) => RET_COL[w] ?? ['#7fe0ff', '#ffffff'];
const ret = {
    pose(p, home, _f, body) {
        const ap = approach(p, home, body);
        if (p < T.guard || !ap)
            return ap;
        const fr = front(body);
        if (p < T.clash - 0.008)
            return at(home, { x: fr.x + 3, y: fr.y }, { action: 'attack', t: 0.05 }); // 大きく振りかぶる
        if (p < T.strike) {
            const k = win(p, T.clash - 0.008, T.clash);
            return at(home, { x: fr.x + 3 * (1 - k) + 3 * bump(p, T.clash, T.strike) + Math.sin(p * 800) * 0.6, y: fr.y }, { action: 'attack', t: 0.05 + 0.4 * k });
        } // 玉を受けて、押し合う
        if (p < T.hit + 0.06) {
            const k = win(p, T.strike, T.strike + 0.008);
            return at(home, { x: fr.x - 3 * k, y: fr.y }, { action: 'attack', t: 0.45 + 0.5 * k });
        } // 振り抜いて、見送る
        return goHome(p, home, fr);
    },
    cam: (p, home, _f, body) => cam(p, home, body, 1.7),
    beats: (w) => [{ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.clash, stop: 0.004, shake: 4, sfx: 'guard' }, { t: T.freeze, stop: 0, shake: 1, sfx: 'charge' }, { t: T.strike, stop: 0.006, shake: 5, sfx: w === 'pan' ? 'guard' : 'hit' }, { t: T.strike + 0.004, stop: 0, shake: 0, sfx: 'shoot' }, { t: T.hit, stop: 0.007, shake: 7, sfx: 'impactHeavy' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = retCol(w), cp = contact(a.body), tg = target(a.body);
        readyFx(a, hero);
        if (p > ARRIVE0 && p < T.clash) {
            const q = incoming(p, a.body);
            redOrb(ctx, q.x, q.y, 7, a.frame);
        }
        // 押し合い: 武器の上で玉が回りながら、味方の色に染まっていく
        if (p >= T.clash && p < T.strike) {
            const k = win(p, T.clash, T.strike), x = cp.x + Math.sin(a.frame * 2.2) * 1.5, y = cp.y;
            if (k < 0.6)
                redOrb(ctx, x, y, 7 + k * 3, a.frame, 1 - k / 0.6);
            if (k > 0.3)
                allyOrb(ctx, x, y, 7 + k * 4, cols, a.frame);
            sparkBurst(ctx, x, y, (p * 50) % 1, `${a.seed}:retpush${Math.floor(p * 50)}`, ['#ff4a5a', '#ffffff', cols[0]], 8, 24, 10);
            glowArc(ctx, x, y, 14, 14, a.frame / 2, a.frame / 2 + 4, 1.5, cols[0], k);
        }
        // 打った瞬間: 衝撃の輪と、白い打撃の星
        const sk = win(p, T.strike, T.strike + 0.04);
        if (sk > 0 && sk < 1) {
            starSpark(ctx, cp.x, cp.y, 30 * (1 - sk) + 6, 1 - sk, '#ffffff');
            groundRings(ctx, cp.x, cp.y + 20, sk, cols[0], 60, 2);
            sparkBurst(ctx, cp.x, cp.y, sk, `${a.seed}:retspark`, ['#ffffff', cols[0], '#ff4a5a'], 24, 50, 20);
            text(ctx, tl('カキーン！'), cp.x + 6, cp.y - 34, R(13 + 5 * (1 - sk)), '#ffe9a0', 1 - sk, '#3a1a00');
        }
        // 返った玉: ひと回り大きく、味方の色。尾を引いて、ボスへ
        const rk = win(p, T.strike, T.hit);
        if (rk > 0 && rk < 1) {
            const pos = (u) => ({ x: lerp(cp.x, tg.x, u), y: lerp(cp.y, tg.y, u) - Math.sin(u * Math.PI) * 10 });
            for (let i = 8; i >= 1; i--) {
                const q = pos(Math.max(0, rk - i * 0.04));
                glowDisc(ctx, q.x, q.y, 12 - i, cols[0], 0.7 - i * 0.07, 0.4);
            }
            const q = pos(rk);
            allyOrb(ctx, q.x, q.y, 11 + 3 * rk, cols, a.frame);
            speedLines(ctx, q.x + 20, 30, q.y - 20, q.y + 20, a.frame, 0.4, cols[1], 8, Math.PI / 2);
        }
        const hk = win(p, T.hit, T.hit + 0.14);
        impactBurst(a, tg.x, tg.y, hk, cols[0], cols[1], 1.1);
        sparkBurst(ctx, tg.x, tg.y, hk, `${a.seed}:retburst`, [cols[0], cols[1], '#ffffff'], 36, 100, 30);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// カウンター斬り（counter）
// =====================================================================
const CNT_COL = { fan: ['#9be7b0', '#ffffff'] };
const cntCol = (w) => CNT_COL[w] ?? ['#ffffff', '#ff9ab0'];
const STOP0 = T.clash - 0.012, STOP1 = T.strike; // 時が止まっているあいだ
const counter = {
    pose(p, home, _f, body) {
        const ap = approach(p, home, body);
        if (p < T.guard || !ap)
            return ap;
        const fr = front(body);
        if (p < STOP1 + 0.01)
            return at(home, fr, { action: 'guard', t: 1 }); // 本体は受ける構えのまま、止まっている
        if (p < T.hit + 0.06)
            return at(home, { x: fr.x - 4, y: fr.y }, { action: 'attack', t: 0.95 }); // 時が動きだすと、もう振り抜いている
        return goHome(p, home, fr);
    },
    cam: (p, home, _f, body) => cam(p, home, body, 1.6),
    beats: () => [{ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: STOP0, stop: 0, shake: 0, sfx: 'chant' }, { t: STOP0 + 0.03, stop: 0, shake: 0, sfx: 'slash' }, { t: STOP0 + 0.05, stop: 0, shake: 0, sfx: 'slash' }, { t: STOP1, stop: 0.004, shake: 3, sfx: 'shatter' }, { t: T.hit, stop: 0.008, shake: 7, sfx: 'impactBlade' }],
    top(a, hero, w, look) {
        const { ctx, phase: p } = a;
        const cols = cntCol(w), cp = contact(a.body), fr = front(a.body), tg = target(a.body);
        readyFx(a, hero);
        // 迫る三日月（止まった時間の中では、空中で止まる）
        if (p > ARRIVE0 && p < STOP1) {
            const u = ease(win(Math.min(p, STOP0), ARRIVE0, T.clash)), s = source(a.body), x = lerp(s.x, cp.x, u), y = lerp(s.y, cp.y, u);
            crescent(ctx, x, y, 1, 1.15, p > STOP0 ? '#8a8a96' : '#ff4a5a', 1);
        }
        // 止まった世界: 色が抜けて灰色に。時計の針の輪がまわる
        const sk = win(p, STOP0, STOP0 + 0.008) * (1 - win(p, STOP1, STOP1 + 0.01));
        if (sk > 0) {
            dim(a, sk * 0.55, '#2a2c38'); // 色が抜けた、止まった世界
            ctx.save();
            ctx.globalAlpha = sk * 0.8;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, 34, 0, TAU);
            ctx.stroke();
            for (let i = 0; i < 12; i++) {
                const an = (i / 12) * TAU;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(cp.x + Math.cos(an) * 30) - 1, R(cp.y + Math.sin(an) * 30) - 1, 2, 2);
            }
            const hand = -Math.PI / 2 + win(p, STOP0, STOP1) * TAU * 0.25;
            ctx.beginPath();
            ctx.moveTo(cp.x, cp.y);
            ctx.lineTo(cp.x + Math.cos(hand) * 24, cp.y + Math.sin(hand) * 24);
            ctx.stroke();
            ctx.restore();
            text(ctx, tl('……時が止まる'), cp.x, cp.y - 46, 9, '#ffffff', sk);
        }
        // 白い影だけが動く: ボスの懐へ → 二太刀 → 戻る
        const wk = win(p, STOP0 + 0.01, STOP1 - 0.004);
        if (wk > 0 && wk < 1 && look) {
            const A = fr, B = { x: tg.x + 16, y: fr.y - 2 }, C = { x: tg.x - 30, y: fr.y }, u = wk;
            const pos = u < 0.3 ? { x: lerp(A.x, B.x, ease(u / 0.3)), y: A.y } : u < 0.65 ? { x: lerp(B.x, C.x, ease((u - 0.3) / 0.35)), y: B.y } : { x: lerp(C.x, A.x, ease((u - 0.65) / 0.35)), y: A.y };
            const act = u < 0.3 || u > 0.65 ? 'dash' : 'attack';
            for (let j = 3; j >= 0; j--)
                heroSilhouette(ctx, (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame, flip: u < 0.65, action: act, t: 0.8, ring: false }), pos.x + j * (u < 0.65 ? 6 : -6), pos.y, 1, '#ffffff', j ? 0.25 / j : 1, j ? 0 : 1);
            // 白い影がつけた斬撃の線（止まったまま残る）
            for (const [t0, an] of [[0.32, -0.7], [0.5, 0.6]]) {
                const k = win(u, t0, t0 + 0.08);
                if (k > 0) {
                    const L = 54;
                    slashLine(ctx, tg.x - Math.cos(an) * L, tg.y - Math.sin(an) * L, lerp(tg.x - Math.cos(an) * L, tg.x + Math.cos(an) * L, ease(k)), lerp(tg.y - Math.sin(an) * L, tg.y + Math.sin(an) * L, ease(k)), 6, ['#ffffff', '#ffffff'], 0.9);
                }
            }
        }
        // 時が動きだす: 三日月が砕け、斬撃がいっせいに刻まれる
        const rk = win(p, STOP1, STOP1 + 0.04);
        if (rk > 0 && rk < 1)
            sparkBurst(ctx, cp.x, cp.y, rk, `${a.seed}:cntshard`, ['#ff4a5a', '#ffd0d0', '#ffffff'], 26, 60, 40);
        const hk = win(p, T.hit, T.hit + 0.14);
        if (hk > 0 && hk < 1) {
            for (const an of [-0.7, 0.6]) {
                const L = 70 + hk * 20;
                slashLine(ctx, tg.x - Math.cos(an) * L, tg.y - Math.sin(an) * L, tg.x + Math.cos(an) * L, tg.y + Math.sin(an) * L, 16 * (1 - hk) + 2, cols[0] === '#ffffff' ? ['#ff9ab0', '#ffffff'] : cols, 1 - hk);
            }
            text(ctx, tl('斬！'), tg.x + 36, tg.y - 32, R(16 + 6 * (1 - hk)), '#ffffff', Math.min(1, (1 - hk) * 3), '#2a0a3a');
            if (w === 'fan')
                petals(ctx, tg.x, tg.y, 200, 120, hk * 2, `${a.seed}:cntleaf`, ['#3aa860', '#9be7b0', '#e3ffc8'], 1 - hk, 26, 0.6);
            else
                petals(ctx, tg.x, tg.y, 200, 120, hk * 2, `${a.seed}:cntsakura`, ['#ffb7c5', '#ffd6e0', '#ff8fab'], 1 - hk, 26, 0.6);
        }
        impactBurst(a, tg.x, tg.y, hk, cols[1], cols[0], 1);
        flash(a, bump(p, STOP1 - 0.003, STOP1 + 0.015), '#ffffff', 0.5);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 鏡の盾（mirror）
// =====================================================================
const MIR_COL = { umbrella: ['#7bed9f', '#e3ffc8'] };
const mirCol = (w) => MIR_COL[w] ?? ['#9fe8ff', '#ffffff'];
const mirror = {
    pose(p, home, _f, body) {
        const ap = approach(p, home, body);
        if (p < T.guard || !ap)
            return ap;
        const fr = front(body);
        const push = 5 * bump(p, T.clash, T.strike) + Math.sin(p * 900) * 0.6 * (p > T.clash && p < T.strike ? 1 : 0);
        if (p < T.hit + 0.06)
            return at(home, { x: fr.x + push, y: fr.y }, { action: 'guard', t: 1 });
        return goHome(p, home, fr);
    },
    cam: (p, home, _f, body) => cam(p, home, body, 1.5),
    beats: () => [{ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.guard, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.clash, stop: 0.004, shake: 4, sfx: 'guard' }, { t: T.freeze, stop: 0, shake: 2, sfx: 'charge' }, { t: T.strike, stop: 0, shake: 2, sfx: 'thunder' }, { t: T.hit, stop: 0.007, shake: 7, sfx: 'impactMagic' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = mirCol(w), cp = contact(a.body), s = source(a.body), tg = target(a.body);
        readyFx(a, hero);
        // 光る板（六角）: 受けると傾いて、跳ね返す角度になる
        const pk = win(p, T.guard - 0.02, T.guard) * (1 - win(p, T.hit + 0.02, T.hit + 0.08));
        if (pk > 0) {
            const tilt = -0.25 * win(p, T.freeze, T.strike);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(cp.x + 4, cp.y);
            ctx.rotate(tilt);
            ctx.globalAlpha = pk * (0.8 + 0.2 * Math.sin(a.frame / 3));
            ctx.fillStyle = `${cols[0]}55`;
            ctx.strokeStyle = cols[0];
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
                const t = (i / 6) * TAU + Math.PI / 6, x = Math.cos(t) * 10, y = Math.sin(t) * 26;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-3, -18);
            ctx.lineTo(3, -6);
            ctx.moveTo(-3, 0);
            ctx.lineTo(3, 12);
            ctx.stroke(); // 板のきらめき
            ctx.restore();
        }
        // ボスの光線（赤）: 板に当たって止まり、押し合う
        const bk = win(p, ARRIVE0 + 0.02, T.clash), bf = 1 - win(p, T.strike, T.strike + 0.02);
        if (bk > 0 && bf > 0) {
            const end = { x: lerp(s.x, cp.x, ease(bk)), y: lerp(s.y, cp.y, ease(bk)) }, wv = 6 + 3 * Math.sin(a.frame * 1.3);
            glowLine(ctx, s.x, s.y, end.x, end.y, wv + 2, '#ff3b3b', bf);
            glowLine(ctx, s.x, s.y, end.x, end.y, 2, '#ffe0e0', bf);
            glowDisc(ctx, s.x, s.y, 14, '#ff3b3b', bf, 1);
            if (p > T.clash) {
                sparkBurst(ctx, cp.x, cp.y, (p * 40) % 1, `${a.seed}:mirspark${Math.floor(p * 40)}`, ['#ff4a5a', '#ffffff', cols[0]], 10, 30, 0);
                glowDisc(ctx, cp.x, cp.y, 20, '#ffffff', 0.8 * bf, 1);
            }
        }
        clashFx(a, cp, tl('受け止めた！'), 0.35);
        // 跳ね返す: 味方の色に変わった極太の光線
        const rk = win(p, T.strike, T.hit), rf = 1 - win(p, T.hit + 0.04, T.hit + 0.12);
        if (rk > 0 && rf > 0) {
            const end = { x: lerp(cp.x, tg.x - 30, ease(Math.min(1, rk * 1.4))), y: lerp(cp.y, tg.y, ease(Math.min(1, rk * 1.4))) };
            glowLine(ctx, cp.x, cp.y, end.x, end.y, 16 * rf + 2, cols[0], rf);
            glowLine(ctx, cp.x, cp.y, end.x, end.y, 4 * rf + 1, '#ffffff', rf);
            for (let i = 0; i < 3; i++) {
                const off = (i - 1) * 10;
                glowLine(ctx, cp.x, cp.y + off * 0.3, lerp(cp.x, end.x, 0.8), lerp(cp.y, end.y, 0.8) + off, 1, cols[1], rf * 0.6);
            }
        }
        const hk = win(p, T.hit, T.hit + 0.14);
        impactBurst(a, tg.x, tg.y, hk, cols[0], cols[1], 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 受け止めて投げ返す（catch）
// =====================================================================
const CAT_COL = { bow: ['#ffd166', '#fff6c8'], guitar: ['#ff6bd6', '#7fe0ff'], wand: ['#c77dff', '#f0e0ff'], dagger: ['#a55bd8', '#e2c2ff'] };
const catCol = (w) => CAT_COL[w] ?? ['#7fe0ff', '#ffffff'];
const SPIN0 = T.clash + 0.012, SPIN1 = T.strike; // 頭の上でぐるりと回す
const spinPos = (fr, p) => { const k = win(p, SPIN0, SPIN1), an = -Math.PI / 2 + ease(k) * TAU * 1.25; return { x: fr.x - 2 + Math.cos(an) * 14, y: fr.y - 34 + Math.sin(an) * 8 }; };
const catchMove = {
    pose(p, home, _f, body, frame) {
        const ap = approach(p, home, body);
        if (p < T.guard || !ap)
            return ap;
        const fr = front(body);
        if (p < T.clash + 0.004)
            return at(home, fr, { action: 'guard', t: 1 }); // 両手を前に
        if (p < SPIN0)
            return at(home, { x: fr.x + 4 * bump(p, T.clash, SPIN0), y: fr.y }, { action: 'guard', t: 1 }); // 受け止めた勢いで、少し押される
        if (p < SPIN1)
            return at(home, { x: fr.x, y: fr.y - 2 }, { action: 'cast', t: 0.5 + 0.5 * Math.sin(frame / 2) }); // 頭の上で回す
        if (p < T.hit + 0.06)
            return at(home, { x: fr.x - 4 * win(p, SPIN1, SPIN1 + 0.01), y: fr.y }, { action: 'attack', t: 0.2 + 0.7 * win(p, SPIN1, SPIN1 + 0.012) }); // 投げる
        return goHome(p, home, fr);
    },
    cam: (p, home, _f, body) => cam(p, home, body, 1.7),
    beats: () => [{ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.clash, stop: 0.006, shake: 4, sfx: 'guard' }, { t: SPIN0 + 0.01, stop: 0, shake: 0, sfx: 'whoosh' }, { t: SPIN0 + 0.035, stop: 0, shake: 0, sfx: 'whoosh' }, { t: SPIN1, stop: 0, shake: 1, sfx: 'shoot' }, { t: T.hit, stop: 0.007, shake: 7, sfx: 'impactHeavy' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = catCol(w), fr = front(a.body), cp = contact(a.body), tg = target(a.body);
        readyFx(a, hero);
        if (p > ARRIVE0 && p < T.clash) {
            const q = incoming(p, a.body);
            redOrb(ctx, q.x, q.y, 8, a.frame);
        }
        // 受け止める: 手の中で玉が暴れる → 味方の色に染まっていく
        const tint = win(p, T.clash, SPIN1);
        let ball = null;
        if (p >= T.clash && p < SPIN0)
            ball = { x: cp.x + 4 + Math.sin(a.frame * 2.4) * 1.5, y: cp.y };
        else if (p >= SPIN0 && p < SPIN1)
            ball = spinPos(fr, p);
        if (ball) {
            if (tint < 0.5)
                redOrb(ctx, ball.x, ball.y, 8, a.frame, 1 - tint * 2);
            if (tint > 0.2)
                allyOrb(ctx, ball.x, ball.y, 8 + 2 * tint, cols, a.frame);
            if (p >= SPIN0)
                for (let i = 1; i <= 6; i++) {
                    const q = spinPos(fr, p - i * 0.003);
                    glowDisc(ctx, q.x, q.y, 8 - i, cols[0], 0.6 - i * 0.08, 0.2);
                }
        }
        if (p >= T.clash && p < SPIN0) {
            const k = win(p, T.clash, T.clash + 0.02);
            groundRings(ctx, fr.x, fr.y, k, '#ffffff', 40, 2);
            sparkBurst(ctx, cp.x, cp.y, k, `${a.seed}:catspark`, ['#ff4a5a', '#ffffff'], 18, 30, 10);
            text(ctx, tl('つかんだ！'), cp.x, cp.y - 34, 12, '#ffe9a0', 1 - k * 0.3, '#3a1a00');
        }
        // 投げ返す: 回した勢いで、大きな弧を描いてボスへ
        const tk = win(p, SPIN1, T.hit);
        if (tk > 0 && tk < 1) {
            const s0 = spinPos(fr, SPIN1), pos = (u) => ({ x: lerp(s0.x, tg.x, u), y: lerp(s0.y, tg.y, u) - Math.sin(u * Math.PI) * 26 });
            for (let i = 8; i >= 1; i--) {
                const q = pos(Math.max(0, tk - i * 0.05));
                glowDisc(ctx, q.x, q.y, 13 - i, cols[0], 0.7 - i * 0.07, 0.4);
            }
            const q = pos(tk);
            allyOrb(ctx, q.x, q.y, 10 + 3 * tk, cols, a.frame);
            if (w === 'guitar')
                text(ctx, '♪', q.x + 10, q.y - 12, 10, cols[1], 1, '#2a0a3a');
        }
        const hk = win(p, T.hit, T.hit + 0.14);
        impactBurst(a, tg.x, tg.y, hk, cols[0], cols[1], 1.15);
        sparkBurst(ctx, tg.x, tg.y, hk, `${a.seed}:catburst`, [cols[0], cols[1], '#ffffff'], 36, 100, 40);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 吸いこんで放つ（absorb）
// =====================================================================
const ABS_COL = { blaster: ['#63d471', '#c8ffc8'], book: ['#c77dff', '#7fe0ff'] };
const absCol = (w) => ABS_COL[w] ?? ['#ffe27a', '#ffffff'];
const absorb = {
    pose(p, home, _f, body, frame) {
        const ap = approach(p, home, body);
        if (p < T.guard || !ap)
            return ap;
        const fr = front(body);
        if (p < T.strike)
            return at(home, { x: fr.x + Math.sin(frame * 2.1) * 0.6 * win(p, T.clash, T.strike), y: fr.y }, { action: 'cast', t: 0.5 }); // 武器をかざして吸いこむ（震える）
        if (p < T.hit + 0.06)
            return at(home, { x: fr.x + 6 * bump(p, T.strike, T.hit), y: fr.y }, { action: 'attack', t: 0.6 }); // 撃った反動
        return goHome(p, home, fr);
    },
    cam: (p, home, _f, body) => cam(p, home, body, 1.6),
    beats: () => [{ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: ARRIVE0 + 0.01, stop: 0, shake: 1, sfx: 'thunder' }, { t: T.clash, stop: 0.003, shake: 3, sfx: 'charge' }, { t: T.strike, stop: 0.003, shake: 4, sfx: 'thunder' }, { t: T.hit, stop: 0.007, shake: 8, sfx: 'impactMagic' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = absCol(w), cp = contact(a.body), s = source(a.body), tg = target(a.body);
        readyFx(a, hero);
        // ボスの雷: 武器の先へ届き、吸いこまれていく（だんだん細く）
        const ek = win(p, ARRIVE0, T.clash), ef = 1 - win(p, T.freeze - 0.02, T.freeze + 0.01);
        if (ek > 0 && ef > 0) {
            const end = { x: lerp(s.x, cp.x, ease(ek)), y: lerp(s.y, cp.y, ease(ek)) };
            bolt(ctx, s.x, s.y, end.x, end.y, `${a.seed}:abs${Math.floor(a.frame / 2)}`, 3 * ef + 1, '#ff4a5a', ef, 10, 2);
        }
        // 吸いこむ渦: 光の粒が武器の先へ集まり、玉が大きくなる
        const ck = win(p, T.clash, T.strike);
        if (ck > 0 && p < T.strike + 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const rng = new Rng(`${a.seed}:absorb`);
            for (let i = 0; i < 40; i++) {
                const t = (ck * 3 + rng.next()) % 1, an = rng.range(0, TAU) + t * 3, d = (1 - t) * rng.range(24, 70);
                ctx.globalAlpha = t;
                ctx.fillStyle = [cols[0], cols[1], '#ff4a5a', '#ffffff'][i % 4];
                ctx.fillRect(R(cp.x + Math.cos(an) * d), R(cp.y + Math.sin(an) * d * 0.8), 2, 2);
            }
            ctx.restore();
            glowArc(ctx, cp.x, cp.y, 20 * (1 - ck) + 10, 16 * (1 - ck) + 8, a.frame / 3, a.frame / 3 + 4.5, 2, cols[0], 0.9);
            glowDisc(ctx, cp.x, cp.y, 8 + 20 * ck, cols[0], 0.9, 1);
            text(ctx, tl('吸収！'), cp.x, cp.y - 40, 12, '#ffe9a0', win(p, T.clash, T.clash + 0.01) * (1 - win(p, T.freeze, T.strike)), '#3a1a00');
        }
        // 撃ち返す: 極太の光線と、まわりを巻く雷
        const rk = win(p, T.strike, T.hit), rf = 1 - win(p, T.hit + 0.04, T.hit + 0.12);
        if (rk > 0 && rf > 0) {
            const reach = ease(Math.min(1, rk * 1.5)), end = { x: lerp(cp.x, tg.x - 40, reach), y: lerp(cp.y, tg.y, reach) };
            glowLine(ctx, cp.x, cp.y, end.x, end.y, 22 * rf + 3, cols[0], rf);
            glowLine(ctx, cp.x, cp.y, end.x, end.y, 6 * rf + 1, '#ffffff', rf);
            for (let i = 0; i < 2; i++)
                bolt(ctx, cp.x, cp.y + (i ? 6 : -6), end.x, end.y + (i ? 6 : -6), `${a.seed}:absbolt${i}${Math.floor(a.frame / 2)}`, 1.5, cols[1], rf * 0.9, 8, 1);
            starSpark(ctx, cp.x, cp.y, 22 * rf, rf, '#ffffff');
        }
        const hk = win(p, T.hit, T.hit + 0.14);
        impactBurst(a, tg.x, tg.y, hk, cols[0], cols[1], 1.2);
        if (hk > 0 && hk < 1)
            for (let i = 0; i < 3; i++)
                bolt(ctx, tg.x + (i - 1) * 16, tg.y - 40, tg.x + (i - 1) * 8, tg.y + 30, `${a.seed}:abshit${i}${Math.floor(a.frame / 2)}`, 2, cols[0], 1 - hk, 8, 1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 影からの返し（behind）
// =====================================================================
const BEH_COL = { axe: ['#ff7a3a', '#ffd166'] };
const behCol = (w) => BEH_COL[w] ?? ['#a55bd8', '#e2c2ff'];
const SINK = T.clash - 0.004, EMERGE = T.strike - 0.015; // 影に沈む・背後に現れる
const backSpot = (body, foot) => ({ x: body.x - 44, y: foot.y + 4 }); // ボスの背中側
const behind = {
    pose(p, home, foot, body) {
        const ap = approach(p, home, body);
        if (p < T.guard || !ap)
            return ap;
        const fr = front(body), bk = backSpot(body, foot);
        if (p < SINK)
            return at(home, fr, { action: 'guard', t: 1 });
        if (p < SINK + 0.02) {
            const k = win(p, SINK, SINK + 0.02);
            return at(home, { x: fr.x, y: fr.y + 10 * k }, { action: 'guard', t: 1, alpha: 1 - k });
        } // 影へ沈む
        if (p < EMERGE)
            return { ...base, alpha: 0 };
        if (p < T.strike) {
            const k = win(p, EMERGE, T.strike);
            return at(home, { x: bk.x, y: bk.y + 10 * (1 - k) }, { action: 'guard', t: 1, alpha: k, flip: false });
        } // 背後の影から浮かび上がる
        if (p < T.hit + 0.06) {
            const k = win(p, T.strike, T.hit);
            return at(home, { x: bk.x + 10 * ease(k), y: bk.y }, { action: 'attack', t: 0.2 + 0.75 * k, flip: false });
        }
        const k = win(p, T.hit + 0.06, T.home); // ボスを跳び越えて戻る
        return at(home, { x: lerp(bk.x + 10, home.x, ease(k)), y: lerp(bk.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 50 }, { action: 'dash', flip: false });
    },
    cam(p, home, foot, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.04, T.home));
        if (g <= 0)
            return null;
        const fr = front(body), bk = backSpot(body, foot);
        if (p < T.step)
            return [g, 1.6, home.x - 4, home.y - 22];
        if (p < T.clash)
            return [g, 1.3, (fr.x + body.x) / 2 + 8, body.y - 18];
        return [g, 1.25, (fr.x + bk.x) / 2, body.y - 10]; // ボスの両側が入る広さ
    },
    beats: () => [{ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: SINK, stop: 0.004, shake: 2, sfx: 'guard' }, { t: SINK + 0.01, stop: 0, shake: 0, sfx: 'whoosh' }, { t: EMERGE, stop: 0, shake: 0, sfx: 'chant' }, { t: T.strike + 0.01, stop: 0, shake: 1, sfx: 'slash' }, { t: T.hit, stop: 0.008, shake: 8, sfx: 'impactBlade' }],
    top(a, hero, w, look) {
        const { ctx, phase: p } = a;
        const cols = behCol(w), fr = front(a.body), cp = contact(a.body), bk = backSpot(a.body, a.foot), tg = target(a.body);
        readyFx(a, hero);
        // 迫る三日月: 当たった瞬間、主役は影に消え、三日月は素通りする
        if (p > ARRIVE0 && p < T.freeze) {
            const u = ease(win(p, ARRIVE0, T.freeze)), s = source(a.body), x = lerp(s.x, cp.x + 60, u), y = lerp(s.y, cp.y, u);
            crescent(ctx, x, y, 1, 1.15, '#ff4a5a', 1 - win(p, T.clash + 0.02, T.freeze));
        }
        if (p > SINK && p < SINK + 0.03)
            text(ctx, tl('すり抜けた…'), cp.x + 20, cp.y - 34, 10, '#e2c2ff', bump(p, SINK, SINK + 0.03), '#14081e');
        // 影の水たまり（沈む所と、現れる所）
        const pool = (x, y, k) => { if (k <= 0)
            return; ctx.save(); ctx.globalAlpha = k * 0.85; ctx.fillStyle = '#14081e'; ctx.beginPath(); ctx.ellipse(x, y, 16 * k, 4 * k, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = cols[0]; ctx.lineWidth = 1; ctx.globalAlpha = k * 0.7; ctx.beginPath(); ctx.ellipse(x, y, 16 * k, 4 * k, 0, 0, TAU); ctx.stroke(); ctx.restore(); };
        pool(fr.x, fr.y, bump(p, SINK - 0.01, SINK + 0.04));
        pool(bk.x, bk.y, bump(p, EMERGE - 0.02, T.strike + 0.02));
        // 地面の下を走る影（沈んだ所から、背後へ）
        const rk = win(p, SINK + 0.02, EMERGE);
        if (rk > 0 && rk < 1) {
            const x = lerp(fr.x, bk.x, ease(rk));
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#14081e';
            ctx.beginPath();
            ctx.ellipse(x, a.foot.y + 6, 14, 3, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
            sparkBurst(ctx, x, a.foot.y + 4, (p * 60) % 1, `${a.seed}:behrun${Math.floor(p * 60)}`, ['#2a103e', cols[0]], 6, 14, -10);
        }
        // 背中の影から立ちのぼる靄
        const ek = bump(p, EMERGE - 0.01, T.strike + 0.02);
        if (ek > 0) {
            sparkBurst(ctx, bk.x, bk.y - 10, (p * 30) % 1, `${a.seed}:behmist${Math.floor(p * 30)}`, ['#2a103e', cols[0], '#14081e'], 14, 30, -50, 3);
            if (look)
                heroSilhouette(ctx, (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame, flip: false, action: 'guard', t: 1, ring: false }), bk.x + 3, bk.y, 1.1, '#2a103e', ek * 0.5, 1);
        }
        // 背中を斬りつける: 下から上への影の斬撃（三日月）
        const sk = win(p, T.strike, T.hit), sf = 1 - win(p, T.hit + 0.02, T.hit + 0.1);
        if (sk > 0 && sf > 0)
            slashLine(ctx, bk.x + 4, bk.y - 4, lerp(bk.x + 4, tg.x + 30, ease(sk)), lerp(bk.y - 4, tg.y - 50, ease(sk)), 16, cols, sf);
        const hk = win(p, T.hit, T.hit + 0.14);
        if (hk > 0 && hk < 1) {
            text(ctx, tl('背後！'), tg.x - 30, tg.y - 44, R(14 + 5 * (1 - hk)), cols[1], Math.min(1, (1 - hk) * 3), '#14081e');
            sparkBurst(ctx, tg.x - 6, tg.y, hk, `${a.seed}:behburst`, [cols[0], cols[1], '#ffffff', '#2a103e'], 40, 100, 20);
        }
        impactBurst(a, tg.x - 6, tg.y, hk, cols[0], cols[1], 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.65);
    },
};
export const PARRY_MOVES = { return: ret, counter, mirror, catch: catchMove, absorb, behind };
void clamp01;
void MAGIC;
//# sourceMappingURL=ult-parry.js.map