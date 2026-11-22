// ボスごとの攻撃の演出に使う、共通の部品（#118）。各ボスの演出（src/client/bosses/<kind>-fx.ts）が読む。
// 狙う所（aimOf・diveSpot）・急降下の共通の流れ（fallingBoss・fallingShadow）・大きな爪痕（ripMarks）・口から流れる奔流（streamAim）・
// 背後から来る攻撃（backRaid）・段（partyLanes）など。ボスの種類ごとの絵や形は、ここには置かない。
// 時間は場面の進行度 phase（0..1）: 0.04〜0.38 予兆 / 0.38〜0.46 着弾 / 〜0.6 余韻（シークしても同じ絵になる）
import { bump, clamp01, ease, hash, lerp, R, screenFlash, slashMark, sparkle, TAU, tinted, win } from './fxkit.js';
import { BOSS_IDLE, bossCanvas } from './boss.js';
import { bossMotion, makeAt } from './bossmotion.js';
import { focusOf, GUARD } from './reach.js';
import { BW0, BH0, spriteToWorld } from './bossstyle.js';
import { bossOf } from './bossapi.js';
export const heroes = (a) => a.fighters.filter((v) => v.alive);
/** 技が届く先（当たった人の体）。かわした人への攻撃は、元いた場所（立ち位置）へ届く（体は回避の型で抜けている。#120） */
export const landing = (v, dy = -10) => ({ x: v.x, y: v.y + dy });
/** 大きな攻撃（急降下の着地・大岩・薙ぎ払いの弧など）が狙う所（足もと）。reach.ts の focusOf */
export const aimOf = (a) => focusOf(a.fighters, a.solo) ?? { x: a.W * 0.68, y: 156 };
/** 真上から降ってくる急降下（fallingBoss）の、降ってくる所（足もと）。狙う人の上に落ちる（落ちる場所から飛びのいて抜ける） */
export const diveSpot = (a, _kind) => ({ x: aimOf(a).x + DIVE_AIM_DX, y: aimOf(a).y });
/** 背後から来る攻撃（全部のボス。BossModule の backScene。このファイルの backRaid と、ボスごとの背後の演出）の時刻と所。
 *  appear: 背後に小さな相手があらわれはじめる / t0: 背中へ届く（＋冒険者ごとのずらし backDelay）/ t1: 通りすぎる。
 *  meet: 振り向いて迎え撃つ所（左右を反転した MEET。型の当てる先）/ guard: 振り向いて受ける所（左右を反転した GUARD）。arrival.ts も同じ値を使う */
export const BACK = { appear: 0.28, t0: 0.415, t1: 0.47, meet: { dx: 26, dy: -18 }, guard: { dx: -GUARD.dx, dy: GUARD.dy } };
export const backDelay = (f) => hash(f, 3) * 0.03;
/** 急降下は、狙う人の少し手前（ボスの側）に落ちる（体の幅に入るので当たる。抜ける向きは、ボスから離れる右） */
export const DIVE_AIM_DX = -20;
/** 狙う人（1人に寄る窓の人・自分の冒険者）。討伐隊のまん中を狙うときは、いない */
export const focusFighter = (a) => a.fighters.find((v) => v.alive && (a.solo !== undefined ? v.f === a.solo : v.mine));
export const bodyOf = (a, kind) => spriteToWorld(a.foot, bossOf(kind).style.body);
/** 動いているボスの、絵の中の位置 → 画面の位置（bossmotion.ts の体の動き＝踏みこみ・傾き・のびを含める）。
 *  爪・脚・触手などを、ボスの体に付けて描くのに使う（spriteToWorld は動かない待機の位置なので、動くとずれる） */
export const motionAt = (a, kind) => {
    const reach = a.partyX !== undefined ? a.partyX + 28 - a.foot.x : 120;
    return makeAt(a.foot, bossMotion(kind, a.scene, 'claw', a.phase, { reach }), BW0, BH0);
};
/** 真上から降ってくる急降下（使うボスで共通）: 空（天井）へ飛び去ったボスが、討伐隊の真上に姿をあらわし（0.27〜0.33）、
 *  ひと呼吸ためて（〜0.37）、まっすぐ真下へ突っこむ（0.37〜0.42）。着弾 0.42 は、画面の揺れ・冒険者ののけぞりと同じ時刻。
 *  ボスは影ではなく、色のついた本物の絵で描く（降りるときは体がのび、着地でつぶれる）。残像・風を切る線・床の影つき。
 *  着弾のあとは、跳び上がって消え（〜0.5）、もとの場所に舞いもどる（bossmotion.ts の dive）
 *  kind: ボスの種類 / rim: 残像と風の色 / poseOf: 降るときのポーズ（diving: 突っこんでいる）/ extra: ボスのまわりの飾りを描く */
