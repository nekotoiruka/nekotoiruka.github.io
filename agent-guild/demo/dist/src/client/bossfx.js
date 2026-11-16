import { arrow, band, bat, billowStream, FROST5, bump, clamp01, crack, dustRing, ease, fangShape, glowAt, goblinSil, hash, iceSpear, lerp, mistBlob, puffs, R, rock, screenFlash, shard, skyDark, slashMark, sparkle, sweepArc, TAU, tentacle, tinted, webNet, win } from './fxkit.js';
import { BW0, BH0, STYLE, spriteToWorld } from './bossstyle.js';
import { drawBoulder, drawRockFist, ROCK } from './pixart.js';
import { BOSS_IDLE, bossCanvas } from './boss.js';
import { bossMotion, makeAt, SPIDER_SWEEP } from './bossmotion.js';
import { focusOf, GUARD, MEET } from './reach.js';
const heroes = (a) => a.fighters.filter((v) => v.alive);
/** 技が届く先（当たった人の体）。かわした人への攻撃は、元いた場所（立ち位置）へ届く（体は回避の型で抜けている。#120） */
const landing = (v, dy = -10) => ({ x: v.x, y: v.y + dy });
/** 大きな攻撃（急降下の着地・大岩・薙ぎ払いの弧など）が狙う所（足もと）。reach.ts の focusOf */
export const aimOf = (a) => focusOf(a.fighters, a.solo) ?? { x: a.W * 0.68, y: 156 };
/** 急降下（竜・伯爵・大蜘蛛）で降ってくる所（足もと）。狙う人の上に落ちる（落ちる場所から飛びのいて抜ける） */
export const diveSpot = (a, _kind) => ({ x: aimOf(a).x + DIVE_AIM_DX, y: aimOf(a).y });
/** 急降下は、狙う人の少し手前（ボスの側）に落ちる（体の幅に入るので当たる。抜ける向きは、ボスから離れる右） */
export const DIVE_AIM_DX = -20;
/** 狙う人（1人に寄る窓の人・自分の冒険者）。討伐隊のまん中を狙うときは、いない */
export const focusFighter = (a) => a.fighters.find((v) => v.alive && (a.solo !== undefined ? v.f === a.solo : v.mine));
const bodyOf = (a, kind) => spriteToWorld(a.foot, STYLE[kind].body);
/** 動いているボスの、絵の中の位置 → 画面の位置（bossmotion.ts の体の動き＝踏みこみ・傾き・のびを含める）。
 *  爪・脚・触手などを、ボスの体に付けて描くのに使う（spriteToWorld は動かない待機の位置なので、動くとずれる） */
const motionAt = (a, kind) => {
    const reach = a.partyX !== undefined ? a.partyX + 28 - a.foot.x : 120;
    return makeAt(a.foot, bossMotion(kind, a.scene, 'claw', a.phase, { reach }), BW0, BH0);
};
/** 急降下（竜・伯爵・大蜘蛛で共通）: 空（天井）へ飛び去ったボスが、討伐隊の真上に姿をあらわし（0.27〜0.33）、
 *  ひと呼吸ためて（〜0.37）、まっすぐ真下へ突っこむ（0.37〜0.42）。着弾 0.42 は、画面の揺れ・冒険者ののけぞりと同じ時刻。
 *  ボスは影ではなく、色のついた本物の絵で描く（降りるときは体がのび、着地でつぶれる）。残像・風を切る線・床の影つき。
 *  着弾のあとは、跳び上がって消え（〜0.5）、もとの場所に舞いもどる（bossmotion.ts の dive）
 *  kind: ボスの種類 / rim: 残像と風の色 / extra: ボスのまわりの飾り（蝙蝠・糸など）を描く */
export const DIVE_FALL = { from: 0.27, hold: 0.33, dive: 0.37, hit: 0.42 };
/** 急降下の床の影（冒険者より奥に描く）。降ってくるボスが近づくほど濃く大きい2段の楕円 */
export function fallingShadow(a) {
    const { ctx, phase: p } = a;
    if (p < DIVE_FALL.from || p > 0.5)
        return;
    const enter = ease(win(p, DIVE_FALL.from, DIVE_FALL.hold)), d = win(p, DIVE_FALL.dive, DIVE_FALL.hit), leave = win(p, 0.45, 0.5);
    const near = p < 0.42 ? 0.25 + 0.5 * enter + 0.25 * d * d : 1 - leave;
    const at = diveSpot(a, (a.theme?.kind ?? 'dragon')), cx = at.x, y = at.y + 2;
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
export function fallingBoss(a, kind, rim, extra) {
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
    const pose = kind === 'spider' ? { eye: 'angry', wing: diving ? 2 : 1, mouth: diving ? 2 : 0.5 }
        : kind === 'vampire' ? { eye: 'angry', wing: diving ? -1 : 2, lean: diving ? 3 : 0, mouth: diving ? 1 : 0 }
            : { eye: 'angry', wing: diving ? -2 : (a.frame >> 2) % 2 ? 2 : -0.5, lean: diving ? 6 : 0, mouth: diving ? 2 : 1 };
    const body = bossCanvas({ ...BOSS_IDLE, ...pose }, false, kind);
    const sx = diving ? 1 - 0.14 * fall : 1 + 0.22 * smash, sy = diving ? 1 + 0.25 * fall : 1 - 0.25 * smash; // 降りるときはのびて、床でつぶれる
    const draw = (img, yy, al) => {
        ctx.save();
        ctx.globalAlpha = al;
        ctx.imageSmoothingEnabled = false;
        ctx.translate(R(cx), R(yy));
        ctx.scale(sx, sy);
        const g0 = STYLE[kind].ground?.y0 ?? BH0; // 足場（霧の台座など）は、跳んだボスには付いてこない
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
        const e = spriteToWorld({ x: cx, y }, STYLE[kind].eye);
        sparkle(ctx, e.x, e.y, 2 + 4 * wind, '#ffffff', wind);
    } // 突っこむ直前、目が光る
}
/** 討伐隊ぜんたいを裂く大きな爪痕（竜のひっかき・伯爵の伸びる爪）の、一本ずつの線（左上 → 右下）と、ふくらみ・裂ける速さ。
 *  狙う人（aimOf）の所を、狙う爪痕（右端＝ボスから遠い側）が通るように、爪痕ぜんたいを横にずらす。竜は横へ抜ける人の元いた所、
 *  伯爵は受け止める所（GUARD）。ほかの爪痕は、狙う人の手前（ボスの側）を通るので、横へ抜けた体や受け止めた体にかからない。描く（scenes.ts の clawFx・vampire.claw）と、届く時刻（arrival.ts）の両方で使う */
export const RIP = {
    dragon: { n: 3, gap: 32, y0: 44, dy: 4, len: 104, bow: -12, aim: 2, a0: 0.39, a1: 0.45, sp: 1.5, at: { dx: 0, dy: -12 } },
    vampire: { n: 5, gap: 24, y0: 54, dy: 3, len: 108, bow: -10, aim: 4, a0: 0.4, a1: 0.45, sp: 1.6, at: GUARD },
};
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
    const R0 = RIP[kind];
    const raw = Array.from({ length: R0.n }, (_, i) => { const x0 = W * 0.36 + i * R0.gap, y0 = R0.y0 + i * R0.dy; return { x0, y0, x1: x0 + R0.len, y1: 214, bow: R0.bow }; });
    const tx = aim.x + R0.at.dx, ty = aim.y + R0.at.dy, ox = tx - ripX(raw[R0.aim], ty);
    return raw.map((m) => ({ ...m, x0: m.x0 + ox, x1: m.x1 + ox }));
}
/** 口から右へ流れる奔流（竜の炎・氷の巨人の息。fxkit.ts の billowStream）が、狙う所 (tx, ty) を通るように、下がり方 drop と広がり spread を決める。
 *  まん中の筋（広がりの 0.6）に、狙う所が入るように（近い人には、斜めに吹きつける） */
