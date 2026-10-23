import { tl } from '../shared/i18n.js';
import { Rng } from '../shared/rng.js';
import { drawHero } from './hero.js';
import { ULT_T, R, TAU, bandArc, bolt, bump, clamp01, crater, dim, dustCloud, ease, flash, glowDisc, glowLine, groundRings, heroSilhouette, lerp, petals, rocks, slashArc, slashLine, sparkBurst, speedLines, starSpark, text, win, } from './ultkit.js';
const T = ULT_T.ougi;
const land = (foot) => ({ x: foot.x + 34, y: foot.y + 6 });
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const up = (u) => 1 - (1 - u) * (1 - u);
const easeIn = (u) => u * u;
const MAGIC = new Set(['wand', 'book', 'fan', 'guitar']);
const SHOT = new Set(['bow', 'blaster']);
const swingAct = (w) => (MAGIC.has(w) ? 'cast' : 'attack');
function at(home, q, extra = {}) { return { ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra }; }
function trail(home, q, k, n, step, a0, act) {
    return Array.from({ length: n }, (_, j) => { const g = q(Math.max(0, k - (j + 1) * step)); return { x: g.x - home.x, y: g.y - home.y, a: a0 / (j + 1), ...(act ? { act } : {}) }; });
}
// 屈んで溜める（小刻みに震える）
function crouch(p, frame, w) {
    const k = win(p, T.crouch - 0.02, T.jump);
    return { ...base, ox: Math.sin(frame * 1.7) * 0.7 * k, oy: 3.5 * ease(k), action: MAGIC.has(w) ? 'cast' : 'guard', t: k };
}
// 残心の位置から、跳んで元の位置へ
function goHome(p, home, from) {
    const k = win(p, T.land, T.home);
    return at(home, { x: lerp(from.x, home.x, ease(k)), y: lerp(from.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 24 }, { action: 'dash', flip: false });
}
// ---- 共通の演出: 溜めの粒・跳躍の砂煙・技名の前の「……」 ----
function chargeFx(a, hero, cols) {
    const { ctx, phase: p } = a;
    const ck = win(p, T.crouch - 0.02, T.jump);
    if (ck > 0 && p < T.jump) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rng = new Rng(`${a.seed}:ougicharge`);
        for (let i = 0; i < 22; i++) {
            const t = (ck * 2.5 + rng.next()) % 1, dx = rng.range(-16, 16);
            ctx.globalAlpha = (1 - t) * ck;
            ctx.fillStyle = i % 3 ? cols[0] : '#ffffff';
            ctx.fillRect(R(hero.x + dx * (1 - t)), R(hero.y - t * 40), 1, 3);
        }
        ctx.restore();
        glowDisc(ctx, hero.x, hero.y - 12, 18 + 10 * ck, cols[0], ck * 0.5, 0.5);
    }
    const jk = win(p, T.jump, T.jump + 0.1);
    dustCloud(a, hero.x, hero.y, jk, 'ougijump', 1.3);
    if (jk > 0 && jk < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - jk;
        ctx.strokeStyle = cols[1];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(hero.x, hero.y, 6 + jk * 30, 2 + jk * 8, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }
}
// 落下地点の照準（地面の輪が縮み、四隅が回る）
function reticle(a, x, y, k, tk, col) {
    if (k <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
        const r = (48 - i * 12) * (1 - tk * 0.55);
        ctx.globalAlpha = k * (0.5 + 0.5 * Math.sin(a.frame / 3 + i));
        ctx.strokeStyle = i ? col : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, a.foot.y + 4, r, r * 0.3, 0, 0, TAU);
        ctx.stroke();
    }
    ctx.translate(x, y);
    ctx.rotate(a.frame / 12);
    const rr = 22 - tk * 8;
    ctx.globalAlpha = k;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(rr, -6);
        ctx.lineTo(rr, -rr);
        ctx.lineTo(6, -rr);
        ctx.stroke();
    }
    ctx.restore();
}
// 落ちる・決まるまでの共通の暗転（静寂）
function hush(a, max, until = T.impact) {
    const p = a.phase;
    dim(a, max * win(p, T.hush - 0.01, T.hush + 0.02) * (1 - win(p, until, until + 0.06)));
}
const ellipsis = (a, x, y) => text(a.ctx, '……', x, y, 10, '#ffe9a0', bump(a.phase, T.hush + 0.01, T.fall));
// =====================================================================
// 天墜（fall）
// =====================================================================
const FALL_COL = { spear: ['#7fe0ff', '#e8fff0'], shield: ['#9fe8ff', '#ffffff'] };
const fallCol = (w) => FALL_COL[w] ?? ['#ffb04a', '#ffe27a'];
const fall = {
    pose(p, home, foot, _body, frame, w) {
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump)
            return crouch(p, frame, w);
        const L = land(foot), sky = { x: home.x + (L.x - home.x) * 0.35, y: -110 };
        if (p < T.hush) {
            const k = win(p, T.jump, T.hush), q = (u) => ({ x: lerp(home.x, sky.x, up(u)), y: lerp(home.y, sky.y, up(u)) });
            return at(home, q(k), { action: 'dash', rot: -0.3 * k, ghosts: trail(home, q, k, 4, 0.09, 0.4) });
        }
        if (p < T.fall)
            return { ...base, alpha: 0 };
        if (p < T.impact) {
            const k = win(p, T.fall, T.impact), top = { x: L.x, y: -60 }, q = (u) => ({ x: L.x, y: lerp(top.y, L.y, easeIn(u)) });
            const spin = w === 'axe' || w === 'hammer';
            return at(home, q(k), { action: 'attack', t: 0.15 + 0.5 * k, rot: spin ? Math.PI * 4 * k : w === 'spear' ? -1.2 : -0.2, ghosts: trail(home, q, k, 4, 0.1, 0.45) });
        }
        if (p < T.land)
            return at(home, { x: L.x, y: L.y + 3 * (1 - win(p, T.impact, T.impact + 0.04)) }, { action: 'attack', t: 0.9 });
        return goHome(p, home, L);
    },
    cam(p, home, foot, body) {
        const L = land(foot), hx = home.x - 4, hy = home.y - 22;
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (p < T.hush) {
            const k = ease(win(p, T.jump, T.hush));
            return [g, lerp(1.6, 1.3, k), lerp(hx, (home.x + L.x) / 2, k), hy - 110 * k];
        }
        if (p < T.fall)
            return [g, 1.4, L.x, body.y - 30];
        if (p < T.impact)
            return [g, 1.05, L.x + 6, body.y - 24];
        return [g, p < T.impact + 0.04 ? 1.35 : 1.15, L.x - 2, body.y - 14];
    },
    beats: (w) => [{ t: T.jump, stop: 0, shake: 2, sfx: 'jump' }, { t: T.fall, stop: 0, shake: 0, sfx: 'dive' }, { t: T.impact, stop: 0.007, shake: w === 'spear' ? 7 : 10, sfx: 'impactHeavy' }, { t: T.impact + 0.05, stop: 0, shake: 4, sfx: 'rumble' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = fallCol(w), L = land(a.foot), sx = L.x - 2, ground = a.foot.y;
        chargeFx(a, hero, cols);
        hush(a, 0.6);
        const tk = win(p, T.hush, T.fall);
        reticle(a, sx, a.body.y - 20, win(p, T.hush, T.hush + 0.02) * (1 - win(p, T.fall + 0.01, T.impact)), tk, cols[0]);
        ellipsis(a, sx + 34, a.body.y - 50);
        // 上空のきらめき（落ちてくる直前）
        const gl = bump(p, T.fall - 0.03, T.fall + 0.005);
        if (gl > 0)
            starSpark(ctx, sx, 14, 4 + gl * 10, gl, '#ffffff');
        // 落下: 縦の速度線と、主役の後ろに燃える尾
        const fk = win(p, T.fall, T.impact);
        if (fk > 0 && fk < 1) {
            speedLines(ctx, sx, 150, -20, ground, a.frame, 0.85, cols[1], 22);
            const hy = lerp(-60, L.y, fk * fk) - 14;
            glowLine(ctx, sx, -180, sx, hy, w === 'spear' ? 6 : 12, cols[0], 1);
            glowLine(ctx, sx - 9, -160, sx - 9, hy - 18, 1.2, '#ffffff', 0.7);
            glowLine(ctx, sx + 9, -160, sx + 9, hy - 18, 1.2, '#ffffff', 0.7);
            if (w === 'axe' || w === 'hammer') { // 回る刃の光の輪
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = cols[1];
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(sx, hy, 16, a.frame / 2, a.frame / 2 + 4.2);
                ctx.stroke();
                ctx.restore();
            }
            const rng = new Rng(`${a.seed}:fallember`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 18; i++) {
                const t = (fk * 3 + rng.next()) % 1;
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = i % 2 ? cols[1] : '#ffffff';
                ctx.fillRect(R(sx + rng.range(-14, 14)), R(hy - 10 - t * 70), 2, 2);
            }
            ctx.restore();
        }
        // 決まる: 縦一文字の光の柱 → 地面の放射状の亀裂・衝撃の輪・岩片・砂煙
        const ik = win(p, T.impact, T.impact + 0.14);
        if (ik > 0 && ik < 1) {
            const wv = (w === 'spear' ? 14 : 30) * (1 - ease(ik)) + 3;
            glowLine(ctx, sx, -220, sx, ground + 12, wv, cols[0], 1 - ik * ik);
            glowLine(ctx, sx - wv * 1.4, -220, sx - wv * 1.4, ground, 1.5, '#ffffff', (1 - ik) * 0.6);
            glowLine(ctx, sx + wv * 1.4, -220, sx + wv * 1.4, ground, 1.5, '#ffffff', (1 - ik) * 0.6);
            const rng = new Rng(`${a.seed}:fallcrack`);
            for (let i = 0; i < 14; i++) {
                const an = (i / 14) * TAU + rng.range(-0.15, 0.15), len = rng.range(50, 130) * ease(clamp01(ik * 2.4));
                glowLine(ctx, sx, ground + 4, sx + Math.cos(an) * len, ground + 4 + Math.sin(an) * len * 0.26, 2.6 * (1 - ik) + 0.6, i % 2 ? cols[1] : cols[0], 1 - ik);
            }
            if (w === 'shield') { // 盾: 四角い衝撃の壁
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 1 - ik;
                ctx.strokeStyle = cols[0];
                ctx.lineWidth = 3 * (1 - ik) + 1;
                const r0 = 10 + 90 * ease(ik);
                ctx.strokeRect(R(sx - r0), R(ground - r0 * 0.9), R(r0 * 2), R(r0 * 0.9));
                ctx.restore();
            }
            groundRings(ctx, sx, ground + 4, ik, cols[0], 190);
        }
        crater(ctx, sx, ground + 4, 26 * ease(win(p, T.impact, T.impact + 0.03)), 1 - win(p, T.land, T.home), cols[0]);
        rocks(a, sx, ground, win(p, T.impact, T.impact + 0.18), 'fallrock', 46, 150);
        dustCloud(a, sx, ground + 4, win(p, T.impact, T.impact + 0.16), 'falldust', 2.4);
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.85);
    },
};
// =====================================================================
// 月輪（moon）
// =====================================================================
const MOON_COL = { scythe: ['#c77dff', '#f0e0ff'], fan: ['#7bed9f', '#e3ffc8'] };
const moonCol = (w) => MOON_COL[w] ?? ['#ffd166', '#fff6c8'];
// 跳んだ頂点（満月の前）
const moonApex = (foot, body) => ({ x: land(foot).x + 40, y: body.y - 46 });
const moonCenter = (foot, body) => { const q = moonApex(foot, body); return { x: q.x + 4, y: q.y - 20 }; };
const moon = {
    pose(p, home, foot, body, frame, w) {
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump)
            return crouch(p, frame, w);
        const ap = moonApex(foot, body), L = land(foot);
        if (p < T.hush) {
            const k = win(p, T.jump, T.hush), q = (u) => ({ x: lerp(home.x, ap.x, up(u)), y: lerp(home.y, ap.y, up(u)) - Math.sin(u * Math.PI) * 20 });
            return at(home, q(k), { action: 'dash', ghosts: trail(home, q, k, 4, 0.1, 0.4) });
        }
        if (p < T.fall) { // 月の前で、武器を振りかぶったまま浮かぶ
            const k = win(p, T.hush, T.fall);
            return at(home, { x: ap.x, y: ap.y - 4 * ease(k) + Math.sin(frame / 6) * 0.6 }, { action: swingAct(w), t: 0.1, rot: -0.15 * k });
        }
        if (p < T.impact) { // 月の縁にそって、弧を描いて振り下ろす
            const k = win(p, T.fall, T.impact), c = moonCenter(foot, body), r = Math.hypot(ap.x - c.x, ap.y - c.y) + 30;
            const a0 = Math.atan2(ap.y - c.y, ap.x - c.x), a1 = Math.atan2(L.y - c.y, L.x - c.x) + 0.15;
            const q = (u) => { const an = lerp(a0, a1, easeIn(u)), rr = lerp(r, Math.hypot(L.x - c.x, L.y - c.y), u); return { x: c.x + Math.cos(an) * rr, y: c.y + Math.sin(an) * rr }; };
            return at(home, q(k), { action: swingAct(w), t: 0.2 + 0.7 * k, rot: 0.6 * k, ghosts: trail(home, q, k, 5, 0.08, 0.5) });
        }
        if (p < T.land)
            return at(home, L, { action: swingAct(w), t: 0.95 });
        return goHome(p, home, L);
    },
    cam(p, home, foot, body) {
        const hx = home.x - 4, hy = home.y - 22, c = moonCenter(foot, body);
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (p < T.hush) {
            const k = ease(win(p, T.jump, T.hush));
            return [g, lerp(1.6, 1.35, k), lerp(hx, c.x, k), lerp(hy, c.y + 10, k)];
        }
        if (p < T.fall)
            return [g, 1.45 + 0.1 * win(p, T.hush, T.fall), c.x - 4, c.y + 12]; // 月と主役に寄る
        if (p < T.impact + 0.02)
            return [g, 1.15, (c.x + body.x) / 2, body.y - 24];
        return [g, 1.3, land(foot).x - 6, body.y - 16];
    },
    beats: () => [{ t: T.jump, stop: 0, shake: 2, sfx: 'jump' }, { t: T.hush, stop: 0, shake: 0, sfx: 'chant' }, { t: T.fall, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.impact, stop: 0.008, shake: 7, sfx: 'impactBlade' }, { t: T.impact + 0.03, stop: 0, shake: 2, sfx: 'shatter' }],
    back(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = moonCol(w), c = moonCenter(a.foot, a.body);
        // 夜になる（奥だけを暗くして、月とキャラを浮かび上がらせる）
        dim(a, 0.62 * win(p, T.jump, T.hush + 0.02) * (1 - win(p, T.impact, T.impact + 0.1)), '#05061a');
        const rise = ease(win(p, T.jump + 0.01, T.hush + 0.02)), split = win(p, T.impact, T.impact + 0.1), out = 1 - win(p, T.impact + 0.04, T.impact + 0.12);
        if (rise <= 0 || out <= 0)
            return;
        const r = 40 * rise;
        const half = (side) => {
            const dx = side * 30 * ease(split), dy = side * 18 * ease(split);
            ctx.save();
            ctx.translate(c.x + dx, c.y + dy);
            ctx.beginPath(); // 斜めの切り口で半分に
            const cut = -0.55;
            ctx.moveTo(Math.cos(cut) * 60, Math.sin(cut) * 60);
            ctx.lineTo(Math.cos(cut + Math.PI) * 60, Math.sin(cut + Math.PI) * 60);
            ctx.lineTo(Math.cos(cut + Math.PI) * 60 + side * 60 * Math.cos(cut + Math.PI / 2), Math.sin(cut + Math.PI) * 60 + side * 60 * Math.sin(cut + Math.PI / 2));
            ctx.lineTo(Math.cos(cut) * 60 + side * 60 * Math.cos(cut + Math.PI / 2), Math.sin(cut) * 60 + side * 60 * Math.sin(cut + Math.PI / 2));
            ctx.closePath();
            ctx.clip();
            ctx.globalAlpha = out;
            ctx.fillStyle = w === 'scythe' ? '#e8dcff' : w === 'fan' ? '#e8ffe0' : '#fff6c8';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = w === 'scythe' ? '#c8b0f0' : w === 'fan' ? '#c8f0c0' : '#f0dca0'; // 月の模様
            for (const [mx, my, mr] of [[-12, -10, 8], [10, 7, 10], [-5, 17, 6], [17, -14, 5]]) {
                ctx.beginPath();
                ctx.arc(mx * rise, my * rise, mr * rise, 0, TAU);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = cols[1];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r - 1, 0, TAU);
            ctx.stroke(); // 明るい縁
            if (split > 0) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(Math.cos(cut) * r, Math.sin(cut) * r);
                ctx.lineTo(Math.cos(cut + Math.PI) * r, Math.sin(cut + Math.PI) * r);
                ctx.stroke();
            } // 切り口
            ctx.restore();
        };
        // 月の暈（かさ）
        glowDisc(ctx, c.x, c.y, r * 2.4, cols[0], out * rise * 0.45, 0.4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
            ctx.globalAlpha = out * rise * (0.5 - i * 0.2);
            ctx.strokeStyle = cols[i];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r + 6 + i * 6 + Math.sin(a.frame / 5 + i) * 1.5, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
        half(1);
        half(-1);
        void hero;
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = moonCol(w), c = moonCenter(a.foot, a.body), L = land(a.foot), ground = a.foot.y;
        chargeFx(a, hero, cols);
        ellipsis(a, c.x + 46, c.y - 30);
        // 月の前の主役を照らす光
        if (p > T.hush && p < T.impact)
            glowDisc(ctx, c.x, c.y, 50, cols[0], 0.35 * bump(p, T.hush, T.impact), 0.3);
        // 振り下ろし: 月の縁にそって、太い弧の軌跡
        const ap = moonApex(a.foot, a.body), r = Math.hypot(ap.x - c.x, ap.y - c.y) + 30;
        const a0 = Math.atan2(ap.y - c.y, ap.x - c.x), a1 = Math.atan2(L.y - c.y, L.x - c.x) + 0.15;
        const sk = win(p, T.fall, T.impact), fade = 1 - win(p, T.impact + 0.02, T.impact + 0.12);
        if (sk > 0 && fade > 0)
            slashArc(ctx, c.x, c.y, r - 6, a0, lerp(a0, a1, easeIn(sk)), 22, cols, fade);
        // 月の切り口: 斜めの白い一閃
        const ck = win(p, T.impact - 0.005, T.impact + 0.03), cf = 1 - win(p, T.impact + 0.04, T.impact + 0.14);
        if (ck > 0 && cf > 0) {
            const cut = -0.55, Lc = 70 * ease(ck);
            slashLine(ctx, c.x - Math.cos(cut) * Lc, c.y - Math.sin(cut) * Lc, c.x + Math.cos(cut) * Lc, c.y + Math.sin(cut) * Lc, 10, ['#ffffff', cols[1]], cf);
        }
        // ボスに刻まれる三日月
        const ik = win(p, T.impact, T.impact + 0.14);
        if (ik > 0 && ik < 1) {
            bandArc(ctx, a.body.x + 30, a.body.y - 10, 46, 10 * (1 - ik) + 2, Math.PI * 0.55, Math.PI * 1.45, cols, 1 - ik);
            sparkBurst(ctx, a.body.x + 4, a.body.y, ik, `${a.seed}:moonspark`, [cols[0], cols[1], '#ffffff'], 30, 80, 30);
            groundRings(ctx, L.x - 4, ground + 4, ik, cols[0], 140, 2);
        }
        if (w === 'fan')
            petals(ctx, c.x, c.y + 30, 160, 120, p * 3, `${a.seed}:moonleaf`, ['#7bed9f', '#e3ffc8', '#3aa860'], bump(p, T.jump, T.land), 16, 1);
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), cols[1], 0.8);
    },
};
// =====================================================================
// 十字斬り（cross）
// =====================================================================
const crossCol = (w) => (w === 'guitar' ? ['#ff6bd6', '#7fe0ff'] : ['#ff9ab0', '#ffffff']);
const crossC = (body) => ({ x: body.x + 4, y: body.y - 6 }); // ×の中心（ボスの胸）
const S1 = T.hush + 0.005, S2 = T.hush + 0.03; // 一太刀目・二太刀目
const cross = {
    pose(p, home, foot, body, frame, w) {
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump)
            return crouch(p, frame, w);
        const c = crossC(body), A = { x: c.x + 46, y: c.y - 30 }, B = { x: c.x - 40, y: c.y + 34 }, C = { x: c.x - 40, y: c.y - 34 }, D = { x: c.x + 46, y: c.y + 34 }, L = land(foot);
        if (p < S1) {
            const k = win(p, T.jump, S1), q = (u) => ({ x: lerp(home.x, A.x, up(u)), y: lerp(home.y, A.y, up(u)) - Math.sin(u * Math.PI) * 24 });
            return at(home, q(k), { action: 'dash', ghosts: trail(home, q, k, 4, 0.1, 0.4) });
        }
        const seg = (P, Q, t0) => { const k = win(p, t0, t0 + 0.012), q = (u) => ({ x: lerp(P.x, Q.x, ease(u)), y: lerp(P.y, Q.y, ease(u)) }); return at(home, q(k), { action: swingAct(w), t: 0.3 + 0.6 * k, flip: true, ghosts: k < 1 ? trail(home, q, k, 6, 0.1, 0.5, 'attack') : [] }); };
        if (p < S1 + 0.012)
            return seg(A, B, S1);
        if (p < S2) {
            const k = win(p, S1 + 0.012, S2), q = (u) => ({ x: lerp(B.x, C.x, ease(u)), y: lerp(B.y, C.y, ease(u)) - Math.sin(u * Math.PI) * 10 });
            return at(home, q(k), { action: 'dash', flip: false });
        }
        if (p < S2 + 0.012)
            return seg(C, D, S2);
        if (p < T.impact) {
            const k = win(p, S2 + 0.012, T.impact);
            return at(home, { x: lerp(D.x, L.x + 20, ease(k)), y: lerp(D.y, L.y, ease(k)) }, { action: 'guard', t: 1, flip: false });
        } // 背を向けて着地（納刀）
        if (p < T.land)
            return at(home, { x: L.x + 20, y: L.y }, { action: 'guard', t: 1, flip: false });
        return goHome(p, home, { x: L.x + 20, y: L.y });
    },
    cam(p, home, _foot, body) {
        const hx = home.x - 4, hy = home.y - 22, c = crossC(body);
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (p < S1) {
            const k = ease(win(p, T.jump, S1));
            return [g, lerp(1.6, 1.4, k), lerp(hx, c.x + 20, k), lerp(hy, c.y, k)];
        }
        if (p < T.impact - 0.01)
            return [g, 1.45 + 0.15 * win(p, S2, T.impact), c.x + 10, c.y]; // ×に寄る
        return [g, 1.25, c.x + 16, c.y + 6];
    },
    beats: () => [{ t: T.jump, stop: 0, shake: 2, sfx: 'jump' }, { t: S1 + 0.006, stop: 0.003, shake: 3, sfx: 'slash' }, { t: S2 + 0.006, stop: 0.003, shake: 3, sfx: 'slash' }, { t: T.fall, stop: 0, shake: 0, sfx: 'guard' }, { t: T.impact, stop: 0.008, shake: 8, sfx: 'impactBlade' }, { t: T.impact + 0.02, stop: 0, shake: 2, sfx: 'shatter' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = crossCol(w), c = crossC(a.body);
        chargeFx(a, hero, cols);
        // 時が止まる: 二太刀のあと、暗くなって × だけが残る
        dim(a, 0.62 * win(p, S2 + 0.012, S2 + 0.03) * (1 - win(p, T.impact, T.impact + 0.06)), '#0a0612');
        const A = { x: c.x + 46, y: c.y - 30 }, B = { x: c.x - 40, y: c.y + 34 }, C = { x: c.x - 40, y: c.y - 34 }, D = { x: c.x + 46, y: c.y + 34 };
        const glow = win(p, T.fall - 0.02, T.impact); // × が金色に光りだす
        const lines = [[A, B, S1], [C, D, S2]];
        for (const [P, Q, t0] of lines) {
            const k = win(p, t0, t0 + 0.012), fade = 1 - win(p, T.impact + 0.01, T.impact + 0.05);
            if (k <= 0 || fade <= 0)
                continue;
            const ex = { x: P.x + (Q.x - P.x) * 1.25, y: P.y + (Q.y - P.y) * 1.25 }, sx0 = { x: Q.x + (P.x - Q.x) * 1.25, y: Q.y + (P.y - Q.y) * 1.25 };
            const head = { x: lerp(sx0.x, ex.x, ease(k)), y: lerp(sx0.y, ex.y, ease(k)) };
            const wv = (p < t0 + 0.03 ? 9 : 4) + glow * 8;
            slashLine(ctx, sx0.x, sx0.y, head.x, head.y, wv, glow > 0 ? ['#ffd166', '#ffffff'] : cols, fade);
            if (k < 1)
                starSpark(ctx, head.x, head.y, 10, 1, '#ffffff');
        }
        // 止まった時間の中で、×の交点が脈打つ
        if (p > S2 + 0.012 && p < T.impact) {
            glowDisc(ctx, c.x, c.y, 10 + 14 * glow + Math.sin(a.frame / 2) * 2, '#ffd166', 0.5 + 0.5 * glow, 1);
            text(ctx, '……', c.x + 40, c.y - 40, 10, '#ffe9a0', win(p, S2 + 0.02, S2 + 0.03));
        }
        if (w === 'katana')
            petals(ctx, c.x, c.y, 200, 140, p * 2.2, `${a.seed}:sakura`, ['#ffb7c5', '#ffd6e0', '#ff8fab'], win(p, S1, S2) * (1 - win(p, T.land, T.home)), 26, 1);
        if (w === 'guitar') { // ネオンの音符
            const rng = new Rng(`${a.seed}:crossnote`);
            for (let i = 0; i < 12; i++) {
                const t = (p * 5 + rng.next()) % 1, an = rng.range(0, TAU);
                text(ctx, i % 2 ? '♪' : '♫', c.x + Math.cos(an) * (20 + t * 60), c.y + Math.sin(an) * (14 + t * 40), 9, i % 2 ? cols[0] : cols[1], win(p, S1, S2) * (1 - t) * (1 - win(p, T.impact + 0.04, T.land)), '#2a0a3a');
            }
        }
        // はじける: × が爆ぜて、光の粒と輪
        const ik = win(p, T.impact, T.impact + 0.14);
        if (ik > 0 && ik < 1) {
            for (const [P, Q] of [[A, B], [C, D]]) {
                const L2 = 1.25 + ik * 0.6;
                slashLine(ctx, Q.x + (P.x - Q.x) * L2, Q.y + (P.y - Q.y) * L2, P.x + (Q.x - P.x) * L2, P.y + (Q.y - P.y) * L2, 18 * (1 - ik) + 2, ['#ffd166', '#ffffff'], 1 - ik);
            }
            sparkBurst(ctx, c.x, c.y, ik, `${a.seed}:crossburst`, ['#ffd166', '#ffffff', cols[0]], 40, 100, 30);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 2; i++) {
                const kk = clamp01(ik * 1.3 - i * 0.2);
                if (kk <= 0 || kk >= 1)
                    continue;
                ctx.globalAlpha = 1 - kk;
                ctx.strokeStyle = i ? '#ffffff' : '#ffd166';
                ctx.lineWidth = 4 * (1 - kk) + 1;
                ctx.beginPath();
                ctx.arc(c.x, c.y, 8 + kk * 90, 0, TAU);
                ctx.stroke();
            }
            ctx.restore();
        }
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#fff6e0', 0.85);
        void tl;
    },
};
// =====================================================================
// 流星（comet）
// =====================================================================
const COMET_COL = { bow: ['#ffd166', '#fff6c8', '#7fe0ff'], blaster: ['#63d471', '#c8ffc8', '#7fe0ff'] };
const cometCol = (w) => COMET_COL[w] ?? ['#ff7a3a', '#ffd166', '#ff3b3b'];
const cometFrom = (a, foot) => ({ x: land(foot).x + 210, y: -24 });
const cometAt = (foot, k) => { const L = land(foot), F = cometFrom({}, foot); const u = Math.pow(k, 1.4); return { x: lerp(F.x, L.x, u), y: lerp(F.y, L.y - 10, u) }; };
const DIVE = T.fall - 0.035; // 光の玉が空の端から落ちはじめる
const comet = {
    pose(p, home, foot, _body, frame, w) {
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump)
            return crouch(p, frame, w);
        const L = land(foot), sky = { x: home.x + 40, y: -90 };
        if (p < T.hush) {
            const k = win(p, T.jump, T.hush), q = (u) => ({ x: lerp(home.x, sky.x, up(u)), y: lerp(home.y, sky.y, up(u)) });
            return at(home, q(k), { action: 'dash', ghosts: trail(home, q, k, 4, 0.09, 0.45) });
        }
        if (p < T.impact + 0.01)
            return { ...base, alpha: 0 }; // 光の玉になっている（DIVE から急降下）
        if (p < T.land)
            return at(home, { x: L.x + 4, y: L.y + 2 }, { action: 'guard', t: 1, flip: true }); // クレーターの中で、片膝をついて着地
        return goHome(p, home, { x: L.x + 4, y: L.y });
    },
    cam(p, home, foot, body) {
        const hx = home.x - 4, hy = home.y - 22, L = land(foot);
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (p < T.hush) {
            const k = ease(win(p, T.jump, T.hush));
            return [g, lerp(1.6, 1.2, k), lerp(hx, hx - 20, k), hy - 90 * k];
        }
        if (p < T.impact)
            return [g, 1.0, (L.x + home.x) / 2 + 10, body.y - 40]; // 空の端から落ちてくる線が入る広さ（DIVE〜）
        return [g, p < T.impact + 0.04 ? 1.35 : 1.2, L.x, body.y - 10];
    },
    beats: () => [{ t: T.jump, stop: 0, shake: 2, sfx: 'jump' }, { t: T.hush, stop: 0, shake: 0, sfx: 'charge' }, { t: DIVE, stop: 0, shake: 1, sfx: 'dive' }, { t: T.impact, stop: 0.008, shake: 11, sfx: 'impactHeavy' }, { t: T.impact + 0.04, stop: 0, shake: 5, sfx: 'rumble' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = cometCol(w), L = land(a.foot), ground = a.foot.y;
        chargeFx(a, hero, [cols[0], cols[1]]);
        hush(a, 0.55);
        ellipsis(a, L.x + 40, a.body.y - 50);
        // 空の端で光が生まれる（光の玉になる）
        const F = cometFrom({}, a.foot), bk = bump(p, T.hush, DIVE + 0.01);
        if (bk > 0) {
            glowDisc(ctx, F.x - 60, 20, 10 + 26 * bk, cols[0], bk, 1);
            starSpark(ctx, F.x - 60, 20, 10 + 16 * bk, bk, '#ffffff');
        }
        // 照準
        reticle(a, L.x, a.body.y - 16, win(p, T.hush, T.hush + 0.02) * (1 - win(p, T.fall + 0.01, T.impact)), win(p, T.hush, T.fall), cols[0]);
        // 急降下: 光の玉と長い尾、まわりの火の粉
        const fk = win(p, DIVE, T.impact);
        if (fk > 0 && fk < 1) {
            const h = cometAt(a.foot, fk);
            for (let i = 14; i >= 1; i--) {
                const q = cometAt(a.foot, Math.max(0, fk - i * 0.035));
                glowDisc(ctx, q.x, q.y, 16 - i * 0.8, i < 5 ? cols[1] : cols[0], 0.9 - i * 0.055, 0.3);
            }
            const tail = cometAt(a.foot, Math.max(0, fk - 0.5));
            glowLine(ctx, tail.x, tail.y, h.x, h.y, 10, cols[0], 0.9);
            glowLine(ctx, tail.x + 4, tail.y - 2, h.x, h.y, 3, '#ffffff', 0.8);
            glowDisc(ctx, h.x, h.y, 26, cols[0], 1, 1);
            starSpark(ctx, h.x, h.y, 16, 1, '#ffffff');
            const rng = new Rng(`${a.seed}:cometember`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 26; i++) {
                const t = (fk * 4 + rng.next()) % 1, q = cometAt(a.foot, Math.max(0, fk - t * 0.4));
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = [cols[0], cols[1], cols[2], '#ffffff'][i % 4];
                ctx.fillRect(R(q.x + rng.range(-10, 10)), R(q.y + rng.range(-10, 10) + t * 14), 2, 2);
            }
            ctx.restore();
            speedLines(ctx, h.x + 40, 120, h.y - 80, h.y + 20, a.frame, 0.5, cols[1], 12, -1.05);
        }
        // 着弾: 大きな火の輪・えぐれた地面・火の粉の雨
        const ik = win(p, T.impact, T.impact + 0.16);
        if (ik > 0 && ik < 1) {
            glowDisc(ctx, L.x, ground - 6, 50 * (0.5 + ik), cols[0], (1 - ik) * (1 - ik), 1);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; // 火柱のように立ちのぼる炎の舌
            const rng = new Rng(`${a.seed}:cometflame`);
            for (let i = 0; i < 12; i++) {
                const x = L.x + rng.range(-50, 50), h = rng.range(30, 80) * Math.sin(Math.PI * ik);
                ctx.globalAlpha = (1 - ik) * 0.8;
                ctx.fillStyle = i % 2 ? cols[0] : cols[1];
                ctx.fillRect(R(x - 2), R(ground - h), 4, R(h));
            }
            ctx.restore();
            groundRings(ctx, L.x, ground + 4, ik, cols[0], 210);
            sparkBurst(ctx, L.x, ground - 10, ik, `${a.seed}:cometspark`, [cols[0], cols[1], '#ffffff'], 40, 120, 160, 2);
        }
        crater(ctx, L.x, ground + 4, 34 * ease(win(p, T.impact, T.impact + 0.04)), 1 - win(p, T.land, T.home), cols[0]);
        rocks(a, L.x, ground, win(p, T.impact, T.impact + 0.2), 'cometrock', 50, 170);
        dustCloud(a, L.x, ground + 4, win(p, T.impact, T.impact + 0.18), 'cometdust', 2.6);
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.04), cols[1], 0.95);
    },
};
// =====================================================================
// 雷刃（bolt）
// =====================================================================
const BOLT_COL = { book: ['#c77dff', '#f0e0ff'], pan: ['#ffb04a', '#fff0b0'] };
const boltCol = (w) => BOLT_COL[w] ?? ['#ffe27a', '#ffffff'];
const boltApex = (foot, body) => ({ x: land(foot).x + 6, y: body.y - 64 });
const STRIKE = T.hush + 0.025; // 雷が武器に落ちる
const boltMove = {
    pose(p, home, foot, body, frame, w) {
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump)
            return crouch(p, frame, w);
        const ap = boltApex(foot, body), L = land(foot);
        if (p < T.hush) {
            const k = win(p, T.jump, T.hush), q = (u) => ({ x: lerp(home.x, ap.x, up(u)), y: lerp(home.y, ap.y, up(u)) - Math.sin(u * Math.PI) * 16 });
            return at(home, q(k), { action: 'dash', ghosts: trail(home, q, k, 4, 0.1, 0.4) });
        }
        if (p < T.fall) { // 武器を天にかざす。雷を受けて震える
            const shock = p > STRIKE ? Math.sin(frame * 2.7) * 1.2 * (1 - win(p, STRIKE, T.fall)) : 0;
            return at(home, { x: ap.x + shock, y: ap.y + Math.sin(frame / 6) * 0.6 }, { action: MAGIC.has(w) ? 'cast' : 'attack', t: 0.05 });
        }
        if (p < T.impact) {
            const k = win(p, T.fall, T.impact), q = (u) => ({ x: lerp(ap.x, L.x, easeIn(u)), y: lerp(ap.y, L.y, easeIn(u)) });
            return at(home, q(k), { action: 'attack', t: 0.5 + 0.4 * k, rot: -0.5, ghosts: trail(home, q, k, 5, 0.1, 0.5) });
        }
        if (p < T.land)
            return at(home, L, { action: 'attack', t: 0.95 });
        return goHome(p, home, L);
    },
    cam(p, home, foot, body) {
        const hx = home.x - 4, hy = home.y - 22, ap = boltApex(foot, body);
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (p < T.hush) {
            const k = ease(win(p, T.jump, T.hush));
            return [g, lerp(1.6, 1.4, k), lerp(hx, ap.x, k), lerp(hy, ap.y - 20, k)];
        }
        if (p < T.fall)
            return [g, 1.55, ap.x, ap.y - 26]; // 雷を受ける主役に寄る
        if (p < T.impact)
            return [g, 1.2, ap.x - 4, body.y - 30];
        return [g, 1.15, land(foot).x - 10, body.y - 12];
    },
    beats: () => [{ t: T.jump, stop: 0, shake: 2, sfx: 'jump' }, { t: STRIKE, stop: 0.004, shake: 5, sfx: 'thunder' }, { t: T.fall, stop: 0, shake: 0, sfx: 'dive' }, { t: T.impact, stop: 0.008, shake: 8, sfx: 'impactMagic' }, { t: T.impact + 0.02, stop: 0, shake: 3, sfx: 'thunder' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = boltCol(w), ap = boltApex(a.foot, a.body), L = land(a.foot), ground = a.foot.y;
        chargeFx(a, hero, cols);
        // 雷雲: 空が暗くなり、雲の中で光がまたたく
        const sky = win(p, T.jump, T.hush) * (1 - win(p, T.impact + 0.04, T.land + 0.04));
        dim(a, 0.62 * sky, '#05061a');
        if (sky > 0) {
            ctx.save();
            const rng = new Rng(`${a.seed}:cloud`);
            for (let i = 0; i < 16; i++) {
                const x = ap.x + rng.range(-160, 160), y = rng.range(-8, 18), r = rng.range(14, 30);
                ctx.globalAlpha = sky * 0.85;
                ctx.fillStyle = i % 2 ? '#1a1830' : '#24223e';
                ctx.beginPath();
                ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
            if (a.frame % 23 < 2)
                glowDisc(ctx, ap.x + ((a.frame * 37) % 160) - 80, 8, 30, cols[0], sky * 0.5, 0.4);
        }
        const tip = { x: ap.x - 6, y: ap.y - 28 }; // かざした武器の先
        // 落雷: 天から武器の先へ
        const sk = bump(p, STRIKE - 0.004, STRIKE + 0.03);
        if (sk > 0) {
            bolt(ctx, tip.x + 10, -40, tip.x, tip.y, `${a.seed}:strike${Math.floor(a.frame / 2)}`, 4, cols[0], sk, 12, 3);
            bolt(ctx, tip.x - 30, -40, tip.x, tip.y, `${a.seed}:strike2${Math.floor(a.frame / 3)}`, 1.5, cols[1], sk * 0.6, 8, 1);
            glowDisc(ctx, tip.x, tip.y, 30, cols[0], sk, 1);
        }
        // 雷をまとう: 体のまわりで小さな稲妻がはじけ続ける
        const mk = win(p, STRIKE, STRIKE + 0.01) * (1 - win(p, T.impact + 0.02, T.impact + 0.06));
        if (mk > 0) {
            const k = win(p, T.fall, T.impact), pos = p < T.fall ? { x: ap.x, y: ap.y } : { x: lerp(ap.x, L.x, easeIn(k)), y: lerp(ap.y, L.y, easeIn(k)) };
            for (let i = 0; i < 4; i++) {
                const an = (a.frame * 0.7 + i * 1.7) % TAU, r0 = 8, r1 = 20 + (i % 2) * 6;
                bolt(ctx, pos.x + Math.cos(an) * r0, pos.y - 14 + Math.sin(an) * r0, pos.x + Math.cos(an) * r1, pos.y - 14 + Math.sin(an) * r1, `${a.seed}:aura${i}${a.frame % 5}`, 1, cols[0], mk * 0.9, 4, 0);
            }
            glowDisc(ctx, pos.x, pos.y - 14, 28, cols[0], mk * 0.5, 0.5);
            if (p >= T.fall && p < T.impact)
                glowLine(ctx, ap.x, ap.y - 14, pos.x, pos.y - 14, 8, cols[0], 0.8);
        }
        // 突き刺さる: 稲妻が地面を左右へ走り、ボスの体を雷が駆けめぐる
        const ik = win(p, T.impact, T.impact + 0.16);
        if (ik > 0 && ik < 1) {
            const run = ease(clamp01(ik * 1.8));
            for (const dir of [-1, 1])
                bolt(ctx, L.x, ground + 2, L.x + dir * 150 * run, ground + 2, `${a.seed}:run${dir}${Math.floor(a.frame / 2)}`, 3, cols[0], 1 - ik, 6, 2);
            for (let i = 0; i < 3; i++)
                bolt(ctx, a.body.x + (i - 1) * 16, a.body.y - 40, a.body.x + (i - 1) * 10, a.body.y + 20, `${a.seed}:body${i}${Math.floor(a.frame / 2)}`, 2, cols[1], (1 - ik) * 0.9, 8, 1);
            bolt(ctx, L.x, -60, L.x, ground, `${a.seed}:pillar${Math.floor(a.frame / 2)}`, 7 * (1 - ik) + 2, cols[0], 1 - ik, 10, 3);
            groundRings(ctx, L.x, ground + 4, ik, cols[0], 150);
            sparkBurst(ctx, L.x, ground - 6, ik, `${a.seed}:boltspark`, [cols[0], cols[1], '#ffffff'], 34, 90, 40);
        }
        rocks(a, L.x, ground, win(p, T.impact, T.impact + 0.16), 'boltrock', 22, 110);
        flash(a, sk, cols[1], 0.35);
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.9);
    },
};
// =====================================================================
// 影縫い（shadow）
// =====================================================================
const SH = ['#a55bd8', '#e2c2ff'];
const SHADOW_HITS = [T.hush + 0.02, T.hush + 0.055, T.impact];
const shadowSpot = (body, i) => ({ x: body.x + [26, -18, 6][i], y: body.y - 60 });
const shadowCut = (body, i) => { const s = shadowSpot(body, i); return [{ x: s.x + 6, y: s.y + 4 }, { x: s.x - 14 + i * 6, y: body.y + 40 }]; };
const shadow = {
    pose(p, home, foot, body, frame, w) {
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump)
            return crouch(p, frame, w);
        const L = land(foot);
        if (p < SHADOW_HITS[0] - 0.012) { // 影になって、残像だけが一直線にボスの頭上へ
            const k = win(p, T.jump, SHADOW_HITS[0] - 0.012), A = shadowSpot(body, 0), q = (u) => ({ x: lerp(home.x, A.x, u), y: lerp(home.y, A.y, u) - Math.sin(u * Math.PI) * 30 });
            return { ...base, alpha: 0, ghosts: Array.from({ length: 9 }, (_, j) => { const g = q(Math.max(0, k - j * 0.08)); return { x: g.x - home.x, y: g.y - home.y, a: 0.5 - j * 0.05, act: 'dash' }; }) };
        }
        for (let i = 0; i < 3; i++) { // 頭上に現れて、斬り下ろす（三度）
            const t0 = SHADOW_HITS[i], s = shadowSpot(body, i), [P, Q] = shadowCut(body, i);
            if (p < t0 + 0.012) {
                const k = win(p, t0 - 0.012, t0 + 0.004), q = (u) => ({ x: lerp(s.x, Q.x + 6, ease(u)), y: lerp(s.y, Q.y - 34, ease(u)) });
                void P;
                return at(home, q(k), { action: 'attack', t: 0.2 + 0.75 * k, alpha: 0.95, ghosts: trail(home, q, k, 4, 0.12, 0.4, 'attack') });
            }
            if (i < 2 && p < SHADOW_HITS[i + 1] - 0.012)
                return { ...base, alpha: 0 }; // 影に溶けて、次の位置へ
        }
        if (p < T.land)
            return at(home, L, { action: 'guard', t: 1 }); // 着地して、短剣を逆手に構える
        return goHome(p, home, L);
    },
    cam(p, home, _foot, body) {
        const hx = home.x - 4, hy = home.y - 22;
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (p < SHADOW_HITS[0] - 0.012) {
            const k = ease(win(p, T.jump, SHADOW_HITS[0] - 0.012));
            return [g, lerp(1.6, 1.3, k), lerp(hx, body.x + 10, k), lerp(hy, body.y - 20, k)];
        }
        return [g, 1.35, body.x + 8, body.y - 16];
    },
    beats: () => [{ t: T.jump, stop: 0, shake: 1, sfx: 'whoosh' }, ...SHADOW_HITS.slice(0, 2).map((t) => ({ t, stop: 0.003, shake: 3, sfx: 'slash' })), { t: T.impact, stop: 0.008, shake: 7, sfx: 'impactBlade' }, { t: T.impact + 0.03, stop: 0, shake: 2, sfx: 'shatter' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        chargeFx(a, hero, SH);
        // 影の世界: 紫の闇に沈む
        dim(a, 0.68 * win(p, T.jump, T.hush) * (1 - win(p, T.impact + 0.04, T.land)), '#0c0418');
        // 主役が影に溶ける（黒い靄）
        const dk = bump(p, T.jump - 0.01, T.jump + 0.05);
        if (dk > 0)
            sparkBurst(ctx, hero.x, hero.y - 12, clamp01((p - T.jump + 0.01) / 0.06), `${a.seed}:melt`, ['#2a103e', '#a55bd8', '#14081e'], 30, 30, -40, 3);
        // 三度の斬り下ろし: 頭上から影の刃。斬るたびに、影の分身が残る
        SHADOW_HITS.forEach((t0, i) => {
            const s = shadowSpot(a.body, i), [P, Q] = shadowCut(a.body, i);
            const ak = bump(p, t0 - 0.02, t0 - 0.008); // 現れる直前の影のゆらぎ
            if (ak > 0)
                glowDisc(ctx, s.x, s.y - 10, 16, SH[0], ak, 0.2);
            const k = win(p, t0 - 0.006, t0 + 0.004), fade = 1 - win(p, t0 + 0.01, t0 + 0.08);
            if (k > 0 && fade > 0) {
                const head = { x: lerp(P.x, Q.x, ease(k)), y: lerp(P.y, Q.y, ease(k)) };
                slashLine(ctx, P.x, P.y, head.x, head.y, 12, SH, fade);
                slashLine(ctx, P.x + 3, P.y, head.x + 3, head.y, 3, ['#14081e', '#2a103e'], fade * 0.8);
                if (k >= 1)
                    sparkBurst(ctx, a.body.x + (i - 1) * 10, a.body.y, win(p, t0, t0 + 0.06), `${a.seed}:shspark${i}`, [SH[0], SH[1], '#ffffff'], 16, 40, 20);
            }
            // 斬ったあとに残る影の分身（だんだん消える）
            const gk = win(p, t0 + 0.004, t0 + 0.01) * (1 - win(p, T.impact + 0.02, T.impact + 0.1));
            if (gk > 0 && a.ult?.look)
                heroSilhouette(ctx, (c) => drawHero(c, a.ult.look, { back: [], fams: [], charms: [] }, 32, 56, { frame: a.frame, flip: true, action: 'attack', t: 0.95, ring: false }), Q.x + 6, Q.y - 34 + 24, 1, '#1a0828', gk * 0.75, 1);
        });
        // 影を縫いとめる: ボスの足元の影に、紫の糸が何本も縫いこまれる
        const nk = win(p, T.impact, T.impact + 0.04), nf = 1 - win(p, T.impact + 0.1, T.land + 0.04);
        if (nk > 0 && nf > 0) {
            ctx.save();
            ctx.globalAlpha = nf * 0.7;
            ctx.fillStyle = '#14081e';
            ctx.beginPath();
            ctx.ellipse(a.foot.x + 8, a.foot.y + 4, 54, 12, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
            for (let i = 0; i < 7; i++) {
                const x = a.foot.x - 34 + i * 12, k2 = ease(clamp01(nk * 1.6 - i * 0.08));
                glowLine(ctx, x + 10, a.foot.y - 30, lerp(x + 10, x, k2), lerp(a.foot.y - 30, a.foot.y + 6, k2), 1.5, i % 2 ? SH[1] : SH[0], nf);
            }
            text(ctx, tl('縫'), a.body.x + 40, a.body.y - 40, R(14 + 6 * (1 - nk)), SH[1], nf * Math.min(1, nk * 3), '#14081e');
        }
        const ik = win(p, T.impact, T.impact + 0.14);
        if (ik > 0 && ik < 1) {
            sparkBurst(ctx, a.body.x + 4, a.body.y, ik, `${a.seed}:shburst`, [SH[0], SH[1], '#ffffff'], 36, 90, 20);
            groundRings(ctx, a.foot.x + 8, a.foot.y + 4, ik, SH[0], 120, 2);
        }
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), SH[1], 0.55);
        void w;
    },
};
export const OUGI_MOVES = { fall, moon, cross, comet, bolt: boltMove, shadow };
void SHOT;
//# sourceMappingURL=ult-ougi.js.map