export const DIVE_FALL = { from: 0.27, hold: 0.33, dive: 0.37, hit: 0.42 };
/** 急降下の床の影（冒険者より奥に描く）。降ってくるボスが近づくほど濃く大きい2段の楕円 */
export function fallingShadow(a) {
    const { ctx, phase: p } = a;
    if (p < DIVE_FALL.from || p > 0.5)
        return;
    const enter = ease(win(p, DIVE_FALL.from, DIVE_FALL.hold)), d = win(p, DIVE_FALL.dive, DIVE_FALL.hit), leave = win(p, 0.45, 0.5);
    const near = p < 0.42 ? 0.25 + 0.5 * enter + 0.25 * d * d : 1 - leave;
    const at = diveSpot(a, a.theme?.kind), cx = at.x, y = at.y + 2;
    ctx.save();
    ctx.fillStyle = '#05040a';
    ctx.globalAlpha = 0.3 * near;
    ctx.beginPath();
    ctx.ellipse(R(cx), y, 16 + 30 * near, 5 + 8 * near, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.45 * near;
    ctx.beginPath();
    ctx.ellipse(R(cx), y, 9 + 18 * near, 3 + 5 * near, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
}
export function fallingBoss(a, kind, rim, poseOf, extra) {
    const { ctx, phase: p } = a;
    const at = diveSpot(a, kind), cx = at.x, land = at.y, apex = Math.max(40, Math.min(58, land - 98)); // 足もとの高さ: 空中で止まる所 → 床（狙う人の足もと）
    if (p < DIVE_FALL.from || p > 0.5)
        return;
    const enter = ease(win(p, DIVE_FALL.from, DIVE_FALL.hold)), wind = win(p, DIVE_FALL.hold, DIVE_FALL.dive), d = win(p, DIVE_FALL.dive, DIVE_FALL.hit);
    const leave = win(p, 0.45, 0.5), smash = bump(p, 0.415, 0.47);
    const fall = d * d; // だんだん速く
    const yAt = (q) => { const dd = win(q, DIVE_FALL.dive, DIVE_FALL.hit); return q < DIVE_FALL.dive ? lerp(-30, apex, ease(win(q, DIVE_FALL.from, DIVE_FALL.hold))) - 5 * ease(win(q, DIVE_FALL.hold, DIVE_FALL.dive)) : lerp(apex - 5, land, dd * dd); };
    const y = p < 0.42 ? yAt(p) : land - 70 * ease(leave);
    const diving = p >= DIVE_FALL.dive && p < 0.42;
    const pose = poseOf(diving, a.frame);
    const body = bossCanvas({ ...BOSS_IDLE, ...pose }, false, kind);
    const sx = diving ? 1 - 0.14 * fall : 1 + 0.22 * smash, sy = diving ? 1 + 0.25 * fall : 1 - 0.25 * smash; // 降りるときはのびて、床でつぶれる
    const draw = (img, yy, al) => {
        ctx.save();
        ctx.globalAlpha = al;
        ctx.imageSmoothingEnabled = false;
        ctx.translate(R(cx), R(yy));
        ctx.scale(sx, sy);
        const g0 = bossOf(kind).style.ground?.y0 ?? BH0; // 足場（霧の台座など）は、跳んだボスには付いてこない
        ctx.drawImage(img, 0, 0, BW0, g0, -48, -82, BW0, g0);
        ctx.restore();
    };
    // 残像（来た道に、縁の色で）
    if (diving)
        for (let i = 1; i <= 3; i++) {
            const yy = yAt(p - i * 0.022);
            if (y - yy > 14 * i)
                draw(tinted(body, rim), yy, 0.22 * (1 - i / 4));
        }
    // 風を切る線（真上へ流れる。速いほど長い）
    if (diving || (p >= 0.42 && smash > 0)) {
        for (let i = 0; i < 9; i++) {
            const ox = (hash(i, 3) - 0.5) * 90, len = (16 + 40 * hash(i, 4)) * (diving ? fall : smash), top = y - 70 - hash(i, 5) * 40;
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = i % 3 ? '#ffffff' : rim;
            ctx.fillRect(R(cx + ox), R(top - len), i % 2 ? 1 : 2, R(len));
        }
        ctx.globalAlpha = 1;
    }
    extra?.(cx, y, d);
    draw(body, y, 1 - leave);
    if (wind > 0 && wind < 1) {
        const e = spriteToWorld({ x: cx, y }, bossOf(kind).style.eye);
        sparkle(ctx, e.x, e.y, 2 + 4 * wind, '#ffffff', wind);
    } // 突っこむ直前、目が光る
}
/** 爪痕 i の、高さ y での x（ふくらみを含む） */
export function ripX(m, y) {
    const l = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) || 1, nx = -(m.y1 - m.y0) / l, ny = (m.x1 - m.x0) / l;
    const pt = (u) => { const b = Math.sin(u * Math.PI) * m.bow; return { x: lerp(m.x0, m.x1, u) + nx * b, y: lerp(m.y0, m.y1, u) + ny * b }; };
    let prev = pt(0);
    if (y <= prev.y)
        return prev.x;
    for (let i = 1; i <= 64; i++) {
        const q = pt(i / 64);
        if (q.y >= y)
            return lerp(prev.x, q.x, (y - prev.y) / Math.max(1e-6, q.y - prev.y));
        prev = q;
    }
    return prev.x;
}
export function ripMarks(W, kind, aim) {
    const R0 = bossOf(kind).fx.rip; // ボスごとの爪痕の形（BossModule の fx.rip）
    const raw = Array.from({ length: R0.n }, (_, i) => { const x0 = W * 0.36 + i * R0.gap, y0 = R0.y0 + i * R0.dy; return { x0, y0, x1: x0 + R0.len, y1: 214, bow: R0.bow }; });
    const tx = aim.x + R0.at.dx, ty = aim.y + R0.at.dy, ox = tx - ripX(raw[R0.aim], ty);
    return raw.map((m) => ({ ...m, x0: m.x0 + ox, x1: m.x1 + ox }));
}
/** 口から右へ流れる奔流（fxkit.ts の billowStream）が、狙う所 (tx, ty) を通るように、下がり方 drop と広がり spread を決める。
 *  まん中の筋（広がりの 0.6）に、狙う所が入るように（近い人には、斜めに吹きつける） */
export function streamAim(m, W, tx, ty, drop0, spread0) {
    const reach = W + 30 - m.x, u = Math.max(0.05, clamp01((tx - m.x - 4) / reach));
    const drop = Math.max(-400, Math.min(1600, (ty - m.y - 2) / u)), miss = Math.abs(ty - (m.y + 2 + drop * u));
    return { drop, spread: Math.max(spread0, Math.min(spread0 * 1.6, miss / (0.6 * Math.pow(u, 0.9)))), u };
}
/** 冒険者の段（1人に寄る窓でも、討伐隊ぜんたいの段）。段ごとに走る攻撃（突撃・地割れ）に使う */
export const partyLanes = (a) => {
    const ls = a.lanes ?? [...new Set(heroes(a).map((v) => Math.round(v.y)))];
    return ls.length ? [...ls].sort((p, q) => p - q) : [156, 170, 184, 198];
};
/** 折れ線の、長さの割合 k の点 */
export function pathAt(pts, k) {
    const L = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
    let d = clamp01(k) * L;
    for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (d <= l)
            return { x: lerp(pts[i - 1].x, pts[i].x, d / (l || 1)), y: lerp(pts[i - 1].y, pts[i].y, d / (l || 1)) };
        d -= l;
    }
    return pts[pts.length - 1];
}
export function backRaid(a, R0, guard = false) {
    const { ctx, phase: p } = a, B = guard ? BACK.guard : BACK.meet;
    for (const v of heroes(a)) {
        const d = backDelay(v.f), t0 = BACK.t0 + d;
        const come = ease(win(p, BACK.appear + d, BACK.appear + 0.08 + d));
        if (come <= 0 || p > t0 + 0.2)
            continue;
        for (let j = 0; j < R0.n; j++) {
            const sd = v.f * 2 + j, oy = R0.n > 1 ? (j ? 6 : -6) : 0;
            const home = R0.home(v, j), tgt = { x: v.x + B.dx + (R0.n > 1 ? (j ? 3 : -1) : 0), y: v.y + B.dy + oy * 0.6 };
            const sw0 = win(p, t0 - 0.06 - 0.008 * j, t0), sw = sw0 * sw0;
            const st = { v, j, p, t0, come, sw, home, tgt, pos: home, ok: v.ok, hit: 0 };
            // 待つあいだは、ふわふわと間合いをはかる
            const wob = 1 - sw;
            st.pos = { x: lerp(home.x, tgt.x, sw) + Math.sin(p * 40 + sd) * 1.5 * wob, y: lerp(home.y, tgt.y, sw) + Math.sin(p * 55 + sd * 2) * 1.5 * wob };
            if (come < 1) {
                const e = R0.enter ? R0.enter(st) : { x: home.x + 12, y: home.y };
                st.pos = { x: lerp(e.x, st.pos.x, come), y: lerp(e.y, st.pos.y, come) };
            }
            if (p >= t0) {
                st.pos = tgt;
                if (v.ok)
                    st.hit = win(p, t0, t0 + 0.12);
                else {
                    st.hit = win(p, t0, t0 + 0.16);
                    st.pos = { x: lerp(tgt.x, v.x + 3, win(p, t0, t0 + 0.03)), y: lerp(tgt.y, v.y - 16 + oy * 0.5, win(p, t0, t0 + 0.03)) };
                } // 背中まで届く
                if (st.hit >= 1)
                    continue;
            }
            R0.draw(ctx, st, a);
        }
    }
    screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), R0.flash ?? '#ffffff', 0.18);
}
/** 縁どり: shape(col) を、まわり4方向へ1ドットずらして縁の色 col で描いてから、本来の色（col が null）で描く */
export function rimmed(ctx, rim, shape) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        ctx.save();
        ctx.translate(ox, oy);
        shape(rim);
        ctx.restore();
    }
    shape(null);
}
export const poly = (ctx, pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
/** 背中の傷（動けなかった人）: 斜めの2本の傷 */
export function backWound(ctx, v, k, P) {
    const cut = win(k, 0.1, 0.35), fade = 1 - win(k, 0.55, 1);
    if (cut <= 0 || fade <= 0)
        return;
    const l = landing(v, 0);
    ctx.save();
    ctx.globalAlpha = fade;
    slashMark(ctx, l.x + 10, l.y - 26, l.x - 2, l.y - 8, 4, 3, ease(cut), P);
    slashMark(ctx, l.x + 12, l.y - 18, l.x, l.y - 2, 4, 3, ease(win(cut, 0.3, 1)), P);
    ctx.restore();
}
/** 爆発の輪（10 個の粒と、はじめの白い閃光。隕石などが落ちた所） */
export function boomBurst(ctx, x, y, k, col) {
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = col;
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(a) * k * 16), Math.round(y + Math.sin(a) * k * 10), 3, 3);
    }
    if (k < 0.4) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 8 * (1 - k), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