export function streamAim(m, W, tx, ty, drop0, spread0) {
    const reach = W + 30 - m.x, u = Math.max(0.05, clamp01((tx - m.x - 4) / reach));
    const drop = Math.max(-400, Math.min(1600, (ty - m.y - 2) / u)), miss = Math.abs(ty - (m.y + 2 + drop * u));
    return { drop, spread: Math.max(spread0, Math.min(spread0 * 1.6, miss / (0.6 * Math.pow(u, 0.9)))), u };
}
/** 奔流が狙う所（立ち位置からのずれ）: 竜の炎は受け止める所、氷の巨人の息は伏せた頭の上 */
export const STREAM_AT = { dragon: { dx: GUARD.dx, dy: GUARD.dy, drop: 44, spread: 46 }, giant: { dx: 0, dy: -30, drop: 40, spread: 50 } };
// ================= 吸血鬼伯爵 =================
/** 蝙蝠の群れが通る高さ（段の足もとから。立っている人の頭にかかり、伏せた人の上を通る） */
export const VAMP_BATS_DY = 30;
const VAMP_NAIL = { line: '#2a0610', dark: '#6a0f20', body: '#c0283e', hi: '#ff9aae' };
const VAMP_RIP = { line: '#1a0208', dark: '#7a0a1e', body: '#e8284a', hi: '#ffe0e8' };
const vampire = {
    // 蝙蝠の群れ: 蝙蝠が体のまわりを回りながら集まり、マントから群れになって飛び出す
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const c = bodyOf(a, 'vampire');
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.46) { // 体のまわりを回りながら、数がふえて集まる
                const n = 4 + R(12 * gather);
                for (let i = 0; i < n; i++) {
                    const ang = p * 9 + (i / n) * TAU, r = lerp(54, 20, gather) * (0.8 + 0.4 * hash(i, 5));
                    bat(ctx, c.x + Math.cos(ang) * r, c.y - 10 + Math.sin(ang) * r * 0.55, ((a.frame >> 1) + i) % 2, '#1a0a24', 1.7);
                }
                puffs(ctx, c.x, c.y + 24, { n: 8, t: p * 2, dx: 0, dy: -30, spread: 50, r0: 3, r1: 8, color: '#5a2a7a', alpha: 0.5 * gather, seed: 31 });
            }
            const rel = win(p, 0.38, 0.6);
            if (rel > 0) { // 群れが飛び出して、列ごとに横ぎる
                // 群れは、冒険者の頭のすぐ上の高さを横ぎる（床に伏せた人の上を通りすぎる）
                const lanes = a.lanes ?? [...new Set(heroes(a).map((v) => Math.round(v.y)))];
                // 1人に寄った窓では、その人の段を通る蝙蝠だけを描く（ほかの段の蝙蝠が、寄った画面では体にぶつかって見える）
                const me = a.solo !== undefined ? a.fighters.find((v) => v.f === a.solo) : undefined, myLane = me ? Math.round(me.y) : null;
                for (let i = 0; i < 24; i++) {
                    if (myLane !== null && lanes.length && lanes[Math.floor(hash(i, 2) * lanes.length)] !== myLane)
                        continue;
                    const t = clamp01((rel - hash(i, 1) * 0.3) / 0.7);
                    if (t <= 0 || t >= 1)
                        continue;
                    const ty = lanes.length ? lanes[Math.floor(hash(i, 2) * lanes.length)] - VAMP_BATS_DY + (hash(i, 3) - 0.5) * 8 : 92 + hash(i, 2) * 112, x = lerp(c.x + 14, a.W + 40, ease(t)), y = lerp(c.y - 10, ty, ease(t)) + Math.sin(t * 11 + i) * 5;
                    ctx.globalAlpha = 1 - Math.max(0, t - 0.88) * 8;
                    bat(ctx, x, y, ((a.frame >> 1) + i) % 2, '#1a0a24', 1.6 + t * 0.6);
                    ctx.fillStyle = 'rgba(110,40,150,0.45)';
                    ctx.fillRect(R(x - 14), R(y), 8, 1);
                    ctx.fillRect(R(x - 22), R(y + 1), 5, 1);
                    ctx.globalAlpha = 1;
                }
                for (const v of heroes(a)) { // 当たった人のまわりを、蝙蝠が回る（かわした人の頭上は通りすぎる）
                    const u = win(p, 0.44, 0.58) * (1 - win(p, 0.56, 0.62));
                    if (u <= 0 || v.ok)
                        continue;
                    for (let i = 0; i < 6; i++) {
                        const ang = a.frame / 4 + (i / 6) * TAU;
                        bat(ctx, v.x + Math.cos(ang) * 13, v.y - 14 + Math.sin(ang) * 7, (a.frame + i) % 2, '#1a0a24', 1.5);
                    }
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), '#c070ff', 0.25);
            }
        },
    },
    // 伸びる爪: 指先の五本の爪が、じわじわ血の色に伸びる → 滑るように踏みこんで、討伐隊ぜんたいを五本の大きな爪痕で引き裂く（竜のひっかきと同じ大きさの全体攻撃）。
    //   爪は動く体の手（motionAt）から伸ばすので、踏みこんでもずれない。爪痕が裂けきる山場は 0.42〜0.45（画面の揺れ・のけぞりと同じ）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const at = motionAt(a, 'vampire');
            const h = at(STYLE.vampire.hand[0], STYLE.vampire.hand[1]);
            const grow = ease(win(p, 0.1, 0.36)), reach = ease(win(p, 0.37, 0.42)), fade = 1 - win(p, 0.47, 0.56);
            if (grow > 0 && fade > 0) { // 五本の爪（付け根は指、先はとがって反る）
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 5; i++) {
                    const ang = -0.42 + i * 0.13 - reach * 0.2, L = (5 + 30 * grow) * (0.85 + 0.08 * (i % 3)) + 30 * reach, curl = 0.18 + 0.12 * grow; // 刃物のように細く、まっすぐ前へ（先だけ下へ反る）
                    const x0 = h.x + 1, y0 = h.y - 3 + i * 1.5, pts = [];
                    for (let j = 0; j <= 8; j++) {
                        const u = j / 8, an = ang + curl * u * u;
                        pts.push([x0 + Math.cos(an) * L * u, y0 + Math.sin(an) * L * u, lerp(1.5, 0.3, u)]);
                    }
                    band(ctx, pts, VAMP_NAIL);
                }
                ctx.restore();
                if (grow > 0.3 && p < 0.4)
                    for (let i = 0; i < 3; i++)
                        sparkle(ctx, h.x + 8 + 26 * grow + (hash(i, 2) - 0.5) * 10, h.y - 10 + i * 8, 1.5 + 2 * grow * (a.frame % 6 < 3 ? 1 : 0.5), '#ffd0da', grow);
            }
            // 討伐隊ぜんたいを裂く、五本の大きな爪痕（左上 → 右下。一本ずつ少し遅れて裂ける）
            const rip = win(p, RIP.vampire.a0, RIP.vampire.a1), gone = win(p, 0.48, 0.6);
            if (rip > 0 && gone < 1) {
                ctx.save();
                ctx.globalAlpha = 1 - gone;
                // 狙う人が受け止めたときは、受け止めた爪痕（右端）は、受け止めた高さで止まる
                const ff = focusFighter(a), stopY = ff?.ok ? ff.y + GUARD.dy + 2 : null;
                ripMarks(a.W, 'vampire', aimOf(a)).forEach(({ x0, y0, x1, y1, bow }, i) => {
                    const raw = clamp01(rip * RIP.vampire.sp - i * 0.12), stopT = stopY !== null && i >= RIP.vampire.aim ? clamp01((stopY - y0) / (y1 - y0)) : 1;
                    const t = Math.min(ease(raw), stopT), wdt = lerp(11, 4, gone) * (i === RIP.vampire.aim ? 1.15 : 1);
                    if (stopT < 1) { // 受け止められる爪痕は、はじめから受け止めた所までの一本として描く（太さは両端へなだらかに細る）
                        const hx = ripX({ x0, y0, x1, y1, bow }, stopY);
                        slashMark(ctx, x0, y0, hx, stopY, wdt, bow * stopT, clamp01(t / stopT), VAMP_RIP);
                    }
                    else
                        slashMark(ctx, x0, y0, x1, y1, wdt, bow, t, VAMP_RIP);
                    const held = t < ease(raw) - 1e-3; // 受け止められて止まった爪痕
                    if (t > 0 && raw < 1 && !held)
                        sparkle(ctx, lerp(x0, x1, t), lerp(y0, y1, t), 4, '#ffffff', 1); // 裂けていく先の閃き
                    if (held) { // 受け止めた所: 白い閃きを一瞬だけ出して、火花を散らす（丸い光を残さない）
                        const k = clamp01((raw - clamp01((stopY - y0) / (y1 - y0))) * 4), hx = ripX({ x0, y0, x1, y1, bow }, stopY);
                        if (k < 1) {
                            sparkle(ctx, hx, stopY, 5 * (1 - k), '#ffffff', 1 - k);
                            for (let j = 0; j < 5; j++) {
                                const an = -2.6 + j * 0.5, d = 3 + 10 * k;
                                ctx.fillStyle = j % 2 ? '#ffd0da' : '#ffffff';
                                ctx.globalAlpha = (1 - k) * (1 - gone);
                                ctx.fillRect(R(hx + Math.cos(an) * d), R(stopY + Math.sin(an) * d), 1, 1);
                            }
                            ctx.globalAlpha = 1 - gone;
                        }
                    }
                });
                ctx.restore();
                for (const v of heroes(a)) { // 当たった人: 血の色の火花が散る
                    if (v.ok)
                        continue;
                    const u = win(p, 0.42, 0.52);
                    if (u <= 0 || u >= 1)
                        continue;
                    const l = landing(v, -12);
                    for (let j = 0; j < 6; j++) {
                        const an = -2.4 + hash(j, v.f) * 2.2, d = 6 + 16 * u * (0.6 + hash(j, v.f + 1));
                        ctx.globalAlpha = 1 - u;
                        ctx.fillStyle = j % 2 ? '#ff5a6e' : '#ffd0da';
                        ctx.fillRect(R(l.x + Math.cos(an) * d), R(l.y + Math.sin(an) * d), 2, 2);
                    }
                    ctx.globalAlpha = 1;
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), '#ff3050', 0.28);
        },
    },
    // 急降下: 蝙蝠になって舞い上がり、伯爵の影（本物のシルエット）が蝙蝠の群れとともに落ちてくる
    dive: {
        back: fallingShadow,
        front(a) {
            const { ctx, phase: p } = a;
            const dark = win(p, 0.14, 0.4) * (1 - win(p, 0.46, 0.6));
            skyDark(ctx, a.W, a.H, dark, 'rgba(14,4,22,0.85)', 'rgba(14,4,22,0.35)', 'rgba(14,4,22,0.1)');
            if (dark > 0)
                for (let i = 0; i < 10; i++) { // 頭上を旋回する蝙蝠
                    const u = a.frame / 14 + i * 0.63, x = a.foot.x + 20 + Math.cos(u) * (50 + 10 * i), y = 26 + Math.sin(u * 1.3) * 12 + (i % 3) * 8;
                    ctx.globalAlpha = dark;
                    bat(ctx, x, y, (a.frame + i) % 2, '#0a0410', 1.2);
                    ctx.globalAlpha = 1;
                }
            // 真上から降ってくる伯爵（蝙蝠の群れをまとって）
            fallingBoss(a, 'vampire', '#ff5a7a', (x, y, k) => {
                for (let i = 0; i < 12; i++) {
                    const ang = a.frame / 8 + i * 0.52, rr = 34 + 10 * hash(i, 2);
                    bat(ctx, x + Math.cos(ang) * rr, y - 40 + Math.sin(ang) * rr * 0.4 - 70 * k * hash(i, 6), (a.frame + i) % 2, '#0a0410', 1.3);
                }
            });
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) { // 着弾: 蝙蝠が四方に散り、赤い衝撃の輪
                const at = diveSpot(a, 'vampire'), cx = at.x, cy = at.y + 4;
                ctx.save();
                ctx.strokeStyle = '#ff3050';
                ctx.lineWidth = 4 * (1 - b);
                ctx.globalAlpha = 1 - b;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 20 + b * 200, 6 + b * 54, 0, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#ffd0e0';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 10 + b * 150, 3 + b * 40, 0, 0, TAU);
                ctx.stroke();
                ctx.restore();
                for (let i = 0; i < 16; i++) {
                    const ang = hash(i) * TAU, sp = 30 + hash(i, 2) * 110;
                    ctx.globalAlpha = 1 - b;
                    bat(ctx, cx + Math.cos(ang) * sp * b, cy - 8 + Math.sin(ang) * sp * b * 0.6 - 30 * b, (a.frame + i) % 2, '#0a0410', 1.2);
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#ffd0e0', 0.4);
            }
        },
    },
    // 背後の霧: 足もとから霧が床を這って背後へ流れ、霧から蝙蝠が湧いて背後から襲う（竜の尾は出ない）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const flow = win(p, 0.12, 0.4) * (1 - win(p, 0.5, 0.62));
            if (flow > 0) { // 霧の川
                for (let i = 0; i < 4; i++)
                    puffs(ctx, a.foot.x + 10, 176 + i * 8, { n: 14, t: p * 2.2 + i * 0.2, dx: a.W - a.foot.x + 10, dy: 0, spread: 10, r0: 4, r1: 12, color: i % 2 ? '#3a1a52' : '#6a3a8a', alpha: 0.5 * flow, seed: 41 + i });
                mistBlob(ctx, lerp(a.foot.x + 30, a.W - 20, win(p, 0.14, 0.38)), 170, 26, 12, '#4a2a62', 0.55 * flow);
            }
            // 霧から蝙蝠が2匹ずつ、冒険者ひとりずつの背後（右）に湧き（0.28〜）、羽ばたいて間合いをはかり、背中へ襲いかかる。
            // 届く時刻は arrival.ts（0.415 + d）。正しく動けた人は振り向いて迎え撃ち（motionlab.ts の型。当てる先は背後 26 の所）、
            // 蝙蝠はその瞬間に打たれて、紫の煙と羽のかけらになって落ちる。動けなかった人は、背中に噛みつかれて赤い傷が走る
            for (const v of heroes(a)) {
                const d = hash(v.f, 3) * 0.03; // 少しずつずらす
                const t0 = 0.415 + d, come = ease(win(p, 0.28 + d, 0.36 + d)), go = win(p, t0 + 0.06, t0 + 0.14);
                if (come <= 0 || go >= 1)
                    continue;
                const hitC = { x: v.x + 26, y: v.y - 18 }; // 迎え撃つ所（型の当てる先）
                // 暗い背景（柱の陰）でも見えるよう、紫の縁どりと、うすい光をつけて描く
                const drawBat = (x, y, j, al) => {
                    const fl = ((a.frame >> 1) + j) % 2;
                    ctx.globalAlpha = al * 0.35;
                    ctx.fillStyle = '#9a50d0';
                    ctx.beginPath();
                    ctx.ellipse(R(x), R(y), 9, 6, 0, 0, TAU);
                    ctx.fill();
                    ctx.globalAlpha = al;
                    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
                        bat(ctx, x + ox, y + oy, fl, '#c890ff', 2);
                    bat(ctx, x, y, fl, '#12061c', 2);
                    ctx.globalAlpha = 1;
                };
                for (let j = 0; j < 2; j++) {
                    const sd = v.f * 2 + j, oy = j ? 6 : -6;
                    const home = { x: v.x + 46 + 6 * j, y: v.y - 22 + oy + 2 * j }; // 霧から出て、羽ばたいて待つ所
                    const tgt = { x: hitC.x + (j ? 3 : -1), y: hitC.y + oy * 0.6 };
                    const sw0 = win(p, t0 - 0.06 - 0.008 * j, t0), sw = sw0 * sw0; // 襲いかかる（だんだん速く）
                    let x = lerp(home.x, tgt.x, sw) + Math.sin(p * 40 + sd) * 2 * (1 - sw), y = lerp(home.y, tgt.y, sw) + Math.sin(p * 55 + sd * 2) * 2 * (1 - sw) - 6 * Math.sin(sw * Math.PI) * (j ? -1 : 1);
                    if (p < t0 && come < 1) {
                        x = lerp(home.x + 10, x, come);
                    }
                    const al = come;
                    if (v.ok) {
                        if (p < t0) {
                            drawBat(x, y, j, al);
                            continue;
                        }
                        // 打たれて砕ける: 白い光 → 紫の煙 → 羽のかけらが落ちる
                        const k = win(p, t0, t0 + 0.1);
                        if (k < 1) {
                            sparkle(ctx, tgt.x, tgt.y, 3 + 5 * (1 - k), '#ffffff', 1 - k);
                            puffs(ctx, tgt.x, tgt.y, { n: 6, t: k, dx: 6, dy: -6, spread: 10, r0: 2, r1: 6, color: '#6a3a8a', alpha: 0.8 * (1 - k), seed: 51 + sd });
                            ctx.fillStyle = '#c890ff';
                            ctx.globalAlpha = 1 - k;
                            for (let i = 0; i < 5; i++) {
                                const ang = hash(i, sd) * TAU;
                                ctx.fillRect(R(tgt.x + Math.cos(ang) * 9 * k), R(tgt.y + Math.sin(ang) * 5 * k + 18 * k * k), 2, 1);
                            }
                            ctx.globalAlpha = 1;
                        }
                    }
                    else {
                        // 背中まで届いて噛みつき、上へ飛び去る
                        const bite = { x: v.x + 3, y: v.y - 16 + oy * 0.5 };
                        const to = win(p, t0, t0 + 0.03), off = win(p, t0 + 0.05, t0 + 0.14);
                        if (p >= t0) {
                            x = lerp(lerp(tgt.x, bite.x, to), v.x + 60, off);
                            y = lerp(lerp(tgt.y, bite.y, to), v.y - 70, off);
                        }
                        drawBat(x, y, j, al * (1 - go));
                    }
                }
                if (!v.ok) {
                    const cut = win(p, t0 + 0.02, t0 + 0.06), fadeCut = 1 - win(p, t0 + 0.08, t0 + 0.16);
                    if (cut > 0 && fadeCut > 0) {
                        const l = landing(v, 0);
                        ctx.save();
                        ctx.globalAlpha = fadeCut;
                        slashMark(ctx, l.x + 10, l.y - 26, l.x - 2, l.y - 8, 4, 3, ease(cut), VAMP_RIP);
                        slashMark(ctx, l.x + 12, l.y - 18, l.x, l.y - 2, 4, 3, ease(win(cut, 0.3, 1)), VAMP_RIP);
                        ctx.restore();
                    }
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), '#c070ff', 0.2);
        },
    },
};
// ================= 大蜘蛛アラクネア =================
const spider = {
    // 糸: 空気中の糸が口に吸い込まれ、五本の白い糸が列ごとに飛んで、巣になって絡みつく
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const m = spriteToWorld(a.foot, STYLE.spider.mouth);
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.44) { // 細い糸が、まわりから口へ吸い寄せられる
                ctx.save();
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1;
                for (let i = 0; i < 16; i++) {
                    const ang = hash(i) * TAU, d0 = 26 + hash(i, 2) * 44, u = (gather * (0.7 + hash(i, 3)) + hash(i, 4)) % 1, d = d0 * (1 - u);
                    ctx.globalAlpha = u * 0.9;
                    ctx.beginPath();
                    ctx.moveTo(R(m.x + Math.cos(ang) * d), R(m.y + Math.sin(ang) * d * 0.7));
                    ctx.lineTo(R(m.x + Math.cos(ang) * (d + 8)), R(m.y + Math.sin(ang) * (d + 8) * 0.7));
                    ctx.stroke();
                }
                ctx.restore();
                glowAt(ctx, m.x, m.y, 4 + gather * 9, '#ffffff', '#9ad0ff', 0.7 * gather);
            }
            const rel = win(p, 0.38, 0.5), fade = 1 - win(p, 0.54, 0.62);
            if (rel > 0 && fade > 0) { // 白い糸が飛び、巣になる
                const hs = heroes(a);
                const targets = hs.length ? hs.map((v) => landing(v, -12)) : [{ x: a.W - 40, y: 150 }];
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1.5;
                targets.forEach((t, i) => {
                    const e = ease(win(rel, 0, 0.7)), x = lerp(m.x, t.x, e), y = lerp(m.y, t.y, e) - Math.sin(e * Math.PI) * 10;
                    ctx.beginPath();
                    ctx.moveTo(m.x, m.y);
                    ctx.quadraticCurveTo(lerp(m.x, x, 0.5), lerp(m.y, y, 0.5) + 8, x, y);
                    ctx.stroke();
                    webNet(ctx, t.x, t.y, 24, win(rel, 0.55, 1), '#f4f6ff');
                    sparkle(ctx, x, y, 2 + (i % 2), '#ffffff', 1 - win(rel, 0.7, 1));
                });
                ctx.restore();
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#d8e8ff', 0.2);
            }
        },
    },
    // 毒牙: 牙が大きく開いて毒がしたたり、飛びかかって噛みつく（二本の牙と毒のしぶき）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const m = spriteToWorld(a.foot, STYLE.spider.mouth);
            const open = ease(win(p, 0.1, 0.36)) * (1 - win(p, 0.5, 0.58));
            if (open > 0) { // 口もとの牙: 開いて、毒がしたたる
                fangShape(ctx, m.x - 2, m.y - 2, 6 + 7 * open, 3.4, Math.PI * 0.5 + 0.15 + (1 - open) * 0.3);
                fangShape(ctx, m.x + 4, m.y - 1, 6 + 7 * open, 3.4, Math.PI * 0.5 - 0.15 - (1 - open) * 0.3);
                ctx.fillStyle = '#7bed9f';
                for (let i = 0; i < 3; i++) {
                    const u = (p * 4 + i / 3) % 1;
                    ctx.globalAlpha = (1 - u) * open;
                    ctx.fillRect(R(m.x - 2 + i * 3), R(m.y + 10 + open * 4 + u * 12), 2, 3);
                }
                ctx.globalAlpha = 1;
            }
            for (const v of heroes(a)) { // 噛みつき: 上から二本の大きな牙が閉じる
                const k = win(p, 0.4, 0.47), fade = 1 - win(p, 0.5, 0.62);
                if (k <= 0 || fade <= 0)
                    continue;
                const l = v.ok ? { x: v.x + GUARD.dx - 4, y: v.y - 8 } : landing(v, -8), drop = ease(k), y0 = l.y - 54 + drop * 30; // 受け止めた人の前で閉じる
                ctx.save();
                ctx.globalAlpha = fade * (v.ok ? 0.5 : 1);
                fangShape(ctx, l.x - 7, y0 - 14, 22, 8, Math.PI / 2 + 0.12);
                fangShape(ctx, l.x + 7, y0 - 14, 22, 8, Math.PI / 2 - 0.12);
                ctx.fillStyle = '#7bed9f';
                for (let i = 0; i < 6; i++) {
                    const u = win(k, 0.5, 1) * (0.6 + hash(i));
                    ctx.fillRect(R(l.x - 12 + i * 5), R(l.y - 18 + u * 20), 2, 3);
                }
                ctx.restore();
                glowAt(ctx, l.x, l.y - 14, 14 * k, '#d8ffe0', '#3bd070', 0.5 * k * fade);
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#7bed9f', 0.2);
        },
    },
    // 落下: 天井へ糸を伝って登り、糸を引いて降ってくる（巣が広がる）
    dive: {
        back: fallingShadow,
        front(a) {
            const { ctx, phase: p } = a;
            const dark = win(p, 0.14, 0.4) * (1 - win(p, 0.46, 0.6));
            skyDark(ctx, a.W, a.H, dark * 0.7, 'rgba(8,6,16,0.8)', 'rgba(8,6,16,0.3)', 'rgba(8,6,16,0.05)');
            const at = diveSpot(a, 'spider'), cx = at.x;
            fallingBoss(a, 'spider', '#cfd8ee', (x, y) => { ctx.save(); ctx.strokeStyle = '#f4f6ff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(R(x), -10); ctx.lineTo(R(x), R(y - 50)); ctx.stroke(); ctx.restore(); }); // 天井からの糸を伝って降る
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) { // 着地: 巣が広がり、糸が四方へ
                ctx.save();
                ctx.globalAlpha = 1 - b;
                webNet(ctx, cx, at.y + 4, 20 + 120 * ease(win(b, 0, 0.6)), 1, '#f4f6ff');
                ctx.restore();
                puffs(ctx, cx, at.y + 2, { n: 10, t: b, dx: 0, dy: -20, spread: 100, r0: 2, r1: 6, color: '#cfd8ee', alpha: 0.6 * (1 - b), seed: 51 });
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#ffffff', 0.4);
            }
        },
    },
    // 脚の薙ぎはらい: 高くかかげた前脚2本（絵の脚）が、そのまま大鎌のように伸びて、床すれすれを前へ振り抜く。
    //   脚は動く体の付け根（motionAt）から描くので、踏みこんでもずれない。振るあいだは、絵の側の前脚を描かない（bossmotion.ts の hide）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            if (p < SPIDER_SWEEP.from || p >= SPIDER_SWEEP.to)
                return;
            const at = motionAt(a, 'spider');
            const hairs = [];
            // 奥の脚（2本目）を先に、手前の脚（1本目）をあとに
            for (const { leg, s, back, w } of spiderLegsAt({ ...a, aim: aimOf(a) }).reverse()) {
                const P = SPIDER_LEGS[leg];
                const big = lerp(1, 1.5, s) * (1 - 0.35 * back);
                const rr = [2.8, 2.2, 1.6, 0.5].map((r) => r * big * (leg ? 0.85 : 1));
                const pal = leg ? SPIDER_LEG_FAR : SPIDER_LEG_NEAR;
                // 振り抜いた跡（足先の通り道）
                if (s > 0.05 && s < 1 && back <= 0) {
                    const b0 = w[0], t0 = at(P.raise[3][0], P.raise[3][1]), tip = w[3];
                    const r0 = Math.hypot(tip.x - b0.x, (tip.y - b0.y)), a1 = Math.atan2(tip.y - b0.y, tip.x - b0.x), a0 = Math.atan2(t0.y - b0.y, t0.x - b0.x);
                    ctx.save();
                    ctx.globalAlpha = 0.85 * (1 - win(s, 0.85, 1));
                    sweepArc(ctx, b0.x, b0.y, r0 - 6, a0, a1, 1, 20 * (leg ? 0.7 : 1), 1, SPIDER_TRAIL, 0.9);
                    ctx.restore();
                }
                const pts3 = [];
                for (let i = 0; i < 3; i++)
                    for (let j = 0; j < 4; j++) {
                        const u = j / 4;
                        pts3.push([lerp(w[i].x, w[i + 1].x, u), lerp(w[i].y, w[i + 1].y, u), lerp(rr[i], rr[i + 1], u)]);
                    }
                pts3.push([w[3].x, w[3].y, rr[3]]);
                band(ctx, pts3, pal);
                // 関節の明るい帯と、背の毛
                ctx.fillStyle = pal.hi;
                for (let i = 1; i <= 2; i++) {
                    const q = w[i];
                    ctx.fillRect(R(q.x - 1), R(q.y - rr[i] - 1), 3, 2);
                }
                for (let i = 0; i < 2; i++)
                    for (let u = 0.25; u < 0.9; u += 0.25)
                        hairs.push([lerp(w[i].x, w[i + 1].x, u), lerp(w[i].y, w[i + 1].y, u) - rr[i] - 1.5]);
                // 足先のかぎ爪
                const ta = Math.atan2(w[3].y - w[2].y, w[3].x - w[2].x);
                ctx.strokeStyle = '#1a1014';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(R(w[3].x), R(w[3].y));
                ctx.lineTo(R(w[3].x + Math.cos(ta + 0.5) * 6), R(w[3].y + Math.sin(ta + 0.5) * 6));
                ctx.stroke();
                ctx.strokeStyle = '#d8c8b0';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(R(w[3].x), R(w[3].y));
                ctx.lineTo(R(w[3].x + Math.cos(ta + 0.5) * 5), R(w[3].y + Math.sin(ta + 0.5) * 5));
                ctx.stroke();
                // 足先が床をこする所の砂ぼこり
                if (s > 0.5 && back < 1)
                    puffs(ctx, w[3].x, Math.min(206, w[3].y + 2), { n: 6, t: p * 5 + leg, dx: -26, dy: -10, spread: 10, r0: 1.5, r1: 5, color: '#9a8aa8', alpha: 0.7 * (1 - back), seed: 53 + leg });
            }
            ctx.fillStyle = '#2a1a1c';
            for (const [x, y] of hairs)
                ctx.fillRect(R(x), R(y), 1, 2);
            // 振り抜いた瞬間（攻撃の山場 0.42〜0.45）: 床を走る衝撃と、白い閃き
            const hit = bump(p, 0.41, 0.47);
            if (hit > 0) {
                for (const v of heroes(a)) {
                    if (v.ok)
                        continue;
                    const l = landing(v, -10);
                    sparkle(ctx, l.x, l.y, 3 + 4 * hit, '#ffffff', hit);
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#e8e0ff', 0.18);
            }
        },
    },
};
// 大蜘蛛の前脚2本（絵 spider.ts の NEAR の 3本目・2本目）: [付け根, ひざ, 中関節, 足先]。かかげた形は spider.ts の RAISE と同じ
const SPIDER_LEGS = [
    { raise: [[70, 58], [80, 16], [93, 20], [92, 38]], strike: [[70, 58], [104, 30], [158, 46], [214, 80]], rest: [[70, 58], [88, 31], [94, 56], [93, 80]] },
    { raise: [[66, 60], [70, 12], [83, 8], [91, 20]], strike: [[66, 60], [96, 34], [146, 56], [196, 86]], rest: [[66, 60], [76, 33], [83, 60], [78, 80]] },
];
const SPIDER_LEG_NEAR = { line: '#1a1014', dark: '#3e2826', body: '#5a3a36', hi: '#86625a' };
const SPIDER_LEG_FAR = { line: '#140c10', dark: '#2a1a1a', body: '#3e2826', hi: '#5a3a36' };
const SPIDER_TRAIL = { line: '#2a1e3a', dark: '#6a5a8a', body: '#b4a6d8', hi: '#f4f0ff' };
/** 大蜘蛛の前脚2本の、その時刻の形（画面の座標の [付け根, ひざ, 中関節, 足先]）。描く（tail の front）と、届く時刻を調べる（arrival.ts）の両方で使う。
 *  leg 0 が手前の脚、1 が奥の脚 */
