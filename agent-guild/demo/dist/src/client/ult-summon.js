import { Rng } from '../shared/rng.js';
import { drawHero } from './hero.js';
import { ULT_T, R, TAU, bump, clamp01, crater, dim, dustCloud, ease, flash, glowArc, glowDisc, glowLine, groundRings, heroSilhouette, lerp, petals, rocks, skyDisc, slashArc, sparkBurst, speedLines, starSpark, summonCircle, text, win, } from './ultkit.js';
import { blit, crescentSprite, drawBird as drawFireBird, drawHole, drawRockFist, firePal, pixelSlash, ramp } from './pixart.js';
const T = ULT_T.summon;
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const NO_GEAR = { back: [], fams: [], charms: [] };
// 主役: 魔法陣の上で、宙に浮いて詠唱（以前と同じ）
function floatPose(p, frame) {
    if (p < T.circle || p >= T.home)
        return null;
    const lift = win(p, T.circle, T.circle + 0.04) * (1 - win(p, T.impact + 0.06, T.home));
    return { ...base, oy: -5 * ease(lift) + Math.sin(frame / 6) * lift, action: p < T.impact + 0.06 ? 'cast' : 'idle', t: 0.5 };
}
function wideCam(p, home, body, W, H, mid = [1.0, W / 2, H / 2]) {
    const g = win(p, T.circle - 0.04, T.circle) * (1 - win(p, T.impact + 0.08, T.home));
    if (g <= 0)
        return null;
    if (p < T.split)
        return [g, 1.5, home.x - 4, home.y - 22];
    if (p < T.plunge)
        return [g, mid[0], mid[1], mid[2]];
    return [g, 1.25, body.x + 20, body.y - 10];
}
// 魔法陣から立ちのぼる光の粒（共通）
function riseFx(a, hero, col) {
    const { ctx, phase: p } = a;
    const ck = bump(p, T.circle, T.impact + 0.06);
    if (ck <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rng = new Rng(`${a.seed}:summonrise`);
    for (let i = 0; i < 22; i++) {
        const dx = rng.range(-44, 44), t = (p * 6 + rng.next()) % 1;
        ctx.globalAlpha = ck * (1 - t);
        ctx.fillStyle = i % 3 ? col : '#ffffff';
        ctx.fillRect(R(hero.x + dx), R(hero.y - t * 60), 1, 4);
    }
    ctx.restore();
}
// =====================================================================
// 岩の拳（fist）
// =====================================================================
const FIST_VEIN = { scythe: '#c77dff', shield: '#7fe0ff', wand: '#c77dff' };
const veinOf = (w) => FIST_VEIN[w] ?? '#ffb04a';
const RISE0 = T.plunge - 0.006; // 拳が地面を割って出はじめる
const fist = {
    pose: (p, _h, _f, _b, frame) => floatPose(p, frame),
    cam: (p, home, _f, body, W, H) => wideCam(p, home, body, W, H, [1.2, body.x + 30, body.y - 10]),
    beats: (w) => [{ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.split, stop: 0, shake: 1, sfx: 'summonHorn' }, { t: T.descend, stop: 0, shake: 3, sfx: 'rumble' }, { t: RISE0, stop: 0, shake: 4, sfx: 'boom' },
        { t: T.impact, stop: 0.008, shake: w === 'shield' ? 9 : 10, sfx: 'impactHeavy' }, { t: T.impact + 0.06, stop: 0, shake: 3, sfx: 'rumble' }],
    back(a, hero, w) {
        summonCircle(a, hero);
        const p = a.phase;
        drawHole(a.ctx, a.body.x + 4, a.foot.y + 5, 36 * ease(win(p, RISE0, RISE0 + 0.02)), veinOf(w), 1 - win(p, T.impact + 0.1, T.home), a.frame, 2);
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const vein = veinOf(w), x = a.body.x + 4, ground = a.foot.y + 4;
        riseFx(a, hero, vein);
        // 地鳴り: 足元に光る亀裂が走り、砂ぼこりが跳ねる
        const ck = win(p, T.descend, RISE0) * (1 - win(p, T.impact + 0.08, T.home));
        if (ck > 0) {
            const rng = new Rng(`${a.seed}:fistcrack`);
            for (let i = 0; i < 9; i++) {
                const an = (i / 9) * TAU + rng.range(-0.2, 0.2), len = rng.range(30, 70) * ease(ck);
                glowLine(ctx, x, ground, x + Math.cos(an) * len, ground + Math.sin(an) * len * 0.25, 1.6, vein, ck * (0.6 + 0.4 * Math.sin(a.frame / 2 + i)));
            }
            if (p < RISE0)
                for (let i = 0; i < 6; i++) {
                    const t = (p * 20 + i / 6) % 1;
                    ctx.save();
                    ctx.globalAlpha = (1 - t) * ck;
                    ctx.fillStyle = '#a8987a';
                    ctx.fillRect(R(x - 40 + i * 14), R(ground - t * 10 - Math.abs(Math.sin(a.frame + i)) * 3), 2, 2);
                    ctx.restore();
                }
        }
        // 拳が突き上がる → 止まって、崩れる
        const rk = win(p, RISE0, T.impact), hold = win(p, T.impact, T.impact + 0.08), crumble = win(p, T.impact + 0.08, T.impact + 0.16);
        if (rk > 0 && crumble < 1) {
            // 岩の拳（pixart.ts の共通の部品。ボスの「石の巨人」の拳も同じ部品）。突き上げて、当たった瞬間に少し押しこむ
            const s = 2.5, h = 112, topY = ground - h * ease(rk) - 6 * Math.sin(Math.PI * hold) + 40 * crumble * crumble;
            const shake = hold > 0 && hold < 1 ? Math.round(Math.sin(a.frame * 2.1) * 2 * (1 - hold)) : 0;
            drawRockFist(ctx, x + shake, topY, { s, arm: 0.9, vein, glow: 0.5 + 0.5 * rk, alpha: 1 - crumble, ground: ground + 2 });
            if (rk < 1)
                speedLines(ctx, x, 60, topY - 40, ground, a.frame, 0.7, '#ffffff', 10, Math.PI);
            if (crumble > 0)
                rocks(a, x, topY + 30, crumble, 'fistcrumble', 30, 70);
        }
        // 殴り上げた瞬間: 拳の上で衝撃の輪と星
        const ik = win(p, T.impact, T.impact + 0.14);
        if (ik > 0 && ik < 1) {
            const y = a.body.y - 30;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const kk = clamp01(ik * 1.3 - i * 0.15);
                if (kk <= 0 || kk >= 1)
                    continue;
                ctx.globalAlpha = 1 - kk;
                ctx.strokeStyle = i === 1 ? '#ffffff' : vein;
                ctx.lineWidth = 4 * (1 - kk) + 1;
                ctx.beginPath();
                ctx.ellipse(x, y, 10 + kk * 90, 4 + kk * 26, 0, 0, TAU);
                ctx.stroke();
            }
            ctx.restore();
            starSpark(ctx, x, y, 26 * (1 - ik), 1 - ik, '#ffffff');
            sparkBurst(ctx, x, y, ik, `${a.seed}:fistspark`, [vein, '#ffffff', '#ffe27a'], 30, 90, 60);
        }
        rocks(a, x, ground, win(p, RISE0, RISE0 + 0.16), 'fistrock', 40, 140);
        dustCloud(a, x, ground, win(p, RISE0, RISE0 + 0.16), 'fistdust', 2.2);
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 流星群（meteor）
// =====================================================================
const METEOR_COL = { blaster: ['#63d471', '#c8ffc8', '#2a8a5a'], book: ['#c77dff', '#f0e0ff', '#5a2a8a'] };
const mCol = (w) => METEOR_COL[w] ?? ['#ff7a3a', '#ffd166', '#8a2a10'];
// 降る岩（時刻・着弾点・大きさ）。最後が特大
const METEORS = (body, foot) => {
    const xs = [-60, 34, -20, 58, -44, 12, 0], ts = [0, 0.018, 0.034, 0.05, 0.068, 0.086, 0.14], ss = [0.9, 1.1, 1, 1.2, 1, 1.3, 2.6];
    return xs.map((dx, i) => ({ t: T.descend + ts[i], x: body.x + 4 + dx, y: i === 6 ? body.y : foot.y + 2, s: ss[i] }));
};
const FALL = 0.03; // 1つの岩が空から落ちるまで
const meteor = {
    pose: (p, _h, _f, _b, frame) => floatPose(p, frame),
    cam: (p, home, _f, body, W, H) => wideCam(p, home, body, W, H, [1.05, body.x + 50, body.y - 30]),
    beats: () => [{ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.split, stop: 0, shake: 1, sfx: 'summonHorn' },
        ...METEORS({ x: 0, y: 0 }, { x: 0, y: 0 }).slice(0, 6).map((m) => ({ t: m.t + FALL, stop: 0, shake: 3, sfx: 'boom' })),
        { t: T.impact, stop: 0.008, shake: 11, sfx: 'impactHeavy' }, { t: T.impact + 0.05, stop: 0, shake: 4, sfx: 'rumble' }],
    back(a, hero, w) {
        summonCircle(a, hero);
        const p = a.phase, cols = mCol(w);
        // 空が染まる（奥だけ）
        dim(a, 0.55 * win(p, T.split, T.split + 0.04) * (1 - win(p, T.impact + 0.06, T.home)), w === 'blaster' ? '#04140a' : w === 'book' ? '#10061e' : '#1a0606');
        const dk = win(p, T.split, T.descend) * (1 - win(p, T.impact + 0.04, T.impact + 0.12));
        if (dk > 0)
            skyDisc(a, a.body.x + 30, 20, 70 * ease(dk), dk, w === 'blaster' ? 130 : w === 'book' ? 280 : 20);
        void cols;
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = mCol(w);
        riseFx(a, hero, cols[1]);
        for (const [i, m] of METEORS(a.body, a.foot).entries()) {
            const t1 = (i === 6 ? T.impact : m.t + FALL), t0 = t1 - (i === 6 ? 0.05 : FALL), k = win(p, t0, t1);
            const from = { x: m.x + 130 * m.s + 40, y: -40 - 30 * m.s };
            if (k > 0 && k < 1) { // 燃えながら落ちる岩
                const u = k * k, h = { x: lerp(from.x, m.x, u), y: lerp(from.y, m.y, u) }, r = 6 * m.s;
                for (let j = 12; j >= 1; j--) {
                    const uu = Math.max(0, k - j * 0.03) ** 2;
                    glowDisc(ctx, lerp(from.x, m.x, uu), lerp(from.y, m.y, uu), r * (1.8 - j * 0.1), j < 4 ? cols[1] : cols[0], 0.8 - j * 0.06, 0.3);
                }
                ctx.save();
                ctx.fillStyle = cols[2];
                ctx.beginPath();
                ctx.arc(h.x, h.y, r, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#4a3a2a';
                ctx.beginPath();
                ctx.arc(h.x - r * 0.2, h.y + r * 0.2, r * 0.75, 0, TAU);
                ctx.fill();
                ctx.fillStyle = cols[0];
                ctx.fillRect(R(h.x - r * 0.3), R(h.y - r * 0.5), R(r * 0.5), 2);
                ctx.restore();
                glowDisc(ctx, h.x + r * 0.4, h.y - r * 0.4, r * 2.2, cols[0], 0.7, 0.5);
            }
            const ek = win(p, t1, t1 + (i === 6 ? 0.14 : 0.06)); // 爆ぜる
            if (ek > 0 && ek < 1) {
                glowDisc(ctx, m.x, m.y - 6, 30 * m.s * (0.6 + ek), cols[0], (1 - ek) * (1 - ek), 1);
                sparkBurst(ctx, m.x, m.y - 4, ek, `${a.seed}:mspark${i}`, [cols[0], cols[1], '#ffffff'], 16 + 10 * m.s, 50 * m.s, 70);
                groundRings(ctx, m.x, a.foot.y + 4, ek, cols[0], 50 * m.s, 2);
            }
            crater(ctx, m.x, a.foot.y + 4, 10 * m.s * ease(win(p, t1, t1 + 0.01)), 1 - win(p, T.impact + 0.1, T.home), cols[0]);
            if (i === 6) {
                rocks(a, m.x, a.foot.y, ek, 'meteorrock', 40, 150);
                dustCloud(a, m.x, a.foot.y + 4, ek, 'meteordust', 2.4);
            }
        }
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.7);
    },
};
// =====================================================================
// 炎の鳥（bird）
// =====================================================================
const BIRD_COL = { umbrella: ['#5fcde4', '#e8fbff', '#2a5a9a'] };
const bCol = (w) => BIRD_COL[w] ?? ['#ff7a3a', '#ffe27a', '#c8301a'];
// 鳥の位置（u: 0→1）。主役の頭上から舞い上がり、空を右から大きく回って、ボスへ急降下
function birdAt(hero, body, u) {
    const P0 = { x: hero.x, y: hero.y - 40 }, P1 = { x: hero.x + 40, y: 0 }, P2_ = { x: body.x - 30, y: 16 }, P3 = { x: body.x + 6, y: body.y - 6 };
    const q = 1 - u;
    return { x: q * q * q * P0.x + 3 * q * q * u * P1.x + 3 * q * u * u * P2_.x + u * u * u * P3.x, y: q * q * q * P0.y + 3 * q * q * u * P1.y + 3 * q * u * u * P2_.y + u * u * u * P3.y };
}
const birdU = (p) => clamp01((p - T.split) / (T.impact - T.split)) ** 1.6;
const bird = {
    pose: (p, _h, _f, _b, frame) => floatPose(p, frame),
    cam: (p, home, _f, body, W, H) => wideCam(p, home, body, W, H, [1.0, (home.x + body.x) / 2 + 10, H / 2 - 20]),
    beats: () => [{ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.split, stop: 0, shake: 1, sfx: 'summonHorn' }, { t: T.descend, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.plunge, stop: 0, shake: 1, sfx: 'dive' },
        { t: T.impact, stop: 0.008, shake: 9, sfx: 'impactMagic' }, { t: T.impact + 0.04, stop: 0, shake: 3, sfx: 'boom' }],
    back(a, hero) { summonCircle(a, hero); },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = bCol(w);
        riseFx(a, hero, cols[1]);
        // 魔法陣から炎が噴き上がって、鳥が生まれる
        const bk = bump(p, T.split - 0.02, T.split + 0.04);
        if (bk > 0) {
            glowLine(ctx, hero.x, hero.y, hero.x, hero.y - 70, 14 * bk, cols[0], bk);
            glowDisc(ctx, hero.x, hero.y - 40, 30 * bk, cols[0], bk, 1);
        }
        const u = birdU(p);
        if (p >= T.split && p < T.impact) {
            const h = birdAt(hero, a.body, u), h2 = birdAt(hero, a.body, Math.min(1, u + 0.01)), ang = Math.atan2(h2.y - h.y, h2.x - h.x);
            // 火の粉の尾（通った道）
            const rng = new Rng(`${a.seed}:birdtrail`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 40; i++) {
                const back = rng.range(0, 0.25), q = birdAt(hero, a.body, Math.max(0, u - back));
                ctx.globalAlpha = 1 - back / 0.25;
                ctx.fillStyle = [cols[0], cols[1], '#ffffff'][i % 3];
                ctx.fillRect(R(q.x + rng.range(-6, 6)), R(q.y + rng.range(-6, 6) + back * 30), 2, 2);
            }
            ctx.restore();
            const dive = p > T.plunge;
            // 炎の鳥（ドット絵。翼を3コマで羽ばたき、突っこむときは翼をたたむ）
            drawFireBird(ctx, h.x, h.y, ang, dive ? 0 : Math.floor(a.frame / 4), firePal(cols[0], cols[1]), { glow: cols[0] });
            if (dive)
                speedLines(ctx, h.x + 20, 80, h.y - 60, h.y + 10, a.frame, 0.5, cols[1], 10, ang - Math.PI / 2);
        }
        // 突っこんで、火の羽根が散る
        const ik = win(p, T.impact, T.impact + 0.16);
        if (ik > 0 && ik < 1) {
            const c = { x: a.body.x + 6, y: a.body.y - 6 };
            glowDisc(ctx, c.x, c.y, 70 * (0.5 + ik), cols[0], (1 - ik) * (1 - ik), 1);
            petals(ctx, c.x, c.y + 10, 220 * ik + 40, 120, ik * 1.5, `${a.seed}:feather`, [cols[0], cols[1], cols[2]], 1 - ik, 34, 0.6);
            sparkBurst(ctx, c.x, c.y, ik, `${a.seed}:birdburst`, [cols[0], cols[1], '#ffffff'], 40, 110, 50);
            groundRings(ctx, c.x, a.foot.y + 4, ik, cols[0], 160);
            // 翼の形の残光
            for (const side of [-1, 1])
                glowArc(ctx, c.x + side * 20, c.y - 4, 50 * (0.6 + ik * 0.6), 22, side > 0 ? -2.6 : -0.5, side > 0 ? -1.2 : 0.9, 6 * (1 - ik) + 1, cols[0], 1 - ik);
        }
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.7);
    },
};
// =====================================================================
// 竜巻（tornado）
// =====================================================================
const TOR_COL = { guitar: ['#ff6bd6', '#7fe0ff'], spear: ['#7fe0ff', '#e8fff0'] };
const tCol = (w) => TOR_COL[w] ?? ['#9be7b0', '#e3ffc8'];
const TOR_N = 20;
// 竜巻の輪 i（0=足元）。高さ・半径・揺れ
function torRing(a, i, grow) {
    const f = i / (TOR_N - 1), h = 150 * grow, y = a.foot.y + 2 - f * h, rx = (6 + f * f * 60) * (0.4 + 0.6 * grow), sway = Math.sin(a.frame / 9 + f * 3) * 10 * f;
    return { x: a.body.x + 4 + sway, y, rx, ry: rx * 0.22 };
}
const torGrow = (p) => ease(win(p, T.split, T.plunge)) * (1 + 0.2 * win(p, T.plunge, T.impact));
// 竜巻の本体（ドット絵）: 行ごとに、らせんの帯を塗る。手前の帯は top、奥の内壁は back。
// 帯は左の縁が明るく、右の縁が暗く、帯の先頭に白いふち（グラデーションは使わない）
function torBands(a, w, back) {
    const p = a.phase, g = torGrow(p), out = 1 - win(p, T.impact, T.impact + 0.06);
    if (g <= 0 || out <= 0)
        return;
    const pal = ramp(tCol(w)[0], 0.6), ctx = a.ctx, top = torRing(a, TOR_N - 1, g).y, bottom = a.foot.y + 2, rot = a.frame / 4;
    const seg = Math.PI / 3; // 帯の間隔
    ctx.save();
    ctx.globalAlpha *= out * (back ? 0.55 : 0.92);
    for (let y = Math.floor(top); y <= bottom; y++) {
        const f = clamp01((bottom - y) / Math.max(1, bottom - top)), hw = Math.round((6 + f * f * 60) * (0.4 + 0.6 * g)), cx = Math.round(a.body.x + 4 + Math.sin(a.frame / 9 + f * 3) * 10 * f);
        let run = -1, runCol = '';
        const flush = (x) => { if (run >= 0) {
            ctx.fillStyle = runCol;
            ctx.fillRect(run, y, x - run, 1);
        } run = -1; };
        for (let x = cx - hw; x <= cx + hw; x++) {
            const u = (x + 0.5 - cx) / hw, th = Math.asin(Math.max(-1, Math.min(1, u))), ph = back ? Math.PI - th : th;
            const sp = (((ph + rot - y * 0.09) % seg) + seg) % seg, on = sp < seg * 0.55;
            let col = '';
            if (on)
                col = sp < seg * 0.08 ? pal.h : back ? pal.d : u < -0.6 ? pal.l : u > 0.6 ? pal.d : pal.m;
            else if (!back && Math.abs(u) > 0.93)
                col = pal.o; // 外側の輪郭
            if (col !== runCol || !col) {
                flush(x);
                if (col) {
                    run = x;
                    runCol = col;
                }
            }
        }
        flush(cx + hw + 1);
    }
    ctx.restore();
}
// 竜巻の中でボスに入る連打（巻きこまれて、何度も打たれる）
const TOR_HITS = [0, 1, 2, 3, 4, 5].map((i) => T.descend + 0.02 + i * 0.019);
const tornado = {
    pose: (p, _h, _f, _b, frame) => floatPose(p, frame),
    cam: (p, home, _f, body, W, H) => wideCam(p, home, body, W, H, [1.1, body.x + 50, body.y - 30]),
    beats: () => [{ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.split, stop: 0, shake: 1, sfx: 'summonHorn' }, { t: T.descend, stop: 0, shake: 1, sfx: 'whoosh' }, { t: T.plunge, stop: 0, shake: 2, sfx: 'rumble' },
        ...TOR_HITS.map((t, i) => ({ t, stop: 0.002, shake: 2 + (i % 2), sfx: 'hit' })),
        { t: T.impact, stop: 0.008, shake: 8, sfx: 'impactMagic' }, { t: T.impact + 0.03, stop: 0, shake: 2, sfx: 'whoosh' }],
    back(a, hero, w) { summonCircle(a, hero); torBands(a, w, true); },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = tCol(w), g = torGrow(p), out = 1 - win(p, T.impact, T.impact + 0.06);
        riseFx(a, hero, cols[1]);
        torBands(a, w, false);
        // 巻き上がる木の葉・砂・小石（らせんに昇る）
        if (g > 0 && out > 0) {
            const rng = new Rng(`${a.seed}:tordebris`);
            ctx.save();
            for (let i = 0; i < 46; i++) {
                const ph = rng.next(), f = (ph + p * 3 * rng.range(0.7, 1.3)) % 1, r = torRing(a, Math.floor(f * (TOR_N - 1)), g), an = a.frame / 4 + i * 2.3;
                ctx.globalAlpha = out * Math.sin(f * Math.PI);
                ctx.fillStyle = w === 'guitar' ? (i % 2 ? cols[0] : cols[1]) : i % 4 ? (i % 2 ? '#3aa860' : '#9be7b0') : '#a8987a';
                const dx = R(r.x + Math.cos(an) * r.rx), dy = R(r.y + Math.sin(an) * r.ry);
                if (i % 4 === 0 && w !== 'guitar') {
                    ctx.fillStyle = '#3a2e22';
                    ctx.fillRect(dx - 1, dy - 1, 4, 4);
                    ctx.fillStyle = '#a8987a';
                    ctx.fillRect(dx, dy, 2, 2);
                    ctx.fillStyle = '#d8ccb0';
                    ctx.fillRect(dx, dy, 1, 1);
                } // 小石（輪郭・中・ハイライト）
                else
                    ctx.fillRect(dx, dy, 2, i % 3 ? 2 : 3);
            }
            ctx.restore();
            if (w === 'guitar') {
                const rng2 = new Rng(`${a.seed}:tornote`);
                for (let i = 0; i < 8; i++) {
                    const f = (rng2.next() + p * 2) % 1, r = torRing(a, Math.floor(f * (TOR_N - 1)), g), an = a.frame / 5 + i;
                    text(ctx, i % 2 ? '♪' : '♫', r.x + Math.cos(an) * r.rx, r.y, 9, i % 2 ? cols[0] : cols[1], out * Math.sin(f * Math.PI), '#2a0a3a');
                }
            }
            if (w === 'spear')
                for (let i = 0; i < 2; i++) {
                    const r0 = torRing(a, 4 + i * 6, g), r1 = torRing(a, 10 + i * 6, g);
                    glowLine(ctx, r0.x - 8, r0.y, r1.x + 6, r1.y, 1.4, cols[1], out * (a.frame % 6 < 3 ? 1 : 0.3));
                }
            // 足元の砂煙
            dustCloud(a, a.body.x + 4, a.foot.y + 4, (p * 8) % 1, `tordust${Math.floor(p * 8)}`, 1.2 * g);
        }
        // 連打: 巻きこまれたボスに、風の刃が当たるたびに白い火花と岩のかけら
        TOR_HITS.forEach((t0, i) => {
            const k = win(p, t0, t0 + 0.02);
            if (k <= 0 || k >= 1)
                return;
            const hx = a.body.x + 4 + [-14, 12, -6, 16, -16, 6][i], hy = a.body.y - 10 + [-12, 6, -24, -4, 10, -16][i];
            starSpark(ctx, hx, hy, 12 * (1 - k) + 2, 1 - k, '#ffffff');
            ctx.save();
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = cols[1];
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(R(hx) + 0.5, R(hy) + 0.5, 3 + k * 10, 2 + k * 6, 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
            sparkBurst(ctx, hx, hy, k, `${a.seed}:torhit${i}`, ['#ffffff', cols[0], '#a8987a'], 8, 22, 20);
        });
        // 弾ける: 輪が外へ吹き飛び、木の葉が四方へ
        const ik = win(p, T.impact, T.impact + 0.16);
        if (ik > 0 && ik < 1) {
            for (let i = 0; i < TOR_N; i += 2) {
                const r = torRing(a, i, 1.2);
                glowArc(ctx, r.x, r.y, r.rx * (1 + ik * 1.4), r.ry * (1 + ik * 1.4), i, i + 2.4, 2.5 * (1 - ik) + 0.5, i % 4 ? cols[0] : cols[1], 1 - ik);
            }
            petals(ctx, a.body.x, a.body.y - 30, 260 * ik + 40, 200, ik * 2, `${a.seed}:torleaf`, w === 'guitar' ? [cols[0], cols[1], '#ffffff'] : ['#3aa860', '#9be7b0', '#e3ffc8'], 1 - ik, 40, 0.5);
            groundRings(ctx, a.body.x + 4, a.foot.y + 4, ik, cols[0], 170);
        }
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.7);
    },
};
// =====================================================================
// 光の騎士（knight）
// =====================================================================
const KN_COL = { fan: ['#9be7b0', '#e3ffc8'] };
const kCol = (w) => KN_COL[w] ?? ['#9fe8ff', '#ffffff'];
const KS = 3; // 光の騎士の大きさ（主役の何倍）
const knPos = (hero) => ({ x: Math.min(hero.x + 6, 300), y: hero.y + 4 }); // 主役の背後（画面に収まるように）
const knight = {
    pose: (p, _h, _f, _b, frame) => floatPose(p, frame),
    cam: (p, home, _f, body, W, H) => wideCam(p, home, body, W, H, [1.0, (home.x + body.x) / 2 + 10, H / 2 - 30]),
    beats: () => [{ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.split, stop: 0, shake: 2, sfx: 'awakenFlare' }, { t: T.plunge, stop: 0, shake: 1, sfx: 'slash' },
        { t: T.impact, stop: 0.009, shake: 10, sfx: 'impactBlade' }, { t: T.impact + 0.03, stop: 0, shake: 3, sfx: 'shatter' }],
    back(a, hero, w, look) {
        summonCircle(a, hero);
        const p = a.phase, cols = kCol(w), kp = knPos(hero);
        const rise = ease(win(p, T.split, T.descend + 0.02)), out = 1 - win(p, T.impact + 0.06, T.impact + 0.14);
        if (rise <= 0 || out <= 0 || !look)
            return;
        const swing = win(p, T.plunge - 0.02, T.impact);
        const act = p < T.plunge - 0.02 ? 'cast' : 'attack', t = p < T.plunge - 0.02 ? 0.5 : swing;
        heroSilhouette(a.ctx, (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame, flip: true, action: act, t, ring: false }), kp.x, kp.y + (1 - rise) * 30, KS, cols[0], 0.62 * rise * out, 0.35);
        heroSilhouette(a.ctx, (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame, flip: true, action: act, t, ring: false }), kp.x, kp.y + (1 - rise) * 30 - 3, KS * 0.86, '#ffffff', 0.3 * rise * out, 0);
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = kCol(w), kp = knPos(hero);
        riseFx(a, hero, cols[1]);
        // 立ち上がるときの光の柱
        const rk = bump(p, T.split - 0.01, T.descend + 0.03);
        if (rk > 0) {
            glowLine(ctx, kp.x, kp.y, kp.x, kp.y - 110, 20 * rk, cols[0], rk * 0.8);
            sparkBurst(ctx, kp.x, kp.y - 30, win(p, T.split, T.descend + 0.03), `${a.seed}:knrise`, [cols[0], '#ffffff'], 30, 70, -40);
        }
        // 振り下ろし: 騎士の剣筋（巨大な弧）
        const sk = win(p, T.plunge - 0.01, T.impact - 0.01), sf = 1 - win(p, T.impact + 0.02, T.impact + 0.1);
        // ボスは左にいるので、右上 → 頭上 → 左下へ振り下ろす（反時計まわり）
        const A0 = -(Math.PI - 1.9), A1 = -(Math.PI + 1.2);
        if (sk > 0 && sf > 0)
            slashArc(ctx, kp.x - 10, kp.y - 70, 66, A0, lerp(A0, A1, ease(sk)), 26, cols, sf);
        // 光の斬撃（ドット絵の三日月の刃）が、残像を引いて飛び、ボスに食いこむ
        const fk = win(p, T.plunge + 0.005, T.impact), cr = crescentSprite(cols[0], 0.9);
        if (fk > 0 && fk < 1) {
            const xAt = (u) => lerp(kp.x - 40, a.body.x + 14, ease(u));
            for (let j = 3; j >= 1; j--)
                blit(ctx, cr.spr, xAt(Math.max(0, fk - j * 0.09)), a.body.y - 4, cr.ax, cr.ay, { alpha: 0.5 - j * 0.12, add: true });
            blit(ctx, cr.spr, xAt(fk), a.body.y - 4, cr.ax, cr.ay);
            speedLines(ctx, xAt(fk) + 40, 60, a.body.y - 70, a.body.y + 60, a.frame, 0.5, cols[1], 10, Math.PI / 2);
        }
        const ik = win(p, T.impact, T.impact + 0.14);
        if (ik > 0 && ik < 1) {
            const c = { x: a.body.x + 4, y: a.body.y - 4 };
            // 食いこんだ刃が、ボスを通り抜けて二つに割れて飛ぶ。縦の切り口が白く残る
            blit(ctx, cr.spr, c.x - 10 - ik * 40, c.y - ik * 18, cr.ax, cr.ay, { alpha: 1 - ik, sy: 0.6 });
            blit(ctx, cr.spr, c.x - 10 - ik * 40, c.y + ik * 18, cr.ax, cr.ay, { alpha: 1 - ik, sy: -0.6 });
            pixelSlash(ctx, c.x + 2, c.y - 70, c.x - 2, c.y + 64, 14 * (1 - ik) + 2, ramp(cols[0]), 1 - ik * ik);
            sparkBurst(ctx, c.x, c.y, ik, `${a.seed}:knburst`, [cols[0], cols[1], '#ffffff'], 40, 110, 20);
            groundRings(ctx, c.x, a.foot.y + 4, ik, cols[0], 150);
            if (w === 'fan')
                petals(ctx, c.x, c.y, 220, 140, ik * 2, `${a.seed}:knleaf`, ['#3aa860', '#9be7b0', '#e3ffc8'], 1 - ik, 30, 0.6);
        }
        rocks(a, a.body.x + 4, a.foot.y, win(p, T.impact, T.impact + 0.16), 'knrock', w === 'hammer' ? 36 : 14, 130);
        flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', 0.7);
    },
};
export const SUMMON_MOVES = { fist, meteor, bird, tornado, knight };
void TAU;
void dustCloud;
//# sourceMappingURL=ult-summon.js.map