/** 攻撃がふつうに届く時刻 */
export const IMPACT_T = 0.42;
/** 届く時刻（t1 を省くと t0 の少しあと） */
export const arrive = (t0, t1 = t0 + 0.04) => ({ t0, t1 });
/** 狙う所（ないときは、この冒険者） */
export const aimAt = (c) => c.aim ?? { x: c.x, y: c.y };
/** 立ち位置からのずれで、当たる所 */
export const strikeAt = (c, dx, dy, r = 6) => ({ x: c.x + dx, y: c.y + dy, r });
/** 段の一覧（上から順）と、この冒険者の段の番号（partyLanes と同じ並び） */
export const laneOf = (c) => { const ls = c.lanes.length ? [...c.lanes].sort((p, q) => p - q) : [c.y]; let j = 0; ls.forEach((l, i) => { if (Math.abs(l - c.y) < Math.abs(ls[j] - c.y))
    j = i; }); return { ls, j }; };
/** 折れ線のうえで、x に来るまでの長さの割合 */
export function fracAtX(pts, x) {
    const L = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (pts[i].x >= x)
            return clamp01((d + l * clamp01((x - pts[i - 1].x) / Math.max(1e-6, pts[i].x - pts[i - 1].x))) / L);
        d += l;
    }
    return 1;
}
/** ease（なめらかな 0→1）の逆。v から t を探す */
export const easeInv = (v) => { v = clamp01(v); let lo = 0, hi = 1; for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (ease(m) < v)
        lo = m;
    else
        hi = m;
} return (lo + hi) / 2; };
/** 点 (px,py) と折れ線の、いちばん近い距離 */
export function distTo(pts, px, py) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
        const t = clamp01(((px - a.x) * dx + (py - a.y) * dy) / l2), qx = a.x + dx * t - px, qy = a.y + dy * t - py;
        best = Math.min(best, Math.hypot(qx, qy));
    }
    return best;
}
/** 点 (px,py) にいちばん近い、折れ線の上の点 */
export const nearPoint = (pts, px, py) => { let b = pts[0], bd = 1e9; for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1], dx = p1.x - p0.x, dy = p1.y - p0.y, l2 = dx * dx + dy * dy || 1, t = clamp01(((px - p0.x) * dx + (py - p0.y) * dy) / l2), q = { x: p0.x + dx * t, y: p0.y + dy * t }, d = Math.hypot(q.x - px, q.y - py);
    if (d < bd) {
        bd = d;
        b = q;
    }
} return b; };
/** 形が足もとに触れていた時刻の区間を、細かい時刻ごとに調べる（触れなければ、いちばん近づいた時刻） */
export function scan(from, to, near, reach) {
    let t0 = -1, t1 = -1, bestP = from, best = 1e9;
    for (let p = from; p <= to + 1e-9; p += 0.0025) {
        const d = near(p);
        if (d < best) {
            best = d;
            bestP = p;
        }
        if (d <= reach) {
            if (t0 < 0)
                t0 = p;
            t1 = p;
        }
    }
    return t0 < 0 ? { t0: bestP, t1: bestP } : { t0, t1 };
}
/** 口から右へ流れる奔流（streamAim）の届く時刻: 先が届く → 根もとから消えて、ここを通りすぎる */
export function streamArrival(c, head0, head1, cut0, cut1) {
    const { kind, x, foot, W } = c, S = bossOf(kind).style;
    const mo = makeAt(foot, bossMotion(kind, 'breath', 'breath', head1), BW0, BH0)(S.mouth[0], S.mouth[1]);
    const reach = W + 30 - mo.x, u = clamp01((x - mo.x - 4) / reach);
    return { t0: head0 + (head1 - head0) * easeInv(u), t1: cut0 + (cut1 - cut0) * u };
}
/** 奔流の当たる所: 自分の列（x）を通る、まん中の筋（広がりの 0.6）。下がり方と広がりは、狙う人を通るように（streamAim） */
export function streamStrike(c, a, St) {
    const { kind, x, foot, W } = c, S = bossOf(kind).style, aim = aimAt(c);
    const mo = makeAt(foot, bossMotion(kind, 'breath', 'breath', a.t0), BW0, BH0)(S.mouth[0], S.mouth[1]);
    const sa = streamAim(mo, W, aim.x + St.dx, aim.y + St.dy, St.drop, St.spread), u = Math.max(0.05, clamp01((x + St.dx - mo.x - 4) / (W + 30 - mo.x)));
    return { x: x + St.dx, y: mo.y + 2 + sa.drop * u, r: 0.6 * sa.spread * Math.pow(u, 0.9), band: true };
}
/** 大きな爪痕（ripMarks）のうち、この冒険者のいちばん近くを通る一本（受け止める・横へ抜ける所の高さで） */
export function ripNear(c) {
    const R0 = bossOf(c.kind).fx.rip, ty = c.y + R0.at.dy, tx = c.x + R0.at.dx;
    const ms = ripMarks(c.W, c.kind, aimAt(c));
    let i = 0;
    ms.forEach((m, k) => { if (Math.abs(ripX(m, ty) - tx) < Math.abs(ripX(ms[i], ty) - tx))
        i = k; });
    return { i, m: ms[i], x: ripX(ms[i], ty), y: ty, all: ms.map((m) => ripX(m, ty)) };
}
/** 大きな爪痕の届く時刻: いちばん近くを通る爪痕の先が、自分の高さ（受ける・抜ける所）を通る時刻 */
export function ripArrival(c) {
    const R0 = bossOf(c.kind).fx.rip, { i, m, y: ty } = ripNear(c), t = easeInv(clamp01((ty - m.y0) / (m.y1 - m.y0)));
    return arrive(R0.a0 + (R0.a1 - R0.a0) * clamp01((t + i * 0.12) / R0.sp), 0.5);
}
/** 真上から降ってくる急降下（fallingBoss）の、落ちる場所（体の幅 96 を、着地のつぶれで少し広げた半分） */
export const fallingZone = (c) => ({ x: aimAt(c).x + DIVE_AIM_DX, r: 58 });
//# sourceMappingURL=bosskit.js.map