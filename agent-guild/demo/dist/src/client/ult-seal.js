import { tl } from '../shared/i18n.js';
import { Rng } from '../shared/rng.js';
import { ULT_T, R, TAU, bump, clamp01, dim, dustCloud, ease, flash, glowArc, glowDisc, glowLine, groundRings, impactBurst, lerp, petals, rocks, skyDisc, slashLine, sparkBurst, speedLines, starSpark, text, win, } from './ultkit.js';
const T = ULT_T.seal;
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const MAGIC = new Set(['wand', 'book', 'fan', 'guitar']);
const SHOT = new Set(['bow', 'blaster']);
const at = (home, q, extra = {}) => ({ ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra });
const front = (body) => ({ x: body.x + 64, y: body.y + 16 });
const ctrOf = (a) => ({ x: a.body.x + 2, y: a.foot.y + 4 });
const bcOf = (a) => ({ x: a.body.x + 2, y: a.body.y });
// 主役: ボスの正面へ → 浮いて詠唱 → 打ちこむ（以前と同じ。打ちこみの動きは武器しだい）
function sealPose(p, home, body, frame, w, lunge = 0) {
    const fr = front(body);
    if (p < T.circle - 0.02 || p >= T.home)
        return null;
    if (p < T.chain) {
        const k = win(p, T.circle - 0.02, T.chain), q = (u) => ({ x: lerp(home.x, fr.x, ease(u)), y: lerp(home.y, fr.y, ease(u)) });
        return at(home, q(k), { action: 'dash', ghosts: Array.from({ length: 3 }, (_, j) => { const g = q(Math.max(0, k - (j + 1) * 0.14)); return { x: g.x - home.x, y: g.y - home.y, a: 0.35 / (j + 1) }; }) });
    }
    if (p < T.hit + 0.06) {
        const lift = win(p, T.chain, T.chain + 0.04) * (1 - win(p, T.hit + 0.02, T.hit + 0.06));
        const driving = p >= T.drive && !MAGIC.has(w);
        const lx = driving ? -lunge * ease(win(p, T.drive, T.hit)) * (1 - win(p, T.hit + 0.02, T.hit + 0.06)) : 0;
        return at(home, { x: fr.x + lx, y: fr.y - 6 * ease(lift) + Math.sin(frame / 6) * lift }, { action: driving ? 'attack' : 'cast', t: driving ? 0.2 + 0.7 * win(p, T.drive, T.hit) : 0.5 });
    }
    const k = win(p, T.hit + 0.06, T.home);
    return at(home, { x: lerp(fr.x, home.x, ease(k)), y: lerp(fr.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: false });
}
function sealCam(p, home, body, zoom = 1.4) {
    const g = win(p, T.circle - 0.04, T.circle) * (1 - win(p, T.hit + 0.08, T.home));
    if (g <= 0)
        return null;
    if (p < T.chain)
        return [g, 1.5, home.x - 4, home.y - 22];
    return [g, p < T.drive ? 1.2 : zoom, body.x + 36, body.y - 12];
}
// 打ちこみ（主役から封印へ）: 武器しだいの一撃の線
function driveFx(a, w, cols, to) {
    const { ctx, phase: p } = a;
    const fr = front(a.body), hand = { x: fr.x - 10, y: fr.y - 18 };
    const k = win(p, T.drive, T.hit), fade = 1 - win(p, T.hit + 0.01, T.hit + 0.06);
    if (k <= 0 || fade <= 0)
        return;
    if (SHOT.has(w)) {
        const e = { x: lerp(hand.x, to.x, ease(k)), y: lerp(hand.y, to.y, ease(k)) };
        glowLine(ctx, hand.x, hand.y, e.x, e.y, 6 * fade + 1, cols[0], fade);
        starSpark(ctx, hand.x, hand.y, 10 * fade, fade, '#ffffff');
    }
    else if (MAGIC.has(w)) {
        const e = { x: lerp(hand.x, to.x, ease(k)), y: lerp(hand.y, to.y, ease(k)) };
        glowLine(ctx, hand.x, hand.y - 4, e.x, e.y, 3, cols[1], fade);
        glowDisc(ctx, hand.x, hand.y - 4, 14 * fade, cols[0], fade, 1);
    }
    else
        slashLine(ctx, to.x + 50, to.y - 60, lerp(to.x + 50, to.x - 40, ease(k)), lerp(to.y - 60, to.y + 50, ease(k)), 16, cols, fade);
}
// =====================================================================
// 結界の箱（box）
// =====================================================================
const BOX_COL = { blaster: ['#63d471', '#c8ffc8'], hammer: ['#ffd166', '#fff6c8'], spear: ['#7fe0ff', '#e8fff0'] };
const boxCol = (w) => BOX_COL[w] ?? ['#9fe8ff', '#ffffff'];
// 箱の大きさ（半幅）。現れて → 締めつけて縮む → 砕ける
const boxSize = (p) => { const app = ease(win(p, T.chain, T.chain + 0.05)), squeeze = ease(win(p, T.bind, T.strain)) * 0.25 + ease(win(p, T.drive, T.hit)) * 0.15; return { s: 54 * (0.5 + 0.5 * app) * (1 - squeeze), app }; };
function boxPts(a, s, shake) {
    const c = { x: a.body.x + 2 + shake, y: a.foot.y - 30 }, d = s * 0.45; // 奥行き（斜め上）
    const f = [{ x: c.x - s, y: c.y + s * 0.6 }, { x: c.x + s, y: c.y + s * 0.6 }, { x: c.x + s, y: c.y - s * 1.1 }, { x: c.x - s, y: c.y - s * 1.1 }];
    const b = f.map((q) => ({ x: q.x + d, y: q.y - d * 0.6 }));
    return { f, b, c };
}
function boxEdges(a, w, back) {
    const { ctx, phase: p } = a;
    const cols = boxCol(w), { s, app } = boxSize(p), out = 1 - win(p, T.hit, T.hit + 0.02);
    if (app <= 0 || out <= 0)
        return;
    const shake = p > T.bind && p < T.hit ? Math.sin(a.frame * 1.9) * 1.2 * win(p, T.bind, T.strain) : 0;
    const { f, b } = boxPts(a, s, shake), al = app * out, hot = win(p, T.strain, T.hit);
    const col = hot > 0.5 && a.frame % 6 < 3 ? '#ffffff' : cols[0];
    if (back) { // 奥の面（背面の四辺と、奥へのびる辺）
        for (let i = 0; i < 4; i++)
            glowLine(ctx, b[i].x, b[i].y, b[(i + 1) % 4].x, b[(i + 1) % 4].y, 1.6, col, al * 0.6);
        for (let i = 0; i < 4; i++)
            glowLine(ctx, f[i].x, f[i].y, b[i].x, b[i].y, 1.6, col, al * 0.6);
        return;
    }
    // 手前の面: 六角の模様の、半透明の壁
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = al * (0.18 + 0.25 * hot);
    ctx.fillStyle = cols[0];
    ctx.beginPath();
    f.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = al * 0.5;
    ctx.strokeStyle = cols[1];
    ctx.lineWidth = 0.8;
    const hs = 9, x0 = f[0].x, y0 = f[2].y;
    for (let r = 0; r < 14; r++)
        for (let q = 0; q < 14; q++) {
            const cx = x0 + q * hs * 1.5, cy = y0 + r * hs * 1.7 + (q % 2) * hs * 0.85;
            ctx.beginPath();
            for (let k = 0; k <= 6; k++) {
                const an = (k / 6) * TAU;
                k ? ctx.lineTo(cx + Math.cos(an) * hs * 0.55, cy + Math.sin(an) * hs * 0.55) : ctx.moveTo(cx + Math.cos(an) * hs * 0.55, cy + Math.sin(an) * hs * 0.55);
            }
            ctx.stroke();
        }
    ctx.restore();
    for (let i = 0; i < 4; i++)
        glowLine(ctx, f[i].x, f[i].y, f[(i + 1) % 4].x, f[(i + 1) % 4].y, 2.4 + 2 * hot, col, al);
    for (const q of f)
        starSpark(ctx, q.x, q.y, 5 + 4 * hot, al, '#ffffff');
}
const box = {
    pose: (p, home, _f, body, frame, w) => sealPose(p, home, body, frame, w, w === 'hammer' ? 18 : w === 'spear' ? 14 : 6),
    cam: (p, home, _f, body) => sealCam(p, home, body, 1.4),
    beats: (w) => [{ t: T.chain, stop: 0, shake: 1, sfx: 'barrier' }, { t: T.bind, stop: 0.002, shake: 2, sfx: 'sealBind' }, { t: T.strain, stop: 0, shake: 3, sfx: 'rumble' }, { t: T.drive, stop: 0, shake: 0, sfx: SHOT.has(w) ? 'shoot' : 'whoosh' },
        { t: T.hit, stop: 0.008, shake: 8, sfx: 'shatter' }, { t: T.hit + 0.005, stop: 0, shake: 4, sfx: w === 'hammer' ? 'impactHeavy' : 'impactMagic' }],
    back(a, _hero, w) { boxEdges(a, w, true); },
    top(a, _hero, w) {
        const { ctx, phase: p } = a;
        const cols = boxCol(w), { s } = boxSize(p);
        boxEdges(a, w, false);
        const { c } = boxPts(a, s, 0);
        if (p > T.bind && p < T.hit && a.frame % 10 < 5)
            text(ctx, tl('封…！'), c.x + s + 30, c.y - s - 10, 10, '#ffffff', win(p, T.bind, T.strain), '#0a1a2a');
        // 締めつけ: 箱の内側に光がたまる
        const sq = win(p, T.strain, T.hit);
        if (sq > 0 && p < T.hit)
            glowDisc(ctx, c.x, c.y - 10, s * 1.2, cols[0], sq * 0.6, 0.8);
        driveFx(a, w, cols, { x: c.x, y: c.y - 10 });
        // はじける: 箱の壁が六角の破片になって飛び散る
        const hk = win(p, T.hit, T.hit + 0.16);
        if (hk > 0 && hk < 1) {
            const rng = new Rng(`${a.seed}:boxshard`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 46; i++) {
                const an = rng.range(0, TAU), sp = rng.range(20, 130), x = c.x + Math.cos(an) * (s * 0.6 + sp * ease(hk)), y = c.y - 10 + Math.sin(an) * (s * 0.5 + sp * ease(hk) * 0.7) + 60 * hk * hk;
                ctx.globalAlpha = 1 - hk;
                ctx.fillStyle = i % 3 ? cols[0] : '#ffffff';
                ctx.save();
                ctx.translate(R(x), R(y));
                ctx.rotate(hk * 8 + i);
                ctx.fillRect(-3, -2, 6, 4);
                ctx.restore();
            }
            ctx.restore();
            glowLine(ctx, c.x, -200, c.x, a.foot.y + 10, 24 * (1 - hk) + 2, cols[0], 1 - hk);
            if (w === 'hammer') {
                rocks(a, c.x, a.foot.y, hk, 'boxrock', 30, 120);
                dustCloud(a, c.x, a.foot.y + 4, hk, 'boxdust', 1.6);
            }
        }
        impactBurst(a, c.x, c.y - 10, hk, cols[0], cols[1], 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.85);
    },
};
// =====================================================================
// 札（talisman）
// =====================================================================
const TAL_N = 12;
// 札 i の貼りつく場所（ボスのまわり、上から順に）と、飛んでいく時刻
const talSpot = (body, i) => { const an = -Math.PI / 2 + (i / TAL_N) * TAU, r = 30 + (i % 3) * 8; return { x: body.x + 2 + Math.cos(an) * r, y: body.y + 2 + Math.sin(an) * r * 1.1 }; };
const talT = (i) => T.chain + (i / TAL_N) * (T.bind - T.chain);
const talLit = (i) => T.bind + (i / TAL_N) * (T.drive - T.bind); // 順に光る
function drawTalisman(ctx, x, y, rot, lit, al) {
    ctx.save();
    ctx.translate(R(x), R(y));
    ctx.rotate(rot);
    ctx.globalAlpha = al;
    ctx.fillStyle = '#f4ead2';
    ctx.fillRect(-4, -7, 8, 14);
    ctx.fillStyle = '#c8301a';
    ctx.fillRect(-4, -7, 8, 2);
    ctx.fillRect(-1, -4, 2, 8);
    ctx.fillRect(-3, -1, 6, 1);
    ctx.fillRect(-3, 3, 6, 1); // 朱の字（封）
    if (lit > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = al * lit;
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-5, -8, 10, 16);
    }
    ctx.restore();
}
const talisman = {
    pose: (p, home, _f, body, frame, w) => sealPose(p, home, body, frame, w, 0),
    cam: (p, home, _f, body) => sealCam(p, home, body, 1.5),
    beats: () => [{ t: T.chain, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.chain + 0.04, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.bind, stop: 0.002, shake: 2, sfx: 'sealBind' },
        ...Array.from({ length: 4 }, (_, i) => ({ t: talLit(i * 3), stop: 0, shake: 1, sfx: 'chant', v: 0.7 + i * 0.2 })), { t: T.hit, stop: 0.008, shake: 8, sfx: 'boom' }, { t: T.hit + 0.006, stop: 0, shake: 3, sfx: 'impactMagic' }],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = ['#ffd166', '#fff6c8'];
        const fr = front(a.body), from = { x: fr.x - 8, y: fr.y - 20 }, out = 1 - win(p, T.hit, T.hit + 0.01);
        // 扇から舞い上がる札（扇は風で運ぶ）
        for (let i = 0; i < TAL_N; i++) {
            const t0 = talT(i), k = win(p, t0, t0 + 0.04), to = talSpot(a.body, i);
            if (k <= 0 || out <= 0)
                continue;
            const pos = { x: lerp(from.x, to.x, ease(k)), y: lerp(from.y, to.y, ease(k)) - Math.sin(k * Math.PI) * 30 };
            const lit = win(p, talLit(i), talLit(i) + 0.01) * (0.6 + 0.4 * Math.sin(a.frame / 2 + i));
            const quiver = p > T.strain ? Math.sin(a.frame * 2 + i) * 0.15 : 0;
            drawTalisman(ctx, pos.x, pos.y, k < 1 ? k * 9 + i : (i % 2 ? 0.2 : -0.2) + quiver, lit, out);
            if (lit > 0) {
                glowDisc(ctx, pos.x, pos.y, 10, cols[0], lit * 0.6, 0.6);
                if (talLit(i) <= p && p < talLit(i) + 0.012)
                    text(ctx, tl('封'), pos.x, pos.y - 14, 9, '#ffe9a0', 1, '#3a1a00');
            }
            if (k < 1)
                glowLine(ctx, lerp(from.x, to.x, Math.max(0, ease(k) - 0.15)), lerp(from.y, to.y, Math.max(0, ease(k) - 0.15)), pos.x, pos.y, 1, '#ffffff', 0.4);
        }
        if (w === 'fan')
            petals(ctx, from.x - 20, from.y, 120, 80, p * 3, `${a.seed}:talwind`, ['#9be7b0', '#e3ffc8', '#ffffff'], bump(p, T.chain, T.bind + 0.04), 16, -1);
        // 札どうしを結ぶ光の線（光ったものから）
        for (let i = 0; i < TAL_N; i++) {
            const lit = win(p, talLit(i), talLit(i) + 0.01) * out;
            if (lit <= 0)
                continue;
            const A = talSpot(a.body, i), B = talSpot(a.body, (i + 5) % TAL_N);
            glowLine(ctx, A.x, A.y, B.x, B.y, 1, cols[0], lit * 0.6);
        }
        if (p > T.strain && p < T.hit && a.frame % 8 < 4)
            text(ctx, tl('封…！'), a.body.x + 56, a.body.y - 46, 10, '#ffffff', 1, '#3a1a00');
        // いっせいに爆ぜる: 札ごとに小さな爆発 → 全体の大爆発
        const hk = win(p, T.hit, T.hit + 0.16);
        if (hk > 0 && hk < 1) {
            for (let i = 0; i < TAL_N; i++) {
                const q = talSpot(a.body, i), kk = clamp01(hk * 1.6 - (i % 4) * 0.05);
                glowDisc(ctx, q.x, q.y, 18 * (0.5 + kk), cols[0], (1 - kk) * (1 - kk), 1);
                sparkBurst(ctx, q.x, q.y, kk, `${a.seed}:talb${i}`, ['#ffd166', '#c8301a', '#ffffff', '#f4ead2'], 8, 26, 30);
            }
            petals(ctx, a.body.x, a.body.y, 200 * hk + 40, 120, hk * 2, `${a.seed}:talash`, ['#f4ead2', '#c8b89a', '#ffd166'], 1 - hk, 30, 0.5); // 燃える紙片
        }
        impactBurst(a, a.body.x + 2, a.body.y, hk, cols[0], '#ff7a3a', 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.8);
        void hero;
    },
};
// =====================================================================
// 光の柱（pillar）
// =====================================================================
const PIL_COL = { guitar: ['#ff6bd6', '#7fe0ff', 300], pan: ['#ffb04a', '#fff0b0', 35], umbrella: ['#7bed9f', '#e3ffc8', 140] };
const pilCol = (w) => PIL_COL[w] ?? ['#ffe27a', '#ffffff', 50];
const DRAW1 = T.bind; // 魔法陣を描き終える
function pillarW(p) { const up = ease(win(p, DRAW1, DRAW1 + 0.04)), narrow = ease(win(p, T.strain, T.hit)); return 46 * up * (1 - narrow * 0.7) + 6 * narrow; }
const pillar = {
    pose: (p, home, _f, body, frame, w) => sealPose(p, home, body, frame, w, w === 'pan' ? 10 : 0),
    cam: (p, home, _f, body) => sealCam(p, home, body, 1.3),
    beats: () => [{ t: T.chain, stop: 0, shake: 0, sfx: 'chant' }, { t: T.chain + 0.05, stop: 0, shake: 0, sfx: 'chant', v: 1.2 }, { t: DRAW1, stop: 0.002, shake: 3, sfx: 'barrier' }, { t: DRAW1 + 0.01, stop: 0, shake: 2, sfx: 'rumble' },
        { t: T.strain, stop: 0, shake: 2, sfx: 'charge' }, { t: T.hit, stop: 0.008, shake: 8, sfx: 'impactMagic' }, { t: T.hit + 0.02, stop: 0, shake: 3, sfx: 'thunder' }],
    back(a, _hero, w) {
        const { ctx, phase: p } = a;
        const [c0, c1, hue] = pilCol(w), ctr = ctrOf(a), dk = win(p, T.chain, DRAW1), out = 1 - win(p, T.hit + 0.02, T.hit + 0.1);
        if (dk <= 0 || out <= 0)
            return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(ctr.x, ctr.y);
        ctx.scale(1, 0.28);
        const r = 84;
        const arc = (rr, k, col, wv) => { if (k <= 0)
            return; ctx.globalAlpha = out; ctx.strokeStyle = col; ctx.lineWidth = wv; ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); };
        arc(r, win(dk, 0, 0.4), c0, 3);
        arc(r * 0.82, win(dk, 0.15, 0.55), c1, 1.6);
        arc(r * 0.45, win(dk, 0.3, 0.7), c0, 1.6);
        const sk = win(dk, 0.5, 1); // 六芒星
        for (let j = 0; j < 6; j++) {
            const k = clamp01(sk * 6 - j);
            if (k <= 0)
                continue;
            const a0 = (j / 6) * TAU * 2 - Math.PI / 2, a1 = ((j + 1) / 6) * TAU * 2 - Math.PI / 2;
            ctx.globalAlpha = out;
            ctx.strokeStyle = c1;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0) * r * 0.82, Math.sin(a0) * r * 0.82);
            ctx.lineTo(lerp(Math.cos(a0), Math.cos(a1), k) * r * 0.82, lerp(Math.sin(a0), Math.sin(a1), k) * r * 0.82);
            ctx.stroke();
        }
        ctx.restore();
        if (dk >= 1)
            skyDisc(a, ctr.x, ctr.y, 84, out * 0.6, hue);
    },
    top(a, _hero, w) {
        const { ctx, phase: p } = a;
        const [c0, c1] = pilCol(w), ctr = ctrOf(a), bc = bcOf(a);
        // 魔法陣を描く光の点（筆先）
        const dk = win(p, T.chain, DRAW1);
        if (dk > 0 && dk < 1) {
            const an = -Math.PI / 2 + TAU * win(dk, 0, 0.4) * (dk < 0.4 ? 1 : 0) + (dk >= 0.4 ? a.frame / 3 : 0);
            starSpark(ctx, ctr.x + Math.cos(an) * 84, ctr.y + Math.sin(an) * 84 * 0.28, 8, 1, '#ffffff');
        }
        // 光の柱: 立ちのぼってボスを包み、細く絞られる
        const pw = pillarW(p), out = 1 - win(p, T.hit, T.hit + 0.04);
        if (pw > 0 && out > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(ctr.x - pw, 0, ctr.x + pw, 0);
            g.addColorStop(0, `${c0}00`);
            g.addColorStop(0.25, `${c0}88`);
            g.addColorStop(0.5, '#ffffff');
            g.addColorStop(0.75, `${c0}88`);
            g.addColorStop(1, `${c0}00`);
            ctx.globalAlpha = out * 0.85;
            ctx.fillStyle = g;
            ctx.fillRect(ctr.x - pw, -200, pw * 2, ctr.y + 200);
            ctx.restore();
            // 柱の中を昇る光の文字・粒
            const rng = new Rng(`${a.seed}:pilrune`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 26; i++) {
                const t = (p * 4 + rng.next()) % 1, x = ctr.x + rng.range(-pw, pw) * 0.8, y = ctr.y - t * 180;
                ctx.globalAlpha = out * (1 - t);
                ctx.fillStyle = i % 2 ? c1 : '#ffffff';
                ctx.fillRect(R(x), R(y), 2, i % 3 ? 2 : 4);
            }
            ctx.restore();
            // 柱のふちの輪（上へ流れる）
            for (let i = 0; i < 3; i++) {
                const t = (p * 6 + i / 3) % 1;
                glowArc(ctx, ctr.x, ctr.y - t * 150, pw, pw * 0.26, 0, TAU, 1.4, i % 2 ? c0 : c1, out * (1 - t));
            }
            if (w === 'guitar') {
                const rng2 = new Rng(`${a.seed}:pilnote`);
                for (let i = 0; i < 8; i++) {
                    const t = (p * 3 + rng2.next()) % 1;
                    text(ctx, i % 2 ? '♪' : '♫', ctr.x + rng2.range(-pw, pw), ctr.y - t * 160, 9, i % 2 ? c0 : c1, out * (1 - t), '#2a0a3a');
                }
            }
        }
        if (p > T.strain && p < T.hit && a.frame % 8 < 4)
            text(ctx, tl('封…！'), bc.x + 56, bc.y - 46, 10, '#ffffff', 1, '#3a1a00');
        driveFx(a, w, [c0, c1], { x: bc.x, y: bc.y });
        // 炸裂: 細い光が一瞬で太く弾けて、天へ抜ける
        const hk = win(p, T.hit, T.hit + 0.16);
        if (hk > 0 && hk < 1) {
            glowLine(ctx, ctr.x, -220, ctr.x, ctr.y + 6, 60 * Math.sin(Math.PI * Math.min(1, hk * 2)) * (1 - hk) + 3, c0, 1 - hk);
            groundRings(ctx, ctr.x, ctr.y, hk, c0, 180);
            sparkBurst(ctx, bc.x, bc.y, hk, `${a.seed}:pilburst`, [c0, c1, '#ffffff'], 44, 120, -20);
        }
        impactBurst(a, bc.x, bc.y, hk, c0, c1, 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.85);
    },
};
// =====================================================================
// 氷結（freeze）
// =====================================================================
const ICE = ['#8fd3ff', '#e8f8ff', '#2a5a9a'];
// 氷が足元から昇る高さ（0→1）
const iceUp = (p) => ease(win(p, T.chain, T.strain)) * (1 - win(p, T.hit, T.hit + 0.01));
// 氷の結晶（ギザギザの多角形）を、ボスの体の形に沿って並べる
function iceShards(a, k) {
    const { ctx } = a;
    if (k <= 0)
        return;
    const rng = new Rng(`${a.seed}:ice`), ground = a.foot.y + 2, top = a.body.y - 46, h = (ground - top) * k;
    ctx.save();
    for (let i = 0; i < 34; i++) {
        const yy = rng.range(0, 1), y = ground - yy * (ground - top);
        if (ground - y > h)
            continue;
        const wdt = 26 * (1 - yy * 0.5) + 6, x = a.body.x + 2 + rng.range(-wdt, wdt), s = rng.range(5, 11);
        const pts = Array.from({ length: 5 }, (_, j) => { const an = (j / 5) * TAU + rng.range(-0.3, 0.3), r = s * rng.range(0.6, 1.1); return { x: x + Math.cos(an) * r, y: y + Math.sin(an) * r * 1.4 - s * 0.3 }; });
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = i % 3 ? ICE[0] : '#bfe8ff';
        ctx.beginPath();
        pts.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = ICE[1];
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(R(pts[0].x), R(pts[0].y), 2, 1);
    }
    ctx.restore();
}
const freeze = {
    pose: (p, home, _f, body, frame, w) => sealPose(p, home, body, frame, w, w === 'axe' ? 18 : 0),
    cam: (p, home, _f, body) => sealCam(p, home, body, 1.45),
    beats: (w) => [{ t: T.chain, stop: 0, shake: 0, sfx: 'chant' }, { t: T.chain + 0.03, stop: 0, shake: 1, sfx: 'barrier' }, { t: T.bind, stop: 0.002, shake: 2, sfx: 'sealBind' }, { t: T.strain, stop: 0, shake: 2, sfx: 'guard' },
        { t: T.drive, stop: 0, shake: 0, sfx: MAGIC.has(w) ? 'thunder' : 'whoosh' }, { t: T.hit, stop: 0.008, shake: 8, sfx: 'shatter' }, { t: T.hit + 0.006, stop: 0, shake: 4, sfx: w === 'axe' ? 'impactHeavy' : 'impactMagic' }],
    back(a) {
        const { ctx, phase: p } = a;
        const k = ease(win(p, T.chain, T.bind)) * (1 - win(p, T.hit + 0.04, T.home));
        if (k <= 0)
            return;
        ctx.save();
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = '#cfefff';
        ctx.beginPath();
        ctx.ellipse(a.body.x + 2, a.foot.y + 4, 80 * k, 16 * k, 0, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = ICE[0];
        ctx.lineWidth = 1;
        const rng = new Rng(`${a.seed}:frost`);
        for (let i = 0; i < 10; i++) {
            const an = rng.range(0, TAU), r = rng.range(20, 80) * k;
            ctx.beginPath();
            ctx.moveTo(a.body.x + 2, a.foot.y + 4);
            ctx.lineTo(a.body.x + 2 + Math.cos(an) * r, a.foot.y + 4 + Math.sin(an) * r * 0.2);
            ctx.stroke();
        }
        ctx.restore();
    },
    top(a, _hero, w) {
        const { ctx, phase: p } = a;
        const bc = bcOf(a), up = iceUp(p);
        // 冷気の渦と雪
        const sk = bump(p, T.circle, T.hit + 0.02);
        if (sk > 0) {
            const rng = new Rng(`${a.seed}:snow`);
            ctx.save();
            for (let i = 0; i < 30; i++) {
                const t = (p * 2 + rng.next()) % 1, x = bc.x + rng.range(-90, 90) + Math.sin(t * 6 + i) * 6, y = -10 + t * (a.foot.y + 20);
                ctx.globalAlpha = sk * 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(x), R(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
            }
            ctx.restore();
        }
        // 青く凍りつく: ボスに冷たい光をかぶせ、氷の結晶を積む
        if (up > 0) {
            glowDisc(ctx, bc.x, a.foot.y - 30 * up, 60, ICE[0], up * 0.45, 0.2);
            iceShards(a, up);
        }
        // 浮かぶ大きな結晶（六角の雪の結晶）
        const ck = win(p, T.bind, T.strain) * (1 - win(p, T.hit, T.hit + 0.02));
        for (let i = 0; i < 3 && ck > 0; i++) {
            const x = bc.x + (i - 1) * 46, y = bc.y - 54 - (i % 2) * 10 + Math.sin(a.frame / 8 + i) * 2, r = 8 * ck;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = ck;
            ctx.strokeStyle = ICE[1];
            ctx.lineWidth = 1.4;
            ctx.translate(x, y);
            ctx.rotate(a.frame / 30 + i);
            for (let j = 0; j < 6; j++) {
                ctx.rotate(TAU / 6);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -r);
                ctx.moveTo(0, -r * 0.6);
                ctx.lineTo(r * 0.3, -r * 0.85);
                ctx.moveTo(0, -r * 0.6);
                ctx.lineTo(-r * 0.3, -r * 0.85);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (p > T.strain && p < T.hit && a.frame % 8 < 4)
            text(ctx, tl('凍結'), bc.x + 56, bc.y - 46, 10, '#e8f8ff', 1, '#0a1a3a');
        driveFx(a, w, [ICE[0], ICE[1]], { x: bc.x, y: bc.y });
        // 氷ごと砕ける: 氷の破片が飛び、きらきらと舞う
        const hk = win(p, T.hit, T.hit + 0.18);
        if (hk > 0 && hk < 1) {
            const rng = new Rng(`${a.seed}:iceshard`);
            ctx.save();
            for (let i = 0; i < 40; i++) {
                const an = rng.range(-Math.PI, 0.2), sp = rng.range(30, 140), x = bc.x + rng.range(-24, 24) + Math.cos(an) * sp * ease(hk), y = bc.y + rng.range(-30, 40) + Math.sin(an) * sp * ease(hk) * 0.7 + 120 * hk * hk;
                ctx.globalAlpha = 1 - hk;
                ctx.fillStyle = i % 3 ? ICE[0] : ICE[1];
                ctx.save();
                ctx.translate(R(x), R(y));
                ctx.rotate(hk * 6 + i);
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(3, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(-3, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
            sparkBurst(ctx, bc.x, bc.y, hk, `${a.seed}:iceglint`, ['#ffffff', ICE[1]], 30, 90, 20);
            groundRings(ctx, bc.x, a.foot.y + 4, hk, ICE[0], 150);
        }
        impactBurst(a, bc.x, bc.y, hk, ICE[0], ICE[1], 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#e8f8ff', 0.85);
    },
};
// =====================================================================
// 光の楔（stakes）
// =====================================================================
const STK_COL = { dagger: ['#a55bd8', '#e2c2ff'], bow: ['#ffd166', '#fff6c8'] };
const stkCol = (w) => STK_COL[w] ?? ['#7fe0ff', '#ffffff'];
// 楔の刺さる位置（ボスの四方。手前2本・奥2本）と落ちる時刻
const stakeAt = (a, i, tight) => { const an = (i / 4) * TAU + Math.PI / 4, r = 66 * (1 - tight * 0.35); return { x: a.body.x + 2 + Math.cos(an) * r, y: a.foot.y + 4 + Math.sin(an) * r * 0.3 }; };
const stakeT = (i) => T.chain + i * 0.022;
function drawStake(ctx, x, tip, cols, al) {
    glowLine(ctx, x, tip - 34, x, tip, 4, cols[0], al);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 4, tip - 10);
    ctx.lineTo(x + 4, tip - 10);
    ctx.lineTo(x, tip + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cols[0];
    ctx.fillRect(R(x - 5), R(tip - 36), 10, 3);
    ctx.restore(); // 頭の鍔
}
function stakeLayer(a, w, back) {
    const { ctx, phase: p } = a;
    const cols = stkCol(w), tight = ease(win(p, T.bind, T.strain)) + 0.15 * ease(win(p, T.drive, T.hit)), out = 1 - win(p, T.hit, T.hit + 0.02);
    if (out <= 0)
        return;
    for (let i = 0; i < 4; i++) {
        const isBack = i >= 2; // 奥の2本（i=2,3 は上側）
        const q = stakeAt(a, i, tight), sin = Math.sin((i / 4) * TAU + Math.PI / 4);
        if ((sin < 0) !== back)
            continue;
        const k = win(p, stakeT(i), stakeT(i) + 0.02);
        if (k <= 0)
            continue;
        const tip = lerp(-60, q.y, k * k);
        if (k < 1)
            speedLines(ctx, q.x, 16, tip - 80, tip - 20, a.frame, 0.6, cols[1], 5);
        drawStake(ctx, q.x, tip, cols, out);
        const ik = win(p, stakeT(i) + 0.02, stakeT(i) + 0.06);
        if (ik > 0 && ik < 1) {
            groundRings(ctx, q.x, q.y, ik, cols[0], 30, 2);
            dustCloud(a, q.x, q.y, ik, `stk${i}`, 0.7);
        }
        void isBack;
    }
}
const stakes = {
    pose: (p, home, _f, body, frame, w) => sealPose(p, home, body, frame, w, SHOT.has(w) ? 0 : 16),
    cam: (p, home, _f, body) => sealCam(p, home, body, 1.4),
    beats: (w) => [...Array.from({ length: 4 }, (_, i) => ({ t: stakeT(i) + 0.02, stop: 0.002, shake: 3, sfx: 'hit' })), { t: T.bind, stop: 0.002, shake: 2, sfx: 'sealBind' }, { t: T.strain, stop: 0, shake: 2, sfx: 'rumble' },
        { t: T.drive, stop: 0, shake: 0, sfx: SHOT.has(w) ? 'shoot' : 'slash' }, { t: T.hit, stop: 0.008, shake: 8, sfx: 'impactBlade' }, { t: T.hit + 0.01, stop: 0, shake: 2, sfx: 'shatter' }],
    back(a, _hero, w) { stakeLayer(a, w, true); },
    top(a, _hero, w) {
        const { ctx, phase: p } = a;
        const cols = stkCol(w), bc = bcOf(a), tight = ease(win(p, T.bind, T.strain)) + 0.15 * ease(win(p, T.drive, T.hit)), out = 1 - win(p, T.hit, T.hit + 0.02);
        // 楔どうしを結ぶ光の線（ひし形）→ 締めつける
        const lk = win(p, T.chain + 0.09, T.bind) * out;
        if (lk > 0) {
            const pts = [0, 1, 2, 3].map((i) => stakeAt(a, i, tight)), hot = win(p, T.strain, T.hit);
            for (let i = 0; i < 4; i++) {
                const A = pts[i], B = pts[(i + 1) % 4], k = clamp01(lk * 4 - i);
                if (k <= 0)
                    continue;
                glowLine(ctx, A.x, A.y - 18, lerp(A.x, B.x, k), lerp(A.y, B.y, k) - 18, 2 + 2 * hot, hot > 0.5 && a.frame % 6 < 3 ? '#ffffff' : cols[0], lk);
            }
            // 縛る光の帯（楔からボスの胴へ）
            if (tight > 0)
                for (let i = 0; i < 4; i++) {
                    const A = pts[i];
                    glowLine(ctx, A.x, A.y - 18, lerp(A.x, bc.x, 0.75), lerp(A.y - 18, bc.y, 0.75), 1.4, cols[1], tight * out * (0.6 + 0.4 * Math.sin(a.frame / 2 + i)));
                }
            glowArc(ctx, bc.x, bc.y + 4, 40 * (1 - tight * 0.3), 16, a.frame / 10, a.frame / 10 + TAU * 0.8, 1.6, cols[0], tight * out);
        }
        stakeLayer(a, w, false);
        if (p > T.strain && p < T.hit && a.frame % 8 < 4)
            text(ctx, tl('封…！'), bc.x + 56, bc.y - 46, 10, '#ffffff', 1, '#0a1a2a');
        driveFx(a, w, cols, { x: bc.x, y: bc.y });
        // 封じ砕く: 楔が光って弾け、ひし形の光が地面に焼きつく
        const hk = win(p, T.hit, T.hit + 0.16);
        if (hk > 0 && hk < 1) {
            for (let i = 0; i < 4; i++) {
                const q = stakeAt(a, i, 1);
                glowLine(ctx, q.x, -200, q.x, q.y, 10 * (1 - hk) + 1, cols[0], 1 - hk);
                sparkBurst(ctx, q.x, q.y - 18, hk, `${a.seed}:stkb${i}`, [cols[0], '#ffffff'], 10, 40, 30);
            }
            glowLine(ctx, bc.x, -200, bc.x, a.foot.y + 10, 24 * (1 - hk) + 2, cols[0], 1 - hk);
        }
        impactBurst(a, bc.x, bc.y, hk, cols[0], cols[1], 1.1);
        flash(a, bump(p, T.hit - 0.003, T.hit + 0.035), '#ffffff', 0.85);
    },
};
export const SEAL_MOVES = { box, talisman, pillar, freeze, stakes };
void dim;
void petals;
void glowDisc;
void rocks;
//# sourceMappingURL=ult-seal.js.map