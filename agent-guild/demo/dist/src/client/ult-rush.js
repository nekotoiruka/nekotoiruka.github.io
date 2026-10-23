import { Rng } from '../shared/rng.js';
import { drawHero } from './hero.js';
import { ULT_T, R, TAU, bandArc, heroSilhouette, bump, clamp01, dim, dustCloud, ease, flash, glowArc, glowDisc, glowLine, groundRings, lerp, petals, rocks, skyDisc, slashLine, sparkBurst, speedLines, starSpark, text, win, } from './ultkit.js';
const T = ULT_T.rush;
const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
const MAGIC = new Set(['wand', 'book', 'fan', 'guitar']);
const SHOT = new Set(['bow', 'blaster']);
const at = (home, q, extra = {}) => ({ ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra });
function trail(home, q, k, n, step, a0, act) {
    return Array.from({ length: n }, (_, j) => { const g = q(Math.max(0, k - (j + 1) * step)); return { x: g.x - home.x, y: g.y - home.y, a: a0 / (j + 1), ...(act ? { act } : {}) }; });
}
const NO_GEAR = { back: [], fams: [], charms: [] };
const passAt = (i) => T.first + i * T.pass;
const passOf = (p) => Math.floor((p - T.first) / T.pass);
// 構え → 最初の位置へ
function ready(p, home, start, w) {
    if (p < T.ready - 0.02 || p >= T.home)
        return null;
    if (p < T.go) {
        const k = win(p, T.ready - 0.02, T.go);
        return { ...base, oy: 2.5 * ease(k), ox: 3 * ease(k), action: MAGIC.has(w) ? 'cast' : 'guard', t: k };
    }
    const k = win(p, T.go, T.first), q = (u) => ({ x: lerp(home.x, start.x, u * u), y: lerp(home.y, start.y, u * u) });
    return at(home, q(k), { action: 'dash', ghosts: trail(home, q, k, 3, 0.15, 0.35) });
}
function goHome(p, home, from) {
    const k = win(p, T.burst + 0.03, T.home);
    return at(home, { x: lerp(from.x, home.x, ease(k)), y: lerp(from.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 16 }, { action: 'dash', flip: false });
}
// 構えのときに集まる風（共通）
function readyFx(a, hero, col) {
    const { ctx, phase: p } = a;
    const rk = win(p, T.ready - 0.02, T.go);
    if (rk <= 0 || p >= T.first)
        return;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const t = (rk * 3 + i / 6) % 1;
        ctx.globalAlpha = (1 - t) * rk * 0.8;
        ctx.beginPath();
        ctx.arc(hero.x, hero.y - 12, 26 * (1 - t) + 4, i, i + 1.2);
        ctx.stroke();
    }
    ctx.restore();
}
// ヒット数（右上）。n は今までの数、max で FINISH
function hitCounter(a, n, last, max, col) {
    const p = a.phase;
    const showK = win(p, T.first, T.first + 0.01) * (1 - win(p, T.burst + 0.12, T.burst + 0.16));
    if (showK <= 0 || n <= 0)
        return;
    const pop = 1 + 0.5 * (1 - clamp01((p - last) / 0.02));
    const x = a.body.x + 100, y = a.body.y - 26;
    text(a.ctx, 'HIT', x - 22, y + 2, 9, '#ffe9a0', showK, '#3a1a00');
    text(a.ctx, `×${n}`, x + 8, y, R(16 * pop), n >= max ? (a.frame % 6 < 3 ? '#ffffff' : col) : '#ffffff', showK, '#3a1a00');
    if (p > T.burst)
        text(a.ctx, 'FINISH!', x, y + 18, 11, col, showK, '#3a0a3a');
}
// 締めの爆発（共通の土台: 白い玉と輪）
function burstCore(a, x, y, k, cols, big = 1) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    glowDisc(ctx, x, y, 60 * big * (0.6 + k), cols[0], (1 - k) * (1 - k), 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 1.3 - i * 0.15);
        if (kk <= 0 || kk >= 1)
            continue;
        ctx.globalAlpha = 1 - kk;
        ctx.strokeStyle = i === 1 ? '#ffffff' : i ? cols[1] : cols[0];
        ctx.lineWidth = 5 * (1 - kk) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, (10 + kk * (120 + i * 30)) * big, (8 + kk * (70 + i * 16)) * big, 0, 0, TAU);
        ctx.stroke();
    }
    ctx.restore();
}
// =====================================================================
// 旋風（cyclone）
// =====================================================================
const CYC_COL = { scythe: ['#c77dff', '#f0e0ff'], shield: ['#9fe8ff', '#ffffff'], umbrella: ['#7bed9f', '#e3ffc8'] };
const cycCol = (w) => CYC_COL[w] ?? ['#ffb04a', '#ffe27a'];
const orbitC = (foot, body) => ({ x: body.x + 2, y: foot.y + 4 });
const RX = 60, RY = 18;
// 回る角度（だんだん速くなる。八手で3周半）
const orbitAng = (p) => { const u = clamp01((p - T.first) / (T.finish - T.first)); return Math.PI * 0.15 + (u * u * 0.6 + u * 0.4) * TAU * 3.5; };
const orbitPos = (foot, body, p) => { const c = orbitC(foot, body), an = orbitAng(p); return { x: c.x + Math.cos(an) * RX, y: c.y + Math.sin(an) * RY }; };
const cyclone = {
    pose(p, home, foot, body, frame, w) {
        const start = orbitPos(foot, body, T.first), c = orbitC(foot, body);
        if (p < T.first)
            return ready(p, home, start, w);
        if (p >= T.home)
            return null;
        if (p < T.finish) { // ボスのまわりを回る（体も回る）
            const q = orbitPos(foot, body, p), an = orbitAng(p);
            const gh = Array.from({ length: 5 }, (_, j) => { const g = orbitPos(foot, body, p - (j + 1) * 0.006); return { x: g.x - home.x, y: g.y - home.y, a: 0.4 / (j + 1), act: 'attack' }; });
            return at(home, q, { action: 'attack', t: (frame % 6) / 6, rot: an * 0.6, flip: Math.sin(an) < 0 ? false : true, ghosts: gh });
        }
        if (p < T.burst) { // 跳んで、中心へ叩きつける
            const k = win(p, T.finish, T.burst), from = orbitPos(foot, body, T.finish), top = { x: c.x + 10, y: c.y - 90 };
            const q = (u) => (u < 0.55 ? { x: lerp(from.x, top.x, ease(u / 0.55)), y: lerp(from.y, top.y, ease(u / 0.55)) } : { x: lerp(top.x, c.x + 10, ((u - 0.55) / 0.45) ** 2), y: lerp(top.y, c.y, ((u - 0.55) / 0.45) ** 2) });
            return at(home, q(k), { action: 'attack', t: k < 0.55 ? 0.1 : 0.4 + 0.5 * k, rot: k < 0.55 ? -TAU * k : 0, ghosts: trail(home, q, k, 4, 0.08, 0.45) });
        }
        if (p < T.burst + 0.03)
            return at(home, { x: c.x + 10, y: c.y }, { action: 'attack', t: 0.95 });
        return goHome(p, home, { x: c.x + 10, y: c.y });
    },
    cam(p, home, foot, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.burst + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.go)
            return [g, 1.6, home.x - 4, home.y - 22];
        const c = orbitC(foot, body);
        if (p < T.finish)
            return [g, 1.35 + 0.15 * win(p, T.first, T.finish), c.x + 14, c.y - 30];
        return [g, p < T.burst ? 1.15 : 1.4, c.x + 14, c.y - 40 + 14 * win(p, T.finish, T.burst)];
    },
    beats(w) {
        const out = Array.from({ length: T.n }, (_, i) => ({ t: passAt(i) + T.pass * 0.4, stop: i % 2 ? 0.0015 : 0, shake: 1 + (i >> 1), sfx: (i % 2 ? 'hit' : 'whoosh') }));
        return [...out, { t: T.finish, stop: 0, shake: 0, sfx: 'jump' }, { t: T.burst, stop: 0.007, shake: w === 'shield' ? 8 : 10, sfx: 'impactHeavy' }, { t: T.burst + 0.04, stop: 0, shake: 4, sfx: 'rumble' }];
    },
    back(a, _hero, w) {
        cycBands(a, w, true);
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = cycCol(w), c = orbitC(a.foot, a.body);
        readyFx(a, hero, cols[1]);
        cycBands(a, w, false);
        // 巻き上がる風と木の葉・砂
        const wk = win(p, T.first, T.first + 0.06) * (1 - win(p, T.burst, T.burst + 0.06));
        if (wk > 0) {
            const rng = new Rng(`${a.seed}:cycdust`);
            ctx.save();
            for (let i = 0; i < 40; i++) {
                const an = orbitAng(p) * (0.8 + rng.next() * 0.4) + rng.range(0, TAU), r = rng.range(0.6, 1.3), h = rng.range(0, 70) * win(p, T.first, T.finish);
                ctx.globalAlpha = wk * 0.9;
                ctx.fillStyle = i % 3 ? '#d8ccb0' : i % 2 ? cols[0] : '#8a7a5a';
                ctx.fillRect(R(c.x + Math.cos(an) * RX * r), R(c.y + Math.sin(an) * RY * r - h), 2, 2);
            }
            ctx.restore();
            if (w === 'umbrella')
                petals(ctx, c.x, c.y - 40, 140, 100, p * 4, `${a.seed}:cycleaf`, ['#7bed9f', '#3aa860', '#e3ffc8'], wk, 18, -1);
        }
        // 跳んで叩きつける: 上から速度線
        const fk = win(p, T.finish + (T.burst - T.finish) * 0.55, T.burst);
        if (fk > 0 && fk < 1)
            speedLines(ctx, c.x + 10, 70, c.y - 120, c.y, a.frame, 0.8, cols[1], 14);
        // 爆ぜる: 帯がちぎれて外へ吹き飛び、地面が割れる
        const bk = win(p, T.burst, T.burst + 0.14);
        if (bk > 0 && bk < 1) {
            for (let i = 0; i < 5; i++)
                glowArc(ctx, c.x, c.y - i * 10, (RX + 20) * (1 + bk * 1.6), (RY + 6) * (1 + bk * 1.6), i, i + 2.2, 4 * (1 - bk) + 1, i % 2 ? cols[1] : cols[0], 1 - bk);
            groundRings(ctx, c.x, c.y, bk, cols[0], 200);
            glowLine(ctx, c.x + 10, -200, c.x + 10, c.y + 6, 20 * (1 - bk) + 2, cols[0], 1 - bk);
        }
        burstCore(a, c.x + 6, a.body.y, bk, cols, 1.1);
        rocks(a, c.x + 10, a.foot.y, bk, 'cycrock', 40, 150);
        dustCloud(a, c.x + 10, a.foot.y + 4, bk, 'cycdust2', 2.2);
        const n = Math.max(0, Math.min(T.n, passOf(p) + 1)) * 3 + (p >= T.burst ? 1 : 0);
        hitCounter(a, p >= T.first ? n : 0, p >= T.burst ? T.burst : passAt(Math.max(0, passOf(p))), T.n * 3 + 1, cols[0]);
        flash(a, bump(p, T.burst - 0.003, T.burst + 0.04), '#ffffff', 0.85);
    },
};
// 光の帯（回った軌跡が重なる）。back=true で奥側の半分だけ
function cycBands(a, w, back) {
    const { ctx, phase: p } = a;
    if (p < T.first || p >= T.burst)
        return;
    const cols = cycCol(w), c = orbitC(a.foot, a.body);
    const laps = Math.min(5, Math.floor((orbitAng(p) - Math.PI * 0.15) / TAU) + 1);
    for (let i = 0; i < laps; i++) {
        const y = c.y - 8 - i * 14, rx = RX + 4 - i * 4, ry = RY - i * 1.5;
        const an1 = orbitAng(p), an0 = Math.max(Math.PI * 0.15 + i * TAU, an1 - TAU * 0.95);
        if (an1 <= Math.PI * 0.15 + i * TAU)
            continue;
        const s0 = i === laps - 1 ? an0 : an1 - TAU, s1 = an1;
        // 奥: 角度 π〜2π（上半分）。手前: 0〜π（下半分）
        const seg = (from, to) => glowArc(ctx, c.x, y, rx, ry, from, to, 3.5 - i * 0.4, i % 2 ? cols[1] : cols[0], 0.85 - i * 0.08);
        const n0 = Math.floor(s0 / Math.PI), n1 = Math.ceil(s1 / Math.PI);
        for (let k = n0; k < n1; k++) {
            const lo = Math.max(s0, k * Math.PI), hi = Math.min(s1, (k + 1) * Math.PI);
            if (hi <= lo)
                continue;
            const isBack = (((k % 2) + 2) % 2) === 1;
            if (isBack === back)
                seg(lo, hi);
        }
    }
}
// =====================================================================
// 乱れ突き（pierce）
// =====================================================================
const PIERCE_COL = { bow: ['#ffd166', '#fff6c8'], blaster: ['#63d471', '#c8ffc8'], pan: ['#ff9a3a', '#ffe27a'] };
const pierceCol = (w) => PIERCE_COL[w] ?? ['#7fe0ff', '#e8fff0'];
const pierceSpot = (body, w) => ({ x: body.x + (SHOT.has(w) ? 96 : 50), y: body.y + 16 });
const NEEDLES = 40;
// 突き（針）の i 本目: 出る時刻と、先端の位置（ボスの前で束になる）
const needleT = (i) => passAt(0) + (T.n * T.pass) * Math.pow(i / NEEDLES, 0.8);
const pierce = {
    pose(p, home, _foot, body, frame, w) {
        const s = pierceSpot(body, w);
        if (p < T.first)
            return ready(p, home, s, w);
        if (p >= T.home)
            return null;
        if (p < T.finish) { // 小刻みに前後しながら突き続ける（残像の腕）
            const j = (frame % 4) / 4;
            return at(home, { x: s.x - (SHOT.has(w) ? 0 : 3 * Math.sin(frame * 1.9)), y: s.y }, { action: 'attack', t: SHOT.has(w) ? 0.5 + 0.3 * j : 0.3 + 0.5 * j, ghosts: SHOT.has(w) ? [] : [{ x: s.x - home.x - 4, y: s.y - home.y, a: 0.3, act: 'attack' }, { x: s.x - home.x + 3, y: s.y - home.y, a: 0.2, act: 'attack' }] });
        }
        if (p < T.burst) {
            const k = win(p, T.finish, T.burst);
            return at(home, { x: s.x + 10 * ease(Math.min(1, k * 2)) - (k > 0.7 ? 24 * ease((k - 0.7) / 0.3) : 0), y: s.y }, { action: 'attack', t: k < 0.7 ? 0.1 : 0.95 });
        } // 引いて、溜めて、突く
        if (p < T.burst + 0.03)
            return at(home, { x: s.x - 24, y: s.y }, { action: 'attack', t: 0.95 });
        return goHome(p, home, { x: s.x - 24, y: s.y });
    },
    cam(p, home, _foot, body, _W, _H, w) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.burst + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.go)
            return [g, 1.6, home.x - 4, home.y - 22];
        const s = pierceSpot(body, w);
        if (p < T.burst)
            return [g, 1.45 + 0.2 * win(p, T.first, T.finish), (s.x + body.x) / 2, body.y - 6];
        return [g, 1.2, body.x + 10, body.y - 6];
    },
    beats(w) {
        const out = Array.from({ length: 16 }, (_, i) => ({ t: needleT(i * 2.5), stop: 0, shake: i % 4 === 3 ? 1 : 0, sfx: (SHOT.has(w) ? 'shoot' : 'slash') }));
        return [...out, { t: T.finish, stop: 0, shake: 0, sfx: 'charge' }, { t: T.burst, stop: 0.008, shake: 8, sfx: SHOT.has(w) ? 'impactShot' : 'impactBlade' }, { t: T.burst + 0.02, stop: 0, shake: 2, sfx: 'shatter' }];
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = pierceCol(w), s = pierceSpot(a.body, w), hand = { x: s.x - (SHOT.has(w) ? 12 : 10), y: s.y - 14 }, tgt = { x: a.body.x + 6, y: a.body.y + 2 };
        readyFx(a, hero, cols[1]);
        const rng = new Rng(`${a.seed}:pierce`);
        let n = 0, last = T.first;
        const fade = 1 - win(p, T.burst, T.burst + 0.03);
        for (let i = 0; i < NEEDLES; i++) {
            const t0 = needleT(i), off = { x: rng.range(-6, 6), y: rng.range(-16, 16) }, life = 0.03;
            if (p < t0)
                continue;
            n++;
            last = t0;
            const u = (p - t0) / 0.006, k = clamp01(u), al = (p < T.finish ? Math.max(0.25, 1 - (p - t0) / life) : 0.25 + 0.75 * win(p, T.finish, T.burst)) * fade;
            const tip = { x: lerp(hand.x, tgt.x + off.x, k), y: lerp(hand.y, tgt.y + off.y, k) };
            if (SHOT.has(w)) { // 光の針（弾）: 細い線が手元から一瞬で届く
                glowLine(ctx, lerp(hand.x, tip.x, Math.max(0, k - 0.4)), lerp(hand.y, tip.y, Math.max(0, k - 0.4)), tip.x, tip.y, 1.3, i % 2 ? cols[0] : cols[1], al);
            }
            else
                glowLine(ctx, hand.x, hand.y, tip.x, tip.y, 1.2 + (i % 3 === 0 ? 0.8 : 0), i % 2 ? cols[0] : cols[1], al);
            if (k >= 1 && p - t0 < 0.02)
                starSpark(ctx, tip.x, tip.y, 6 * (1 - (p - t0) / 0.02), 1, '#ffffff');
        }
        // 束: 突きが重なるほど、ボスの前の光が太くなる
        const bundle = clamp01(n / NEEDLES) * fade;
        if (bundle > 0) {
            glowDisc(ctx, tgt.x + 8, tgt.y, 10 + 16 * bundle, cols[0], bundle * 0.7, 0.8);
            glowLine(ctx, hand.x, hand.y, tgt.x, tgt.y, 3 + 8 * bundle, cols[0], bundle * 0.5);
        }
        // 締め: 力を溜めて、極太の一突きがボスを貫き、向こう側まで抜ける
        const ck = win(p, T.finish, T.burst);
        if (ck > 0 && p < T.burst) {
            sparkBurst(ctx, hand.x, hand.y, 1 - ck, `${a.seed}:pgather`, [cols[0], '#ffffff'], 18, 40, 0);
            glowDisc(ctx, hand.x, hand.y, 10 + 16 * ck, cols[0], ck, 1);
        }
        const bk = win(p, T.burst - 0.006, T.burst + 0.1);
        if (bk > 0 && bk < 1) {
            const reach = ease(clamp01(bk * 3)), end = { x: lerp(hand.x, tgt.x - 200, reach), y: lerp(hand.y, tgt.y, reach) };
            glowLine(ctx, hand.x, hand.y, end.x, end.y, 22 * (1 - bk) + 3, cols[0], 1 - bk * 0.6);
            glowLine(ctx, hand.x, hand.y, end.x, end.y, 6 * (1 - bk) + 1, '#ffffff', 1 - bk * 0.6);
            // 貫いた向こうの円錐の衝撃波
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const kk = clamp01(bk * 1.4 - i * 0.18);
                if (kk <= 0 || kk >= 1)
                    continue;
                ctx.globalAlpha = 1 - kk;
                ctx.strokeStyle = i === 1 ? '#ffffff' : cols[0];
                ctx.lineWidth = 3 * (1 - kk) + 1;
                ctx.beginPath();
                ctx.ellipse(tgt.x - 20 - kk * 60, tgt.y, 6 + kk * 10, 10 + kk * 40, 0, 0, TAU);
                ctx.stroke();
            }
            ctx.restore();
            sparkBurst(ctx, tgt.x - 10, tgt.y, bk, `${a.seed}:pburst`, [cols[0], cols[1], '#ffffff'], 40, 110, 20);
        }
        burstCore(a, tgt.x, tgt.y, win(p, T.burst, T.burst + 0.12), cols, 0.9);
        hitCounter(a, n + (p >= T.burst ? 1 : 0), p >= T.burst ? T.burst : last, NEEDLES + 1, cols[0]);
        flash(a, bump(p, T.burst - 0.003, T.burst + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 五芒星（star）
// =====================================================================
const STAR_COL = { book: ['#c77dff', '#7fe0ff'] };
const starCol = (w) => STAR_COL[w] ?? ['#7fe0ff', '#fff6c8'];
const starC = (body) => ({ x: body.x + 4, y: body.y - 2 });
const SR = 62;
// 星の頂点（一筆書きの順）: 上 → 右下 → 左上 → 右上 → 左下 → 上
const starPt = (body, i, rot = 0) => { const c = starC(body), an = -Math.PI / 2 + ((i * 2) % 5) * (TAU / 5) + rot; return { x: c.x + Math.cos(an) * SR, y: c.y + Math.sin(an) * SR * 0.78 }; };
const STROKES = 5, STROKE_T = (i) => passAt(i * 1.4); // 一画ずつ（最後の画が終わったら、星が回って魔法陣になる）
const star = {
    pose(p, home, _foot, body, frame, w) {
        const P0 = starPt(body, 0);
        if (p < T.first)
            return ready(p, home, { x: P0.x, y: P0.y + 14 }, w);
        if (p >= T.home)
            return null;
        for (let i = 0; i < STROKES; i++) {
            const t0 = STROKE_T(i), t1 = STROKE_T(i) + T.pass * 1.4;
            if (p < t1) {
                const A = starPt(body, i), B = starPt(body, i + 1), mv = clamp01((p - t0) / (T.pass * 0.8));
                const q = (u) => ({ x: lerp(A.x, B.x, ease(u)), y: lerp(A.y, B.y, ease(u)) + 14 });
                return at(home, q(mv), { action: mv < 1 ? 'dash' : 'cast', t: 0.5, flip: B.x < A.x, ghosts: mv < 1 ? trail(home, q, mv, 5, 0.12, 0.45, 'dash') : [] });
            }
        }
        const top = starPt(body, 0);
        if (p < T.burst + 0.03)
            return at(home, { x: top.x, y: top.y + 10 + Math.sin(frame / 6) }, { action: 'cast', t: 0.5 + 0.5 * Math.sin(frame / 4) });
        return goHome(p, home, { x: top.x, y: top.y + 14 });
    },
    cam(p, home, _foot, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.burst + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.go)
            return [g, 1.6, home.x - 4, home.y - 22];
        const c = starC(body);
        return [g, p < T.finish ? 1.3 : 1.2 + 0.15 * win(p, T.finish, T.burst), c.x + 6, c.y - 6];
    },
    beats: () => [
        ...Array.from({ length: STROKES }, (_, i) => ({ t: STROKE_T(i) + T.pass * 0.7, stop: 0.002, shake: 1, sfx: 'chant', v: 0.7 + i * 0.15 })),
        { t: STROKE_T(STROKES), stop: 0, shake: 1, sfx: 'barrier' }, { t: T.finish, stop: 0, shake: 0, sfx: 'charge' }, { t: T.burst, stop: 0.007, shake: 7, sfx: 'impactMagic' }, { t: T.burst + 0.02, stop: 0, shake: 2, sfx: 'thunder' },
    ],
    back(a, _hero, w) {
        const p = a.phase, c = starC(a.body), cols = starCol(w);
        const k = win(p, STROKE_T(STROKES), STROKE_T(STROKES) + 0.04) * (1 - win(p, T.burst + 0.04, T.burst + 0.12));
        if (k > 0)
            skyDisc(a, c.x, a.foot.y + 4, 90 * ease(k), k, w === 'book' ? 280 : 190);
        void cols;
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = starCol(w), c = starC(a.body);
        readyFx(a, hero, cols[1]);
        dim(a, 0.45 * win(p, T.first, T.first + 0.04) * (1 - win(p, T.burst, T.burst + 0.06)), '#060418');
        const done = STROKE_T(STROKES), spin = win(p, done, T.burst), rot = ease(spin) * TAU * 0.6, fade = 1 - win(p, T.burst, T.burst + 0.05);
        // 一画ずつ描かれる光の線（描き終えると、星ごと回る）
        for (let i = 0; i < STROKES; i++) {
            const t0 = STROKE_T(i), k = clamp01((p - t0) / (T.pass * 0.8));
            if (k <= 0 || fade <= 0)
                continue;
            const A = starPt(a.body, i, rot), B = starPt(a.body, i + 1, rot);
            const head = { x: lerp(A.x, B.x, ease(k)), y: lerp(A.y, B.y, ease(k)) };
            const wv = 2.5 + 3 * spin + (k < 1 ? 2 : 0);
            glowLine(ctx, A.x, A.y, head.x, head.y, wv, i % 2 ? cols[1] : cols[0], fade);
            if (k < 1)
                starSpark(ctx, head.x, head.y, 9, 1, '#ffffff');
        }
        // 頂点の小さな魔法陣（たどり着くたびに灯る）
        for (let i = 0; i < STROKES; i++) {
            const lit = win(p, STROKE_T(i) + T.pass * 0.7, STROKE_T(i) + T.pass * 0.9) * fade;
            if (lit <= 0)
                continue;
            const v = starPt(a.body, i + 1, rot);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(v.x, v.y);
            ctx.rotate(a.frame / 10 + i);
            ctx.globalAlpha = lit;
            ctx.strokeStyle = cols[0];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            for (let j = 0; j < 4; j++) {
                const an = (j / 4) * TAU;
                ctx.moveTo(Math.cos(an) * 4, Math.sin(an) * 4);
                ctx.lineTo(Math.cos(an) * 12, Math.sin(an) * 12);
            }
            ctx.stroke();
            ctx.restore();
            glowDisc(ctx, v.x, v.y, 14, cols[0], lit * 0.7, 0.8);
        }
        // 星が光る: 中心に力が集まる
        if (spin > 0 && fade > 0) {
            glowDisc(ctx, c.x, c.y, 20 + 40 * spin, cols[0], spin * fade, 1);
            sparkBurst(ctx, c.x, c.y, 1 - ((p * 30) % 1), `${a.seed}:stargather${Math.floor(p * 30)}`, [cols[0], cols[1]], 12, 70, 0);
        }
        // 炸裂: 星形の光と、天を突く光の柱
        const bk = win(p, T.burst, T.burst + 0.14);
        if (bk > 0 && bk < 1) {
            for (let i = 0; i < STROKES; i++) {
                const A = starPt(a.body, i, rot), B = starPt(a.body, i + 1, rot), s = 1 + bk * 0.8;
                glowLine(ctx, c.x + (A.x - c.x) * s, c.y + (A.y - c.y) * s, c.x + (B.x - c.x) * s, c.y + (B.y - c.y) * s, 8 * (1 - bk) + 1, cols[0], 1 - bk);
            }
            const w0 = 30 * (1 - bk) + 4;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(c.x - w0, 0, c.x + w0, 0);
            g.addColorStop(0, `${cols[0]}00`);
            g.addColorStop(0.4, `${cols[0]}cc`);
            g.addColorStop(0.5, '#ffffff');
            g.addColorStop(0.6, `${cols[0]}cc`);
            g.addColorStop(1, `${cols[0]}00`);
            ctx.globalAlpha = 1 - bk;
            ctx.fillStyle = g;
            ctx.fillRect(c.x - w0, -200, w0 * 2, a.foot.y + 210);
            ctx.restore();
        }
        burstCore(a, c.x, c.y, bk, cols, 1.2);
        const n = Math.min(STROKES, Math.max(0, Math.floor((p - T.first) / (T.pass * 1.4)) + 1));
        hitCounter(a, p >= T.first ? n + (p >= T.burst ? 1 : 0) : 0, p >= T.burst ? T.burst : STROKE_T(Math.max(0, n - 1)), STROKES + 1, cols[0]);
        flash(a, bump(p, T.burst - 0.003, T.burst + 0.04), cols[1], 0.75);
    },
};
// =====================================================================
// 百連斬（hundred）
// =====================================================================
const HUN_COL = { guitar: ['#ff6bd6', '#7fe0ff'] };
const hunCol = (w) => HUN_COL[w] ?? ['#c8b0ff', '#ffffff'];
const HUNDRED = 99;
// k 本目の斬撃の時刻（だんだん速くなる）
const cutT = (k) => T.first + (T.finish - T.first) * Math.pow(k / HUNDRED, 0.55);
const cutOf = (seed, k, body) => {
    const rng = new Rng(`${seed}:cut${k}`), an = rng.range(0, Math.PI), L = rng.range(14, 26), c = { x: body.x + 2 + rng.range(-34, 34), y: body.y + rng.range(-34, 30) };
    return { x0: c.x - Math.cos(an) * L, y0: c.y - Math.sin(an) * L, x1: c.x + Math.cos(an) * L, y1: c.y + Math.sin(an) * L, c };
};
const hundred = {
    pose(p, home, foot, body, frame, w) {
        const start = { x: body.x + 40, y: foot.y + 4 };
        if (p < T.first)
            return ready(p, home, start, w);
        if (p >= T.home)
            return null;
        if (p < T.finish) { // ボスのまわりの、あちこちに一瞬だけ現れる
            const k = Math.floor(clamp01((p - T.first) / (T.finish - T.first)) ** (1 / 0.55) * HUNDRED);
            const rng = new Rng(`hun${k}`), q = { x: body.x + rng.range(-56, 56), y: foot.y + rng.range(-40, 8) };
            return at(home, q, { action: 'attack', t: (frame % 5) / 5, flip: q.x > body.x, alpha: 0.85 });
        }
        const end = { x: body.x - 60, y: foot.y + 4 };
        if (p < T.burst) {
            const k = win(p, T.finish, T.burst), from = { x: body.x + 70, y: foot.y - 40 }, q = (u) => ({ x: lerp(from.x, end.x, ease(u)), y: lerp(from.y, end.y, ease(u)) });
            return at(home, q(k), { action: 'attack', t: 0.3 + 0.6 * k, ghosts: trail(home, q, k, 6, 0.08, 0.45, 'attack') });
        }
        if (p < T.burst + 0.03)
            return at(home, end, { action: 'attack', t: 0.95, flip: false });
        return goHome(p, home, end);
    },
    cam(p, home, _foot, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.burst + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.go)
            return [g, 1.6, home.x - 4, home.y - 22];
        return [g, p < T.finish ? 1.45 + 0.2 * win(p, T.first, T.finish) : 1.25, body.x + 8, body.y - 8];
    },
    beats(w) {
        const out = Array.from({ length: 20 }, (_, i) => ({ t: cutT(i * 5), stop: 0, shake: i > 14 ? 1 : 0, sfx: (w === 'guitar' ? 'hit' : 'slash') }));
        return [...out, { t: T.finish, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.burst, stop: 0.008, shake: 8, sfx: 'impactBlade' }, { t: T.burst + 0.02, stop: 0, shake: 2, sfx: 'shatter' }];
    },
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = hunCol(w);
        readyFx(a, hero, cols[1]);
        dim(a, 0.35 * win(p, T.first, T.first + 0.03) * (1 - win(p, T.burst, T.burst + 0.06)), '#08061a');
        let n = 0, last = T.first;
        const fade = 1 - win(p, T.burst, T.burst + 0.06);
        for (let k = 0; k < HUNDRED; k++) {
            const t0 = cutT(k);
            if (p < t0)
                break;
            n++;
            last = t0;
            const c = cutOf(a.seed, k, a.body), age = (p - t0) / 0.004, fresh = clamp01(1 - (p - t0) / 0.02);
            const kk = clamp01(age);
            const al = Math.max(0.18, fresh) * fade * (p > T.finish ? 0.4 + 0.6 * win(p, T.finish, T.burst) : 1);
            slashLine(ctx, c.x0, c.y0, lerp(c.x0, c.x1, kk), lerp(c.y0, c.y1, kk), 2 + fresh * 4, k % 2 ? cols : [cols[1], cols[0]], al);
            if (fresh > 0.6)
                starSpark(ctx, c.c.x, c.c.y, 5, fresh, '#ffffff');
        }
        if (w === 'guitar' && p > T.first && p < T.burst) { // 弦の残響（音符）
            const rng = new Rng(`${a.seed}:hunnote`);
            for (let i = 0; i < 10; i++) {
                const t = (p * 6 + rng.next()) % 1;
                text(ctx, i % 2 ? '♪' : '♫', a.body.x + rng.range(-60, 60), a.body.y + 20 - t * 70, 9, i % 2 ? cols[0] : cols[1], (1 - t) * 0.9, '#2a0a3a');
            }
        }
        // 最後の大きな一太刀（右上 → 左下）
        const fk = win(p, T.finish, T.burst), ff = 1 - win(p, T.burst + 0.02, T.burst + 0.1);
        if (fk > 0 && ff > 0) {
            const A = { x: a.body.x + 90, y: a.body.y - 60 }, B = { x: a.body.x - 80, y: a.body.y + 46 };
            slashLine(ctx, A.x, A.y, lerp(A.x, B.x, ease(fk)), lerp(A.y, B.y, ease(fk)), 14, [cols[0], '#ffffff'], ff);
        }
        // 爆ぜる: 刻んだ斬撃がいっせいに光って、はじける
        const bk = win(p, T.burst, T.burst + 0.12);
        if (bk > 0 && bk < 1)
            for (let k = 0; k < HUNDRED; k += 3) {
                const c = cutOf(a.seed, k, a.body);
                sparkBurst(ctx, c.c.x, c.c.y, bk, `${a.seed}:hb${k}`, [cols[0], cols[1], '#ffffff'], 3, 30, 10);
            }
        burstCore(a, a.body.x + 2, a.body.y, bk, cols, 1);
        hitCounter(a, n + (p >= T.burst ? 1 : 0), p >= T.burst ? T.burst : last, HUNDRED + 1, cols[0]);
        flash(a, bump(p, T.burst - 0.003, T.burst + 0.035), '#ffffff', 0.8);
    },
};
// =====================================================================
// 暗転の連撃（frames）
// =====================================================================
const FR_COL = { fan: ['#7bed9f', '#ffffff'], katana: ['#ff9ab0', '#ffffff'] };
const frCol = (w) => FR_COL[w] ?? ['#9fe8ff', '#ffffff'];
const DARK0 = T.first - 0.01, DARK1 = T.finish + 0.01; // 暗転しているあいだ
// i 番目のコマの斬撃（ボスを通る、角度のちがう線）
const frameCut = (body, i) => { const an = [-0.6, 0.5, -1.2, 1.0, 0.1, -0.3, 1.3, -0.9][i % 8], L = 96, c = { x: body.x + 2 + ((i % 3) - 1) * 8, y: body.y + (((i * 5) % 7) - 3) * 4 }; return { x0: c.x + Math.cos(an) * L, y0: c.y + Math.sin(an) * L, x1: c.x - Math.cos(an) * L, y1: c.y - Math.sin(an) * L }; };
const frames = {
    pose(p, home, foot, body, _frame, w) {
        const start = { x: body.x + 50, y: foot.y + 4 };
        if (p < T.first)
            return ready(p, home, start, w);
        if (p >= T.home)
            return null;
        if (p < DARK1) { // 暗転のあいだは、斬った瞬間の姿だけが一瞬浮かぶ（白い影は演出で描く）
            return { ...base, alpha: 0 };
        }
        const end = { x: body.x - 56, y: foot.y + 4 };
        if (p < T.burst + 0.03)
            return at(home, end, { action: MAGIC.has(w) ? 'cast' : 'attack', t: 0.95, flip: false }); // ボスの向こう側で、背を向けた残心
        return goHome(p, home, end);
    },
    cam(p, home, _foot, body) {
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.burst + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.go)
            return [g, 1.6, home.x - 4, home.y - 22];
        return [g, p < DARK1 ? 1.5 : 1.3, body.x + 6, body.y - 8];
    },
    beats: () => [
        { t: DARK0, stop: 0, shake: 0, sfx: 'whoosh' },
        ...Array.from({ length: T.n }, (_, i) => ({ t: passAt(i) + T.pass * 0.5, stop: 0.003, shake: 2, sfx: 'slash' })),
        { t: DARK1, stop: 0, shake: 0, sfx: 'guard' }, { t: T.burst, stop: 0.008, shake: 9, sfx: 'impactBlade' }, { t: T.burst + 0.02, stop: 0, shake: 3, sfx: 'shatter' },
    ],
    top(a, hero, w) {
        const { ctx, phase: p } = a;
        const cols = frCol(w);
        readyFx(a, hero, cols[0]);
        // 上下の黒い帯（シネマスコープ）
        const bars = win(p, T.go, T.first) * (1 - win(p, T.burst + 0.06, T.home));
        // 暗転: 真っ黒の中に、白い斬撃と、その瞬間の主役の白い影だけ
        const dk = win(p, DARK0, DARK0 + 0.005) * (1 - win(p, DARK1, DARK1 + 0.01));
        dim(a, dk * 0.96, '#000000');
        const shown = Math.min(T.n, Math.max(0, passOf(p) + 1));
        for (let i = 0; i < shown; i++) {
            const t0 = passAt(i) + T.pass * 0.45, k = win(p, t0, t0 + 0.004);
            if (k <= 0)
                continue;
            const l = frameCut(a.body, i), cur = i === shown - 1 && p < DARK1;
            const al = p < DARK1 ? (cur ? 1 : 0.35) : 0.6 + 0.4 * win(p, DARK1, T.burst);
            const wv = p < DARK1 ? (cur ? 7 : 2.5) : 3 + 5 * win(p, DARK1 + 0.02, T.burst);
            slashLine(ctx, l.x0, l.y0, lerp(l.x0, l.x1, k), lerp(l.y0, l.y1, k), wv, p < DARK1 ? ['#ffffff', '#ffffff'] : cols, al * (1 - win(p, T.burst, T.burst + 0.05)));
            if (cur && a.ult?.look) { // 斬った瞬間の主役の白い影（線の先）
                const look = a.ult.look, hx = lerp(l.x0, l.x1, 0.74), hy = lerp(l.y0, l.y1, 0.74) + 16, fl = l.x1 < l.x0;
                heroSilhouette(ctx, (c) => drawHero(c, look, NO_GEAR, 32, 56, { frame: a.frame, flip: fl, action: MAGIC.has(w) ? 'cast' : 'attack', t: 0.9, ring: false }), hx, hy, 1, '#ffffff', k * 0.9, 1);
            }
        }
        // 明ける: ボスがよろめき、間をおいて斬撃が一斉にはじける
        if (p >= DARK1 && p < T.burst)
            text(ctx, '……', a.body.x + 50, a.body.y - 44, 10, '#ffffff', win(p, DARK1 + 0.005, DARK1 + 0.015));
        const bk = win(p, T.burst, T.burst + 0.12);
        if (bk > 0 && bk < 1) {
            for (let i = 0; i < T.n; i++) {
                const l = frameCut(a.body, i), s = 1 + bk * 0.3;
                const cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2;
                slashLine(ctx, cx + (l.x0 - cx) * s, cy + (l.y0 - cy) * s, cx + (l.x1 - cx) * s, cy + (l.y1 - cy) * s, 12 * (1 - bk) + 1, cols, 1 - bk);
            }
            sparkBurst(ctx, a.body.x + 2, a.body.y, bk, `${a.seed}:frburst`, [cols[0], '#ffffff'], 46, 120, 20);
            if (w === 'katana' || w === 'fan')
                petals(ctx, a.body.x, a.body.y, 220, 140, p * 3, `${a.seed}:frpetal`, w === 'katana' ? ['#ffb7c5', '#ffd6e0', '#ff8fab'] : ['#7bed9f', '#3aa860', '#e3ffc8'], 1 - bk, 24, 1);
        }
        burstCore(a, a.body.x + 2, a.body.y, bk, cols, 1);
        // 黒い帯は一番手前に
        if (bars > 0) {
            ctx.save();
            ctx.fillStyle = '#000000';
            const h = 26 * ease(bars);
            ctx.fillRect(-a.W, -a.H, a.W * 3, a.H + h);
            ctx.fillRect(-a.W, a.H - h, a.W * 3, a.H + h);
            ctx.restore();
        }
        hitCounter(a, shown + (p >= T.burst ? 1 : 0), p >= T.burst ? T.burst : passAt(Math.max(0, shown - 1)) + T.pass * 0.45, T.n + 1, cols[0]);
        flash(a, bump(p, DARK1 - 0.003, DARK1 + 0.01), '#ffffff', 0.5);
        flash(a, bump(p, T.burst - 0.003, T.burst + 0.035), '#ffffff', 0.85);
    },
};
export const RUSH_MOVES = { cyclone, pierce, star, hundred, frames };
void bandArc;
//# sourceMappingURL=ult-rush.js.map