export function spiderLegsAt(a) {
    const p = a.phase, at = motionAt(a, 'spider'), lean = SPIDER_SWEEP.lean(p);
    // 振り抜いた脚の先が、狙う人（aimOf）の迎え撃つ所（MEET）の少し先の床に届くよう、振り抜いた形を付け根のまわりに回して伸ばす（振るほど強く）
    const fit = (leg, w, si) => {
        if (!a.aim)
            return w;
        const strike = spiderLegsAt({ ...a, aim: undefined, phase: 0.47 })[leg].w, b = strike[0], tip = strike[3];
        const T = { x: a.aim.x + SPIDER_REACH.dx - leg * 10, y: a.aim.y + SPIDER_REACH.dy - leg * 4 };
        const rot = Math.atan2(T.y - b.y, T.x - b.x) - Math.atan2(tip.y - b.y, tip.x - b.x), sc = Math.hypot(T.x - b.x, T.y - b.y) / Math.max(1, Math.hypot(tip.x - b.x, tip.y - b.y));
        const r = rot * si, k = 1 + (sc - 1) * si, c = Math.cos(r), sn = Math.sin(r), o = w[0];
        return w.map((q, i) => (i === 0 ? q : { x: o.x + ((q.x - o.x) * c - (q.y - o.y) * sn) * k, y: o.y + ((q.x - o.x) * sn + (q.y - o.y) * c) * k }));
    };
    return [0, 1].map((leg) => {
        const s = ease(win(p, 0.35 + leg * 0.02, 0.43 + leg * 0.02)), back = ease(win(p, 0.5, 0.58));
        const P = SPIDER_LEGS[leg];
        const ang = (q, i) => Math.atan2(q[i + 1][1] - q[i][1], q[i + 1][0] - q[i][0]);
        const len = (q, i) => Math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]);
        // 節ごとの角度と長さを、かかげた形 → 振り抜いた形 → もとの形 と移す（先は少し遅れてしなる）
        const pts = [[P.raise[0][0] + lean * 0.45, P.raise[0][1]]];
        for (let i = 0; i < 3; i++) {
            const si = clamp01(s * 1.15 - i * 0.06);
            let an = lerp(ang(P.raise, i), ang(P.strike, i), si), ln = lerp(len(P.raise, i), len(P.strike, i), si);
            an = lerp(an, ang(P.rest, i), back);
            ln = lerp(ln, len(P.rest, i), back);
            const [x, y] = pts[i];
            pts.push([x + Math.cos(an) * ln, y + Math.sin(an) * ln]);
        }
        return { leg, s, back, w: fit(leg, pts.map(([x, y]) => at(x, y)), s * (1 - back)) };
    });
}
/** 大蜘蛛の脚の先が届く所（狙う人の立ち位置からのずれ）。手前の脚。奥の脚は少し手前・上 */
export const SPIDER_REACH = { dx: -14, dy: -2 };
/** ゴブリンの突撃: 段ごとの先頭のゴブリンは lead − back − stag(段の番号) を走る。槍の先は体の reach 前（goblinSil の charge・大きさ 1.15） */
export const GOBLIN_CHARGE = { t0: 0.31, back: 20, reach: 21, stag: (j) => (j % 2) * 10 };
/** 突撃が走る段（冒険者の段。1人に寄る窓でも、討伐隊ぜんたいの段） */
export const goblinLanes = (a) => {
    const ls = a.lanes ?? [...new Set(heroes(a).map((v) => Math.round(v.y)))];
    return ls.length ? [...ls].sort((p, q) => p - q) : [156, 170, 184, 198];
};
// ================= ゴブリンの頭目ガルグ =================
const goblin = {
    // 矢の雨: 頭目が号令をかけ、空から矢がいっせいに降る（地面に刺さる）
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, STYLE.goblin.hand);
            const raise = win(p, 0.06, 0.34);
            if (raise > 0 && p < 0.44) { // 号令: 棍棒を掲げ、きらめき
                sparkle(ctx, h.x + 4, h.y - 10 - raise * 6, 3 + 3 * raise, '#fff2b0', raise);
                for (let i = 0; i < 3; i++) {
                    const u = fract2(p * 3 + i / 3);
                    ctx.save();
                    ctx.globalAlpha = (1 - u) * raise;
                    ctx.strokeStyle = '#fff2b0';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(h.x - 10, h.y + 12, 6 + u * 22, -1.0, 1.0);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            const rel = win(p, 0.34, 0.6);
            if (rel > 0) { // 矢が空から降る
                const hs = heroes(a);
                const n = 26;
                for (let i = 0; i < n; i++) {
                    const t = clamp01((rel - hash(i, 1) * 0.32) / 0.36);
                    if (t <= 0)
                        continue;
                    const v = hs.length ? hs[i % hs.length] : null;
                    const gx = (v ? (v.ok ? v.x + GUARD.dx - 4 : v.x) : a.W - 60) + (hash(i, 2) - 0.5) * 36, gy = (v ? v.y : 170) + (hash(i, 3) - 0.5) * 22; // 受け止めた人の前に刺さる
                    const e = Math.min(1, t * 1.2), x = lerp(gx - 34, gx, e), y = lerp(-20, gy - 6, e); // 左上（ゴブリンの陣）から右下へ
                    const stuck = t >= 0.83;
                    ctx.globalAlpha = stuck ? 1 - win(p, 0.56, 0.62) : 1;
                    arrow(ctx, stuck ? gx : x, stuck ? gy - 4 : y, Math.PI - 1.9, 14);
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.44, 0.48), '#ffe0a0', 0.18);
            }
        },
    },
    // 落とし穴: 頭目の踏みつけで床にひびが走り（0.3〜0.42）、冒険者ひとりずつの足もとが崩れて穴があき、とがった木の杭が突き上がる（山場 0.42〜0.46）。
    //   穴は 奥の壁（暗い土）→ 杭 → 手前のふち の順に描き、杭の根もとを手前のふちで隠す（穴の中から生えて見えるように）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const run = win(p, 0.3, 0.42);
            if (run > 0)
                crack(ctx, a.foot.x + 40, a.foot.y - 2, (a.W - a.foot.x) * 0.9, 0, 11, run, '#1a1008', '#ffd080', 2);
            for (const v of heroes(a)) {
                const open = ease(win(p, 0.4, 0.45)), fade = 1 - win(p, 0.56, 0.66);
                if (open <= 0 || fade <= 0)
                    continue;
                const l = landing(v, 2), rx = 4 + 12 * open, ry = 2 + 5 * open;
                ctx.save();
                ctx.globalAlpha = fade * (v.ok ? 0.6 : 1);
                // 穴: ふちの縁 → 土のふち → 中の暗がり → 奥の壁（上半分だけ明るい土）
                ctx.fillStyle = '#1a1008';
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y), rx + 3, ry + 2, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#7a5a34';
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y), rx + 2, ry + 1.5, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#0e0804';
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y), rx, ry, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#3a2614';
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y - ry * 0.35), rx * 0.92, ry * 0.55, 0, Math.PI, TAU);
                ctx.fill();
                // 杭（奥の列 → 手前の列。一本ずつ少し遅れて突き上がる）
                const up = win(p, 0.41, 0.46);
                for (let i = 0; i < 7; i++) {
                    const row = i < 3 ? 0 : 1, k = ease(clamp01(up * 1.5 - hash(i, v.f) * 0.4));
                    if (k <= 0)
                        continue;
                    const sx = l.x + (row ? (i - 5) * 5 : (i - 1) * 6) * open + (hash(i, 9) - 0.5) * 2, base = l.y + (row ? ry * 0.4 : -ry * 0.3);
                    const hgt = (row ? 12 : 9) * (0.8 + 0.4 * hash(i, 4)) * k, tilt = (hash(i, 5) - 0.5) * 0.5 + (sx - l.x) * 0.02;
                    stake(ctx, sx, base, hgt, row ? 3 : 2.5, tilt);
                }
                // 手前のふち（杭の根もとを隠す）と、ふちの照り
                ctx.fillStyle = '#1a1008';
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y), rx + 3, ry + 2, 0, 0.05, Math.PI - 0.05);
                ctx.ellipse(R(l.x), R(l.y + 1), rx - 1, ry * 0.7, 0, Math.PI - 0.05, 0.05, true);
                ctx.fill();
                ctx.fillStyle = '#7a5a34';
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y), rx + 2, ry + 1.5, 0, 0.1, Math.PI - 0.1);
                ctx.ellipse(R(l.x), R(l.y + 1), rx, ry * 0.75, 0, Math.PI - 0.1, 0.1, true);
                ctx.fill();
                ctx.fillStyle = '#c8a070';
                for (let j = -2; j <= 2; j++)
                    ctx.fillRect(R(l.x + j * rx * 0.36 - 1), R(l.y - ry - 1.5 + Math.abs(j) * ry * 0.18), 3, 1);
                ctx.restore();
                // 崩れた土くれが跳ねる
                const dirt = win(p, 0.4, 0.54);
                if (dirt > 0 && dirt < 1)
                    for (let j = 0; j < 7; j++) {
                        const an = Math.PI * (1.1 + hash(j, v.f) * 0.8), sp = 10 + hash(j, v.f + 2) * 22;
                        ctx.globalAlpha = (1 - dirt) * fade;
                        rock(ctx, l.x + Math.cos(an) * sp * dirt, l.y + Math.sin(an) * sp * dirt + 50 * dirt * dirt, 1.5 + hash(j, 3) * 1.5, j, j, '#7a5a34', '#c8a070', '#2a1808');
                        ctx.globalAlpha = 1;
                    }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#ffd080', 0.18);
        },
    },
    // 投石: 抱えた大岩を山なりに投げる（岩は回りながら飛び、砕けて砂ぼこり）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, [66, 6]);
            const at = aimOf(a), tx = at.x, ty = at.y - 4; // 狙う人（aimOf）の足もとに落ちる
            const k = win(p, 0.34, 0.44);
            if (k > 0 && k < 1) { // 山なりの軌道
                const x = lerp(h.x, tx, k), y = lerp(h.y, ty, k) - Math.sin(k * Math.PI) * 120, r = 9; // 大きさは変えない（ふくらんで見えないように）
                for (let i = 1; i <= 4; i++) {
                    const u = k - i * 0.04;
                    if (u <= 0)
                        continue;
                    puffs(ctx, lerp(h.x, tx, u), lerp(h.y, ty, u) - Math.sin(u * Math.PI) * 120, { n: 2, t: u * 3 + i, dx: 0, dy: -4, spread: 6, r0: 1.5, r1: 3, color: '#a89a80', alpha: 0.5 / i, seed: 60 + i });
                } // 土ぼこりの尾
                ctx.globalAlpha = 1;
                drawBoulder(ctx, x, y, r, k * 9, 3); // 回りながら飛ぶ大岩（大きさは変えない）
                ctx.fillStyle = `rgba(0,0,0,${0.25 * k})`;
                ctx.beginPath();
                ctx.ellipse(tx, ty + 6, 6 + 16 * k, 2 + 5 * k, 0, 0, TAU);
                ctx.fill(); // 落ちる影
            }
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) {
                dustRing(ctx, tx, ty + 6, b, 100);
                for (let i = 0; i < 12; i++) {
                    const ang = Math.PI * (1.05 + hash(i) * 0.9), sp = 30 + hash(i, 2) * 90;
                    drawBoulder(ctx, tx + Math.cos(ang) * sp * b, ty + Math.sin(ang) * sp * b + 140 * b * b, 2 + hash(i, 3) * 3, i + b * 6, i, 1 - b);
                } // 砕けた岩のかけら
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#ffffff', 0.3);
            }
        },
    },
    // 突進: 頭目とゴブリンの群れが、槍をかまえて床を駆けぬける（砂ぼこり）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const run = win(p, GOBLIN_CHARGE.t0, GOBLIN_CHARGE.t0 + 0.22), fade = 1 - win(p, 0.53, 0.61);
            if (run > 0 && fade > 0) {
                const lead = lerp(a.foot.x + 10, a.W + 80, ease(run));
                const lanes = goblinLanes(a);
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 9; i++) {
                    const j = i % lanes.length, x = lead - GOBLIN_CHARGE.back - GOBLIN_CHARGE.stag(j) - Math.floor(i / lanes.length) * 26, y = lanes[j] + 1; // 冒険者の段ごとに、先頭のゴブリンが走る（槍の先が受け止める所 GUARD に届く）
                    if (x < a.foot.x - 10)
                        continue;
                    goblinSil(ctx, x, y, 1.15, a.frame / 2 + i, undefined, undefined, true); // 槍を前（右）へ構えて駆ける
                    puffs(ctx, x - 6, y - 1, { n: 4, t: p * 5 + i, dx: -16, dy: -5, spread: 6, r0: 2, r1: 5, color: '#c8b48a', alpha: 0.6, seed: 61 + i });
                }
                ctx.restore();
                puffs(ctx, lead - 30, 190, { n: 10, t: p * 4, dx: -60, dy: -8, spread: 20, r0: 3, r1: 9, color: '#b8a37a', alpha: 0.6 * fade, seed: 59 });
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#ffffff', 0.18);
            }
        },
    },
};
/** とがった木の杭（根もと (x,y) から上へ h。縁・影・地・照り・とがった先の白木） */
function stake(ctx, x, y, h, w, tilt) {
    if (h < 1)
        return;
    ctx.save();
    ctx.translate(R(x), R(y));
    ctx.rotate(tilt);
    const tip = Math.min(h * 0.45, 6);
    const shape = (ww, hh) => { ctx.beginPath(); ctx.moveTo(-ww, 1); ctx.lineTo(-ww, -hh + tip); ctx.lineTo(0, -hh); ctx.lineTo(ww, -hh + tip); ctx.lineTo(ww, 1); ctx.closePath(); };
    ctx.fillStyle = '#2a1808';
    shape(w + 1, h + 1.2);
    ctx.fill();
    ctx.fillStyle = '#6a4424';
    shape(w, h);
    ctx.fill();
    ctx.fillStyle = '#9a6a3a';
    ctx.fillRect(-w, -h + tip, w, h - tip + 1); // 光の当たる左半分
    ctx.fillStyle = '#d8a868';
    ctx.fillRect(-w, -h + tip, 1, h - tip + 1); // 照り
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.moveTo(-w, -h + tip);
    ctx.lineTo(0, -h);
    ctx.lineTo(0, -h + tip);
    ctx.closePath();
    ctx.fill(); // 削った先の白木
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(-w, -h * 0.45, w * 2, 1); // 縄の巻き
    ctx.restore();
}
function fract2(x) { return x - Math.floor(x); }
// ================= 大王クラーケン =================
/** 触手の中心線: 付け根 (bx,by) から、角度 ang・長さ len・反り bend の曲線上の点 */
function tentaclePts(bx, by, ang, len, bend, n = 12) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const u = i / n, a = ang + bend * u * u;
        pts.push([bx + Math.cos(a) * len * u, by + Math.sin(a) * len * u * 0.9 + Math.sin(u * 5) * 3]);
    }
    return pts;
}
/** 突き上げで、跳んでかわした人の下に伸びる触手の高さ（いちばん長くて ×1.2。跳ぶ型の足は、当たる瞬間にこれより上にある） */
export const KRAKEN_UNDER = 18;
/** 墨の噴射で、伏せた人の頭の上を通る所（立ち位置からのずれ） */
export const INK_OVER = { dx: 10, dy: -30 };
const kraken = {
    // 墨: 漏斗に水が吸いこまれ、黒い墨が列ごとに噴きつける（しぶきと墨だまり）
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const f = spriteToWorld(a.foot, STYLE.kraken.mouth);
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.44) { // 泡と水が漏斗に集まる
                for (let i = 0; i < 14; i++) {
                    const ang = hash(i) * TAU, d0 = 20 + hash(i, 2) * 40, u = (gather * (0.7 + hash(i, 3)) + hash(i, 4)) % 1, d = d0 * (1 - u);
                    ctx.globalAlpha = u;
                    ctx.strokeStyle = '#d8f2ff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(R(f.x + Math.cos(ang) * d), R(f.y + Math.sin(ang) * d * 0.7), 1 + (i % 3), 0, TAU);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                glowAt(ctx, f.x, f.y, 3 + gather * 6, '#6a4aa0', '#1a0a2a', 0.8 * gather);
            }
            const rel = win(p, 0.38, 0.5), fade = 1 - win(p, 0.54, 0.62);
            if (rel > 0 && fade > 0) { // 黒い墨の奔流
                const hs = heroes(a);
                // 伏せた人の上は頭の高さを通りすぎ、うしろの床に落ちる（当たった人には、胸に噴きつける）
                const ts = hs.length ? hs.map((v) => (v.ok ? { x: v.x + INK_OVER.dx, y: v.y + INK_OVER.dy, fy: v.y } : { ...landing(v, -12), fy: v.y })) : [{ x: a.W - 40, y: 150, fy: 162 }];
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.lineCap = 'round';
                ts.forEach((t, i) => {
                    const e = ease(win(rel, 0, 0.7)), ex = lerp(f.x, t.x, e), ey = lerp(f.y, t.y, e) - Math.sin(e * Math.PI) * 14;
                    ctx.strokeStyle = '#120a22';
                    ctx.lineWidth = 7 - (i % 2) * 2;
                    ctx.beginPath();
                    ctx.moveTo(f.x, f.y);
                    ctx.quadraticCurveTo(lerp(f.x, ex, 0.5), lerp(f.y, ey, 0.5) - 14, ex, ey);
                    ctx.stroke();
                    ctx.strokeStyle = '#3a1a5a';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.fillStyle = '#120a22';
                    ctx.beginPath();
                    ctx.ellipse(t.x, t.fy - 2, 4 + 16 * win(rel, 0.5, 1), 2 + 5 * win(rel, 0.5, 1), 0, 0, TAU);
                    ctx.fill(); // 墨だまり
                    for (let j = 0; j < 5; j++) {
                        const u = (rel * 2 + j / 5) % 1;
                        ctx.fillStyle = '#3a1a5a';
                        ctx.fillRect(R(lerp(f.x, t.x, u) + (hash(j, i) - 0.5) * 10), R(lerp(f.y, t.y, u) - Math.sin(u * Math.PI) * 14 + (hash(j, i + 3) - 0.5) * 8), 2, 2);
                    }
                });
                ctx.restore();
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#3a1a5a', 0.3);
            }
        },
    },
    // 触手の薙ぎ: ボスの体の後ろの海から巨大な触手が立ちあがり、高くしなって、床すれすれを横ざまに薙ぎはらう（吸盤・水しぶき）。
    //   触手は、体の後ろ（奥の層 back。ボスと冒険者より奥）に描く。付け根は体に隠れるので、顔の前から生えて見えない。
    //   床を払う水しぶきは、手前の層（front）に描く
    claw: {
        back(a) { krakenSweep(a, 'back'); },
        front(a) { krakenSweep(a, 'front'); },
    },
    // 突き上げ: 床に波紋が広がり、足もとから触手が一斉に突き上がる（水柱）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const warn = win(p, 0.16, 0.38) * (1 - win(p, 0.42, 0.5));
            for (const v of heroes(a)) {
                const l = landing(v, 4);
                if (warn > 0) {
                    ctx.save();
                    ctx.strokeStyle = '#bfe8ff';
                    ctx.lineWidth = 1.5;
                    for (let i = 0; i < 2; i++) {
                        const u = (p * 4 + i / 2) % 1;
                        ctx.globalAlpha = (1 - u) * warn;
                        ctx.beginPath();
                        ctx.ellipse(l.x, l.y, 4 + u * 16, 1.5 + u * 6, 0, 0, TAU);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                const k = win(p, 0.38, 0.46), fade = 1 - win(p, 0.5, 0.62);
                if (k > 0 && fade > 0) {
                    // 跳んでかわした人の下では、足の下までしか伸びず、すぐ引っこむ（跳んだ体を突きぬけて見えないように）
                    const e = ease(k), hgt = (v.ok ? KRAKEN_UNDER * (1 - win(p, 0.46, 0.52)) : 78) * e * (0.8 + 0.4 * hash(v.f));
                    ctx.save();
                    ctx.globalAlpha = fade * (v.ok ? 0.8 : 1);
                    const pts = [];
                    for (let i = 0; i <= 10; i++) {
                        const u = i / 10;
                        pts.push([l.x + Math.sin(u * 4 + v.f) * 6 * u, l.y - hgt * u]);
                    }
                    tentacleDraw(ctx, pts, 11, 3.5);
                    ctx.restore();
                    puffs(ctx, l.x, l.y - 6, { n: 8, t: k, dx: 0, dy: -30, spread: 24, r0: 1.5, r1: 3.5, color: '#d8f2ff', alpha: 0.8 * fade, seed: 73 });
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.38, 0.43), '#bfe8ff', 0.25);
        },
    },
    // 巻き取り: 触手が床を這って冒険者に巻きつき、引きよせる。
    //   這う触手は奥の層（back。冒険者より奥）に描き、冒険者の動きを隠さない。手前（front）には、足首に巻きつく細い輪だけを描く
    tail: {
        back(a) {
            const { ctx, phase: p } = a;
            const base = { x: a.foot.x + 54, y: a.foot.y - 8 };
            const reach = ease(win(p, 0.16, 0.4)), coil = ease(win(p, 0.38, 0.5)), fade = 1 - win(p, 0.52, 0.62);
            if (reach <= 0 || fade <= 0)
                return;
            ctx.save();
            ctx.globalAlpha = fade;
            for (const v of heroes(a)) {
                const l = v.ok ? { x: v.x + MEET.dx + 4, y: v.y + MEET.dy + 6 } : landing(v, 2), pts = []; // 迎え撃つ人には、斬られる所（MEET）まで這い上がる
                for (let i = 0; i <= 14; i++) {
                    const u = i / 14 * reach;
                    pts.push([lerp(base.x, l.x, u), lerp(base.y, l.y, u) + Math.sin(u * 9 + v.f + p * 12) * 4 * (1 - coil * 0.6)]);
                }
                tentacleDraw(ctx, pts, 6, 3);
            }
            ctx.restore();
            puffs(ctx, base.x + 60, a.foot.y - 2, { n: 8, t: p * 2, dx: 100, dy: -4, spread: 10, r0: 2, r1: 4, color: '#d8f2ff', alpha: 0.5 * fade * coil, seed: 75 });
        },
        front(a) {
            const { ctx, phase: p } = a;
            const coil = ease(win(p, 0.38, 0.5)), fade = 1 - win(p, 0.52, 0.62);
            if (coil > 0 && fade > 0)
                for (const v of heroes(a)) {
                    if (v.ok)
                        continue;
                    const l = landing(v, 2);
                    ctx.save();
                    ctx.globalAlpha = fade;
                    ctx.lineWidth = 2;
                    for (let j = 0; j < 2; j++) { // 足首に巻きつく（前の半分だけ。体は隠さない）
                        const yy = l.y - 1 - j * 4 * coil;
                        ctx.strokeStyle = '#3e1230';
                        ctx.beginPath();
                        ctx.ellipse(R(l.x), R(yy + 1), 7, 2.5, 0.15, 0.1, Math.PI - 0.1);
                        ctx.stroke();
                        ctx.strokeStyle = '#a8487e';
                        ctx.beginPath();
                        ctx.ellipse(R(l.x), R(yy), 7, 2.5, 0.15, 0.1, Math.PI - 0.1);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#bfe8ff', 0.15);
        },
    },
};
/** クラーケンの触手の薙ぎの、触手の形（中心線の点と太さ）。s: 振り抜きの進み・b: もどりの進み。描く（krakenSweep）と、届く時刻を調べる（arrival.ts）の両方で使う */
export function krakenArmShape(a, s, b, end) {
    const floor = Math.max(a.foot.y + 34, (a.aim?.y ?? 0) + 1); // 床の手前の端（狙う人の足もとまでは、薙ぎはらう）
    const p = a.phase, root = spriteToWorld(a.foot, [70, 74]), rise = ease(win(p, 0.08, 0.3));
    // 触手の形: 付け根の角度 ang・長さ len・先の巻き curl
    const sway = Math.sin(p * 40) * 0.08 * (1 - s);
    const ang = lerp(lerp(-1.25, -1.62, rise) + sway, end ?? (a.aim ? krakenSweepEnd(a.foot, a.aim) : 0.2), s), len = lerp(lerp(20, 120, rise), a.aim ? Math.max(240, Math.hypot(a.aim.x - root.x, a.aim.y - root.y) * 1.15) : 240, Math.sin(s * Math.PI * 0.5)) * (1 - 0.85 * b); // 遠い人にも届く長さ
    const curl = lerp(-1.6, 0.35, s);
    const pts = [];
    const n = 18;
    let x = root.x, y = root.y;
    for (let i = 0; i <= n; i++) {
        const u = i / n;
        pts.push([x, y + Math.sin(u * 7 - p * 26) * 5 * s * u, lerp(8, 1.4, Math.pow(u, 0.9))]); // 振り抜いた触手は、波打ってしなる
        const an = ang + curl * u * u - (1 - s) * 0.3 * u;
        x += Math.cos(an) * (len / n);
        y += Math.sin(an) * (len / n) * (s > 0 ? lerp(1, 0.5, s) : 1);
        if (y > floor)
            y = floor; // 床より前へは出ない
    }
    return pts;
}
/** 触手を振り抜いた最後の向き: ふだんは 0.2。狙う人（aimOf）の足もとがその下になるときは、足もとを払う所まで振り下ろす */
const SWEEP_END = new Map();
function krakenSweepEnd(foot, aim) {
    const key = `${foot.x},${foot.y},${Math.round(aim.x)},${Math.round(aim.y)}`;
    let e = SWEEP_END.get(key);
    if (e === undefined) {
        e = 0.2;
        for (let g = 0.2; g <= 1.4; g += 0.05) {
            const pts = krakenArmShape({ foot, phase: 0.47, aim }, 1, 0, g);
            if (pts.some(([x, y], i) => i && Math.hypot(x - aim.x, y - aim.y + 2) <= 8 || (i && segNear(pts[i - 1], [x, y], aim.x, aim.y - 2) <= 8))) {
                e = g;
                break;
            }
        }
        SWEEP_END.set(key, e);
    }
    return e;
}
const segNear = (a, b, px, py) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = clamp01(((px - a[0]) * dx + (py - a[1]) * dy) / l2); return Math.hypot(a[0] + dx * t - px, a[1] + dy * t - py); };
/** クラーケンの触手の薙ぎの進み（krakenSweep と同じ） */
export const krakenSweepK = (p) => ({ rise: ease(win(p, 0.08, 0.3)), sw: ease(win(p, 0.35, 0.44)), back: ease(win(p, 0.5, 0.62)) });
/** クラーケンの触手の薙ぎ（奥の層: 触手と振り抜いた跡 / 手前の層: 水しぶき・閃光） */
function krakenSweep(a, layer) {
    const { ctx, phase: p } = a;
    const root = spriteToWorld(a.foot, [70, 74]); // 体の右うしろの海の中（手前の波に隠れる）
    const rise = ease(win(p, 0.08, 0.3)), sw = ease(win(p, 0.35, 0.44)), back = ease(win(p, 0.5, 0.62));
    if (rise <= 0 || back >= 1)
        return;
    const shape = (s, b) => krakenArmShape({ ...a, aim: aimOf(a) }, s, b);
    const pts = shape(sw, back);
    if (layer === 'back') {
        // 振り抜いた跡（水の弧）
        if (sw > 0.05 && sw < 1 && back <= 0) {
            for (let j = 6; j >= 1; j--) {
                const g = shape(Math.max(0, sw - j * 0.06), 0), q = g[g.length - 1], q2 = shape(Math.max(0, sw - (j - 1) * 0.06), 0);
                const t2 = q2[q2.length - 1];
                ctx.save();
                ctx.globalAlpha = 0.6 * (1 - j / 7);
                ctx.strokeStyle = '#d8f2ff';
                ctx.lineWidth = 2 + 6 * (1 - j / 7);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(q[0], q[1]);
                ctx.lineTo(t2[0], t2[1]);
                ctx.stroke();
                ctx.restore();
            }
        }
        band(ctx, pts, KRAKEN_ARM);
        // 吸盤（下側に、縁の暗い輪と明るい中）
        for (let i = 2; i < pts.length - 2; i += 2) {
            const [x, y, r] = pts[i], [nx, ny] = pts[i + 1];
            const an = Math.atan2(ny - y, nx - x) + Math.PI / 2, d = r * 0.55;
            const sx = x + Math.cos(an) * d, sy = y + Math.sin(an) * d, sr = Math.max(1, r * 0.32);
            ctx.fillStyle = '#5e1a48';
            ctx.beginPath();
            ctx.arc(R(sx), R(sy), sr + 0.8, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#f4c8dc';
            ctx.beginPath();
            ctx.arc(R(sx), R(sy), sr, 0, TAU);
            ctx.fill();
        }
        return;
    }
    // 付け根の海面のしぶき（体の右の海面）
    puffs(ctx, root.x + 16, a.foot.y - 8, { n: 8, t: p * 3, dx: 0, dy: -18, spread: 22, r0: 1, r1: 3.5, color: '#d8f2ff', alpha: 0.8 * rise * (1 - back), seed: 70 });
    // 床を払う水しぶき（山場 0.42）
    if (sw > 0.6 && back < 1) {
        const tip = pts[pts.length - 1];
        puffs(ctx, tip[0], Math.min(206, tip[1]), { n: 10, t: p * 4, dx: 20, dy: -26, spread: 26, r0: 1.5, r1: 4, color: '#d8f2ff', alpha: 0.9 * (1 - back), seed: 71 });
        for (const v of heroes(a)) {
            if (v.ok)
                continue;
            const l = landing(v, -6);
            puffs(ctx, l.x, l.y, { n: 6, t: win(p, 0.42, 0.52), dx: 10, dy: -20, spread: 14, r0: 1.5, r1: 3.5, color: '#bfe8ff', alpha: bump(p, 0.41, 0.52), seed: 72 + v.f });
        }
    }
    screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#bfe8ff', 0.18);
}
const KRAKEN_ARM = { line: '#2a0a20', dark: '#5e1a48', body: '#8a2a6a', hi: '#c86a9e' };
function tentacleDraw(ctx, pts, w0, w1) { tentacle(ctx, pts, w0, w1, '#8a2a6a', '#3e1230', '#f4c8dc'); }
// ================= 守護巨人ゴルドム =================
const golem = {
    // 石礫の嵐: まわりの小石が浮かびあがり、岩が列ごとに飛んでいく
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const hnd = spriteToWorld(a.foot, [70, 36]);
            const gather = win(p, 0.06, 0.38);
            if (gather > 0 && p < 0.44) { // 地面の小石が浮かぶ
                for (let i = 0; i < 12; i++) {
                    const x = a.foot.x + 10 + hash(i) * 90, base = a.foot.y - 2;
                    rock(ctx, x, base - gather * (10 + hash(i, 2) * 40) - Math.sin(p * 20 + i) * 2, 1.5 + hash(i, 3) * 2.5, p * 6 + i, i, '#7a6a52', '#a8987a', '#3a2a1a');
                }
                puffs(ctx, a.foot.x + 50, a.foot.y - 2, { n: 8, t: p * 2, dx: 0, dy: -12, spread: 80, r0: 2, r1: 5, color: '#a8987a', alpha: 0.55 * gather, seed: 81 });
            }
            const rel = win(p, 0.36, 0.56), fade = 1 - win(p, 0.56, 0.62);
            if (rel > 0 && fade > 0) { // 岩が山なりに飛ぶ
                const hs = heroes(a), n = Math.max(6, hs.length * 2);
                for (let i = 0; i < n; i++) {
                    const t = clamp01((rel - hash(i, 1) * 0.25) / 0.45);
                    if (t <= 0 || t >= 1)
                        continue;
                    const v = hs.length ? hs[i % hs.length] : null, tx = (v ? (v.ok ? v.x + GUARD.dx - 4 : v.x) : a.W - 50) + (hash(i, 2) - 0.5) * 12, ty = (v ? v.y : 170) - 6; // 受け止めた人の前で砕ける
                    const x = lerp(hnd.x, tx, t), y = lerp(hnd.y, ty, t) - Math.sin(t * Math.PI) * 60;
                    ctx.globalAlpha = fade;
                    rock(ctx, x, y, 4 + 4 * hash(i, 4), a.frame / 3 + i, i, '#8a7a62', '#b8a888', '#3a2a1a');
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.44, 0.48), '#d8ccb0', 0.18);
            }
        },
    },
    // 拳の叩きつけ: 空中に岩の拳（#105 の召喚「岩の拳」と同じ部品 pixart.ts の drawRockFist）があらわれ、冒険者ひとりずつの真上から叩きつける。
    //   0.28〜 床に影 → 0.34〜0.43 だんだん速く落ちる（刻印の亀裂が光る）→ 0.43 着弾（土ぼこり・ひび・岩のかけら）→ 0.5〜0.6 浮き上がって消える
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            for (const v of heroes(a)) {
                const l = landing(v, 2), d = hash(v.f, 7) * 0.02;
                const warn = win(p, 0.28, 0.42), k = win(p, 0.34 + d, 0.43 + d), lift = ease(win(p, 0.5, 0.6));
                if (warn <= 0 || lift >= 1)
                    continue;
                const fall = k * k, al = (v.ok ? 0.65 : 1) * (1 - lift);
                // 床の影（2段）
                ctx.save();
                ctx.fillStyle = '#05040a';
                ctx.globalAlpha = (0.2 + 0.35 * warn) * (1 - lift);
                ctx.beginPath();
                ctx.ellipse(R(l.x), R(l.y), 6 + 8 * warn, 2 + 3 * warn, 0, 0, TAU);
                ctx.fill();
                ctx.restore();
                if (k <= 0)
                    continue;
                const y = k < 1 ? lerp(l.y - 150, l.y - 2, fall) : l.y - 2 - 40 * lift;
                if (k < 1 && k > 0.3)
                    for (let i = 0; i < 4; i++) {
                        ctx.globalAlpha = 0.6 * al;
                        ctx.fillStyle = i % 2 ? '#ffffff' : '#c8b48a';
                        ctx.fillRect(R(l.x - 10 + i * 6), R(y - 60 - 30 * fall), 1, R(24 * fall));
                    } // 風を切る線
                ctx.globalAlpha = 1;
                drawRockFist(ctx, l.x, y, { s: 1, arm: 0.4, rot: Math.PI, pal: ROCK, vein: '#30d0c0', glow: 0.4 + 0.6 * k, alpha: al, flip: v.f % 2 === 1 });
                const b = win(p, 0.43 + d, 0.58);
                if (b > 0 && b < 1) {
                    dustRing(ctx, l.x, l.y, b, 40);
                    for (let c = 0; c < 3; c++)
                        crack(ctx, l.x, l.y, 24, -0.6 + c * 0.6, c + v.f, ease(win(b, 0, 0.4)), '#1a1008', '#30d0c0', 1.5);
                    for (let j = 0; j < 5; j++) {
                        const an = Math.PI * (1.1 + hash(j, v.f) * 0.8), sp = 10 + hash(j, v.f + 3) * 24;
                        drawBoulder(ctx, l.x + Math.cos(an) * sp * b, l.y + Math.sin(an) * sp * b + 50 * b * b, 1.5 + hash(j, 4) * 2, j + b * 8, j, 1 - b);
                    }
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.47), '#d8ccb0', 0.3);
        },
    },
    // 地割れ: 足もとから光る割れ目が走り、岩のかけらが噴きあがる
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            // 地割れは、巨人が跳び上がって着地した瞬間（0.42〜0.44。bossmotion.ts の dive）から走らせる
            // 割れ目は冒険者の段ごとに1本ずつ、足もとの下を走る（段へ斜めに下りてから、段にそって右へ。arrival.ts も同じ道で届く時刻を出す）
            const run = ease(win(p, 0.42, 0.5)), fade = 1 - win(p, 0.58, 0.7);
            if (run > 0 && fade > 0) {
                ctx.save();
                ctx.globalAlpha = fade;
                goblinLanes(a).forEach((ly, i) => { const path = golemCrackPath(a, ly, i); laneCrack(ctx, path, run, '#140c06', '#30d0c0', 2.4 - (i % 3) * 0.3); const tip = pathAt(path, run); puffs(ctx, tip.x, tip.y - 2, { n: 5, t: p * 3 + i, dx: -30, dy: -16, spread: 10, r0: 2, r1: 5, color: '#c8b48a', alpha: 0.7 * fade, seed: 83 + i }); });
                ctx.restore();
            }
            const b = win(p, 0.46, 0.62); // 割れ目が届いてから
            if (b > 0 && b < 1) {
                for (const v of heroes(a)) { // 割れ目から岩が噴きあがる
                    for (let i = 0; i < 5; i++) {
                        const sp = 24 + hash(i, v.f) * 46, ang = -Math.PI / 2 + (hash(i, v.f + 3) - 0.5) * 1.2;
                        ctx.globalAlpha = (1 - b) * (v.ok ? 0.5 : 1);
                        rock(ctx, v.x + Math.cos(ang) * sp * b, v.y - 4 + Math.sin(ang) * sp * b + 80 * b * b, 2 + hash(i, 5) * 3, i + b * 8, i, '#7a6a52', '#a8987a', '#3a2a1a');
                        ctx.globalAlpha = 1;
                    }
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#c0fff0', 0.3); // 着地の瞬間
        },
    },
    // 腕の薙ぎ払い: 石の腕が、討伐隊ぜんたいを包む大きな弧をえがいて床を払う（岩の帯・砕けた石・砂ぼこり）。
    //   弧の先が討伐隊のまん中を通るのが山場（0.42〜0.44。画面の揺れ・のけぞりと同じ）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            giantSweep(a, spriteToWorld(a.foot, [58, 44]), SWEEP_AT.golem, GOLEM_ARC, (x, y, i) => rock(ctx, x, y, 2 + hash(i, 3) * 3.5, i + p * 20, i, '#8a7a62', '#c8b898', '#2a1e12'), '#c8b48a', '#d8ccb0');
        },
    },
};
/** 地割れの道（段 ly ごと）: 着地した足もとから、討伐隊の前（x=150）で段の高さへ下りて、段にそって右の端まで */
export function golemCrackPath(a, ly, seed) {
    const x0 = a.foot.x + 44, y0 = a.foot.y - 4, pts = [{ x: x0, y: y0 }];
    const n = 14;
    for (let i = 1; i <= n; i++) {
        const x = lerp(x0, a.W + 10, i / n), k = clamp01((x - x0) / Math.max(1, 150 - x0));
        pts.push({ x, y: lerp(y0, ly + 1, ease(k)) + (i < n ? (hash(i, seed + 7) - 0.5) * 3 : 0) });
    }
    return pts;
}
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
/** 折れ線の地割れを、長さの割合 k まで描く（光る縁つき） */
function laneCrack(ctx, pts, k, col, glow, w) {
    const tip = pathAt(pts, k), L = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
    const draw = (c, lw) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(R(pts[0].x), R(pts[0].y));
        let d = 0;
        for (let i = 1; i < pts.length; i++) {
            d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (d > k * L)
                break;
            ctx.lineTo(R(pts[i].x), R(pts[i].y));
        }
        ctx.lineTo(R(tip.x), R(tip.y));
        ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    draw(glow, w + 3);
    ctx.globalCompositeOperation = 'source-over';
    draw(col, w);
    ctx.restore();
}
// ================= 氷巨人グラシエル =================
/** 踏みつけの衝撃の輪が、x に届く時刻（arrival.ts） */
export const giantStompAt = (a, x) => 0.4 + 0.2 * clamp01((x - a.foot.x - 10 - 16) / 300);
const giant = {
    // 凍てつく息: 冷気が口に集まり、冷気のかたまりが渦を巻いて流れ出る（縁・青・水色・白の段。四角い光や帯は使わない）。氷のかけらが飛び、地面に霜
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const m = motionAt(a, 'giant')(STYLE.giant.mouth[0], STYLE.giant.mouth[1]);
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.44) { // 雪の結晶が口に吸い込まれる
                for (let i = 0; i < 18; i++) {
                    const ang = hash(i) * TAU, d0 = 24 + hash(i, 2) * 50, u = (gather * (0.7 + hash(i, 3)) + hash(i, 4)) % 1, d = d0 * (1 - u);
                    sparkle(ctx, m.x + Math.cos(ang) * d, m.y + Math.sin(ang) * d * 0.7, 1 + (i % 2), '#ffffff', u);
                }
                for (let i = 0; i < 5; i++) {
                    const an = p * 30 + i * 1.26, r = 3 + 3 * gather;
                    ctx.fillStyle = i % 2 ? '#a8dcff' : '#ffffff';
                    ctx.beginPath();
                    ctx.arc(R(m.x + 3 + Math.cos(an) * r), R(m.y + Math.sin(an) * r * 0.7), 1 + gather * 1.5, 0, TAU);
                    ctx.fill();
                } // 口の前で渦をまく冷気
            }
            const head = ease(win(p, 0.38, 0.44)), cut = win(p, 0.52, 0.62);
            if (head > 0 && cut < 1) {
                const reach = a.W + 30 - m.x;
                ctx.save();
                ctx.globalAlpha = 0.95;
                const A = aimOf(a), sa = streamAim(m, a.W, A.x + STREAM_AT.giant.dx, A.y + STREAM_AT.giant.dy, STREAM_AT.giant.drop, STREAM_AT.giant.spread); // 狙う人の頭の上を通る
                billowStream(ctx, m.x, m.y, reach, head, cut, p, FROST5, { drop: sa.drop, spread: sa.spread });
                ctx.restore();
                for (let i = 0; i < 14; i++) {
                    const t = (hash(i) + p * 3) % 1;
                    if (t > head || t < cut)
                        continue;
                    const x = m.x + reach * t, y = m.y + sa.drop * t + (hash(i, 2) - 0.5) * 90 * t;
                    shard(ctx, x, y, 5 + 5 * hash(i, 3), 3, 0.3 + (hash(i, 5) - 0.5), '#e6f6ff', '#ffffff', '#4a8ac0');
                }
                for (const v of heroes(a)) {
                    if (v.ok)
                        continue;
                    for (let i = 0; i < 4; i++) {
                        ctx.globalAlpha = 1 - cut;
                        shard(ctx, v.x - 8 + i * 5, v.y + 2, 8 + 5 * hash(i, v.f) * win(p, 0.42, 0.5), 3, -Math.PI / 2 + (hash(i, 9) - 0.5) * 0.6, '#e6f6ff', '#ffffff', '#4a8ac0');
                        ctx.globalAlpha = 1;
                    }
                } // 足もとが凍る
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#bfe8ff', 0.3);
            }
        },
    },
    // 氷柱の投げ槍: 振りかぶった手の上に、氷の槍が一本ずつ凍りついて増えていき（0.1〜0.34。狙う冒険者の数だけ、最大6本）、
    //   いっせいに投げる（0.38〜0.45）。槍は列ごとに飛んで、砕けて散る
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = motionAt(a, 'giant')(STYLE.giant.hand[0], STYLE.giant.hand[1]);
            const hs = heroes(a);
            const n = Math.max(1, Math.min(6, hs.length));
            const slot = (i) => { const c = i - (n - 1) / 2; return { x: h.x - 4 + c * 6, y: h.y - 16 - Math.abs(c) * 3 + c * 1.5, ang: -1.05 + c * 0.12 }; }; // 手の上に扇のように並ぶ
            const fly = win(p, 0.38, 0.47), fade = 1 - win(p, 0.5, 0.6);
            if (p < 0.4)
                for (let i = 0; i < n; i++) { // 一本ずつ凍りついて伸びる
                    const t0 = 0.12 + (i * 0.2) / n, g = ease(win(p, t0, t0 + 0.05));
                    if (g <= 0)
                        continue;
                    const q = slot(i), L = 8 + 26 * g;
                    iceSpear(ctx, q.x + Math.cos(q.ang) * L * 0.5, q.y + Math.sin(q.ang) * L * 0.5, q.ang, L);
                    if (g < 1) {
                        sparkle(ctx, q.x + Math.cos(q.ang) * L * 0.5 + 8, q.y + Math.sin(q.ang) * L * 0.5 - 4, 2 + 3 * (1 - g), '#ffffff', 1);
                        puffs(ctx, q.x, q.y, { n: 5, t: g, dx: 0, dy: -8, spread: 12, r0: 1, r1: 2.5, color: '#e6f6ff', alpha: 0.8 * (1 - g), seed: 95 + i });
                    }
                }
            if (fly > 0 && fade > 0) {
                const ts = hs.length ? hs.map((v) => landing(v, -12)) : [{ x: a.W - 50, y: 150 }];
                ts.forEach((t, i) => {
                    const q = slot(i % n), sx = q.x + Math.cos(q.ang) * 17, sy = q.y + Math.sin(q.ang) * 17;
                    const e = clamp01(fly * 1.2 - (i % n) * 0.04);
                    if (e <= 0)
                        return;
                    const x = lerp(sx, t.x, e), y = lerp(sy, t.y, e) - Math.sin(e * Math.PI) * 10, ang = Math.atan2(t.y - sy, t.x - sx);
                    ctx.globalAlpha = fade;
                    iceSpear(ctx, x, y, ang, 34);
                    ctx.fillStyle = '#ffffff';
                    for (let j = 1; j <= 3; j++)
                        ctx.fillRect(R(x - 34 - j * 7), R(y - 1 + (hash(j, i) - 0.5) * 4), 3, 1);
                    ctx.globalAlpha = 1;
                    if (e >= 1)
                        for (let k = 0; k < 6; k++) {
                            const aa = hash(k, i) * TAU, sp = 14 * win(p, 0.46, 0.58);
                            ctx.globalAlpha = fade;
                            shard(ctx, t.x + Math.cos(aa) * sp, t.y + Math.sin(aa) * sp, 6, 3, aa);
                            ctx.globalAlpha = 1;
                        }
                });
                screenFlash(ctx, a.W, a.H, bump(p, 0.44, 0.48), '#e6f6ff', 0.28);
            }
        },
    },
    // 踏みつけ: 片足を上げて踏みおろし、氷の衝撃波と氷の柱が床を走る（氷のとげが突き出す）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const b = win(p, 0.4, 0.6);
            if (b > 0 && b < 1) {
                ctx.save();
                ctx.strokeStyle = '#bfe8ff';
                ctx.lineWidth = 4 * (1 - b);
                ctx.globalAlpha = 1 - b;
                ctx.beginPath();
                ctx.ellipse(a.foot.x + 10, a.foot.y + 4, 16 + b * 300, 5 + b * 70, 0, -Math.PI / 2, Math.PI / 2);
                ctx.stroke();
                ctx.restore();
                screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.45), '#e6f6ff', 0.4);
            }
            for (const v of heroes(a)) { // 氷のとげが、衝撃波が届いた冒険者の足もと（元いた所）から突き出す（arrival.ts と同じ時刻）
                const t0 = giantStompAt(a, v.x), t = clamp01((p - t0 + 0.02) / 0.06);
                if (t <= 0)
                    continue;
                ctx.globalAlpha = 1 - win(p, t0 + 0.08, t0 + 0.16);
                for (let j = -1; j <= 1; j++)
                    shard(ctx, v.x + j * 6, v.y + 1 + Math.abs(j), (j ? 10 : 18 + 6 * hash(v.f)) * ease(t), j ? 4 : 6, -Math.PI / 2 + j * 0.25);
                ctx.globalAlpha = 1;
            }
            puffs(ctx, a.foot.x + 10, a.foot.y - 2, { n: 8, t: p * 2, dx: 20, dy: -8, spread: 30, r0: 2, r1: 6, color: '#e6f6ff', alpha: 0.6 * bump(p, 0.38, 0.6), seed: 91 });
        },
    },
    // 棍棒の薙ぎ払い: 氷の棍棒が、討伐隊ぜんたいを包む大きな弧をえがいて床を払う（冷気の帯・氷のかけら・霜の煙）。山場は 0.42〜0.44
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            giantSweep(a, spriteToWorld(a.foot, [60, 42]), SWEEP_AT.giant, GIANT_ARC, (x, y, i) => shard(ctx, x, y, 5 + hash(i, 3) * 6, 3, hash(i, 4) * TAU + p * 10, '#e6f6ff', '#ffffff', '#4a8ac0'), '#e6f6ff', '#e6f6ff');
        },
    },
};
const GOLEM_ARC = { line: '#2a1e12', dark: '#5a4a34', body: '#a8987a', hi: '#e8dcc0' };
const GIANT_ARC = { line: '#1e3a5a', dark: '#4a8ac0', body: '#a8dcff', hi: '#ffffff' };
/** 薙ぎ払いの弧が、狙う人（aimOf）の所で通る点（立ち位置からのずれ）。石の巨人は伏せた人の頭の上、氷の巨人は迎え撃つ所（MEET） */
export const SWEEP_AT = { golem: { dx: 0, dy: -36 }, giant: MEET };
/** 巨人の薙ぎ払いの弧の形。弧は床の高さで、奥から手前へ水平に回す（上から叩きつけて見えないように、つぶした楕円の上を通す）。
 *  楕円の大きさは、狙う人の所（aim ＋ at）を弧が通るように決める。弧の先の角度は lerp(a0, a1, ease(win(p, 0.35, 0.46)))。届く時刻を調べる（arrival.ts）でも使う */
export function giantSweepGeo(a, pivot, aim, at) {
    const sq = 0.3, cy = a.foot.y - 6, tx = aim.x + at.dx, ty = aim.y + at.dy;
    return { r: Math.max(40, Math.hypot(tx - pivot.x, (ty - cy) / sq)), sq, a0: -2.2, a1: 0.65, cy };
}
/** 巨人の薙ぎ払い（石の巨人・氷の巨人）: 肩 pivot を中心に、奥（左上）から手前の右まで、討伐隊ぜんたいを包む大きな弧を振り抜く。
 *  弧は 3本（太い帯・細い帯・先の閃き）。弧の先から、かけら（bit）と煙が飛び散る */
function giantSweep(a, pivot, at, P, bit, dust, flashCol) {
    const { ctx, phase: p } = a;
    const sw = ease(win(p, 0.35, 0.46)), fade = 1 - win(p, 0.5, 0.62);
    if (sw <= 0 || fade <= 0)
        return;
    const { r, sq, a0, a1, cy } = giantSweepGeo(a, pivot, aimOf(a), at);
    ctx.save();
    ctx.globalAlpha = fade;
    sweepArc(ctx, pivot.x, cy, r, a0, a1, sw, 22, sq, P, 0.7);
    ctx.globalAlpha = fade * 0.75;
    sweepArc(ctx, pivot.x, cy, r * 0.78, a0 + 0.15, a1, sw, 12, sq, P, 0.5);
    ctx.restore();
    const ang = lerp(a0, a1, sw), tx = pivot.x + Math.cos(ang) * r, ty = cy + Math.sin(ang) * r * sq;
    if (sw < 1)
        sparkle(ctx, tx, ty, 6, '#ffffff', fade);
    // 弧の先から飛び散るかけら（弧の通ったあとに残る）
    for (let i = 0; i < 14; i++) {
        const u = clamp01(sw - hash(i, 1) * 0.5);
        if (u <= 0)
            continue;
        const an = lerp(a0, a1, u), age = sw - u;
        const x = pivot.x + Math.cos(an) * r * (1 + age * 0.4) + age * 30, y = cy + Math.sin(an) * r * sq + age * 26 + 60 * age * age;
        ctx.globalAlpha = fade * (1 - age);
        bit(x, y, i);
        ctx.globalAlpha = 1;
    }
    puffs(ctx, tx, Math.min(206, ty + 4), { n: 10, t: sw * 3, dx: -40, dy: -10, spread: 16, r0: 2, r1: 7, color: dust, alpha: 0.75 * fade, seed: 85 });
    for (const v of heroes(a)) {
        if (v.ok)
            continue;
        const k = bump(p, 0.42, 0.5);
        if (k > 0)
            sparkle(ctx, v.x, v.y - 12, 3 + 4 * k, '#ffffff', k);
    }
    screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), flashCol, 0.28);
}
export const BOSS_FX = { vampire, spider, goblin, kraken, golem, giant };
/** 竜以外のボスの、ひとり分の飛び道具。描いたら true（共通の竜の炎・爪・隕石は描かない） */
export function attackHitFx(kind, atk, o) {
    if (kind === 'dragon')
        return false;
    const { ctx, phase: p, x, y, stopX, blocked, mouth, hand } = o;
    const ty = o.ty ?? y - 12;
    if (atk === 'breath') {
        const k = clamp01((p - 0.34) / 0.12);
        if (k <= 0 || k >= 1)
            return true;
        const fx = (t) => lerp(mouth.x, stopX, t), fy = (t) => lerp(mouth.y, ty, t);
        if (kind === 'vampire' && o.blocked)
            return true; // 伏せた人へは飛ばさない（蝙蝠の群れが、伏せた上を通りすぎる。vampire.breath）
        if (kind === 'vampire') {
            for (let i = 0; i < 5; i++) {
                const t = clamp01(k * 1.3 - i * 0.07);
                if (t > 0)
                    bat(ctx, fx(t) + (hash(i) - 0.5) * 8, fy(t) + (hash(i, 2) - 0.5) * 12 + Math.sin(t * 9 + i) * 4, (o.frame + i) % 2, '#1a0a24', 1.6);
            }
        }
        else if (kind === 'spider') {
            ctx.save();
            ctx.strokeStyle = '#f4f6ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mouth.x, mouth.y);
            ctx.lineTo(fx(k), fy(k));
            ctx.stroke();
            if (!blocked)
                webNet(ctx, stopX, ty, 18, win(k, 0.7, 1));
            ctx.restore();
        } // 正しく動けた人の前では、糸は斬られて巣にならない
        else if (kind === 'goblin') {
            const a = Math.PI - 1.9, sy = -10, sx = stopX - (ty - sy) / Math.tan(a);
            arrow(ctx, lerp(sx, stopX, k), lerp(sy, ty, k), a, 14);
        } // 矢の雨と同じく、左上（ゴブリンの陣）から右下へ
        else if (kind === 'kraken') {
            ctx.save();
            ctx.strokeStyle = '#120a22';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(mouth.x, mouth.y);
            ctx.lineTo(fx(k), fy(k) - Math.sin(k * Math.PI) * 10);
            ctx.stroke();
            ctx.fillStyle = '#3a1a5a';
            ctx.beginPath();
            ctx.ellipse(stopX, y + 4, 3 + 9 * win(k, 0.7, 1), 1 + 3 * win(k, 0.7, 1), 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        else if (kind === 'golem') {
            rock(ctx, fx(k), fy(k) - Math.sin(k * Math.PI) * 30, 5, o.frame / 3, 2, '#8a7a62', '#b8a888', '#3a2a1a');
        }
        else if (kind === 'giant') {
            for (let i = 0; i < 4; i++) {
                const t = clamp01(k * 1.3 - i * 0.06);
                if (t > 0)
                    shard(ctx, fx(t), fy(t) + (hash(i) - 0.5) * 10, 8, 3, 0.3, '#e6f6ff', '#ffffff', '#6aaee0');
            }
        }
        return true;
    }
    if (atk === 'claw') {
        const k = clamp01((p - 0.4) / 0.06);
        if (k <= 0 || k >= 1)
            return true;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.5;
        if (kind === 'vampire') {
            ctx.globalAlpha = 0.8;
            for (let i = 0; i < 3; i++)
                slashMark(ctx, stopX - 10 + i * 5, y - 30, stopX - 2 + i * 5, y - 4, 2.5, -2, ease(clamp01(k * 1.4 - i * 0.15)), VAMP_RIP);
        } // ひとり分の、三本の爪痕
        else if (kind === 'spider') {
            ctx.fillStyle = '#7bed9f';
            ctx.fillRect(R(stopX - 4), R(y - 16), 2, 3);
            ctx.fillRect(R(stopX + 3), R(y - 16), 2, 3);
            fangShape(ctx, stopX - 3, y - 30 + 12 * k, 12, 5, Math.PI / 2 + 0.1);
            fangShape(ctx, stopX + 4, y - 30 + 12 * k, 12, 5, Math.PI / 2 - 0.1);
        }
        else if (kind === 'goblin') {
            ctx.fillStyle = '#1a1008';
            ctx.beginPath();
            ctx.ellipse(stopX, y + 2, 3 + 12 * k, 1 + 4 * k, 0, 0, TAU);
            ctx.fill();
        }
        else if (kind === 'kraken') {
            ctx.strokeStyle = '#8a2a6a';
            ctx.lineWidth = 6 * (1 - k * 0.4);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(stopX - 4, y - 14, 18, -1.6 + k * 1.2, -0.4 + k * 1.2);
            ctx.stroke();
        }
        else if (kind === 'golem') {
            ctx.strokeStyle = '#c8b48a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(stopX, y + 2, 4 + 18 * k, 1.5 + 5 * k, 0, 0, TAU);
            ctx.stroke();
        }
        else if (kind === 'giant') {
            const ex = blocked && !o.pass ? x - 34 : stopX, ey = blocked && !o.pass ? y - 10 : ty;
            iceSpear(ctx, lerp(hand.x, ex, k), lerp(hand.y, ey, k), Math.atan2(ey - hand.y, ex - hand.x), 24);
        } // 正しく動けた人は、手前の空中で撃ち落とす（counterfx.ts の shootDown）
        ctx.restore();
        return true;
    }
    if (atk === 'meteor') {
        const k = clamp01((p - 0.3) / 0.12), by = blocked ? y - 30 : y - 6;
        if (k > 0 && k < 1) {
            const cx = lerp(x + 30, stopX + 4, k), cy = lerp(-20, by, k);
            if (kind === 'vampire') {
                for (let i = 0; i < 5; i++)
                    bat(ctx, cx + (hash(i) - 0.5) * 14, cy - i * 5 + (hash(i, 2) - 0.5) * 8, (o.frame + i) % 2, '#1a0a24', 1.6);
            }
            else if (kind === 'spider') {
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(stopX + 4, -10);
                ctx.lineTo(stopX + 4, cy);
                ctx.stroke();
                ctx.fillStyle = '#e4e7f0';
                ctx.beginPath();
                ctx.ellipse(stopX + 4, cy, 6, 7, 0, 0, TAU);
                ctx.fill();
            }
            else if (kind === 'goblin' || kind === 'golem')
                rock(ctx, cx, cy, kind === 'golem' ? 8 : 6, o.frame / 3, 4, '#7a6a52', '#a8987a', '#3a2a1a');
            else if (kind === 'kraken') {
                ctx.fillStyle = '#bfe8ff';
                ctx.fillRect(R(stopX - 4), R(by - 44 * k), 8, R(44 * k));
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(stopX - 1), R(by - 44 * k), 2, R(44 * k));
            }
            else if (kind === 'giant')
                shard(ctx, cx, cy, 16, 6, Math.PI / 2 + 0.3, '#e6f6ff', '#ffffff', '#6aaee0');
        }
        const kb = clamp01((p - 0.42) / 0.06);
        if (kb > 0 && kb < 1) {
            const col = { vampire: '#c070ff', spider: '#e4e7f0', goblin: '#c8b48a', kraken: '#bfe8ff', golem: '#c8b48a', giant: '#e6f6ff' }[kind];
            dustRing(ctx, stopX, blocked ? y - 30 : y - 4, kb, 34, col);
        }
        return true;
    }
    return false;
}
/** 尾の攻撃のとき床をはしる帯（竜は砂ぼこり）。竜以外は、ボスごとの色で */
export function tailBandColors(kind) {
    switch (kind) {
        case 'vampire': return ['#6a3a8a', '#3a1a52'];
        case 'spider': return ['#9a8aa8', '#5a4a60'];
        case 'goblin': return ['#c8b48a', '#8a7450'];
        case 'kraken': return ['#bfe8ff', '#5fb3e6'];
        case 'golem': return ['#c8b48a', '#8a7a52'];
        case 'giant': return ['#e6f6ff', '#9fd8ff'];
        default: return null;
    }
}
export function bossFxFor(kind, scene) {
    if (!kind || !scene)
        return null;
    const k = BOSS_FX[kind];
    return k?.[scene] ?? null;
}
//# sourceMappingURL=bossfx.js.map